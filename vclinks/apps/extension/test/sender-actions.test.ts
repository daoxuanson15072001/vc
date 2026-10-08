// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxItem } from '@vclinks/shared';
import { acceptAllows, installFileHook } from '../src/file-hook';
import { ACTION_ERR, createPoll, sendCard, sendFiles, sendMentions, sendQuote, sendOutboxItem, sendSticker, splitMentions, type ActionDeps } from '../src/sender-actions';

/**
 * Fake Zalo Web: one group in the sidebar (already selected), #richInput with
 * a mention popover driven by "@", and a name-card dialog. Structures follow
 * the live survey of 28/09/2026 (text replaced).
 */
const GROUP = 'g6910418193163461340';
let cli = 5000;

function clock() {
  let t = 1_790_000_000_000;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

function item(extra: Partial<OutboxItem>): OutboxItem {
  return {
    id: 'o1',
    uid: '476214826876503713',
    channel: 'zalo',
    threadId: GROUP,
    text: '',
    status: 'sending',
    approvedBy: 'anh',
    approvedAt: '2026-09-28T13:00:00.000Z',
    createdAt: '2026-09-28T13:00:00.000Z',
    ...extra,
  };
}

function deps(): ActionDeps {
  const c = clock();
  return { doc: document, now: c.now, sleep: c.sleep, findScroller: () => null };
}

function sentBubble(text: string) {
  const b = document.createElement('div');
  b.id = `bb_msg_id_${++cli}`;
  b.innerHTML = `<div data-id="div_SentMsg_Text">${text}</div>`;
  document.getElementById('chat')!.append(b);
}

function setupZalo(members = ['A.A vợ', 'Vcparts Tú']) {
  document.body.innerHTML = `
    <div id="sidebar"><div data-id="div_TabMsg_ThrdChItem" anim-data-id="${GROUP}"><div class="conv-item selected">Kiểm thử vclink</div></div></div>
    <div id="header">Kiểm thử vclink</div>
    <div id="chat"></div>
    <div id="richInput" contenteditable="true"></div>
    <div data-id="div_CT_Menu" title="Gửi danh thiếp"></div>`;
  const input = document.getElementById('richInput')!;
  // happy-dom has no layout: everything counts as visible.
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', { configurable: true, value: () => [{}] });

  // Editor: insertText appends a plain span; picking a mention replaces the typed "@Name" with a chip + space.
  (document as unknown as { execCommand: (c: string, u?: boolean, v?: string) => boolean }).execCommand = (cmd, _u, v) => {
    if (cmd === 'insertText') {
      const span = document.createElement('span');
      span.textContent = v ?? '';
      // Like Zalo: a lone "@" opens the list; "@Name" typed at once does not.
      if (v === '@') {
        span.dataset.at = '1';
        input.append(span);
        showPopover('');
      } else {
        input.append(span);
        // Typing after "@" filters the open list.
        if (document.getElementById('mentionPopover')) showPopover(v ?? '');
      }
    } else if (cmd === 'delete') {
      // Collapsed caret = one Backspace; a selection (select-all) = clear.
      if (document.getSelection()?.isCollapsed) {
        const last = [...input.children].pop();
        if (last?.textContent) last.textContent = last.textContent.slice(0, -1);
      } else input.replaceChildren();
    }
    return true;
  };
  const showPopover = (query: string) => {
    document.getElementById('mentionPopover')?.remove();
    const pop = document.createElement('div');
    pop.id = 'mentionPopover';
    const rows = ['Báo cho cả nhóm', ...members].filter((m) => m.toLowerCase().includes(query.toLowerCase()));
    if (!rows.length) return;
    for (const m of rows) {
      const row = document.createElement('div');
      row.className = 'mention-popover__item';
      row.title = m;
      row.addEventListener('click', () => {
        // The chip replaces "@" and the name typed after it.
        const at = [...input.querySelectorAll('span[data-at]')].pop()!;
        let n = at.nextSibling;
        while (n) {
          const next = n.nextSibling;
          n.remove();
          n = next;
        }
        const typed = at;
        const chip = document.createElement('span');
        chip.className = 'clnMention';
        chip.setAttribute('data-mention', `@${m}`);
        chip.textContent = `@${m}`;
        const space = document.createElement('span');
        space.textContent = ' ';
        typed.replaceWith(chip, space);
        pop.remove();
      });
      pop.append(row);
    }
    document.body.append(pop);
  };
  input.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key !== 'Enter') return;
    const text = input.textContent ?? '';
    input.replaceChildren();
    sentBubble(text);
  });
  return input;
}

