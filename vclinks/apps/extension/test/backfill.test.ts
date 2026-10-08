// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKFILL_RATE_KEY,
  runBackfill,
  takeHourlySlot,
  type BackfillDeps,
  type BackfillProgress,
  type KeyValueStore,
} from '../src/backfill';
import type { MessageContentPayloadItem } from '../src/dom-reader';

const bubble = (cli: string) =>
  `<div id="bb_msg_id_${cli}" class="chat-message"><div data-id="div_ReceivedMsg_Text">Tin ${cli}</div></div>`;

const BANNER =
  '<div class="transform-gpu"><div>Sử dụng Zalo PC để tìm tin nhắn trước ngày 15/09/2026.<a>Tải Zalo PC</a></div><div>T3 15/09/2026</div></div>';
/** 15/09/2026 00:00 in Vietnam (UTC+7). */
const SEP15_VN = Date.UTC(2026, 8, 15) - 7 * 3600_000;

function memStore(init: Record<string, unknown> = {}): KeyValueStore & { data: Record<string, unknown> } {
  const data = { ...init };
  return {
    data,
    get: async (k) => data[k],
    set: async (k, v) => {
      data[k] = v;
    },
  };
}

/**
 * Chat frame with a sidebar (active item u1) and a mocked scroller: setting
 * scrollTop to the top loads the next older page after `loadDelay` ms, like Zalo.
 */
function setup(opts: { initial: string[]; pages: string[][]; loadDelay?: number; bannerAfterPage?: number }) {
  document.body.innerHTML = `
    <div data-id="div_TabMsg_ThrdChList">
      <div data-id="div_TabMsg_ThrdChItem" anim-data-id="u1" class="msg-item selected">Anh Minh</div>
      <div data-id="div_TabMsg_ThrdChItem" anim-data-id="u2" class="msg-item">Chị Lan</div>
    </div>
    <div id="scroller"><div id="list">${opts.initial.map(bubble).join('')}</div></div>`;
  const scroller = document.getElementById('scroller')!;
  const list = document.getElementById('list')!;
  const pages = [...opts.pages];
  let loaded = 0;
  const scrollTimes: number[] = [];
  let top = 500;
  Object.defineProperty(scroller, 'scrollHeight', { get: () => 1000 + list.children.length * 50, configurable: true });
  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, v);
      if (top > 0) return; // restoring to the bottom, not a load
      scrollTimes.push(Date.now());
      const page = pages.shift();
      if (page) {
        setTimeout(() => {
          list.insertAdjacentHTML('afterbegin', page.map(bubble).join(''));
          // Zalo Web's history start, above the oldest bubble (real markup, 29/09/2026).
          if (++loaded === opts.bannerAfterPage) list.insertAdjacentHTML('afterbegin', BANNER);
        }, opts.loadDelay ?? 300);
      }
    },
  });
  return { scroller, list, scrollTimes, getTop: () => top };
}

function deps(over: Partial<BackfillDeps> = {}) {
  const batches: MessageContentPayloadItem[][] = [];
  const progress: BackfillProgress[] = [];
  const d: BackfillDeps = {
    root: document,
    findScroller: (root) => (root as Document).getElementById('scroller'),
    post: async (items) => {
      batches.push(items);
      return { matched: items.length, unmatched: 0 };
    },
    onProgress: (p) => progress.push(p),
    rateStore: memStore(),
    ...over,
  };
  return { d, batches, progress };
}

/** Runs the backfill while advancing fake time until it resolves. */
async function drive(d: BackfillDeps): Promise<BackfillProgress> {
  let result: BackfillProgress | undefined;
  const p = runBackfill(d).then((r) => (result = r));
  for (let i = 0; i < 2000 && !result; i++) await vi.advanceTimersByTimeAsync(100);
  await p;
  return result!;
}

