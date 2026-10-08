import type { QuoteForm } from '@vclinks/shared';
import { C, DbService } from '../db/db.service';

/**
 * `quote_sends` (M1c-02, F9.7): one row per quote that really reached the customer, written when the
 * extension reports the `send_quote` command as sent. `_id` is the outbox id, so a repeated report never
 * makes a second row. Holds ids, the quote number and the total, never the message text.
 */
export interface QuoteSendDoc {
  _id: string;
  uid: string;
  threadId: string;
  customerCode: string;
  no: string;
  version: string | null;
  total: number;
  form: QuoteForm;
  /** The person who pressed "Gửi báo giá" (the approver of the command). */
  sentBy: string;
  sentByName: string | null;
  approvedAt: Date;
  sentAt: Date;
  cliMsgIds: string[];
  /** F9.8: remind the sender to follow up after this many days (the reminder list itself is a later session). */
  followUpDays: number | null;
  followUpAt: Date | null;
}

export async function recordQuoteSent(
  db: DbService,
  d: {
    _id: { toHexString(): string };
    uid: string;
    threadId: string;
    quote?: { no: string; form: QuoteForm; total: number; customerCode: string; version?: string; followUpDays?: number | null };
    approvedBy?: string;
    approvedByName?: string;
    approvedAt?: Date;
    sentAt?: Date;
    cliMsgId?: string;
    cliMsgIds?: string[];
  },
): Promise<void> {
  if (!d.quote || !d.approvedBy || !d.approvedAt) return;
  const sentAt = d.sentAt ?? new Date();
  const days = d.quote.followUpDays ?? null;
  const doc: QuoteSendDoc = {
    _id: d._id.toHexString(),
    uid: d.uid,
    threadId: d.threadId,
    customerCode: d.quote.customerCode,
    no: d.quote.no,
    version: d.quote.version ?? null,
    total: d.quote.total,
    form: d.quote.form,
    sentBy: d.approvedBy,
    sentByName: d.approvedByName ?? null,
    approvedAt: d.approvedAt,
    sentAt,
    cliMsgIds: d.cliMsgIds?.length ? d.cliMsgIds : d.cliMsgId ? [d.cliMsgId] : [],
    followUpDays: days,
    followUpAt: days ? new Date(sentAt.getTime() + days * 86_400_000) : null,
  };
  await db.col<QuoteSendDoc>(C.quoteSends).updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
}
