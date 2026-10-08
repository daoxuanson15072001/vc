import { RealtimeService } from '../realtime/realtime.service';
import { ownSenders, refreshInboxState } from '../conversations/inbox-state';
import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  RECALL_MSG_TYPE,
  RECALL_PLACEHOLDER_TEXT,
  STREAM_CURSOR,
  docId,
  domMessagesBatchSchema,
  messageStatusItemSchema,
  domSenderNameSchema,
  validateContentItems,
  validateItems,
  validateThreadNames,
  type ContactItem,
  type ConversationItem,
  type GroupItem,
  type IngestResult,
  type LabelItem,
  type ReactionItem,
  type ReadStateItem,
  type ItemOf,
  type ContentFile,
  type MessageContentBody,
  type MessageContentItem,
  type MessageContentResult,
  type DomMessagesResult,
  type MessageItem,
  type MessageStatusItem,
  type MessageStatusResult,
  type RejectedItem,
  type Stream,
  type SyncReport,
  type ThreadNameItem,
  type ThreadNamesResult,
} from '@vclinks/shared';
import type { AnyBulkWriteOperation, Document } from 'mongodb';
import { parseOr400 } from '../common/zod';

type StrIdDoc = Document & { _id: string };
import { AccountsService, type CheckpointDoc } from '../accounts/accounts.service';
import { C, DbService } from '../db/db.service';
import { SearchService } from '../search/search.service';
import { MessageVault } from '../security/message-vault';
import { AttachmentsService } from '../attachments/attachments.service';
import { sentTextByCliMsgId } from './sent-text';

const COLLECTION: Record<Stream, string> = {
  contacts: C.contacts,
  groups: C.groups,
  conversations: C.conversations,
  messages: C.messages,
  reactions: C.reactions,
  labels: C.labels,
  read_state: C.readStates,
};

const toDate = (ms: number | null | undefined) => (ms == null ? undefined : new Date(ms));

/**
 * $set for a sidebar-read conversation name. Avatar/unread/labels are kept in
 * dom* fields so they never overwrite the IndexedDB-derived `unread`/`labels`.
 */
function threadNameSet(t: ThreadNameItem): Record<string, unknown> {
  const set: Record<string, unknown> = { name: t.name, nameSource: 'dom', nameCapturedAt: new Date() };
  if (t.avatar) set.domAvatar = t.avatar;
  if (t.unread != null) set.domUnread = t.unread;
  if (t.labels) set.domLabels = t.labels;
  // Zalo label chip (thẻ phân loại) as shown: the store keeps the name encrypted.
  if (t.label) set.domLabel = { name: t.label.name, ...(t.label.color ? { color: t.label.color } : {}) };
  return set;
}

/**
 * Reaction summary stored next to Zalo's raw `{ [uid]: { [icon]: count } }`:
 * totals per icon and each reactor's icon, so the Dashboard renders without
 * re-deriving. Zalo uses "0" for the account itself.
 */
function reactionSummary(r: ReactionItem['reactions']): { totals: Record<string, number>; byUser: Record<string, string>; total: number } {
  const totals: Record<string, number> = {};
  const byUser: Record<string, string> = {};
  let total = 0;
  for (const [who, icons] of Object.entries(r ?? {})) {
    let best: string | null = null;
    for (const [icon, n] of Object.entries(icons)) {
      if (n <= 0) continue;
      totals[icon] = (totals[icon] ?? 0) + n;
      total += n;
      best = icon;
    }
    if (best) byUser[who] = best;
  }
  return { totals, byUser, total };
}

/**
 * Stored fields to clear when a record is ingested as metadata only, so any
 * ciphertext left from an earlier ingest is removed. Message content is filled
 * later from the DOM (docs/04-ky-thuat/zalo-web/zalo-web-extraction.md).
 */
const UNSET_ON_ENCRYPTED: Record<Stream, string[]> = {
  contacts: ['displayName', 'zaloName', 'phone', 'avatar'],
  groups: ['name', 'avatar'],
  conversations: [],
  messages: ['text', 'senderName', 'content', 'quoteRef'],
  reactions: [],
  // The DOM-captured name lives in `domName`, so clearing `name` never loses it.
  labels: ['name'],
  read_state: [],
};

function unsetForEncrypted(stream: Stream, item: ItemOf<Stream>): Record<string, ''> | undefined {
  if (!(item as { encrypted?: boolean }).encrypted) return undefined;
  // A field the item sets itself (e.g. a placeholder text) must not be unset too.
  const fields = UNSET_ON_ENCRYPTED[stream].filter((f) => (item as Record<string, unknown>)[f] === undefined);
  if (!fields.length) return undefined;
  return Object.fromEntries(fields.map((f) => [f, ''])) as Record<string, ''>;
}

/**
 * Pipeline update for one message. A pipeline (not `$set`/`$unset`) because what
 * to write depends on the stored doc:
 * - Content captured from the DOM (`contentSource: 'dom'`) is what the user saw
 *   and is never wiped by a later metadata-only (encrypted) re-ingest — the
 *   extension re-sends records every sync (drift sample, full re-sync, recalls).
 *   The same holds for text delivered by a direct nick's zca-js listener ('direct').
 * - A recalled message (msgType RECALL_MSG_TYPE) keeps the text/content stored
 *   before the recall and is flagged `recalled` (owner decision 2026-09-28).
 * Without a stored capture, an encrypted item still clears old ciphertext fields.
 */
