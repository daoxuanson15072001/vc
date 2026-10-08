import type { Stream } from './schemas';

/**
 * Zalo Web encrypts text fields at rest in IndexedDB (message, dName, displayName,
 * phoneNumber...) and marks such records with `ev` (encryption version, e.g. 1).
 * The ciphertext is useless to us and must never be stored, but the metadata on
 * the same record (ids, timestamps, msgType, member lists) is readable and worth
 * keeping. So an encrypted record is ingested as METADATA ONLY: its ciphertext
 * fields are dropped, and message content is filled later from the DOM
 * (see docs/04-ky-thuat/zalo-web/zalo-web-extraction.md). We never decrypt.
 */

/** Record field carrying Zalo Web's at-rest encryption version. */
export const ENCRYPTION_VERSION_FIELD = 'ev';

/** True when a raw IndexedDB record carries a non-zero encryption version. */
export function isEncryptedRecord(record: unknown): boolean {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) return false;
  const v = (record as Record<string, unknown>)[ENCRYPTION_VERSION_FIELD];
  if (v === undefined || v === null || v === '' || v === false) return false;
  return Number(v) !== 0;
}

/**
 * Mapped ITEM fields whose value comes from a Zalo ciphertext field. They are
 * dropped from an encrypted record's item so only metadata is ingested. The API
 * `$unset`s the matching stored fields (message content comes from the DOM).
 */
export const ENCRYPTED_CONTENT_FIELDS: Record<Stream, readonly string[]> = {
  contacts: ['displayName', 'zaloName', 'phone', 'avatar'],
  groups: ['name', 'avatar'],
  conversations: [],
  messages: ['senderName', 'text', 'content', 'quote'],
  reactions: [],
  labels: ['name'],
  read_state: [],
};

/** Opaque base64 ciphertext blobs are long; ids/timestamps are numeric or short. */
const MIN_OPAQUE_LEN = 24;
const MAX_STRIP_DEPTH = 8;

function isOpaqueCipher(v: string): boolean {
  if (v.length < MIN_OPAQUE_LEN) return false;
  if (/^[0-9]+$/.test(v)) return false; // numeric ids / timestamps
  return true;
}

/**
 * Returns a deep copy of `record` with the encryption marker and every opaque
 * ciphertext string removed, keeping ids, timestamps, numbers and id arrays.
 * Used to build a metadata-only `raw` so no ciphertext ever reaches the backend,
 * even from a field name we have not catalogued.
 */
export function stripEncryptedValues<T>(record: T, depth = 0): T {
  if (depth > MAX_STRIP_DEPTH || record === null || typeof record !== 'object') return record;
  if (Array.isArray(record)) {
    return record
      .map((v) => (typeof v === 'string' ? (isOpaqueCipher(v) ? undefined : v) : stripEncryptedValues(v, depth + 1)))
      .filter((v) => v !== undefined) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record as Record<string, unknown>)) {
    if (k === ENCRYPTION_VERSION_FIELD) continue;
    if (typeof v === 'string') {
      if (!isOpaqueCipher(v)) out[k] = v;
    } else {
      out[k] = stripEncryptedValues(v, depth + 1);
    }
  }
  return out as T;
}
