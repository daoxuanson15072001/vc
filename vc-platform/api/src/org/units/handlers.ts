/**
 * Change kinds of the unit tree, applied through the change core (B-03): `unit_create`, `unit_move` (≥ 21 people in the
 * branch wait for a second admin, VH-BR-25) and `unit_head` (head of unit from a date, VH-ORG-04).
 */
import { MAX_UNIT_DEPTH, UNIT_MSG, UNIT_STATUS_LABEL, addDays, fillMsg, foldName, formatVnDate, tidyName, UNIT_TYPES, type UnitType } from '@vc/contracts';
import { ObjectId, type ClientSession, type Db } from 'mongodb';
import { z } from 'zod';
import type { Viewer } from '../../auth/viewer';
import { ApiError } from '../../common/api-error';
import type { ChangeContext, ChangeHandler, ChangeItem } from '../../common/changes';
import { C } from '../../db/collections';
import type { CatalogService } from '../catalogs/catalog.service';
import { checkMove, checkPlacement, depthOf, derive, descendants, ownsLegalEntity, recomputeBranch, units } from './tree';
import type { OrgUnitDoc, PersonLite } from './types';

export const UNIT_CREATE = 'unit_create';
export const UNIT_MOVE = 'unit_move';
export const UNIT_HEAD = 'unit_head';

const rule = (message: string, details?: unknown) => new ApiError('rule_violation', { message, details });
const notFound = (code: string) => rule(`Đơn vị ${code} không có.`);

/** HC-NS scope over units: the unit's legal entity or division (kế hoạch GĐ B mục 3.3 điểm 6); the root code means all. */
export function unitInScope(viewer: Viewer | undefined, u: Pick<OrgUnitDoc, 'legal_entity_code' | 'division_code'>, rootCode: string): boolean {
  if (!viewer || viewer.hcnsScope === 'all') return true;
  const s = viewer.hcnsScope ?? [];
  if (s.includes(rootCode)) return true;
  return (u.legal_entity_code != null && s.includes(u.legal_entity_code)) || (u.division_code != null && s.includes(u.division_code));
}

export const OUT_OF_SCOPE = 'Đơn vị nằm ngoài phạm vi HC-NS của bạn.';

export function assertUnitScope(viewer: Viewer | undefined, u: Pick<OrgUnitDoc, 'legal_entity_code' | 'division_code'>, rootCode: string): void {
  if (!unitInScope(viewer, u, rootCode)) throw new ApiError('forbidden', { message: OUT_OF_SCOPE });
}

/** People with an active position (main or concurrent) in these units (kế hoạch GĐ B mục 3.3 điểm 10). */
export async function peopleIn(db: Db, codes: string[], session?: ClientSession): Promise<string[]> {
  const ids = await db.collection(C.positions).distinct('person_id', { unit_code: { $in: codes }, active: true }, { session });
  return ids.map(String);
}

const statusLabel = (u: OrgUnitDoc) => (u.deleted_at ? UNIT_STATUS_LABEL.da_xoa : UNIT_STATUS_LABEL[u.status]);

// --- unit_create ---------------------------------------------------------------------------------------------------

export const CreatePayload = z.object({
  code: z.string(),
  name: z.string().transform(tidyName),
  short_name: z.string().nullable(),
  type: z.enum(UNIT_TYPES),
  parent_code: z.string(),
  legal_entity_code: z.string().nullable(),
  function_code: z.string().nullable(),
  order: z.number().int().optional(),
  group_email: z.string().nullable(),
  description: z.string(),
});
export type CreatePayload = z.infer<typeof CreatePayload>;