function messageUpdate(uid: string, item: MessageItem): Document[] {
  const { sentAt, serverTime, quote, ...rest } = item;
  const lit = (v: unknown) => ({ $literal: v });
  const fields = defined({ uid, ...rest, quoteRef: quote, sentAt: new Date(sentAt), serverTime: toDate(serverTime) });
  const set: Document = {};
  for (const [k, v] of Object.entries(fields)) set[k] = lit(v);

  // Plaintext already on the record (DOM capture, direct listener, or the text VClinks itself sent) survives a metadata re-ingest.
  const captured = { $in: ['$contentSource', ['dom', 'outbox', 'direct']] };
  if (item.encrypted) {
    for (const f of UNSET_ON_ENCRYPTED.messages) {
      set[f] = { $cond: [captured, `$${f}`, f in set ? set[f] : '$$REMOVE'] };
    }
    set.encrypted = { $cond: [captured, false, true] };
    if (item.contentStatus) set.contentStatus = { $cond: [captured, '$contentStatus', item.contentStatus] };
  }

  if (item.msgType === RECALL_MSG_TYPE) {
    const hasRealText = {
      $and: [{ $gt: [{ $strLenCP: { $ifNull: ['$text', ''] } }, 0] }, { $ne: ['$text', RECALL_PLACEHOLDER_TEXT] }],
    };
    set.text = { $cond: [hasRealText, '$text', lit(item.text ?? RECALL_PLACEHOLDER_TEXT)] };
    for (const f of ['content', 'quoteRef', 'senderName'] as const) {
      set[f] = { $ifNull: [`$${f}`, f in fields ? lit(fields[f]) : '$$REMOVE'] };
    }
    // A recall reported on its own (direct nicks: zca-js `undo`) carries the recall time: keep the send time.
    set.sentAt = { $ifNull: ['$sentAt', lit(new Date(sentAt))] };
    // Nothing encrypted is stored: text is the captured content or the placeholder.
    set.encrypted = false;
    set.contentStatus = 'complete';
    set.recalled = true;
    set.recalledAt = { $ifNull: ['$recalledAt', lit(new Date())] };
    // Pipeline $set reads the pre-update doc, so this is the type before the recall.
    set.recalledFromMsgType = {
      $ifNull: [
        '$recalledFromMsgType',
        { $cond: [{ $and: [{ $gt: ['$msgType', null] }, { $ne: ['$msgType', RECALL_MSG_TYPE] }] }, '$msgType', '$$REMOVE'] },
      ],
    };
  }

  // Direct nicks report "Đã gửi" with each own message; delivered / seen arrive later: the status only moves up.
  if (item.contentSource === 'direct' && typeof item.status === 'number') {
    set.status = { $max: [{ $ifNull: ['$status', 0] }, lit(item.status)] };
  }

  set.ingestedAt = { $ifNull: ['$ingestedAt', lit(new Date())] };
  set.attachmentIds = { $ifNull: ['$attachmentIds', { $literal: [] }] };
  return [{ $set: set }];
}

/** Removes undefined values so `$set` never touches fields the source did not send. */
function defined<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * Builds the stored `messages.content` from a DOM capture. Field names are the
 * contract the Dashboard renders (MessageContentBody). Empty lists are omitted;
 * the legacy `voiceUrl` maps onto `voice.url`.
 */
function contentBody(it: MessageContentItem): MessageContentBody {
  const nonEmpty = <T>(a: T[] | undefined) => (a && a.length ? a : undefined);
  let voice = it.voice ? defined({ ...it.voice }) : undefined;
  if (it.voiceUrl && !voice?.url) voice = { ...(voice ?? {}), url: it.voiceUrl };
  return defined({
    images: nonEmpty(it.images),
    links: nonEmpty(it.links),
    files: nonEmpty(it.files?.map((f) => defined({ ...f }) as ContentFile)),
    voice,
    video: it.video ? defined({ ...it.video }) : undefined,
    card: it.card ? defined({ ...it.card }) : undefined,
    location: it.location ? defined({ ...it.location }) : undefined,
    call: it.call ? defined({ ...it.call }) : undefined,
    reminder: it.reminder ? defined({ ...it.reminder }) : undefined,
    quote: it.quote && (it.quote.senderName || it.quote.text) ? defined({ ...it.quote }) : undefined,
    kind: it.kind,
  }) as MessageContentBody;
}

/** Content that must be re-captured later: a voice seen without its URL (<audio> appears only after Play). */
function isPartial(body: MessageContentBody): boolean {
  return !!body.voice && !body.voice.url;
}

/** A message counts as "new" for realtime when it was sent within this window. */
const NEW_MESSAGE_WINDOW_MS = 15 * 60_000;
/** Content captured for messages sent this recently is announced (`message.content`); older back-fill stays silent. */
const CONTENT_EVENT_WINDOW_MS = 60 * 60_000;
/** Earliest plausible send time for a cliMsgId-derived date (Zalo Web did not exist before). */
const MIN_CLI_MS = Date.UTC(2015, 0, 1);

/**
 * Send time of a DOM-only message: Zalo's cliMsgId is the client clock in ms
 * when the message was created (within ~1 s of the server's sendDttm).
 */
export function sentAtFromCliMsgId(cliMsgId: string, now = Date.now()): Date | null {
  if (!/^\d{12,14}$/.test(cliMsgId)) return null;
  const ms = Number(cliMsgId);
  return ms >= MIN_CLI_MS && ms <= now + 86_400_000 ? new Date(ms) : null;
}

export interface LagStats {
  p50: number;
  p95: number;
  max: number;
}

/** Nearest-rank percentile of an ascending-sorted array. */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/** p50 / p95 / max of ingest lag samples in ms; null when there are no samples. */
export function computeLagStats(lags: number[]): LagStats | null {
  if (!lags.length) return null;
  const s = [...lags].sort((a, b) => a - b);
  return { p50: percentile(s, 50), p95: percentile(s, 95), max: s[s.length - 1] };
}

interface BulkOutcome {
  upserted: number;
  modified: number;
  matched: number;
  upsertedIndexes: number[];
  errors: { index: number; code?: number }[];
}

export interface DomPlacement {
  threadId: string;
  direction: 'in' | 'out';
  senderName?: string;
  capturedAt: number;
}

