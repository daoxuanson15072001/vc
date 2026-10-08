import { z } from 'zod';
import { COMPANY_DOMAINS } from './org';

/*
 * Customer model (docs/02-yeu-cau/dac-ta/02-khach-da-kenh.md §4, §9; BA Q1, D8-05, D8-06; M1b-12).
 *
 * Three levels: CustomerAccount (tổ chức khách) → CustomerContact (người) → channel identity.
 * A channel identity is a record of the existing `contacts` collection, keyed `${uid}:${userId}`;
 * its link to a person lives in `identity_links` (`_id` = identity id). Merging / splitting only
 * rewrites `contactId` / `accountId` of links: identity ids, `contacts._id` and messages never change
 * (DK-01; per-identity keys of M1b-14 stay valid).
 *
 * ERP data (VCsales) is read only and goes through `erp_customers` snapshots, so replacing the mock
 * client by the real API does not change this model (BR12).
 */

/** Identity id of a channel identity: the `_id` of its `contacts` record. */
export const identityIdOf = (uid: string, userId: string) => `${uid}:${userId}`;

/** Splits an identity id back into the channel (account uid) and the platform user id. */
export function splitIdentityId(id: string): { uid: string; userId: string } | null {
  const i = id.indexOf(':');
  if (i <= 0 || i === id.length - 1) return null;
  return { uid: id.slice(0, i), userId: id.slice(i + 1) };
}

/** Verification levels of a phone / email (DK-04, §4.2). */
export const VERIFY_LEVELS = ['V0', 'V1', 'V2', 'V3'] as const;
export type VerifyLevel = (typeof VERIFY_LEVELS)[number];
export const verifyRank = (l: VerifyLevel) => VERIFY_LEVELS.indexOf(l);
export const VERIFY_LEVEL_LABELS: Record<VerifyLevel, string> = {
  V3: 'Đã xác thực',
  V2: 'Nền tảng / NV xác nhận',
  V1: 'Khách tự khai',
  V0: 'Suy luận',
};

export const CONTACT_POINT_KINDS = ['phone', 'email'] as const;
export type ContactPointKind = (typeof CONTACT_POINT_KINDS)[number];

/** State of a contact point (DK-04, DK-57): in use, retired, shared in one account / many customers, no longer verified. */
export const CONTACT_POINT_STATES = ['active', 'retired', 'shared_account', 'shared_many', 'unverified'] as const;
export type ContactPointState = (typeof CONTACT_POINT_STATES)[number];

/**
 * How an identity is tied to its person: `new` = own fresh profile (F5.1), `auto` = merged by the
 * D8-05 rule (undo-able), `confirmed` = merged / attached by a person, `unconfirmed` = only V1 evidence (DK-15).
 */
export const IDENTITY_LINK_STATES = ['new', 'auto', 'confirmed', 'unconfirmed'] as const;
export type IdentityLinkState = (typeof IDENTITY_LINK_STATES)[number];

/** Role of a person in the customer organisation (DK-61, §4.13a). */
export const ORG_ROLES = ['owner', 'manager', 'purchasing', 'accounting', 'technician', 'proxy', 'other'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];
export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Chủ / Giám đốc',
  manager: 'Quản lý xưởng',
  purchasing: 'Mua hàng',
  accounting: 'Kế toán / Thanh toán',
  technician: 'Thợ / Kỹ thuật',
  proxy: 'Người nhà / người nói thay',
  other: 'Khác',
};

/** ERP systems a customer account can be linked to, one code each (BR11). */
export const ERP_SYSTEMS = ['vcsales', 'vcgarage', 'vcedu', 'vccrm'] as const;
export type ErpSystem = (typeof ERP_SYSTEMS)[number];
export const ERP_LINK_STATUSES = ['suggested', 'confirmed'] as const;
export type ErpLinkStatus = (typeof ERP_LINK_STATUSES)[number];

