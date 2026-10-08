import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AiDraftAction, AiDraftMetrics, AiDraftSource, AiDraftStatus, AiDraftView, AiRiskFlag } from '@vclinks/shared';
import { ObjectId } from 'mongodb';
import { C, DbService } from '../db/db.service';
import { toIso } from '../common/zod';
import { runUnscoped } from '../db/tenant-context';
import type { GuardReason } from './output-guard';
import { SuggestWorker } from './suggest.worker';

/*
 * AI drafts (M1c-06). Stored in `ai_drafts`, a collection of their own: the outbox lives in `suggestions`
 * and is claimed by the extension / dispatcher, so a draft must never be a document there.
 *
 * §12.1 / BR07: this service has NO way to send. "Dùng nháp" only puts the text in the composer; the user
 * presses "Gửi", which creates an outbox item through the outbox create route with approvedBy / approvedAt = that
 * user. Afterwards the web reports the outbox id here (`linkSent`) and the service READS that item to
 * record the pair (draft, final text) for playbook learning. Audit entries carry ids and flags, never text.
 */
export const AI_DRAFTS = 'ai_drafts';

export interface AiDraftDoc {
  _id: ObjectId;
  conversationId: string;
  uid: string;
  threadId: string;
  messageId: string | null;
  status: AiDraftStatus;
  action: AiDraftAction;
  draft: string | null;
  summary: string | null;
  riskFlags: AiRiskFlag[];
  reason: string | null;
  guard: GuardReason[];
  sources: AiDraftSource[];
  mode: 'mock' | 'live';
  model: string;
  requestedBy: string;
  createdAt: Date;
  /** Superseded by a newer draft of the same conversation ("Soạn lại"); not counted in metrics. */
  replaced?: boolean;
  /** Pair kept for playbook learning (CLAUDE.md §8): draft vs. what was actually sent. */
  finalText?: string;
  outboxId?: string;
  approvedBy?: string;
  approvedAt?: Date;
  decidedBy?: string;
  decidedAt?: Date;
  rejectReason?: string;
}

/** Outbox fields read when linking a sent item (read only). */
interface OutboxRead {
  _id: ObjectId;
  uid: string;
  threadId: string;
  finalText?: string;
  action?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

/** Shown when the nick is marked "Chưa an toàn": no AI draft, same as the locked composer. */
export const UNSAFE_NICK_TEXT = 'Nick đang ở trạng thái Chưa an toàn: không soạn nháp AI.';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function toView(d: AiDraftDoc): AiDraftView {
  return {
    id: d._id.toHexString(),
    conversationId: d.conversationId,
    status: d.status,
    action: d.action,
    draft: d.draft,
    summary: d.summary,
    riskFlags: d.riskFlags,
    reason: d.reason,
    sources: d.sources,
    mode: d.mode,
    model: d.model,
    requestedBy: d.requestedBy,
    createdAt: d.createdAt.toISOString(),
    decidedAt: toIso(d.decidedAt),
  };
}

function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw new NotFoundException('Không tìm thấy nháp AI');
  return new ObjectId(id);
}

@Injectable()
export class SuggestService {
  private indexed = false;

  constructor(
    private readonly db: DbService,
    private readonly worker: SuggestWorker,
  ) {}

  private get col() {
    return this.db.col<AiDraftDoc>(AI_DRAFTS);
  }

  private async ensureIndexes() {
    if (this.indexed) return;
    await this.col.createIndex({ conversationId: 1, createdAt: -1 });
    await this.col.createIndex({ decidedBy: 1, status: 1 });
    this.indexed = true;
  }

  /** True when the nick of the conversation is marked "Chưa an toàn" (same rule as AuthzService.canSend). */
  private async nickUnsafe(conversationId: string): Promise<boolean> {
    const uid = conversationId.slice(0, Math.max(0, conversationId.indexOf(':')));
    const n = await runUnscoped(() =>
      this.db
        .col<{ _id: string; safety?: string; unsafe?: boolean }>(C.accounts)
        .countDocuments({ _id: uid as never, $or: [{ safety: 'chua_an_toan' }, { unsafe: true }] }, { limit: 1 }),
    );
    return n > 0;
  }

  /** "Soạn nháp" / "Soạn lại": runs the worker and keeps the result (risk / blocked results too, without text). */
  async generate(conversationId: string, actor: string): Promise<AiDraftView> {
    await this.ensureIndexes();
    // Server-side twin of the locked composer: an unsafe nick gets no draft (the AI is not called).
    if (await this.nickUnsafe(conversationId)) throw new ForbiddenException(UNSAFE_NICK_TEXT);
    const r = await this.worker.run({ conversationId, actor });
    const sep = conversationId.indexOf(':');
    const doc: AiDraftDoc = {
      _id: new ObjectId(),
      conversationId,
      uid: conversationId.slice(0, sep),
      threadId: conversationId.slice(sep + 1),
      messageId: r.messageId,
      status: r.status,
      action: r.action,
      draft: r.draft,
      summary: r.summary,
      riskFlags: r.riskFlags,
      reason: r.reason,
      guard: r.guard,
      sources: r.sources,
      mode: r.mode,
      model: r.model,
      requestedBy: actor,
      createdAt: new Date(),
    };
    await this.col.updateMany({ conversationId, status: 'pending', replaced: { $ne: true } }, { $set: { replaced: true } });
    await this.col.insertOne(doc);
    await this.db.audit(actor, 'ai_draft.generate', doc._id.toHexString(), {
      conversationId,
      status: doc.status,
      action: doc.action,
      riskFlags: doc.riskFlags,
      guard: doc.guard,
      mode: doc.mode,
      sources: doc.sources.length,
    });
    return toView(doc);
  }

