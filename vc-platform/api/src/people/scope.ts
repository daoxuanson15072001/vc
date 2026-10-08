/**
 * HC-NS scope over profiles (kế hoạch GĐ B mục 3.3 điểm 6): the profile's legal entity, or the Division of its main
 * position's unit, is in the scope; `hcns@<root unit>` and plain `hcns` cover everyone.
 */
import type { Db, Filter } from 'mongodb';
import type { Viewer } from '../auth/viewer';
import { C } from '../db/collections';
import type { LegalEntityDoc } from '../org/catalogs/types';
import type { OrgUnitDoc } from '../org/units/types';
import type { PersonDoc } from './types';

export function scopeCodes(viewer: Viewer | undefined): 'all' | string[] {
  if (!viewer || viewer.hcnsScope === 'all') return 'all';
  return viewer.hcnsScope ?? [];
}

export async function personInScope(db: Db, viewer: Viewer | undefined, legal: string, unitCode: string | null | undefined): Promise<boolean> {
  const s = scopeCodes(viewer);
  if (s === 'all') return true;
  if (s.includes(legal)) return true;
  if (!unitCode) return false;
  const unit = await db.collection<OrgUnitDoc>(C.orgUnits).findOne({ _id: unitCode }, { projection: { division_code: 1, legal_entity_code: 1 } });
  return !!unit && ((unit.division_code != null && s.includes(unit.division_code)) || (unit.legal_entity_code != null && s.includes(unit.legal_entity_code)));
}

/** Mongo filter of the profiles a viewer may list: HC-NS their scope; quản trị hệ thống and kiểm soát read all. */
export async function scopeFilter(db: Db, viewer: Viewer | undefined): Promise<Filter<PersonDoc>> {
  if (viewer && (viewer.roles.has('qtht') || viewer.roles.has('kiem_soat'))) return {};
  const s = scopeCodes(viewer);
  if (s === 'all') return {};
  const units = await db
    .collection<OrgUnitDoc>(C.orgUnits)
    .find({ $or: [{ division_code: { $in: s } }, { legal_entity_code: { $in: s } }] }, { projection: { _id: 1 } })
    .toArray();
  return { $or: [{ legal_entity_code: { $in: s } }, { 'primary.unit_code': { $in: units.map((u) => u._id) } }] };
}

/** "VCparts, VCservice" for "Bạn chỉ sửa được hồ sơ thuộc {phạm vi}". */
export async function scopeLabel(db: Db, viewer: Viewer | undefined): Promise<string> {
  const s = scopeCodes(viewer);
  if (s === 'all') return 'toàn tập đoàn';
  const legal = await db.collection<LegalEntityDoc>(C.legalEntities).find({ _id: { $in: s } }, { projection: { short_name: 1 } }).toArray();
  const units = await db.collection<OrgUnitDoc>(C.orgUnits).find({ _id: { $in: s } }, { projection: { name: 1 } }).toArray();
  const names = new Map<string, string>([...units.map((u) => [u._id, u.name] as [string, string]), ...legal.map((l) => [l._id, l.short_name] as [string, string])]);
  return s.map((c) => names.get(c) ?? c).join(', ');
}
