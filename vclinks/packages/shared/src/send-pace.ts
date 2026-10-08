import { z } from 'zod';

/**
 * Per-nick send pace for extension channels (M1a-06; 03 SZ-04, BA §11.7 ZR3):
 * commands of one nick go out one by one, at least `gapMs` apart and at most
 * `perMinute` in any 60 seconds. A held command stays `approved` and is handed
 * out by a later poll, never dropped (the 30-minute expiry still applies).
 *
 * Friend requests keep their own, slower pace (SZ-09, `OUTBOX_LIMITS.friendGapMs`).
 *
 * Configured by env (`SEND_PACE_GAP_MS`, `SEND_PACE_PER_MINUTE`) and per nick
 * (`accounts.sendPace`, `PATCH /api/accounts/:uid`). The bounds keep any
 * configuration away from bulk sending: never under 1 second, never over 30 a minute.
 */
export interface SendPace {
  /** Minimum time between two commands of the same nick (ms). */
  gapMs: number;
  /** Maximum commands of the same nick in any 60-second window. */
  perMinute: number;
}

export const SEND_PACE_DEFAULT: SendPace = { gapMs: 1500, perMinute: 20 };

export const SEND_PACE_BOUNDS = {
  gapMs: { min: 1000, max: 10 * 60_000 },
  perMinute: { min: 1, max: 30 },
} as const;

export const SEND_PACE_WINDOW_MS = 60_000;

export const sendPaceSchema = z
  .object({
    gapMs: z.number().int().min(SEND_PACE_BOUNDS.gapMs.min).max(SEND_PACE_BOUNDS.gapMs.max).optional(),
    perMinute: z.number().int().min(SEND_PACE_BOUNDS.perMinute.min).max(SEND_PACE_BOUNDS.perMinute.max).optional(),
  })
  .strict();
export type SendPaceInput = z.infer<typeof sendPaceSchema>;

const clamp = (v: unknown, b: { min: number; max: number }): number | undefined => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  return Math.min(b.max, Math.max(b.min, Math.round(n)));
};

/**
 * Effective pace: nick override over env over default, each value clamped to
 * SEND_PACE_BOUNDS (a bad value never disables pacing).
 */
export function resolveSendPace(
  env: { gapMs?: unknown; perMinute?: unknown } = {},
  nick?: { gapMs?: unknown; perMinute?: unknown } | null,
): SendPace {
  return {
    gapMs: clamp(nick?.gapMs, SEND_PACE_BOUNDS.gapMs) ?? clamp(env.gapMs, SEND_PACE_BOUNDS.gapMs) ?? SEND_PACE_DEFAULT.gapMs,
    perMinute:
      clamp(nick?.perMinute, SEND_PACE_BOUNDS.perMinute) ??
      clamp(env.perMinute, SEND_PACE_BOUNDS.perMinute) ??
      SEND_PACE_DEFAULT.perMinute,
  };
}

/**
 * Milliseconds until the nick may start its next command (0 = now), given the
 * start times (epoch ms) of its recent commands.
 */
export function sendPaceWaitMs(pace: SendPace, recentStarts: readonly number[], now: number): number {
  if (!recentStarts.length) return 0;
  const sorted = [...recentStarts].sort((a, b) => b - a);
  const byGap = sorted[0] + pace.gapMs - now;
  const inWindow = sorted.filter((t) => t > now - SEND_PACE_WINDOW_MS);
  // The window frees a slot when its oldest counted start leaves it.
  const byWindow = inWindow.length >= pace.perMinute ? inWindow[pace.perMinute - 1] + SEND_PACE_WINDOW_MS - now : 0;
  return Math.max(0, byGap, byWindow);
}

/** Start of every pace refusal; clients test for it to stop the current poll. */
export const SEND_PACE_REFUSAL = 'Chưa tới nhịp gửi của nick';

/** True for an error (or its message) of a claim refused by the send pace. */
export const isSendPaceRefusal = (e: unknown): boolean =>
  (e instanceof Error ? e.message : String(e ?? '')).includes(SEND_PACE_REFUSAL);

/** Vietnamese message of a claim refused by the pace (shown as is). */
export function sendPaceMessage(pace: SendPace, waitMs: number): string {
  const s = (ms: number) => (ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `${SEND_PACE_REFUSAL} (tối thiểu ${s(pace.gapMs)} giây giữa hai lệnh, tối đa ${pace.perMinute} lệnh mỗi phút); lệnh vẫn chờ, sẽ gửi sau khoảng ${s(Math.max(waitMs, 100))} giây`;
}
