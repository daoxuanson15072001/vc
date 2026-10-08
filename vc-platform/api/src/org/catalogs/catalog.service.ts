/**
 * Catalogs (04 VH-ORG-02, 03, 07): add, edit, stop, start again, delete when never used. Codes never change; names are
 * compared folded (no accents, case, extra spaces). Legal entities: HC-NS of the whole group only, and a new name takes
 * effect on a date (through the change core, B-03). Each write is one transaction with one audit row.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_INFO,
  CATALOG_MSG,
  CATALOG_SCHEMAS,
  CATALOG_STATUS_LABEL,
  CatalogStatusChange,
  fillMsg,
  foldName,
  type CatalogStatus,
  type CatalogType,
} from '@vc/contracts';
import { MongoServerError, type ClientSession, type Collection, type Db, type Document, type Filter, type MongoClient } from 'mongodb';
import { AuditService } from '../../audit/audit.service';
import type { Viewer } from '../../auth/viewer';
import { ApiError } from '../../common/api-error';
import { CLOCK, todayOn, type Clock } from '../../common/clock';
import { assertRev, updateByRev } from '../../common/rev';
import { withTx } from '../../common/tx';
import { parseInput } from '../../common/zod.pipe';
import { C } from '../../db/collections';
import { DB, MONGO_CLIENT } from '../../db/mongo';
import { ChangeService, type Requester, type SubmitResult } from '../../people/changes/change.service';
import { CatalogHooks, type CatalogEvent } from './hooks';
import type { CatalogDoc, LegalEntityDoc, WorkLocationDoc } from './types';
import { everUsed, inUse, inUseAll, type InUse } from './usage';

const COLLECTION: Record<CatalogType, string> = {
  'job-titles': C.jobTitles,
  'job-functions': C.jobFunctions,
  'legal-entities': C.legalEntities,
  'work-locations': C.workLocations,
};
/** Entries that still hold their name (merged ones give it up, VH-ORG-09). */
const LIVE: CatalogStatus[] = ['dang_dung', 'ngung'];
const ORDERED = new Set<CatalogType>(['job-titles', 'job-functions']);

export type CatalogView = Record<string, unknown> & { code: string; name: string; status: CatalogStatus; rev: number };

