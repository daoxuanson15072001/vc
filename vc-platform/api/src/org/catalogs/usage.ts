/**
 * Where catalog entries are used, by the field names of 05 (`positions.job_title_code`, `people.legal_entity_code`…).
 * "In use" blocks Ngừng (04 VH-ORG-03 bước 4, VH-ORG-07 bước 5); "ever used" blocks Xoá (VH-ORG-02 bước 5).
 * Access rules (GĐ C) are not there yet: their count is 0.
 */
import type { CatalogType } from '@vc/contracts';
import type { ClientSession, Db, Document } from 'mongodb';
import { C } from '../../db/collections';

export interface InUse {
  /** Active positions with this title or function. */
  positions: number;
  /** People not yet gone (status ≠ da_nghi). */
  people: number;
  /** Active org units. */
  units: number;
  /** Access rules switched on (GĐ C). */
  rules: number;
}

const NOT_GONE = { status: { $ne: 'da_nghi' } };

/** Collection and filter counted for each kind of use; `{code}` is replaced by the entry's code. */
const IN_USE: Record<CatalogType, { key: keyof InUse; col: string; field: string; extra: Document }[]> = {
  'job-titles': [{ key: 'positions', col: C.positions, field: 'job_title_code', extra: { active: true } }],
  'job-functions': [{ key: 'positions', col: C.positions, field: 'job_function_code', extra: { active: true } }],
  'legal-entities': [
    { key: 'people', col: C.people, field: 'legal_entity_code', extra: NOT_GONE },
    { key: 'units', col: C.orgUnits, field: 'legal_entity_code', extra: { status: 'hoat_dong' } },
  ],
  'work-locations': [{ key: 'people', col: C.people, field: 'work_location_code', extra: NOT_GONE }],
};

/** Any reference, current or past (ended positions, people who left, merged-away entries). */
const EVER: Record<CatalogType, { col: string; field: string }[]> = {
  'job-titles': [{ col: C.positions, field: 'job_title_code' }],
  'job-functions': [
    { col: C.positions, field: 'job_function_code' },
    { col: C.jobTitles, field: 'default_function_code' },
    { col: C.orgUnits, field: 'function_code' },
  ],
  'legal-entities': [
    { col: C.people, field: 'legal_entity_code' },
    { col: C.orgUnits, field: 'legal_entity_code' },
    { col: C.workLocations, field: 'legal_entity_code' },
  ],
  'work-locations': [{ col: C.people, field: 'work_location_code' }],
};

const empty = (): InUse => ({ positions: 0, people: 0, units: 0, rules: 0 });

export async function inUse(db: Db, type: CatalogType, code: string, session?: ClientSession): Promise<InUse> {
  const out = empty();
  for (const u of IN_USE[type]) out[u.key] += await db.collection(u.col).countDocuments({ [u.field]: code, ...u.extra }, { session });
  return out;
}

/** Counts for every entry at once (list screens: "số người đang giữ", "số vị trí đang dùng"). */
export async function inUseAll(db: Db, type: CatalogType): Promise<Map<string, InUse>> {
  const out = new Map<string, InUse>();
  for (const u of IN_USE[type]) {
    const rows = await db
      .collection(u.col)
      .aggregate<{ _id: string; n: number }>([{ $match: { [u.field]: { $type: 'string' }, ...u.extra } }, { $group: { _id: `$${u.field}`, n: { $sum: 1 } } }])
      .toArray();
    for (const r of rows) {
      const cur = out.get(r._id) ?? empty();
      cur[u.key] += r.n;
      out.set(r._id, cur);
    }
  }
  return out;
}

export async function everUsed(db: Db, type: CatalogType, code: string, session?: ClientSession): Promise<boolean> {
  for (const u of EVER[type]) if (await db.collection(u.col).findOne({ [u.field]: code }, { session, projection: { _id: 1 } })) return true;
  return false;
}
