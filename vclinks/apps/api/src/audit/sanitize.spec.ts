import { auditGroupOf } from '@vclinks/shared';
import { maskPhones, sanitizeDetail } from './sanitize';
import { isOffHours, vnParts } from './vn-time';

describe('sanitizeDetail', () => {
  it('drops content keys at any depth and keeps ids and counts', () => {
    expect(sanitizeDetail({ text: 'xin chào', nested: { message: 'bí mật', ok: 1 }, count: 2, ids: ['a:b'] })).toEqual({ nested: { ok: 1 }, count: 2, ids: ['a:b'] });
  });
  it('hides phone numbers in all common spellings but not ids that contain digits', () => {
    expect(maskPhones('gọi 0912345678 và +84 912 345 678, 0912.345.678')).toBe('gọi [SĐT đã ẩn] và [SĐT đã ẩn], [SĐT đã ẩn]');
    expect(maskPhones('9000000000012:910001')).toBe('9000000000012:910001');
  });
  it('cuts long strings', () => {
    expect((sanitizeDetail({ s: 'x'.repeat(500) })!.s as string).length).toBe(201);
  });
});

describe('auditGroupOf', () => {
  it.each([
    ['phone.reveal', 'truy_cap'],
    ['export.create', 'xuat'],
    ['conversation.delete', 'xoa'],
    ['role.assign', 'quyen'],
    ['mcp.call', 'mcp'],
    ['login', 'dang_nhap'],
    ['audit.view_person', 'kiem_soat'],
    ['something.else', 'he_thong'],
  ])('%s is in %s', (a, g) => expect(auditGroupOf(a)).toBe(g));
});

describe('Vietnam time', () => {
  it('22:00 to 06:00 and Sunday are off hours', () => {
    expect(isOffHours(new Date('2026-09-29T16:30:00Z'))).toBe(true); // 23:30 Tue
    expect(isOffHours(new Date('2026-09-29T05:00:00Z'))).toBe(false); // 12:00 Tue
    expect(isOffHours(new Date('2026-09-27T05:00:00Z'))).toBe(true); // Sunday noon
    expect(vnParts(new Date('2026-09-29T20:00:00Z')).day).toBe('2026-09-30');
  });
});