export const CUSTOMER_STATUSES = ['active', 'merged'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

/** Match signals implemented by the merge rules (§4.4). Others (T8–T11, T13, T15, T16, G*) need message analysis or claim times. */
export const MERGE_SIGNALS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T12', 'T14', 'A1', 'A2', 'A4', 'A6'] as const;
export type MergeSignalCode = (typeof MERGE_SIGNALS)[number];

/** Reasons that block an automatic merge (DK-08, §4.5). */
export const MERGE_BLOCKS = [
  'shared_or_retired',
  'two_erp_codes',
  'two_owners',
  'split_before',
  'internal_staff',
  'web_chat',
  'gender',
  'dormant',
  'unverified_point',
  'erased',
] as const;
export type MergeBlock = (typeof MERGE_BLOCKS)[number];
export const MERGE_BLOCK_LABELS: Record<MergeBlock, string> = {
  shared_or_retired: 'SĐT / email dùng chung hoặc ngừng dùng',
  two_erp_codes: 'Hai mã KH khác nhau',
  two_owners: 'Hai owner khác nhau cùng division',
  split_before: 'Đã từng tách',
  internal_staff: 'Nhân viên nội bộ',
  web_chat: 'Danh tính chat web',
  gender: 'Khác giới tính',
  dormant: 'SĐT không hoạt động > 12 tháng',
  unverified_point: 'SĐT dùng chung nhiều khách / không còn xác thực',
  erased: 'Hồ sơ đã xóa theo yêu cầu',
};

export const MERGE_OUTCOMES = ['auto_merge', 'suggest_high', 'suggest', 'none'] as const;
export type MergeOutcome = (typeof MERGE_OUTCOMES)[number];

export const MERGE_SUGGESTION_STATUSES = ['open', 'merged', 'rejected', 'expired'] as const;
export type MergeSuggestionStatus = (typeof MERGE_SUGGESTION_STATUSES)[number];

export const MERGE_OPS = ['auto_merge', 'merge', 'undo', 'erp_link', 'import'] as const;
export type MergeOp = (typeof MERGE_OPS)[number];

/** Undo window of a merge (DK-11). */
export const MERGE_UNDO_DAYS = 30;
/** "Danh tính mới" (DK-06): seen ≤ 72 h, fewer than 20 messages. */
export const NEW_IDENTITY_HOURS = 72;
export const NEW_IDENTITY_MAX_MESSAGES = 20;

// ---------------------------------------------------------------------------
// Normalisation (DK-03, DK-19, §4.3)

/** Old 11-digit mobile prefixes → 10-digit ones (2018 renumbering). */
const OLD_PREFIX: Record<string, string> = {
  '0120': '070', '0121': '079', '0122': '077', '0126': '076', '0128': '078',
  '0123': '083', '0124': '084', '0125': '085', '0127': '081', '0129': '082',
  '0162': '032', '0163': '033', '0164': '034', '0165': '035', '0166': '036',
  '0167': '037', '0168': '038', '0169': '039', '0186': '056', '0188': '058', '0199': '059',
};

/**
 * Normalised Vietnamese phone number (10-digit mobile `0[35789]…` or 11-digit landline `02…`), or null
 * when the value cannot be used as a match signal (toll-free 1800 / 1900, company numbers, garbage).
 */
export function normalizePhone(raw: string | null | undefined, companyNumbers: readonly string[] = []): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[\s.\-()]/g, '');
  if (!/^\+?\d+$/.test(d)) return null;
  d = d.replace(/^\+/, '');
  if (d.startsWith('84') && (d.length === 11 || d.length === 12)) d = `0${d.slice(2)}`;
  if (d.length === 11 && OLD_PREFIX[d.slice(0, 4)]) d = OLD_PREFIX[d.slice(0, 4)] + d.slice(4);
  if (d.startsWith('1800') || d.startsWith('1900')) return null;
  if (!/^0[35789]\d{8}$/.test(d) && !/^02\d{9}$/.test(d)) return null;
  if (companyNumbers.some((c) => normalizePhone(c) === d)) return null;
  return d;
}

/** Company domains: their addresses are staff, never customer match signals. */
export const COMPANY_EMAIL_DOMAINS: readonly string[] = COMPANY_DOMAINS;

/** Normalised email (lower case; gmail dots and `+tag` removed), or null for invalid / company addresses. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = String(raw).trim().toLowerCase();
  const m = /^([^\s@]+)@([^\s@]+\.[^\s@]+)$/.exec(e);
  if (!m) return null;
  let [, local, domain] = m;
  if (COMPANY_EMAIL_DOMAINS.includes(domain)) return null;
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.split('+')[0].replace(/\./g, '');
  return local ? `${local}@${domain}` : null;
}

// ---------------------------------------------------------------------------
// API shapes

export interface CustomerOwnerView {
  division: string;
  userId: string;
  userName: string | null;
  since: string;
  source: 'vcsales_import' | 'manual' | 'merge';
}

export interface ErpLinkView {
  erp: ErpSystem;
  customerId: string;
  status: ErpLinkStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

export interface ContactPointView {
  id: string;
  kind: ContactPointKind;
  /**
   * Phones and emails are masked by CustomersService unless cust.phone_full shows them in full to the
   * viewer (DK-44); `masked` / `revealable` say how the UI must show them ("Hiện" button, 60 s).
   */
  phone?: string;
  email?: string;
  masked?: boolean;
  revealable?: boolean;
  level: VerifyLevel;
  state: ContactPointState;
  source: string;
}

