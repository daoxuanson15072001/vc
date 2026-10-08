import { foldVi } from '@vclinks/shared';
import type { FrameCard } from './prompt-frame';

/*
 * Knowledge adapters of the suggest worker (CLAUDE.md §6, §7). The real VCwiki endpoint and the VCsales
 * part price / stock API are not delivered yet (§14, E5): both run as in-memory mocks behind small
 * interfaces, chosen by VCWIKI_MODE / VCSALE_MODE (only `mock` exists today). Read-only: nothing here
 * writes to VCwiki or VCsales (BR12).
 */
export const VCWIKI_CLIENT = Symbol('VCWIKI_CLIENT');
export const PART_LOOKUP = Symbol('PART_LOOKUP');

export interface VcwikiClient {
  readonly mode: 'mock';
  /** Approved knowledge cards relevant to the text (C1). */
  searchCards(query: string, limit?: number): Promise<FrameCard[]>;
}

export interface PartQuote {
  code: string;
  name: string;
  /** Public list price (C2). Customer-specific prices and debt are C3 and never returned here. */
  listPrice: number;
  stock: number;
  warehouse: string;
}

export interface PartLookup {
  readonly mode: 'mock';
  /** Part codes (OE) quoted in the text → list price and stock. */
  lookup(text: string): Promise<PartQuote[]>;
}

const MOCK_CARDS: (FrameCard & { keys: string[] })[] = [
  {
    id: 'mock-bao-hanh',
    title: 'Chính sách bảo hành phụ tùng VCparts (mẫu)',
    text: 'Phụ tùng chính hãng bảo hành 6 tháng hoặc 10.000 km tùy điều kiện nào đến trước. Khách giữ hóa đơn và tem bảo hành.',
    keys: ['bao hanh', 'doi tra', 'loi'],
  },
  {
    id: 'mock-giao-hang',
    title: 'Giao hàng nội thành Hà Nội (mẫu)',
    text: 'Đơn đặt trước 15h giao trong ngày nội thành Hà Nội. Tỉnh khác gửi xe khách hoặc chuyển phát.',
    keys: ['giao', 'ship', 'van chuyen', 'bao gio co', 'khi nao co'],
  },
  {
    id: 'mock-tra-ma',
    title: 'Tra mã phụ tùng theo VIN (mẫu)',
    text: 'Xin khách số VIN (17 ký tự) hoặc ảnh cà-vẹt để tra đúng mã OE trước khi báo giá.',
    keys: ['vin', 'ma phu tung', 'ma oe', 'tra ma', 'xe', 'phanh', 'loc', 'gia'],
  },
];

export class MockVcwikiClient implements VcwikiClient {
  readonly mode = 'mock' as const;
  async searchCards(query: string, limit = 3): Promise<FrameCard[]> {
    const f = foldVi(query);
    return MOCK_CARDS.filter((c) => c.keys.some((k) => f.includes(k)))
      .slice(0, limit)
      .map(({ id, title, text }) => ({ id, title, text }));
  }
}

/** OE-like codes: 04465-0K290, 90915-YZZD2, 31110-2W000. */
const OE = /\b[0-9A-Z]{5}-[0-9A-Z]{4,5}\b/g;

const MOCK_PARTS: Record<string, Omit<PartQuote, 'code'>> = {
  '04465-0K290': { name: 'Má phanh trước Toyota Hilux (mẫu)', listPrice: 1250000, stock: 8, warehouse: 'Kho Hà Nội' },
  '90915-YZZD2': { name: 'Lọc dầu Toyota (mẫu)', listPrice: 95000, stock: 120, warehouse: 'Kho Hà Nội' },
};

export class MockPartLookup implements PartLookup {
  readonly mode = 'mock' as const;
  async lookup(text: string): Promise<PartQuote[]> {
    const codes = [...new Set(text.toUpperCase().match(OE) ?? [])].slice(0, 5);
    return codes.filter((c) => MOCK_PARTS[c]).map((code) => ({ code, ...MOCK_PARTS[code]! }));
  }
}

export function createVcwikiClient(): VcwikiClient {
  return new MockVcwikiClient();
}

export function createPartLookup(): PartLookup {
  return new MockPartLookup();
}

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

/** Trusted VCsales text of the quotes (C2: list price and stock only). */
export function partsText(quotes: PartQuote[]): string {
  return quotes.map((q) => `${q.code} ${q.name}: giá niêm yết ${vnd(q.listPrice)}, tồn ${q.stock} (${q.warehouse})`).join('\n');
}
