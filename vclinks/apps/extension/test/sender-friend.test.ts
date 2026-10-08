// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxItem } from '@vclinks/shared';
import { STAMP_ATTR } from '../src/contact-id-stamp';
import { FRIEND_TARGET_BLOCKED } from '@vclinks/shared';
import { FRIEND_ERR, sendFriendCommand } from '../src/sender-friend';
import type { ActionDeps } from '../src/sender-actions';

/**
 * Fake Zalo Web with the "Lời mời kết bạn" page already open (structure of the
 * survey of 04/10/2026) and the sidebar's "Thêm bạn" dialog.
 */
function clock() {
  let t = 1_790_000_000_000;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}
const deps = (): ActionDeps => {
  const c = clock();
  return { doc: document, now: c.now, sleep: c.sleep, findScroller: () => null, friendTargets: ['11', '0912345678'] };
};
const item = (extra: Partial<OutboxItem>): OutboxItem => ({
  id: 'o1',
  uid: '476214826876503713',
  channel: 'zalo',
  threadId: '11',
  text: '[Kết bạn] Hoàng Đạt',
  status: 'sending',
  approvedBy: 'anh',
  approvedAt: '2026-10-04T13:00:00.000Z',
  createdAt: '2026-10-04T13:00:00.000Z',
  ...extra,
});

const card = (id: string, name: string) => `
  <div class="card-wrapper received--friend" ${STAMP_ATTR}="${id}">
    <div class="card-user"><div class="card-name"><span class="name truncate">${name}</span></div></div>
    <div class="card-cta"><div class="z--btn--v2 btn-neutral"><div class="truncate">Từ chối</div></div><div class="z--btn--v2 btn-secondary"><div class="truncate">Đồng ý</div></div></div>
  </div>`;

function page(cards: string) {
  document.body.innerHTML = `<div class="card-list-title"><span>Lời mời đã nhận (2)</span></div><div id="list">${cards}</div>`;
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', { configurable: true, value: () => [{}] });
}

/** Pressing a button of a card removes the card, like Zalo does once the request is answered. */
const listeners: ((e: Event) => void)[] = [];
function answerOnClick(onPress: (button: string, row: HTMLElement) => void) {
  const l = (e: Event) => {
    const b = (e.target as HTMLElement).closest('.card-cta .z--btn--v2');
    const row = b?.closest<HTMLElement>('.card-wrapper');
    if (b && row) onPress(b.textContent!.trim(), row);
  };
  listeners.push(l);
  document.addEventListener('click', l);
}

beforeEach(() => {
  for (const l of listeners.splice(0)) document.removeEventListener('click', l);
  document.body.innerHTML = '';
});

describe('friend_accept / friend_reject', () => {
  const friend = { userId: '11', name: 'Hoàng Đạt' };

  it('presses Đồng ý on the card with the right id and reports success once the card left the list', async () => {
    page(card('11', 'Hoàng Đạt') + card('12', 'Hoàng Đạt'));
    const pressed: string[] = [];
    answerOnClick((b, row) => {
      pressed.push(`${b}:${row.getAttribute(STAMP_ATTR)}`);
      if (b === 'Đồng ý') row.remove();
    });
    const out = await sendFriendCommand(item({ action: 'friend_accept', friend }), deps());
    expect(out.ok).toBe(true);
    expect(pressed).toEqual(['Đồng ý:11']); // the same-named other person is untouched
  });

  it('does not press anything when the name differs from the approved one, or the card is gone', async () => {
    page(card('11', 'Người khác'));
    const pressed: string[] = [];
    answerOnClick((b) => pressed.push(b));
    expect(await sendFriendCommand(item({ action: 'friend_accept', friend }), deps())).toEqual({ ok: false, error: FRIEND_ERR.nameMismatch, sentLines: 0 });
    page(card('99', 'Hoàng Đạt'));
    expect(await sendFriendCommand(item({ action: 'friend_accept', friend }), deps())).toEqual({ ok: false, error: FRIEND_ERR.rowNotFound, sentLines: 0 });
    expect(pressed).toEqual([]);
  });

  it('fails (and does not claim success) when the card is still listed after the press', async () => {
    page(card('11', 'Hoàng Đạt'));
    const out = await sendFriendCommand(item({ action: 'friend_accept', friend }), deps());
    expect(out).toEqual({ ok: false, error: FRIEND_ERR.notDone, sentLines: 0 });
  });

  it('reject: confirms the "are you sure" dialog Zalo may show, then sees the card leave', async () => {
    page(card('11', 'Hoàng Đạt'));
    answerOnClick((b, row) => {
      if (b === 'Từ chối') {
        document.body.insertAdjacentHTML('beforeend', '<div class="zl-modal__dialog"><div class="z--btn--v2" id="no"><div>Hủy</div></div><div class="z--btn--v2" id="yes"><div>Từ chối</div></div></div>');
        document.getElementById('yes')!.addEventListener('click', () => {
          row.remove();
          document.querySelector('.zl-modal__dialog')!.remove();
        });
      }
    });
    expect((await sendFriendCommand(item({ action: 'friend_reject', friend }), deps())).ok).toBe(true);
  });

  it('a dialog after Đồng ý is dismissed (not confirmed); success needs the card to leave the list', async () => {
    page(card('11', 'Hoàng Đạt'));
    const pressed: string[] = [];
    answerOnClick((b, row) => {
      pressed.push(b);
      if (b === 'Đồng ý') {
        document.body.insertAdjacentHTML('beforeend', '<div class="zl-modal__dialog"><div class="modal-header-icon" id="x">x</div><div class="z--btn--v2"><div>Lưu</div></div></div>');
        document.getElementById('x')!.addEventListener('click', () => {
          document.querySelector('.zl-modal__dialog')!.remove();
          row.remove();
        });
      }
    });
    expect((await sendFriendCommand(item({ action: 'friend_accept', friend }), deps())).ok).toBe(true);
    expect(pressed).toEqual(['Đồng ý']);
  });

  it('a dialog after Đồng ý while the card stays is a failure, never a false success', async () => {
    page(card('11', 'Hoàng Đạt'));
    answerOnClick((b) => b === 'Đồng ý' && document.body.insertAdjacentHTML('beforeend', '<div class="zl-modal__dialog"><div class="modal-header-icon">x</div></div>'));
    expect((await sendFriendCommand(item({ action: 'friend_accept', friend }), deps())).ok).toBe(false);
  });
});

