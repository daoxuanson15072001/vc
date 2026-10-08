import {
  MAX_BATCH_SIZE,
  OPTIONAL_STREAMS,
  RECALL_MSG_TYPE,
  STREAMS,
  STREAM_CURSOR,
  fieldMappingSpecSchema,
  isSensitiveKey,
  mapRecord,
  type FieldMappingSpec,
  type MappingContext,
  type Stream,
  type StreamMapping,
} from '@vclinks/shared';
import { UnauthorizedError, type ApiClient } from './api';
import {
  assertSafeStore,
  countStore,
  getByKeys,
  indexFor,
  iterateStore,
  listDatabaseNames,
  listStores,
  openExistingDb,
  readPrimaryKeys,
  readTail,
  uidsFromDbNames,
} from './reader';
import { lightWindowStart, oldRunStop } from './quick-sync';
import { emptyStreamStats, type AccountRunStatus, type StreamRunStats } from './status';

/**
 * Sync core: IndexedDB → mapRecord (shared) → REST ingest.
 * No chrome.* APIs here; the API client and IDBFactory are injected.
 */

/** First N records of a stream are the drift sample. */
export const DRIFT_SAMPLE_SIZE = 50;
/** More than this share of failing sample records = the mapping no longer fits. */
export const DRIFT_FAIL_RATIO = 0.2;
export const READ_CHUNK_SIZE = 500;
/** Messages sent within this many ms before "now" are re-sent each sync (delivery status keeps changing). */
export const RECENT_OVERLAP_MS = 30 * 60_000;
/**
 * Streams re-sent in full every run. A contact's fields change without its
 * `lastActionTime` moving, so a cursor misses those updates; the store is small.
 */
export const FULL_EACH_RUN: ReadonlySet<Stream> = new Set<Stream>(['contacts']);

/**
 * Light sync (`light: true`): what the content-script poll runs when new message
 * records show up. Messages first (their thread ids pick the conversations), then
 * only the conversation records of those threads. Contacts, groups, reactions,
 * labels and read state stay with the full sync (alarm every 15 min).
 */
export const LIGHT_STREAMS: readonly Stream[] = ['messages', 'conversations'];
/** Light sync re-sends own recent messages only this far back (status 1 → 2 → 3); the full sync keeps RECENT_OVERLAP_MS. */
export const LIGHT_RECENT_MS = 5 * 60_000;
/** Light sync reads at most this many message records from the end of the store. */
export const LIGHT_MAX_READ = 3_000;
/**
 * Light sync stops after this many consecutive records older than its window.
 * Primary-key order (msgId) is only roughly time order, so one old record is not
 * enough to stop; a long run of them is.
 */
export const LIGHT_OLD_RUN_STOP = 50;

export interface SyncOptions {
  api: ApiClient;
  idb: IDBFactory;
  /** Ignore checkpoints and re-send everything ("Đồng bộ lại toàn bộ"). */
  full?: boolean;
  extensionVersion?: string;
  chunkSize?: number;
  batchSize?: number;
  onProgress?: (status: AccountRunStatus) => void;
  /** Content-free diagnostics only (counts, stream names). */
  log?: (msg: string) => void;
  now?: () => Date;
  /**
   * Streams to run, in this order (default: STREAMS). A stream left out is not
   * read at all and keeps the `pending` state in the run status.
   */
  streams?: readonly Stream[];
  /**
   * Light sync: messages are read from the end of the store only (newest
   * first, bounded), conversations only for the threads of those messages, no
   * `count()`, no backdated full pass and no `reportSync`. Use runLightSync().
   */
  light?: boolean;
  /**
   * Records this extension inserted for (uid, stream) since the last full run
   * (light syncs). They count as "new past the checkpoint" in the backdated
   * check, which otherwise sees them as records behind the checkpoint and
   * re-reads the whole store.
   */
  priorAccepted?: (uid: string, stream: Stream) => number;
}

