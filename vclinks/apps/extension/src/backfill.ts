import { DEFAULT_DOM_SELECTORS, MAX_BATCH_SIZE, type DomSelectors } from '@vclinks/shared';
import {
  extractMessages,
  filterNew,
  findMessageScroller,
  readActiveThreadId,
  toContentItems,
  type MessageContentPayloadItem,
  type DomMessage,
} from './dom-reader';

/**
 * Backfill (docs/04-ky-thuat/zalo-web/zalo-web-extraction.md §4.4): scrolls up the message list of the
 * conversation the user ALREADY has open so Zalo renders older messages, and
 * captures the content of each newly rendered bubble.
 *
 * Safety rules:
 * - Never opens or switches conversations (that would mark chats read). If the
 *   open conversation changes mid-run, the run aborts.
 * - At most one scroll per second; at most `hourlyCap` runs per rolling hour
 *   (persisted, so reloading the page does not reset it).
 * - Stops when nothing new loads after `idleLimit` scrolls (web history limit),
 *   when every pending cliMsgId of the thread has been seen, on user stop, or
 *   after `maxScrolls`.
 *
 * No chrome.* here: everything is injected, so it is unit-testable with happy-dom.
 */

export type BackfillState = 'running' | 'done' | 'stopped' | 'aborted' | 'error';

export type BackfillReason =
  | 'reached_start' // nothing new after idleLimit scrolls (Zalo Web history limit)
  | 'web_history_start' // Zalo Web shows its "use Zalo PC for older messages" banner: nothing older to load
  | 'all_pending_seen'
  | 'max_scrolls'
  | 'stopped' // user pressed Stop
  | 'thread_changed' // the user switched conversation mid-run
  | 'tab_hidden' // the Zalo tab went to the background (no scroll rendering) mid-run
  | 'no_conversation' // no open conversation / nothing scrollable
  | 'rate_limited' // hourly cap reached
  | 'error';

export interface BackfillProgress {
  state: BackfillState;
  reason: BackfillReason | null;
  threadId: string | null;
  scrolls: number;
  /** Distinct bubbles seen during the run (including those on screen at start). */
  seen: number;
  /** Content items posted to the API. */
  posted: number;
  matched: number;
  unmatched: number;
  /** Pending cliMsgIds from the API (null = unknown), and how many were seen. */
  pendingTotal: number | null;
  pendingSeen: number;
  /** Epoch ms of the history start shown by Zalo Web's banner, when seen. */
  webHistoryFrom?: number;
  startedAt: number;
  finishedAt: number | null;
  message?: string;
}

/** Minimal persistent key/value store (chrome.storage.local in the extension). */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface BackfillOptions {
  /** Hard cap on scrolls per run (default 200). */
  maxScrolls?: number;
  /** Consecutive scrolls with no new bubble before stopping (default 3). */
  idleLimit?: number;
  /** Minimum time between two scrolls (default 1000 ms). */
  minScrollIntervalMs?: number;
  /** Quiet time after the last DOM mutation before reading (default 800 ms). */
  settleMs?: number;
  /** Max wait for new bubbles after a scroll (default 3000 ms). */
  loadTimeoutMs?: number;
  /** Runs allowed per rolling hour (default 20). */
  hourlyCap?: number;
  /** Scroll back to the newest message at the end (default true). */
  restoreBottom?: boolean;
  /** Count the run against `hourlyCap` (default true; the automatic sync paces itself). */
  rateLimited?: boolean;
  /** Stop once every pending cliMsgId was seen (default: !domOnly). */
  stopWhenPendingSeen?: boolean;
}

export interface BackfillDeps extends BackfillOptions {
  root: Document;
  dom?: DomSelectors;
  /** Posts one batch (≤ MAX_BATCH_SIZE) of content items. */
  /** `threadMismatch`: the API saw bubbles of another conversation (wrong chat on screen): stop. */
  post(items: MessageContentPayloadItem[]): Promise<{ matched: number; unmatched: number; threadMismatch?: boolean }>;
  /** Pending cliMsgIds of the thread, or null when unknown/unavailable. */
  pendingCliMsgIds?(threadId: string): Promise<string[] | null>;
  /** Called with every newly rendered message (e.g. to upload blob: photos right away). */
  onMessages?(msgs: DomMessage[]): void;
  /** Thread known to be open (from the caller that opened it), when the sidebar does not show it. */
  threadId?: string;
  /**
   * DOM-only mode (Dashboard fetch requests, account and thread confirmed):
   * items carry sender names, and the run scrolls to the oldest message Zalo
   * shows instead of stopping once the pending ids were seen, so history that
   * IndexedDB no longer has is captured too.
   */
  domOnly?: boolean;
  onProgress?(p: BackfillProgress): void;
  rateStore: KeyValueStore;
  signal?: AbortSignal;
  now?: () => number;
  /** Override for tests (happy-dom has no layout). Defaults to findMessageScroller. */
  findScroller?(root: ParentNode, dom: DomSelectors): Element | null;
}