/** The parent as it will be on the effective date: existing, or created by a pending change on or before it. */
async function parentAt(ctx: ChangeContext, code: string): Promise<{ parent: OrgUnitDoc; grandType: UnitType | null } | null> {
  const col = units(ctx.db);
  const p = await col.findOne({ _id: code, deleted_at: null }, { session: ctx.session });
  if (p) {
    const g = p.parent_code ? await col.findOne({ _id: p.parent_code }, { session: ctx.session, projection: { type: 1 } }) : null;
    return { parent: p, grandType: g?.type ?? null };
  }
  if (ctx.phase !== 'submit') return null;
  const [pending] = await ctx.pendingUntil(ctx.effectiveOn, { kind: UNIT_CREATE, 'payload.code': code });
  if (!pending) return null;
  const pp = pending.payload as CreatePayload;
  const g = await col.findOne({ _id: pp.parent_code, deleted_at: null }, { session: ctx.session });
  if (!g) return null;
  const virtual = { _id: pp.code, name: pp.name, type: pp.type, parent_code: pp.parent_code, status: 'hoat_dong', ...derive({ _id: pp.code, type: pp.type, legal_entity_code: pp.legal_entity_code }, g) } as OrgUnitDoc;
  return { parent: virtual, grandType: g.type };
}

async function checkSiblingName(db: Db, session: ClientSession, parentCode: string, name: string, except?: string): Promise<void> {
  const dup = await units(db).findOne({ parent_code: parentCode, name_folded: foldName(name), status: 'hoat_dong', deleted_at: null, ...(except ? { _id: { $ne: except } } : {}) }, { session });
  if (dup) throw rule(fillMsg(UNIT_MSG.nameTaken, { ten: dup.name }), { field: 'name' });
}

/** The legal entity rule of 04 VH-ORG-01 bước 3, and the 1–1 link of a Pháp nhân unit. */
async function checkLegal(db: Db, session: ClientSession, catalogs: CatalogService, type: UnitType, parent: OrgUnitDoc, legal: string | null, self?: string): Promise<void> {
  if (!ownsLegalEntity(type, parent)) {
    if (legal && legal !== parent.legal_entity_code) throw rule(UNIT_MSG.legalInherited, { field: 'legal_entity_code' });
    return;
  }
  if (!legal) throw rule(UNIT_MSG.chooseLegal, { field: 'legal_entity_code' });
  await catalogs.requireSelectable('legal-entities', legal, session);
  if (type === 'phap_nhan') {
    const linked = await units(db).findOne({ type: 'phap_nhan', legal_entity_code: legal, deleted_at: null, ...(self ? { _id: { $ne: self } } : {}) }, { session });
    if (linked) throw rule(fillMsg(UNIT_MSG.legalLinked, { ma: legal, ten: linked.name }), { field: 'legal_entity_code' });
  }
}

