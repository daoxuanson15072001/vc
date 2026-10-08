// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxItem } from '@vclinks/shared';
import { ACTION_ERR, reactToMessage, setConversationState, type ActionDeps } from '../src/sender-actions';

/**
 * Reactions and conversation-state commands against a synthetic Zalo Web
 * (structure from the live survey 28/09/2026): the picker appears when the
 * reaction button is hovered; the sidebar "Thêm" menu is a popover of
 * `.zmenu-item` rows whose labels depend on the current state.
 */
const GROUP = 'g6910418193163461340';

function item(extra: Partial<OutboxItem>): OutboxItem {
  return { id: 'o1', uid: '476214826876503713', channel: 'zalo', threadId: GROUP, text: '[Cảm xúc 👍]', status: 'sending', approvedBy: 'anh', approvedAt: '2026-09-28T01:00:00.000Z', createdAt: '2026-09-28T01:00:00.000Z', ...extra };
}

function deps(): ActionDeps {
  let t = 1_790_600_000_000;
  return { doc: document, now: () => (t += 50), sleep: async () => undefined, findScroller: () => null, timing: { pollStepMs: 10 } };
}

function setup(state: { pinned?: boolean; unread?: boolean } = {}) {
  document.body.innerHTML = `
    <div id="sidebar" data-id="div_TabMsg_ThrdChList">
      <div class="msg-item${state.pinned ? ' pinned' : ''}" data-id="div_TabMsg_ThrdChItem" anim-data-id="${GROUP}">
        <div class="conv-item selected"><div class="conv-item-title__name"><div class="truncate">Kiểm thử vclink</div></div>
          <div icon="More_24_Line" class="conv-action__menu-v2" title="Thêm"></div>
          <div class="conv-item-body__action">${state.pinned ? '<div class="conv-action__pin conv__pinned"></div>' : ''}${state.unread ? '<div class="conv-action__unread-v2"></div>' : ''}</div>
        </div>
      </div>
    </div>
    <header id="header">Kiểm thử vclink</header>
    <div id="chat">
      <div id="bb_msg_id_1790608559166" class="chat-message"><div class="message-content-wrapper">
        <div data-id="div_SentMsg_Text">Kiểm chứng</div><div data-id="btn_SentMsg_React"></div>
      </div></div>
      <div id="bb_msg_id_555" class="chat-message"><div class="message-content-wrapper"><div data-id="div_SentMsg_Text">Không có nút</div></div></div>
    </div>
    <div id="richInput" contenteditable="true"></div>`;
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', { configurable: true, value: () => [{}] });

  // Zalo: hovering the reaction button shows the picker; clicking an icon adds the reaction list to the bubble.
  const bubble = document.getElementById('bb_msg_id_1790608559166')!;
  const btn = bubble.querySelector('[data-id="btn_SentMsg_React"]')!;
  btn.addEventListener('mouseover', () => {
    if (document.querySelector('.reaction-emoji-list')) return;
    const list = document.createElement('div');
    list.className = 'reaction-emoji-list';
    for (const code of ['/-strong', '/-heart', ':>', ':o', ':-((', ':-h']) {
      const icon = document.createElement('div');
      icon.className = 'reaction-emoji-icon';
      icon.innerHTML = `<span class="emoji-sizer">${code}</span>`;
      icon.addEventListener('click', () => {
        const rl = document.createElement('div');
        rl.setAttribute('data-id', 'div_SentMsg_ReactList');
        rl.className = 'reacts-list me';
        rl.dataset.code = code;
        bubble.querySelector('.message-content-wrapper')!.append(rl);
        list.remove();
      });
      list.append(icon);
    }
    document.body.append(list);
  });

  // Zalo: the item's "Thêm" button opens a popover whose rows reflect the current state.
  const sidebarItem = document.querySelector<HTMLElement>(`[anim-data-id="${GROUP}"]`)!;
  const more = sidebarItem.querySelector('[icon="More_24_Line"]')!;
  const actions = sidebarItem.querySelector('.conv-item-body__action')!;
  const clicked: string[] = [];
  more.addEventListener('click', () => {
    document.querySelector('.popover-v3')?.remove();
    const pop = document.createElement('div');
    pop.className = 'popover-v3';
    const pinned = !!actions.querySelector('.conv__pinned');
    const unread = !!actions.querySelector('.conv-action__unread-v2');
    for (const label of [pinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại', 'Phân loại', unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc', 'Tắt thông báo', 'Ẩn trò chuyện', 'Xóa hội thoại']) {
      const row = document.createElement('div');
      row.className = 'zmenu-item';
      row.textContent = label;
      row.addEventListener('click', () => {
        clicked.push(label);
        if (label === 'Ghim hội thoại') actions.insertAdjacentHTML('beforeend', '<div class="conv-action__pin conv__pinned"></div>');
        if (label === 'Bỏ ghim hội thoại') actions.querySelector('.conv__pinned')?.remove();
        if (label === 'Đánh dấu chưa đọc') actions.insertAdjacentHTML('beforeend', '<div class="conv-action__unread-v2"></div>');
        if (label === 'Đánh dấu đã đọc') actions.querySelector('.conv-action__unread-v2')?.remove();
        pop.remove();
      });
      pop.append(row);
    }
    document.body.append(pop);
    document.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') pop.remove(); }, { once: true });
  });
  return { bubble, clicked };
}

