/** Canonical JSON for hashing audit rows: keys sorted, Date as ISO string, ObjectId as hex, undefined dropped. */
import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';

function normalize(v: unknown): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof ObjectId) return v.toHexString();
  if (Array.isArray(v)) return v.map(normalize);
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = normalize(x);
    }
    return out;
  }
  return v;
}

export function canonicalJson(v: unknown): string {
  return JSON.stringify(normalize(v));
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Hash of an audit row: every field except `_id` and `hash` (05 mục 3.18). */
export function rowHash(row: Record<string, unknown>): string {
  const { _id: _ignoredId, hash: _ignoredHash, ...rest } = row;
  return sha256(canonicalJson(rest));
}

/** MongoDB stores `undefined` as `null`; drop such keys so the stored row hashes the same as the written one. */
export function stripUndefined<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripUndefined) as T;
  if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof ObjectId)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as object)) if (x !== undefined) out[k] = stripUndefined(x);
    return out as T;
  }
  return v;
}
