import { BadRequestException, ConflictException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CHANNELS,
  CHANNEL_INFO,
  OUTBOX_ATTENTION,
  OUTBOX_EXPIRE_MS,
  OUTBOX_STALE_SENDING_MS,
  OUTBOX_STATUSES,
  outboxCancelSchema,
  outboxSources,
  channelOfUid,
  uidChannelFilter,
  type Channel,
  outboxLabel,
  outboxResultSchema,
  isFriendAction,
  sendPaceMessage,
  FRIEND_TARGET_BLOCKED,
  type OutboxFriend,
  type OutboxAction,
  type OutboxAttachment,
  type OutboxCancelReason,
  type OutboxCounts,
  type OutboxCreate,
  type OutboxItem,
  type OutboxResult,
  type OutboxStatus,
  type OutboxReaction,
  type OutboxSticker,
  type OutboxHoldReason,
  type OutboxQuote,
  type OutboxSendSource,
} from '@vclinks/shared';
import { Filter, ObjectId } from 'mongodb';
import { AccountsService } from '../accounts/accounts.service';
import type { Principal } from '../auth/token.service';
import { AuthzService } from '../authz/authz.service';
import { MediaService } from '../media/media.service';
import { C, DbService } from '../db/db.service';
import { IngestService } from '../ingest/ingest.service';
import { sentTextByCliMsgId } from '../ingest/sent-text';
import { parseOr400 } from '../common/zod';
import { conversationOpenHints } from '../threads/fetch-requests.service';
import { auditThreadId, friendCommandAllowed, friendGateOpen, mirrorFriendEffect, prepareFriendCommand } from './outbox-friend';
import { QUOTE_GATE, type QuoteGate } from '../quotes/quote-gate';
import { recordQuoteSent } from '../quotes/quote-sends';
import { sendPaceWait, takeSendPaceSlot } from './outbox-pace';
import { SYSTEM_ACTOR, expireStale, holdAfterReconnect, holdItems, wasOffline, type PresenceSnapshot } from './outbox-hold';

/**
 * Who approves an item: the signed-in user (`id` = user id, recorded in approvedBy; D40, PQ-51) or, for
 * tokens without a user, the token name. `name` is shown as "Duyệt bởi".
 */
export interface Approver {
  id: string;
  name: string;
}

export const approverOf = (p: Principal): Approver => ({ id: p.userId ?? p.name, name: p.name });

/** Stored in `suggestions` (CLAUDE.md §5); manual outbox items have source 'manual'. */
export interface SuggestionDoc {
  _id: ObjectId;
  uid: string;
  threadId: string;
  draft: string;
  finalText: string;
  status: OutboxStatus | 'pending' | 'edited' | 'rejected';
  source: 'manual' | 'suggest';
  replyToCliMsgId?: string;
  /** Command (absent = send_text); `finalText` then holds its label, e.g. "[2 ảnh]". */
  action?: OutboxAction;
  mentions?: { name: string; uid?: string }[];
  attachments?: OutboxAttachment[];
  /** send_quote: which quote, how, and the words after the file (M1c-02). */
  quote?: OutboxQuote;
  card?: { name: string; userId?: string; withPhone?: boolean };
  sticker?: OutboxSticker;
  poll?: { question: string; options: string[] };
  reaction?: OutboxReaction;
  pin?: boolean;
  friend?: OutboxFriend;
  /** cliMsgId of the sent message that carries the quote (first line of a reply item). */
  replyCliMsgId?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Date;
  /** Sent on someone else's nick (QT-SZ-10): trả lời thay / trực thay, and the holder at that time. */
  sendSource?: OutboxSendSource;
  onBehalfOf?: string;
  onBehalfOfName?: string;
  /** needs_reapproval: why (PQ-51). */
  holdReason?: OutboxHoldReason;
  createdAt: Date;
  claimedAt?: Date;
  claimedBy?: string;
  sentAt?: Date;
  cliMsgId?: string;
  cliMsgIds?: string[];
  error?: string;
  /** Last status change ("Treo {n} phút"). Missing on items created before M1a-05: createdAt. */
  statusAt?: Date;
  /** Number of claims (sender attempts). */
  attempts?: number;
  cancelReason?: OutboxCancelReason;
  cancelledBy?: string;
}

/** Channels whose sender supports replying to a message (quote). */
export const REPLY_CHANNELS: readonly Channel[] = ['zalo'];

/** Items per /pending poll. */
export const PENDING_LIMIT = 5;
/** A claim older than this is "stale": shown as sending, never auto-retried. */
export const STALE_SENDING_MS = OUTBOX_STALE_SENDING_MS;

/** Self uids Zalo Web writes in `fromUid` for the nick's own messages (shared mapping.ts). */
const SELF_FROM = ['0', '-1'];

/**
 * The approval invariant as a query: status approved AND a non-empty approver
 * AND an approval date AND a text to send. Every read that hands an item out
 * and every write that marks one sent goes through this filter.
 */
export const APPROVED_FILTER = {
  approvedBy: { $type: 'string', $ne: '' },
  approvedAt: { $type: 'date' },
  finalText: { $type: 'string', $ne: '' },
} as const satisfies Filter<SuggestionDoc>;

export function toOutboxItem(d: SuggestionDoc): OutboxItem {
  return {
    id: d._id.toHexString(),
    uid: d.uid,
    channel: channelOfUid(d.uid),
    threadId: d.threadId,
    text: d.finalText,
    ...(d.action && d.action !== 'send_text' ? { action: d.action } : {}),
    ...(d.mentions?.length ? { mentions: d.mentions } : {}),
    ...(d.attachments?.length ? { attachments: d.attachments } : {}),
    ...(d.quote ? { quote: d.quote } : {}),
    ...(d.card ? { card: d.card } : {}),
    ...(d.sticker ? { sticker: d.sticker } : {}),
    ...(d.poll ? { poll: d.poll } : {}),
    ...(d.reaction ? { reaction: d.reaction } : {}),
    ...(typeof d.pin === 'boolean' ? { pin: d.pin } : {}),
    ...(d.friend ? { friend: d.friend } : {}),
    status: d.status as OutboxStatus,
    approvedBy: d.approvedBy ?? '',
    ...(d.approvedByName ? { approvedByName: d.approvedByName } : {}),
    approvedAt: d.approvedAt?.toISOString() ?? '',
    ...(d.sendSource ? { sendSource: d.sendSource } : {}),
    ...(d.onBehalfOfName ? { onBehalfOfName: d.onBehalfOfName } : {}),
    ...(d.status === 'needs_reapproval' && d.holdReason ? { holdReason: d.holdReason } : {}),
    ...(d.sentAt ? { sentAt: d.sentAt.toISOString() } : {}),
    ...(d.cliMsgId ? { cliMsgId: d.cliMsgId } : {}),
    ...(d.cliMsgIds?.length ? { cliMsgIds: d.cliMsgIds } : {}),
    ...(d.error ? { error: d.error } : {}),
    createdAt: d.createdAt.toISOString(),
    statusAt: (d.statusAt ?? d.createdAt).toISOString(),
    ...(d.attempts ? { attempts: d.attempts } : {}),
    ...(d.cancelReason ? { cancelReason: d.cancelReason } : {}),
    ...(d.replyToCliMsgId ? { replyToCliMsgId: d.replyToCliMsgId } : {}),
  };
}

