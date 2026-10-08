import { AttachmentsService } from '../attachments/attachments.service';
import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  REACTION_EMOJI,
  channelOfUid,
  slaChip,
  uidChannelFilter,
  type Channel,
  type ConversationInboxFields,
  type ConversationOutcome,
  type ConversationListItem,
  type InboxQuery,
  type InboxSummary,
  type MessageView,
  type Paged,
  type QuoteView,
  type ReactionsView,
} from '@vclinks/shared';
import type { Document } from 'mongodb';
import { toIso } from '../common/zod';

/** Self uids Zalo Web writes in `fromUid` for the nick's own messages (shared mapping.ts). */
/** Messages newer than the target in an `around` window. */
const NEWER_AROUND = 30;
const SELF_FROM = new Set(['0', '-1']);
import { AuthzService } from '../authz/authz.service';
import type { Subject } from '../authz/engine';
import { C, DbService } from '../db/db.service';
import { divisionOfAccount, slaConfigFor } from './inbox-state';
import { CUST_C, type CustomerAccountDoc, type IdentityLinkDoc } from '../customers/customers.types';
import { MessageVault } from '../security/message-vault';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const KIND_PREVIEW: Record<string, string> = {
  image: '[Hình ảnh]',
  voice: '[Ghi âm]',
  file: '[Tệp]',
  video: '[Video]',
  card: '[Danh thiếp]',
  sticker: '[Sticker]',
  location: '[Vị trí]',
  call: '[Cuộc gọi]',
  reminder: '[Nhắc hẹn]',
};

/** One-line preview of a conversation's last message; nothing while it is still ciphertext. */
function lastMessageView(m: Document | undefined): { lastMessage?: { text: string | null; fromUid: string | null; senderName: string | null } } {
  if (!m || m.encrypted) return {};
  const text = (m.text as string | undefined)?.split('\n')[0]?.slice(0, 200) || KIND_PREVIEW[m.content?.kind ?? ''] || null;
  if (!text) return {};
  return { lastMessage: { text, fromUid: m.fromUid ?? null, senderName: m.senderName ?? null } };
}

/** Ids of a stored quote reference: Zalo `{cliMsgId, globalMsgId, …}`, webhooks `{msgId}`. */
function quoteIds(q: unknown): { cliMsgId: string | null; msgId: string | null } | null {
  if (!q || typeof q !== 'object') return null;
  const r = q as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && String(v) !== '0' && String(v) ? String(v) : null;
  const ids = { cliMsgId: str(r.cliMsgId), msgId: str(r.msgId) ?? str(r.globalMsgId) };
  return ids.cliMsgId || ids.msgId ? ids : null;
}

const QUOTE_TEXT_MAX = 200;

/** Short plaintext preview of a quoted message (nothing while it is ciphertext). */
function quotePreview(m: Document | undefined): Pick<QuoteView, 'fromUid' | 'senderName' | 'text'> {
  if (!m) return { fromUid: null, senderName: null, text: null };
  const kind = m.content?.kind ?? '';
  // A quoted file shows its name ("[Tệp] bao-gia.pdf"), like Zalo does.
  const fileName = Array.isArray(m.content?.files) && typeof m.content.files[0]?.name === 'string' ? (m.content.files[0].name as string) : null;
  const kindText = KIND_PREVIEW[kind] ? (fileName ? `${KIND_PREVIEW[kind]} ${fileName}` : KIND_PREVIEW[kind]) : null;
  const text = m.encrypted ? null : (m.text as string | undefined)?.slice(0, QUOTE_TEXT_MAX) || kindText?.slice(0, QUOTE_TEXT_MAX) || null;
  return { fromUid: m.fromUid ?? null, senderName: m.encrypted ? null : (m.senderName ?? null), text };
}

/**
 * Stages resolving a conversation's display name and avatar: the DOM name
 * captured from the Zalo sidebar first, then the name / avatar read from the Zalo
 * friend list (plaintext, `domName`), then the contact/group lookup (IndexedDB,
 * ciphertext on accounts with encrypted storage, so skipped then).
 */
