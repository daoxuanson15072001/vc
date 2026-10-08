import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ERP_CODE_TAKEN_TEXT,
  foldVi,
  maskPhone,
  MERGE_UNDO_DAYS,
  NO_ACCESS_TEXT,
  verifyRank,
  type ContactPointView,
  type ErpSearchRow,
  type CustomerContactView,
  type CustomerDetail,
  type CustomerImportInput,
  type CustomerImportResult,
  type CustomerListQuery,
  type CustomerListResponse,
  type CustomerOwnerView,
  type CustomerSummary,
  type CustomerSweepResult,
  type ErpLinkConfirmInput,
  type ErpMatchingResponse,
  type ErpMatchingRow,
  type IdentityView,
  type MergeOperationView,
  type MergeSignalView,
  type MergeSuggestionView,
  type QuickSearchItem,
} from '@vclinks/shared';
import { VcsaleUnavailableError, type VcsaleClient, type VcsaleCustomer } from '@vclinks/vcsale-client';
import { randomUUID } from 'node:crypto';
import type { AnyBulkWriteOperation, Document, Filter } from 'mongodb';
import { AUTHZ_C, type ChannelAccessDoc } from '../authz/authz.types';
import { AuthzService } from '../authz/authz.service';
import type { Subject } from '../authz/engine';
import { toIso } from '../common/zod';
import { C, DbService } from '../db/db.service';
import { currentTenant, runAsTenant, runUnscoped } from '../db/tenant-context';
import type { UserDoc } from '../users/users.service';
import { CustomerLinksService } from './customer-links.service';
import { CustomerPrivacyService } from './customer-privacy';
import {
  CUST_C,
  stableHash,
  type ContactPointDoc,
  type CustomerAccountDoc,
  type CustomerContactDoc,
  type ErpCustomerDoc,
  type ErpTaskDoc,
  type IdentityLinkDoc,
  type MergeOperationDoc,
  type MergeSnapshot,
  type MergeSuggestionDoc,
} from './customers.types';
import { evaluatePair, nameSimilarity, type MergeEvaluation, type MergeSide } from './merge-rules';
import { buildIdentityProfile, erpPoints, erpProfileIdsOf, identityName, pointIdOf, type IdentitySource } from './profile-builder';

/** DI token of the VCsales client (mock until E5, packages/vcsale-client). */
export const VCSALE_CLIENT = Symbol('VCSALE_CLIENT');

/** One catalogue run (plan C11): `updatedSince` reads only what changed after it; `dryRun` writes nothing. */
export interface CatalogRunOptions {
  updatedSince?: Date | null;
  dryRun?: boolean;
  kind?: 'full' | 'incremental';
  onProgress?: (fetched: number) => void | Promise<void>;
}

export interface CatalogRunResult extends CustomerImportResult {
  /** Customers deleted on VCsales seen in this run (no profile is made for them). */
  deleted: number;
  /** New codes matching the phone or tax code of a waiting "Chờ tạo mã KH" form: kept for "Gắn mã này", no profile. */
  held: number;
  /** Highest VCsales `updatedAt` read (the next incremental run starts there). */
  maxUpdatedAt: string | null;
}

const BATCH = 500;
/** A phone shared by more contacts than this is not a person signal (call centre, market switchboard). */
const MAX_GROUP = 10;
const DAY = 86_400_000;
const defaultDivision = () => process.env.AUTHZ_DEFAULT_DIVISION?.trim() || null;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pairId = (x: string, y: string) => `ms_${stableHash([x, y].sort().join('|'))}`;
/** Roles that confirm ERP links (DK-16: sale admin; D8-17: GĐ division reads only). */
const ERP_CONFIRM_ROLES = new Set(['sale_admin', 'admin']);

type Vis = Filter<CustomerAccountDoc>;

/**
 * Customer model service (M1b-12): profiles of channel identities, VCsales catalogue import with first
 * owners (D8-06), automatic merge only under D8-05 with one-touch undo, merge suggestions, ERP link
 * confirmation (MH-DK-10) and the matching list (MH-DK-13).
 *
 * Also the provider of the customer ports of other sessions: identityIdsOfAccount / accountOfIdentity
 * (M1b-14 SUBJECT_RESOLVER) and conversationIdsOf (M1b-09 CUSTOMER_OWNERSHIP).
 *
 * Never writes to VCsales (BR12). Events and audit hold ids and counts only, never phones or content.
 */
