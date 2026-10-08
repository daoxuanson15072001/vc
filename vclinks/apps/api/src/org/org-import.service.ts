import { Injectable } from '@nestjs/common';
import {
  ORG_IMPORT_COLUMNS,
  ORG_UNIT_TYPES,
  ORG_UNIT_TYPE_LABELS,
  ROOT_UNIT_CODE,
  foldVi,
  unitCodeSchema,
  type ImportCommitResult,
  type ImportPreview,
  type ImportRowResult,
  type OrgUnitType,
} from '@vclinks/shared';
import { C, DbService } from '../db/db.service';
import type { UserDoc } from '../users/users.service';
import { OrgService } from './org.service';
import type { OrgUnitDoc } from './org.types';
import { readTable, toCsv, toXlsx, type TabularRow } from './tabular';

interface PlannedUnit {
  line: number;
  code: string;
  name: string;
  type: OrgUnitType;
  parentCode: string;
  managerEmail: string;
  existing: OrgUnitDoc | undefined;
  outcome: 'them' | 'doi' | 'khong_doi' | 'loi';
}

const typeFromText = (s: string): OrgUnitType | null => {
  const f = foldVi(s).replace(/[\s-]+/g, '_');
  for (const t of ORG_UNIT_TYPES) {
    if (t === 'goc') continue;
    if (f === t || f === foldVi(ORG_UNIT_TYPE_LABELS[t]).replace(/[\s-]+/g, '_')) return t;
  }
  return null;
};

/** Org-tree import from CSV/xlsx (MH-PQ-01 #10). Preview never writes; commit refuses when any row is wrong. */
@Injectable()
export class OrgImportService {
  constructor(
    private readonly db: DbService,
    private readonly org: OrgService,
  ) {}

  template = {
    header: ORG_IMPORT_COLUMNS,
    rows: [
      ['VCPARTS', 'Division VCparts', 'division', '', 'thang.uat@vcprosperous.com'],
      ['HN1', 'Tổ bán hàng HN1', 'to_ban_hang', 'VCPARTS', 'huong.uat@vcprosperous.com'],
      ['NHOM_CSKH', 'Nhóm CSKH VCparts', 'nhom_cskh', 'VCPARTS', ''],
    ],
  };

  async templateFile(format: 'csv' | 'xlsx'): Promise<{ name: string; buffer: Buffer }> {
    const t = this.template;
    if (format === 'csv') return { name: 'don-vi-mau.csv', buffer: toCsv(t.header, t.rows) };
    const guide = {
      title: 'Cột loai nhận: ' + ORG_UNIT_TYPES.filter((x) => x !== 'goc').join(', '),
      lines: [['ma_cha', 'Mã đơn vị cha; để trống với division (đặt dưới gốc GOC)'], ['email_quan_ly', 'Có thể để trống; gắn khi nhập người dùng có truong_nhom = co']],
    };
    return { name: 'don-vi-mau.xlsx', buffer: await toXlsx(t.header, t.rows, guide) };
  }

  async currentFile(format: 'csv' | 'xlsx'): Promise<{ name: string; buffer: Buffer }> {
    const units = (await this.org.list()).filter((u) => u.type !== 'goc' && u.active);
    const users = await this.db.col<UserDoc>(C.users).find({}).toArray();
    const email = new Map(users.map((u) => [u._id, u.email]));
    const rows = units.map((u) => [
      u.code,
      u.name,
      u.type,
      u.parentId === ROOT_UNIT_CODE ? '' : (u.parentId ?? ''),
      u.managerUserId ? (email.get(u.managerUserId) ?? '') : '',
    ]);
    if (format === 'csv') return { name: 'don-vi-hien-trang.csv', buffer: toCsv(ORG_IMPORT_COLUMNS, rows) };
    return { name: 'don-vi-hien-trang.xlsx', buffer: await toXlsx(ORG_IMPORT_COLUMNS, rows) };
  }

  async preview(fileName: string, base64: string): Promise<ImportPreview> {
    const { preview } = await this.evaluate(fileName, base64);
    return preview;
  }