export interface IdentityView {
  identityId: string;
  uid: string;
  userId: string;
  channel: string;
  name: string | null;
  state: IdentityLinkState;
  linkedBy: string;
  linkedAt: string;
}

export interface CustomerContactView {
  id: string;
  name: string;
  orgRole: OrgRole | null;
  status: CustomerStatus;
  points: ContactPointView[];
  identities: IdentityView[];
}

export interface CustomerSummary {
  id: string;
  name: string;
  type: string | null;
  region: string | null;
  status: CustomerStatus;
  owners: CustomerOwnerView[];
  erpLinks: ErpLinkView[];
  contactCount: number;
  identityCount: number;
  updatedAt: string;
}

export interface CustomerDetail extends CustomerSummary {
  mergedInto: string | null;
  contacts: CustomerContactView[];
  /** Account-level contact points (garage landline…). */
  points: ContactPointView[];
}

export interface CustomerListResponse {
  items: CustomerSummary[];
  total: number;
}

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  /** `none` = no confirmed VCsales code. */
  erp: z.enum(['linked', 'none']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type CustomerListQuery = z.output<typeof customerListQuerySchema>;

export const customerImportSchema = z
  .object({
    erp: z.literal('vcsales').default('vcsales'),
    /** Division whose owners are loaded the first time (D8-06); default AUTHZ_DEFAULT_DIVISION. */
    division: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
export type CustomerImportInput = z.output<typeof customerImportSchema>;

export interface CustomerImportResult {
  erp: ErpSystem;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  ownersSet: number;
  /** ERP salesperson that matched no VClinks user: account stays "Chưa phân công". */
  ownerUnmatched: number;
  /** VClinks owner differs from the VCsales salesperson: warning only, never written back (D8-06). */
  ownerMismatch: number;
  autoMerged: number;
  suggestions: number;
}

export interface CustomerSweepResult {
  profilesCreated: number;
  autoMerged: number;
  suggestions: number;
}

export const erpLinkConfirmSchema = z
  .object({
    erp: z.enum(ERP_SYSTEMS).default('vcsales'),
    customerId: z.string().trim().min(1).max(64),
  })
  .strict();
export type ErpLinkConfirmInput = z.output<typeof erpLinkConfirmSchema>;

/** Text of the UAT-DK-27 warning (MH-DK-10 "Xác nhận" when the code is taken). */
export const ERP_CODE_TAKEN_TEXT = (otherName: string) =>
  `Mã KH này đã liên kết với ${otherName}. Có thể hai hồ sơ là một khách.`;

export interface MergeSignalView {
  code: MergeSignalCode;
  points: number;
  detail?: string;
}

export interface MergeSuggestionView {
  id: string;
  a: { contactId: string; accountId: string; name: string };
  b: { contactId: string; accountId: string; name: string };
  score: number;
  signals: MergeSignalView[];
  blocks: MergeBlock[];
  priority: 'high' | 'normal';
  cleanup: boolean;
  status: MergeSuggestionStatus;
  createdAt: string;
}

export interface MergeOperationView {
  id: string;
  op: MergeOp;
  actor: string;
  at: string;
  undoUntil: string | null;
  undoneAt: string | null;
}

/** One row of "Đối chiếu mã KH" (MH-DK-13). */
export interface ErpMatchingRow {
  accountId: string;
  accountName: string;
  owners: CustomerOwnerView[];
  candidates: { customerId: string; name: string; score: number; reasons: string[]; taxCode: string | null; address: string | null; salesperson: string | null }[];
}

/** A VCsales customer found by "Liên kết mã KH" (manual search, MH-DK-10). Phones are masked. */
export interface ErpSearchRow {
  code: string;
  name: string;
  taxCode: string | null;
  address: string | null;
  region: string | null;
  type: string | null;
  phones: string[];
  salespersonName: string | null;
}

export interface ErpMatchingResponse {
  items: ErpMatchingRow[];
  /** Sale admin confirms; GĐ division reads only (D8-17). */
  canConfirm: boolean;
  /** `mock`: fake VCsales data; `http`: the real VCsales through vclinks-bridge. */
  erpMode: 'mock' | 'http';
  /** VCsales customers loaded into VClinks (Danh mục VCsales): suggestions come only from them. */
  catalogSize: number;
}