describe('acceptAllows (file input accept list)', () => {
  it('matches extensions, wildcards and empty accept', () => {
    const png = { name: 'a.PNG', type: 'image/png' };
    const webp = { name: 'a.webp', type: 'image/webp' };
    expect(acceptAllows('.png, .jpg, .jpeg, .gif, .jxl', [png])).toBe(true);
    expect(acceptAllows('.png, .jpg, .jpeg, .gif, .jxl', [png, webp])).toBe(false);
    expect(acceptAllows('image/*', [webp])).toBe(true);
    expect(acceptAllows('', [{ name: 'bao-gia.pdf', type: 'application/pdf' }])).toBe(true);
  });
});

describe('splitMentions', () => {
  it('splits on @Name for the given names, longest first', () => {
    expect(splitMentions('Chào @A.A vợ và @An nhé', ['An', 'A.A vợ'])).toEqual([
      { text: 'Chào ' },
      { text: '@A.A vợ', mention: 'A.A vợ' },
      { text: ' và ' },
      { text: '@An', mention: 'An' },
      { text: ' nhé' },
    ]);
    expect(splitMentions('email a@An.vn', [])).toEqual([{ text: 'email a@An.vn' }]);
  });
});

describe('sendMentions', () => {
  beforeEach(() => setupZalo());

  it('picks each name from Zalo’s list, checks the chips and text, then sends once', async () => {
    const r = await sendMentions(item({ text: 'Chào @A.A vợ nhé', mentions: [{ name: 'A.A vợ' }] }), deps());
    expect(r).toMatchObject({ ok: true });
    expect(document.querySelector('[id^="bb_msg_id_"]')!.textContent).toBe('Chào @A.A vợ nhé');
  });

  it('removes Zalo’s space after the chip when punctuation follows ("@Name, ...")', async () => {
    const r = await sendMentions(item({ text: 'Chào @A.A vợ, @Vcparts Tú ơi', mentions: [{ name: 'A.A vợ' }, { name: 'Vcparts Tú' }] }), deps());
    expect(r).toMatchObject({ ok: true });
    expect(document.querySelector('[id^="bb_msg_id_"]')!.textContent).toBe('Chào @A.A vợ, @Vcparts Tú ơi');
  });

  it('refuses a name that is not in the group, clears the composer and sends nothing', async () => {
    const r = await sendMentions(item({ text: 'Chào @Người lạ', mentions: [{ name: 'Người lạ' }] }), deps());
    expect(r).toEqual({ ok: false, error: ACTION_ERR.mentionNotFound('Người lạ'), sentLines: 0 });
    expect(document.getElementById('richInput')!.textContent).toBe('');
    expect(document.querySelector('[id^="bb_msg_id_"]')).toBeNull();
  });

  it('never overwrites a draft', async () => {
    document.getElementById('richInput')!.textContent = 'đang gõ dở';
    const r = await sendMentions(item({ text: 'Chào @A.A vợ', mentions: [{ name: 'A.A vợ' }] }), deps());
    expect(r).toMatchObject({ ok: false, error: ACTION_ERR.inputBusy });
  });
});

