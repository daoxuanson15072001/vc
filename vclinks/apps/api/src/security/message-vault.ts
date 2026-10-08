import { Injectable, Logger } from '@nestjs/common';
import { ERASED_TEXT, RECALL_PLACEHOLDER_TEXT } from '@vclinks/shared';
import type { AnyBulkWriteOperation, Document, Filter } from 'mongodb';
import { C, DbService } from '../db/db.service';
import { CustomerKeysService, type Sealed } from './customer-keys.service';

/** Message fields holding customer content; moved into `messages.sealed` when encryption is on. */
export const SEALED_MESSAGE_FIELDS = ['text', 'content', 'quoteRef', 'senderName', 'raw'] as const;
type MsgDoc = Document & { _id: string };
type SealedFields = Partial<Record<(typeof SEALED_MESSAGE_FIELDS)[number], unknown>>;

/** Account's own sender ids (outgoing messages). */
const SELF = new Set(['0']);

/**
 * Subject (= key) of a message: the customer it is about.
 * - 1-1 thread: the peer (`threadId`), for both directions.
 * - group thread: the sender for incoming messages, the group for the account's own messages.
 */
export function messageSubject(uid: string, m: { threadId: string; fromUid?: string | null }): string {
  const from = m.fromUid ?? '';
  if (!from || SELF.has(from) || from === uid || from === m.threadId) return `${uid}:${m.threadId}`;
  return `${uid}:${from}`;
}

/**
 * Per-customer encryption of message content (BA §2.2 #9, M1b-14).
 *
 * Off unless CUSTOMER_ENCRYPTION=1 (and CUSTOMER_KEK set): sealed text is not reachable by the MongoDB
 * text index, so the search (M1c, 5.3) must pick another index before this is switched on in production.
 * When on, IngestService calls `sealMessages` after each write (thin hook); readers call `open`.
 * Erasing a subject works with the switch off too: plaintext content of the subject is scrubbed.
 */
@Injectable()
export class MessageVault {
  private readonly logger = new Logger(MessageVault.name);

  constructor(
    private readonly db: DbService,
    private readonly keys: CustomerKeysService,
  ) {}

  get enabled(): boolean {
    return process.env.CUSTOMER_ENCRYPTION === '1' && this.keys.available;
  }

  /**
   * Moves plaintext content of the matching messages of `uid` into `sealed` (merged with what was
   * sealed before). Messages of an erased subject get the ERASED_TEXT placeholder instead.
   */
  async sealMessages(uid: string, filter: Filter<MsgDoc>): Promise<number> {
    // Erased customers first, whatever the switch: re-pushed content is never kept in clear (gate M1b-12).
    const scrubbed = await this.scrubErasedIn(uid, filter);
    if (!this.enabled) return scrubbed;
    const messages = this.db.col<MsgDoc>(C.messages);
    const docs = await messages
      .find(
        {
          ...filter,
          uid,
          erased: { $ne: true },
          $or: SEALED_MESSAGE_FIELDS.map((f) => ({ [f]: { $exists: true } })),
        },
        { projection: { threadId: 1, fromUid: 1, sealed: 1, ...Object.fromEntries(SEALED_MESSAGE_FIELDS.map((f) => [f, 1])) } },
      )
      .toArray();
    if (!docs.length) return 0;
    const subjectOf = new Map(docs.map((d) => [d._id as unknown as string, messageSubject(uid, d as never)]));
    const keys = await this.keys.dataKeys([...subjectOf.values()]);
    // M1c-05: search keys are derived from the plaintext, they go with it.
    const unset = { ...Object.fromEntries(SEALED_MESSAGE_FIELDS.map((f) => [f, ''])), searchKeys: '' } as Record<string, ''>;
    const ops: AnyBulkWriteOperation<MsgDoc>[] = [];
    for (const d of docs) {
      const id = d._id as unknown as string;
      const subject = subjectOf.get(id)!;
      const key = keys.get(subject);
      if (!key) {
        ops.push({ updateOne: { filter: { _id: id }, update: { $set: { text: ERASED_TEXT, erased: true }, $unset: { searchKeys: '', content: '', quoteRef: '', senderName: '', raw: '', sealed: '' } } } });
        continue;
      }
      const before = (d.sealed && this.keys.openWith<SealedFields>(key, d.sealed as Sealed)) || {};
      const next: SealedFields = { ...before };
      for (const f of SEALED_MESSAGE_FIELDS) if (d[f] !== undefined) next[f] = d[f];
      // Recall keeps the content seen before (IngestService puts the placeholder when it cannot see the text).
      if (d.text === RECALL_PLACEHOLDER_TEXT && typeof before.text === 'string' && before.text) next.text = before.text;
      if (d.content && before.content && typeof d.content === 'object' && typeof before.content === 'object') {
        next.content = { ...(before.content as object), ...(d.content as object) };
      }
      ops.push({ updateOne: { filter: { _id: id }, update: { $set: { sealed: this.keys.sealWith(subject, key, next) }, $unset: unset } } });
    }
    await messages.bulkWrite(ops, { ordered: false });
    return ops.length;
  }

