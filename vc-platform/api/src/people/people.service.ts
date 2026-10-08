/**
 * Employee profiles (04 VH-NSU-01). A new profile is written at once ("Chưa vào làm"); its main position and the move to
 * "Đang làm" form one change group on the start day, so a start in the future waits in `scheduled_changes` and a start
 * today or earlier applies in the same transaction. Fields used in access rules change on a date (`person_update`).
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import {
  EMPLOYEE_TYPES,
  PEOPLE_MSG,
  PERSON_RULE_FIELDS,
  PERSON_STATUS as STATUS_LABEL,
  PersonCreate,
  PersonNoShow,
  PersonPatch,
  accessFor,
  addDays,
  fillMsg,
  foldName,
  type PersonStatus,
} from '@vc/contracts';
import ExcelJS from 'exceljs';
import { MongoServerError, ObjectId, type ClientSession, type Db, type Filter, type MongoClient } from 'mongodb';
import sharp from 'sharp';
import { AuditService } from '../audit/audit.service';
import type { Viewer } from '../auth/viewer';
import { ApiError } from '../common/api-error';
import { CLOCK, todayOn, type Clock } from '../common/clock';
import { decodeCursor, encodeCursor, parseLimit } from '../common/cursor';
import { assertRev, updateByRev } from '../common/rev';
import { withTx } from '../common/tx';
import { parseInput } from '../common/zod.pipe';
import { ENV, type Env } from '../config/env';
import { C } from '../db/collections';
import { DB, MONGO_CLIENT } from '../db/mongo';
import { CatalogService } from '../org/catalogs/catalog.service';
import type { JobTitleDoc, LegalEntityDoc } from '../org/catalogs/types';
import type { OrgUnitDoc } from '../org/units/types';
import { ChangeService, type Requester, type SubmitResult } from './changes/change.service';
import { PERSON_STATUS, PERSON_UPDATE } from './handlers';
import { POSITION_OPEN, type OpenPayload } from './positions/position-open';
import { people, positions } from './positions/rules';
import { personInScope, scopeFilter, scopeLabel } from './scope';
import { PersonDocSchema, type PersonDoc, type PositionDoc } from './types';

const rule = (message: string, details?: unknown) => new ApiError('rule_violation', { message, details });
const HIRE_KINDS = [POSITION_OPEN, PERSON_STATUS];
/** C1 fields of a profile (04 VH-NSU-08): hidden from colleagues and HC-NS outside the scope. */
const C1_FIELDS = ['secondary_email', 'employee_type', 'work_location_code', 'status', 'status_since_at', 'joined_on', 'left_on', 'left_reason', 'leave', 'suspension', 'is_manager'] as const;

type ChangeOut = Pick<SubmitResult, 'group_id' | 'status' | 'message' | 'warnings' | 'effective_on'>;
const changeOut = (r: SubmitResult): ChangeOut => ({ group_id: r.group_id, status: r.status, message: r.message, warnings: r.warnings, effective_on: r.effective_on });

