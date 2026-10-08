/*
 * VCsales client (CLAUDE.md §7, M1b-12). VClinks only READS VCsales: no method here writes anything (BR12).
 *
 * Two implementations: MockVcsaleClient (fake test data, default) and HttpVcsaleClient, which reads the
 * read-only `vclinks-bridge` of VCsales (repo VCsales apps/vclinks-bridge, design in
 * docs/04-ky-thuat/api/vclinks-bridge.md). Callers only see the VcsaleClient interface; the API stores snapshots
 * of VcsaleCustomer (with the raw record) in `erp_customers`, so the mode changes no database schema.
 */

/** One customer of the VCsales catalogue (danh mục khách). Missing API fields are null, never guessed. */
export interface VcsaleCustomer {
  /** Id on VCsales (its web edit page is `/customer/:id/edit`); absent in the mock. */
  id?: string | null;
  /** Mã KH, e.g. `KH-TEST-0301`. */
  code: string;
  name: string;
  legalName: string | null;
  /** Mã số thuế. */
  taxCode: string | null;
  address: string | null;
  region: string | null;
  /** Customer type as VCsales names it (garage, đại lý, khách lẻ…). */
  type: string | null;
  /** Phone numbers as stored on VCsales (not normalised). */
  phones: string[];
  emails: string[];
  /** "NV phụ trách" on VCsales: used once to load the first owner, then only compared (D8-06). */
  salespersonEmail: string | null;
  salespersonName: string | null;
  /** Every salesperson of the customer on VCsales (data_viewer); the first active one with an email is `salespersonEmail`. */
  salespersons?: VcsaleStaffRef[];
  /** Customer type code on VCsales (GARAGE, RETAIL…): the price tier. */
  typeCode?: string | null;
  /** `deleted`: soft-deleted on VCsales (only in incremental pages, so VClinks can mark it). */
  status: 'active' | 'inactive' | 'merged' | 'deleted';
  /** Code this one was merged into on VCsales (duplicate codes, MH-DK-12 merge_codes). */
  mergedInto: string | null;
  lastTradeAt: string | null;
  updatedAt: string;
}

export interface VcsaleStaffRef {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
}

/** Debt of one customer. `dueAt`: the oldest overdue date when something is overdue, else the next due date. */
export interface VcsaleDebt {
  amount: number;
  dueAt: string | null;
  overdue?: number;
  nearestDueAt?: string | null;
  oldestOverdueAt?: string | null;
  /** Where VCsales figures come from: ledger 131 or open invoices; receivables or invoice due dates. */
  source?: { total: string; due: string };
}

/** Commercial figures of one customer (tier, 12-month revenue, debt, open quotes, last order). Read only. */
export interface VcsaleCommerce {
  code: string;
  tier: string | null;
  revenue12m: number | null;
  debt: VcsaleDebt | null;
  openQuotes: { id?: string; no: string; total: number; validUntil: string | null }[];
  lastOrder: { id?: string; no: string; at: string; status: string } | null;
  salespersons?: VcsaleStaffRef[];
}

/** Debt of one code in a batch (`getDebtSummaries`): only flags and totals, never the documents. */
export interface VcsaleDebtSummary {
  code: string;
  /** VCsales has no customer with this code. */
  notFound?: true;
  total: number;
  overdue: number;
  nearestDueAt: string | null;
  oldestOverdueAt: string | null;
  dueAt: string | null;
  source: { total: 'gl' | 'invoices' | 'none'; due: 'receivables' | 'invoices' | 'none' };
}

/** One VCsales user (staff), to match the salesperson of a customer with a VClinks user by email (D8-06). */
export interface VcsaleStaffMember {
  id: string;
  fullName: string;
  email: string | null;
  active: boolean;
  positionCode: string | null;
  positionName: string | null;
  departmentName: string | null;
  employeeId: string | null;
  emailMissing: boolean;
  emailDuplicated: boolean;
}

/** One catalogue product (tra hàng, F9.1). Prices in VND. Read only. */
export interface VcsaleProduct {
  /** Mã nội bộ VCsales. */
  sku: string;
  name: string;
  /** OE (original equipment) part numbers. */
  oeCodes: string[];
  brand: string | null;
  /** Vehicle lines this part fits, e.g. `Toyota Vios 2018-2022`. */
  fitments: string[];
  unit: string;
  /** Giá niêm yết. */
  listPrice: number;
  /** Price by the policy of the asked customer; null when no customer was asked. */
  customerPrice: number | null;
  /** Policy label shown to the user, e.g. `Chính sách hạng B (-10%)`; null when no customer. */
  policy: string | null;
  /** Stock on hand across warehouses. */
  stock: number;
}

/**
 * Status of a quote for VClinks (`Hết hạn` is not a status: it follows from `validUntil`). `ordered`: the customer
 * agreed and the quote became an order on VCsales (from "Yêu cầu đặt hàng" to "Đã xuất hóa đơn").
 */
