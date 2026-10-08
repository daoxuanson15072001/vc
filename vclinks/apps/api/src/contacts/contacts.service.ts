import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CONTACT_ROLES,
  channelOfUid,
  contactDomItemSchema,
  foldVi,
  type ContactDomBatch,
  type ContactDomItem,
  type ContactDomResult,
  type ContactGroupItem,
  type ContactGroupsQuery,
  type ContactGroupsResponse,
  type ContactListItem,
  type ContactListQuery,
  type ContactListResponse,
  type ContactListStats,
  type ContactProfile,
  type ContactRole,
} from '@vclinks/shared';
import type { AnyBulkWriteOperation, Document } from 'mongodb';
import { AccountsService } from '../accounts/accounts.service';
import { toIso } from '../common/zod';
import { C, DbService } from '../db/db.service';

/** Friend-list snapshot per account (`_id` = uid): "Bạn bè (N)" and the last walk. */
export const CONTACT_LISTS = 'contact_lists';

/**
 * A complete walk that saw fewer rows than this share of "Bạn bè (N)" does not
 * mark the unseen contacts as removed (a half-rendered list must not unfriend anyone).
 */
const REMOVAL_MIN_SHARE = 0.9;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Groups listed in a profile. */
const COMMON_GROUPS_MAX = 20;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Contact profile for the Dashboard's sender modal. Personal Zalo contacts are
 * often Zalo ciphertext at rest (names/phone withheld, CLAUDE.md §3), so the
 * name falls back to the plaintext sender name captured from the DOM, then to
 * the 1-1 conversation's sidebar name.
 */
