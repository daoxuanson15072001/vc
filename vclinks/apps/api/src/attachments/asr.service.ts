import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import {
  VOICE_TEXT_PREFIX,
  asrFailSchema,
  asrResultSchema,
  type AsrJobView,
  type AsrMode,
  type TranscriptStatus,
  type TranscriptView,
} from '@vclinks/shared';
import { parseOr400 } from '../common/zod';
import { C, DbService } from '../db/db.service';
import { TENANT_FIELD } from '../db/tenant-collection';
import { MediaStore } from '../media/media-store';
import { SearchService } from '../search/search.service';
import { MessageVault } from '../security/message-vault';

/** Voice-to-text job; `_id` = attachment id (one job per voice note). */
interface JobDoc {
  _id: string;
  uid: string;
  messageId: string;
  status: TranscriptStatus;
  attempts: number;
  leaseUntil?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  [TENANT_FIELD]?: string;
}

interface TranscriptDoc {
  _id: string;
  uid: string;
  messageId: string;
  /** Customer data: never logged. */
  text: string;
  lang: string;
  model: string;
  durationSec?: number;
  mode: AsrMode;
  createdAt: Date;
}

const MAX_ATTEMPTS = 3;
const LEASE_MS = 10 * 60_000;
export const MOCK_TRANSCRIPT = 'Bản chữ mô phỏng (ASR_MODE=mock), không phải lời của người nói.';

/**
 * Voice-to-text queue (M1c-04). No BullMQ in the repo yet, so the queue is the `asr_jobs` collection with
 * a claim/lease, like the other in-API jobs; the Python worker (workers/asr) polls the token routes below.
 * ASR_MODE=live (default): jobs wait for the worker. ASR_MODE=mock: the API completes a job itself with a fixed text
 * (tests and demos, no model needed).
 */
@Injectable()
export class AsrService {
  private readonly logger = new Logger(AsrService.name);

  constructor(
    private readonly db: DbService,
    private readonly store: MediaStore,
    @Optional() private readonly vault?: MessageVault,
    // M1c-05: search keys of a message whose text became "[Ghi âm] …".
    @Optional() private readonly search?: SearchService,
  ) {}

  get mode(): AsrMode {
    return process.env.ASR_MODE === 'mock' ? 'mock' : 'live';
  }

  private get jobs() {
    return this.db.col<JobDoc>(C.asrJobs);
  }

  /** Queues a job for a stored voice note (idempotent: a finished or running job is left alone). */
  async enqueue(att: { _id: string; uid: string; messageId: string; mediaId?: string; mime?: string }): Promise<void> {
    const now = new Date();
    await this.jobs.updateOne(
      { _id: att._id },
      { $setOnInsert: { uid: att.uid, messageId: att.messageId, status: 'queued', attempts: 0, createdAt: now, updatedAt: now } },
      { upsert: true },
    );
    if (this.mode === 'mock') await this.runMock(att._id);
  }

  /** Back to the queue after a failure (Dashboard "Thử lại"). */
  async requeue(att: { _id: string; uid: string; messageId: string }): Promise<void> {
    await this.jobs.updateOne({ _id: att._id, status: 'failed' }, { $set: { status: 'queued', attempts: 0, updatedAt: new Date() }, $unset: { error: '', leaseUntil: '' } });
    await this.enqueue(att);
  }

  private async runMock(id: string): Promise<void> {
    const job = await this.claimById(id);
    if (job) await this.complete(id, { text: MOCK_TRANSCRIPT, lang: 'vi', model: 'mock' });
  }

