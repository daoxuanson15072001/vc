import { z } from 'zod';

/*
 * Phiếu báo giá / hậu mãi do CSKH soạn, NVKD giữ nick duyệt (M1c-03; BA D9-01…D9-05, F9.15, BR20, BR21;
 * 03 QT-SZ-13…15, MH-SZ-15; 04 MH-OA-20; 01 PQ-119…PQ-121). Shapes shared by the API and the Dashboard.
 *
 * Invariant (CLAUDE.md §12.1, BR20): the only edge that sends anything is `approve`, pressed by the nick
 * holder (or his active "Trực nick"); the outbox command carries approvedBy / approvedAt of that person.
 * CSKH has no event that sends.
 */

export const WORKITEM_KINDS = ['bao_gia', 'hau_mai'] as const;
export type WorkitemKind = (typeof WORKITEM_KINDS)[number];
export const WORKITEM_KIND_LABELS: Record<WorkitemKind, string> = { bao_gia: 'Báo giá', hau_mai: 'Hậu mãi' };

/** Hàng việc CSKH (D9-01, BR22). A kind always goes to one queue. */
export const WORKITEM_QUEUES = ['ban_hang', 'hau_mai'] as const;
export type WorkitemQueue = (typeof WORKITEM_QUEUES)[number];
export const WORKITEM_QUEUE_LABELS: Record<WorkitemQueue, string> = { ban_hang: 'Bán hàng', hau_mai: 'Hậu mãi' };
export const queueOfKind = (k: WorkitemKind): WorkitemQueue => (k === 'bao_gia' ? 'ban_hang' : 'hau_mai');

/** Loại hậu mãi (QT-SZ-13 bước 2). */
export const AFTERSALES_TYPES = ['bao_hanh', 'doi_tra', 'khieu_nai', 'khac'] as const;
export type AftersalesType = (typeof AFTERSALES_TYPES)[number];
export const AFTERSALES_TYPE_LABELS: Record<AftersalesType, string> = { bao_hanh: 'Bảo hành', doi_tra: 'Đổi trả', khieu_nai: 'Khiếu nại', khac: 'Khác' };

/** D9-02 states (BA Ticket.trạng thái). */
export const WORKITEM_STATUSES = ['moi', 'cskh_xu_ly', 'cho_nvkd_duyet', 'tra_lai', 'da_gui_khach', 'cho_khach', 'cho_hang', 'xong'] as const;
export type WorkitemStatus = (typeof WORKITEM_STATUSES)[number];
export const WORKITEM_STATUS_LABELS: Record<WorkitemStatus, string> = {
  moi: 'Mới',
  cskh_xu_ly: 'CSKH đang xử lý',
  cho_nvkd_duyet: 'Chờ NVKD duyệt',
  tra_lai: 'Trả lại CSKH',
  da_gui_khach: 'Đã gửi khách',
  cho_khach: 'Chờ khách',
  cho_hang: 'Chờ hãng',
  xong: 'Xong',
};
/** Chip text on the chat header (MH-SZ-15 #3), seen by the approver. */
export const WORKITEM_CHIP_LABELS: Record<WorkitemStatus, string> = {
  moi: 'CSKH đang xử lý',
  cskh_xu_ly: 'CSKH đang xử lý',
  cho_nvkd_duyet: 'Chờ bạn duyệt',
  tra_lai: 'Đã trả lại · CSKH sửa',
  da_gui_khach: 'Đang gửi khách',
  cho_khach: 'Chờ khách',
  cho_hang: 'Chờ hãng',
  xong: 'Xong',
};
export const WORKITEM_OPEN_STATUSES: readonly WorkitemStatus[] = WORKITEM_STATUSES.filter((s) => s !== 'xong');

/** "Trả lại" reasons (QT-SZ-15 3b), one is mandatory. */
export const RETURN_REASONS = ['sai_ma', 'sai_so_luong', 'gia_chua_dung', 'thieu_hang_thay_the', 'loi_nhan_chua_on', 'khac'] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];
export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  sai_ma: 'Sai mã',
  sai_so_luong: 'Sai số lượng',
  gia_chua_dung: 'Giá chưa đúng chính sách khách',
  thieu_hang_thay_the: 'Thiếu hàng thay thế',
  loi_nhan_chua_on: 'Lời nhắn chưa ổn',
  khac: 'Khác',
};

/** Results of "Xong" (D9-02: kết quả bắt buộc). */
export const WORKITEM_RESULTS = ['khach_dong_y', 'khach_tu_choi', 'het_han', 'doi_moi', 'sua_chua', 'tu_choi_bao_hanh', 'hoan_tien', 'nvkd_tu_xu_ly', 'khac'] as const;
export type WorkitemResult = (typeof WORKITEM_RESULTS)[number];
export const WORKITEM_RESULT_LABELS: Record<WorkitemResult, string> = {
  khach_dong_y: 'Khách đồng ý',
  khach_tu_choi: 'Khách từ chối',
  het_han: 'Hết hạn',
  doi_moi: 'Đổi mới',
  sua_chua: 'Sửa chữa',
  tu_choi_bao_hanh: 'Từ chối bảo hành',
  hoan_tien: 'Hoàn tiền',
  nvkd_tu_xu_ly: 'NVKD tự xử lý',
  khac: 'Khác',
};
export const RESULTS_BY_KIND: Record<WorkitemKind, readonly WorkitemResult[]> = {
  bao_gia: ['khach_dong_y', 'khach_tu_choi', 'het_han', 'khac'],
  hau_mai: ['doi_moi', 'sua_chua', 'tu_choi_bao_hanh', 'hoan_tien', 'khac'],
};

