import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { C, DbService } from '../db/db.service';

/**
 * Change-request channel (BA → design → code). The owner talks to Claude
 * Desktop, which files requests; Claude Code sessions claim one stage at a
 * time, do the work in the repo and hand the stage back for review. Nothing
 * moves to the next stage until the owner approves it (review_request).
 *
 * Status per stage: new → in_progress → (needs_info → new) → review →
 * approve: next stage `new` (after `code`: done) | revise: same stage `new`.
 * The submitter can cancel at any time; a worker can reject with a report.
 */
export const STAGES = ['ba', 'design', 'code'] as const;
export type Stage = (typeof STAGES)[number];
export const STATUSES = ['new', 'in_progress', 'needs_info', 'review', 'done', 'rejected', 'cancelled'] as const;
export type Status = (typeof STATUSES)[number];
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

const PRIORITY_RANK: Record<Priority, number> = { low: 0, normal: 1, high: 2, urgent: 3 };
const OPEN: Status[] = ['new', 'in_progress', 'needs_info', 'review'];
const CLOSED: Status[] = ['done', 'rejected', 'cancelled'];
const STAGE_LABEL: Record<Stage, string> = { ba: 'BA', design: 'Design', code: 'Code' };
/** A claim with no update for this long goes back to the queue (the Claude Code session died). */
export const CLAIM_TTL_MS = 3 * 3600_000;
const LOG_MAX = 200;

export type LogKind = 'status' | 'note' | 'question' | 'answer' | 'report' | 'review';

export interface LogEntry {
  at: Date;
  by: string;
  via: string;
  stage: Stage;
  kind: LogKind;
  text: string;
}

/** What a worker hands over at the end of a stage. */
export interface StageReport {
  summary: string;
  /** Repo paths touched (BA docs, code). */
  files?: string[];
  /** Mockup / artifact links (design stage). */
  links?: string[];
  tests?: string;
  followups?: string[];
}

export interface DevRequestDoc {
  _id: ObjectId;
  title: string;
  description: string;
  acceptance: string[];
  priority: Priority;
  priorityRank: number;
  /** BA references, e.g. "docs/02-yeu-cau/dac-ta/03-sale-zalo-ca-nhan.md MH-SZ-05". */
  specRef: string | null;
  stages: Stage[];
  stage: Stage;
  status: Status;
  resumed: boolean;
  createdBy: string;
  createdVia: string;
  createdAt: Date;
  updatedAt: Date;
  claimedBy: string | null;
  claimedWorker: string | null;
  claimedAt: Date | null;
  branch: string | null;
  commits: string[];
  reports: Partial<Record<Stage, StageReport & { at: Date; by: string }>>;
  log: LogEntry[];
}

export interface SubmitInput {
  title: string;
  description: string;
  acceptance?: string[];
  priority?: Priority;
  specRef?: string;
  /** Stages to run, in order. Default all three; e.g. ["code"] for a pure bug fix. */
  stages?: Stage[];
}

export interface UpdateInput {
  status?: 'in_progress' | 'needs_info' | 'review' | 'rejected';
  note?: string;
  branch?: string;
  commits?: string[];
  report?: StageReport;
}

function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id) || id.length !== 24) throw new NotFoundException('Không tìm thấy yêu cầu');
  return new ObjectId(id);
}

@Injectable()
export class DevRequestsService {
  private indexed = false;

  constructor(private readonly db: DbService) {}

  private get col() {
    return this.db.col<DevRequestDoc>(C.devRequests);
  }

  private async ensureIndexes() {
    if (this.indexed) return;
    await this.col.createIndex({ status: 1, stage: 1, priorityRank: -1, createdAt: 1 });
    await this.col.createIndex({ updatedAt: -1 });
    this.indexed = true;
  }

  private entry(by: string, via: string, stage: Stage, kind: LogKind, text: string): LogEntry {
    return { at: new Date(), by, via, stage, kind, text: text.trim() };
  }

  private async load(id: string): Promise<DevRequestDoc> {
    const doc = await this.col.findOne({ _id: oid(id) });
    if (!doc) throw new NotFoundException('Không tìm thấy yêu cầu');
    return doc;
  }

  out(doc: DevRequestDoc, full = true) {
    const { _id, priorityRank: _r, log, reports, description, acceptance, ...rest } = doc;
    const base = { id: _id.toHexString(), ...rest };
    if (full) return { ...base, description, acceptance, reports, log };
    const last = log.at(-1);
    return { ...base, lastLog: last && { at: last.at, stage: last.stage, kind: last.kind, text: last.text.slice(0, 300) } };
  }

  /** Claims idle past CLAIM_TTL_MS go back to the queue; branch and log stay for the next session. */
  async releaseStale(): Promise<number> {
    const r = await this.col.updateMany(
      { status: 'in_progress', claimedAt: { $lt: new Date(Date.now() - CLAIM_TTL_MS) } },
      [
        {
          $set: {
            status: 'new',
            resumed: true,
            claimedBy: null,
            claimedWorker: null,
            log: {
              $slice: [
                {
                  $concatArrays: [
                    '$log',
                    [{ at: '$$NOW', by: 'hệ thống', via: 'server', stage: '$stage', kind: 'status', text: 'Quá 3 giờ không cập nhật — trả về hàng chờ' }],
                  ],
                },
                -LOG_MAX,
              ],
            },
          },
        },
      ],
    );
    return r.modifiedCount;
  }