describe('sendCard', () => {
  function cardDialog(rows: string[]) {
    document.getElementById('richInput')!.insertAdjacentHTML(
      'afterend',
      `<div class="zl-modal">
         <input data-id="txt_CT_Search">
         <div id="list">${rows.map((r) => `<div data-id="div_CT_CTItem"><div class="z-checkbox"></div><div><div class="name">${r}</div><div>0918000000</div></div></div>`).join('')}</div>
         <div class="create-group__selected-section"></div>
         <div data-id="btn_CT_CXL">Hủy</div>
         <div data-id="btn_CT_Share">Gửi danh thiếp</div>
       </div>`,
    );
    const modal = document.querySelector('.zl-modal')!;
    for (const row of modal.querySelectorAll('[data-id="div_CT_CTItem"]')) {
      row.addEventListener('click', () => {
        // Live Zalo: "Gửi kèm số điện thoại" starts checked (--active); clicking the row container toggles it.
        const sec = modal.querySelector('.create-group__selected-section')!;
        sec.innerHTML = `Đã chọn 1/9 ${row.textContent}<div class="create-group__snd-with-num-container"><div class="z-checkbox --active"></div><div>Gửi kèm số điện thoại</div></div>`;
        sec.querySelector('.create-group__snd-with-num-container')!.addEventListener('click', () => sec.querySelector('.z-checkbox')!.classList.toggle('--active'));
      });
    }
    modal.querySelector('[data-id="btn_CT_Share"]')!.addEventListener('click', () => {
      modal.remove();
      sentBubble('Danh thiếp');
    });
    modal.querySelector('[data-id="btn_CT_CXL"]')!.addEventListener('click', () => modal.remove());
  }

  beforeEach(() => {
    setupZalo();
  });

  it('selects exactly the named contact and shares it', async () => {
    document.querySelector('[data-id="div_CT_Menu"]')!.addEventListener('click', () => cardDialog(['9C_Hiệp Lễ', '9C_Lê Anh Vũ']));
    let phoneWhenShared: boolean | undefined;
    document.addEventListener('click', (e) => {
      if ((e.target as Element).closest?.('[data-id="btn_CT_Share"]')) phoneWhenShared = !!document.querySelector('.create-group__snd-with-num-container .--active');
    }, { capture: true, once: false });
    const r = await sendCard(item({ action: 'send_card', card: { name: '9C_Hiệp Lễ' } }), deps());
    expect(r).toMatchObject({ ok: true });
    // Not approved with the phone number: the default-on toggle was switched off first.
    expect(phoneWhenShared).toBe(false);
  });

  it('keeps the phone number when approved with it', async () => {
    document.querySelector('[data-id="div_CT_Menu"]')!.addEventListener('click', () => cardDialog(['9C_Hiệp Lễ']));
    let phoneWhenShared: boolean | undefined;
    document.addEventListener('click', (e) => {
      if ((e.target as Element).closest?.('[data-id="btn_CT_Share"]')) phoneWhenShared = !!document.querySelector('.create-group__snd-with-num-container .--active');
    }, { capture: true });
    const r = await sendCard(item({ action: 'send_card', card: { name: '9C_Hiệp Lễ', withPhone: true } }), deps());
    expect(r).toMatchObject({ ok: true });
    expect(phoneWhenShared).toBe(true);
  });

  it('types the name again when Zalo wipes the search box right after the dialog opens', async () => {
    // Live Zalo (29/09/2026): the first value typed after mount is cleared, and the
    // default list does not contain the contact; only a filtered list does.
    document.querySelector('[data-id="div_CT_Menu"]')!.addEventListener('click', () => {
      cardDialog(['1A11_Hải Nam', '9C_Hiệp Lễ']);
      const box = document.querySelector<HTMLInputElement>('[data-id="txt_CT_Search"]')!;
      let wiped = false;
      box.addEventListener('input', () => {
        if (!wiped) {
          wiped = true;
          queueMicrotask(() => (box.value = '')); // mount effect resets the search
          return;
        }
        if (box.value === 'Vcparts Tú') {
          document.getElementById('list')!.innerHTML = '<div data-id="div_CT_CTItem"><div class="z-checkbox"></div><div><div class="name">Vcparts&nbsp;Tú</div><div>0384000000</div></div></div>';
          const row = document.querySelector('#list [data-id="div_CT_CTItem"]')!;
          row.addEventListener('click', () => {
            const sec = document.querySelector('.create-group__selected-section')!;
            sec.innerHTML = `Đã chọn 1/9 ${row.textContent}<div class="create-group__snd-with-num-container"><div class="z-checkbox --active"></div><div>Gửi kèm số điện thoại</div></div>`;
            sec.querySelector('.create-group__snd-with-num-container')!.addEventListener('click', () => sec.querySelector('.z-checkbox')!.classList.toggle('--active'));
          });
        }
      });
    });
    const r = await sendCard(item({ action: 'send_card', card: { name: 'Vcparts Tú' } }), deps());
    expect(r).toMatchObject({ ok: true });
  });

  it('cancels when the name is ambiguous (two contacts with the same name)', async () => {
    document.querySelector('[data-id="div_CT_Menu"]')!.addEventListener('click', () => cardDialog(['An', 'An']));
    const r = await sendCard(item({ action: 'send_card', card: { name: 'An' } }), deps());
    expect(r).toEqual({ ok: false, error: ACTION_ERR.cardNotFound, sentLines: 0 });
    expect(document.querySelector('.zl-modal')).toBeNull();
    expect(document.querySelector('[id^="bb_msg_id_"]')).toBeNull();
  });
});

