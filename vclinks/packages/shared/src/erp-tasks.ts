import { z } from 'zod';

/*
 * Việc VCsales (02 MH-DK-12, DK-58, SA-04) and the VCsales catalogue sync (plan docs/01-quan-ly-du-an/ke-hoach-ket-noi-vcsales.md
 * C11, C12). VClinks only reads VCsales (BR12): every change VCsales needs (new customer code, phone / e-mail, salesperson,
 * merging two codes) becomes a task a sale admin does by hand there, and the next sync closes or reopens it.
 */

export const ERP_TASK_KINDS = ['create_customer', 'update_phone', 'update_email', 'change_owner', 'merge_codes'] as const;
export type ErpTaskKind = (typeof ERP_TASK_KINDS)[number];

export const ERP_TASK_KIND_LABELS: Record<ErpTaskKind, string> = {
  create_customer: 'Tạo mã KH',
  update_phone: 'Đổi SĐT',
  update_email: 'Đổi email',
  change_owner: 'Đổi NV phụ trách',
  merge_codes: 'Gộp mã',
};

/** `open` waits for the sale admin; `waiting_sale` went back to the salesperson for missing fields. */
export const ERP_TASK_STATUSES = ['open', 'waiting_sale', 'done', 'closed'] as const;
export type ErpTaskStatus = (typeof ERP_TASK_STATUSES)[number];

export const ERP_TASK_STATUS_LABELS: Record<ErpTaskStatus, string> = {
  open: 'Đang chờ',
  waiting_sale: 'Chờ sale bổ sung',
  done: 'Đã xong',
  closed: 'Đã đóng',
};

/** Tab of MH-DK-12 a kind belongs to. */
export const erpTaskTab = (kind: ErpTaskKind): 'create' | 'update' => (kind === 'create_customer' ? 'create' : 'update');

/** Customer types of the create form (MH-DK-12 #3). */
export const ERP_CUSTOMER_TYPES = ['Garage', 'Đại lý', 'Khách lẻ'] as const;

/** Fields of the create form a sale admin can send back as missing ("Thiếu thông tin → trả sale"). */
export const ERP_FORM_FIELDS = ['legalName', 'taxCode', 'deliveryAddress', 'invoiceAddress', 'phone', 'type'] as const;
export type ErpFormField = (typeof ERP_FORM_FIELDS)[number];

export const ERP_FORM_FIELD_LABELS: Record<ErpFormField, string> = {
  legalName: 'Tên pháp lý',
  taxCode: 'MST',
  deliveryAddress: 'Địa chỉ giao hàng',
  invoiceAddress: 'Địa chỉ xuất hóa đơn',
  phone: 'SĐT',
  type: 'Loại khách',
};

export const ERP_CLOSE_REASONS = ['one_time', 'duplicate', 'other'] as const;
export type ErpCloseReason = (typeof ERP_CLOSE_REASONS)[number];

export const ERP_CLOSE_REASON_LABELS: Record<ErpCloseReason, string> = {
  one_time: 'Khách lẻ mua một lần',
  duplicate: 'Trùng khách có sẵn',
  other: 'Khác',
};

/** Minutes a "Nhận xử lý" keeps the row for one sale admin (MH-DK-12 #8, as MH-DK-04 #13). */
export const ERP_TASK_CLAIM_MINUTES = 15;

const id = z.string().trim().min(1).max(200);
const code = z.string().trim().min(1).max(64);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

/**
 * "Phiếu thông tin tạo mã" (MH-DK-12 #3), filled by the salesperson. Any field may be left empty: the list shows
 * "Thiếu …" and the sale admin can send it back. The phone is one of the customer's contact points (shown masked).
 */
export const erpCreateFormSchema = z
  .object({
    legalName: text(200),
    taxCode: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s.-]/g, '') || null)
      .refine((v) => v === null || /^\d{10}(\d{3})?$/.test(v), 'MST gồm 10 hoặc 13 số.')
      .nullable()
      .optional(),
    deliveryAddress: text(300),
    invoiceAddress: text(300),
    phonePointId: id.nullable().optional(),
    type: z.enum(ERP_CUSTOMER_TYPES).nullable().optional(),
    note: text(500),
  })
  .strict();
export type ErpCreateForm = z.output<typeof erpCreateFormSchema>;