  async submit(input: SubmitInput, actor: string, via: string) {
    await this.ensureIndexes();
    const title = input.title.trim();
    const description = input.description.trim();
    if (!title || !description) throw new UnprocessableEntityException('Cần title và description');
    // Keep the canonical order whatever order the caller gave.
    const stages = STAGES.filter((s) => (input.stages?.length ? input.stages.includes(s) : true));
    const priority = input.priority ?? 'normal';
    const now = new Date();
    const doc: DevRequestDoc = {
      _id: new ObjectId(),
      title: title.slice(0, 200),
      description,
      acceptance: (input.acceptance ?? []).map((a) => a.trim()).filter(Boolean),
      priority,
      priorityRank: PRIORITY_RANK[priority],
      specRef: input.specRef?.trim() || null,
      stages,
      stage: stages[0],
      status: 'new',
      resumed: false,
      createdBy: actor,
      createdVia: via,
      createdAt: now,
      updatedAt: now,
      claimedBy: null,
      claimedWorker: null,
      claimedAt: null,
      branch: null,
      commits: [],
      reports: {},
      log: [this.entry(actor, via, stages[0], 'status', `Tạo yêu cầu — chặng: ${stages.map((s) => STAGE_LABEL[s]).join(' → ')}`)],
    };
    await this.col.insertOne(doc);
    await this.db.audit(actor, 'devreq.submit', doc._id.toHexString(), { stages, priority });
    return this.out(doc);
  }

  /** `status`: comma list; "open" = new,in_progress,needs_info,review; "" = all. */
  async list(opts: { status?: string; stage?: Stage; limit?: number }) {
    await this.ensureIndexes();
    await this.releaseStale();
    const wanted = this.statuses(opts.status ?? 'open');
    const f: Record<string, unknown> = {};
    if (wanted.length) f.status = { $in: wanted };
    if (opts.stage) f.stage = opts.stage;
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const rows = await this.col.find(f).sort({ updatedAt: -1 }).limit(limit).toArray();
    return { total: await this.col.countDocuments(f), items: rows.map((r) => this.out(r, false)) };
  }

  private statuses(status: string): Status[] {
    const wanted = status.split(',').map((s) => s.trim()).filter(Boolean);
    const wrong = wanted.filter((s) => s !== 'open' && !STATUSES.includes(s as Status));
    if (wrong.length) {
      throw new UnprocessableEntityException(`Trạng thái không hợp lệ: ${wrong.join(', ')} — chọn trong open, ${STATUSES.join(', ')}`);
    }
    return [...new Set(wanted.flatMap((w) => (w === 'open' ? OPEN : [w as Status])))];
  }

  async get(id: string) {
    return this.out(await this.load(id));
  }

  /**
   * Claims ONE request at the given stage (any stage when omitted). A worker
   * that still holds an unfinished request gets that one back. Order: resumed
   * work first, then priority, then oldest.
   */
  async claim(actor: string, via: string, worker: string, stage?: Stage) {
    await this.ensureIndexes();
    await this.releaseStale();
    const now = new Date();
    const held = await this.col.findOneAndUpdate(
      { status: 'in_progress', claimedBy: actor, claimedWorker: worker },
      { $set: { claimedAt: now } },
      { returnDocument: 'after' },
    );
    if (held) {
      return { request: this.out(held), note: 'Bạn đang giữ yêu cầu này — chuyển sang review (hoặc needs_info) rồi mới nhận tiếp.' };
    }
    const f: Record<string, unknown> = { status: 'new' };
    if (stage) f.stage = stage;
    const doc = await this.col.findOneAndUpdate(
      f,
      [
        {
          $set: {
            status: 'in_progress',
            claimedBy: actor,
            claimedWorker: worker,
            claimedAt: now,
            updatedAt: now,
            log: { $concatArrays: ['$log', [{ at: now, by: actor, via, stage: '$stage', kind: 'status', text: `Nhận việc (${worker})` }]] },
          },
        },
      ],
      { sort: { resumed: -1, priorityRank: -1, createdAt: 1 }, returnDocument: 'after' },
    );
    return { request: doc && this.out(doc), queueLeft: await this.col.countDocuments(f) };
  }

