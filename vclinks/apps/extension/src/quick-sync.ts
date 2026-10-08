/**
 * Pure logic of the fast path that gets a new Zalo message into the DB within
 * seconds, whatever conversation is open (content.ts wires it to the page):
 *
 * - a poll reads the last few records of the `message` store every ~4 s
 *   (slower while the tab is hidden, backing off on errors, one tick at a time);
 * - when that tail changed, a light sync (sync.ts runLightSync) posts the new
 *   messages and their conversations;
 * - DOM content the API could not attach yet (`unmatched`: its metadata was not
 *   ingested) waits in a retry queue instead of being dropped.
 *
 * No chrome.*, no DOM, no IndexedDB here: everything is injected, so it is unit
 * tested in test/quick-sync.test.ts. Nothing here logs record contents.
 */

// ---------------------------------------------------------------- light sync window

/**
 * Oldest send time the light sync must still read: everything past the API
 * checkpoint, and own recent messages whose delivery status may still change.
 * Without a checkpoint (never synced) only the recent window: the full sync
 * reads the rest.
 */
export function lightWindowStart(checkpoint: number | null, recentSince: number): number {
  return checkpoint === null ? recentSince : Math.min(checkpoint, recentSince);
}

/**
 * Stop predicate for a newest-first walk: true once `run` consecutive records
 * have a cursor older than `since`. A record without a readable cursor breaks
 * the run (it might be new). Stateful: make one per walk.
 */
export function oldRunStop(since: number, cursorOf: (record: unknown) => unknown, run: number): (record: unknown) => boolean {
  let old = 0;
  return (record) => {
    const v = cursorOf(record);
    const n = v === undefined || v === null || v === '' ? NaN : Number(v);
    old = Number.isFinite(n) && n < since ? old + 1 : 0;
    return old >= run;
  };
}

// ---------------------------------------------------------------- poll: did the tail change?

/** How many records from the end of the message store each poll reads. */
export const POLL_TAIL_SIZE = 20;

/** Raw-record field names (from the active mapping) that make up a tail signature. */
export interface TailFields {
  /** e.g. `msgId` */
  id: string;
  /** e.g. `sendDttm` */
  sentAt?: string;
  /** e.g. `status` (1 sent → 2 received → 3 seen) */
  status?: string;
  /** e.g. `msgType` (turns into the recall type on recall) */
  msgType?: string;
}

/**
 * Compact fingerprint of the newest records: ids, send times, delivery status
 * and type. Any new record, status change (1 → 2 → 3) or recall among them
 * changes it. Ids and numbers only, never message content; kept in memory, never logged.
 */
export function tailSignature(records: readonly unknown[], f: TailFields): string {
  const part = (r: unknown, path: string | undefined) => {
    if (!path || !r || typeof r !== 'object') return '';
    const v = (r as Record<string, unknown>)[path];
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
  };
  return records.map((r) => [part(r, f.id), part(r, f.sentAt), part(r, f.status), part(r, f.msgType)].join(':')).join('|');
}

/**
 * Remembers the last tail signature per account. `changed` is true on the first
 * look (catch up on what arrived while the page was closed) and whenever the
 * signature differs. `commit` stores it only after the light sync succeeded, so
 * a failed sync is retried on the next poll.
 */
export class TailTracker {
  private readonly seen = new Map<string, string>();

  changed(uid: string, sig: string): boolean {
    return this.seen.get(uid) !== sig;
  }

  commit(uid: string, sig: string): void {
    this.seen.set(uid, sig);
  }
}

// ---------------------------------------------------------------- poll loop

export const POLL_VISIBLE_MS = 4_000;
/**
 * While the tab is hidden. Chrome may throttle timers of hidden tabs further
 * (at most once a minute after ~5 min hidden, "intensive throttling").
 */
export const POLL_HIDDEN_MS = 15_000;
export const POLL_MAX_BACKOFF_MS = 60_000;
/** Ticks are at least this far apart, however often they are nudged. */
export const POLL_MIN_GAP_MS = 1_000;