const isApiChannel = (uid: string) => CHANNEL_INFO[channelOfUid(uid)].sendMode === 'api';

/** uid filter matching only accounts the extension / Claude send for (not API channels). */
const EXTENSION_UIDS: Filter<SuggestionDoc>['uid'] = {
  $not: new RegExp(
    `^(${CHANNELS.filter((c) => CHANNEL_INFO[c].sendMode === 'api')
      .map((c) => CHANNEL_INFO[c].uidPrefix)
      .join('|')})`,
  ),
};

function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw new NotFoundException('Không tìm thấy tin chờ gửi');
  return new ObjectId(id);
}

/**
 * Outbox of approved messages. The Dashboard creates approved items; the
 * extension (REST, scope ingest) or Claude (MCP) claims and reports them.
 * Audit entries and logs never contain message text.
 */
/** Upper bound of one long-poll on /outbox/pending (below the MV3 service-worker 30 s fetch limit). */
export const PENDING_MAX_WAIT_MS = 25_000;

@Injectable()
export class OutboxService {
  private indexed = false;
  /** Long-poll waiters per uid ('*' = unscoped), woken when an item becomes approved. */
  private readonly waiters = new Map<string, Set<() => void>>();

  constructor(
    private readonly db: DbService,
    private readonly accounts: AccountsService,
    private readonly media: MediaService,
    private readonly authz: AuthzService,
    // M1c-07: push failed commands to open Dashboards.
    @Optional() private readonly realtime?: RealtimeService,
    // M1c-02: re-checks a quote when its command is re-approved (only the app provides it, not the connector).
    @Optional() @Inject(QUOTE_GATE) private readonly quoteGate?: QuoteGate,
    // Shows the sent text on the message at once (the extension reads it back from the screen much later).
    @Optional() private readonly ingest?: IngestService,
  ) {}

  private get col() {
    return this.db.col<SuggestionDoc>(C.suggestions);
  }

  /** Attachment metadata for a command; images must be raster photos. */
  private async attachmentsFor(input: OutboxCreate): Promise<OutboxAttachment[] | undefined> {
    if (!input.attachments?.length) return undefined;
    const known = await this.media.describe(input.attachments);
    const list = input.attachments.map((id) => known.get(id));
    if (list.some((a) => !a)) throw new BadRequestException('Tệp đính kèm không tồn tại (hãy tải lên lại)');
    const atts = list as OutboxAttachment[];
    if ((input.action === 'send_images' || (input.action === 'send_quote' && input.quote?.form === 'image')) && atts.some((a) => !/^image\/(jpeg|png|webp|gif)$/.test(a.mime))) {
      throw new BadRequestException('Chỉ gửi được ảnh JPG, PNG, WEBP, GIF; tệp khác hãy gửi dạng file');
    }
    return atts;
  }

  private async ensureIndexes() {
    if (this.indexed) return;
    await this.col.createIndexes([
      { key: { uid: 1, status: 1, approvedAt: 1 } },
      { key: { uid: 1, threadId: 1, createdAt: -1 } },
    ]);
    this.indexed = true;
  }

  /** Channel and thread of an item, for the permission check of "Thử lại" / "Gửi ngay" / "Bỏ lệnh"; null when unknown. */
  async targetOf(id: string): Promise<{ uid: string; threadId: string } | null> {
    const doc = await this.col.findOne({ _id: oid(id) }, { projection: { uid: 1, threadId: 1 } });
    return doc ? { uid: doc.uid, threadId: doc.threadId } : null;
  }