export function unitCreate(catalogs: CatalogService, rootCode: string): ChangeHandler<CreatePayload> {
  return {
    kind: UNIT_CREATE,
    category: 'co_cau',
    permission: 'co_cau.sua',
    schema: CreatePayload,
    conflictKeys: (it) => [`org_unit:${it.payload.code}:exists`],
    describe: (it) => `tạo đơn vị ${it.payload.code} "${it.payload.name}"`,
    async authorize(viewer, it, db) {
      const parent = await units(db).findOne({ _id: it.payload.parent_code });
      if (!parent) return; // validate says "không có"
      assertUnitScope(viewer, { ...derive({ _id: it.payload.code, type: it.payload.type, legal_entity_code: it.payload.legal_entity_code }, parent) }, rootCode);
    },
    async validate(ctx, it) {
      const p = it.payload;
      const s = ctx.session;
      const existing = await units(ctx.db).findOne({ _id: p.code }, { session: s });
      if (existing) throw rule(fillMsg(UNIT_MSG.codeUsed, { ma: p.code, ten: existing.name, trang_thai: statusLabel(existing) }), { field: 'code' });
      const at = await parentAt(ctx, p.parent_code);
      if (!at) throw notFound(p.parent_code);
      if (at.parent.status !== 'hoat_dong') throw rule(fillMsg(UNIT_MSG.parentStopped, { ten: at.parent.name }));
      checkPlacement(p.type, at.parent, at.grandType);
      if (depthOf(at.parent) + 1 > MAX_UNIT_DEPTH) throw rule(UNIT_MSG.depth);
      await checkSiblingName(ctx.db, s, p.parent_code, p.name);
      await checkLegal(ctx.db, s, catalogs, p.type, at.parent, p.legal_entity_code);
      if (p.function_code) await catalogs.requireSelectable('job-functions', p.function_code, s);
    },
    affectedPeople: async () => [],
    async apply(ctx, ch) {
      const p = ch.payload;
      const col = units(ctx.db);
      const parent = (await col.findOne({ _id: p.parent_code }, { session: ctx.session })) as OrgUnitDoc;
      const order = p.order ?? ((await col.find({ parent_code: p.parent_code }, { session: ctx.session }).sort({ order: -1 }).limit(1).next())?.order ?? 0) + 10;
      const now = ctx.clock.now();
      const doc: OrgUnitDoc = {
        _id: p.code,
        name: p.name,
        name_folded: foldName(p.name),
        short_name: p.short_name,
        type: p.type,
        parent_code: p.parent_code,
        ...derive({ _id: p.code, type: p.type, legal_entity_code: p.legal_entity_code }, parent),
        function_code: p.function_code,
        head_person_id: null,
        head_history: [],
        status: 'hoat_dong',
        effective_from_on: ch.effective_on,
        effective_to_on: null,
        merged_into_code: null,
        order,
        group_email: p.group_email,
        description: p.description,
        deleted_at: null,
        event_seq: 1,
        created_at: now,
        updated_at: now,
        rev: 1,
      };
      await col.insertOne(doc, { session: ctx.session });
      await ctx.audit({ action: 'org_unit.create', target: { type: 'org_unit', id: doc._id, label: doc.name }, after: auditView(doc) });
    },
  };
}

export function auditView(u: OrgUnitDoc): Record<string, unknown> {
  const { name_folded: _f, created_at: _c, updated_at: _u, rev: _r, head_history: _h, event_seq: _e, ...rest } = u;
  return { ...rest, head_person_id: u.head_person_id ? String(u.head_person_id) : null };
}

// --- unit_move -----------------------------------------------------------------------------------------------------

const MovePayload = z.object({ parent_code: z.string(), legal_entity_code: z.string().nullable().optional() });
type MovePayload = z.infer<typeof MovePayload>;

