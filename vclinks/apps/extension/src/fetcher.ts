import type { FetchRequest, FetchResult, FetchWaiting } from '@vclinks/shared';
import type { AccountPresence } from './account-detect';
import type { BackfillProgress, BackfillReason } from './backfill';
import { USER_IDLE_MS } from './sender';

/**
 * Fetcher: the Dashboard asks for a conversation's content (user opened it and
 * part of it is still missing). The extension opens that conversation in the
 * Zalo Web sidebar and runs a backfill (scroll up, capture rendered bubbles).
 *
 * Opening a conversation marks it read on Zalo, so this only ever runs for an
 * explicit Dashboard request, never on its own. It waits until the user has
 * been idle in the Zalo tab, and never runs next to the sender or a manual
 * backfill (the caller serialises them). Ids only: no message text here.
 */

/** Sent with every poll, so the Dashboard can tell whether the right tab is there. */
export interface PollPresence {
  loggedIn: boolean | null;
  waiting: FetchWaiting | null;
}

export interface FetcherApi {
  /** `waitSec` > 0: long-poll, the API holds the call until a request is queued. */
  pending(uid: string, presence: PollPresence, waitSec?: number): Promise<FetchRequest[]>;
  claim(id: string): Promise<FetchRequest>;
  result(id: string, r: FetchResult): Promise<unknown>;
}

export interface FetcherDeps {
  api: FetcherApi;
  /** Accounts in this browser and whether each is the one logged in on this tab. */
  accounts: () => Promise<AccountPresence[]>;
  /**
   * Opens the conversation in the sidebar and verifies it is the active one.
   * `name` finds it through search when it is not rendered; `recentCliMsgIds`
   * confirm the open conversation from its bubbles. `allowUnread`: the Dashboard request was confirmed knowing the
   * sender will see "Đã xem".
   */
  open: (threadId: string, hint: { name?: string; recentCliMsgIds?: string[]; allowUnread?: boolean }) => Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Backfills the conversation now open (`threadId` = the one just opened).
   * `deep`: scroll to the start of Zalo Web history (first run for this chat);
   * otherwise stop once every message still missing content was seen.
   */
  backfill: (threadId: string, uid: string, opts: { deep: boolean }) => Promise<BackfillProgress>;
  /** True while the Zalo tab is in the background (Chrome throttles it, the list stops rendering). */
  tabHidden?: () => boolean;
  /** False while the sender / a manual backfill is using the conversation list. */
  canRun?: () => boolean;
  /** Epoch ms of the last real user input in this tab. */
  lastUserActivity?: () => number;
  now?: () => number;
  /** Pause after opening, so Zalo renders the thread before scrolling. */
  settle?: () => Promise<void>;
  log?: (m: string) => void;
  /**
   * Runs the work (open + backfill) under the shared UI lock, waiting for it.
   * The poll itself runs outside the lock, so a long-poll never blocks others.
   */
  withLock?: (fn: () => Promise<void>) => Promise<void>;
  /** A Dashboard request is about to run: the automatic sync stops its current run and yields. */
  preempt?: (on: boolean) => void;
  /** Long-poll length for the logged-in account (0 = plain poll). */
  waitSec?: number;
}

