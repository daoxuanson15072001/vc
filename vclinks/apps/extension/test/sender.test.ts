// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DOM_SELECTORS, type OutboxItem } from '@vclinks/shared';
import { readActiveThread } from '../src/backfill';
import {
  DEFAULT_TIMING,
  ERR,
  LONG_POLL_SEC,
  REPLY_SELECTORS,
  clickTarget,
  findBubble,
  normalizeText,
  openConversation,
  pollOnce,
  sameName,
  sendToThread,
  splitLines,
  type LoopDeps,
  type SendDeps,
} from '../src/sender';

/**
 * Fake Zalo Web: sidebar items (click → selected), a #richInput whose editing
 * goes through document.execCommand (stubbed: happy-dom has no editing engine),
 * and an Enter handler that turns the input into a sent bubble.
 */
interface FakeZalo {
  input: HTMLElement;
  chat: HTMLElement;
  sidebar: HTMLElement;
  enterPresses: number;
  keyCodes: number[];
  /** What Zalo does on Enter: 'send' (default), 'ignore' (keeps text), 'swallow' (clears, no bubble). */
  onEnter: 'send' | 'ignore' | 'swallow';
  /** Transforms text inserted by insertText (simulates a corrupting editor). */
  mangle: (s: string) => string;
  /** Whether clicking a sidebar item selects it. */
  clickSelects: boolean;
  addThread(id: string, name?: string): HTMLElement;
}

let cli = 1000;

function setup(threads: string[] = ['222', 'g333']): FakeZalo {
  document.body.innerHTML = `
    <div id="sidebar"></div>
    <div id="chat"></div>
    <div id="richInput" contenteditable="true"></div>`;
  const z: FakeZalo = {
    input: document.getElementById('richInput')!,
    chat: document.getElementById('chat')!,
    sidebar: document.getElementById('sidebar')!,
    enterPresses: 0,
    keyCodes: [],
    onEnter: 'send',
    mangle: (s) => s,
    clickSelects: true,
    addThread(id, name = `Hội thoại ${id}`) {
      const el = document.createElement('div');
      el.setAttribute('data-id', 'div_TabMsg_ThrdChItem');
      el.setAttribute('anim-data-id', id);
      el.textContent = name;
      el.addEventListener('click', () => {
        if (!z.clickSelects) return;
        for (const other of z.sidebar.querySelectorAll('.selected')) other.classList.remove('selected');
        el.classList.add('selected');
      });
      z.sidebar.append(el);
      return el;
    },
  };
  for (const t of threads) z.addThread(t);
  document.hasFocus = () => true;

  (document as unknown as { execCommand: (c: string, u?: boolean, v?: string) => boolean }).execCommand = (
    cmd,
    _ui,
    value,
  ) => {
    if (cmd === 'insertText') z.input.textContent = (z.input.textContent ?? '') + z.mangle(value ?? '');
    else if (cmd === 'delete') z.input.textContent = '';
    return true;
  };

  z.input.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Enter') return;
    z.enterPresses++;
    z.keyCodes.push(ke.keyCode);
    if (z.onEnter === 'ignore') return;
    const text = z.input.innerText;
    z.input.textContent = '';
    if (z.onEnter === 'swallow') return;
    const id = String(++cli);
    const bubble = document.createElement('div');
    bubble.id = `bb_msg_id_${id}`;
    const body = document.createElement('div');
    body.setAttribute('data-id', 'div_SentMsg_Text');
    body.textContent = text;
    bubble.append(body);
    z.chat.append(bubble);
  });
  return z;
}

