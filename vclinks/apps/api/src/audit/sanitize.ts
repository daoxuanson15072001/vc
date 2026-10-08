/*
 * Log hygiene (CLAUDE.md §12.3, docs 01 MH-PQ-10 #8): an audit line holds ids, counts and reasons,
 * never message text or a full phone number. Services already write clean lines; this is the second
 * lock, applied when a line is written and again when it is shown or exported.
 */

/** Keys that would carry content or a phone number: dropped. */
const FORBIDDEN_KEYS = /^(text|content|message|body|caption|raw|phone|phoneNumber|msg|draft|finalText)$/i;

/** A Vietnamese phone number as its own token (not part of a longer id such as `uid:thread`). */
const PHONE_TOKEN = /(?<![\d:_-])(?:\+?84|0)(?:[\s.-]?\d){8,10}(?![\d:_-])/g;

const MAX_STRING = 200;
const MAX_DEPTH = 4;

export const maskPhones = (s: string): string => s.replace(PHONE_TOKEN, '[SĐT đã ẩn]');

function clean(v: unknown, depth: number): unknown {
  if (typeof v === 'string') return maskPhones(v.length > MAX_STRING ? `${v.slice(0, MAX_STRING)}…` : v);
  if (Array.isArray(v)) return depth >= MAX_DEPTH ? [] : v.slice(0, 500).map((x) => clean(x, depth + 1));
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if (depth >= MAX_DEPTH) return {};
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.test(k)) continue;
      out[k] = clean(x, depth + 1);
    }
    return out;
  }
  return v;
}

/** Copy of `detail` without content keys, long strings cut, phone numbers hidden. */
export function sanitizeDetail(detail: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!detail) return undefined;
  return clean(detail, 0) as Record<string, unknown>;
}
