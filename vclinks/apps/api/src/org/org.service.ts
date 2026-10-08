import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  GROUP_LEAD_ROLES,
  MANAGER_ROLE,
  ORG_PARENT_TYPES,
  ROOT_UNIT_CODE,
  foldVi,
  parentTypeMessage,
  type OrgUnit,
  type OrgUnitInput,
  type OrgUnitPatch,
  type OrgUnitType,
  type RoleKey,
  type UnitMember,
} from '@vclinks/shared';
import { C, DbService } from '../db/db.service';
import type { UserDoc } from '../users/users.service';
import { ORG_C, type CustomRoleDoc, type OrgUnitDoc, type RoleAssignmentDoc } from './org.types';

const ACTIVE_STATUSES = ['hoat_dong', 'cho_kich_hoat'];

/** `NOT_FOUND`-style helper for unit lookups. */
export const unitNotFound = () => new NotFoundException('Không tìm thấy đơn vị.');

/** Slug a name into a unit code: "Tổ bán hàng HN4" -> "TO-BAN-HANG-HN4". */
export function codeFromName(name: string): string {
  return foldVi(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, 30);
}

/**
 * Organisation tree (division -> team -> sub-team), docs 01 §2.2 and MH-PQ-01.
 * Units are never deleted: "Ngừng" keeps history and can be undone.
 */
@Injectable()
export class OrgService {
  constructor(private readonly db: DbService) {}

