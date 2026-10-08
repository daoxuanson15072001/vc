import { Injectable } from '@nestjs/common';
import {
  ROLE_KEYS,
  ROLE_LABELS,
  ROLE_UNIT_TYPE,
  SELF_EDIT_MESSAGE,
  USER_IMPORT_COLUMNS,
  companyEmailSchema,
  isCustomRoleId,
  phoneSchema,
  roleUnitMessage,
  type ImportCommitResult,
  type ImportOutcome,
  type ImportPreview,
  type ImportRowResult,
  type RoleKey,
} from '@vclinks/shared';
import { randomBytes } from 'node:crypto';
import { C, DbService } from '../db/db.service';
import type { UserDoc } from '../users/users.service';
import { OrgService } from './org.service';
import { ORG_C, assignmentId, type CustomRoleDoc, type OrgUnitDoc, type RoleAssignmentDoc } from './org.types';
import { PeopleService, type Actor } from './people.service';
import { parseVnDate, readTable, toCsv, toXlsx } from './tabular';

const DAY = 86_400_000;

interface PlannedRow {
  line: number;
  email: string;
  fullName: string;
  phone?: string;
  roleKey: RoleKey;
  /** `vai_tro` holds a custom role code (`tc_…`, MH-PQ-15): built on `roleKey`. */
  customRoleId?: string;
  unit: OrgUnitDoc;
  lead: boolean;
  from?: Date;
  to?: Date;
  outcome: ImportOutcome;
  /** Home division used to decide "cross-division" for this person. */
  home: string | null;
  existingUser?: UserDoc;
  alreadyAssigned: boolean;
  userFieldsChanged: boolean;
}

/** Bulk user import from CSV/xlsx (MH-PQ-15): every row is one role assignment. */
@Injectable()
export class UserImportService {
  constructor(
    private readonly db: DbService,
    private readonly org: OrgService,
    private readonly people: PeopleService,
  ) {}

  private customRoles() {
    return this.db.col<CustomRoleDoc>(ORG_C.customRoles);
  }

  async templateFile(format: 'csv' | 'xlsx'): Promise<{ name: string; buffer: Buffer }> {
    const rows = [
      ['minh.uat@vcprosperous.com', 'Nguyễn Văn Minh', '0901234567', 'nvkd', 'HN1', '', '', '', '', '', ''],
      ['huong.uat@vcprosperous.com', 'Nguyễn Thị Hương', '', 'giam_sat_bh', 'HN1', 'co', '', '', '', '', ''],
    ];
    if (format === 'csv') return { name: 'nguoi-dung-mau.csv', buffer: toCsv(USER_IMPORT_COLUMNS, rows) };
    const units = await this.org.units.find({ active: true }).sort({ _id: 1 }).toArray();
    const custom = await this.customRoles().find({}).sort({ _id: 1 }).toArray();
    const guide = {
      title: 'Mã vai trò và mã đơn vị hiện có',
      lines: [
        ...ROLE_KEYS.map((r) => [r, ROLE_LABELS[r]]),
        ...custom.map((c) => [c._id, `${c.name} (tùy chỉnh, gốc ${ROLE_LABELS[c.baseRole]})`]),
        [],
        ...units.map((u) => [u.code, `${u.name} (${u.type})`]),
      ],
    };
    return { name: 'nguoi-dung-mau.xlsx', buffer: await toXlsx(USER_IMPORT_COLUMNS, rows, guide) };
  }

