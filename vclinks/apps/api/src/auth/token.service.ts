import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { McpGroup, RevokeReason, TokenKind } from '@vclinks/shared';
import { C, DbService } from '../db/db.service';
import { DEFAULT_TENANT } from '../db/tenant-context';
import { SESSION_PREFIX, SessionService } from './session.service';

export const SCOPES = ['dashboard', 'ingest', 'mcp', 'dev'] as const;
export type Scope = (typeof SCOPES)[number];

export interface Principal {
  name: string;
  scopes: Scope[];
  /** Tenant whose data this token reads and writes (BA §2.2 #10). */
  tenantId: string;
  /** Set for dashboard sessions (Google login); absent for device/MCP tokens. */
  userId?: string;
  /** Set when the principal comes from an API token (M1b-06); absent for login sessions. */
  tokenId?: string;
  tokenKind?: TokenKind;
  /** Nicks a device / sync / agent token is bound to (empty or absent = no binding, legacy tokens). */
  uids?: string[];
  /** Tool groups of a personal MCP token. */
  groups?: McpGroup[];
}

export interface TokenDoc {
  _id: string;
  name: string;
  hash: string;
  scopes: Scope[];
  /** Missing on tokens created before multi-tenancy: DEFAULT_TENANT. */
  tenant_id?: string;
  createdAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  /** M1b-06 fields; tokens created before it have none of them (kind `legacy`). */
  kind?: TokenKind;
  userId?: string;
  uids?: string[];
  groups?: McpGroup[];
  deviceName?: string;
  expiresAt?: Date;
  lastIp?: string;
  createdBy?: string;
  revokedReason?: RevokeReason;
  revokedBy?: string;
}

/** Extra fields of a token (everything but name / scopes / tenant). */
export interface TokenOptions {
  kind?: TokenKind;
  /** Owner of a personal MCP token. */
  userId?: string;
  uids?: string[];
  groups?: McpGroup[];
  deviceName?: string;
  expiresAt?: Date;
  createdBy?: string;
}

const CACHE_TTL_MS = 60_000;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Personal bearer tokens. Only the sha256 hash is stored; the plain token is
 * shown once at creation. Phase 1 stand-in for Google SSO / OAuth.
 */
@Injectable()
export class TokenService {
  private cache = new Map<string, { principal: Principal | null; at: number }>();

  constructor(
    private readonly db: DbService,
    private readonly sessions: SessionService,
  ) {}

  async create(name: string, scopes: Scope[], tenantId = DEFAULT_TENANT, opts: TokenOptions = {}): Promise<string> {
    return (await this.createWithId(name, scopes, tenantId, opts)).token;
  }

  /** Like create, also returning the token id (for tables and revocation). The id is not a secret. */
  async createWithId(name: string, scopes: Scope[], tenantId = DEFAULT_TENANT, opts: TokenOptions = {}) {
    const token = `vcz_${randomBytes(32).toString('base64url')}`;
    const id = randomBytes(8).toString('hex');
    await this.db.col<TokenDoc>(C.apiTokens).insertOne({
      _id: id,
      name,
      hash: hashToken(token),
      scopes,
      tenant_id: tenantId,
      createdAt: new Date(),
      ...(opts.kind ? { kind: opts.kind } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.uids?.length ? { uids: opts.uids } : {}),
      ...(opts.groups ? { groups: opts.groups } : {}),
      ...(opts.deviceName ? { deviceName: opts.deviceName } : {}),
      ...(opts.expiresAt ? { expiresAt: opts.expiresAt } : {}),
      ...(opts.createdBy ? { createdBy: opts.createdBy } : {}),
    });
    await this.db.audit(opts.createdBy ?? 'system', 'token.create', name, { scopes, tenantId, kind: opts.kind ?? 'legacy', tokenId: id });
    return { token, id };
  }

  /** Drops cached verdicts so a revocation applies at once (other processes: within CACHE_TTL_MS). */
  forgetCache() {
    this.cache.clear();
  }

  async revoke(name: string): Promise<number> {
    const r = await this.db
      .col<TokenDoc>(C.apiTokens)
      .updateMany({ name, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    this.cache.clear();
    await this.db.audit('system', 'token.revoke', name, { count: r.modifiedCount });
    return r.modifiedCount;
  }

  async verify(token: string, ip?: string): Promise<Principal | null> {
    // Login sessions (vcs_) live in their own collection; device and MCP tokens (vcz_) are unchanged.
    if (token.startsWith(SESSION_PREFIX)) return this.sessions.verify(token);
    const hash = hashToken(token);
    const hit = this.cache.get(hash);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.principal;

    const now = new Date();
    const doc = await this.db
      .col<TokenDoc>(C.apiTokens)
      .findOneAndUpdate(
        { hash, revokedAt: { $exists: false }, $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
        { $set: { lastUsedAt: now, ...(ip ? { lastIp: ip.slice(0, 64) } : {}) } },
        { returnDocument: 'after' },
      );
    const principal: Principal | null = doc
      ? {
          name: doc.name,
          scopes: doc.scopes,
          tenantId: doc.tenant_id ?? DEFAULT_TENANT,
          tokenId: doc._id,
          tokenKind: doc.kind ?? 'legacy',
          ...(doc.uids?.length ? { uids: doc.uids } : {}),
          ...(doc.groups ? { groups: doc.groups } : {}),
          // A personal MCP token acts as its owner: the guard applies the owner's data scope.
          ...(doc.kind === 'mcp_user' && doc.userId ? { userId: doc.userId } : {}),
        }
      : null;
    this.cache.set(hash, { principal, at: Date.now() });
    return principal;
  }
}
