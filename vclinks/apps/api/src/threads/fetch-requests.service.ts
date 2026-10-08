import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FETCH_CONFIRM_IDS,
  FETCH_STALE_MS,
  PRESENCE_ONLINE_MS,
  channelOfUid,
  fetchResultSchema,
  type ExtensionPresence,
  type FetchRequest,
  type FetchStatus,
  type FetchStatusView,
  type FetchWaiting,
} from '@vclinks/shared';
import type { Filter } from 'mongodb';
import { parseOr400 } from '../common/zod';
import { C, DbService } from '../db/db.service';
import { holdAfterReconnect, wasOffline } from '../outbox/outbox-hold';
import { deepDone, recordContentRun } from './autosync.service';

/**
 * What the extension needs to open a conversation that is not in Zalo Web's
 * rendered sidebar: its display name (for Zalo's search box) and the cliMsgIds
 * of its newest messages (to confirm the right chat is open from the bubbles).
 * Used by fetch requests and by the outbox sender.
 */
export async function conversationOpenHints(
  db: DbService,
  uid: string,
  threadId: string,
): Promise<{ name?: string; recentCliMsgIds: string[] }> {
  const [conv, msgs] = await Promise.all([
    db.col(C.conversations).findOne({ _id: `${uid}:${threadId}` as never }, { projection: { name: 1 } }),
    db
      .col(C.messages)
      .find({ uid, threadId, cliMsgId: { $nin: [null, ''] } }, { projection: { cliMsgId: 1 } })
      .sort({ sentAt: -1 })
      .limit(FETCH_CONFIRM_IDS)
      .toArray(),
  ]);
  const name = typeof conv?.name === 'string' && conv.name.trim() ? conv.name.trim().slice(0, 200) : undefined;
  return { ...(name ? { name } : {}), recentCliMsgIds: msgs.map((m) => String(m.cliMsgId)) };
}

interface FetchRequestDoc {
  _id: string;
  uid: string;
  threadId: string;
  status: FetchStatus;
  requestedAt: Date;
  requestedBy: string;
  claimedAt?: Date;
  claimedBy?: string;
  finishedAt?: Date;
  reason?: string;
  posted?: number;
  error?: string;
  /** Explicit confirmed request: open the conversation even with unread messages (sender sees "Đã xem"). */
  allowUnread?: boolean;
}

/** Heartbeat of the extension per account (collection `extension_presence`). */
interface PresenceDoc {
  _id: string;
  lastSeenAt: Date;
  loggedIn: boolean | null;
  waiting: FetchWaiting | null;
  by: string;
}

/** Longest long-poll hold of GET /fetch-requests/pending. */
const FETCH_MAX_WAIT_MS = 25_000;

/** Requests per /pending poll: the extension handles them one at a time anyway. */
const PENDING_LIMIT = 3;

function toFetchRequest(d: FetchRequestDoc): FetchRequest {
  return {
    id: d._id,
    uid: d.uid,
    threadId: d.threadId,
    status: d.status,
    requestedAt: d.requestedAt.toISOString(),
    ...(d.claimedAt ? { claimedAt: d.claimedAt.toISOString() } : {}),
    ...(d.finishedAt ? { finishedAt: d.finishedAt.toISOString() } : {}),
    ...(d.reason ? { reason: d.reason } : {}),
    ...(d.posted != null ? { posted: d.posted } : {}),
    ...(d.error ? { error: d.error } : {}),
    ...(d.allowUnread ? { allowUnread: true } : {}),
  };
}

/** Pending, or running but abandoned (tab closed / reloaded mid-run). */
function claimable(now: Date): Filter<FetchRequestDoc> {
  return {
    $or: [{ status: 'pending' }, { status: 'running', claimedAt: { $lt: new Date(now.getTime() - FETCH_STALE_MS) } }],
  };
}

/**
 * Dashboard → extension "load this conversation from Zalo Web" queue
 * (collection `fetch_requests`, one doc per conversation). Ids only, never text.
 */