/** Delay before the next tick: slower while hidden, doubled per consecutive failure (capped). */
export function nextPollDelay(hidden: boolean, failures: number): number {
  const base = hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS;
  if (failures <= 0) return base;
  return Math.min(base * 2 ** Math.min(failures, 10), POLL_MAX_BACKOFF_MS);
}

export interface PollerDeps {
  /** One poll. A rejection counts as a failure (backoff). */
  tick: () => Promise<void>;
  hidden: () => boolean;
  /** False stops the loop for good (e.g. the extension was reloaded). */
  alive?: () => boolean;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
}

export interface Poller {
  start(): void;
  /** Run a tick within `delayMs` (sooner than scheduled); never two ticks at once. */
  nudge(delayMs: number): void;
  stop(): void;
  readonly failures: number;
  readonly inFlight: boolean;
}

/**
 * Self-scheduling loop: exactly one timer or one running tick at a time, so
 * ticks never overlap. A nudge during a tick runs another tick right after it
 * (respecting POLL_MIN_GAP_MS); a nudge while waiting brings the timer forward.
 */
export function createPoller(deps: PollerDeps): Poller {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let dueAt = Infinity;
  let running = false;
  let stopped = true;
  let failures = 0;
  let lastTickAt = -Infinity;
  let nudgedDuringTick: number | null = null;

  const schedule = (ms: number) => {
    if (stopped) return;
    const wait = Math.max(ms, lastTickAt + POLL_MIN_GAP_MS - now(), 0);
    if (timer !== null) {
      if (now() + wait >= dueAt) return; // already due sooner
      clearTimer(timer);
    }
    dueAt = now() + wait;
    timer = setTimer(fire, wait);
  };

  const fire = async () => {
    timer = null;
    dueAt = Infinity;
    if (stopped) return;
    if (deps.alive && !deps.alive()) {
      stopped = true;
      return;
    }
    running = true;
    lastTickAt = now();
    try {
      await deps.tick();
      failures = 0;
    } catch {
      failures++;
    } finally {
      running = false;
    }
    const nudged = nudgedDuringTick;
    nudgedDuringTick = null;
    const regular = nextPollDelay(deps.hidden(), failures);
    schedule(nudged !== null && failures === 0 ? Math.min(nudged, regular) : regular);
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      schedule(0);
    },
    nudge(delayMs) {
      if (stopped) return;
      if (running) nudgedDuringTick = Math.min(nudgedDuringTick ?? Infinity, delayMs);
      else schedule(delayMs);
    },
    stop() {
      stopped = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      dueAt = Infinity;
    },
    get failures() {
      return failures;
    },
    get inFlight() {
      return running;
    },
  };
}

// ---------------------------------------------------------------- unmatched content retries

/** Retry delays after a post came back unmatched; after the last one the item is parked. */
export const UNMATCHED_RETRY_DELAYS_MS: readonly number[] = [3_000, 8_000, 20_000];
/** A parked item is revived this many times at most (after light syncs that brought new records). */
export const UNMATCHED_MAX_REVIVALS = 3;
/** Most items kept (waiting + parked); the oldest go first. */
export const UNMATCHED_MAX_ITEMS = 500;

interface RetryEntry<T> {
  item: T;
  attempt: number;
  dueAt: number;
  parked: boolean;
  revivals: number;
}

/**
 * Message content the API answered `unmatched` for (its cliMsgId has no
 * metadata yet: the DOM is often a few seconds ahead of IndexedDB). Each item is
 * retried after 3 s, 8 s and 20 s, then parked; a light sync that brought new
 * records makes everything due at once (`expedite`), parked items included, up
 * to UNMATCHED_MAX_REVIVALS times. An item is given up (`settle` returns it in
 * `dropped`) only after that. Items stay in memory only, never logged.
 */
export class UnmatchedRetryQueue<T> {
  private readonly entries = new Map<string, RetryEntry<T>>();

