import { HEALTH_OFFLINE_MS, OUTBOX_EXPIRE_MS, OUTBOX_RECONNECT_HOLD_MS, outboxSources, type OutboxHoldReason } from '@vclinks/shared';
import type { Filter } from 'mongodb';
import { runUnscoped } from '../db/tenant-context';
import { C, DbService } from '../db/db.service';

/**
 * Time-driven outbox transitions, kept free of Nest providers so both the
 * outbox and the extension heartbeat (threads module) can call them without a
 * dependency cycle. Audit entries carry ids only, never message text.
 */

/** Actor recorded for transitions made by the API itself. */
export const SYSTEM_ACTOR = 'he-thong';

/** Last presence row of an account, as written by the extension heartbeat. */
export interface PresenceSnapshot {
  lastSeenAt?: Date | null;
  loggedIn?: boolean | null;
}

/**
 * True when the previous presence means the nick was red (03 SZ-10): never
 * seen, silent longer than HEALTH_OFFLINE_MS, or Zalo Web logged out.
 */
export function wasOffline(prev: PresenceSnapshot | null | undefined, now: Date): boolean {
  if (!prev?.lastSeenAt) return true;
  if (prev.loggedIn === false) return true;
  return now.getTime() - prev.lastSeenAt.getTime() > HEALTH_OFFLINE_MS;
}

/**
 * SZ-11: approved / awaiting-confirm items older than 30 minutes (from their
 * approval) become `expired`. `statusAt` is the moment the deadline passed, so
 * "Treo {n} phút" counts from there even when the sweep runs late.
 */
export async function expireStale(db: DbService, now = new Date(), uid?: string): Promise<number> {
  const cutoff = new Date(now.getTime() - OUTBOX_EXPIRE_MS);
  const col = db.col(C.suggestions);
  const filter = { status: { $in: outboxSources('expire') }, approvedAt: { $type: 'date', $lt: cutoff }, ...(uid ? { uid } : {}) };
  const docs = await col.find(filter, { projection: { _id: 1, uid: 1, threadId: 1 } }).limit(500).toArray();
  if (!docs.length) return 0;
  const res = await col.updateMany({ ...filter, _id: { $in: docs.map((d) => d._id) } }, [
    { $set: { status: 'expired', statusAt: { $add: ['$approvedAt', OUTBOX_EXPIRE_MS] } } },
  ]);
  for (const d of docs) await db.audit(SYSTEM_ACTOR, 'outbox.expired', String(d._id), { uid: d.uid, threadId: d.threadId });
  return res.modifiedCount;
}

/**
 * SZ-28 (b): the nick of `uid` just came back online. Approved items that
 * already waited longer than OUTBOX_RECONNECT_HOLD_MS are not handed out any
 * more: they become `awaiting_confirm` until the approver presses "Gửi ngay".
 * Items approved within the hold window are sent as usual.
 */
export async function holdAfterReconnect(db: DbService, uid: string, now = new Date()): Promise<number> {
  await expireStale(db, now, uid);
  const col = db.col(C.suggestions);
  const filter = {
    uid,
    status: { $in: outboxSources('reconnect') },
    approvedAt: { $type: 'date', $lt: new Date(now.getTime() - OUTBOX_RECONNECT_HOLD_MS) },
  };
  const docs = await col.find(filter, { projection: { _id: 1, threadId: 1 } }).limit(500).toArray();
  if (!docs.length) return 0;
  const res = await col.updateMany({ ...filter, _id: { $in: docs.map((d) => d._id) } }, { $set: { status: 'awaiting_confirm', statusAt: now } });
  for (const d of docs) await db.audit(SYSTEM_ACTOR, 'outbox.awaiting_confirm', String(d._id), { uid, threadId: d.threadId });
  return res.modifiedCount;
}

/**
 * PQ-51, QT-SZ-11 #1, D40: items matching `filter` that have not started sending go to
 * `needs_reapproval` (never run by themselves; only "Duyệt lại" by the nick holder / cover, or "Bỏ lệnh").
 * Items being sent are left alone. Audit `outbox.needs_reapproval` (system, ids only).
 */
export async function holdItems(db: DbService, filter: Filter<Record<string, unknown>>, reason: OutboxHoldReason, now = new Date()): Promise<number> {
  const col = db.col(C.suggestions);
  const f = { ...filter, status: { $in: outboxSources('hold') } };
  const docs = await col.find(f, { projection: { _id: 1, uid: 1, threadId: 1 } }).limit(1000).toArray();
  if (!docs.length) return 0;
  const res = await col.updateMany({ ...f, _id: { $in: docs.map((d) => d._id) } }, { $set: { status: 'needs_reapproval', statusAt: now, holdReason: reason } });
  for (const d of docs) await db.audit(SYSTEM_ACTOR, 'outbox.needs_reapproval', String(d._id), { uid: d.uid, threadId: d.threadId, reason });
  return res.modifiedCount;
}

/**
 * Every waiting item approved by `userId` (lock, offboarding: PQ-51, PQ-53). Runs outside the caller's
 * data scope: the admin locking someone usually cannot read that person's conversations.
 */
export function holdApproverItems(db: DbService, userId: string, reason: OutboxHoldReason): Promise<number> {
  return runUnscoped(() => holdItems(db, { approvedBy: userId }, reason));
}
