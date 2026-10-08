import { SEND_PACE_WINDOW_MS, resolveSendPace, sendPaceWaitMs, type SendPace } from '@vclinks/shared';
import { C, DbService } from '../db/db.service';

/**
 * Per-nick send pace of extension commands (M1a-06, 03 SZ-04, BA §11.7 ZR3).
 * Every command except `friend_request` (own SZ-09 gate in outbox-friend.ts)
 * shares one pace per nick. The gate is read from `claimedAt`, so it holds for
 * every client that claims (extension, Claude via MCP) and survives restarts.
 * Kept free of Nest providers, like outbox-hold.ts.
 */

/** Effective pace of a nick: `accounts.sendPace` over env over SEND_PACE_DEFAULT. */
export async function sendPaceOf(db: DbService, uid: string): Promise<SendPace> {
  const acc = await db.col<{ _id: string; sendPace?: { gapMs?: number; perMinute?: number } }>(C.accounts).findOne(
    { _id: uid },
    { projection: { sendPace: 1 } },
  );
  return resolveSendPace({ gapMs: process.env.SEND_PACE_GAP_MS, perMinute: process.env.SEND_PACE_PER_MINUTE }, acc?.sendPace);
}

/** Milliseconds until `uid` may start its next paced command (0 = now). */
export async function sendPaceWait(db: DbService, uid: string, now = new Date()): Promise<{ waitMs: number; pace: SendPace }> {
  const pace = await sendPaceOf(db, uid);
  // Test runs only (jest sets NODE_ENV=test): suites that claim several items back to back opt out.
  if (process.env.NODE_ENV === 'test' && process.env.SEND_PACE_DISABLED === '1') return { waitMs: 0, pace };
  const since = new Date(now.getTime() - Math.max(pace.gapMs, SEND_PACE_WINDOW_MS));
  const rows = await db
    .col(C.suggestions)
    .find({ uid, action: { $ne: 'friend_request' }, claimedAt: { $gte: since } }, { projection: { claimedAt: 1 } })
    .sort({ claimedAt: -1 })
    .limit(SEND_PACE_WINDOW_LIMIT)
    .toArray();
  const starts = rows.map((r) => (r.claimedAt instanceof Date ? r.claimedAt.getTime() : 0)).filter(Boolean);
  return { waitMs: sendPaceWaitMs(pace, starts, now.getTime()), pace };
}

/**
 * Atomically takes the nick's next pace slot (one document per nick in
 * `send_pace_slots`): two clients claiming at the same moment cannot both pass
 * the read-only check above, only one of them gets the slot. Upsert on a busy
 * slot hits the unique `_id` and counts as "not yet".
 */
export async function takeSendPaceSlot(db: DbService, uid: string, pace: SendPace, now = new Date()): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' && process.env.SEND_PACE_DISABLED === '1') return true;
  try {
    await db
      .col<{ _id: string; at: Date }>(C.sendPaceSlots)
      .updateOne({ _id: uid, at: { $lte: new Date(now.getTime() - pace.gapMs) } }, { $set: { at: now } }, { upsert: true });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false;
    throw e;
  }
}

/** Upper bound of claims read per check (SEND_PACE_BOUNDS.perMinute.max is 30). */
const SEND_PACE_WINDOW_LIMIT = 64;
