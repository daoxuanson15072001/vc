import { BadGatewayException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ERR_QUOTE_NO_FILE,
  ERR_QUOTE_NO_LINK,
  NO_ACCESS_TEXT,
  OUTBOX_LIMITS,
  QUOTE_MAX_IMAGES,
  quoteBlock,
  vnDay,
  type CustomerDetail,
  type OutboxQuote,
  type QuoteDebtBanner,
  type QuoteHidden,
  type QuoteListResponse,
  type QuoteSendInput,
  type QuoteSendResult,
} from '@vclinks/shared';
import { VcsaleExportError, VcsaleUnavailableError, type VcsaleClient } from '@vclinks/vcsale-client';
import { AccountsService } from '../accounts/accounts.service';
import { AuthzService } from '../authz/authz.service';
import { decide, type Subject, type Target } from '../authz/engine';
import { CUST_C, type CustomerAccountDoc } from '../customers/customers.types';
import { CustomerPrivacyService } from '../customers/customer-privacy';
import { CustomersService, VCSALE_CLIENT } from '../customers/customers.service';
import { C, DbService } from '../db/db.service';
import { MediaService } from '../media/media.service';
import { OutboxService, type Approver } from '../outbox/outbox.service';
import { ERR_VCSALE_DOWN, QUOTE_GATE, QuoteGate, toSalesQuote } from './quote-gate';
import type { QuoteSendDoc } from './quote-sends';
import type { OutboxItem, OutboxSendSource } from '@vclinks/shared';

interface Resolved {
  customerCode: string | null;
  hidden: QuoteHidden | null;
  /** Customer profile of a 1-1 chat (absent for a thread mapped by QUOTE_THREAD_CUSTOMERS). */
  detail?: CustomerDetail;
  /** Engine target of the chat, for the checks that follow. */
  target: Target;
}

/**
 * Threads that are not 1-1 chats (groups) have no customer profile yet ("nhóm gắn khách" is a later
 * feature, 03 TD-G01). Until then an operator may map a thread to a VCsales code by hand:
 * `QUOTE_THREAD_CUSTOMERS='{"<uid>:<threadId>":"KH-TEST-0101"}'` (used for the test group "Kiểm thử vclink").
 * Only the code is mapped; every permission check stays the same.
 */
