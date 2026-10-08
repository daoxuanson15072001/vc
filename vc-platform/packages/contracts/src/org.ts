/** Org unit tree (04 VH-ORG-01, 04; 02 VH-BR-06; 05 mục 3.4). Placement rules are checked on the server (VH-NFR-18). */
import { z } from 'zod';
import { COMPANY_EMAIL_DOMAINS } from './catalogs.js';
import { tidyName } from './text.js';

export const UNIT_TYPES = ['tap_doan', 'phap_nhan', 'division', 'phong', 'to_nhom'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];
export type UnitStatus = 'hoat_dong' | 'ngung';

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  tap_doan: 'Tập đoàn',
  phap_nhan: 'Pháp nhân',
  division: 'Division',
  phong: 'Khối / Phòng',
  to_nhom: 'Tổ / Nhóm',
};
export const UNIT_STATUS_LABEL: Record<UnitStatus | 'da_xoa', string> = { hoat_dong: 'Hoạt động', ngung: 'Ngừng', da_xoa: 'Đã xoá' };

/**
 * Allowed parent types (05 mục 3.4 "Luật đặt cha"; 02 VH-BR-06). A Tổ / Nhóm may hold Tổ / Nhóm one level deep, like the
 * nested sales teams of VClinks.
 */
export const UNIT_PARENTS: Record<UnitType, UnitType[]> = {
  tap_doan: [],
  phap_nhan: ['tap_doan'],
  division: ['tap_doan', 'phap_nhan'],
  phong: ['tap_doan', 'phap_nhan', 'division', 'phong'],
  to_nhom: ['division', 'phong', 'to_nhom'],
};

export const MAX_UNIT_DEPTH = 8;
export const UNIT_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,29}$/;

/** Sentences of 04 VH-ORG-01, 04 (placeholders filled by the API). */
export const UNIT_MSG = {
  code: 'Mã đơn vị gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới.',
  /** {ma} {ten} {trang_thai} */
  codeUsed: 'Mã {ma} đã dùng cho đơn vị {ten} ({trang_thai}). Mã không được dùng lại.',
  /** {loai} {loai_cha} */
  placement: '{loai} chỉ đặt dưới {loai_cha}.',
  nested: 'Tổ / Nhóm chỉ chứa được Tổ / Nhóm con một cấp.',
  oneRoot: 'Chỉ có một đơn vị gốc loại Tập đoàn.',
  /** {dich} {don_vi} */
  cycle: 'Không chuyển được: {dich} đang nằm dưới {don_vi}. Chuyển thế này sẽ tạo vòng.',
  depth: 'Cây đơn vị sâu tối đa 8 cấp.',
  /** {n} {m} */
  stopInUse: 'Đơn vị còn {n} vị trí đang hiệu lực và {m} đơn vị con đang hoạt động. Chuyển hết người và đơn vị con trước khi ngừng.',
  /** {ten} */
  nameTaken: 'Tên {ten} đã có trong cùng đơn vị cha.',
  parentStopped: 'Đơn vị cha {ten} đã ngừng, không thêm hoặc chuyển đơn vị vào được.',
  rootFixed: 'Đơn vị gốc không chuyển, ngừng hay xoá được.',
  chooseLegal: 'Chọn pháp nhân cho đơn vị nằm thẳng dưới Tập đoàn.',
  legalInherited: 'Pháp nhân của đơn vị này tự lấy theo đơn vị cha.',
  /** {ma} {ten} */
  legalLinked: 'Pháp nhân {ma} đã gắn với đơn vị {ten}.',
  typeFixed: 'Loại đơn vị không đổi được khi đơn vị đã từng có vị trí.',
  usedNoDelete: 'Đơn vị đã từng có vị trí, không xoá được. Hãy chuyển sang Ngừng.',
  /** {m} */
  childrenNoDelete: 'Đơn vị còn {m} đơn vị con. Chuyển hoặc xoá đơn vị con trước.',
  groupEmail: 'Email nhóm phải thuộc vcprosperous.com hoặc vcpart.vn.',
  /** VH-ORG-04 */
  headNoPosition: 'Người được chọn chưa có vị trí trong {don_vi} hoặc đơn vị cha trực tiếp. Thêm vị trí (chính hoặc kiêm nhiệm) trước.',
  headNotWorking: 'Chỉ chọn được nhân viên đang làm.',
  headUnitStopped: 'Đơn vị đã ngừng, không đặt trưởng được.',
  /** {don_vi} {ten} {ngay}: VH-BR-06 "tối đa 1 trưởng"; replacing must be chosen on purpose. */
  headExists: '{don_vi} đã có trưởng {ten}. Mỗi đơn vị chỉ có một trưởng. Chọn "Thay trưởng" để {ten} thôi từ ngày {ngay}.',
  /** {ten} {don_vi} */
  headSame: '{ten} đang là trưởng {don_vi}.',
  headNone: '{don_vi} chưa có trưởng.',
} as const;