export interface RunSummary {
  mappingVersion: number;
  uids: string[];
  accounts: AccountRunStatus[];
}

interface ActiveMapping {
  version: number;
  spec: FieldMappingSpec;
}

export async function runSync(opts: SyncOptions): Promise<RunSummary> {
  const record = await opts.api.getActiveMapping();
  // Re-validate the mapping locally: it decides which stores we open.
  const spec = fieldMappingSpecSchema.parse(record.spec);
  const mapping: ActiveMapping = { version: record.version, spec };

  const names = await listDatabaseNames(opts.idb);
  const prefixes = [...new Set(STREAMS.flatMap((s) => (spec.streams[s] ? [spec.streams[s]!.dbPrefix] : [])))];
  const uids = uidsFromDbNames(names, prefixes);
  opts.log?.(`VClinks: mapping v${mapping.version}, ${uids.length} account(s) found`);

  const accounts: AccountRunStatus[] = [];
  for (const uid of uids) {
    accounts.push(await syncAccount(uid, mapping, names, opts));
  }
  return { mappingVersion: mapping.version, uids, accounts };
}

/** Light sync of every account: new messages and their conversations only (see LIGHT_STREAMS). */
export function runLightSync(opts: Omit<SyncOptions, 'streams' | 'light' | 'full'>): Promise<RunSummary> {
  return runSync({ ...opts, streams: LIGHT_STREAMS, light: true, full: false });
}

export async function syncAccount(
  uid: string,
  mapping: ActiveMapping,
  dbNames: readonly string[],
  opts: SyncOptions,
): Promise<AccountRunStatus> {
  const now = opts.now ?? (() => new Date());
  const status: AccountRunStatus = {
    uid,
    state: 'running',
    full: !!opts.full,
    mappingVersion: mapping.version,
    startedAt: now().toISOString(),
    finishedAt: null,
    streams: Object.fromEntries(STREAMS.map((s) => [s, emptyStreamStats()])),
    errors: [],
  };
  const progress = () => opts.onProgress?.(structuredClone(status));
  progress();

  const openDbs = new Map<string, IDBDatabase | null>();
  const getDb = async (name: string) => {
    if (!openDbs.has(name)) {
      openDbs.set(name, dbNames.includes(name) ? await openExistingDb(opts.idb, name) : null);
    }
    return openDbs.get(name) ?? null;
  };

  try {
    await opts.api.registerAccount({ uid, label: 'Nick chưa đặt tên' });

    const ctx: SyncCtx = { uid, groupIds: new Set<string>(), touchedThreads: new Set<string>() };
    const sourceCounts: Partial<Record<Stream, number>> = {};
    const order = opts.streams ?? STREAMS;

    // STREAMS order: contacts → groups → conversations → messages.
    // Groups run before conversations/messages so `ctx.groupIds` is filled.
    // A run without the groups stream (light sync) takes the group ids from the
    // keys of the group store instead: conversation records without `isGroup`
    // would otherwise be typed 'user' and overwrite a correct 'group'.
    if (!order.includes('groups')) await seedGroupIds(mapping, ctx, getDb);
    for (const stream of order) {
      const stats = status.streams[stream]!;
      stats.state = 'running';
      progress();
      try {
        await syncStream(stream, mapping, ctx, getDb, stats, opts, progress);
        if (!opts.light && (stats.state as StreamRunStats['state']) === 'ok' && stats.backdated) {
          // Records appeared behind the checkpoint: the cursor would skip them forever.
          const backdated = stats.backdated;
          opts.log?.(`VClinks: ${uid}/${stream} ${backdated} record(s) behind the checkpoint, full pass`);
          Object.assign(stats, emptyStreamStats(), { state: 'running', backdated });
          await syncStream(stream, mapping, ctx, getDb, stats, { ...opts, full: true }, progress);
          stats.backdated = backdated;
        }
        if (stats.sourceCount !== null) sourceCounts[stream] = stats.sourceCount;
      } catch (e) {
        if (e instanceof UnauthorizedError) throw e;
        stats.state = 'error';
        stats.error = errorText(e);
        status.errors.push(`${stream}: ${stats.error}`);
      }
      progress();
      opts.log?.(
        `VClinks: ${uid}/${stream} ${stats.state} read=${stats.read} sent=${stats.sent} ` +
          `accepted=${stats.accepted} updated=${stats.updated} rejected=${stats.rejected} ` +
          `skipped=${stats.skipped} filtered=${stats.filtered}`,
      );
    }

    // Source counts come from count() of every store: only the full sync reports them.
    if (!opts.light) {
      await opts.api.reportSync({
        uid,
        sourceCounts,
        mappingVersion: mapping.version,
        ...(opts.extensionVersion ? { extensionVersion: opts.extensionVersion } : {}),
      });
    }
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      status.state = 'error';
      status.errors.push('Token không hợp lệ');
      status.finishedAt = now().toISOString();
      progress();
      closeAll(openDbs);
      throw e;
    }
    status.errors.push(errorText(e));
  }
  closeAll(openDbs);

  const states = Object.values(status.streams).map((s) => s!.state);
  status.state =
    status.errors.length || states.includes('error') ? 'error' : states.includes('drift') ? 'drift' : 'ok';
  status.finishedAt = now().toISOString();
  progress();
  return status;
}

