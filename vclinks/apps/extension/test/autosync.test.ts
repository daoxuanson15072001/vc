import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoSyncPlanItem, AutoSyncResult } from '@vclinks/shared';
import { FAST_PLAN_TTL_MS, PLAN_TTL_MS, autoSyncStep, newAutoSyncState, type AutoSyncDeps, type OpenOutcome, type SidebarItem } from '../src/autosync';
import type { BackfillProgress } from '../src/backfill';

const item = (threadId: string, deepDone = false): AutoSyncPlanItem => ({
  threadId,
  pending: 5,
  lastMsgAt: null,
  deepDone,
  recentCliMsgIds: [],
});

const progress = (over: Partial<BackfillProgress> = {}): BackfillProgress => ({
  state: 'done',
  reason: 'max_scrolls',
  threadId: null,
  scrolls: 0,
  seen: 3,
  posted: 3,
  matched: 3,
  unmatched: 0,
  pendingTotal: null,
  pendingSeen: 0,
  startedAt: 0,
  finishedAt: 0,
  ...over,
});

function harness(opts: { plan: AutoSyncPlanItem[]; sidebar?: SidebarItem[]; open?: (t: string) => OpenOutcome }) {
  const results: AutoSyncResult[] = [];
  const opened: string[] = [];
  const captures: { threadId: string; mode: string; deepDone: boolean }[] = [];
  let activity = 0;
  let planCalls = 0;
  const d: AutoSyncDeps & { capture: ReturnType<typeof vi.fn> } = {
    api: {
      plan: async () => {
        planCalls++;
        return opts.plan;
      },
      result: async (r) => {
        results.push(r);
        return { ok: true };
      },
    },
    loggedInUid: async () => '111',
    firstPage: () => opts.sidebar ?? [],
    blocked: () => null,
    open: async (it) => {
      opened.push(it.threadId);
      return opts.open?.(it.threadId) ?? { ok: true };
    },
    capture: vi.fn(async (_uid: string, it: AutoSyncPlanItem, mode: string) => {
      captures.push({ threadId: it.threadId, mode, deepDone: it.deepDone });
      return progress(mode === 'deep' ? { reason: 'web_history_start', webHistoryFrom: 123 } : {});
    }),
    lastUserActivity: () => activity,
  };
  return {
    d,
    results,
    opened,
    captures,
    touch: (t: number) => (activity = t),
    planCalls: () => planCalls,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('autoSyncStep', () => {
  it('first captures the screen of each first-page conversation, top to bottom, then goes deep in plan order', async () => {
    const h = harness({
      plan: [item('g1'), item('u2'), item('u3')],
      sidebar: [
        { threadId: 'u2', unread: false },
        { threadId: 'g9', unread: false }, // nothing missing: not in the plan
        { threadId: 'g1', unread: false },
      ],
    });
    const state = newAutoSyncState();
    const steps = [];
    for (let i = 0; i < 6; i++) steps.push(await autoSyncStep(state, h.d));
    expect(h.captures.map((c) => `${c.mode}:${c.threadId}`)).toEqual([
      'screen:u2',
      'screen:g1',
      'deep:g1',
      'deep:u2',
      'deep:u3',
    ]);
    expect(steps[5]).toEqual({ worked: false, why: 'nothing_to_do' });
    expect(h.results[2]).toMatchObject({ uid: '111', threadId: 'g1', mode: 'deep', outcome: 'done', reason: 'web_history_start', webHistoryFrom: 123 });
  });

  it('never opens a first-page conversation with unread messages', async () => {
    const h = harness({ plan: [item('u2')], sidebar: [{ threadId: 'u2', unread: true }] });
    const state = newAutoSyncState();
    const r = await autoSyncStep(state, h.d);
    expect(r).toMatchObject({ worked: true, outcome: 'skipped_unread' });
    expect(h.opened).toEqual([]);
    expect(h.results[0]).toMatchObject({ threadId: 'u2', mode: 'screen', outcome: 'skipped_unread' });
  });

  it('a fast nick (opens unread chats) refreshes its plan every few seconds, a normal one every minute', async () => {
    const run = async (fast: boolean) => {
      const h = harness({ plan: [] });
      if (fast) h.d.fast = () => true;
      const state = newAutoSyncState();
      await autoSyncStep(state, h.d);
      vi.setSystemTime(Date.now() + FAST_PLAN_TTL_MS + 1000);
      await autoSyncStep(state, h.d);
      return h.planCalls();
    };
    expect(PLAN_TTL_MS).toBeGreaterThan(FAST_PLAN_TTL_MS + 1000);
    expect(await run(false)).toBe(1);
    expect(await run(true)).toBe(2);
  });

  it('fast nick: newest new messages first, one screen capture each, never twice for the same message', async () => {
    const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    const plan = [
      { ...item('old'), newestPendingAt: at(3 * 24 * 60) },
      { ...item('g1'), newestPendingAt: at(5) },
      { ...item('u2'), newestPendingAt: at(1) },
    ];
    const h = harness({ plan, sidebar: [{ threadId: 'old', unread: false }] });
    h.d.fast = () => true;
    const state = newAutoSyncState();
    for (let i = 0; i < 3; i++) await autoSyncStep(state, h.d);
    // Fresh lane (u2 then g1, newest first) before the first sidebar page; an old pending message is history.
    expect(h.captures.map((c) => `${c.mode}:${c.threadId}`)).toEqual(['screen:u2', 'screen:g1', 'screen:old']);
    // A newer message in u2 brings it back once.
    plan[2] = { ...plan[2]!, newestPendingAt: new Date().toISOString() };
    state.plan = null;
    await autoSyncStep(state, h.d);
    expect(h.captures.at(-1)).toMatchObject({ threadId: 'u2', mode: 'screen' });
  });

  it('a chat with nothing to read is reported as an error, not retried in a loop', async () => {
    const h = harness({ plan: [item('g7')], sidebar: [{ threadId: 'g7', unread: false }] });
    h.d.capture.mockImplementation(async () => progress({ state: 'aborted', reason: 'no_conversation' }));
    const state = newAutoSyncState();
    const steps = [];
    for (let i = 0; i < 4; i++) steps.push(await autoSyncStep(state, h.d));
    // One screen and one deep try, each reported as an error; then nothing left (before: the same chat every 3 s).
    expect(h.opened).toEqual(['g7', 'g7']);
    expect(h.results.map((r) => `${r.mode}:${r.outcome}`)).toEqual(['screen:error', 'deep:error']);
    expect(steps[3]).toEqual({ worked: false, why: 'nothing_to_do' });
  });

  it('reports unread and missing conversations found while opening (deep pass)', async () => {
    const h = harness({
      plan: [item('u2'), item('u3')],
      open: (t) =>
        t === 'u2' ? { ok: false, code: 'unread', error: 'chưa đọc' } : { ok: false, code: 'not_found', error: 'không thấy' },
    });
    const state = newAutoSyncState();
    await autoSyncStep(state, h.d);
    await autoSyncStep(state, h.d);
    expect(h.results.map((r) => r.outcome)).toEqual(['skipped_unread', 'not_found']);
    expect(h.captures).toEqual([]);
  });

  it('stops the capture when the user touches the tab, and retries that conversation later', async () => {
    const h = harness({ plan: [item('u2')] });
    h.d.capture.mockImplementationOnce(
      (_u: string, _i: AutoSyncPlanItem, _m: string, signal: AbortSignal) =>
        new Promise<BackfillProgress>((resolve) => {
          signal.addEventListener('abort', () => resolve(progress({ state: 'stopped', reason: 'stopped' })));
        }),
    );
    const state = newAutoSyncState();
    const p = autoSyncStep(state, h.d);
    await vi.advanceTimersByTimeAsync(500);
    h.touch(Date.now() + 1);
    await vi.advanceTimersByTimeAsync(500);
    expect(await p).toMatchObject({ outcome: 'aborted' });
    // Next step: the same conversation again.
    expect(await autoSyncStep(state, h.d)).toMatchObject({ threadId: 'u2', mode: 'deep', outcome: 'done' });
  });

  it('does nothing while blocked or when no account is logged in on the tab', async () => {
    const h = harness({ plan: [item('u2')] });
    h.d.blocked = () => 'user_active';
    expect(await autoSyncStep(newAutoSyncState(), h.d)).toEqual({ worked: false, why: 'user_active' });
    h.d.blocked = () => null;
    h.d.loggedInUid = async () => null;
    expect(await autoSyncStep(newAutoSyncState(), h.d)).toEqual({ worked: false, why: 'no_account' });
    expect(h.planCalls()).toBe(0);
  });

  it('passes deepDone through so later passes stop at the pending ids', async () => {
    const h = harness({ plan: [item('u2', true)] });
    await autoSyncStep(newAutoSyncState(), h.d);
    expect(h.captures[0]).toEqual({ threadId: 'u2', mode: 'deep', deepDone: true });
  });

  it('gives way to a Dashboard request: the current run stops and the thread is retried later', async () => {
    const h = harness({ plan: [item('u2')] });
    let dashboard = false;
    h.d.preempted = () => dashboard;
    h.d.capture.mockImplementationOnce(
      (_u: string, _i: AutoSyncPlanItem, _m: string, signal: AbortSignal) =>
        new Promise<BackfillProgress>((resolve) => {
          signal.addEventListener('abort', () => resolve(progress({ state: 'stopped', reason: 'stopped' })));
        }),
    );
    const state = newAutoSyncState();
    const p = autoSyncStep(state, h.d);
    await vi.advanceTimersByTimeAsync(300);
    dashboard = true;
    await vi.advanceTimersByTimeAsync(300);
    expect(await p).toMatchObject({ threadId: 'u2', outcome: 'aborted' });
    expect(state.deepTried.has('u2:5')).toBe(false);
  });

  it('runs a deep-tried conversation again in the same session when new messages without content arrive', async () => {
    const plan = [item('u2')];
    const h = harness({ plan });
    const state = newAutoSyncState();
    await autoSyncStep(state, h.d);
    state.plan = null;
    expect(await autoSyncStep(state, h.d)).toEqual({ worked: false, why: 'nothing_to_do' });
    plan[0] = { ...plan[0]!, pending: 7 };
    state.plan = null;
    expect(await autoSyncStep(state, h.d)).toMatchObject({ threadId: 'u2', mode: 'deep' });
  });
});