const ids = (batches: MessageContentPayloadItem[][]) => batches.flat().map((i) => i.cliMsgId);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('runBackfill', () => {
  it('scrolls up until nothing new loads, posting each new bubble once', async () => {
    const env = setup({ initial: ['10', '11'], pages: [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3']] });
    const { d, batches } = deps();
    const r = await drive(d);

    expect(r.state).toBe('done');
    expect(r.reason).toBe('reached_start');
    expect(r.threadId).toBe('u1');
    expect(r.scrolls).toBe(6); // 3 pages + 3 idle scrolls
    expect(new Set(ids(batches))).toEqual(new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']));
    expect(ids(batches)).toHaveLength(11); // no duplicates
    expect(r.posted).toBe(11);
    // Rate limit: at least one second between scrolls.
    for (let i = 1; i < env.scrollTimes.length; i++) {
      expect(env.scrollTimes[i] - env.scrollTimes[i - 1]).toBeGreaterThanOrEqual(1000);
    }
    // Restored to the newest message.
    expect(env.getTop()).toBeGreaterThan(0);
  });

  it('stops as soon as every pending cliMsgId has been seen', async () => {
    setup({ initial: ['10'], pages: [['7', '8', '9'], ['4', '5', '6']] });
    const { d } = deps({ pendingCliMsgIds: async (t) => (t === 'u1' ? ['8', '9'] : null) });
    const r = await drive(d);
    expect(r.reason).toBe('all_pending_seen');
    expect(r.scrolls).toBe(1);
    expect(r.pendingTotal).toBe(2);
    expect(r.pendingSeen).toBe(2);
  });

  it('in DOM-only mode keeps scrolling to the oldest message even when nothing is pending', async () => {
    setup({ initial: ['10'], pages: [['7', '8', '9'], ['4', '5', '6']] });
    const { d, batches } = deps({ pendingCliMsgIds: async () => [], domOnly: true });
    const r = await drive(d);
    expect(r.reason).toBe('reached_start');
    expect(new Set(ids(batches))).toEqual(new Set(['4', '5', '6', '7', '8', '9', '10']));
  });

  it('stops as thread_changed when the API reports bubbles of another conversation', async () => {
    setup({ initial: ['10'], pages: [['7', '8', '9'], ['4', '5', '6']] });
    const { d } = deps({ domOnly: true });
    d.post = async () => ({ matched: 0, unmatched: 0, threadMismatch: true });
    const r = await drive(d);
    expect(r.state).toBe('aborted');
    expect(r.reason).toBe('thread_changed');
  });

  it('stops immediately when nothing is pending for the thread', async () => {
    const env = setup({ initial: ['10'], pages: [['9']] });
    const { d } = deps({ pendingCliMsgIds: async () => [] });
    const r = await drive(d);
    expect(r.reason).toBe('all_pending_seen');
    expect(env.scrollTimes).toHaveLength(0);
  });

  it('falls back to "no new bubbles" when the pending list is unavailable', async () => {
    setup({ initial: ['10'], pages: [['9']] });
    const { d } = deps({ pendingCliMsgIds: async () => Promise.reject(new Error('down')) });
    const r = await drive(d);
    expect(r.reason).toBe('reached_start');
    expect(r.pendingTotal).toBeNull();
  });

  it('aborts when the Zalo tab goes hidden mid-run, keeping what was captured before', async () => {
    setup({ initial: ['10'], pages: [['7', '8', '9'], ['4', '5', '6'], ['1']] });
    const { d, batches } = deps();
    let result: BackfillProgress | undefined;
    const p = runBackfill(d).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(1200);
    // happy-dom defines visibilityState on the prototype; shadow it on the instance.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    try {
      for (let i = 0; i < 200 && !result; i++) await vi.advanceTimersByTimeAsync(100);
      await p;
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState;
    }
    expect(result!.state).toBe('aborted');
    expect(result!.reason).toBe('tab_hidden');
    expect(new Set(ids(batches))).toEqual(new Set(['7', '8', '9', '10']));
  });

  it('aborts when the user switches conversation, keeping what was captured before', async () => {
    const env = setup({ initial: ['10'], pages: [['7', '8', '9'], ['4', '5', '6'], ['1']] });
    const { d, batches } = deps();
    let result: BackfillProgress | undefined;
    const p = runBackfill(d).then((r) => (result = r));
    // First page: scroll at 0, loads at 300, settles at 1100, second scroll right after.
    // Switch the highlighted sidebar item while the second page is loading.
    await vi.advanceTimersByTimeAsync(1200);
    document.querySelector('[anim-data-id="u1"]')!.classList.remove('selected');
    document.querySelector('[anim-data-id="u2"]')!.classList.add('selected');
    for (let i = 0; i < 200 && !result; i++) await vi.advanceTimersByTimeAsync(100);
    await p;

    expect(result!.state).toBe('aborted');
    expect(result!.reason).toBe('thread_changed');
    expect(env.scrollTimes).toHaveLength(2);
    // Page 2 rendered after the switch is discarded; page 1 was posted.
    expect(new Set(ids(batches))).toEqual(new Set(['7', '8', '9', '10']));
    // Never scrolls the other conversation back.
    expect(env.getTop()).toBe(0);
  });

  it('stops when the user presses Stop', async () => {
    const env = setup({ initial: ['10'], pages: Array.from({ length: 50 }, (_, i) => [`p${i}`]) });
    const ctl = new AbortController();
    const { d } = deps({ signal: ctl.signal });
    let result: BackfillProgress | undefined;
    const p = runBackfill(d).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(3500);
    ctl.abort();
    for (let i = 0; i < 100 && !result; i++) await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(result!.state).toBe('stopped');
    expect(result!.reason).toBe('stopped');
    expect(env.scrollTimes.length).toBeLessThan(6);
  });

  it('caps the number of scrolls per run', async () => {
    setup({ initial: ['x'], pages: Array.from({ length: 50 }, (_, i) => [`p${i}`]) });
    const { d } = deps({ maxScrolls: 5 });
    const r = await drive(d);
    expect(r.reason).toBe('max_scrolls');
    expect(r.scrolls).toBe(5);
  });

  it('posts in batches of at most 500 items', async () => {
    setup({ initial: Array.from({ length: 1200 }, (_, i) => String(i + 1)), pages: [] });
    const { d, batches } = deps();
    const r = await drive(d);
    expect(batches.map((b) => b.length)).toEqual([500, 500, 200]);
    expect(r.posted).toBe(1200);
  });

  it('refuses to run with no open conversation', async () => {
    document.body.innerHTML = '<div>trống</div>';
    const { d, batches } = deps({ findScroller: () => null });
    const r = await drive(d);
    expect(r).toMatchObject({ state: 'aborted', reason: 'no_conversation', scrolls: 0 });
    expect(batches).toHaveLength(0);
  });

  it('reads a short chat that fits on one screen (nothing scrolls) instead of giving up', async () => {
    setup({ initial: ['s1', 's2'], pages: [] });
    const { d, batches } = deps({ findScroller: () => null });
    const r = await drive(d);
    expect(r).toMatchObject({ state: 'done', reason: 'reached_start', scrolls: 0, posted: 2 });
    expect(ids(batches)).toEqual(['s1', 's2']);
  });

  it('refuses to run past 20 conversations per hour', async () => {
    const env = setup({ initial: ['10'], pages: [['9']] });
    const now = Date.now();
    const store = memStore({ [BACKFILL_RATE_KEY]: Array.from({ length: 20 }, (_, i) => now - i * 60_000) });
    const { d } = deps({ rateStore: store });
    const r = await drive(d);
    expect(r).toMatchObject({ state: 'aborted', reason: 'rate_limited' });
    expect(env.scrollTimes).toHaveLength(0);
  });
});

describe('takeHourlySlot', () => {
  it('prunes runs older than an hour and records the new one', async () => {
    const now = 10 * 3_600_000;
    const store = memStore({ [BACKFILL_RATE_KEY]: [now - 3_700_000, now - 1000] });
    expect(await takeHourlySlot(store, now, 2)).toBe(true);
    expect(store.data[BACKFILL_RATE_KEY]).toEqual([now - 1000, now]);
    expect(await takeHourlySlot(store, now + 1, 2)).toBe(false);
  });

  it('stops as soon as Zalo Web shows its history-start banner, without idle scrolls', async () => {
    setup({ initial: ['10', '11'], pages: [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3']], bannerAfterPage: 2 });
    const { d, batches } = deps();
    const r = await drive(d);
    expect(r).toMatchObject({ state: 'done', reason: 'web_history_start', scrolls: 2, webHistoryFrom: SEP15_VN });
    expect(ids(batches).sort()).toEqual(['10', '11', '4', '5', '6', '7', '8', '9']);
  });

  it('ignores the banner words when someone typed them in a message', async () => {
    setup({ initial: ['10'], pages: [['9']] });
    document.getElementById('bb_msg_id_10')!.firstElementChild!.textContent =
      'Sử dụng Zalo PC để tìm tin nhắn trước ngày 01/01/2025';
    const { d } = deps();
    const r = await drive(d);
    expect(r.reason).toBe('reached_start');
    expect(r.webHistoryFrom).toBeUndefined();
  });

  it('does not count against the hourly cap when rateLimited is false (automatic sync)', async () => {
    setup({ initial: ['10'], pages: [] });
    const now = Date.now();
    const rateStore = memStore({ [BACKFILL_RATE_KEY]: Array.from({ length: 20 }, () => now) });
    const { d } = deps({ rateStore, rateLimited: false, maxScrolls: 0 });
    const r = await drive(d);
    expect(r).toMatchObject({ state: 'done', reason: 'max_scrolls', scrolls: 0, posted: 1 });
    expect(rateStore.data[BACKFILL_RATE_KEY]).toHaveLength(20);
  });

  it('stops at the pending ids in DOM-only mode when asked (later fetches of a chat)', async () => {
    setup({ initial: ['10', '11'], pages: [['7', '8', '9'], ['4', '5', '6']] });
    const { d } = deps({ domOnly: true, stopWhenPendingSeen: true, pendingCliMsgIds: async () => ['8'] });
    const r = await drive(d);
    expect(r).toMatchObject({ state: 'done', reason: 'all_pending_seen', scrolls: 1 });
  });
});
