// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboxItem } from '@vclinks/shared';
import { pollOnce, type LoopDeps } from '../src/sender';
import { FB_ERR, sendFbToThread, type FbSendDeps } from '../src/messenger/sender';
import { readThreadMessages } from '../src/messenger/reader';
import { PARTNER_ID, out, inc, page, sep, sidebar } from './messenger-fixtures';

/**
 * Fake Messenger: sidebar links (click → client-side route change), a
 * contenteditable composer driven through document.execCommand (stubbed:
 * happy-dom has no editing engine), and an Enter handler that turns the
 * composer text into an outgoing row.
 */
interface FakeMessenger {
  loc: { pathname: string };
  composer: HTMLElement;
  grid: HTMLElement;
  enterPresses: number;
  keyCodes: number[];
  inserted: string[];
  onEnter: 'send' | 'ignore' | 'swallow';
  mangle: (s: string) => string;
}

const OTHER = '100005555555555';

function setup(opts: { open?: string } = {}): FakeMessenger {
  document.body.innerHTML = page({
    sidebar: sidebar([
      { id: OTHER, name: 'Chị Hoa' },
      { id: PARTNER_ID, name: 'Anh Tuấn Gara' },
    ]),
    rows: '',
  });
  const f: FakeMessenger = {
    loc: { pathname: `/t/${opts.open ?? OTHER}/` },
    composer: document.querySelector<HTMLElement>('[role="textbox"]')!,
    grid: document.querySelector<HTMLElement>('[role="main"] [role="grid"]')!,
    enterPresses: 0,
    keyCodes: [],
    inserted: [],
    onEnter: 'send',
    mangle: (s) => s,
  };
  f.composer.textContent = '';
  const threadRows: Record<string, string> = {
    [OTHER]: sep('09:00') + inc('Chị Hoa', 'Chào em'),
    [PARTNER_ID]: sep('10:00') + inc('Anh Tuấn Gara', 'Báo giá giúp anh') + out('ok'),
  };
  const show = () => {
    const id = f.loc.pathname.split('/')[2];
    f.grid.innerHTML = threadRows[id] ?? '';
  };
  show();
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[role="navigation"] a[href]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault(); // Messenger routes client-side
      f.loc.pathname = a.getAttribute('href')!;
      show();
    });
  }
  (document as unknown as { execCommand: (c: string, u?: boolean, v?: string) => boolean }).execCommand = (cmd, _ui, value) => {
    if (cmd === 'insertText') {
      f.inserted.push(value ?? '');
      f.composer.textContent = (f.composer.textContent ?? '') + f.mangle(value ?? '');
    } else if (cmd === 'delete') f.composer.textContent = '';
    return true;
  };
  f.composer.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter') return;
    f.enterPresses++;
    f.keyCodes.push(ke.keyCode);
    if (f.onEnter === 'ignore') return;
    const text = f.composer.textContent ?? '';
    f.composer.textContent = '';
    if (f.onEnter === 'swallow') return;
    f.grid.insertAdjacentHTML('beforeend', out(text, false));
  });
  return f;
}

function clock() {
  let t = new Date(2026, 8, 28, 15, 0, 0).getTime();
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
      await Promise.resolve();
    },
    sleeps,
  };
}

function deps(f: FakeMessenger, extra: Partial<FbSendDeps> = {}): FbSendDeps & { sleeps: number[] } {
  const c = clock();
  return { doc: document, loc: f.loc, now: c.now, sleep: c.sleep, sleeps: c.sleeps, random: () => 0, findScroller: () => null, ...extra };
}

