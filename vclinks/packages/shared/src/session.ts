import { z } from 'zod';

/**
 * Health of one connected account's web session (personal Zalo on the Chrome
 * driver). Reported by the driver watchdog (tools/chrome-driver/watchdog.js);
 * the Dashboard shows `lost` in red (M1a-02). Only states and short reasons —
 * never page content, cookies or tokens (CLAUDE.md §12.2).
 */
export const SESSION_STATES = ['ok', 'lost'] as const;
export type SessionState = (typeof SESSION_STATES)[number];

/**
 * Why a session is `lost`:
 * - `cdp_down`: the Chrome profile is not running / not answering on its debug port
 * - `tab_missing`: Chrome runs but has no chat.zalo.me tab
 * - `qr`: Zalo shows its login (QR) screen; a person must scan again
 * - `extension_silent`: tab looks fine but the extension stopped reporting syncs
 * - `duplicate_web`: direct (zca-js) nick: Zalo Web was opened elsewhere and took the session
 * - `direct_down`: direct (zca-js) nick: the connection dropped and could not come back yet
 */
export const SESSION_LOST_REASONS = ['cdp_down', 'tab_missing', 'qr', 'extension_silent', 'duplicate_web', 'direct_down'] as const;
export type SessionLostReason = (typeof SESSION_LOST_REASONS)[number];

export const sessionReportSchema = z
  .object({
    state: z.enum(SESSION_STATES),
    reason: z.enum(SESSION_LOST_REASONS).optional(),
    /** Who reports, e.g. `watchdog:nick1@vm-1`. */
    source: z.string().trim().min(1).max(100).optional(),
    /** Short technical note (no message content). */
    detail: z.string().max(200).optional(),
  })
  .strict()
  .refine((r) => (r.state === 'lost') === !!r.reason, {
    message: 'reason is required when state=lost and not allowed when state=ok',
    path: ['reason'],
  });
export type SessionReport = z.infer<typeof sessionReportSchema>;

/** Session part of an account (stored on the `accounts` doc). */
export interface AccountSession {
  state: SessionState;
  reason: SessionLostReason | null;
  /** When the current state began. */
  since: string;
  /** Last report from the watchdog (heartbeat). */
  reportedAt: string;
  source: string | null;
}

export interface SessionReportResult {
  state: SessionState;
  /** True when this report changed the state (an `account.session_lost` / `account.session_restored` was recorded). */
  changed: boolean;
  /** Last extension sync report seen by the API, so the watchdog can detect a silent extension. */
  lastSyncAt: string | null;
}
