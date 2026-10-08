import { Inject, Injectable, Optional } from '@nestjs/common';
import { vnDay } from '@vclinks/shared';
import { VcsaleUnavailableError, type VcsaleClient } from '@vclinks/vcsale-client';
import type { Subject } from '../authz/engine';
import { CustomerPrivacyService } from '../customers/customer-privacy';
import { VCSALE_CLIENT } from '../customers/customers.service';
import { CUST_C, type CustomerAccountDoc, type IdentityLinkDoc } from '../customers/customers.types';
import { C, DbService } from '../db/db.service';
import { VcsalesStatusService } from '../vcsales/vcsales-status.service';

/** Debt is cached 15 minutes (BA §6 "công nợ 15 phút"). */
const TTL_MS = () => Number(process.env.DEBT_FLAG_TTL_MS ?? 15 * 60_000);
const MAX_ACCOUNTS = 1000;
const PARALLEL = 8;

export interface DebtFlags {
  /** Conversation ids (`${uid}:${threadId}`) of customers who owe overdue debt, visible to the caller. */
  ids: string[];
  /** ISO time VCsales was last read for this answer. */
  fetchedAt: string;
}

/**
 * "Nợ quá hạn" chip and filter of the conversation list (03 MH-SZ-01 #8a, #9o; UAT-SZ-86). Only the flag leaves
 * here: no amount, no days. The caller sees a customer's flag only with `cust.debt` on that customer (the same
 * check as the debt line of the panel), and only customers with a confirmed VCsales code are looked at.
 * VCsales is read in batches (`getDebtSummaries`, 100 codes a call) and the answer per code is kept 15 minutes,
 * so opening the list does not call VCsales once per row. A VCsales outage gives the last known flags (or none),
 * never an error; while VCsales is known down (last connection check) it is not called at all.
 */
@Injectable()
export class DebtFlagsService {
  private readonly cache = new Map<string, { at: number; overdue: boolean }>();

  constructor(
    private readonly db: DbService,
    private readonly privacy: CustomerPrivacyService,
    @Inject(VCSALE_CLIENT) private readonly vcsale: VcsaleClient,
    @Optional() private readonly status?: VcsalesStatusService,
  ) {}

  /** Overdue flag per code: cached answers, then one batch read of VCsales for the others. */
  private async overdueCodes(codes: string[], now: number): Promise<Map<string, boolean>> {
    const out = new Map<string, boolean>();
    const stale: string[] = [];
    for (const code of codes) {
      const hit = this.cache.get(code);
      if (hit && now - hit.at < TTL_MS()) out.set(code, hit.overdue);
      else stale.push(code);
    }
    if (!stale.length) return out;
    const lastKnown = () => {
      for (const code of stale) {
        const hit = this.cache.get(code);
        if (hit) out.set(code, hit.overdue);
      }
      return out;
    };
    if (this.status?.down()) return lastKnown();
    try {
      const today = vnDay(new Date(now));
      for (const r of await this.vcsale.getDebtSummaries(stale)) {
        const overdue = !r.notFound && (r.overdue > 0 || (!!r.dueAt && vnDay(r.dueAt) < today));
        this.cache.set(r.code, { at: now, overdue });
        out.set(r.code, overdue);
      }
    } catch (e) {
      if (!(e instanceof VcsaleUnavailableError)) throw e;
      return lastKnown();
    }
    return out;
  }

  async flags(u: Subject | undefined): Promise<DebtFlags> {
    const now = Date.now();
    const accounts = await this.db
      .col<CustomerAccountDoc>(CUST_C.accounts)
      .find({ status: 'active', erpLinks: { $elemMatch: { erp: 'vcsales', status: 'confirmed' } } } as never, { projection: { owners: 1, erpLinks: 1 } })
      .limit(MAX_ACCOUNTS)
      .toArray();
    const links = await this.db
      .col<IdentityLinkDoc>(CUST_C.identityLinks)
      .find({ accountId: { $in: accounts.map((a) => a._id) }, state: { $ne: 'unconfirmed' } } as never, { projection: { uid: 1, userId: 1, accountId: 1, contactId: 1 } })
      .toArray();
    const byAccount = new Map<string, IdentityLinkDoc[]>();
    for (const l of links) byAccount.set(l.accountId, [...(byAccount.get(l.accountId) ?? []), l]);
    const todo = accounts.filter((a) => byAccount.has(a._id));
    const seen: { code: string; ids: string[] }[] = [];
    for (let i = 0; i < todo.length; i += PARALLEL) {
      await Promise.all(
        todo.slice(i, i + PARALLEL).map(async (a) => {
          const mine = byAccount.get(a._id)!;
          // cust.debt on this customer first (cheap, local), VCsales only for those the caller may see.
          const shape = { owners: a.owners, contacts: [{ identities: mine.map((l) => ({ uid: l.uid, userId: l.userId })) }] } as never;
          if (!(await this.privacy.allowed(u, 'cust.debt', shape))) return;
          const code = a.erpLinks.find((l) => l.erp === 'vcsales' && l.status === 'confirmed')!.customerId;
          seen.push({ code, ids: mine.map((l) => `${l.uid}:${l.userId}`) });
        }),
      );
    }
    const overdue = await this.overdueCodes([...new Set(seen.map((x) => x.code))], now);
    const ids = seen.filter((x) => overdue.get(x.code)).flatMap((x) => x.ids);
    // Identity links are not nick-scoped: keep only conversations of the caller's data scope (request scope of db.col).
    const visible = ids.length
      ? (await this.db.col<{ _id: string }>(C.conversations).find({ _id: { $in: ids } } as never, { projection: { _id: 1 } }).toArray()).map((d) => d._id)
      : [];
    return { ids: visible, fetchedAt: new Date(now).toISOString() };
  }
}
