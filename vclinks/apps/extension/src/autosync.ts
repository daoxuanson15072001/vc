import type { AutoSyncMode, AutoSyncOutcome, AutoSyncPlanItem, AutoSyncResult } from '@vclinks/shared';
import type { BackfillProgress } from './backfill';

/**
 * Automatic content sync (shared/autosync.ts), run from the Zalo Web tab while
 * the user is idle:
 *
 * 1. First sidebar page, top to bottom: open each conversation still missing
 *    content and capture only what is on screen (`screen`, no scrolling).
 * 2. Then the plan (newest first): scroll each conversation back (`deep`) until
 *    Zalo Web shows nothing older, or, once a deep pass reached that point,
 *    until every message still missing content was seen.
 *
 * Never opens a conversation with unread messages. Any user input in the tab
 * stops the current run at once; it is retried later.
 * No chrome.* here: everything is injected, so it is unit-testable.
 */

export interface AutoSyncApi {
  plan(uid: string): Promise<AutoSyncPlanItem[]>;
  result(r: AutoSyncResult): Promise<unknown>;
}

/** One rendered sidebar item, in screen order. */
export interface SidebarItem {
  threadId: string;
  unread: boolean;
}

export type OpenOutcome = { ok: true } | { ok: false; code: 'unread' | 'not_found' | 'error'; error: string };

/** Why a run cannot start now. */
export type AutoSyncBlock = 'disabled' | 'tab_hidden' | 'user_active' | 'busy';

export interface AutoSyncDeps {
  api: AutoSyncApi;
  /** Account logged in on this tab; null when unknown. */
  loggedInUid(): Promise<string | null>;
  /** Rendered sidebar items (the first page when the list is at the top). */
  firstPage(): SidebarItem[];
  /** Null when a run may start now. */
  blocked(): AutoSyncBlock | null;
  /** Opens the conversation (refusing unread ones) and confirms it is the active one. */
  open(item: AutoSyncPlanItem): Promise<OpenOutcome>;
  /** Captures the open conversation; stops when `signal` aborts. */
  capture(uid: string, item: AutoSyncPlanItem, mode: AutoSyncMode, signal: AbortSignal): Promise<BackfillProgress>;
  /** Epoch ms of the last real user input in the tab. */
  lastUserActivity(): number;
  /** True when a Dashboard request wants the UI: the current run stops and is retried later. */
  preempted?(): boolean;
  /**
   * True on a nick that opens unread conversations too (máy Zalo option): nobody uses that tab, so the loop
   * looks for new work every few seconds instead of every 15 s and refreshes its plan more often.
   */
  fast?(): boolean;
  now?: () => number;
  log?: (m: string) => void;
}

/**
 * Per page-load memory: which threads were already tried in each mode. Deep
 * tries are keyed `threadId:pending`, so new messages without content bring a
 * thread back within the same session.
 */
export interface AutoSyncState {
  screenDone: Set<string>;
  deepTried: Set<string>;
  /** Fast nick: `threadId@newestPendingAt` already given a quick screen capture. */
  freshDone: Set<string>;
  plan: { uid: string; at: number; items: AutoSyncPlanItem[] } | null;
  /** Fast nick: new messages arrived (nudge) since the step started; a running deep pass gives way to them. */
  freshSignal: boolean;
}

export const newAutoSyncState = (): AutoSyncState => ({ screenDone: new Set(), deepTried: new Set(), freshDone: new Set(), plan: null, freshSignal: false });

/** Fast nick: messages without content sent this recently count as new and are captured before any history. */
export const FRESH_MS = 24 * 60 * 60_000;
const freshKey = (i: AutoSyncPlanItem) => `${i.threadId}@${i.newestPendingAt ?? ''}`;

/** The plan is fetched again after this long, or right after a run. */
export const PLAN_TTL_MS = 60_000;
/** Same, on a `fast` nick (one small API call every few seconds while idle). */
export const FAST_PLAN_TTL_MS = 8_000;
/** How often a running capture checks for user input. */
const WATCH_MS = 250;

export type StepResult =
  | { worked: false; why: AutoSyncBlock | 'no_account' | 'nothing_to_do' }
  | { worked: true; threadId: string; mode: AutoSyncMode; outcome: AutoSyncOutcome };

const deepKey = (i: AutoSyncPlanItem) => `${i.threadId}:${i.pending}`;

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

