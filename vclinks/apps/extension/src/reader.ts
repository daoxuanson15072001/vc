import { isSensitiveStoreName } from '@vclinks/shared';

/**
 * Read-only access to Zalo Web's IndexedDB.
 *
 * Rules (CLAUDE.md §4.1, §12.2):
 * - databases are opened WITHOUT a version, so we never trigger an upgrade and
 *   never create a database; every transaction is `readonly`;
 * - a store whose name looks sensitive (e2ee, token, session, key...) is never opened;
 * - our connection closes itself on `versionchange` so Zalo's own upgrades are never blocked;
 * - transactions are short: records are read in chunks and the transaction ends
 *   before the caller does any network I/O.
 *
 * Records are untrusted page data: this module only moves them around, it never logs them.
 */

/** Zalo account uids are numeric strings (e.g. `zdb_1234567890`). */
const UID_RE = /^\d{1,30}$/;

export class SensitiveStoreError extends Error {
  constructor(store: string) {
    super(`Refusing to open sensitive store "${store}"`);
    this.name = 'SensitiveStoreError';
  }
}

export function assertSafeStore(store: string): void {
  if (isSensitiveStoreName(store)) throw new SensitiveStoreError(store);
}

export async function listDatabaseNames(idb: IDBFactory): Promise<string[]> {
  const dbs = await idb.databases();
  return dbs.map((d) => d.name).filter((n): n is string => typeof n === 'string');
}

/** Account uids found behind any of `prefixes` (`zdb_<uid>`), sorted, de-duplicated. */
export function uidsFromDbNames(names: readonly string[], prefixes: readonly string[]): string[] {
  const uids = new Set<string>();
  for (const name of names) {
    for (const prefix of prefixes) {
      if (!name.startsWith(prefix)) continue;
      const uid = name.slice(prefix.length);
      if (UID_RE.test(uid)) uids.add(uid);
    }
  }
  return [...uids].sort();
}

/**
 * Opens an existing database at its current version. Returns null if it does not
 * exist (the implicit create is aborted in `onupgradeneeded`, so nothing is written).
 */
export function openExistingDb(idb: IDBFactory, name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    let aborted = false;
    const req = idb.open(name);
    req.onupgradeneeded = () => {
      // Only happens when the DB does not exist yet: never create it.
      aborted = true;
      req.transaction?.abort();
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => {
      if (aborted) resolve(null);
      else reject(req.error ?? new Error(`Cannot open IndexedDB "${name}"`));
    };
    req.onblocked = () => {
      /* opening without version never blocks; ignore */
    };
  });
}

export function listStores(db: IDBDatabase): string[] {
  return Array.from(db.objectStoreNames);
}

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function countStore(db: IDBDatabase, store: string): Promise<number> {
  assertSafeStore(store);
  return reqPromise(db.transaction(store, 'readonly').objectStore(store).count());
}

export interface Chunk {
  records: unknown[];
  /** Primary key of the last record, to resume after it. */
  lastKey: IDBValidKey | undefined;
  done: boolean;
}

/**
 * Reads up to `limit` records with primary key > `afterKey`, in one short readonly
 * transaction. The transaction auto-commits when this resolves.
 */
