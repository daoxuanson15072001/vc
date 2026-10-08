import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import {
  HANDOVER_TEXT,
  PRESENCE_LABELS,
  foldVi,
  type HandoverInput,
  type HandoverPlanPreview,
  type HandoverPreviewInput,
  type HandoverResult,
  type OffboardPreview,
  type RoleKey,
} from '@vclinks/shared';
import { randomBytes } from 'node:crypto';
import type { AnyBulkWriteOperation } from 'mongodb';
import { TokenService, type TokenDoc } from '../auth/token.service';
import { AUTHZ_C, type AccessGrantDoc, type ChannelAccessDoc } from '../authz/authz.types';
import { AuthzService } from '../authz/authz.service';
import type { Subject } from '../authz/engine';
import { CUST_C, type CustomerAccountDoc, type IdentityLinkDoc } from '../customers/customers.types';
import { C, DbService } from '../db/db.service';
import { runsBackgroundJobs } from '../db/role';
import { DEFAULT_TENANT, currentTenant, runAsTenant, runUnscoped } from '../db/tenant-context';
import { NotificationsService } from '../notifications/notifications.service';
import { ORG_C, type OrgUnitDoc, type RoleAssignmentDoc } from '../org/org.types';
import { SYSTEM_ACTOR, holdItems } from '../outbox/outbox-hold';
import type { UserDoc } from '../users/users.service';

/** Roles that may receive customers and nicks of a person who left (MH-PQ-04 #7). */
const RECEIVER_ROLES: RoleKey[] = ['nvkd', 'giam_sat_bh'];
const HOUR = 3600_000;
const VN_OFFSET = 7 * HOUR;
/** The unsafe-nick reminder goes out daily from 08:30 Vietnam time (PQ-51). */
const DAILY_REMINDER_MINUTE = 8 * 60 + 30;

export const HANDOVERS_COLLECTION = 'handovers';

export interface HandoverDoc {
  _id: string;
  userId: string;
  userName: string;
  by: string;
  at: Date;
  effectiveAt: Date;
  mode: string;
  /** Counts and ids only, never message text or phone numbers. */
  customers: { count: number; byReceiver: { userId: string; count: number }[] };
  conversationsMoved: number;
  channels: {
    uid: string;
    label: string;
    toUserId: string;
    phoneLogoutConfirmed: boolean;
    confirmedBy?: string;
    confirmedAt?: Date;
    note?: string;
    checklist: { qrRescanned: boolean };
  }[];
  status: 'hoan_tat';
  tenant_id?: string;
}

/** What `UserDoc` carries for the offboarding clock (PQ-34); written here only. */
type LeaverDoc = UserDoc & { handoverDoneAt?: Date; remind4At?: Date; remind20At?: Date; fallbackAt?: Date; presence?: { status?: string; until?: Date } };

type AccountDoc = { _id: string; label?: string; divisionId?: string | null; unsafe?: boolean; safety?: string; status?: string };

const newId = (prefix: string) => `${prefix}${randomBytes(6).toString('hex')}`;
const vnDate = (d: Date) => {
  const l = new Date(d.getTime() + VN_OFFSET);
  return `${String(l.getUTCDate()).padStart(2, '0')}/${String(l.getUTCMonth() + 1).padStart(2, '0')}`;
};

export interface HandoverActor {
  /** User id, or null for a token without a user (dev / tests). */
  userId: string | null;
  name: string;
}

/**
 * Leaving the company (MH-PQ-04, PQ-33/34/51, QT-SZ-11, GS-05): the part after "Khóa ngay". Step 1 (lock,
 * sessions, grants, device tokens, waiting commands) is `onOffboard`; steps 2-4 move customers, the open
 * conversations that follow them and the nicks in one call, record the handover, and mark a nick
 * "Chưa an toàn" until somebody confirms Zalo was logged out on the old phone (D29, D41). Nothing here
 * stores a password or message text.
 */
