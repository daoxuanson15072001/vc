import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Readable } from 'node:stream';
import {
  MESSAGE_MEDIA_MAX_BYTES,
  OUTBOX_LIMITS,
  messageMediaUploadSchema,
  outboxAttachmentUploadSchema,
  type MessageMediaResult,
  type OutboxAttachment,
} from '@vclinks/shared';
import { AttachmentsService } from '../attachments/attachments.service';
import { AccountsService } from '../accounts/accounts.service';
import { IngestService } from '../ingest/ingest.service';
import { parseOr400 } from '../common/zod';
import { C, DbService } from '../db/db.service';
import { MEDIA_BUCKET, MEDIA_ID, MediaStore, type MediaFileMeta } from './media-store';

export { MEDIA_BUCKET };

/** Server times of one album's messages fall within this window around the first. */
const ALBUM_WINDOW_MS = 60_000;
/** cliMsgIds (client ms clock) of one album's messages are this close. */
const ALBUM_CLI_GAP = 1_000;

interface AlbumHead {
  _id: string;
  uid: string;
  cliMsgId: string;
  threadId: string;
  fromUid: string;
  msgType: string;
  sentAt: Date;
}

/** Magic bytes per accepted mime: the declared type must match the content. */
function sniff(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.toString('ascii', 0, 6))) return 'image/gif';
  return null;
}

