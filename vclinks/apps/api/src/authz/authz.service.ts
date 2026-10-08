import { Injectable, Logger } from '@nestjs/common';
import {
  CHANNEL_INFO,
  GROUP_LEAD_ROLES,
  channelOfUid,
  customRoleRow,
  type ChannelAccessLevel,
  type ConversationAccess,
  type InboxScope,
  type MePermissions,
  type PermissionKey,
  type RoleKey,
  type ScopeCode,
} from '@vclinks/shared';
import type { Principal } from '../auth/token.service';
import { C, DbService } from '../db/db.service';
import { currentTenant, runUnscoped, type DataScope } from '../db/tenant-context';
import { ORG_C, type CustomRoleDoc, type OrgUnitDoc, type RoleAssignmentDoc } from '../org/org.types';
import type { UserDoc } from '../users/users.service';
import { CUST_C, type CustomerAccountDoc, type IdentityLinkDoc } from '../customers/customers.types';
import { AUTHZ_C, type AccessGrantDoc, type ChannelAccessDoc } from './authz.types';
import { decide, effectivePermissions, phoneVisibility, rowOf, type Decision, type DecideOptions, type RoleRow, type Subject, type Target } from './engine';

/** Facts are cached 30 s (role changes apply within a minute, UAT-PQ-03); AUTHZ_CACHE_MS overrides (tests: 0). */
const cacheMs = () => Number(process.env.AUTHZ_CACHE_MS ?? 30_000);

/** Legacy tokens (no user) keep full access only with AUTHZ_LEGACY_TOKENS=1 (dev / test). Owner decision 04/10/2026. */
export const legacyTokensAllowed = () => process.env.AUTHZ_LEGACY_TOKENS === '1';
/** Division of channels that have none yet (owner decision 04/10/2026: VCparts). */
const defaultDivision = () => process.env.AUTHZ_DEFAULT_DIVISION?.trim() || null;

/** What the engine needs to know about one channel (account). */
export interface ChannelFacts {
  uid: string;
  kind: 'personal' | 'official';
  divisionId: string | null;
  holderId: string | null;
  holderUnits: string[];
}

interface TenantFacts {
  at: number;
  units: Map<string, OrgUnitDoc>;
  children: Map<string, string[]>;
  channels: ChannelFacts[];
  /** Nicks registered by a device and awaiting an Admin (M1b-06, PQ-52 d): shown to nobody. */
  pendingUids: string[];
  access: ChannelAccessDoc[];
  /** userId → unit ids of his active assignments. */
  unitsOfUser: Map<string, string[]>;
  /** Custom roles (MH-PQ-05) with their rows, rebuilt from the system matrix (never wider, PQ-06). */
  customRoles: Map<string, { name: string; baseRole: RoleKey; row: RoleRow }>;
}

const active = (d: { from?: Date; to?: Date | null }, now: number) =>
  (!d.from || d.from.getTime() <= now) && (!d.to || d.to.getTime() > now);

/**
 * Loads subjects and targets for the pure engine (engine.ts) and turns a subject into a MongoDB data
 * scope (channels it may read), applied to every channel collection of the request (DbService).
 */
@Injectable()
export class AuthzService {
  private readonly logger = new Logger(AuthzService.name);
  private tenants = new Map<string, TenantFacts>();
  private subjects = new Map<string, { at: number; subject: Subject }>();
  private warnedLegacy = new Set<string>();

  constructor(private readonly db: DbService) {}

  /** Drops cached facts (after a change of roles, units or channel access; tests). */
  invalidate() {
    this.tenants.clear();
    this.subjects.clear();
  }

  /** A token without a user: allowed only with AUTHZ_LEGACY_TOKENS=1, logged once per token. */
  legacyAllowed(p: Principal): boolean {
    if (!legacyTokensAllowed()) return false;
    if (!this.warnedLegacy.has(p.name)) {
      this.warnedLegacy.add(p.name);
      this.logger.warn(`Legacy token "${p.name}" used without a user (AUTHZ_LEGACY_TOKENS=1): full access`);
    }
    return true;
  }

