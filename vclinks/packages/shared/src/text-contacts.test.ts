import { describe, expect, it } from 'vitest';
import { findContactsInText, maskContactsInText, splitMaskedText } from './text-contacts';

describe('findContactsInText (L-02)', () => {
  it.each([
    ['Anh gọi em số 0900000950 nhé', '0900000950'],
    ['sdt: 0900 000 950.', '0900 000 950'],
    ['zalo 090.000.0950 ok', '090.000.0950'],
    ['gọi 0900-000-950', '0900-000-950'],
    ['+84 900 000 950 nha', '+84 900 000 950'],
    ['84900000950', '84900000950'],
    ['văn phòng 0243 123 4567', '0243 123 4567'],
  ])('masks %s', (text, found) => {
    expect(findContactsInText(text).map((s) => s.value)).toEqual([found]);
    expect(maskContactsInText(text).text).not.toContain(found);
  });

  it('masks emails and keeps the surrounding text', () => {
    const r = maskContactsInText('gửi về minh.phat@example.vn giúp em, cảm ơn');
    expect(r).toEqual({ text: 'gửi về mi***@example.vn giúp em, cảm ơn', count: 1 });
  });

  it('masks several contacts in order', () => {
    const r = maskContactsInText('a@b.vn hoặc 0900000950');
    expect(r.count).toBe(2);
    expect(findContactsInText('a@b.vn hoặc 0900000950').map((s) => s.kind)).toEqual(['email', 'phone']);
  });

  it.each(['Hẹn 14:30 ngày 04/10/2026', 'Giá 1.500.000 đ', 'Mã OE 04152-31090', 'đơn 12345', 'năm 2026, 25.000 km', '0123456789', 'tài khoản 1903 1234 5678 9012'])(
    'leaves %s alone',
    (text) => {
      expect(maskContactsInText(text)).toEqual({ text, count: 0 });
    },
  );

  it('masked text is stable and splits back into parts', () => {
    const { text, count } = maskContactsInText('em 0900000950, mail ab@x.vn nhé');
    expect(maskContactsInText(text).count).toBe(0);
    const parts = splitMaskedText(text, count);
    expect(parts.filter((p) => p.maskIndex !== undefined).map((p) => [p.maskIndex, p.kind])).toEqual([[0, 'phone'], [1, 'email']]);
    expect(parts.map((p) => p.text).join('')).toBe(text);
  });
});

describe('findContactsInText stays linear (ReDoS, gác cổng M1b-17)', () => {
  it.each([
    ['long run of letters', 'a'.repeat(100_000)],
    ['long run of digits', '0'.repeat(100_000)],
    ['dotted domain', `a@${'b.'.repeat(40_000)}!`],
    ['dashed domain', `a@${'b-'.repeat(40_000)}`],
  ])('%s: 100 kB in well under a second', (_name, text) => {
    const t = performance.now();
    findContactsInText(text);
    expect(performance.now() - t).toBeLessThan(500);
  });
});