describe('sendFbToThread', () => {
  let f: FakeMessenger;
  beforeEach(() => {
    f = setup();
  });

  it('opens the thread from the sidebar, types, presses Enter exactly once and confirms', async () => {
    const d = deps(f);
    const r = await sendFbToThread(PARTNER_ID, 'Dạ em gửi anh báo giá ạ', d);
    expect(r).toMatchObject({ ok: true, lines: 1 });
    expect(f.loc.pathname).toBe(`/t/${PARTNER_ID}/`);
    expect(f.enterPresses).toBe(1);
    expect(f.keyCodes).toEqual([13]);
    expect(f.composer.textContent).toBe('');
    // The returned id is the one the reader ingests for that bubble.
    const read = readThreadMessages(document, { threadId: PARTNER_ID, now: d.now!() }).messages;
    expect(r.ok && r.cliMsgId).toBe(read.at(-1)!.msgId);
    // Human pace: a "reading" pause before typing.
    expect(d.sleeps[0]).toBeGreaterThanOrEqual(2500);
  });

  it('confirms even when an identical outgoing text already exists in the thread', async () => {
    const r = await sendFbToThread(PARTNER_ID, 'ok', deps(f));
    expect(r.ok).toBe(true);
    expect(f.enterPresses).toBe(1);
  });

  it('never presses Enter when the composer text does not match 100%, and clears it', async () => {
    f.mangle = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const r = await sendFbToThread(PARTNER_ID, 'Dạ em chào anh', deps(f));
    expect(r).toMatchObject({ ok: false, error: FB_ERR.mismatch });
    expect(f.enterPresses).toBe(0);
    expect(f.composer.textContent).toBe('');
  });

  it('refuses while the user is typing, without touching the composer', async () => {
    const r = await sendFbToThread(PARTNER_ID, 'Xin chào', deps(f, { isUserActive: () => true }));
    expect(r).toMatchObject({ ok: false, error: FB_ERR.userActive, sentLines: 0 });
    expect(f.inserted).toEqual([]);
    expect(f.enterPresses).toBe(0);
  });

  it('aborts (and clears) when the user becomes active after typing, before Enter', async () => {
    let calls = 0;
    const r = await sendFbToThread(PARTNER_ID, 'Xin chào', deps(f, { isUserActive: () => ++calls > 2 }));
    expect(r).toMatchObject({ ok: false, error: FB_ERR.userActive });
    expect(f.inserted).toEqual(['Xin chào']);
    expect(f.enterPresses).toBe(0);
    expect(f.composer.textContent).toBe('');
  });

  it('does not overwrite a draft the user left in the composer', async () => {
    f = setup({ open: PARTNER_ID });
    f.composer.textContent = 'nháp của anh';
    const r = await sendFbToThread(PARTNER_ID, 'Xin chào', deps(f));
    expect(r).toMatchObject({ ok: false, error: FB_ERR.inputBusy });
    expect(f.composer.textContent).toBe('nháp của anh');
    expect(f.enterPresses).toBe(0);
  });

  it('fails without typing when the thread is not in the sidebar', async () => {
    const r = await sendFbToThread('100009999999999', 'Xin chào', deps(f));
    expect(r).toEqual({ ok: false, error: FB_ERR.notFound, sentLines: 0 });
    expect(f.inserted).toEqual([]);
  });

  it('reports failure (and clears) when Messenger keeps the text; Enter is not repeated', async () => {
    f.onEnter = 'ignore';
    const r = await sendFbToThread(PARTNER_ID, 'Xin chào', deps(f));
    expect(r).toMatchObject({ ok: false, error: FB_ERR.notSent });
    expect(f.enterPresses).toBe(1);
    expect(f.composer.textContent).toBe('');
  });

  it('reports unconfirmed when no outgoing bubble appears', async () => {
    f.onEnter = 'swallow';
    const r = await sendFbToThread(PARTNER_ID, 'Xin chào', deps(f));
    expect(r).toMatchObject({ ok: false, error: FB_ERR.unconfirmed });
    expect(f.enterPresses).toBe(1);
  });

  it('sends one message per line, spaced by the slow minimum gap', async () => {
    const d = deps(f);
    const r = await sendFbToThread(PARTNER_ID, 'Dạ anh\n\nEm gửi báo giá', d);
    expect(r).toMatchObject({ ok: true, lines: 2 });
    expect(f.enterPresses).toBe(2);
    expect(d.sleeps.filter((ms) => ms >= 8000)).toHaveLength(1);
  });

  it('rejects a malformed thread id', async () => {
    const r = await sendFbToThread('../../x', 'Xin chào', deps(f));
    expect(r).toMatchObject({ ok: false, error: FB_ERR.badThreadId });
  });
});

describe('pollOnce with the Messenger sender', () => {
  const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
    id: 'f1',
    uid: 'fb_100001111111111',
    channel: 'fb_personal',
    threadId: PARTNER_ID,
    text: 'Dạ em chào anh',
    status: 'approved',
    approvedBy: 'anh',
    approvedAt: '2026-09-28T01:00:00.000Z',
    createdAt: '2026-09-28T01:00:00.000Z',
    ...over,
  });

  function loop(f: FakeMessenger, over: Partial<LoopDeps> = {}) {
    const c = clock();
    const api = {
      pending: vi.fn(async () => [item({ id: 'z1', channel: 'zalo' }), item({ id: 'f1' }), item({ id: 'f2' })]),
      claim: vi.fn(async (id: string) => item({ id, status: 'sending' })),
      result: vi.fn(async () => ({})),
    };
    const d: LoopDeps = {
      doc: document,
      now: c.now,
      sleep: c.sleep,
      api,
      config: async () => ({ enabled: true, uid: 'fb_100001111111111' }),
      knownUids: async () => ['fb_100001111111111'],
      acceptItem: (i) => i.channel === 'fb_personal',
      maxPerPoll: 1,
      send: (threadId, text) => sendFbToThread(threadId, text, { doc: document, loc: f.loc, now: c.now, sleep: c.sleep, random: () => 0 }),
      ...over,
    };
    return { d, api };
  }

  it('sends only Facebook items, one per poll', async () => {
    const f = setup();
    const { d, api } = loop(f);
    expect(await pollOnce(d)).toBe(1);
    expect(api.claim).toHaveBeenCalledTimes(1);
    expect(api.claim).toHaveBeenCalledWith('f1');
    expect(api.result).toHaveBeenCalledWith('f1', expect.objectContaining({ ok: true }));
    expect(f.enterPresses).toBe(1);
  });

  it('does not claim or type while the user keeps using the tab', async () => {
    const f = setup();
    const c = clock();
    const { d, api } = loop(f, { now: c.now, sleep: c.sleep, lastUserActivity: () => c.now() - 3000 });
    expect(await pollOnce(d)).toBe(0);
    expect(api.claim).not.toHaveBeenCalled();
    expect(f.enterPresses).toBe(0);
  });

  it('stops when the hourly cap says no, before claiming', async () => {
    const f = setup();
    const { d, api } = loop(f, { allowSend: () => false });
    expect(await pollOnce(d)).toBe(0);
    expect(api.claim).not.toHaveBeenCalled();
  });
});