  async commit(fileName: string, base64: string, actor: string): Promise<ImportCommitResult> {
    const { preview, plan } = await this.evaluate(fileName, base64);
    if (preview.loi > 0) {
      return { ...preview, summary: `Sửa ${preview.loi} dòng lỗi rồi kiểm tra lại. Chưa có gì được ghi.` };
    }
    // Parents first: rows are ordered by depth so every parent exists before its children.
    const byCode = new Map(plan.map((p) => [p.code, p]));
    const depth = (p: PlannedUnit): number => {
      let d = 0;
      let cur: PlannedUnit | undefined = p;
      while (cur && byCode.has(cur.parentCode) && d < 10) {
        cur = byCode.get(cur.parentCode);
        d++;
      }
      return d;
    };
    const now = new Date();
    for (const p of [...plan].sort((a, b) => depth(a) - depth(b))) {
      if (p.outcome === 'khong_doi') continue;
      const parent = (await this.org.units.findOne({ _id: p.parentCode }))!;
      const divisionId = p.type === 'division' ? p.code : parent.divisionId;
      if (p.existing) {
        await this.org.units.updateOne(
          { _id: p.code },
          { $set: { name: p.name, type: p.type, parentId: p.parentCode, divisionId, updatedAt: now } },
        );
      } else {
        await this.org.units.insertOne({
          _id: p.code,
          code: p.code,
          type: p.type,
          name: p.name,
          parentId: p.parentCode,
          divisionId,
          managerUserId: null,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      await this.db.audit(actor, p.existing ? 'org.update' : 'org.create', p.code, { via: 'import' });
    }
    const n = preview.them + preview.doi;
    await this.db.audit(actor, 'org.import', fileName, { added: preview.them, changed: preview.doi });
    return { ...preview, summary: `Đã nhập ${n} đơn vị.` };
  }

  private async evaluate(fileName: string, base64: string): Promise<{ preview: ImportPreview; plan: PlannedUnit[] }> {
    const rows = await readTable(fileName, base64, ['ma_don_vi', 'ten', 'loai']);
    await this.org.ensureRoot();
    const existing = new Map((await this.org.units.find({}).toArray()).map((u) => [u._id, u]));
    const users = await this.db.col<UserDoc>(C.users).find({}).toArray();
    const userByEmail = new Map(users.map((u) => [u.email, u]));

    // Pass 1: syntax of each row and the codes the file defines.
    interface Raw {
      row: TabularRow;
      code: string;
      name: string;
      type: OrgUnitType | null;
      parentCode: string;
      managerEmail: string;
      errors: string[];
    }
    const raws: Raw[] = rows.map((row) => {
      const errors: string[] = [];
      const c = row.cells;
      const code = unitCodeSchema.safeParse(c.ma_don_vi);
      if (!code.success) errors.push(code.error.issues[0]!.message);
      const name = (c.ten ?? '').trim();
      if (name.length < 2 || name.length > 80) errors.push('Tên đơn vị 2–80 ký tự.');
      const type = typeFromText(c.loai ?? '');
      if (!type) errors.push('Loại đơn vị không hợp lệ.');
      return {
        row,
        code: code.success ? code.data : (c.ma_don_vi ?? '').toUpperCase(),
        name,
        type,
        parentCode: (c.ma_cha ?? '').trim().toUpperCase() || ROOT_UNIT_CODE,
        managerEmail: (c.email_quan_ly ?? '').trim().toLowerCase(),
        errors,
      };
    });
    const seen = new Map<string, number>();
    for (const r of raws) {
      if (seen.has(r.code)) r.errors.push(`Mã đơn vị ${r.code} trùng với dòng ${seen.get(r.code)}.`);
      else seen.set(r.code, r.row.line);
      if (r.code === ROOT_UNIT_CODE) r.errors.push('Không nhập đè đơn vị gốc.');
    }
    const fileByCode = new Map(raws.filter((r) => r.type && !r.errors.length).map((r) => [r.code, r]));

    // The tree as it would be after the import, to validate placement and cycles.
    const future = (code: string): Pick<OrgUnitDoc, 'type' | 'parentId'> | undefined => {
      const f = fileByCode.get(code);
      if (f) return { type: f.type!, parentId: f.parentCode };
      return existing.get(code);
    };

    const plan: PlannedUnit[] = [];
    const results: ImportRowResult[] = [];
    for (const r of raws) {
      const warnings: string[] = [];
      const errors = [...r.errors];
      if (!errors.length && r.type) {
        const parent = future(r.parentCode);
        const bad = this.org.checkPlacement(r.type, parent, future);
        if (bad) errors.push(bad);
        // Cycle: walking up from the parent must not reach this unit.
        let cur: string | null = r.parentCode;
        for (let i = 0; cur && i < 12; i++) {
          if (cur === r.code) {
            errors.push('Đơn vị cha tạo vòng lặp.');
            break;
          }
          cur = future(cur)?.parentId ?? null;
        }
        // Same name twice under one parent (file rows and existing units alike).
        const clash = raws.find(
          (o) => o !== r && o.parentCode === r.parentCode && foldVi(o.name) === foldVi(r.name) && !o.errors.length,
        );
        if (clash) errors.push(`Tên đơn vị trùng với dòng ${clash.row.line} trong cùng đơn vị cha.`);
        for (const e of existing.values()) {
          if (e.parentId === r.parentCode && e._id !== r.code && foldVi(e.name) === foldVi(r.name) && !fileByCode.has(e._id)) {
            errors.push('Tên đơn vị đã có trong cùng đơn vị cha.');
            break;
          }
        }
      }
      // The manager is attached when the person's own row (truong_nhom = co) is imported, so this is only a yellow note.
      if (r.managerEmail) {
        warnings.push(
          userByEmail.has(r.managerEmail)
            ? `Quản lý ${r.managerEmail} sẽ được gắn khi nhập người dùng có truong_nhom = co.`
            : `Quản lý ${r.managerEmail} chưa có trong VClinks; sẽ gắn khi nhập người dùng có truong_nhom = co.`,
        );
      }
      const ex = existing.get(r.code);
      let outcome: PlannedUnit['outcome'] = 'them';
      let message = 'Thêm';
      if (errors.length) {
        outcome = 'loi';
        message = errors.join(' ');
      } else if (ex) {
        const same = ex.name === r.name && ex.type === r.type && ex.parentId === r.parentCode;
        outcome = same ? 'khong_doi' : 'doi';
        message = same ? 'Không đổi' : 'Đổi';
      }
      plan.push({
        line: r.row.line,
        code: r.code,
        name: r.name,
        type: r.type ?? 'division',
        parentCode: r.parentCode,
        managerEmail: r.managerEmail,
        existing: ex,
        outcome,
      });
      results.push({ line: r.row.line, key: r.code, outcome, message, warnings });
    }
    const count = (o: string) => results.filter((x) => x.outcome === o).length;
    return {
      plan: plan.filter((p) => p.outcome !== 'loi'),
      preview: {
        total: results.length,
        them: count('them'),
        doi: count('doi'),
        khongDoi: count('khong_doi'),
        loi: count('loi'),
        choDuyet: 0,
        rows: results.sort((a, b) => (a.outcome === 'loi' ? -1 : 0) - (b.outcome === 'loi' ? -1 : 0) || a.line - b.line),
      },
    };
  }
}

