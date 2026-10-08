import { z } from 'zod';

/**
 * Offboarding and handover contracts (M1b-11, docs 01 MH-PQ-04, PQ-33/34/51, 03 QT-SZ-11).
 * Step 1 (lock) is `POST /admin/users/:id/offboard`; steps 2-4 use the preview / handover routes below.
 */

export const HANDOVER_MODES = ['one', 'even', 'region', 'pick'] as const;
export type HandoverMode = (typeof HANDOVER_MODES)[number];
export const HANDOVER_MODE_LABELS: Record<HandoverMode, string> = {
  one: 'Một người',
  even: 'Chia đều',
  region: 'Theo khu vực / tag',
  pick: 'Chọn từng khách',
};

/** Offboard body: reason + the device tokens an Admin keeps ("máy công ty dùng chung"). */
export const offboardInputSchema = z
  .object({
    reason: z.string().trim().min(5, 'Lý do ít nhất 5 ký tự.').max(200),
    keepDeviceTokenIds: z.array(z.string().min(1)).max(50).default([]),
  })
  .strict();
export type OffboardInput = z.infer<typeof offboardInputSchema>;

export const handoverChannelSchema = z
  .object({
    uid: z.string().min(1),
    toUserId: z.string().min(1),
    /** Zalo logged out on the old phone and password changed (done outside VClinks; only who / when is stored). */
    phoneLogoutConfirmed: z.boolean().default(false),
    note: z.string().trim().max(200).optional(),
    qrRescanned: z.boolean().default(false),
  })
  .strict();

const planBase = {
  mode: z.enum(HANDOVER_MODES),
  /** one: exactly one receiver; even / region: one or more. */
  toUserIds: z.array(z.string().min(1)).max(100).default([]),
  /** pick: customer account id → receiver. Also used to override single rows of any mode. */
  picks: z.record(z.string(), z.string()).default({}),
};
export const handoverPreviewSchema = z.object(planBase).strict();
export type HandoverPreviewInput = z.infer<typeof handoverPreviewSchema>;

export const handoverInputSchema = z
  .object({
    ...planBase,
    channels: z.array(handoverChannelSchema).max(100).default([]),
    effectiveAt: z.string().datetime().optional(),
    notifyReceivers: z.boolean().default(true),
  })
  .strict();
export type HandoverInput = z.infer<typeof handoverInputSchema>;

export interface OffboardPreview {
  userId: string;
  fullName: string;
  status: string;
  /** Device tokens bound to the nicks this person holds, or held by him (step 1, 4a). */
  deviceTokens: { id: string; name: string; deviceName: string | null; uids: string[] }[];
  pendingCommands: number;
  managedUnits: { id: string; name: string }[];
  customers: number;
  openConversations: number;
  nicks: { uid: string; label: string; unsafe: boolean }[];
  /** Counts of what stays on the nick (step 3, 11c): never message text. */
  nickLoad: { uid: string; needsReapproval: number; pendingFriendRequests: number; unansweredConversations: number }[];
  /** Locked at, and the 24 h deadline of PQ-34. */
  lockedAt: string | null;
  deadlineAt: string | null;
}

export interface HandoverPlanRow {
  userId: string;
  name: string;
  customers: number;
  /** No revenue source before VCsales (E5): null until then. */
  revenue12m: number | null;
  gradeA: number;
}
export interface HandoverPlanPreview {
  rows: HandoverPlanRow[];
  excluded: { userId: string; name: string; reason: string }[];
  total: number;
}

export interface HandoverResult {
  id: string;
  customersMoved: number;
  conversationsMoved: number;
  nicksMoved: number;
  unsafeNicks: number;
  message: string;
}

export const HANDOVER_TEXT = {
  notLocked: 'Người này chưa bị khóa. Hãy "Khóa ngay" ở bước 1 trước khi bàn giao.',
  done: (customers: number, nicks: number, names: string) => `Đã bàn giao ${customers} khách và ${nicks} nick cho ${names}.`,
  unsafe: (n: number) => ` ${n} nick chưa xác nhận đăng xuất điện thoại cũ. Chưa gửi được qua nick này tới khi xác nhận; hệ thống sẽ nhắc hằng ngày.`,
  safeConfirmed: (label: string) => `Đã ghi nhận nick ${label} đã đăng xuất khỏi thiết bị cũ. Nick đã gửi được.`,
  locked: (name: string, devices: number, held: number) =>
    `Đã khóa tài khoản ${name}. Đã thu hồi ${devices} thiết bị; ${held} lệnh gửi chuyển Cần duyệt lại. Hoàn tất bàn giao trong 24 giờ, nếu không khách sẽ về "Chưa phân công".`,
} as const;
