import { z } from 'zod';

/*
 * Tra hàng VCsales trong khung chat (M1c-01, BA F9.1, story KD-06). Shapes shared by the API and the
 * Dashboard. VClinks only READS the VCsales catalogue (CLAUDE.md §7, BR12).
 */

export const productSearchQuerySchema = z.object({ q: z.string().trim().min(2).max(100) }).strict();
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export interface ProductRow {
  sku: string;
  name: string;
  oeCodes: string[];
  brand: string | null;
  fitments: string[];
  unit: string;
  listPrice: number;
  /** Price by the customer's policy; null when the viewer may not see it (see `priceHidden`). */
  customerPrice: number | null;
  /** Policy label, e.g. `Chính sách hạng B (-10%)`. */
  policy: string | null;
  stock: number;
}

/** Why the customer price is not shown: no right to commerce data, identity not confirmed, or no VCsales code. */
export type ProductPriceHidden = 'no_right' | 'unconfirmed' | 'no_link';

export interface ProductSearchResponse {
  items: ProductRow[];
  customerCode: string | null;
  priceHidden: ProductPriceHidden | null;
  /** VCsales did not answer (mock outage or E5 missing). */
  error: string | null;
}

/** Text put in the compose box by "Chèn vào tin": text only, never sent by this action (CLAUDE.md §12.1). */
export function productInsertText(p: Pick<ProductRow, 'name' | 'unit' | 'customerPrice' | 'listPrice' | 'stock' | 'oeCodes'>): string {
  const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
  const price = p.customerPrice ?? p.listPrice;
  const stock = p.stock > 0 ? `còn ${p.stock} ${p.unit.toLowerCase()}` : 'hiện hết hàng';
  const oe = p.oeCodes[0] ? ` (mã ${p.oeCodes[0]})` : '';
  return `${p.name}${oe}: ${vnd(price)}/${p.unit.toLowerCase()}, ${stock}.`;
}
