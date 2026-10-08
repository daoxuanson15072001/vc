/**
 * Shared catalogs (04 VH-ORG-02, 03, 07; 05 mục 3.5): job titles, job functions, legal entities, work locations.
 * Input schemas carry the 04 sentences so the API and the forms show the same text.
 */
import { z } from 'zod';
import { tidyName } from './text.js';

export const CATALOG_TYPES = ['job-titles', 'job-functions', 'legal-entities', 'work-locations'] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

export function isCatalogType(t: string): t is CatalogType {
  return (CATALOG_TYPES as readonly string[]).includes(t);
}

/** Names for messages ("Chức danh '…' đã có") and the audit target type. */
export const CATALOG_INFO: Record<CatalogType, { label: string; target: string }> = {
  'job-titles': { label: 'Chức danh', target: 'job_title' },
  'job-functions': { label: 'Chức năng', target: 'job_function' },
  'legal-entities': { label: 'Pháp nhân', target: 'legal_entity' },
  'work-locations': { label: 'Nơi làm việc', target: 'work_location' },
};

/** `da_gop`: merged into another entry (VH-ORG-09, B-22). */
export type CatalogStatus = 'dang_dung' | 'ngung' | 'da_gop';
export const CATALOG_STATUS_LABEL: Record<CatalogStatus, string> = { dang_dung: 'Đang dùng', ngung: 'Ngừng', da_gop: 'Đã gộp' };

export const TITLE_LEVELS: Record<number, string> = {
  1: 'Nhân viên',
  2: 'Chuyên viên',
  3: 'Trưởng nhóm, Giám sát',
  4: 'Phó phòng',
  5: 'Trưởng phòng',
  6: 'Giám đốc division, khối',
  7: 'Ban điều hành',
};

export const WORK_LOCATION_KINDS = { van_phong: 'Văn phòng', kho: 'Kho', gara: 'Garage, xưởng', cua_hang: 'Cửa hàng', khac: 'Khác' } as const;
export type WorkLocationKind = keyof typeof WORK_LOCATION_KINDS;

export const COMPANY_EMAIL_DOMAINS = ['vcprosperous.com', 'vcpart.vn'] as const;

/** Provinces and centrally run cities in force (34 units, Nghị quyết 202/2025/QH15, from 01/07/2025). */
export const PROVINCES = {
  ha_noi: 'Hà Nội',
  hue: 'Huế',
  hai_phong: 'Hải Phòng',
  da_nang: 'Đà Nẵng',
  ho_chi_minh: 'Hồ Chí Minh',
  can_tho: 'Cần Thơ',
  lai_chau: 'Lai Châu',
  dien_bien: 'Điện Biên',
  son_la: 'Sơn La',
  lang_son: 'Lạng Sơn',
  cao_bang: 'Cao Bằng',
  quang_ninh: 'Quảng Ninh',
  tuyen_quang: 'Tuyên Quang',
  lao_cai: 'Lào Cai',
  thai_nguyen: 'Thái Nguyên',
  phu_tho: 'Phú Thọ',
  bac_ninh: 'Bắc Ninh',
  hung_yen: 'Hưng Yên',
  ninh_binh: 'Ninh Bình',
  thanh_hoa: 'Thanh Hoá',
  nghe_an: 'Nghệ An',
  ha_tinh: 'Hà Tĩnh',
  quang_tri: 'Quảng Trị',
  quang_ngai: 'Quảng Ngãi',
  gia_lai: 'Gia Lai',
  khanh_hoa: 'Khánh Hoà',
  dak_lak: 'Đắk Lắk',
  lam_dong: 'Lâm Đồng',
  dong_nai: 'Đồng Nai',
  tay_ninh: 'Tây Ninh',
  dong_thap: 'Đồng Tháp',
  vinh_long: 'Vĩnh Long',
  an_giang: 'An Giang',
  ca_mau: 'Cà Mau',
} as const;
export type ProvinceCode = keyof typeof PROVINCES;