/**
 * Message photos uploaded as bytes by the extension (Zalo Web shows photos of
 * encrypted chats as `blob:` URLs only). Stored once per sha256 in GridFS and
 * referenced from `messages.content.mediaImages`. MinIO replaces GridFS in
 * phase 2; the media id (sha256) stays the same.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly db: DbService,
    private readonly accounts: AccountsService,
    private readonly ingest: IngestService,
    private readonly store_: MediaStore,
    // M1c-04: uploaded photos are also listed as attachments of the message.
    @Optional() private readonly attachments?: AttachmentsService,
  ) {}

  /**
   * Stores bytes once per id and returns it. Message photos: sha256 of the
   * bytes. Outbox attachments: sha256 of name + bytes, because Zalo shows the
   * file name to the recipient and the same bytes may be sent under two names.
   */
  private async store(buf: Buffer, meta: MediaFileMeta): Promise<string> {
    return this.store_.put(buf, meta, meta.source === 'outbox' ? `${meta.fileName ?? ''}\u0000` : '');
  }

  /**
   * Dashboard: a file for an outbox command (photo or document). Images must
   * really be the raster type they claim; other files are stored as given and
   * always served as downloads.
   */
  async uploadAttachment(body: unknown): Promise<OutboxAttachment> {
    const u = parseOr400(outboxAttachmentUploadSchema, body);
    const buf = Buffer.from(u.dataBase64, 'base64');
    if (!buf.length || buf.length > OUTBOX_LIMITS.attachmentBytes) throw new BadRequestException('Tệp rỗng hoặc quá 10 MB');
    let mime = u.mime.toLowerCase();
    if (mime.startsWith('image/')) {
      const sniffed = sniff(buf);
      // An "image" that is not a raster we know is sent as a plain file.
      mime = sniffed ?? 'application/octet-stream';
    }
    const id = await this.store(buf, { mime, fileName: u.fileName, source: 'outbox' });
    return { id, name: u.fileName, mime, size: buf.length };
  }

  /**
   * A file made by the server itself for an outbox command (the PDF / page images of a quote, M1c-02), stored
   * exactly like a Dashboard upload: sha256 id, GridFS, served only with a token (no public link).
   */
  async saveOutboxFile(file: { fileName: string; mime: string; bytes: Uint8Array }): Promise<OutboxAttachment> {
    const buf = Buffer.from(file.bytes);
    if (!buf.length || buf.length > OUTBOX_LIMITS.attachmentBytes) throw new BadRequestException('Tệp rỗng hoặc quá 10 MB');
    let mime = file.mime.toLowerCase();
    if (mime.startsWith('image/')) mime = sniff(buf) ?? 'application/octet-stream';
    const id = await this.store(buf, { mime, fileName: file.fileName, source: 'outbox' });
    return { id, name: file.fileName, mime, size: buf.length };
  }

  /** Name / type / size of stored media (outbox attachments). */
  async describe(ids: string[]): Promise<Map<string, OutboxAttachment>> {
    const files = await this.db
      .col<{ filename: string; length: number; metadata?: MediaFileMeta }>(`${MEDIA_BUCKET}.files`)
      .find({ filename: { $in: ids.filter((i) => MEDIA_ID.test(i)) } })
      .toArray();
    return new Map(
      files.map((f) => [
        f.filename,
        { id: f.filename, name: f.metadata?.fileName ?? `${f.filename.slice(0, 12)}`, mime: f.metadata?.mime ?? 'application/octet-stream', size: f.length },
      ]),
    );
  }

  async upload(body: unknown): Promise<MessageMediaResult> {
    const u = parseOr400(messageMediaUploadSchema, body);
    await this.accounts.assertExists(u.uid);
    const buf = Buffer.from(u.dataBase64, 'base64');
    if (!buf.length || buf.length > MESSAGE_MEDIA_MAX_BYTES) throw new BadRequestException('Ảnh rỗng hoặc quá 10 MB');
    const sniffed = sniff(buf);
    if (sniffed !== u.mime) throw new BadRequestException('Nội dung không phải ảnh đúng định dạng đã khai báo');

    const messages = this.db.col<{ _id: string }>(C.messages);
    const find = () => messages.findOne(
      { uid: u.uid, cliMsgId: u.cliMsgId },
      { projection: { _id: 1, uid: 1, cliMsgId: 1, content: 1, threadId: 1, fromUid: 1, msgType: 1, sentAt: 1 } },
    );
    let msg = await find();
    // Fetch requests: a photo bubble whose metadata is gone from IndexedDB.
    if (!msg && u.dom && (await this.ingest.createDomMessage(u.uid, u.cliMsgId, { ...u.dom, capturedAt: u.capturedAt }))) {
      msg = await find();
      if (msg) await this.ingest.refreshThread(u.uid, u.dom.threadId);
    }
    if (!msg) return { matched: false };

    const mediaId = await this.store(buf, { mime: u.mime, uid: u.uid, source: 'message' });

    // Keep bubble order: place the id at `index` when that slot is free.
    const current = ((msg as { content?: { mediaImages?: unknown } }).content?.mediaImages ?? []) as string[];
    if (!current.includes(mediaId)) {
      const next = [...current];
      next.splice(Math.min(u.index, next.length), 0, mediaId);
      await messages.updateOne(
        { _id: msg._id },
        {
          $set: {
            'content.mediaImages': next.slice(0, 200),
            contentStatus: 'complete',
            encrypted: false,
            contentSource: 'dom',
            contentCapturedAt: new Date(u.capturedAt),
          },
        },
      );
      // `kind` only when nothing else set it (a text + photo bubble stays as captured).
      await messages.updateOne({ _id: msg._id, 'content.kind': { $exists: false } }, { $set: { 'content.kind': 'image' } });
      await this.attachments?.noteMessages(u.uid, { _id: msg._id });
      if (next.length > 1) await this.markAlbumSiblings(msg as unknown as AlbumHead, next.length);
    }
    return { matched: true, mediaId };
  }

  /**
   * Zalo sends an album as one message per photo but renders a single bubble
   * under the first message's id, so every photo lands on that first message.
   * The other messages of the album are marked `albumOf` the first one:
   * complete, and hidden by the Dashboard, instead of waiting for content forever.
   *
   * Siblings: same account, thread, sender and type, not captured from the DOM,
   * with a cliMsgId (client clock, generated together for the album) within
   * ALBUM_CLI_GAP of the head's. Server `sentAt` alone is not enough: siblings
   * can be stamped a few ms *before* the head (seen 28/09/2026).
   */
  private async markAlbumSiblings(head: AlbumHead, photos: number) {
    const headCli = Number(head.cliMsgId);
    if (!(head.sentAt instanceof Date) || !Number.isFinite(headCli)) return;
    const messages = this.db.col<{ _id: string; cliMsgId?: string }>(C.messages);
    const t = head.sentAt.getTime();
    const candidates = await messages
      .find(
        {
          uid: head.uid,
          threadId: head.threadId,
          fromUid: head.fromUid,
          msgType: head.msgType,
          _id: { $ne: head._id },
          sentAt: { $gte: new Date(t - ALBUM_WINDOW_MS), $lte: new Date(t + ALBUM_WINDOW_MS) },
          contentSource: { $ne: 'dom' },
        },
        { projection: { _id: 1, cliMsgId: 1 } },
      )
      .limit(200)
      .toArray();
    const siblings = candidates
      .map((d) => ({ id: d._id, gap: Math.abs(Number(d.cliMsgId) - headCli) }))
      .filter((d) => Number.isFinite(d.gap) && d.gap <= ALBUM_CLI_GAP)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, photos - 1);
    if (!siblings.length) return;
    await messages.updateMany(
      { _id: { $in: siblings.map((d) => d.id) } },
      { $set: { albumOf: head._id, contentStatus: 'complete', encrypted: false } },
    );
  }


  /** Bytes + mime of one stored photo. */
  async open(mediaId: string): Promise<{ stream: Readable; mime: string; length: number; fileName?: string }> {
    if (!MEDIA_ID.test(mediaId)) throw new NotFoundException('Không tìm thấy ảnh');
    const file = await this.db
      .col<{ _id: unknown; length: number; metadata?: MediaFileMeta }>(`${MEDIA_BUCKET}.files`)
      .findOne({ filename: mediaId });
    if (!file) throw new NotFoundException('Không tìm thấy ảnh');
    return {
      stream: this.store_.stream(mediaId),
      mime: file.metadata?.mime ?? 'application/octet-stream',
      length: file.length,
      ...(file.metadata?.fileName ? { fileName: file.metadata.fileName } : {}),
    };
  }
}