/** Fields still missing on a create form: MST only for garages and dealers (optional for "Khách lẻ"). */
export function erpFormMissing(f: Partial<ErpCreateForm> | null | undefined): ErpFormField[] {
  const out: ErpFormField[] = [];
  if (!f?.legalName) out.push('legalName');
  if (!f?.type) out.push('type');
  if (!f?.phonePointId) out.push('phone');
  if (!f?.deliveryAddress) out.push('deliveryAddress');
  if (!f?.taxCode && f?.type !== 'Khách lẻ') out.push('taxCode');
  return out;
}

export const erpTaskCreateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create_customer'), accountId: id, form: erpCreateFormSchema }).strict(),
  /** The new phone / e-mail is one of the customer's verified contact points (SA-04). */
  z.object({ kind: z.literal('update_phone'), accountId: id, pointId: id }).strict(),
  z.object({ kind: z.literal('update_email'), accountId: id, pointId: id }).strict(),
  /** The VCsales salesperson becomes the VClinks owner of the account (TT-01: the owner lives in VClinks). */
  z.object({ kind: z.literal('change_owner'), accountId: id }).strict(),
  /** "Báo trùng trên VCsales": the other codes are merged into the main one on VCsales; the main one is linked. */
  z.object({ kind: z.literal('merge_codes'), accountId: id, mainCode: code, otherCodes: z.array(code).min(1).max(5) }).strict(),
]);
export type ErpTaskCreateInput = z.output<typeof erpTaskCreateSchema>;

const flag = z
  .enum(['0', '1', 'true', 'false'])
  .transform((v) => v === '1' || v === 'true')
  .optional();

export const erpTaskListQuerySchema = z
  .object({
    tab: z.enum(['create', 'update']).default('create'),
    /** "Của tôi": tasks the caller created, claimed or owns the customer of. */
    mine: flag,
    /** 4a: accounts whose VClinks owner is not a VCsales salesperson of the code. */
    mismatch: z.enum(['owner']).optional(),
    /** Also the finished ones of the last 30 days. */
    finished: flag,
  })
  .strict();
export type ErpTaskListQuery = z.output<typeof erpTaskListQuerySchema>;

export const erpTaskLinkSchema = z.object({ code }).strict();
export const erpTaskReturnSchema = z.object({ missing: z.array(z.enum(ERP_FORM_FIELDS)).min(1), note: text(300) }).strict();
export const erpTaskCloseSchema = z.object({ reason: z.enum(ERP_CLOSE_REASONS), note: text(300) }).strict();
export const erpTaskFormSchema = z.object({ form: erpCreateFormSchema }).strict();

/** One VCsales customer seen while checking duplicates or suggested by the sync (phones masked). */
export interface ErpTaskCandidate {
  code: string;
  name: string;
  taxCode: string | null;
  address: string | null;
  phones: string[];
  salesperson: string | null;
  /** Why it matches: "SĐT", "MST", "tên giống". */
  reasons: string[];
  /** Account this code is already linked to, if any. */
  linkedTo: { accountId: string; name: string } | null;
}

export interface ErpTaskView {
  id: string;
  kind: ErpTaskKind;
  status: ErpTaskStatus;
  accountId: string;
  accountName: string;
  /** VCsales code concerned (update tab), or the code linked when a create task was done. */
  code: string | null;
  owners: { userId: string; userName: string | null }[];
  /** One line for the table: "Đổi SĐT 0900***501 → 0900***502", "Gộp mã KH-2 vào KH-1"… */
  summary: string;
  /** Why it is in the queue: "Linh bấm Đưa vào hàng chờ", "Báo trùng", "Owner VClinks ≠ NV phụ trách VCsales"… */
  origin: string;
  form: (ErpCreateForm & { phoneMasked: string | null }) | null;
  missing: ErpFormField[];
  /** New phone / e-mail of an update task (masked; the full value is read through the reveal API with `pointId`). */
  newValue: { pointId: string; masked: string } | null;
  /** Main and other codes of a merge task. */
  merge: { mainCode: string; otherCodes: string[] } | null;
  /** Salesperson change: from the VCsales names to the VClinks owner. */
  owner: { from: string[]; to: string | null; since: string | null } | null;
  /** "Nhận xử lý": who holds the row and until when. */
  claim: { by: string; byName: string | null; until: string } | null;
  /** Last duplicate check on VCsales ("Trùng?" column). */
  duplicates: { at: string; candidates: ErpTaskCandidate[] } | null;
  /** New code found by the sync for a create task (MH-DK-12 #6). */
  suggestion: (ErpTaskCandidate & { at: string }) | null;
  /** Last check of a "done" update task by the sync: still different on VCsales → the task opens again. */
  reopenedNote: string | null;
  returned: { missing: ErpFormField[]; note: string | null; by: string; at: string } | null;
  closeReason: ErpCloseReason | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  doneBy: string | null;
  doneAt: string | null;
  /** VCsales page of the customer concerned ("Mở trên VCsales"), when the web address and its id are known. */
  vcsalesUrl: string | null;
  /** What the caller may do on this row. */
  can: { process: boolean; editForm: boolean };
}