  async create(
    input: OutboxCreate,
    approver: Approver,
    onBehalf?: { source: OutboxSendSource; holderId: string | null; holderName: string | null },
    /** `quote`: set only by QuotesService, which has just checked the quote on VCsales (BR16, BR17). */
    opts: { quote?: true } = {},
  ): Promise<OutboxItem> {
    const actor = approver.id;
    await this.ensureIndexes();
    await this.accounts.assertExists(input.uid);
    // Red / "Chưa an toàn" nick or a thread outside the test allowlist: refuse now instead of queueing forever (SZ-10, SZ-14).
    const action = input.action ?? 'send_text';
    // A quote only goes out through POST /quotes/send: it re-reads the quote and the file from VCsales itself.
    if (action === 'send_quote' && !opts.quote) throw new BadRequestException('Báo giá chỉ gửi được bằng hộp "Gửi báo giá"');
    await this.accounts.assertCanSend(input.uid, input.threadId, { anyThread: isFriendAction(action) });
    // Commands drive Zalo Web's own UI through the extension: personal Zalo only.
    if ((action !== 'send_text' || input.mentions?.length) && channelOfUid(input.uid) !== 'zalo') {
      throw new BadRequestException('Ảnh, file, danh thiếp, sticker, bình chọn, cảm xúc, ghim, đánh dấu đã đọc, kết bạn và @nhắc tên hiện chỉ hỗ trợ Zalo cá nhân');
    }
    const friend = isFriendAction(action) ? await prepareFriendCommand(this.db, input) : undefined;
    if (action === 'react') await this.assertMessageInThread(input.uid, input.threadId, input.reaction!.cliMsgId, 'Không tìm thấy tin cần thả cảm xúc trong hội thoại này');
    if ((action === 'create_poll' || input.mentions?.length) && !input.threadId.startsWith('g')) {
      throw new BadRequestException('Bình chọn và @nhắc tên chỉ dùng được trong nhóm');
    }
    const attachments = await this.attachmentsFor(input);
    const text = outboxLabel({ action, text: input.text, attachments, quote: input.quote, card: input.card, sticker: input.sticker, poll: input.poll, reaction: input.reaction, pin: input.pin, friend });
    if (input.replyToCliMsgId) await this.assertReplyTarget(input);
    const now = new Date();
    const doc: SuggestionDoc = {
      _id: new ObjectId(),
      uid: input.uid,
      threadId: input.threadId,
      draft: text,
      finalText: text,
      status: 'approved',
      source: 'manual',
      ...(action !== 'send_text' ? { action } : {}),
      ...(input.mentions?.length ? { mentions: input.mentions } : {}),
      ...(attachments ? { attachments } : {}),
      ...(input.quote ? { quote: input.quote } : {}),
      ...(input.card ? { card: input.card } : {}),
      ...(input.sticker ? { sticker: input.sticker } : {}),
      ...(input.poll ? { poll: input.poll } : {}),
      ...(input.reaction ? { reaction: input.reaction } : {}),
      ...(typeof input.pin === 'boolean' ? { pin: input.pin } : {}),
      ...(friend ? { friend } : {}),
      ...(input.replyToCliMsgId ? { replyToCliMsgId: input.replyToCliMsgId } : {}),
      approvedBy: actor,
      approvedByName: approver.name,
      approvedAt: now,
      ...(onBehalf
        ? {
            sendSource: onBehalf.source,
            ...(onBehalf.holderId ? { onBehalfOf: onBehalf.holderId } : {}),
            ...(onBehalf.holderName ? { onBehalfOfName: onBehalf.holderName } : {}),
          }
        : {}),
      createdAt: now,
      statusAt: now,
    };
    await this.col.insertOne(doc);
    await this.db.audit(actor, 'outbox.create', doc._id.toHexString(), {
      uid: doc.uid,
      threadId: auditThreadId(doc.action, doc.threadId),
      ...(doc.action ? { action: doc.action } : {}),
      ...(doc.sendSource ? { sendSource: doc.sendSource } : {}),
    });
    // PQ-38: replying on someone else's nick has its own audit line (ids only).
    if (doc.sendSource) await this.db.audit(actor, doc.sendSource === 'truc_thay' ? 'reply_cover' : 'reply_on_behalf', `${doc.uid}:${doc.threadId}`, { outboxId: doc._id.toHexString(), holder: doc.onBehalfOf ?? null });
    this.notify(doc.uid);
    return toOutboxItem(doc);
  }

  /**
   * `canDispatch` on items about to be handed to a sender (PQ-51): items whose approver may no longer
   * send go to `needs_reapproval` and are dropped from the list. Never throws on a single item.
   */
  private async dispatchable(docs: SuggestionDoc[]): Promise<SuggestionDoc[]> {
    const out: SuggestionDoc[] = [];
    for (const d of docs) {
      const r = await this.authz.canDispatch(d.approvedBy ?? '', d.uid, d.threadId);
      if (r.allowed) out.push(d);
      else await holdItems(this.db, { _id: d._id }, r.reason);
    }
    return out;
  }

  /** Wakes long-polls waiting for `uid` (and unscoped ones). */
  private notify(uid: string) {
    for (const key of [uid, '*']) {
      const set = this.waiters.get(key);
      if (!set) continue;
      this.waiters.delete(key);
      for (const wake of set) wake();
    }
  }