  /** Latest draft of the conversation (or null). */
  async latest(conversationId: string): Promise<AiDraftView | null> {
    await this.ensureIndexes();
    if (await this.nickUnsafe(conversationId)) return null;
    const d = await this.col.find({ conversationId }).sort({ createdAt: -1, _id: -1 }).limit(1).next();
    return d ? toView(d) : null;
  }

  private async pendingDraft(conversationId: string, id: string): Promise<AiDraftDoc> {
    const d = await this.col.findOne({ _id: oid(id), conversationId });
    if (!d) throw new NotFoundException('Không tìm thấy nháp AI');
    if (d.status !== 'pending') throw new ConflictException('Nháp này đã được xử lý');
    return d;
  }

  /** "Bỏ". */
  async reject(conversationId: string, id: string, actor: string, reason?: string): Promise<AiDraftView> {
    await this.pendingDraft(conversationId, id);
    const now = new Date();
    const d = await this.col.findOneAndUpdate(
      { _id: oid(id), status: 'pending' },
      { $set: { status: 'rejected', decidedBy: actor, decidedAt: now, ...(reason ? { rejectReason: reason } : {}) } },
      { returnDocument: 'after' },
    );
    if (!d) throw new ConflictException('Nháp này đã được xử lý');
    await this.db.audit(actor, 'ai_draft.reject', id, { conversationId });
    return toView(d);
  }

  /**
   * The user used the draft and pressed "Gửi": records the pair. Only an outbox item of this conversation
   * that THIS user approved (approvedBy = actor, approvedAt set) is accepted; nothing is created or sent here.
   */
  async linkSent(conversationId: string, id: string, outboxId: string, actor: string): Promise<AiDraftView> {
    const draft = await this.pendingDraft(conversationId, id);
    if (!ObjectId.isValid(outboxId) || outboxId.length !== 24) throw new NotFoundException('Không tìm thấy lệnh gửi');
    // Read-only look at the outbox item the user created by pressing "Gửi".
    const item = await this.db
      .col<OutboxRead>(C.suggestions)
      .findOne({ _id: new ObjectId(outboxId) }, { projection: { uid: 1, threadId: 1, finalText: 1, action: 1, approvedBy: 1, approvedAt: 1 } });
    if (!item) throw new NotFoundException('Không tìm thấy lệnh gửi');
    if (item.uid !== draft.uid || item.threadId !== draft.threadId || (item.action && item.action !== 'send_text')) {
      throw new ConflictException('Lệnh gửi không thuộc hội thoại của nháp này');
    }
    if (!item.approvedBy || item.approvedBy !== actor || !(item.approvedAt instanceof Date)) {
      throw new ConflictException('Chỉ người đã bấm Gửi mới ghi nhận được nháp này');
    }
    const finalText = item.finalText ?? '';
    const status: AiDraftStatus = norm(finalText) === norm(draft.draft ?? '') ? 'approved' : 'edited';
    const now = new Date();
    const d = await this.col.findOneAndUpdate(
      { _id: draft._id, status: 'pending' },
      { $set: { status, finalText, outboxId, approvedBy: item.approvedBy, approvedAt: item.approvedAt, decidedBy: actor, decidedAt: now } },
      { returnDocument: 'after' },
    );
    if (!d) throw new ConflictException('Nháp này đã được xử lý');
    await this.db.audit(actor, 'ai_draft.sent', id, { conversationId, outboxId, edited: status === 'edited' });
    return toView(d);
  }

  /** Approval rate without edits (CLAUDE.md §8) over the drafts this user decided. */
  async metrics(actor: string): Promise<AiDraftMetrics> {
    await this.ensureIndexes();
    const rows = await this.col
      .aggregate<{ _id: AiDraftStatus; n: number }>([
        { $match: { $or: [{ decidedBy: actor }, { requestedBy: actor, status: { $in: ['risk', 'blocked'] } }] } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ])
      .toArray();
    const n = (s: AiDraftStatus) => rows.find((r) => r._id === s)?.n ?? 0;
    const approved = n('approved');
    const edited = n('edited');
    const rejected = n('rejected');
    const decided = approved + edited + rejected;
    return { approved, edited, rejected, approvedUneditedRate: decided ? approved / decided : null, risk: n('risk'), blocked: n('blocked') };
  }
}
