import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AcceptedTally,
  POLL_HIDDEN_MS,
  POLL_MAX_BACKOFF_MS,
  POLL_MIN_GAP_MS,
  POLL_TAIL_SIZE,
  POLL_VISIBLE_MS,
  TailTracker,
  UNMATCHED_MAX_REVIVALS,
  UnmatchedRetryQueue,
  createPoller,
  lightWindowStart,
  nextPollDelay,
  oldRunStop,
  tailSignature,
  unmatchedInAll,
} from '../src/quick-sync';
import { getByKeys, iterateStore, openExistingDb, readPrimaryKeys, readTail, SensitiveStoreError } from '../src/reader';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------- window / stop rule

describe('lightWindowStart', () => {
  it('reaches back to the older of checkpoint and recent window', () => {
    expect(lightWindowStart(1_000, 5_000)).toBe(1_000);
    expect(lightWindowStart(9_000, 5_000)).toBe(5_000);
    expect(lightWindowStart(null, 5_000)).toBe(5_000);
  });
});

describe('oldRunStop', () => {
  it('stops only after N consecutive old records; a new or unreadable one resets the run', () => {
    const stop = oldRunStop(100, (r) => (r as { t?: unknown }).t, 3);
    const seq = [{ t: 50 }, { t: 60 }, { t: 150 }, { t: 40 }, {}, { t: 30 }, { t: 20 }, { t: 10 }];
    expect(seq.map((r) => stop(r))).toEqual([false, false, false, false, false, false, false, true]);
  });

  it('reads string send times', () => {
    const stop = oldRunStop(100, (r) => r, 1);
    expect(stop('99')).toBe(true);
  });
});

// ---------------------------------------------------------------- tail signature

describe('tailSignature / TailTracker', () => {
  const f = { id: 'msgId', sentAt: 'sendDttm', status: 'status', msgType: 'msgType' };
  const rec = (id: string, extra: Record<string, unknown> = {}) => ({ msgId: id, sendDttm: '1000', status: 1, msgType: 'webchat', message: 'secret text', ...extra });

  it('changes on a new record, a status change or a recall, never contains content', () => {
    const base = tailSignature([rec('m2'), rec('m1')], f);
    expect(base).not.toContain('secret');
    expect(tailSignature([rec('m3'), rec('m2')], f)).not.toBe(base);
    expect(tailSignature([rec('m2', { status: 3 }), rec('m1')], f)).not.toBe(base);
    expect(tailSignature([rec('m2'), rec('m1', { msgType: '20' })], f)).not.toBe(base);
    expect(tailSignature([rec('m2'), rec('m1', { message: 'other' })], f)).toBe(base);
  });

  it('reports a change on first look and after a failed sync, not after commit', () => {
    const t = new TailTracker();
    expect(t.changed('111', 'a')).toBe(true);
    // sync failed: not committed, still changed
    expect(t.changed('111', 'a')).toBe(true);
    t.commit('111', 'a');
    expect(t.changed('111', 'a')).toBe(false);
    expect(t.changed('222', 'a')).toBe(true);
    expect(t.changed('111', 'b')).toBe(true);
  });
});

// ---------------------------------------------------------------- reader tail helpers