  get units() {
    return this.db.col<OrgUnitDoc>(ORG_C.orgUnits);
  }
  get assignments() {
    return this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments);
  }
  get users() {
    return this.db.col<UserDoc & { primaryOrgUnitId?: string }>(C.users);
  }

  /** The root unit as it is before its first write (reads never write, gate N4). */
  private virtualRoot(): OrgUnitDoc {
    const now = new Date(0);
    return {
      _id: ROOT_UNIT_CODE,
      code: ROOT_UNIT_CODE,
      type: 'goc',
      name: 'Tập đoàn VC Phồn Vinh',
      parentId: null,
      divisionId: null,
      managerUserId: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** The root unit exists in every tenant: written on the first write that needs it. */
  async ensureRoot(): Promise<OrgUnitDoc> {
    const found = await this.units.findOne({ _id: ROOT_UNIT_CODE });
    if (found) return found;
    const root = { ...this.virtualRoot(), createdAt: new Date(), updatedAt: new Date() };
    await this.units.updateOne({ _id: ROOT_UNIT_CODE }, { $setOnInsert: root }, { upsert: true });
    return (await this.units.findOne({ _id: ROOT_UNIT_CODE }))!;
  }

  async get(id: string): Promise<OrgUnitDoc> {
    const u = (await this.units.findOne({ _id: id })) ?? (id === ROOT_UNIT_CODE ? this.virtualRoot() : null);
    if (!u) throw unitNotFound();
    return u;
  }

  /** Every unit with its active-member count and manager name (the tree is built by the caller). */
  async list(): Promise<OrgUnit[]> {
    const [found, assignments, users] = await Promise.all([
      this.units.find({}).sort({ name: 1 }).toArray(),
      this.assignments.find({}, { projection: { userId: 1, orgUnitId: 1 } }).toArray(),
      this.users.find({}, { projection: { fullName: 1, status: 1 } }).toArray(),
    ]);
    const units = found.some((u) => u._id === ROOT_UNIT_CODE) ? found : [this.virtualRoot(), ...found];
    const byUser = new Map(users.map((u) => [u._id, u]));
    const counts = new Map<string, Set<string>>();
    for (const a of assignments) {
      const u = byUser.get(a.userId);
      if (!u || !ACTIVE_STATUSES.includes(u.status)) continue;
      (counts.get(a.orgUnitId) ?? counts.set(a.orgUnitId, new Set()).get(a.orgUnitId)!).add(a.userId);
    }
    return units.map((u) => ({
      id: u._id,
      code: u.code,
      name: u.name,
      type: u.type,
      parentId: u.parentId,
      divisionId: u.divisionId,
      managerUserId: u.managerUserId,
      managerName: u.managerUserId ? (byUser.get(u.managerUserId)?.fullName ?? null) : null,
      active: u.active,
      memberCount: counts.get(u._id)?.size ?? 0,
    }));
  }

  async members(unitId: string): Promise<UnitMember[]> {
    const unit = await this.get(unitId);
    const as = await this.assignments.find({ orgUnitId: unit._id }).toArray();
    const users = await this.users.find({ _id: { $in: as.map((a) => a.userId) } }).toArray();
    const byId = new Map(users.map((u) => [u._id, u]));
    const customIds = [...new Set(as.map((a) => a.customRoleId).filter((x): x is string => !!x))];
    const custom = customIds.length
      ? new Map((await this.db.col<CustomRoleDoc>(ORG_C.customRoles).find({ _id: { $in: customIds } }, { projection: { name: 1 } }).toArray()).map((c) => [c._id, c.name]))
      : new Map<string, string>();
    return as
      .filter((a) => byId.has(a.userId))
      .map((a) => {
        const u = byId.get(a.userId)!;
        return {
          userId: u._id,
          fullName: u.fullName,
          email: u.email,
          roleKey: a.roleKey,
          customRoleName: a.customRoleId ? (custom.get(a.customRoleId) ?? a.customRoleId) : null,
          status: u.status,
          lead: unit.managerUserId === u._id,
        };
      })
      .sort((x, y) => x.fullName.localeCompare(y.fullName, 'vi'));
  }

  /** Ids of `id` and all units below it. */
  async subtreeIds(id: string): Promise<string[]> {
    const all = await this.units.find({}, { projection: { parentId: 1 } }).toArray();
    const kids = new Map<string, string[]>();
    for (const u of all) if (u.parentId) (kids.get(u.parentId) ?? kids.set(u.parentId, []).get(u.parentId)!).push(u._id);
    const out: string[] = [];
    const walk = (x: string) => {
      out.push(x);
      for (const k of kids.get(x) ?? []) walk(k);
    };
    walk(id);
    return out;
  }

  /**
   * Placement rules shared by the form and the file import (MH-PQ-01 #6-#8).
   * `units` is a lookup of the units that will exist (database plus the file's own rows).
   */
  checkPlacement(
    type: OrgUnitType,
    parent: Pick<OrgUnitDoc, 'type' | 'parentId'> | undefined,
    lookup: (id: string) => Pick<OrgUnitDoc, 'type'> | undefined,
  ): string | null {
    if (!parent) return 'Không tìm thấy đơn vị cha.';
    if (!ORG_PARENT_TYPES[type].includes(parent.type)) return parentTypeMessage(type);
    // A sales team nests one level only: a sub-team cannot hold another sub-team.
    if (type === 'to_ban_hang' && parent.type === 'to_ban_hang') {
      const grand = parent.parentId ? lookup(parent.parentId) : undefined;
      if (grand?.type === 'to_ban_hang') return 'Tổ bán hàng chỉ lồng được một cấp tổ con.';
    }
    return null;
  }

  /** Manager rules (MH-PQ-01 #9): division -> giam_doc_bh, sales team -> giam_sat_bh, group -> a member. */
  async checkManager(unit: Pick<OrgUnitDoc, '_id' | 'type' | 'name'>, userId: string): Promise<string | null> {
    const user = await this.users.findOne({ _id: userId });
    if (!user || !ACTIVE_STATUSES.includes(user.status)) return 'Quản lý phải là người dùng đang hoạt động.';
    const need = MANAGER_ROLE[unit.type];
    const mine = await this.assignments.find({ userId, orgUnitId: unit._id }).toArray();
    if (need) {
      return mine.some((a) => a.roleKey === need) || (unit.type === 'division' && (await this.holdsInDivision(userId, unit._id, need)))
        ? null
        : `Quản lý của ${unit.name} phải có vai trò ${need}.`;
    }
    return mine.length ? null : `Quản lý của ${unit.name} phải là thành viên của nhóm.`;
  }

  private async holdsInDivision(userId: string, divisionId: string, role: RoleKey): Promise<boolean> {
    const ids = await this.subtreeIds(divisionId);
    return (await this.assignments.countDocuments({ userId, roleKey: role, orgUnitId: { $in: ids } })) > 0;
  }

  /** Whether `roleKey` may carry the "Trưởng nhóm" flag in `unitType`. */
  canLead(unitType: OrgUnitType, roleKey: RoleKey): boolean {
    const need = MANAGER_ROLE[unitType];
    return need ? need === roleKey : GROUP_LEAD_ROLES.includes(roleKey);
  }

  async create(input: OrgUnitInput, actor: string): Promise<OrgUnit> {
    await this.ensureRoot();
    const parent = await this.get(input.parentId);
    if (!parent.active) throw new BadRequestException('Đơn vị cha đã ngừng.');
    const all = await this.units.find({}, { projection: { type: 1, parentId: 1 } }).toArray();
    const lookup = (id: string) => all.find((u) => u._id === id);
    const bad = this.checkPlacement(input.type, parent, lookup);
    if (bad) throw new BadRequestException(bad);
    await this.assertNameFree(input.name, parent._id);
    const code = input.code ?? codeFromName(input.name);
    if (code.length < 2) throw new BadRequestException('Không tạo được mã đơn vị từ tên này. Nhập mã đơn vị.');
    if (await this.units.findOne({ _id: code })) throw new ConflictException(`Mã đơn vị ${code} đã tồn tại.`);
    const now = new Date();
    const doc: OrgUnitDoc = {
      _id: code,
      code,
      type: input.type,
      name: input.name,
      parentId: parent._id,
      divisionId: input.type === 'division' ? code : parent.divisionId,
      managerUserId: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.units.insertOne(doc);
    if (input.managerUserId) await this.setManager(doc, input.managerUserId);
    await this.db.audit(actor, 'org.create', code, { type: doc.type, parentId: doc.parentId });
    return this.toDto(code);
  }

  async update(id: string, patch: OrgUnitPatch, actor: string): Promise<OrgUnit> {
    const unit = await this.get(id);
    if (unit.type === 'goc') throw new BadRequestException('Không sửa đơn vị gốc.');
    if (patch.name !== undefined && patch.name !== unit.name) {
      await this.assertNameFree(patch.name, unit.parentId!, unit._id);
      await this.units.updateOne({ _id: id }, { $set: { name: patch.name, updatedAt: new Date() } });
    }
    if (patch.managerUserId !== undefined) {
      if (patch.managerUserId === null) {
        await this.units.updateOne({ _id: id }, { $set: { managerUserId: null, updatedAt: new Date() } });
      } else {
        await this.setManager(unit, patch.managerUserId);
      }
    }
    await this.db.audit(actor, 'org.update', id, { fields: Object.keys(patch) });
    return this.toDto(id);
  }

  /** Sets the manager after checking the rule. Changing manager is the caller's explicit choice. */
  async setManager(unit: Pick<OrgUnitDoc, '_id' | 'type' | 'name'>, userId: string): Promise<void> {
    const bad = await this.checkManager(unit, userId);
    if (bad) throw new BadRequestException(bad);
    await this.units.updateOne({ _id: unit._id }, { $set: { managerUserId: userId, updatedAt: new Date() } });
  }

  /** Moves a unit under another parent; returns how many people's view changes. */
  async move(id: string, parentId: string, actor: string): Promise<{ unit: OrgUnit; affected: number }> {
    const unit = await this.get(id);
    if (unit.type === 'goc') throw new BadRequestException('Không chuyển đơn vị gốc.');
    const parent = await this.get(parentId);
    const subtree = await this.subtreeIds(id);
    if (subtree.includes(parentId)) throw new BadRequestException('Không chuyển đơn vị vào chính nó hoặc nhánh con của nó.');
    if (!parent.active) throw new BadRequestException('Đơn vị cha đã ngừng.');
    const all = await this.units.find({}, { projection: { type: 1, parentId: 1 } }).toArray();
    const bad = this.checkPlacement(unit.type, parent, (x) => all.find((u) => u._id === x));
    if (bad) throw new BadRequestException(bad);
    // A moved sub-tree may not exceed one level of sub-teams below the new parent.
    if (unit.type === 'to_ban_hang' && parent.type === 'to_ban_hang') {
      const hasKids = (await this.units.countDocuments({ parentId: id, type: 'to_ban_hang' })) > 0;
      if (hasKids) throw new BadRequestException('Tổ bán hàng chỉ lồng được một cấp tổ con.');
    }
    await this.assertNameFree(unit.name, parentId, id);
    const divisionId = unit.type === 'division' ? unit._id : parent.divisionId;
    const now = new Date();
    await this.units.updateOne({ _id: id }, { $set: { parentId, divisionId, updatedAt: now } });
    if (unit.type !== 'division') {
      await this.units.updateMany({ _id: { $in: subtree.filter((s) => s !== id) } }, { $set: { divisionId, updatedAt: now } });
    }
    const people = await this.assignments.distinct('userId', { orgUnitId: { $in: subtree } });
    await this.db.audit(actor, 'org.move', id, { from: unit.parentId, to: parentId, affected: people.length });
    return { unit: await this.toDto(id), affected: people.length };
  }

  /** "Ngừng": refused while the unit has active members or active sub-units. */
  async deactivate(id: string, actor: string): Promise<OrgUnit> {
    const unit = await this.get(id);
    if (unit.type === 'goc') throw new BadRequestException('Không ngừng đơn vị gốc.');
    const subtree = (await this.subtreeIds(id)).filter((s) => s !== id);
    if (subtree.length && (await this.units.countDocuments({ _id: { $in: subtree }, active: true })) > 0) {
      throw new ConflictException('Ngừng hoặc chuyển các đơn vị con trước.');
    }
    const members = await this.activeMemberCount(id);
    if (members > 0) throw new ConflictException('Chuyển hết thành viên và kênh trước khi ngừng.');
    await this.units.updateOne({ _id: id }, { $set: { active: false, updatedAt: new Date() } });
    await this.db.audit(actor, 'org.deactivate', id);
    return this.toDto(id);
  }

  async reactivate(id: string, actor: string): Promise<OrgUnit> {
    const unit = await this.get(id);
    const parent = unit.parentId ? await this.units.findOne({ _id: unit.parentId }) : null;
    if (parent && !parent.active) throw new ConflictException('Khôi phục đơn vị cha trước.');
    await this.units.updateOne({ _id: id }, { $set: { active: true, updatedAt: new Date() } });
    await this.db.audit(actor, 'org.reactivate', id);
    return this.toDto(id);
  }

  async activeMemberCount(unitId: string): Promise<number> {
    const ids = await this.assignments.distinct('userId', { orgUnitId: unitId });
    if (!ids.length) return 0;
    return this.users.countDocuments({ _id: { $in: ids }, status: { $in: ACTIVE_STATUSES as never } });
  }

  private async assertNameFree(name: string, parentId: string, exceptId?: string) {
    const clash = await this.units.findOne({
      parentId,
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    });
    if (clash) throw new ConflictException('Tên đơn vị đã có trong cùng đơn vị cha.');
  }

  private async toDto(id: string): Promise<OrgUnit> {
    const u = (await this.list()).find((x) => x.id === id);
    if (!u) throw unitNotFound();
    return u;
  }
}
