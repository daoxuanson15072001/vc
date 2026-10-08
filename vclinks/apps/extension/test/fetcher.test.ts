import { describe, expect, it, vi } from 'vitest';
import type { FetchRequest } from '@vclinks/shared';
import type { BackfillProgress } from '../src/backfill';
import { fetchOnce, toFetchResult, type FetcherDeps } from '../src/fetcher';

const req = (id: string, uid = '111'): FetchRequest => ({
  id,
  uid,
  threadId: id.split(':')[1],
  status: 'pending',
  requestedAt: '2026-09-28T00:00:00.000Z',
});

const progress = (p: Partial<BackfillProgress>): BackfillProgress => ({
  state: 'done', reason: 'reached_start', threadId: '222', scrolls: 3, seen: 10, posted: 10, matched: 10,
  unmatched: 0, pendingTotal: null, pendingSeen: 0, startedAt: 0, finishedAt: 1, ...p,
});

function deps(over: Partial<FetcherDeps> = {}) {
  const api = {
    pending: vi.fn(async (uid: string, _presence?: unknown, _waitSec?: number) => (uid === '111' ? [req('111:222'), req('111:333')] : [])),
    claim: vi.fn(async (id: string) => ({ ...req(id), status: 'running' as const })),
    result: vi.fn(async () => ({})),
  };
  const d: FetcherDeps = {
    api,
    accounts: async () => [{ uid: '111', loggedIn: true }],
    open: vi.fn(async () => ({ ok: true as const })),
    backfill: vi.fn(async () => progress({})),
    now: () => 100_000,
    ...over,
  };
  return { d, api };
}

describe('fetchOnce', () => {
  it('long-polls only the account logged in here, after a plain heartbeat for the others', async () => {
    const { d, api } = deps({
      waitSec: 20,
      accounts: async () => [
        { uid: '111', loggedIn: true },
        { uid: '999', loggedIn: false },
      ],
    });
    await fetchOnce(d);
    expect(api.pending.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ['999', undefined],
      ['111', 20],
    ]);
  });

  it('does not long-poll while waiting (user active) or when the account is unknown', async () => {
    const a = deps({ waitSec: 20, lastUserActivity: () => 97_000 });
    await fetchOnce(a.d);
    expect(a.api.pending.mock.calls[0]).toHaveLength(2);
    const b = deps({ waitSec: 20, accounts: async () => [{ uid: '111', loggedIn: null }] });
    await fetchOnce(b.d);
    expect(b.api.pending.mock.calls[0]).toHaveLength(2);
  });

  it('asks the automatic sync to yield, then runs the request under the UI lock', async () => {
    const events: string[] = [];
    const { d } = deps({
      preempt: (on) => events.push(`preempt:${on}`),
      withLock: async (fn) => {
        events.push('lock');
        await fn();
        events.push('unlock');
      },
      backfill: vi.fn(async () => {
        events.push('backfill');
        return progress({});
      }),
    });
    expect(await fetchOnce(d)).toBe(true);
    expect(events).toEqual(['preempt:true', 'lock', 'backfill', 'unlock', 'preempt:false']);
  });

  it('claims one request, opens the thread, backfills and reports done', async () => {
    const { d, api } = deps();
    expect(await fetchOnce(d)).toBe(true);
    expect(api.claim).toHaveBeenCalledTimes(1);
    expect(d.open).toHaveBeenCalledWith('222', expect.any(Object));
    expect(api.result).toHaveBeenCalledWith('111:222', { ok: true, reason: 'reached_start', posted: 10 });
  });

  it('reports a failure when the conversation cannot be opened, without backfilling', async () => {
    const { d, api } = deps({ open: vi.fn(async () => ({ ok: false as const, error: 'không tìm thấy hội thoại' })) });
    await fetchOnce(d);
    expect(d.backfill).not.toHaveBeenCalled();
    expect(api.result).toHaveBeenCalledWith('111:222', expect.objectContaining({ ok: false }));
  });

  it('skips a request taken elsewhere and moves to the next one', async () => {
    const { d, api } = deps();
    api.claim.mockRejectedValueOnce(new Error('409'));
    await fetchOnce(d);
    expect(d.open).toHaveBeenCalledWith('333', expect.any(Object));
  });

  it('still reports presence while waiting, but claims nothing', async () => {
    const a = deps({ lastUserActivity: () => 97_000 }); // 3 s ago: inside USER_IDLE_MS
    expect(await fetchOnce(a.d)).toBe(false);
    expect(a.api.pending).toHaveBeenCalledWith('111', { loggedIn: true, waiting: 'user_active' });
    const b = deps({ canRun: () => false });
    expect(await fetchOnce(b.d)).toBe(false);
    expect(b.api.pending).toHaveBeenCalledWith('111', { loggedIn: true, waiting: 'busy' });
    const c = deps({ tabHidden: () => true });
    expect(await fetchOnce(c.d)).toBe(false);
    expect(c.api.pending).toHaveBeenCalledWith('111', { loggedIn: true, waiting: 'tab_hidden' });
    expect(a.api.claim).not.toHaveBeenCalled();
    expect(b.api.claim).not.toHaveBeenCalled();
    expect(c.api.claim).not.toHaveBeenCalled();
  });

  it('passes the request name and recent cliMsgIds to open, and the threadId to backfill', async () => {
    const a = deps();
    a.api.pending.mockImplementation(async (uid: string) =>
      uid === '111' ? [{ ...req('111:222'), name: 'Kho Kim Đồng', recentCliMsgIds: ['c1', 'c2'] }] : [],
    );
    expect(await fetchOnce(a.d)).toBe(true);
    expect(a.d.open).toHaveBeenCalledWith('222', { name: 'Kho Kim Đồng', recentCliMsgIds: ['c1', 'c2'] });
    // Account + thread: the backfill may create messages IndexedDB no longer has.
    expect(a.d.backfill).toHaveBeenCalledWith('222', '111', { deep: true });
  });

  it('serves only the account logged in on this tab', async () => {
    const { d, api } = deps({
      accounts: async () => [
        { uid: '111', loggedIn: false },
        { uid: '999', loggedIn: true },
      ],
    });
    expect(await fetchOnce(d)).toBe(false);
    expect(api.pending).toHaveBeenCalledWith('111', { loggedIn: false, waiting: null });
    expect(api.claim).not.toHaveBeenCalled();
  });
});

describe('toFetchResult', () => {
  it('turns a rate-limited backfill into a readable failure', () => {
    const r = toFetchResult(progress({ state: 'aborted', reason: 'rate_limited', posted: 0 }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/giới hạn/);
  });
});
