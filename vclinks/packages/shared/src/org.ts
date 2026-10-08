import { z } from 'zod';

/**
 * Organisation tree, administrators' user list and bulk import (docs 02-yeu-cau/dac-ta/01-phan-quyen.md
 * §2.1, §2.2, §2.8, MH-PQ-01, 02, 03, 15). The permission engine (who may call what) arrives in M1b-04;
 * this file only holds the data model and the validation rules.
 */

/** Company Google Workspace domains: who may sign in and which addresses a user may have (01 PQ-10). */
export const COMPANY_DOMAINS = ['vcprosperous.com', 'vcpart.vn'] as const;
/** Main company domain (sample addresses, single-domain texts). */
export const COMPANY_DOMAIN = COMPANY_DOMAINS[0];
/** "@vcprosperous.com hoặc @vcpart.vn", for messages. */
export const COMPANY_DOMAINS_TEXT = COMPANY_DOMAINS.map((d) => `@${d}`).join(' hoặc ');

/** Address on one of the company domains (case and surrounding spaces ignored). */
export function isCompanyEmail(email: string | null | undefined): boolean {
  const m = /^[^\s@]+@([^\s@]+)$/.exec(String(email ?? '').trim().toLowerCase());
  return !!m && (COMPANY_DOMAINS as readonly string[]).includes(m[1]);
}

/** Code of the root unit ("Tập đoàn") that every tenant gets on first use. */
export const ROOT_UNIT_CODE = 'GOC';

export const ORG_UNIT_TYPES = [
  'goc',
  'division',
  'to_ban_hang',
  'nhom_cskh',
  'nhom_marketing',
  'nhom_sale_admin',
  'nhom_ke_toan',
  'nhom_thi_truong',
] as const;
export type OrgUnitType = (typeof ORG_UNIT_TYPES)[number];

export const ORG_UNIT_TYPE_LABELS: Record<OrgUnitType, string> = {
  goc: 'Gốc (Tập đoàn)',
  division: 'Division',
  to_ban_hang: 'Tổ bán hàng',
  nhom_cskh: 'Nhóm CSKH',
  nhom_marketing: 'Nhóm marketing',
  nhom_sale_admin: 'Nhóm sale admin',
  nhom_ke_toan: 'Nhóm kế toán',
  nhom_thi_truong: 'Nhóm thị trường',
};

/** Types a unit of the given type may sit under (MH-PQ-01 #7). A sales team nests one level only. */
export const ORG_PARENT_TYPES: Record<OrgUnitType, readonly OrgUnitType[]> = {
  goc: [],
  division: ['goc'],
  to_ban_hang: ['division', 'to_ban_hang'],
  nhom_cskh: ['division'],
  nhom_marketing: ['division'],
  nhom_sale_admin: ['division'],
  nhom_ke_toan: ['division'],
  nhom_thi_truong: ['division'],
};

/** "Tổ bán hàng chỉ đặt dưới Division hoặc Tổ bán hàng." */
export function parentTypeMessage(type: OrgUnitType): string {
  const names = ORG_PARENT_TYPES[type].map((t) => ORG_UNIT_TYPE_LABELS[t]);
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' hoặc ' + names[names.length - 1] : (names[0] ?? 'không đơn vị nào');
  return `${ORG_UNIT_TYPE_LABELS[type]} chỉ đặt dưới ${list}.`;
}

export const ROLE_KEYS = [
  'admin',
  'giam_doc_bh',
  'giam_sat_bh',
  'nvkd',
  'cskh',
  'marketing',
  'sale_admin',
  'ke_toan',
  'nv_thi_truong',
  'quan_sat',
] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: 'Admin hệ thống',
  giam_doc_bh: 'Giám đốc bán hàng',
  giam_sat_bh: 'Giám sát bán hàng',
  nvkd: 'Nhân viên kinh doanh',
  cskh: 'Nhân viên CSKH',
  marketing: 'Nhân viên marketing',
  sale_admin: 'Sale admin',
  ke_toan: 'Kế toán',
  nv_thi_truong: 'NV thị trường',
  quan_sat: 'Ban giám đốc / Kiểm soát',
};

/** Unit type each role must sit in (MH-PQ-03 #6). */
export const ROLE_UNIT_TYPE: Record<RoleKey, OrgUnitType> = {
  admin: 'goc',
  quan_sat: 'goc',
  giam_doc_bh: 'division',
  giam_sat_bh: 'to_ban_hang',
  nvkd: 'to_ban_hang',
  cskh: 'nhom_cskh',
  marketing: 'nhom_marketing',
  sale_admin: 'nhom_sale_admin',
  ke_toan: 'nhom_ke_toan',
  nv_thi_truong: 'nhom_thi_truong',
};

