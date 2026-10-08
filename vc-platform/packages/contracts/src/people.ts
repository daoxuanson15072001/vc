/** Employee profiles and positions (04 VH-NSU-01, 02, 03; 02 VH-BR-01, 04, 19; 05 mục 3.1, 3.3). */
import { z } from 'zod';
import { COMPANY_EMAIL_DOMAINS } from './catalogs.js';
import { tidyName } from './text.js';

export const EMPLOYEE_TYPES = { chinh_thuc: 'Chính thức', thu_viec: 'Thử việc', cong_tac_vien: 'Cộng tác viên', thuc_tap: 'Thực tập' } as const;
export type EmployeeType = keyof typeof EMPLOYEE_TYPES;

export const PERSON_STATUS = { chua_vao_lam: 'Chưa vào làm', dang_lam: 'Đang làm', nghi_dai_ngay: 'Nghỉ dài ngày', tam_khoa: 'Tạm khoá', da_nghi: 'Đã nghỉ' } as const;
export type PersonStatus = keyof typeof PERSON_STATUS;

export const POSITION_KINDS = { chinh: 'Chính', kiem_nhiem: 'Kiêm nhiệm' } as const;
export type PositionKind = keyof typeof POSITION_KINDS;

/**
 * VH-BR-19: names a profile must never have (checked on the stored schema by a test, VH-NSU-01 tiêu chí 6). Any of
 * them in a request is refused as an unknown field.
 */
export const FORBIDDEN_PERSON_FIELDS = [
  'cccd',
  'cmnd',
  'id_number',
  'national_id',
  'ngay_sinh',
  'birth_date',
  'birthday',
  'dob',
  'gioi_tinh',
  'gender',
  'sex',
  'dia_chi',
  'home_address',
  'address',
  'sdt_ca_nhan',
  'personal_phone',
  'mobile',
  'luong',
  'salary',
  'hop_dong',
  'contract',
  'danh_gia',
  'evaluation',
  'rating',
] as const;

/** Sentences of 04 VH-NSU-01, 02, 03 (placeholders filled by the API). */
export const PEOPLE_MSG = {
  code: 'Mã nhân viên gồm 3–20 ký tự chữ hoa, số hoặc gạch ngang.',
  /** {ma} {ho_ten} {trang_thai} */
  codeUsed: 'Mã nhân viên {ma} đã dùng cho {ho_ten} ({trang_thai}). Mã không được dùng lại.',
  codeLocked: 'Mã nhân viên đã khoá vì hồ sơ đã gắn tài khoản hoặc đã có hiệu lực.',
  emailDomain: 'Email phải có đuôi @vcprosperous.com hoặc @vcpart.vn.',
  /** {email} {ma} {ho_ten} */
  emailTaken: 'Email {email} đã có trong hồ sơ {ma} – {ho_ten}.',
  secondarySame: 'Email phụ phải khác email công ty.',
  noPrimary: 'Chưa có vị trí chính. Chọn đơn vị, chức danh và quản lý trực tiếp.',
  joinedFar: 'Ngày vào cách hôm nay quá 180 ngày. Kiểm lại năm.',
  /** {pham_vi} */
  scope: 'Bạn chỉ sửa được hồ sơ thuộc {pham_vi}.',
  name: 'Họ tên từ 2 đến 80 ký tự, không có chữ số.',
  phone: 'SĐT công việc gồm 10 số bắt đầu bằng 0, hoặc số bàn kèm máy lẻ (ví dụ 02437001234 #123).',
  photo: 'Ảnh phải là JPG hoặc PNG, tối đa 2 MB.',
  notFound: 'Không tìm thấy nhân viên.',
  /** {trang_thai} */
  noShowOnly: 'Chỉ hồ sơ "Chưa vào làm" mới đánh dấu "Không nhận việc" được. Hồ sơ đang ở trạng thái {trang_thai}.',
  joinedOnlyBefore: 'Ngày vào chỉ sửa được khi hồ sơ chưa vào làm.',
  ruleFieldDate: 'Pháp nhân, loại nhân viên, nơi làm việc đổi theo ngày hiệu lực.',
  // VH-NSU-02
  /** {don_vi} {ngay} */
  primaryOverlap: 'Nhân viên đang làm phải có đúng 1 vị trí chính. Vị trí chính mới chồng ngày với vị trí tại {don_vi} từ {ngay}.',
  /** {ten} {ngay} */
  unitStopped: 'Đơn vị {ten} đã ngừng từ {ngay}. Chọn đơn vị khác.',
  /** {ten} */
  titleStopped: 'Chức danh {ten} đã ngừng dùng. Chọn chức danh khác.',
  endBeforeStart: 'Đến ngày phải bằng hoặc sau từ ngày.',
  startBeforeJoined: 'Từ ngày của vị trí không được trước ngày vào.',
  // VH-NSU-03
  managerSelf: 'Không chọn chính mình làm quản lý trực tiếp.',
  managerStatus: 'Quản lý trực tiếp phải là nhân viên đang làm hoặc đang nghỉ dài ngày.',
  /** {ho_ten} */
  managerOnlyOneEmpty: 'Chỉ một người được để trống quản lý trực tiếp (người đứng đầu tập đoàn). Hiện là {ho_ten}.',
} as const;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ.');
const oid = (msg: string) => z.string().regex(/^[0-9a-f]{24}$/, msg);
export const companyEmail = z
  .string()
  .trim()
  .toLowerCase()
  .refine((e) => /^[^@\s]+@[^@\s]+$/.test(e) && (COMPANY_EMAIL_DOMAINS as readonly string[]).includes(e.split('@')[1]), PEOPLE_MSG.emailDomain);