/** One account of filter 4a (owner VClinks ≠ NV phụ trách VCsales). */
export interface ErpOwnerMismatchRow {
  accountId: string;
  accountName: string;
  code: string;
  owners: { userId: string; userName: string | null; since: string }[];
  /** VCsales salespersons of the code (names). */
  salespersons: string[];
  /** Open change_owner task of the account, if any. */
  taskId: string | null;
}

export interface ErpTaskListResponse {
  items: ErpTaskView[];
  counts: { create: number; update: number; mismatch: number };
  mismatch: ErpOwnerMismatchRow[] | null;
  /** Caller is a sale admin (processes rows); others only read or create. */
  canProcess: boolean;
  /** Last VCsales sync of the catalogue ("Đồng bộ VCsales lần cuối [HH:mm]", MH-DK-12 #9). */
  lastSyncAt: string | null;
  /** Web address of VCsales for "Mở VCsales tạo mã" (null in mock mode). */
  createUrl: string | null;
}

// ------------------------------------------------------------------------------------------------- catalogue sync (C11)

export const ERP_SYNC_KINDS = ['preview', 'full', 'incremental'] as const;
export type ErpSyncKind = (typeof ERP_SYNC_KINDS)[number];

export const ERP_SYNC_KIND_LABELS: Record<ErpSyncKind, string> = {
  preview: 'Xem trước',
  full: 'Nạp toàn bộ',
  incremental: 'Đồng bộ thay đổi',
};

export const erpSyncStartSchema = z
  .object({
    kind: z.enum(ERP_SYNC_KINDS),
    /** Division whose first owners are loaded (D8-06); default: the one of the first import, else AUTHZ_DEFAULT_DIVISION. */
    division: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
export type ErpSyncStartInput = z.output<typeof erpSyncStartSchema>;

export interface ErpSyncCounts {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Customers deleted on VCsales (incremental pages): their snapshot is marked, no profile is made for them. */
  deleted: number;
  /** New codes matching a waiting "Chờ tạo mã KH" form: no profile, the task suggests "Gắn mã này". */
  held: number;
  ownersSet: number;
  ownerUnmatched: number;
  ownerMismatch: number;
  autoMerged: number;
  suggestions: number;
  /** Việc VCsales closed (done on VCsales) or reopened (still different) by this run, and new codes suggested. */
  tasksDone: number;
  tasksReopened: number;
  codeSuggestions: number;
}

export interface ErpSyncRunView {
  id: string;
  kind: ErpSyncKind;
  by: string;
  /** Name of the person who ran it; null for the automatic sync. */
  byName: string | null;
  startedAt: string;
  finishedAt: string | null;
  /** Changes after this time were read (incremental), null for a full read. */
  since: string | null;
  counts: ErpSyncCounts;
  error: string | null;
}

export interface ErpSyncStatus {
  mode: 'mock' | 'http';
  /** Division of the first owners (D8-06), fixed by the first full import. */
  division: string | null;
  firstImportAt: string | null;
  lastSyncAt: string | null;
  /** High-water mark: VCsales changes after this time are read by the next incremental sync. */
  since: string | null;
  /** Minutes between two automatic syncs (0 = off). Automatic syncs only start after the first full import. */
  everyMinutes: number;
  /** Snapshots of VCsales customers kept in VClinks. */
  snapshotCount: number;
  running: { id: string; kind: ErpSyncKind; by: string; startedAt: string; fetched: number } | null;
  runs: ErpSyncRunView[];
  canRun: boolean;
}
