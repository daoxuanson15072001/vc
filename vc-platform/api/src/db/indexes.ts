/** Indexes of every collection (kế hoạch GĐ B mục 4.1). Created at every start: createIndexes is a no-op when present. */
import type { Db, IndexDescription } from 'mongodb';
import { C, type CollectionName } from './collections';

/** Names are unique among entries not merged away (kế hoạch GĐ B mục 4.1: `name_folded` ✚). */
const uniqueName: IndexDescription = { key: { name_folded: 1 }, name: 'name_folded', unique: true, partialFilterExpression: { status: { $in: ['dang_dung', 'ngung'] } } };

export const INDEXES: Partial<Record<CollectionName, IndexDescription[]>> = {
  [C.jobLocks]: [{ key: { lease_until: 1 }, name: 'lease_until' }],
  // 05 mục 3.18; TTL removes rows 24 months old (expires_at).
  [C.auditLog]: [
    { key: { at: 1 }, name: 'at' },
    { key: { 'target.type': 1, 'target.id': 1, at: 1 }, name: 'target_at' },
    { key: { 'actor.person_id': 1, at: 1 }, name: 'actor_at' },
    { key: { action: 1, at: 1 }, name: 'action_at' },
    { key: { correlation_id: 1 }, name: 'correlation_id' },
    { key: { expires_at: 1 }, name: 'expires_at_ttl', expireAfterSeconds: 0 },
    { key: { 'seal.day_on': 1 }, name: 'seal_day', unique: true, partialFilterExpression: { action: 'audit.daily_seal' } },
  ],
  // 05 mục 3.6; conflict_keys finds pending changes on the same object and field (kế hoạch GĐ B mục 3.3 điểm 1).
  [C.scheduledChanges]: [
    { key: { status: 1, effective_at: 1 }, name: 'status_effective_at' },
    { key: { 'target.type': 1, 'target.id': 1, status: 1 }, name: 'target_status' },
    { key: { group_id: 1 }, name: 'group_id' },
    { key: { 'source.import_batch_id': 1 }, name: 'import_batch', sparse: true },
    { key: { conflict_keys: 1, status: 1 }, name: 'conflict_keys_status' },
  ],
  // 05 mục 3.5.
  [C.jobTitles]: [{ key: { status: 1 }, name: 'status' }, { key: { default_function_code: 1 }, name: 'default_function' }, uniqueName],
  [C.jobFunctions]: [{ key: { status: 1 }, name: 'status' }, uniqueName],
  [C.legalEntities]: [
    { key: { status: 1 }, name: 'status' },
    { key: { tax_code: 1 }, name: 'tax_code', unique: true, partialFilterExpression: { tax_code: { $type: 'string' } } },
    { key: { employee_code_prefix: 1 }, name: 'employee_code_prefix', unique: true, partialFilterExpression: { employee_code_prefix: { $type: 'string' } } },
    uniqueName,
  ],
  // 05 mục 3.4: sibling names unique among active units; ancestors for whole branches.
  [C.orgUnits]: [
    { key: { parent_code: 1, name_folded: 1 }, name: 'parent_name', unique: true, partialFilterExpression: { status: 'hoat_dong' } },
    { key: { ancestors: 1 }, name: 'ancestors' },
    { key: { parent_code: 1, order: 1 }, name: 'parent_order' },
    { key: { division_code: 1 }, name: 'division_code' },
    { key: { head_person_id: 1 }, name: 'head_person_id', sparse: true },
    { key: { status: 1 }, name: 'status' },
    { key: { type: 1 }, name: 'type' },
  ],
  // 05 mục 3.1 plus kế hoạch GĐ B mục 4.1 (secondary_email, updated_at).
  [C.people]: [
    { key: { employee_code: 1 }, name: 'employee_code', unique: true },
    { key: { work_email: 1 }, name: 'work_email', unique: true, partialFilterExpression: { work_email: { $type: 'string' } } },
    { key: { secondary_email: 1 }, name: 'secondary_email', unique: true, partialFilterExpression: { secondary_email: { $type: 'string' } } },
    { key: { previous_emails: 1 }, name: 'previous_emails' },
    { key: { status: 1 }, name: 'status' },
    { key: { 'primary.unit_code': 1 }, name: 'primary_unit' },
    { key: { 'primary.manager_person_id': 1 }, name: 'primary_manager' },
    { key: { name_folded: 1, _id: 1 }, name: 'name_folded' },
    { key: { legal_entity_code: 1, status: 1 }, name: 'legal_entity_status' },
    { key: { updated_at: 1 }, name: 'updated_at' },
  ],
  // 05 mục 3.3: one active main position per person.
  [C.positions]: [
    { key: { person_id: 1, active: 1 }, name: 'person_active' },
    { key: { person_id: 1 }, name: 'one_active_primary', unique: true, partialFilterExpression: { kind: 'chinh', active: true } },
    { key: { unit_code: 1, active: 1 }, name: 'unit_active' },
    { key: { manager_person_id: 1, active: 1 }, name: 'manager_active' },
    { key: { start_at: 1 }, name: 'start_at' },
    { key: { end_at: 1 }, name: 'end_at' },
  ],
  [C.workLocations]: [{ key: { legal_entity_code: 1, status: 1 }, name: 'legal_entity_status' }, { key: { kind: 1 }, name: 'kind' }, uniqueName],
};

export async function ensureIndexes(db: Db): Promise<void> {
  for (const [name, specs] of Object.entries(INDEXES)) {
    if (specs?.length) await db.collection(name).createIndexes(specs);
  }
}
