import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  ATTACHMENT_MAX_BYTES,
  DOWNLOAD_LINK_TTL_SEC,
  UPLOAD_URL_TTL_SEC,
  confirmUploadSchema,
  createUploadUrlSchema,
  type AttachmentKind,
  type AttachmentStatus,
  type AttachmentView,
  type DownloadLink,
  type TranscriptStatus,
  type UploadUrlResult,
} from '@vclinks/shared';
import { AccountsService } from '../accounts/accounts.service';
import { parseOr400 } from '../common/zod';
import { C, DbService } from '../db/db.service';
import { TENANT_FIELD } from '../db/tenant-collection';
import { currentTenant, runAsTenant } from '../db/tenant-context';
import { MediaStore } from '../media/media-store';
import { CustomerKeysService } from '../security/customer-keys.service';
import { messageSubject } from '../security/message-vault';
import { AsrService } from './asr.service';
import { signLink, verifyLink } from './signing';
import { AttachmentFetchError, UrlFetcher } from './url-fetcher';
import { effectiveMime } from './mime';

export interface AttachmentDoc {
  _id: string;
  uid: string;
  threadId: string;
  messageId: string;
  /** Customer the file is about (erasure key, same rule as the message vault). */
  subject: string;
  kind: AttachmentKind;
  status: AttachmentStatus;
  /** Expiring source link; dropped once the bytes are in the store. */
  sourceUrl?: string;
  fileName?: string;
  mime?: string;
  size?: number;
  durationSec?: number;
  /** Id of the bytes in the store (sha256). */
  mediaId?: string;
  checksum?: string;
  attempts: number;
  leaseUntil?: Date;
  error?: string;
  createdAt: Date;
  storedAt?: Date;
  [TENANT_FIELD]?: string;
}

interface Candidate {
  key: string;
  kind: AttachmentKind;
  url?: string;
  mediaId?: string;
  fileName?: string;
  mime?: string;
  size?: number;
  durationSec?: number;
}

const FETCH_ATTEMPTS = 3;
const FETCH_LEASE_MS = 2 * 60_000;
const DEFAULT_MIME: Record<AttachmentKind, string> = {
  image: 'image/jpeg',
  file: 'application/octet-stream',
  audio: 'audio/mp4',
  video: 'video/mp4',
};
/** What a message's captured content offers to keep (Zalo links expire; the company store does not). */
export function candidatesOf(content: unknown): Candidate[] {
  if (!content || typeof content !== 'object') return [];
  const c = content as Record<string, unknown>;
  const out: Candidate[] = [];
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  (Array.isArray(c.mediaImages) ? c.mediaImages : []).forEach((id, i) => {
    if (typeof id === 'string') out.push({ key: `image:m${i}`, kind: 'image', mediaId: id });
  });
  (Array.isArray(c.images) ? c.images : []).forEach((u, i) => {
    if (str(u)) out.push({ key: `image:${i}`, kind: 'image', url: u as string });
  });
  (Array.isArray(c.files) ? c.files : []).forEach((f, i) => {
    const o = (f ?? {}) as Record<string, unknown>;
    if (str(o.url)) out.push({ key: `file:${i}`, kind: 'file', url: o.url as string, fileName: str(o.name), size: num(o.size) });
  });
  const voice = c.voice as Record<string, unknown> | undefined;
  if (voice && str(voice.url)) out.push({ key: 'audio:0', kind: 'audio', url: voice.url as string, durationSec: num(voice.durationSec) });
  const video = c.video as Record<string, unknown> | undefined;
  if (video && str(video.url)) out.push({ key: 'video:0', kind: 'video', url: video.url as string, durationSec: num(video.durationSec) });
  return out;
}

