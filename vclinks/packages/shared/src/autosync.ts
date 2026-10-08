import { z } from 'zod';

/**
 * Automatic content sync (personal Zalo, extension): while the user is idle the
 * extension opens conversations on Zalo Web itself and captures their content.
 *
 * 1. First sidebar page: open each conversation and capture only what is on
 *    screen (`mode: 'screen'`, no scrolling).
 * 2. Then, one by one, the conversations still missing content are scrolled
 *    back (`mode: 'deep'`) until Zalo Web has nothing older.
 * 3. Later runs only fetch what is missing (the plan lists threads with pending
 *    content; a deep pass that found nothing new is not repeated).
 *
 * Conversations with unread messages are never opened: opening one tells the
 * sender it was seen (owner decision 29/09/2026).
 */

export const AUTOSYNC_MODES = ['screen', 'deep'] as const;
export type AutoSyncMode = (typeof AUTOSYNC_MODES)[number];

export const AUTOSYNC_OUTCOMES = [
  'done', // the run finished (deep: history start reached or every pending id seen; screen: screen captured)
  'skipped_unread', // the conversation has unread messages: not opened
  'not_found', // not in the sidebar (automatic runs never use Zalo search)
  'aborted', // the user came back, the tab went hidden or the conversation changed
  'error',
] as const;
export type AutoSyncOutcome = (typeof AUTOSYNC_OUTCOMES)[number];

/** How long a thread stays out of the plan after each outcome. */
export const AUTOSYNC_RETRY_MS: Record<AutoSyncOutcome, number> = {
  done: 0,
  skipped_unread: 10 * 60_000,
  not_found: 6 * 60 * 60_000,
  aborted: 0,
  error: 30 * 60_000,
};

/** Upper bound on plan items returned per call. */
export const AUTOSYNC_PLAN_LIMIT = 200;

/** GET /api/autosync/plan: one conversation still missing content. */
export interface AutoSyncPlanItem {
  threadId: string;
  /** Sidebar name, when captured (never used to search: automatic runs only click rendered items). */
  name?: string;
  /** Messages still waiting for content that Zalo Web can still show. */
  pending: number;
  /** ISO time of the newest message (plan order: newest first). */
  lastMsgAt: string | null;
  /** A deep pass reached the start of Zalo Web history before: later passes stop at the pending ids. */
  deepDone: boolean;
  /** Newest cliMsgIds, to confirm the right conversation is open. */
  recentCliMsgIds: string[];
  /** ISO send time of the newest message still waiting for content (fast nicks capture new messages first). */
  newestPendingAt?: string | null;
}

/** POST /api/autosync/result */
export const autoSyncResultSchema = z.object({
  uid: z.string().trim().min(1).max(128),
  threadId: z.string().trim().min(1).max(128),
  mode: z.enum(AUTOSYNC_MODES),
  outcome: z.enum(AUTOSYNC_OUTCOMES),
  /** Backfill stop reason (content-free). */
  reason: z.string().trim().max(64).optional(),
  posted: z.number().int().min(0).max(1_000_000).optional(),
  /** Epoch ms of the "use Zalo PC for messages before <date>" banner: Zalo Web shows nothing older. */
  webHistoryFrom: z.number().int().min(0).max(8_640_000_000_000).optional(),
  error: z.string().trim().max(300).optional(),
});
export type AutoSyncResult = z.input<typeof autoSyncResultSchema>;
