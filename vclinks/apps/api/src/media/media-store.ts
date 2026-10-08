import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { GridFSBucket } from 'mongodb';
import { DbService } from '../db/db.service';

/** GridFS bucket of the company file store (`media.files` / `media.chunks`). */
export const MEDIA_BUCKET = 'media';
export const MEDIA_ID = /^[a-f0-9]{64}$/;

export interface MediaFileMeta {
  mime: string;
  /** Account the file came from. */
  uid?: string;
  /** Original name (outbox attachments, message files). */
  fileName?: string;
  source?: 'message' | 'outbox' | 'attachment';
}

/**
 * The one place that talks to the byte store. Kept behind this class so moving to MinIO later changes
 * only here (id = sha256 of the bytes stays). GridFS is kept for M1c-04: see docs/04-ky-thuat/api/kho-file-va-ghi-am.md.
 */
@Injectable()
export class MediaStore {
  constructor(private readonly db: DbService) {}

  private get bucket() {
    return new GridFSBucket(this.db.db, { bucketName: MEDIA_BUCKET });
  }

  /** Stores bytes once per id (sha256 of `prefix` + bytes) and returns the id. */
  async put(buf: Buffer, meta: MediaFileMeta, prefix = ''): Promise<string> {
    const h = createHash('sha256');
    if (prefix) h.update(prefix);
    const mediaId = h.update(buf).digest('hex');
    if (!(await this.db.col(`${MEDIA_BUCKET}.files`).countDocuments({ filename: mediaId }, { limit: 1 }))) {
      await new Promise<void>((resolve, reject) => {
        this.bucket.openUploadStream(mediaId, { metadata: meta }).on('error', reject).on('finish', () => resolve()).end(buf);
      });
    }
    return mediaId;
  }

  async stat(mediaId: string): Promise<{ length: number; metadata?: MediaFileMeta } | null> {
    if (!MEDIA_ID.test(mediaId)) return null;
    return this.db.col<{ length: number; metadata?: MediaFileMeta }>(`${MEDIA_BUCKET}.files`).findOne({ filename: mediaId });
  }

  stream(mediaId: string, range?: { start: number; end: number }): Readable {
    // `end` is inclusive for HTTP ranges, exclusive for GridFS.
    return this.bucket.openDownloadStreamByName(mediaId, range ? { start: range.start, end: range.end + 1 } : undefined);
  }

  async readAll(mediaId: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const c of this.stream(mediaId)) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  }

  /** Removes the bytes (erasure by customer). Only files stored by the attachment flow are removable here. */
  async remove(mediaId: string): Promise<boolean> {
    const f = await this.db.col<{ _id: unknown; metadata?: MediaFileMeta }>(`${MEDIA_BUCKET}.files`).findOne({ filename: mediaId });
    if (!f || f.metadata?.source !== 'attachment') return false;
    await this.bucket.delete(f._id as never);
    return true;
  }
}