@Injectable()
export class HandoverService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HandoverService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    private readonly tokens: TokenService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    if (!runsBackgroundJobs() || process.env.HANDOVER_JOBS === 'off') return;
    this.timer = setInterval(() => void this.tick(), 5 * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private get users() {
    return this.db.col<LeaverDoc>(C.users);
  }
  private get handovers() {
    return this.db.col<HandoverDoc>(HANDOVERS_COLLECTION);
  }

  // ---------- step 1 (called by PeopleService.offboard) ----------

  /** Device tokens of the nicks the person holds, or held by him (MH-PQ-04 #4a). */
  async deviceTokensOf(userId: string) {
    const nicks = await this.heldNicks(userId);
    const docs = await runUnscoped(() =>
      this.db
        .col<TokenDoc>(C.apiTokens)
        .find({ ...this.tenantFilter(), kind: 'device', revokedAt: { $exists: false }, $or: [{ userId }, ...(nicks.length ? [{ uids: { $in: nicks } }] : [])] } as never)
        .toArray(),
    );
    return docs.map((d) => ({ id: d._id, name: d.name, deviceName: d.deviceName ?? null, uids: d.uids ?? [] }));
  }

  private tenantFilter() {
    const t = currentTenant();
    return t === DEFAULT_TENANT ? { $or: [{ tenant_id: t }, { tenant_id: { $exists: false } }] } : { tenant_id: t };
  }

  /**
   * Cuts what a person who left still holds: personal MCP tokens, device tokens (except the ones an Admin
   * keeps as shared company machines), live grants given to him and covers he gave or got.
   */
  async onOffboard(userId: string, keepDeviceTokenIds: string[], actor: HandoverActor) {
    const devices = await this.deviceTokensOf(userId);
    const keep = new Set(keepDeviceTokenIds);
    const revokeIds = devices.filter((d) => !keep.has(d.id)).map((d) => d.id);
    const now = new Date();
    const revoked = await runUnscoped(async () => {
      const col = this.db.col<TokenDoc>(C.apiTokens);
      const a = await col.updateMany(
        { ...this.tenantFilter(), kind: 'mcp_user', userId, revokedAt: { $exists: false } } as never,
        { $set: { revokedAt: now, revokedReason: 'nghi_viec', revokedBy: actor.name } },
      );
      const b = revokeIds.length
        ? await col.updateMany({ _id: { $in: revokeIds } as never, ...this.tenantFilter() } as never, { $set: { revokedAt: now, revokedReason: 'nghi_viec', revokedBy: actor.name } })
        : { modifiedCount: 0 };
      return { mcp: a.modifiedCount, devices: b.modifiedCount };
    });
    this.tokens.forgetCache();
    const grants = await runUnscoped(() =>
      this.db
        .col<AccessGrantDoc>(AUTHZ_C.accessGrants)
        .updateMany({ status: 'hieu_luc', $or: [{ userId }, { absentUserId: userId }] }, { $set: { status: 'thu_hoi' } }),
    );
    this.authz.invalidate();
    await this.db.audit(actor.name, 'token.revoke_all', userId, { reason: 'nghi_viec', mcp: revoked.mcp, devices: revoked.devices, kept: keep.size });
    // Admin, GĐ and GS of the person learn at once (PQ-33), so devices can be collected.
    const { managers, admins } = await this.overseers(userId);
    const u = await this.user(userId);
    await this.notifications.notify([...managers, ...admins], 'offboard', `Đã khóa tài khoản ${u.fullName} (nghỉ việc). Cần bàn giao khách và nick trong 24 giờ.`, `/admin/users/${userId}/offboard`);
    return { devices: revoked.devices, mcpTokens: revoked.mcp, grants: grants.modifiedCount };
  }

  // ---------- reads ----------

  private async user(id: string): Promise<LeaverDoc> {
    const u = await runUnscoped(() => this.users.findOne({ _id: id as never }));
    if (!u) throw new NotFoundException('Không tìm thấy người dùng.');
    return u;
  }

  private async heldNicks(userId: string): Promise<string[]> {
    const rows = await runUnscoped(() => this.db.col<ChannelAccessDoc>(AUTHZ_C.channelAccess).find({ principalType: 'user', principalId: userId, level: 'giu_nick' }).toArray());
    return rows.map((r) => r.channelId);
  }

  private customersOf(userId: string) {
    return runUnscoped(() =>
      this.db
        .col<CustomerAccountDoc>(CUST_C.accounts)
        .find({ 'owners.userId': userId, status: 'active', erasedAt: null } as never)
        .sort({ _id: 1 })
        .toArray(),
    );
  }

  /** People the actor may hand customers and nicks to (step 2 and 3 selects). */
  async receivers(userId: string, actor: HandoverActor, subject: Subject | null) {
    const map = await this.eligibleReceivers(actor, subject);
    map.delete(userId);
    return [...map.values()].map((u) => ({ id: String(u._id), name: u.fullName })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  /** Step 2 table "Chọn từng khách": id, name, region, tags. No phone, no message text. */
  async customerList(userId: string) {
    await this.user(userId);
    return (await this.customersOf(userId)).slice(0, 2000).map((a) => ({ id: a._id, name: a.name, region: a.region, tags: a.tags }));
  }

  private async openConversationIds(accountIds: string[], leaverId: string): Promise<{ ids: string[]; byIdentity: Map<string, string> }> {
    if (!accountIds.length) return { ids: [], byIdentity: new Map() };
    const links = await runUnscoped(() => this.db.col<IdentityLinkDoc>(CUST_C.identityLinks).find({ accountId: { $in: accountIds } }, { projection: { _id: 1, accountId: 1 } }).toArray());
    const byIdentity = new Map(links.map((l) => [l._id, l.accountId]));
    const convs = await runUnscoped(() =>
      this.db
        .col<{ _id: string; status?: string; assigneeId?: string | null }>(C.conversations)
        .find({ _id: { $in: [...byIdentity.keys()] as never[] }, status: { $ne: 'done' } } as never, { projection: { _id: 1, assigneeId: 1 } })
        .toArray(),
    );
    void leaverId;
    return { ids: convs.map((c) => String(c._id)), byIdentity };
  }

  async preview(userId: string): Promise<OffboardPreview> {
    const u = await this.user(userId);
    const accounts = await this.customersOf(userId);
    const nicks = await this.heldNicks(userId);
    const [accDocs, units, devices, pending, load] = await Promise.all([
      runUnscoped(() => this.db.col<AccountDoc>(C.accounts).find({ _id: { $in: nicks as never[] } } as never).toArray()),
      runUnscoped(() => this.db.col<OrgUnitDoc>(ORG_C.orgUnits).find({ managerUserId: userId } as never).toArray()),
      this.deviceTokensOf(userId),
      runUnscoped(() => this.db.col(C.suggestions).countDocuments({ approvedBy: userId, status: { $in: ['approved', 'failed', 'expired', 'needs_reapproval'] } } as never)),
      Promise.all(nicks.map((uid) => this.nickLoad(uid))),
    ]);
    const open = await this.openConversationIds(accounts.map((a) => a._id), userId);
    const lockedAt = u.leftAt ?? null;
    return {
      userId,
      fullName: u.fullName,
      status: u.status,
      deviceTokens: devices,
      pendingCommands: pending,
      managedUnits: units.map((x) => ({ id: x._id, name: x.name })),
      customers: accounts.length,
      openConversations: open.ids.length,
      nicks: accDocs.map((a) => ({ uid: a._id, label: a.label ?? a._id, unsafe: !!(a.unsafe || a.safety === 'chua_an_toan') })),
      nickLoad: load,
      lockedAt: lockedAt?.toISOString() ?? null,
      deadlineAt: lockedAt ? new Date(lockedAt.getTime() + 24 * HOUR).toISOString() : null,
    };
  }

  /** What stays on a nick for the new holder (11c): counts only. */
  private async nickLoad(uid: string) {
    const [needsReapproval, pendingFriendRequests, unansweredConversations] = await runUnscoped(() =>
      Promise.all([
        this.db.col(C.suggestions).countDocuments({ uid, status: 'needs_reapproval' } as never),
        this.db.col(C.friendRequests).countDocuments({ uid, status: 'pending' } as never),
        this.db.col(C.conversations).countDocuments({ uid, unansweredSince: { $ne: null }, status: { $ne: 'done' } } as never),
      ]),
    );
    return { uid, needsReapproval, pendingFriendRequests, unansweredConversations };
  }

  // ---------- plan (step 2) ----------

  /** Users the actor may hand things to: active, a receiver role, inside the actor's units. */
  private async eligibleReceivers(actor: HandoverActor, subject: Subject | null) {
    const now = Date.now();
    const as = await runUnscoped(() => this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments).find({ roleKey: { $in: RECEIVER_ROLES } } as never).toArray());
    const live = as.filter((a) => (!a.from || a.from.getTime() <= now) && (!a.to || a.to.getTime() > now));
    const scope = subject ? new Set(subject.roles.flatMap((r) => [...r.subtree])) : null;
    const inScope = live.filter((a) => !scope || scope.has(a.orgUnitId));
    const ids = [...new Set(inScope.map((a) => a.userId))];
    const users = ids.length ? await runUnscoped(() => this.users.find({ _id: { $in: ids as never[] }, status: 'hoat_dong' } as never).toArray()) : [];
    void actor;
    return new Map(users.map((x) => [String(x._id), x]));
  }

  private async absence(userIds: string[], now: Date): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!userIds.length) return out;
    const users = await runUnscoped(() => this.users.find({ _id: { $in: userIds as never[] } } as never).toArray());
    for (const u of users) {
      const p = u.presence;
      if (!p?.status || (p.until && p.until.getTime() <= now.getTime())) continue;
      if (p.status === 'away' || p.status === 'offline') out.set(String(u._id), PRESENCE_LABELS[p.status]);
    }
    const leaves = await runUnscoped(() =>
      this.db.col<AccessGrantDoc>(AUTHZ_C.accessGrants).find({ type: 'truc_thay', status: 'hieu_luc', absentUserId: { $in: userIds }, from: { $lte: now }, to: { $gt: now } }).toArray(),
    );
    for (const g of leaves) out.set(g.absentUserId!, `Nghỉ phép tới ${vnDate(g.to!)}`);
    return out;
  }

  private async buildPlan(leaver: LeaverDoc, input: HandoverPreviewInput, actor: HandoverActor, subject: Subject | null, now = new Date()) {
    const accounts = await this.customersOf(leaver._id);
    const eligible = await this.eligibleReceivers(actor, subject);
    eligible.delete(leaver._id);
    const named = (id: string) => eligible.get(id)?.fullName ?? id;
    for (const id of [...input.toUserIds, ...Object.values(input.picks)]) {
      if (!eligible.has(id)) throw new BadRequestException('Người nhận phải là NVKD hoặc giám sát đang hoạt động trong phạm vi bàn giao của bạn.');
    }
    const picks = new Map(Object.entries(input.picks).filter(([acc]) => accounts.some((a) => a._id === acc)));
    const excluded: HandoverPlanPreview['excluded'] = [];
    let receivers = [...new Set(input.toUserIds)];
    if (input.mode === 'one' && receivers.length !== 1) throw new BadRequestException('Chọn đúng một người nhận.');
    if ((input.mode === 'even' || input.mode === 'region') && !receivers.length) throw new BadRequestException('Chọn ít nhất một người nhận.');
    if (input.mode === 'even' || input.mode === 'region') {
      // DK-62: "Chia đều" / "Theo khu vực" skip people who are Vắng, Ngoại tuyến or on leave.
      const away = await this.absence(receivers, now);
      for (const id of receivers) if (away.has(id)) excluded.push({ userId: id, name: named(id), reason: away.get(id)! });
      receivers = receivers.filter((id) => !away.has(id));
      if (!receivers.length) throw new BadRequestException('Mọi người nhận đã chọn đều đang vắng. Chọn người khác hoặc chọn tay.');
    }
    const to = new Map<string, string>();
    const rest = accounts.filter((a) => !picks.has(a._id));
    const load = new Map<string, number>(receivers.map((id) => [id, 0]));
    const give = (accId: string, id: string) => {
      to.set(accId, id);
      load.set(id, (load.get(id) ?? 0) + 1);
    };
    const lightest = () => [...load.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]![0];
    for (const [acc, id] of picks) to.set(acc, id);
    if (input.mode === 'one') for (const a of rest) give(a._id, receivers[0]!);
    else if (input.mode === 'even') for (const a of rest) give(a._id, lightest());
    else if (input.mode === 'region') {
      const groups = new Map<string, CustomerAccountDoc[]>();
      for (const a of rest) {
        const k = a.region ?? a.tags[0] ?? '';
        (groups.get(k) ?? groups.set(k, []).get(k)!).push(a);
      }
      for (const g of [...groups.values()].sort((x, y) => y.length - x.length)) {
        const id = lightest();
        for (const a of g) give(a._id, id);
      }
    } else if (rest.length) {
      throw new BadRequestException(`Còn ${rest.length} khách chưa có người nhận.`);
    }
    const byRecv = new Map<string, { customers: number; gradeA: number }>();
    for (const a of accounts) {
      const id = to.get(a._id)!;
      const row = byRecv.get(id) ?? { customers: 0, gradeA: 0 };
      row.customers++;
      if (a.tags.some((t) => foldVi(t) === 'hang a')) row.gradeA++;
      byRecv.set(id, row);
    }
    const rows = [...byRecv.entries()].map(([userId, r]) => ({ userId, name: named(userId), customers: r.customers, revenue12m: null, gradeA: r.gradeA }));
    return { accounts, to, plan: { rows, excluded, total: accounts.length } as HandoverPlanPreview, eligible };
  }

  async previewPlan(userId: string, input: HandoverPreviewInput, actor: HandoverActor, subject: Subject | null): Promise<HandoverPlanPreview> {
    const leaver = await this.user(userId);
    if (leaver.status !== 'nghi_viec') throw new ConflictException(HANDOVER_TEXT.notLocked);
    return (await this.buildPlan(leaver, input, actor, subject)).plan;
  }

  // ---------- steps 2-4: complete ----------

  async complete(userId: string, input: HandoverInput, actor: HandoverActor, subject: Subject | null, now = new Date()): Promise<HandoverResult> {
    const leaver = await this.user(userId);
    if (leaver.status !== 'nghi_viec') throw new ConflictException(HANDOVER_TEXT.notLocked);
    if (input.effectiveAt && new Date(input.effectiveAt).getTime() > now.getTime() + 60_000) {
      throw new BadRequestException('Chưa hỗ trợ hẹn giờ hiệu lực: bàn giao có hiệu lực ngay khi bấm Hoàn tất.');
    }
    const { accounts, to, plan, eligible } = await this.buildPlan(leaver, input, actor, subject, now);

    // Nicks: every held nick needs a new holder (step 3).
    const held = await this.heldNicks(userId);
    const chosen = new Map(input.channels.map((c) => [c.uid, c]));
    for (const c of input.channels) if (!held.includes(c.uid)) throw new BadRequestException('Nick này không do người nghỉ việc giữ.');
    const missing = held.filter((u) => !chosen.has(u));
    if (missing.length) throw new BadRequestException(`Còn ${missing.length} nick chưa có người giữ mới.`);
    const accDocs = new Map((await runUnscoped(() => this.db.col<AccountDoc>(C.accounts).find({ _id: { $in: held as never[] } } as never).toArray())).map((a) => [String(a._id), a]));
    const dflt = process.env.AUTHZ_DEFAULT_DIVISION?.trim() || null;
    for (const c of input.channels) {
      const recv = eligible.get(c.toUserId);
      if (!recv) throw new BadRequestException('Người giữ nick mới phải là NVKD hoặc giám sát đang hoạt động trong phạm vi bàn giao của bạn.');
      const division = accDocs.get(c.uid)?.divisionId ?? dflt;
      const divisions = await this.divisionsOf(c.toUserId);
      if (division && divisions.length && !divisions.includes(division)) throw new ConflictException(`${recv.fullName} thuộc division khác. Gán chéo division cần người duyệt thứ hai (PQ-42), chưa có ở bản này.`);
      if (c.phoneLogoutConfirmed && subject) {
        const d = await this.authz.decide(subject, 'channel.safety_confirm', await this.authz.channelTarget(c.uid));
        if (!d.allowed) throw new ForbiddenException('Bạn không có quyền xác nhận đã đăng xuất nick này (Admin, GĐ hoặc người giữ nick).');
      }
    }

    // --- apply: every write only touches what the leaver still owns, so a retry is safe ---
    const byIdentity = new Map<string, string>();
    const links = accounts.length
      ? await runUnscoped(() => this.db.col<IdentityLinkDoc>(CUST_C.identityLinks).find({ accountId: { $in: accounts.map((a) => a._id) } }, { projection: { _id: 1, accountId: 1 } }).toArray())
      : [];
    for (const l of links) byIdentity.set(l._id, to.get(l.accountId)!);
    await runUnscoped(async () => {
      const ops: AnyBulkWriteOperation<CustomerAccountDoc>[] = accounts.map((a) => {
        const dest = to.get(a._id)!;
        const owners = a.owners.map((o) => (o.userId === userId ? { ...o, userId: dest, since: now, source: 'manual' as const } : o));
        const seen = new Set<string>();
        const deduped = owners.filter((o) => (seen.has(`${o.division}:${o.userId}`) ? false : (seen.add(`${o.division}:${o.userId}`), true)));
        return { updateOne: { filter: { _id: a._id, 'owners.userId': userId } as never, update: { $set: { owners: deduped, updatedAt: now } } } };
      });
      if (ops.length) await this.db.col<CustomerAccountDoc>(CUST_C.accounts).bulkWrite(ops, { ordered: false });
    });

    // Conversations assigned to him follow the customer; the rest go back to the nick holder.
    const conv = this.db.col<{ _id: string; assigneeId?: string | null }>(C.conversations);
    let conversationsMoved = 0;
    await runUnscoped(async () => {
      const by = new Map<string, string[]>();
      for (const [identity, dest] of byIdentity) (by.get(dest) ?? by.set(dest, []).get(dest)!).push(identity);
      for (const [dest, ids] of by) {
        const r = await conv.updateMany({ _id: { $in: ids as never[] }, assigneeId: userId } as never, { $set: { assigneeId: dest } });
        conversationsMoved += r.modifiedCount;
      }
      const r2 = await conv.updateMany({ assigneeId: userId } as never, { $set: { assigneeId: null } });
      conversationsMoved += r2.modifiedCount;
    });

    // Nicks and their checklist (QT-SZ-11).
    const accountsCol = this.db.col<AccountDoc & Record<string, unknown>>(C.accounts);
    const channels: HandoverDoc['channels'] = [];
    let unsafeNicks = 0;
    const access = this.db.col<ChannelAccessDoc>(AUTHZ_C.channelAccess);
    for (const c of input.channels) {
      const acc = accDocs.get(c.uid);
      await runUnscoped(async () => {
        await access.deleteMany({ channelId: c.uid, level: 'giu_nick' } as never);
        const doc: ChannelAccessDoc = {
          _id: `${c.uid}:user:${c.toUserId}:giu_nick`,
          channelId: c.uid,
          principalType: 'user',
          principalId: c.toUserId,
          level: 'giu_nick',
          from: now,
          to: null,
          createdBy: actor.name,
          note: 'Bàn giao nghỉ việc',
        };
        await access.replaceOne({ _id: doc._id } as never, doc, { upsert: true });
        if (c.phoneLogoutConfirmed) {
          await accountsCol.updateOne({ _id: c.uid } as never, { $set: { unsafe: false, safety: 'an_toan', safetyConfirmedBy: actor.userId ?? actor.name, safetyConfirmedAt: now } });
        } else {
          unsafeNicks++;
          await accountsCol.updateOne({ _id: c.uid } as never, { $set: { unsafe: true, safety: 'chua_an_toan', unsafeReason: 'handover', unsafeSince: now } });
        }
        // The new holder re-approves what is still waiting on this nick (holder changed, PQ-51).
        await holdItems(this.db, { uid: c.uid }, 'holder_changed', now);
      });
      channels.push({
        uid: c.uid,
        label: acc?.label ?? c.uid,
        toUserId: c.toUserId,
        phoneLogoutConfirmed: c.phoneLogoutConfirmed,
        ...(c.phoneLogoutConfirmed ? { confirmedBy: actor.userId ?? actor.name, confirmedAt: now } : {}),
        ...(c.note ? { note: c.note } : {}),
        checklist: { qrRescanned: c.qrRescanned },
      });
      await this.db.audit(actor.name, 'channel.holder_change', c.uid, { from: userId, to: c.toUserId, reason: 'handover' });
    }
    // Whatever else the person had on a channel ends with him.
    await runUnscoped(() => access.deleteMany({ principalType: 'user', principalId: userId } as never));
    this.authz.invalidate();

    const id = newId('ho_');
    await this.handovers.insertOne({
      _id: id,
      userId,
      userName: leaver.fullName,
      by: actor.userId ?? actor.name,
      at: now,
      effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : now,
      mode: input.mode,
      customers: { count: accounts.length, byReceiver: plan.rows.map((r) => ({ userId: r.userId, count: r.customers })) },
      conversationsMoved,
      channels,
      status: 'hoan_tat',
    });
    await runUnscoped(() => this.users.updateOne({ _id: userId as never }, { $set: { handoverDoneAt: now } }));
    await this.db.audit(actor.name, 'user.handover', userId, {
      handoverId: id,
      customers: accounts.length,
      conversations: conversationsMoved,
      nicks: channels.length,
      unsafeNicks,
      receivers: plan.rows.length,
    });

    const names = [...new Set([...plan.rows.map((r) => r.name), ...channels.map((c) => eligible.get(c.toUserId)?.fullName ?? c.toUserId)])].join(', ');
    if (input.notifyReceivers) {
      for (const r of plan.rows) await this.notifications.notify([r.userId], 'handover', `Bạn nhận bàn giao ${r.customers} khách từ ${leaver.fullName}.`, '/customers');
      for (const c of channels) await this.notifications.notify([c.toUserId], 'handover', `Bạn giữ nick ${c.label} từ nay (bàn giao từ ${leaver.fullName}).`, '/channels');
    }
    return {
      id,
      customersMoved: accounts.length,
      conversationsMoved,
      nicksMoved: channels.length,
      unsafeNicks,
      message: HANDOVER_TEXT.done(accounts.length, channels.length, names || 'người nhận') + (unsafeNicks ? HANDOVER_TEXT.unsafe(unsafeNicks) : ''),
    };
  }

  private async divisionsOf(userId: string): Promise<string[]> {
    const as = await runUnscoped(() => this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments).find({ userId } as never).toArray());
    const units = await runUnscoped(() => this.db.col<OrgUnitDoc>(ORG_C.orgUnits).find({ _id: { $in: as.map((a) => a.orgUnitId) } as never } as never).toArray());
    return [...new Set(units.map((u) => u.divisionId).filter((d): d is string => !!d))];
  }

  // ---------- "Chưa an toàn" confirmation ----------

  /** A person with `channel.safety_confirm` records that Zalo was logged out of the old device (PQ-51). */
  async confirmSafe(uid: string, note: string | undefined, actor: HandoverActor) {
    const acc = await runUnscoped(() => this.db.col<AccountDoc>(C.accounts).findOne({ _id: uid as never }));
    if (!acc) throw new NotFoundException('Không tìm thấy nick.');
    if (!(acc.unsafe || acc.safety === 'chua_an_toan')) throw new ConflictException('Nick này không ở trạng thái "Chưa an toàn".');
    const now = new Date();
    await runUnscoped(async () => {
      await this.db.col<AccountDoc & Record<string, unknown>>(C.accounts).updateOne(
        { _id: uid } as never,
        { $set: { unsafe: false, safety: 'an_toan', safetyConfirmedBy: actor.userId ?? actor.name, safetyConfirmedAt: now }, $unset: { unsafeReason: '', unsafeSince: '' } },
      );
      await this.handovers.updateMany(
        { 'channels.uid': uid } as never,
        { $set: { 'channels.$[c].phoneLogoutConfirmed': true, 'channels.$[c].confirmedBy': actor.userId ?? actor.name, 'channels.$[c].confirmedAt': now, ...(note ? { 'channels.$[c].note': note } : {}) } },
        { arrayFilters: [{ 'c.uid': uid }] },
      );
    });
    this.authz.invalidate();
    await this.db.audit(actor.name, 'channel.safety_confirm', uid, {});
    return { message: HANDOVER_TEXT.safeConfirmed(acc.label ?? uid) };
  }

  /** The handover records of a person (counts only), newest first. */
  async recordsOf(userId: string) {
    const rows = await this.handovers.find({ userId }).sort({ at: -1 }).toArray();
    return rows.map((r) => ({
      id: r._id,
      at: r.at.toISOString(),
      by: r.by,
      mode: r.mode,
      customers: r.customers.count,
      conversationsMoved: r.conversationsMoved,
      channels: r.channels.map((c) => ({ uid: c.uid, label: c.label, toUserId: c.toUserId, phoneLogoutConfirmed: c.phoneLogoutConfirmed, qrRescanned: c.checklist.qrRescanned })),
    }));
  }

  // ---------- clock: 4 h and 20 h reminders, 24 h fallback, daily unsafe reminder (PQ-34, PQ-51) ----------

  async tick(now = new Date()) {
    try {
      for (const tenant of await this.db.tenants()) await runAsTenant(tenant, () => this.processDue(now));
    } catch (e) {
      this.logger.warn(`Handover jobs failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Managers above a person's units (GS, GĐ…), nearest first, and the people with the Admin role. */
  private async overseers(userId: string): Promise<{ managers: string[]; admins: string[] }> {
    return runUnscoped(async () => {
      const as = await this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments).find({ userId } as never).toArray();
      const units = new Map((await this.db.col<OrgUnitDoc>(ORG_C.orgUnits).find({} as never).toArray()).map((u) => [u._id, u]));
      const managers: string[] = [];
      for (const a of as) {
        for (let x: string | null = a.orgUnitId, n = 0; x && n < 20; x = units.get(x)?.parentId ?? null, n++) {
          const u = units.get(x);
          if (u?.managerUserId && u.managerUserId !== userId && !managers.includes(u.managerUserId)) managers.push(u.managerUserId);
        }
      }
      const admins = (await this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments).find({ roleKey: { $in: ['admin', 'quan_sat'] } } as never).toArray()).map((a) => a.userId);
      return { managers, admins: [...new Set(admins)] };
    });
  }

  async processDue(now = new Date()) {
    const out = { reminded: 0, fallback: 0, unsafeReminders: 0, preLeaveDue: 0 };
    const leavers = await runUnscoped(() => this.users.find({ status: 'nghi_viec', handoverDoneAt: { $exists: false }, leftAt: { $exists: true } } as never).toArray());
    for (const u of leavers) {
      const age = now.getTime() - u.leftAt!.getTime();
      const { managers, admins } = await this.overseers(u._id);
      const who = [...managers, ...admins];
      for (const [hours, field] of [[4, 'remind4At'], [20, 'remind20At']] as const) {
        if (age >= hours * HOUR && !u[field]) {
          await this.notifications.notify(who, 'handover_reminder', `Còn khách và nick của ${u.fullName} chưa bàn giao xong (đã ${hours} giờ kể từ khi khóa).`, `/admin/users/${u._id}/offboard`);
          await runUnscoped(() => this.users.updateOne({ _id: u._id as never }, { $set: { [field]: now } }));
          out.reminded++;
        }
      }
      if (age >= 24 * HOUR && !u.fallbackAt) {
        await this.fallback(u, managers, now);
        out.fallback++;
      }
    }
    out.unsafeReminders = await this.remindUnsafe(now);
    out.preLeaveDue = await this.remindPreLeaveDue(now);
    return out;
  }

  /** After 24 h: customers go to "Chưa phân công", nicks to the old supervisor, who holds them temporarily (PQ-34). */
  private async fallback(u: LeaverDoc, managers: string[], now: Date) {
    const accounts = await this.customersOf(u._id);
    const links = accounts.length
      ? await runUnscoped(() => this.db.col<IdentityLinkDoc>(CUST_C.identityLinks).find({ accountId: { $in: accounts.map((a) => a._id) } }, { projection: { _id: 1 } }).toArray())
      : [];
    await runUnscoped(async () => {
      if (accounts.length) {
        await this.db.col<CustomerAccountDoc>(CUST_C.accounts).updateMany({ _id: { $in: accounts.map((a) => a._id) }, 'owners.userId': u._id } as never, { $pull: { owners: { userId: u._id } } as never, $set: { updatedAt: now } });
      }
      const conv = this.db.col(C.conversations);
      if (links.length) await conv.updateMany({ _id: { $in: links.map((l) => l._id) as never[] }, assigneeId: u._id } as never, { $set: { assigneeId: null } });
      await conv.updateMany({ assigneeId: u._id } as never, { $set: { assigneeId: null } });
    });
    const temp = managers[0] ?? null;
    const nicks = await this.heldNicks(u._id);
    for (const uid of nicks) {
      const access = this.db.col<ChannelAccessDoc>(AUTHZ_C.channelAccess);
      await runUnscoped(async () => {
        await access.deleteMany({ channelId: uid, level: 'giu_nick' } as never);
        if (temp) await access.replaceOne({ _id: `${uid}:user:${temp}:giu_nick` } as never, { _id: `${uid}:user:${temp}:giu_nick`, channelId: uid, principalType: 'user', principalId: temp, level: 'giu_nick', from: now, to: null, createdBy: SYSTEM_ACTOR, note: 'Giữ tạm sau 24 giờ chưa bàn giao' } as never, { upsert: true });
        await this.db.col<AccountDoc & Record<string, unknown>>(C.accounts).updateOne({ _id: uid } as never, { $set: { unsafe: true, safety: 'chua_an_toan', unsafeReason: 'handover', unsafeSince: now } });
        await holdItems(this.db, { uid }, 'holder_changed', now);
      });
    }
    await runUnscoped(() => this.users.updateOne({ _id: u._id as never }, { $set: { fallbackAt: now } }));
    this.authz.invalidate();
    await this.db.audit(SYSTEM_ACTOR, 'user.handover_fallback', u._id, { customers: accounts.length, nicks: nicks.length });
    await this.notifications.notify(managers, 'handover_fallback', `Quá 24 giờ: ${accounts.length} khách của ${u.fullName} về "Chưa phân công", ${nicks.length} nick gắn tạm cho giám sát.`, `/admin/users/${u._id}/offboard`);
  }

  /**
   * PQ-82: the day a "Sắp nghỉ" flag reaches its date, remind the managers and Admin / QS once a day to lock the
   * account and hand over (nothing is locked automatically). The text carries a name and a date, no customer data.
   */
  async remindPreLeaveDue(now: Date): Promise<number> {
    const local = new Date(now.getTime() + VN_OFFSET);
    if (local.getUTCHours() * 60 + local.getUTCMinutes() < DAILY_REMINDER_MINUTE) return 0;
    const today = local.toISOString().slice(0, 10);
    const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - VN_OFFSET + DAILY_REMINDER_MINUTE * 60_000);
    const due = await runUnscoped(() => this.users.find({ status: 'hoat_dong', 'preLeave.date': { $lte: today } } as never).toArray());
    let n = 0;
    for (const u of due) {
      const { managers, admins } = await this.overseers(u._id);
      const [dd, mm] = [u.preLeave!.date.slice(8, 10), u.preLeave!.date.slice(5, 7)];
      for (const uid of [...new Set([...managers, ...admins])]) {
        if (await this.notifications.sentSince(uid, `pre_leave_due:${u._id}`, dayStart)) continue;
        await this.notifications.notify([uid], `pre_leave_due:${u._id}`, `${u.fullName} đã tới ngày nghỉ dự kiến (${dd}/${mm}). Khóa tài khoản và bàn giao khách, nick nếu đã nghỉ.`, '/admin/users');
        n++;
      }
    }
    return n;
  }

  /** Every day from 08:30 (VN): remind GĐ, Admin, QS and the holder of each nick still "Chưa an toàn". */
  private async remindUnsafe(now: Date): Promise<number> {
    const local = new Date(now.getTime() + VN_OFFSET);
    if (local.getUTCHours() * 60 + local.getUTCMinutes() < DAILY_REMINDER_MINUTE) return 0;
    const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - VN_OFFSET + DAILY_REMINDER_MINUTE * 60_000);
    const unsafe = await runUnscoped(() => this.db.col<AccountDoc>(C.accounts).find({ $or: [{ unsafe: true }, { safety: 'chua_an_toan' }] } as never).toArray());
    let n = 0;
    for (const a of unsafe) {
      const holder = await this.authz.holderOf(a._id);
      const { admins } = await this.overseers(holder ?? '');
      const managers = await this.authz.managersOver(a._id);
      for (const uid of [...new Set([...(holder ? [holder] : []), ...managers, ...admins])]) {
        if (await this.notifications.sentSince(uid, `unsafe:${a._id}`, dayStart)) continue;
        await this.notifications.notify([uid], `unsafe:${a._id}`, `Nick ${a.label ?? a._id} chưa xác nhận đăng xuất khỏi điện thoại cũ. Chưa gửi được qua nick này.`, '/admin/channels');
        n++;
      }
    }
    return n;
  }
}