export function unitMove(catalogs: CatalogService, rootCode: string): ChangeHandler<MovePayload> {
  async function load(db: Db, session: ClientSession | undefined, it: ChangeItem<MovePayload>) {
    const col = units(db);
    const unit = await col.findOne({ _id: it.target.id, deleted_at: null }, { session });
    const target = await col.findOne({ _id: it.payload.parent_code, deleted_at: null }, { session });
    return { unit, target };
  }
  return {
    kind: UNIT_MOVE,
    category: 'co_cau',
    permission: 'co_cau.sua',
    schema: MovePayload,
    conflictKeys: (it) => [`org_unit:${it.target.id}:parent`],
    describe: (it) => `chuyển đơn vị ${it.target.id} sang dưới ${it.payload.parent_code}`,
    async authorize(viewer, it, db) {
      const { unit, target } = await load(db, undefined, it);
      if (unit) assertUnitScope(viewer, unit, rootCode);
      if (unit && target) assertUnitScope(viewer, derive(unit, target), rootCode);
    },
    async validate(ctx, it) {
      const s = ctx.session;
      const { unit, target } = await load(ctx.db, s, it);
      if (!unit) throw notFound(it.target.id);
      if (unit.type === 'tap_doan') throw rule(UNIT_MSG.rootFixed);
      if (unit.status !== 'hoat_dong') throw rule(`Đơn vị ${unit.name} đã ngừng, không chuyển được.`);
      if (!target) throw notFound(it.payload.parent_code);
      if (target.status !== 'hoat_dong') throw rule(fillMsg(UNIT_MSG.parentStopped, { ten: target.name }));
      if (target._id === unit.parent_code) throw rule(`${unit.name} đã nằm dưới ${target.name}.`);
      const grand = target.parent_code ? await units(ctx.db).findOne({ _id: target.parent_code }, { session: s, projection: { type: 1 } }) : null;
      checkMove(unit, target, grand?.type ?? null, await descendants(ctx.db, unit._id, s));
      await checkSiblingName(ctx.db, s, target._id, unit.name, unit._id);
      const legal = ownsLegalEntity(unit.type, target) ? (it.payload.legal_entity_code ?? unit.legal_entity_code) : (it.payload.legal_entity_code ?? null);
      await checkLegal(ctx.db, s, catalogs, unit.type, target, legal, unit._id);
    },
    async affectedPeople(ctx, it) {
      const below = await descendants(ctx.db, it.target.id, ctx.session);
      return peopleIn(ctx.db, [it.target.id, ...below.map((d) => d._id)], ctx.session);
    },
    async apply(ctx, ch) {
      const col = units(ctx.db);
      const unit = (await col.findOne({ _id: ch.target.id }, { session: ctx.session })) as OrgUnitDoc;
      const target = (await col.findOne({ _id: ch.payload.parent_code }, { session: ctx.session })) as OrgUnitDoc;
      const own = ownsLegalEntity(unit.type, target);
      const now = ctx.clock.now();
      await col.updateOne(
        { _id: unit._id },
        { $set: { parent_code: target._id, ...(own ? { legal_entity_code: ch.payload.legal_entity_code ?? unit.legal_entity_code } : {}), updated_at: now }, $inc: { rev: 1, event_seq: 1 } },
        { session: ctx.session },
      );
      const changed = await recomputeBranch(ctx.db, unit._id, ctx.session, now);
      const after = (await col.findOne({ _id: unit._id }, { session: ctx.session })) as OrgUnitDoc;
      await ctx.audit({
        action: 'org_unit.move',
        target: { type: 'org_unit', id: unit._id, label: unit.name },
        before: { parent_code: unit.parent_code, ancestors: unit.ancestors, division_code: unit.division_code, legal_entity_code: unit.legal_entity_code },
        after: { parent_code: after.parent_code, ancestors: after.ancestors, division_code: after.division_code, legal_entity_code: after.legal_entity_code, branch_updated: changed.length },
      });
    },
  };
}

// --- unit_head -----------------------------------------------------------------------------------------------------

const HeadPayload = z.object({ person_id: z.string().regex(/^[0-9a-f]{24}$/).nullable(), replace_current: z.boolean() });
type HeadPayload = z.infer<typeof HeadPayload>;

export async function personName(db: Db, id: ObjectId | null, session?: ClientSession): Promise<string> {
  if (!id) return '';
  const p = await db.collection<PersonLite>(C.people).findOne({ _id: id }, { session, projection: { full_name: 1, employee_code: 1 } });
  return p?.full_name ?? p?.employee_code ?? String(id);
}

/** A main or concurrent position in the unit or its direct parent on that day (02 VH-BR-06). */
async function hasPositionThere(db: Db, session: ClientSession, person: ObjectId, unit: OrgUnitDoc, on: string): Promise<boolean> {
  const codes = [unit._id, ...(unit.parent_code ? [unit.parent_code] : [])];
  const p = await db
    .collection(C.positions)
    .findOne({ person_id: person, unit_code: { $in: codes }, start_on: { $lte: on }, $or: [{ end_on: null }, { end_on: { $exists: false } }, { end_on: { $gte: on } }], voided: { $ne: true } }, { session });
  return !!p;
}