describe('sendFiles: file hook missing in the tab', () => {
  const photo = item({ action: 'send_images', attachments: [{ id: 'a'.repeat(64), name: 'x.png', mime: 'image/png', size: 3 }] });
  const media = { fetchMedia: async () => ({ buffer: new Uint8Array([1, 2, 3]).buffer, mime: 'image/png' }) };

  beforeEach(() => {
    setupZalo();
    document.getElementById('richInput')!.insertAdjacentHTML('afterend', '<div icon="Photo_24_Line"></div>');
    // happy-dom leaves MessageEvent.source empty; the hook and the sender both check it.
    window.postMessage = ((data: unknown) =>
      setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data, source: window })), 0)) as typeof window.postMessage;
  });

  it('fails without clicking anything when the hook cannot be injected', async () => {
    let asked = 0;
    let clicked = 0;
    document.querySelector('[icon="Photo_24_Line"]')!.addEventListener('click', () => clicked++);
    const r = await sendFiles(photo, { ...deps(), ...media, win: window, injectFileHook: async () => (asked++, false) });
    expect(r).toEqual({ ok: false, error: ACTION_ERR.hookMissing, sentLines: 0 });
    expect(asked).toBe(1);
    expect(clicked).toBe(0);
  });

  it('asks the background to inject the hook, then arms it', async () => {
    let clicked = 0;
    document.querySelector('[icon="Photo_24_Line"]')!.addEventListener('click', () => clicked++);
    const r = sendFiles(photo, {
      ...deps(),
      ...media,
      win: window,
      injectFileHook: async () => {
        installFileHook(window);
        installFileHook(window); // idempotent
        return true;
      },
    });
    expect(await r).toMatchObject({ ok: false, error: ACTION_ERR.pickerNotOpened });
    expect(clicked).toBe(1);
  }, 10_000);
});

