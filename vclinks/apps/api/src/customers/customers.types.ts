import { createHash } from 'node:crypto';
import type {
  ContactPointKind,
  ContactPointState,
  CustomerStatus,
  ErpCloseReason,
  ErpCreateForm,
  ErpFormField,
  ErpLinkStatus,
  ErpSyncCounts,
  ErpSyncKind,
  ErpSystem,
  ErpTaskCandidate,
  ErpTaskKind,
  ErpTaskStatus,
  IdentityLinkState,
  MergeBlock,
  MergeOp,
  MergeSignalView,
  MergeSuggestionStatus,
  OrgRole,
  VerifyLevel,
} from '@vclinks/shared';
import type { VcsaleCustomer } from '@vclinks/vcsale-client';

/**
 * Customer collections (M1b-12, docs/02-yeu-cau/dac-ta/02-khach-da-kenh.md §9). All tenant-scoped.
 * Contract with M1b-14 (per-customer keys): identity ids never change; `erasedAt` / `erasedBy` on
 * customer_accounts and customer_contacts are written by M1b-14 and respected here.
 */
export const CUST_C = {
  accounts: 'customer_accounts',
  contacts: 'customer_contacts',
  points: 'contact_points',
  identityLinks: 'identity_links',
  erpCustomers: 'erp_customers',
  suggestions: 'merge_suggestions',
  operations: 'merge_operations',
  /** Việc VCsales (02 MH-DK-12, DK-58) and the catalogue sync state (plan C11). */
  erpTasks: 'erp_tasks',
  erpSync: 'erp_sync',
} as const;

/** Short stable hash used to derive ids: re-running a migration / import never creates duplicates. */
export const stableHash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 20);

export interface CustomerOwner {
  division: string;
  userId: string;
  since: Date;
  source: 'vcsales_import' | 'manual' | 'merge';
}

export interface ErpLink {
  erp: ErpSystem;
  customerId: string;
  status: ErpLinkStatus;
  confirmedBy: string | null;
  confirmedAt: Date | null;
}

interface Erasable {
  /** Set by M1b-14 when the customer is erased (NĐ 13, key destroyed). */
  erasedAt?: Date | null;
  erasedBy?: string | null;
}

interface FromRun {
  /** migrate-customers run that created the record (undo deletes exactly these). */
  migrationRunId?: string;
}