/**
 * Idempotent batch upsert shared by REST (extension) and MCP (fallback).
 * `_id = ${uid}:${source id}`; re-sending the same data changes nothing.
 * Fields owned by VClinks (role, notes, attachmentIds...) are never in `$set`.
 */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    private readonly db: DbService,
    private readonly accounts: AccountsService,
    // M1b-14: per-customer encryption hook, no-op unless CUSTOMER_ENCRYPTION=1.
    @Optional() private readonly vault?: MessageVault,
    // M1c-07: pushes "new message" to open Dashboards.
    @Optional() private readonly realtime?: RealtimeService,
    // M1c-05: keeps `messages.searchKeys` in step with `text`.
    @Optional() private readonly search?: SearchService,
    // M1c-04: files of a message are copied into the company store (links expire).
    @Optional() private readonly attachments?: AttachmentsService,
  ) {}

  async ingest(stream: Stream, uid: string, items: unknown[]): Promise<IngestResult> {
    await this.accounts.assertExists(uid);
    const { valid, rejected } = validateItems(stream, items);
    if (stream === 'reactions') await this.foldReactionDeltas(uid, valid as { item: ReactionItem }[]);

    // Last occurrence wins when a batch repeats the same id.
    const byId = new Map<string, ItemOf<typeof stream>>();
    for (const v of valid) byId.set(this.sourceId(stream, v.item), v.item);
    const unique = [...byId.values()];

    let accepted = 0;
    let updated = 0;
    let unchanged = 0;
    let lagStats: LagStats | null = null;
    const failedIdx = new Set<number>();
    if (unique.length) {
      // Threads the messages lived in before this batch (threadId may change on re-sync).
      const prevThreads =
        stream === 'messages'
          ? await this.db
              .col<StrIdDoc>(C.messages)
              .distinct('threadId', { _id: { $in: unique.map((m) => docId(uid, (m as MessageItem).msgId)) } })
          : [];
      const ops = unique.map((item) => this.upsertOp(stream, uid, item));
      const w = await this.safeBulkWrite(COLLECTION[stream], ops);
      accepted = w.upserted;
      updated = w.modified;
      unchanged = Math.max(0, w.matched - w.modified);
      // Per-record write failures (e.g. E11000): report the id only, never the content.
      for (const e of w.errors) {
        failedIdx.add(e.index);
        const it = unique[e.index];
        rejected.push({ index: e.index, ...(it ? { id: this.sourceId(stream, it) } : {}), reason: `write error ${e.code ?? ''}`.trim() });
      }
      if (stream === 'messages') {
        // Lag of the NEW messages only (sentAt -> now), as numbers, never content.
        const nowMs = Date.now();
        const lags: number[] = [];
        for (const idx of w.upsertedIndexes) {
          const m = unique[idx] as (MessageItem & { sentAtApprox?: boolean }) | undefined;
          if (!m || m.sentAtApprox) continue;
          const lag = nowMs - Number(m.sentAt);
          if (Number.isFinite(lag) && lag >= 0) lags.push(lag);
        }
        lagStats = computeLagStats(lags);
        // Only records that were actually written feed the follow-up steps.
        const written = (unique as MessageItem[]).filter((_, i) => !failedIdx.has(i));
        await this.step(uid, stream, 'absorbDomMessages', () => this.absorbDomMessages(uid, written));
        await this.step(uid, stream, 'applySentText', () => this.applySentText(uid, written));
        await this.step(uid, stream, 'searchKeys', () => this.search?.reindex(uid, { _id: { $in: written.map((m) => docId(uid, m.msgId)) } }));
        await this.step(uid, stream, 'noteAttachments', () =>
          this.attachments?.noteMessages(uid, { _id: { $in: written.map((m) => docId(uid, m.msgId)) } }),
        );
        await this.step(uid, stream, 'sealMessages', () =>
          this.vault?.sealMessages(uid, { _id: { $in: written.map((m) => docId(uid, m.msgId)) } }),
        );
        const threads = new Set<string>([...prevThreads, ...written.map((m) => m.threadId)]);
        await this.step(uid, stream, 'refreshConversations', () => this.refreshConversations(uid, [...threads]));
        const fresh = new Set(w.upsertedIndexes.filter((i) => !failedIdx.has(i)));
        await this.step(uid, stream, 'directUnread', () => this.countDirectUnread(uid, (unique as MessageItem[]).filter((_, i) => fresh.has(i))));
        await this.step(uid, stream, 'announceNewMessages', () => this.announceNewMessages(uid, written));
      }
      if (stream === 'conversations') {
        // A conversation whose chip was captured before its labelId arrived can now name its label.
        await this.nameLabelsFromChips(uid, (unique as ConversationItem[]).filter((c) => c.labelId != null).map((c) => c.threadId));
      }
      if (stream === 'groups') {
        await this.db.col<StrIdDoc>(C.conversations).updateMany(
          { _id: { $in: (unique as GroupItem[]).map((g) => docId(uid, g.groupId)) }, fromStore: { $ne: true } },
          { $set: { type: 'group' } },
        );
      }
    }
    if (rejected.length) {
      // Reasons carry field paths and zod messages only, never record values.
      const byReason = new Map<string, number>();
      for (const r of rejected) byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
      for (const [reason, n] of byReason) this.logger.warn(`[${uid}/${stream}] rejected ${n}: ${reason}`);
    }
    // Duplicates inside the batch count as unchanged.
    unchanged += valid.length - unique.length;

    // Records that failed to write must not move the cursor.
    const checkpoint = await this.advanceCheckpoint(stream, uid, unique.filter((_, i) => !failedIdx.has(i)));
    // Event log: counts only (never content); batches that changed nothing are not logged.
    if (accepted || updated || rejected.length) {
      await this.db.appendEvent({
        type: 'ingest.batch',
        subject: { kind: 'account', id: uid },
        actor: 'ingest',
        data: {
          stream,
          accepted,
          updated,
          unchanged,
          rejected: rejected.length,
          ...(lagStats ? { lagP50Ms: lagStats.p50, lagP95Ms: lagStats.p95, lagMaxMs: lagStats.max } : {}),
        },
      });
    }
    return { accepted, updated, unchanged, rejected, checkpoint };
  }

  /**
   * Unread count of direct (zca-js) nicks, which have no Zalo Web badge to copy: each new customer message adds one,
   * an own message (sent from VClinks or the phone) sets it to the customer messages after it. Only messages new to
   * VClinks count, so a catch-up re-ingest never counts twice.
   */
  private async countDirectUnread(uid: string, fresh: MessageItem[]): Promise<void> {
    const own = new Set(ownSenders(uid));
    const byThread = new Map<string, MessageItem[]>();
    for (const m of fresh) {
      // Group system lines ("A đã tham gia nhóm") are not messages to read.
      if (m.contentSource !== 'direct' || m.systemEvent) continue;
      byThread.set(m.threadId, [...(byThread.get(m.threadId) ?? []), m]);
    }
    const convs = this.db.col<StrIdDoc>(C.conversations);
    for (const [threadId, list] of byThread) {
      list.sort((a, b) => Number(a.sentAt) - Number(b.sentAt));
      let lastOwn = -1;
      list.forEach((m, i) => {
        if (own.has(String(m.fromUid))) lastOwn = i;
      });
      const customer = list.slice(lastOwn + 1).filter((m) => !own.has(String(m.fromUid))).length;
      const _id = docId(uid, threadId);
      if (lastOwn >= 0) await convs.updateOne({ _id }, { $set: { unread: customer } });
      else if (customer) await convs.updateOne({ _id }, [{ $set: { unread: { $add: [{ $ifNull: ['$unread', 0] }, customer] } } }]);
    }
  }

  /** Direct nicks: someone is typing in a conversation; realtime only, nothing is stored (ids, no text). */
  async typing(uid: string, threadId: string, who?: string | null): Promise<{ ok: true }> {
    await this.realtime?.publish({ type: 'typing', id: `${uid}:${threadId}`, uid, threadId, ...(who ? { kind: who } : {}) });
    return { ok: true };
  }

  /**
   * Direct nicks: the other side received / read the nick's own messages (status 2 / 3 on every own message up to
   * that one; never down), or the nick read the thread on another device (unread 0). Silent redraw of open chats.
   */
  async ingestMessageStatus(uid: string, items: unknown[]): Promise<MessageStatusResult> {
    await this.accounts.assertExists(uid);
    const rejected: RejectedItem[] = [];
    const valid: MessageStatusItem[] = [];
    items.forEach((raw, index) => {
      const p = messageStatusItemSchema.safeParse(raw);
      if (p.success) valid.push(p.data);
      else rejected.push({ index, reason: `invalid: ${p.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}` });
    });
    const messages = this.db.col<StrIdDoc>(C.messages);
    const convs = this.db.col<StrIdDoc>(C.conversations);
    const own = ownSenders(uid);
    const touched = new Set<string>();
    let updated = 0;
    for (const it of valid) {
      if (it.event === 'read') {
        const r = await convs.updateOne({ _id: docId(uid, it.threadId), unread: { $gt: 0 } }, { $set: { unread: 0 } });
        if (r.modifiedCount) {
          updated += 1;
          touched.add(it.threadId);
        }
        continue;
      }
      if (!it.msgId) continue;
      const target = await messages.findOne({ uid, threadId: it.threadId, msgId: it.msgId }, { projection: { sentAt: 1 } });
      if (!(target?.sentAt instanceof Date)) continue;
      const status = it.event === 'seen' ? 3 : 2;
      const r = await messages.updateMany(
        { uid, threadId: it.threadId, fromUid: { $in: own }, sentAt: { $lte: target.sentAt }, $or: [{ status: { $exists: false } }, { status: null }, { status: { $lt: status } }] },
        { $set: { status } },
      );
      if (r.modifiedCount) {
        updated += r.modifiedCount;
        touched.add(it.threadId);
      }
    }
    for (const t of touched) await this.realtime?.publish({ type: 'message.content', id: `${uid}:${t}`, uid, threadId: t });
    if (rejected.length) this.logger.warn(`[${uid}/message-status] rejected ${rejected.length}`);
    return { updated, rejected };
  }

  /**
   * Direct nicks report reactions one event at a time (`delta`). Each is folded
   * onto the stored map in batch order, so the item that reaches the upsert
   * carries the whole map, as the extension's items do.
   */
  private async foldReactionDeltas(uid: string, valid: { item: ReactionItem }[]): Promise<void> {
    const withDelta = valid.filter((v) => v.item.delta);
    if (!withDelta.length) return;
    type IconMap = Record<string, Record<string, number>>;
    const copy = (m: IconMap): IconMap => Object.fromEntries(Object.entries(m).map(([who, icons]) => [who, { ...icons }]));
    const ids = [...new Set(withDelta.map((v) => docId(uid, v.item.msgId)))];
    const stored = await this.db
      .col<StrIdDoc>(C.reactions)
      .find({ _id: { $in: ids } }, { projection: { reactions: 1 } })
      .toArray();
    const state = new Map<string, IconMap>(stored.map((d) => [d._id, copy((d.reactions as IconMap | undefined) ?? {})]));
    for (const v of valid) {
      const key = docId(uid, v.item.msgId);
      const { delta, ...rest } = v.item;
      if (!delta) {
        if (rest.reactions) state.set(key, copy(rest.reactions));
        continue;
      }
      const map = state.get(key) ?? {};
      if (delta.icon === null) delete map[delta.reactor];
      else map[delta.reactor] = { ...(map[delta.reactor] ?? {}), [delta.icon]: (map[delta.reactor]?.[delta.icon] ?? 0) + 1 };
      state.set(key, map);
      v.item = { ...rest, reactions: copy(map) };
    }
  }

  /**
   * bulkWrite({ordered:false}) that survives partial failure: a MongoBulkWriteError
   * is turned into counts for the part that was written plus per-record errors.
   * Any other error is rethrown.
   */
  private async safeBulkWrite(collection: string, ops: AnyBulkWriteOperation<StrIdDoc>[]): Promise<BulkOutcome> {
    try {
      const r = await this.db.col<StrIdDoc>(collection).bulkWrite(ops, { ordered: false });
      return {
        upserted: r.upsertedCount,
        modified: r.modifiedCount,
        matched: r.matchedCount,
        upsertedIndexes: Object.keys(r.upsertedIds ?? {}).map(Number),
        errors: [],
      };
    } catch (err) {
      const e = err as {
        name?: string;
        writeErrors?: unknown;
        result?: { upsertedCount?: number; modifiedCount?: number; matchedCount?: number; upsertedIds?: Record<string, unknown> };
      };
      if (e?.name !== 'MongoBulkWriteError') throw err;
      const raw = (Array.isArray(e.writeErrors) ? e.writeErrors : e.writeErrors ? [e.writeErrors] : []) as { index?: number; code?: number }[];
      const errors = raw.map((w) => ({ index: Number(w.index), code: w.code }));
      const res = e.result ?? {};
      this.logger.warn(`bulkWrite partial failure on ${collection}: ${errors.length} record error(s)`);
      return {
        upserted: res.upsertedCount ?? 0,
        modified: res.modifiedCount ?? 0,
        matched: res.matchedCount ?? 0,
        upsertedIndexes: Object.keys(res.upsertedIds ?? {}).map(Number),
        errors,
      };
    }
  }

  /** Runs a secondary step; its failure is logged (step name + error class only) and never aborts the batch. */
  private async step(uid: string, stream: Stream, name: string, fn: () => Promise<unknown> | undefined) {
    try {
      await fn();
    } catch (err) {
      this.logger.warn(`[${uid}/${stream}] step ${name} failed: ${(err as Error)?.name ?? 'Error'}`);
    }
  }

  /**
   * Joins DOM-captured content onto existing messages by (uid, cliMsgId).
   * Fills text/media, marks the message content complete and clears the
   * metadata-only `encrypted` flag so the Dashboard shows it. Content for a
   * message whose metadata has not been ingested yet is reported as unmatched.
   */
  async ingestContent(uid: string, items: unknown[]): Promise<MessageContentResult> {
    await this.accounts.assertExists(uid);
    const { valid, rejected } = validateContentItems(items);

    // Last capture of a cliMsgId wins, and only items that actually carry content.
    // (Non-https URLs were already dropped by the schema.)
    const byId = new Map<string, MessageContentItem>();
    for (const v of valid) {
      const it = v.item;
      const hasContent =
        (it.text != null && it.text !== '') ||
        !!it.images?.length ||
        !!it.links?.length ||
        !!it.files?.length ||
        !!it.voice ||
        !!it.video ||
        !!it.card ||
        !!it.location ||
        !!it.call ||
        !!it.reminder ||
        !!it.voiceUrl;
      if (hasContent) byId.set(it.cliMsgId, it);
    }
    const cliMsgIds = [...byId.keys()];
    if (!cliMsgIds.length) return { matched: 0, unmatched: [], rejected };

    const found = await this.db
      .col<StrIdDoc>(C.messages)
      .find({ uid, cliMsgId: { $in: cliMsgIds } }, { projection: { cliMsgId: 1, contentStatus: 1, threadId: 1, sentAt: 1, 'content.mediaImages': 1 } })
      .toArray();
    const statusById = new Map<string, unknown>(found.map((d) => [String(d.cliMsgId), d.contentStatus]));
    // Photos uploaded as bytes (MediaService) are not part of a DOM capture: keep them.
    const mediaById = new Map<string, string[]>(
      found
        .filter((d) => Array.isArray(d.content?.mediaImages) && d.content.mediaImages.length)
        .map((d) => [String(d.cliMsgId), d.content.mediaImages as string[]]),
    );
    const unmatched = cliMsgIds.filter((id) => !statusById.has(id));

    // A partial capture never downgrades a message already captured in full
    // (e.g. voice seen again before Play, after its URL was stored earlier).
    let keptComplete = 0;
    const ops = cliMsgIds
      .filter((id) => statusById.has(id))
      .flatMap((id) => {
        const it = byId.get(id)!;
        const body = contentBody(it);
        const media = mediaById.get(id);
        if (media) body.mediaImages = media;
        const status = isPartial(body) ? 'partial' : 'complete';
        if (status === 'partial' && statusById.get(id) === 'complete') {
          keptComplete++;
          return [];
        }
        const set: Document = {
          contentStatus: status,
          encrypted: false,
          contentSource: 'dom',
          contentCapturedAt: new Date(it.capturedAt),
        };
        if (it.schemaVersion) set.contentSchemaVersion = it.schemaVersion;
        if (it.text != null) set.text = it.text;
        // Plaintext on screen; the IndexedDB `dName` is ciphertext for encrypted records.
        if (it.senderName) set.senderName = it.senderName;
        if (Object.keys(body).length) set.content = body;
        return [{ updateOne: { filter: { uid, cliMsgId: id }, update: { $set: set } } }];
      });

    let matched = 0;
    if (ops.length) {
      const r = await this.db.col<StrIdDoc>(C.messages).bulkWrite(ops as never, { ordered: false });
      matched = r.matchedCount; // messages found (includes idempotent re-captures)
      await this.search?.reindex(uid, { cliMsgId: { $in: cliMsgIds } }).catch(() => undefined);
      await this.attachments?.noteMessages(uid, { cliMsgId: { $in: cliMsgIds } });
      await this.vault?.sealMessages(uid, { cliMsgId: { $in: cliMsgIds } });
      await this.announceContent(uid, found, new Set(ops.map((o) => String(o.updateOne.filter.cliMsgId))));
    }
    matched += keptComplete;
    if (rejected.length) {
      const byReason = new Map<string, number>();
      for (const r of rejected) byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
      for (const [reason, n] of byReason) this.logger.warn(`[${uid}/content] rejected ${n}: ${reason}`);
    }
    return { matched, unmatched, rejected };
  }

  /**
   * Stores conversation display names read from the Zalo Web sidebar (plaintext
   * on screen, read without opening any conversation). The name lives on the
   * conversation and the Dashboard prefers it over the encrypted contact/group
   * name. Threads with no conversation doc yet are reported unmatched.
   */
  async updateThreadNames(uid: string, items: unknown[]): Promise<ThreadNamesResult> {
    await this.accounts.assertExists(uid);
    const { valid, rejected } = validateThreadNames(items);

    const byId = new Map<string, ThreadNameItem>();
    for (const v of valid) byId.set(v.item.threadId, v.item);
    const threadIds = [...byId.keys()];
    if (!threadIds.length) return { matched: 0, unmatched: [], rejected };

    const existing = new Set(
      await this.db
        .col<StrIdDoc>(C.conversations)
        .distinct('threadId', { uid, threadId: { $in: threadIds } }),
    );
    const unmatched = threadIds.filter((id) => !existing.has(id));

    const ops = threadIds
      .filter((id) => existing.has(id))
      .map((id) => ({
        updateOne: {
          filter: { _id: docId(uid, id) },
          update: { $set: threadNameSet(byId.get(id)!) },
        },
      }));
    let matched = 0;
    if (ops.length) {
      const r = await this.db.col<StrIdDoc>(C.conversations).bulkWrite(ops as never, { ordered: false });
      matched = r.matchedCount;
      await this.nameLabelsFromChips(uid, threadIds.filter((id) => existing.has(id) && byId.get(id)!.label));
    }
    if (rejected.length) {
      const byReason = new Map<string, number>();
      for (const r of rejected) byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + 1);
      for (const [reason, n] of byReason) this.logger.warn(`[${uid}/thread-names] rejected ${n}: ${reason}`);
    }
    return { matched, unmatched, rejected };
  }

  /**
   * The label store keeps names encrypted; the sidebar shows them. A conversation
   * that has both a `labelId` (store) and a label chip (DOM) names that label.
   */
  private async nameLabelsFromChips(uid: string, threadIds: string[]) {
    if (!threadIds.length) return;
    const convs = await this.db
      .col<StrIdDoc>(C.conversations)
      .find({ _id: { $in: threadIds.map((t) => docId(uid, t)) }, labelId: { $exists: true, $nin: [null, ''] }, domLabel: { $exists: true } }, { projection: { labelId: 1, domLabel: 1 } })
      .toArray();
    const ops = convs.map((c) => ({
      updateOne: {
        filter: { _id: docId(uid, String(c.labelId)) },
        update: {
          $set: { uid, labelId: String(c.labelId), domName: c.domLabel.name, ...(c.domLabel.color ? { domColor: c.domLabel.color } : {}), nameSource: 'dom', nameCapturedAt: new Date() },
          $setOnInsert: { ingestedAt: new Date() },
        },
        upsert: true,
      },
    }));
    if (ops.length) await this.db.col<StrIdDoc>(C.labels).bulkWrite(ops as never, { ordered: false });
  }

  /**
   * Content of the conversation open in a Dashboard fetch request. Bubbles whose
   * message exists get their content as in ingestContent; the others (history
   * no longer in IndexedDB) are created from the DOM: `_id = uid:dom:<cliMsgId>`,
   * `source: 'dom'`, send time from the cliMsgId. When IndexedDB metadata with
   * the same cliMsgId shows up later, the content moves there (absorbDomMessages).
   */
  async ingestDomMessages(body: unknown): Promise<DomMessagesResult> {
    const { uid, threadId, items } = parseOr400(domMessagesBatchSchema, body);
    await this.accounts.assertExists(uid);
    const conv = await this.db.col(C.conversations).countDocuments({ _id: docId(uid, threadId) as never }, { limit: 1 });
    if (!conv) return { matched: 0, unmatched: [], rejected: [], created: 0 };

    // Sender names are DOM-only data: split them off before the strict content schema.
    const senders = new Map<string, string | undefined>();
    const contentItems = items.map((raw) => {
      if (!raw || typeof raw !== 'object') return raw;
      const { senderName, ...rest } = raw as Record<string, unknown>;
      const name = domSenderNameSchema.safeParse(senderName);
      if (rest.cliMsgId != null) senders.set(String(rest.cliMsgId), name.success ? name.data : undefined);
      return rest;
    });
    const res = await this.ingestContent(uid, contentItems);

    // Everything not joined to an existing message (including media-only bubbles
    // that ingestContent skips as empty) is created from the DOM.
    const { valid } = validateContentItems(contentItems);
    const ids = [...new Set(valid.map((v) => v.item.cliMsgId))];
    const known = await this.db
      .col<StrIdDoc>(C.messages)
      .find({ uid, cliMsgId: { $in: ids } }, { projection: { cliMsgId: 1, threadId: 1 } })
      .toArray();
    // Safety: a known bubble of another thread means the chat on screen is not
    // `threadId`; creating the unknown ones would file them under the wrong chat.
    if (known.some((d) => d.threadId !== threadId)) {
      this.logger.warn(`[${uid}/dom-messages] batch holds bubbles of another thread; nothing created`);
      return { ...res, created: 0, threadMismatch: true };
    }
    const existing = new Set(known.map((d) => String(d.cliMsgId)));
    let created = 0;
    for (const { item } of valid) {
      if (existing.has(item.cliMsgId)) continue;
      const ok = await this.createDomMessage(uid, item.cliMsgId, {
        threadId,
        direction: item.direction ?? 'in',
        senderName: senders.get(item.cliMsgId),
        capturedAt: item.capturedAt,
      });
      if (!ok) continue;
      existing.add(item.cliMsgId);
      created++;
      await this.ingestContent(uid, [item]);
    }
    if (created) await this.refreshConversations(uid, [threadId]);
    return { ...res, unmatched: res.unmatched.filter((id) => !existing.has(id)), created };
  }

  /**
   * Creates a message known only from the DOM (no-op when a message with this
   * cliMsgId already exists). Content is filled by the caller. Returns false
   * when the cliMsgId does not carry a plausible send time.
   */
  async createDomMessage(uid: string, cliMsgId: string, p: DomPlacement): Promise<boolean> {
    const sentAt = sentAtFromCliMsgId(cliMsgId);
    if (!sentAt) return false;
    const messages = this.db.col<StrIdDoc>(C.messages);
    if (await messages.countDocuments({ uid, cliMsgId }, { limit: 1 })) return true;
    // Only into a conversation the account already has (never invent threads).
    if (!(await this.db.col(C.conversations).countDocuments({ _id: docId(uid, p.threadId) as never }, { limit: 1 }))) {
      return false;
    }
    const fromUid = p.direction === 'out' ? '0' : await this.resolveSender(uid, p.threadId, p.senderName);
    await messages.updateOne(
      { _id: docId(uid, `dom:${cliMsgId}`) },
      {
        $setOnInsert: {
          uid,
          threadId: p.threadId,
          msgId: `dom:${cliMsgId}`,
          cliMsgId,
          fromUid,
          ...(p.senderName ? { senderName: p.senderName } : {}),
          msgType: null,
          sentAt,
          sentAtApprox: true,
          source: 'dom',
          contentStatus: 'pending',
          encrypted: false,
          attachmentIds: [],
          ingestedAt: new Date(),
        },
      },
      { upsert: true },
    );
    await this.search?.reindex(uid, { _id: docId(uid, `dom:${cliMsgId}`) }).catch(() => undefined);
    await this.vault?.sealMessages(uid, { _id: docId(uid, `dom:${cliMsgId}`) });
    return true;
  }

  /** Recomputes messageCount / lastMsgAt of one thread (after DOM-only messages were added). */
  refreshThread(uid: string, threadId: string) {
    return this.refreshConversations(uid, [threadId]);
  }

  /**
   * Sender of an incoming DOM-only bubble: the peer in a 1-1 thread, else the
   * one contact of the account with exactly that display / Zalo name, else a
   * name-based placeholder (`dom:<name>`) so runs still group by sender.
   */
  private async resolveSender(uid: string, threadId: string, name?: string): Promise<string> {
    if (!threadId.startsWith('g')) return threadId;
    if (name) {
      const hits = await this.db
        .col(C.contacts)
        .find({ uid, $or: [{ displayName: name }, { zaloName: name }] }, { projection: { userId: 1 } })
        .limit(2)
        .toArray();
      if (hits.length === 1 && hits[0].userId) return String(hits[0].userId);
      return `dom:${name}`;
    }
    return 'dom:unknown';
  }

  /**
   * Writes the text of a message VClinks sent (outbox, mark_sent) onto the
   * message record, so the Dashboard shows it at once instead of waiting for
   * the extension to read it back from the screen (measured 4–27 min). A DOM
   * capture or the text a direct nick's listener delivered (the message as Zalo
   * holds it) is never overwritten; a DOM capture may replace this later.
   * Content-free log.
   */
  async mirrorSentText(uid: string, threadId: string, textByCliMsgId: Map<string, string>, sentAt: Date): Promise<number> {
    if (!textByCliMsgId.size) return 0;
    const messages = this.db.col<StrIdDoc>(C.messages);
    const ops = [...textByCliMsgId].map(([cliMsgId, text]) => ({
      updateOne: {
        filter: { uid, threadId, cliMsgId, contentSource: { $nin: ['dom', 'direct'] } },
        update: { $set: { text, contentStatus: 'complete', encrypted: false, contentSource: 'outbox', contentCapturedAt: sentAt } },
      },
    }));
    const r = await messages.bulkWrite(ops as never, { ordered: false });
    if (r.matchedCount) {
      const filter = { uid, cliMsgId: { $in: [...textByCliMsgId.keys()] } };
      await this.search?.reindex(uid, filter).catch(() => undefined);
      await this.vault?.sealMessages(uid, filter);
    }
    return r.matchedCount;
  }

  /**
   * Metadata of own messages (`fromUid` '0') that arrived after mark_sent: fill
   * the text from the sent outbox item (reverse order of mirrorSentText).
   */
  private async applySentText(uid: string, items: MessageItem[]) {
    const own = items.filter((m) => m.fromUid === '0' && m.cliMsgId && m.encrypted);
    if (!own.length) return;
    const ids = own.map((m) => String(m.cliMsgId));
    const sent = await this.db
      .col<{ threadId: string; finalText: string; cliMsgId?: string; cliMsgIds?: string[]; sentAt?: Date; statusAt?: Date }>(C.suggestions)
      .find(
        { uid, status: 'sent', action: { $in: [null, 'send_text'] }, $or: [{ cliMsgId: { $in: ids } }, { cliMsgIds: { $in: ids } }] },
        { projection: { threadId: 1, finalText: 1, cliMsgId: 1, cliMsgIds: 1, sentAt: 1, statusAt: 1 } },
      )
      .toArray();
    for (const d of sent) {
      const map = sentTextByCliMsgId(d);
      for (const id of map.keys()) if (!ids.includes(id)) map.delete(id);
      await this.mirrorSentText(uid, d.threadId, map, d.sentAt ?? d.statusAt ?? new Date());
    }
  }

  /**
   * IndexedDB metadata arrived for messages first created from the DOM: move
   * the captured content onto the real message and drop the DOM-only copy.
   */
  private async absorbDomMessages(uid: string, items: MessageItem[]) {
    const byCli = new Map(items.filter((m) => m.cliMsgId).map((m) => [String(m.cliMsgId), m]));
    if (!byCli.size) return;
    const messages = this.db.col<StrIdDoc>(C.messages);
    const doms = await messages.find({ uid, source: 'dom', cliMsgId: { $in: [...byCli.keys()] } }).toArray();
    for (const d of doms) {
      const real = byCli.get(String(d.cliMsgId));
      if (!real || d._id === docId(uid, real.msgId)) continue;
      const realId = docId(uid, real.msgId);
      const set: Document = { encrypted: false };
      for (const f of ['text', 'content', 'sealed', 'contentStatus', 'contentSource', 'contentCapturedAt', 'contentSchemaVersion']) {
        if (d[f] !== undefined) set[f] = d[f];
      }
      if (!real.senderName && d.senderName) set.senderName = d.senderName;
      await messages.updateOne({ _id: realId, contentSource: { $ne: 'dom' } }, { $set: set });
      await messages.updateMany({ uid, albumOf: d._id }, { $set: { albumOf: realId } });
      await messages.deleteOne({ _id: d._id });
    }
  }

  async getCheckpoint(uid: string, stream: Stream) {
    const cp = await this.db.col<CheckpointDoc>(C.checkpoints).findOne({ _id: docId(uid, stream) });
    return { uid, stream, cursor: cp?.cursor ?? null, sourceCount: cp?.sourceCount ?? null };
  }

  async report(r: SyncReport) {
    await this.accounts.assertExists(r.uid);
    const now = new Date();
    const ops = Object.entries(r.sourceCounts).map(([stream, count]) => ({
      updateOne: {
        filter: { _id: docId(r.uid, stream) },
        update: {
          $set: { uid: r.uid, stream, sourceCount: count, sourceCountAt: now, mappingVersion: r.mappingVersion },
        },
        upsert: true,
      },
    }));
    if (ops.length) await this.db.col<CheckpointDoc>(C.checkpoints).bulkWrite(ops as never);
    await this.db.col(C.accounts).updateOne({ _id: r.uid as never }, { $set: { lastSyncAt: now } });
  }

  private sourceId(stream: Stream, item: ItemOf<Stream>): string {
    switch (stream) {
      case 'contacts':
        return (item as ContactItem).userId;
      case 'groups':
        return (item as GroupItem).groupId;
      case 'conversations':
        return (item as ConversationItem).threadId;
      case 'messages':
        return (item as MessageItem).msgId;
      case 'reactions':
        return (item as ReactionItem).msgId;
      case 'labels':
        return (item as LabelItem).labelId;
      case 'read_state':
        return (item as ReadStateItem).threadId;
    }
  }

  private upsertOp(stream: Stream, uid: string, item: ItemOf<Stream>): AnyBulkWriteOperation<StrIdDoc> {
    const _id = docId(uid, this.sourceId(stream, item));
    const base = { filter: { _id }, upsert: true } as const;
    const unset = unsetForEncrypted(stream, item);
    const withUnset = <U extends Document>(update: U): U => (unset ? { ...update, $unset: unset } : update);
    switch (stream) {
      case 'contacts': {
        const { lastActionTime, ...rest } = item as ContactItem;
        return {
          updateOne: {
            ...base,
            update: withUnset({
              $set: defined({ uid, ...rest, lastActionTime: toDate(lastActionTime) }),
              $setOnInsert: { ingestedAt: new Date(), tags: [] },
            }),
          },
        };
      }
      case 'groups':
        return {
          updateOne: {
            ...base,
            update: withUnset({ $set: defined({ uid, ...(item as GroupItem) }), $setOnInsert: { ingestedAt: new Date() } }),
          },
        };
      case 'conversations': {
        const { lastMsgAt, ...rest } = item as ConversationItem;
        const update: Document = {
          $set: defined({ uid, ...rest, fromStore: true }),
          $setOnInsert: { ingestedAt: new Date(), messageCount: 0 },
        };
        // $max so a stale store value never moves lastMsgAt backwards.
        if (lastMsgAt != null) update.$max = { lastMsgAt: new Date(lastMsgAt) };
        return { updateOne: { ...base, update } };
      }
      case 'messages':
        return { updateOne: { ...base, update: messageUpdate(uid, item as MessageItem) } };
      case 'reactions': {
        const { lastUpdate, reactions, ...rest } = item as ReactionItem;
        return {
          updateOne: {
            ...base,
            update: {
              $set: defined({ uid, ...rest, reactions: reactions ?? {}, ...reactionSummary(reactions), lastUpdate: toDate(lastUpdate) }),
              $setOnInsert: { ingestedAt: new Date() },
            },
          },
        };
      }
      case 'labels': {
        const { createdAt, ...rest } = item as LabelItem;
        return {
          updateOne: {
            ...base,
            update: withUnset({ $set: defined({ uid, ...rest, createdAt: toDate(createdAt) }), $setOnInsert: { ingestedAt: new Date() } }),
          },
        };
      }
      case 'read_state': {
        const { at, ...rest } = item as ReadStateItem;
        return { updateOne: { ...base, update: { $set: defined({ uid, ...rest, at: toDate(at) }), $setOnInsert: { ingestedAt: new Date() } } } };
      }
    }
  }

  /**
   * Recomputes messageCount / lastMsgAt of the given threads from `messages`,
   * so conversations stay correct even when the conversation store is not
   * mapped, and when a re-sync moves messages to another thread.
   * Derived conversations left without messages are removed.
   */
  private async refreshConversations(uid: string, threadIds: string[]) {
    if (!threadIds.length) return;
    const stats = await this.db
      .col(C.messages)
      .aggregate<{ _id: string; n: number; last: Date }>([
        { $match: { uid, threadId: { $in: threadIds } } },
        { $group: { _id: '$threadId', n: { $sum: 1 }, last: { $max: '$sentAt' } } },
      ])
      .toArray();
    const byThread = new Map(stats.map((s) => [s._id, s]));
    const groups = await this.db
      .col<StrIdDoc>(C.groups)
      .find({ _id: { $in: threadIds.map((t) => docId(uid, t)) } }, { projection: { groupId: 1 } })
      .toArray();
    const groupIds = new Set(groups.map((g) => g.groupId as string));

    const convs = this.db.col<StrIdDoc>(C.conversations);
    const empty = threadIds.filter((t) => !byThread.has(t)).map((t) => docId(uid, t));
    if (empty.length) await convs.deleteMany({ _id: { $in: empty }, fromStore: { $ne: true } });
    if (!stats.length) return;
    await convs.bulkWrite(
      stats.map((s) => ({
        updateOne: {
          filter: { _id: docId(uid, s._id) },
          update: {
            $setOnInsert: {
              uid,
              threadId: s._id,
              type: groupIds.has(s._id) ? 'group' : 'user',
              fromStore: false,
              labels: [],
              ingestedAt: new Date(),
            },
            $set: { messageCount: s.n, lastMsgAt: s.last },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    // "Chưa trả lời" / SLA deadline of the threads (M1b-09, SZ-21).
    await refreshInboxState(this.db, uid, threadIds);
  }

  /**
   * Realtime "new message" (M1c-07): one event per thread that got a customer message sent in the last
   * few minutes, so a back-fill of old history stays silent. Ids only, no text.
   */
  private async announceNewMessages(uid: string, items: MessageItem[]) {
    if (!this.realtime) return;
    const own = new Set(ownSenders(uid));
    const since = Date.now() - NEW_MESSAGE_WINDOW_MS;
    const threads = new Set<string>();
    for (const m of items) if (!own.has(String(m.fromUid)) && !m.systemEvent && Number(m.sentAt) >= since) threads.add(m.threadId);
    for (const t of threads) await this.realtime.publish({ type: 'message.new', id: `${uid}:${t}`, uid, threadId: t });
  }

  /**
   * Realtime "content arrived": a chat showing "Đang chờ nội dung" refreshes as soon as the text / photo of a recent
   * message is captured, instead of at its next poll. One event per thread; ids only, no text.
   */
  private async announceContent(uid: string, found: StrIdDoc[], written: Set<string>) {
    if (!this.realtime) return;
    const since = Date.now() - CONTENT_EVENT_WINDOW_MS;
    const threads = new Set<string>();
    for (const d of found) {
      if (!written.has(String(d.cliMsgId)) || d.contentStatus === 'complete') continue;
      if (d.sentAt instanceof Date && d.sentAt.getTime() >= since && d.threadId) threads.add(String(d.threadId));
    }
    for (const t of threads) await this.realtime.publish({ type: 'message.content', id: `${uid}:${t}`, uid, threadId: t });
  }

  private async advanceCheckpoint(stream: Stream, uid: string, items: ItemOf<Stream>[]) {
    const field = STREAM_CURSOR[stream];
    let max: number | null = null;
    if (field) {
      for (const it of items) {
        const v = (it as Record<string, unknown>)[field];
        if (typeof v === 'number' && (max === null || v > max)) max = v;
      }
    }
    const update: Document = {
      $set: { uid, stream, lastIngestAt: new Date() },
    };
    if (max !== null) update.$max = { cursor: max };
    const cp = await this.db
      .col<CheckpointDoc>(C.checkpoints)
      .findOneAndUpdate({ _id: docId(uid, stream) }, update, { upsert: true, returnDocument: 'after' });
    return cp?.cursor ?? null;
  }
}