/** Q-02: the 10 functions every installation starts with (04 VH-ORG-03, tiêu chí 1). */
export const INITIAL_FUNCTIONS: { code: string; name: string }[] = [
  { code: 'ban_hang', name: 'Bán hàng' },
  { code: 'cskh', name: 'CSKH' },
  { code: 'sale_admin', name: 'Sale admin' },
  { code: 'ke_toan', name: 'Kế toán' },
  { code: 'ky_thuat', name: 'Kỹ thuật / dịch vụ' },
  { code: 'kho', name: 'Kho' },
  { code: 'marketing', name: 'Marketing' },
  { code: 'nhan_su', name: 'Nhân sự' },
  { code: 'it', name: 'IT' },
  { code: 'ban_giam_doc', name: 'Ban giám đốc' },
];

/** Sentences of 04 VH-ORG-02, 03, 07 (placeholders filled by the API). */
export const CATALOG_MSG = {
  titleCode: 'Mã chức danh gồm 2–30 ký tự chữ hoa, số hoặc gạch dưới.',
  functionCode: 'Mã chức năng gồm 2–30 ký tự chữ thường không dấu, số hoặc gạch dưới.',
  legalCode: 'Mã pháp nhân gồm 2–20 ký tự chữ hoa hoặc số.',
  locationCode: 'Mã nơi làm việc gồm 2–30 ký tự chữ hoa, số hoặc gạch dưới.',
  taxCode: 'Mã số thuế gồm 10 chữ số, hoặc 10 chữ số, gạch ngang và 3 chữ số.',
  codeFixed: 'Mã không đổi được sau khi tạo.',
  /** {label} {name} {code} */
  duplicate: "{label} '{name}' đã có (mã {code}).",
  duplicateFunction: "Chức năng '{name}' đã có.",
  codeTaken: 'Mã {code} đã có.',
  /** Two people saved the same code, name or tax code at the same moment. */
  raceDuplicate: '{label} trùng với mục vừa được người khác thêm. Tải lại để xem.',
  /** {name} */
  taxTaken: 'Mã số thuế đã có ở pháp nhân {name}.',
  prefixTaken: 'Tiền tố mã nhân viên đã có ở pháp nhân {name}.',
  titleInRules: 'Chức danh đang dùng trong {n} luật cấp quyền. Sửa hoặc tắt các luật đó trước.',
  functionInUse: 'Chức năng đang gắn với {n} vị trí và {m} luật cấp quyền. Chuyển vị trí và sửa luật trước khi ngừng.',
  legalInUse: 'Pháp nhân còn {n} nhân viên và {m} đơn vị. Chuyển trước khi ngừng.',
  locationInUse: 'Nơi làm việc còn {n} nhân viên. Chuyển trước khi ngừng.',
  /** {label} */
  usedNoDelete: '{label} đã được dùng, không xoá được. Hãy chuyển sang Ngừng.',
  legalAllOnly: 'Chỉ HC-NS phạm vi toàn tập đoàn sửa được danh mục pháp nhân.',
  locationScope: 'Bạn chỉ sửa được nơi làm việc thuộc pháp nhân trong phạm vi của mình hoặc nơi làm việc dùng chung.',
  /** {label} {name} */
  notSelectable: '{label} {name} đã ngừng, không chọn được cho dữ liệu mới.',
  notFoundRef: '{label} {code} không có.',
  renameDate: 'Đổi tên pháp nhân cần ngày hiệu lực (theo đăng ký kinh doanh mới).',
  /** {ngay} */
  renameAfter: 'Ngày hiệu lực phải sau ngày của tên hiện tại ({ngay}).',
  alreadyStatus: '{label} đang ở trạng thái {status}.',
} as const;