  private async facts(): Promise<TenantFacts> {
    const tenant = currentTenant();
    const hit = this.tenants.get(tenant);
    if (hit && Date.now() - hit.at < cacheMs()) return hit;
    return runUnscoped(async () => {
      const now = Date.now();
      const [units, assignments, accounts, access, custom] = await Promise.all([
        this.db.col<OrgUnitDoc>(ORG_C.orgUnits).find({}).toArray(),
        this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments).find({}).toArray(),
        this.db.col<{ _id: string; divisionId?: string | null; status?: string }>(C.accounts).find({}, { projection: { divisionId: 1, status: 1 } }).toArray(),
        this.db.col<ChannelAccessDoc>(AUTHZ_C.channelAccess).find({}).toArray(),
        this.db.col<CustomRoleDoc>(ORG_C.customRoles).find({}).toArray(),
      ]);
      const customRoles = new Map(custom.map((c) => [c._id, { name: c.name, baseRole: c.baseRole, row: customRoleRow(c.baseRole, c.picks ?? {}) }]));
      const byId = new Map(units.map((u) => [u._id, u]));
      const children = new Map<string, string[]>();
      for (const u of units) if (u.parentId) (children.get(u.parentId) ?? children.set(u.parentId, []).get(u.parentId)!).push(u._id);
      const unitsOfUser = new Map<string, string[]>();
      for (const a of assignments) {
        if (!active(a, now)) continue;
        (unitsOfUser.get(a.userId) ?? unitsOfUser.set(a.userId, []).get(a.userId)!).push(a.orgUnitId);
      }
      const liveAccess = access.filter((x) => active(x, now));
      const holders = new Map(
        liveAccess.filter((x) => x.level === 'giu_nick' && x.principalType === 'user').map((x) => [x.channelId, x.principalId]),
      );
      const pendingUids = accounts.filter((a) => a.status === 'cho_xac_nhan').map((a) => a._id);
      const channels: ChannelFacts[] = accounts.filter((a) => a.status !== 'cho_xac_nhan').map((a) => {
        const holderId = holders.get(a._id) ?? null;
        return {
          uid: a._id,
          kind: CHANNEL_INFO[channelOfUid(a._id)].sendMode === 'api' ? 'official' : 'personal',
          divisionId: a.divisionId ?? defaultDivision(),
          holderId,
          holderUnits: holderId ? (unitsOfUser.get(holderId) ?? []) : [],
        };
      });
      const f: TenantFacts = { at: now, units: byId, children, channels, pendingUids, access: liveAccess, unitsOfUser, customRoles };
      this.tenants.set(tenant, f);
      return f;
    });
  }

  private subtree(f: TenantFacts, id: string): Set<string> {
    const out = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const x = stack.pop()!;
      if (out.has(x)) continue;
      out.add(x);
      stack.push(...(f.children.get(x) ?? []));
    }
    return out;
  }

  /** The engine subject of a signed-in user (cached 30 s: role changes apply within a minute, UAT-PQ-03). */
  async subject(userId: string): Promise<Subject> {
    const key = `${currentTenant()}:${userId}`;
    const hit = this.subjects.get(key);
    if (hit && Date.now() - hit.at < cacheMs()) return hit.subject;
    const f = await this.facts();
    const subject = await runUnscoped(async () => {
      const now = Date.now();
      const [user, assignments, grants] = await Promise.all([
        this.db.col<UserDoc>(C.users).findOne({ _id: userId }),
        this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments).find({ userId }).toArray(),
        this.db.col<AccessGrantDoc>(AUTHZ_C.accessGrants).find({ userId, status: 'hieu_luc' }).toArray(),
      ]);
      const roles = assignments
        .filter((a) => active(a, now) && f.units.get(a.orgUnitId)?.active !== false)
        .map((a) => {
          const unit = f.units.get(a.orgUnitId);
          // A custom role that is gone or built on another role grants nothing (never fall back to the wider system row).
          const cr = a.customRoleId ? f.customRoles.get(a.customRoleId) : undefined;
          const custom = a.customRoleId
            ? { id: a.customRoleId, name: cr?.name ?? a.customRoleId, row: cr && cr.baseRole === a.roleKey ? cr.row : {} }
            : undefined;
          return {
            roleKey: a.roleKey,
            unitId: a.orgUnitId,
            divisionId: unit?.divisionId ?? null,
            subtree: this.subtree(f, a.orgUnitId),
            isManager: unit?.managerUserId === userId,
            ...(custom ? { custom } : {}),
          };
        });
      const myUnits = new Set(roles.map((r) => r.unitId));
      const liveGrants = grants.filter((g) => active(g, now));
      const nicks = new Set(f.access.filter((x) => x.level === 'giu_nick' && x.principalType === 'user' && x.principalId === userId).map((x) => x.channelId));
      // "Trực nick": an active cover grant on a channel adds the nick.
      const covers = new Map<string, { absentUserId: string | null; until: Date | null }>();
      for (const g of liveGrants) {
        if (g.type !== 'truc_thay' || g.targetType !== 'channel') continue;
        nicks.add(g.targetId);
        covers.set(g.targetId, { absentUserId: g.absentUserId ?? null, until: g.to ?? null });
      }
      const channelLevels = new Map<string, Set<ChannelAccessLevel>>();
      for (const x of f.access) {
        if (x.level === 'giu_nick') continue;
        const mine = x.principalType === 'user' ? x.principalId === userId : myUnits.has(x.principalId);
        if (mine) (channelLevels.get(x.channelId) ?? channelLevels.set(x.channelId, new Set()).get(x.channelId)!).add(x.level);
      }
      return {
        userId,
        active: user?.status === 'hoat_dong',
        roles,
        nicks,
        channelLevels,
        grants: liveGrants.map((g) => ({ type: g.type, target: `${g.targetType}:${g.targetId}`, rights: g.rights })),
        covers,
      } satisfies Subject;
    });
    this.subjects.set(key, { at: Date.now(), subject });
    return subject;
  }

  /** Engine target of one channel (as a whole): division, kind and its nick holder's units. */
  async channelTarget(uid: string): Promise<Target> {
    const f = await this.facts();
    const c = f.channels.find((x) => x.uid === uid);
    const kind = CHANNEL_INFO[channelOfUid(uid)].sendMode === 'api' ? 'official' : 'personal';
    if (!c) return { channelId: uid, channelKind: kind, divisionId: defaultDivision(), grantTargets: [`channel:${uid}`] };
    return {
      channelId: uid,
      channelKind: c.kind,
      divisionId: c.divisionId,
      unitIds: c.holderUnits,
      grantTargets: [`channel:${uid}`],
    };
  }

  /**
   * Engine target of one conversation (`${uid}:${threadId}`). M1b-12: the customer owner(s) of the
   * conversation's identity in the channel's division are `responsibleIds` (scope CT, "khách của tôi"),
   * and their units join `unitIds` (TỔ / NH of the owner). Assignees arrive with M1b-09.
   */
  async conversationTarget(uid: string, threadId: string): Promise<Target> {
    const t = await this.channelTarget(uid);
    const owners = threadId ? await this.ownersOfIdentity(`${uid}:${threadId}`, t.divisionId ?? null) : [];
    const f = owners.length ? await this.facts() : null;
    const ownerUnits = f ? owners.flatMap((o) => f.unitsOfUser.get(o) ?? []) : [];
    return {
      ...t,
      ...(owners.length ? { responsibleIds: owners, unitIds: [...new Set([...(t.unitIds ?? []), ...ownerUnits])] } : {}),
      grantTargets: [...(t.grantTargets ?? []), `conversation:${uid}:${threadId}`],
    };
  }

  /**
   * Owners (user ids) of the customer an identity (`${uid}:${userId}`) belongs to, in `division` (all
   * divisions when null). Empty when the identity has no customer profile yet or no owner (M1b-12).
   */
  async ownersOfIdentity(identityId: string, division: string | null): Promise<string[]> {
    return runUnscoped(async () => {
      const link = await this.db.col<IdentityLinkDoc>(CUST_C.identityLinks).findOne({ _id: identityId }, { projection: { accountId: 1 } });
      if (!link) return [];
      const acc = await this.db
        .col<CustomerAccountDoc>(CUST_C.accounts)
        .findOne({ _id: link.accountId }, { projection: { owners: 1 } });
      return [...new Set((acc?.owners ?? []).filter((o) => !division || o.division === division).map((o) => o.userId))];
    });
  }

  /**
   * Customer accounts a subject may reach with a cust.* key (M1b-12), as MongoDB conditions for
   * CustomersService: null = every customer of the tenant (TĐ / ✅). Otherwise an account is visible when
   * one of its owners is in `ownerIds` (CT / NH / TỔ / SELF), it has an owner in one of `divisions` (DV),
   * or one of its identities is on a channel of `channels` (NICK / KÊNH / LEAD… through the data scope).
   * Customer-list filtering of the inbox (M1b-09) can reuse it.
   */
  async customerScope(u: Subject, key: PermissionKey = 'cust.view'): Promise<{ divisions: string[]; ownerIds: string[]; channels: string[] } | null> {
    const empty = { divisions: [], ownerIds: [], channels: [] };
    if (!u.active) return empty;
    const f = await this.facts();
    const divisions = new Set<string>();
    const ownerIds = new Set<string>();
    const usersIn = (units: ReadonlySet<string>) => {
      for (const [userId, us] of f.unitsOfUser) if (us.some((x) => units.has(x))) ownerIds.add(userId);
    };
    for (const r of u.roles) {
      const cell = rowOf(r)[key];
      if (!cell || cell.cond) continue;
      for (const s of cell.s) {
        if (s === 'TD' || s === 'ALL') return null;
        if (s === 'DV' && r.divisionId) divisions.add(r.divisionId);
        if (s === 'TO') usersIn(r.subtree);
        if (s === 'NH' || s === 'CT') {
          ownerIds.add(u.userId);
          if (r.isManager && (s === 'NH' || GROUP_LEAD_ROLES.includes(r.roleKey as never))) usersIn(r.subtree);
        }
        if (s === 'SELF') ownerIds.add(u.userId);
      }
    }
    const scope = await this.dataScope(u, key);
    if (!scope) return null;
    return { ...empty, divisions: [...divisions], ownerIds: [...ownerIds], channels: scope.channels };
  }

  /** Personal channels whose nick holder is `userId`. */
  async heldNicks(userId: string): Promise<string[]> {
    return (await this.facts()).channels.filter((c) => c.holderId === userId && c.kind === 'personal').map((c) => c.uid);
  }

  /**
   * Supervisor of a person (leave request approver, PQ-32): the manager of the nearest unit above any of
   * his units who is not himself (team → GS, else division → GĐ).
   */
  async supervisorOf(userId: string): Promise<string | null> {
    const f = await this.facts();
    for (const start of f.unitsOfUser.get(userId) ?? []) {
      for (let x: string | null = start, n = 0; x && n < 20; x = f.units.get(x)?.parentId ?? null, n++) {
        const m = f.units.get(x)?.managerUserId;
        if (m && m !== userId) return m;
      }
    }
    return null;
  }

  /** Managers of the units a channel's holder belongs to, up to the division (UAT-PQ-85 notices). */
  async managersOver(uid: string): Promise<string[]> {
    const f = await this.facts();
    const c = f.channels.find((x) => x.uid === uid);
    const out = new Set<string>();
    for (const start of c?.holderUnits ?? []) {
      for (let x: string | null = start, n = 0; x && n < 20; x = f.units.get(x)?.parentId ?? null, n++) {
        const u = f.units.get(x);
        if (u?.type === 'goc') break;
        if (u?.managerUserId) out.add(u.managerUserId);
      }
    }
    return [...out];
  }

  /** Holder (giu_nick) of channel `uid`, or null. */
  async holderOf(uid: string): Promise<string | null> {
    return (await this.facts()).channels.find((c) => c.uid === uid)?.holderId ?? null;
  }

  /** Who holds each nick and the org units behind them, for reports (M1c-09). Read only. */
  async reportFacts(): Promise<{
    channels: { uid: string; kind: 'personal' | 'official'; holderId: string | null; holderUnits: string[] }[];
    units: Map<string, { name: string; type: string; parentId: string | null; divisionId: string | null }>;
  }> {
    const f = await this.facts();
    return {
      channels: f.channels.map((c) => ({ uid: c.uid, kind: c.kind, holderId: c.holderId, holderUnits: c.holderUnits })),
      units: new Map([...f.units.values()].map((u) => [u._id, { name: u.name, type: u.type, parentId: u.parentId ?? null, divisionId: u.divisionId ?? null }])),
    };
  }

  /** Display names of users (unknown ids map to themselves). */
  async userNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const want = [...new Set(ids.filter((x): x is string => !!x))];
    const out = new Map<string, string>(want.map((x) => [x, x]));
    if (!want.length) return out;
    const rows = await runUnscoped(() =>
      this.db.col<UserDoc>(C.users).find({ _id: { $in: want as never[] } } as never, { projection: { fullName: 1 } }).toArray(),
    );
    for (const r of rows) out.set(r._id, r.fullName || r._id);
    return out;
  }

  /**
   * How the user sends on channel `uid` (QT-SZ-10): as the nick holder (null), as the active cover of
   * the absent holder (`truc_thay`), or replying on behalf of the holder (`tra_loi_thay`, GS/GĐ).
   * Official channels: always null (the channel speaks, there is no personal holder).
   */
  async sendModeOf(u: Subject, uid: string): Promise<{ source: 'truc_thay' | 'tra_loi_thay' | null; holderId: string | null; until: Date | null }> {
    const t = await this.channelTarget(uid);
    const holderId = await this.holderOf(uid);
    if (t.channelKind !== 'personal') return { source: null, holderId, until: null };
    if (holderId === u.userId) return { source: null, holderId, until: null };
    const cover = u.covers?.get(uid);
    if (cover) return { source: 'truc_thay', holderId: cover.absentUserId ?? holderId, until: cover.until };
    if (u.nicks.has(uid)) return { source: null, holderId, until: null };
    return { source: 'tra_loi_thay', holderId, until: null };
  }

  /**
   * `canDispatch` (docs 01 §2.9, PQ-51): re-checked when an approved item is really handed to a sender
   * (extension poll, MCP, OutboxDispatcher). The approver must still be an active user who may send on
   * that nick / thread (`canSend`, which also refuses an unsafe nick). Items approved by a token without
   * a user pass only while legacy tokens are allowed (dev / test). Refused items go to `needs_reapproval`.
   */
  async canDispatch(approvedBy: string, uid: string, threadId: string): Promise<{ allowed: true } | { allowed: false; reason: 'approver_offboarded' | 'approver_locked' | 'approver_no_send' }> {
    const user = await runUnscoped(() =>
      this.db.col<UserDoc>(C.users).findOne({ _id: approvedBy as never } as never, { projection: { status: 1 } }),
    );
    if (!user) return legacyTokensAllowed() ? { allowed: true } : { allowed: false, reason: 'approver_no_send' };
    if (user.status === 'nghi_viec') return { allowed: false, reason: 'approver_offboarded' };
    if (user.status !== 'hoat_dong') return { allowed: false, reason: 'approver_locked' };
    const d = await this.canSend(await this.subject(approvedBy), uid, threadId);
    return d.allowed ? { allowed: true } : { allowed: false, reason: 'approver_no_send' };
  }

  decide(u: Subject, key: PermissionKey, t: Target, opts?: DecideOptions): Decision {
    return decide(u, key, t, opts);
  }

  /**
   * `canSend(u, c)` (docs 01 §2.9) at channel level. Personal: nick holder / "Trực nick", or
   * `conv.reply_on_behalf` over the holder. Official: channel access `gui` and a role allowed to reply
   * (claim or reply on behalf: assignees arrive with M1b-09). Never quan_sat; never an unsafe nick.
   */
  async canSend(u: Subject, uid: string, threadId?: string): Promise<Decision> {
    if (!u.active) return { allowed: false, via: 'tai_khoan_khong_hoat_dong' };
    if (u.roles.some((r) => r.roleKey === 'quan_sat') && u.roles.every((r) => r.roleKey === 'quan_sat' || r.roleKey === 'admin')) {
      return { allowed: false, via: 'quan_sat' };
    }
    const t = threadId ? await this.conversationTarget(uid, threadId) : await this.channelTarget(uid);
    const unsafe = await runUnscoped(() =>
      this.db
        .col<{ _id: string; safety?: string; unsafe?: boolean }>(C.accounts)
        .countDocuments({ _id: uid as never, $or: [{ safety: 'chua_an_toan' }, { unsafe: true }] }, { limit: 1 }),
    );
    if (unsafe) return { allowed: false, via: 'nick_chua_an_toan' };
    if (t.channelKind === 'personal') {
      if (u.nicks.has(uid)) return { allowed: true, via: 'NICK' };
      const onBehalf = decide(u, 'conv.reply_on_behalf', t);
      if (onBehalf.allowed && t.unitIds?.length) return { allowed: true, via: `tra_loi_thay:${onBehalf.via}` };
      const grant = decide(u, 'conv.reply', { grantTargets: t.grantTargets });
      return grant.via === 'YC' && grant.allowed ? grant : { allowed: false, via: 'chua_duoc_gan_nick' };
    }
    if (!u.channelLevels.get(uid)?.has('gui')) {
      const grant = decide(u, 'conv.reply', { grantTargets: t.grantTargets });
      return grant.allowed && grant.via === 'YC' ? grant : { allowed: false, via: 'kenh_chua_gan_muc_gui' };
    }
    for (const key of ['conv.reply', 'conv.claim', 'conv.reply_on_behalf'] as const) {
      const d = decide(u, key, t);
      if (d.allowed) return d;
    }
    return { allowed: false, via: 'ngoai_pham_vi' };
  }

  /**
   * Data scope of a subject for a key (default `conv.view`): every channel where the engine allows the key
   * on the channel as a whole, plus conversations opened by grants. Null = no restriction (TĐ / ✅).
   */
  async dataScope(u: Subject, key: PermissionKey = 'conv.view'): Promise<DataScope | null> {
    // A nick awaiting confirmation (M1b-06) is hidden from everybody; read fresh, not from the 30 s cache.
    const pending = new Set(
      (await runUnscoped(() => this.db.col<{ _id: string }>(C.accounts).find({ status: 'cho_xac_nhan' }, { projection: { _id: 1 } }).toArray())).map((a) => a._id),
    );
    if (u.active && u.roles.some((r) => (rowOf(r)[key]?.s ?? []).some((s) => s === 'TD' || s === 'ALL') && !rowOf(r)[key]?.cond)) {
      return pending.size ? { channels: (await this.facts()).channels.map((c) => c.uid).filter((x) => !pending.has(x)), conversations: [] } : null;
    }
    const f = await this.facts();
    const channels: string[] = [];
    if (u.active) {
      for (const c of f.channels) {
        const t: Target = { channelId: c.uid, channelKind: c.kind, divisionId: c.divisionId, unitIds: c.holderUnits, grantTargets: [`channel:${c.uid}`] };
        if (!pending.has(c.uid) && decide(u, key, t).allowed) channels.push(c.uid);
      }
    }
    const conversations = u.active ? u.grants.filter((g) => g.target.startsWith('conversation:')).map((g) => g.target.slice('conversation:'.length)) : [];
    return { channels, conversations };
  }

  /**
   * Who owns what, for the inbox scopes (M1b-09): nick holder per channel (personal channels; null = nobody
   * holds it) and the official channels, whose conversations are owned by an assignee instead.
   */
  async ownership(): Promise<{ holders: Map<string, string | null>; official: Set<string> }> {
    const f = await this.facts();
    return {
      holders: new Map(f.channels.map((c) => [c.uid, c.holderId])),
      official: new Set(f.channels.filter((c) => c.kind === 'official').map((c) => c.uid)),
    };
  }

  /**
   * Inbox scopes the subject may pick (MH-SZ-01 #4): "Của tôi" always; "Tất cả" when `conv.view` reaches
   * beyond the person's own work (unit, division, group, channel or everything); "Chưa phân công" with
   * `conv.view_unassigned` for those who see more than their own (NVKD only has "Của tôi", SZ-18).
   */
  inboxScopes(u: Subject): InboxScope[] {
    const perms = effectivePermissions(u);
    const own: ScopeCode[] = ['CT', 'NICK', 'SELF', 'YC'];
    const seesMore = (perms['conv.view']?.scopes ?? []).some((s) => !own.includes(s));
    const out: InboxScope[] = ['mine'];
    if (seesMore && perms['conv.view_unassigned']) out.push('unassigned');
    if (seesMore) out.push('all');
    return out;
  }

  /** Phone visibility of identities on channel `uid` (MH-PQ-12). */
  async phoneOn(u: Subject, uid: string): Promise<'full' | 'reveal' | 'masked'> {
    return phoneVisibility(u, await this.channelTarget(uid));
  }

  /** Unit ids of a user's active assignments (org / user targets). */
  async unitsOf(userId: string): Promise<string[]> {
    return (await this.facts()).unitsOfUser.get(userId) ?? [];
  }

  async unitFacts(id: string): Promise<{ divisionId: string | null; ancestors: string[] } | null> {
    const f = await this.facts();
    const u = f.units.get(id);
    if (!u) return null;
    const ancestors: string[] = [];
    let p = u.parentId;
    while (p && !ancestors.includes(p)) {
      ancestors.push(p);
      p = f.units.get(p)?.parentId ?? null;
    }
    return { divisionId: u.divisionId, ancestors };
  }

  /**
   * Org units the subject may see for `key` (org.view): allowed units plus their ancestors, so the tree
   * keeps its path (UAT-PQ-02: "Tập đoàn › VCparts › Tổ HN1"). Null = all.
   */
  async visibleUnits(u: Subject, key: PermissionKey): Promise<Set<string> | null> {
    const f = await this.facts();
    const out = new Set<string>();
    let all = true;
    for (const unit of f.units.values()) {
      if (decide(u, key, { divisionId: unit.divisionId, unitIds: [unit._id] }).allowed) {
        out.add(unit._id);
        let p = unit.parentId;
        while (p && !out.has(p)) {
          out.add(p);
          p = f.units.get(p)?.parentId ?? null;
        }
      } else all = false;
    }
    if (all && decide(u, key, { divisionId: null, unitIds: [] }).allowed) return null;
    return out;
  }

  /** Whether the subject may act with `key` on user `userId` (user.view, user.lock…). */
  async canOnUser(u: Subject, key: PermissionKey, userId: string): Promise<boolean> {
    const f = await this.facts();
    const units = f.unitsOfUser.get(userId) ?? [];
    const divisionId = units.map((x) => f.units.get(x)?.divisionId).find((d) => !!d) ?? null;
    return decide(u, key, { unitIds: units, divisionId, userId, selfIds: [userId] }).allowed;
  }

  /** The group approver of sensitive role changes (security_settings.groupApprover, Q-PQ-17). */
  async isGroupApprover(userId: string): Promise<boolean> {
    const s = await runUnscoped(() =>
      this.db.col<{ _id: string; groupApprover?: string }>(ORG_C.securitySettings).findOne({ _id: 'main' }),
    );
    return !!s?.groupApprover && s.groupApprover === userId;
  }

  /**
   * Approver of a temporary grant on channel `uid` (PQ-30): the manager of the nearest unit that covers
   * both the requester and the target (same team: its supervisor; other team of the division: the division
   * director). Across divisions, or when nobody covers both, the director of the target's division.
   * A manager never approves his own request: the search goes one level up.
   */
  async grantApprover(requesterId: string, uid: string): Promise<{ userId: string; fullName: string } | null> {
    const f = await this.facts();
    const chain = (id: string): string[] => {
      const out: string[] = [];
      for (let x: string | null = id; x && !out.includes(x); x = f.units.get(x)?.parentId ?? null) out.push(x);
      return out;
    };
    const channel = f.channels.find((c) => c.uid === uid);
    const requester = new Set((f.unitsOfUser.get(requesterId) ?? []).flatMap(chain));
    const start: string[] = [];
    for (const tu of channel?.holderUnits ?? []) {
      const common = chain(tu).find((x) => requester.has(x) && f.units.get(x)?.type !== 'goc');
      if (common) start.push(common);
    }
    const divisionId = channel?.divisionId ?? defaultDivision();
    if (!start.length && divisionId) start.push(divisionId);
    for (const first of start) {
      for (const id of chain(first)) {
        const m = f.units.get(id)?.managerUserId;
        if (m && m !== requesterId) {
          const user = await runUnscoped(() => this.db.col<UserDoc>(C.users).findOne({ _id: m as never }, { projection: { fullName: 1 } }));
          return { userId: m, fullName: user?.fullName ?? m };
        }
      }
    }
    return null;
  }

  /**
   * Whether the user may reply in a conversation, with the 00 MH-UI-08 / 01 MH-PQ-11 reason when not,
   * how the reply goes out (own nick / trực thay / trả lời thay, QT-SZ-10) and whether opening it may
   * fetch content or mark it read on Zalo (SZ-23: only the holder or the cover).
   */
  async conversationAccess(p: Principal, id: string): Promise<ConversationAccess> {
    if (!p.userId) return { canReply: this.legacyAllowed(p), replyReason: null, autoFetch: true, canFetchOnBehalf: false, sendMode: null };
    const u = await this.subject(p.userId);
    const sep = id.indexOf(':');
    const uid = sep > 0 ? id.slice(0, sep) : id;
    const threadId = sep > 0 ? id.slice(sep + 1) : '';
    const d = await this.canSend(u, uid, threadId || undefined);
    const personal = (await this.channelTarget(uid)).channelKind === 'personal';
    const autoFetch = !personal || u.nicks.has(uid);
    const canFetchOnBehalf = personal && !autoFetch && decide(u, 'conv.reply_on_behalf', await this.channelTarget(uid)).allowed;
    const mode = await this.sendModeOf(u, uid);
    const names = await this.userNames([mode.holderId]);
    const nick = personal
      ? await runUnscoped(() => this.db.col<{ _id: string; label?: string }>(C.accounts).findOne({ _id: uid as never }, { projection: { label: 1 } }))
      : null;
    const facts = {
      autoFetch,
      canFetchOnBehalf,
      holderName: personal && mode.holderId ? (names.get(mode.holderId) ?? null) : null,
      nickLabel: nick ? (nick.label ?? uid) : null,
    };
    if (d.allowed) {
      return { canReply: true, replyReason: null, sendMode: mode.source, coverUntil: mode.until ? mode.until.toISOString() : null, ...facts };
    }
    const view = decide(u, 'conv.view', await this.conversationTarget(uid, threadId));
    const reason =
      d.via === 'nick_chua_an_toan'
        ? 'Nick này chưa an toàn: chưa xác nhận đăng xuất Zalo trên thiết bị cũ. Nhờ Admin hoặc Giám đốc bán hàng xác nhận.'
        : view.allowed
          ? 'Bạn chỉ có quyền xem hội thoại này.'
          : 'Bạn không có quyền trả lời hội thoại này.';
    return { canReply: false, replyReason: reason, sendMode: null, ...facts };
  }

  /** `GET /api/me/permissions`. */
  async me(p: Principal): Promise<MePermissions> {
    if (!p.userId) {
      return { userId: null, legacy: this.legacyAllowed(p), roles: [], permissions: {}, heldChannels: [] };
    }
    const u = await this.subject(p.userId);
    const f = await this.facts();
    // Collection of ZaloFarmService (not imported: that service depends on this one).
    const slots = await this.db
      .col<{ holderUserId: string; state: string }>('zalo_slots')
      .countDocuments({ holderUserId: p.userId, state: { $ne: 'da_ngat' } }, { limit: 1 });
    return {
      userId: p.userId,
      legacy: false,
      roles: u.roles.map((r) => ({
        roleKey: r.roleKey as RoleKey,
        ...(r.custom ? { customRoleId: r.custom.id, customRoleName: r.custom.name } : {}),
        orgUnitId: r.unitId,
        orgUnitName: f.units.get(r.unitId)?.name ?? r.unitId,
        lead: r.isManager,
      })),
      permissions: effectivePermissions(u),
      heldChannels: [...u.nicks],
      zaloSlotHolder: slots > 0,
    };
  }
}
