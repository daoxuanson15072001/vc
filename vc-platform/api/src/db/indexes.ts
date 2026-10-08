/** Indexes of every collection (kế hoạch GĐ B mục 4.1). Created at every start: createIndexes is a no-op when present. */
import type { Db, IndexDescription } from 'mongodb';
import { C, type CollectionName } from './collections';

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
};

export async function ensureIndexes(db: Db): Promise<void> {
  for (const [name, specs] of Object.entries(INDEXES)) {
    if (specs?.length) await db.collection(name).createIndexes(specs);
  }
}