/** Where an after-sales item goes once the approved answer reached the customer (set by CSKH before submitting). */
export const AFTER_SEND_STATES = ['cskh_xu_ly', 'cho_hang', 'xong'] as const;
export type AfterSendState = (typeof AFTER_SEND_STATES)[number];

/**
 * Events of the D9-02 machine. `who` is documentation (enforced by the API with the permission keys):
 * cs = CSKH giữ phiếu (TK), approver = người giữ nick / trực nick (workitem.approve NICK),
 * returner = workitem.return (NVKD NICK/CT, GS TỔ, GĐ DV), system = jobs / outbox result.
 */
export const WORKITEM_EVENTS = {
  start: { from: ['moi', 'tra_lai'], to: 'cskh_xu_ly', who: 'cs' },
  submit: { from: ['cskh_xu_ly', 'tra_lai'], to: 'cho_nvkd_duyet', who: 'cs' },
  return: { from: ['cho_nvkd_duyet'], to: 'tra_lai', who: 'returner' },
  approve: { from: ['cho_nvkd_duyet'], to: 'da_gui_khach', who: 'approver' },
  send_failed: { from: ['da_gui_khach'], to: 'cho_nvkd_duyet', who: 'system' },
  /** Quote → Chờ khách; after-sales → the state CSKH chose (Chờ hãng / CSKH đang xử lý / Xong). */
  sent: { from: ['da_gui_khach'], to: ['cho_khach', 'cho_hang', 'cskh_xu_ly', 'xong'], who: 'system' },
  self_reply: { from: ['moi', 'cskh_xu_ly', 'tra_lai', 'cho_nvkd_duyet'], to: 'xong', who: 'returner' },
  wait_vendor: { from: ['cskh_xu_ly'], to: 'cho_hang', who: 'cs' },
  vendor_back: { from: ['cho_hang'], to: 'cskh_xu_ly', who: 'cs' },
  close: { from: ['cskh_xu_ly', 'cho_khach', 'cho_hang'], to: 'xong', who: 'cs' },
} as const satisfies Record<string, { from: readonly WorkitemStatus[]; to: WorkitemStatus | readonly WorkitemStatus[]; who: string }>;
export type WorkitemEvent = keyof typeof WORKITEM_EVENTS;

/**
 * Next state for `event` from `from`, or null when the edge does not exist. `to` picks among several targets
 * (only `sent`); it must be one of them.
 */
export function workitemTransition(from: WorkitemStatus, event: WorkitemEvent, to?: WorkitemStatus): WorkitemStatus | null {
  const e = WORKITEM_EVENTS[event];
  if (!(e.from as readonly WorkitemStatus[]).includes(from)) return null;
  if (typeof e.to === 'string') return e.to;
  const targets = e.to as readonly WorkitemStatus[];
  if (!to || !targets.includes(to)) return null;
  return to;
}

/** Defaults of thresholds still waiting for the owner (E7): T-36 = 2 returns, remind at 10′, supervisor at 20′. */
export const WORKITEM_DEFAULTS = { maxReturns: 2, remindMinutes: 10, escalateMinutes: 20 } as const;
export const WORKITEM_MAX_MESSAGES = 10;
export const WORKITEM_MESSAGE_MAX = 2000;
export const WORKITEM_NOTE_MAX = 500;

const shortId = z.string().trim().min(1).max(160);

/** "Tạo phiếu" / "Tạo ticket" from the chat selection (QT-SZ-13, QT-SZ-14). */
export const workitemCreateSchema = z
  .object({
    uid: shortId,
    threadId: shortId,
    kind: z.enum(WORKITEM_KINDS),
    /** `_id`s of the chosen messages (1..10), all of this conversation. */
    messageIds: z.array(shortId).min(1).max(WORKITEM_MAX_MESSAGES),
    /** "Ghi chú cho CSKH" (quote) / "Mô tả ngắn" (after-sales, ≥ 10 characters). */
    note: z.string().trim().max(WORKITEM_NOTE_MAX).default(''),
    aftersalesType: z.enum(AFTERSALES_TYPES).optional(),
    /** "Hạn cần gửi khách" (ISO). */
    dueAt: z.coerce.date().optional(),
    /** "Cho AI trích nhu cầu" (stored; extraction runs only when enabled). */
    aiExtract: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.kind === 'hau_mai') {
      if (!v.aftersalesType) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['aftersalesType'], message: 'Chọn loại hậu mãi.' });
      if (v.note.length < 10) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Mô tả ngắn tối thiểu 10 ký tự.' });
    }
    if (new Set(v.messageIds).size !== v.messageIds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['messageIds'], message: 'Tin bị chọn trùng.' });
  });