export type VcsaleQuoteStatus = 'draft' | 'pending' | 'approved' | 'ordered' | 'cancelled';

/** One quote of a customer (báo giá). Read only: VClinks never creates or edits quotes (BR12). */
export interface VcsaleQuote {
  /** Id on VCsales (the mock uses the number); `getQuote` / `getQuoteFiles` take the id or the number. */
  id: string;
  no: string;
  /** Mã KH the quote belongs to. */
  customerCode: string;
  /** ISO time the quote was made. */
  date: string;
  total: number;
  /** ISO time; null while a draft has no validity. */
  validUntil: string | null;
  status: VcsaleQuoteStatus;
  lineCount: number;
  createdByName: string | null;
  /** Changes whenever the quote is edited on VCsales (the send box compares it right before sending, BR16). */
  version: string;
  /** Status as VCsales names it (FULLY_QUOTED, WAREHOUSE_REQUESTED…) and its Vietnamese label. */
  erpStatus: string | null;
  erpStatusLabel: string | null;
}

/** One exported file of a quote: the PDF, or one page as an image. */
export interface VcsaleQuoteFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

/** Answer of `getHealth()`: VCsales reachable, key accepted and its databases up. Never throws. */
export interface VcsaleHealth {
  ok: boolean;
  /** Version of the VCsales side (the bridge) when it answered. */
  version: string | null;
  /** Why VCsales cannot be used (Vietnamese, for the admin page); null when ok. */
  error: string | null;
}

export interface VcsaleCustomerPage {
  items: VcsaleCustomer[];
  /** Opaque cursor of the next page; null on the last page. */
  nextCursor: string | null;
}

export interface VcsaleClient {
  readonly mode: 'mock' | 'http';
  /** Catalogue pages, oldest change first; `updatedSince` (ISO) for incremental loads. */
  listCustomers(opts?: { cursor?: string | null; limit?: number; updatedSince?: string | null }): Promise<VcsaleCustomerPage>;
  /** Free search: code, phone, tax code or name (MH-DK-10 "Tìm trên VCsales", ≥ 3 characters). */
  searchCustomers(query: string, limit?: number): Promise<VcsaleCustomer[]>;
  getCustomer(code: string): Promise<VcsaleCustomer | null>;
  /** Commercial block of one code (Customer 360, MH-DK-01 #12); null when VCsales has no such code. */
  getCommerce(code: string): Promise<VcsaleCommerce | null>;
  /**
   * Product lookup by name, OE code or vehicle line (≥ 2 characters). With `customerCode` each item carries the
   * price by that customer's policy (tier). Read only.
   */
  searchProducts(query: string, opts?: { customerCode?: string | null; limit?: number }): Promise<VcsaleProduct[]>;
  /** Quotes of one customer code, newest first (F9.5). Always live: callers must not cache them (BR16). */
  listQuotes(customerCode: string): Promise<VcsaleQuote[]>;
  /** One quote by number, live; null when VCsales has no such number. */
  getQuote(no: string): Promise<VcsaleQuote | null>;
  /** The quote as one PDF (`form: 'pdf'`) or as up to 10 page images (`'image'`). Throws when VCsales cannot export it. */
  getQuoteFiles(no: string, form: 'pdf' | 'image'): Promise<VcsaleQuoteFile[]>;
  /** VCsales page to make a new quote for this customer ("Tạo báo giá ↗": a link only, nothing is written). */
  getQuoteCreateUrl(customerCode: string): string;
  /** Debt of many codes at once (the client splits them by 100): "Nợ quá hạn" flags without one call per customer. */
  getDebtSummaries(codes: string[]): Promise<VcsaleDebtSummary[]>;
  /** VCsales staff with their emails, to match salespersons with VClinks users (D8-06). */
  listSalesStaff(): Promise<VcsaleStaffMember[]>;
  /** Connection check (plan C6): address, key and databases in one short call. */
  getHealth(): Promise<VcsaleHealth>;
}

/** Discount of the price policy by customer tier (mock of the VCsales policy; the real one comes with E5). */
export const MOCK_TIER_DISCOUNT: Record<string, number> = { A: 0.15, B: 0.1, C: 0.05 };