describe('friend_request', () => {
  const req = (extra = {}) => item({ action: 'friend_request', threadId: '0912345678', text: '[Mời kết bạn] 0912345678', friend: { phone: '0912345678', ...extra } });
  const profile = (buttons: string[]) =>
    `<div class="pi-info-layout"><div class="pi-primary-action-section">${buttons.map((b, i) => `<div class="z--btn--v2" data-n="${i}"><div>${b}</div></div>`).join('')}</div></div>`;
  /** Presses on the "Có thể bạn quen" buttons: must stay empty, they would send a request to a stranger. */
  let suggestionPresses: string[] = [];

  /**
   * Sidebar "Thêm bạn" → #FIND_FRIEND dialog. It starts with the search form and two suggestions that have
   * their own "Kết bạn" buttons; the search replaces the form with `result` (after `delayMs`, like Zalo's request).
   */
  function setup(result: string, after?: (dialog: HTMLElement) => void, delayMs = 0) {
    suggestionPresses = [];
    document.body.innerHTML = `<div data-id="btn_Main_AddFrd" id="add"></div><div id="root"></div>`;
    Object.defineProperty(HTMLElement.prototype, 'getClientRects', { configurable: true, value: () => [{}] });
    document.getElementById('add')!.addEventListener('click', () => {
      document.getElementById('root')!.innerHTML = `<div class="zl-modal__dialog" id="FIND_FRIEND"><div class="modal-header-icon" id="close"></div>
        <div id="form"><input data-id="txt_Main_AddFrd_Phone" class="phone-i-input">
        <div class="find-friend-suggestion-item"><div>Anh Khanh</div><div class="z--btn--v2 sug"><div class="truncate">Kết bạn</div></div></div>
        <div class="find-friend-suggestion-item"><div>0767737777</div><div class="z--btn--v2 sug"><div class="truncate">Kết bạn</div></div></div></div>
        <div data-id="btn_Main_AddFrd_Search" id="search" class="z--btn--v2"><div>Tìm kiếm</div></div></div>`;
      document.querySelectorAll('.sug').forEach((b) => b.addEventListener('click', () => suggestionPresses.push('Kết bạn')));
      document.getElementById('close')!.addEventListener('click', () => document.getElementById('FIND_FRIEND')?.remove());
      document.getElementById('search')!.addEventListener('click', () => {
        const render = () => {
          const d = document.getElementById('FIND_FRIEND');
          if (!d) return;
          d.querySelector('#form')!.remove();
          d.insertAdjacentHTML('beforeend', result);
          after?.(d);
        };
        // The deferred render uses the fake clock's real timers: keep it short.
        if (delayMs) setTimeout(render, delayMs);
        else render();
      });
    });
  }

  it('types the number, searches, presses the profile\'s Kết bạn and succeeds once the profile offers withdrawing', async () => {
    const typed: string[] = [];
    document.addEventListener('input', (e) => typed.push((e.target as HTMLInputElement).value), { once: true });
    setup(profile(['Kết bạn', 'Nhắn tin']), (d) => {
      d.querySelector('[data-n="0"]')!.addEventListener('click', () => {
        d.querySelector('[data-n="0"] div')!.textContent = 'Thu hồi lời mời';
      });
    });
    expect((await sendFriendCommand(req(), deps())).ok).toBe(true);
    expect(typed).toEqual(['0912345678']);
    expect(suggestionPresses).toEqual([]);
    expect(document.getElementById('FIND_FRIEND')).toBeNull(); // dialog closed again
  });

  it('never presses a suggestion\'s Kết bạn while the result has not arrived (waits, then fails)', async () => {
    setup(profile(['Kết bạn']), undefined, 60_000);
    const c = clock();
    const out = await sendFriendCommand(req(), { doc: document, now: c.now, sleep: c.sleep, findScroller: () => null, friendTargets: ['0912345678'] });
    expect(out).toEqual({ ok: false, error: FRIEND_ERR.noResult, sentLines: 0 });
    expect(suggestionPresses).toEqual([]);
  });

  it('fills the greeting dialog Zalo may open and confirms it', async () => {
    let greeting = '';
    setup(profile(['Kết bạn']), (d) => {
      d.querySelector('[data-n="0"]')!.addEventListener('click', () => {
        document.body.insertAdjacentHTML('beforeend', '<div class="zl-modal__dialog" id="greet"><textarea></textarea><div class="z--btn--v2"><div>Hủy</div></div><div class="z--btn--v2" id="ok"><div>Kết bạn</div></div></div>');
        document.getElementById('ok')!.addEventListener('click', () => {
          greeting = (document.querySelector('#greet textarea') as HTMLTextAreaElement).value;
          document.getElementById('greet')!.remove();
          d.querySelector('[data-n="0"] div')!.textContent = 'Thu hồi lời mời';
        });
      });
    });
    expect((await sendFriendCommand(req({ greeting: 'Chào anh Đạt' }), deps())).ok).toBe(true);
    expect(greeting).toBe('Chào anh Đạt');
    expect(suggestionPresses).toEqual([]);
  });

  it('reports an unregistered number, an existing friend and a missing result', async () => {
    setup('<div>Số điện thoại chưa đăng ký tài khoản hoặc không cho phép tìm kiếm</div>');
    expect(await sendFriendCommand(req(), deps())).toEqual({ ok: false, error: FRIEND_ERR.notFound, sentLines: 0 });
    setup(profile(['Nhắn tin']));
    expect(await sendFriendCommand(req(), deps())).toEqual({ ok: false, error: FRIEND_ERR.alreadyFriend, sentLines: 0 });
    setup('<div>đang tải</div>');
    expect(await sendFriendCommand(req(), deps())).toEqual({ ok: false, error: FRIEND_ERR.noResult, sentLines: 0 });
    expect(suggestionPresses).toEqual([]);
  });

  it('fails without claiming success when the profile still offers Kết bạn afterwards', async () => {
    setup(profile(['Kết bạn']));
    expect(await sendFriendCommand(req(), deps())).toEqual({ ok: false, error: FRIEND_ERR.notConfirmed, sentLines: 0 });
  });

  it('fails when pressing Kết bạn changes nothing recognisable (no positive proof of the sent request)', async () => {
    setup(profile(['Kết bạn']), (d) => {
      d.querySelector('[data-n="0"]')!.addEventListener('click', () => d.querySelector('[data-n="0"]')!.remove());
    });
    expect(await sendFriendCommand(req(), deps())).toEqual({ ok: false, error: FRIEND_ERR.notConfirmed, sentLines: 0 });
  });
});

