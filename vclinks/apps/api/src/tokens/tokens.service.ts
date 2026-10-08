import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MAX_OWN_MCP_TOKENS,
  TOKEN_TEXT,
  channelOfUid,
  CHANNEL_INFO,
  type CreateOwnToken,
  type CreateSystemToken,
  type TokenImpact,
  type RevokeReason,
  type TokenKind,
  type TokenRow,
  type TokenSettings,
} from '@vclinks/shared';
import type { Principal, TokenDoc } from '../auth/token.service';
import { TokenService } from '../auth/token.service';
import type { Subject } from '../authz/engine';
import { hasKey } from '../authz/engine';
import { C, DbService } from '../db/db.service';
import { DEFAULT_TENANT, currentTenant, runUnscoped } from '../db/tenant-context';
import { ORG_C } from '../org/org.types';
import { AUTHZ_C, type ChannelAccessDoc } from '../authz/authz.types';
import { AuthzService } from '../authz/authz.service';
import type { UserDoc } from '../users/users.service';

const DAY = 24 * 3600_000;
const SETTINGS_ID = 'main';

/** Row of `api_tokens` as the tables show it (never the hash). */
function toRow(d: TokenDoc, owners: Map<string, string>, calls?: number): TokenRow {
  return {
    id: d._id,
    name: d.name,
    kind: d.kind ?? 'legacy',
    ownerUserId: d.userId ?? null,
    ownerName: d.userId ? (owners.get(d.userId) ?? null) : (d.createdBy ?? null),
    deviceName: d.deviceName ?? null,
    uids: d.uids ?? [],
    groups: d.groups ?? [],
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt?.toISOString() ?? null,
    lastUsedAt: d.lastUsedAt?.toISOString() ?? null,
    lastIp: d.lastIp ?? null,
    revokedAt: d.revokedAt?.toISOString() ?? null,
    revokedReason: d.revokedReason ?? null,
    revokedBy: d.revokedBy ?? null,
    ...(calls !== undefined ? { calls7d: calls } : {}),
  };
}