type MockProduct = Omit<VcsaleProduct, 'customerPrice' | 'policy'>;
/** Mock catalogue (fake data). */
export const MOCK_VCSALE_PRODUCTS: readonly MockProduct[] = [
  { sku: 'VC-MP-VIOS-F', name: 'Má phanh trước Vios', oeCodes: ['04465-0D110', '04465-0D140'], brand: 'Akebono', fitments: ['Toyota Vios 2014-2018', 'Toyota Vios 2019-2023'], unit: 'Bộ', listPrice: 850_000, stock: 24 },
  { sku: 'VC-MP-VIOS-R', name: 'Má phanh sau Vios', oeCodes: ['04495-0D090'], brand: 'Akebono', fitments: ['Toyota Vios 2019-2023'], unit: 'Bộ', listPrice: 720_000, stock: 0 },
  { sku: 'VC-MP-ALT-F', name: 'Má phanh trước Altis', oeCodes: ['04465-02390'], brand: 'Brembo', fitments: ['Toyota Corolla Altis 2014-2019'], unit: 'Bộ', listPrice: 980_000, stock: 6 },
  { sku: 'VC-LD-VIOS', name: 'Lọc dầu Vios', oeCodes: ['90915-YZZE1'], brand: 'Denso', fitments: ['Toyota Vios 2008-2023', 'Toyota Yaris 2014-2020'], unit: 'Cái', listPrice: 95_000, stock: 140 },
  { sku: 'VC-LG-CIVIC', name: 'Lọc gió động cơ Civic', oeCodes: ['17220-5BA-A00'], brand: 'Honda Genuine', fitments: ['Honda Civic 2016-2021'], unit: 'Cái', listPrice: 310_000, stock: 12 },
];

const foldText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
const alnum = (s: string) => foldText(s).replace(/[^a-z0-9]/g, '');