/** "Vai trò NVKD phải đặt ở Tổ bán hàng." */
export const roleUnitMessage = (role: RoleKey): string =>
  `Vai trò ${role === 'nvkd' ? 'NVKD' : ROLE_LABELS[role]} phải đặt ở ${ORG_UNIT_TYPE_LABELS[ROLE_UNIT_TYPE[role]]}.`;

/** Roles whose holder may read chat: granting them needs a second person (PQ-42). */
export const SENSITIVE_ROLES: readonly RoleKey[] = ['admin', 'quan_sat', 'giam_doc_bh'];

/** Roles of groups outside the sales tree, whose "Trưởng nhóm" flag makes them the unit manager. */
export const GROUP_LEAD_ROLES: readonly RoleKey[] = ['cskh', 'marketing', 'sale_admin', 'ke_toan', 'nv_thi_truong'];

/** Role a unit manager must hold, by unit type (MH-PQ-01 #9); other groups: any member. */
export const MANAGER_ROLE: Partial<Record<OrgUnitType, RoleKey>> = {
  division: 'giam_doc_bh',
  to_ban_hang: 'giam_sat_bh',
};

export const USER_STATUS_LABELS = {
  cho_kich_hoat: 'Chờ kích hoạt',
  hoat_dong: 'Hoạt động',
  tam_khoa: 'Tạm khóa',
  nghi_viec: 'Nghỉ việc',
} as const;

export const SELF_EDIT_MESSAGE = 'Không sửa được quyền của chính bạn.';

// ---------- input schemas ----------

export const unitCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9_-]{1,29}$/, 'Mã đơn vị gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới.');

const unitNameSchema = z.string().trim().min(2, 'Tên đơn vị 2–80 ký tự.').max(80, 'Tên đơn vị 2–80 ký tự.');

export const orgUnitInputSchema = z
  .object({
    code: unitCodeSchema.optional(),
    name: unitNameSchema,
    type: z.enum(ORG_UNIT_TYPES).refine((t) => t !== 'goc', 'Không tạo thêm đơn vị gốc.'),
    parentId: z.string().trim().min(1, 'Chọn đơn vị cha.'),
    managerUserId: z.string().trim().min(1).nullable().optional(),
  })
  .strict();
export type OrgUnitInput = z.infer<typeof orgUnitInputSchema>;

export const orgUnitPatchSchema = z
  .object({
    name: unitNameSchema.optional(),
    managerUserId: z.string().trim().min(1).nullable().optional(),
  })
  .strict();
export type OrgUnitPatch = z.infer<typeof orgUnitPatchSchema>;

export const orgUnitMoveSchema = z.object({ parentId: z.string().trim().min(1) }).strict();

export const phoneSchema = z.string().trim().regex(/^0\d{9}$/, 'SĐT nội bộ gồm 10 số, bắt đầu bằng 0.');

export const companyEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email không hợp lệ.')
  .refine((e) => isCompanyEmail(e), `Email phải kết thúc ${COMPANY_DOMAINS_TEXT}.`);

export const assignmentInputSchema = z
  .object({
    roleKey: z.enum(ROLE_KEYS),
    /** Custom role (`tc_…`, MH-PQ-05) built on `roleKey`: its row replaces the system row for this assignment. */
    customRoleId: z.string().trim().min(1).max(80).optional(),
    orgUnitId: z.string().trim().min(1),
    /** Make the user the manager of the unit (MH-PQ-03 #7). */
    lead: z.boolean().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();
export type AssignmentInput = z.infer<typeof assignmentInputSchema>;

export const userInputSchema = z
  .object({
    email: companyEmailSchema,
    fullName: z.string().trim().min(2, 'Họ tên 2–80 ký tự.').max(80, 'Họ tên 2–80 ký tự.'),
    phone: phoneSchema.optional(),
    assignments: z.array(assignmentInputSchema).max(10).default([]),
  })
  .strict();
export type UserInput = z.infer<typeof userInputSchema>;

export const userPatchSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80).optional(),
    phone: phoneSchema.nullable().optional(),
    email: companyEmailSchema.optional(),
    primaryOrgUnitId: z.string().trim().min(1).optional(),
  })
  .strict();
