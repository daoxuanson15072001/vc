/** Optimistic concurrency (khung chung mục 6): every editable document has `rev`; a stale `rev` is 409 LOI-409. */
import type { ClientSession, Collection, Document, Filter, UpdateFilter } from 'mongodb';
import { ApiError } from './api-error';

export function assertRev(current: { rev: number } | null | undefined, expected: unknown): void {
  if (!current) throw new ApiError('not_found');
  if (typeof expected !== 'number' || !Number.isInteger(expected)) {
    throw new ApiError('bad_request', { message: 'Thiếu số phiên bản dữ liệu (rev).', details: { field: 'rev' } });
  }
  if (current.rev !== expected) throw new ApiError('conflict_rev', { details: { current_rev: current.rev } });
}

/** Updates one document only if its `rev` is still `rev`, and bumps it. Throws 404 or 409 otherwise. */
export async function updateByRev<T extends Document & { rev: number }>(
  col: Collection<T>,
  filter: Filter<T>,
  rev: number,
  update: UpdateFilter<T>,
  session?: ClientSession,
): Promise<T> {
  const inc = { ...((update.$inc as object) ?? {}), rev: 1 };
  const res = await col.findOneAndUpdate({ ...filter, rev } as Filter<T>, { ...update, $inc: inc } as unknown as UpdateFilter<T>, {
    returnDocument: 'after',
    session,
  });
  if (res) return res as T;
  const cur = await col.findOne(filter, { session, projection: { rev: 1 } });
  assertRev(cur as { rev: number } | null, rev);
  throw new ApiError('conflict_rev');
}