@Injectable()
export class FetchRequestsService {
  constructor(private readonly db: DbService) {}

  /** Long-poll waiters per uid, woken when a request is queued. */
  private readonly waiters = new Map<string, Set<() => void>>();

  private get col() {
    return this.db.col<FetchRequestDoc>(C.fetchRequests);
  }

  private notify(uid: string) {
    const set = this.waiters.get(uid);
    if (!set) return;
    this.waiters.delete(uid);
    for (const wake of set) wake();
  }

  /**
   * `pending()` that, when empty, holds the call up to `waitMs` until a request
   * is queued for `uid`, then queries once more: the extension starts a
   * Dashboard request within a round trip instead of a poll period. Waiters live
   * in this process only (several API instances fall back to the poll period).
   */
  async pendingWait(uid: string, waitMs: number): Promise<FetchRequest[]> {
    const first = await this.pending(uid);
    if (first.length || waitMs <= 0) return first;
    await new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const wake = () => {
        if (timer) clearTimeout(timer);
        this.waiters.get(uid)?.delete(wake);
        resolve();
      };
      timer = setTimeout(wake, Math.min(waitMs, FETCH_MAX_WAIT_MS));
      timer.unref?.();
      let set = this.waiters.get(uid);
      if (!set) this.waiters.set(uid, (set = new Set()));
      set.add(wake);
    });
    return this.pending(uid);
  }

  private split(id: string): { uid: string; threadId: string } {
    const i = id.indexOf(':');
    if (i <= 0 || i === id.length - 1 || id.length > 260) throw new BadRequestException('Mã hội thoại không hợp lệ');
    return { uid: id.slice(0, i), threadId: id.slice(i + 1) };
  }

  /** Queues (or re-arms) a fetch; a request already pending/running is returned as is. */
  async request(conversationId: string, actor: string, opts: { allowUnread?: boolean } = {}): Promise<FetchRequest> {
    const { uid, threadId } = this.split(conversationId);
    if (channelOfUid(uid) !== 'zalo') throw new BadRequestException('Chỉ hỗ trợ lấy nội dung cho kênh Zalo cá nhân');
    const exists = await this.db.col(C.conversations).countDocuments({ _id: conversationId as never }, { limit: 1 });
    if (!exists) throw new NotFoundException('Không tìm thấy hội thoại');

    const now = new Date();
    const active = await this.col.findOne({
      _id: conversationId,
      $or: [{ status: 'pending' }, { status: 'running', claimedAt: { $gte: new Date(now.getTime() - FETCH_STALE_MS) } }],
    });
    if (active) {
      // A confirmed "open it even if unread" joins a request that is already queued.
      if (opts.allowUnread && !active.allowUnread) {
        await this.col.updateOne({ _id: conversationId }, { $set: { allowUnread: true } });
        return toFetchRequest({ ...active, allowUnread: true });
      }
      return toFetchRequest(active);
    }

    const doc = await this.col.findOneAndUpdate(
      { _id: conversationId },
      {
        $set: { uid, threadId, status: 'pending', requestedAt: now, requestedBy: actor, ...(opts.allowUnread ? { allowUnread: true } : {}) },
        $unset: { claimedAt: '', claimedBy: '', finishedAt: '', reason: '', posted: '', error: '', ...(opts.allowUnread ? {} : { allowUnread: '' }) },
      },
      { upsert: true, returnDocument: 'after' },
    );
    this.notify(uid);
    await this.db.audit(actor, 'fetch.request', conversationId);
    return toFetchRequest(doc!);
  }

  private get presence() {
    return this.db.col<PresenceDoc>(C.extensionPresence);
  }

  /** The request, plus whether an online extension is logged in to its account. */
  async get(conversationId: string): Promise<FetchStatusView> {
    const { uid } = this.split(conversationId);
    const since = new Date(Date.now() - PRESENCE_ONLINE_MS);
    const [doc, mine, other] = await Promise.all([
      this.col.findOne({ _id: conversationId }),
      this.presence.findOne({ _id: uid }),
      this.presence.findOne({ _id: { $ne: uid }, loggedIn: true, lastSeenAt: { $gte: since } }, { sort: { lastSeenAt: -1 } }),
    ]);
    const extension: ExtensionPresence | null = mine
      ? {
          online: mine.lastSeenAt >= since,
          lastSeenAt: mine.lastSeenAt.toISOString(),
          loggedIn: mine.loggedIn,
          waiting: mine.waiting,
        }
      : null;
    let otherLoggedIn: FetchStatusView['otherLoggedIn'] = null;
    if (other && !(extension?.online && extension.loggedIn)) {
      const acc = await this.db.col(C.accounts).findOne({ _id: other._id as never }, { projection: { label: 1 } });
      otherLoggedIn = { uid: other._id, label: (acc?.label as string | undefined) || other._id };
    }
    return { ...(doc ? toFetchRequest(doc) : { status: 'none' as const }), extension, otherLoggedIn };
  }

  /** Records the extension's heartbeat for one account (sent with every poll). */
  async heartbeat(uid: string, p: { loggedIn?: '1' | '0'; waiting?: FetchWaiting }, actor: string) {
    const now = new Date();
    const prev = await this.presence.findOneAndUpdate(
      { _id: uid },
      {
        $set: {
          lastSeenAt: now,
          loggedIn: p.loggedIn === undefined ? null : p.loggedIn === '1',
          waiting: p.waiting ?? null,
          by: actor,
        },
      },
      { upsert: true, returnDocument: 'before' },
    );
    // Nick back online after being red: hold items that waited too long (03 SZ-28 b).
    if (p.loggedIn !== '0' && wasOffline(prev, now)) await holdAfterReconnect(this.db, uid, now);
  }

  /**
   * Oldest claimable requests of one account, each with the conversation name
   * and its newest cliMsgIds (see FetchRequest.name / recentCliMsgIds).
   */
  async pending(uid: string): Promise<FetchRequest[]> {
    const docs = await this.col
      .find({ uid, ...claimable(new Date()) })
      .sort({ requestedAt: 1 })
      .limit(PENDING_LIMIT)
      .toArray();
    return Promise.all(
      docs.map(async (d) => ({
        ...toFetchRequest(d),
        ...(await conversationOpenHints(this.db, uid, d.threadId)),
        deep: !(await deepDone(this.db, uid, d.threadId)),
      })),
    );
  }

  async claim(id: string, actor: string): Promise<FetchRequest> {
    const now = new Date();
    const doc = await this.col.findOneAndUpdate(
      { _id: id, ...claimable(now) },
      { $set: { status: 'running', claimedAt: now, claimedBy: actor } },
      { returnDocument: 'after' },
    );
    if (!doc) throw new ConflictException('Yêu cầu không còn chờ xử lý');
    return toFetchRequest(doc);
  }

  async result(id: string, body: unknown, actor: string): Promise<FetchRequest> {
    const r = parseOr400(fetchResultSchema, body);
    const doc = await this.col.findOneAndUpdate(
      { _id: id, status: 'running' },
      {
        $set: {
          status: r.ok ? 'done' : 'failed',
          finishedAt: new Date(),
          ...(r.reason ? { reason: r.reason } : {}),
          ...(r.posted != null ? { posted: r.posted } : {}),
          ...(r.error ? { error: r.error } : {}),
        },
      },
      { returnDocument: 'after' },
    );
    if (!doc) throw new ConflictException('Yêu cầu không ở trạng thái đang chạy');
    if (r.ok) {
      await recordContentRun(this.db, {
        uid: doc.uid,
        threadId: doc.threadId,
        mode: 'deep',
        outcome: 'done',
        reason: r.reason,
        posted: r.posted,
        webHistoryFrom: r.webHistoryFrom,
      });
    }
    await this.db.audit(actor, r.ok ? 'fetch.done' : 'fetch.failed', id, { reason: r.reason, posted: r.posted });
    return toFetchRequest(doc);
  }
}
