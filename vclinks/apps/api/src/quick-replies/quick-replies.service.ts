import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { QuickReply, QuickReplyInput, QuickReplyPatch } from '@vclinks/shared';
import { ObjectId } from 'mongodb';
import { C, DbService } from '../db/db.service';

export interface QuickReplyDoc {
  _id: ObjectId;
  shortcut: string;
  title: string;
  text: string;
  kind: QuickReply['kind'];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function toQuickReply(d: QuickReplyDoc): QuickReply {
  return { id: d._id.toHexString(), shortcut: d.shortcut, title: d.title, text: d.text, kind: d.kind, createdBy: d.createdBy, updatedAt: d.updatedAt.toISOString() };
}

function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw new NotFoundException('Không tìm thấy mẫu câu');
  return new ObjectId(id);
}

/**
 * Company-wide quick replies (BA F3.2), stored in `quick_replies`. One
 * shortcut per template. Audit entries carry ids and shortcuts only, never
 * the template text.
 */
@Injectable()
export class QuickRepliesService {
  private indexed = false;

  constructor(private readonly db: DbService) {}

  private get col() {
    return this.db.col<QuickReplyDoc>(C.quickReplies);
  }

  private async ensureIndexes() {
    if (this.indexed) return;
    await this.col.createIndex({ shortcut: 1 }, { unique: true });
    this.indexed = true;
  }

  async list(): Promise<QuickReply[]> {
    await this.ensureIndexes();
    const docs = await this.col.find({}).sort({ kind: 1, shortcut: 1 }).limit(500).toArray();
    return docs.map(toQuickReply);
  }

  async create(input: Required<QuickReplyInput>, actor: string): Promise<QuickReply> {
    await this.ensureIndexes();
    const now = new Date();
    const doc: QuickReplyDoc = { _id: new ObjectId(), ...input, createdBy: actor, createdAt: now, updatedAt: now };
    try {
      await this.col.insertOne(doc);
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ConflictException(`Phím tắt /${input.shortcut} đã có`);
      throw e;
    }
    await this.db.audit(actor, 'quick_reply.create', doc._id.toHexString(), { shortcut: doc.shortcut, kind: doc.kind });
    return toQuickReply(doc);
  }

  async update(id: string, patch: QuickReplyPatch, actor: string): Promise<QuickReply> {
    await this.ensureIndexes();
    const _id = oid(id);
    const set: Partial<QuickReplyDoc> = { updatedAt: new Date() };
    for (const k of ['shortcut', 'title', 'text', 'kind'] as const) if (patch[k] !== undefined) (set as Record<string, unknown>)[k] = patch[k];
    let doc: QuickReplyDoc | null;
    try {
      doc = await this.col.findOneAndUpdate({ _id }, { $set: set }, { returnDocument: 'after' });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ConflictException(`Phím tắt /${patch.shortcut} đã có`);
      throw e;
    }
    if (!doc) throw new NotFoundException('Không tìm thấy mẫu câu');
    await this.db.audit(actor, 'quick_reply.update', id, { fields: Object.keys(set).filter((k) => k !== 'updatedAt') });
    return toQuickReply(doc);
  }

  async remove(id: string, actor: string): Promise<void> {
    const r = await this.col.deleteOne({ _id: oid(id) });
    if (!r.deletedCount) throw new NotFoundException('Không tìm thấy mẫu câu');
    await this.db.audit(actor, 'quick_reply.delete', id);
  }
}
