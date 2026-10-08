import { z } from 'zod';

/**
 * Fetch request: the Dashboard asks the extension to load a conversation's
 * content from Zalo Web (open it in the sidebar, then backfill = scroll up and
 * capture rendered bubbles). One document per conversation in `fetch_requests`,
 * keyed `${uid}:${threadId}`; a new request re-arms the same document.
 * Personal-Zalo (extension) accounts only.
 */

export const FETCH_STATUSES = ['pending', 'running', 'done', 'failed'] as const;
export type FetchStatus = (typeof FETCH_STATUSES)[number];

/** A running request not finished after this long is handed out again. */
export const FETCH_STALE_MS = 5 * 60_000;

export interface FetchRequest {
  id: string;
  uid: string;
  threadId: string;
  status: FetchStatus;
  /** ISO timestamps. */
  requestedAt: string;
  claimedAt?: string;
  finishedAt?: string;
  /** Backfill stop reason (e.g. reached_start, all_pending_seen). */
  reason?: string;
  /** Content items posted by the run. */
  posted?: number;
  /** Short Vietnamese reason on failure; never message text. */
  error?: string;
  /**
   * Extension poll only (GET /fetch/pending): the conversation's display name,
   * so the extension can find it through Zalo Web search when it is not in the
   * rendered sidebar, and the cliMsgIds of its newest messages, so it can
   * confirm the right conversation is open from the bubbles on screen.
   */
  name?: string;
  recentCliMsgIds?: string[];
  /**
   * Extension poll only: scroll to the start of Zalo Web history. False once a
   * run reached it: later runs stop when every pending message was seen.
   */
  deep?: boolean;
  /**
   * Extension poll only: open the conversation even when Zalo shows unread messages (the sender then sees
   * "Đã xem", the holder loses the unread badge). Set only by an explicit, confirmed Dashboard request
   * (`onBehalf`); the automatic rule stays "never open unread".
   */
  allowUnread?: boolean;
}

/** How many newest cliMsgIds a pending fetch request carries. */
export const FETCH_CONFIRM_IDS = 50;

/** Extension → API when a claimed request finished. */
export const fetchResultSchema = z
  .object({
    ok: z.boolean(),
    reason: z.string().trim().max(64).optional(),
    posted: z.number().int().min(0).max(1_000_000).optional(),
    error: z.string().trim().max(300).optional(),
    /** Epoch ms of Zalo Web's history start ("use Zalo PC before <date>" banner). */
    webHistoryFrom: z.number().int().min(0).max(8_640_000_000_000).optional(),
  })
  .refine((r) => r.ok || !!r.error, { message: 'error is required when ok=false', path: ['error'] });
export type FetchResult = z.input<typeof fetchResultSchema>;

/** Why an online extension is not starting a request right now. */
export const FETCH_WAITING = ['user_active', 'busy', 'tab_hidden'] as const;
export type FetchWaiting = (typeof FETCH_WAITING)[number];

/** A heartbeat older than this means no extension is serving the account. */
export const PRESENCE_ONLINE_MS = 30_000;

/** Extension → API with every poll: what this Zalo Web tab can serve. */
export const fetchPresenceQuerySchema = z.object({
  /** '1' = this uid is logged in on the tab, '0' = another one is, absent = unknown. */
  loggedIn: z.enum(['1', '0']).optional(),
  waiting: z.enum(FETCH_WAITING).optional(),
});

/** Last heartbeat of the extension for one account. */
export interface ExtensionPresence {
  online: boolean;
  lastSeenAt: string;
  /** null = the extension could not tell which account is logged in. */
  loggedIn: boolean | null;
  waiting: FetchWaiting | null;
}

/** GET /conversations/:id/fetch: the request plus whether an extension can serve it. */
export type FetchStatusView = (FetchRequest | { status: 'none' }) & {
  extension: ExtensionPresence | null;
  /** Account logged in on an online Zalo Web tab, when it is not this one. */
  otherLoggedIn: { uid: string; label: string } | null;
};