export interface CatalogListQuery {
  status?: string;
  q?: string;
  /** Job titles: by default function. */
  function?: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly hooks: CatalogHooks,
    private readonly changes: ChangeService,
  ) {}

  col<T extends CatalogDoc = CatalogDoc>(type: CatalogType): Collection<T> {
    return this.db.collection<T>(COLLECTION[type]);
  }

  // --- Rules ---------------------------------------------------------------------------------------------------------

  /** Scope (04 VH-ORG-07 bước 2): legal entities by HC-NS of the whole group; work locations of one's own legal entities or shared. */
  private assertCanWrite(type: CatalogType, viewer: Viewer | undefined, legalCodes: (string | null | undefined)[] = []): void {
    if (!viewer || viewer.hcnsScope === 'all') return;
    if (type === 'legal-entities') throw new ApiError('forbidden', { message: CATALOG_MSG.legalAllOnly });
    if (type === 'work-locations') {
      const scope = viewer.hcnsScope ?? [];
      if (legalCodes.some((c) => c != null && !scope.includes(c))) throw new ApiError('forbidden', { message: CATALOG_MSG.locationScope });
    }
  }

  private canWrite(type: CatalogType, viewer: Viewer | undefined, doc?: CatalogDoc): boolean {
    try {
      this.assertCanWrite(type, viewer, type === 'work-locations' && doc ? [(doc as WorkLocationDoc).legal_entity_code] : []);
      return true;
    } catch {
      return false;
    }
  }

  private async assertUniqueName(type: CatalogType, name: string, except: string | null, session: ClientSession): Promise<void> {
    const filter: Filter<CatalogDoc> = { name_folded: foldName(name), status: { $in: LIVE } };
    if (except) filter._id = { $ne: except };
    const dup = await this.col(type).findOne(filter, { session });
    if (!dup) return;
    const message =
      type === 'job-functions'
        ? fillMsg(CATALOG_MSG.duplicateFunction, { name: dup.name })
        : fillMsg(CATALOG_MSG.duplicate, { label: CATALOG_INFO[type].label, name: dup.name, code: dup._id });
    throw new ApiError('rule_violation', { message, details: { field: 'name', code: dup._id } });
  }

  /** Tax code and employee code prefix are unique among legal entities. */
  private async assertUniqueLegalFields(fields: Partial<LegalEntityDoc>, except: string | null, session: ClientSession): Promise<void> {
    const col = this.col<LegalEntityDoc>('legal-entities');
    const others = except ? { _id: { $ne: except } } : {};
    if (fields.tax_code) {
      const dup = await col.findOne({ tax_code: fields.tax_code, ...others }, { session });
      if (dup) throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.taxTaken, { name: dup.name }), details: { field: 'tax_code' } });
    }
    if (fields.employee_code_prefix) {
      const dup = await col.findOne({ employee_code_prefix: fields.employee_code_prefix, ...others }, { session });
      if (dup) throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.prefixTaken, { name: dup.name }), details: { field: 'employee_code_prefix' } });
    }
  }

  /**
   * The entry exists and is in use ("Đang dùng"): stopped entries cannot be picked for new data (05 mục 3.5).
   * Positions (B-07) and profiles (B-06) call this for the title, function, legal entity and work location they set.
   */
  async requireSelectable(type: CatalogType, code: string, session?: ClientSession): Promise<CatalogDoc> {
    const doc = await this.col(type).findOne({ _id: code }, { session });
    const label = CATALOG_INFO[type].label;
    if (!doc) throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.notFoundRef, { label, code }) });
    if (doc.status !== 'dang_dung') throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.notSelectable, { label, name: doc.name }) });
    return doc;
  }

  /** References inside the catalogs: a title's default function, a work location's legal entity. */
  private async checkRefs(type: CatalogType, fields: Record<string, unknown>, session: ClientSession): Promise<void> {
    if (type === 'job-titles' && typeof fields.default_function_code === 'string') await this.requireSelectable('job-functions', fields.default_function_code, session);
    if (type === 'work-locations' && typeof fields.legal_entity_code === 'string') await this.requireSelectable('legal-entities', fields.legal_entity_code, session);
  }

  // --- Read ----------------------------------------------------------------------------------------------------------

  private view(type: CatalogType, doc: CatalogDoc): CatalogView {
    const { _id, name_folded: _f, created_at: _c, ...rest } = doc as CatalogDoc & Record<string, unknown>;
    return { code: _id, ...rest, updated_at: doc.updated_at.toISOString(), type } as CatalogView;
  }

  async list(type: CatalogType, q: CatalogListQuery, viewer?: Viewer): Promise<{ items: (CatalogView & { usage: InUse; can_edit: boolean })[]; can_create: boolean }> {
    const filter: Filter<CatalogDoc> = {};
    if (q.status && q.status !== 'all') filter.status = { $in: q.status.split(',') as CatalogStatus[] };
    const text = q.q?.trim();
    if (text) filter.$or = [{ name_folded: { $regex: escapeRe(foldName(text)) } }, { _id: { $regex: `^${escapeRe(text)}`, $options: 'i' } }];
    if (type === 'job-titles' && q.function) (filter as Filter<Document>).default_function_code = q.function;
    const docs = await this.col(type)
      .find(filter)
      .sort(ORDERED.has(type) ? { order: 1, _id: 1 } : { _id: 1 })
      .limit(2000)
      .toArray();
    const usage = await inUseAll(this.db, type);
    const none: InUse = { positions: 0, people: 0, units: 0, rules: 0 };
    return {
      items: docs.map((d) => ({ ...this.view(type, d), usage: usage.get(d._id) ?? none, can_edit: this.canWrite(type, viewer, d) })),
      can_create: this.canWrite(type, viewer),
    };
  }

  async get(type: CatalogType, code: string, viewer?: Viewer): Promise<CatalogView & { usage: InUse; can_edit: boolean }> {
    const doc = await this.col(type).findOne({ _id: code });
    if (!doc) throw new ApiError('not_found');
    return { ...this.view(type, doc), usage: await inUse(this.db, type, code), can_edit: this.canWrite(type, viewer, doc) };
  }

  // --- Write ---------------------------------------------------------------------------------------------------------

  /** Transaction; a unique-index race (two people adding the same name at once) gets the same sentence as the check. */
  private async tx<T>(type: CatalogType, fn: (s: ClientSession) => Promise<T>): Promise<T> {
    try {
      return await withTx(this.client, fn);
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.raceDuplicate, { label: CATALOG_INFO[type].label }) });
      }
      throw e;
    }
  }

  private target(type: CatalogType, doc: { _id: string; name: string }) {
    return { type: CATALOG_INFO[type].target, id: doc._id, label: doc.name };
  }

  private auditView(doc: CatalogDoc | Record<string, unknown>): Record<string, unknown> {
    const { name_folded: _f, created_at: _c, updated_at: _u, rev: _r, ...rest } = doc as Record<string, unknown>;
    return rest;
  }

  private async record(session: ClientSession, req: Requester, type: CatalogType, action: string, doc: { _id: string; name: string }, extra: { before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string }) {
    await this.audit.record(session, {
      actor: req.actor,
      action,
      target: this.target(type, doc),
      ...extra,
      correlation_id: req.correlationId,
      ip_prefix: req.ipPrefix ?? null,
      source: { type: req.via },
    });
  }

  private async event(session: ClientSession, e: CatalogEvent) {
    await this.hooks.run(session, e);
  }

  async create(type: CatalogType, raw: unknown, req: Requester): Promise<CatalogView> {
    const input = parseInput(CATALOG_SCHEMAS[type].create, raw) as Record<string, unknown> & { code: string; name: string };
    this.assertCanWrite(type, req.viewer, [input.legal_entity_code as string | null | undefined]);
    const today = todayOn(this.clock);
    const doc = await this.tx(type, async (session) => {
      const col = this.col(type);
      if (await col.findOne({ _id: input.code }, { session })) {
        throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.codeTaken, { code: input.code }), details: { field: 'code' } });
      }
      await this.assertUniqueName(type, input.name, null, session);
      await this.checkRefs(type, input, session);
      if (type === 'legal-entities') await this.assertUniqueLegalFields(input as Partial<LegalEntityDoc>, null, session);
      const now = this.clock.now();
      const { code, ...fields } = input;
      const doc = { _id: code, ...fields, name_folded: foldName(input.name), status: 'dang_dung', status_from: today, merged_into_code: null, created_at: now, updated_at: now, rev: 1 } as Record<string, unknown>;
      if (ORDERED.has(type) && fields.order === undefined) {
        const last = await col.find({}, { session, projection: { order: 1 } }).sort({ order: -1 }).limit(1).next();
        doc.order = ((last as { order?: number } | null)?.order ?? 0) + 10;
      }
      if (type === 'legal-entities') doc.name_history = [{ name: input.name, from_on: today }];
      await col.insertOne(doc as unknown as CatalogDoc, { session });
      await this.record(session, req, type, 'catalog.create', doc as { _id: string; name: string }, { after: this.auditView(doc) });
      await this.event(session, { type, code, action: 'create', before: null, after: doc as unknown as CatalogDoc });
      return doc as unknown as CatalogDoc;
    });
    return this.view(type, doc);
  }

  async update(type: CatalogType, code: string, raw: unknown, req: Requester): Promise<CatalogView & { change?: Pick<SubmitResult, 'group_id' | 'status' | 'message' | 'warnings' | 'effective_on'> }> {
    if (raw && typeof raw === 'object' && ('code' in raw || '_id' in raw)) throw new ApiError('rule_violation', { message: CATALOG_MSG.codeFixed, details: { field: 'code' } });
    const patch = parseInput(CATALOG_SCHEMAS[type].patch, raw) as Record<string, unknown> & { rev: number; effective_on?: string; reason?: string; replace_ids?: string[] };
    const { rev, effective_on, reason, replace_ids, ...fields } = patch;
    const out = await this.tx(type, async (session) => {
      const col = this.col(type);
      const cur = await col.findOne({ _id: code }, { session });
      if (!cur) throw new ApiError('not_found');
      this.assertCanWrite(type, req.viewer, [(cur as WorkLocationDoc).legal_entity_code, fields.legal_entity_code as string | null | undefined]);
      assertRev(cur, rev);
      if (cur.status === 'da_gop') throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.alreadyStatus, { label: CATALOG_INFO[type].label, status: CATALOG_STATUS_LABEL.da_gop }) });

      // A legal entity's name changes on a date (registration), through the change core.
      let rename: string | undefined;
      if (type === 'legal-entities' && typeof fields.name === 'string') {
        if (fields.name !== cur.name) rename = fields.name;
        delete fields.name;
      }
      const changed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (JSON.stringify((cur as unknown as Record<string, unknown>)[k] ?? null) !== JSON.stringify(v ?? null)) changed[k] = v;
      if (typeof changed.name === 'string') await this.assertUniqueName(type, changed.name, code, session);
      await this.checkRefs(type, changed, session);
      if (type === 'legal-entities') await this.assertUniqueLegalFields(changed as Partial<LegalEntityDoc>, code, session);

      let doc: CatalogDoc = cur;
      if (Object.keys(changed).length) {
        const set = { ...changed, updated_at: this.clock.now(), ...(typeof changed.name === 'string' ? { name_folded: foldName(changed.name) } : {}) };
        doc = await updateByRev(col as Collection<CatalogDoc>, { _id: code }, rev, { $set: set }, session);
        const before = Object.fromEntries(Object.keys(changed).map((k) => [k, (cur as unknown as Record<string, unknown>)[k] ?? null]));
        await this.record(session, req, type, 'catalog.update', doc, { before, after: changed });
        await this.event(session, { type, code, action: 'update', before: cur, after: doc });
      }
      let change: SubmitResult | undefined;
      if (rename !== undefined) {
        if (!effective_on) throw new ApiError('rule_violation', { message: CATALOG_MSG.renameDate, details: { field: 'effective_on' } });
        change = await this.changes.submit(
          { items: [{ kind: LEGAL_RENAME, target: { type: 'catalog', id: code }, payload: { name: rename } }], effective_on, reason, replace_ids },
          req,
          session,
        );
        doc = (await col.findOne({ _id: code }, { session })) as CatalogDoc;
      }
      return { doc, change };
    });
    const view = this.view(type, out.doc);
    if (!out.change) return view;
    const { group_id, status, message, warnings, effective_on: on } = out.change;
    return { ...view, change: { group_id, status, message, warnings, effective_on: on } };
  }

  private async setStatus(type: CatalogType, code: string, raw: unknown, req: Requester, to: 'ngung' | 'dang_dung'): Promise<CatalogView> {
    const { rev, reason } = parseInput(CatalogStatusChange, raw);
    const today = todayOn(this.clock);
    const doc = await this.tx(type, async (session) => {
      const col = this.col(type);
      const cur = await col.findOne({ _id: code }, { session });
      if (!cur) throw new ApiError('not_found');
      this.assertCanWrite(type, req.viewer, [(cur as WorkLocationDoc).legal_entity_code]);
      assertRev(cur, rev);
      const from: CatalogStatus = to === 'ngung' ? 'dang_dung' : 'ngung';
      if (cur.status !== from) {
        throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.alreadyStatus, { label: CATALOG_INFO[type].label, status: CATALOG_STATUS_LABEL[cur.status] }) });
      }
      if (to === 'ngung') await this.assertCanStop(type, code, session);
      const doc = await updateByRev(col as Collection<CatalogDoc>, { _id: code }, rev, { $set: { status: to, status_from: today, updated_at: this.clock.now() } }, session);
      await this.record(session, req, type, to === 'ngung' ? 'catalog.deactivate' : 'catalog.activate', doc, { before: { status: cur.status }, after: { status: to }, reason: reason || undefined });
      await this.event(session, { type, code, action: to === 'ngung' ? 'deactivate' : 'activate', before: cur, after: doc });
      return doc;
    });
    return this.view(type, doc);
  }

  /** Ngừng is blocked while the entry is in use (04 VH-ORG-03 bước 4, VH-ORG-07 bước 5; titles: rules from GĐ C). */
  private async assertCanStop(type: CatalogType, code: string, session: ClientSession): Promise<void> {
    const u = await inUse(this.db, type, code, session);
    const fail = (message: string) => {
      throw new ApiError('rule_violation', { message, details: { usage: u } });
    };
    if (type === 'job-titles' && u.rules) fail(fillMsg(CATALOG_MSG.titleInRules, { n: u.rules }));
    if (type === 'job-functions' && u.positions + u.rules) fail(fillMsg(CATALOG_MSG.functionInUse, { n: u.positions, m: u.rules }));
    if (type === 'legal-entities' && u.people + u.units) fail(fillMsg(CATALOG_MSG.legalInUse, { n: u.people, m: u.units }));
    if (type === 'work-locations' && u.people) fail(fillMsg(CATALOG_MSG.locationInUse, { n: u.people }));
  }

  deactivate(type: CatalogType, code: string, raw: unknown, req: Requester): Promise<CatalogView> {
    return this.setStatus(type, code, raw, req, 'ngung');
  }

  activate(type: CatalogType, code: string, raw: unknown, req: Requester): Promise<CatalogView> {
    return this.setStatus(type, code, raw, req, 'dang_dung');
  }

  /** Xoá: only an entry never used anywhere (04 VH-ORG-02 bước 5); otherwise Ngừng. */
  async remove(type: CatalogType, code: string, rev: unknown, req: Requester): Promise<{ code: string; deleted: true }> {
    await this.tx(type, async (session) => {
      const col = this.col(type);
      const cur = await col.findOne({ _id: code }, { session });
      if (!cur) throw new ApiError('not_found');
      this.assertCanWrite(type, req.viewer, [(cur as WorkLocationDoc).legal_entity_code]);
      assertRev(cur, typeof rev === 'string' && /^\d+$/.test(rev) ? Number(rev) : rev);
      if (await everUsed(this.db, type, code, session)) {
        throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.usedNoDelete, { label: CATALOG_INFO[type].label }) });
      }
      await col.deleteOne({ _id: code }, { session });
      await this.record(session, req, type, 'catalog.delete', cur, { before: this.auditView(cur) });
      await this.event(session, { type, code, action: 'delete', before: cur, after: null });
    });
    return { code, deleted: true };
  }
}

export const LEGAL_RENAME = 'legal_entity_rename';
