import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { channelOfUid, type Channel } from '@vclinks/shared';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DbService } from '../db/db.service';

export const CREDENTIALS_COLLECTION = 'channel_credentials';

interface CredentialDoc {
  _id: string;
  channel: Channel;
  /** AES-256-GCM, base64. */
  iv: string;
  tag: string;
  data: string;
  /** Non-secret metadata (e.g. token expiry) readable without decrypting. */
  expiresAt?: Date;
  updatedAt: Date;
}

/**
 * Encrypted store for the integration credentials of API channels (Zalo OA
 * access/refresh tokens, Facebook Page access tokens), keyed by account uid.
 *
 * These are VClinks's own tokens for official APIs, not secrets taken from a
 * user's Zalo/Facebook session (those are never stored, CLAUDE.md §12.2).
 * Values are encrypted with CREDENTIALS_KEY (base64, 32 bytes), never logged,
 * never returned by any API or MCP tool.
 */
@Injectable()
export class CredentialsService implements OnModuleInit {
  private readonly logger = new Logger(CredentialsService.name);
  private key: Buffer | null = null;

  constructor(private readonly db: DbService) {}

  onModuleInit() {
    const raw = process.env.CREDENTIALS_KEY;
    if (!raw) {
      this.logger.warn('CREDENTIALS_KEY not set: API channels (Zalo OA, Fanpage) cannot be connected');
      return;
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('CREDENTIALS_KEY must be 32 bytes, base64-encoded');
    this.key = key;
  }

  get available(): boolean {
    return this.key !== null;
  }

  private requireKey(): Buffer {
    if (!this.key) throw new Error('CREDENTIALS_KEY is not configured');
    return this.key;
  }

  private get col() {
    return this.db.col<CredentialDoc>(CREDENTIALS_COLLECTION);
  }

  async put<T extends object>(uid: string, secret: T, opts: { expiresAt?: Date } = {}): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.requireKey(), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(secret), 'utf8'), cipher.final()]);
    await this.col.updateOne(
      { _id: uid },
      {
        $set: {
          channel: channelOfUid(uid),
          iv: iv.toString('base64'),
          tag: cipher.getAuthTag().toString('base64'),
          data: data.toString('base64'),
          updatedAt: new Date(),
          ...(opts.expiresAt ? { expiresAt: opts.expiresAt } : {}),
        },
        ...(opts.expiresAt ? {} : { $unset: { expiresAt: '' } }),
      },
      { upsert: true },
    );
  }

  async get<T>(uid: string): Promise<T | null> {
    const doc = await this.col.findOne({ _id: uid });
    if (!doc) return null;
    const decipher = createDecipheriv('aes-256-gcm', this.requireKey(), Buffer.from(doc.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(doc.tag, 'base64'));
    const plain = Buffer.concat([decipher.update(Buffer.from(doc.data, 'base64')), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  }

  /** Accounts of a channel that have credentials, with their expiry (no secrets). */
  async list(channel: Channel): Promise<{ uid: string; expiresAt?: Date; updatedAt: Date }[]> {
    const docs = await this.col
      .find({ channel }, { projection: { _id: 1, expiresAt: 1, updatedAt: 1 } })
      .toArray();
    return docs.map((d) => ({ uid: d._id, expiresAt: d.expiresAt, updatedAt: d.updatedAt }));
  }

  async delete(uid: string): Promise<void> {
    await this.col.deleteOne({ _id: uid });
  }
}
