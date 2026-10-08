import { z } from 'zod';
import { CONTACT_ROLES, MAX_BATCH_SIZE, uidSchema, type ContactRole } from './schemas';

/**
 * Zalo personal "Danh bạ" (friend list) read from the Zalo Web DOM by the
 * extension's ContactReader (03 MH-SZ-09, BA §11.6 L3 F1–F3). The IndexedDB
 * `friend` store keeps names and phone numbers as ciphertext, so the plaintext
 * name shown in the friend list (the alias when one is set, else the Zalo name)
 * comes from the DOM. Only these fields are accepted (strict): no tokens, no
 * ciphertext, no free-form payload.
 */

const zid = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d{1,40}$/));

/** One row of the Zalo Web friend list. */
export const contactDomItemSchema = z
  .object({
    /** Zalo user id; missing when the row could not be tied to an id (the API then matches by name). */
    userId: zid.optional(),
    /** Name shown in the friend list: the alias (tên gợi nhớ) when set, else the Zalo name. */
    name: z.string().trim().min(1).max(200),
    // Non-https avatars are dropped (not rejected) so the name still lands.
    avatar: z.preprocess(
      (v) => (typeof v === 'string' && v.length <= 2000 && /^https:\/\/[^\s]+$/i.test(v) ? v : undefined),
      z.string().url().max(2000).optional(),
    ),
    /** Zalo label (thẻ phân loại) shown on the row. */
    labels: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
    /** zBusiness badge on the row. */
    business: z.boolean().optional(),
  })
  .strict();
export type ContactDomItem = z.output<typeof contactDomItemSchema>;

/** POST /api/contacts/:uid/dom */
export const contactDomBatchSchema = z
  .object({
    /** Count in the list header "Bạn bè (N)", for the sync comparison (BA S4). */
    friendCount: z.number().int().min(0).max(100_000).optional(),
    /** True when the whole list was walked (enables the removal of friends no longer listed). */
    complete: z.boolean().default(false),
    /** Walk id: every batch of one walk carries the same id. */
    walkId: z.string().regex(/^[A-Za-z0-9_-]{4,64}$/),
    /** Last batch of the walk. */
    last: z.boolean().default(false),
    items: z.array(z.unknown()).max(MAX_BATCH_SIZE),
  })
  .strict();
export type ContactDomBatch = z.output<typeof contactDomBatchSchema>;

export interface ContactDomResult {
  /** Rows stored against a contact id (from the DOM id or by name). */
  matched: number;
  /** Rows tied to a contact by name (no id on the row). */
  matchedByName: number;
  /** Rows whose name matched no single 1-1 conversation ("chưa ghép"). */
  unmatched: number;
  rejected: number;
}

/** Friend-list snapshot of one account, for the sync comparison. */
export interface ContactListStats {
  /** "Bạn bè (N)" read from Zalo Web. */
  friendCount: number | null;
  /** Friends stored in VClinks for this account. */
  stored: number;
  /** Rows of the last walk that could not be tied to a contact. */
  unmatched: number;
  /** Last complete walk of the friend list (ISO). */
  readAt: string | null;
}

export const CONTACT_SORTS = ['name', 'recent'] as const;
export type ContactSort = (typeof CONTACT_SORTS)[number];

export const contactListQuerySchema = z.object({
  uid: uidSchema,
  q: z.string().trim().max(100).optional(),
  sort: z.enum(CONTACT_SORTS).default('name'),
  /** Vai trò filter (03 MH-SZ-09 #4): a role of CLAUDE.md §5, or `none` = no role yet. */
  role: z.enum([...CONTACT_ROLES, 'none']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ContactListQuery = z.output<typeof contactListQuerySchema>;

export interface ContactListItem {
  userId: string;
  /** Name shown in Zalo's friend list (alias if set); null = not read from Zalo yet. */
  name: string | null;
  avatar: string | null;
  phone: string | null;
  labels: string[];
  isOA: boolean;
  /** Role of the contact (CLAUDE.md §5; rule / llm / manual), null = not classified yet. */
  role: ContactRole | null;
  /** Conversation id (`uid:threadId`) when a 1-1 conversation exists. */
  conversationId: string | null;
  lastMsgAt: string | null;
}

export interface ContactListResponse {
  items: ContactListItem[];
  total: number;
  stats: ContactListStats;
}

/** Lower-case, accent-free form used for the contact search (Vietnamese "không dấu"). */
export function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Vietnamese labels of the contact roles (CLAUDE.md §5), for the Danh bạ filter and profile. */
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  khach_hang: 'Khách hàng',
  dai_ly_gara: 'Đại lý / Gara',
  nha_cung_cap: 'Nhà cung cấp',
  nhan_vien: 'Nhân viên',
  quan_ly: 'Quản lý',
  doi_tac: 'Đối tác',
  ngan_hang: 'Ngân hàng',
  co_quan_nha_nuoc: 'Cơ quan nhà nước',
  gia_dinh_ban_be: 'Gia đình / Bạn bè',
  oa_doanh_nghiep: 'OA doanh nghiệp',
  khac: 'Khác',
};
/** Danh bạ tab "Nhóm": groups and communities of one account, from stored conversations. */
export const contactGroupsQuerySchema = z.object({
  uid: uidSchema,
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ContactGroupsQuery = z.output<typeof contactGroupsQuerySchema>;

export interface ContactGroupItem {
  threadId: string;
  name: string | null;
  /** Members known from the IndexedDB `group` store; null when not synced yet. */
  memberCount: number | null;
  /** Conversation id (`uid:threadId`). */
  conversationId: string;
  lastMsgAt: string | null;
}

export interface ContactGroupsResponse {
  items: ContactGroupItem[];
  total: number;
}
