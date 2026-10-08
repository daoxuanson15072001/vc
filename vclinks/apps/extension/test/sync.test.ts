import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FIELD_MAPPING,
  MAX_BATCH_SIZE,
  validateItems,
  type CheckpointResponse,
  type DriftReport,
  type FieldMappingRecord,
  type FieldMappingSpec,
  type IngestResult,
  type Stream,
  type SyncReport,
} from '@vclinks/shared';
import { HttpApiClient, UnauthorizedError, type ApiClient } from '../src/api';
import { readChunk, SensitiveStoreError, uidsFromDbNames, openExistingDb } from '../src/reader';
import { LIGHT_OLD_RUN_STOP, LIGHT_RECENT_MS, runLightSync, runSync } from '../src/sync';

// ---------------------------------------------------------------- fixtures

const SECRET = 'SUPER-SECRET-VALUE-42';

type StoreDef = { keyPath: string; records: Record<string, unknown>[] };

async function createDb(idb: IDBFactory, name: string, stores: Record<string, StoreDef>) {
  await new Promise<void>((resolve, reject) => {
    const req = idb.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [store, def] of Object.entries(stores)) {
        const os = db.createObjectStore(store, { keyPath: def.keyPath });
        for (const r of def.records) os.put(r);
      }
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

const GROUP_ID = 'g900';
const T0 = 1_727_000_000_000;

function friend(i: number) {
  return {
    userId: `u${i}`,
    displayName: `Friend ${i}`,
    zaloName: `friend${i}`,
    phoneNumber: `09000000${i}`,
    isFr: 1,
    lastActionTime: T0 + i,
    refresh_token: SECRET,
    e2ee_identity: SECRET,
  };
}

function message(i: number, extra: Record<string, unknown> = {}) {
  const toGroup = i % 10 === 0;
  return {
    msgId: `m${String(i).padStart(6, '0')}`,
    cliMsgId: `c${i}`,
    fromUid: toGroup ? `u${i % 7}` : i % 2 ? '0' : `u${i % 7}`,
    toUid: toGroup ? GROUP_ID : i % 2 ? `u${i % 7}` : '111',
    dName: 'Someone',
    msgType: 'webchat',
    message: `hello ${i}`,
    sendDttm: String(T0 + i * 1000),
    e2eeStatus: 0,
    e2ee_session: SECRET,
    properties: { access_token: SECRET, color: 1 },
    ...extra,
  };
}

async function seedAccount(
  idb: IDBFactory,
  uid: string,
  opts: { messages?: Record<string, unknown>[]; withConversation?: boolean; withExtras?: boolean } = {},
) {
  const stores: Record<string, StoreDef> = {
    friend: { keyPath: 'userId', records: [1, 2, 3].map(friend) },
    group: {
      // Real Zalo shape (drift report 2026-09-28): keyed on userId, name in displayName, carries an `e2ee` object.
      keyPath: 'userId',
      records: [{ userId: GROUP_ID, displayName: 'Nhóm phụ tùng', memberIds: ['u1', 'u2'], creatorId: 'u1', e2ee: { k: SECRET } }],
    },
    message: { keyPath: 'msgId', records: opts.messages ?? [1, 2, 3, 10].map((i) => message(i)) },
    e2ee_session: { keyPath: 'id', records: [{ id: 1, key: SECRET }] },
  };
  if (opts.withConversation !== false) {
    stores.conversation = {
      keyPath: 'userId',
      records: [
        { userId: 'u1', isGroup: 0, pinned: 1 },
        { userId: GROUP_ID, isGroup: 1, pinned: 0 },
      ],
    };
  }
  if (opts.withExtras) {
    // Real shapes surveyed 28/09/2026: label names are ciphertext (ev: 1), reactions live in r_db_<uid>.
    stores.label = { keyPath: 'id', records: [{ id: 7, text: 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=', color: '#d91b1b', conversations: ['u1'], offset: 3, createTime: T0, ev: 1 }] };
  }
  await createDb(idb, `zdb_${uid}`, stores);
  // Other per-account DBs that must be ignored.
  const msginfo: Record<string, StoreDef> = { ThreadMsg: { keyPath: 'id', records: [{ id: 1 }] } };
  if (opts.withExtras) msginfo.unreadInfo = { keyPath: 'userId', records: [{ userId: 'u1', mId: 900001, timestamp: T0 + 5000 }] };
  await createDb(idb, `msginfo_${uid}`, msginfo);
  if (opts.withExtras) {
    await createDb(idb, `r_db_${uid}`, {
      reaction: { keyPath: 'rMsgId', records: [{ rMsgId: 'm000001', rClientMsgId: 1, idTo: 'u1', reactions: { '0': { '3': 1 }, u2: { '5': 1 } }, currentIcon: 3, lastSender: 'u2', lastUpdate: T0 + 9000, msgType: 'chat.reaction' }] },
      unread_react: { keyPath: 'id', records: [{ id: 1 }] },
    });
  }
}

// ---------------------------------------------------------------- fake API

class FakeApi implements ApiClient {
  mapping: FieldMappingSpec = DEFAULT_FIELD_MAPPING;
  checkpoints: Partial<Record<Stream, number>> = {};
  /** Source counts reported by the previous run (checkpoint.sourceCount). */
  sourceCounts: Partial<Record<Stream, number>> = {};
  accounts: string[] = [];
  batches: { stream: Stream; uid: string; items: Record<string, unknown>[] }[] = [];
  drifts: DriftReport[] = [];
  reports: SyncReport[] = [];
  checkpointCalls: string[] = [];

  async getActiveMapping(): Promise<FieldMappingRecord> {
    return { id: 'm1', version: 1, status: 'active', spec: this.mapping, proposedBy: 'seed', createdAt: '' };
  }
  async registerAccount(input: { uid: string; label: string }) {
    this.accounts.push(input.uid);
    return { uid: input.uid, label: input.label, created: true };
  }
  async getCheckpoint(uid: string, stream: Stream): Promise<CheckpointResponse> {
    this.checkpointCalls.push(`${uid}:${stream}`);
    return { uid, stream, cursor: this.checkpoints[stream] ?? null, sourceCount: this.sourceCounts[stream] ?? null };
  }
  async ingest(stream: Stream, uid: string, items: Record<string, unknown>[]): Promise<IngestResult> {
    // Deep copy, like a real network hop.
    this.batches.push({ stream, uid, items: JSON.parse(JSON.stringify(items)) });
    const { valid, rejected } = validateItems(stream, items);
    return { accepted: valid.length, updated: 0, unchanged: 0, rejected, checkpoint: null };
  }
  async ingestContent(_uid: string, items: Record<string, unknown>[]) {
    return { matched: items.length, unmatched: [] as string[], rejected: [] };
  }
  async ingestThreadNames(_uid: string, items: Record<string, unknown>[]) {
    return { matched: items.length, unmatched: [] as string[], rejected: [] };
  }
  async reportDrift(report: DriftReport) {
    this.drifts.push(report);
    return { id: `d${this.drifts.length}` };
  }
  async reportSync(report: SyncReport) {
    this.reports.push(report);
    return { ok: true as const };
  }

  items(stream: Stream, uid?: string) {
    return this.batches.filter((b) => b.stream === stream && (!uid || b.uid === uid)).flatMap((b) => b.items);
  }
}

// ---------------------------------------------------------------- tests

let idb: IDBFactory;
let api: FakeApi;
const logs: string[] = [];

beforeEach(() => {
  idb = new IDBFactory();
  api = new FakeApi();
  logs.length = 0;
});
afterEach(() => vi.restoreAllMocks());

const run = (extra: Partial<Parameters<typeof runSync>[0]> = {}) =>
  runSync({ api, idb, extensionVersion: '0.1.0', log: (m) => logs.push(m), ...extra });

describe('reader', () => {
  it('finds numeric uids behind the prefix only', () => {
    expect(uidsFromDbNames(['zdb_111', 'zdb_222', 'msginfo_111', 'zdb_abc', 'zdb_', 'r_db_111'], ['zdb_'])).toEqual([
      '111',
      '222',
    ]);
  });

  it('never creates a database that does not exist', async () => {
    expect(await openExistingDb(idb, 'zdb_404')).toBeNull();
    expect((await idb.databases()).map((d) => d.name)).not.toContain('zdb_404');
  });

  it('refuses to read sensitive stores', async () => {
    await seedAccount(idb, '111');
    const db = (await openExistingDb(idb, 'zdb_111'))!;
    await expect(readChunk(db, 'e2ee_session', undefined, 10)).rejects.toBeInstanceOf(SensitiveStoreError);
    db.close();
  });
});

describe('runSync', () => {
  it('maps and pushes every stream of an account, in order, without secrets', async () => {
    await seedAccount(idb, '111');
    const summary = await run();

    expect(summary.uids).toEqual(['111']);
    expect(api.accounts).toEqual(['111']);
    expect(api.batches.map((b) => b.stream)).toEqual(['contacts', 'groups', 'conversations', 'messages']);
    expect(api.drifts).toEqual([]);

    const contacts = api.items('contacts');
    expect(contacts).toHaveLength(3);
    expect(contacts[0]).toMatchObject({ userId: 'u1', displayName: 'Friend 1', phone: '090000001', isFriend: true });

    const convs = api.items('conversations');
    expect(convs.find((c) => c.threadId === GROUP_ID)?.type).toBe('group');
    expect(convs.find((c) => c.threadId === 'u1')?.type).toBe('user');

    const msgs = api.items('messages');
    expect(msgs).toHaveLength(4);
    expect(msgs.find((m) => m.msgId === 'm000010')?.threadId).toBe(GROUP_ID);
    expect(msgs.find((m) => m.msgId === 'm000001')).toMatchObject({ text: 'hello 1', threadId: 'u1' });

    // Every item passes the API schema (nothing rejected).
    expect(summary.accounts[0].streams.messages).toMatchObject({ state: 'ok', sent: 4, accepted: 4, rejected: 0 });
    expect(summary.accounts[0].state).toBe('ok');

    // Secrets never leave the page.
    const wire = JSON.stringify(api.batches);
    expect(wire).not.toContain(SECRET);
    for (const k of ['refresh_token', 'e2ee_identity', 'e2ee_session', 'access_token']) expect(wire).not.toContain(k);
    expect(msgs[0].raw).toMatchObject({ properties: { color: 1 } });

    // Source counts reported per stream.
    expect(api.reports).toEqual([
      {
        uid: '111',
        sourceCounts: { contacts: 3, groups: 1, conversations: 2, messages: 4 },
        mappingVersion: 1,
        extensionVersion: '0.1.0',
      },
    ]);

    // Logs carry counts only, never message text.
    expect(logs.join('\n')).not.toMatch(/hello|Friend|SUPER-SECRET/);
  });

  it('never opens a sensitive store', async () => {
    await seedAccount(idb, '111');
    const opened: string[] = [];
    const orig = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, names, ...rest) {
      opened.push(...(Array.isArray(names) ? names : [names as string]));
      return orig.call(this, names, ...(rest as [IDBTransactionMode]));
    });
    await run();
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.some((n) => /e2ee|ThreadMsg/.test(n))).toBe(false);
    expect(new Set(opened)).toEqual(new Set(['friend', 'group', 'conversation', 'message']));
  });

  it('rejects a mapping that points at a sensitive store before opening anything', async () => {
    await seedAccount(idb, '111');
    api.mapping = {
      streams: { ...DEFAULT_FIELD_MAPPING.streams, messages: { ...DEFAULT_FIELD_MAPPING.streams.messages, store: 'e2ee_session' } },
    };
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction');
    await expect(run()).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
    expect(api.batches).toEqual([]);
  });

  it('splits 1200 messages into batches of at most 500', async () => {
    const messages = Array.from({ length: 1200 }, (_, i) => message(i + 1));
    await seedAccount(idb, '111', { messages });
    await run();
    const sizes = api.batches.filter((b) => b.stream === 'messages').map((b) => b.items.length);
    expect(sizes).toEqual([500, 500, 200]);
    expect(sizes.every((s) => s <= MAX_BATCH_SIZE)).toBe(true);
    expect(new Set(api.items('messages').map((m) => m.msgId)).size).toBe(1200);
  });

  it('only sends items at or after the checkpoint, unless full', async () => {
    const messages = Array.from({ length: 120 }, (_, i) => message(i + 1));
    await seedAccount(idb, '111', { messages });
    const cp = T0 + 100 * 1000; // message 100
    api.checkpoints = { messages: cp, contacts: T0 + 2 };

    const summary = await run();
    const sent = api.items('messages');
    expect(sent).toHaveLength(21); // 100..120, `>=` on purpose
    expect(sent.every((m) => Number(m.sentAt) >= cp)).toBe(true);
    expect(summary.accounts[0].streams.messages).toMatchObject({ filtered: 99, sent: 21, checkpoint: cp });
    // Contacts change without their cursor moving: always re-sent in full, no checkpoint read.
    expect(api.items('contacts').map((c) => c.userId)).toEqual(['u1', 'u2', 'u3']);
    expect(api.checkpointCalls).not.toContain('111:contacts');
    expect(api.items('groups')).toHaveLength(1); // no cursor: always full
    expect(api.checkpointCalls).not.toContain('111:groups');

    api.batches = [];
    api.checkpointCalls = [];
    await run({ full: true });
    expect(api.items('messages')).toHaveLength(120);
    expect(api.checkpointCalls).toEqual([]);
  });

  it('re-reads a stream in full when records appeared behind the checkpoint since the last run', async () => {
    const messages = Array.from({ length: 120 }, (_, i) => message(i + 1));
    await seedAccount(idb, '111', { messages });
    api.checkpoints = { messages: T0 + 100 * 1000 };

    // Last run counted 100 records; 20 are new and all past the checkpoint: nothing behind it.
    api.sourceCounts = { messages: 100 };
    let summary = await run();
    expect(api.items('messages')).toHaveLength(21);
    expect(summary.accounts[0].streams.messages?.backdated).toBeUndefined();

    // Last run counted 90: 30 new records but only 21 past the checkpoint, so 9 were inserted behind it.
    api.batches = [];
    api.sourceCounts = { messages: 90 };
    summary = await run();
    expect(api.items('messages')).toHaveLength(21 + 120);
    expect(summary.accounts[0].streams.messages).toMatchObject({ state: 'ok', backdated: 9, filtered: 0, sent: 120 });
  });

  it('reads reactions, labels and read state when their stores exist, and skips them quietly otherwise', async () => {
    await seedAccount(idb, '111', { withExtras: true });
    const summary = await run();
    expect(api.drifts).toEqual([]);
    expect(api.batches.map((b) => b.stream)).toEqual(['contacts', 'groups', 'conversations', 'messages', 'reactions', 'labels', 'read_state']);
    expect(api.items('reactions')[0]).toMatchObject({ msgId: 'm000001', cliMsgId: '1', threadId: 'u1', reactions: { '0': { '3': 1 }, u2: { '5': 1 } }, currentIcon: 3 });
    const label = api.items('labels')[0];
    expect(label).toMatchObject({ labelId: '7', color: '#d91b1b', conversationIds: ['u1'], encrypted: true });
    expect(label).not.toHaveProperty('name');
    expect(JSON.stringify(api.items('labels'))).not.toContain('QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=');
    expect(api.items('read_state')[0]).toMatchObject({ threadId: 'u1', lastReadMsgId: '900001', at: T0 + 5000 });
    expect(api.items('conversations').find((c) => c.threadId === 'u1')).toMatchObject({ pinned: true });
    expect(summary.accounts[0].streams.reactions).toMatchObject({ state: 'ok', sent: 1 });
    expect(api.reports[0].sourceCounts).toMatchObject({ reactions: 1, labels: 1, read_state: 1 });

    // The default fixture has no r_db_ / label / unreadInfo: no drift, nothing reported for them.
    api.batches = []; api.drifts = []; api.reports = [];
    await seedAccount(idb, '222');
    const s2 = await run();
    expect(api.drifts).toEqual([]);
    expect(s2.accounts.find((a) => a.uid === '222')?.streams.reactions).toMatchObject({ state: 'ok', read: 0 });
    expect(api.reports.find((r) => r.uid === '222')?.sourceCounts).not.toHaveProperty('reactions');
  });

  it('always re-sends recalled messages, even before the checkpoint', async () => {
    // Message 10 was recalled after an earlier sync: same send time, msgType 20.
    const messages = Array.from({ length: 120 }, (_, i) => message(i + 1, i + 1 === 10 ? { msgType: 20 } : {}));
    await seedAccount(idb, '111', { messages });
    api.checkpoints = { messages: T0 + 100 * 1000 };

    await run();
    const sent = api.items('messages');
    expect(sent).toHaveLength(22); // 100..120 + the recall
    expect(sent.find((m) => m.msgId === 'm000010')).toMatchObject({ msgType: '20', text: '[Đã thu hồi]' });
  });

  it('reports drift and stops the stream when message fields were renamed', async () => {
    const messages = Array.from({ length: 80 }, (_, i) => {
      const { fromUid, sendDttm, ...rest } = message(i + 1);
      return { ...rest, senderUid: fromUid, sendTime: sendDttm };
    });
    await seedAccount(idb, '111', { messages });
    const summary = await run();

    expect(api.items('messages')).toEqual([]);
    expect(api.items('contacts')).toHaveLength(3); // other streams unaffected
    expect(api.drifts).toHaveLength(1);
    const d = api.drifts[0];
    expect(d).toMatchObject({ uid: '111', stream: 'messages', kind: 'missing_fields', mappingVersion: 1 });
    expect(d.missing).toEqual(expect.arrayContaining(['fromUid', 'sentAt']));
    expect(d.sampleSize).toBe(50);
    expect(d.failedCount).toBe(50);
    expect(d.observedKeys).toEqual(expect.arrayContaining(['msgId', 'senderUid', 'sendTime', 'properties']));
    expect(d.observedKeys).not.toContain('e2ee_session');
    expect(JSON.stringify(api.drifts)).not.toContain(SECRET);
    expect(JSON.stringify(api.drifts)).not.toContain('hello');
    expect(summary.accounts[0].streams.messages).toMatchObject({ state: 'drift', drift: 'missing_fields', sent: 0 });
    expect(summary.accounts[0].state).toBe('drift');
  });

  const CIPHER = 'lk4njWs4ssRmcxFy61oYAU76vmSyDd+x5JiglmWzlY=';

  it('ingests metadata for encrypted messages, dropping ciphertext (no drift)', async () => {
    const messages = Array.from({ length: 80 }, (_, i) =>
      message(i + 1, i >= 60 ? { ev: 1, message: CIPHER, dName: CIPHER } : {}),
    );
    await seedAccount(idb, '111', { messages });
    const summary = await run({ chunkSize: 10, batchSize: 10 });

    const sent = api.items('messages');
    expect(sent.length).toBe(80); // everything ingested, encrypted or not
    expect(api.drifts).toEqual([]);
    expect(JSON.stringify(sent)).not.toContain('lk4njWs4ssRmcx'); // ciphertext dropped

    const enc = sent.filter((m) => m.encrypted);
    expect(enc.length).toBe(20);
    expect(enc.every((m) => m.contentStatus === 'pending' && m.text === undefined && m.senderName === undefined)).toBe(true);
    const plain = sent.filter((m) => !m.encrypted);
    expect(plain.every((m) => m.contentStatus === 'complete')).toBe(true);
    expect(summary.accounts[0].streams.messages).toMatchObject({ state: 'ok' });
    expect(summary.accounts[0].streams.messages?.drift).toBeUndefined();
  });

  it('ingests metadata even when every message is encrypted', async () => {
    const messages = Array.from({ length: 20 }, (_, i) => message(i + 1, { ev: 1, message: CIPHER }));
    await seedAccount(idb, '111', { messages });
    const summary = await run();
    const sent = api.items('messages');
    expect(sent.length).toBe(20);
    expect(sent.every((m) => m.encrypted === true && m.contentStatus === 'pending')).toBe(true);
    expect(api.drifts).toEqual([]);
    expect(summary.accounts[0].streams.messages).toMatchObject({ state: 'ok' });
  });

  it('skips a few bad records below the drift threshold', async () => {
    const messages = Array.from({ length: 100 }, (_, i) => {
      const m = message(i + 1);
      if (i % 10 === 5) delete (m as Partial<typeof m>).sendDttm; // 10% broken
      return m;
    });
    await seedAccount(idb, '111', { messages });
    const summary = await run();
    expect(api.drifts).toEqual([]);
    expect(api.items('messages')).toHaveLength(90);
    expect(summary.accounts[0].streams.messages).toMatchObject({ state: 'ok', skipped: 10 });
  });

  it('handles several accounts equally and reports a missing store', async () => {
    await seedAccount(idb, '111');
    await seedAccount(idb, '222', { withConversation: false });
    const summary = await run();

    expect(summary.uids).toEqual(['111', '222']);
    expect(api.accounts).toEqual(['111', '222']);
    expect(api.items('messages', '111')).toHaveLength(4);
    expect(api.items('messages', '222')).toHaveLength(4);
    expect(api.drifts).toEqual([
      expect.objectContaining({ uid: '222', stream: 'conversations', kind: 'missing_store', missing: ['conversation'] }),
    ]);
    expect(api.drifts[0].observedStores).toEqual(expect.arrayContaining(['friend', 'message', 'group']));
    expect(api.reports.find((r) => r.uid === '222')?.sourceCounts).toEqual({ contacts: 3, groups: 1, messages: 4 });
  });

  it('stops everything on 401', async () => {
    await seedAccount(idb, '111');
    await seedAccount(idb, '222');
    api.ingest = async () => {
      throw new UnauthorizedError();
    };
    const progress: string[] = [];
    await expect(run({ onProgress: (s) => progress.push(s.uid) })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(api.accounts).toEqual(['111']);
    expect(progress).not.toContain('222');
  });
});

describe('runLightSync (fast path)', () => {
  // Message i is sent at T0 + i s; "now" is just after message 2000.
  const NOW = new Date(T0 + 2000 * 1000 + 500);
  const light = (extra: Partial<Parameters<typeof runLightSync>[0]> = {}) =>
    runLightSync({ api, idb, log: (m) => logs.push(m), now: () => NOW, ...extra });

  it('runs only messages then conversations: no contacts, groups, optional streams, count() or reportSync', async () => {
    await seedAccount(idb, '111', { withExtras: true, messages: [1995, 1999, 2000].map((i) => message(i)) });
    api.checkpoints = { messages: T0 + 1990 * 1000 };
    const opened: string[] = [];
    const orig = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, names, ...rest) {
      opened.push(...(Array.isArray(names) ? names : [names as string]));
      return orig.call(this, names, ...(rest as [IDBTransactionMode]));
    });
    const count = vi.spyOn(IDBObjectStore.prototype, 'count');
    const summary = await light();

    expect(api.batches.map((b) => b.stream)).toEqual(['messages', 'conversations']);
    expect(api.reports).toEqual([]);
    expect(count).not.toHaveBeenCalled();
    expect(api.checkpointCalls).toEqual(['111:messages']);
    // Group store: keys only (seeding group ids); never friend, label, reaction, read state.
    expect(new Set(opened)).toEqual(new Set(['group', 'message', 'conversation']));
    const s = summary.accounts[0];
    expect(s.state).toBe('ok');
    expect(s.streams.contacts?.state).toBe('pending');
    expect(s.streams.messages).toMatchObject({ state: 'ok', sent: 3, sourceCount: null });
    expect(logs.join('\n')).not.toMatch(/hello/);
  });

  it('reads only the end of the message store, down to the checkpoint / recent window', async () => {
    const messages = Array.from({ length: 2000 }, (_, i) => message(i + 1));
    await seedAccount(idb, '111', { messages });
    api.checkpoints = { messages: T0 + 1990 * 1000 };
    const summary = await light();

    // Window = min(checkpoint, now - LIGHT_RECENT_MS) = message 1700.
    const since = T0 + 2000 * 1000 + 500 - LIGHT_RECENT_MS;
    const sent = api.items('messages');
    expect(sent.length).toBe(300);
    expect(sent.every((m) => Number(m.sentAt) >= since)).toBe(true);
    // Stopped after LIGHT_OLD_RUN_STOP older records instead of walking 2000.
    expect(summary.accounts[0].streams.messages!.read).toBe(300 + LIGHT_OLD_RUN_STOP);
  });

  it('without a checkpoint reads only the recent window (the full sync does the rest)', async () => {
    const messages = Array.from({ length: 2000 }, (_, i) => message(i + 1));
    await seedAccount(idb, '111', { messages });
    await light();
    expect(api.items('messages')).toHaveLength(300);
  });

  it('still re-sends a recalled message in the tail', async () => {
    await seedAccount(idb, '111', { messages: [1990, 1991, 1992].map((i) => message(i, i === 1991 ? { msgType: '20' } : {})) });
    api.checkpoints = { messages: T0 + 1992 * 1000 };
    const realNow = new Date(T0 + 99_999_999);
    await runLightSync({ api, idb, now: () => realNow });
    expect(api.items('messages').map((m) => m.msgId).sort()).toEqual(['m001991', 'm001992']);
  });

  it('reads only the conversations of the threads it posted messages for', async () => {
    const mine = (i: number) => message(i, { fromUid: '0', toUid: 'u1' });
    await seedAccount(idb, '111', { messages: [1998, 1999].map(mine) });
    api.checkpoints = { messages: T0 + 1990 * 1000 };
    await light();
    expect(api.items('conversations').map((c) => c.threadId)).toEqual(['u1']);
  });

  it('posts no conversation when no message is new', async () => {
    await seedAccount(idb, '111', { messages: [1, 2].map((i) => message(i)) });
    api.checkpoints = { messages: T0 + 1990 * 1000 };
    await light();
    expect(api.batches).toEqual([]);
  });

  it('types a conversation without isGroup as a group from the group store keys', async () => {
    await createDb(idb, 'zdb_111', {
      group: { keyPath: 'userId', records: [{ userId: GROUP_ID, displayName: 'x', memberIds: [] }] },
      conversation: { keyPath: 'userId', records: [{ userId: GROUP_ID }, { userId: 'u1' }] },
      message: { keyPath: 'msgId', records: [message(1999, { fromUid: 'u2', toUid: GROUP_ID }), message(2000, { fromUid: 'u1', toUid: '111' })] },
    });
    api.checkpoints = { messages: T0 + 1990 * 1000 };
    await light();
    const convs = api.items('conversations');
    expect(convs.find((c) => c.threadId === GROUP_ID)?.type).toBe('group');
    expect(convs.find((c) => c.threadId === 'u1')?.type).toBe('user');
    expect(api.items('groups')).toEqual([]);
  });

  it('walks a send-time index when the store has one', async () => {
    // Primary keys in reverse time order: only the index gives the newest first.
    await new Promise<void>((resolve, reject) => {
      const req = idb.open('zdb_111', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const os = db.createObjectStore('message', { keyPath: 'msgId' });
        os.createIndex('sendDttm', 'sendDttm');
        for (let i = 1; i <= 500; i++) os.put(message(i, { msgId: `m${String(10_000 - i).padStart(6, '0')}`, sendDttm: T0 + i * 1000 }));
        db.createObjectStore('conversation', { keyPath: 'userId' });
        db.createObjectStore('group', { keyPath: 'userId' });
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    api.checkpoints = { messages: T0 + 495 * 1000 };
    const summary = await runLightSync({ api, idb, now: () => new Date(T0 + 99_999_999) });
    expect(api.items('messages')).toHaveLength(6);
    expect(summary.accounts[0].streams.messages!.read).toBe(6 + LIGHT_OLD_RUN_STOP);
  });

  it('light-sync inserts do not trigger a backdated full pass in the next full run', async () => {
    const messages = Array.from({ length: 120 }, (_, i) => message(i + 1));
    await seedAccount(idb, '111', { messages });
    // Last full run counted 100; light syncs since inserted 110..120's predecessors 101..109 (9),
    // the checkpoint moved to message 110: 11 records at or past it.
    api.checkpoints = { messages: T0 + 110 * 1000 };
    api.sourceCounts = { messages: 100 };
    let summary = await run();
    expect(summary.accounts[0].streams.messages?.backdated).toBe(9);

    api.batches = [];
    summary = await run({ priorAccepted: (_uid, stream) => (stream === 'messages' ? 9 : 0) });
    expect(summary.accounts[0].streams.messages?.backdated).toBeUndefined();
    expect(api.items('messages')).toHaveLength(11);
  });
});

describe('HttpApiClient', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it('retries network errors and 5xx with backoff, then succeeds', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('{}', { status: 502 }))
      .mockResolvedValueOnce(ok({ name: 'ext', scopes: ['ingest'] }));
    const sleeps: number[] = [];
    const c = new HttpApiClient('http://localhost:3000/', 'tok', {
      fetch: fetchMock,
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(await c.me()).toEqual({ name: 'ext', scopes: ['ingest'] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([1000, 2000]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/me');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('does not retry 401 and throws UnauthorizedError', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized' }), { status: 401 }),
    );
    const c = new HttpApiClient('http://x', 't', { fetch: fetchMock, sleep: async () => undefined });
    await expect(c.getActiveMapping()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 attempts', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('down'));
    const c = new HttpApiClient('http://x', 't', { fetch: fetchMock, sleep: async () => undefined });
    await expect(c.ingest('messages', '1', [{}])).rejects.toMatchObject({ status: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