export const BACKFILL_RATE_KEY = 'vclinks:backfill-runs';
const HOUR_MS = 60 * 60_000;

/**
 * Zalo Web's history start, surveyed 29/09/2026: the top of the message list
 * shows "Sử dụng Zalo PC để tìm tin nhắn trước ngày 15/09/2026." Nothing older
 * loads on Web, so scrolling further is wasted. Text inside message bubbles is
 * ignored (someone may type the same words in a chat).
 */
const WEB_HISTORY_BANNER = /Zalo PC[^\n]{0,80}?(?:trước ngày|before)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i;
/** Zalo's dates are Vietnam dates (UTC+7, no DST). */
const VN_OFFSET_MS = 7 * 60 * 60_000;

/** Epoch ms of the history-start date shown by the banner, or null when it is not rendered. */
export function readWebHistoryStart(scroller: Element): number | null {
  const doc = scroller.ownerDocument;
  const walker = doc.createTreeWalker(scroller, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.includes('Zalo PC')) continue;
    const host = n.parentElement;
    if (!host || host.closest('[id^="bb_msg_id_"]')) continue;
    const block = host.closest('div') ?? host;
    const m = WEB_HISTORY_BANNER.exec(block.textContent ?? '');
    if (!m) continue;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
    return Date.UTC(y, mo - 1, d) - VN_OFFSET_MS;
  }
  return null;
}

/** Identity of the open conversation: sidebar active item and chat header. */
export interface ActiveThread {
  threadId: string | null;
  header: string | null;
}

/**
 * Reads which conversation is open. threadId comes from the highlighted sidebar
 * item (`threadIdAttr`), the header from the chat title area. Best-effort: either
 * may be null when Zalo changes its markup; the scroller identity is checked too.
 */
export function readActiveThread(root: ParentNode, dom: DomSelectors = DEFAULT_DOM_SELECTORS): ActiveThread {
  const threadId = readActiveThreadId(root, dom);
  // First candidate that actually shows text: `#header [data-id*="Title"]` matches
  // the icon-only `btn_ChatTitle_Search` on Zalo Web (empty innerText) while
  // `#header` itself carries the name (verified 28/09/2026).
  let header: string | null = null;
  for (const q of [
    '[data-id*="ChatTitle" i]:not([data-id^="btn"])',
    '#header [data-id*="Title" i]:not([data-id^="btn"]), .chat-header [data-id*="Title" i], header [data-id*="Title" i]',
    '#header, .chat-header',
  ]) {
    for (const titleEl of root.querySelectorAll(q)) {
      const raw = (titleEl as HTMLElement).innerText ?? titleEl.textContent ?? '';
      // First line only: later lines (online status, "last seen") change over time.
      const first = raw.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
      header = first.replace(/\s+/g, ' ').slice(0, 200) || null;
      if (header) break;
    }
    if (header) break;
  }
  return { threadId, header };
}

/** Compares by threadId when both are known, otherwise by header name. */
function sameThread(a: ActiveThread, b: ActiveThread): boolean {
  if (a.threadId && b.threadId) return a.threadId === b.threadId;
  if (a.header) return a.header === b.header;
  return true; // no identity signal: the scroller identity check still applies
}

/** Returns true (and records the run) when another backfill run is allowed this hour. */
export async function takeHourlySlot(store: KeyValueStore, now: number, cap: number): Promise<boolean> {
  let runs: number[] = [];
  try {
    const got = await store.get(BACKFILL_RATE_KEY);
    if (Array.isArray(got)) runs = got.filter((t): t is number => typeof t === 'number');
  } catch {
    /* unreadable: start fresh */
  }
  runs = runs.filter((t) => now - t < HOUR_MS && t <= now);
  if (runs.length >= cap) return false;
  runs.push(now);
  await store.set(BACKFILL_RATE_KEY, runs);
  return true;
}