function mappedCode(uid: string, threadId: string): string | null {
  // ⛔ Test-phase setting only: ignored in production (a group is tied to a customer by the later feature).
  if (process.env.NODE_ENV === 'production') return null;
  const raw = process.env.QUOTE_THREAD_CUSTOMERS;
  if (!raw) return null;
  try {
    const v = (JSON.parse(raw) as Record<string, unknown>)[`${uid}:${threadId}`];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Send a quote from the chat (M1c-02, 03 MH-SZ-05i / QT-SZ-03, BA F9.5-F9.7, BR16, BR17).
 * VCsales is only READ here (BR12): the quote list, the quote itself and its PDF / page images. The
 * send box's click is the approval (CLAUDE.md §12.1): the command goes through the same outbox as every
 * other message, with approvedBy / approvedAt of the person who pressed it, and the nick safety, send
 * pace and test allowlist rules of `OutboxService.create` all apply. Quotes that are expired, not
 * approved, cancelled or of another customer are refused here, not only greyed out in the Dashboard.
 * Logs and audit hold the quote number and ids, never the message text.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly customers: CustomersService,
    private readonly privacy: CustomerPrivacyService,
    private readonly authz: AuthzService,
    private readonly db: DbService,
    private readonly media: MediaService,
    private readonly outbox: OutboxService,
    private readonly accounts: AccountsService,
    @Inject(QUOTE_GATE) private readonly gate: QuoteGate,
    @Inject(VCSALE_CLIENT) private readonly vcsale: VcsaleClient,
  ) {}

  /**
   * Engine target of the chat. A thread mapped to a customer code (a group) has no profile of its own, so its
   * "khách của tôi" scope (CT) comes from the owners of the customer that code belongs to; no rule is widened.
   */
  private async targetOf(uid: string, threadId: string, mapped: string | null): Promise<Target> {
    const t = await this.authz.conversationTarget(uid, threadId);
    if (!mapped || t.responsibleIds?.length) return t;
    const acc = await this.db
      .col<CustomerAccountDoc>(CUST_C.accounts)
      .findOne({ status: 'active', erpLinks: { $elemMatch: { erp: 'vcsales', customerId: mapped, status: 'confirmed' } } } as never, { projection: { owners: 1 } });
    const ids = [...new Set((acc?.owners ?? []).map((o) => o.userId))];
    if (!ids.length) return t;
    const units = [...new Set((await Promise.all(ids.map((i) => this.authz.unitsOf(i)))).flat())];
    return { ...t, responsibleIds: ids, unitIds: [...new Set([...(t.unitIds ?? []), ...units])] };
  }

  private async resolve(uid: string, threadId: string, u: Subject | undefined): Promise<Resolved> {
    const mapped = mappedCode(uid, threadId);
    const target = await this.targetOf(uid, threadId, mapped);
    if (u && !decide(u, 'conv.view', target).allowed) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    const may = !u || decide(u, 'quote.view', target).allowed;
    if (mapped) return { customerCode: may ? mapped : null, hidden: may ? null : 'no_right', target };
    let detail: CustomerDetail;
    try {
      detail = await this.customers.byIdentity(uid, threadId, u);
    } catch (e) {
      if (e instanceof NotFoundException && /chưa có hồ sơ/.test(e.message)) return { customerCode: null, hidden: 'no_link', target };
      throw e;
    }
    const mine = detail.contacts.flatMap((c) => c.identities).find((i) => i.uid === uid && i.userId === threadId);
    const link = detail.erpLinks.find((l) => l.erp === 'vcsales' && l.status === 'confirmed');
    if (!may) return { customerCode: null, hidden: 'no_right', detail, target };
    if (mine?.state === 'unconfirmed') return { customerCode: null, hidden: 'unconfirmed', detail, target };
    if (!link) return { customerCode: null, hidden: 'no_link', detail, target };
    return { customerCode: link.customerId, hidden: null, detail, target };
  }

  private async debtBanner(code: string, r: Resolved, u: Subject | undefined): Promise<QuoteDebtBanner | null> {
    const allowed = r.detail ? await this.privacy.allowed(u, 'cust.debt', r.detail) : !u || decide(u, 'cust.debt', r.target).allowed;
    if (!allowed) return null;
    try {
      const c = await this.vcsale.getCommerce(code);
      if (!c?.debt?.dueAt) return null;
      const today = vnDay(new Date());
      const due = vnDay(c.debt.dueAt);
      if (due >= today) return null;
      const days = Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);
      return { amount: c.debt.amount, overdueDays: days, fetchedAt: new Date().toISOString(), note: null };
    } catch (e) {
      if (e instanceof VcsaleUnavailableError) return null;
      throw e;
    }
  }

  /** Quotes of the customer of this chat, read live from VCsales (no cache, BR16). */
  async list(uid: string, threadId: string, u: Subject | undefined): Promise<QuoteListResponse> {
    const now = new Date();
    const r = await this.resolve(uid, threadId, u);
    const forms: QuoteListResponse['forms'] = this.vcsale.mode === 'http' ? ['pdf'] : ['pdf', 'image'];
    const empty: QuoteListResponse = { items: [], customerCode: r.customerCode, hidden: r.hidden, error: null, debt: null, createUrl: null, fetchedAt: now.toISOString(), forms };
    if (!r.customerCode) return empty;
    const code = r.customerCode;
    const createUrl = !u || decide(u, 'quote.open_erp', r.target).allowed ? this.vcsale.getQuoteCreateUrl(code) : null;
    let quotes;
    try {
      quotes = await this.vcsale.listQuotes(code);
    } catch (e) {
      if (!(e instanceof VcsaleUnavailableError)) throw e;
      return { ...empty, error: ERR_VCSALE_DOWN, createUrl };
    }
    const sent = await this.db
      .col<QuoteSendDoc>(C.quoteSends)
      .aggregate<{ _id: string; n: number }>([{ $match: { customerCode: code, no: { $in: quotes.map((q) => q.no) } } }, { $group: { _id: '$no', n: { $sum: 1 } } }])
      .toArray();
    const counts = new Map(sent.map((x) => [x._id, x.n]));
    return {
      ...empty,
      items: quotes.map((q) => ({ ...toSalesQuote(q), sendCount: counts.get(q.no) ?? 0, block: quoteBlock(q, code, now) })),
      debt: await this.debtBanner(code, r, u),
      createUrl,
    };
  }

  /** "Gửi báo giá": re-check everything on VCsales, then queue the approved `send_quote` command. */
  async send(
    input: QuoteSendInput,
    approver: Approver,
    u: Subject | undefined,
    onBehalf?: { source: OutboxSendSource; holderId: string | null; holderName: string | null },
  ): Promise<{ result: QuoteSendResult; item: OutboxItem }> {
    const { uid, threadId } = input;
    await this.accounts.assertExists(uid);
    // Nick state and the test allowlist are refused before any file is made (same rules as POST /outbox).
    await this.accounts.assertCanSend(uid, threadId);
    const r = await this.resolve(uid, threadId, u);
    if (u && !decide(u, 'quote.send', r.target).allowed) throw new ForbiddenException(NO_ACCESS_TEXT.noPermission('quote.send'));
    if (r.hidden === 'no_link') throw new ConflictException(ERR_QUOTE_NO_LINK);
    if (r.hidden || !r.customerCode) throw new ForbiddenException(NO_ACCESS_TEXT.api);
    const code = r.customerCode;
    // BR16: the quote is read again right now; expired / unapproved / cancelled / other customer / edited since the person looked.
    const fresh = await this.gate.assertSendable(input.no, code, input.version);
    let files;
    try {
      files = await this.vcsale.getQuoteFiles(fresh.no, input.form);
    } catch (e) {
      if (e instanceof VcsaleUnavailableError) throw new BadGatewayException(ERR_VCSALE_DOWN);
      if (e instanceof VcsaleExportError) throw new BadGatewayException(ERR_QUOTE_NO_FILE);
      throw e;
    }
    if (!files.length || files.length > (input.form === 'pdf' ? 1 : QUOTE_MAX_IMAGES) || files.some((f) => !f.bytes.length || f.bytes.length > OUTBOX_LIMITS.attachmentBytes)) {
      throw new BadGatewayException(ERR_QUOTE_NO_FILE);
    }
    const stored = [];
    for (const f of files) stored.push(await this.media.saveOutboxFile({ fileName: f.name, mime: f.mime, bytes: f.bytes }));
    const quote: OutboxQuote = {
      no: fresh.no,
      form: input.form,
      message: input.message,
      total: fresh.total,
      customerCode: code,
      version: fresh.version,
      ...(input.followUpDays ? { followUpDays: input.followUpDays } : {}),
    };
    const item = await this.outbox.create({ uid, threadId, action: 'send_quote', attachments: stored.map((a) => a.id), quote }, approver, onBehalf, { quote: true });
    await this.db.audit(approver.id, 'quote.send', `${uid}:${threadId}`, { no: fresh.no, form: input.form, outboxId: item.id });
    return { result: { sendId: item.id, outboxId: item.id, no: fresh.no }, item };
  }
}