@Injectable()
export class CustomersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CustomersService.name);
  private indexed?: Promise<unknown>;
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    private readonly linksSvc: CustomerLinksService,
    private readonly privacy: CustomerPrivacyService,
    @Inject(VCSALE_CLIENT) private readonly vcsale: VcsaleClient,
  ) {}

  onModuleInit() {
    // Background sweep: profiles for new identities and D8-05 merges within minutes. 0 disables (tests).
    const ms = Number(process.env.CUSTOMERS_SWEEP_MS ?? 300_000);
    if (ms > 0) {
      this.timer = setInterval(() => void this.sweepAllTenants(), ms);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweepAllTenants() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const t of await this.db.tenants()) await runAsTenant(t, () => this.sweep());
    } catch (e) {
      this.logger.warn(`customer sweep: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.sweeping = false;
    }
  }

  private col<T extends Document>(name: string) {
    return this.db.col<T>(name);
  }
  private get accounts() {
    return this.col<CustomerAccountDoc>(CUST_C.accounts);
  }
  private get contacts() {
    return this.col<CustomerContactDoc>(CUST_C.contacts);
  }
  private get points() {
    return this.col<ContactPointDoc>(CUST_C.points);
  }
  private get links() {
    return this.col<IdentityLinkDoc>(CUST_C.identityLinks);
  }
  private get erp() {
    return this.col<ErpCustomerDoc>(CUST_C.erpCustomers);
  }
  private get suggestions() {
    return this.col<MergeSuggestionDoc>(CUST_C.suggestions);
  }
  private get operations() {
    return this.col<MergeOperationDoc>(CUST_C.operations);
  }

  ensureIndexes() {
    const d = this.db.db;
    this.indexed ??= Promise.all([
      d.collection(CUST_C.accounts).createIndexes([
        { key: { tenant_id: 1, 'erpLinks.erp': 1, 'erpLinks.customerId': 1 } },
        { key: { tenant_id: 1, 'owners.userId': 1 } },
        { key: { tenant_id: 1, 'owners.division': 1 } },
        { key: { tenant_id: 1, status: 1, updatedAt: -1 } },
      ]),
      d.collection(CUST_C.contacts).createIndexes([{ key: { tenant_id: 1, accountId: 1 } }]),
      d.collection(CUST_C.points).createIndexes([
        { key: { tenant_id: 1, kind: 1, value: 1 } },
        { key: { tenant_id: 1, contactId: 1 } },
        { key: { tenant_id: 1, accountId: 1 } },
      ]),
      d.collection(CUST_C.identityLinks).createIndexes([
        { key: { tenant_id: 1, accountId: 1 } },
        { key: { tenant_id: 1, contactId: 1 } },
        { key: { tenant_id: 1, uid: 1 } },
      ]),
      d.collection(CUST_C.suggestions).createIndexes([{ key: { tenant_id: 1, status: 1, score: -1 } }]),
      d.collection(CUST_C.operations).createIndexes([{ key: { tenant_id: 1, at: -1 } }]),
    ]).catch((e: unknown) => {
      this.indexed = undefined;
      this.logger.warn(`customer indexes: ${e instanceof Error ? e.message : String(e)}`);
    });
    return this.indexed;
  }

  // -------------------------------------------------------------------------
  // Ports for M1b-14 (SUBJECT_RESOLVER) and M1b-09 (CUSTOMER_OWNERSHIP): see CustomerLinksService

  identityIdsOfAccount(accountId: string) {
    return this.linksSvc.identityIdsOfAccount(accountId);
  }
  accountOfIdentity(identityId: string) {
    return this.linksSvc.accountOfIdentity(identityId);
  }
  conversationIdsOf(userId: string) {
    return this.linksSvc.conversationIdsOf(userId);
  }

  // -------------------------------------------------------------------------
  // Sweep: profiles for identities without one, then matching

  /** Creates missing profiles and runs the merge rules over shared phones / emails. Idempotent. */
  async sweep(): Promise<CustomerSweepResult> {
    return runUnscoped(async () => {
      await this.ensureIndexes();
      const profilesCreated = await this.createMissingProfiles();
      const { autoMerged, suggestions } = await this.match();
      if (profilesCreated || autoMerged || suggestions) {
        await this.db.appendEvent({
          type: 'customer.sweep',
          subject: { kind: 'customer', id: 'all' },
          actor: 'system',
          data: { profilesCreated, autoMerged, suggestions },
        });
      }
      return { profilesCreated, autoMerged, suggestions };
    });
  }

  private async createMissingProfiles(): Promise<number> {
    let created = 0;
    const now = new Date();
    const cursor = this.db
      .col<IdentitySource & Document>(C.contacts)
      .find(
        { userId: { $nin: ['0', null] } } as never,
        {
          projection: { uid: 1, userId: 1, domName: 1, displayName: 1, zaloName: 1, phone: 1, encrypted: 1, gender: 1, role: 1, orgEmail: 1, ingestedAt: 1, lastActionTime: 1 },
        },
      );
    let batch: IdentitySource[] = [];
    const flush = async () => {
      if (!batch.length) return;
      const have = new Set((await this.links.find({ _id: { $in: batch.map((c) => c._id) } }, { projection: { _id: 1 } }).toArray()).map((l) => l._id));
      const todo = batch.filter((c) => !have.has(c._id) && typeof c.uid === 'string' && c.userId != null);
      batch = [];
      if (!todo.length) return;
      const built = todo.map((c) => buildIdentityProfile({ ...c, userId: String(c.userId) }, now));
      const upserts = <T extends { _id: string }>(docs: T[]) =>
        docs.map((doc) => ({ updateOne: { filter: { _id: doc._id }, update: { $setOnInsert: doc }, upsert: true } })) as unknown as AnyBulkWriteOperation<Document>[];
      // Children first, link last: a crash leaves at most an orphan profile that the next sweep reuses (same ids).
      await this.accounts.bulkWrite(upserts(built.map((b) => b.account)) as never, { ordered: false });
      await this.contacts.bulkWrite(upserts(built.map((b) => b.contact)) as never, { ordered: false });
      const pts = built.flatMap((b) => b.points);
      if (pts.length) await this.points.bulkWrite(upserts(pts) as never, { ordered: false });
      const r = await this.links.bulkWrite(upserts(built.map((b) => b.link)) as never, { ordered: false });
      created += r.upsertedCount;
    };
    for await (const c of cursor) {
      batch.push(c as IdentitySource);
      if (batch.length >= BATCH) await flush();
    }
    await flush();
    return created;
  }

  /** Pairs of active contacts sharing a phone / email value. */
  private async candidatePairs(): Promise<[string, string][]> {
    const groups = await this.points
      .aggregate<{ _id: unknown; contacts: string[] }>([
        { $match: { contactId: { $ne: null }, state: { $ne: 'shared_many' } } },
        { $group: { _id: { k: '$kind', v: '$value' }, contacts: { $addToSet: '$contactId' } } },
        { $match: { 'contacts.1': { $exists: true } } },
      ])
      .toArray();
    const pairs = new Map<string, [string, string]>();
    for (const g of groups) {
      if (g.contacts.length > MAX_GROUP) continue;
      const ids = [...g.contacts].sort();
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.set(`${ids[i]}|${ids[j]}`, [ids[i], ids[j]]);
    }
    return [...pairs.values()];
  }

  private async match(): Promise<{ autoMerged: number; suggestions: number }> {
    let autoMerged = 0;
    let suggestions = 0;
    const now = new Date();
    for (const [x, y] of await this.candidatePairs()) {
      const [ca, cb] = await Promise.all([this.contacts.findOne({ _id: x }), this.contacts.findOne({ _id: y })]);
      if (!ca || !cb || ca.status !== 'active' || cb.status !== 'active' || ca.accountId === cb.accountId) continue;
      const division = (await this.divisionOfContact(x)) ?? (await this.divisionOfContact(y)) ?? defaultDivision();
      const [a, b] = await Promise.all([this.side(ca, division), this.side(cb, division)]);
      const ev = evaluatePair(a, b, { division, now });
      if (ev.outcome === 'auto_merge') {
        const [source, target] = ev.newSide === 'a' ? [a, b] : [b, a];
        await this.merge(source.contactId, target.contactId, 'system', 'auto_merge', ev.signals, null);
        autoMerged++;
      } else if (ev.outcome !== 'none') {
        if (await this.upsertSuggestion(a, b, ev)) suggestions++;
      }
    }
    return { autoMerged, suggestions };
  }

  /** Division of the first channel an identity of the contact is on (accounts.divisionId). */
  private async divisionOfContact(contactId: string): Promise<string | null> {
    const link = await this.links.findOne({ contactId }, { projection: { uid: 1 } });
    if (!link) return null;
    const acc = await this.db.col<{ _id: string; divisionId?: string | null }>(C.accounts).findOne({ _id: link.uid }, { projection: { divisionId: 1 } });
    return acc?.divisionId ?? null;
  }

  /** Facts of one contact for the merge rules. */
  private async side(c: CustomerContactDoc, division: string | null): Promise<MergeSide> {
    const [account, points, links] = await Promise.all([
      this.accounts.findOne({ _id: c.accountId }),
      this.points.find({ contactId: c._id }).toArray(),
      this.links.find({ contactId: c._id }).toArray(),
    ]);
    const owners = (account?.owners ?? []).map((o) => ({ division: o.division, userId: o.userId }));
    let responsibleIds = owners.filter((o) => !division || o.division === division).map((o) => o.userId);
    if (!responsibleIds.length && links.length) {
      const holders = await this.db
        .col<ChannelAccessDoc>(AUTHZ_C.channelAccess)
        .find({ channelId: { $in: links.map((l) => l.uid) }, level: 'giu_nick', principalType: 'user' })
        .toArray();
      responsibleIds = [...new Set(holders.map((h) => h.principalId))];
    }
    let messageCount = 0;
    for (const l of links) {
      messageCount += await this.db.col(C.messages).countDocuments({ uid: l.uid, threadId: l.userId }, { limit: 20 });
      if (messageCount >= 20) break;
    }
    const firstSeen = links.length ? Math.min(...links.map((l) => l.firstSeenAt.getTime())) : c.createdAt.getTime();
    return {
      contactId: c._id,
      accountId: c.accountId,
      name: c.name,
      gender: c.gender,
      points: points.map((p) => ({ kind: p.kind, value: p.value, level: p.level, state: p.state, lastActivityAt: p.lastActivityAt })),
      erpCodes: (account?.erpLinks ?? []).filter((l) => l.status === 'confirmed').map((l) => ({ erp: l.erp, customerId: l.customerId })),
      owners,
      responsibleIds,
      isInternal: c.isInternal,
      webChat: links.some((l) => l.channel === 'web_chat'),
      erased: !!(c.erasedAt || account?.erasedAt),
      firstSeenAt: new Date(firstSeen),
      messageCount,
      mergeLocks: c.mergeLocks ?? [],
    };
  }

  /** Opens or refreshes the suggestion of a pair; closed suggestions (rejected / merged) stay closed. */
  private async upsertSuggestion(a: MergeSide, b: MergeSide, ev: MergeEvaluation): Promise<boolean> {
    const id = pairId(a.contactId, b.contactId);
    const cur = await this.suggestions.findOne({ _id: id }, { projection: { status: 1 } });
    if (cur && cur.status !== 'open') return false;
    const now = new Date();
    await this.suggestions.updateOne(
      { _id: id },
      {
        $set: {
          a: { contactId: a.contactId, accountId: a.accountId },
          b: { contactId: b.contactId, accountId: b.accountId },
          score: ev.score,
          signals: ev.signals,
          blocks: ev.blocks,
          priority: ev.score >= 90 ? 'high' : 'normal',
          updatedAt: now,
        },
        $setOnInsert: {
          kind: 'contact',
          // Both sides already had history: first clean-up, no deadline (§4.6, Q2 of the session plan).
          cleanup: !ev.newSide,
          status: 'open',
          reviewedBy: null,
          reviewedAt: null,
          reason: null,
          createdAt: now,
        },
      },
      { upsert: true },
    );
    return !cur;
  }

  // -------------------------------------------------------------------------
  // Merge and undo

  /**
   * Merges contact `sourceId` into `targetId`: identities, contact points and (when the source account
   * empties) the account follow the target. Only links move: identity ids, `contacts`, messages are never
   * touched (DK-01). The previous state is stored on the operation for an exact undo (DK-11).
   */
  async merge(sourceId: string, targetId: string, actor: string, op: 'auto_merge' | 'merge', signals: MergeSignalView[], suggestionId: string | null): Promise<string> {
    const [src, tgt] = await Promise.all([this.contacts.findOne({ _id: sourceId }), this.contacts.findOne({ _id: targetId })]);
    if (!src || !tgt || src.status !== 'active' || tgt.status !== 'active') throw new ConflictException('Hồ sơ đã thay đổi (đã gộp hoặc không còn). Tải lại rồi thử lại.');
    const [srcAcc, tgtAcc] = await Promise.all([this.accounts.findOne({ _id: src.accountId }), this.accounts.findOne({ _id: tgt.accountId })]);
    if (!srcAcc || !tgtAcc) throw new ConflictException('Không tìm thấy account của hồ sơ.');
    const sameAccount = srcAcc._id === tgtAcc._id;
    const others = sameAccount ? 1 : await this.contacts.countDocuments({ accountId: srcAcc._id, status: 'active', _id: { $ne: sourceId } });
    const accountMerged = !sameAccount && others === 0;
    const links = await this.links.find({ contactId: sourceId }).toArray();
    const points = await this.points
      .find(accountMerged ? { $or: [{ contactId: sourceId }, { contactId: null, accountId: srcAcc._id }] } : { contactId: sourceId })
      .toArray();
    const before: MergeSnapshot = {
      links: links.map((l) => ({ _id: l._id, contactId: l.contactId, accountId: l.accountId, state: l.state, mergeOpId: l.mergeOpId ?? null })),
      points: points.map((p) => ({ _id: p._id, contactId: p.contactId, accountId: p.accountId })),
      contacts: [{ _id: src._id, status: src.status, mergedInto: src.mergedInto, accountId: src.accountId }],
      accounts: [
        { _id: tgtAcc._id, status: tgtAcc.status, mergedInto: tgtAcc.mergedInto, owners: tgtAcc.owners },
        ...(accountMerged ? [{ _id: srcAcc._id, status: srcAcc.status, mergedInto: srcAcc.mergedInto, owners: srcAcc.owners }] : []),
      ],
    };
    const now = new Date();
    const opId = `mo_${randomUUID()}`;
    // The operation is written first: an interrupted merge can still be undone from it.
    await this.operations.insertOne({
      _id: opId,
      op,
      actor,
      at: now,
      suggestionId,
      target: { contactId: tgt._id, accountId: tgtAcc._id },
      source: { contactId: src._id, accountId: srcAcc._id },
      signals,
      before,
      undoUntil: new Date(now.getTime() + MERGE_UNDO_DAYS * DAY),
      undoneAt: null,
      undoneBy: null,
    });
    await this.links.updateMany(
      { contactId: sourceId },
      { $set: { contactId: tgt._id, accountId: tgtAcc._id, state: op === 'auto_merge' ? 'auto' : 'confirmed', mergeOpId: opId, linkedBy: actor, linkedAt: now } },
    );
    if (points.length) {
      await this.points.updateMany({ _id: { $in: points.filter((p) => p.contactId).map((p) => p._id) } }, { $set: { contactId: tgt._id, accountId: tgtAcc._id } });
      await this.points.updateMany({ _id: { $in: points.filter((p) => !p.contactId).map((p) => p._id) } }, { $set: { accountId: tgtAcc._id } });
    }
    await this.contacts.updateOne({ _id: sourceId }, { $set: { status: 'merged', mergedInto: tgt._id, updatedAt: now } });
    // Owners: the kept account keeps its owners; a division it had none in takes the absorbed one's.
    const have = new Set(tgtAcc.owners.map((o) => o.division));
    const extra = srcAcc.owners.filter((o) => !have.has(o.division)).map((o) => ({ ...o, source: 'merge' as const, since: now }));
    await this.accounts.updateOne({ _id: tgtAcc._id }, { $set: { updatedAt: now, ...(extra.length ? { owners: [...tgtAcc.owners, ...extra] } : {}) } });
    if (accountMerged) await this.accounts.updateOne({ _id: srcAcc._id }, { $set: { status: 'merged', mergedInto: tgtAcc._id, updatedAt: now } });
    await this.suggestions.updateMany({ _id: pairId(sourceId, targetId), status: 'open' }, { $set: { status: 'merged', reviewedBy: actor, reviewedAt: now, updatedAt: now } });
    await this.db.appendEvent({
      type: `customer.${op}`,
      subject: { kind: 'customer', id: tgtAcc._id },
      actor,
      data: { operationId: opId, sourceContactId: sourceId, targetContactId: tgt._id, identities: links.length, signals: signals.map((s) => s.code) },
    });
    return opId;
  }

  /**
   * One-touch undo of a merge (DK-11, "Không phải người này"): restores the exact previous links, points,
   * contact and account states, then locks the pair against automatic merges (DK-12 #6).
   */
  async undo(operationId: string, actor: string, u?: Subject): Promise<MergeOperationView> {
    const op = await this.operations.findOne({ _id: operationId });
    if (!op || (op.op !== 'merge' && op.op !== 'auto_merge') || !op.before || !op.source || !op.target) throw new NotFoundException('Không tìm thấy thao tác gộp');
    const targetAccount = op.target.accountId;
    await this.assertVisible(targetAccount, u, 'cust.merge').catch(() => this.assertVisible(targetAccount, u, 'cust.split'));
    if (op.undoneAt) throw new ConflictException('Thao tác này đã được hoàn tác.');
    const now = new Date();
    if (op.undoUntil && op.undoUntil < now) throw new ConflictException(`Đã quá ${MERGE_UNDO_DAYS} ngày, không hoàn tác được. Dùng Tách hồ sơ.`);
    const b = op.before;
    // Identities linked to the kept contact after this merge (by a later operation) stay where they are.
    const moved = b.links.length
      ? await this.links.find({ _id: { $in: b.links.map((l) => l._id) }, mergeOpId: operationId }, { projection: { _id: 1 } }).toArray()
      : [];
    const movedIds = new Set(moved.map((m) => m._id));
    for (const l of b.links) {
      if (!movedIds.has(l._id)) continue;
      await this.links.updateOne({ _id: l._id }, { $set: { contactId: l.contactId, accountId: l.accountId, state: l.state, mergeOpId: l.mergeOpId ?? null, linkedBy: actor, linkedAt: now } });
    }
    for (const p of b.points) await this.points.updateOne({ _id: p._id }, { $set: { contactId: p.contactId, accountId: p.accountId } });
    for (const c of b.contacts) await this.contacts.updateOne({ _id: c._id }, { $set: { status: c.status, mergedInto: c.mergedInto, accountId: c.accountId, updatedAt: now } });
    for (const a of b.accounts) await this.accounts.updateOne({ _id: a._id }, { $set: { status: a.status, mergedInto: a.mergedInto, owners: a.owners, updatedAt: now } });
    await this.contacts.updateOne({ _id: op.source.contactId }, { $addToSet: { mergeLocks: op.target.contactId } });
    await this.contacts.updateOne({ _id: op.target.contactId }, { $addToSet: { mergeLocks: op.source.contactId } });
    await this.operations.updateOne({ _id: operationId }, { $set: { undoneAt: now, undoneBy: actor } });
    await this.operations.insertOne({
      _id: `mo_${randomUUID()}`,
      op: 'undo',
      actor,
      at: now,
      suggestionId: op.suggestionId,
      target: op.target,
      source: op.source,
      signals: [],
      before: null,
      undoUntil: null,
      undoneAt: null,
      undoneBy: null,
      detail: { undoOf: operationId, identitiesRestored: movedIds.size, identitiesKept: b.links.length - movedIds.size },
    });
    await this.suggestions.updateOne(
      { _id: pairId(op.source.contactId, op.target.contactId) },
      {
        $set: { status: 'rejected', reason: 'Hoàn tác gộp: hai người khác nhau', reviewedBy: actor, reviewedAt: now, updatedAt: now },
        $setOnInsert: {
          kind: 'contact',
          a: op.source,
          b: op.target,
          score: 0,
          signals: op.signals,
          blocks: ['split_before'],
          priority: 'normal',
          cleanup: false,
          createdAt: now,
        },
      },
      { upsert: true },
    );
    await this.db.appendEvent({
      type: 'customer.merge_undo',
      subject: { kind: 'customer', id: op.target.accountId },
      actor,
      data: { operationId, identitiesRestored: movedIds.size },
    });
    return this.opView((await this.operations.findOne({ _id: operationId }))!);
  }

  private opView(o: MergeOperationDoc): MergeOperationView {
    return { id: o._id, op: o.op, actor: o.actor, at: o.at.toISOString(), undoUntil: toIso(o.undoUntil), undoneAt: toIso(o.undoneAt) };
  }

  async operationsOf(accountId: string, u?: Subject): Promise<MergeOperationView[]> {
    await this.assertVisible(accountId, u);
    const ops = await this.operations
      .find({ $or: [{ 'target.accountId': accountId }, { 'source.accountId': accountId }] })
      .sort({ at: -1 })
      .limit(100)
      .toArray();
    return ops.map((o) => this.opView(o));
  }

  // -------------------------------------------------------------------------
  // VCsales catalogue import (D3-09, D8-06)

  /**
   * Reads the VCsales catalogue (all of it, or what changed after `opts.updatedSince`) into snapshots, accounts and V3
   * points. `dryRun` writes nothing and only counts ("Xem trước", plan C11). Customers deleted on VCsales never get a
   * profile; their snapshot is marked.
   */
  async importCatalog(input: CustomerImportInput, actor: string, opts: CatalogRunOptions = {}): Promise<CatalogRunResult> {
    const division = input.division ?? defaultDivision();
    if (!division) throw new BadRequestException('Thiếu division để nạp owner lần đầu (đặt AUTHZ_DEFAULT_DIVISION hoặc gửi division).');
    await this.ensureIndexes();
    const res: CatalogRunResult = {
      erp: input.erp,
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      deleted: 0,
      held: 0,
      ownersSet: 0,
      ownerUnmatched: 0,
      ownerMismatch: 0,
      autoMerged: 0,
      suggestions: 0,
      maxUpdatedAt: null,
    };
    const users = new Map<string, string | null>();
    const userOf = async (email: string | null) => {
      if (!email) return null;
      const e = email.trim().toLowerCase();
      if (!users.has(e)) users.set(e, (await this.db.col<UserDoc>(C.users).findOne({ email: e }, { projection: { _id: 1 } }))?._id ?? null);
      return users.get(e) ?? null;
    };
    const updatedSince = opts.updatedSince ? opts.updatedSince.toISOString() : null;
    const waiting = await this.waitingForms();
    let cursor: string | null = null;
    try {
      do {
        const page = await this.vcsale.listCustomers({ cursor, limit: 200, updatedSince });
        for (const x of page.items) {
          res.fetched++;
          if (!res.maxUpdatedAt || x.updatedAt > res.maxUpdatedAt) res.maxUpdatedAt = x.updatedAt;
          await this.importOne(input.erp, x, division, actor, res, userOf, !!opts.dryRun, waiting);
        }
        cursor = page.nextCursor;
        await opts.onProgress?.(res.fetched);
      } while (cursor);
    } catch (e) {
      if (e instanceof VcsaleUnavailableError) throw new ServiceUnavailableException(e.message);
      throw e;
    }
    if (opts.dryRun) return res;
    await this.markSharedMany();
    const sweep = await this.sweep();
    res.autoMerged = sweep.autoMerged;
    res.suggestions = sweep.suggestions;
    const { erp: _erp, maxUpdatedAt: _max, ...counts } = res;
    await this.operations.insertOne({
      _id: `mo_${randomUUID()}`,
      op: 'import',
      actor,
      at: new Date(),
      suggestionId: null,
      target: null,
      source: null,
      signals: [],
      before: null,
      undoUntil: null,
      undoneAt: null,
      undoneBy: null,
      detail: { erp: input.erp, division, kind: opts.kind ?? 'full', ...counts },
    });
    await this.db.appendEvent({ type: 'customer.import', subject: { kind: 'customer', id: 'all' }, actor, data: { erp: input.erp, division, kind: opts.kind ?? 'full', ...counts } });
    return res;
  }

  /** Account confirmed-linked to `code` (following merges), or null. */
  private async accountOfCode(erp: string, code: string): Promise<CustomerAccountDoc | null> {
    let acc = await this.accounts.findOne({ erpLinks: { $elemMatch: { erp, customerId: code, status: 'confirmed' } } } as Filter<CustomerAccountDoc>, {
      sort: { status: 1 },
    });
    for (let i = 0; acc && acc.status === 'merged' && acc.mergedInto && i < 10; i++) acc = await this.accounts.findOne({ _id: acc.mergedInto });
    return acc;
  }

  private async importOne(
    erp: CustomerImportInput['erp'],
    x: VcsaleCustomer,
    division: string,
    actor: string,
    res: CatalogRunResult,
    userOf: (email: string | null) => Promise<string | null>,
    dryRun = false,
    waiting: { phones: Set<string>; taxCodes: Set<string> } = { phones: new Set(), taxCodes: new Set() },
  ) {
    const now = new Date();
    const { phones, emails } = erpPoints(x);
    const hash = stableHash(JSON.stringify(x));
    const snapId = `${erp}:${x.code}`;
    const prev = await this.erp.findOne({ _id: snapId }, { projection: { hash: 1 } });
    if (x.status === 'deleted') {
      // Deleted on VCsales: the snapshot says so (a linked profile shows "Mã KH … không còn"), no new profile.
      res.deleted++;
      if (!dryRun && prev) await this.erp.updateOne({ _id: snapId }, { $set: { status: 'deleted', raw: x, hash, fetchedAt: now } });
      return;
    }
    let acc = await this.accountOfCode(erp, x.code);
    if (!acc && (phones.some((p) => waiting.phones.has(p)) || (!!x.taxCode && waiting.taxCodes.has(x.taxCode)))) {
      // Most likely the code a sale admin just made for a queued customer (MH-DK-12 #6): no second profile, the
      // snapshot waits for "Gắn mã này" on that task.
      res.held++;
      if (!dryRun) {
        await this.erp.updateOne(
          { _id: snapId },
          {
            $set: {
              erp,
              code: x.code,
              name: x.name,
              phones,
              emails,
              taxCode: x.taxCode,
              address: x.address,
              region: x.region,
              salespersonEmail: x.salespersonEmail,
              status: x.status,
              mergedInto: x.mergedInto,
              ownerMismatch: false,
              raw: x,
              hash,
              fetchedAt: now,
            },
          },
          { upsert: true },
        );
      }
      return;
    }
    // First owner (D8-06): only when the division has none; afterwards VCsales is only compared. A customer may
    // have several salespersons on VCsales: the first (main one first) with a VClinks account of the same e-mail.
    const ownerEmails = [...new Set([x.salespersonEmail, ...(x.salespersons ?? []).filter((s) => s.active).map((s) => s.email)].filter((e): e is string => !!e))];
    const userIds: string[] = [];
    for (const e of ownerEmails) {
      const id = await userOf(e);
      if (id && !userIds.includes(id)) userIds.push(id);
    }
    const userId = userIds[0] ?? null;
    if (dryRun) {
      if (!acc) res.created++;
      else if (prev?.hash === hash) res.unchanged++;
      else res.updated++;
      const cur = acc?.owners.find((o) => o.division === division);
      if (!cur) {
        if (userId) res.ownersSet++;
        else if (ownerEmails.length) res.ownerUnmatched++;
      } else if (userIds.length && !userIds.includes(cur.userId)) res.ownerMismatch++;
      return;
    }
    const ids = erpProfileIdsOf(erp, x.code);
    if (!acc) {
      const account: CustomerAccountDoc = {
        _id: ids.accountId,
        name: x.name,
        type: x.type,
        region: x.region,
        status: 'active',
        mergedInto: null,
        owners: [],
        erpLinks: [{ erp, customerId: x.code, status: 'confirmed', confirmedBy: `import:${erp}`, confirmedAt: now }],
        tags: [],
        createdFrom: 'erp',
        createdAt: now,
        updatedAt: now,
      };
      const contact: CustomerContactDoc = {
        _id: ids.contactId,
        accountId: ids.accountId,
        name: x.name,
        orgRole: null,
        status: 'active',
        mergedInto: null,
        mergeLocks: [],
        gender: null,
        isInternal: false,
        createdAt: now,
        updatedAt: now,
      };
      await this.accounts.updateOne({ _id: account._id }, { $setOnInsert: account }, { upsert: true });
      await this.contacts.updateOne({ _id: contact._id }, { $setOnInsert: contact }, { upsert: true });
      acc = (await this.accountOfCode(erp, x.code)) ?? (await this.accounts.findOne({ _id: ids.accountId }));
      res.created++;
    } else if (prev?.hash === hash) res.unchanged++;
    else res.updated++;
    if (!acc) return;

    // ERP phones / emails are V3 (DK-04); attached to the ERP profile's contact, else the account's first one.
    const own = await this.contacts.findOne({ _id: ids.contactId, accountId: acc._id, status: 'active' });
    const holder = own ?? (await this.contacts.findOne({ accountId: acc._id, status: 'active' }, { sort: { createdAt: 1 } }));
    const pointOps = [...phones.map((v) => ['phone', v] as const), ...emails.map((v) => ['email', v] as const)].map(([kind, value]) => ({
      updateOne: {
        filter: { _id: pointIdOf(`erp:${erp}:${x.code}`, kind, value) },
        update: {
          $setOnInsert: {
            contactId: holder?._id ?? null,
            accountId: acc!._id,
            kind,
            value,
            level: 'V3',
            state: 'active',
            source: { erp, customerId: x.code },
            createdAt: now,
          },
          $set: { lastActivityAt: x.lastTradeAt ? new Date(x.lastTradeAt) : null },
        },
        upsert: true,
      },
    }));
    if (pointOps.length) await this.points.bulkWrite(pointOps as never, { ordered: false });

    const cur = acc.owners.find((o) => o.division === division);
    let mismatch = false;
    if (!cur) {
      if (userId) {
        await this.accounts.updateOne(
          { _id: acc._id, 'owners.division': { $ne: division } } as Filter<CustomerAccountDoc>,
          { $push: { owners: { division, userId, since: now, source: 'vcsales_import' } }, $set: { updatedAt: now } },
        );
        res.ownersSet++;
      } else if (ownerEmails.length) res.ownerUnmatched++;
    } else if (userIds.length && !userIds.includes(cur.userId)) {
      mismatch = true;
      res.ownerMismatch++;
    }
    await this.erp.updateOne(
      { _id: snapId },
      {
        $set: {
          erp,
          code: x.code,
          name: x.name,
          phones,
          emails,
          taxCode: x.taxCode,
          address: x.address,
          region: x.region,
          salespersonEmail: x.salespersonEmail,
          status: x.status,
          mergedInto: x.mergedInto,
          ownerMismatch: mismatch,
          raw: x,
          hash,
          fetchedAt: now,
        },
      },
      { upsert: true },
    );
    void actor;
  }

  /** Phones and tax codes of the waiting "Chờ tạo mã KH" forms (MH-DK-12): codes matching them are held for the task. */
  private async waitingForms(): Promise<{ phones: Set<string>; taxCodes: Set<string> }> {
    const tasks = await this.col<ErpTaskDoc>(CUST_C.erpTasks)
      .find({ kind: 'create_customer', status: { $in: ['open', 'waiting_sale'] } } as Filter<ErpTaskDoc>, { projection: { form: 1 } })
      .toArray();
    const pointIds = tasks.map((t) => t.form?.phonePointId).filter((x): x is string => !!x);
    const pts = pointIds.length ? await this.points.find({ _id: { $in: pointIds } }, { projection: { value: 1 } }).toArray() : [];
    return { phones: new Set(pts.map((p) => p.value)), taxCodes: new Set(tasks.map((t) => t.form?.taxCode).filter((x): x is string => !!x)) };
  }

  /** DK-57: a phone on ≥ 2 VCsales codes is "Dùng chung nhiều khách" (no signal, blocks merges). */
  private async markSharedMany() {
    const rows = await this.points
      .aggregate<{ _id: string }>([
        { $match: { kind: 'phone', 'source.erp': { $exists: true } } },
        { $group: { _id: '$value', codes: { $addToSet: '$source.customerId' } } },
        { $match: { 'codes.1': { $exists: true } } },
      ])
      .toArray();
    if (rows.length) await this.points.updateMany({ kind: 'phone', value: { $in: rows.map((r) => r._id) }, state: 'active' }, { $set: { state: 'shared_many' } });
  }

  // -------------------------------------------------------------------------
  // Visibility (M1b-04 engine: cust.* scopes)

  async visibility(u: Subject | undefined, key: Parameters<AuthzService['customerScope']>[1] = 'cust.view'): Promise<Vis> {
    if (!u) return {};
    const scope = await this.authz.customerScope(u, key);
    if (!scope) return {};
    const or: Vis[] = [];
    if (scope.ownerIds.length) or.push({ 'owners.userId': { $in: scope.ownerIds } } as Vis);
    if (scope.divisions.length) or.push({ 'owners.division': { $in: scope.divisions } } as Vis);
    if (scope.channels.length) {
      const accIds = await this.links.distinct('accountId', { uid: { $in: scope.channels } });
      if (accIds.length) or.push({ _id: { $in: accIds as string[] } });
    }
    return or.length ? { $or: or } : { _id: { $in: [] } };
  }

  async assertVisible(accountId: string, u: Subject | undefined, key: Parameters<AuthzService['customerScope']>[1] = 'cust.view') {
    const vis = await this.visibility(u, key);
    const n = await this.accounts.countDocuments({ $and: [{ _id: accountId }, vis] } as Filter<CustomerAccountDoc>, { limit: 1 });
    if (!n) throw new NotFoundException(NO_ACCESS_TEXT.api);
  }

  // -------------------------------------------------------------------------
  // Read views

  async userNames(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows = await runUnscoped(() => this.db.col<UserDoc>(C.users).find({ _id: { $in: ids } }, { projection: { fullName: 1 } }).toArray());
    return new Map(rows.map((r) => [r._id, r.fullName]));
  }

  private ownersView(a: CustomerAccountDoc, names: Map<string, string>): CustomerOwnerView[] {
    return a.owners.map((o) => ({ division: o.division, userId: o.userId, userName: names.get(o.userId) ?? null, since: o.since.toISOString(), source: o.source }));
  }

  private async summaries(accs: CustomerAccountDoc[]): Promise<CustomerSummary[]> {
    const ids = accs.map((a) => a._id);
    const [contactCounts, identityCounts, names] = await Promise.all([
      this.contacts.aggregate<{ _id: string; n: number }>([{ $match: { accountId: { $in: ids }, status: 'active' } }, { $group: { _id: '$accountId', n: { $sum: 1 } } }]).toArray(),
      this.links.aggregate<{ _id: string; n: number }>([{ $match: { accountId: { $in: ids } } }, { $group: { _id: '$accountId', n: { $sum: 1 } } }]).toArray(),
      this.userNames([...new Set(accs.flatMap((a) => a.owners.map((o) => o.userId)))]),
    ]);
    const cc = new Map(contactCounts.map((r) => [r._id, r.n]));
    const ic = new Map(identityCounts.map((r) => [r._id, r.n]));
    return accs.map((a) => ({
      id: a._id,
      name: a.name,
      type: a.type,
      region: a.region,
      status: a.status,
      owners: this.ownersView(a, names),
      erpLinks: a.erpLinks.map((l) => ({ erp: l.erp, customerId: l.customerId, status: l.status, confirmedBy: l.confirmedBy, confirmedAt: toIso(l.confirmedAt) })),
      contactCount: cc.get(a._id) ?? 0,
      identityCount: ic.get(a._id) ?? 0,
      updatedAt: a.updatedAt.toISOString(),
    }));
  }

  async list(q: CustomerListQuery, u?: Subject): Promise<CustomerListResponse> {
    await this.ensureIndexes();
    const and: Vis[] = [{ status: 'active' }, await this.visibility(u)];
    if (q.q) and.push({ name: { $regex: escapeRe(q.q), $options: 'i' } });
    if (q.erp === 'linked') and.push({ erpLinks: { $elemMatch: { erp: 'vcsales', status: 'confirmed' } } } as Vis);
    if (q.erp === 'none') and.push({ erpLinks: { $not: { $elemMatch: { erp: 'vcsales', status: 'confirmed' } } } } as Vis);
    const filter = { $and: and } as Filter<CustomerAccountDoc>;
    const [total, accs] = await Promise.all([
      this.accounts.countDocuments(filter),
      this.accounts
        .find(filter)
        .sort({ updatedAt: -1, _id: 1 })
        .skip((q.page - 1) * q.pageSize)
        .limit(q.pageSize)
        .toArray(),
    ]);
    return { items: await this.summaries(accs), total };
  }

  /** Accent-free name of accounts that have none yet (written lazily, at most once a minute per tenant). */
  private foldedAt = new Map<string, number>();
  private async backfillNameFold() {
    const key = currentTenant();
    if (Date.now() - (this.foldedAt.get(key) ?? 0) < 60_000) return;
    this.foldedAt.set(key, Date.now());
    const rows = await this.accounts.find({ nameFold: { $exists: false } } as never, { projection: { name: 1 } }).limit(5000).toArray();
    if (!rows.length) return;
    await this.accounts.bulkWrite(rows.map((r) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { nameFold: foldVi(r.name) } as never } } })));
  }

  /**
   * Customers for Ctrl+K (MH-UI-04): by name without accents, phone digits (≥ 3) or VCsales code, inside the
   * accounts the viewer may see (`cust.view`). Phones are always masked here (MH-PQ-12).
   */
  async quickSearch(q: string, limit: number, u?: Subject): Promise<QuickSearchItem[]> {
    await this.backfillNameFold();
    const fold = foldVi(q);
    const digits = q.replace(/\D/g, '');
    const or: Filter<CustomerAccountDoc>[] = [{ nameFold: { $regex: `(^|\\s)${escapeRe(fold)}` } } as never, { 'erpLinks.customerId': { $regex: `^${escapeRe(q.toUpperCase())}` } } as never];
    if (digits.length >= 3 && digits.length === q.replace(/[\s.+-]/g, '').length) {
      const pts = await this.points.find({ kind: 'phone', value: { $regex: escapeRe(digits) } }, { projection: { accountId: 1 } }).limit(50).toArray();
      if (pts.length) or.push({ _id: { $in: [...new Set(pts.map((p) => p.accountId))] } });
    }
    const filter = { $and: [{ status: 'active' }, await this.visibility(u), { $or: or }] } as Filter<CustomerAccountDoc>;
    const accs = await this.accounts.find(filter).sort({ updatedAt: -1 }).limit(limit).toArray();
    if (!accs.length) return [];
    const phones = await this.points.find({ accountId: { $in: accs.map((a) => a._id) }, kind: 'phone', state: { $ne: 'retired' } } as never, { projection: { accountId: 1, value: 1 } }).toArray();
    const phoneOf = new Map<string, string>();
    for (const p of phones) if (!phoneOf.has(p.accountId)) phoneOf.set(p.accountId, p.value);
    return accs.map((a) => ({
      kind: 'customer' as const,
      accountId: a._id,
      conversationId: null,
      uid: '',
      userId: '',
      name: a.name,
      phone: phoneOf.has(a._id) ? maskPhone(phoneOf.get(a._id)) : null,
      customerCode: a.erpLinks.find((l) => l.erp === 'vcsales' && l.status === 'confirmed')?.customerId ?? null,
    }));
  }

  async detail(accountId: string, u?: Subject): Promise<CustomerDetail> {
    await this.assertVisible(accountId, u);
    const acc = (await this.accounts.findOne({ _id: accountId }))!;
    const [summary] = await this.summaries([acc]);
    const [contacts, points, links] = await Promise.all([
      this.contacts.find({ accountId, status: 'active' }).sort({ createdAt: 1 }).toArray(),
      this.points.find({ accountId }).toArray(),
      this.links.find({ accountId }).toArray(),
    ]);
    const idDocs = links.length
      ? await runUnscoped(() => this.db.col<IdentitySource & Document>(C.contacts).find({ _id: { $in: links.map((l) => l._id) } as never }).toArray())
      : [];
    const names = new Map(idDocs.map((d) => [String(d._id), identityName(d as IdentitySource)]));
    const pointView = (p: ContactPointDoc): ContactPointView => ({
      id: p._id,
      kind: p.kind,
      ...(p.kind === 'phone' ? { phone: p.value } : { email: p.value }),
      level: p.level,
      state: p.state,
      source: p.source.erp ? p.source.erp : (p.source.channel ?? 'manual'),
    });
    const identityView = (l: IdentityLinkDoc): IdentityView => ({
      identityId: l._id,
      uid: l.uid,
      userId: l.userId,
      channel: l.channel,
      name: names.get(l._id) ?? null,
      state: l.state,
      linkedBy: l.linkedBy,
      linkedAt: l.linkedAt.toISOString(),
    });
    const contactViews: CustomerContactView[] = contacts.map((c) => ({
      id: c._id,
      name: c.name,
      orgRole: c.orgRole,
      status: c.status,
      points: points.filter((p) => p.contactId === c._id).map(pointView),
      identities: links.filter((l) => l.contactId === c._id).map(identityView),
    }));
    const view: CustomerDetail = { ...summary, mergedInto: acc.mergedInto, contacts: contactViews, points: points.filter((p) => !p.contactId).map(pointView) };
    // DK-44: owner / nick holder see phones and emails in full, others masked (+ "Hiện" when allowed).
    return this.privacy.mask(view, await this.privacy.phoneVisibility(u, view));
  }

  /** Customer of one channel identity (panel of the chat, Customer 360 entry). */
  async byIdentity(uid: string, userId: string, u?: Subject): Promise<CustomerDetail> {
    const accountId = await this.accountOfIdentity(`${uid}:${userId}`);
    if (!accountId) throw new NotFoundException('Danh tính này chưa có hồ sơ khách (chờ lượt đồng bộ khách kế tiếp).');
    return this.detail(accountId, u);
  }

  // -------------------------------------------------------------------------
  // Suggestions

  async listSuggestions(u?: Subject): Promise<MergeSuggestionView[]> {
    const vis = await this.visibility(u, 'cust.merge');
    const rows = await this.suggestions.find({ status: 'open' }).sort({ score: -1, createdAt: 1 }).limit(200).toArray();
    const accIds = [...new Set(rows.flatMap((r) => [r.a.accountId, r.b.accountId]))];
    const visible = new Set((await this.accounts.find({ $and: [{ _id: { $in: accIds } }, vis] } as Filter<CustomerAccountDoc>, { projection: { _id: 1 } }).toArray()).map((a) => a._id));
    const contactIds = [...new Set(rows.flatMap((r) => [r.a.contactId, r.b.contactId]))];
    const names = new Map((await this.contacts.find({ _id: { $in: contactIds } }, { projection: { name: 1 } }).toArray()).map((c) => [c._id, c.name]));
    return rows
      .filter((r) => visible.has(r.a.accountId) || visible.has(r.b.accountId))
      .map((r) => ({
        id: r._id,
        a: { ...r.a, name: names.get(r.a.contactId) ?? '' },
        b: { ...r.b, name: names.get(r.b.contactId) ?? '' },
        score: r.score,
        signals: r.signals,
        blocks: r.blocks,
        priority: r.priority,
        cleanup: r.cleanup,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }));
  }

  /** Person-approved merge of a suggestion (DK-09 approvers hold cust.merge). The kept side: ERP code, then older. */
  async approveSuggestion(id: string, u: Subject | undefined, actor: string): Promise<{ operationId: string }> {
    const s = await this.suggestions.findOne({ _id: id });
    if (!s || s.status !== 'open') throw new NotFoundException('Không tìm thấy gợi ý đang mở');
    await this.assertVisible(s.a.accountId, u, 'cust.merge').catch(() => this.assertVisible(s.b.accountId, u, 'cust.merge'));
    if (s.blocks.includes('two_erp_codes')) throw new ConflictException('Hai hồ sơ có hai mã KH khác nhau: không gộp. Dùng "Là account liên quan" hoặc "Báo trùng trên VCsales".');
    if (s.blocks.includes('erased')) throw new ConflictException('Một hồ sơ đã bị xóa theo yêu cầu, không gộp được.');
    const [aa, ab] = await Promise.all([this.accounts.findOne({ _id: s.a.accountId }), this.accounts.findOne({ _id: s.b.accountId })]);
    const hasCode = (a: CustomerAccountDoc | null) => !!a?.erpLinks.some((l) => l.status === 'confirmed');
    const keepA = hasCode(aa) !== hasCode(ab) ? hasCode(aa) : (aa?.createdAt.getTime() ?? 0) <= (ab?.createdAt.getTime() ?? 0);
    const [keep, drop] = keepA ? [s.a, s.b] : [s.b, s.a];
    const operationId = await this.merge(drop.contactId, keep.contactId, actor, 'merge', s.signals, id);
    return { operationId };
  }

  /** "Hai người khác nhau" (DK-60): closes the suggestion and locks the pair. */
  async rejectSuggestion(id: string, u: Subject | undefined, actor: string, reason: string): Promise<void> {
    const s = await this.suggestions.findOne({ _id: id });
    if (!s || s.status !== 'open') throw new NotFoundException('Không tìm thấy gợi ý đang mở');
    await this.assertVisible(s.a.accountId, u, 'cust.merge').catch(() => this.assertVisible(s.b.accountId, u, 'cust.merge'));
    const now = new Date();
    await this.suggestions.updateOne({ _id: id }, { $set: { status: 'rejected', reason, reviewedBy: actor, reviewedAt: now, updatedAt: now } });
    await this.contacts.updateOne({ _id: s.a.contactId }, { $addToSet: { mergeLocks: s.b.contactId } });
    await this.contacts.updateOne({ _id: s.b.contactId }, { $addToSet: { mergeLocks: s.a.contactId } });
    await this.db.appendEvent({ type: 'customer.suggestion_reject', subject: { kind: 'customer', id: s.a.accountId }, actor, data: { suggestionId: id } });
  }

  // -------------------------------------------------------------------------
  // ERP links (MH-DK-10, MH-DK-13)

  canConfirmErp(u: Subject | undefined): boolean {
    return !u || u.roles.some((r) => ERP_CONFIRM_ROLES.has(r.roleKey));
  }

  /** Snapshot of an ERP customer, fetched from VCsales when not imported yet. */
  async erpSnapshot(erp: string, code: string): Promise<ErpCustomerDoc | null> {
    const snap = await this.erp.findOne({ _id: `${erp}:${code}` });
    if (snap || erp !== 'vcsales') return snap;
    let x: VcsaleCustomer | null;
    try {
      x = await this.vcsale.getCustomer(code);
    } catch (e) {
      if (e instanceof VcsaleUnavailableError) throw new ServiceUnavailableException(e.message);
      throw e;
    }
    if (!x) return null;
    const { phones, emails } = erpPoints(x);
    const doc: Omit<ErpCustomerDoc, '_id'> = {
      erp: 'vcsales',
      code: x.code,
      name: x.name,
      phones,
      emails,
      taxCode: x.taxCode,
      address: x.address,
      region: x.region,
      salespersonEmail: x.salespersonEmail,
      status: x.status,
      mergedInto: x.mergedInto,
      ownerMismatch: false,
      raw: x,
      hash: stableHash(JSON.stringify(x)),
      fetchedAt: new Date(),
    };
    await this.erp.updateOne({ _id: `vcsales:${code}` }, { $set: doc }, { upsert: true });
    return { _id: `vcsales:${code}`, ...doc };
  }

  /** "Xác nhận" of MH-DK-10: one code per ERP (BR11); a code taken by another account is refused (UAT-DK-27). */
  async confirmErpLink(accountId: string, input: ErpLinkConfirmInput, u: Subject | undefined, actor: string): Promise<CustomerDetail> {
    if (!this.canConfirmErp(u)) throw new ForbiddenException('Chỉ sale admin xác nhận liên kết mã KH. Bạn có thể đề xuất liên kết.');
    await this.assertVisible(accountId, u, 'cust.erp_link');
    const acc = await this.accounts.findOne({ _id: accountId });
    if (!acc || acc.status !== 'active') throw new ConflictException('Hồ sơ này đã gộp vào hồ sơ khác.');
    const same = acc.erpLinks.find((l) => l.erp === input.erp && l.status === 'confirmed');
    if (same && same.customerId !== input.customerId) throw new ConflictException(`Account đã liên kết mã ${same.customerId}. Mỗi account chỉ một mã mỗi bộ ERP.`);
    if (same) return this.detail(accountId, u);
    const taken = await this.accounts.findOne({
      _id: { $ne: accountId },
      status: 'active',
      erpLinks: { $elemMatch: { erp: input.erp, customerId: input.customerId, status: 'confirmed' } },
    } as Filter<CustomerAccountDoc>);
    if (taken) throw new ConflictException({ message: ERP_CODE_TAKEN_TEXT(taken.name), otherAccountId: taken._id, otherAccountName: taken.name });
    const snap = await this.erpSnapshot(input.erp, input.customerId);
    if (!snap) throw new NotFoundException('Không tìm thấy mã KH này trên VCsales.');
    const now = new Date();
    const link = { erp: input.erp, customerId: input.customerId, status: 'confirmed' as const, confirmedBy: actor, confirmedAt: now };
    await this.accounts.updateOne({ _id: accountId }, { $set: { erpLinks: [...acc.erpLinks.filter((l) => l.erp !== input.erp), link], updatedAt: now } });
    // ERP phones / emails become V3 on this account (DK-16); missing ones are added to its first contact.
    const holder = await this.contacts.findOne({ accountId, status: 'active' }, { sort: { createdAt: 1 } });
    for (const [kind, values] of [['phone', snap.phones], ['email', snap.emails]] as const) {
      for (const value of values) {
        const existing = await this.points.find({ accountId, kind, value }).toArray();
        for (const p of existing) if (verifyRank(p.level) < 3) await this.points.updateOne({ _id: p._id }, { $set: { level: 'V3' } });
        await this.points.updateOne(
          { _id: pointIdOf(`erp:${input.erp}:${input.customerId}`, kind, value) },
          {
            $setOnInsert: { contactId: holder?._id ?? null, accountId, kind, value, level: 'V3', state: 'active', source: { erp: input.erp, customerId: input.customerId }, lastActivityAt: null, createdAt: now },
          },
          { upsert: true },
        );
      }
    }
    await this.operations.insertOne({
      _id: `mo_${randomUUID()}`,
      op: 'erp_link',
      actor,
      at: now,
      suggestionId: null,
      target: { contactId: holder?._id ?? '', accountId },
      source: null,
      signals: [],
      before: null,
      undoUntil: null,
      undoneAt: null,
      undoneBy: null,
      detail: { erp: input.erp, customerId: input.customerId },
    });
    await this.db.appendEvent({ type: 'customer.erp_link', subject: { kind: 'customer', id: accountId }, actor, data: { erp: input.erp, customerId: input.customerId } });
    // The customer has a code now: its "Chờ tạo mã KH" task leaves the queue (MH-DK-12, DK-58).
    await this.col<ErpTaskDoc>(CUST_C.erpTasks).updateMany(
      { accountId, kind: 'create_customer', status: { $in: ['open', 'waiting_sale'] } } as Filter<ErpTaskDoc>,
      { $set: { status: 'done', code: input.customerId, doneBy: actor, doneAt: now, updatedAt: now, claim: null } },
    );
    return this.detail(accountId, u);
  }

  /** Manual search of VCsales customers for "Liên kết mã KH" (read only, phones masked). */
  async erpSearch(query: string): Promise<ErpSearchRow[]> {
    const q = query.trim().slice(0, 100);
    if (q.length < 3) return [];
    let found: VcsaleCustomer[];
    try {
      found = await this.vcsale.searchCustomers(q, 20);
    } catch (e) {
      if (e instanceof VcsaleUnavailableError) throw new ServiceUnavailableException(e.message);
      throw e;
    }
    return found
      .filter((x) => x.status !== 'merged')
      .map((x) => ({
        code: x.code,
        name: x.name,
        taxCode: x.taxCode,
        address: x.address,
        region: x.region,
        type: x.type,
        phones: x.phones.map((p) => maskPhone(p)),
        salespersonName: x.salespersonName,
      }));
  }

  /** "Đối chiếu mã KH" (MH-DK-13): active accounts without a VCsales code, with candidate codes. */
  async erpMatching(u?: Subject): Promise<ErpMatchingResponse> {
    await this.ensureIndexes();
    const vis = await this.visibility(u, 'cust.erp_link');
    const accs = await this.accounts
      .find({ $and: [{ status: 'active' }, { erpLinks: { $not: { $elemMatch: { erp: 'vcsales', status: 'confirmed' } } } }, vis] } as Filter<CustomerAccountDoc>)
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();
    const snaps = await this.erp.find({ erp: 'vcsales', status: { $ne: 'merged' } }).limit(5000).toArray();
    const points = await this.points.find({ accountId: { $in: accs.map((a) => a._id) } }).toArray();
    const names = await this.userNames([...new Set(accs.flatMap((a) => a.owners.map((o) => o.userId)))]);
    const items: ErpMatchingRow[] = [];
    for (const a of accs) {
      const exact = (n: string) => (foldVi(n) === foldVi(a.name) ? 1 : 0);
      const mine = points.filter((p) => p.accountId === a._id && p.state !== 'shared_many');
      const candidates = snaps
        .map((s) => {
          const reasons: string[] = [];
          let score = 0;
          const hit = mine.find((p) => (p.kind === 'phone' ? s.phones : s.emails).includes(p.value));
          if (hit) {
            const strong = verifyRank(hit.level) >= 2;
            score += strong ? 95 : 60;
            reasons.push(`${hit.kind === 'phone' ? 'SĐT' : 'Email'} ${strong ? hit.level : 'V1'}`);
          }
          if (nameSimilarity(a.name, s.name) >= 0.5) {
            score += hit ? 0 : 40;
            reasons.push('tên giống');
          }
          if (score && a.region && s.region && a.region === s.region) {
            score += 20;
            reasons.push('cùng khu vực');
          }
          return { customerId: s.code, name: s.name, score: Math.min(100, score), reasons, taxCode: s.taxCode, address: s.address, salesperson: s.raw.salespersonName };
        })
        .filter((c) => c.score >= 40)
        // Same score: the exact (accent-free) name first, then the closer name.
        .sort((x, y) => y.score - x.score || exact(y.name) - exact(x.name) || nameSimilarity(a.name, y.name) - nameSimilarity(a.name, x.name))
        .slice(0, 3);
      if (candidates.length) items.push({ accountId: a._id, accountName: a.name, owners: this.ownersView(a, names), candidates });
    }
    return { items, canConfirm: this.canConfirmErp(u), erpMode: this.vcsale.mode, catalogSize: await this.erp.countDocuments({ erp: 'vcsales' }) };
  }
}
