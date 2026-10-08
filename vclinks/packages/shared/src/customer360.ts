import type { ErpTaskKind, ErpTaskStatus } from './erp-tasks';
import { z } from 'zod';
import type { Channel } from './channels';
import type { CustomerDetail, IdentityLinkState } from './customers';

/*
 * Customer 360 (M1b-13, docs/02-yeu-cau/dac-ta/02-khach-da-kenh.md MH-DK-01, 02, 03, 09 and 00 MH-UI-09).
 * Shapes shared by the API and the Dashboard. M1 has Zalo personal only: the other channels fill the same
 * shapes later without a change here.
 */

/** Seconds a revealed phone / email stays on screen (DK-44, MH-PQ-12). */
export const CUSTOMER_REVEAL_SECONDS = 60;
/** A conversation whose last inbound message is at most this old shows the green dot (DK-43). */
export const ACTIVE_DOT_MINUTES = 30;
/** "Khách đang hoạt động" lists conversations with an inbound message in this many days (DK-43). */
export const ACTIVITY_DAYS = 7;
/** Messages of one conversation closer than this form one cluster in the timeline (DK-39). */
export const CLUSTER_MINUTES = 10;
/** ≥ 2 channels with inbound messages inside this window make the "Khách dùng n kênh" band (DK-39). */
export const MULTI_CHANNEL_WINDOW_MINUTES = 60;
/** Cross-nick hint ("Khách này cũng nhắn …") disappears after this long without an answer (UAT-DK-73). */
export const CROSS_NICK_HOURS = 24;

/** How much of the commercial block the viewer may see (01 `cust.commerce`; CS: orders only). */
export type CommerceLevel = 'full' | 'orders_only' | 'none';

export interface CommerceOrder {
  no: string;
  at: string;
  status: string;
}

/** Commercial block of one VCsales customer, a snapshot "lấy lúc" (read only, BR12). */
export interface CommerceBlock {
  erp: 'vcsales';
  code: string;
  fetchedAt: string;
  /** VCsales did not answer: the numbers are the last snapshot (shown in italics with ERR-ERP). */
  stale: boolean;
  error: string | null;
  /** Hidden for `orders_only` viewers. */
  tier: string | null;
  revenue12m: number | null;
  debt: { amount: number; dueAt: string | null; overdue: boolean } | null;
  openQuotes: { no: string; total: number; validUntil: string | null }[] | null;
  /** `orders_only` viewers only learn whether something is overdue. */
  hasOverdueDebt: boolean;
  lastOrder: CommerceOrder | null;
}

export interface CustomerActivityRow {
  /** Conversation id `${uid}:${threadId}`. */
  conversationId: string;
  uid: string;
  channel: Channel;
  /** Name given to the channel account (`accounts.label`) and its owner, shown "Zalo · Minh VCparts". */
  nickLabel: string | null;
  nickOwnerName: string | null;
  contactId: string;
  contactName: string | null;
  lastMsgAt: string | null;
  lastInboundAt: string | null;
  /** Inbound messages after the last answer; 0 = answered. */
  unanswered: number;
  unansweredSince: string | null;
  /** Person handling it (nick holder). */
  handlerName: string | null;
  /** The viewer may not read it: shown with chip, person and time, no link (DK-40, UAT-DK-18). */
  locked: boolean;
  /** Inbound within `ACTIVE_DOT_MINUTES`. */
  active: boolean;
}

export interface Customer360Viewer {
  /** DK-44: `full` for owner / nick holder, `reveal` = masked + "Hiện" (60 s, logged), `masked` = nothing. */
  phone: 'full' | 'reveal' | 'masked';
  commerce: CommerceLevel;
  /** `cust.timeline`: may open the timeline tab and see recent events. */
  timeline: boolean;
  /** The viewer is an owner of the customer (account turns orange otherwise, MH-DK-02 #2). */
  isOwner: boolean;
  canConfirmErp: boolean;
}

