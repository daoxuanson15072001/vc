import { BadRequestException, ConflictException } from '@nestjs/common';
import { FRIEND_TARGET_BLOCKED, foldVi, friendTargetAllowed, normalizeVnPhone, parseFriendTargets, OUTBOX_LIMITS, type FriendRequestQuota, type OutboxCreate } from '@vclinks/shared';
import type { Document } from 'mongodb';
import { C, DbService } from '../db/db.service';

/**
 * Friend-request commands (M1a-04, rule SZ-09): validation at creation, the
 * pacing gate of GET /outbox/pending, the daily quota and the mirror of a
 * finished command into `friend_requests` / `contacts`. Kept free of Nest
 * providers, like outbox-hold.ts.
 */

/** Statuses of a `friend_request` command that still count against today's quota (expired / cancelled ones never reached Zalo). */
const COUNTED = { $nin: ['cancelled', 'expired'] };
/** Statuses of a command that is still on its way (a second one for the same target is refused). */
const ACTIVE = ['approved', 'sending', 'awaiting_confirm'];

/** 00:00 today in Asia/Ho_Chi_Minh (UTC+7, no DST). */
function startOfDayVn(now: Date): Date {
  const VN_OFFSET_MS = 7 * 3600_000;
  const local = new Date(now.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - VN_OFFSET_MS);
}

/** Friend-request id of a received request: `${uid}:received:${userId}`. */
export const friendRequestId = (uid: string, direction: 'received' | 'sent', userId: string) => `${uid}:${direction}:${userId}`;

/** Quota and pacing state of one nick (SZ-09: 30 s between two new requests, 20 a day). */
export async function friendQuota(db: DbService, uid: string, now = new Date()): Promise<FriendRequestQuota> {
  const col = db.col(C.suggestions);
  const [usedToday, last] = await Promise.all([
    col.countDocuments({ uid, action: 'friend_request', createdAt: { $gte: startOfDayVn(now) }, status: COUNTED }),
    col.find({ uid, action: 'friend_request', claimedAt: { $type: 'date' } }, { projection: { claimedAt: 1 } }).sort({ claimedAt: -1 }).limit(1).toArray(),
  ]);
  const limit = OUTBOX_LIMITS.friendPerDay;
  const next = last[0]?.claimedAt instanceof Date ? new Date(last[0].claimedAt.getTime() + OUTBOX_LIMITS.friendGapMs) : null;
  return {
    limit,
    usedToday,
    remaining: Math.max(0, limit - usedToday),
    nextAllowedAt: next && next.getTime() > now.getTime() ? next.toISOString() : null,
  };
}

/**
 * Whether a `friend_request` of `uid` may be handed to the extension now: the
 * last claim is at least friendGapMs old and fewer than friendPerDay were
 * claimed today. A held item stays `approved` (it is only not handed out yet).
 */
export async function friendGateOpen(db: DbService, uid: string, now = new Date()): Promise<boolean> {
  const col = db.col(C.suggestions);
  const [last, claimedToday] = await Promise.all([
    col.find({ uid, action: 'friend_request', claimedAt: { $type: 'date' } }, { projection: { claimedAt: 1 } }).sort({ claimedAt: -1 }).limit(1).toArray(),
    col.countDocuments({ uid, action: 'friend_request', claimedAt: { $gte: startOfDayVn(now) } }),
  ]);
  const lastAt = last[0]?.claimedAt instanceof Date ? last[0].claimedAt.getTime() : 0;
  return now.getTime() - lastAt >= OUTBOX_LIMITS.friendGapMs && claimedToday < OUTBOX_LIMITS.friendPerDay;
}

/**
 * Checks a friend command at creation and returns what is stored on the item
 * (the phone of a new request is normalised). Throws 400 / 409 with a
 * Vietnamese message the Dashboard shows as is.
 */
/** Allowlist from `FRIEND_TARGETS` (user ids / phones, `*` = all). Unset or empty blocks every friend command. */
export const friendTargets = () => parseFriendTargets(process.env.FRIEND_TARGETS);

