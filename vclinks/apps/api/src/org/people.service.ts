import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  HANDOVER_TEXT,
  ORG_UNIT_TYPE_LABELS,
  ROLE_LABELS,
  ROLE_UNIT_TYPE,
  SELF_EDIT_MESSAGE,
  ROOT_UNIT_CODE,
  SENSITIVE_ROLES,
  foldVi,
  isCustomRoleId,
  roleUnitMessage,
  type AdminUser,
  type AssignmentInput,
  type PendingRoleChange,
  type RoleAssignment,
  type RoleKey,
  type UserInput,
  type UserPatch,
} from '@vclinks/shared';
import { randomBytes } from 'node:crypto';
import { SessionService } from '../auth/session.service';
import { TokenService } from '../auth/token.service';
import { holdApproverItems } from '../outbox/outbox-hold';
import type { Principal } from '../auth/token.service';
import { C, DbService } from '../db/db.service';
import { runAsTenant, runUnscoped } from '../db/tenant-context';
import type { UserDoc } from '../users/users.service';
import { HandoverService } from '../handover/handover.service';
import { CustomRolesService } from './custom-roles.service';
import { OrgService } from './org.service';
import {
  ORG_C,
  assignmentId,
  type CustomRoleDoc,
  type OrgUnitDoc,
  type RoleAssignmentDoc,
  type RoleChangeRequestDoc,
  type ScheduledChangeDoc,
} from './org.types';

const ACTIVE = ['hoat_dong', 'cho_kich_hoat'];

/** Who is acting. A dashboard session has a user id; a plain token does not. */
export interface Actor {
  id: string;
  userId: string | null;
}
export const actorOf = (p: Principal): Actor => ({ id: p.userId ?? `token:${p.name}`, userId: p.userId ?? null });

export type AddResult =
  | { applied: true; assignmentId: string }
  | { applied: false; requestId: string; approverRule: RoleChangeRequestDoc['approverRule']; message: string };

export interface AssignmentCheck {
  unit: OrgUnitDoc;
  sensitive: boolean;
  approverRule: RoleChangeRequestDoc['approverRule'];
  /** Name for messages: the custom role's name, else the system label. */
  roleName: string;
}

/**
 * Users as seen by administrators (MH-PQ-02, 03): role assignments, lock, unit change and the
 * "second person approves" requests (PQ-42). What a given caller is allowed to call is decided
 * by the permission engine of M1b-04; here only the data rules and PQ-41 (no self-edit) apply.
 */
