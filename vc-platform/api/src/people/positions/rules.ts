/**
 * Checks shared by every position change (04 VH-NSU-02, 03): unit active on the start day, title and function in use,
 * manager rules and the management loop, one main position at a time (VH-BR-04, 05). B-07 builds transfers, concurrent
 * positions and manager changes on these.
 */
import { PEOPLE_MSG, addDays, fillMsg, formatVnDate } from '@vc/contracts';
import { ObjectId, type ClientSession, type Db } from 'mongodb';
import { ApiError } from '../../common/api-error';
import { todayOn } from '../../common/clock';
import type { ChangeContext } from '../../common/changes';
import { C } from '../../db/collections';
import type { CatalogService } from '../../org/catalogs/catalog.service';
import { UNIT_CREATE } from '../../org/units/handlers';
import type { OrgUnitDoc } from '../../org/units/types';
import type { PersonDoc, PositionDoc } from '../types';

const rule = (message: string, details?: unknown) => new ApiError('rule_violation', { message, details });

export const people = (db: Db) => db.collection<PersonDoc>(C.people);
export const positions = (db: Db) => db.collection<PositionDoc>(C.positions);

/** The unit as it is on `on`: existing and active, or created by a pending change on or before that day (submit). */
export async function unitOn(ctx: ChangeContext, code: string, on: string): Promise<Pick<OrgUnitDoc, '_id' | 'name' | 'type'>> {
  const u = await ctx.db.collection<OrgUnitDoc>(C.orgUnits).findOne({ _id: code, deleted_at: null }, { session: ctx.session });
  if (u) {
    if (u.status !== 'hoat_dong') {
      // Stopped now, so at the latest since today (a unit made and stopped the same day keeps that day as its last).
      const today = todayOn(ctx.clock);
      const next = u.effective_to_on ? addDays(u.effective_to_on, 1) : today;
      const since = next < today ? next : today;
      throw rule(fillMsg(PEOPLE_MSG.unitStopped, { ten: u.name, ngay: formatVnDate(since) }), { field: 'unit_code' });
    }
    // A unit that opens later cannot take a position before it opens. Units entered today may carry positions that
    // started earlier (existing staff loaded with their real start day).
    if (u.effective_from_on > on && u.effective_from_on > todayOn(ctx.clock)) {
      throw rule(`Đơn vị ${u.name} bắt đầu hoạt động từ ${formatVnDate(u.effective_from_on)}. Chọn từ ngày sau đó.`, { field: 'unit_code' });
    }
    return u;
  }
  if (ctx.phase === 'submit') {
    const [pending] = await ctx.pendingUntil(on, { kind: UNIT_CREATE, 'payload.code': code });
    if (pending) {
      const p = pending.payload as { code: string; name: string; type: OrgUnitDoc['type'] };
      return { _id: p.code, name: p.name, type: p.type };
    }
  }
  throw rule(`Đơn vị ${code} không có.`, { field: 'unit_code' });
}

export async function checkTitleAndFunction(catalogs: CatalogService, session: ClientSession, title: string, fn: string): Promise<void> {
  const t = await catalogs.col('job-titles').findOne({ _id: title }, { session });
  if (!t) throw rule(`Chức danh ${title} không có.`, { field: 'job_title_code' });
  if (t.status !== 'dang_dung') throw rule(fillMsg(PEOPLE_MSG.titleStopped, { ten: t.name }), { field: 'job_title_code' });
  await catalogs.requireSelectable('job-functions', fn, session);
}

const MAX_CHAIN = 15;

/**
 * Manager rules (VH-NSU-03 bước 3–5): not oneself, working or on long leave, no loop up the chain (≤ 15 levels);
 * empty only for the one head of the group, on a position in the root unit.
 */
export async function checkManager(db: Db, session: ClientSession, personId: ObjectId, managerId: ObjectId | null, unit: Pick<OrgUnitDoc, 'type'>): Promise<void> {
  const col = people(db);
  if (!managerId) {
    if (unit.type !== 'tap_doan') throw rule('Chọn quản lý trực tiếp.', { field: 'manager_person_id' });
    const other = await col.findOne({ _id: { $ne: personId }, status: { $in: ['dang_lam', 'nghi_dai_ngay', 'tam_khoa'] }, primary: { $ne: null }, 'primary.manager_person_id': null }, { session });
    if (other) throw rule(fillMsg(PEOPLE_MSG.managerOnlyOneEmpty, { ho_ten: other.full_name }), { field: 'manager_person_id' });
    return;
  }
  if (managerId.equals(personId)) throw rule(PEOPLE_MSG.managerSelf, { field: 'manager_person_id' });
  const manager = await col.findOne({ _id: managerId }, { session });
  if (!manager || !['dang_lam', 'nghi_dai_ngay'].includes(manager.status)) throw rule(PEOPLE_MSG.managerStatus, { field: 'manager_person_id' });
  // Walk up from the chosen manager; meeting the person again would make a loop.
  let cur: PersonDoc | null = manager;
  for (let i = 0; cur?.primary?.manager_person_id; i++) {
    if (i >= MAX_CHAIN) throw rule('Chuỗi quản lý vượt 15 cấp. Kiểm tra lại dữ liệu.');
    if (cur.primary.manager_person_id.equals(personId)) {
      const me = await col.findOne({ _id: personId }, { session, projection: { full_name: 1 } });
      throw rule(`Không đặt được: ${me?.full_name ?? ''} đang là cấp trên của ${manager.full_name}. Đặt thế này sẽ tạo vòng.`, { field: 'manager_person_id' });
    }
    cur = await col.findOne({ _id: cur.primary.manager_person_id }, { session });
  }
}

/** One main position at a time (VH-BR-04): a main position covering the day blocks a new one. */
export async function checkPrimaryOverlap(db: Db, session: ClientSession, personId: ObjectId, start: string, end: string | null): Promise<void> {
  const clash = await positions(db).findOne(
    { person_id: personId, kind: 'chinh', start_on: { $lte: end ?? '9999-12-31' }, $or: [{ end_on: null }, { end_on: { $gte: start } }] },
    { session },
  );
  if (!clash) return;
  const unit = await db.collection<OrgUnitDoc>(C.orgUnits).findOne({ _id: clash.unit_code }, { session, projection: { name: 1 } });
  throw rule(fillMsg(PEOPLE_MSG.primaryOverlap, { don_vi: unit?.name ?? clash.unit_code, ngay: formatVnDate(clash.start_on) }));
}

/** Keeps `people.is_manager` right after positions naming this manager change (05 mục 3.1). */
export async function refreshIsManager(db: Db, session: ClientSession, managerId: ObjectId | null): Promise<void> {
  if (!managerId) return;
  const any = await positions(db).findOne({ manager_person_id: managerId, active: true }, { session, projection: { _id: 1 } });
  await people(db).updateOne({ _id: managerId }, { $set: { is_manager: !!any } }, { session });
}