export function fillMsg(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

const text = (label: string, max: number) =>
  z
    .string({ required_error: `Nhập ${label.toLowerCase()}.`, invalid_type_error: `Nhập ${label.toLowerCase()}.` })
    .transform(tidyName)
    .pipe(z.string().min(1, `Nhập ${label.toLowerCase()}.`).max(max, `${label} tối đa ${max} ký tự.`));
const optionalText = (label: string, max: number) => z.string().trim().max(max, `${label} tối đa ${max} ký tự.`).default('');
const order = z.number().int().min(0).max(1_000_000).optional();
const rev = z.number({ required_error: 'Thiếu số phiên bản dữ liệu (rev).' }).int();

export const JobTitleInput = z
  .object({
    code: z.string({ required_error: CATALOG_MSG.titleCode }).regex(/^[A-Z0-9_]{2,30}$/, CATALOG_MSG.titleCode),
    name: text('Tên', 80),
    level: z.number({ required_error: 'Chọn cấp bậc.', invalid_type_error: 'Chọn cấp bậc.' }).int('Cấp bậc từ 1 đến 7.').min(1, 'Cấp bậc từ 1 đến 7.').max(7, 'Cấp bậc từ 1 đến 7.'),
    default_function_code: z.string({ required_error: 'Chọn chức năng mặc định.' }).min(1, 'Chọn chức năng mặc định.'),
    suggest_manager: z.boolean().default(false),
    description: optionalText('Mô tả', 300),
    order,
  })
  .strict();

export const JobFunctionInput = z
  .object({
    code: z.string({ required_error: CATALOG_MSG.functionCode }).regex(/^[a-z0-9_]{2,30}$/, CATALOG_MSG.functionCode),
    name: text('Tên', 80),
    description: optionalText('Mô tả', 300),
    order,
  })
  .strict();

export const LegalEntityInput = z
  .object({
    code: z.string({ required_error: CATALOG_MSG.legalCode }).regex(/^[A-Z0-9]{2,20}$/, CATALOG_MSG.legalCode),
    name: text('Tên đầy đủ', 200),
    short_name: text('Tên ngắn', 30),
    tax_code: z.string({ required_error: CATALOG_MSG.taxCode }).trim().regex(/^\d{10}(-\d{3})?$/, CATALOG_MSG.taxCode),
    hq_address: text('Địa chỉ trụ sở', 300),
    email_domains: z.array(z.enum(COMPANY_EMAIL_DOMAINS, { errorMap: () => ({ message: 'Domain email phải là vcprosperous.com hoặc vcpart.vn.' }) })).max(2).default([]),
    /** Q-11 phương án C: prefix when VC Home gives employee codes, e.g. `VCP`. */
    employee_code_prefix: z.string().regex(/^[A-Z]{2,6}$/, 'Tiền tố mã nhân viên gồm 2–6 chữ hoa.').nullable().default(null),
  })
  .strict();

export const WorkLocationInput = z
  .object({
    code: z.string({ required_error: CATALOG_MSG.locationCode }).regex(/^[A-Z0-9_]{2,30}$/, CATALOG_MSG.locationCode),
    name: text('Tên', 100),
    kind: z.enum(Object.keys(WORK_LOCATION_KINDS) as [WorkLocationKind, ...WorkLocationKind[]], { errorMap: () => ({ message: 'Chọn loại nơi làm việc.' }) }),
    address: text('Địa chỉ', 300),
    province: z.enum(Object.keys(PROVINCES) as [ProvinceCode, ...ProvinceCode[]], { errorMap: () => ({ message: 'Chọn tỉnh, thành.' }) }),
    /** Empty: shared by every legal entity. */
    legal_entity_code: z.string().min(1).nullable().default(null),
  })
  .strict();

/** Edit: every field but the code; `rev` required. A legal entity's new name also needs `effective_on`. */
export const JobTitlePatch = JobTitleInput.omit({ code: true }).partial().extend({ rev }).strict();
export const JobFunctionPatch = JobFunctionInput.omit({ code: true }).partial().extend({ rev }).strict();
export const LegalEntityPatch = LegalEntityInput.omit({ code: true })
  .partial()
  .extend({
    rev,
    effective_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày hiệu lực không hợp lệ.').optional(),
    reason: z.string().trim().max(200, 'Lý do tối đa 200 ký tự.').optional(),
    /** Pending renames the sender agreed to replace (06 mục 1.5). */
    replace_ids: z.array(z.string()).max(20).optional(),
  })
  .strict();
export const WorkLocationPatch = WorkLocationInput.omit({ code: true }).partial().extend({ rev }).strict();

export const CatalogStatusChange = z.object({ rev, reason: z.string().trim().max(300, 'Lý do tối đa 300 ký tự.').optional() }).strict();

export const CATALOG_SCHEMAS = {
  'job-titles': { create: JobTitleInput, patch: JobTitlePatch },
  'job-functions': { create: JobFunctionInput, patch: JobFunctionPatch },
  'legal-entities': { create: LegalEntityInput, patch: LegalEntityPatch },
  'work-locations': { create: WorkLocationInput, patch: WorkLocationPatch },
} as const;
