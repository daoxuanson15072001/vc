import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { C, DbService } from '../db/db.service';
import { DEFAULT_TENANT } from '../db/tenant-context';
import type { Principal } from './token.service';

/** Prefix of dashboard session tokens (device/MCP tokens use `vcz_`). */
export const SESSION_PREFIX = 'vcs_';
/** Docs 00 MH-UI-02 (Q-UI-2): 12 hours without activity ends the session, on every device. */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60_000;

interface SessionDoc {
  _id: string;
  hash: string;
  userId: string;
  name: string;
  tenant_id: string;
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt?: Date;
  /** "Chrome · Windows" from the sign-in request (no IP, no full user agent). */
  device?: string | null;
}

/** Short browser and system name of a user agent, for "Phiên đăng nhập". */
export function deviceOf(userAgent: string | undefined | null): string | null {
  const ua = String(userAgent ?? '');
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Trình duyệt khác';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  return os ? `${browser} · ${os}` : browser;
}

const hashSession = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Dashboard login sessions after Google SSO. Only the sha256 hash is stored.
 * `sessions` is a global collection (looked up by hash before the tenant is
 * known); the tenant is a field of the session, like `api_tokens`.
 */
@Injectable()
export class SessionService {
  private cache = new Map<string, { principal: Principal | null; at: number }>();

  constructor(private readonly db: DbService) {}

  async create(user: { _id: string; fullName: string }, tenantId = DEFAULT_TENANT, device: string | null = null): Promise<string> {
    const token = `${SESSION_PREFIX}${randomBytes(32).toString('base64url')}`;
    const now = new Date();
    await this.db.col<SessionDoc>(C.sessions).insertOne({
      _id: randomBytes(8).toString('hex'),
      hash: hashSession(token),
      userId: user._id,
      name: user.fullName,
      tenant_id: tenantId,
      createdAt: now,
      lastUsedAt: now,
      ...(device ? { device } : {}),
    });
    return token;
  }

  /** Live sign-ins of a user, newest use first; `current` marks the one of `token`. */
  async listMine(userId: string, token: string): Promise<{ id: string; createdAt: string; lastUsedAt: string; device: string | null; current: boolean }[]> {
    const live = await this.db
      .col<SessionDoc>(C.sessions)
      .find({ userId, revokedAt: { $exists: false }, lastUsedAt: { $gt: new Date(Date.now() - SESSION_IDLE_MS) } })
      .sort({ lastUsedAt: -1 })
      .limit(50)
      .toArray();
    const mine = hashSession(token);
    return live.map((s) => ({ id: s._id, createdAt: s.createdAt.toISOString(), lastUsedAt: s.lastUsedAt.toISOString(), device: s.device ?? null, current: s.hash === mine }));
  }

  /** Ends one sign-in of this user (not someone else's). False when it is not live. */
  async revokeMine(userId: string, id: string): Promise<boolean> {
    const doc = await this.db.col<SessionDoc>(C.sessions).findOneAndUpdate({ _id: id, userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    if (doc) this.cache.delete(doc.hash);
    return !!doc;
  }

  /** Ends every sign-in of this user but the one of `token`. */
  async revokeOthers(userId: string, token: string): Promise<number> {
    const keep = hashSession(token);
    const r = await this.db
      .col<SessionDoc>(C.sessions)
      .updateMany({ userId, hash: { $ne: keep }, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    this.cache.clear();
    return r.modifiedCount;
  }

  /** The principal of a live session, or null (unknown, revoked or idle for 12 hours). */
  async verify(token: string): Promise<Principal | null> {
    const hash = hashSession(token);
    const hit = this.cache.get(hash);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.principal;
    const now = new Date();
    const doc = await this.db.col<SessionDoc>(C.sessions).findOneAndUpdate(
      { hash, revokedAt: { $exists: false }, lastUsedAt: { $gt: new Date(now.getTime() - SESSION_IDLE_MS) } },
      { $set: { lastUsedAt: now } },
      { returnDocument: 'after' },
    );
    const principal: Principal | null = doc
      ? { name: doc.name, scopes: ['dashboard'], tenantId: doc.tenant_id, userId: doc.userId }
      : null;
    this.cache.set(hash, { principal, at: Date.now() });
    return principal;
  }

  /** Ends the session of this token. Returns false when it is not a live session. */
  async revoke(token: string): Promise<boolean> {
    const hash = hashSession(token);
    const r = await this.db
      .col<SessionDoc>(C.sessions)
      .updateOne({ hash, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    this.cache.delete(hash);
    return r.modifiedCount > 0;
  }

  /** Ends every live session of a user (lock, leaving the company). The 60 s cache is dropped too. */
  async revokeUser(userId: string): Promise<number> {
    const r = await this.db
      .col<SessionDoc>(C.sessions)
      .updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    this.cache.clear();
    return r.modifiedCount;
  }
}
