import { describe, expect, it } from 'vitest';
import { productInsertText, productSearchQuerySchema } from '../src';

describe('catalog (M1c-01)', () => {
  it('insert text uses the customer price when present, else the list price, and says out of stock', () => {
    const base = { name: 'Má phanh trước Vios', unit: 'Bộ', listPrice: 850_000, oeCodes: ['04465-0D110'] };
    expect(productInsertText({ ...base, customerPrice: 765_000, stock: 24 })).toBe('Má phanh trước Vios (mã 04465-0D110): 765.000đ/bộ, còn 24 bộ.');
    expect(productInsertText({ ...base, customerPrice: null, stock: 0, oeCodes: [] })).toBe('Má phanh trước Vios: 850.000đ/bộ, hiện hết hàng.');
  });
  it('query needs 2+ characters and refuses extra keys', () => {
    expect(productSearchQuerySchema.safeParse({ q: 'x' }).success).toBe(false);
    expect(productSearchQuerySchema.safeParse({ q: 'vios', a: 1 }).success).toBe(false);
    expect(productSearchQuerySchema.parse({ q: ' vios ' }).q).toBe('vios');
  });
});