  private async claimById(id: string): Promise<JobDoc | null> {
    const now = new Date();
    return this.jobs.findOneAndUpdate(
      { _id: id, $or: [{ status: 'queued' }, { status: 'running', leaseUntil: { $lt: now } }], attempts: { $lt: MAX_ATTEMPTS } },
      { $set: { status: 'running', leaseUntil: new Date(now.getTime() + LEASE_MS), updatedAt: now }, $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    );
  }

  /**
   * M1c-05 reindex: search keys are stored per message and the 60 s sweep only picks messages WITHOUT a key,
   * so a text changed on an existing message is re-indexed here (before sealing, like ingest).
   */
  protected async afterMessageTextChanged(uid: string, filter: Record<string, unknown>): Promise<void> {
    await this.search?.reindex(uid, filter).catch(() => undefined);
  }

  // ---- worker side (token routes) ----

  /** Next job for the worker, or null. A token bound to nicks only gets jobs of those nicks. */
  async claim(uids?: string[]): Promise<AsrJobView | null> {
    const now = new Date();
    const job = await this.jobs.findOneAndUpdate(
      { ...(uids?.length ? { uid: { $in: uids } } : {}), $or: [{ status: 'queued' }, { status: 'running', leaseUntil: { $lt: now } }], attempts: { $lt: MAX_ATTEMPTS } },
      { $set: { status: 'running', leaseUntil: new Date(now.getTime() + LEASE_MS), updatedAt: now }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, returnDocument: 'after' },
    );
    if (!job) return null;
    const att = await this.db.col<{ _id: string; mediaId?: string; mime?: string; size?: number }>(C.attachments).findOne({ _id: job._id });
    if (!att?.mediaId) {
      await this.fail(job._id, { error: 'no_file' });
      return this.claim(uids);
    }
    return { jobId: job._id, attachmentId: job._id, mime: att.mime ?? 'audio/mp4', size: att.size ?? 0, audioPath: `/api/asr/jobs/${encodeURIComponent(job._id)}/audio` };
  }

  /** Audio bytes of a running job (worker token). */
  async audio(jobId: string) {
    const job = await this.jobs.findOne({ _id: jobId, status: 'running' });
    if (!job) throw new NotFoundException('Không có việc chuyển chữ đang chạy');
    const att = await this.db.col<{ _id: string; mediaId?: string; mime?: string }>(C.attachments).findOne({ _id: jobId });
    const info = att?.mediaId ? await this.store.stat(att.mediaId) : null;
    if (!att?.mediaId || !info) throw new NotFoundException('Không tìm thấy tệp ghi âm');
    return { stream: this.store.stream(att.mediaId), mime: att.mime ?? 'audio/mp4', length: info.length };
  }

  async complete(jobId: string, body: unknown): Promise<{ ok: true }> {
    const r = parseOr400(asrResultSchema, body);
    const job = await this.jobs.findOne({ _id: jobId, status: 'running' });
    if (!job) throw new NotFoundException('Không có việc chuyển chữ đang chạy');
    const text = r.text.trim();
    await this.db.col<TranscriptDoc>(C.transcripts).updateOne(
      { _id: jobId },
      { $set: { uid: job.uid, messageId: job.messageId, text, lang: r.lang, model: r.model, ...(r.durationSec != null ? { durationSec: r.durationSec } : {}), mode: r.model === 'mock' ? 'mock' : 'live' }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    await this.jobs.updateOne({ _id: jobId }, { $set: { status: 'done', updatedAt: new Date() }, $unset: { error: '', leaseUntil: '' } });
    if (text) {
      // messages.text = "[Ghi âm] " + text (CLAUDE.md §5); skipped for erased customers, re-sealed when encryption is on.
      const res = await this.db.col(C.messages).updateOne({ _id: job.messageId as never, erased: { $ne: true } }, { $set: { text: VOICE_TEXT_PREFIX + text } });
      if (res.matchedCount) {
        await this.afterMessageTextChanged(job.uid, { _id: job.messageId });
        await this.vault?.sealMessages(job.uid, { _id: job.messageId } as never);
      }
    }
    this.logger.log(`transcript ${jobId} done (${text.length} chars)`);
    return { ok: true };
  }

  async fail(jobId: string, body: unknown): Promise<{ ok: true }> {
    const { error } = parseOr400(asrFailSchema, body);
    const job = await this.jobs.findOne({ _id: jobId });
    if (!job) throw new NotFoundException('Không tìm thấy việc chuyển chữ');
    if (job.status === 'done') throw new BadRequestException('Việc này đã xong');
    const final = job.attempts >= MAX_ATTEMPTS;
    await this.jobs.updateOne(
      { _id: jobId },
      { $set: { status: final ? 'failed' : 'queued', error: error.slice(0, 120), updatedAt: new Date() }, $unset: { leaseUntil: '' } },
    );
    return { ok: true };
  }

  // ---- views ----

  async stateOf(attachmentIds: string[]): Promise<Map<string, TranscriptView>> {
    const out = new Map<string, TranscriptView>();
    if (!attachmentIds.length) return out;
    const [jobs, texts] = await Promise.all([
      this.jobs.find({ _id: { $in: attachmentIds } }, { projection: { status: 1 } }).toArray(),
      this.db.col<TranscriptDoc>(C.transcripts).find({ _id: { $in: attachmentIds } }, { projection: { text: 1, model: 1 } }).toArray(),
    ]);
    const tx = new Map(texts.map((t) => [t._id, t]));
    for (const j of jobs) {
      const t = tx.get(j._id);
      out.set(j._id, j.status === 'done' && t ? { status: 'done', text: t.text, model: t.model } : { status: j.status });
    }
    return out;
  }

  /** Deletes jobs and transcripts of attachments (erasure); returns transcripts removed. */
  async purge(attachmentIds: string[]): Promise<number> {
    await this.jobs.deleteMany({ _id: { $in: attachmentIds } });
    return (await this.db.col(C.transcripts).deleteMany({ _id: { $in: attachmentIds } as never })).deletedCount;
  }
}
