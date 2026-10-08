import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { runUnscoped } from '../db/tenant-context';
import { CUST_C, type CustomerAccountDoc, type IdentityLinkDoc } from './customers.types';

/**
 * Read-only links between channel identities and customers (M1b-12), for the ports of other sessions:
 * - SUBJECT_RESOLVER (M1b-14, per-identity keys): identityIdsOfAccount / accountOfIdentity;
 * - CUSTOMER_OWNERSHIP (M1b-09, "khách của tôi" in the inbox): conversationIdsOf.
 * Core provider (also in the connector process): depends on the database only.
 */
@Injectable()
export class CustomerLinksService {
  constructor(private readonly db: DbService) {}

  /** Identity ids (`${uid}:${userId}`) linked to customer account `accountId`. */
  async identityIdsOfAccount(accountId: string): Promise<string[]> {
    const rows = await runUnscoped(() =>
      this.db.col<IdentityLinkDoc>(CUST_C.identityLinks).find({ accountId }, { projection: { _id: 1 } }).toArray(),
    );
    return rows.map((r) => r._id);
  }

  /** Customer account of an identity, if it has a profile. */
  async accountOfIdentity(identityId: string): Promise<string | null> {
    const l = await runUnscoped(() =>
      this.db.col<IdentityLinkDoc>(CUST_C.identityLinks).findOne({ _id: identityId }, { projection: { accountId: 1 } }),
    );
    return l?.accountId ?? null;
  }

  /** 1-1 conversation ids (= identity ids) of the active customers `userId` owns. */
  async conversationIdsOf(userId: string): Promise<string[]> {
    return runUnscoped(async () => {
      const accs = await this.db
        .col<CustomerAccountDoc>(CUST_C.accounts)
        .find({ 'owners.userId': userId, status: 'active' }, { projection: { _id: 1 } })
        .toArray();
      if (!accs.length) return [];
      const rows = await this.db
        .col<IdentityLinkDoc>(CUST_C.identityLinks)
        .find({ accountId: { $in: accs.map((a) => a._id) } }, { projection: { _id: 1 } })
        .toArray();
      return rows.map((r) => r._id);
    });
  }
}