const fullName = z
  .string({ required_error: PEOPLE_MSG.name, invalid_type_error: PEOPLE_MSG.name })
  .transform(tidyName)
  .pipe(z.string().min(2, PEOPLE_MSG.name).max(80, PEOPLE_MSG.name).refine((s) => !/\d/.test(s), PEOPLE_MSG.name));
const workPhone = z.string().trim().regex(/^0\d{9}$|^0\d{9,10} #\d{1,6}$/, PEOPLE_MSG.phone);

/** One position (VH-NSU-02 bảng trường); the start is the change's effective date. */
export const PositionInput = z
  .object({
    unit_code: z.string({ required_error: PEOPLE_MSG.noPrimary }).min(1, PEOPLE_MSG.noPrimary),
    job_title_code: z.string({ required_error: PEOPLE_MSG.noPrimary }).min(1, PEOPLE_MSG.noPrimary),
    /** Defaults to the title's default function (VH-ORG-03 tiêu chí 2). */
    job_function_code: z.string().min(1).optional(),
    /** Empty only for the head of the group (VH-NSU-03 bước 3). */
    manager_person_id: oid('Chọn quản lý trực tiếp.').nullable().default(null),
    end_on: ymd.nullable().default(null),
    basis: z.string().trim().max(100, 'Căn cứ tối đa 100 ký tự.').default(''),
    note: z.string().trim().max(300, 'Ghi chú tối đa 300 ký tự.').default(''),
  })
  .strict();

export const PersonCreate = z
  .object({
    /** Empty: VC Home gives `<prefix of the legal entity><4 digits>` (Q-11). */
    employee_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, PEOPLE_MSG.code).optional(),
    full_name: fullName,
    nickname: z.string().transform(tidyName).pipe(z.string().max(30, 'Tên gọi tối đa 30 ký tự.')).nullable().default(null),
    /** Empty for people without a Google account (workshop, warehouse): in the directory, cannot sign in. */
    work_email: companyEmail.nullable().default(null),
    secondary_email: companyEmail.nullable().default(null),
    work_phone: workPhone.nullable().default(null),
    legal_entity_code: z.string({ required_error: 'Chọn pháp nhân.' }).min(1, 'Chọn pháp nhân.'),
    employee_type: z.enum(Object.keys(EMPLOYEE_TYPES) as [EmployeeType, ...EmployeeType[]], { errorMap: () => ({ message: 'Chọn loại nhân viên.' }) }),
    work_location_code: z.string().min(1).nullable().default(null),
    joined_on: ymd,
    primary: PositionInput.optional(),
    reason: z.string().trim().max(200, 'Lý do tối đa 200 ký tự.').optional(),
  })
  .strict();

/** Edit: fields that apply at once, plus the ones used in rules, which take an effective date (VH-NSU-01 bước 6). */
export const PersonPatch = z
  .object({
    employee_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, PEOPLE_MSG.code),
    full_name: fullName,
    nickname: z.string().transform(tidyName).pipe(z.string().max(30, 'Tên gọi tối đa 30 ký tự.')).nullable(),
    work_email: companyEmail.nullable(),
    secondary_email: companyEmail.nullable(),
    work_phone: workPhone.nullable(),
    joined_on: ymd,
    legal_entity_code: z.string().min(1),
    employee_type: z.enum(Object.keys(EMPLOYEE_TYPES) as [EmployeeType, ...EmployeeType[]], { errorMap: () => ({ message: 'Chọn loại nhân viên.' }) }),
    work_location_code: z.string().min(1).nullable(),
  })
  .partial()
  .extend({
    rev: z.number({ required_error: 'Thiếu số phiên bản dữ liệu (rev).' }).int(),
    effective_on: ymd.optional(),
    reason: z.string().trim().max(200, 'Lý do tối đa 200 ký tự.').optional(),
    replace_ids: z.array(z.string()).max(20).optional(),
  })
  .strict();

/** Fields used in access rules: changed through `person_update` on a date (VH-BR-07, VH-BR-10). */
export const PERSON_RULE_FIELDS = ['legal_entity_code', 'employee_type', 'work_location_code'] as const;

export const PersonNoShow = z.object({ reason: z.string({ required_error: 'Nhập lý do.' }).trim().min(5, 'Nhập lý do (ít nhất 5 ký tự).').max(300, 'Lý do tối đa 300 ký tự.') }).strict();