describe('createPoll', () => {
  const poll = item({ action: 'create_poll', poll: { question: 'Chọn màu?', options: ['Đỏ', 'Xanh', 'Vàng'] } });
  let showsPoll = true;

  beforeEach(() => {
    showsPoll = true;
    setupZalo();
    const input = document.getElementById('richInput')!;
    input.insertAdjacentHTML('afterend', '<div data-id="div_More_Menu"></div><div id="menus"></div>');
    // The poll dialog's question is its own contenteditable: type into the focused editor.
    (document as unknown as { execCommand: (c: string, u?: boolean, v?: string) => boolean }).execCommand = (cmd, _u, v) => {
      if (cmd === 'insertText') (document.activeElement as HTMLElement).textContent = v ?? '';
      return true;
    };
    document.querySelector('[data-id="div_More_Menu"]')!.addEventListener('click', () => {
      const entry = document.createElement('div');
      entry.dataset.id = 'div_MoreMenu_Poll';
      entry.addEventListener('click', openDialog);
      document.getElementById('menus')!.replaceChildren(entry);
    });
  });

  function openDialog() {
    const m = document.createElement('div');
    m.className = 'zl-modal';
    m.innerHTML = `<div class="rich-input" contenteditable="true"></div>
      <div id="opts"><input placeholder="Lựa chọn 1"><input placeholder="Lựa chọn 2"></div>
      <div data-id="div_CreatePoll_AddOpt"></div>
      <div data-id="btn_CreatePoll_CXL"></div><div data-id="btn_CreatePoll_Create"></div>`;
    m.querySelector('[data-id="div_CreatePoll_AddOpt"]')!.addEventListener('click', () => {
      const n = m.querySelectorAll('#opts input').length + 1;
      m.querySelector('#opts')!.insertAdjacentHTML('beforeend', `<input placeholder="Lựa chọn ${n}">`);
    });
    m.querySelector('[data-id="btn_CreatePoll_CXL"]')!.addEventListener('click', () => m.remove());
    m.querySelector('[data-id="btn_CreatePoll_Create"]')!.addEventListener('click', () => {
      const q = m.querySelector('.rich-input')!.textContent;
      m.remove();
      if (!showsPoll) return;
      // Live Zalo: a group notice without a bubble id.
      document.getElementById('chat')!.insertAdjacentHTML('beforeend', `<div class="group-poll-message-container"><div class="question__poll">${q}</div></div>`);
    });
    document.body.append(m);
  }

  it('fills the dialog, creates the poll and confirms it by the new poll notice', async () => {
    // An older poll with the same question must not count as the new one.
    document.getElementById('chat')!.insertAdjacentHTML('beforeend', '<div class="group-poll-message-container"><div class="question__poll">Chọn màu?</div></div>');
    const r = await createPoll(poll, deps());
    expect(r).toMatchObject({ ok: true, cliMsgId: null });
    expect(document.querySelectorAll('.group-poll-message-container')).toHaveLength(2);
  });

  it('reports failure when no new poll shows up', async () => {
    showsPoll = false;
    const r = await createPoll(poll, deps());
    expect(r).toEqual({ ok: false, error: ACTION_ERR.notConfirmed('bình chọn'), sentLines: 0 });
  });
});