  /**
   * Replaces the content of the matching messages of `uid` whose subject was erased (erased_subjects, or
   * a customer stamped erasedAt) by ERASED_TEXT. Runs on every ingest write with encryption on or off, and
   * also catches messages flagged `erased` that a re-sync filled again. No-op when nothing was ever erased.
   */
  private async scrubErasedIn(uid: string, filter: Filter<MsgDoc>): Promise<number> {
    if (!(await this.keys.anyErased())) return 0;
    const messages = this.db.col<MsgDoc>(C.messages);
    const docs = await messages
      .find(
        {
          ...filter,
          uid,
          $or: [
            { text: { $exists: true, $ne: ERASED_TEXT } },
            ...SEALED_MESSAGE_FIELDS.filter((f) => f !== 'text').map((f) => ({ [f]: { $exists: true } })),
            { sealed: { $exists: true }, erased: true },
          ],
        },
        { projection: { threadId: 1, fromUid: 1 } },
      )
      .toArray();
    if (!docs.length) return 0;
    const subjectOf = new Map(docs.map((d) => [d._id as unknown as string, messageSubject(uid, d as never)]));
    const erased = await this.keys.erasedAmong([...subjectOf.values()]);
    const ids = [...subjectOf].filter(([, s]) => erased.has(s)).map(([id]) => id);
    if (!ids.length) return 0;
    const r = await messages.updateMany(
      { _id: { $in: ids } },
      { $set: { text: ERASED_TEXT, erased: true }, $unset: { searchKeys: '', content: '', quoteRef: '', senderName: '', raw: '', sealed: '' } },
    );
    return r.modifiedCount;
  }

  /**
   * Restores sealed fields on loaded messages, in place. A message whose key was destroyed shows
   * ERASED_TEXT and no content. Messages without `sealed` are left as they are.
   */
  async open<T extends Document>(docs: T[]): Promise<T[]> {
    const sealedDocs = docs.filter((d) => d.sealed && typeof d.sealed === 'object');
    if (!sealedDocs.length || !this.keys.available) {
      for (const d of sealedDocs) this.markErased(d);
      return docs;
    }
    const keys = await this.keys.dataKeys(sealedDocs.map((d) => (d.sealed as Sealed).k), false);
    for (const d of sealedDocs) {
      const s = d.sealed as Sealed;
      const v = this.keys.openWith<SealedFields>(keys.get(s.k), s);
      const rec = d as Record<string, unknown>;
      delete rec.sealed;
      if (!v) {
        this.markErased(d);
        continue;
      }
      for (const f of SEALED_MESSAGE_FIELDS) if (v[f] !== undefined) rec[f] = v[f];
    }
    return docs;
  }

  private markErased(d: Document) {
    const rec = d as Record<string, unknown>;
    delete rec.sealed;
    for (const f of SEALED_MESSAGE_FIELDS) delete rec[f];
    rec.text = ERASED_TEXT;
    rec.erased = true;
  }

  /**
   * Scrubs content still stored in plaintext for the given subjects (encryption off, or written before
   * it was switched on). Sealed content needs nothing: its key is gone.
   */
  async scrubSubjects(subjectIds: string[]): Promise<number> {
    let n = 0;
    for (const s of subjectIds) {
      const i = s.indexOf(':');
      if (i <= 0) continue;
      const uid = s.slice(0, i);
      const peer = s.slice(i + 1);
      const r = await this.db.col(C.messages).updateMany(
        {
          uid,
          $or: [{ threadId: peer, fromUid: { $in: [...SELF, uid, peer] } }, { fromUid: peer }],
          sealed: { $exists: false },
          erased: { $ne: true },
        },
        { $set: { text: ERASED_TEXT, erased: true }, $unset: { searchKeys: '', content: '', quoteRef: '', senderName: '', raw: '' } },
      );
      n += r.modifiedCount;
    }
    if (n) this.logger.log(`scrubbed ${n} plaintext message(s) of ${subjectIds.length} erased subject(s)`);
    return n;
  }
}