export type WorkitemCreateInput = z.output<typeof workitemCreateSchema>;

/** CSKH edits the draft before "Chuyển NVKD duyệt". */
export const workitemDraftSchema = z
  .object({
    message: z.string().max(WORKITEM_MESSAGE_MAX).optional(),
    /** Approved VCsales quote attached to the item (BR16, BR21); null detaches. */
    quoteNo: z.string().trim().min(1).max(64).nullable().optional(),
    afterSend: z.enum(AFTER_SEND_STATES).optional(),
    vendorDueAt: z.coerce.date().nullable().optional(),
  })
  .strict();
export type WorkitemDraftInput = z.output<typeof workitemDraftSchema>;

export const workitemReturnSchema = z.object({ reason: z.enum(RETURN_REASONS), note: z.string().trim().max(WORKITEM_NOTE_MAX).default('') }).strict();
export const workitemApproveSchema = z
  .object({
    /** The approver may edit the words, not the quote (F9.15). */
    message: z.string().trim().min(1).max(WORKITEM_MESSAGE_MAX),
    /** `version` of the quote the approver looked at (BR16): a newer one stops the send. */
    quoteVersion: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
export const workitemSelfReplySchema = z.object({ note: z.string().trim().max(WORKITEM_NOTE_MAX).default('') }).strict();
export const workitemWaitVendorSchema = z.object({ vendorDueAt: z.coerce.date() }).strict();
export const workitemCloseSchema = z.object({ result: z.enum(WORKITEM_RESULTS), note: z.string().trim().max(WORKITEM_NOTE_MAX).default('') }).strict();
export const workitemAssignSchema = z.object({ assigneeId: shortId }).strict();
export const workitemQueueConfigSchema = z
  .object({ divisionId: shortId, queue: z.enum(WORKITEM_QUEUES), members: z.array(shortId).max(200) })
  .strict();
export const workitemListQuerySchema = z.object({
  view: z.enum(['approvals', 'queue', 'conversation', 'mine']).default('queue'),
  queue: z.enum(WORKITEM_QUEUES).optional(),
  uid: shortId.optional(),
  threadId: shortId.optional(),
  open: z.enum(['0', '1']).default('1'),
});

export interface WorkitemHistoryEntry {
  at: string;
  byId: string | null;
  byName: string | null;
  event: WorkitemEvent | 'create' | 'assign' | 'draft' | 'remind' | 'escalate';
  from: WorkitemStatus | null;
  to: WorkitemStatus | null;
  reason?: ReturnReason;
  note?: string;
  result?: WorkitemResult;
}

export interface WorkitemQuoteView {
  no: string;
  total: number | null;
  validUntil: string | null;
  status: string | null;
  version: string | null;
  /** Why "Duyệt & gửi" is locked (UAT-SZ-96), from the quote read live at this moment; null = may be sent. */
  block: string | null;
}

export interface WorkitemMessageView {
  id: string;
  msgId: string;
  uid: string;
  threadId: string;
  fromUid: string;
  senderName: string | null;
  text: string | null;
  sentAt: string;
  textMasked?: number;
  attachments?: { id: string; kind: string; fileName?: string | null; mime?: string | null }[];
}

export interface WorkitemSummary {
  id: string;
  code: string;
  kind: WorkitemKind;
  queue: WorkitemQueue;
  status: WorkitemStatus;
  uid: string;
  threadId: string;
  conversationName: string | null;
  aftersalesType: AftersalesType | null;
  createdById: string;
  createdByName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  approverId: string | null;
  approverName: string | null;
  quoteNo: string | null;
  quoteTotal: number | null;
  returnCount: number;
  maxReturns: number;
  vendorDueAt: string | null;
  dueAt: string | null;
  submittedAt: string | null;
  /** Minutes waiting for the approver (working minutes of the division), while `cho_nvkd_duyet`. */
  waitingMinutes: number | null;
  escalated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkitemDetail extends WorkitemSummary {
  note: string;
  message: string;
  afterSend: AfterSendState | null;
  result: WorkitemResult | null;
  messages: WorkitemMessageView[];
  history: WorkitemHistoryEntry[];
  quote: WorkitemQuoteView | null;
  /** Buttons the caller may press (the API checks again). */
  can: {
    start: boolean;
    edit: boolean;
    submit: boolean;
    approve: boolean;
    approveBlock: string | null;
    return: boolean;
    selfReply: boolean;
    waitVendor: boolean;
    vendorBack: boolean;
    close: boolean;
    assign: boolean;
    aiExtract: boolean;
  };
}

export interface WorkitemCounts {
  approvals: number;
  /** Approvals waiting longer than the reminder threshold (red badge, MH-SZ-15 #1). */
  approvalsOverdue: number;
  queue: Record<WorkitemQueue, number>;
}

export interface WorkitemQueueConfig {
  divisionId: string;
  queue: WorkitemQueue;
  members: { userId: string; name: string | null }[];
}

/** Item code shown to people (`TK-0001`). */
export const workitemCode = (n: number): string => `TK-${String(n).padStart(4, '0')}`;