export interface CustomerAccountDoc extends Erasable, FromRun {
  _id: string;
  name: string;
  type: string | null;
  region: string | null;
  status: CustomerStatus;
  mergedInto: string | null;
  owners: CustomerOwner[];
  erpLinks: ErpLink[];
  tags: string[];
  createdFrom: 'identity' | 'erp' | 'manual';
  /** Accent-free lower-case name for Ctrl+K (written lazily by CustomersService.quickSearch). */
  nameFold?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerContactDoc extends Erasable, FromRun {
  _id: string;
  accountId: string;
  name: string;
  orgRole: OrgRole | null;
  status: CustomerStatus;
  mergedInto: string | null;
  /** Contacts this one must never be merged with automatically again (split / undo, DK-12 #6). */
  mergeLocks: string[];
  gender: 'male' | 'female' | null;
  /** Company staff (role nhan_vien / quan_ly or org email): never auto-merged (DK-08 #5). */
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactPointDoc extends FromRun {
  _id: string;
  /** Null for an account-level point (garage landline). */
  contactId: string | null;
  accountId: string;
  kind: ContactPointKind;
  /** Normalised value (normalizePhone / normalizeEmail). */
  value: string;
  level: VerifyLevel;
  state: ContactPointState;
  source: { channel?: string; identityId?: string; erp?: ErpSystem; customerId?: string };
  lastActivityAt: Date | null;
  createdAt: Date;
}

export interface IdentityLinkDoc extends FromRun {
  /** = identityId = `contacts._id` = `${uid}:${userId}`; never changes. */
  _id: string;
  identityId: string;
  uid: string;
  userId: string;
  channel: string;
  contactId: string;
  accountId: string;
  state: IdentityLinkState;
  linkedBy: string;
  linkedAt: Date;
  /** First time VClinks saw the identity ("danh tính mới" ≤ 72 h). */
  firstSeenAt: Date;
  mergeOpId?: string | null;
}

/** Read-only snapshot of one ERP customer (`_id` = `${erp}:${code}`): mock and real API share it. */
export interface ErpCustomerDoc {
  _id: string;
  erp: ErpSystem;
  code: string;
  name: string;
  /** Normalised phones / emails. */
  phones: string[];
  emails: string[];
  taxCode: string | null;
  address: string | null;
  region: string | null;
  salespersonEmail: string | null;
  status: VcsaleCustomer['status'];
  mergedInto: string | null;
  /** VClinks owner differs from the VCsales salesperson (D8-06: warn, never write back). */
  ownerMismatch: boolean;
  raw: VcsaleCustomer;
  hash: string;
  fetchedAt: Date;
}

/**
 * One Việc VCsales (02 §9 `erp_tasks`). Phones and e-mails are never copied here: an update task points at the
 * customer's contact point (`pointId`), so erasing the customer (NĐ 13) leaves no number behind.
 */
export interface ErpTaskDoc {
  _id: string;
  erp: ErpSystem;
  kind: ErpTaskKind;
  accountId: string;
  /** Division of the account owner when the task was made (sale admin scope for accounts without an owner). */
  division: string | null;
  status: ErpTaskStatus;
  /** "Linh bấm Đưa vào hàng chờ", "Báo trùng trên VCsales", "Owner VClinks ≠ NV phụ trách VCsales". */
  origin: string;
  /** VCsales code concerned (update tab); for a done create task, the code linked. */
  code: string | null;
  form: ErpCreateForm | null;
  /** update_phone / update_email: the new value is this contact point of the account. */
  pointId: string | null;
  /** merge_codes */
  mainCode: string | null;
  otherCodes: string[];
  /** change_owner: VClinks owner the VCsales salesperson must become. */
  toUserId: string | null;
  sourceMessageIds: string[];
  claim: { by: string; until: Date } | null;
  /** Last "Kiểm tra trùng trên VCsales": candidates as shown then (phones masked). */
  duplicates: { at: Date; candidates: Omit<ErpTaskCandidate, 'linkedTo'>[] } | null;
  /** New code found by a sync for a create task (MH-DK-12 #6); details come from the snapshot. */
  suggestion: { code: string; at: Date; reasons: string[] } | null;
  returned: { missing: ErpFormField[]; note: string | null; by: string; at: Date } | null;
  closeReason: ErpCloseReason | null;
  closeNote: string | null;
  /** A "done" update task the next sync must still compare with VCsales. */
  verifyAfter: Date | null;
  reopenedNote: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  doneBy: string | null;
  doneAt: Date | null;
}

/** Catalogue sync state of one tenant (`_id` = `vcsales:<tenant>`). */
export interface ErpSyncDoc {
  _id: string;
  erp: ErpSystem;
  division: string | null;
  firstImportAt: Date | null;
  lastSyncAt: Date | null;
  /** Highest VCsales `updatedAt` read so far. */
  since: Date | null;
  running: { id: string; kind: ErpSyncKind; by: string; startedAt: Date; fetched: number } | null;
  runs: { id: string; kind: ErpSyncKind; by: string; startedAt: Date; finishedAt: Date | null; since: Date | null; counts: ErpSyncCounts; error: string | null }[];
}

export interface MergeSuggestionDoc {
  _id: string;
  kind: 'contact';
  a: { contactId: string; accountId: string };
  b: { contactId: string; accountId: string };
  score: number;
  signals: MergeSignalView[];
  blocks: MergeBlock[];
  priority: 'high' | 'normal';
  /** Found during the first clean-up (migration / first import): no deadline (§4.6). */
  cleanup: boolean;
  status: MergeSuggestionStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** State of the records an operation touched, to undo it exactly (DK-11, DK-18). */
export interface MergeSnapshot {
  links: Pick<IdentityLinkDoc, '_id' | 'contactId' | 'accountId' | 'state' | 'mergeOpId'>[];
  points: Pick<ContactPointDoc, '_id' | 'contactId' | 'accountId'>[];
  contacts: Pick<CustomerContactDoc, '_id' | 'status' | 'mergedInto' | 'accountId'>[];
  accounts: Pick<CustomerAccountDoc, '_id' | 'status' | 'mergedInto' | 'owners'>[];
}

export interface MergeOperationDoc {
  _id: string;
  op: MergeOp;
  actor: string;
  at: Date;
  suggestionId: string | null;
  /** Kept contact and absorbed contact of a merge. */
  target: { contactId: string; accountId: string } | null;
  source: { contactId: string; accountId: string } | null;
  signals: MergeSignalView[];
  before: MergeSnapshot | null;
  undoUntil: Date | null;
  undoneAt: Date | null;
  undoneBy: string | null;
  detail?: Record<string, unknown>;
}