const name = z
  .string({ required_error: 'Nhập tên đơn vị.', invalid_type_error: 'Nhập tên đơn vị.' })
  .transform(tidyName)
  .pipe(z.string().min(2, 'Tên đơn vị từ 2 đến 100 ký tự.').max(100, 'Tên đơn vị từ 2 đến 100 ký tự.'));
const shortName = z.string().transform(tidyName).pipe(z.string().max(30, 'Tên ngắn tối đa 30 ký tự.')).nullable();
const groupEmail = z
  .string()
  .trim()
  .toLowerCase()
  .refine((e) => /^[^@\s]+@[^@\s]+$/.test(e) && (COMPANY_EMAIL_DOMAINS as readonly string[]).includes(e.split('@')[1]), UNIT_MSG.groupEmail)
  .nullable();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày hiệu lực không hợp lệ.');
const rev = z.number({ required_error: 'Thiếu số phiên bản dữ liệu (rev).' }).int();
const reason = z.string().trim().max(200, 'Lý do tối đa 200 ký tự.');

export const OrgUnitCreate = z
  .object({
    code: z.string({ required_error: UNIT_MSG.code }).regex(UNIT_CODE_RE, UNIT_MSG.code),
    name,
    short_name: shortName.default(null),
    type: z.enum(UNIT_TYPES, { errorMap: () => ({ message: 'Chọn loại đơn vị.' }) }),
    parent_code: z.string({ required_error: 'Chọn đơn vị cha.' }).min(1, 'Chọn đơn vị cha.'),
    /** Only for a Pháp nhân unit (its 1–1 legal entity) or a unit right under the root. */
    legal_entity_code: z.string().min(1).nullable().default(null),
    function_code: z.string().min(1).nullable().default(null),
    order: z.number().int().min(0).max(1_000_000).optional(),
    group_email: groupEmail.default(null),
    description: z.string().trim().max(300, 'Mô tả tối đa 300 ký tự.').default(''),
    /** GĐ B: today by default; imports may set a later day. */
    effective_on: ymd.optional(),
    reason: reason.optional(),
  })
  .strict();

export const OrgUnitPatch = z
  .object({
    name,
    short_name: shortName,
    order: z.number().int().min(0).max(1_000_000),
    group_email: groupEmail,
    description: z.string().trim().max(300, 'Mô tả tối đa 300 ký tự.'),
    function_code: z.string().min(1).nullable(),
    type: z.enum(UNIT_TYPES, { errorMap: () => ({ message: 'Chọn loại đơn vị.' }) }),
    legal_entity_code: z.string().min(1).nullable(),
  })
  .partial()
  .extend({ rev, reason: reason.optional() })
  .strict();

export const OrgUnitMove = z
  .object({
    parent_code: z.string({ required_error: 'Chọn đơn vị cha mới.' }).min(1, 'Chọn đơn vị cha mới.'),
    legal_entity_code: z.string().min(1).nullable().optional(),
    rev,
    reason: reason.optional(),
    replace_ids: z.array(z.string()).max(20).optional(),
  })
  .strict();

export const OrgUnitHead = z
  .object({
    /** People id (hex); null: the current head steps down and the unit has no head. */
    person_id: z.string().regex(/^[0-9a-f]{24}$/, 'Chọn nhân viên.').nullable(),
    effective_on: ymd.optional(),
    /** The user chose "Thay trưởng": the current head steps down the day before. */
    replace_current: z.boolean().default(false),
    /** "Cập nhật quản lý trực tiếp cho {n} người đang báo cáo trưởng cũ" (VH-ORG-04 bước 4). */
    update_reports: z.boolean().default(true),
    reason: reason.optional(),
    replace_ids: z.array(z.string()).max(20).optional(),
  })
  .strict();

export const OrgUnitStatusChange = z.object({ rev, reason: z.string().trim().max(300, 'Lý do tối đa 300 ký tự.').optional() }).strict();