/** Picks and runs at most one job. */
export async function autoSyncStep(state: AutoSyncState, deps: AutoSyncDeps): Promise<StepResult> {
  const now = deps.now ?? Date.now;
  const block = deps.blocked();
  if (block) return { worked: false, why: block };
  const uid = await deps.loggedInUid();
  if (!uid) return { worked: false, why: 'no_account' };

  if (!state.plan || state.plan.uid !== uid || now() - state.plan.at > (deps.fast?.() ? FAST_PLAN_TTL_MS : PLAN_TTL_MS)) {
    state.plan = { uid, at: now(), items: await deps.api.plan(uid) };
  }
  const byThread = new Map(state.plan.items.map((i) => [i.threadId, i]));

  const report = async (item: AutoSyncPlanItem, mode: AutoSyncMode, outcome: AutoSyncOutcome, p?: BackfillProgress, error?: string) => {
    state.plan = null; // counts changed: fetch a fresh plan next time
    await deps.api
      .result({
        uid,
        threadId: item.threadId,
        mode,
        outcome,
        ...(p?.reason ? { reason: p.reason } : {}),
        ...(p ? { posted: p.posted } : {}),
        ...(p?.webHistoryFrom != null ? { webHistoryFrom: p.webHistoryFrom } : {}),
        ...(error ? { error: error.slice(0, 300) } : {}),
      })
      .catch((e) => deps.log?.(`VClinks autosync: result not reported: ${errText(e)}`));
    deps.log?.(`VClinks autosync: ${mode} ${outcome}${p ? ` (${p.reason}, posted ${p.posted})` : ''}`);
    return { worked: true as const, threadId: item.threadId, mode, outcome };
  };

  const run = async (item: AutoSyncPlanItem, mode: AutoSyncMode, mark?: { set: Set<string>; key: string }): Promise<StepResult> => {
    const m = mark ?? (mode === 'screen' ? { set: state.screenDone, key: item.threadId } : { set: state.deepTried, key: deepKey(item) });
    m.set.add(m.key);
    const startedAt = now();
    let opened: OpenOutcome;
    try {
      opened = await deps.open(item);
    } catch (e) {
      opened = { ok: false, code: 'error', error: errText(e) };
    }
    if (!opened.ok) {
      const outcome: AutoSyncOutcome =
        opened.code === 'unread' ? 'skipped_unread' : opened.code === 'not_found' ? 'not_found' : 'error';
      return report(item, mode, outcome, undefined, opened.error);
    }
    const ctl = new AbortController();
    const watch = setInterval(() => {
      if (deps.lastUserActivity() > startedAt || deps.blocked() === 'tab_hidden' || deps.preempted?.()) ctl.abort();
      // Fast nick: a history pass gives way to messages that just arrived.
      if (mode === 'deep' && state.freshSignal && deps.fast?.()) ctl.abort();
    }, WATCH_MS);
    let p: BackfillProgress;
    try {
      p = await deps.capture(uid, item, mode, ctl.signal);
    } finally {
      clearInterval(watch);
    }
    if (p.state === 'done') return report(item, mode, 'done', p);
    if (p.state === 'error') return report(item, mode, 'error', p, p.message);
    // Nothing to read or the hourly cap: retrying at once would loop on this thread; the API retries it later.
    if (p.reason === 'no_conversation' || p.reason === 'rate_limited') return report(item, mode, 'error', p, `capture ${p.reason}`);
    // Stopped by the user, the tab or newer work: try this thread again later in this session.
    m.set.delete(m.key);
    return report(item, mode, 'aborted', p);
  };

  // 0. Fast nick: newest messages without content first, one quick screen capture each (no scrolling), so their
  //    content shows a few seconds after they arrive. History (deep passes) runs only when nothing new waits.
  if (deps.fast?.()) {
    state.freshSignal = false;
    const fresh = state.plan.items
      .filter((i) => i.newestPendingAt && now() - Date.parse(i.newestPendingAt) < FRESH_MS && !state.freshDone.has(freshKey(i)))
      .sort((a, b) => Date.parse(b.newestPendingAt!) - Date.parse(a.newestPendingAt!));
    if (fresh[0]) return run(fresh[0], 'screen', { set: state.freshDone, key: freshKey(fresh[0]) });
  }

  // 1. First sidebar page: what is on screen, top to bottom.
  for (const s of deps.firstPage()) {
    if (state.screenDone.has(s.threadId)) continue;
    const item = byThread.get(s.threadId);
    if (!item) continue;
    if (s.unread) {
      state.screenDone.add(s.threadId);
      return report(item, 'screen', 'skipped_unread');
    }
    return run(item, 'screen');
  }
  // 2. Everything else still missing content, newest first.
  for (const item of state.plan.items) {
    if (!state.deepTried.has(deepKey(item))) return run(item, 'deep');
  }
  return { worked: false, why: 'nothing_to_do' };
}

/** Idle-loop timing. */
export const AUTOSYNC_TIMING = {
  /** Between two conversations (keeps the pace human-like). */
  betweenJobsMs: 2_000,
  /** When there is nothing to do or the tab is busy. */
  idleMs: 15_000,
  /** The same on a `fast` nick. */
  fastIdleMs: 4_000,
  firstDelayMs: 10_000,
};

/** Stops the loop; `nudge()` says new messages arrived (fast nicks capture them at once). */
export type AutoSyncHandle = (() => void) & { nudge(): void };

/** Delay of the step started by a nudge (lets the light sync's posts settle). */
const NUDGE_MS = 300;

/**
 * Starts the loop. `withLock` runs a step only when this tab holds the shared
 * UI lock (sender and Dashboard fetches use the same one).
 */
export function startAutoSync(
  deps: AutoSyncDeps,
  opts: { withLock?: (fn: () => Promise<void>) => Promise<void>; timing?: Partial<typeof AUTOSYNC_TIMING> } = {},
): AutoSyncHandle {
  const t = { ...AUTOSYNC_TIMING, ...opts.timing };
  const withLock = opts.withLock ?? ((fn) => fn());
  const state = newAutoSyncState();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tick(), ms);
  };
  const tick = async () => {
    if (stopped) return;
    running = true;
    let worked = false;
    try {
      await withLock(async () => {
        worked = (await autoSyncStep(state, deps)).worked;
      });
    } catch (e) {
      deps.log?.(`VClinks autosync: ${errText(e)}`);
    } finally {
      running = false;
      if (!stopped) schedule(worked ? t.betweenJobsMs : deps.fast?.() ? t.fastIdleMs : t.idleMs);
    }
  };
  schedule(t.firstDelayMs);
  const nudge = () => {
    if (stopped || !deps.fast?.()) return;
    state.plan = null;
    state.freshSignal = true;
    if (!running) schedule(NUDGE_MS);
  };
  return Object.assign(
    () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    { nudge },
  );
}