async function seedMessages(idb: IDBFactory, n: number) {
  await new Promise<void>((resolve, reject) => {
    const req = idb.open('zdb_111', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const os = db.createObjectStore('message', { keyPath: 'msgId' });
      for (let i = 1; i <= n; i++) os.put({ msgId: `m${String(i).padStart(7, '0')}`, sendDttm: String(1e12 + i), status: 1 });
      const conv = db.createObjectStore('conversation', { keyPath: 'userId' });
      conv.put({ userId: 'u1' });
      conv.put({ userId: 'g9' });
      db.createObjectStore('e2ee_session', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

describe('reader tail helpers', () => {
  it('readTail returns the newest records first, capped', async () => {
    const idb = new IDBFactory();
    await seedMessages(idb, 100);
    const db = (await openExistingDb(idb, 'zdb_111'))!;
    const tail = (await readTail(db, 'message', { limit: POLL_TAIL_SIZE })) as { msgId: string }[];
    expect(tail).toHaveLength(POLL_TAIL_SIZE);
    expect(tail[0].msgId).toBe('m0000100');
    expect(tail[19].msgId).toBe('m0000081');
    const stopped = await readTail(db, 'message', { limit: 1000, stop: (r) => (r as { msgId: string }).msgId === 'm0000095' });
    expect(stopped).toHaveLength(6);
    db.close();
  });

  it('getByKeys and readPrimaryKeys read only what is asked, and refuse sensitive stores', async () => {
    const idb = new IDBFactory();
    await seedMessages(idb, 3);
    const db = (await openExistingDb(idb, 'zdb_111'))!;
    expect(await getByKeys(db, 'conversation', 'userId', ['u1', 'nope'])).toEqual([{ userId: 'u1' }]);
    expect(await getByKeys(db, 'conversation', 'otherField', ['u1'])).toBeNull();
    expect((await readPrimaryKeys(db, 'conversation', 'userId'))?.sort()).toEqual(['g9', 'u1']);
    expect(await readPrimaryKeys(db, 'conversation', 'groupId')).toBeNull();
    await expect(readTail(db, 'e2ee_session', { limit: 1 })).rejects.toBeInstanceOf(SensitiveStoreError);
    await expect(getByKeys(db, 'e2ee_session', 'id', [1])).rejects.toBeInstanceOf(SensitiveStoreError);
    db.close();
  });

  it('benchmark (fake-indexeddb, indicative only): tail read vs full walk of 20k records', async () => {
    const idb = new IDBFactory();
    await seedMessages(idb, 20_000);
    const db = (await openExistingDb(idb, 'zdb_111'))!;
    let t = performance.now();
    const tail = await readTail(db, 'message', { limit: POLL_TAIL_SIZE });
    const tailMs = performance.now() - t;
    t = performance.now();
    let n = 0;
    for await (const chunk of iterateStore(db, 'message', 500)) n += chunk.length;
    const fullMs = performance.now() - t;
    db.close();
    expect(tail).toHaveLength(POLL_TAIL_SIZE);
    expect(n).toBe(20_000);
    console.info(`[bench] tail ${POLL_TAIL_SIZE}: ${tailMs.toFixed(1)} ms · full walk 20k: ${fullMs.toFixed(1)} ms`);
  }, 60_000);
});

// ---------------------------------------------------------------- poll loop

describe('nextPollDelay', () => {
  it('polls every 4 s visible, slower hidden, doubles per failure up to the cap', () => {
    expect(nextPollDelay(false, 0)).toBe(POLL_VISIBLE_MS);
    expect(nextPollDelay(true, 0)).toBe(POLL_HIDDEN_MS);
    expect(nextPollDelay(false, 1)).toBe(POLL_VISIBLE_MS * 2);
    expect(nextPollDelay(false, 3)).toBe(POLL_VISIBLE_MS * 8);
    expect(nextPollDelay(false, 50)).toBe(POLL_MAX_BACKOFF_MS);
    expect(nextPollDelay(true, 2)).toBe(POLL_MAX_BACKOFF_MS);
  });
});

describe('createPoller', () => {
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it('ticks right away, then every POLL_VISIBLE_MS; never two ticks at once', async () => {
    vi.useFakeTimers();
    let active = 0;
    let maxActive = 0;
    let ticks = 0;
    const pending: ReturnType<typeof deferred>[] = [];
    const p = createPoller({
      tick: async () => {
        ticks++;
        active++;
        maxActive = Math.max(maxActive, active);
        const d = deferred();
        pending.push(d);
        await d.promise;
        active--;
      },
      hidden: () => false,
    });
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(ticks).toBe(1);
    // Nudges during a running tick do not start a second one.
    p.nudge(0);
    p.nudge(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ticks).toBe(1);
    pending.shift()!.resolve();
    // Nudged during the tick: runs again after the minimum gap, not 4 s later.
    await vi.advanceTimersByTimeAsync(0);
    expect(ticks).toBe(2);
    pending.shift()!.resolve();
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS - 1);
    expect(ticks).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(ticks).toBe(3);
    expect(maxActive).toBe(1);
    p.stop();
  });

  it('a nudge brings the next tick forward, respecting the minimum gap', async () => {
    vi.useFakeTimers();
    let ticks = 0;
    const p = createPoller({ tick: async () => void ticks++, hidden: () => false });
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(ticks).toBe(1);
    p.nudge(0);
    await vi.advanceTimersByTimeAsync(POLL_MIN_GAP_MS - 1);
    expect(ticks).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(ticks).toBe(2);
    // A later nudge does not push an earlier timer back.
    p.nudge(1_500);
    p.nudge(3_000);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(ticks).toBe(3);
    p.stop();
  });

  it('backs off on failures and recovers on success; slows down while hidden', async () => {
    vi.useFakeTimers();
    let fail = true;
    let hidden = false;
    const at: number[] = [];
    const p = createPoller({
      tick: async () => {
        at.push(Date.now());
        if (fail) throw new Error('down');
      },
      hidden: () => hidden,
    });
    const t0 = Date.now();
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS * 2); // 2nd tick after 8 s
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS * 4); // 3rd after 16 s
    expect(at.map((t) => t - t0)).toEqual([0, 8_000, 24_000]);
    expect(p.failures).toBe(3);
    fail = false;
    await vi.advanceTimersByTimeAsync(32_000); // 4th, succeeds
    expect(p.failures).toBe(0);
    hidden = true;
    await vi.advanceTimersByTimeAsync(POLL_VISIBLE_MS);
    expect(at).toHaveLength(5); // still the visible delay scheduled before hiding
    await vi.advanceTimersByTimeAsync(POLL_HIDDEN_MS - 1);
    expect(at).toHaveLength(5);
    await vi.advanceTimersByTimeAsync(1);
    expect(at).toHaveLength(6);
    p.stop();
  });

  it('stops for good when the extension context is gone', async () => {
    vi.useFakeTimers();
    let alive = true;
    let ticks = 0;
    const p = createPoller({ tick: async () => void ticks++, hidden: () => false, alive: () => alive });
    p.start();
    await vi.advanceTimersByTimeAsync(0);
    alive = false;
    await vi.advanceTimersByTimeAsync(60_000);
    p.nudge(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ticks).toBe(1);
  });
});

// ---------------------------------------------------------------- unmatched retries

describe('UnmatchedRetryQueue', () => {
  const item = (id: string) => ({ id, item: { cliMsgId: id, text: 'x' } });

  it('retries after 3 s, 8 s, 20 s, then parks; matched items leave the queue', () => {
    const q = new UnmatchedRetryQueue<{ cliMsgId: string; text: string }>();
    q.add([item('a'), item('b')], 0);
    expect(q.nextDueIn(0)).toBe(3_000);
    expect(q.due(2_999)).toEqual([]);
    expect(q.due(3_000).map((d) => d.id)).toEqual(['a', 'b']);
    // b matched now; a still unmatched.
    expect(q.settle(['a', 'b'], new Set(['a']), 3_000)).toEqual({ matched: ['b'], dropped: [] });
    expect(q.has('b')).toBe(false);
    expect(q.nextDueIn(3_000)).toBe(8_000);
    q.settle(['a'], new Set(['a']), 11_000);
    expect(q.nextDueIn(11_000)).toBe(20_000);
    q.settle(['a'], new Set(['a']), 31_000);
    // Parked: no longer due, but kept for a later light sync.
    expect(q.has('a')).toBe(true);
    expect(q.nextDueIn(31_000)).toBeNull();
    expect(q.due(1e9)).toEqual([]);
  });

  it('adding an id already queued keeps its schedule', () => {
    const q = new UnmatchedRetryQueue<{ cliMsgId: string; text: string }>();
    q.add([item('a')], 0);
    q.add([item('a')], 2_000);
    expect(q.nextDueIn(0)).toBe(3_000);
    expect(q.size).toBe(1);
  });

  it('expedite makes everything due now and revives parked items a limited number of times', () => {
    const q = new UnmatchedRetryQueue<{ cliMsgId: string; text: string }>([10, 20]);
    q.add([item('a'), item('w')], 0);
    q.settle(['a'], new Set(['a']), 10);
    q.settle(['a'], new Set(['a']), 30); // parked
    expect(q.due(1e9).map((d) => d.id)).toEqual(['w']);
    // Each revival is one more attempt; the last one that fails gives the item up.
    for (let i = 1; i < UNMATCHED_MAX_REVIVALS; i++) {
      q.expedite(100);
      expect(q.due(100).map((d) => d.id)).toContain('a');
      expect(q.settle(['a'], new Set(['a']), 100).dropped).toEqual([]);
    }
    q.expedite(200);
    expect(q.due(200).map((d) => d.id)).toContain('a');
    expect(q.settle(['a'], new Set(['a']), 200)).toEqual({ matched: [], dropped: ['a'] });
    expect(q.has('a')).toBe(false);
    // A waiting item is pulled forward, not delayed.
    expect(q.due(200).map((d) => d.id)).toEqual(['w']);
  });

  it('a revived item that matches leaves as matched', () => {
    const q = new UnmatchedRetryQueue<{ cliMsgId: string; text: string }>([10]);
    q.add([item('a')], 0);
    q.settle(['a'], new Set(['a']), 10); // parked
    q.expedite(50);
    expect(q.settle(['a'], new Set(), 50)).toEqual({ matched: ['a'], dropped: [] });
  });

  it('keeps at most maxItems, evicting the oldest', () => {
    const q = new UnmatchedRetryQueue<{ cliMsgId: string; text: string }>(undefined, undefined, 2);
    q.add([item('a'), item('b'), item('c')], 0);
    expect(q.size).toBe(2);
    expect(q.has('a')).toBe(false);
  });
});

describe('unmatchedInAll', () => {
  it('keeps only ids no account matched', () => {
    expect(unmatchedInAll([['a', 'b', 'c'], ['b', 'c'], ['c', 'b', 'z']])).toEqual(new Set(['b', 'c']));
    expect(unmatchedInAll([['a']])).toEqual(new Set(['a']));
    expect(unmatchedInAll([])).toEqual(new Set());
  });
});

describe('AcceptedTally', () => {
  it('sums light-sync inserts per account and stream, and resets on take', () => {
    const t = new AcceptedTally();
    t.add('111', 'messages', 3);
    t.add('111', 'messages', 2);
    t.add('111', 'conversations', 0);
    t.add('222', 'messages', 1);
    const got = t.take();
    expect(got('111', 'messages')).toBe(5);
    expect(got('222', 'messages')).toBe(1);
    expect(got('111', 'conversations')).toBe(0);
    expect(t.take()('111', 'messages')).toBe(0);
  });
});