describe('reactToMessage', () => {
  beforeEach(() => setup());

  it('hovers the button, picks the icon by Zalo code and confirms the reaction list', async () => {
    const { bubble } = setup();
    const r = await reactToMessage(item({ action: 'react', reaction: { cliMsgId: '1790608559166', icon: '0' } }), deps());
    expect(r).toMatchObject({ ok: true, cliMsgId: '1790608559166' });
    expect(bubble.querySelector<HTMLElement>('[data-id="div_SentMsg_ReactList"]')?.dataset.code).toBe('/-heart');
  });

  it('does not trust a reaction list that was already there: the click must change it', async () => {
    const { bubble } = setup();
    // Existing 👍 list; the picker is shown but Zalo ignores the click (no new reaction).
    bubble.querySelector('.message-content-wrapper')!.insertAdjacentHTML('beforeend', '<div data-id="div_SentMsg_ReactList" class="reacts-list me"><span class="react-icon"></span><span class="total-reacts">3</span></div>');
    for (const icon of document.querySelectorAll('.reaction-emoji-icon')) icon.replaceWith(icon.cloneNode(true)); // drop click handlers
    const r = await reactToMessage(item({ action: 'react', reaction: { cliMsgId: '1790608559166', icon: '0' } }), deps());
    expect(r).toEqual({ ok: false, error: ACTION_ERR.reactNotShown, sentLines: 0 });
  });

  it('fails cleanly when the message is not on screen or Zalo shows no picker', async () => {
    expect(await reactToMessage(item({ action: 'react', reaction: { cliMsgId: '404', icon: '3' } }), deps())).toEqual({ ok: false, error: ACTION_ERR.reactTarget, sentLines: 0 });
    expect(await reactToMessage(item({ action: 'react', reaction: { cliMsgId: '555', icon: '3' } }), deps())).toEqual({ ok: false, error: ACTION_ERR.reactPicker, sentLines: 0 });
  });
});

describe('setConversationState', () => {
  it('pins through the item menu and verifies the pin icon; a second pin is a no-op', async () => {
    const { clicked } = setup();
    expect(await setConversationState(item({ action: 'pin_conversation', pin: true, text: '[Ghim hội thoại]' }), deps())).toMatchObject({ ok: true });
    expect(clicked).toEqual(['Ghim hội thoại']);
    expect(await setConversationState(item({ action: 'pin_conversation', pin: true, text: '[Ghim hội thoại]' }), deps())).toMatchObject({ ok: true });
    expect(clicked).toEqual(['Ghim hội thoại']); // menu offered "Bỏ ghim": already pinned
    expect(document.querySelector('.popover-v3')).toBeNull(); // menu closed
    expect(await setConversationState(item({ action: 'pin_conversation', pin: false, text: '[Bỏ ghim hội thoại]' }), deps())).toMatchObject({ ok: true });
    expect(clicked).toEqual(['Ghim hội thoại', 'Bỏ ghim hội thoại']);
  });

  it('marks unread / read', async () => {
    const { clicked } = setup({ unread: false });
    expect(await setConversationState(item({ action: 'mark_unread', text: '[Đánh dấu chưa đọc]' }), deps())).toMatchObject({ ok: true });
    expect(await setConversationState(item({ action: 'mark_read', text: '[Đánh dấu đã đọc]' }), deps())).toMatchObject({ ok: true });
    expect(clicked).toEqual(['Đánh dấu chưa đọc', 'Đánh dấu đã đọc']);
  });

  it('reports when the conversation is not in the sidebar', async () => {
    setup();
    expect(await setConversationState(item({ threadId: 'g404', action: 'mark_read', text: '[Đánh dấu đã đọc]' }), deps())).toEqual({ ok: false, error: ACTION_ERR.convItem, sentLines: 0 });
  });
});
