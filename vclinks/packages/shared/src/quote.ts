import { z } from 'zod';

/*
 * Gửi báo giá VCsales trong khung chat (M1c-02, 03 MH-SZ-05i, BA F9.2, F9.5-F9.7, BR16, BR17, story KD-07).
 * Shapes shared by the API, the extension and the Dashboard. VClinks only READS quotes from VCsales
 * (CLAUDE.md §7, BR12); "Tạo báo giá" only opens a VCsales link.
 */

/** `ordered`: the customer agreed, the quote became an order on VCsales ("Đã chốt"). */
export const SALES_QUOTE_STATUSES = ['draft', 'pending', 'approved', 'ordered', 'cancelled'] as const;
export type SalesQuoteStatus = (typeof SALES_QUOTE_STATUSES)[number];
export const SALES_QUOTE_STATUS_LABELS: Record<SalesQuoteStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  ordered: 'Đã chốt',
  cancelled: 'Đã hủy',
};

/** One quote as VCsales returns it. `version` changes whenever the quote is edited on VCsales (BR16 re-fetch). */
export interface SalesQuote {
  no: string;
  customerCode: string;
  /** ISO date the quote was made. */
  date: string;
  total: number;
  /** ISO date; null while it has no validity yet (drafts). */
  validUntil: string | null;
  status: SalesQuoteStatus;
  lineCount: number;
  createdByName: string | null;
  version: string;
  /** Id on VCsales (absent in rows saved before the real VCsales). */
  id?: string;
  /** Status as VCsales shows it (e.g. "Yêu cầu xuất kho"), shown next to the VClinks status. */
  erpStatusLabel?: string | null;
}

export type QuoteBlockCode = 'expired' | 'not_approved' | 'other_customer';
export interface QuoteBlock {
  code: QuoteBlockCode;
  /** Text shown to the person (03 QT-SZ-03, table "Lỗi"). */
  message: string;
}

/** `yyyy-mm-dd` of an instant in Asia/Ho_Chi_Minh (the company calendar). */
export function vnDay(d: Date | string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
}
/** `dd/MM/yyyy` in Asia/Ho_Chi_Minh. */
export function vnDate(d: Date | string): string {
  const [y, m, day] = vnDay(d).split('-');
  return `${day}/${m}/${y}`;
}
export const formatVnd = (n: number): string => `${n.toLocaleString('vi-VN')} ₫`;

/**
 * Why a quote cannot be sent to this customer, or null when it can (BR16, BR17): an approved quote still valid
 * (the whole last day counts), or a quote already ordered ("Đã chốt", sent again for reference whatever its date,
 * dev002 07/10/2026), of the same customer code. The API enforces it on every send; the Dashboard only greys rows.
 */
export function quoteBlock(
  q: Pick<SalesQuote, 'no' | 'status' | 'validUntil' | 'customerCode'> & { erpStatusLabel?: string | null },
  customerCode: string,
  now: Date = new Date(),
): QuoteBlock | null {
  if (q.customerCode !== customerCode) {
    return { code: 'other_customer', message: `Báo giá ${q.no} không phải của khách này, không gửi được.` };
  }
  if (q.status === 'ordered') return null;
  if (q.status !== 'approved') {
    const label = q.erpStatusLabel ?? SALES_QUOTE_STATUS_LABELS[q.status] ?? q.status;
    return { code: 'not_approved', message: `Báo giá ${q.no} đang ở trạng thái "${label}" trên VCsales, chỉ gửi được báo giá đã duyệt.` };
  }
  if (!q.validUntil || vnDay(q.validUntil) < vnDay(now)) {
    const when = q.validUntil ? ` ngày ${vnDate(q.validUntil)}` : '';
    return { code: 'expired', message: `Báo giá ${q.no} đã hết hiệu lực${when}, không gửi được. Hãy gia hạn hoặc tạo bản mới trên VCsales.` };
  }
  return null;
}

export const QUOTE_FORMS = ['pdf', 'image'] as const;
export type QuoteForm = (typeof QUOTE_FORMS)[number];
export const QUOTE_MESSAGE_MAX = 1000;
/** Images of one quote sent as "Ảnh" (03 MH-SZ-05i #6: VCsales exports at most 10 pages). */
export const QUOTE_MAX_IMAGES = 10;
export const QUOTE_FOLLOW_UP_DAYS = [1, 2, 3, 5, 7] as const;

export const ERR_QUOTE_CHANGED = (no: string) => `Báo giá ${no} vừa được sửa trên VCsales. Đã tải bản mới, hãy xem lại rồi bấm Gửi.`;
export const ERR_QUOTE_NO_FILE = 'VCsales không xuất được file báo giá. Thử dạng Ảnh hoặc thử lại sau.';
export const ERR_QUOTE_NO_LINK = 'Khách này chưa liên kết mã KH VCsales nên chưa lấy được báo giá.';

const shortId = z.string().trim().min(1).max(160);

/** Dashboard → API: the person pressed "Gửi báo giá" (this click is the approval, CLAUDE.md §12.1). */
export const quoteSendSchema = z
  .object({
    uid: shortId,
    threadId: shortId,
    no: z.string().trim().min(1).max(64),
    form: z.enum(QUOTE_FORMS).default('pdf'),
    /** The words that follow the file; may be empty (the file alone is sent). */
    message: z.string().trim().max(QUOTE_MESSAGE_MAX).default(''),
    /** `version` of the quote the person looked at: a newer one on VCsales stops the send (BR16). */
    version: z.string().trim().min(1).max(64),
    followUpDays: z
      .number()
      .int()
      .refine((n) => (QUOTE_FOLLOW_UP_DAYS as readonly number[]).includes(n), 'invalid follow-up days')
      .nullable()
      .optional(),
  })
  .strict();