@Injectable()
export class PeopleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PeopleService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: DbService,
    private readonly org: OrgService,
    private readonly sessions: SessionService,
    private readonly handover: HandoverService,
    private readonly tokenSvc: TokenService,
    private readonly customRoles: CustomRolesService,
  ) {}

  onModuleInit() {
    // Scheduled unit changes (UAT-PQ-93) are applied within about a minute of their time.
    this.timer = setInterval(() => {
      void this.applyDueAllTenants().catch((e) => this.logger.error(`applyDue: ${(e as Error).message}`));
    }, 30_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async applyDueAllTenants() {
    for (const t of await this.db.tenants()) await runAsTenant(t, () => this.applyDue());
  }

  get users() {
    return this.db.col<UserDoc>(C.users);
  }
  get assignments() {
    return this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments);
  }
  get requests() {
    return this.db.col<RoleChangeRequestDoc>(ORG_C.roleChangeRequests);
  }
  get scheduled() {
    return this.db.col<ScheduledChangeDoc>(ORG_C.scheduledChanges);
  }

  private newId = (prefix: string) => `${prefix}${randomBytes(6).toString('hex')}`;

  async getDoc(id: string): Promise<UserDoc> {
    const u = await this.users.findOne({ _id: id });
    if (!u) throw new NotFoundException('Không tìm thấy người dùng.');
    return u;
  }

  /** PQ-41: nobody changes their own roles, not even an Admin. */
  assertNotSelf(actor: Actor, targetUserId: string) {
    if (actor.userId && actor.userId === targetUserId) throw new ForbiddenException(SELF_EDIT_MESSAGE);
  }

  // ---------- reads ----------

  async list(q: {
    q?: string;
    orgUnitId?: string;
    role?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }, actor: Actor, visible?: (userId: string) => Promise<boolean>): Promise<{ items: AdminUser[]; total: number }> {
    const statuses = q.status ? [q.status] : ACTIVE;
    let users = (await this.users.find({ status: { $in: statuses as never } }).toArray()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'vi'),
    );
    const needle = q.q ? foldVi(q.q.trim()) : '';
    if (needle) users = users.filter((u) => foldVi(`${u.fullName} ${u.email}`).includes(needle));
    const all = await this.assignments.find({}).toArray();
    let allowed: Set<string> | null = null;
    if (q.orgUnitId) {
      const ids = new Set(await this.org.subtreeIds(q.orgUnitId));
      allowed = new Set(all.filter((a) => ids.has(a.orgUnitId)).map((a) => a.userId));
    }
    if (q.role) {
      // `none`: people who signed in by themselves and wait for an Admin to assign a role (PQ-10).
      // A custom role (`tc_…`) filters its own holders; a system role, holders of the role itself (MH-PQ-02 #4).
      const holds = (a: RoleAssignmentDoc) =>
        q.role === 'none' || (isCustomRoleId(q.role!) ? a.customRoleId === q.role : a.roleKey === q.role && !a.customRoleId);
      const withRole = new Set(all.filter(holds).map((a) => a.userId));
      const pick = q.role === 'none' ? new Set(users.map((u) => u._id).filter((x) => !withRole.has(x))) : withRole;
      allowed = allowed ? new Set([...allowed].filter((x) => pick.has(x))) : pick;
    }
    if (allowed) users = users.filter((u) => allowed!.has(u._id));
    // Caller's user.view scope (M1b-04), before paging so totals match what the caller may see.
    if (visible) {
      const keep = await Promise.all(users.map((u) => visible(u._id)));
      users = users.filter((_, i) => keep[i]);
    }
    const total = users.length;
    const size = Math.min(Math.max(q.pageSize ?? 20, 1), 100);
    const page = Math.max(q.page ?? 1, 1);
    const slice = users.slice((page - 1) * size, page * size);
    return { items: await Promise.all(slice.map((u) => this.toDto(u, actor))), total };
  }

  async get(id: string, actor: Actor): Promise<AdminUser> {
    return this.toDto(await this.getDoc(id), actor);
  }

  async toDto(u: UserDoc, actor: Actor): Promise<AdminUser> {
    const [as, units, reqs, managers] = await Promise.all([
      this.assignments.find({ userId: u._id }).toArray(),
      this.org.units.find({}, { projection: { name: 1 } }).toArray(),
      this.requests.find({ targetUserId: u._id, status: 'cho_duyet' }).toArray(),
      this.org.units.find({ managerUserId: u._id }, { projection: { _id: 1 } }).toArray(),
    ]);
    const name = new Map(units.map((x) => [x._id, x.name]));
    const leads = new Set(managers.map((m) => m._id));
    const roleNames = await this.customRoles.names(as.map((a) => a.customRoleId));
    const assignments: RoleAssignment[] = as.map((a) => ({
      id: a._id,
      roleKey: a.roleKey,
      customRoleId: a.customRoleId ?? null,
      customRoleName: a.customRoleId ? (roleNames.get(a.customRoleId) ?? a.customRoleId) : null,
      orgUnitId: a.orgUnitId,
      orgUnitName: name.get(a.orgUnitId) ?? a.orgUnitId,
      lead: leads.has(a.orgUnitId),
      from: a.from?.toISOString() ?? null,
      to: a.to?.toISOString() ?? null,
    }));
    return {
      id: u._id,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone ?? null,
      status: u.status,
      primaryOrgUnitId: u.primaryOrgUnitId ?? as[0]?.orgUnitId ?? null,
      assignments,
      pending: await Promise.all(reqs.map((r) => this.requestDto(r))),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      lockReason: u.lockReason ?? null,
      preLeave: u.preLeave ? { date: u.preLeave.date, reason: u.preLeave.reason } : null,
      isSelf: !!actor.userId && actor.userId === u._id,
    };
  }

  // ---------- assignment rules ----------

  /** Validates role x unit and decides whether a second person must approve (PQ-42). */
  async checkAssignment(
    user: { _id: string },
    input: Pick<AssignmentInput, 'roleKey' | 'orgUnitId' | 'lead' | 'customRoleId'>,
    opts: { homeDivisionId?: string | null } = {},
  ): Promise<AssignmentCheck> {
    let custom: CustomRoleDoc | null = null;
    if (input.customRoleId) {
      custom = await this.customRoles.roles.findOne({ _id: input.customRoleId });
      if (!custom) throw new BadRequestException('Không tìm thấy vai trò tùy chỉnh.');
      if (custom.baseRole !== input.roleKey) {
        throw new BadRequestException(`Vai trò ${custom.name} dựa trên ${ROLE_LABELS[custom.baseRole]}, không phải ${ROLE_LABELS[input.roleKey]}.`);
      }
    }
    const roleName = custom?.name ?? ROLE_LABELS[input.roleKey];
    const unit = await this.org.units.findOne({ _id: input.orgUnitId });
    if (!unit) throw new BadRequestException('Không tìm thấy đơn vị.');
    if (!unit.active) throw new BadRequestException('Đơn vị đã ngừng.');
    if (ROLE_UNIT_TYPE[input.roleKey] !== unit.type) {
      throw new BadRequestException(custom ? `Vai trò ${custom.name} phải đặt ở ${ORG_UNIT_TYPE_LABELS[ROLE_UNIT_TYPE[input.roleKey]]}.` : roleUnitMessage(input.roleKey));
    }
    if (input.lead && !this.org.canLead(unit.type, input.roleKey)) {
      throw new BadRequestException(`Vai trò ${roleName} không làm quản lý ${ORG_UNIT_TYPE_LABELS[unit.type]}.`);
    }
    let home = opts.homeDivisionId;
    if (home === undefined) {
      const mine = await this.assignments.find({ userId: user._id }).toArray();
      const divs = new Set<string>();
      for (const a of mine) {
        const u = await this.org.units.findOne({ _id: a.orgUnitId }, { projection: { divisionId: 1 } });
        if (u?.divisionId) divs.add(u.divisionId);
      }
      home = divs.size && !divs.has(unit.divisionId ?? '') && unit.divisionId ? [...divs][0]! : null;
    }
    const cross = !!home && !!unit.divisionId && home !== unit.divisionId;
    // A custom role built on admin / quan_sat / giam_doc_bh is as sensitive as its base (PQ-42).
    const roleSensitive = SENSITIVE_ROLES.includes(input.roleKey);
    const approverRule: AssignmentCheck['approverRule'] =
      input.roleKey === 'admin' || input.roleKey === 'quan_sat' ? 'nguoi_duyet_tap_doan' : 'quan_sat';
    return { unit, sensitive: roleSensitive || cross, approverRule, roleName };
  }

  /** Adds a role at a unit, or files a request when a second person has to approve. */
  async addAssignment(
    userId: string,
    input: AssignmentInput,
    actor: Actor,
    opts: { replaceManager?: boolean; homeDivisionId?: string | null; reason?: string } = {},
  ): Promise<AddResult> {
    if (input.orgUnitId === ROOT_UNIT_CODE) await this.org.ensureRoot();
    this.assertNotSelf(actor, userId);
    const user = await this.getDoc(userId);
    const check = await this.checkAssignment(user, input, { homeDivisionId: opts.homeDivisionId });
    const id = assignmentId(userId, input.customRoleId ?? input.roleKey, input.orgUnitId);
    if (await this.assignments.findOne({ _id: id })) throw new ConflictException('Người này đã có vai trò đó ở đơn vị này.');
    if (check.sensitive) {
      const dup = await this.requests.findOne({
        targetUserId: userId,
        status: 'cho_duyet',
        'change.op': 'add',
        'change.roleKey': input.roleKey,
        // null also matches requests written before custom roles (no field).
        'change.customRoleId': (input.customRoleId ?? null) as never,
        'change.orgUnitId': input.orgUnitId,
      });
      if (dup) throw new ConflictException('Đã có yêu cầu thêm vai trò này đang chờ duyệt.');
      const req: RoleChangeRequestDoc = {
        _id: this.newId('rq_'),
        targetUserId: userId,
        change: {
          op: 'add',
          roleKey: input.roleKey,
          ...(input.customRoleId ? { customRoleId: input.customRoleId } : {}),
          orgUnitId: input.orgUnitId,
          ...(input.lead ? { lead: true } : {}),
          ...(input.from ? { from: new Date(input.from) } : {}),
          ...(input.to ? { to: new Date(input.to) } : {}),
        },
        requestedBy: actor.id,
        approverRule: check.approverRule,
        status: 'cho_duyet',
        reason: opts.reason ?? 'Vai trò nhạy cảm hoặc gán chéo division',
        createdAt: new Date(),
      };
      await this.requests.insertOne(req);
      await this.db.audit(actor.id, 'role.request', req._id, {
        targetUserId: userId,
        roleKey: input.roleKey,
        ...(input.customRoleId ? { customRoleId: input.customRoleId } : {}),
        orgUnitId: input.orgUnitId,
        approverRule: check.approverRule,
        notifyQuanSat: true,
      });
      const who = check.approverRule === 'quan_sat' ? 'Ban giám đốc / Kiểm soát' : 'người duyệt cấp tập đoàn';
      return {
        applied: false,
        requestId: req._id,
        approverRule: check.approverRule,
        message: `Vai trò ${check.roleName} chờ ${who} duyệt.`,
      };
    }
    await this.writeAssignment(userId, input, actor.id, check.unit, opts.replaceManager ?? false);
    await this.db.audit(actor.id, 'role.assign', id, {
      userId,
      roleKey: input.roleKey,
      ...(input.customRoleId ? { customRoleId: input.customRoleId } : {}),
      orgUnitId: input.orgUnitId,
      notifyQuanSat: true,
    });
    return { applied: true, assignmentId: id };
  }

  /** Writes the assignment and the manager flag; no sensitivity check (the caller did it). */
  private async writeAssignment(
    userId: string,
    input: AssignmentInput,
    createdBy: string,
    unit: OrgUnitDoc,
    replaceManager: boolean,
  ) {
    if (input.lead) {
      if (unit.managerUserId && unit.managerUserId !== userId && !replaceManager) {
        const old = await this.users.findOne({ _id: unit.managerUserId }, { projection: { fullName: 1 } });
        throw new ConflictException(`Thay ${old?.fullName ?? 'quản lý cũ'} làm quản lý ${unit.name}?`);
      }
    }
    const id = assignmentId(userId, input.customRoleId ?? input.roleKey, input.orgUnitId);
    await this.assignments.insertOne({
      _id: id,
      userId,
      roleKey: input.roleKey,
      ...(input.customRoleId ? { customRoleId: input.customRoleId } : {}),
      orgUnitId: input.orgUnitId,
      ...(input.from ? { from: new Date(input.from) } : {}),
      ...(input.to ? { to: new Date(input.to) } : {}),
      createdBy,
      createdAt: new Date(),
    });
    if (input.lead) await this.org.units.updateOne({ _id: unit._id }, { $set: { managerUserId: userId, updatedAt: new Date() } });
    const u = await this.users.findOne({ _id: userId }, { projection: { primaryOrgUnitId: 1 } });
    if (!u?.primaryOrgUnitId) await this.users.updateOne({ _id: userId }, { $set: { primaryOrgUnitId: unit._id } });
  }

  async removeAssignment(userId: string, assignment: string, actor: Actor, opts: { force?: boolean } = {}): Promise<void> {
    this.assertNotSelf(actor, userId);
    const user = await this.getDoc(userId);
    const a = await this.assignments.findOne({ _id: assignment, userId });
    if (!a) throw new NotFoundException('Không tìm thấy vai trò của người này.');
    if (!opts.force && ACTIVE.includes(user.status) && (await this.assignments.countDocuments({ userId })) <= 1) {
      throw new ConflictException('Không gỡ vai trò cuối của người đang hoạt động.');
    }
    await this.assignments.deleteOne({ _id: assignment });
    await this.org.units.updateMany({ _id: a.orgUnitId, managerUserId: userId }, { $set: { managerUserId: null, updatedAt: new Date() } });
    if (user.primaryOrgUnitId === a.orgUnitId) {
      const next = await this.assignments.findOne({ userId });
      await this.users.updateOne({ _id: userId }, next ? { $set: { primaryOrgUnitId: next.orgUnitId } } : { $unset: { primaryOrgUnitId: '' } });
    }
    await this.db.audit(actor.id, 'role.remove', assignment, {
      userId,
      roleKey: a.roleKey,
      ...(a.customRoleId ? { customRoleId: a.customRoleId } : {}),
      orgUnitId: a.orgUnitId,
      notifyQuanSat: true,
    });
  }

  // ---------- user CRUD ----------

  async create(input: UserInput, actor: Actor): Promise<{ user: AdminUser; messages: string[] }> {
    if (await this.users.findOne({ email: input.email })) throw new ConflictException('Email này đã có người dùng.');
    // Validate every assignment before anything is written.
    const probe = { _id: '(new)' };
    const homes = new Set<string>();
    for (const a of input.assignments) {
      const c = await this.checkAssignment(probe, a, { homeDivisionId: null });
      if (c.unit.divisionId) homes.add(c.unit.divisionId);
    }
    const id = this.newId('u_');
    const now = new Date();
    await this.users.insertOne({
      _id: id,
      email: input.email,
      fullName: input.fullName,
      ...(input.phone ? { phone: input.phone } : {}),
      status: 'cho_kich_hoat',
      createdAt: now,
      createdBy: actor.id,
    });
    await this.db.audit(actor.id, 'user.create', id, { roles: input.assignments.map((a) => a.roleKey) });
    const messages: string[] = [];
    let home: string | null = null;
    for (const a of input.assignments) {
      const unit = (await this.org.units.findOne({ _id: a.orgUnitId }))!;
      const r = await this.addAssignment(id, a, { ...actor, userId: null }, { homeDivisionId: home, replaceManager: true });
      if (r.applied) home = home ?? unit.divisionId;
      else messages.push(r.message);
    }
    return { user: await this.get(id, actor), messages };
  }

  async update(id: string, patch: UserPatch, actor: Actor): Promise<AdminUser> {
    const user = await this.getDoc(id);
    const set: Record<string, unknown> = {};
    if (patch.fullName !== undefined) set.fullName = patch.fullName;
    if (patch.phone !== undefined) {
      if (patch.phone === null) await this.users.updateOne({ _id: id }, { $unset: { phone: '' } });
      else set.phone = patch.phone;
    }
    if (patch.email !== undefined && patch.email !== user.email) {
      if (user.lastLoginAt) throw new ConflictException('Không sửa email sau khi người dùng đã đăng nhập lần đầu.');
      if (await this.users.findOne({ email: patch.email, _id: { $ne: id } })) throw new ConflictException('Email này đã có người dùng.');
      set.email = patch.email;
    }
    if (patch.primaryOrgUnitId !== undefined) {
      if (!(await this.assignments.findOne({ userId: id, orgUnitId: patch.primaryOrgUnitId }))) {
        throw new BadRequestException('Đơn vị chính phải là một đơn vị trong các vai trò của người này.');
      }
      set.primaryOrgUnitId = patch.primaryOrgUnitId;
    }
    if (Object.keys(set).length) await this.users.updateOne({ _id: id }, { $set: set });
    await this.db.audit(actor.id, 'user.update', id, { fields: Object.keys(patch) });
    return this.get(id, actor);
  }

  // ---------- status ----------

  async lock(id: string, reason: string, actor: Actor): Promise<AdminUser> {
    this.assertNotSelf(actor, id);
    const user = await this.getDoc(id);
    if (user.status !== 'hoat_dong' && user.status !== 'cho_kich_hoat') throw new ConflictException('Chỉ khóa được người đang hoạt động.');
    await this.users.updateOne({ _id: id }, { $set: { status: 'tam_khoa', lockReason: reason, lockedBy: actor.id } });
    const revoked = await this.sessions.revokeUser(id);
    // PQ-51 / PQ-53: his waiting send commands need a new approval by the nick holder / cover.
    const held = await holdApproverItems(this.db, id, 'approver_locked');
    await this.db.audit(actor.id, 'user.lock', id, { sessionsEnded: revoked, outboxHeld: held });
    return this.get(id, actor);
  }

  /** Sets the "Sắp nghỉ" flag (PQ-82): thresholds of the person's alerts drop to a quarter (rule R7). */
  async setPreLeave(id: string, input: { expectedDate: string; reason: string }, actor: Actor): Promise<AdminUser> {
    this.assertNotSelf(actor, id);
    const user = await this.getDoc(id);
    if (user.status !== 'hoat_dong' && user.status !== 'cho_kich_hoat') throw new ConflictException('Chỉ đặt cờ cho người đang hoạt động.');
    await this.users.updateOne({ _id: id }, { $set: { preLeave: { date: input.expectedDate, reason: input.reason, by: actor.id, at: new Date() } } });
    // PQ-82: his personal MCP tokens drop to the read group at once (cache cleared, no wait for the 60 s TTL).
    const lowered = await runUnscoped(() =>
      this.db.col(C.apiTokens).updateMany({ kind: 'mcp_user', userId: id, groups: 'de_xuat', revokedAt: { $exists: false } } as never, { $set: { groups: ['doc'] } }),
    );
    this.tokenSvc.forgetCache();
    await this.db.audit(actor.id, 'user.pre_leave', id, { expectedDate: input.expectedDate, tokensLowered: lowered.modifiedCount });
    return this.get(id, actor);
  }

  async clearPreLeave(id: string, actor: Actor): Promise<AdminUser> {
    const user = await this.getDoc(id);
    if (!user.preLeave) throw new ConflictException('Người này không có cờ Sắp nghỉ.');
    await this.users.updateOne({ _id: id }, { $unset: { preLeave: '' } });
    await this.db.audit(actor.id, 'user.pre_leave_clear', id);
    return this.get(id, actor);
  }

  async unlock(id: string, actor: Actor): Promise<AdminUser> {
    this.assertNotSelf(actor, id);
    const user = await this.getDoc(id);
    if (user.status !== 'tam_khoa') throw new ConflictException('Người này không bị tạm khóa.');
    await this.users.updateOne({ _id: id }, { $set: { status: 'hoat_dong' }, $unset: { lockReason: '', lockedBy: '' } });
    await this.db.audit(actor.id, 'user.unlock', id);
    return this.get(id, actor);
  }

  /**
   * "Khóa ngay" step of leaving the company (MH-PQ-04 step 1, UAT-PQ-40, 67). Handover of customers and
   * nicks (steps 2-4) is `HandoverService`.
   */
  async offboard(id: string, reason: string, actor: Actor, keepDeviceTokenIds: string[] = []): Promise<{ user: AdminUser; message: string }> {
    this.assertNotSelf(actor, id);
    const user = await this.getDoc(id);
    if (user.status === 'nghi_viec') throw new ConflictException('Người này đã nghỉ việc.');
    await this.users.updateOne({ _id: id }, { $set: { status: 'nghi_viec', leftAt: new Date(), lockReason: reason, lockedBy: actor.id } });
    const revoked = await this.sessions.revokeUser(id);
    await this.org.units.updateMany({ managerUserId: id }, { $set: { managerUserId: null, updatedAt: new Date() } });
    const held = await holdApproverItems(this.db, id, 'approver_offboarded');
    // Step 1 of MH-PQ-04: tokens, device tokens and temporary rights end with the lock.
    const cut = await this.handover.onOffboard(id, keepDeviceTokenIds, { userId: actor.userId, name: actor.id });
    await this.db.audit(actor.id, 'user.offboard', id, { sessionsEnded: revoked, outboxHeld: held, devicesRevoked: cut.devices, mcpTokensRevoked: cut.mcpTokens, grantsRevoked: cut.grants });
    return { user: await this.get(id, actor), message: HANDOVER_TEXT.locked(user.fullName, cut.devices, held) };
  }

  // ---------- change of unit (PQ-54) ----------

  async changeUnit(
    id: string,
    input: { fromOrgUnitId: string; toOrgUnitId: string; effectiveAt?: string },
    actor: Actor,
  ): Promise<{ applied: boolean; scheduledFor?: string; message: string; requests: string[] }> {
    this.assertNotSelf(actor, id);
    const user = await this.getDoc(id);
    const mine = await this.assignments.find({ userId: id, orgUnitId: input.fromOrgUnitId }).toArray();
    if (!mine.length) throw new BadRequestException('Người này không có vai trò ở đơn vị cũ.');
    const to = await this.org.get(input.toOrgUnitId);
    if (!to.active) throw new BadRequestException('Đơn vị mới đã ngừng.');
    if (to._id === input.fromOrgUnitId) throw new BadRequestException('Đơn vị mới trùng đơn vị cũ.');
    for (const a of mine) if (ROLE_UNIT_TYPE[a.roleKey] !== to.type) throw new BadRequestException(roleUnitMessage(a.roleKey));
    const when = input.effectiveAt ? new Date(input.effectiveAt) : new Date();
    if (when.getTime() > Date.now() + 5_000) {
      await this.scheduled.insertOne({
        _id: this.newId('sc_'),
        userId: id,
        kind: 'change_unit',
        payload: { fromOrgUnitId: input.fromOrgUnitId, toOrgUnitId: input.toOrgUnitId },
        effectiveAt: when,
        status: 'cho',
        createdBy: actor.id,
        createdAt: new Date(),
      });
      await this.db.audit(actor.id, 'user.change_unit_scheduled', id, { to: to._id, at: when.toISOString() });
      return { applied: false, scheduledFor: when.toISOString(), requests: [], message: `Sẽ chuyển ${user.fullName} sang ${to.name} lúc ${formatVn(when)}.` };
    }
    const requests = await this.doChangeUnit(id, input.fromOrgUnitId, input.toOrgUnitId, actor.id);
    return { applied: true, requests, message: `Đã chuyển ${user.fullName} sang ${to.name}.` };
  }

  /** Moves the role assignments of one unit to another; cross-division roles become requests. */
  private async doChangeUnit(userId: string, fromId: string, toId: string, by: string): Promise<string[]> {
    const from = await this.org.get(fromId);
    const to = await this.org.get(toId);
    const mine = await this.assignments.find({ userId, orgUnitId: fromId }).toArray();
    const cross = !!from.divisionId && !!to.divisionId && from.divisionId !== to.divisionId;
    const reqs: string[] = [];
    for (const a of mine) {
      await this.removeAssignment(userId, a._id, { id: by, userId: null }, { force: true });
      // The custom role moves with the person: never widened back to the system role.
      const r = await this.addAssignmentSystem(userId, { roleKey: a.roleKey, ...(a.customRoleId ? { customRoleId: a.customRoleId } : {}), orgUnitId: toId }, by, cross);
      if (!r.applied) reqs.push(r.requestId);
    }
    const u = await this.users.findOne({ _id: userId }, { projection: { primaryOrgUnitId: 1 } });
    if (!u?.primaryOrgUnitId || u.primaryOrgUnitId === fromId) {
      const first = await this.assignments.findOne({ userId });
      await this.users.updateOne({ _id: userId }, first ? { $set: { primaryOrgUnitId: first.orgUnitId } } : { $unset: { primaryOrgUnitId: '' } });
    }
    // Named `user.update` as the spec says (PQ-08, L-06); older lines were written as `user.change_unit`, still readable.
    await this.db.audit(by, 'user.update', userId, { change: 'unit', from: fromId, to: toId, requests: reqs.length });
    return reqs;
  }

  private async addAssignmentSystem(userId: string, input: AssignmentInput, by: string, cross: boolean): Promise<AddResult> {
    // `homeDivisionId` is forced so that a division change counts as cross-division (PQ-42).
    const unit = await this.org.get(input.orgUnitId);
    return this.addAssignment(userId, input, { id: by, userId: null }, { homeDivisionId: cross ? '(other)' : unit.divisionId, reason: 'Đổi đơn vị sang division khác' });
  }

  /** Applies scheduled unit changes that are due. Returns how many ran. */
  async applyDue(now = new Date()): Promise<number> {
    const due = await this.scheduled.find({ status: 'cho', effectiveAt: { $lte: now } }).toArray();
    let n = 0;
    for (const s of due) {
      const claimed = await this.scheduled.findOneAndUpdate({ _id: s._id, status: 'cho' }, { $set: { status: 'xong' } });
      if (!claimed) continue;
      try {
        await this.doChangeUnit(s.userId, s.payload.fromOrgUnitId, s.payload.toOrgUnitId, s.createdBy);
        n++;
      } catch (e) {
        await this.scheduled.updateOne({ _id: s._id }, { $set: { status: 'loi', note: (e as Error).message.slice(0, 200) } });
      }
    }
    return n;
  }

  // ---------- requests (PQ-42) ----------

  async requestDto(r: RoleChangeRequestDoc): Promise<PendingRoleChange> {
    const [target, by, roleNames] = await Promise.all([
      this.users.findOne({ _id: r.targetUserId }, { projection: { fullName: 1 } }),
      this.users.findOne({ _id: r.requestedBy }, { projection: { fullName: 1 } }),
      this.customRoles.names([r.change.customRoleId]),
    ]);
    const cr = r.change.customRoleId;
    return {
      id: r._id,
      targetUserId: r.targetUserId,
      targetName: target?.fullName ?? r.targetUserId,
      change: {
        op: r.change.op,
        roleKey: r.change.roleKey,
        ...(cr ? { customRoleId: cr, customRoleName: roleNames.get(cr) ?? cr } : {}),
        orgUnitId: r.change.orgUnitId,
        ...(r.change.lead ? { lead: true } : {}),
      },
      requestedBy: r.requestedBy,
      requestedByName: by?.fullName ?? r.requestedBy,
      approverRule: r.approverRule,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async listRequests(status = 'cho_duyet'): Promise<PendingRoleChange[]> {
    const rs = await this.requests.find({ status: status as never }).sort({ createdAt: -1 }).limit(200).toArray();
    return Promise.all(rs.map((r) => this.requestDto(r)));
  }

  /** Whether `userId` may decide request `r`: holds quan_sat, or is the group approver for admin/quan_sat. */
  private async mayDecide(userId: string, r: RoleChangeRequestDoc): Promise<boolean> {
    const isQs = (await this.assignments.countDocuments({ userId, roleKey: 'quan_sat' })) > 0;
    if (r.approverRule === 'quan_sat') return isQs;
    const settings = await this.db.col<{ _id: string; groupApprover?: string }>(ORG_C.securitySettings).findOne({ _id: 'main' });
    // Q-PQ-17 (who is the group approver) is still open: without a setting, a quan_sat holder decides.
    return settings?.groupApprover ? settings.groupApprover === userId : isQs;
  }

  async approve(id: string, actor: Actor): Promise<{ request: PendingRoleChange; message: string }> {
    const r = await this.requests.findOne({ _id: id });
    if (!r) throw new NotFoundException('Không tìm thấy yêu cầu.');
    if (r.status !== 'cho_duyet') throw new ConflictException('Yêu cầu này đã được xử lý.');
    if (!actor.userId) throw new ForbiddenException('Cần đăng nhập bằng tài khoản người dùng để duyệt.');
    if (r.requestedBy === actor.userId) throw new ForbiddenException('Người tạo yêu cầu không tự duyệt được.');
    if (r.targetUserId === actor.userId) throw new ForbiddenException(SELF_EDIT_MESSAGE);
    if (!(await this.mayDecide(actor.userId, r))) throw new ForbiddenException('Bạn không phải người duyệt của yêu cầu này.');
    const claimed = await this.requests.findOneAndUpdate(
      { _id: id, status: 'cho_duyet' },
      { $set: { status: 'da_duyet', approvedBy: actor.userId, approvedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!claimed) throw new ConflictException('Yêu cầu này đã được xử lý.');
    const c = r.change;
    try {
      const unit = await this.org.get(c.orgUnitId);
      if (!unit.active) throw new BadRequestException('Đơn vị đã ngừng.');
      if (c.op === 'add') {
        if (c.customRoleId) {
          const cr = await this.customRoles.roles.findOne({ _id: c.customRoleId });
          if (!cr || cr.baseRole !== c.roleKey) throw new BadRequestException('Vai trò tùy chỉnh của yêu cầu này không còn.');
        }
        await this.writeAssignment(
          r.targetUserId,
          {
            roleKey: c.roleKey,
            ...(c.customRoleId ? { customRoleId: c.customRoleId } : {}),
            orgUnitId: c.orgUnitId,
            lead: c.lead,
            from: c.from?.toISOString(),
            to: c.to?.toISOString(),
          },
          actor.userId,
          unit,
          true,
        );
      }
    } catch (e) {
      // Roll the decision back so the request can be retried or rejected.
      await this.requests.updateOne({ _id: id }, { $set: { status: 'cho_duyet' }, $unset: { approvedBy: '', approvedAt: '' } });
      if ((e as { code?: number }).code === 11000) throw new ConflictException('Người này đã có vai trò đó.');
      throw e;
    }
    await this.db.audit(actor.userId, 'role.approve', id, {
      targetUserId: r.targetUserId,
      roleKey: c.roleKey,
      ...(c.customRoleId ? { customRoleId: c.customRoleId } : {}),
      orgUnitId: c.orgUnitId,
    });
    return { request: await this.requestDto(claimed), message: 'Đã duyệt. Quyền mới có hiệu lực trong vòng 1 phút.' };
  }

  async reject(id: string, actor: Actor): Promise<PendingRoleChange> {
    const r = await this.requests.findOne({ _id: id });
    if (!r) throw new NotFoundException('Không tìm thấy yêu cầu.');
    if (r.status !== 'cho_duyet') throw new ConflictException('Yêu cầu này đã được xử lý.');
    if (!actor.userId || !(await this.mayDecide(actor.userId, r))) throw new ForbiddenException('Bạn không phải người duyệt của yêu cầu này.');
    await this.requests.updateOne({ _id: id }, { $set: { status: 'tu_choi', approvedBy: actor.userId, approvedAt: new Date() } });
    await this.db.audit(actor.userId, 'role.reject', id, { targetUserId: r.targetUserId });
    return this.requestDto({ ...r, status: 'tu_choi' });
  }

  /** The requester withdraws their own request (the one exception of PQ-41). */
  async cancel(id: string, actor: Actor): Promise<PendingRoleChange> {
    const r = await this.requests.findOne({ _id: id });
    if (!r) throw new NotFoundException('Không tìm thấy yêu cầu.');
    if (r.status !== 'cho_duyet') throw new ConflictException('Yêu cầu này đã được xử lý.');
    if (r.requestedBy !== actor.id) throw new ForbiddenException('Chỉ người tạo yêu cầu mới hủy được.');
    await this.requests.updateOne({ _id: id }, { $set: { status: 'huy' } });
    await this.db.audit(actor.id, 'role.cancel', id, { targetUserId: r.targetUserId });
    return this.requestDto({ ...r, status: 'huy' });
  }
}

/** dd/MM/yyyy HH:mm in Vietnam time. */
export function formatVn(d: Date): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
}