class Aborted extends Error {}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });

/**
 * Waits until the scroller's subtree changes and then stays quiet for `settleMs`,
 * or until `timeoutMs` passes with no change at all.
 */
function waitForSettle(target: Element, settleMs: number, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const Observer = target.ownerDocument.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      observer.disconnect();
      clearTimeout(settle);
      clearTimeout(timeout);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const observer = new Observer(() => {
      clearTimeout(settle);
      settle = setTimeout(finish, settleMs);
    });
    observer.observe(target, { childList: true, subtree: true });
    const timeout = setTimeout(finish, timeoutMs);
    signal?.addEventListener('abort', finish, { once: true });
  });
}

/**
 * Scrolls to the oldest loaded message. Assigning -scrollHeight works for both
 * normal lists (clamped to 0) and `column-reverse` lists (clamped to the top,
 * where scrollTop is negative in Chrome).
 */
function scrollToTop(el: Element) {
  el.scrollTop = -el.scrollHeight;
}

export async function runBackfill(deps: BackfillDeps): Promise<BackfillProgress> {
  const dom = deps.dom ?? DEFAULT_DOM_SELECTORS;
  const now = deps.now ?? Date.now;
  const maxScrolls = deps.maxScrolls ?? 200;
  const idleLimit = deps.idleLimit ?? 3;
  const minInterval = deps.minScrollIntervalMs ?? 1000;
  const settleMs = deps.settleMs ?? 800;
  const loadTimeoutMs = deps.loadTimeoutMs ?? 3000;
  const hourlyCap = deps.hourlyCap ?? 20;
  const findScroller = deps.findScroller ?? findMessageScroller;
  const { root, signal } = deps;

  const start = readActiveThread(root, dom);
  const progress: BackfillProgress = {
    state: 'running',
    reason: null,
    threadId: start.threadId ?? deps.threadId ?? null,
    scrolls: 0,
    seen: 0,
    posted: 0,
    matched: 0,
    unmatched: 0,
    pendingTotal: null,
    pendingSeen: 0,
    startedAt: now(),
    finishedAt: null,
  };
  const report = () => deps.onProgress?.({ ...progress });
  const finish = (state: BackfillState, reason: BackfillReason, message?: string) => {
    progress.state = state;
    progress.reason = reason;
    progress.finishedAt = now();
    if (message) progress.message = message.slice(0, 300);
    report();
    return { ...progress };
  };

  const scroller = findScroller(root, dom);
  if (!scroller) {
    // A short chat fits on one screen: nothing scrolls, so the rendered bubbles are everything Zalo Web loaded.
    // Read them instead of giving up (giving up made the automatic sync open the same chat again and again).
    const shown = extractMessages(root, dom);
    if (!shown.length || !(start.threadId ?? deps.threadId)) return finish('aborted', 'no_conversation');
    try {
      deps.onMessages?.(shown);
      const items = toContentItems(shown, now());
      for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
        const batch = items.slice(i, i + MAX_BATCH_SIZE);
        const r = await deps.post(batch);
        progress.posted += batch.length;
        progress.matched += r.matched;
        progress.unmatched += r.unmatched;
        if (r.threadMismatch) return finish('aborted', 'thread_changed');
      }
      progress.seen = shown.length;
      return finish('done', 'reached_start');
    } catch (e) {
      return finish('error', 'error', e instanceof Error ? e.message : String(e));
    }
  }
  if ((deps.rateLimited ?? true) && !(await takeHourlySlot(deps.rateStore, now(), hourlyCap))) {
    return finish('aborted', 'rate_limited');
  }

  const seen = new Set<string>();
  let buffer: MessageContentPayloadItem[] = [];
  let pending: Set<string> | null = null;

  const flush = async (all: boolean) => {
    while (buffer.length >= MAX_BATCH_SIZE || (all && buffer.length)) {
      const batch = buffer.slice(0, MAX_BATCH_SIZE);
      buffer = buffer.slice(batch.length);
      const r = await deps.post(batch);
      progress.posted += batch.length;
      progress.matched += r.matched;
      progress.unmatched += r.unmatched;
      if (r.threadMismatch) throw new Aborted('thread_changed');
    }
  };

  /** Reads rendered bubbles; returns how many were not seen before. */
  const absorb = (): number => {
    const fresh = filterNew(extractMessages(root, dom), seen);
    for (const m of fresh) {
      seen.add(m.cliMsgId);
      if (pending?.has(m.cliMsgId)) progress.pendingSeen++;
    }
    if (fresh.length) deps.onMessages?.(fresh);
    buffer.push(...toContentItems(fresh, now()));
    progress.seen = seen.size;
    return fresh.length;
  };

  /** Throws Aborted when the user stopped, the tab went hidden or the open conversation changed. */
  const guard = () => {
    if (signal?.aborted) throw new Aborted('stopped');
    // A background tab fires no scroll events, so the list would stop loading and
    // "nothing new after N scrolls" would be mistaken for the start of history.
    if (root.visibilityState === 'hidden') throw new Aborted('tab_hidden');
    const cur = readActiveThread(root, dom);
    if (!sameThread(start, cur) || !scroller.isConnected || findScroller(root, dom) !== scroller) {
      throw new Aborted('thread_changed');
    }
  };

  let reverse = false;
  try {
    const knownThreadId = start.threadId ?? deps.threadId;
    if (knownThreadId && deps.pendingCliMsgIds) {
      const ids = await deps.pendingCliMsgIds(knownThreadId).catch(() => null);
      if (ids) {
        pending = new Set(ids);
        progress.pendingTotal = pending.size;
      }
    }
    guard();
    absorb();
    await flush(true);
    report();

    const stopWhenPendingSeen = deps.stopWhenPendingSeen ?? !deps.domOnly;
    const allPendingSeen = () => stopWhenPendingSeen && pending != null && progress.pendingSeen >= pending.size;
    let idle = 0;
    let lastScrollAt = -Infinity;
    let reason: BackfillReason = 'max_scrolls';
    while (true) {
      if (allPendingSeen()) {
        reason = 'all_pending_seen';
        break;
      }
      const historyStart = readWebHistoryStart(scroller);
      if (historyStart != null) {
        progress.webHistoryFrom = historyStart;
        reason = 'web_history_start';
        break;
      }
      if (idle >= idleLimit) {
        reason = 'reached_start';
        break;
      }
      if (progress.scrolls >= maxScrolls) {
        reason = 'max_scrolls';
        break;
      }
      // Rate limit: at most one scroll per `minInterval`.
      await sleep(lastScrollAt + minInterval - now(), signal);
      guard();
      lastScrollAt = now();
      const settled = waitForSettle(scroller, settleMs, loadTimeoutMs, signal);
      scrollToTop(scroller);
      if (scroller.scrollTop < 0) reverse = true;
      progress.scrolls++;
      await settled;
      guard();
      idle = absorb() > 0 ? 0 : idle + 1;
      await flush(true);
      report();
    }
    await flush(true);
    return finish('done', reason);
  } catch (e) {
    // Content already captured belongs to the original conversation: still post it.
    try {
      await flush(true);
    } catch {
      /* reported below */
    }
    if (e instanceof Aborted) {
      if (e.message === 'stopped') return finish('stopped', 'stopped');
      return finish('aborted', e.message === 'tab_hidden' ? 'tab_hidden' : 'thread_changed');
    }
    return finish('error', 'error', e instanceof Error ? e.message : String(e));
  } finally {
    // Best-effort: back to the newest message, only if still the same conversation.
    if ((deps.restoreBottom ?? true) && scroller.isConnected && sameThread(start, readActiveThread(root, dom))) {
      scroller.scrollTop = reverse ? 0 : scroller.scrollHeight;
    }
  }
}

// ---- Messaging contract (popup → content script) and progress storage ----

export const BACKFILL_START = 'vclinks:backfill:start';
export const BACKFILL_STOP = 'vclinks:backfill:stop';
/** chrome.storage.local key holding the latest BackfillProgress. */
export const BACKFILL_PROGRESS_KEY = 'vclinks:backfill';

export interface BackfillStartMessage {
  type: typeof BACKFILL_START;
}
export interface BackfillStopMessage {
  type: typeof BACKFILL_STOP;
}
export type BackfillStartResponse = { accepted: true } | { accepted: false; reason: 'busy' };
export type BackfillStopResponse = { stopped: boolean };
