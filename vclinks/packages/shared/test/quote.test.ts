import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUOTE_TEMPLATE,
  debtLineText,
  outboxCreateSchema,
  outboxLabel,
  quoteBlock,
  quoteSendSchema,
  quoteSentText,
  renderDebtReminder,
  renderQuoteMessage,
  type SalesQuote,
} from '../src';

const NOW = new Date('2026-10-04T05:00:00.000Z'); // 12:00 giờ Việt Nam
const q = (extra: Partial<SalesQuote> = {}): SalesQuote => ({
  no: 'BG-2026-0915',
  customerCode: 'KH-TEST-0101',
  date: '2026-10-01T03:00:00.000Z',
  total: 8_450_000,
  validUntil: '2026-10-11T00:00:00.000Z',
  status: 'approved',
  lineCount: 5,
  createdByName: 'Minh',
  version: '1',
  ...extra,
});

describe('quoteBlock (BR16, BR17)', () => {
  it('lets an order ("Đã chốt") through whatever its date, and names the VCsales status when it blocks', () => {
    expect(quoteBlock(q({ status: 'ordered', validUntil: '2026-01-01T00:00:00.000Z' }), 'KH-TEST-0101', NOW)).toBeNull();
    expect(quoteBlock(q({ status: 'ordered' }), 'KH-OTHER', NOW)!.code).toBe('other_customer');
    expect(quoteBlock(q({ status: 'draft', erpStatusLabel: 'Yêu cầu báo giá' }), 'KH-TEST-0101', NOW)!.message).toContain('"Yêu cầu báo giá"');
  });

  it('lets an approved, valid quote of the same customer through', () => {
    expect(quoteBlock(q(), 'KH-TEST-0101', NOW)).toBeNull();
  });

  it('the last valid day still counts; the next day it is expired, with the date in the text', () => {
    expect(quoteBlock(q({ validUntil: '2026-10-04T00:00:00.000Z' }), 'KH-TEST-0101', NOW)).toBeNull();
    const b = quoteBlock(q({ validUntil: '2026-10-03T00:00:00.000Z' }), 'KH-TEST-0101', NOW);
    expect(b).toEqual({ code: 'expired', message: 'Báo giá BG-2026-0915 đã hết hiệu lực ngày 03/10/2026, không gửi được. Hãy gia hạn hoặc tạo bản mới trên VCsales.' });
  });

  it('draft, pending and cancelled are refused with the status named; a draft has no validity', () => {
    expect(quoteBlock(q({ status: 'cancelled' }), 'KH-TEST-0101', NOW)!.message).toBe('Báo giá BG-2026-0915 đang ở trạng thái "Đã hủy" trên VCsales, chỉ gửi được báo giá đã duyệt.');
    expect(quoteBlock(q({ status: 'draft', validUntil: null }), 'KH-TEST-0101', NOW)!.code).toBe('not_approved');
    expect(quoteBlock(q({ status: 'pending' }), 'KH-TEST-0101', NOW)!.code).toBe('not_approved');
  });

  it('an approved quote with no validity date is not sendable', () => {
    expect(quoteBlock(q({ validUntil: null }), 'KH-TEST-0101', NOW)!.code).toBe('expired');
  });

  it('a quote of another customer code is refused first', () => {
    expect(quoteBlock(q(), 'KH-TEST-0601', NOW)).toMatchObject({ code: 'other_customer' });
    expect(quoteBlock(q({ status: 'cancelled' }), 'KH-TEST-0601', NOW)!.code).toBe('other_customer');
  });
});