  constructor(
    private readonly delays: readonly number[] = UNMATCHED_RETRY_DELAYS_MS,
    private readonly maxRevivals = UNMATCHED_MAX_REVIVALS,
    private readonly maxItems = UNMATCHED_MAX_ITEMS,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Queues items that just came back unmatched (already queued ids keep their schedule). */
  add(items: ReadonlyArray<{ id: string; item: T }>, now: number): void {
    for (const { id, item } of items) {
      if (this.entries.has(id)) continue;
      this.entries.set(id, { item, attempt: 0, dueAt: now + this.delays[0]!, parked: false, revivals: 0 });
    }
    // Map keeps insertion order: evict the oldest.
    while (this.entries.size > this.maxItems) this.entries.delete(this.entries.keys().next().value as string);
  }

  /** Items due now (not parked), to be posted again. */
  due(now: number): { id: string; item: T }[] {
    const out: { id: string; item: T }[] = [];
    for (const [id, e] of this.entries) if (!e.parked && e.dueAt <= now) out.push({ id, item: e.item });
    return out;
  }

  /**
   * Result of re-posting `ids`: those not in `unmatched` matched and leave the
   * queue (`matched`); the others move to their next delay, get parked, or are
   * given up for good (`dropped`) once revivals are spent.
   */
  settle(ids: readonly string[], unmatched: ReadonlySet<string>, now: number): { matched: string[]; dropped: string[] } {
    const matched: string[] = [];
    const dropped: string[] = [];
    for (const id of ids) {
      const e = this.entries.get(id);
      if (!e) continue;
      if (!unmatched.has(id)) {
        this.entries.delete(id);
        matched.push(id);
        continue;
      }
      e.attempt++;
      if (e.attempt < this.delays.length) {
        e.dueAt = now + this.delays[e.attempt]!;
      } else if (e.revivals < this.maxRevivals) {
        e.parked = true;
        e.dueAt = Infinity;
      } else {
        this.entries.delete(id);
        dropped.push(id);
      }
    }
    return { matched, dropped };
  }

  /**
   * New metadata just landed (light sync posted records): make every item due
   * now. Parked items come back for one more attempt each.
   */
  expedite(now: number): void {
    for (const e of this.entries.values()) {
      if (e.parked) {
        e.parked = false;
        e.revivals++;
        e.attempt = this.delays.length - 1; // one attempt, then parked (or dropped) again
      }
      e.dueAt = Math.min(e.dueAt, now);
    }
  }

  /** Ms until the next item is due (0 = now), or null when nothing waits. */
  nextDueIn(now: number): number | null {
    let min = Infinity;
    for (const e of this.entries.values()) if (!e.parked) min = Math.min(min, e.dueAt);
    return min === Infinity ? null : Math.max(0, min - now);
  }
}

/**
 * Content is posted to every account (the DOM does not say which owns the
 * chat): an id is really unmatched only when no account matched it.
 */
export function unmatchedInAll(perAccount: ReadonlyArray<readonly string[]>): Set<string> {
  if (!perAccount.length) return new Set();
  let acc = new Set(perAccount[0]);
  for (const list of perAccount.slice(1)) {
    const next = new Set(list);
    acc = new Set([...acc].filter((id) => next.has(id)));
  }
  return acc;
}

// ---------------------------------------------------------------- accepted by light syncs

/**
 * Records light syncs inserted per (uid, stream) since the last full sync, for
 * SyncOptions.priorAccepted. `take` returns the counts and resets them (call it
 * when a full sync starts: its reportSync becomes the new baseline).
 */
export class AcceptedTally {
  private counts = new Map<string, number>();

  add(uid: string, stream: string, n: number): void {
    if (n <= 0) return;
    const k = `${uid}:${stream}`;
    this.counts.set(k, (this.counts.get(k) ?? 0) + n);
  }

  take(): (uid: string, stream: string) => number {
    const snapshot = this.counts;
    this.counts = new Map();
    return (uid, stream) => snapshot.get(`${uid}:${stream}`) ?? 0;
  }
}
