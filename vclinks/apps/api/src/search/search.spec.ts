import { maskContentForViewer } from './search.service';

describe('maskContentForViewer', () => {
  const t = 'Gọi 0900.123.456 hoặc +84 901 234 567 nhé, mã 04465-0D130';
  it('keeps the text for a viewer who sees phones in full', () => {
    expect(maskContentForViewer(t, 'full')).toBe(t);
  });
  it('masks phones (not OE codes) for the others', () => {
    for (const v of ['reveal', 'masked'] as const) {
      const out = maskContentForViewer(t, v);
      expect(out).not.toContain('123.456');
      expect(out).not.toContain('234 567');
      expect(out).toContain('0900 *** 456');
      expect(out).toContain('04465-0D130');
    }
  });
});