function nameStages(): Document[] {
  return [
    // The conversation's own name comes from the Zalo sidebar (DOM) and is plaintext.
    { $addFields: { domName: '$name' } },
    // contacts/groups share the `${uid}:${id}` key scheme with conversations.
    { $lookup: { from: C.contacts, localField: '_id', foreignField: '_id', as: 'c', pipeline: [{ $project: { displayName: 1, zaloName: 1, avatar: 1, encrypted: 1, domName: 1, domAvatar: 1 } }] } },
    { $lookup: { from: C.groups, localField: '_id', foreignField: '_id', as: 'g', pipeline: [{ $project: { name: 1, avatar: 1, encrypted: 1, memberCount: { $size: { $ifNull: ['$memberIds', []] } } } }] } },
    {
      $addFields: {
        lookupName: {
          $ifNull: [
            { $first: '$g.name' },
            { $ifNull: [{ $first: '$c.displayName' }, { $first: '$c.zaloName' }] },
          ],
        },
        avatar: { $ifNull: [{ $first: '$g.avatar' }, { $first: '$c.avatar' }] },
        encrypted: { $ifNull: [{ $first: '$g.encrypted' }, { $first: '$c.encrypted' }, false] },
      },
    },
    // Prefer the DOM name; otherwise the lookup name, unless it is ciphertext
    // (then fall back to threadId in the UI). Avatar is withheld while encrypted.
    {
      $set: {
        name: { $ifNull: ['$domName', { $ifNull: [{ $first: '$c.domName' }, { $cond: ['$encrypted', null, '$lookupName'] }] }] },
        avatar: { $cond: ['$encrypted', { $first: '$c.domAvatar' }, '$avatar'] },
      },
    },
  ];
}

/**
 * Joins the conversation's Zalo label (`labelId` from the store) with the label
 * doc, whose name/colour were read from the sidebar chip (the store keeps the
 * name encrypted). A chip seen on this very conversation is the fallback.
 */
function labelLookup(): Document {
  return {
    $lookup: {
      from: C.labels,
      let: { u: '$uid', l: '$labelId' },
      as: 'lbl',
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$uid', '$$u'] }, { $eq: ['$labelId', '$$l'] }] } } },
        { $project: { labelId: 1, domName: 1, domColor: 1, color: 1 } },
      ],
    },
  };
}

function labelView(d: Document): ConversationListItem['label'] | undefined {
  const doc = d.lbl?.[0];
  const name: string | undefined = doc?.domName ?? d.domLabel?.name;
  if (!name) return undefined;
  return { id: d.labelId != null ? String(d.labelId) : null, name, color: doc?.domColor ?? d.domLabel?.color ?? doc?.color ?? null };
}

/** Zalo `mentions`: `[{ uid, pos, len, type }]`; anything else is ignored. */
function mentionsView(v: unknown): MessageView['mentions'] | undefined {
  if (!Array.isArray(v) || !v.length) return undefined;
  const out: { uid: string; pos: number; len: number }[] = [];
  for (const m of v as Record<string, unknown>[]) {
    if (!m || typeof m !== 'object') continue;
    const pos = Number(m.pos), len = Number(m.len);
    if (!Number.isInteger(pos) || !Number.isInteger(len) || pos < 0 || len <= 0) continue;
    out.push({ uid: String(m.uid ?? ''), pos, len });
  }
  return out.length ? out.slice(0, 100) : undefined;
}

/** Joins the newest message as `last` (uses the (uid, threadId, sentAt) index). */
function lastMessageLookup(): Document {
  return {
    $lookup: {
      from: C.messages,
      let: { u: '$uid', t: '$threadId' },
      as: 'last',
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$uid', '$$u'] }, { $eq: ['$threadId', '$$t'] }] } } },
        { $sort: { sentAt: -1 } },
        { $limit: 1 },
        { $project: { text: 1, fromUid: 1, senderName: 1, encrypted: 1, 'content.kind': 1 } },
      ],
    },
  };
}

/**
 * Port to the customer model (M1b-12): conversations of the customers a user is responsible for
 * ("khách của tôi"). Until it is provided the answer is empty.
 */
export abstract class CustomerOwnership {
  abstract conversationIdsOf(userId: string): Promise<string[]>;
}
export const CUSTOMER_OWNERSHIP = Symbol('CUSTOMER_OWNERSHIP');

type ListItem = ConversationListItem & ConversationInboxFields;

function toListItem(d: Document): ListItem {
  return {
    id: d._id,
    uid: d.uid,
    channel: channelOfUid(d.uid),
    threadId: d.threadId,
    type: d.type ?? 'user',
    name: d.name ?? null,
    avatar: d.avatar ?? null,
    lastMsgAt: toIso(d.lastMsgAt),
    // IndexedDB count first; the sidebar badge read from the DOM otherwise.
    unread: d.unread ?? d.domUnread ?? null,
    messageCount: d.messageCount ?? 0,
    ...(d.pinned ? { pinned: true } : {}),
    ...(labelView(d) ? { label: labelView(d) } : {}),
    ...(d.encrypted ? { encrypted: true } : {}),
    ...(d.type === 'group' && d.g?.[0]?.memberCount ? { memberCount: d.g[0].memberCount } : {}),
    ...lastMessageView(d.last?.[0]),
  };
}