const REASON_TEXT: Partial<Record<BackfillReason, string>> = {
  rate_limited: 'đã đạt giới hạn lấy lịch sử trong 1 giờ, thử lại sau',
  thread_changed: 'hội thoại trên Zalo Web bị chuyển giữa chừng',
  tab_hidden: 'tab Zalo bị ẩn giữa chừng nên không tải được tin cũ; hãy để cửa sổ Zalo Web hiện trên màn hình rồi thử lại',
  no_conversation: 'không thấy khung tin nhắn trên Zalo Web',
  stopped: 'đã dừng',
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

/** Maps a finished backfill to the result reported to the API. */
export function toFetchResult(p: BackfillProgress): FetchResult {
  if (p.state === 'done') {
    return {
      ok: true,
      reason: p.reason ?? undefined,
      posted: p.posted,
      ...(p.webHistoryFrom != null ? { webHistoryFrom: p.webHistoryFrom } : {}),
    };
  }
  const error = p.reason === 'error' ? `lỗi khi lấy nội dung: ${p.message ?? ''}` : REASON_TEXT[p.reason ?? 'error'];
  return { ok: false, reason: p.reason ?? undefined, posted: p.posted, error: (error ?? 'không lấy được nội dung').slice(0, 300) };
}

/**
 * One poll: reports presence for every account, then handles at most one
 * request (a backfill takes a while; the next poll picks up the rest). Only the
 * account logged in here is served; when that is unknown, every account is tried.
 * The poll (a long-poll for the logged-in account) runs outside the UI lock; only
 * the work takes it, after asking the automatic sync to yield.
 * Returns true when a request was processed.
 */
export async function fetchOnce(deps: FetcherDeps): Promise<boolean> {
  const now = deps.now ?? Date.now;
  const waiting: FetchWaiting | null =
    deps.canRun && !deps.canRun()
      ? 'busy'
      : deps.lastUserActivity && now() - deps.lastUserActivity() < USER_IDLE_MS
        ? 'user_active'
        : deps.tabHidden?.()
          ? 'tab_hidden'
          : null;

  const accounts = await deps.accounts();
  // Long-poll only the one account logged in on this tab; the others (and all
  // of them when the account is unknown) get a plain heartbeat poll first.
  const target = waiting ? null : accounts.filter((a) => a.loggedIn === true);
  const longPollUid = target?.length === 1 ? target[0]!.uid : null;
  const ordered = [...accounts.filter((a) => a.uid !== longPollUid), ...accounts.filter((a) => a.uid === longPollUid)];
  const withLock = deps.withLock ?? ((fn) => fn());

  let handled = false;
  for (const { uid, loggedIn } of ordered) {
    const wait = uid === longPollUid ? (deps.waitSec ?? 0) : 0;
    const presence = { loggedIn, waiting };
    const items = await (wait ? deps.api.pending(uid, presence, wait) : deps.api.pending(uid, presence));
    if (handled || waiting || loggedIn === false) continue;
    const mine = items.filter((i) => i.uid === uid);
    if (!mine.length) continue;
    deps.preempt?.(true);
    try {
      await withLock(async () => {
        handled = await handleItems(mine, deps);
      });
    } finally {
      deps.preempt?.(false);
    }
  }
  return handled;
}

/** Claims and runs the first request that is still claimable. */
async function handleItems(items: FetchRequest[], deps: FetcherDeps): Promise<boolean> {
  for (const item of items) {
    let claimed: FetchRequest;
    try {
      claimed = await deps.api.claim(item.id);
    } catch {
      continue; // taken by another tab/browser meanwhile
    }
    let result: FetchResult;
    try {
      const opened = await deps.open(claimed.threadId, { name: item.name, recentCliMsgIds: item.recentCliMsgIds, ...(item.allowUnread ? { allowUnread: true } : {}) });
      if (!opened.ok) {
        result = { ok: false, error: opened.error };
      } else {
        await deps.settle?.();
        result = toFetchResult(await deps.backfill(claimed.threadId, claimed.uid, { deep: item.deep ?? true }));
      }
    } catch (e) {
      result = { ok: false, error: `lỗi khi lấy nội dung: ${errMsg(e)}` };
    }
    await deps.api.result(claimed.id, result).catch((e) => deps.log?.(`VClinks fetcher: result not reported: ${errMsg(e)}`));
    deps.log?.(`VClinks fetcher: ${claimed.id} → ${result.ok ? 'done' : 'failed'}`);
    return true;
  }
  return false;
}

export const FETCH_POLL_MS = 8_000;
/** Long-poll length (the API caps it at 25 s). */
export const FETCH_WAIT_SEC = 20;

/**
 * Starts the poll loop. The logged-in account is long-polled, so a Dashboard
 * request starts within a round trip; the work itself takes the shared UI lock
 * (`deps.withLock`, same as the sender), so one job drives Zalo at a time.
 */
export function startFetcher(deps: FetcherDeps, opts: { everyMs?: number; firstDelayMs?: number } = {}): () => void {
  const everyMs = opts.everyMs ?? FETCH_POLL_MS;
  const now = deps.now ?? Date.now;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (stopped) return;
    let busy = false;
    const started = now();
    try {
      busy = await fetchOnce({ waitSec: FETCH_WAIT_SEC, ...deps });
    } catch (e) {
      deps.log?.(`VClinks fetcher: ${errMsg(e)}`);
    } finally {
      // After a request, or a long-poll that already waited, look again at once;
      // after a plain poll (account unknown, tab busy/hidden), wait the period.
      const longPolled = now() - started >= 5_000;
      if (!stopped) timer = setTimeout(() => void tick(), busy ? 500 : longPolled ? 250 : everyMs);
    }
  };
  timer = setTimeout(() => void tick(), opts.firstDelayMs ?? 3000);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