/** Virtual clock: sleeping advances time instantly. */
function clock() {
  let t = 1_700_000_000_000;
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

function deps(extra: Partial<SendDeps> = {}): SendDeps & { sleeps: number[] } {
  const c = clock();
  return { doc: document, now: c.now, sleep: c.sleep, sleeps: c.sleeps, findScroller: () => null, ...extra };
}

describe('text helpers', () => {
  it('normalises nbsp / zero-width / edges and splits non-empty lines', () => {
    expect(normalizeText('  Dạ anh​ \n')).toBe('Dạ anh');
    expect(splitLines('Dạ anh\r\n\n  Em gửi báo giá  \n \nCảm ơn anh')).toEqual(['Dạ anh', 'Em gửi báo giá', 'Cảm ơn anh']);
  });
});

describe('sameName', () => {
  it('matches header and sidebar names despite emoji, spacing and a stripped time tail', () => {
    expect(sameName('Nhóm VCS 🚗', 'nhóm  vcs')).toBe(true);
    expect(sameName('Họp giao ban 12/9', 'Họp giao ban')).toBe(true);
    expect(sameName('Nhóm VCS', 'Nhóm VCS')).toBe(true);
  });
  it('rejects different names, empty values and too-short prefixes', () => {
    expect(sameName('Nhóm VCS', 'Nhóm VCP')).toBe(false);
    expect(sameName('An', 'Anh Tuấn')).toBe(false);
    expect(sameName(null, 'Nhóm VCS')).toBe(false);
    expect(sameName('🚗', '🚗')).toBe(false);
  });
});

describe('readActiveThread', () => {
  it('skips the icon-only btn_ChatTitle_Search inside #header and reads the name from #header', () => {
    document.body.innerHTML = `
      <div id="header" class="flx"><div data-id="btn_ChatTitle_Search"></div><span>3.VCPARTS_KHO KIM ĐỒNG</span></div>`;
    expect(readActiveThread(document).header).toBe('3.VCPARTS_KHO KIM ĐỒNG');
  });
});

describe('openConversation', () => {
  let z: FakeZalo;
  beforeEach(() => {
    z = setup();
  });

  /** Adds a bubble with the given cliMsgId to the chat pane. */
  const bubble = (id: string, text = 'x') => {
    const b = document.createElement('div');
    b.id = `bb_msg_id_${id}`;
    const body = document.createElement('div');
    body.setAttribute('data-id', 'div_ReceivedMsg_Text');
    body.textContent = text;
    b.append(body);
    z.chat.append(b);
  };

  it('accepts the conversation as open when a known cliMsgId is on screen, even without a selected item', async () => {
    z.clickSelects = false;
    bubble('777');
    const r = await openConversation('222', deps({ confirmCliMsgIds: ['777', '778'] }));
    expect(r).toEqual({ ok: true });
  });

  it('does not accept a bubble from another conversation as confirmation', async () => {
    z.clickSelects = false;
    bubble('555');
    const r = await openConversation('222', deps({ confirmCliMsgIds: ['777'] }));
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining(ERR.notActive) });
  });

  it('refuses to open a conversation with unread messages when asked (automatic runs)', async () => {
    const el = z.sidebar.querySelector('[anim-data-id="222"]')!;
    // Muted chat: a dot badge without a number (Zalo Web, 29/09/2026).
    el.insertAdjacentHTML('beforeend', '<div class="conv-action__unread-v2"><i class="z-noti-badge --big --dot"></i></div>');
    const r = await openConversation('222', deps({ refuseUnread: true }));
    expect(r).toEqual({ ok: false, error: ERR.unread });
    expect(el.classList.contains('selected')).toBe(false);
    // Without the flag (sending an approved message) it still opens.
    expect(await openConversation('222', deps())).toEqual({ ok: true });
  });

  it('opens an unread conversation when allowUnread is set (confirmed request / máy Zalo option)', async () => {
    const el = z.sidebar.querySelector('[anim-data-id="222"]')!;
    el.insertAdjacentHTML('beforeend', '<div class="conv-action__unread-v2"><i class="z-noti-badge --big --dot"></i></div>');
    expect(await openConversation('222', deps({ refuseUnread: true, allowUnread: true }))).toEqual({ ok: true });
  });

  it('with allowUnread, finds a chat pushed below the rendered sidebar through Zalo search, confirmed by its bubbles', async () => {
    const { box, seen } = fakeSearch(() => bubble('778'));
    const r = await openConversation('g999', deps({ refuseUnread: true, allowUnread: true, name: 'Kho Kim Đồng', confirmCliMsgIds: ['778'] }));
    expect(r).toEqual({ ok: true });
    expect(seen).toEqual(['Kho Kim Đồng', '']);
    expect(box.value).toBe('');
  });

  it('never falls back to Zalo search when refusing unread chats (search shows no unread marks)', async () => {
    const r = await openConversation('g999', deps({ refuseUnread: true, name: 'Nhóm lạ' }));
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining(ERR.notFound) });
  });

  it('asks for the tab when it is hidden and the item is not rendered', async () => {
    // happy-dom defines visibilityState on the prototype; shadow it on the instance.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    try {
      const r = await openConversation('g999', deps());
      expect(r).toEqual({ ok: false, error: ERR.tabHidden });
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState;
    }
  });

  it('clicks the .conv-item row inside the virtual-list wrapper (Zalo listens there, not on the wrapper)', async () => {
    z.clickSelects = false; // the wrapper does nothing
    const item = z.sidebar.querySelector<HTMLElement>('[anim-data-id="222"]')!;
    const row = document.createElement('div');
    row.className = 'gridv2 conv-item conv-rel';
    row.textContent = 'Hội thoại 222';
    item.textContent = '';
    item.append(row);
    row.addEventListener('click', () => row.classList.add('selected'));
    expect(clickTarget(item)).toBe(row);
    const r = await openConversation('222', deps());
    expect(r).toEqual({ ok: true });
  });

  /** Fake Zalo search: typing renders "Liên hệ" rows; clicking a row opens the thread; clearing removes the rows. */
  function fakeSearch(onOpen: () => void) {
    const box = document.createElement('input');
    box.setAttribute('data-id', 'txt_Main_Search');
    document.body.append(box);
    const results = document.createElement('div');
    results.id = 'results';
    document.body.append(results);
    const seen: string[] = [];
    box.addEventListener('input', () => {
      seen.push(box.value);
      results.replaceChildren();
      if (!box.value) return;
      const title = document.createElement('div');
      title.className = 'item-search__title';
      title.textContent = 'Liên hệ (2)';
      results.append(title);
      for (const name of ['Kho Kim Đồng', 'Kho Kim Đồng Cũ']) {
        const row = document.createElement('div');
        row.className = 'gridv2 conv-item conv-rel lv-1';
        const nm = document.createElement('div');
        nm.className = 'conv-item-title__name truncate';
        nm.textContent = name;
        row.append(nm);
        if (name === 'Kho Kim Đồng') row.addEventListener('click', onOpen);
        results.append(row);
      }
    });
    return { box, seen };
  }

  it('finds an unrendered conversation through search by name and clears the query afterwards', async () => {
    // Opening from a result: Zalo shows the chat (bubble with a known cliMsgId)…
    const { box, seen } = fakeSearch(() => bubble('777'));
    const r = await openConversation('g999', deps({ name: '  Kho  Kim Đồng ', confirmCliMsgIds: ['777'] }));
    expect(r).toEqual({ ok: true });
    expect(seen).toEqual(['Kho Kim Đồng', '']);
    expect(box.value).toBe('');
  });

  it('after search, also accepts the sidebar item that comes back selected once the query is cleared', async () => {
    // …or, once the query is cleared, the sidebar returns with the item selected.
    const { box } = fakeSearch(() => undefined);
    box.addEventListener('input', () => {
      if (!box.value && !z.sidebar.querySelector('[anim-data-id="g999"]')) z.addThread('g999', 'Kho Kim Đồng').classList.add('selected');
    });
    const r = await openConversation('g999', deps({ name: 'Kho Kim Đồng' }));
    expect(r).toEqual({ ok: true });
  });

  it('matches the search result by its id `group-item-<threadId>` even when the stored name is outdated (M1a-06)', async () => {
    const box = document.createElement('input');
    box.setAttribute('data-id', 'txt_Main_Search');
    document.body.append(box);
    box.addEventListener('input', () => {
      document.getElementById('res')?.remove();
      if (!box.value) return;
      const row = document.createElement('div');
      row.className = 'gridv2 conv-item conv-rel lv-1';
      row.id = 'group-item-g999';
      row.innerHTML = '<div class="conv-item-title__name truncate">Kiểm thử vclink (mới)</div>';
      const wrap = document.createElement('div');
      wrap.id = 'res';
      wrap.append(row);
      row.addEventListener('click', () => bubble('778'));
      document.body.append(wrap);
    });
    const r = await openConversation('g999', deps({ name: 'Kiểm thử', confirmCliMsgIds: ['778'] }));
    expect(r).toEqual({ ok: true });
    expect(box.value).toBe('');
  });

  it('prefers the exact name over a longer name starting with it', async () => {
    let opened = '';
    const box = document.createElement('input');
    box.setAttribute('data-id', 'txt_Main_Search');
    document.body.append(box);
    box.addEventListener('input', () => {
      document.getElementById('res')?.remove();
      if (!box.value) return;
      const wrap = document.createElement('div');
      wrap.id = 'res';
      for (const name of ['Kho Kim Đồng Cũ', 'Kho Kim Đồng']) {
        const row = document.createElement('div');
        row.className = 'conv-item';
        row.innerHTML = `<div class="conv-item-title__name">${name}</div>`;
        row.addEventListener('click', () => {
          opened = name;
          if (name === 'Kho Kim Đồng') bubble('779');
        });
        wrap.append(row);
      }
      document.body.append(wrap);
    });
    const r = await openConversation('g999', deps({ name: 'Kho Kim Đồng', confirmCliMsgIds: ['779'] }));
    expect(r).toEqual({ ok: true });
    expect(opened).toBe('Kho Kim Đồng');
  });

  it('types the query again when Zalo wipes the first one', async () => {
    const { box, seen } = fakeSearch(() => bubble('780'));
    let wiped = false;
    box.addEventListener('input', () => {
      if (!wiped && box.value) {
        wiped = true;
        box.value = '';
        document.getElementById('results')!.replaceChildren();
      }
    });
    const r = await openConversation('g999', deps({ name: 'Kho Kim Đồng', confirmCliMsgIds: ['780'] }));
    expect(r).toEqual({ ok: true });
    expect(seen.filter((v) => v === 'Kho Kim Đồng').length).toBe(2);
  });

  it('says why the search failed (no name / no result)', async () => {
    fakeSearch(() => undefined);
    const noName = await openConversation('g999', deps({}));
    expect(noName).toMatchObject({ ok: false, error: expect.stringContaining('chưa có tên hội thoại') });
    const none = await openConversation('g999', deps({ name: 'Không có' }));
    expect(none).toMatchObject({ ok: false, error: expect.stringContaining('không khớp hội thoại') });
  });

  it('reports not found when search yields nothing, with the box cleared', async () => {
    const { box } = fakeSearch(() => undefined);
    const r = await openConversation('g999', deps({ name: 'Không có' }));
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining(ERR.notFound) });
    expect(box.value).toBe('');
  });
});

