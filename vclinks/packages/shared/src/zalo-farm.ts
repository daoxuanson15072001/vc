import { z } from 'zod';

/*
 * "Máy Zalo" (docs/01-quan-ly-du-an/ke-hoach-zalo-ca-nhan-quet-qr.md): a personal Zalo nick connected by scanning
 * a QR code shown on the Dashboard, like Zalo Web. A slot is one Chrome profile on the server running Zalo Web
 * with the VClinks extension. The Zalo session lives in that profile only: VClinks never stores cookies or
 * tokens (§12.2), and the QR image is relayed, never stored.
 */

export const ZALO_SLOT_STATES = ['dang_bat', 'cho_quet', 'da_quet', 'dang_ket_noi', 'da_ket_noi', 'mat_phien', 'quet_nham', 'loi', 'da_ngat'] as const;
export type ZaloSlotState = (typeof ZALO_SLOT_STATES)[number];

export const ZALO_SLOT_STATE_LABELS: Record<ZaloSlotState, string> = {
  dang_bat: 'Đang mở Zalo Web',
  cho_quet: 'Chờ quét mã QR',
  da_quet: 'Đã quét, hãy bấm Đăng nhập trên điện thoại',
  dang_ket_noi: 'Đang kết nối',
  da_ket_noi: 'Đã kết nối',
  mat_phien: 'Mất phiên, cần quét lại mã QR',
  quet_nham: 'Quét nhầm tài khoản Zalo khác',
  loi: 'Máy Zalo gặp lỗi',
  da_ngat: 'Đã ngắt kết nối',
};

/**
 * How a nick of the máy Zalo talks to Zalo: `browser` = Chrome with Zalo Web and the VClinks extension; `direct` =
 * a zca-js session (docs/01-quan-ly-du-an/ke-hoach-zalo-truc-tiep-zca-js.md). Direct is in its trial step (P0).
 */
export const ZALO_SLOT_MODES = ['browser', 'direct'] as const;
export type ZaloSlotMode = (typeof ZALO_SLOT_MODES)[number];

/** Body of `PATCH /api/zalo/slots/:id` (Admin): per-nick options of the máy Zalo. */
export const zaloSlotOptionsSchema = z
  .object({
    /**
     * Also open conversations that still have unread messages to read their content (automatic sync and Dashboard
     * fetches). Zalo then tells the sender "Đã xem" and the holder loses the unread badge on the phone.
     */
    openUnread: z.boolean().optional(),
  })
  .strict()
  .refine((o) => o.openUnread !== undefined, { message: 'Chọn một tùy chọn' });
export type ZaloSlotOptions = z.infer<typeof zaloSlotOptionsSchema>;

/** One sticker of Zalo's sticker search (direct nicks): what `send_sticker` needs, and its image. */
export interface ZaloStickerView {
  id: number;
  cateId: number;
  type: number;
  /** Image of the sticker (https). */
  url: string;
}

/** GET /api/zalo/stickers: `direct: false` = the nick sends through Zalo Web, which offers its default set instead. */
export interface ZaloStickerSearch {
  direct: boolean;
  items: ZaloStickerView[];
}

/** State label for one slot: a direct (zca-js) slot never opens Zalo Web, it prepares a QR. */
export function zaloSlotStateLabel(state: ZaloSlotState, mode: ZaloSlotMode | undefined): string {
  if (mode === 'direct' && state === 'dang_bat') return 'Đang tạo mã QR';
  return ZALO_SLOT_STATE_LABELS[state];
}

/** Body of `POST /api/zalo/slots` (Admin): one company nick to connect. */
export const createZaloSlotSchema = z
  .object({
    label: z.string().trim().min(2, 'Đặt tên nick (ít nhất 2 ký tự)').max(60),
    divisionId: z.string().trim().min(1).max(100),
    holderUserId: z.string().trim().min(1).max(100),
    mode: z.enum(ZALO_SLOT_MODES).default('browser'),
    /**
     * Direct mode only: Zalo Web first, to bring the nick's history (Zalo keeps no history for a new direct session),
     * then the máy Zalo moves the nick to direct by itself (plan P4). One QR scan either way.
     */
    history: z.boolean().optional(),
    /** Plan Q2 (NĐ 13/2023): only company nicks; the Admin confirms it, and the confirmation is logged. */
    companyNick: z.literal(true, { errorMap: () => ({ message: 'Chỉ kết nối nick công ty: hãy xác nhận đây là nick công ty' }) }),
  })
  .strict();
export type CreateZaloSlot = z.infer<typeof createZaloSlotSchema>;

export interface ZaloSlotView {
  id: string;
  label: string;
  divisionId: string;
  divisionName: string | null;
  holderUserId: string;
  holderName: string | null;
  mode: ZaloSlotMode;
  /** Zalo uid once the nick has logged in; null before the first scan. */
  uid: string | null;
  state: ZaloSlotState;
  /** Opens unread conversations to read their content (sender sees "Đã xem"); off by default. */
  openUnread: boolean;
  /** Zalo Web now, moving to direct by itself at this time (nick created "Trực tiếp, lấy cả tin cũ"). */
  handoverAt: string | null;
  /** Direct now, and the Zalo Web profile is still kept: "Quay về Zalo Web" is possible (7 days after the move). */
  chromeKept: boolean;
  /** The viewer may disconnect this nick: an Admin (`channel.confirm`) or its holder (dev002, 07/10/2026). */
  canDisconnect: boolean;
  /** Only while the QR is shown and only for the holder / Admin; a PNG data URL relayed from the server, never stored. */
  qr: { png: string; expired: boolean } | null;
  /** One sentence for the person scanning (wrong account, error, what happens next). */
  message: string | null;
  connectedAt: string | null;
  createdAt: string;
}

export interface ZaloFarmStatus {
  /** False when this server has no "máy Zalo" (ZALO_FARM_URL unset or not answering). */
  installed: boolean;
  slots: number;
  max: number;
  /** Whether the signed-in user may connect nicks and disconnect any of them (channel.confirm); a holder disconnects his own (`ZaloSlotView.canDisconnect`). */
  canManage: boolean;
}

/** Result of `POST /api/zalo/slots/:id/sync-history`: ask the phone to send older messages (Zalo "Đồng bộ ngay"). */
export interface ZaloSyncHistoryResult {
  requested: boolean;
  message: string;
}
