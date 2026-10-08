/** Indexes of every collection (kế hoạch GĐ B mục 4.1). Created at every start: createIndexes is a no-op when present. */
import type { Db, IndexDescription } from 'mongodb';
import { C, type CollectionName } from './collections';

export const INDEXES: Partial<Record<CollectionName, IndexDescription[]>> = {
  [C.jobLocks]: [{ key: { lease_until: 1 }, name: 'lease_until' }],
};

export async function ensureIndexes(db: Db): Promise<void> {
  for (const [name, specs] of Object.entries(INDEXES)) {
    if (specs?.length) await db.collection(name).createIndexes(specs);
  }
}