  /** The holder records progress, asks a question, hands the stage in for review, or rejects. */
  async update(id: string, input: UpdateInput, actor: string, via: string) {
    const doc = await this.load(id);
    if (doc.status !== 'in_progress' || doc.claimedBy !== actor) {
      throw new ConflictException(`Yêu cầu đang ở trạng thái ${doc.status} và không do bạn giữ — nhận bằng claim_request trước`);
    }
    const note = input.note?.trim() ?? '';
    if (input.status === 'needs_info' && !note) throw new UnprocessableEntityException('needs_info cần note là câu hỏi cho chủ dự án');
    if ((input.status === 'review' || input.status === 'rejected') && !input.report?.summary?.trim()) {
      throw new UnprocessableEntityException('Chuyển review / rejected cần report có summary');
    }
    const now = new Date();
    const set: Record<string, unknown> = { updatedAt: now, claimedAt: now };
    const push: LogEntry[] = [];
    if (note) push.push(this.entry(actor, via, doc.stage, input.status === 'needs_info' ? 'question' : 'note', note));
    if (input.branch?.trim()) set.branch = input.branch.trim();
    if (input.report) {
      set[`reports.${doc.stage}`] = { ...input.report, at: now, by: actor };
      push.push(this.entry(actor, via, doc.stage, 'report', input.report.summary));
    }
    if (input.status && input.status !== 'in_progress') {
      set.status = input.status;
      set.claimedBy = null;
      set.claimedWorker = null;
      const label = { needs_info: 'Cần chủ dự án trả lời', review: `Xong chặng ${STAGE_LABEL[doc.stage]} — chờ duyệt`, rejected: 'Từ chối' }[input.status];
      push.push(this.entry(actor, via, doc.stage, 'status', label));
    }
    const ops: Record<string, unknown> = { $set: set };
    if (push.length) ops.$push = { log: { $each: push, $slice: -LOG_MAX } };
    const commits = (input.commits ?? []).map((c) => c.trim()).filter(Boolean);
    if (commits.length) ops.$addToSet = { commits: { $each: commits } };
    await this.col.updateOne({ _id: doc._id }, ops);
    await this.db.audit(actor, 'devreq.update', id, { stage: doc.stage, status: input.status ?? 'in_progress' });
    return this.out(await this.load(id), false);
  }

  /**
   * The owner's decision on a stage in review: approve moves on to the next
   * stage (or closes the request after the last one), revise sends the same
   * stage back to the queue with the owner's notes.
   */
  async review(id: string, decision: 'approve' | 'revise', note: string, actor: string, via: string) {
    const doc = await this.load(id);
    if (doc.status !== 'review') throw new ConflictException(`Yêu cầu đang ở trạng thái ${doc.status}, không chờ duyệt`);
    if (decision === 'revise' && !note.trim()) throw new UnprocessableEntityException('revise cần note: sửa gì');
    const push: LogEntry[] = [];
    if (note.trim()) push.push(this.entry(actor, via, doc.stage, 'review', note));
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (decision === 'revise') {
      Object.assign(set, { status: 'new', resumed: true });
      push.push(this.entry(actor, via, doc.stage, 'status', `Chặng ${STAGE_LABEL[doc.stage]} cần sửa — về hàng chờ`));
    } else {
      const next = doc.stages[doc.stages.indexOf(doc.stage) + 1];
      if (next) {
        Object.assign(set, { status: 'new', stage: next, resumed: false });
        push.push(this.entry(actor, via, doc.stage, 'status', `Duyệt ${STAGE_LABEL[doc.stage]} — chuyển sang ${STAGE_LABEL[next]}`));
      } else {
        set.status = 'done';
        push.push(this.entry(actor, via, doc.stage, 'status', `Duyệt ${STAGE_LABEL[doc.stage]} — hoàn thành`));
      }
    }
    await this.col.updateOne({ _id: doc._id }, { $set: set, $push: { log: { $each: push, $slice: -LOG_MAX } } });
    await this.db.audit(actor, 'devreq.review', id, { stage: doc.stage, decision });
    return this.out(await this.load(id), false);
  }

  /** The owner answers a question (needs_info → back to the queue, served first), adds a note, reopens or cancels. */
  async reply(id: string, text: string, cancel: boolean, actor: string, via: string) {
    const doc = await this.load(id);
    if (!text.trim() && !cancel) throw new UnprocessableEntityException('Cần text');
    const set: Record<string, unknown> = { updatedAt: new Date() };
    const push: LogEntry[] = text.trim() ? [this.entry(actor, via, doc.stage, 'answer', text)] : [];
    if (cancel) {
      if (CLOSED.includes(doc.status)) throw new ConflictException(`Yêu cầu đã ${doc.status}`);
      Object.assign(set, { status: 'cancelled', claimedBy: null, claimedWorker: null });
      push.push(this.entry(actor, via, doc.stage, 'status', 'Chủ dự án huỷ'));
    } else if (doc.status === 'needs_info' || CLOSED.includes(doc.status)) {
      Object.assign(set, { status: 'new', resumed: true });
      push.push(this.entry(actor, via, doc.stage, 'status', doc.status === 'needs_info' ? 'Đã trả lời — về hàng chờ' : 'Mở lại'));
    }
    await this.col.updateOne({ _id: doc._id }, { $set: set, $push: { log: { $each: push, $slice: -LOG_MAX } } });
    await this.db.audit(actor, cancel ? 'devreq.cancel' : 'devreq.reply', id, { stage: doc.stage });
    return this.out(await this.load(id), false);
  }
}