export type UserPatch = z.infer<typeof userPatchSchema>;

export const lockInputSchema = z
  .object({ reason: z.string().trim().min(10, 'Lý do ít nhất 10 ký tự.').max(300) })
  .strict();

/** "Đặt cờ Sắp nghỉ" (MH-PQ-02, PQ-82, L-05): expected last day (yyyy-mm-dd) and the reason. */
export const preLeaveInputSchema = z
  .object({
    expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày nghỉ dự kiến dạng năm-tháng-ngày.'),
    reason: z.string().trim().min(10, 'Lý do ít nhất 10 ký tự.').max(300),
  })
  .strict();
export type PreLeaveInput = z.infer<typeof preLeaveInputSchema>;

export const changeUnitSchema = z
  .object({
    fromOrgUnitId: z.string().trim().min(1),
    toOrgUnitId: z.string().trim().min(1),
    /** Future time = scheduled; absent = now. */
    effectiveAt: z.string().datetime().optional(),
  })
  .strict();

export const importFileSchema = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    /** File bytes, base64. 2.000 data rows at most (MH-PQ-15 #4). */
    contentBase64: z.string().min(1),
  })
  .strict();
export type ImportFile = z.infer<typeof importFileSchema>;

export const MAX_IMPORT_ROWS = 2000;

/** Header names of the templates (MH-PQ-01 #10 and MH-PQ-15). */
export const ORG_IMPORT_COLUMNS = ['ma_don_vi', 'ten', 'loai', 'ma_cha', 'email_quan_ly'] as const;
export const USER_IMPORT_COLUMNS = [
  'email',
  'ho_ten',
  'sdt_noi_bo',
  'vai_tro',
  'ma_don_vi',
  'truong_nhom',
  'tu_ngay',
  'den_ngay',
  'nick_giu',
  'kenh_chinh_thuc',
  'ly_do',
] as const;

// ---------- API shapes ----------

export type UnitStatus = 'active' | 'inactive';

export interface OrgUnit {
  id: string;
  code: string;
  name: string;
  type: OrgUnitType;
  parentId: string | null;
  divisionId: string | null;
  managerUserId: string | null;
  managerName: string | null;
  active: boolean;
  /** Active members (assignments of users who are not locked or gone). */
  memberCount: number;
}

export interface UnitMember {
  userId: string;
  fullName: string;
  email: string;
  roleKey: RoleKey;
  customRoleName?: string | null;
  status: keyof typeof USER_STATUS_LABELS;
  lead: boolean;
}

export interface RoleAssignment {
  id: string;
  roleKey: RoleKey;
  /** Custom role of the assignment (MH-PQ-05); null = the system role itself. */
  customRoleId: string | null;
  customRoleName: string | null;
  orgUnitId: string;
  orgUnitName: string;
  lead: boolean;
  from: string | null;
  to: string | null;
}

export interface PendingRoleChange {
  id: string;
  targetUserId: string;
  targetName: string;
  change: { op: 'add' | 'remove'; roleKey: RoleKey; customRoleId?: string; customRoleName?: string; orgUnitId: string; lead?: boolean };
  requestedBy: string;
  requestedByName: string;
  approverRule: 'quan_sat' | 'nguoi_duyet_tap_doan';
  status: 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'huy';
  reason: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: keyof typeof USER_STATUS_LABELS;
  primaryOrgUnitId: string | null;
  assignments: RoleAssignment[];
  pending: PendingRoleChange[];
  lastLoginAt: string | null;
  lockReason: string | null;
  /** "Sắp nghỉ" flag (L-05): expected last day; alerts of this person run at a quarter of the usual limit (R7). */
  preLeave: { date: string; reason: string } | null;
  isSelf: boolean;
}

export type ImportOutcome = 'them' | 'doi' | 'khong_doi' | 'loi' | 'cho_duyet';

export interface ImportRowResult {
  /** 1-based line in the file, counting the header as line 1. */
  line: number;
  key: string;
  outcome: ImportOutcome;
  /** Error reason, change summary or yellow warning. */
  message: string;
  warnings: string[];
}

export interface ImportPreview {
  total: number;
  them: number;
  doi: number;
  khongDoi: number;
  loi: number;
  choDuyet: number;
  rows: ImportRowResult[];
}

export interface ImportCommitResult extends ImportPreview {
  summary: string;
}

// foldVi (diacritic-insensitive name folding) lives in contact-list.ts and is shared via index.ts.