describe('sendToThread', () => {
  let z: FakeZalo;
  beforeEach(() => {
    z = setup();
  });

  it('opens the conversation, types, presses Enter exactly once and confirms the bubble', async () => {
    const d = deps();
    const r = await sendToThread('222', 'Dạ em chào anh, mai em giao hàng ạ', d);
    expect(r).toMatchObject({ ok: true, lines: 1 });
    expect(r.ok && r.cliMsgId).toBe(String(cli));
    expect(z.enterPresses).toBe(1);
    expect(z.keyCodes).toEqual([13]);
    expect(z.sidebar.querySelector('.selected')?.getAttribute('anim-data-id')).toBe('222');
    expect(z.input.innerText).toBe('');
  });

  it('clicks Zalo’s send button when it is shown (a synthetic Enter is ignored by Zalo Web)', async () => {
    z.onEnter = 'ignore';
    const button = document.createElement('div');
    button.setAttribute('icon', 'Sent-msg_24_Line');
    let clicks = 0;
    button.addEventListener('click', () => {
      clicks++;
      const text = z.input.innerText;
      z.input.textContent = '';
      const bubble = document.createElement('div');
      bubble.id = `bb_msg_id_${++cli}`;
      bubble.innerHTML = `<div data-id="div_SentMsg_Text">${text}</div>`;
      z.chat.append(bubble);
    });
    document.body.append(button);
    const r = await sendToThread('222', 'Dạ em gửi báo giá ạ', deps());
    button.remove();
    expect(r).toMatchObject({ ok: true, lines: 1 });
    expect(clicks).toBe(1);
    expect(z.enterPresses).toBe(0);
  });

  it('treats the send as done when Zalo replaces #richInput with a fresh empty one', async () => {
    z.input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key !== 'Enter') return;
      // Zalo re-renders the editor: the old node keeps its text, a new empty one takes its place.
      const old = z.input;
      const fresh = old.cloneNode(false) as HTMLElement;
      old.removeAttribute('id');
      old.textContent = 'stale';
      old.after(fresh);
    });
    const r = await sendToThread('222', 'Dạ vâng', deps());
    expect(r).toMatchObject({ ok: true, lines: 1 });
  });

  it('asks for the tab to be focused before typing (execCommand fails without focus)', async () => {
    let hasFocus = false;
    document.hasFocus = () => hasFocus;
    z.mangle = (v) => (hasFocus ? v : '');
    const focusTab = vi.fn(async () => {
      hasFocus = true;
    });
    const r = await sendToThread('222', 'Dạ em chào anh', deps({ focusTab }));
    expect(r).toMatchObject({ ok: true });
    expect(focusTab).toHaveBeenCalledTimes(1);
  });

  it('reports noFocus (and does not send) when the tab cannot get focus', async () => {
    document.hasFocus = () => false;
    z.mangle = () => '';
    const r = await sendToThread('222', 'Dạ em chào anh', deps({ focusTab: async () => undefined }));
    expect(r).toMatchObject({ ok: false, error: ERR.noFocus });
    expect(z.enterPresses).toBe(0);
  });

  it('maps a group threadId to the prefixed sidebar id (g<groupId>)', async () => {
    const r = await sendToThread('333', 'Chào cả nhóm', deps());
    expect(r.ok).toBe(true);
    expect(z.sidebar.querySelector('.selected')?.getAttribute('anim-data-id')).toBe('g333');
  });

  it('scrolls the virtual sidebar to find a conversation that is not rendered', async () => {
    const scroller = document.createElement('div');
    let top = 0;
    Object.defineProperty(scroller, 'scrollTop', {
      get: () => top,
      set: (v: number) => {
        top = v;
        if (v >= 400 && !document.querySelector('[anim-data-id="999"]')) z.addThread('999');
      },
    });
    Object.defineProperty(scroller, 'clientHeight', { get: () => 300 });
    const r = await sendToThread('999', 'Xin chào', deps({ findScroller: () => scroller }));
    expect(r.ok).toBe(true);
  });

  it('fails with "không tìm thấy hội thoại" after the scroll limit, without typing', async () => {
    const scroller = document.createElement('div');
    let top = 0;
    Object.defineProperty(scroller, 'scrollTop', { get: () => top, set: (v: number) => (top = v) });
    Object.defineProperty(scroller, 'clientHeight', { get: () => 300 });
    const r = await sendToThread('404', 'Xin chào', deps({ findScroller: () => scroller }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining(ERR.notFound), sentLines: 0 });
    expect(z.enterPresses).toBe(0);
    expect(z.input.innerText).toBe('');
  });

  it('refuses when the clicked conversation does not become active', async () => {
    z.clickSelects = false;
    const r = await sendToThread('222', 'Xin chào', deps());
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining(ERR.notActive) });
    expect(z.input.innerText).toBe('');
    expect(z.enterPresses).toBe(0);
  });

  it('never presses Enter when the typed text does not match 100%, and clears the input', async () => {
    z.mangle = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, ''); // lost diacritics
    const r = await sendToThread('222', 'Dạ em chào anh', deps());
    expect(r).toMatchObject({ ok: false, error: ERR.mismatch });
    expect(z.enterPresses).toBe(0);
    expect(z.input.innerText).toBe('');
  });

  it('does not overwrite a draft the user left in the input', async () => {
    z.input.textContent = 'nháp của anh';
    const r = await sendToThread('222', 'Xin chào', deps());
    expect(r).toMatchObject({ ok: false, error: ERR.inputBusy });
    expect(z.input.innerText).toBe('nháp của anh');
    expect(z.enterPresses).toBe(0);
  });

  it('reports failure (and clears) when Zalo keeps the text after Enter; Enter is not repeated', async () => {
    z.onEnter = 'ignore';
    const r = await sendToThread('222', 'Xin chào', deps());
    expect(r).toMatchObject({ ok: false, error: ERR.notSent });
    expect(z.enterPresses).toBe(1);
    expect(z.input.innerText).toBe('');
  });

  it('reports unconfirmed when no outgoing bubble appears', async () => {
    z.onEnter = 'swallow';
    const r = await sendToThread('222', 'Xin chào', deps());
    expect(r).toMatchObject({ ok: false, error: ERR.unconfirmed });
    expect(z.enterPresses).toBe(1);
  });

  it('sends a multi-line text as one message per non-empty line, spaced by the minimum gap', async () => {
    const d = deps();
    const r = await sendToThread('222', 'Dạ anh\n\nEm gửi báo giá\nCảm ơn anh', d);
    expect(r).toMatchObject({ ok: true, lines: 3 });
    expect(z.enterPresses).toBe(3);
    expect([...z.chat.querySelectorAll('[data-id="div_SentMsg_Text"]')].map((e) => e.textContent)).toEqual([
      'Dạ anh',
      'Em gửi báo giá',
      'Cảm ơn anh',
    ]);
    expect(d.sleeps.filter((ms) => ms === DEFAULT_TIMING.minGapMs)).toHaveLength(2);
  });

  it('stops at the first failed line and says how many lines went out', async () => {
    let n = 0;
    z.mangle = (s) => (++n === 2 ? `${s}!` : s);
    const r = await sendToThread('222', 'Dòng 1\nDòng 2\nDòng 3', deps());
    expect(r).toEqual({ ok: false, error: `đã gửi 1/3 dòng; ${ERR.mismatch}`, sentLines: 1 });
    expect(z.enterPresses).toBe(1);
  });
});