/** Whether a stored friend command still targets someone on the allowlist (re-checked at claim and retry). */
export const friendCommandAllowed = (friend: { userId?: string; phone?: string } | undefined): boolean =>
  friendTargetAllowed(friendTargets(), { userId: friend?.userId, phone: friend?.phone });

/** `threadId` for audit_log: a new friend request carries the phone there, so only its ends are kept. */
export const auditThreadId = (action: string | undefined, threadId: string): string =>
  action === 'friend_request' ? threadId.replace(/^(\+?\d{3})\d+(\d{3})$/, '$1***$2') : threadId;

export async function prepareFriendCommand(db: DbService, input: OutboxCreate): Promise<NonNullable<OutboxCreate['friend']>> {
  const friend = { ...input.friend! };
  const action = input.action;
  if (!friendTargetAllowed(friendTargets(), { userId: friend.userId, phone: friend.phone })) throw new BadRequestException(FRIEND_TARGET_BLOCKED);
  const col = db.col(C.suggestions);
  if (action === 'friend_request') {
    const phone = normalizeVnPhone(friend.phone ?? '');
    if (!phone) throw new BadRequestException('Số điện thoại chưa đúng (cần số di động Việt Nam, ví dụ 0912345678)');
    friend.phone = phone;
    const quota = await friendQuota(db, input.uid);
    if (quota.remaining <= 0) {
      throw new BadRequestException(`Hôm nay nick này đã đủ ${quota.limit} lời mời kết bạn. Hãy gửi tiếp vào ngày mai.`);
    }
    if (await col.countDocuments({ uid: input.uid, action: 'friend_request', 'friend.phone': phone, status: { $in: ACTIVE } }, { limit: 1 })) {
      throw new ConflictException('Đã có lệnh mời kết bạn tới số này đang chờ gửi');
    }
    return friend;
  }
  // accept / reject: the request must be listed and still pending.
  const req = await db.col(C.friendRequests).findOne({ _id: friendRequestId(input.uid, 'received', friend.userId!) as never });
  if (!req || req.status !== 'pending') {
    throw new BadRequestException('Không thấy lời mời này trên danh sách (có thể đã được xử lý). Hãy đợi lần đồng bộ sau.');
  }
  if (await col.countDocuments({ uid: input.uid, action: { $in: ['friend_accept', 'friend_reject'] }, 'friend.userId': friend.userId, status: { $in: ACTIVE } }, { limit: 1 })) {
    throw new ConflictException('Đã có lệnh cho lời mời này đang chờ thực hiện');
  }
  return friend;
}

/** What a finished friend command changes in VClinks, so the Dashboard does not wait for the next read. */
export async function mirrorFriendEffect(
  db: DbService,
  doc: { uid: string; action?: string; friend?: { userId?: string; name?: string; alias?: string } },
  now = new Date(),
): Promise<void> {
  const f = doc.friend;
  if (!f?.userId) return;
  const reqId = friendRequestId(doc.uid, 'received', f.userId);
  if (doc.action === 'friend_reject') {
    await db.col(C.friendRequests).updateOne({ _id: reqId as never }, { $set: { status: 'rejected', handledAt: now } });
    return;
  }
  if (doc.action !== 'friend_accept') return;
  await db.col(C.friendRequests).updateOne({ _id: reqId as never }, { $set: { status: 'accepted', handledAt: now } });
  // "Chấp nhận xong khách có hồ sơ": the contact exists at once, named as Zalo will list it (alias first).
  const name = (f.alias ?? f.name ?? '').trim();
  const set: Document = { uid: doc.uid, userId: f.userId, inFriendList: true, friendSeenAt: now };
  if (name) Object.assign(set, { domName: name, domNameFold: foldVi(name) });
  await db.col(C.contacts).updateOne({ _id: `${doc.uid}:${f.userId}` as never }, { $set: set, $setOnInsert: { ingestedAt: now, tags: [] } }, { upsert: true });
}