function closeAll(dbs: Map<string, IDBDatabase | null>) {
  for (const db of dbs.values()) db?.close();
}

function errorText(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}

type SyncCtx = MappingContext & {
  groupIds: Set<string>;
  /** Thread ids of the messages posted in this run (the light sync reads only their conversations). */
  touchedThreads: Set<string>;
};

/** Fills ctx.groupIds from the group store's primary keys (no record value is read). Best effort. */
async function seedGroupIds(
  mapping: ActiveMapping,
  ctx: SyncCtx,
  getDb: (name: string) => Promise<IDBDatabase | null>,
): Promise<void> {
  const sm = mapping.spec.streams.groups;
  const field = sm?.fields.groupId;
  if (!sm || !field) return;
  try {
    const db = await getDb(`${sm.dbPrefix}${ctx.uid}`);
    if (!db || !listStores(db).includes(sm.store)) return;
    for (const k of (await readPrimaryKeys(db, sm.store, field)) ?? []) ctx.groupIds.add(String(k));
  } catch {
    // Without group ids, conversations fall back to `isGroup` from their own record.
  }
}

/** Sentinel for "this stream has nothing to read in a light run". */
const NOTHING: unknown[][] = [];

async function syncStream(
  stream: Stream,
  mapping: ActiveMapping,
  ctx: SyncCtx,
  getDb: (name: string) => Promise<IDBDatabase | null>,
  stats: StreamRunStats,
  opts: SyncOptions,
  progress: () => void,
): Promise<void> {
  const sm: StreamMapping | undefined = mapping.spec.streams[stream];
  if (!sm) {
    // Optional stream not in this mapping version yet (the API adds it from the defaults).
    stats.state = 'ok';
    return;
  }
  const dbName = `${sm.dbPrefix}${ctx.uid}`;
  const baseDrift = { uid: ctx.uid, stream, mappingVersion: mapping.version };
  // Optional streams (reactions, labels, read state) live in databases Zalo only
  // creates when there is something to store, and older accounts lack them
  // altogether: nothing to read is not a drift.
  const optional = (OPTIONAL_STREAMS as readonly string[]).includes(stream);

  const db = await getDb(dbName);
  if (!db) {
    if (optional) {
      // Not reported to the API either: there is no store to compare against.
      stats.state = 'ok';
      return;
    }
    stats.state = 'drift';
    stats.drift = 'missing_db';
    await opts.api.reportDrift({
      ...baseDrift,
      kind: 'missing_db',
      missing: [dbName],
      observedKeys: [],
      observedStores: [],
      sampleSize: 0,
      failedCount: 0,
    });
    return;
  }
  const stores = listStores(db);
  if (!stores.includes(sm.store)) {
    if (optional) {
      // Not reported to the API either: there is no store to compare against.
      stats.state = 'ok';
      return;
    }
    stats.state = 'drift';
    stats.drift = 'missing_store';
    await opts.api.reportDrift({
      ...baseDrift,
      kind: 'missing_store',
      missing: [sm.store],
      observedKeys: [],
      observedStores: stores.slice(0, 500).map((s) => s.slice(0, 200)),
      sampleSize: 0,
      failedCount: 0,
    });
    return;
  }
  assertSafeStore(sm.store);

  // count() walks the whole store: the light sync skips it (and the backdated check with it).
  if (!opts.light) stats.sourceCount = await countStore(db, sm.store);

  // Light sync reads only the conversations of the threads it just posted messages for.
  const lightConversations = !!opts.light && stream === 'conversations';
  const cursorField = FULL_EACH_RUN.has(stream) || lightConversations ? null : STREAM_CURSOR[stream];
  let prevSourceCount: number | null = null;
  if (cursorField && !opts.full) {
    const cp = await opts.api.getCheckpoint(ctx.uid, stream);
    stats.checkpoint = cp.cursor ?? null;
    prevSourceCount = cp.sourceCount ?? null;
  }
  const checkpoint = stats.checkpoint;
  // Cheap pre-filter on the raw record (skips mapRecord's deep copy for old records).
  // The authoritative filter is applied again on the mapped item.
  const cursorSource = cursorField ? sm.fields[cursorField] : undefined;
  // A recall turns an old record into msgType RECALL_MSG_TYPE without changing
  // its send time, so recalled messages always pass the checkpoint filter (the
  // API upsert is idempotent and keeps the content captured before the recall).
  const msgTypeSource = stream === 'messages' ? sm.fields.msgType : undefined;
  const isRecall = (v: unknown) => v !== undefined && v !== null && String(v) === RECALL_MSG_TYPE;

  const batchSize = Math.min(opts.batchSize ?? MAX_BATCH_SIZE, MAX_BATCH_SIZE);
  let buffer: Record<string, unknown>[] = [];
  let sampled = 0;
  let sampleFailed = 0;
  let decided = false;
  const missingUnion = new Set<string>();
  const keyUnion = new Set<string>();

  // Messages keep changing after they are stored (delivery status 1 → 2 → 3,
  // read receipts), so those sent in the last RECENT_OVERLAP_MS are re-sent
  // every sync even when they are behind the checkpoint: the upsert is idempotent.
  const nowMs = (opts.now?.() ?? new Date()).getTime();
  const recentSince =
    stream === 'messages' ? nowMs - (opts.light ? LIGHT_RECENT_MS : RECENT_OVERLAP_MS) : Infinity;
  // A light sync without a checkpoint (never synced) sends only the recent window.
  const floor = checkpoint ?? (opts.light && stream === 'messages' ? recentSince : null);
  const isBeforeCheckpoint = (v: unknown) => {
    if (floor === null || v === undefined || v === null || v === '') return false;
    const n = Number(v);
    return Number.isFinite(n) && n < floor && n < recentSince;
  };

  const flush = async (all: boolean) => {
    while (buffer.length >= batchSize || (all && buffer.length > 0)) {
      const batch = buffer.slice(0, batchSize);
      buffer = buffer.slice(batchSize);
      const res = await opts.api.ingest(stream, ctx.uid, batch);
      stats.batches++;
      stats.sent += batch.length;
      stats.accepted += res.accepted;
      stats.updated += res.updated;
      stats.unchanged += res.unchanged ?? 0;
      stats.rejected += res.rejected.length;
      progress();
    }
  };

  /** Returns true when the sample shows the mapping no longer fits (drift reported). */
  const decide = async (): Promise<boolean> => {
    decided = true;
    if (sampled === 0 || sampleFailed / sampled <= DRIFT_FAIL_RATIO) return false;
    stats.state = 'drift';
    stats.drift = 'missing_fields';
    buffer = [];
    await opts.api.reportDrift({
      ...baseDrift,
      kind: 'missing_fields',
      missing: [...missingUnion].sort().slice(0, 200),
      observedKeys: [...keyUnion].sort().slice(0, 500),
      observedStores: [],
      sampleSize: sampled,
      failedCount: sampleFailed,
    });
    return true;
  };

  let source: AsyncIterable<unknown[]> | Iterable<unknown[]>;
  if (!opts.light) {
    source = iterateStore(db, sm.store, opts.chunkSize ?? READ_CHUNK_SIZE);
  } else if (stream === 'messages' && cursorSource) {
    // Newest first, until a long run of records older than the window (or the cap).
    const since = lightWindowStart(checkpoint, recentSince);
    const index = indexFor(db, sm.store, cursorSource);
    const stop = oldRunStop(since, (r) => readPath(r, cursorSource), LIGHT_OLD_RUN_STOP);
    source = [await readTail(db, sm.store, { limit: LIGHT_MAX_READ, index, stop })];
  } else if (lightConversations && sm.fields.threadId) {
    const keys = [...ctx.touchedThreads];
    const records = keys.length ? await getByKeys(db, sm.store, sm.fields.threadId, keys) : [];
    // No key or index to look the threads up by: the API derives them from the messages.
    source = records && records.length ? [records] : NOTHING;
  } else {
    source = NOTHING;
  }

  for await (const records of source) {
    for (const record of records) {
      stats.read++;
      const inSample = !decided && sampled < DRIFT_SAMPLE_SIZE;
      if (inSample) {
        sampled++;
        if (record && typeof record === 'object') {
          for (const k of Object.keys(record)) {
            if (!isSensitiveKey(k) && k.length <= 200) keyUnion.add(k);
          }
        }
      }
      // Encrypted records are not skipped: mapRecord ingests their metadata and
      // drops the ciphertext (message content comes from the DOM later).
      const recalled = !!msgTypeSource && isRecall(readPath(record, msgTypeSource));
      if (!inSample && !recalled && cursorSource && isBeforeCheckpoint(readPath(record, cursorSource))) {
        stats.filtered++;
        continue;
      }

      const res = mapRecord(stream, sm, record, ctx);
      if (!res.ok) {
        stats.skipped++;
        if (inSample) {
          sampleFailed++;
          res.missing.forEach((m) => missingUnion.add(m));
        }
        continue;
      }
      const item = res.item;
      if (stream === 'groups' && item.groupId != null) ctx.groupIds.add(String(item.groupId));
      if (cursorField && !recalled && isBeforeCheckpoint(item[cursorField])) {
        stats.filtered++;
        continue;
      }
      if (stream === 'messages' && item.threadId != null) ctx.touchedThreads.add(String(item.threadId));
      buffer.push(item);
    }

    if (!decided && sampled >= DRIFT_SAMPLE_SIZE && (await decide())) return;
    if (decided) await flush(false);
  }
  if (!decided && (await decide())) return;
  await flush(true);
  stats.state = 'ok';
  // The store grew by more records than were new past the checkpoint: some
  // landed behind it (e.g. older history Zalo loaded when a chat was scrolled).
  if (!opts.light && checkpoint !== null && prevSourceCount !== null && stats.sourceCount !== null) {
    const elsewhere = opts.priorAccepted?.(ctx.uid, stream) ?? 0;
    const behind = stats.sourceCount - prevSourceCount - stats.accepted - elsewhere;
    if (behind > 0) stats.backdated = behind;
  }
}

/** Dotted-path read used only for the checkpoint pre-filter. */
function readPath(obj: unknown, path: string): unknown {
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