/**
 * Company file store of message attachments (M1c-04). Bytes live in the byte store (`MediaStore`, GridFS);
 * `attachments` rows say what they are and where they came from. Personal data (CLAUDE.md §12): files
 * are served only through routes that check the data scope of the message (scoped collection), links are
 * signed and short-lived, nothing is logged but ids and codes.
 */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly db: DbService,
    private readonly store: MediaStore,
    private readonly fetcher: UrlFetcher,
    private readonly asr: AsrService,
    private readonly accounts: AccountsService,
    @Optional() private readonly keys?: CustomerKeysService,
  ) {}

  onModuleInit() {
    // Retry sweep for links that failed on the network; off in tests (ATTACHMENT_SWEEP_MS=0).
    const every = Number(process.env.ATTACHMENT_SWEEP_MS ?? (process.env.NODE_ENV === 'test' ? 0 : 60_000));
    if (every > 0) {
      this.sweeper = setInterval(() => void this.sweepAll().catch(() => undefined), every);
      this.sweeper.unref();
    }
  }

  onModuleDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  private get rows() {
    return this.db.col<AttachmentDoc>(C.attachments);
  }

  /**
   * Ingest hook (plaintext content, before sealing): registers the files of the matching messages and
   * starts downloading them in the background. Idempotent per message + file; never throws into ingest.
   */
  async noteMessages(uid: string, filter: Record<string, unknown>): Promise<number> {
    if (process.env.ATTACHMENTS === 'off') return 0;
    try {
      const msgs = await this.db
        .col<{ _id: string; threadId: string; fromUid?: string; content?: unknown; erased?: boolean }>(C.messages)
        .find(
          { ...filter, uid, erased: { $ne: true }, content: { $exists: true } },
          { projection: { threadId: 1, fromUid: 1, content: 1 } },
        )
        .toArray();
      const withFiles = msgs.map((m) => ({ m, cands: candidatesOf(m.content) })).filter((x) => x.cands.length);
      if (!withFiles.length) return 0;
      const subjects = new Map(withFiles.map(({ m }) => [m._id, messageSubject(uid, m)]));
      const erased = (await this.keys?.erasedAmong([...subjects.values()])) ?? new Set<string>();
      let added = 0;
      for (const { m, cands } of withFiles) {
        const subject = subjects.get(m._id)!;
        if (erased.has(subject)) continue;
        for (const c of cands) {
          const id = `${m._id}#${c.key}`;
          const stored = !!c.mediaId;
          const info = c.mediaId ? await this.store.stat(c.mediaId) : null;
          const r = await this.rows.updateOne(
            { _id: id },
            {
              $setOnInsert: {
                uid,
                threadId: m.threadId,
                messageId: m._id,
                subject,
                kind: c.kind,
                status: stored && info ? 'stored' : stored ? 'failed' : 'pending',
                ...(c.url ? { sourceUrl: c.url } : {}),
                ...(c.fileName ? { fileName: c.fileName } : {}),
                ...(c.size ? { size: c.size } : {}),
                ...(c.durationSec ? { durationSec: c.durationSec } : {}),
                ...(c.mediaId && info ? { mediaId: c.mediaId, checksum: c.mediaId, mime: info.metadata?.mime ?? DEFAULT_MIME.image, size: info.length, storedAt: new Date() } : {}),
                attempts: 0,
                createdAt: new Date(),
              },
            },
            { upsert: true },
          );
          if (r.upsertedCount) added++;
        }
      }
      if (added) void this.processPending().catch(() => undefined);
      return added;
    } catch (e) {
      this.logger.warn(`noteMessages failed: ${(e as Error).message}`);
      return 0;
    }
  }

  /** Downloads pending files of the current tenant, a few at a time. */
  async processPending(limit = 10): Promise<number> {
    let done = 0;
    for (let i = 0; i < limit; i++) {
      const now = new Date();
      const doc = await this.rows.findOneAndUpdate(
        { status: 'pending', attempts: { $lt: FETCH_ATTEMPTS }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }] },
        { $set: { leaseUntil: new Date(now.getTime() + FETCH_LEASE_MS) }, $inc: { attempts: 1 } },
        { returnDocument: 'after' },
      );
      if (!doc) break;
      await this.fetchOne(doc);
      done++;
    }
    return done;
  }

  /** Background sweep over every tenant. */
  async sweepAll(): Promise<void> {
    const tenants = await this.db
      .unscoped(C.attachments)
      .distinct(TENANT_FIELD, { status: 'pending', attempts: { $lt: FETCH_ATTEMPTS } });
    for (const t of tenants as string[]) await runAsTenant(t, () => this.processPending());
  }

  private async fetchOne(doc: AttachmentDoc): Promise<void> {
    const max = ATTACHMENT_MAX_BYTES[doc.kind];
    try {
      if (!doc.sourceUrl) throw new AttachmentFetchError('expired');
      const { buf, mime } = await this.fetcher.fetchBytes(doc.sourceUrl, max);
      if (!buf.length) throw new AttachmentFetchError('expired');
      await this.finishStored(doc, buf, mime ?? doc.mime ?? DEFAULT_MIME[doc.kind]);
    } catch (e) {
      const reason = e instanceof AttachmentFetchError ? e.reason : 'network';
      // Final: link gone or refused. Network trouble retries until FETCH_ATTEMPTS.
      const final = reason !== 'network' || doc.attempts >= FETCH_ATTEMPTS;
      await this.rows.updateOne(
        { _id: doc._id },
        {
          $set: { error: reason, ...(final ? { status: reason === 'expired' ? 'expired' : 'failed' } : {}) },
          ...(final ? { $unset: { sourceUrl: '' } } : {}),
        },
      );
      this.logger.warn(`attachment ${doc._id} not stored: ${reason}`);
    }
  }

  /** Puts bytes in the store, marks the row stored and starts voice-to-text for audio. */
  private async finishStored(doc: AttachmentDoc, buf: Buffer, fetchedMime: string): Promise<void> {
    // A photo or video sent as a file often comes back as application/octet-stream: keep the type of its name.
    const mime = effectiveMime(fetchedMime, doc.fileName) ?? fetchedMime;
    const mediaId = await this.store.put(buf, { mime, uid: doc.uid, ...(doc.fileName ? { fileName: doc.fileName } : {}), source: 'attachment' });
    await this.rows.updateOne(
      { _id: doc._id },
      { $set: { status: 'stored', mediaId, checksum: mediaId, mime, size: buf.length, storedAt: new Date() }, $unset: { sourceUrl: '', error: '', leaseUntil: '' } },
    );
    if (doc.kind === 'audio') await this.asr.enqueue({ ...doc, mediaId, mime });
  }

  // ---- create_upload_url / confirm_upload (CLAUDE.md §4.3): bytes never go through MCP ----

  async createUploadUrl(body: unknown): Promise<UploadUrlResult> {
    const u = parseOr400(createUploadUrlSchema, body);
    await this.accounts.assertExists(u.uid);
    const msg = await this.db
      .col<{ _id: string; threadId: string; fromUid?: string }>(C.messages)
      .findOne({ _id: u.messageId, uid: u.uid }, { projection: { threadId: 1, fromUid: 1 } });
    if (!msg) throw new NotFoundException('Không tìm thấy tin nhắn');
    const kind = kindOfMime(u.mime);
    if (u.size > ATTACHMENT_MAX_BYTES[kind]) throw new BadRequestException(`Tệp quá ${Math.round(ATTACHMENT_MAX_BYTES[kind] / 1024 / 1024)} MB`);
    const subject = messageSubject(u.uid, msg);
    if ((await this.keys?.erasedAmong([subject]))?.has(subject)) throw new BadRequestException('Khách đã được ẩn danh');
    const id = `up_${randomUUID()}`;
    const exp = Math.floor(Date.now() / 1000) + UPLOAD_URL_TTL_SEC;
    await this.rows.insertOne({
      _id: id,
      uid: u.uid,
      threadId: msg.threadId,
      messageId: u.messageId,
      subject,
      kind,
      status: 'awaiting_upload',
      fileName: u.fileName,
      mime: u.mime.toLowerCase(),
      size: u.size,
      attempts: 0,
      createdAt: new Date(),
    });
    return { uploadId: id, url: `/api/attachments/upload/${signLink({ k: 'put', id, tenant: currentTenant(), exp })}`, expiresAt: new Date(exp * 1000).toISOString() };
  }

  /** PUT of the raw bytes to the signed URL (no token: the signature is the credential). */
  async receiveUpload(token: string, req: Readable): Promise<{ ok: true; size: number }> {
    const p = verifyLink(token, 'put');
    return runAsTenant(p.tenant, async () => {
      const doc = await this.rows.findOne({ _id: p.id, status: 'awaiting_upload' });
      if (!doc) throw new NotFoundException('Không tìm thấy lượt tải lên');
      const max = Math.min(doc.size ?? 0, ATTACHMENT_MAX_BYTES[doc.kind]);
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const c of req) {
        total += (c as Buffer).length;
        // The declared size is a hard cap: more bytes than announced are refused.
        if (total > max) throw new BadRequestException('Tệp lớn hơn kích thước đã khai báo');
        chunks.push(c as Buffer);
      }
      const buf = Buffer.concat(chunks);
      if (!buf.length) throw new BadRequestException('Tệp rỗng');
      const mediaId = await this.store.put(buf, { mime: doc.mime ?? DEFAULT_MIME[doc.kind], uid: doc.uid, ...(doc.fileName ? { fileName: doc.fileName } : {}), source: 'attachment' });
      await this.rows.updateOne({ _id: doc._id }, { $set: { status: 'uploaded', mediaId, size: buf.length } });
      return { ok: true as const, size: buf.length };
    });
  }

  async confirmUpload(
    body: unknown,
    assertUid?: (uid: string) => void,
  ): Promise<{ id: string; status: AttachmentStatus; transcript?: TranscriptStatus }> {
    const u = parseOr400(confirmUploadSchema, body);
    const doc = await this.rows.findOne({ _id: u.uploadId });
    if (doc) assertUid?.(doc.uid);
    if (!doc || (doc.status !== 'uploaded' && doc.status !== 'stored')) throw new NotFoundException('Chưa nhận được tệp của lượt tải lên này');
    if (doc.mediaId !== u.checksum) {
      await this.rows.updateOne({ _id: doc._id }, { $set: { status: 'failed', error: 'checksum' } });
      throw new BadRequestException('Mã kiểm tra (checksum) không khớp với tệp đã nhận');
    }
    if (doc.status === 'uploaded') {
      await this.rows.updateOne({ _id: doc._id }, { $set: { status: 'stored', checksum: u.checksum, storedAt: new Date() } });
      if (doc.kind === 'audio') await this.asr.enqueue(doc);
    }
    return { id: doc._id, status: 'stored', ...(doc.kind === 'audio' ? { transcript: 'queued' as const } : {}) };
  }

  // ---- reading (scope enforced by the scoped collection: an out-of-scope id is simply not found) ----

  private async stored(id: string): Promise<AttachmentDoc> {
    const doc = await this.rows.findOne({ _id: id });
    if (!doc || doc.status !== 'stored' || !doc.mediaId) throw new NotFoundException('Không tìm thấy tệp');
    if ((await this.keys?.erasedAmong([doc.subject]))?.has(doc.subject)) throw new NotFoundException('Không tìm thấy tệp');
    return doc;
  }

  async open(id: string, range?: { start: number; end: number }) {
    const doc = await this.stored(id);
    const info = await this.store.stat(doc.mediaId!);
    if (!info) throw new NotFoundException('Không tìm thấy tệp');
    return this.openDoc(doc, info.length, range);
  }

  private openDoc(doc: AttachmentDoc, length: number, range?: { start: number; end: number }) {
    return {
      stream: this.store.stream(doc.mediaId!, range),
      mime: effectiveMime(doc.mime, doc.fileName) ?? DEFAULT_MIME[doc.kind],
      length,
      fileName: doc.fileName ?? doc._id.replace(/[^\w.-]+/g, '_'),
    };
  }

  /** Short-lived link for `<audio>` / `<video>` / downloads; the caller already passed the scope check. */
  async link(id: string): Promise<DownloadLink> {
    const doc = await this.stored(id);
    const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_LINK_TTL_SEC;
    return { url: `/api/attachments/dl/${signLink({ k: 'get', id: doc._id, tenant: currentTenant(), exp })}`, expiresAt: new Date(exp * 1000).toISOString() };
  }

  /** Download through a signed link (no token). */
  async openByLink(token: string, range?: { start: number; end: number }) {
    const p = verifyLink(token, 'get');
    return runAsTenant(p.tenant, () => this.open(p.id, range));
  }

  /** Retry of a failed voice-to-text from the Dashboard. */
  async retryTranscript(id: string): Promise<AttachmentView> {
    const doc = await this.stored(id);
    if (doc.kind !== 'audio') throw new BadRequestException('Chỉ ghi âm mới chuyển thành chữ');
    await this.asr.requeue(doc);
    return (await this.viewsFor([doc.messageId])).get(doc.messageId)!.find((a) => a.id === id)!;
  }

  /** Attachment states of messages, for the chat view (no bytes, no links). */
  async viewsFor(messageIds: string[]): Promise<Map<string, AttachmentView[]>> {
    const out = new Map<string, AttachmentView[]>();
    if (!messageIds.length) return out;
    const docs = await this.rows.find({ messageId: { $in: messageIds } }).sort({ _id: 1 }).toArray();
    const audio = docs.filter((d) => d.kind === 'audio').map((d) => d._id);
    const tr = await this.asr.stateOf(audio);
    for (const d of docs) {
      const v: AttachmentView = {
        id: d._id,
        kind: d.kind,
        status: d.status,
        ...(d.fileName ? { fileName: d.fileName } : {}),
        ...(effectiveMime(d.mime, d.fileName) ? { mime: effectiveMime(d.mime, d.fileName)! } : {}),
        ...(d.size ? { size: d.size } : {}),
        ...(d.kind === 'audio' && d.status === 'stored' ? { transcript: tr.get(d._id) ?? { status: 'queued' as const } } : {}),
      };
      const list = out.get(d.messageId) ?? [];
      list.push(v);
      out.set(d.messageId, list);
    }
    return out;
  }

  // ---- erasure by customer (M1b-14): files and transcripts are deleted with the keys ----

  async purgeSubjects(subjects: string[]): Promise<{ files: number; transcripts: number }> {
    if (!subjects.length) return { files: 0, transcripts: 0 };
    const docs = await this.rows.find({ subject: { $in: subjects } }, { projection: { mediaId: 1 } }).toArray();
    if (!docs.length) return { files: 0, transcripts: 0 };
    const ids = docs.map((d) => d._id);
    const t = await this.asr.purge(ids);
    await this.rows.deleteMany({ _id: { $in: ids } });
    let files = 0;
    for (const mediaId of new Set(docs.map((d) => d.mediaId).filter((x): x is string => !!x))) {
      // Same bytes may belong to another customer's attachment (content-addressed): keep them then.
      if (await this.db.unscoped(C.attachments).countDocuments({ mediaId }, { limit: 1 })) continue;
      if (await this.store.remove(mediaId)) files++;
    }
    return { files, transcripts: t };
  }
}

/** Kind from the declared mime (voice notes and videos have their own handling). */
export function kindOfMime(mime: string): AttachmentKind {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  return 'file';
}
