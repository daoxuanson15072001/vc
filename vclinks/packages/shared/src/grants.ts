import { z } from 'zod';
import { GRANT_DURATION_HOURS, GRANT_RIGHTS, type GrantRight, type GrantStatus, type GrantType } from './permissions';

/*
 * MH-PQ-07 "Quyền tạm thời" (docs 01 §2.6, PQ-30…32, M1b-10): approving access requests, covers
 * ("Trực thay"), leave requests ("Đăng ký vắng") and the "Tất cả trong phạm vi" view.
 */

export const GRANT_TYPE_LABELS: Record<GrantType | 'dang_ky_vang', string> = {
  xem_ngoai_pham_vi: 'Xem ngoài phạm vi',
  xem_noi_dung_chat: 'Xem nội dung chat',
  truc_thay: 'Trực thay',
  ho_tro_ky_thuat: 'Hỗ trợ kỹ thuật',
  uy_quyen_duyet: 'Ủy quyền duyệt',
  dang_ky_vang: 'Đăng ký vắng',
};

export const GRANT_STATUS_LABELS: Record<GrantStatus, string> = {
  cho_duyet: 'Chờ duyệt',
  hieu_luc: 'Hiệu lực',
  tu_choi: 'Từ chối',
  het_han: 'Hết hạn',
  thu_hoi: 'Đã thu hồi',
};

export const GRANT_RIGHT_LABELS: Record<GrantRight, string> = { xem: 'Xem', ghi_chu: 'Xem + Ghi chú', tra_loi: 'Xem + Trả lời' };

/** Tabs of MH-PQ-07 (`?tab=`). */
export const GRANT_TABS = ['pending', 'mine', 'cover', 'scope', 'all'] as const;
export type GrantTab = (typeof GRANT_TABS)[number];
export const GRANT_TAB_LABELS: Record<GrantTab, string> = {
  pending: 'Chờ tôi duyệt',
  mine: 'Của tôi',
  cover: 'Trực thay',
  scope: 'Tất cả trong phạm vi',
  all: 'Tất cả',
};

/** Max length of a cover (PQ-32). */
export const COVER_MAX_DAYS = 30;

/** One row of MH-PQ-07 (a grant, or a leave request when `type` is `dang_ky_vang`). */
export interface AccessGrantRow {
  id: string;
  type: GrantType | 'dang_ky_vang';
  status: GrantStatus;
  userId: string;
  userName: string;
  /** truc_thay / dang_ky_vang: the absent person. */
  absentUserId?: string;
  absentUserName?: string;
  targetType: string;
  targetId: string;
  /** Customer / conversation / nick name; the bare id while a requester waits (MH-PQ-07 #3). */
  targetLabel: string;
  rights: GrantRight[];
  durationHours?: number;
  from?: string;
  to?: string;
  reason: string;
  requestedByName?: string;
  approverName?: string;
  approvedByName?: string;
  createdAt: string;
  /** dang_ky_vang: proposed cover. */
  proposedCoverId?: string | null;
  proposedCoverName?: string | null;
  canApprove?: boolean;
  canReject?: boolean;
  canCancel?: boolean;
  canRevoke?: boolean;
  canEnd?: boolean;
  canReviewRequest?: boolean;
}

export interface AccessGrantList {
  tab: GrantTab;
  tabs: GrantTab[];
  pendingCount: number;
  items: AccessGrantRow[];
}

export const grantListQuerySchema = z.object({ tab: z.enum(GRANT_TABS).optional() });

export const grantApproveSchema = z
  .object({ durationHours: z.number().int().refine((h) => (GRANT_DURATION_HOURS as readonly number[]).includes(h), 'Thời hạn không hợp lệ').optional() })
  .strict();

export const grantRejectSchema = z.object({ reason: z.string().trim().min(5, 'Lý do cần ít nhất 5 ký tự').max(300) }).strict();

/** "Xin quyền theo SĐT / mã KH" (MH-PQ-07 #6a, PQ-49): the answer never says whether the customer exists. */
export const grantByIdentitySchema = z
  .object({
    query: z.string().trim().min(3).max(60),
    right: z.enum(GRANT_RIGHTS).default('xem'),
    durationHours: z.number().int().refine((h) => (GRANT_DURATION_HOURS as readonly number[]).includes(h), 'Thời hạn không hợp lệ').default(24),
    reason: z.string().trim().min(10, 'Lý do cần 10–300 ký tự').max(300, 'Lý do cần 10–300 ký tự'),
  })
  .strict();
export const GRANT_BY_IDENTITY_MESSAGE = 'Đã gửi yêu cầu. Nếu khách thuộc phạm vi cần duyệt, người duyệt sẽ nhận.';

const isoDate = z.string().datetime({ offset: true });

/** "Tạo trực thay" (MH-PQ-07 #4–#6): one cover person per nick the absent person holds. */
export const coverCreateSchema = z
  .object({
    absentUserId: z.string().min(1).max(100),
    covers: z.array(z.object({ uid: z.string().min(1).max(128), userId: z.string().min(1).max(100) }).strict()).max(20),
    from: isoDate,
    to: isoDate,
    /** Required when `from` is before now (PQ-32 v1.4.2). */
    backdateReason: z.string().trim().min(10).max(300).optional(),
    /** Agreeing to a leave request creates its cover. */
    leaveRequestId: z.string().min(1).max(100).optional(),
  })
  .strict();
export type CoverCreateInput = z.infer<typeof coverCreateSchema>;

/** "Đăng ký vắng" (MH-PQ-07 #6c). */
export const leaveRequestSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    reason: z.string().trim().min(5, 'Lý do cần ít nhất 5 ký tự').max(300),
    proposedCoverId: z.string().min(1).max(100).optional(),
    note: z.string().trim().max(500).optional(),
    backdateReason: z.string().trim().min(10).max(300).optional(),
  })
  .strict();
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

/** Data for the "Tạo trực thay" modal. */
export interface CoverOptions {
  absentees: { id: string; name: string }[];
  /** Nicks the selected absent person holds. */
  nicks: { uid: string; label: string }[];
  candidates: { id: string; name: string }[];
}

/** Answer of every write of MH-PQ-07: the toast text. */
export interface GrantActionResult {
  message: string;
  id?: string;
}

/** `dd/MM/yyyy HH:mm` in Asia/Ho_Chi_Minh. */
export function fmtVnDateTime(d: Date): string {
  const l = new Date(d.getTime() + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(l.getUTCDate())}/${p(l.getUTCMonth() + 1)}/${l.getUTCFullYear()} ${p(l.getUTCHours())}:${p(l.getUTCMinutes())}`;
}

/** "Đã giao <người trực> trực thay <người vắng> từ <…> đến <…>." (MH-PQ-07). */
export function coverCreatedMessage(cover: string, absent: string, from: Date, to: Date): string {
  return `Đã giao ${cover} trực thay ${absent} từ ${fmtVnDateTime(from)} đến ${fmtVnDateTime(to)}.`;
}

/** 18:00 summary to the absent person (QT-SZ-10 #6, PQ-32). */
export function coverSummaryText(cover: string, nick: string, conversations: number, reveals: number): string {
  return `Trong lúc bạn vắng: ${cover} trực nick ${nick}, đã trả lời ${conversations} hội thoại, đã hiện SĐT ${reveals} lần.`;
}