@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly db: DbService,
    private readonly accounts: AccountsService,
  ) {}

  private indexed?: Promise<unknown>;
  /** Indexes of the friend-list queries, created on first use (DbService connects in its own init). */
  private ensureIndexes() {
    this.indexed ??= this.db.db
      .collection(C.contacts)
      .createIndexes([{ key: { uid: 1, inFriendList: 1, domNameFold: 1 } }, { key: { uid: 1, domName: 1 } }])
      .catch((e: unknown) => {
        this.indexed = undefined;
        this.logger.warn(`contact indexes: ${e instanceof Error ? e.message : String(e)}`);
      });
    return this.indexed;
  }

  /**
   * Friend-list rows read from Zalo Web (ContactReader). A row with an id is
   * stored on `uid:userId`; a row without one is tied by name to the single 1-1
   * conversation (or contact) of the account with that name, else counted
   * "chưa ghép". DOM fields live beside the IndexedDB ones (`domName`…), so the
   * metadata-only IndexedDB sync never clears them. Idempotent: re-sending the
   * same rows changes nothing but `friendSeenAt`.
   */
  async ingestDom(uid: string, batch: ContactDomBatch): Promise<ContactDomResult> {
    await this.accounts.assertExists(uid);
    await this.ensureIndexes();
    const result: ContactDomResult = { matched: 0, matchedByName: 0, unmatched: 0, rejected: 0 };
    const now = new Date();
    const rows: { userId: string; item: ContactDomItem }[] = [];
    for (const raw of batch.items) {
      const parsed = contactDomItemSchema.safeParse(raw);
      if (!parsed.success) {
        result.rejected++;
        continue;
      }
      const item = parsed.data;
      const userId = item.userId ?? (await this.userIdByName(uid, item.name));
      if (!userId) {
        result.unmatched++;
        continue;
      }
      if (!item.userId) result.matchedByName++;
      rows.push({ userId, item });
    }
    if (rows.length) {
      const ops: AnyBulkWriteOperation<Document>[] = rows.map(({ userId, item }) => ({
        updateOne: {
          filter: { _id: `${uid}:${userId}` as never },
          update: {
            $set: {
              uid,
              userId,
              domName: item.name,
              domNameFold: foldVi(item.name),
              domLabels: item.labels ?? [],
              ...(item.avatar ? { domAvatar: item.avatar } : {}),
              ...(item.business !== undefined ? { domBusiness: item.business } : {}),
              inFriendList: true,
              friendWalkId: batch.walkId,
              friendSeenAt: now,
            },
            $setOnInsert: { ingestedAt: now, tags: [] },
          },
          upsert: true,
        },
      }));
      await this.db.col(C.contacts).bulkWrite(ops as never, { ordered: false });
      result.matched = rows.length;
    }

    const lists = this.db.col(CONTACT_LISTS);
    const set: Document = { uid, updatedAt: now };
    if (batch.friendCount !== undefined) set.friendCount = batch.friendCount;
    // Counters of one walk add up over its batches; a new walk starts from zero.
    const prev = await lists.findOne({ _id: uid as never }, { projection: { walkId: 1, walkSeen: 1, walkUnmatched: 1 } });
    const same = prev?.walkId === batch.walkId;
    const seen = (same ? Number(prev?.walkSeen ?? 0) : 0) + result.matched;
    const unmatched = (same ? Number(prev?.walkUnmatched ?? 0) : 0) + result.unmatched;
    Object.assign(set, { walkId: batch.walkId, walkSeen: seen, walkUnmatched: unmatched });
    if (batch.last && batch.complete) {
      set.readAt = now;
      set.unmatched = unmatched;
      const count = batch.friendCount ?? Number((await lists.findOne({ _id: uid as never }))?.friendCount ?? 0);
      if (count > 0 && seen >= count * REMOVAL_MIN_SHARE) {
        // Friends not seen in this complete walk are no longer in the list (unfriended).
        const r = await this.db
          .col(C.contacts)
          .updateMany({ uid, inFriendList: true, friendWalkId: { $ne: batch.walkId } }, { $set: { inFriendList: false } });
        if (r.modifiedCount) this.logger.log(`[${uid}/contacts-dom] ${r.modifiedCount} contact(s) left the friend list`);
      }
    }
    await lists.updateOne({ _id: uid as never }, { $set: set }, { upsert: true });
    if (result.rejected || result.unmatched) {
      this.logger.warn(`[${uid}/contacts-dom] rejected ${result.rejected}, unmatched ${result.unmatched}`);
    }
    return result;
  }

  /** The single 1-1 conversation / contact of `uid` with exactly this name, if any. */
  private async userIdByName(uid: string, name: string): Promise<string | null> {
    const [convs, contacts] = await Promise.all([
      this.db.col(C.conversations).distinct('threadId', { uid, type: 'user', name }),
      this.db.col(C.contacts).distinct('userId', { uid, domName: name }),
    ]);
    const ids = new Set([...convs, ...contacts].map(String));
    return ids.size === 1 ? [...ids][0] : null;
  }

  /** Friend list of one account for the Danh bạ page (03 MH-SZ-09). */
  async list(query: ContactListQuery): Promise<ContactListResponse> {
    const { uid, q, sort, page, pageSize, role } = query;
    await this.ensureIndexes();
    const filter: Document = { uid, inFriendList: true };
    // Vai trò filter (MH-SZ-09 #4): `none` = not classified yet (role missing / null / not a known role).
    if (role === 'none') filter.role = { $nin: [...CONTACT_ROLES] };
    else if (role) filter.role = role;
    if (q) {
      const digits = q.replace(/\D/g, '');
      const or: Document[] = [{ domNameFold: { $regex: escapeRe(foldVi(q)) } }];
      if (digits.length >= 3 && digits.length === q.replace(/[\s.+-]/g, '').length) {
        or.push({ phone: { $regex: escapeRe(digits) } });
      }
      filter.$or = or;
    }
    const docs = await this.db
      .col(C.contacts)
      .find(filter, {
        projection: { userId: 1, domName: 1, domNameFold: 1, domAvatar: 1, domLabels: 1, domBusiness: 1, phone: 1, isOA: 1, encrypted: 1, role: 1 },
      })
      .toArray();
    const convs = await this.db
      .col(C.conversations)
      .find({ _id: { $in: docs.map((d) => d._id) } }, { projection: { lastMsgAt: 1 } })
      .toArray();
    const lastAt = new Map<unknown, Date | undefined>(convs.map((c) => [c._id, c.lastMsgAt as Date | undefined]));
    const time = (d: Document) => lastAt.get(d._id)?.getTime() ?? 0;
    const byName = (a: Document, b: Document) => String(a.domNameFold ?? '').localeCompare(String(b.domNameFold ?? ''), 'vi');
    docs.sort(sort === 'recent' ? (a, b) => time(b) - time(a) || byName(a, b) : byName);
    const items: ContactListItem[] = docs.slice((page - 1) * pageSize, page * pageSize).map((d) => ({
      userId: String(d.userId),
      name: str(d.domName),
      avatar: str(d.domAvatar),
      phone: d.encrypted ? null : str(d.phone),
      labels: Array.isArray(d.domLabels) ? d.domLabels.filter((l: unknown): l is string => typeof l === 'string') : [],
      isOA: d.isOA === true || d.domBusiness === true,
      role: (CONTACT_ROLES as readonly string[]).includes(d.role) ? (d.role as ContactRole) : null,
      conversationId: lastAt.has(d._id) ? String(d._id) : null,
      lastMsgAt: toIso(lastAt.get(d._id)),
    }));
    return { items, total: docs.length, stats: await this.stats(uid) };
  }

  /**
   * Groups and communities of one account for the Danh bạ tab "Nhóm": the
   * group conversations VClinks holds, with the member count of the IndexedDB
   * `group` store when it was synced. Names come from the sidebar (DOM).
   */
  async groups(query: ContactGroupsQuery): Promise<ContactGroupsResponse> {
    const { uid, q, page, pageSize } = query;
    const filter: Document = { uid, type: 'group' };
    if (q) filter.name = { $regex: escapeRe(q), $options: 'i' };
    const [docs, total] = await Promise.all([
      this.db
        .col(C.conversations)
        .find(filter, { projection: { threadId: 1, name: 1, lastMsgAt: 1 } })
        .sort({ lastMsgAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      this.db.col(C.conversations).countDocuments(filter),
    ]);
    const groups = await this.db
      .col(C.groups)
      .find({ _id: { $in: docs.map((d) => d._id) } }, { projection: { memberIds: 1 } })
      .toArray();
    const members = new Map<unknown, number>(groups.map((g) => [g._id, Array.isArray(g.memberIds) ? g.memberIds.length : 0]));
    const items: ContactGroupItem[] = docs.map((d) => ({
      threadId: String(d.threadId),
      name: str(d.name),
      memberCount: members.get(d._id) || null,
      conversationId: String(d._id),
      lastMsgAt: toIso(d.lastMsgAt as Date | undefined),
    }));
    return { items, total };
  }

  /** "Bạn bè (N)" read from Zalo Web against what VClinks stores. */
  async stats(uid: string): Promise<ContactListStats> {
    const [snap, stored] = await Promise.all([
      this.db.col(CONTACT_LISTS).findOne({ _id: uid as never }),
      this.db.col(C.contacts).countDocuments({ uid, inFriendList: true }),
    ]);
    return {
      friendCount: typeof snap?.friendCount === 'number' ? snap.friendCount : null,
      stored,
      unmatched: typeof snap?.unmatched === 'number' ? snap.unmatched : 0,
      readAt: toIso(snap?.readAt),
    };
  }

  async profile(uid: string, userId: string, threadId?: string): Promise<ContactProfile> {
    const key = `${uid}:${userId}`;
    const edge = (dir: 1 | -1) =>
      this.db.col(C.messages).findOne({ uid, fromUid: userId }, { projection: { sentAt: 1 }, sort: { sentAt: dir } });
    const [contact, direct, lastMsg, groups, messages, inThread, first, last] = await Promise.all([
      this.db.col(C.contacts).findOne({ _id: key as never }, { projection: { raw: 0 } }),
      this.db.col(C.conversations).findOne({ _id: key as never }, { projection: { name: 1, domAvatar: 1 } }),
      // Newest plaintext sender name (DOM capture) of this contact.
      this.db
        .col(C.messages)
        .findOne(
          { uid, fromUid: userId, senderName: { $type: 'string', $ne: '' }, encrypted: { $ne: true } },
          { projection: { senderName: 1 }, sort: { sentAt: -1 } },
        ),
      this.commonGroups(uid, userId),
      this.db.col(C.messages).countDocuments({ uid, fromUid: userId }),
      threadId ? this.db.col(C.messages).countDocuments({ uid, threadId, fromUid: userId }) : Promise.resolve(null),
      edge(1),
      edge(-1),
    ]);
    if (!contact && !direct && !messages && !groups.length) throw new NotFoundException('Không tìm thấy liên hệ');

    const enc = !!contact?.encrypted;
    const plain = (f: string) => (enc ? null : str(contact?.[f]));
    return {
      uid,
      userId,
      channel: channelOfUid(uid),
      displayName: str(contact?.domName) ?? plain('displayName') ?? plain('zaloName') ?? str(lastMsg?.senderName) ?? str(direct?.name),
      zaloName: plain('zaloName'),
      username: str(contact?.username),
      phone: plain('phone'),
      avatar: plain('avatar') ?? str(contact?.domAvatar) ?? str(direct?.domAvatar),
      isFriend: typeof contact?.isFriend === 'boolean' ? contact.isFriend : null,
      isOA: typeof contact?.isOA === 'boolean' ? contact.isOA : null,
      encrypted: enc,
      known: !!contact,
      lastActionTime: toIso(contact?.lastActionTime),
      role: str(contact?.role),
      roleSource: str(contact?.roleSource),
      division: str(contact?.division),
      orgEmail: str(contact?.orgEmail),
      orgDepartment: str(contact?.orgDepartment),
      tags: Array.isArray(contact?.tags) ? contact.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
      notes: str(contact?.notes),
      directConversationId: direct ? key : null,
      commonGroups: groups,
      stats: {
        messages,
        inThread,
        firstAt: toIso(first?.sentAt),
        lastAt: toIso(last?.sentAt),
      },
    };
  }

  /** Groups whose member list (stored or raw) contains the contact, most recently active first. */
  private async commonGroups(uid: string, userId: string): Promise<ContactProfile['commonGroups']> {
    const groups = await this.db
      .col(C.groups)
      .find({ uid, $or: [{ memberIds: userId }, { 'raw.memberIds': userId }] }, { projection: { _id: 1 } })
      .limit(200)
      .toArray();
    if (!groups.length) return [];
    const convs = await this.db
      .col(C.conversations)
      .find({ _id: { $in: groups.map((g) => g._id) } }, { projection: { name: 1, lastMsgAt: 1 } })
      .toArray();
    const byId = new Map<unknown, Document>(convs.map((c) => [c._id, c]));
    return groups
      .map((g) => ({ id: String(g._id), name: str(byId.get(g._id)?.name), at: (byId.get(g._id)?.lastMsgAt as Date | undefined)?.getTime() ?? 0 }))
      .sort((a, b) => b.at - a.at)
      .slice(0, COMMON_GROUPS_MAX)
      .map(({ id, name }) => ({ id, name }));
  }
}