/** Every word of the query must appear in the name / fitments (accent-free) or the query must match an OE code. */
export function matchProduct(p: MockProduct, query: string): boolean {
  const q = foldText(query).trim();
  if (q.length < 2) return false;
  const code = alnum(query);
  if (code.length >= 4 && p.oeCodes.some((o) => alnum(o).includes(code))) return true;
  const hay = foldText([p.name, p.brand ?? '', ...p.fitments].join(' '));
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/** Raised when VCsales cannot export a quote file (03 QT-SZ-03: "VCsales không xuất được file báo giá"). */
export class VcsaleExportError extends Error {
  constructor(message = 'VCsales không xuất được file báo giá. Thử dạng Ảnh hoặc thử lại sau.') {
    super(message);
    this.name = 'VcsaleExportError';
  }
}

/** Web address of the (mock) VCsales; the real one comes with E5 (env VCSALE_WEB_URL). */
export const MOCK_VCSALE_WEB_URL = 'https://vcsales.example.vn';

/** Raised when VCsales cannot be reached / is not configured (MH-DK-10: "Không kết nối được VCsales…"). */
export class VcsaleUnavailableError extends Error {
  constructor(message = 'Không kết nối được VCsales. Thử lại sau ít phút.') {
    super(message);
    this.name = 'VcsaleUnavailableError';
  }
}

const copy = (x: VcsaleCustomer): VcsaleCustomer => ({ ...x, phones: [...x.phones], emails: [...x.emails] });
const digits = (s: string) => s.replace(/\D/g, '');
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

const c = (code: string, name: string, phone: string, salesperson: [string, string] | null, more: Partial<VcsaleCustomer> = {}): VcsaleCustomer => ({
  code,
  name,
  legalName: null,
  taxCode: null,
  address: null,
  region: 'Hà Nội',
  type: 'Garage',
  phones: [phone],
  emails: [],
  salespersonEmail: salesperson?.[0] ?? null,
  salespersonName: salesperson?.[1] ?? null,
  status: 'active',
  mergedInto: null,
  lastTradeAt: '2026-09-20T03:00:00.000Z',
  updatedAt: '2026-10-01T01:00:00.000Z',
  ...more,
});

const MINH: [string, string] = ['minh.uat@vcprosperous.com', 'Nguyễn Văn Minh'];
const LINH: [string, string] = ['linh.uat@vcprosperous.com', 'Trần Thùy Linh'];
const HAI: [string, string] = ['hai.uat@vcprosperous.com', 'Phạm Văn Hải'];
const HUONG: [string, string] = ['huong.uat@vcprosperous.com', 'Nguyễn Thị Hương'];
const TU: [string, string] = ['tu.uat@vcprosperous.com', 'Đỗ Minh Tú'];
const TOAN: [string, string] = ['toan.uat@vcprosperous.com', 'Lê Văn Toàn'];

/**
 * VCsales mock catalogue: the `KH-TEST-xxxx` customers of the test data (docs/05-kiem-thu/du-lieu-kiem-thu.md
 * §4.1). All names, phones (`0900 000 xxx`), tax codes and addresses are fake. Includes the noise code
 * `KH-TEST-0388` "Gara Khoa Minh" (UAT-DK-87) and the two codes of one owner (TD-K03 / TD-K04).
 */
export const MOCK_VCSALE_CUSTOMERS: readonly VcsaleCustomer[] = [
  c('KH-TEST-0101', 'Garage Minh Phát', '0900 000 101', MINH, { address: 'Thanh Xuân, Hà Nội' }),
  c('KH-TEST-0301', 'Garage Minh Khoa', '0900 000 301', LINH, {
    legalName: 'Hộ kinh doanh Garage Minh Khoa',
    taxCode: '9900000301',
    address: 'Số 8 ngõ 21 phố Thử Nghiệm, Hà Đông, Hà Nội',
    emails: ['khoa.gara@example.vn'],
  }),
  c('KH-TEST-0302', 'Garage Minh Khoa 2', '0900 000 301', LINH, { address: 'Lô 5 cụm xưởng Giả Định, Hoài Đức, Hà Nội' }),
  c('KH-TEST-0388', 'Gara Khoa Minh', '0900 000 388', HAI, { address: 'Thanh Xuân, Hà Nội', lastTradeAt: null }),
  c('KH-TEST-0401', 'Nguyễn Văn Bình', '0900 000 401', MINH, { type: 'Khách lẻ' }),
  c('KH-TEST-0501', 'Hoàng Văn Nam', '0900 000 502', MINH, { type: 'Khách lẻ' }),
  c('KH-TEST-0601', 'Garage Hưng Thịnh', '0900 000 601', MINH),
  c('KH-TEST-0701', 'Garage Đại Phát', '0900 000 701', MINH),
  c('KH-TEST-0801', 'Garage An Phú', '0900 000 900', MINH),
  c('KH-TEST-0802', 'Garage An Khang', '0900 000 821', HAI),
  c('KH-TEST-0901', 'Đặng Văn Lực', '0900 000 901', MINH, { type: 'Khách lẻ', lastTradeAt: '2025-03-10T03:00:00.000Z' }),
  c('KH-TEST-0950', 'Đinh Văn Kiên', '0900 000 950', LINH, { type: 'Khách lẻ' }),
  c('KH-TEST-0960', 'Garage Hòa Bình', '0900 000 960', HAI),
  c('KH-TEST-0970', 'Garage Phú Thịnh', '0900 000 970', null),
  c('KH-TEST-0980', 'Garage Đông Anh', '0900 000 980', HUONG),
  c('KH-TEST-0030', 'Garage Thành Công', '0900 000 030', MINH),
  c('KH-TEST-0003', 'Đại lý phụ tùng Hoàng Long', '0900 000 003', HAI, { type: 'Đại lý' }),
  c('KH-TEST-0021', 'Garage Tây Hồ', '0900 000 021', TOAN),
  c('KH-TEST-0022', 'Garage Long Biên', '0900 000 022', TOAN),
  c('KH-TEST-0023', 'Garage Hà Đông', '0900 000 023', TOAN),
  c('KH-TEST-0050', 'Trịnh Thị Oanh', '0900 000 050', LINH, { type: 'Khách lẻ', emails: ['oanh.trinh@example.vn'] }),
  c('KH-TEST-0071', 'Garage Phúc Lộc', '0900 000 071', TU, { address: 'Cầu Giấy, Hà Nội' }),
  c('KH-TEST-0072', 'Mai Văn Quý', '0900 000 072', TU, { type: 'Khách lẻ' }),
];

/** Mock commercial figures (test data TD-K01 of docs/05-kiem-thu/du-lieu-kiem-thu.md); other codes get a plain block. */
const MOCK_COMMERCE: Record<string, Omit<VcsaleCommerce, 'code'>> = {
  'KH-TEST-0101': {
    tier: 'B',
    revenue12m: 412_500_000,
    debt: { amount: 12_000_000, dueAt: '2026-10-20T00:00:00.000Z' },
    openQuotes: [{ no: 'BG-2026-0915', total: 8_450_000, validUntil: '2026-10-21T00:00:00.000Z' }],
    lastOrder: { no: 'DH-2026-0480', at: '2026-09-29T03:00:00.000Z', status: 'Đã xác nhận' },
  },
  'KH-TEST-0301': {
    tier: 'C',
    revenue12m: 96_000_000,
    debt: { amount: 4_500_000, dueAt: '2026-09-25T00:00:00.000Z' },
    openQuotes: [],
    lastOrder: { no: 'DH-2026-0391', at: '2026-09-12T03:00:00.000Z', status: 'Đã giao' },
  },
};

/** Overdue debts of the mock (TD-CN5, TD-CN6): the due date is "N days ago" whenever it is asked, so the demo never ages. */
const MOCK_OVERDUE_DEBT: Record<string, { amount: number; days: number }> = {
  'KH-TEST-0030': { amount: 180_000_000, days: 62 },
  'KH-TEST-0901': { amount: 1_800_000, days: 120 },
};

const DAY_MS = 86_400_000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY_MS).toISOString();

/** VCsales status standing behind each VClinks status of the mock. */
const MOCK_ERP_STATUS: Record<VcsaleQuoteStatus, [string, string]> = {
  draft: ['NOT_QUOTED', 'Chưa báo giá'],
  pending: ['FULLY_QUOTED', 'Đã báo giá · chờ duyệt giảm giá'],
  approved: ['FULLY_QUOTED', 'Đã báo giá'],
  ordered: ['WAREHOUSE_REQUESTED', 'Yêu cầu xuất kho'],
  cancelled: ['CANCELLED', 'Đã hủy'],
};