/** Query of `list`: the classic filters plus the inbox ones (shared `inboxQuerySchema`). */
export interface ListOpts extends InboxQuery {
  uid?: string;
  channel?: Channel;
  q?: string;
  unread?: boolean;
  /** Only these conversation ids (`${uid}:${threadId}`): the "Nợ quá hạn" filter (M1c-02). */
  onlyIds?: string[];
  page: number;
  pageSize: number;
}

/** Read-only views for the Dashboard. Never exposes `raw`. */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    @Optional() @Inject(CUSTOMER_OWNERSHIP) private readonly customers?: CustomerOwnership,
    @Optional() private readonly vault?: MessageVault,
    // M1c-04: file / transcript state of the messages on the page.
    @Optional() private readonly attachments?: AttachmentsService,
  ) {}

  async list(opts: ListOpts, subject?: Subject): Promise<Paged<ListItem>> {
    const now = new Date();
    const and: Document[] = [];
    const match: Document = {};
    if (opts.uid) match.uid = opts.uid;
    else if (opts.channel) match.uid = uidChannelFilter(opts.channel);
    if (opts.unread) and.push({ $or: [{ unread: { $gt: 0 } }, { domUnread: { $gt: 0 } }] });
    const own = await this.ownershipFilters(opts, subject);
    if (own) and.push(own);
    if (opts.unanswered || opts.overSla) {
      and.push({ unansweredSince: { $ne: null }, status: { $ne: 'done' } });
      if (opts.overSla) and.push({ slaDueAt: { $lt: now } });
    }
    // Plan B2 tabs: "Chờ khách" (nothing waits for us, not closed) and "Đã xong".
    if (opts.state === 'waiting') and.push({ unansweredSince: null, status: { $ne: 'done' } });
    if (opts.state === 'done') and.push({ status: 'done' });
    if (opts.pinned) and.push({ pinned: true });
    if (opts.onlyIds) and.push({ _id: { $in: opts.onlyIds } });
    if (opts.labelId) and.push({ labelId: opts.labelId });
    if (opts.vcLabelId) and.push({ vcLabels: opts.vcLabelId });
    if (and.length) match.$and = and;
    const waitFirst = opts.sort ? opts.sort === 'wait' : !!(opts.unanswered || opts.overSla);
    // Pinned first like Zalo Web (descending puts true before false/missing); "chờ lâu nhất" first when asked.
    const sort: Document = waitFirst ? { unansweredSince: 1, _id: 1 } : { pinned: -1, lastMsgAt: -1, _id: 1 };
    const pipeline: Document[] = [{ $match: match }, { $sort: sort }, ...nameStages(), labelLookup()];
    if (opts.q) {
      const re = { $regex: escapeRegex(opts.q), $options: 'i' };
      pipeline.push({ $match: { $or: [{ name: re }, { threadId: re }] } });
    }
    pipeline.push({
      $facet: {
        items: [
          { $skip: (opts.page - 1) * opts.pageSize },
          { $limit: opts.pageSize },
          // Last message preview, per page only (uses the (uid, threadId, sentAt) index).
          lastMessageLookup(),
        ],
        total: [{ $count: 'n' }],
      },
    });

    const [res] = await this.db.col(C.conversations).aggregate(pipeline).toArray();
    return {
      total: res.total[0]?.n ?? 0,
      items: await this.withInbox(res.items as Document[], now.getTime()),
    };
  }

  /** The Mongo filter of "Của tôi / Chưa phân công" and of the owner filter; null = no restriction. */
  private async ownershipFilters(opts: Pick<InboxQuery, 'scope' | 'ownerId'>, subject?: Subject): Promise<Document | null> {
    const parts: Document[] = [];
    // Tokens without a user (legacy / dev) have no "mine": they see everything.
    if (opts.scope === 'mine' && subject) parts.push(await this.ownedBy(subject.userId, subject.nicks));
    if (opts.scope === 'unassigned') {
      const { holders, official } = await this.authz.ownership();
      const uids = [...holders].filter(([uid, holder]) => official.has(uid) || !holder).map(([uid]) => uid);
      parts.push({ uid: { $in: uids }, assigneeId: null });
    }
    if (opts.ownerId) {
      const { holders } = await this.authz.ownership();
      const nicks = new Set([...holders].filter(([, holder]) => holder === opts.ownerId).map(([uid]) => uid));
      parts.push(await this.ownedBy(opts.ownerId, nicks));
    }
    return parts.length ? (parts.length === 1 ? parts[0] : { $and: parts }) : null;
  }

  /** Conversations of the nicks a user holds, assigned to him, or of customers he is responsible for. */
  private async ownedBy(userId: string, nicks: ReadonlySet<string>): Promise<Document> {
    const owned = (await this.customers?.conversationIdsOf(userId)) ?? [];
    const or: Document[] = [{ uid: { $in: [...nicks] } }, { assigneeId: userId }];
    if (owned.length) or.push({ _id: { $in: owned } });
    return { $or: or };
  }

  /** Owner, wait and SLA chip of a page of conversations (chip computed now, redrawn by the web every 30 s). */
  private async withInbox(docs: Document[], nowMs: number): Promise<ListItem[]> {
    const { holders, official } = await this.authz.ownership();
    const labelIds = [...new Set(docs.flatMap((d) => (Array.isArray(d.vcLabels) ? (d.vcLabels as string[]) : [])))];
    const catalog = new Map<string, { _id: string; name: string; color: string }>();
    if (labelIds.length) {
      for (const l of await this.db.col<{ _id: string; name: string; color: string }>('conversation_labels').find({ _id: { $in: labelIds } }).toArray()) catalog.set(l._id, l);
    }
    const ownerOf = (d: Document): string | null => (typeof d.assigneeId === 'string' && d.assigneeId ? d.assigneeId : (holders.get(d.uid) ?? null));
    const closer = (d: Document): string | null => (d.status === 'done' && typeof d.doneBy === 'string' ? d.doneBy : null);
    const ids = [...new Set([...docs.map(ownerOf), ...docs.map(closer)].filter((x): x is string => !!x))];
    const names = new Map<string, string>();
    if (ids.length) {
      for (const u of await this.db.col<{ _id: string; fullName?: string }>(C.users).find({ _id: { $in: ids } }, { projection: { fullName: 1 } }).toArray()) {
        names.set(u._id, u.fullName ?? u._id);
      }
    }
    const customerOf = await this.customersOf(docs.filter((d) => d.type !== 'group').map((d) => String(d._id)));
    const senders = await this.friendNames(docs.flatMap((d) => (d.last?.[0]?.fromUid && !d.last[0].senderName ? [`${d.uid}:${d.last[0].fromUid}`] : [])));
    const cfgs = new Map<string, Awaited<ReturnType<typeof slaConfigFor>>>();
    const out: ListItem[] = [];
    for (const d of docs) {
      const item: ListItem = toListItem(d);
      const owner = ownerOf(d);
      item.ownerId = owner;
      item.ownerName = owner ? (names.get(owner) ?? null) : null;
      const waiting = d.unansweredSince instanceof Date && d.status !== 'done';
      item.unansweredSince = waiting ? d.unansweredSince.toISOString() : null;
      item.slaDueAt = waiting && d.slaDueAt instanceof Date ? d.slaDueAt.toISOString() : null;
      if (waiting && d.slaDueAt instanceof Date) {
        let cfg = cfgs.get(d.uid);
        if (!cfg) cfgs.set(d.uid, (cfg = await slaConfigFor(this.db, await divisionOfAccount(this.db, d.uid))));
        item.sla = slaChip({ dueAtMs: d.slaDueAt.getTime(), config: cfg, nowMs });
      } else item.sla = null;
      item.customerId = customerOf.get(String(d._id)) ?? null;
      item.assigneeId = typeof d.assigneeId === 'string' && d.assigneeId ? d.assigneeId : null;
      item.assignable = official.has(d.uid) || !holders.get(d.uid);
      item.vcLabels = (Array.isArray(d.vcLabels) ? (d.vcLabels as string[]) : [])
        .map((x) => catalog.get(x))
        .filter((l): l is { _id: string; name: string; color: string } => !!l)
        .map((l) => ({ id: l._id, name: l.name, color: l.color as never }));
      if (item.lastMessage && !item.lastMessage.senderName && d.last?.[0]?.fromUid) item.lastMessage.senderName = senders.get(`${d.uid}:${d.last[0].fromUid}`) ?? null;
      const by = closer(d);
      item.done =
        d.status === 'done' && d.doneAt instanceof Date
          ? { at: d.doneAt.toISOString(), byName: by ? (names.get(by) ?? null) : null, outcome: (d.outcome as ConversationOutcome | null) ?? null }
          : null;
      out.push(item);
    }
    return out;
  }

  /**
   * Plaintext names read from the Zalo friend list (`domName`), keyed `${uid}:${userId}`: the fallback for a message
   * sender or a conversation that has no DOM name of its own (IndexedDB names are ciphertext on encrypted accounts).
   */
  private async friendNames(keys: Iterable<string>): Promise<Map<string, string>> {
    const ids = [...new Set(keys)];
    if (!ids.length) return new Map();
    const rows = await this.db.col<{ _id: string; domName?: string }>(C.contacts).find({ _id: { $in: ids } as never, domName: { $type: 'string' } } as never, { projection: { domName: 1 } }).toArray();
    return new Map(rows.map((r) => [String(r._id), r.domName as string]));
  }

  /**
   * Customer profile of each 1-1 conversation of a page (identity id = conversation id), following a merged
   * profile to the one it went into. Only the id leaves: names and contact points stay behind cust.view.
   */
  private async customersOf(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const links = await this.db.col<IdentityLinkDoc>(CUST_C.identityLinks).find({ _id: { $in: ids } }, { projection: { accountId: 1 } }).toArray();
    if (!links.length) return new Map();
    const accountIds = [...new Set(links.map((l) => l.accountId))];
    const merged = await this.db
      .col<CustomerAccountDoc>(CUST_C.accounts)
      .find({ _id: { $in: accountIds }, mergedInto: { $ne: null } }, { projection: { mergedInto: 1 } })
      .toArray();
    const into = new Map(merged.map((a) => [a._id, a.mergedInto as string]));
    return new Map(links.map((l) => [l._id, into.get(l.accountId) ?? l.accountId]));
  }

  /**
   * Scopes and counters of the inbox (MH-SZ-01 #4, #4b, #4c): everything the caller may see is already
   * limited by his data scope; counters only split it by owner and by waiting state.
   */
  async summary(subject?: Subject): Promise<InboxSummary> {
    const now = new Date();
    const col = this.db.col(C.conversations);
    const waiting: Document = { unansweredSince: { $ne: null }, status: { $ne: 'done' } };
    const mine = subject ? await this.ownedBy(subject.userId, subject.nicks) : {};
    const unassignedFilter = (await this.ownershipFilters({ scope: 'unassigned' })) ?? {};
    const [all, mineN, unassigned, unanswered, overSla, groups, ownership] = await Promise.all([
      col.countDocuments({}),
      col.countDocuments(mine),
      col.countDocuments(unassignedFilter),
      col.countDocuments(waiting),
      col.countDocuments({ ...waiting, slaDueAt: { $lt: now } }),
      col.aggregate<{ _id: { uid: string; assigneeId: string | null }; n: number }>([{ $match: waiting }, { $group: { _id: { uid: '$uid', assigneeId: '$assigneeId' }, n: { $sum: 1 } } }]).toArray(),
      this.authz.ownership(),
    ]);
    const byOwner = new Map<string | null, number>();
    for (const g of groups) {
      const owner = g._id.assigneeId || ownership.holders.get(g._id.uid) || null;
      byOwner.set(owner, (byOwner.get(owner) ?? 0) + g.n);
    }
    const ids = [...byOwner.keys()].filter((x): x is string => !!x);
    const names = new Map((ids.length ? await this.db.col<{ _id: string; fullName?: string }>(C.users).find({ _id: { $in: ids } }, { projection: { fullName: 1 } }).toArray() : []).map((u) => [u._id, u.fullName ?? u._id]));
    const scopes = subject ? this.authz.inboxScopes(subject) : (['mine', 'unassigned', 'all'] as const);
    return {
      scopes: [...scopes],
      counts: { mine: mineN, unassigned, all },
      unanswered,
      overSla,
      byOwner: [...byOwner]
        .map(([userId, count]) => ({ userId, name: userId ? (names.get(userId) ?? null) : null, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * "Xong" / "Mở lại" (plan B2): the work state of a conversation, logged. Closing takes it out of "Cần trả lời"
   * at once; a later customer message reopens it (refreshInboxState).
   */
  async setDone(id: string, done: boolean, outcome: ConversationOutcome | undefined, subject?: Subject): Promise<{ ok: true }> {
    const col = this.db.col(C.conversations);
    const update: Document = done
      ? { $set: { status: 'done', doneAt: new Date(), doneBy: subject?.userId ?? null, outcome: outcome ?? null } }
      : { $set: { status: 'open' }, $unset: { doneAt: '', doneBy: '', outcome: '' } };
    const r = await col.updateOne({ _id: id } as never, update);
    if (!r.matchedCount) throw new NotFoundException('Không tìm thấy hội thoại');
    await this.db.audit(subject ? `user:${subject.userId}` : 'token', done ? 'conversation.done' : 'conversation.reopen', id, done ? { outcome: outcome ?? null } : undefined);
    return { ok: true };
  }

  /** One conversation (header of a chat opened by direct link), or 404. */
  async get(id: string): Promise<ListItem> {
    const [d] = await this.db
      .col(C.conversations)
      .aggregate([{ $match: { _id: id } }, ...nameStages(), labelLookup(), lastMessageLookup()])
      .toArray();
    if (!d) throw new NotFoundException('Không tìm thấy hội thoại');
    return (await this.withInbox([d], Date.now()))[0]!;
  }

  /**
   * Shared content of a thread for the info panel (MH-SZ-07 tabs Media / File / Link): messages whose DOM-captured
   * content holds photos or video, files, or links. Newest first, paged by `before`. Same visibility as `messages`
   * (route key `conv.view` on the conversation); ciphertext-only records carry no content and are skipped.
   */
  async sharedContent(id: string, kind: 'media' | 'file' | 'link', before: Date | undefined, limit: number) {
    const sep = id.indexOf(':');
    if (sep <= 0) throw new NotFoundException('Mã hội thoại không hợp lệ');
    const has = (f: string) => ({ [f]: { $exists: true } });
    const byKind: Record<typeof kind, Document[]> = {
      media: [has('content.images.0'), has('content.mediaImages.0'), has('content.video')],
      file: [has('content.files.0')],
      link: [has('content.links.0'), has('content.card.url')],
    };
    const filter: Document = { uid: id.slice(0, sep), threadId: id.slice(sep + 1), encrypted: { $ne: true }, $or: byKind[kind] };
    if (before) filter.sentAt = { $lt: before };
    const docs = await this.db
      .col(C.messages)
      .find(filter, { projection: { raw: 0 } })
      .sort({ sentAt: -1 })
      .limit(limit + 1)
      .toArray();
    await this.vault?.open(docs);
    const page = docs.slice(0, limit);
    const items = page.map((d) => {
      const c = (d.content && typeof d.content === 'object' ? d.content : {}) as Record<string, unknown>;
      const pick = (...keys: string[]) => Object.fromEntries(keys.filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));
      return {
        id: d._id as unknown as string,
        msgId: d.msgId,
        fromUid: d.fromUid,
        senderName: d.senderName ?? null,
        sentAt: (d.sentAt as Date).toISOString(),
        ...(kind === 'media' ? pick('images', 'mediaImages', 'video') : kind === 'file' ? pick('files') : pick('links', 'card')),
      };
    });
    return { items, hasMore: docs.length > limit };
  }

  /** `around` (M1c-05, `?msg=`): a window with that message in it: up to 30 newer ones, the message, then `limit` older. */
  async messages(id: string, before: Date | undefined, limit: number, around?: string) {
    const sep = id.indexOf(':');
    if (sep <= 0) throw new NotFoundException('Mã hội thoại không hợp lệ');
    const uid = id.slice(0, sep);
    const threadId = id.slice(sep + 1);

    const filter: Document = { uid, threadId };
    if (before) filter.sentAt = { $lt: before };
    const col = this.db.col(C.messages);
    const target = around ? await col.findOne({ uid, threadId, msgId: around }, { projection: { sentAt: 1 } }) : null;
    let docs: Document[];
    let hasMore: boolean;
    let hasNewer = false;
    if (target) {
      const at = target.sentAt as Date;
      const newer = await col.find({ uid, threadId, sentAt: { $gt: at } }, { projection: { raw: 0 } }).sort({ sentAt: 1 }).limit(NEWER_AROUND + 1).toArray();
      hasNewer = newer.length > NEWER_AROUND;
      const older = await col.find({ uid, threadId, sentAt: { $lte: at } }, { projection: { raw: 0 } }).sort({ sentAt: -1 }).limit(limit + 1).toArray();
      hasMore = older.length > limit;
      docs = [...newer.slice(0, NEWER_AROUND).reverse(), ...older.slice(0, limit)];
    } else {
      const found = await col.find(filter, { projection: { raw: 0 } }).sort({ sentAt: -1 }).limit(limit + 1).toArray();
      hasMore = found.length > limit;
      docs = found.slice(0, limit);
    }
    // M1b-14: restores sealed (per-customer encrypted) content; erased customers show "[Đã ẩn danh]".
    await this.vault?.open(docs);

    const page = docs;
    const quotes = await this.quotes(uid, threadId, page);
    const friends = await this.friendNames(page.filter((d) => d.fromUid && d.fromUid !== '0' && d.fromUid !== uid).map((d) => `${uid}:${d.fromUid}`));
    const reactions = await this.reactions(uid, threadId, page);
    const viaVclinks = await this.sentViaVclinks(uid, page);
    const files = (await this.attachments?.viewsFor(page.map((d) => d._id as unknown as string))) ?? new Map();
    const items: MessageView[] = page
      .reverse()
      .map((d) => ({
        id: d._id as unknown as string,
        msgId: d.msgId,
        cliMsgId: d.cliMsgId ?? null,
        threadId: d.threadId,
        fromUid: d.fromUid,
        // Encrypted records carry metadata only; text/content is filled later
        // from the DOM. The `d.encrypted ? null` guards are defence in depth.
        senderName: (d.encrypted ? null : d.senderName) ?? friends.get(`${uid}:${d.fromUid}`) ?? null,
        msgType: d.msgType ?? null,
        text: d.encrypted ? null : (d.text ?? null),
        content: d.encrypted ? undefined : d.content,
        // Media captured from the DOM (not ciphertext) is exposed flat for the chat UI.
        ...(!d.encrypted && d.content && typeof d.content === 'object' ? d.content : {}),
        sentAt: (d.sentAt as Date).toISOString(),
        ...(d.encrypted ? { encrypted: true } : {}),
        ...(d.contentStatus ? { contentStatus: d.contentStatus } : {}),
        ...(d.contentGone === true ? { contentGone: true } : {}),
        ...(d.recalled ? { recalled: true } : {}),
        // One photo of an album shown on the album's first message (MediaService).
        ...(d.albumOf ? { albumOf: d.albumOf as string } : {}),
        ...(quotes.has(d._id as unknown as string) ? { quote: quotes.get(d._id as unknown as string) } : {}),
        ...(typeof d.status === 'number' ? { status: d.status } : {}),
        ...(typeof d.ttl === 'number' && d.ttl > 0 ? { ttl: d.ttl } : {}),
        ...(d.forwarded ? { forwarded: true } : {}),
        ...(files.has(d._id as unknown as string) && !d.erased ? { attachments: files.get(d._id as unknown as string) } : {}),
        ...(d.systemEvent?.act ? { systemEvent: d.systemEvent } : {}),
        ...(mentionsView(d.mentions) ? { mentions: mentionsView(d.mentions) } : {}),
        ...(reactions.has(d.msgId) ? { reactions: reactions.get(d.msgId) } : {}),
        // 00 §3.3a: the nick's own message with no matching outbox item was sent outside VClinks ("Gửi từ điện thoại").
        ...((SELF_FROM.has(String(d.fromUid)) || d.fromUid === uid) && !viaVclinks.has(String(d.cliMsgId ?? '')) ? { fromPhone: true } : {}),
      }));
    return { items, hasMore, ...(hasNewer ? { hasNewer: true } : {}) };
  }

  /** cliMsgIds of the page's own messages that VClinks sent (outbox `cliMsgId` / `replyCliMsgId`). */
  private async sentViaVclinks(uid: string, docs: Document[]): Promise<Set<string>> {
    const ids = docs
      .filter((d) => (SELF_FROM.has(String(d.fromUid)) || d.fromUid === uid) && typeof d.cliMsgId === 'string' && d.cliMsgId)
      .map((d) => d.cliMsgId as string);
    const out = new Set<string>();
    if (!ids.length) return out;
    const rows = await this.db
      .col(C.suggestions)
      .find({ uid, $or: [{ cliMsgId: { $in: ids } }, { replyCliMsgId: { $in: ids } }] }, { projection: { cliMsgId: 1, replyCliMsgId: 1 } })
      .toArray();
    for (const r of rows) {
      if (r.cliMsgId) out.add(String(r.cliMsgId));
      if (r.replyCliMsgId) out.add(String(r.replyCliMsgId));
    }
    return out;
  }

  /** Reaction summaries of the page's messages (stored by the `reactions` stream, keyed by msgId). */
  private async reactions(uid: string, threadId: string, docs: Document[]): Promise<Map<string, ReactionsView>> {
    const out = new Map<string, ReactionsView>();
    const ids = docs.map((d) => d.msgId).filter((x): x is string => typeof x === 'string' && !!x);
    if (!ids.length) return out;
    const rows = await this.db
      .col(C.reactions)
      .find({ uid, threadId, msgId: { $in: ids } }, { projection: { msgId: 1, totals: 1, byUser: 1, total: 1 } })
      .toArray();
    for (const r of rows) {
      const totals = (r.totals ?? {}) as Record<string, number>;
      const icons = Object.entries(totals)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([icon, count]) => ({ icon, emoji: REACTION_EMOJI[icon] ?? '👍', count }));
      if (!icons.length) continue;
      out.set(r.msgId, { total: r.total ?? icons.reduce((s, i) => s + i.count, 0), icons, mine: (r.byUser as Record<string, string> | undefined)?.['0'] ?? null });
    }
    return out;
  }

  /**
   * Quote block per message id: the stored quote reference (plaintext records)
   * or, for messages VClinks sent with "Trả lời", the outbox item's target. The
   * quoted message is looked up in the same thread for its sender and text.
   */
  private async quotes(uid: string, threadId: string, docs: Document[]): Promise<Map<string, QuoteView>> {
    const refs = new Map<string, { cliMsgId: string | null; msgId: string | null }>();
    for (const d of docs) {
      const ids = d.encrypted ? null : quoteIds(d.quoteRef);
      if (ids) refs.set(d._id, ids);
    }
    const cliIds = docs.map((d) => d.cliMsgId).filter((x): x is string => typeof x === 'string' && !!x);
    if (cliIds.length) {
      const sent = await this.db
        .col(C.suggestions)
        .find({ uid, threadId, replyCliMsgId: { $in: cliIds }, replyToCliMsgId: { $type: 'string' } }, { projection: { replyCliMsgId: 1, replyToCliMsgId: 1 } })
        .toArray();
      const byCli = new Map(sent.map((s) => [s.replyCliMsgId as string, s.replyToCliMsgId as string]));
      for (const d of docs) {
        const target = byCli.get(d.cliMsgId);
        if (target && !refs.has(d._id)) refs.set(d._id, { cliMsgId: target, msgId: null });
      }
    }
    // Quote block read from the Zalo DOM (sender + text as shown; no id).
    const domQuote = (d: Document): QuoteView | null => {
      const q = d.encrypted ? null : d.content?.quote;
      if (!q || (!q.senderName && !q.text)) return null;
      return { cliMsgId: null, msgId: null, fromUid: null, senderName: q.senderName ?? null, text: q.text ? String(q.text).slice(0, QUOTE_TEXT_MAX) : null };
    };
    const dom = new Map(docs.flatMap((d) => (domQuote(d) ? [[d._id as string, domQuote(d)!] as const] : [])));
    if (!refs.size) return dom;

    const wantCli = [...refs.values()].map((r) => r.cliMsgId).filter((x): x is string => !!x);
    const wantMsg = [...refs.values()].map((r) => r.msgId).filter((x): x is string => !!x);
    const targets = await this.db
      .col(C.messages)
      .find(
        { uid, threadId, $or: [{ cliMsgId: { $in: wantCli } }, { msgId: { $in: wantMsg } }] },
        { projection: { cliMsgId: 1, msgId: 1, fromUid: 1, senderName: 1, text: 1, encrypted: 1, 'content.kind': 1, 'content.files.name': 1 } },
      )
      .toArray();
    const byCli = new Map(targets.filter((t) => t.cliMsgId).map((t) => [String(t.cliMsgId), t]));
    const byMsg = new Map(targets.filter((t) => t.msgId).map((t) => [String(t.msgId), t]));

    const out = new Map<string, QuoteView>(dom);
    for (const [id, ref] of refs) {
      const t = (ref.cliMsgId && byCli.get(ref.cliMsgId)) || (ref.msgId && byMsg.get(ref.msgId)) || undefined;
      const p = quotePreview(t);
      const shown = dom.get(id);
      out.set(id, {
        cliMsgId: ref.cliMsgId ?? (t?.cliMsgId ? String(t.cliMsgId) : null),
        msgId: ref.msgId ?? (t?.msgId ? String(t.msgId) : null),
        fromUid: p.fromUid,
        senderName: p.senderName ?? shown?.senderName ?? null,
        text: p.text ?? shown?.text ?? null,
      });
    }
    return out;
  }
}