  /** Current roles in the template format, to edit and import again. */
  async currentFile(format: 'csv' | 'xlsx'): Promise<{ name: string; buffer: Buffer }> {
    const [users, as, units] = await Promise.all([
      this.db.col<UserDoc>(C.users).find({}).sort({ email: 1 }).toArray(),
      this.db.col<RoleAssignmentDoc>('role_assignments').find({}).toArray(),
      this.org.units.find({}).toArray(),
    ]);
    const u = new Map(users.map((x) => [x._id, x]));
    const unit = new Map(units.map((x) => [x._id, x]));
    const fmt = (d?: Date) => (d ? `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : '');
    const rows = as
      .filter((a) => u.has(a.userId) && unit.has(a.orgUnitId))
      .sort((a, b) => u.get(a.userId)!.email.localeCompare(u.get(b.userId)!.email))
      .map((a) => [
        u.get(a.userId)!.email,
        u.get(a.userId)!.fullName,
        u.get(a.userId)!.phone ?? '',
        a.customRoleId ?? a.roleKey,
        a.orgUnitId,
        unit.get(a.orgUnitId)!.managerUserId === a.userId ? 'co' : '',
        fmt(a.from),
        fmt(a.to),
        '',
        '',
        '',
      ]);
    if (format === 'csv') return { name: 'nguoi-dung-hien-trang.csv', buffer: toCsv(USER_IMPORT_COLUMNS, rows) };
    return { name: 'nguoi-dung-hien-trang.xlsx', buffer: await toXlsx(USER_IMPORT_COLUMNS, rows) };
  }

  async preview(fileName: string, base64: string, actor: Actor): Promise<ImportPreview> {
    return (await this.evaluate(fileName, base64, actor)).preview;
  }

  async commit(fileName: string, base64: string, actor: Actor): Promise<ImportCommitResult> {
    const { preview, plan } = await this.evaluate(fileName, base64, actor);
    if (preview.loi > 0) {
      return { ...preview, summary: `Sửa ${preview.loi} dòng lỗi rồi kiểm tra lại. Chưa có gì được ghi.` };
    }
    const sys: Actor = { id: actor.id, userId: null };
    const ids = new Map<string, string>();
    const created = new Set<string>();
    const changed = new Set<string>();
    let pending = 0;
    for (const p of plan) {
      let id = ids.get(p.email) ?? p.existingUser?._id;
      if (!id) {
        id = `u_${randomBytes(6).toString('hex')}`;
        await this.db.col<UserDoc>(C.users).insertOne({
          _id: id,
          email: p.email,
          fullName: p.fullName,
          ...(p.phone ? { phone: p.phone } : {}),
          status: 'cho_kich_hoat',
          createdAt: new Date(),
          createdBy: actor.id,
        });
        created.add(id);
        await this.db.audit(actor.id, 'user.create', id, { via: 'import' });
      } else if (p.userFieldsChanged && !ids.has(p.email)) {
        await this.db.col<UserDoc>(C.users).updateOne({ _id: id }, { $set: { fullName: p.fullName, ...(p.phone ? { phone: p.phone } : {}) } });
        changed.add(id);
      }
      ids.set(p.email, id);
      if (p.outcome === 'khong_doi' && !p.lead) continue;
      const input = {
        roleKey: p.roleKey,
        ...(p.customRoleId ? { customRoleId: p.customRoleId } : {}),
        orgUnitId: p.unit._id,
        lead: p.lead,
        from: p.from?.toISOString(),
        to: p.to?.toISOString(),
      };
      if (p.alreadyAssigned) {
        if (p.lead && p.unit.managerUserId !== id) {
          await this.org.units.updateOne({ _id: p.unit._id }, { $set: { managerUserId: id, updatedAt: new Date() } });
          changed.add(id);
        }
        continue;
      }
      const r = await this.people.addAssignment(id, input, sys, { replaceManager: true, homeDivisionId: p.home });
      if (r.applied) {
        if (!created.has(id)) changed.add(id);
      } else {
        pending++;
      }
    }
    for (const id of changed) if (!created.has(id)) await this.db.audit(actor.id, 'user.update', id, { via: 'import' });
    const a = created.size;
    const b = [...changed].filter((x) => !created.has(x)).length;
    const summary = `Đã nhập ${a + b} người: ${a} thêm mới, ${b} cập nhật, ${pending} chờ duyệt vai trò nhạy cảm.`;
    await this.db.audit(actor.id, 'user.import', fileName, { created: a, updated: b, pending });
    return { ...preview, summary };
  }

  private async evaluate(fileName: string, base64: string, actor: Actor): Promise<{ preview: ImportPreview; plan: PlannedRow[] }> {
    const rows = await readTable(fileName, base64, ['email', 'ho_ten', 'vai_tro', 'ma_don_vi']);
    await this.org.ensureRoot();
    const [units, users, assignments, custom] = await Promise.all([
      this.org.units.find({}).toArray(),
      this.db.col<UserDoc>(C.users).find({}).toArray(),
      this.org.assignments.find({}).toArray(),
      this.customRoles().find({}).toArray(),
    ]);
    const customById = new Map(custom.map((c) => [c._id, c]));
    const unitBy = new Map(units.map((u) => [u._id, u]));
    const userByEmail = new Map(users.map((u) => [u.email, u]));
    const importer = actor.userId ? users.find((u) => u._id === actor.userId) : undefined;

    const homeOf = new Map<string, string | null>(); // email -> home division
    const nameOf = new Map<string, { name: string; line: number }>();
    const leadClaims = new Map<string, number>(); // unit -> line
    const seenKey = new Map<string, number>();
    const results: ImportRowResult[] = [];
    const plan: PlannedRow[] = [];
    const now = Date.now();

    for (const row of rows) {
      const c = row.cells;
      const errors: string[] = [];
      const warnings: string[] = [];
      const email = (c.email ?? '').trim().toLowerCase();
      const emailOk = companyEmailSchema.safeParse(email);
      if (!emailOk.success) errors.push(email.includes('@') ? 'Email ngoài domain.' : 'Email không hợp lệ.');
      const fullName = (c.ho_ten ?? '').trim();
      if (fullName.length < 2 || fullName.length > 80) errors.push('Họ tên 2–80 ký tự.');
      let phone: string | undefined;
      if (c.sdt_noi_bo) {
        if (phoneSchema.safeParse(c.sdt_noi_bo).success) phone = c.sdt_noi_bo;
        else errors.push('SĐT nội bộ gồm 10 số, bắt đầu bằng 0.');
      }
      // A custom role code (`tc_…`) stands for its base role with fewer rights (MH-PQ-15 `vai_tro`).
      const code = (c.vai_tro ?? '').trim().toLowerCase();
      const customRole = isCustomRoleId(code) ? customById.get(code) : undefined;
      const roleKey = (customRole?.baseRole ?? code) as RoleKey;
      if (!ROLE_KEYS.includes(roleKey)) errors.push(`Vai trò "${c.vai_tro ?? ''}" không có.`);
      const roleName = customRole?.name ?? ROLE_LABELS[roleKey];
      const unit = unitBy.get((c.ma_don_vi ?? '').trim().toUpperCase());
      if (!unit) errors.push(`Mã đơn vị "${c.ma_don_vi ?? ''}" không có.`);
      else if (!unit.active) errors.push(`Đơn vị ${unit.name} đã ngừng.`);
      else if (ROLE_KEYS.includes(roleKey) && ROLE_UNIT_TYPE[roleKey] !== unit.type) {
        errors.push(customRole ? `Vai trò ${customRole.name} phải đặt ở cùng loại đơn vị với ${ROLE_LABELS[roleKey]}.` : roleUnitMessage(roleKey));
      }

      if (importer && email === importer.email) errors.push(SELF_EDIT_MESSAGE);

      const prevName = nameOf.get(email);
      if (emailOk.success) {
        if (prevName && prevName.name.toLowerCase() !== fullName.toLowerCase()) {
          errors.push(`Email trùng với dòng ${prevName.line} nhưng khác họ tên.`);
        } else if (!prevName) nameOf.set(email, { name: fullName, line: row.line });
      }

      const lead = (c.truong_nhom ?? '').trim().toLowerCase();
      if (lead && lead !== 'co') errors.push('truong_nhom chỉ nhận "co" hoặc để trống.');
      const isLead = lead === 'co';
      if (isLead && unit && ROLE_KEYS.includes(roleKey) && ROLE_UNIT_TYPE[roleKey] === unit.type && !this.org.canLead(unit.type, roleKey)) {
        errors.push(`Vai trò ${roleName} không làm quản lý ${unit.name}.`);
      }
      if (isLead && unit) {
        const prev = leadClaims.get(unit._id);
        if (prev) errors.push(`Dòng ${prev} đã đặt quản lý cho ${unit.name}.`);
        else leadClaims.set(unit._id, row.line);
      }

      const from = c.tu_ngay ? parseVnDate(c.tu_ngay) : null;
      const to = c.den_ngay ? parseVnDate(c.den_ngay) : null;
      if (c.tu_ngay && !from) errors.push('tu_ngay phải có dạng dd/MM/yyyy.');
      if (c.den_ngay && !to) errors.push('den_ngay phải có dạng dd/MM/yyyy.');
      if (from && to && to < from) errors.push('den_ngay phải sau tu_ngay.');

      if (c.nick_giu || c.kenh_chinh_thuc || c.ly_do) {
        warnings.push('nick_giu, kenh_chinh_thuc, ly_do chưa được áp dụng ở bản này (gán nick và kênh làm ở phiên sau).');
      }

      const existing = userByEmail.get(email);
      if (!homeOf.has(email) && emailOk.success) {
        const divs: string[] = [];
        for (const a of assignments.filter((x) => x.userId === existing?._id)) {
          const d = unitBy.get(a.orgUnitId)?.divisionId;
          if (d) divs.push(d);
        }
        homeOf.set(email, divs[0] ?? null);
      }
      const home = homeOf.get(email) ?? null;
      const has = !!existing && !!unit && assignments.some((a) => a._id === assignmentId(existing._id, customRole?._id ?? roleKey, unit._id));
      // A role the person already holds is not a new grant, so no approval or end date is asked for it.
      const cross = !has && !!home && !!unit?.divisionId && unit.divisionId !== home;
      const sensitive = !has && !!unit && ROLE_KEYS.includes(roleKey) && (['admin', 'quan_sat', 'giam_doc_bh'].includes(roleKey) || cross);
      if (cross) {
        if (!to) errors.push('Gán chéo division cần có den_ngay (tối đa 90 ngày).');
        else if (to.getTime() - (from?.getTime() ?? now) > 90 * DAY) errors.push('Gán chéo division tối đa 90 ngày.');
      }

      const key = `${email}|${customRole?._id ?? roleKey}|${unit?._id}`;
      if (!errors.length && seenKey.has(key)) errors.push(`Trùng dòng ${seenKey.get(key)} (cùng email, vai trò, đơn vị).`);
      else if (!errors.length) seenKey.set(key, row.line);

      let outcome: ImportOutcome;
      let message: string;
      let alreadyAssigned = false;
      let userFieldsChanged = false;
      if (errors.length || !unit) {
        outcome = 'loi';
        message = errors.join(' ');
      } else {
        alreadyAssigned = has;
        userFieldsChanged = !!existing && (existing.fullName !== fullName || (!!phone && existing.phone !== phone));
        const leadChange = isLead && unit.managerUserId !== existing?._id;
        if (!existing) {
          outcome = sensitive ? 'cho_duyet' : 'them';
          message = sensitive ? `Thêm người · vai trò ${roleName} chờ duyệt` : 'Thêm';
        } else if (alreadyAssigned) {
          outcome = userFieldsChanged || leadChange ? 'doi' : 'khong_doi';
          message = outcome === 'doi' ? `Đổi${leadChange ? ' · đặt làm quản lý ' + unit.name : ''}` : 'Không đổi';
        } else {
          outcome = sensitive ? 'cho_duyet' : 'doi';
          message = sensitive ? `Chờ duyệt (PQ-42) · ${roleName} tại ${unit.name}` : `Đổi · thêm vai trò ${roleName} tại ${unit.name}`;
        }
        if (isLead && unit.managerUserId && unit.managerUserId !== existing?._id) {
          const old = users.find((u) => u._id === unit.managerUserId);
          warnings.push(`Sẽ thay ${old?.fullName ?? 'quản lý cũ'} làm quản lý ${unit.name}.`);
        }
        // The first accepted row fixes the home division of a person without roles yet.
        if (!home && unit.divisionId) homeOf.set(email, unit.divisionId);
        plan.push({
          line: row.line,
          email,
          fullName,
          phone,
          roleKey,
          ...(customRole ? { customRoleId: customRole._id } : {}),
          unit,
          lead: isLead,
          from: from ?? undefined,
          to: to ?? undefined,
          outcome,
          home: homeOf.get(email) ?? null,
          existingUser: existing,
          alreadyAssigned,
          userFieldsChanged,
        });
      }
      results.push({ line: row.line, key: email || `dòng ${row.line}`, outcome, message, warnings });
    }

    const count = (o: ImportOutcome) => results.filter((r) => r.outcome === o).length;
    // Errors first, then by line.
    results.sort((a, b) => Number(b.outcome === 'loi') - Number(a.outcome === 'loi') || a.line - b.line);
    return {
      plan,
      preview: {
        total: rows.length,
        them: count('them'),
        doi: count('doi'),
        khongDoi: count('khong_doi'),
        loi: count('loi'),
        choDuyet: count('cho_duyet'),
        rows: results,
      },
    };
  }
}

