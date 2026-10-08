/** Paging `?limit=50&after=<cursor>` (khung chung mục 6): the cursor is the sort key of the last row, base64url JSON. */
import { ApiError } from './api-error';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export function encodeCursor(values: unknown[]): string {
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

export function decodeCursor(raw: unknown): unknown[] | undefined {
  if (raw === undefined || raw === '') return undefined;
  try {
    if (typeof raw !== 'string') throw new Error();
    const v = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new ApiError('bad_request', { message: 'Con trỏ phân trang không hợp lệ.', details: { field: 'after' } });
  }
}

export function parseLimit(raw: unknown): number {
  if (raw === undefined || raw === '') return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    throw new ApiError('bad_request', { message: `Số dòng mỗi trang phải từ 1 đến ${MAX_LIMIT}.`, details: { field: 'limit' } });
  }
  return n;
}