describe('reply ("Trả lời")', () => {
  let z: FakeZalo;
  /** Hover menu + reply banner + group @mention pre-fill, as surveyed on Zalo Web 28/09/2026. */
  const target = (id: string, opts: { menu?: boolean; banner?: boolean } = {}) => {
    const b = document.createElement('div');
    b.id = `bb_msg_id_${id}`;
    b.innerHTML = `<div class="message-content-wrapper"><div data-id="div_ReceivedMsg_Text">Báo giá lọc gió</div></div>
      <div class="floating-menu-wrapper"></div>`;
    const wrapper = b.querySelector<HTMLElement>('.message-content-wrapper')!;
    wrapper.addEventListener('mouseover', () => {
      const menu = b.querySelector('.floating-menu-wrapper')!;
      if (opts.menu === false || menu.children.length) return;
      const btn = document.createElement('div');
      btn.className = 'MSABtn-btn';
      btn.setAttribute('data-translate-title', 'STR_REPLY_MSG');
      btn.addEventListener('click', () => {
        if (opts.banner === false) return;
        const heading = document.getElementById('chatInput')!;
        heading.insertAdjacentHTML('afterbegin', '<div class="quote-banner"><i class="quote-close"></i></div>');
        heading.querySelector('.quote-close')!.addEventListener('click', () => heading.querySelector('.quote-banner')!.remove());
        z.input.textContent = '@VCpart An ';
      });
      menu.append(btn);
    });
    z.chat.append(b);
    return b;
  };

  beforeEach(() => {
    z = setup();
    // Zalo's composer lives in #chatInput; the banner is rendered there.
    const box = document.createElement('div');
    box.id = 'chatInput';
    z.input.replaceWith(box);
    box.append(z.input);
    // Real insertText replaces the selection (select-all): the @mention pre-fill is overwritten.
    (document as unknown as { execCommand: (c: string, u?: boolean, v?: string) => boolean }).execCommand = (cmd, _ui, value) => {
      if (cmd === 'insertText') z.input.textContent = z.mangle(value ?? '');
      else if (cmd === 'delete') z.input.textContent = '';
      return true;
    };
  });

  it('hovers the bubble, clicks Trả lời, replaces the @mention with the approved text and sends once', async () => {
    target('900');
    const r = await sendToThread('222', 'Dạ em gửi ạ\nCảm ơn anh', deps({ replyToCliMsgId: '900' }));
    expect(r).toMatchObject({ ok: true, lines: 2 });
    // The quote rides on the first line only.
    expect(r.ok && r.replyCliMsgId).toBe(String(cli - 1));
    expect(r.ok && r.cliMsgId).toBe(String(cli));
    expect(z.enterPresses).toBe(2);
    expect(z.chat.querySelectorAll('[data-id="div_SentMsg_Text"]')[0].textContent).toBe('Dạ em gửi ạ');
  });

  it('scrolls the chat up to an old message that is not rendered, then replies to it (03 §8 D33)', async () => {
    const scroller = document.createElement('div');
    let scrolls = 0;
    Object.defineProperty(scroller, 'scrollTop', {
      get: () => 0,
      set: () => {
        scrolls++;
        // Each scroll loads one older bubble; the target arrives with the third load.
        if (scrolls === 3) target('905');
        else {
          const older = document.createElement('div');
          older.id = `bb_msg_id_old${scrolls}`;
          z.chat.prepend(older);
        }
      },
    });
    const r = await sendToThread('222', 'Dạ có ạ', deps({ replyToCliMsgId: '905', findMessageScroller: () => scroller }));
    expect(r).toMatchObject({ ok: true, lines: 1 });
    expect(scrolls).toBe(3);
    expect(z.enterPresses).toBe(1);
  });

  it('stops scrolling at the start of Web history and fails without typing', async () => {
    const scroller = document.createElement('div');
    let scrolls = 0;
    Object.defineProperty(scroller, 'scrollTop', { get: () => 0, set: () => void scrolls++ });
    const r = await sendToThread('222', 'Dạ', deps({ replyToCliMsgId: '906', findMessageScroller: () => scroller }));
    expect(r).toEqual({ ok: false, error: ERR.replyTarget, sentLines: 0 });
    // Two scrolls in a row loaded nothing: no need to try the remaining eight.
    expect(scrolls).toBe(2);
    expect(z.enterPresses).toBe(0);
    expect(z.input.textContent).toBe('');
  });

  it('fails without typing when the replied message is not rendered', async () => {
    const r = await sendToThread('222', 'Dạ', deps({ replyToCliMsgId: '901' }));
    expect(r).toEqual({ ok: false, error: ERR.replyTarget, sentLines: 0 });
    expect(z.enterPresses).toBe(0);
  });

  it('fails when the reply button never shows', async () => {
    target('902', { menu: false });
    const r = await sendToThread('222', 'Dạ', deps({ replyToCliMsgId: '902' }));
    expect(r).toEqual({ ok: false, error: ERR.replyButton, sentLines: 0 });
    expect(z.enterPresses).toBe(0);
  });

  it('fails when Zalo does not open the quote banner', async () => {
    target('903', { banner: false });
    const r = await sendToThread('222', 'Dạ', deps({ replyToCliMsgId: '903' }));
    expect(r).toEqual({ ok: false, error: ERR.replyBanner, sentLines: 0 });
    expect(z.enterPresses).toBe(0);
  });

  it('closes the banner and clears the box when the typed text does not match', async () => {
    target('904');
    z.mangle = (s) => `${s}!`;
    const r = await sendToThread('222', 'Dạ', deps({ replyToCliMsgId: '904' }));
    expect(r).toEqual({ ok: false, error: ERR.mismatch, sentLines: 0 });
    expect(document.querySelector(REPLY_SELECTORS.banner)).toBeNull();
    expect(z.input.textContent).toBe('');
    expect(z.enterPresses).toBe(0);
  });

  it('finds album photos by data-qid and never matches a longer cliMsgId by prefix', () => {
    z.chat.innerHTML = `
      <div id="bb_msg_id_12345"></div>
      <div id="bb_msg_id_100_7_g1"><div data-qid="8@100_7_g1"></div><div data-qid="9@101_7_g1"></div></div>`;
    expect(findBubble(document, DEFAULT_DOM_SELECTORS, '1234')).toBeNull();
    expect(findBubble(document, DEFAULT_DOM_SELECTORS, '12345')?.id).toBe('bb_msg_id_12345');
    expect(findBubble(document, DEFAULT_DOM_SELECTORS, '101')?.id).toBe('bb_msg_id_100_7_g1');
    expect(findBubble(document, DEFAULT_DOM_SELECTORS, 'x"]')).toBeNull();
  });
});