/** Staff of the mock: the salespersons of the test customers. */
const MOCK_STAFF: readonly [string, string][] = [
  ['minh.uat@vcprosperous.com', 'Nguyễn Văn Minh'],
  ['linh.uat@vcprosperous.com', 'Trần Thùy Linh'],
  ['hai.uat@vcprosperous.com', 'Phạm Văn Hải'],
  ['huong.uat@vcprosperous.com', 'Nguyễn Thị Hương'],
  ['tu.uat@vcprosperous.com', 'Đỗ Minh Tú'],
  ['toan.uat@vcprosperous.com', 'Lê Văn Toàn'],
];

/** `yyyy-mm-dd` in Asia/Ho_Chi_Minh, to tell "overdue" by calendar day like the rest of VClinks. */
const vnDayOf = (d: string | number | Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));

/** Quotes of the test data (TD-BG1…BG9), dates relative to today. */
export function mockVcsaleQuotes(): VcsaleQuote[] {
  const q = (no: string, customerCode: string, total: number, status: VcsaleQuoteStatus, validIn: number | null, lineCount: number, by = 'Nguyễn Văn Minh'): VcsaleQuote => ({
    id: no,
    no,
    customerCode,
    date: daysFromNow(-3),
    total,
    validUntil: validIn === null ? null : daysFromNow(validIn),
    status,
    lineCount,
    createdByName: by,
    version: '1',
    erpStatus: MOCK_ERP_STATUS[status][0],
    erpStatusLabel: MOCK_ERP_STATUS[status][1],
  });
  return [
    q('BG-2026-0915', 'KH-TEST-0101', 8_450_000, 'approved', 7, 5),
    q('BG-2026-0950', 'KH-TEST-0101', 8_390_000, 'approved', 7, 2),
    q('BG-2026-0932', 'KH-TEST-0101', 8_000_000, 'draft', null, 3),
    q('BG-2026-0902', 'KH-TEST-0101', 3_200_000, 'approved', -7, 2),
    q('BG-2026-0802', 'KH-TEST-0101', 1_500_000, 'approved', -1, 1),
    q('BG-2026-0801', 'KH-TEST-0601', 4_700_000, 'approved', -2, 2),
    q('BG-2026-0870', 'KH-TEST-0030', 400_000_000, 'approved', 7, 40),
    q('BG-2026-0940', 'KH-TEST-0901', 2_000_000, 'approved', 7, 2),
  ];
}

/** Smallest valid 1x1 PNG, standing in for a page image of the mock quote. */
const MOCK_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

