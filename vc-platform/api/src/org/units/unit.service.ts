/**
 * Unit tree (04 VH-ORG-01, 04). Name, short name, order, group email, description, function apply at once; creating,
 * moving and the head of unit go through the change core (dates, conflicts, ≥ 21 people confirmation). In GĐ B a move
 * and a stop take effect today (VH-ORG-01 bước 4); scheduled restructuring is VH-ORG-05 in GĐ C.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  OrgUnitCreate,
  OrgUnitHead,
  OrgUnitMove,
  OrgUnitPatch,
  OrgUnitStatusChange,
  UNIT_MSG,
  UNIT_PARENTS,
  UNIT_STATUS_LABEL,
  UNIT_TYPE_LABEL,
  addDays,
  fillMsg,
  foldName,
  type UnitType,
} from '@vc/contracts';
import { ObjectId, type ClientSession, type Db, type MongoClient } from 'mongodb';
import { AuditService } from '../../audit/audit.service';
import type { Viewer } from '../../auth/viewer';
import { ApiError } from '../../common/api-error';
import { CLOCK, todayOn, type Clock } from '../../common/clock';
import { assertRev, updateByRev } from '../../common/rev';
import { withTx } from '../../common/tx';
import { parseInput } from '../../common/zod.pipe';
import { ENV, type Env } from '../../config/env';
import { C } from '../../db/collections';
import { DB, MONGO_CLIENT } from '../../db/mongo';
import { ChangeService, type Requester, type SubmitResult } from '../../people/changes/change.service';
import { CatalogService } from '../catalogs/catalog.service';
import { assertUnitScope, auditView, personName, UNIT_CREATE, UNIT_HEAD, UNIT_MOVE, unitInScope } from './handlers';
import { HeadReports } from './head-reports';
import { checkPlacement, depthOf, recomputeBranch, units } from './tree';
import type { OrgUnitDoc, PersonLite } from './types';

const rule = (message: string, details?: unknown) => new ApiError('rule_violation', { message, details });

export interface UnitCounts {
  /** People with an active main position here. */
  primary: number;
  /** Active concurrent positions here. */
  concurrent: number;
  /** Units right under this one (not deleted), and those still active. */
  children: number;
  active_children: number;
}

type ChangeOut = Pick<SubmitResult, 'group_id' | 'status' | 'message' | 'warnings' | 'effective_on' | 'affected_people'>;
const changeOut = (r: SubmitResult): ChangeOut => ({ group_id: r.group_id, status: r.status, message: r.message, warnings: r.warnings, effective_on: r.effective_on, affected_people: r.affected_people });