describe('friend allowlist (second check in the extension)', () => {
  it('presses nothing when the list is missing, empty or does not name this very person', async () => {
    page(card('11', 'Hoàng Đạt'));
    const pressed: string[] = [];
    answerOnClick((b) => pressed.push(b));
    const accept = item({ action: 'friend_accept', friend: { userId: '11', name: 'Hoàng Đạt' } });
    const c = clock();
    const base = { doc: document, now: c.now, sleep: c.sleep, findScroller: () => null };
    for (const friendTargets of [undefined, [], ['12'], ['0912345678']]) {
      expect(await sendFriendCommand(accept, { ...base, friendTargets })).toEqual({ ok: false, error: FRIEND_TARGET_BLOCKED, sentLines: 0 });
    }
    const req = item({ action: 'friend_request', friend: { phone: '0912345678' } });
    expect((await sendFriendCommand(req, { ...base, friendTargets: ['0987654321', '11'] })).ok).toBe(false);
    expect(pressed).toEqual([]);
    expect(document.getElementById('FIND_FRIEND')).toBeNull();
  });
  it('matches phones in any spelling and the * entry', async () => {
    page(card('11', 'Hoàng Đạt'));
    answerOnClick((b, row) => b === 'Đồng ý' && row.remove());
    const c = clock();
    const out = await sendFriendCommand(item({ action: 'friend_accept', friend: { userId: '11', name: 'Hoàng Đạt' } }), { doc: document, now: c.now, sleep: c.sleep, findScroller: () => null, friendTargets: ['*'] });
    expect(out.ok).toBe(true);
  });
});
