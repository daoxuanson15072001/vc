import { describe, expect, it } from 'vitest';
import { highlightRanges, parseSearchQuery, searchKeysOf, textMatches } from './search';

describe('searchKeysOf', () => {
  it('folds accents and keeps compact codes', () => {
    const k = searchKeysOf('Anh cần má phanh Vios, đồng giá. Gọi 0900.123.456 hoặc 0901 234 567, mã 04465-0D130, xe 30A-123.45');
    expect(k).toEqual(expect.arrayContaining(['ma', 'phanh', 'dong', '0900123456', '0901234567', '84901234567', '044650d130', '30a12345']));
  });
  it('is empty for empty text', () => expect(searchKeysOf('')).toEqual([]));
});

describe('parseSearchQuery', () => {
  it('rejects 1 char', () => {
    expect(parseSearchQuery('a')).toBeNull();
    expect(parseSearchQuery('1')).toBeNull();
  });
  it('phone typed any way gives one code', () => {
    for (const q of ['0900123456', '0900 123 456', '0900.123.456', '+84 900 123 456']) {
      const p = parseSearchQuery(q)!;
      expect(p.phoneOnly).toBe(true);
      expect([p.terms[0]!.text, ...(p.terms[0]!.alt ?? [])]).toContain('0900123456');
    }
  });
  it('detects OE and plate codes', () => {
    expect(parseSearchQuery('04465-0D130')!.codeKind).toBe('oe');
    expect(parseSearchQuery('30A-123.45')!.codeKind).toBe('plate');
    expect(parseSearchQuery('30A 12345')!.codeKind).toBe('plate');
  });
  it('words and phrases', () => {
    const p = parseSearchQuery('bảo hành "12 tháng"')!;
    expect(p.terms.map((t) => [t.kind, t.text])).toEqual([['phrase', '12 thang'], ['word', 'bao'], ['word', 'hanh']]);
  });
});

describe('textMatches', () => {
  const text = 'Khách hỏi má phanh Vios 2019, gọi 0900 123 456, mã 04465-0D130, xe 30A-123.45';
  it('matches no-accent, any order, prefix', () => {
    expect(textMatches(text, parseSearchQuery('phanh ma')!)).toBe(true);
    expect(textMatches(text, parseSearchQuery('vio')!)).toBe(true);
    expect(textMatches(text, parseSearchQuery('xyzq')!)).toBe(false);
  });
  it('matches codes whatever the separators', () => {
    expect(textMatches(text, parseSearchQuery('0900123456')!)).toBe(true);
    expect(textMatches(text, parseSearchQuery('044650D130')!)).toBe(true);
    expect(textMatches(text, parseSearchQuery('30a12345')!)).toBe(true);
    expect(textMatches(text, parseSearchQuery('30A 123 45')!)).toBe(true);
  });
  it('phrase must be contiguous', () => {
    expect(textMatches(text, parseSearchQuery('"ma phanh"')!)).toBe(true);
    expect(textMatches(text, parseSearchQuery('"phanh ma"')!)).toBe(false);
  });
});

describe('highlightRanges', () => {
  it('marks original (accented) text', () => {
    const t = 'cần má phanh';
    const r = highlightRanges(t, parseSearchQuery('ma phanh')!);
    expect(r.map(([s, e]) => t.slice(s, e))).toEqual(['má', 'phanh']);
  });
});