export interface PeopleListQuery {
  q?: string;
  legal_entity?: string;
  unit?: string;
  include_sub_units?: string;
  status?: string;
  employee_type?: string;
  warning?: string;
  limit?: unknown;
  after?: unknown;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class PeopleService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly changes: ChangeService,
    private readonly catalogs: CatalogService,
  ) {}

  private get col() {
    return people(this.db);
  }

  private async byCode(code: string, session?: ClientSession): Promise<PersonDoc> {
    const p = await this.col.findOne({ employee_code: code }, { session });
    if (!p) throw new ApiError('not_found', { message: PEOPLE_MSG.notFound });
    return p;
  }

  private async assertScope(viewer: Viewer | undefined, legal: string, unitCode: string | null | undefined): Promise<void> {
    if (!(await personInScope(this.db, viewer, legal, unitCode))) {
      throw new ApiError('forbidden', { message: fillMsg(PEOPLE_MSG.scope, { pham_vi: await scopeLabel(this.db, viewer) }) });
    }
  }

  /** Emails are unique across work, secondary and previous addresses of every profile (VH-NSU-01, VH-BR-01). */
  private async assertEmailsFree(emails: (string | null | undefined)[], self: ObjectId | null, session: ClientSession): Promise<void> {
    for (const e of emails) {
      if (!e) continue;
      const other = await this.col.findOne({ $or: [{ work_email: e }, { secondary_email: e }, { previous_emails: e }], ...(self ? { _id: { $ne: self } } : {}) }, { session });
      if (other) throw rule(fillMsg(PEOPLE_MSG.emailTaken, { email: e, ma: other.employee_code, ho_ten: other.full_name }), { field: 'email' });
    }
  }

  private async assertCodeFree(code: string, session: ClientSession): Promise<void> {
    const other = await this.col.findOne({ employee_code: code }, { session });
    if (other) throw rule(fillMsg(PEOPLE_MSG.codeUsed, { ma: code, ho_ten: other.full_name, trang_thai: STATUS_LABEL[other.status] }), { field: 'employee_code' });
  }

  /** Q-11: `<prefix of the legal entity><4 digits>`, the next free number. */
  private async nextCode(legal: LegalEntityDoc, session: ClientSession): Promise<string> {
    const prefix = legal.employee_code_prefix ?? legal._id;
    const re = new RegExp(`^${escapeRe(prefix)}(\\d{4,})$`);
    const used = await this.col.find({ employee_code: { $regex: re } }, { session, projection: { employee_code: 1 } }).toArray();
    const max = used.reduce((m, p) => Math.max(m, Number(re.exec(p.employee_code)?.[1] ?? 0)), 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  // --- Create --------------------------------------------------------------------------------------------------------

  async create(raw: unknown, req: Requester): Promise<{ person: Record<string, unknown>; change: ChangeOut }> {
    if (raw && typeof raw === 'object' && !('primary' in raw)) throw rule(PEOPLE_MSG.noPrimary, { field: 'primary' });
    const input = parseInput(PersonCreate, raw);
    if (!input.primary) throw rule(PEOPLE_MSG.noPrimary, { field: 'primary' });
    const today = todayOn(this.clock);
    if (input.joined_on > addDays(today, 180)) throw rule(PEOPLE_MSG.joinedFar, { field: 'joined_on' });
    if (input.secondary_email && input.secondary_email === input.work_email) throw rule(PEOPLE_MSG.secondarySame, { field: 'secondary_email' });
    await this.assertScope(req.viewer, input.legal_entity_code, input.primary.unit_code);

    for (let attempt = 0; ; attempt++) {
      try {
        const out = await withTx(this.client, async (session) => {
          const legal = (await this.catalogs.requireSelectable('legal-entities', input.legal_entity_code, session)) as LegalEntityDoc;
          if (input.work_location_code) await this.catalogs.requireSelectable('work-locations', input.work_location_code, session);
          const code = input.employee_code ?? (await this.nextCode(legal, session));
          await this.assertCodeFree(code, session);
          await this.assertEmailsFree([input.work_email, input.secondary_email], null, session);
          const title = await this.catalogs.col<JobTitleDoc>('job-titles').findOne({ _id: input.primary!.job_title_code }, { session });
          const now = this.clock.now();
          const doc = PersonDocSchema.parse({
            _id: new ObjectId(),
            employee_code: code,
            full_name: input.full_name,
            name_folded: foldName(input.full_name),
            nickname: input.nickname,
            work_email: input.work_email,
            secondary_email: input.secondary_email,
            previous_emails: [],
            photo: null,
            work_phone: input.work_phone,
            legal_entity_code: input.legal_entity_code,
            employee_type: input.employee_type,
            work_location_code: input.work_location_code,
            status: 'chua_vao_lam',
            status_since_at: now,
            joined_on: input.joined_on,
            left_on: null,
            left_reason: null,
            left_note: null,
            leave: null,
            suspension: null,
            primary: null,
            is_manager: false,
            head_of_unit_codes: [],
            event_seq: 1,
            grant_event_seq: {},
            anonymized_at: null,
            created_at: now,
            created_by: req.actor.person_id ?? req.actor.sub ?? null,
            updated_at: now,
            rev: 1,
          }) as PersonDoc;
          await this.col.insertOne(doc, { session });
          await this.record(session, req, 'person.create', doc, { after: this.auditView(doc), reason: input.reason });
          const open: OpenPayload = {
            kind: 'chinh',
            unit_code: input.primary!.unit_code,
            job_title_code: input.primary!.job_title_code,
            job_function_code: input.primary!.job_function_code ?? title?.default_function_code ?? '',
            manager_person_id: input.primary!.manager_person_id,
            end_on: input.primary!.end_on,
            basis: input.primary!.basis,
            note: input.primary!.note,
          };
          const change = await this.changes.submit(this.hireGroup(doc._id, open, input.joined_on, input.reason), req, session);
          return { id: doc._id, change };
        });
        return { person: this.fullView((await this.col.findOne({ _id: out.id }))!), change: changeOut(out.change) };
      } catch (e) {
        // Two profiles given the same next code at once: take the next one (only when VC Home chose the code).
        if (!input.employee_code && attempt < 3 && e instanceof MongoServerError && e.code === 11000 && JSON.stringify(e.keyPattern ?? {}).includes('employee_code')) continue;
        if (e instanceof MongoServerError && e.code === 11000) throw rule('Mã nhân viên hoặc email vừa được dùng cho hồ sơ khác. Tải lại để xem.');
        throw e;
      }
    }
  }

  /** The main position and "vào làm", effective on the start day. */
  private hireGroup(personId: ObjectId, open: OpenPayload, on: string, reason?: string) {
    const target = { type: 'person' as const, id: String(personId) };
    return {
      items: [
        { kind: POSITION_OPEN, target, payload: open as unknown as Record<string, unknown> },
        { kind: PERSON_STATUS, target, payload: { action: 'vao_lam' } },
      ],
      effective_on: on,
      reason,
    };
  }

  // --- Edit ----------------------------------------------------------------------------------------------------------

  async update(code: string, raw: unknown, req: Requester): Promise<Record<string, unknown> & { change?: ChangeOut }> {
    const input = parseInput(PersonPatch, raw);
    const { rev, effective_on, reason, replace_ids, ...fields } = input;
    const today = todayOn(this.clock);
    const out = await withTx(this.client, async (session) => {
      const cur = await this.byCode(code, session);
      await this.assertScope(req.viewer, cur.legal_entity_code, cur.primary?.unit_code ?? (await this.pendingPrimaryUnit(cur, session)));
      if (fields.legal_entity_code && fields.legal_entity_code !== cur.legal_entity_code) await this.assertScope(req.viewer, fields.legal_entity_code, null);
      assertRev(cur, rev);
      if (cur.status === 'da_nghi') throw rule('Hồ sơ đã nghỉ, không sửa được.');
      const changed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (JSON.stringify((cur as unknown as Record<string, unknown>)[k] ?? null) !== JSON.stringify(v ?? null)) changed[k] = v;

      // Fields used in access rules: on a date, through the change core (VH-NSU-01 bước 6).
      const ruleFields = Object.fromEntries(PERSON_RULE_FIELDS.filter((f) => f in changed).map((f) => [f, changed[f]]));
      for (const f of PERSON_RULE_FIELDS) delete changed[f];

      if (changed.employee_code !== undefined) {
        const linked = await this.db.collection(C.accounts).findOne({ person_id: cur._id }, { session, projection: { _id: 1 } });
        if (cur.status !== 'chua_vao_lam' || linked) throw rule(PEOPLE_MSG.codeLocked, { field: 'employee_code' });
        await this.assertCodeFree(changed.employee_code as string, session);
      }
      const work = changed.work_email !== undefined ? (changed.work_email as string | null) : cur.work_email;
      const secondary = changed.secondary_email !== undefined ? (changed.secondary_email as string | null) : cur.secondary_email;
      if (secondary && secondary === work) throw rule(PEOPLE_MSG.secondarySame, { field: 'secondary_email' });
      await this.assertEmailsFree([changed.work_email as string | undefined, changed.secondary_email as string | undefined], cur._id, session);

      let doc = cur;
      let change: SubmitResult | undefined;
      const set: Record<string, unknown> = {};
      if (changed.joined_on !== undefined) {
        if (cur.status !== 'chua_vao_lam') throw rule(PEOPLE_MSG.joinedOnlyBefore, { field: 'joined_on' });
        if ((changed.joined_on as string) > addDays(today, 180)) throw rule(PEOPLE_MSG.joinedFar, { field: 'joined_on' });
      }
      for (const [k, v] of Object.entries(changed)) set[k] = v;
      if (typeof changed.full_name === 'string') set.name_folded = foldName(changed.full_name);
      if (changed.work_email !== undefined && cur.work_email && cur.work_email !== changed.work_email) {
        // The old address keeps linking the account to the right person (VH-BR-01).
        set.previous_emails = [...new Set([...cur.previous_emails, cur.work_email])].filter((e) => e !== changed.work_email);
      }
      if (Object.keys(set).length) {
        doc = await updateByRev(this.col, { _id: cur._id }, rev, { $set: { ...set, updated_at: this.clock.now() }, $inc: { event_seq: 1 } }, session);
        const before = Object.fromEntries(Object.keys(changed).map((k) => [k, (cur as unknown as Record<string, unknown>)[k] ?? null]));
        await this.record(session, req, 'person.update', doc, { before, after: changed, reason });
      }
      if (changed.joined_on !== undefined) change = await this.reschedule(cur, changed.joined_on as string, reason, req, session);
      if (Object.keys(ruleFields).length) {
        change = await this.changes.submit(
          { items: [{ kind: PERSON_UPDATE, target: { type: 'person', id: String(cur._id) }, payload: ruleFields }], effective_on: effective_on ?? today, reason, replace_ids },
          req,
          session,
        );
      }
      return { id: cur._id, change };
    });
    const view = this.fullView((await this.col.findOne({ _id: out.id }))!);
    return out.change ? { ...view, change: changeOut(out.change) } : view;
  }

  /** A new start day while "Chưa vào làm": the pending hire group is cancelled and sent again for that day. */
  private async reschedule(cur: PersonDoc, on: string, reason: string | undefined, req: Requester, session: ClientSession): Promise<SubmitResult> {
    const pending = await this.changes.pendingFor(session, { type: 'person', id: String(cur._id) }, HIRE_KINDS);
    const open = pending.find((d) => d.kind === POSITION_OPEN);
    if (!open) throw rule('Không tìm thấy vị trí chính đang hẹn của hồ sơ này.');
    await this.changes.cancelGroupsInTx(session, pending.map((d) => d.group_id), 'Đổi ngày vào', req);
    return this.changes.submit(this.hireGroup(cur._id, open.payload as unknown as OpenPayload, on, reason), req, session);
  }

  private async pendingPrimaryUnit(p: PersonDoc, session?: ClientSession): Promise<string | null> {
    const d = await this.db.collection(C.scheduledChanges).findOne({ 'target.type': 'person', 'target.id': String(p._id), kind: POSITION_OPEN, 'payload.kind': 'chinh', status: { $in: ['cho_ap', 'cho_xac_nhan'] } }, { session });
    return (d?.payload as { unit_code?: string } | undefined)?.unit_code ?? null;
  }

  /** "Không nhận việc" (VH-NSU-01 bước 8): only before the start; the code stays used. */
  async noShow(code: string, raw: unknown, req: Requester) {
    const { reason } = parseInput(PersonNoShow, raw);
    const doc = await withTx(this.client, async (session) => {
      const cur = await this.byCode(code, session);
      await this.assertScope(req.viewer, cur.legal_entity_code, await this.pendingPrimaryUnit(cur, session));
      if (cur.status !== 'chua_vao_lam') throw rule(fillMsg(PEOPLE_MSG.noShowOnly, { trang_thai: STATUS_LABEL[cur.status] }));
      const pending = await this.changes.pendingFor(session, { type: 'person', id: String(cur._id) });
      await this.changes.cancelGroupsInTx(session, pending.map((d) => d.group_id), `Không nhận việc: ${reason}`, req);
      const doc = await updateByRev(
        this.col,
        { _id: cur._id },
        cur.rev,
        { $set: { status: 'da_nghi', status_since_at: this.clock.now(), left_reason: 'khong_vao_lam', left_note: reason, updated_at: this.clock.now() }, $inc: { event_seq: 1 } },
        session,
      );
      await this.record(session, req, 'person.no_show', doc, { before: { status: cur.status }, after: { status: 'da_nghi', left_reason: 'khong_vao_lam' }, reason });
      return doc;
    });
    return this.fullView(doc);
  }

  /** HC-NS photo (VH-NSU-01 bước 7): JPG or PNG ≤ 2 MB, cropped square 400 × 400, metadata (EXIF) dropped. */
  async setPhoto(code: string, file: { buffer: Buffer; mimetype: string; size: number } | undefined, req: Requester) {
    const target = await this.byCode(code);
    await this.assertScope(req.viewer, target.legal_entity_code, target.primary?.unit_code ?? (await this.pendingPrimaryUnit(target)));
    if (!file || !['image/jpeg', 'image/png'].includes(file.mimetype) || file.size > 2 * 1024 * 1024) throw new ApiError('bad_request', { message: PEOPLE_MSG.photo });
    let out: Buffer;
    try {
      const meta = await sharp(file.buffer).metadata();
      if (meta.format !== 'jpeg' && meta.format !== 'png') throw new Error('format');
      out = await sharp(file.buffer).rotate().resize(400, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      throw new ApiError('bad_request', { message: PEOPLE_MSG.photo });
    }
    const name = `${createHash('sha256').update(out).digest('hex').slice(0, 16)}.jpg`;
    const dir = join(this.env.MEDIA_DIR, 'photos');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), out);
    const doc = await withTx(this.client, async (session) => {
      const cur = await this.byCode(code, session);
      await this.assertScope(req.viewer, cur.legal_entity_code, cur.primary?.unit_code ?? (await this.pendingPrimaryUnit(cur, session)));
      const photo = { url: `/media/photos/${name}`, source: 'hcns' as const, updated_at: this.clock.now() };
      const doc = await updateByRev(this.col, { _id: cur._id }, cur.rev, { $set: { photo, updated_at: this.clock.now() }, $inc: { event_seq: 1 } }, session);
      await this.record(session, req, 'person.photo', doc, { before: { photo: cur.photo?.url ?? null }, after: { photo: photo.url } });
      return doc;
    });
    return this.fullView(doc);
  }

  // --- Read ----------------------------------------------------------------------------------------------------------

  private fullView(p: PersonDoc): Record<string, unknown> {
    const { _id, name_folded: _f, created_at: _c, grant_event_seq: _g, anonymized_at: _a, ...rest } = p;
    return {
      id: String(_id),
      ...rest,
      primary: p.primary ? { ...p.primary, position_id: String(p.primary.position_id), manager_person_id: p.primary.manager_person_id ? String(p.primary.manager_person_id) : null } : null,
      status_since_at: p.status_since_at.toISOString(),
      updated_at: p.updated_at.toISOString(),
    };
  }

  /** C0 only (04 VH-NSU-08): colleagues, HC-NS outside the scope. */
  private c0View(p: PersonDoc): Record<string, unknown> {
    const v = this.fullView(p);
    for (const f of C1_FIELDS) delete v[f];
    if (v.primary) delete (v.primary as Record<string, unknown>).manager_person_id;
    delete v.previous_emails;
    delete v.rev;
    return v;
  }

  private auditView(p: PersonDoc): Record<string, unknown> {
    const { _id: _i, name_folded: _f, created_at: _c, updated_at: _u, rev: _r, grant_event_seq: _g, event_seq: _e, ...rest } = p;
    return { ...rest, status_since_at: p.status_since_at };
  }

  /**
   * Detail on VH-MH-11. HC-NS in scope: everything and "Sửa"; quản trị hệ thống, kiểm soát: everything, read-only;
   * others (HC-NS outside the scope): C0, and 404 for "Đã nghỉ" or "Chưa vào làm". Opening C1 of someone else writes
   * one `person.view_c1` row (VH-NSU-08 bước 4).
   */
  async get(code: string, req: Requester) {
    const p = await this.byCode(code);
    const v = req.viewer;
    const unit = p.primary?.unit_code ?? (await this.pendingPrimaryUnit(p));
    const inScope = !!v?.hcnsScope && (await personInScope(this.db, v, p.legal_entity_code, unit));
    const readsAll = !!v && (v.roles.has('qtht') || v.roles.has('kiem_soat'));
    const self = !!v?.personId && v.personId === String(p._id);
    if (!(inScope || readsAll || self)) {
      if (p.status === 'da_nghi' || p.status === 'chua_vao_lam') throw new ApiError('not_found', { message: PEOPLE_MSG.notFound });
      return { ...this.c0View(p), can_edit: false, view: 'c0' };
    }
    const history = await positions(this.db).find({ person_id: p._id }).sort({ start_on: -1 }).toArray();
    const pending = await this.db
      .collection(C.scheduledChanges)
      .find({ 'target.type': 'person', 'target.id': String(p._id), status: { $in: ['cho_ap', 'cho_xac_nhan'] } })
      .sort({ effective_at: 1, seq: 1 })
      .toArray();
    const account = await this.db.collection(C.accounts).findOne({ person_id: p._id }, { projection: { _id: 1, email: 1 } });
    if (!self) {
      await withTx(this.client, (session) => this.record(session, req, 'person.view_c1', p, {}));
    }
    return {
      ...this.fullView(p),
      positions: history.map((h) => this.positionView(h)),
      pending_changes: pending.map((d) => ({ id: String(d._id), group_id: String(d.group_id), kind: d.kind, effective_on: d.effective_on, status: d.status, payload: d.payload })),
      account: account ? { linked: true } : { linked: false },
      can_edit: inScope && !!v && accessFor('nhan_su.sua', v.roles) && p.status !== 'da_nghi',
      view: 'c1',
    };
  }

  private positionView(h: PositionDoc) {
    const { _id, person_id: _p, created_at: _c, ...rest } = h;
    return { id: String(_id), ...rest, manager_person_id: h.manager_person_id ? String(h.manager_person_id) : null, scheduled_change_id: h.scheduled_change_id ? String(h.scheduled_change_id) : null };
  }

  private async listFilter(q: PeopleListQuery, viewer: Viewer | undefined): Promise<Filter<PersonDoc>> {
    const and: Filter<PersonDoc>[] = [await scopeFilter(this.db, viewer)];
    const text = typeof q.q === 'string' ? q.q.trim() : '';
    if (text) {
      const f = foldName(text);
      and.push({ $or: [{ name_folded: { $regex: escapeRe(f) } }, { employee_code: { $regex: `^${escapeRe(text.toUpperCase())}` } }, { work_email: { $regex: `^${escapeRe(text.toLowerCase())}` } }] });
    }
    if (typeof q.legal_entity === 'string' && q.legal_entity) and.push({ legal_entity_code: { $in: q.legal_entity.split(',') } });
    if (typeof q.status === 'string' && q.status) and.push({ status: { $in: q.status.split(',') as PersonStatus[] } });
    if (typeof q.employee_type === 'string' && q.employee_type) and.push({ employee_type: { $in: q.employee_type.split(',') as (keyof typeof EMPLOYEE_TYPES)[] } });
    if (typeof q.unit === 'string' && q.unit) {
      let codes = [q.unit];
      if (q.include_sub_units === 'true' || q.include_sub_units === '1') {
        const below = await this.db.collection<OrgUnitDoc>(C.orgUnits).find({ ancestors: q.unit }, { projection: { _id: 1 } }).toArray();
        codes = [q.unit, ...below.map((u) => u._id)];
      }
      and.push({ 'primary.unit_code': { $in: codes } });
    }
    if (q.warning === 'thieu_quan_ly') and.push({ status: { $ne: 'da_nghi' }, primary: { $ne: null }, 'primary.manager_person_id': null, 'primary.unit_code': { $ne: this.env.ROOT_UNIT_CODE } });
    if (q.warning === 'chua_gan_tai_khoan') {
      const linked = await this.db.collection(C.accounts).distinct('person_id', { person_id: { $type: 'objectId' } });
      and.push({ _id: { $nin: linked as ObjectId[] }, work_email: { $type: 'string' }, status: { $ne: 'da_nghi' } });
    }
    return { $and: and };
  }

  /** Rows of VH-MH-11 with names of unit, title and manager, and the warning chips (VH-NSU-01 bước 9). */
  private async rows(docs: PersonDoc[]) {
    const units = await this.db.collection<OrgUnitDoc>(C.orgUnits).find({ _id: { $in: docs.map((d) => d.primary?.unit_code).filter((x): x is string => !!x) } }, { projection: { name: 1 } }).toArray();
    const titles = await this.catalogs.col('job-titles').find({ _id: { $in: docs.map((d) => d.primary?.job_title_code).filter((x): x is string => !!x) } }, { projection: { name: 1 } }).toArray();
    const managerIds = docs.map((d) => d.primary?.manager_person_id).filter((x): x is ObjectId => !!x);
    const managers = await this.col.find({ _id: { $in: managerIds } }, { projection: { full_name: 1 } }).toArray();
    const linked = new Set((await this.db.collection(C.accounts).distinct('person_id', { person_id: { $in: docs.map((d) => d._id) } })).map(String));
    const un = new Map(units.map((u) => [u._id, u.name]));
    const tn = new Map(titles.map((t) => [t._id, t.name]));
    const mn = new Map(managers.map((m) => [String(m._id), m.full_name]));
    return docs.map((d) => {
      const warnings: string[] = [];
      if (d.status !== 'da_nghi' && d.primary && !d.primary.manager_person_id && d.primary.unit_code !== this.env.ROOT_UNIT_CODE) warnings.push('thieu_quan_ly');
      if (d.status !== 'da_nghi' && d.work_email && !linked.has(String(d._id))) warnings.push('chua_gan_tai_khoan');
      return {
        id: String(d._id),
        employee_code: d.employee_code,
        full_name: d.full_name,
        nickname: d.nickname,
        work_email: d.work_email,
        photo: d.photo?.url ?? null,
        legal_entity_code: d.legal_entity_code,
        employee_type: d.employee_type,
        status: d.status,
        joined_on: d.joined_on,
        unit_code: d.primary?.unit_code ?? null,
        unit_name: d.primary ? (un.get(d.primary.unit_code) ?? null) : null,
        job_title_code: d.primary?.job_title_code ?? null,
        job_title_name: d.primary ? (tn.get(d.primary.job_title_code) ?? null) : null,
        manager_name: d.primary?.manager_person_id ? (mn.get(String(d.primary.manager_person_id)) ?? null) : null,
        warnings,
      };
    });
  }

  async list(q: PeopleListQuery, req: Requester) {
    const limit = parseLimit(q.limit);
    const after = decodeCursor(q.after);
    const filter = await this.listFilter(q, req.viewer);
    if (after) {
      const [name, id] = after as [string, string];
      (filter.$and as Filter<PersonDoc>[]).push({ $or: [{ name_folded: { $gt: name } }, { name_folded: name, _id: { $gt: new ObjectId(id) } }] });
    }
    const docs = await this.col.find(filter).sort({ name_folded: 1, _id: 1 }).limit(limit + 1).toArray();
    const page = docs.slice(0, limit);
    const last = page.at(-1);
    // A list with C1 columns: one audit row per load, with the number of people (VH-NSU-08 bước 4).
    await withTx(this.client, (session) =>
      this.audit
        .record(session, {
          actor: req.actor,
          action: 'person.list_c1',
          target: { type: 'person_list', id: 'admin', label: 'VH-MH-11' },
          after: { count: page.length },
          correlation_id: req.correlationId,
          ip_prefix: req.ipPrefix ?? null,
          source: { type: req.via },
        })
        .then(() => undefined),
    );
    return { items: await this.rows(page), next_cursor: docs.length > limit && last ? encodeCursor([last.name_folded, String(last._id)]) : null };
  }

  /** "Xuất Excel" of the filtered list (≤ 5.000 rows); one audit row with the count. */
  async exportXlsx(q: PeopleListQuery, req: Requester): Promise<Buffer> {
    const docs = await this.col.find(await this.listFilter(q, req.viewer)).sort({ name_folded: 1, _id: 1 }).limit(5000).toArray();
    const rows = await this.rows(docs);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Nhân sự');
    ws.columns = [
      { header: 'Mã nhân viên', width: 14 },
      { header: 'Họ và tên', width: 28 },
      { header: 'Email công ty', width: 30 },
      { header: 'Pháp nhân', width: 12 },
      { header: 'Đơn vị', width: 26 },
      { header: 'Chức danh', width: 24 },
      { header: 'Quản lý trực tiếp', width: 24 },
      { header: 'Loại nhân viên', width: 16 },
      { header: 'Ngày vào', width: 12 },
      { header: 'Trạng thái', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of rows) {
      ws.addRow([r.employee_code, r.full_name, r.work_email ?? '', r.legal_entity_code, r.unit_name ?? '', r.job_title_name ?? '', r.manager_name ?? '', EMPLOYEE_TYPES[r.employee_type], r.joined_on, STATUS_LABEL[r.status]]);
    }
    await withTx(this.client, (session) =>
      this.audit
        .record(session, {
          actor: req.actor,
          action: 'person.export',
          target: { type: 'person_list', id: 'admin', label: 'VH-MH-11' },
          after: { count: rows.length },
          correlation_id: req.correlationId,
          ip_prefix: req.ipPrefix ?? null,
          source: { type: req.via },
        })
        .then(() => undefined),
    );
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private async record(session: ClientSession, req: Requester, action: string, p: PersonDoc, extra: { before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string }) {
    await this.audit.record(session, {
      actor: req.actor,
      action,
      target: { type: 'person', id: String(p._id), label: p.employee_code },
      ...extra,
      reason: extra.reason || undefined,
      correlation_id: req.correlationId,
      ip_prefix: req.ipPrefix ?? null,
      source: { type: req.via },
    });
  }
}
