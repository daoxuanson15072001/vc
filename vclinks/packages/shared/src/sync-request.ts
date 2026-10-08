import { z } from 'zod';
import { uidSchema } from './schemas';

/**
 * "Đồng bộ ngay" on /sync (M1a-06, carried over from M1a-02/M1a-05): the
 * Dashboard asks the extension of one nick to run an IndexedDB sync now, the
 * same run as the popup button. One open request per nick (asking again while
 * one waits only refreshes it); the extension picks it up with its next fetch
 * heartbeat (about every 20 seconds). It only reads Zalo Web: nothing is sent,
 * no conversation is opened (BA §11.7 ZR4), so it needs no outbox approval.
 */
export const SYNC_REQUEST_STATUSES = ['pending', 'claimed'] as const;
export type SyncRequestStatus = (typeof SYNC_REQUEST_STATUSES)[number];

/** A request not picked up within this long is no longer handed out (the nick is shown red anyway). */
export const SYNC_REQUEST_TTL_MS = 10 * 60_000;

export const syncRequestCreateSchema = z
  .object({
    uid: uidSchema,
    /** true = re-read every record ("Đồng bộ lại toàn bộ"); default false. */
    full: z.boolean().optional(),
  })
  .strict();
export type SyncRequestCreate = z.infer<typeof syncRequestCreateSchema>;

export const syncRequestClaimSchema = z.object({ uid: uidSchema }).strict();

export interface SyncRequestView {
  uid: string;
  status: SyncRequestStatus;
  full: boolean;
  /** ISO timestamps. */
  requestedAt: string;
  requestedBy: string;
  claimedAt?: string;
}