describe('pollOnce', () => {
  const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
    id: 'a1',
    uid: '111',
    channel: 'zalo',
    threadId: '222',
    text: 'Dạ em chào anh',
    status: 'approved',
    approvedBy: 'anh',
    approvedAt: '2026-09-28T01:00:00.000Z',
    createdAt: '2026-09-28T01:00:00.000Z',
    ...over,
  });

  function loop(over: Partial<LoopDeps> = {}) {
    const c = clock();
    const api = {
      pending: vi.fn(async () => [item()]),
      claim: vi.fn(async (id: string) => item({ id, status: 'sending' })),
      result: vi.fn(async () => ({})),
    };
    const d: LoopDeps = {
      doc: document,
      now: c.now,
      sleep: c.sleep,
      findScroller: () => null,
      api,
      config: async () => ({ enabled: true, uid: '111' }),
      knownUids: async () => ['111', '555'],
      ...over,
    };
    return { d, api };
  }

  beforeEach(() => {
    setup();
  });

  it('with a thread allowlist, never claims items for other conversations', async () => {
    const { d, api } = loop({ config: async () => ({ enabled: true, uid: '111', onlyThreadIds: ['g-test'] }) });
    expect(await pollOnce(d)).toBe(0);
    expect(api.claim).not.toHaveBeenCalled();
  });

  it('friend requests have no conversation: the thread allowlist does not apply, a message still does (M1a-04)', async () => {
    const { d, api } = loop({
      config: async () => ({ enabled: true, uid: '111', onlyThreadIds: ['g-test'] }),
      sendItem: async () => ({ ok: true, cliMsgId: null, sentAt: new Date(), lines: 0 }),
    });
    api.pending.mockResolvedValue([
      item({ id: 'f1', action: 'friend_accept', threadId: '11', friend: { userId: '11', name: 'Hương' } }),
      item({ id: 't1', threadId: '222' }),
    ]);
    expect(await pollOnce(d)).toBe(1);
    expect(api.claim).toHaveBeenCalledTimes(1);
    expect(api.claim).toHaveBeenCalledWith('f1');
  });

  it('does nothing while disabled', async () => {
    const { d, api } = loop({ config: async () => ({ enabled: false, uid: '111' }) });
    expect(await pollOnce(d)).toBe(0);
    expect(api.pending).not.toHaveBeenCalled();
  });

  it('does nothing when the uid is not a Zalo account of this browser', async () => {
    const { d, api } = loop({ knownUids: async () => ['555'] });
    expect(await pollOnce(d)).toBe(0);
    expect(api.pending).not.toHaveBeenCalled();
  });

  it('keeps polling while the user is active, but does not claim until they stop', async () => {
    const c = clock();
    // The user keeps touching the tab: the idle window never elapses.
    const { d, api } = loop({ now: c.now, sleep: c.sleep, lastUserActivity: () => c.now() - 2000 });
    expect(await pollOnce(d)).toBe(0);
    expect(api.pending).toHaveBeenCalledWith('111', LONG_POLL_SEC);
    expect(api.claim).not.toHaveBeenCalled();

    // A single click 2 s ago: the sender waits out the remaining idle window, then sends.
    const c2 = clock();
    const clickedAt = c2.now() - 2000;
    const r = loop({ now: c2.now, sleep: c2.sleep, lastUserActivity: () => clickedAt });
    expect(await pollOnce(r.d)).toBe(1);
    expect(r.api.claim).toHaveBeenCalledWith('a1');
  });

  it('brings a hidden Zalo tab forward before performing any item', async () => {
    let hidden = true;
    const vis = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    const focusTab = vi.fn(async () => { hidden = false; });
    const seen: string[] = [];
    const { d } = loop({ focusTab, send: async () => { seen.push(document.visibilityState); return { ok: true, cliMsgId: null, sentAt: new Date(), lines: 1 }; } });
    try {
      expect(await pollOnce(d)).toBe(1);
      expect(focusTab).toHaveBeenCalledTimes(1);
      expect(seen).toEqual(['visible']);
    } finally {
      if (vis) Object.defineProperty(document, 'visibilityState', vis);
      else delete (document as unknown as Record<string, unknown>).visibilityState;
    }
  });

  it('asks the API for a plain poll when waitSec is 0', async () => {
    const { d, api } = loop({ waitSec: 0 });
    await pollOnce(d);
    expect(api.pending).toHaveBeenCalledWith('111', 0);
  });

  it('claims, sends and reports ok with the cliMsgId', async () => {
    const { d, api } = loop();
    expect(await pollOnce(d)).toBe(1);
    expect(api.claim).toHaveBeenCalledWith('a1');
    expect(api.result).toHaveBeenCalledWith('a1', expect.objectContaining({ ok: true, cliMsgId: String(cli) }));
  });

  it('never claims an item lacking approval, and skips items another sender claimed', async () => {
    const { d } = loop({
      api: {
        pending: vi.fn(async () => [item({ id: 'x', approvedBy: '' }), item({ id: 'y', approvedAt: '' }), item({ id: 'z' })]),
        claim: vi.fn(async () => {
          throw new Error('HTTP 409');
        }),
        result: vi.fn(async () => ({})),
      },
    });
    expect(await pollOnce(d)).toBe(0);
    expect(d.api.claim).toHaveBeenCalledTimes(1);
    expect(d.api.claim).toHaveBeenCalledWith('z');
    expect(d.api.result).not.toHaveBeenCalled();
  });

  it('passes the item name and recent cliMsgIds so an unrendered conversation is found via search', async () => {
    const { d } = loop();
    const box = document.createElement('input');
    box.setAttribute('data-id', 'txt_Main_Search');
    document.body.append(box);
    const seen: string[] = [];
    box.addEventListener('input', () => seen.push(box.value));
    const a = {
      pending: vi.fn(async () => [item({ threadId: '404', name: 'Kho Kim Đồng', recentCliMsgIds: ['777'] })]),
      claim: vi.fn(async (id: string) => item({ id, threadId: '404', status: 'sending' })),
      result: vi.fn(async () => ({})),
    };
    d.api = a;
    await pollOnce(d);
    // Search was tried with the item's name (no matching result here, so it still fails cleanly).
    expect(seen[0]).toBe('Kho Kim Đồng');
    expect(a.result).toHaveBeenCalledWith('a1', { ok: false, error: expect.stringContaining(ERR.notFound) });
  });

  it('reports failed with a reason when the conversation is missing', async () => {
    const { d } = loop();
    const a = {
      pending: vi.fn(async () => [item({ threadId: '404' })]),
      claim: vi.fn(async (id: string) => item({ id, threadId: '404', status: 'sending' })),
      result: vi.fn(async () => ({})),
    };
    d.api = a;
    await pollOnce(d);
    expect(a.result).toHaveBeenCalledWith('a1', { ok: false, error: expect.stringContaining(ERR.notFound) });
  });
});

