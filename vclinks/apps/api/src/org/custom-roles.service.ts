import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CUSTOM_ROLE_PREFIX,
  ROLE_KEYS,
  ROLE_LABELS,
  ROLE_MATRIX,
  SELF_EDIT_MESSAGE,
  customRoleRow,
  foldVi,
  normalisePicks,
  type CustomRoleInput,
  type CustomRoleOption,
  type PermissionKey,
  type RoleColumn,
} from '@vclinks/shared';
import { AuthzService } from '../authz/authz.service';
import { DbService } from '../db/db.service';
import { ORG_C, type CustomRoleDoc, type RoleAssignmentDoc, type RoleChangeRequestDoc } from './org.types';
import type { Actor } from './people.service';

/** `tc_nvkd_thuc_tap`: readable, stable after renames, usable in the `vai_tro` import column (MH-PQ-15). */
const codeOf = (name: string) =>
  CUSTOM_ROLE_PREFIX +
  (foldVi(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'vai_tro');

/**
 * Custom roles (docs 01 PQ-06, MH-PQ-05): Admin copies a system role and removes or narrows scopes.
 * The base role never changes after creation; a role still held by somebody cannot be deleted.
 * Every change reaches the holders within the 30 s cache of AuthzService (NT9 ≤ 60 s).
 */
@Injectable()
export class CustomRolesService {
  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
  ) {}

  get roles() {
    return this.db.col<CustomRoleDoc>(ORG_C.customRoles);
  }
  private get assignments() {
    return this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments);
  }
  private get requests() {
    return this.db.col<RoleChangeRequestDoc>(ORG_C.roleChangeRequests);
  }

  /** Roles screen: the 10 system roles, then the custom ones by name. */
  async columns(): Promise<RoleColumn[]> {
    const [docs, counts] = await Promise.all([this.roles.find({}).toArray(), this.holderCounts()]);
    const custom = docs
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map((d) => this.column(d, counts.get(d._id) ?? 0));
    return [...ROLE_KEYS.map((r) => ({ roleKey: r, label: ROLE_LABELS[r], system: true, permissions: ROLE_MATRIX[r] })), ...custom];
  }

  /** Role pickers (MH-PQ-02 filter, MH-PQ-03 "Thêm vai trò"). */
  async options(): Promise<CustomRoleOption[]> {
    const docs = await this.roles.find({}, { projection: { name: 1, baseRole: 1 } }).toArray();
    return docs.map((d) => ({ id: d._id, name: d.name, baseRole: d.baseRole })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  async get(id: string): Promise<CustomRoleDoc> {
    const d = await this.roles.findOne({ _id: id });
    if (!d) throw new NotFoundException('Không tìm thấy vai trò tùy chỉnh.');
    return d;
  }

  async names(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const want = [...new Set(ids.filter((x): x is string => !!x))];
    if (!want.length) return new Map();
    const docs = await this.roles.find({ _id: { $in: want } }, { projection: { name: 1 } }).toArray();
    return new Map(docs.map((d) => [d._id, d.name]));
  }

  async create(input: CustomRoleInput, actor: Actor): Promise<{ role: RoleColumn; message: string }> {
    const name = input.name.trim();
    await this.assertNameFree(name);
    const { picks, error } = normalisePicks(input.baseRole, input.picks);
    if (error) throw new BadRequestException(error);
    const now = new Date();
    const base = codeOf(name);
    for (let i = 1; i <= 50; i++) {
      const doc: CustomRoleDoc = {
        _id: i === 1 ? base : `${base}_${i}`,
        name,
        nameKey: foldVi(name),
        baseRole: input.baseRole,
        description: input.description,
        picks,
        createdBy: actor.id,
        createdAt: now,
        updatedBy: actor.id,
        updatedAt: now,
      };
      try {
        await this.roles.insertOne(doc);
      } catch (e) {
        // The code is taken (maybe by another tenant): try the next suffix.
        if ((e as { code?: number }).code === 11000) continue;
        throw e;
      }
      await this.db.audit(actor.id, 'role.create', doc._id, { name, baseRole: input.baseRole, narrowed: Object.keys(picks).length, notifyQuanSat: true });
      this.authz.invalidate();
      return { role: this.column(doc, 0), message: `Đã tạo vai trò ${name}.` };
    }
    throw new ConflictException('Không tạo được mã cho vai trò này, đổi tên khác.');
  }

  async update(id: string, input: CustomRoleInput, actor: Actor): Promise<{ role: RoleColumn; message: string }> {
    const doc = await this.get(id);
    if (input.baseRole !== doc.baseRole) throw new BadRequestException('Không đổi được vai trò gốc sau khi tạo.');
    // NT6 / PQ-41: nobody changes the rights of a role they hold themselves.
    if (actor.userId && (await this.assignments.countDocuments({ userId: actor.userId, customRoleId: id }, { limit: 1 }))) {
      throw new ForbiddenException(SELF_EDIT_MESSAGE);
    }
    const name = input.name.trim();
    await this.assertNameFree(name, id);
    const { picks, error } = normalisePicks(doc.baseRole, input.picks);
    if (error) throw new BadRequestException(error);
    const changed = (Object.keys({ ...doc.picks, ...picks }) as PermissionKey[]).filter(
      (k) => JSON.stringify(doc.picks[k] ?? null) !== JSON.stringify(picks[k] ?? null),
    );
    const next: CustomRoleDoc = { ...doc, name, nameKey: foldVi(name), description: input.description, picks, updatedBy: actor.id, updatedAt: new Date() };
    await this.roles.replaceOne({ _id: id }, next);
    await this.db.audit(actor.id, 'role.update', id, {
      name,
      baseRole: doc.baseRole,
      ...(name !== doc.name ? { renamedFrom: doc.name } : {}),
      changedKeys: changed.slice(0, 50),
      notifyQuanSat: true,
    });
    this.authz.invalidate();
    const holders = (await this.holderCounts()).get(id) ?? 0;
    return { role: this.column(next, holders), message: `Đã lưu vai trò ${name}. Áp dụng cho ${holders} người.` };
  }

  async remove(id: string, actor: Actor): Promise<{ message: string }> {
    const doc = await this.get(id);
    const holders = (await this.holderCounts()).get(id) ?? 0;
    if (holders) throw new ConflictException(`Còn ${holders} người đang có vai trò này.`);
    await this.roles.deleteOne({ _id: id });
    await this.db.audit(actor.id, 'role.delete', id, { name: doc.name, baseRole: doc.baseRole, notifyQuanSat: true });
    this.authz.invalidate();
    return { message: `Đã xóa vai trò ${doc.name}.` };
  }

  private column(d: CustomRoleDoc, holders: number): RoleColumn {
    return {
      roleKey: d._id,
      label: d.name,
      system: false,
      permissions: customRoleRow(d.baseRole, d.picks ?? {}),
      baseRole: d.baseRole,
      description: d.description,
      picks: d.picks ?? {},
      assignedCount: holders,
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  /** Distinct people per custom role: assignments (any date range) and requests still waiting (PQ-42). */
  private async holderCounts(): Promise<Map<string, number>> {
    const [as, rs] = await Promise.all([
      this.assignments.find({ customRoleId: { $exists: true } } as never, { projection: { userId: 1, customRoleId: 1 } }).toArray(),
      this.requests
        .find({ status: 'cho_duyet', 'change.op': 'add', 'change.customRoleId': { $exists: true } } as never, { projection: { targetUserId: 1, change: 1 } })
        .toArray(),
    ]);
    const people = new Map<string, Set<string>>();
    const add = (role: string | undefined, user: string) => role && (people.get(role) ?? people.set(role, new Set()).get(role)!).add(user);
    for (const a of as) add(a.customRoleId, a.userId);
    for (const r of rs) add(r.change.customRoleId, r.targetUserId);
    return new Map([...people].map(([k, v]) => [k, v.size]));
  }

  /** "không trùng" (MH-PQ-05 #5): neither another custom role nor a system role, ignoring accents and case. */
  private async assertNameFree(name: string, self?: string) {
    const key = foldVi(name);
    if (ROLE_KEYS.some((r) => foldVi(ROLE_LABELS[r]) === key)) throw new ConflictException(`Trùng tên vai trò hệ thống "${name}".`);
    const other = await this.roles.findOne({ nameKey: key, ...(self ? { _id: { $ne: self } } : {}) } as never, { projection: { _id: 1 } });
    if (other) throw new ConflictException(`Đã có vai trò "${name}".`);
  }
}