describe('sendSticker', () => {
  const THUMB = (n: number) => `https://stc-chat.zdn.vn/images/stickers/default/thumb/${n}.png`;
  let clicks: number[];

  /** Fake sticker panel (live structure 29/09/2026): button → popover with a set tab and items; a click on an item sends at once. */
  function stickerPanel(sets: Record<string, number>) {
    document.body.insertAdjacentHTML('beforeend', '<header id="header">Kiểm thử vclink</header><div data-id="div_Sticker_Menu" title="Gửi Sticker"></div>');
    const names = Object.keys(sets);
    const render = (pop: HTMLElement, set: string) => {
      const section = pop.querySelector('[data-id="div_StickerMenu_Recent"]')!;
      section.innerHTML = `<div class="title">${set}</div>${Array.from({ length: sets[set] }, (_, i) => `<div class="card--sticker--container" data-id="div_StickerMenu_RecentItem"><div class="sticker" style="width: 65px; height: 65px; background-image: url(&quot;${THUMB(i + 1)}&quot;);"></div></div>`).join('')}`;
      for (const [i, el] of [...section.querySelectorAll('[data-id="div_StickerMenu_RecentItem"]')].entries()) {
        el.addEventListener('click', () => {
          clicks.push(i + 1);
          pop.remove();
          const b = document.createElement('div');
          b.id = `bb_msg_id_${++cli}`;
          b.innerHTML = `<div data-id="div_SentMsg_Sticker"><img src="https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=${i + 1}&size=130"></div>`;
          document.getElementById('chat')!.append(b);
        });
      }
    };
    document.querySelector('[data-id="div_Sticker_Menu"]')!.addEventListener('click', () => {
      if (document.querySelector('.popover-v3')) return;
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div class="popover-v3"><div data-id="div_StickerMenu_Recent"></div><div data-id="div_StickerMenu_Set">${names.map((n) => `<div title="${n}" data-id="div_StickerMenu_SetItem"></div>`).join('')}</div></div>`,
      );
      const pop = document.querySelector<HTMLElement>('.popover-v3')!;
      // Zalo opens on "recent" (rendered here under the first set's name); the tab click switches sets.
      render(pop, names[0]);
      for (const tab of pop.querySelectorAll<HTMLElement>('[data-id="div_StickerMenu_SetItem"]')) tab.addEventListener('click', () => render(pop, tab.title));
    });
    // A click on the header (outside the panel) closes it, like Zalo Web.
    document.querySelector('header#header')!.addEventListener('click', () => document.querySelector('.popover-v3')?.remove());
  }

  beforeEach(() => {
    setupZalo();
    clicks = [];
  });

  it('switches to the approved set and clicks the item with the approved thumbnail', async () => {
    stickerPanel({ 'Củ hành': 40 });
    const r = await sendSticker(item({ action: 'send_sticker', sticker: { set: 'Củ hành', index: 3, thumbUrl: THUMB(3) } }), deps());
    expect(r).toMatchObject({ ok: true });
    expect(clicks).toEqual([3]);
    expect(document.querySelector('.popover-v3')).toBeNull();
  });

  it('falls back to the position when no thumbnail was approved', async () => {
    stickerPanel({ 'Củ hành': 40 });
    const r = await sendSticker(item({ action: 'send_sticker', sticker: { set: 'Củ hành', index: 40 } }), deps());
    expect(r).toMatchObject({ ok: true });
    expect(clicks).toEqual([40]);
  });

  it('refuses a set Zalo does not list, closes the panel and sends nothing', async () => {
    stickerPanel({ 'Củ hành': 40 });
    const r = await sendSticker(item({ action: 'send_sticker', sticker: { set: 'Mèo mập', index: 1 } }), deps());
    expect(r).toEqual({ ok: false, error: ACTION_ERR.stickerSet('Mèo mập'), sentLines: 0 });
    expect(clicks).toEqual([]);
    expect(document.querySelector('.popover-v3')).toBeNull();
  });

  it('refuses when the thumbnail does not match the item at any position', async () => {
    stickerPanel({ 'Củ hành': 40 });
    const r = await sendSticker(item({ action: 'send_sticker', sticker: { set: 'Củ hành', index: 3, thumbUrl: 'https://stc-chat.zdn.vn/images/stickers/other/thumb/3.png' } }), deps());
    expect(r).toEqual({ ok: false, error: ACTION_ERR.stickerItem, sentLines: 0 });
    expect(clicks).toEqual([]);
    const r2 = await sendSticker(item({ action: 'send_sticker', sticker: { set: 'Củ hành', index: 41 } }), deps());
    expect(r2).toEqual({ ok: false, error: ACTION_ERR.stickerItem, sentLines: 0 });
  });
});

describe('send_quote (M1c-02): the quote file, then the words', () => {
  const quote = (form: 'pdf' | 'image', message: string) =>
    item({
      action: 'send_quote',
      text: '[Báo giá] BG-2026-0915',
      attachments: [{ id: 'b'.repeat(64), name: form === 'pdf' ? 'BG-2026-0915.pdf' : 'BG-2026-0915-trang-1.png', mime: form === 'pdf' ? 'application/pdf' : 'image/png', size: 4 }],
      quote: { no: 'BG-2026-0915', form, message, total: 8_450_000, customerCode: 'KH-TEST-0101' },
    });
  const media = { fetchMedia: async () => ({ buffer: new Uint8Array([1, 2, 3, 4]).buffer, mime: 'application/pdf' }) };
  let fileClicks = 0;

  /** Fake Zalo: the attach button → "Chọn File" → a hooked file input; choosing a file posts a file bubble at once. */
  beforeEach(() => {
    fileClicks = 0;
    setupZalo();
    const input = document.getElementById('richInput')!;
    input.insertAdjacentHTML('afterend', '<div icon="Attach_24_Line"></div><div icon="Photo_24_Line"></div>');
    window.postMessage = ((data: unknown) =>
      setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data, source: window })), 0)) as typeof window.postMessage;
    const fileBubble = (name: string, photo: boolean) => {
      const b = document.createElement('div');
      b.id = `bb_msg_id_${++cli}`;
      b.innerHTML = photo
        ? '<div data-id="div_SentMsg_Photo"><img class="zimg-el" src="x"/></div>'
        : `<div data-id="div_SentMsg_Fo"><div class="file-message__container">${name}</div></div>`;
      document.getElementById('chat')!.append(b);
    };
    const pick = (accept: string, photo: boolean) => {
      const f = document.createElement('input');
      f.type = 'file';
      f.accept = accept;
      document.body.append(f);
      f.addEventListener('change', () => {
        fileClicks++;
        for (const file of Array.from(f.files ?? [])) fileBubble(file.name, photo);
      });
      f.click();
    };
    document.querySelector('[icon="Attach_24_Line"]')!.addEventListener('click', () => {
      const sel = document.createElement('div');
      sel.dataset.id = 'div_CX_Select';
      sel.addEventListener('click', () => pick('', false));
      document.body.append(sel);
    });
    document.querySelector('[icon="Photo_24_Line"]')!.addEventListener('click', () => pick('.png,.jpg,.jpeg,.gif', true));
  });

  const run = (it: OutboxItem) =>
    sendOutboxItem(it, { ...deps(), ...media, win: window, injectFileHook: async () => (installFileHook(window), true) });

  it('PDF: the file bubble is confirmed by its name, then the words go as a normal message', async () => {
    const r = await run(quote('pdf', 'Dạ em gửi báo giá BG-2026-0915 ạ'));
    expect(r).toMatchObject({ ok: true });
    expect(fileClicks).toBe(1);
    const bubbles = [...document.querySelectorAll('[id^="bb_msg_id_"]')];
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]!.textContent).toContain('BG-2026-0915.pdf');
    expect(bubbles[1]!.textContent).toBe('Dạ em gửi báo giá BG-2026-0915 ạ');
    if (r.ok) expect(r.cliMsgIds?.length).toBe(2);
  }, 15_000);

  it('image: goes through the photo button, then the words', async () => {
    const r = await run(quote('image', 'Báo giá dạng ảnh'));
    expect(r).toMatchObject({ ok: true });
    const bubbles = [...document.querySelectorAll('[id^="bb_msg_id_"]')];
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]!.querySelector('img.zimg-el')).not.toBeNull();
    expect(bubbles[1]!.textContent).toBe('Báo giá dạng ảnh');
  }, 15_000);

  it('no words: only the file is sent', async () => {
    const r = await run(quote('pdf', ''));
    expect(r).toMatchObject({ ok: true });
    expect(document.querySelectorAll('[id^="bb_msg_id_"]')).toHaveLength(1);
  }, 15_000);

  it('the file fails (cannot be downloaded): nothing is typed, the words are never sent alone', async () => {
    const r = await sendQuote(quote('pdf', 'Dạ em gửi báo giá ạ'), { ...deps(), fetchMedia: async () => Promise.reject(new Error('không tải được tệp')), win: window });
    expect(r).toEqual({ ok: false, error: 'không tải được tệp', sentLines: 0 });
    expect(document.getElementById('richInput')!.textContent).toBe('');
    expect(document.querySelector('[id^="bb_msg_id_"]')).toBeNull();
  });

  it('a command without its quote block is refused', async () => {
    const r = await sendQuote({ ...quote('pdf', 'x'), quote: undefined }, deps());
    expect(r).toMatchObject({ ok: false });
  });
});
