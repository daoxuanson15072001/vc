import { foldVi } from '@vclinks/shared';
import { NO_DRAFT_SENTINEL } from './prompt-frame';

/*
 * Server-side check of what the model returned (defence in depth behind the prompt frame): even a model
 * that obeyed an injected order cannot get its draft shown. A refused draft is dropped, never stored.
 * Reasons are codes only (logs and audit never hold the text).
 */
export type GuardReason =
  | 'model_declined'
  | 'empty'
  | 'too_long'
  | 'secret_words'
  | 'payment_words'
  | 'link'
  | 'long_number'
  | 'amount_without_source'
  | 'injection_echo';

export interface GuardResult {
  ok: boolean;
  reasons: GuardReason[];
  /** Cleaned draft (trimmed, no wrapping quotes) when ok. */
  text: string;
}

const MAX_DRAFT = 2000;
const SECRET = /\b(otp|mat khau|mat ma|password|ma xac (nhan|thuc|minh)|ma pin)\b/;
const PAYMENT = /\b(so tai khoan|\bstk\b|chuyen (tien|khoan) (vao|qua|toi|den|cho)|tai khoan (moi|khac)|doi (so )?tai khoan|nap tien|ung tien|cho (vay|muon))\b/;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|vn|net|org|io|me|ly|xyz|top|info)\b)/i;
/** 8+ digits in a row (bank account, phone, card), spaces and dots allowed between groups. */
const LONG_NUMBER = /\d(?:[\s.-]?\d){7,}/g;
/** Money amounts and discounts: 1.250.000, 850k, 2 triệu, 1 đồng, 500đ, 90%. */
const AMOUNT = /\d[\d.,]*\s*(d\b|dong|vnd|k\b|nghin|ngan|tr\b|trieu|ty|%)|\d{1,3}(?:[.,]\d{3})+/g;
const ECHO = /\b(bo qua (moi |tat ca )?(huong dan|chi thi|quy tac)|ignore (all |previous |the )|system prompt|lenh he thong|system override|developer mode|che do (nha phat trien|quan tri)|toi la (admin|quan tri)|\bdu_lieu_khong_dang_tin\b)/;

const digitsOf = (s: string) => s.replace(/\D/g, '');

/** Checks a model answer; `trusted` = text of the VCwiki / VCsales parts (amounts must come from there). */
export function guardDraft(raw: string, trusted: string): GuardResult {
  const text = raw
    .trim()
    .replace(/^["“'`]+|["”'`]+$/g, '')
    .trim();
  const reasons: GuardReason[] = [];
  if (!text) reasons.push('empty');
  if (text.includes(NO_DRAFT_SENTINEL)) reasons.push('model_declined');
  if (text.length > MAX_DRAFT) reasons.push('too_long');
  const f = foldVi(text);
  if (SECRET.test(f)) reasons.push('secret_words');
  if (PAYMENT.test(f)) reasons.push('payment_words');
  if (LINK.test(text)) reasons.push('link');
  // A long number is allowed only when the trusted context has it (a VCsales price like 12.500.000).
  const trustedLong = new Set((trusted.match(LONG_NUMBER) ?? []).map(digitsOf));
  if ((text.match(LONG_NUMBER) ?? []).some((n) => !trustedLong.has(digitsOf(n)))) reasons.push('long_number');
  if (ECHO.test(f) || text.includes('du_lieu_khong_dang_tin')) reasons.push('injection_echo');
  const allowed = new Set((foldVi(trusted).match(AMOUNT) ?? []).map(digitsOf));
  for (const a of f.match(AMOUNT) ?? []) {
    if (!allowed.has(digitsOf(a))) {
      reasons.push('amount_without_source');
      break;
    }
  }
  return { ok: reasons.length === 0, reasons, text };
}

/** Vietnamese reason shown in place of a refused draft. */
export const GUARD_REASON_TEXT = 'AI trả về nội dung không an toàn (có thể do tin của khách chứa lệnh ẩn) nên VClinks không hiện nháp. Hãy tự soạn trả lời.';