describe('send body and command', () => {
  it('quoteSendSchema: default form pdf, message ≤ 1.000, strict, follow-up days from the list', () => {
    expect(quoteSendSchema.parse({ uid: 'u', threadId: 't', no: 'BG-1', version: '1' })).toMatchObject({ form: 'pdf', message: '' });
    expect(quoteSendSchema.safeParse({ uid: 'u', threadId: 't', no: 'BG-1', version: '1', message: 'a'.repeat(1001) }).success).toBe(false);
    expect(quoteSendSchema.safeParse({ uid: 'u', threadId: 't', no: 'BG-1', version: '1', followUpDays: 4 }).success).toBe(false);
    expect(quoteSendSchema.safeParse({ uid: 'u', threadId: 't', no: 'BG-1', version: '1', followUpDays: 3 }).success).toBe(true);
    expect(quoteSendSchema.safeParse({ uid: 'u', threadId: 't', no: 'BG-1', version: '1', approvedBy: 'x' }).success).toBe(false);
  });

  const id = 'a'.repeat(64);
  const quote = { no: 'BG-2026-0915', form: 'pdf' as const, message: '', total: 1, customerCode: 'KH-TEST-0101' };
  it('send_quote needs its quote block and exactly one file for PDF, 1..10 images for "Ảnh"', () => {
    const base = { uid: 'u', threadId: 't', action: 'send_quote' as const };
    expect(outboxCreateSchema.safeParse({ ...base, attachments: [id] }).success).toBe(false);
    expect(outboxCreateSchema.safeParse({ ...base, quote, attachments: [id] }).success).toBe(true);
    expect(outboxCreateSchema.safeParse({ ...base, quote, attachments: [id, id] }).success).toBe(false);
    expect(outboxCreateSchema.safeParse({ ...base, quote: { ...quote, form: 'image' }, attachments: [id, id] }).success).toBe(true);
    expect(outboxCreateSchema.safeParse({ ...base, quote, attachments: [id], text: 'x' }).success).toBe(false);
    expect(outboxCreateSchema.safeParse({ uid: 'u', threadId: 't', text: 'x', quote }).success).toBe(false);
  });

  it('label and timeline text', () => {
    expect(outboxLabel({ action: 'send_quote', quote: { no: 'BG-2026-0915' } })).toBe('[Báo giá] BG-2026-0915');
    expect(quoteSentText('BG-2026-0915', 8_450_000)).toBe('Đã gửi báo giá số BG-2026-0915 (8.450.000 ₫)');
  });
});

describe('texts', () => {
  it('renderQuoteMessage fills the template variables', () => {
    expect(renderQuoteMessage(DEFAULT_QUOTE_TEMPLATE, { ten_khach: 'anh Tuấn', so_bao_gia: 'BG-2026-0915', tong_tien: 8_450_000, hieu_luc: '2026-10-11T00:00:00.000Z' })).toBe(
      'Dạ anh Tuấn, em gửi báo giá BG-2026-0915, tổng 8.450.000 ₫, hiệu lực đến 11/10/2026 ạ.',
    );
  });

  it('debt line: one wording for the panel and the 360 page (UAT-SZ-86)', () => {
    const due = '2026-08-03T00:00:00.000Z';
    expect(debtLineText({ amount: 180_000_000, dueAt: due, overdue: true }, '10:00', NOW)).toBe('Công nợ: 180.000.000 ₫ · Quá hạn 62 ngày (hạn 03/08) · VCsales 10:00');
    expect(debtLineText({ amount: 12_000_000, dueAt: '2026-10-20T00:00:00.000Z', overdue: false }, '10:00', NOW)).toBe('Công nợ: 12.000.000 ₫ · đến hạn 20/10 · VCsales 10:00');
    expect(debtLineText({ amount: 5, dueAt: null, overdue: false }, '10:00', NOW)).toBe('Công nợ: 5 ₫ · VCsales 10:00');
  });

  it('the debt reminder only fills the box (text), with amount and date', () => {
    expect(renderDebtReminder({ ten_khach: 'anh Lực', amount: 1_800_000, dueAt: '2026-06-06T00:00:00.000Z' })).toContain('1.800.000 ₫ đã đến hạn ngày 06/06/2026');
  });
});