export type QuoteSendInput = z.output<typeof quoteSendSchema>;

/** The quote part of an outbox `send_quote` command: what the extension needs to type, and what the audit shows. */
export const outboxQuoteSchema = z.object({
  no: z.string().trim().min(1).max(64),
  form: z.enum(QUOTE_FORMS),
  /** Text sent after the file(s); empty = none. */
  message: z.string().max(QUOTE_MESSAGE_MAX),
  total: z.number(),
  customerCode: z.string().max(64),
  /** `version` of the quote at the moment of sending (kept for the audit trail). */
  version: z.string().max(64).optional(),
  followUpDays: z.number().int().nullable().optional(),
});
export type OutboxQuote = z.infer<typeof outboxQuoteSchema>;

export interface QuoteRow extends SalesQuote {
  /** Times this quote was sent from VClinks (`quote_sends`, "Đã gửi {n} lần"). */
  sendCount: number;
  block: QuoteBlock | null;
}

/** Overdue debt of the customer shown over the box (MH-SZ-05i #10); never blocks the send (N10). */
export interface QuoteDebtBanner {
  amount: number;
  overdueDays: number;
  fetchedAt: string;
  /** Latest "ghi chú thu nợ" (06 HD-56): not stored yet, always null. */
  note: string | null;
}

export type QuoteHidden = 'no_link' | 'unconfirmed' | 'no_right';

export interface QuoteListResponse {
  items: QuoteRow[];
  customerCode: string | null;
  hidden: QuoteHidden | null;
  /** VCsales did not answer. */
  error: string | null;
  debt: QuoteDebtBanner | null;
  /** "Tạo báo giá ↗": VCsales page of this customer; null when no code or no right (`quote.open_erp`). */
  createUrl: string | null;
  fetchedAt: string;
  /** Forms VCsales can export: the real VCsales only gives a PDF (the mock also gives page images). */
  forms?: QuoteForm[];
}

export interface QuoteSendResult {
  sendId: string;
  outboxId: string;
  no: string;
}

/** Default words of the "Báo giá" template (MH-SZ-06 loại "Báo giá"); variables of 03 MH-SZ-05i #7. */
export const DEFAULT_QUOTE_TEMPLATE = 'Dạ {ten_khach}, em gửi báo giá {so_bao_gia}, tổng {tong_tien}, hiệu lực đến {hieu_luc} ạ.';

export function renderQuoteMessage(template: string, v: { ten_khach?: string | null; ten_nv?: string | null; so_bao_gia: string; tong_tien: number; hieu_luc: string | null }): string {
  const map: Record<string, string> = {
    ten_khach: v.ten_khach ?? 'anh/chị',
    ten_nv: v.ten_nv ?? '',
    so_bao_gia: v.so_bao_gia,
    tong_tien: formatVnd(v.tong_tien),
    hieu_luc: v.hieu_luc ? vnDate(v.hieu_luc) : '–',
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? map[k]! : m)).trim();
}

/** Timeline line of a sent quote (03 QT-SZ-03 #6). */
export const quoteSentText = (no: string, total: number): string => `Đã gửi báo giá số ${no} (${formatVnd(total)})`;

/**
 * The one way to write a customer's debt (03 MH-SZ-07 #3, 02 MH-DK-01, 06 MH-HD-04 #8): the chat panel and the
 * customer 360 page show the same line (UAT-SZ-86). `time` is the VCsales read time `HH:mm` (Asia/Ho_Chi_Minh).
 */
export function debtLineText(d: { amount: number; dueAt: string | null; overdue: boolean }, time: string, now: Date = new Date()): string {
  const head = `Công nợ: ${formatVnd(d.amount)}`;
  if (!d.dueAt) return `${head} · VCsales ${time}`;
  const [, m, day] = vnDay(d.dueAt).split('-');
  const due = `${day}/${m}`;
  if (!d.overdue) return `${head} · đến hạn ${due} · VCsales ${time}`;
  const days = Math.max(1, Math.round((Date.parse(vnDay(now)) - Date.parse(vnDay(d.dueAt))) / 86_400_000));
  return `${head} · Quá hạn ${days} ngày (hạn ${due}) · VCsales ${time}`;
}

/** Template of "Tôi tự nhắc khách" (shortcut `/nhac-no-nhe`, 06 HD-53): fills the compose box, never sends. */
export const DEBT_REMINDER_TEMPLATE = 'Dạ {ten_khach}, em xin phép nhắc anh/chị khoản công nợ {so_tien} đã đến hạn ngày {han}. Anh/chị sắp xếp thanh toán giúp em nhé ạ, em cảm ơn.';

export function renderDebtReminder(v: { ten_khach?: string | null; amount: number; dueAt: string | null }): string {
  const [y, m, d] = v.dueAt ? vnDay(v.dueAt).split('-') : ['', '', ''];
  return DEBT_REMINDER_TEMPLATE.replace('{ten_khach}', v.ten_khach?.trim() || 'anh/chị')
    .replace('{so_tien}', formatVnd(v.amount))
    .replace('ngày {han}', v.dueAt ? `ngày ${d}/${m}/${y}` : 'đã qua');
}
