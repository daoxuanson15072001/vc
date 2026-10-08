import { z } from 'zod';
import { MAX_BATCH_SIZE } from './schemas';

/**
 * Friend requests of a personal Zalo nick (03 MH-SZ-10, QT-SZ-12, rule SZ-09):
 * the "Lời mời đã nhận" and "Lời mời đã gửi" lists of Zalo Web's Danh bạ →
 * "Lời mời kết bạn" page, read from the DOM by the extension. Only these fields
 * are accepted (strict): no tokens, no free-form payload.
 */

export const FRIEND_REQUEST_DIRECTIONS = ['received', 'sent'] as const;
export type FriendRequestDirection = (typeof FRIEND_REQUEST_DIRECTIONS)[number];

/**
 * `pending`: still listed in Zalo; `accepted` / `rejected`: handled from
 * VClinks; `gone`: no longer listed (handled on the phone, withdrawn, or the
 * other side accepted).
 */
export const FRIEND_REQUEST_STATUSES = ['pending', 'accepted', 'rejected', 'gone'] as const;
export type FriendRequestStatus = (typeof FRIEND_REQUEST_STATUSES)[number];

export const FRIEND_REQUEST_STATUS_LABELS: Record<FriendRequestStatus, string> = {
  pending: 'Đang chờ',
  accepted: 'Đã chấp nhận',
  rejected: 'Đã từ chối',
  gone: 'Không còn trên Zalo',
};

const zid = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d{1,40}$/));

/** One row of the request list. */
export const friendRequestDomItemSchema = z
  .object({
    /** Zalo user id; the row is dropped when it cannot be tied to one. */
    userId: zid,
    name: z.string().trim().min(1).max(200),
    avatar: z.preprocess(
      (v) => (typeof v === 'string' && v.length <= 2000 && /^https:\/\/[^\s]+$/i.test(v) ? v : undefined),
      z.string().url().max(2000).optional(),
    ),
    /** The requester's greeting (received only). */
    message: z.string().trim().max(500).optional(),
    /** "Từ số điện thoại", "Từ nhóm trò chuyện"… as shown by Zalo. */
    source: z.string().trim().max(100).optional(),
    /** Date text of the row ("03/08"), as shown by Zalo. */
    dateText: z.string().trim().max(40).optional(),
    business: z.boolean().optional(),
  })
  .strict();
export type FriendRequestDomItem = z.output<typeof friendRequestDomItemSchema>;

/** POST /api/contacts/:uid/friend-requests/dom: one list (received or sent) of one read. */
export const friendRequestDomBatchSchema = z
  .object({
    direction: z.enum(FRIEND_REQUEST_DIRECTIONS),
    /** Count in the list header "Lời mời đã nhận (N)". */
    count: z.number().int().min(0).max(100_000).optional(),
    /** The whole list was read (enables marking unseen rows as gone). */
    complete: z.boolean().default(false),
    items: z.array(z.unknown()).max(MAX_BATCH_SIZE),
  })
  .strict();
export type FriendRequestDomBatch = z.output<typeof friendRequestDomBatchSchema>;

export interface FriendRequestDomResult {
  stored: number;
  rejected: number;
}

export const friendRequestListQuerySchema = z.object({
  uid: z.string().trim().min(1).max(128),
  direction: z.enum(FRIEND_REQUEST_DIRECTIONS).default('received'),
  /** Absent = only `pending`. */
  status: z.enum(FRIEND_REQUEST_STATUSES).optional(),
});
export type FriendRequestListQuery = z.output<typeof friendRequestListQuerySchema>;

export interface FriendRequestItem {
  userId: string;
  name: string;
  avatar: string | null;
  message: string | null;
  source: string | null;
  dateText: string | null;
  status: FriendRequestStatus;
  /** First time VClinks saw the request (ISO). */
  firstSeenAt: string;
  /** Last read of the Zalo list that still showed it (ISO). */
  seenAt: string;
  /** An outbox command (accept / reject) is waiting or running for this request. */
  commandStatus: string | null;
}

/** SZ-09 quota of new requests for one nick today. */
export interface FriendRequestQuota {
  limit: number;
  /** Requests created today and not failed / cancelled / expired. */
  usedToday: number;
  remaining: number;
  /** ISO time the next request may be handed to Zalo (null = now). */
  nextAllowedAt: string | null;
}

export interface FriendRequestListResponse {
  items: FriendRequestItem[];
  /** Pending requests of the direction (the badge). */
  pending: number;
  /** Count shown in Zalo's list header at the last read, when known. */
  zaloCount: number | null;
  readAt: string | null;
  quota: FriendRequestQuota;
}

/** Vietnamese mobile number to the national 0xxxxxxxxx form; null when it is not one. */
export function normalizeVnPhone(raw: string): string | null {
  const digits = raw.replace(/[\s.()-]/g, '');
  const m = /^(?:\+?84|0)(\d{8,10})$/.exec(digits);
  return m ? `0${m[1]}` : null;
}

/**
 * Allowlist of people a nick may send / answer friend requests to (M1a-04,
 * after the incident of 04/10/2026). Entries are Zalo user ids, Vietnamese
 * phone numbers (any common spelling) or `*` (owner lifted the restriction).
 * Missing or empty list = nobody: friend commands are blocked by default.
 */
export function friendTargetAllowed(targets: readonly string[] | undefined | null, who: { userId?: string; phone?: string }): boolean {
  if (!targets?.length) return false;
  if (targets.includes('*')) return true;
  const phone = who.phone ? normalizeVnPhone(who.phone) : null;
  return targets.some((t) => {
    const e = t.trim();
    if (!e) return false;
    if (who.userId && e === who.userId) return true;
    const ep = normalizeVnPhone(e);
    return !!phone && !!ep && ep === phone;
  });
}

/** "a, b,c" to a clean list (comma or space separated). */
export function parseFriendTargets(raw: string | undefined | null): string[] {
  return (raw ?? '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
}

export const FRIEND_TARGET_BLOCKED = 'Lệnh kết bạn chỉ chạy với người trong danh sách cho phép (giai đoạn thử). Người này chưa có trong danh sách.';
