import { Injectable, Logger } from '@nestjs/common';
import {
  friendRequestDomItemSchema,
  type FriendRequestDomBatch,
  type FriendRequestDomResult,
  type FriendRequestItem,
  type FriendRequestListQuery,
  type FriendRequestListResponse,
  type FriendRequestStatus,
} from '@vclinks/shared';
import type { AnyBulkWriteOperation, Document } from 'mongodb';
import { AccountsService } from '../accounts/accounts.service';
import { toIso } from '../common/zod';
import { C, DbService } from '../db/db.service';
import { friendQuota, friendRequestId } from '../outbox/outbox-friend';

/** Snapshot of one list (`${uid}:${direction}`): header count and last read. */
const FRIEND_REQUEST_LISTS = 'friend_request_lists';

/**
 * A read that saw fewer rows than this share of the list header count does not
 * mark the unseen requests as gone (the "Xem thêm" expansion may have stopped early).
 */
const GONE_MIN_SHARE = 0.9;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Command statuses worth showing next to a request (a finished one is shown by the request's own status). */
const OPEN_COMMAND = ['approved', 'sending', 'awaiting_confirm', 'failed', 'expired'];

/**
 * Friend requests of personal Zalo nicks (M1a-04, MH-SZ-10): the lists read by
 * the extension from Zalo Web, the Dashboard's view of them and the quota of
 * new requests. Names and greetings are personal data of third parties: they
 * are stored for the nick's own operation only and never logged.
 */
@Injectable()
export class FriendRequestsService {
  private readonly logger = new Logger(FriendRequestsService.name);

  constructor(
    private readonly db: DbService,
    private readonly accounts: AccountsService,
  ) {}

  private indexed?: Promise<unknown>;
  private ensureIndexes() {
    this.indexed ??= this.db
      .col(C.friendRequests)
      .createIndexes([{ key: { uid: 1, direction: 1, status: 1, order: 1 } }])
      .catch((e: unknown) => {
        this.indexed = undefined;
        this.logger.warn(`friend request indexes: ${e instanceof Error ? e.message : String(e)}`);
      });
    return this.indexed;
  }

  /**
   * Rows of one list read from Zalo Web. Idempotent: the same rows again change
   * nothing but `seenAt`. A request handled from VClinks (accepted / rejected)
   * keeps that status even while Zalo still lists it; a `gone` one that
   * reappears becomes pending again.
   */
  async ingestDom(uid: string, batch: FriendRequestDomBatch): Promise<FriendRequestDomResult> {
    await this.accounts.assertExists(uid);
    await this.ensureIndexes();
    const now = new Date();
    const rows = [];
    let rejected = 0;
    for (const raw of batch.items) {
      const parsed = friendRequestDomItemSchema.safeParse(raw);
      if (parsed.success) rows.push(parsed.data);
      else rejected++;
    }
    const col = this.db.col(C.friendRequests);
    const ids = rows.map((r) => friendRequestId(uid, batch.direction, r.userId));
    if (rows.length) {
      const ops: AnyBulkWriteOperation<Document>[] = rows.map((r, i) => ({
        updateOne: {
          filter: { _id: ids[i] as never },
          update: {
            $set: {
              uid,
              direction: batch.direction,
              userId: r.userId,
              name: r.name,
              avatar: r.avatar ?? null,
              message: r.message ?? null,
              source: r.source ?? null,
              dateText: r.dateText ?? null,
              business: r.business === true,
              seenAt: now,
              order: i,
            },
            $setOnInsert: { status: 'pending', firstSeenAt: now },
          },
          upsert: true,
        },
      }));
      await col.bulkWrite(ops as never, { ordered: false });
      await col.updateMany({ _id: { $in: ids as never[] }, status: 'gone' }, { $set: { status: 'pending' } });
    }
    const enough = batch.count === undefined || rows.length >= batch.count * GONE_MIN_SHARE;
    if (batch.complete && enough) {
      // Pending requests this complete read did not list are no longer on Zalo.
      await col.updateMany({ uid, direction: batch.direction, status: 'pending', _id: { $nin: ids as never[] } }, { $set: { status: 'gone', goneAt: now } });
    }
    await this.db
      .col(FRIEND_REQUEST_LISTS)
      .updateOne(
        { _id: `${uid}:${batch.direction}` as never },
        { $set: { uid, direction: batch.direction, ...(batch.count !== undefined ? { count: batch.count } : {}), readAt: now, complete: batch.complete } },
        { upsert: true },
      );
    if (rejected) this.logger.warn(`[${uid}/friend-requests-dom] rejected ${rejected} row(s)`);
    return { stored: rows.length, rejected };
  }

  /** Requests of one direction for MH-SZ-10 (default: the pending ones), plus the badge count and the quota. */
  async list(query: FriendRequestListQuery): Promise<FriendRequestListResponse> {
    await this.ensureIndexes();
    const { uid, direction } = query;
    const status: FriendRequestStatus = query.status ?? 'pending';
    const col = this.db.col(C.friendRequests);
    const [docs, pending, snap, quota] = await Promise.all([
      col.find({ uid, direction, status }).sort({ order: 1, firstSeenAt: -1 }).limit(500).toArray(),
      col.countDocuments({ uid, direction, status: 'pending' }),
      this.db.col(FRIEND_REQUEST_LISTS).findOne({ _id: `${uid}:${direction}` as never }),
      friendQuota(this.db, uid),
    ]);
    const cmds = docs.length
      ? await this.db
          .col(C.suggestions)
          .find(
            { uid, action: { $in: ['friend_accept', 'friend_reject'] }, 'friend.userId': { $in: docs.map((d) => String(d.userId)) }, status: { $in: OPEN_COMMAND } },
            { projection: { 'friend.userId': 1, status: 1, createdAt: 1 } },
          )
          .sort({ createdAt: 1 })
          .toArray()
      : [];
    const byUser = new Map<string, string>();
    for (const c of cmds) byUser.set(String((c.friend as { userId: string }).userId), String(c.status));
    const items: FriendRequestItem[] = docs.map((d) => ({
      userId: String(d.userId),
      name: String(d.name ?? ''),
      avatar: str(d.avatar),
      message: str(d.message),
      source: str(d.source),
      dateText: str(d.dateText),
      status: d.status as FriendRequestStatus,
      firstSeenAt: toIso(d.firstSeenAt) ?? '',
      seenAt: toIso(d.seenAt) ?? '',
      commandStatus: byUser.get(String(d.userId)) ?? null,
    }));
    return { items, pending, zaloCount: typeof snap?.count === 'number' ? snap.count : null, readAt: toIso(snap?.readAt), quota };
  }
}