@Injectable()
export class UnitService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly changes: ChangeService,
    private readonly catalogs: CatalogService,
    private readonly headReports: HeadReports,
  ) {}

  private get col() {
    return units(this.db);
  }

  private get root() {
    return this.env.ROOT_UNIT_CODE;
  }

  private async load(code: string, session?: ClientSession): Promise<OrgUnitDoc> {
    const u = await this.col.findOne({ _id: code, deleted_at: null }, { session });
    if (!u) throw new ApiError('not_found');
    return u;
  }

  // --- Read ----------------------------------------------------------------------------------------------------------

  private view(u: OrgUnitDoc) {
    const { _id, name_folded: _f, created_at: _c, head_history: _h, ...rest } = u;
    return { code: _id, ...rest, head_person_id: u.head_person_id ? String(u.head_person_id) : null, depth: depthOf(u), updated_at: u.updated_at.toISOString() };
  }

  private async counts(): Promise<Map<string, UnitCounts>> {
    const out = new Map<string, UnitCounts>();
    const get = (code: string) => {
      let c = out.get(code);
      if (!c) out.set(code, (c = { primary: 0, concurrent: 0, children: 0, active_children: 0 }));
      return c;
    };
    const pos = await this.db
      .collection(C.positions)
      .aggregate<{ _id: { unit: string; kind: string }; n: number }>([{ $match: { active: true } }, { $group: { _id: { unit: '$unit_code', kind: '$kind' }, n: { $sum: 1 } } }])
      .toArray();
    for (const r of pos) {
      if (r._id.kind === 'kiem_nhiem') get(r._id.unit).concurrent += r.n;
      else get(r._id.unit).primary += r.n;
    }
    const kids = await this.col
      .aggregate<{ _id: string; n: number; active: number }>([
        { $match: { deleted_at: null, parent_code: { $ne: null } } },
        { $group: { _id: '$parent_code', n: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'hoat_dong'] }, 1, 0] } } } },
      ])
      .toArray();
    for (const r of kids) Object.assign(get(r._id), { children: r.n, active_children: r.active });
    return out;
  }

  private async names(ids: (ObjectId | null)[]): Promise<Map<string, PersonLite>> {
    const list = ids.filter((x): x is ObjectId => !!x);
    if (!list.length) return new Map();
    const docs = await this.db.collection<PersonLite>(C.people).find({ _id: { $in: list } }, { projection: { full_name: 1, employee_code: 1 } }).toArray();
    return new Map(docs.map((d) => [String(d._id), d]));
  }

  /**
   * The whole tree as a flat list (VH-MH-12 builds it). `q` keeps units whose folded name matches and their ancestors,
   * so "to ban hang 1" opens the right branch (VH-ORG-01 tiêu chí 4). Stopped units stay, with their status (tiêu chí 5).
   */
  async list(q: { q?: string; status?: string }, viewer?: Viewer) {
    let docs = await this.col.find({ deleted_at: null }).sort({ order: 1, name_folded: 1 }).toArray();
    if (q.status === 'hoat_dong' || q.status === 'ngung') docs = docs.filter((d) => d.status === q.status);
    const text = q.q?.trim();
    let matched: Set<string> | null = null;
    if (text) {
      const f = foldName(text);
      const hits = docs.filter((d) => d.name_folded.includes(f) || d._id.toLowerCase().startsWith(text.toLowerCase()) || (d.short_name && foldName(d.short_name).includes(f)));
      matched = new Set(hits.map((h) => h._id));
      const keep = new Set(hits.flatMap((h) => [...h.ancestors, h._id]));
      docs = docs.filter((d) => keep.has(d._id));
    }
    const counts = await this.counts();
    const heads = await this.names(docs.map((d) => d.head_person_id));
    const none: UnitCounts = { primary: 0, concurrent: 0, children: 0, active_children: 0 };
    return {
      root_code: docs.find((d) => d.type === 'tap_doan')?._id ?? this.root,
      items: docs.map((d) => ({
        ...this.view(d),
        head_name: d.head_person_id ? (heads.get(String(d.head_person_id))?.full_name ?? null) : null,
        counts: counts.get(d._id) ?? none,
        can_edit: unitInScope(viewer, d, this.root),
        ...(matched ? { matched: matched.has(d._id) } : {}),
      })),
    };
  }

  /** Detail on the right of VH-MH-12 (VH-ORG-01 bước 8): counts, path from the root, head and its history, pending changes. */
  async get(code: string, viewer?: Viewer) {
    const u = await this.load(code);
    const path = await this.col.find({ _id: { $in: u.ancestors } }, { projection: { name: 1 } }).toArray();
    const byCode = new Map(path.map((p) => [p._id, p.name]));
    const people = await this.names([u.head_person_id, ...u.head_history.map((h) => h.person_id)]);
    const counts = (await this.counts()).get(code) ?? { primary: 0, concurrent: 0, children: 0, active_children: 0 };
    const pending = await this.db
      .collection(C.scheduledChanges)
      .find({ 'target.type': 'org_unit', 'target.id': code, status: { $in: ['cho_ap', 'cho_xac_nhan'] } })
      .sort({ effective_at: 1 })
      .toArray();
    return {
      ...this.view(u),
      path: [...u.ancestors.map((c) => ({ code: c, name: byCode.get(c) ?? c })), { code: u._id, name: u.name }],
      head: u.head_person_id ? { person_id: String(u.head_person_id), name: people.get(String(u.head_person_id))?.full_name ?? null, employee_code: people.get(String(u.head_person_id))?.employee_code ?? null } : null,
      head_history: u.head_history.map((h) => ({ person_id: String(h.person_id), name: people.get(String(h.person_id))?.full_name ?? null, from_on: h.from_on, to_on: h.to_on })),
      counts,
      pending_changes: pending.map((p) => ({ id: String(p._id), group_id: String(p.group_id), kind: p.kind, effective_on: p.effective_on, status: p.status })),
      can_edit: unitInScope(viewer, u, this.root),
    };
  }

  /** Audit rows of the unit, newest first (VH-MH-12 "Lịch sử"). */
  async history(code: string) {
    await this.load(code);
    const rows = await this.db.collection(C.auditLog).find({ 'target.type': 'org_unit', 'target.id': code }).sort({ at: -1 }).limit(200).toArray();
    return rows.map(({ _id, hash: _h, prev_hash: _p, ...r }) => ({ id: String(_id), ...r }));
  }

  // --- Write ---------------------------------------------------------------------------------------------------------

  /** "Thêm đơn vị con": today unless a date is given (imports). */
  async create(raw: unknown, req: Requester) {
    const input = parseInput(OrgUnitCreate, raw);
    const { effective_on, reason, ...payload } = input;
    const result = await this.changes.submit(
      { items: [{ kind: UNIT_CREATE, target: { type: 'org_unit', id: payload.code }, payload: payload as Record<string, unknown> }], effective_on: effective_on ?? todayOn(this.clock), reason },
      req,
    );
    const unit = await this.col.findOne({ _id: payload.code, deleted_at: null });
    return { unit: unit ? this.view(unit) : null, change: changeOut(result) };
  }

  async update(code: string, raw: unknown, req: Requester) {
    if (raw && typeof raw === 'object' && ('code' in raw || '_id' in raw)) throw rule('Mã không đổi được sau khi tạo.', { field: 'code' });
    if (raw && typeof raw === 'object' && 'parent_code' in raw) throw rule('Đổi đơn vị cha bằng thao tác "Chuyển".', { field: 'parent_code' });
    const { rev, reason, ...fields } = parseInput(OrgUnitPatch, raw);
    const doc = await withTx(this.client, async (session) => {
      const cur = await this.load(code, session);
      assertUnitScope(req.viewer, cur, this.root);
      assertRev(cur, rev);
      const changed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (JSON.stringify((cur as unknown as Record<string, unknown>)[k] ?? null) !== JSON.stringify(v ?? null)) changed[k] = v;
      if (!Object.keys(changed).length) return cur;
      const parent = cur.parent_code ? await this.col.findOne({ _id: cur.parent_code }, { session }) : null;
      const type = (changed.type as UnitType | undefined) ?? cur.type;
      if (changed.type !== undefined) await this.checkTypeChange(cur, type, parent, session);
      if (typeof changed.name === 'string' && parent) {
        const dup = await this.col.findOne({ parent_code: parent._id, name_folded: foldName(changed.name), status: 'hoat_dong', deleted_at: null, _id: { $ne: code } }, { session });
        if (dup) throw rule(fillMsg(UNIT_MSG.nameTaken, { ten: dup.name }), { field: 'name' });
      }
      if (changed.legal_entity_code !== undefined) {
        const own = type === 'phap_nhan' || !parent || parent.type === 'tap_doan';
        if (!own) throw rule(UNIT_MSG.legalInherited, { field: 'legal_entity_code' });
        if (changed.legal_entity_code === null && parent) throw rule(UNIT_MSG.chooseLegal, { field: 'legal_entity_code' });
        if (changed.legal_entity_code) await this.catalogs.requireSelectable('legal-entities', changed.legal_entity_code as string, session);
        if (type === 'phap_nhan' && changed.legal_entity_code) {
          const linked = await this.col.findOne({ type: 'phap_nhan', legal_entity_code: changed.legal_entity_code as string, deleted_at: null, _id: { $ne: code } }, { session });
          if (linked) throw rule(fillMsg(UNIT_MSG.legalLinked, { ma: changed.legal_entity_code as string, ten: linked.name }), { field: 'legal_entity_code' });
        }
      }
      if (changed.function_code) await this.catalogs.requireSelectable('job-functions', changed.function_code as string, session);
      // The new legal entity must be in the editor's scope too.
      if (changed.legal_entity_code !== undefined) assertUnitScope(req.viewer, { legal_entity_code: changed.legal_entity_code as string | null, division_code: null }, this.root);
      const now = this.clock.now();
      const set = { ...changed, updated_at: now, ...(typeof changed.name === 'string' ? { name_folded: foldName(changed.name) } : {}) };
      const doc = await updateByRev(this.col, { _id: code }, rev, { $set: set, $inc: { event_seq: 1 } }, session);
      const branch = changed.type !== undefined || changed.legal_entity_code !== undefined ? await recomputeBranch(this.db, code, session, now) : [];
      const before = Object.fromEntries(Object.keys(changed).map((k) => [k, (cur as unknown as Record<string, unknown>)[k] ?? null]));
      await this.record(session, req, 'org_unit.update', doc, { before, after: { ...changed, ...(branch.length ? { branch_updated: branch.length } : {}) }, reason });
      return (await this.col.findOne({ _id: code }, { session })) as OrgUnitDoc;
    });
    return this.view(doc);
  }

  /** Type: fixed once the unit has had a position (04 bảng trường); must still fit its parent and its children. */
  private async checkTypeChange(cur: OrgUnitDoc, type: UnitType, parent: OrgUnitDoc | null, session: ClientSession): Promise<void> {
    if (cur.type === 'tap_doan' || type === 'tap_doan') throw rule(UNIT_MSG.oneRoot);
    if (await this.db.collection(C.positions).findOne({ unit_code: cur._id }, { session, projection: { _id: 1 } })) throw rule(UNIT_MSG.typeFixed, { field: 'type' });
    const grand = parent?.parent_code ? await this.col.findOne({ _id: parent.parent_code }, { session, projection: { type: 1 } }) : null;
    const children = await this.col.find({ parent_code: cur._id, deleted_at: null }, { session }).toArray();
    checkPlacement(type, parent, grand?.type ?? null, type === 'to_nhom' && children.some((c) => c.type === 'to_nhom'));
    for (const c of children) {
      if (!UNIT_PARENTS[c.type].includes(type)) {
        throw rule(fillMsg(UNIT_MSG.placement, { loai: UNIT_TYPE_LABEL[c.type], loai_cha: UNIT_PARENTS[c.type].map((t) => UNIT_TYPE_LABEL[t]).join(', ') }));
      }
      if (c.type === 'to_nhom' && type === 'to_nhom' && parent?.type === 'to_nhom') throw rule(UNIT_MSG.nested);
    }
    if (type === 'phap_nhan' && !cur.legal_entity_code) throw rule(UNIT_MSG.chooseLegal, { field: 'legal_entity_code' });
  }

  /** "Chuyển" (VH-ORG-01 bước 7): today in GĐ B; ≥ 21 people in the branch wait for a second admin (VH-BR-25). */
  async move(code: string, raw: unknown, req: Requester) {
    const { parent_code, legal_entity_code, rev, reason, replace_ids } = parseInput(OrgUnitMove, raw);
    const result = await withTx(this.client, async (session) => {
      const cur = await this.load(code, session);
      assertRev(cur, rev);
      return this.changes.submit(
        {
          items: [{ kind: UNIT_MOVE, target: { type: 'org_unit', id: code }, payload: { parent_code, ...(legal_entity_code !== undefined ? { legal_entity_code } : {}) } }],
          effective_on: todayOn(this.clock),
          reason,
          replace_ids,
        },
        req,
        session,
      );
    });
    return { unit: this.view(await this.load(code)), change: changeOut(result) };
  }

  /** "Ngừng" (VH-ORG-01 bước 5): no active position (main or concurrent), no active child unit. */
  async deactivate(code: string, raw: unknown, req: Requester) {
    const { rev, reason } = parseInput(OrgUnitStatusChange, raw);
    const today = todayOn(this.clock);
    const doc = await withTx(this.client, async (session) => {
      const cur = await this.load(code, session);
      assertUnitScope(req.viewer, cur, this.root);
      assertRev(cur, rev);
      if (cur.type === 'tap_doan') throw rule(UNIT_MSG.rootFixed);
      if (cur.status !== 'hoat_dong') throw rule(`Đơn vị ${cur.name} đang ở trạng thái ${UNIT_STATUS_LABEL[cur.status]}.`);
      const n = await this.db.collection(C.positions).countDocuments({ unit_code: code, active: true }, { session });
      const m = await this.col.countDocuments({ parent_code: code, status: 'hoat_dong', deleted_at: null }, { session });
      if (n + m) throw rule(fillMsg(UNIT_MSG.stopInUse, { n, m }), { positions: n, children: m });
      const last = addDays(today, -1) < cur.effective_from_on ? cur.effective_from_on : addDays(today, -1);
      const set: Record<string, unknown> = { status: 'ngung', effective_to_on: last, updated_at: this.clock.now() };
      if (cur.head_person_id) {
        set.head_person_id = null;
        set.head_history = cur.head_history.map((t) => (t.to_on === null ? { ...t, to_on: last } : t));
        await this.db.collection<PersonLite>(C.people).updateOne({ _id: cur.head_person_id }, { $pull: { head_of_unit_codes: code } as never }, { session });
      }
      const doc = await updateByRev(this.col, { _id: code }, rev, { $set: set, $inc: { event_seq: 1 } }, session);
      await this.record(session, req, 'org_unit.deactivate', doc, {
        before: { status: cur.status, head_person_id: cur.head_person_id ? String(cur.head_person_id) : null },
        after: { status: 'ngung', effective_to_on: last },
        reason,
      });
      return doc;
    });
    return this.view(doc);
  }

  /** "Xoá" a unit made by mistake (VH-ORG-01 bước 6): soft delete; never had a position; no child unit. */
  async remove(code: string, rev: unknown, req: Requester) {
    await withTx(this.client, async (session) => {
      const cur = await this.load(code, session);
      assertUnitScope(req.viewer, cur, this.root);
      assertRev(cur, typeof rev === 'string' && /^\d+$/.test(rev) ? Number(rev) : rev);
      if (cur.type === 'tap_doan') throw rule(UNIT_MSG.rootFixed);
      const m = await this.col.countDocuments({ parent_code: code, deleted_at: null }, { session });
      if (m) throw rule(fillMsg(UNIT_MSG.childrenNoDelete, { m }));
      if (await this.db.collection(C.positions).findOne({ unit_code: code }, { session, projection: { _id: 1 } })) throw rule(UNIT_MSG.usedNoDelete);
      const now = this.clock.now();
      await updateByRev(this.col, { _id: code }, cur.rev, { $set: { deleted_at: now, status: 'ngung', effective_to_on: cur.effective_to_on ?? todayOn(this.clock), updated_at: now } }, session);
      await this.record(session, req, 'org_unit.delete', cur, { before: auditView(cur) });
    });
    return { code, deleted: true as const };
  }

  /** "Đặt trưởng đơn vị" (VH-ORG-04): from a date (today by default); optionally move the old head's reports. */
  async setHead(code: string, raw: unknown, req: Requester) {
    const input = parseInput(OrgUnitHead, raw);
    const on = input.effective_on ?? todayOn(this.clock);
    const result = await withTx(this.client, async (session) => {
      const unit = await this.load(code, session);
      const items = [{ kind: UNIT_HEAD, target: { type: 'org_unit' as const, id: code }, payload: { person_id: input.person_id, replace_current: input.replace_current } }];
      if (input.update_reports && input.person_id && unit.head_person_id) {
        items.push(...((await this.headReports.items(this.db, session, code, unit.head_person_id, new ObjectId(input.person_id), on)) as typeof items));
      }
      return this.changes.submit({ items, effective_on: on, reason: input.reason, replace_ids: input.replace_ids }, req, session);
    });
    return { unit: this.view(await this.load(code)), change: changeOut(result) };
  }

  /** Before "Đặt trưởng": the current head and how many people report to them in this unit (VH-ORG-04 bước 4). */
  async headPreview(code: string) {
    const u = await this.load(code);
    const reports = u.head_person_id
      ? (await this.db.collection(C.positions).distinct('person_id', { unit_code: code, manager_person_id: u.head_person_id, active: true })).length
      : 0;
    return {
      current_head: u.head_person_id ? { person_id: String(u.head_person_id), name: await personName(this.db, u.head_person_id) } : null,
      reports_count: reports,
      update_reports_available: this.headReports.available,
    };
  }

  private async record(session: ClientSession, req: Requester, action: string, u: OrgUnitDoc, extra: { before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string }) {
    await this.audit.record(session, {
      actor: req.actor,
      action,
      target: { type: 'org_unit', id: u._id, label: u.name },
      ...extra,
      reason: extra.reason || undefined,
      correlation_id: req.correlationId,
      ip_prefix: req.ipPrefix ?? null,
      source: { type: req.via },
    });
  }
}