describe('rich-text mode ("Định dạng tin nhắn")', () => {
  it('leaves Zalo’s rich-text mode (which hides #richInput) with one click on its toggle, then sends', async () => {
    // Live Zalo Web 29/09/2026: in rtf mode the composer container carries --rtf-mode and
    // #richInput is replaced by an editor with a random id; the toggle restores it.
    const z = setup();
    z.input.remove();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="chat-box-input-container --rtf-mode"><div id="x1y2z" class="input-v4" contenteditable="true"></div></div><div data-id="div_RTF_Menu"></div>',
    );
    let toggles = 0;
    document.querySelector('[data-id="div_RTF_Menu"]')!.addEventListener('click', () => {
      toggles++;
      document.querySelector('.chat-box-input-container')!.className = 'chat-box-input-container';
      document.getElementById('x1y2z')!.replaceWith(z.input);
    });
    const r = await sendToThread('222', 'Dạ em chào anh', deps());
    expect(r).toMatchObject({ ok: true, lines: 1 });
    expect(toggles).toBe(1);
    expect(document.querySelector('.--rtf-mode')).toBeNull();
  });

  it('reports the missing composer when it is not rich-text mode', async () => {
    const z = setup();
    z.input.remove();
    const r = await sendToThread('222', 'Dạ em chào anh', deps());
    expect(r).toEqual({ ok: false, error: ERR.noInput, sentLines: 0 });
  });
});
