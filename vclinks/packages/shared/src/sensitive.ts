/**
 * Guards against secrets leaking from Zalo Web into VClinks.
 *
 * Zalo Web keeps E2EE session material and tokens next to regular data in
 * IndexedDB. None of it may ever be accepted or stored (CLAUDE.md §3, §12.2).
 * The extension strips these keys client-side; the API rejects any item that
 * still carries one.
 */

const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  // e2ee_session, e2ee_identity, e2ee_*key*, and the bare `e2ee` object on group records.
  // `e2eeStatus` (message field) stays allowed.
  /^e2ee(_|$)/i,
  /token/i, // refresh_token, access_token, zpw_token...
  /cookie/i,
  /passw(or)?d/i,
  /secret/i,
  /private_?key/i,
  /(^|[_-])otp([_-]|$)/i,
  /^otp[A-Z]/,
];

/** Stores that must never be opened by the extension. */
const SENSITIVE_STORE_PATTERNS: RegExp[] = [/e2ee/i, /token/i, /session/i, /cookie/i, /key/i];

const MAX_DEPTH = 32;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

export function isSensitiveStoreName(name: string): boolean {
  return SENSITIVE_STORE_PATTERNS.some((re) => re.test(name));
}

/** Returns dotted paths of every sensitive key found in `value` (recursively). */
export function findSensitivePaths(value: unknown, path = '', depth = 0): string[] {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return [];
  const found: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => found.push(...findSensitivePaths(v, `${path}[${i}]`, depth + 1)));
    return found;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k;
    if (isSensitiveKey(k)) found.push(p);
    else found.push(...findSensitivePaths(v, p, depth + 1));
  }
  return found;
}

/** Deep-copies `value` without any sensitive key. Used client-side before sending. */
export function stripSensitive<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripSensitive(v, depth + 1)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!isSensitiveKey(k)) out[k] = stripSensitive(v, depth + 1);
  }
  return out as T;
}