  /**
   * `pending()` that, when empty, holds the request up to `waitMs` until an item
   * is approved for `uid` (or the wait ends), then queries once more. Cuts the
   * extension's send latency from the poll period to ~one round trip. Waiters
   * live in this process only; several API instances would still fall back to
   * the caller's poll period.
   */
  async pendingWait(
    uid: string | undefined,
    waitMs: number,
    limit = PENDING_LIMIT,
    opts: { commands?: boolean } = {},
  ): Promise<OutboxItem[]> {
    const first = await this.pending(uid, limit, opts);
    if (first.length || waitMs <= 0) return first;
    const key = uid ?? '*';
    await new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const wake = () => {
        if (timer) clearTimeout(timer);
        this.waiters.get(key)?.delete(wake);
        resolve();
      };
      timer = setTimeout(wake, Math.min(waitMs, PENDING_MAX_WAIT_MS));
      timer.unref?.();
      let set = this.waiters.get(key);
      if (!set) this.waiters.set(key, (set = new Set()));
      set.add(wake);
    });
    return this.pending(uid, limit, opts);
  }

  /**
   * A reply must quote a stored message of the same thread, on a channel whose
   * sender can press Zalo's "Trả lời" (personal Zalo only for now).
   */
  private async assertReplyTarget(input: OutboxCreate) {
    if (!REPLY_CHANNELS.includes(channelOfUid(input.uid))) {
      throw new BadRequestException(`Kênh ${CHANNEL_INFO[channelOfUid(input.uid)].label} chưa hỗ trợ trả lời trích dẫn`);
    }
    await this.assertMessageInThread(input.uid, input.threadId, input.replyToCliMsgId!, 'Không tìm thấy tin cần trả lời trong hội thoại này');
  }

  /** A command that targets a message must name one stored in the same thread. */
  private async assertMessageInThread(uid: string, threadId: string, cliMsgId: string, message: string) {
    const found = await this.db.col(C.messages).countDocuments({ uid, threadId, cliMsgId }, { limit: 1 });
    if (!found) throw new BadRequestException(message);
  }

  /**
   * A state command the extension just performed on Zalo is mirrored right away
   * (the next sync of the reaction / conversation stores confirms or corrects
   * it), so the Dashboard does not wait up to a sync period for feedback.
   */
  private async mirrorCommandEffect(doc: SuggestionDoc) {
    const convId = `${doc.uid}:${doc.threadId}`;
    if (isFriendAction(doc.action)) return mirrorFriendEffect(this.db, doc);
    switch (doc.action) {
      case 'react': {
        if (!doc.reaction) return;
        const msg = await this.db.col(C.messages).findOne({ uid: doc.uid, threadId: doc.threadId, cliMsgId: doc.reaction.cliMsgId }, { projection: { msgId: 1 } });
        if (!msg?.msgId) return;
        const icon = doc.reaction.icon;
        await this.db.col(C.reactions).updateOne(
          { _id: `${doc.uid}:${msg.msgId}` as never },
          {
            $set: { uid: doc.uid, msgId: msg.msgId, cliMsgId: doc.reaction.cliMsgId, threadId: doc.threadId, [`byUser.0`]: icon, lastSender: '0', lastUpdate: new Date(), mirrored: true },
            $inc: { [`totals.${icon}`]: 1, total: 1, [`reactions.0.${icon}`]: 1 },
            $setOnInsert: { ingestedAt: new Date() },
          },
          { upsert: true },
        );
        return;
      }
      case 'pin_conversation':
        await this.db.col(C.conversations).updateOne({ _id: convId as never }, { $set: { pinned: doc.pin !== false } });
        return;
      case 'mark_read':
        await this.db.col(C.conversations).updateOne({ _id: convId as never }, { $set: { unread: 0, domUnread: 0 } });
        return;
      case 'mark_unread':
        await this.db.col(C.conversations).updateOne({ _id: convId as never }, { $set: { unread: 1 } });
        return;
      default:
        return;
    }
  }

  /**
   * Mongo filter of GET /outbox and /outbox/counts. "Của tôi" (mine) = items I approved, plus items on a
   * nick I hold / cover that wait for "Duyệt lại" (PQ-51: only the holder may re-approve them).
   * `onBehalf` = items others sent on my nicks in the last 30 days (QT-SZ-10 #5).
   */
  private listFilter(q: { uid?: string; threadId?: string; mine?: '0' | '1'; onBehalf?: '0' | '1' }, actor: string, heldUids: string[] = []): Filter<SuggestionDoc> {
    const filter: Filter<SuggestionDoc> = { ...APPROVED_FILTER };
    if (q.uid) filter.uid = q.uid;
    if (q.threadId) filter.threadId = q.threadId;
    if (q.onBehalf === '1') {
      filter.onBehalfOf = actor;
      filter.createdAt = { $gte: new Date(Date.now() - 30 * 24 * 3600_000) };
    } else if (q.mine === '1') {
      delete (filter as Record<string, unknown>).approvedBy;
      filter.$and = [
        { approvedBy: APPROVED_FILTER.approvedBy },
        { $or: [{ approvedBy: actor }, ...(heldUids.length ? [{ uid: { $in: heldUids }, status: 'needs_reapproval' as const }] : [])] },
      ];
    }
    return filter;
  }

  /**
   * Outbox items for the chat view and MH-SZ-13. Default: every status but
   * `cancelled`, newest first. When only attention statuses are asked for
   * (failed / expired / awaiting_confirm) the longest-hanging item comes first
   * (MH-SZ-13 #4). `awaiting_confirm` items carry the phone-duplicate warning.
   */
  async list(
    q: { uid?: string; threadId?: string; status?: OutboxStatus[]; mine?: '0' | '1'; onBehalf?: '0' | '1'; limit: number },
    actor = '',
    heldUids: string[] = [],
  ): Promise<OutboxItem[]> {
    await expireStale(this.db);
    const statuses = q.status?.length ? q.status : OUTBOX_STATUSES.filter((st) => st !== 'cancelled');
    const filter: Filter<SuggestionDoc> = { ...this.listFilter(q, actor, heldUids), status: { $in: statuses } };
    const hanging = statuses.every((st) => OUTBOX_ATTENTION.includes(st));
    const docs = await this.col
      .find(filter)
      .sort(hanging ? { statusAt: 1, createdAt: 1 } : { createdAt: -1 })
      .limit(q.limit)
      .toArray();
    const names = await this.conversationNames(docs);
    return Promise.all(
      docs.map(async (d) => {
        const name = names.get(`${d.uid}:${d.threadId}`);
        const item = { ...toOutboxItem(d), ...(name ? { name } : {}) };
        if (d.status !== 'awaiting_confirm') return item;
        const dup = await this.phoneDuplicate(d);
        return dup ? { ...item, phoneDuplicate: dup } : item;
      }),
    );
  }

  /** Conversation display names for the cards of MH-SZ-13 and the failure notices. */
  private async conversationNames(docs: SuggestionDoc[]): Promise<Map<string, string>> {
    const ids = [...new Set(docs.map((d) => `${d.uid}:${d.threadId}`))];
    const out = new Map<string, string>();
    if (!ids.length) return out;
    const rows = await this.db.col(C.conversations).find({ _id: { $in: ids as never[] } }, { projection: { name: 1 } }).toArray();
    for (const r of rows) if (typeof r.name === 'string' && r.name.trim()) out.set(String(r._id), r.name.trim().slice(0, 200));
    return out;
  }

  /**
   * SZ-28 (d): newest message the nick sent outside VClinks (from the phone or
   * Zalo Web directly) in the item's thread after the item was created.
   */
  private async phoneDuplicate(d: SuggestionDoc): Promise<{ at: string; preview: string } | null> {
    const own = await this.db
      .col(C.messages)
      .find(
        { uid: d.uid, threadId: d.threadId, fromUid: { $in: SELF_FROM }, sentAt: { $gt: d.createdAt } },
        { projection: { cliMsgId: 1, text: 1, sentAt: 1 } },
      )
      .sort({ sentAt: -1 })
      .limit(20)
      .toArray();
    if (!own.length) return null;
    const ids = own.map((m) => m.cliMsgId).filter((x): x is string => typeof x === 'string' && !!x);
    const viaVclinks = new Set<string>();
    if (ids.length) {
      const sent = await this.col
        .find({ uid: d.uid, $or: [{ cliMsgId: { $in: ids } }, { replyCliMsgId: { $in: ids } }] }, { projection: { cliMsgId: 1, replyCliMsgId: 1 } })
        .toArray();
      for (const x of sent) {
        if (x.cliMsgId) viaVclinks.add(x.cliMsgId);
        if (x.replyCliMsgId) viaVclinks.add(x.replyCliMsgId);
      }
    }
    const m = own.find((x) => !x.cliMsgId || !viaVclinks.has(String(x.cliMsgId)));
    if (!m) return null;
    return { at: (m.sentAt as Date).toISOString(), preview: String(m.text ?? '').slice(0, 60) };
  }

  /** Items per status for MH-SZ-13's filter chips and the "Lệnh gửi" badge. */
  async counts(q: { uid?: string; threadId?: string; mine?: '0' | '1' }, actor = '', now = new Date(), heldUids: string[] = []): Promise<OutboxCounts> {
    await expireStale(this.db, now);
    const base = this.listFilter(q, actor, heldUids);
    const rows = await this.col
      .aggregate<{ _id: OutboxStatus; n: number }>([
        { $match: { ...base, status: { $in: ['approved', 'sending', 'failed', 'expired', 'awaiting_confirm', 'needs_reapproval'] } } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ])
      .toArray();
    const by = Object.fromEntries(rows.map((r) => [r._id, r.n])) as Partial<Record<OutboxStatus, number>>;
    const sentToday = await this.col.countDocuments({ ...base, status: 'sent', sentAt: { $gte: startOfDayVn(now) } });
    const failed = by.failed ?? 0;
    const expired = by.expired ?? 0;
    const awaiting = by.awaiting_confirm ?? 0;
    const reapproval = by.needs_reapproval ?? 0;
    return {
      approved: by.approved ?? 0,
      sending: by.sending ?? 0,
      failed,
      expired,
      awaiting_confirm: awaiting,
      needs_reapproval: reapproval,
      sentToday,
      attention: failed + expired + awaiting + reapproval,
    };
  }

  /**
   * Called on every extension poll of `uid`: when the nick was red until now
   * (no fresh heartbeat), items that waited longer than the hold window go to
   * `awaiting_confirm` instead of being sent (SZ-28 b). The heartbeat path
   * (FetchRequestsService) does the same, whichever poll arrives first.
   */
  async noteExtensionPoll(uid: string, now = new Date()): Promise<void> {
    const prev = await this.db.col<{ _id: string } & PresenceSnapshot>(C.extensionPresence).findOne({ _id: uid });
    if (wasOffline(prev, now)) await holdAfterReconnect(this.db, uid, now);
  }

  /**
   * Approved items waiting to be sent by the extension or Claude, oldest
   * approval first. API channels (Zalo OA, Fanpage) are never listed: the
   * API's OutboxDispatcher sends those.
   */
  async pending(uid: string | undefined, limit = PENDING_LIMIT, opts: { commands?: boolean } = {}): Promise<OutboxItem[]> {
    if (uid && isApiChannel(uid)) return [];
    const now = new Date();
    await expireStale(this.db, now, uid);
    const filter: Filter<SuggestionDoc> = {
      status: 'approved',
      ...APPROVED_FILTER,
      // Belt and braces next to expireStale: never hand out an item past its deadline (SZ-11).
      approvedAt: { $type: 'date', $gte: new Date(now.getTime() - OUTBOX_EXPIRE_MS) },
      uid: uid ?? EXTENSION_UIDS,
      // Commands (photos, file, card, poll, @mentions) only go to clients that
      // declare support: an older extension or MCP client would type the label
      // ("[2 ảnh]") as plain text instead.
      ...(opts.commands ? {} : { action: { $exists: false }, 'mentions.0': { $exists: false } }),
    };
    // Friend requests are paced (SZ-09): split them out so a held one never takes a slot of a sendable item.
    // The send pace (M1a-06) is enforced at claim: the list stays complete so nothing looks lost.
    const docs = await this.col.find(opts.commands ? { ...filter, action: { $ne: 'friend_request' } } : filter).sort({ approvedAt: 1, _id: 1 }).limit(limit).toArray();
    if (opts.commands) docs.push(...(await this.pacedFriendRequests(filter, now)));
    docs.sort((a, b) => (a.approvedAt?.getTime() ?? 0) - (b.approvedAt?.getTime() ?? 0));
    return (await this.dispatchable(docs.slice(0, limit))).map(toOutboxItem);
  }

  /**
   * Approved `friend_request` items that may go out now: at most one per nick,
   * and only when the nick's gap (30 s) and daily limit (20) allow it. The
   * others stay `approved` and are handed out by a later poll, never dropped
   * (the 30-minute expiry still applies).
   */
  private async pacedFriendRequests(filter: Filter<SuggestionDoc>, now: Date): Promise<SuggestionDoc[]> {
    const waiting = await this.col.find({ ...filter, action: 'friend_request' }).sort({ approvedAt: 1, _id: 1 }).limit(50).toArray();
    const seen = new Set<string>();
    const out: SuggestionDoc[] = [];
    for (const d of waiting) {
      if (seen.has(d.uid)) continue;
      seen.add(d.uid);
      if (await friendGateOpen(this.db, d.uid, now)) out.push(d);
    }
    return out;
  }

  /**
   * `pending` for the extension's poll: each item also carries the
   * conversation's name and newest cliMsgIds so the extension can open a
   * conversation that is not in Zalo Web's rendered sidebar (via search) and
   * confirm it before typing. MCP keeps the short `pending` response.
   */
  async pendingForExtension(
    uid: string | undefined,
    limit = PENDING_LIMIT,
    opts: { commands?: boolean; waitMs?: number } = {},
  ): Promise<OutboxItem[]> {
    if (uid) await this.noteExtensionPoll(uid);
    const items = await this.pendingWait(uid, opts.waitMs ?? 0, limit, { commands: opts.commands });
    return Promise.all(
      items.map(async (it) => ({ ...it, ...(await conversationOpenHints(this.db, it.uid, it.threadId)), ...(await this.targetHint(it)) })),
    );
  }

  /**
   * The message a reply or a reaction points at, as stored. A direct (zca-js) nick quotes or reacts with the
   * message itself (ids, type, author, send time, text), not just its cliMsgId. Text only when plaintext.
   */
  private async targetHint(it: OutboxItem): Promise<Pick<OutboxItem, 'target'>> {
    const cliMsgId = it.replyToCliMsgId ?? it.reaction?.cliMsgId;
    if (!cliMsgId) return {};
    const m = await this.db
      .col(C.messages)
      .findOne(
        { uid: it.uid, threadId: it.threadId, cliMsgId },
        { projection: { msgId: 1, cliMsgId: 1, fromUid: 1, msgType: 1, sentAt: 1, ttl: 1, text: 1, encrypted: 1 } },
      );
    if (!m?.msgId) return {};
    return {
      target: {
        msgId: String(m.msgId),
        cliMsgId: String(m.cliMsgId),
        fromUid: String(m.fromUid ?? ''),
        ...(m.msgType ? { msgType: String(m.msgType) } : {}),
        ...(m.sentAt instanceof Date ? { sentAt: m.sentAt.toISOString() } : {}),
        ...(typeof m.ttl === 'number' ? { ttl: m.ttl } : {}),
        ...(!m.encrypted && typeof m.text === 'string' ? { text: m.text.slice(0, 2000) } : {}),
      },
    };
  }

  /** Approved items of one channel, for the server-side dispatcher. */
  async pendingForChannel(channel: Channel, limit = PENDING_LIMIT): Promise<OutboxItem[]> {
    const now = new Date();
    await expireStale(this.db, now);
    const filter: Filter<SuggestionDoc> = {
      status: 'approved',
      ...APPROVED_FILTER,
      approvedAt: { $type: 'date', $gte: new Date(now.getTime() - OUTBOX_EXPIRE_MS) },
      uid: uidChannelFilter(channel),
    };
    const docs = await this.col.find(filter).sort({ approvedAt: 1, _id: 1 }).limit(limit).toArray();
    return (await this.dispatchable(docs)).map(toOutboxItem);
  }

  /**
   * Atomically moves approved → sending. 409 when someone else got it first.
   * Items of API channels can only be claimed by the dispatcher (`viaApi`).
   */
  async claim(id: string, actor: string, viaApi = false): Promise<OutboxItem> {
    const _id = oid(id);
    const now = new Date();
    const head = await this.col.findOne({ _id }, { projection: { action: 1, uid: 1, threadId: 1, friend: 1, quote: 1, status: 1 } });
    // BR16 at hand-out (gate M1c-02): the quote may have expired, been cancelled or edited while the command waited.
    if (head?.action === 'send_quote' && head.status === 'approved') await this.recheckQuoteAtClaim(_id, head, now);
    // Allowlist re-checked at hand-out: FRIEND_TARGETS may have been narrowed since the item was approved.
    if (head && isFriendAction(head.action) && !friendCommandAllowed(head.friend)) throw new BadRequestException(FRIEND_TARGET_BLOCKED);
    if (head?.action === 'friend_request' && !(await friendGateOpen(this.db, head.uid, now))) {
      throw new ConflictException('Chưa tới nhịp gửi lời mời kết bạn (30 giây giữa hai lời mời, tối đa 20 lời mời mỗi ngày)');
    }
    // canDispatch (PQ-51): the approver must still be allowed to send at the moment of sending.
    const cur = await this.col.findOne({ _id, status: 'approved' }, { projection: { approvedBy: 1, uid: 1, threadId: 1 } });
    if (cur) {
      const r = await this.authz.canDispatch(cur.approvedBy ?? '', cur.uid, cur.threadId);
      if (!r.allowed) {
        await holdItems(this.db, { _id }, r.reason);
        throw new ConflictException('Lệnh cần duyệt lại: người duyệt không còn quyền gửi trên nick này');
      }
    }
    // Send pace of the nick (M1a-06, SZ-04), for every claiming client. API channels are paced by their dispatcher.
    if (head && head.action !== 'friend_request' && !viaApi && !isApiChannel(head.uid)) {
      const { waitMs, pace } = await sendPaceWait(this.db, head.uid, now);
      if (waitMs > 0) throw new ConflictException(sendPaceMessage(pace, waitMs));
      // Gate fix: the check above only reads; the slot makes concurrent claims of one nick exclusive.
      if (!(await takeSendPaceSlot(this.db, head.uid, pace, now))) throw new ConflictException(sendPaceMessage(pace, pace.gapMs));
    }
    const doc = await this.col.findOneAndUpdate(
      {
        _id,
        status: { $in: outboxSources('claim') },
        ...APPROVED_FILTER,
        approvedAt: { $type: 'date', $gte: new Date(now.getTime() - OUTBOX_EXPIRE_MS) },
        ...(viaApi ? {} : { uid: EXTENSION_UIDS }),
      },
      { $set: { status: 'sending', claimedAt: now, claimedBy: actor, statusAt: now }, $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    );
    if (!doc) {
      if (!(await this.col.countDocuments({ _id }, { limit: 1 }))) throw new NotFoundException('Không tìm thấy tin chờ gửi');
      throw new ConflictException('Tin không ở trạng thái chờ gửi (đã được nhận hoặc chưa duyệt)');
    }
    await this.db.audit(actor, 'outbox.claim', id);
    return toOutboxItem(doc);
  }

  /**
   * Records the outcome of a send. Only a claimed ('sending') item can get a
   * result; `allowFromApproved` lets MCP `mark_sent` record a send Claude made
   * without claiming first. Approval fields are re-checked in the same query.
   */
  async result(id: string, body: unknown, actor: string, allowFromApproved = false): Promise<OutboxItem> {
    const r = parseOr400(outboxResultSchema, body);
    const _id = oid(id);
    // A quote is re-checked at claim (BR16): mark_sent straight from approved would skip that check and write quote_sends.
    if (allowFromApproved && (await this.col.countDocuments({ _id, action: 'send_quote', status: { $ne: 'sending' } }, { limit: 1 }))) {
      throw new ConflictException('Báo giá phải được nhận (claim) trước khi báo đã gửi');
    }
    const from: OutboxStatus[] = allowFromApproved ? outboxSources('sent') : ['sending'];
    const set: Partial<SuggestionDoc> = r.ok
      ? { status: 'sent', statusAt: new Date(), sentAt: r.sentAt ? new Date(r.sentAt) : new Date(), ...(r.cliMsgId ? { cliMsgId: r.cliMsgId } : {}), ...(r.cliMsgIds?.length ? { cliMsgIds: r.cliMsgIds } : {}), ...(r.replyCliMsgId ? { replyCliMsgId: r.replyCliMsgId } : {}) }
      : { status: 'failed', statusAt: new Date(), error: (r.error ?? 'lỗi không rõ').slice(0, 300) };
    const doc = await this.col.findOneAndUpdate(
      // mark_sent (allowFromApproved) is for extension channels only; API channels report via the dispatcher.
      { _id, status: { $in: from }, ...APPROVED_FILTER, ...(allowFromApproved ? { uid: EXTENSION_UIDS } : {}) },
      { $set: set, ...(r.ok ? { $unset: { error: '' } } : {}) },
      { returnDocument: 'after' },
    );
    if (!doc) {
      if (!(await this.col.countDocuments({ _id }, { limit: 1 }))) throw new NotFoundException('Không tìm thấy tin chờ gửi');
      throw new ConflictException('Tin không ở trạng thái đang gửi hoặc chưa được duyệt');
    }
    await this.db.audit(actor, r.ok ? 'outbox.sent' : 'outbox.failed', id, {
      uid: doc.uid,
      threadId: doc.threadId,
      ...(doc.cliMsgId ? { cliMsgId: doc.cliMsgId } : {}),
      ...(doc.action ? { action: doc.action } : {}),
    });
    if (!r.ok) void this.realtime?.publish({ type: 'command.failed', id: String(doc._id), uid: doc.uid, threadId: doc.threadId });
    if (r.ok && doc.action) await this.mirrorCommandEffect(doc).catch(() => undefined);
    if (r.ok && (!doc.action || doc.action === 'send_text') && this.ingest) {
      await this.ingest.mirrorSentText(doc.uid, doc.threadId, sentTextByCliMsgId(doc), doc.sentAt ?? new Date()).catch(() => undefined);
    }
    if (r.ok && doc.action === 'send_quote') await recordQuoteSent(this.db, doc).catch(() => undefined);
    if (r.ok && doc.action === 'friend_accept' && doc.friend?.greeting) await this.sendGreeting(doc);
    return toOutboxItem(doc);
  }

  /**
   * The greeting typed in the accept dialog becomes its own approved `send_text`
   * command, by the same approver (CLAUDE.md §12.1): it is checked like any
   * message (nick state, test-phase allowlist) and shows in "Lệnh gửi" with
   * its own status. When it is refused the acceptance still stands.
   */
  private async sendGreeting(doc: SuggestionDoc): Promise<void> {
    const friend = doc.friend!;
    const now = new Date();
    await this.db
      .col(C.conversations)
      .updateOne(
        { _id: `${doc.uid}:${friend.userId}` as never },
        { $setOnInsert: { uid: doc.uid, threadId: friend.userId, type: 'user', name: (friend.alias ?? friend.name ?? '').slice(0, 200), createdAt: now } },
        { upsert: true },
      );
    try {
      await this.create({ uid: doc.uid, threadId: friend.userId!, text: friend.greeting! }, { id: doc.approvedBy ?? SYSTEM_ACTOR, name: doc.approvedByName ?? doc.approvedBy ?? SYSTEM_ACTOR });
    } catch (e) {
      await this.db.audit(SYSTEM_ACTOR, 'outbox.greeting_skipped', doc._id.toHexString(), { uid: doc.uid, reason: e instanceof Error ? e.message.slice(0, 200) : 'lỗi' });
    }
  }

  /** MCP `mark_sent`: success only, from approved or sending. */
  markSent(id: string, sentAt: string | undefined, zaloMsgId: string | undefined, actor: string) {
    return this.result(id, { ok: true, sentAt, cliMsgId: zaloMsgId }, actor, true);
  }

  /**
   * Re-approval by the current principal ("Thử lại"): failed / expired →
   * approved, or a stale 'sending' (claimed > 2 min ago, outcome unknown) →
   * approved once a human has checked Zalo and decided to send again. The new
   * approval restarts the 30-minute deadline.
   */
  async retry(id: string, approver: Approver): Promise<OutboxItem> {
    const actor = approver.id;
    const _id = oid(id);
    const now = new Date();
    const from = outboxSources('retry').filter((st) => st !== 'sending');
    const head = await this.col.findOne({ _id }, { projection: { action: 1, friend: 1, quote: 1 } });
    if (head && isFriendAction(head.action) && !friendCommandAllowed(head.friend)) throw new BadRequestException(FRIEND_TARGET_BLOCKED);
    await this.recheckQuote(head);
    const doc = await this.col.findOneAndUpdate(
      {
        _id,
        finalText: APPROVED_FILTER.finalText,
        $or: [{ status: { $in: from } }, { status: 'sending', claimedAt: { $lt: new Date(now.getTime() - STALE_SENDING_MS) } }],
      },
      {
        $set: { status: 'approved', approvedBy: actor, approvedByName: approver.name, approvedAt: now, statusAt: now },
        $unset: { error: '', claimedAt: '', claimedBy: '' },
      },
      { returnDocument: 'after' },
    );
    if (!doc) {
      const cur = await this.col.findOne({ _id }, { projection: { status: 1 } });
      if (!cur) throw new NotFoundException('Không tìm thấy tin chờ gửi');
      // D40: "Cần duyệt lại" has no "Thử lại"; only the nick holder / cover re-approves it.
      if (cur.status === 'needs_reapproval') throw new ConflictException('Lệnh cần duyệt lại: người giữ nick hoặc người trực nick bấm "Duyệt lại"');
      throw new ConflictException('Chỉ gửi lại được tin lỗi, tin quá hạn hoặc tin kẹt ở trạng thái đang gửi quá 2 phút');
    }
    await this.db.audit(actor, 'outbox.retry', id, { uid: doc.uid, threadId: auditThreadId(doc.action, doc.threadId) });
    this.notify(doc.uid);
    return toOutboxItem(doc);
  }

  /**
   * "Gửi ngay" on an `awaiting_confirm` item (SZ-28 b, e): a re-approval that
   * only the person who pressed Gửi may make. An item past its 30-minute
   * deadline is expired first and cannot be confirmed.
   */
  async confirm(id: string, approver: Approver): Promise<OutboxItem> {
    const actor = approver.id;
    const _id = oid(id);
    const now = new Date();
    await expireStale(this.db, now);
    await this.recheckQuote(await this.col.findOne({ _id }, { projection: { action: 1, quote: 1 } }));
    const doc = await this.col.findOneAndUpdate(
      {
        _id,
        status: { $in: outboxSources('confirm') },
        approvedBy: actor,
        approvedAt: { $type: 'date', $gte: new Date(now.getTime() - OUTBOX_EXPIRE_MS) },
        finalText: APPROVED_FILTER.finalText,
      },
      { $set: { status: 'approved', approvedBy: actor, approvedByName: approver.name, approvedAt: now, statusAt: now } },
      { returnDocument: 'after' },
    );
    if (!doc) {
      const cur = await this.col.findOne({ _id }, { projection: { status: 1, approvedBy: 1 } });
      if (!cur) throw new NotFoundException('Không tìm thấy tin chờ gửi');
      if (cur.status === 'awaiting_confirm' && cur.approvedBy !== actor) {
        throw new ForbiddenException('Chỉ người đã bấm gửi mới được bấm "Gửi ngay"; bạn có thể soạn lệnh mới');
      }
      throw new ConflictException('Lệnh không còn ở trạng thái chờ xác nhận gửi');
    }
    await this.db.audit(actor, 'outbox.confirm', id, { uid: doc.uid, threadId: doc.threadId });
    this.notify(doc.uid);
    return toOutboxItem(doc);
  }

  /**
   * "Duyệt lại" on a `needs_reapproval` item (D40, PQ-51): a new approval by the person pressing it, who
   * the controller checked is the nick holder / "Trực nick" (official channels: canSend). Restarts the
   * 30-minute deadline and records the new approver and time (§12.1).
   */
  async reapprove(id: string, approver: Approver): Promise<OutboxItem> {
    const _id = oid(id);
    const now = new Date();
    await this.recheckQuote(await this.col.findOne({ _id }, { projection: { action: 1, quote: 1 } }));
    const doc = await this.col.findOneAndUpdate(
      { _id, status: { $in: outboxSources('reapprove') }, finalText: APPROVED_FILTER.finalText },
      {
        $set: { status: 'approved', approvedBy: approver.id, approvedByName: approver.name, approvedAt: now, statusAt: now },
        $unset: { holdReason: '', error: '', claimedAt: '', claimedBy: '' },
      },
      { returnDocument: 'after' },
    );
    if (!doc) {
      if (!(await this.col.countDocuments({ _id }, { limit: 1 }))) throw new NotFoundException('Không tìm thấy tin chờ gửi');
      throw new ConflictException('Lệnh không ở trạng thái Cần duyệt lại');
    }
    await this.db.audit(approver.id, 'outbox.reapprove', id, { uid: doc.uid, threadId: doc.threadId });
    this.notify(doc.uid);
    return toOutboxItem(doc);
  }

  /**
   * BR16, BR17: a `send_quote` command that is approved again ("Thử lại", "Gửi ngay", "Duyệt lại") may
   * have waited long enough for its quote to expire, be cancelled or be edited on VCsales: read it live
   * again and refuse (the person gets the reason). Other commands pass.
   */
  private async recheckQuote(head: Pick<SuggestionDoc, 'action' | 'quote'> | null): Promise<void> {
    if (head?.action !== 'send_quote' || !head.quote) return;
    if (!this.quoteGate) throw new ConflictException('Không kiểm tra lại được báo giá trên VCsales, chưa gửi lại.');
    await this.quoteGate.assertSendable(head.quote.no, head.quote.customerCode, head.quote.version);
  }

  /**
   * Claim-time quote check: a quote that may no longer be sent turns the command `failed` with the reason (the
   * person sees it; "Thử lại" checks again), instead of being handed to the extension. VCsales down: stays approved.
   */
  private async recheckQuoteAtClaim(_id: ObjectId, head: Pick<SuggestionDoc, 'action' | 'quote' | 'uid' | 'threadId'>, now: Date): Promise<void> {
    try {
      await this.recheckQuote(head);
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === 503) throw new ConflictException(e.message);
      const error = (e instanceof HttpException ? e.message : 'Không kiểm tra lại được báo giá').slice(0, 300);
      const r = await this.col.updateOne({ _id, status: 'approved' }, { $set: { status: 'failed', statusAt: now, error } });
      if (r.modifiedCount) {
        await this.db.audit(SYSTEM_ACTOR, 'outbox.failed', String(_id), { uid: head.uid, threadId: head.threadId, action: 'send_quote', reason: 'quote_recheck' });
        void this.realtime?.publish({ type: 'command.failed', id: String(_id), uid: head.uid, threadId: head.threadId });
      }
      throw new ConflictException(error);
    }
  }

  /** Status of one item (controller checks that depend on it). */
  async statusOf(id: string): Promise<OutboxStatus | null> {
    const d = await this.col.findOne({ _id: oid(id) }, { projection: { status: 1 } });
    return (d?.status as OutboxStatus) ?? null;
  }

  /**
   * "Bỏ lệnh" / "Hủy gửi" / "Sao chép và bỏ lệnh" (MH-SZ-13 #7, #8a, SZ-28 a).
   * An item being sent cannot be cancelled. "Sao chép và bỏ lệnh" exists only
   * for items still waiting (`approved`).
   */
  async cancel(id: string, body: unknown, actor: string): Promise<OutboxItem> {
    const { reason } = parseOr400(outboxCancelSchema, body ?? {});
    const _id = oid(id);
    const now = new Date();
    const from = reason === 'copied' ? (['approved'] as OutboxStatus[]) : outboxSources('cancel');
    const doc = await this.col.findOneAndUpdate(
      { _id, status: { $in: from } },
      { $set: { status: 'cancelled', statusAt: now, cancelReason: reason, cancelledBy: actor } },
      { returnDocument: 'after' },
    );
    if (!doc) {
      const cur = await this.col.findOne({ _id }, { projection: { status: 1 } });
      if (!cur) throw new NotFoundException('Không tìm thấy tin chờ gửi');
      if (cur.status === 'sending') throw new ConflictException('Lệnh đang được thực hiện trên Zalo, không bỏ được');
      throw new ConflictException('Lệnh không còn bỏ được (đã gửi hoặc đã bỏ)');
    }
    await this.db.audit(actor, 'outbox.cancel', id, { uid: doc.uid, threadId: doc.threadId, reason });
    return toOutboxItem(doc);
  }
}

/** 00:00 today in Asia/Ho_Chi_Minh (UTC+7, no DST). */
export function startOfDayVn(now: Date): Date {
  const VN_OFFSET_MS = 7 * 3600_000;
  const local = new Date(now.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - VN_OFFSET_MS);
}