/** A tiny but valid one-page PDF carrying the quote number and total (ASCII only: no embedded font needed). */
export function mockQuotePdf(q: Pick<VcsaleQuote, 'no' | 'total' | 'customerCode'>): Uint8Array {
  const text = `Bao gia ${q.no} - khach ${q.customerCode} - tong ${q.total} VND (mock)`.replace(/[()\\]/g, '');
  const stream = `BT /F1 14 Tf 50 780 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0) & 0xff);
}

/** In-memory VCsales. `customers` replaces the default catalogue (tests); `down` simulates an outage. */
export class MockVcsaleClient implements VcsaleClient {
  readonly mode = 'mock' as const;
  down = false;
  /** Test switch: exporting the PDF / images fails (ERR "VCsales không xuất được file báo giá"). */
  exportDown = false;
  /** Test counter: how many times a quote or the quote list was read (BR16: the send box must read live). */
  quoteReads = 0;
  private readonly customers: VcsaleCustomer[];
  private readonly quotes: VcsaleQuote[] = mockVcsaleQuotes();

  constructor(customers: readonly VcsaleCustomer[] = MOCK_VCSALE_CUSTOMERS) {
    this.customers = customers.map(copy);
  }

  /** Test helper: edit a quote "on VCsales" (bumps its version, as the real system would). */
  editQuote(no: string, patch: Partial<Omit<VcsaleQuote, 'no' | 'version'>>) {
    const q = this.quotes.find((x) => x.no === no);
    if (!q) throw new Error(`no such quote ${no}`);
    // A new VClinks status brings the VCsales status behind it, unless the test sets that one too.
    const erp = patch.status && !('erpStatus' in patch) ? { erpStatus: MOCK_ERP_STATUS[patch.status][0], erpStatusLabel: MOCK_ERP_STATUS[patch.status][1] } : {};
    Object.assign(q, patch, erp, { version: String(Number(q.version) + 1) });
  }

  async listQuotes(customerCode: string): Promise<VcsaleQuote[]> {
    this.check();
    this.quoteReads++;
    return this.quotes.filter((q) => q.customerCode === customerCode).sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no)).map((q) => ({ ...q }));
  }

  async getQuote(no: string): Promise<VcsaleQuote | null> {
    this.check();
    this.quoteReads++;
    const q = this.quotes.find((x) => x.no === no);
    return q ? { ...q } : null;
  }

  async getQuoteFiles(no: string, form: 'pdf' | 'image'): Promise<VcsaleQuoteFile[]> {
    this.check();
    const q = this.quotes.find((x) => x.no === no);
    if (!q || this.exportDown) throw new VcsaleExportError();
    return form === 'pdf'
      ? [{ name: `${no}.pdf`, mime: 'application/pdf', bytes: mockQuotePdf(q) }]
      : [{ name: `${no}-trang-1.png`, mime: 'image/png', bytes: MOCK_PNG }];
  }

  getQuoteCreateUrl(customerCode: string): string {
    return `${MOCK_VCSALE_WEB_URL}/quotes/new?customer=${encodeURIComponent(customerCode)}`;
  }

  async getDebtSummaries(codes: string[]): Promise<VcsaleDebtSummary[]> {
    this.check();
    const today = vnDayOf(Date.now());
    const out: VcsaleDebtSummary[] = [];
    for (const code of codes) {
      const c = await this.getCommerce(code);
      if (!c) {
        out.push({ code, notFound: true, total: 0, overdue: 0, nearestDueAt: null, oldestOverdueAt: null, dueAt: null, source: { total: 'none', due: 'none' } });
        continue;
      }
      const d = c.debt;
      const late = !!d?.dueAt && vnDayOf(d.dueAt) < today;
      out.push({
        code,
        total: d?.amount ?? 0,
        overdue: late ? (d?.amount ?? 0) : 0,
        nearestDueAt: d && !late ? d.dueAt : null,
        oldestOverdueAt: late ? d!.dueAt : null,
        dueAt: d?.dueAt ?? null,
        source: { total: d ? 'invoices' : 'none', due: d ? 'invoices' : 'none' },
      });
    }
    return out;
  }

  async listSalesStaff(): Promise<VcsaleStaffMember[]> {
    this.check();
    return MOCK_STAFF.map(([email, fullName], i) => ({
      id: `mock-staff-${i + 1}`,
      fullName,
      email,
      active: true,
      positionCode: 'NV',
      positionName: 'Nhân viên kinh doanh',
      departmentName: 'Kinh doanh',
      employeeId: null,
      emailMissing: false,
      emailDuplicated: false,
    }));
  }

  async getHealth(): Promise<VcsaleHealth> {
    return this.down ? { ok: false, version: null, error: new VcsaleUnavailableError().message } : { ok: true, version: 'mock', error: null };
  }

  private check() {
    if (this.down) throw new VcsaleUnavailableError();
  }

  /** Test helper: add or replace a customer (as if edited on VCsales). */
  upsert(customer: VcsaleCustomer) {
    const i = this.customers.findIndex((x) => x.code === customer.code);
    if (i >= 0) this.customers[i] = copy(customer);
    else this.customers.push(copy(customer));
  }

  async listCustomers(opts: { cursor?: string | null; limit?: number; updatedSince?: string | null } = {}): Promise<VcsaleCustomerPage> {
    this.check();
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const since = opts.updatedSince ? Date.parse(opts.updatedSince) : null;
    const rows = this.customers
      .filter((x) => since === null || Date.parse(x.updatedAt) > since)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.code.localeCompare(b.code));
    const start = opts.cursor ? Number(opts.cursor) || 0 : 0;
    const items = rows.slice(start, start + limit).map(copy);
    return { items, nextCursor: start + limit < rows.length ? String(start + limit) : null };
  }

  async searchCustomers(query: string, limit = 20): Promise<VcsaleCustomer[]> {
    this.check();
    const q = query.trim();
    if (q.length < 3) return [];
    const d = digits(q);
    const f = fold(q);
    return this.customers
      .filter(
        (x) =>
          x.code.toLowerCase() === q.toLowerCase() ||
          (d.length >= 6 && (x.phones.some((p) => digits(p).endsWith(d)) || x.taxCode === d)) ||
          fold(x.name).includes(f),
      )
      .slice(0, limit)
      .map(copy);
  }

  async getCustomer(code: string): Promise<VcsaleCustomer | null> {
    this.check();
    const x = this.customers.find((y) => y.code === code);
    return x ? copy(x) : null;
  }

  async searchProducts(query: string, opts: { customerCode?: string | null; limit?: number } = {}): Promise<VcsaleProduct[]> {
    this.check();
    const code = opts.customerCode ?? null;
    const tier = code ? ((await this.getCommerce(code))?.tier ?? null) : null;
    const rate = (tier && MOCK_TIER_DISCOUNT[tier]) || 0;
    const policy = code ? (rate ? `Chính sách hạng ${tier} (-${Math.round(rate * 100)}%)` : 'Giá niêm yết (khách chưa có hạng)') : null;
    return MOCK_VCSALE_PRODUCTS.filter((p) => matchProduct(p, query))
      .slice(0, Math.min(Math.max(opts.limit ?? 20, 1), 50))
      .map((p) => ({ ...p, oeCodes: [...p.oeCodes], fitments: [...p.fitments], customerPrice: code ? Math.round(p.listPrice * (1 - rate)) : null, policy }));
  }

  async getCommerce(code: string): Promise<VcsaleCommerce | null> {
    this.check();
    if (!this.customers.some((y) => y.code === code)) return null;
    const base = MOCK_COMMERCE[code] ?? { tier: null, revenue12m: null, debt: null, openQuotes: [], lastOrder: null };
    const od = MOCK_OVERDUE_DEBT[code];
    const m = od ? { ...base, debt: { amount: od.amount, dueAt: daysFromNow(-od.days) } } : base;
    return { code, ...m, debt: m.debt ? { ...m.debt } : null, openQuotes: m.openQuotes.map((q) => ({ ...q })), lastOrder: m.lastOrder ? { ...m.lastOrder } : null };
  }
}

/** Most codes per `/v1/debts` call (the bridge refuses more). */
const DEBT_BATCH = 100;

export interface HttpVcsaleOptions {
  /** Web address of VCsales for the "Tạo báo giá ↗" link (VCSALE_WEB_URL). */
  webUrl?: string | null;
  /** Wait for one call (default 5 s; PDF 25 s). */
  timeoutMs?: number;
}

const trimSlash = (u: string) => u.replace(/\/+$/, '');

/**
 * VCsales through its read-only `vclinks-bridge` (GET only, header `x-api-key`). Network errors and 5xx are
 * retried once (a time-out is not: it already waited), then raise VcsaleUnavailableError; a refused key or
 * address (401 / 403) says so, without retry.
 * Helpers are instance properties (not prototype methods): the prototype only carries list / get / search reads.
 */
export class HttpVcsaleClient implements VcsaleClient {
  readonly mode = 'http' as const;
  private readonly base: string;
  private readonly webUrl: string | null;
  private readonly timeoutMs: number;

  constructor(
    readonly baseUrl: string,
    private readonly token: string,
    opts: HttpVcsaleOptions = {},
  ) {
    this.base = trimSlash(baseUrl);
    this.webUrl = opts.webUrl ? trimSlash(opts.webUrl) : null;
    this.timeoutMs = opts.timeoutMs ?? 5000;
  }

  /** GET with retry; null on 404 when `allow404`. */
  private readonly fetchOk = async (path: string, opts: { allow404?: boolean; timeoutMs?: number } = {}): Promise<Response | null> => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${this.base}${path}`, {
          method: 'GET',
          headers: { 'x-api-key': this.token, accept: 'application/json, application/pdf' },
          signal: AbortSignal.timeout(opts.timeoutMs ?? this.timeoutMs),
        });
      } catch (e) {
        lastError = e;
        if ((e as Error)?.name === 'TimeoutError') break;
        continue;
      }
      if (res.ok) return res;
      if (res.status === 404 && opts.allow404) return null;
      if (res.status === 401 || res.status === 403) {
        throw new VcsaleUnavailableError('VCsales từ chối kết nối (sai khóa hoặc máy chưa được phép). Báo quản trị kiểm tra VCSALE_TOKEN.');
      }
      if (res.status === 429) throw new VcsaleUnavailableError('VCsales đang bận, thử lại sau ít giây.');
      if (res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      throw new VcsaleUnavailableError(`VCsales trả lỗi ${res.status}. Thử lại sau ít phút.`);
    }
    void lastError;
    throw new VcsaleUnavailableError();
  };

  private readonly json = async <T>(path: string, allow404 = false): Promise<T | null> => {
    const res = await this.fetchOk(path, { allow404 });
    return res ? ((await res.json()) as T) : null;
  };

  async listCustomers(opts: { cursor?: string | null; limit?: number; updatedSince?: string | null } = {}): Promise<VcsaleCustomerPage> {
    const q = new URLSearchParams({ limit: String(Math.min(Math.max(opts.limit ?? 200, 1), 500)) });
    if (opts.cursor) q.set('cursor', opts.cursor);
    else if (opts.updatedSince) q.set('updatedSince', opts.updatedSince);
    const page = await this.json<{ items?: VcsaleCustomer[]; nextCursor?: string | null }>(`/v1/customers?${q}`);
    return { items: page?.items ?? [], nextCursor: page?.nextCursor ?? null };
  }

  async searchCustomers(query: string, limit = 20): Promise<VcsaleCustomer[]> {
    const q = (query ?? '').trim();
    if (q.length < 3) return [];
    const r = await this.json<{ items?: VcsaleCustomer[] }>(`/v1/customers/search?${new URLSearchParams({ q, limit: String(Math.min(Math.max(limit, 1), 20)) })}`);
    return r?.items ?? [];
  }

  async getCustomer(code: string): Promise<VcsaleCustomer | null> {
    return this.json<VcsaleCustomer>(`/v1/customers/${encodeURIComponent(code)}`, true);
  }

  async getCommerce(code: string): Promise<VcsaleCommerce | null> {
    const c = await this.json<VcsaleCommerce & { lastOrder: { at: string | null } | null }>(`/v1/customers/${encodeURIComponent(code)}/commerce`, true);
    if (!c) return null;
    return { ...c, lastOrder: c.lastOrder ? { ...c.lastOrder, at: c.lastOrder.at ?? '' } : null };
  }

  async searchProducts(): Promise<VcsaleProduct[]> {
    throw new VcsaleUnavailableError('Tra hàng trên VCsales thật chưa nối (làm ở đợt 2).');
  }

  async listQuotes(customerCode: string): Promise<VcsaleQuote[]> {
    const r = await this.json<{ items?: (VcsaleQuote & { customerCode: string | null })[] }>(
      `/v1/customers/${encodeURIComponent(customerCode ?? '')}/quotes?limit=50`,
      true,
    );
    return (r?.items ?? []).map((q) => ({ ...q, customerCode: q.customerCode ?? customerCode }));
  }

  async getQuote(idOrNo: string): Promise<VcsaleQuote | null> {
    const q = await this.json<VcsaleQuote & { customerCode: string | null }>(`/v1/quotes/${encodeURIComponent(idOrNo ?? '')}`, true);
    return q ? { ...q, customerCode: q.customerCode ?? '' } : null;
  }

  async getQuoteFiles(idOrNo: string, form: 'pdf' | 'image' = 'pdf'): Promise<VcsaleQuoteFile[]> {
    if (form === 'image') throw new VcsaleExportError('VCsales chỉ xuất được báo giá dạng PDF. Chọn dạng PDF.');
    let res: Response | null;
    try {
      res = await this.fetchOk(`/v1/quotes/${encodeURIComponent(idOrNo ?? '')}/pdf`, { allow404: true, timeoutMs: 25_000 });
    } catch (e) {
      if (e instanceof VcsaleUnavailableError) throw new VcsaleExportError();
      throw e;
    }
    if (!res) throw new VcsaleExportError();
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `${idOrNo}.pdf`;
    return [{ name, mime: 'application/pdf', bytes: new Uint8Array(await res.arrayBuffer()) }];
  }

  /** The create page of VCsales (it does not take the customer from the link yet: the person picks it there). */
  getQuoteCreateUrl(customerCode: string): string {
    void customerCode;
    return `${this.webUrl ?? this.base}/sales/quotation/create`;
  }

  async getDebtSummaries(codes: string[]): Promise<VcsaleDebtSummary[]> {
    const list = [...new Set((codes ?? []).filter(Boolean))];
    const out: VcsaleDebtSummary[] = [];
    for (let i = 0; i < list.length; i += DEBT_BATCH) {
      const r = await this.json<{ items?: VcsaleDebtSummary[] }>(`/v1/debts?${new URLSearchParams({ codes: list.slice(i, i + DEBT_BATCH).join(',') })}`);
      out.push(...(r?.items ?? []));
    }
    return out;
  }

  async listSalesStaff(): Promise<VcsaleStaffMember[]> {
    const r = await this.json<{ items?: VcsaleStaffMember[] }>('/v1/staff');
    return r?.items ?? [];
  }

  /** `/v1/ping` sits behind the key (unlike `/health`), so one call checks address, key and databases. */
  async getHealth(): Promise<VcsaleHealth> {
    try {
      const r = await this.json<{ ok?: boolean; version?: string | null }>('/v1/ping');
      if (r?.ok) return { ok: true, version: r.version ?? null, error: null };
      return { ok: false, version: r?.version ?? null, error: 'VCsales trả lời nhưng cơ sở dữ liệu chưa sẵn sàng.' };
    } catch (e) {
      return { ok: false, version: null, error: e instanceof VcsaleUnavailableError ? e.message : 'Không kết nối được VCsales.' };
    }
  }
}

/** Client from the environment: VCSALE_MODE=mock (default) | http (VCSALE_URL, VCSALE_TOKEN, VCSALE_WEB_URL). */
export function createVcsaleClient(
  env: Record<string, string | undefined> = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {},
): VcsaleClient {
  if ((env.VCSALE_MODE ?? 'mock') === 'http') {
    if (!env.VCSALE_URL || !env.VCSALE_TOKEN) throw new Error('VCSALE_MODE=http cần VCSALE_URL và VCSALE_TOKEN');
    return new HttpVcsaleClient(env.VCSALE_URL, env.VCSALE_TOKEN, { webUrl: env.VCSALE_WEB_URL ?? null });
  }
  return new MockVcsaleClient();
}