export function unitHead(rootCode: string): ChangeHandler<HeadPayload> {
  return {
    kind: UNIT_HEAD,
    category: 'co_cau',
    permission: 'co_cau.sua',
    schema: HeadPayload,
    conflictKeys: (it) => [`org_unit:${it.target.id}:head`],
    describe: (it) => (it.payload.person_id ? `đặt trưởng đơn vị ${it.target.id}` : `bỏ trưởng đơn vị ${it.target.id}`),
    async authorize(viewer, it, db) {
      const unit = await units(db).findOne({ _id: it.target.id });
      if (unit) assertUnitScope(viewer, unit, rootCode);
    },
    async validate(ctx, it) {
      const s = ctx.session;
      const unit = await units(ctx.db).findOne({ _id: it.target.id, deleted_at: null }, { session: s });
      if (!unit) throw notFound(it.target.id);
      if (unit.status !== 'hoat_dong') throw rule(UNIT_MSG.headUnitStopped);
      const current = unit.head_person_id;
      if (!it.payload.person_id) {
        if (!current) throw rule(fillMsg(UNIT_MSG.headNone, { don_vi: unit.name }));
        return;
      }
      const id = new ObjectId(it.payload.person_id);
      const person = await ctx.db.collection<PersonLite>(C.people).findOne({ _id: id }, { session: s });
      if (!person) throw rule('Không tìm thấy nhân viên được chọn.');
      if (person.status !== 'dang_lam') throw rule(UNIT_MSG.headNotWorking);
      if (current?.equals(id)) throw rule(fillMsg(UNIT_MSG.headSame, { ten: person.full_name ?? '', don_vi: unit.name }));
      // One head per unit (VH-BR-06): replacing the current one must be chosen on purpose.
      if (current && !it.payload.replace_current && ctx.phase === 'submit') {
        throw rule(fillMsg(UNIT_MSG.headExists, { don_vi: unit.name, ten: await personName(ctx.db, current, s), ngay: formatVnDate(addDays(ctx.effectiveOn, -1)) }));
      }
      if (!(await hasPositionThere(ctx.db, s, id, unit, ctx.effectiveOn))) throw rule(fillMsg(UNIT_MSG.headNoPosition, { don_vi: unit.name }));
    },
    async affectedPeople(ctx, it) {
      const unit = await units(ctx.db).findOne({ _id: it.target.id }, { session: ctx.session });
      return [unit?.head_person_id ? String(unit.head_person_id) : null, it.payload.person_id].filter((x): x is string => !!x);
    },
    async apply(ctx, ch) {
      const col = units(ctx.db);
      const unit = (await col.findOne({ _id: ch.target.id }, { session: ctx.session })) as OrgUnitDoc;
      const on = ch.effective_on;
      const next = ch.payload.person_id ? new ObjectId(ch.payload.person_id) : null;
      const old = unit.head_person_id;
      // The open term ends the day before; a term that would start on or after that day is replaced.
      const history = unit.head_history.filter((t) => !(t.to_on === null && t.from_on >= on)).map((t) => (t.to_on === null ? { ...t, to_on: addDays(on, -1) } : t));
      if (next) history.push({ person_id: next, from_on: on, to_on: null });
      await col.updateOne({ _id: unit._id }, { $set: { head_person_id: next, head_history: history, updated_at: ctx.clock.now() }, $inc: { rev: 1, event_seq: 1 } }, { session: ctx.session });
      const people = ctx.db.collection<PersonLite & { head_of_unit_codes?: string[] }>(C.people);
      if (old) await people.updateOne({ _id: old }, { $pull: { head_of_unit_codes: unit._id } }, { session: ctx.session });
      if (next) await people.updateOne({ _id: next }, { $addToSet: { head_of_unit_codes: unit._id } }, { session: ctx.session });
      await ctx.audit({
        action: 'org_unit.head_set',
        target: { type: 'org_unit', id: unit._id, label: unit.name },
        before: { head_person_id: old ? String(old) : null },
        after: { head_person_id: next ? String(next) : null },
      });
    },
  };
}