/**
 * Token management (M1b-06, docs 01 §2.7, MH-PQ-08 / 09). Only the sha256 of a token is stored; the plain
 * string is returned by the create call that made it and never again. Nothing here logs a token.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly db: DbService,
    private readonly tokens: TokenService,
    private readonly authz: AuthzService,
  ) {}

  /** `api_tokens` is a global collection (found by hash before the tenant is known): filter by tenant here. */
  private tenantFilter() {
    const t = currentTenant();
    return t === DEFAULT_TENANT ? { $or: [{ tenant_id: t }, { tenant_id: { $exists: false } }] } : { tenant_id: t };
  }

  private col() {
    return this.db.col<TokenDoc>(C.apiTokens);
  }

  private async ownerNames(docs: TokenDoc[]): Promise<Map<string, string>> {
    const ids = [...new Set(docs.map((d) => d.userId).filter((x): x is string => !!x))];
    if (!ids.length) return new Map();
    const users = await runUnscoped(() => this.db.col<UserDoc>(C.users).find({ _id: { $in: ids } as never }).project({ fullName: 1 }).toArray());
    return new Map(users.map((u) => [String(u._id), (u as unknown as { fullName: string }).fullName]));
  }

  async calls7d(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const since = new Date(Date.now() - 7 * DAY);
    const agg = await this.db
      .col(C.auditLog)
      .aggregate<{ _id: string; n: number }>([
        { $match: { action: 'mcp.call', at: { $gt: since }, 'detail.tokenId': { $in: ids } } },
        { $group: { _id: '$detail.tokenId', n: { $sum: 1 } } },
      ])
      .toArray();
    return new Map(agg.map((a) => [a._id, a.n]));
  }

  /** MH-PQ-08 table: every token of the tenant. */
  async listAll(q: { kind?: string; status?: string; search?: string }): Promise<TokenRow[]> {
    const filter: Record<string, unknown> = { ...this.tenantFilter() };
    if (q.kind) filter.kind = q.kind === 'legacy' ? { $exists: false } : q.kind;
    if (q.status === 'active') filter.revokedAt = { $exists: false };
    if (q.status === 'revoked') filter.revokedAt = { $exists: true };
    const docs = await this.col().find(filter as never).sort({ lastUsedAt: -1, createdAt: -1 }).limit(500).toArray();
    const owners = await this.ownerNames(docs);
    const calls = await this.calls7d(docs.filter((d) => d.kind === 'mcp_user').map((d) => d._id));
    const s = q.search?.trim().toLowerCase();
    return docs
      .map((d) => toRow(d, owners, calls.get(d._id) ?? 0))
      .filter((r) => !s || [r.name, r.ownerName ?? '', r.deviceName ?? '', ...r.uids].some((x) => x.toLowerCase().includes(s)));
  }

  /** MH-PQ-09: the caller's own personal MCP tokens, with whether he may create one now. */
  async listOwn(userId: string, subject: Subject) {
    const docs = await this.col().find({ ...this.tenantFilter(), kind: 'mcp_user', userId } as never).sort({ createdAt: -1 }).toArray();
    const owners = await this.ownerNames(docs);
    const calls = await this.calls7d(docs.map((d) => d._id));
    const live = docs.filter((d) => !d.revokedAt && (!d.expiresAt || d.expiresAt > new Date())).length;
    const allowed = await this.selfAllowed(subject);
    const preLeave = await this.hasPreLeave(userId);
    return {
      items: docs.map((d) => toRow(d, owners, calls.get(d._id) ?? 0)),
      canCreate: allowed && live < MAX_OWN_MCP_TOKENS,
      reason: !allowed ? TOKEN_TEXT.selfMcpOff : live >= MAX_OWN_MCP_TOKENS ? TOKEN_TEXT.tooMany : null,
      canPropose: !preLeave && (hasKey(subject, 'conv.reply') || hasKey(subject, 'invoice_req.create') || hasKey(subject, 'cust.merge')),
      ...(preLeave ? { proposeReason: TOKEN_TEXT.preLeaveNoPropose } : {}),
    };
  }

  /** Whether the person carries the "Sắp nghỉ" flag (PQ-82): his tokens may only read. */
  private async hasPreLeave(userId: string): Promise<boolean> {
    const u = await runUnscoped(() => this.db.col<UserDoc>(C.users).findOne({ _id: userId as never }, { projection: { preLeave: 1 } }));
    return !!u?.preLeave;
  }

  /**
   * "Phạm vi ảnh hưởng" of a token (PQ-47, UAT-PQ-72): what the AI behind it read, from the `mcp.call` audit lines.
   * Only ids, tool names and IPs come back: no token, no message content.
   */
  async impact(id: string): Promise<TokenImpact> {
    const doc = await this.col().findOne({ _id: id as never, ...this.tenantFilter() } as never);
    if (!doc) throw new NotFoundException('Không tìm thấy token');
    const owners = await this.ownerNames([doc]);
    const rows = await this.db
      .col<{ target: string; at: Date; ip?: string; detail?: { targets?: string[]; returned?: number; found?: boolean } }>(C.auditLog)
      .find({ action: 'mcp.call', 'detail.tokenId': id } as never)
      .sort({ at: -1 })
      .limit(1000)
      .toArray();
    const convs = new Set<string>();
    const ips = new Map<string, { calls: number; lastAt: Date }>();
    for (const r of rows) {
      for (const t of r.detail?.targets ?? []) convs.add(t);
      if (r.ip) {
        const x = ips.get(r.ip);
        if (x) x.calls++;
        else ips.set(r.ip, { calls: 1, lastAt: r.at });
      }
    }
    return {
      tokenId: id,
      name: doc.name,
      ownerName: doc.userId ? (owners.get(doc.userId) ?? null) : null,
      calls: rows.length,
      conversations: [...convs].slice(0, 100),
      conversationCount: convs.size,
      ips: [...ips].map(([ip, v]) => ({ ip, calls: v.calls, lastAt: v.lastAt.toISOString() })),
      recent: rows.slice(0, 20).map((r) => ({ at: r.at.toISOString(), tool: r.target, returned: r.detail?.returned ?? (r.detail?.found ? 1 : 0), ip: r.ip ?? null })),
    };
  }

  async settings(): Promise<TokenSettings> {
    const d = await this.db.col<{ _id: string; allowSelfMcpToken?: TokenSettings['allowSelfMcpToken'] }>(ORG_C.securitySettings).findOne({ _id: SETTINGS_ID });
    return { allowSelfMcpToken: { divisions: d?.allowSelfMcpToken?.divisions ?? [], roles: d?.allowSelfMcpToken?.roles ?? [] } };
  }

  async saveSettings(s: TokenSettings['allowSelfMcpToken'], actor: string) {
    await this.db.col(ORG_C.securitySettings).updateOne({ _id: SETTINGS_ID } as never, { $set: { allowSelfMcpToken: s } }, { upsert: true });
    await this.db.audit(actor, 'token.settings', 'allowSelfMcpToken', { divisions: s.divisions.length, roles: s.roles.length });
    return this.settings();
  }

  /** NT2: empty settings = nobody; otherwise a division or a role of the person must be listed. */
  private async selfAllowed(subject: Subject): Promise<boolean> {
    const s = (await this.settings()).allowSelfMcpToken;
    if (!subject.active) return false;
    return subject.roles.some((r) => s.roles.includes(r.roleKey) || (!!r.divisionId && s.divisions.includes(r.divisionId)));
  }

  /** The person creates a token for himself only (PQ-43); there is no userId in the request. */
  async createOwn(input: CreateOwnToken, p: Principal, subject: Subject) {
    if (!(await this.selfAllowed(subject))) throw new ForbiddenException(TOKEN_TEXT.selfMcpOff);
    const mine = await this.col().countDocuments({
      ...this.tenantFilter(),
      kind: 'mcp_user',
      userId: p.userId,
      revokedAt: { $exists: false },
      $and: [{ $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] }],
    } as never);
    if (mine >= MAX_OWN_MCP_TOKENS) throw new ConflictException(TOKEN_TEXT.tooMany);
    const groups = [...new Set(['doc' as const, ...input.groups])];
    // PQ-82: a person flagged "Sắp nghỉ" gets the read group only.
    if (groups.includes('de_xuat') && (await this.hasPreLeave(p.userId!))) throw new ForbiddenException(TOKEN_TEXT.preLeaveNoPropose);
    if (groups.includes('de_xuat') && !(hasKey(subject, 'conv.reply') || hasKey(subject, 'invoice_req.create') || hasKey(subject, 'cust.merge'))) {
      throw new ForbiddenException('Nhóm "Đề xuất" cần quyền trả lời hoặc đề xuất của vị trí bạn.');
    }
    const { token, id } = await this.tokens.createWithId(input.name, ['mcp'], p.tenantId, {
      kind: 'mcp_user',
      userId: p.userId,
      groups,
      expiresAt: new Date(Date.now() + input.days * DAY),
      createdBy: p.name,
    });
    return { id, secret: token, name: input.name };
  }

  /** Sync token / sending agent token: Admin only, bound to nicks (docs 01 §2.7). */
  async createSystem(input: CreateSystemToken, p: Principal) {
    const uids = [...new Set(input.uids)];
    const accounts = await runUnscoped(() => this.db.col<{ _id: string; status?: string }>(C.accounts).find({ _id: { $in: uids } as never }).toArray());
    if (accounts.length !== uids.length || accounts.some((a) => a.status === 'cho_xac_nhan')) throw new BadRequestException('Có nick chưa khai báo hoặc đang chờ xác nhận');
    if (input.kind === 'agent') {
      // Sending agent: personal nicks that have a holder.
      const holders = await this.db
        .col<ChannelAccessDoc>(AUTHZ_C.channelAccess)
        .find({ channelId: { $in: uids }, level: 'giu_nick' })
        .toArray();
      const held = new Set(holders.map((h) => h.channelId));
      for (const u of uids) {
        if (CHANNEL_INFO[channelOfUid(u)].sendMode !== 'extension' || !held.has(u)) {
          throw new BadRequestException('Token tác tử gửi chỉ gắn nick cá nhân đã có người giữ nick');
        }
      }
    }
    const { token, id } = await this.tokens.createWithId(input.name, ['mcp'], p.tenantId, {
      kind: input.kind,
      uids,
      expiresAt: new Date(Date.now() + input.days * DAY),
      createdBy: p.name,
    });
    return { id, secret: token, name: input.name };
  }

  /**
   * Revokes one token. Effective at once on this process and within the cache time (60 s) elsewhere.
   * `ownerOnly`: a person revoking from "Token MCP của tôi" may only touch his own tokens.
   */
  async revoke(id: string, reason: RevokeReason, p: Principal, ownerOnly: boolean) {
    const doc = await this.col().findOne({ _id: id as never, ...this.tenantFilter() } as never);
    if (!doc || (ownerOnly && !(doc.kind === 'mcp_user' && doc.userId === p.userId))) throw new NotFoundException('Không tìm thấy token');
    // PQ-41: nobody edits his own rights, but revoking his own token is the one allowed exception (nothing to check).
    if (doc.revokedAt) return { id, revoked: false };
    await this.col().updateOne({ _id: id as never } as never, { $set: { revokedAt: new Date(), revokedReason: reason, revokedBy: p.name } });
    this.tokens.forgetCache();
    await this.db.audit(p.name, 'token.revoke', doc.name, { tokenId: id, kind: doc.kind ?? 'legacy', reason, owner: doc.userId ?? null });
    return { id, revoked: true };
  }

  /** "Thu hồi mọi token của <người>": personal MCP tokens and devices held by him. */
  async revokeAllOf(userId: string, reason: RevokeReason, p: Principal) {
    const r = await this.col().updateMany(
      { ...this.tenantFilter(), userId, revokedAt: { $exists: false } } as never,
      { $set: { revokedAt: new Date(), revokedReason: reason, revokedBy: p.name } },
    );
    this.tokens.forgetCache();
    await this.db.audit(p.name, 'token.revoke_all', userId, { reason, count: r.modifiedCount });
    return { revoked: r.modifiedCount };
  }

  static kindOf(d: { kind?: TokenKind }): TokenKind {
    return d.kind ?? 'legacy';
  }
}