export async function readChunk(
  db: IDBDatabase,
  store: string,
  afterKey: IDBValidKey | undefined,
  limit: number,
): Promise<Chunk> {
  assertSafeStore(store);
  return new Promise<Chunk>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const range = afterKey === undefined ? undefined : IDBKeyRange.lowerBound(afterKey, true);
    const req = tx.objectStore(store).openCursor(range);
    const records: unknown[] = [];
    let lastKey: IDBValidKey | undefined = afterKey;
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve({ records, lastKey, done: true });
        return;
      }
      records.push(cursor.value);
      lastKey = cursor.primaryKey;
      if (records.length >= limit) resolve({ records, lastKey, done: false });
      else cursor.continue();
    };
    req.onerror = () => reject(req.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/** Iterates a whole store chunk by chunk; no transaction spans the consumer's awaits. */
export async function* iterateStore(
  db: IDBDatabase,
  store: string,
  chunkSize = 500,
): AsyncGenerator<unknown[]> {
  let afterKey: IDBValidKey | undefined;
  for (;;) {
    const chunk = await readChunk(db, store, afterKey, chunkSize);
    if (chunk.records.length) yield chunk.records;
    if (chunk.done) return;
    afterKey = chunk.lastKey;
  }
}

/**
 * How many of `keys` exist in `store`, looked up by `idField` (primary key or an
 * index of that name). Reads keys only, never values. Null when the store has
 * neither, i.e. the lookup cannot be done without reading records.
 */
export async function countKnownKeys(
  db: IDBDatabase,
  store: string,
  idField: string,
  keys: readonly string[],
): Promise<number | null> {
  assertSafeStore(store);
  if (!db.objectStoreNames.contains(store)) return null;
  const os = db.transaction(store, 'readonly').objectStore(store);
  const source: IDBObjectStore | IDBIndex | null =
    os.keyPath === idField ? os : os.indexNames.contains(idField) ? os.index(idField) : null;
  if (!source) return null;
  const found = await Promise.all(keys.map((k) => reqPromise(source.getKey(k)).then((v) => v !== undefined)));
  return found.filter(Boolean).length;
}

/** Name of an index of `store` whose keyPath is exactly `field`, or null. */
export function indexFor(db: IDBDatabase, store: string, field: string): string | null {
  assertSafeStore(store);
  if (!db.objectStoreNames.contains(store)) return null;
  const os = db.transaction(store, 'readonly').objectStore(store);
  for (const name of Array.from(os.indexNames)) {
    if (os.index(name).keyPath === field) return name;
  }
  return null;
}

export interface TailOptions {
  /** Hard cap on records read. */
  limit: number;
  /** Walk this index (newest key first) instead of the primary key. */
  index?: string | null;
  /** Called for each record, newest first; returning true ends the walk after that record. */
  stop?: (record: unknown) => boolean;
}

/**
 * Reads records from the END of a store (cursor direction 'prev'), in one short
 * readonly transaction, newest key first. Used by the light sync and the poll so
 * a store of 100k messages is never walked in full just to find the few new ones.
 */
export async function readTail(db: IDBDatabase, store: string, opts: TailOptions): Promise<unknown[]> {
  assertSafeStore(store);
  return new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const os = tx.objectStore(store);
    const source: IDBObjectStore | IDBIndex = opts.index && os.indexNames.contains(opts.index) ? os.index(opts.index) : os;
    const req = source.openCursor(null, 'prev');
    const records: unknown[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(records);
        return;
      }
      records.push(cursor.value);
      if (records.length >= opts.limit || opts.stop?.(cursor.value)) resolve(records);
      else cursor.continue();
    };
    req.onerror = () => reject(req.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/**
 * Records of `store` whose `field` is one of `keys`, looked up through the primary
 * key or an index of that name. Null when the store has neither (the caller then
 * cannot do a targeted read). Missing keys are simply absent from the result.
 */
export async function getByKeys(
  db: IDBDatabase,
  store: string,
  field: string,
  keys: readonly IDBValidKey[],
): Promise<unknown[] | null> {
  assertSafeStore(store);
  if (!db.objectStoreNames.contains(store)) return null;
  const os = db.transaction(store, 'readonly').objectStore(store);
  const source: IDBObjectStore | IDBIndex | null =
    os.keyPath === field ? os : os.indexNames.contains(field) ? os.index(field) : null;
  if (!source) return null;
  const found = await Promise.all(keys.map((k) => reqPromise(source.get(k))));
  return found.filter((r) => r !== undefined);
}

/** Primary keys of `store` when its keyPath is `field` (keys only, no record value is read); else null. */
export async function readPrimaryKeys(db: IDBDatabase, store: string, field: string): Promise<IDBValidKey[] | null> {
  assertSafeStore(store);
  if (!db.objectStoreNames.contains(store)) return null;
  const os = db.transaction(store, 'readonly').objectStore(store);
  if (os.keyPath !== field) return null;
  return reqPromise(os.getAllKeys());
}