export interface Customer360 {
  customer: CustomerDetail;
  viewer: Customer360Viewer;
  /** Identity the panel was opened for (by-identity route); null for the full page. */
  identity: { identityId: string; uid: string; userId: string; state: IdentityLinkState; contactId: string; contactName: string | null } | null;
  /** DK-15: only a weak (V1) match: no debt, orders or private prices until confirmed. */
  unconfirmed: boolean;
  /** Channel accounts of the customer's identities (chips "Zalo · Minh VCparts"), activity or not. */
  channels: { uid: string; channel: Channel; nickLabel: string | null; nickOwnerName: string | null }[];
  activity: CustomerActivityRow[];
  /** Conversation to answer in: the freshest one with unanswered inbound messages the viewer may open. */
  recommendedConversationId: string | null;
  /** Another nick of the same customer has unanswered messages in the last 24 h (UAT-DK-73). */
  crossNick: { conversationId: string; nickLabel: string | null; nickOwnerName: string | null; unanswered: number; locked: boolean }[];
  /** Null when hidden: `none` level, unconfirmed identity, or no linked code. */
  commerce: CommerceBlock | null;
  /** Why `commerce` is null: `no_link` (shows "Liên kết mã KH"), `unconfirmed`, `no_right`. */
  commerceHidden: 'no_link' | 'unconfirmed' | 'no_right' | null;
  /** Latest events for the overview tab (5, DK-40 applied). */
  recent: TimelineEvent[];
  /** Việc VCsales of the customer still waiting (02 MH-DK-12): the panel says "Đã ở hàng chờ" instead of the button. */
  erpTasks: { id: string; kind: ErpTaskKind; status: ErpTaskStatus }[];
  /**
   * MH-DK-10 #5, SA-04: verified phones / e-mails (V2+) the customer uses that the linked VCsales code does not have;
   * `queued` when an update task for it is already waiting. Empty without a linked code.
   */
  erpDiff: { pointId: string; kind: 'phone' | 'email'; masked: string; queued: boolean }[];
  loadedAt: string;
}

export const TIMELINE_KINDS = ['message', 'profile', 'quote'] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export interface TimelineEvent {
  id: string;
  kind: TimelineKind | 'hidden';
  at: string;
  channel: Channel | null;
  uid: string | null;
  nickLabel: string | null;
  nickOwnerName: string | null;
  conversationId: string | null;
  contactId: string | null;
  contactName: string | null;
  /** Message events. */
  direction?: 'in' | 'out';
  /** Sender shown when it is not the customer (staff name, or "Gửi từ điện thoại"). */
  senderName?: string | null;
  text?: string | null;
  /** Phones / emails typed in `text` masked for this viewer (L-02) and whether "Hiện" may be offered. */
  textMasked?: number;
  textRevealable?: boolean;
  msgType?: string | null;
  recalled?: boolean;
  /** Profile events: `merge`, `auto_merge`, `undo`, `erp_link`, `import`. */
  op?: string;
  actor?: string;
  /** `hidden`: how many messages the viewer may not read (summary row, DK-40). */
  hiddenCount?: number;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  /** ISO cursor for the next (older) page; null on the last page. */
  nextBefore: string | null;
  contacts: { id: string; name: string }[];
  channels: { uid: string; channel: Channel; nickLabel: string | null }[];
}

export const timelineQuerySchema = z.object({
  contact: z.string().trim().min(1).max(160).optional(),
  uid: z.string().trim().min(1).max(160).optional(),
  type: z.enum(['message', 'profile', 'quote']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  q: z.string().trim().min(2).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type TimelineQuery = z.output<typeof timelineQuerySchema>;

export const customerRevealSchema = z
  .object({
    pointId: z.string().trim().min(1).max(80),
    action: z.enum(['view', 'copy']).default('view'),
  })
  .strict();
export type CustomerRevealInput = z.output<typeof customerRevealSchema>;

export interface CustomerRevealResult {
  value: string;
  warning?: string;
}
