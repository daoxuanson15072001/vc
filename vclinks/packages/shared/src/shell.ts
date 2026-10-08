import { z } from 'zod';

/** App shell contracts (M1b-08): presence status (00 MH-UI-05), global quick search (MH-UI-04), notifications (MH-UI-03). */

/** The 4 values of the user status table (MH-UI-05). */
export const PRESENCE_STATUSES = ['online', 'field', 'away', 'offline'] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online: 'Trực tuyến',
  field: 'Đi thị trường',
  away: 'Vắng',
  offline: 'Ngoại tuyến',
};

/** `field` and `away` set by hand carry an end time (MH-UI-01 #9). */
export const presenceInputSchema = z
  .object({
    status: z.enum(PRESENCE_STATUSES),
    until: z.string().datetime().optional(),
  })
  .strict();
export type PresenceInput = z.infer<typeof presenceInputSchema>;

export interface MeProfile {
  userId: string | null;
  name: string;
  email: string | null;
  status: PresenceStatus;
  until: string | null;
  /** customRoleName: custom role of the assignment (MH-PQ-05), shown instead of the system label. */
  roles: { roleKey: string; customRoleId?: string; customRoleName?: string; orgUnitName: string }[];
  /**
   * "Nghỉ phép" flag (SZ-27, 00 MH-UI-05 #9): an active or coming cover where this user is the absent
   * person. Null when none.
   */
  leave?: { from: string; to: string; coverName: string; active: boolean } | null;
}

export const quickSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface QuickSearchItem {
  /** `customer` = a customer account (M1b-13): opens Customer 360; `contact` = a channel identity. */
  kind: 'contact' | 'customer';
  /** Customer account id for `customer` items. */
  accountId?: string;
  /** Conversation id (`uid:threadId`) when the contact has one, else null. */
  conversationId: string | null;
  uid: string;
  userId: string;
  name: string;
  /** Always masked (MH-PQ-12); reveal goes through POST /api/reveal. */
  phone: string | null;
  /** Customer code once the customer model exists (M1b-12); null until then. */
  customerCode: string | null;
}
export interface QuickSearchResponse {
  items: QuickSearchItem[];
  tookMs: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  at: string;
  read: boolean;
  link?: string;
}
export interface NotificationList {
  items: NotificationItem[];
  unread: number;
}
