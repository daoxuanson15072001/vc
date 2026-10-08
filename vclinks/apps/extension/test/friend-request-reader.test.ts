// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { friendRequestDomItemSchema } from '@vclinks/shared';
import { STAMP_ATTR, STAMP_EVENT, installContactIdStamp, requestRowUserId, stampRequestRows } from '../src/contact-id-stamp';
import { extractRequestRows, openFriendRequestsPage, readFriendRequests, readRequestCount } from '../src/friend-request-reader';

/** Structure of Danh bạ → Lời mời kết bạn surveyed 04/10/2026 (names and texts invented). */
const received = (id: string | null, name: string, extra = 'Từ số điện thoại', msg = `Xin chào, mình là ${name}. Kết bạn với mình nhé!`) => `
  <div class="card-wrapper received--friend"${id ? ` ${STAMP_ATTR}="${id}"` : ''}>
    <div class="card-user"><div class="rel zavatar-container"><div class="zavatar"><img class="a-child" src="https://s160-ava-talk.zadn.vn/a.jpg"></div></div>
      <div class="card-name"><span class="name truncate">${name}</span><div class="flx"><span class="extra truncate"><span>03/08 </span> - <span>${extra}</span></span></div></div></div>
    <div class="card-message"><div><div><div class="card-message__content">${msg}</div></div></div></div>
    <div class="card-cta"><div class="z--btn--v2 btn-neutral"><div class="truncate">Từ chối</div></div><div class="z--btn--v2 btn-secondary"><div class="truncate">Đồng ý</div></div></div>
  </div>`;
const sent = (id: string, name: string) => `
  <div class="card-wrapper sent--friend" ${STAMP_ATTR}="${id}">
    <div class="card-user"><div class="zavatar"><img class="a-child" src="blob:https://chat.zalo.me/x"></div>
      <div class="card-name"><span class="name truncate">${name}</span><div class="flx"><span class="extra truncate"><span>Bạn đã gửi lời mời</span></span></div></div></div>
    <div class="card-cta"><div class="z--btn--v2 btn-neutral"><div class="truncate">Thu hồi lời mời</div></div></div>
  </div>`;

const page = (rec: string, snt: string, counts = [2, 2]) => `
  <div class="card-list-title"><span>Lời mời đã nhận (${counts[0]})</span></div><div class="card-invitation-list">${rec}</div>
  <div class="card-list-title"><span>Lời mời đã gửi (${counts[1]})</span></div><div class="card-invitation-list">${snt}</div>
  <div class="card-list-title"><span>Gợi ý kết bạn (65)</span></div>`;

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', { configurable: true, value: () => [{}] });
});

describe('extractRequestRows / readRequestCount', () => {
  it('reads received and sent rows, drops rows without a stamped id, and passes the API schema', () => {
    const root = mount(page(received('11', 'Hoàng Đạt') + received(null, 'Chưa có id'), sent('21', 'Gara Quang Huy') + sent('22', 'Mai Tâm')));
    expect(readRequestCount(root, 'received')).toBe(2);
    expect(readRequestCount(root, 'sent')).toBe(2);
    const rows = extractRequestRows(root);
    expect(rows.received).toEqual([
      {
        userId: '11',
        name: 'Hoàng Đạt',
        avatar: "https://s160-ava-talk.zadn.vn/a.jpg",
        dateText: '03/08',
        source: 'Từ số điện thoại',
        message: 'Xin chào, mình là Hoàng Đạt. Kết bạn với mình nhé!',
      },
    ]);
    // Sent rows carry no greeting and no non-https avatar.
    expect(rows.sent).toEqual([{ userId: '21', name: 'Gara Quang Huy' }, { userId: '22', name: 'Mai Tâm' }]);
    for (const r of [...rows.received, ...rows.sent]) expect(friendRequestDomItemSchema.safeParse(r).success).toBe(true);
  });

  it('returns null counts when the page is not shown', () => {
    const root = mount('<div class="card-list-title">Bạn bè (3)</div>');
    expect(readRequestCount(root, 'received')).toBeNull();
  });
});

describe('readFriendRequests', () => {
  const sleep = async () => undefined;

  it('reads an already open page, expands "Xem thêm", reports completeness and never presses a request button', async () => {
    mount(page(received('11', 'Hoàng Đạt') + received('12', 'Hương'), sent('21', 'A') + `<div class="z--btn--v2 view-more__btn"><div class="truncate">Xem thêm</div></div>`, [2, 2]));
    const pressed: string[] = [];
    document.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('.card-cta .z--btn--v2, .view-more__btn');
      if (t) pressed.push(t.textContent!.trim());
      // "Xem thêm" renders the rest of the sent list.
      if (t?.classList.contains('view-more__btn')) {
        t.remove();
        document.querySelectorAll('.card-invitation-list')[1].insertAdjacentHTML('beforeend', sent('22', 'B'));
      }
    });
    const r = await readFriendRequests({ doc: document, sleep });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.received).toMatchObject({ count: 2, complete: true });
    expect(r.received.items.map((i) => i.name)).toEqual(['Hoàng Đạt', 'Hương']);
    expect(r.sent).toMatchObject({ count: 2, complete: true });
    expect(r.sent.items.map((i) => i.userId)).toEqual(['21', '22']);
    expect(pressed).toEqual(['Xem thêm']); // never Đồng ý / Từ chối / Thu hồi
  });

  it('a list shorter than its header count is not complete (the API then never marks the rest as gone)', async () => {
    mount(page(received('11', 'Hoàng Đạt'), sent('21', 'A'), [4, 71]));
    const r = await readFriendRequests({ doc: document, sleep });
    expect(r.ok && [r.received.complete, r.sent.complete]).toEqual([false, false]);
  });

  it('opens Danh bạ → Lời mời kết bạn when another page is shown, and gives the Tin nhắn tab back', async () => {
    document.body.innerHTML = `<div data-translate-title="STR_TAB_CONTACT" title="Danh bạ" id="tab"></div><div data-id="div_Main_TabMsg" id="msg"></div><div id="menu"></div>`;
    const calls: string[] = [];
    document.getElementById('tab')!.addEventListener('click', () => {
      calls.push('contacts');
      document.getElementById('menu')!.innerHTML = '<div class="menu-item"><span>Danh sách bạn bè</span></div><div class="menu-item"><span>Lời mời vào nhóm và cộng đồng</span></div><div class="menu-item"><span>Lời mời kết bạn</span></div>';
      document.querySelectorAll('.menu-item').forEach((m) => m.addEventListener('click', () => {
        if (m.textContent === 'Lời mời kết bạn') {
          calls.push('requests');
          document.body.insertAdjacentHTML('beforeend', page(received('11', 'Hoàng Đạt'), sent('21', 'A'), [1, 1]));
        }
      }));
    });
    document.getElementById('msg')!.addEventListener('click', () => calls.push('messages'));
    const r = await readFriendRequests({ doc: document, sleep });
    expect(r.ok).toBe(true);
    expect(calls).toEqual(['contacts', 'requests', 'messages']);
  });

  it('reports a Vietnamese error when the Danh bạ button is missing', async () => {
    mount('<div>không có gì</div>');
    expect(await openFriendRequestsPage({ doc: document, sleep })).toEqual({ ok: false, error: 'Không thấy nút Danh bạ trên Zalo Web' });
  });
});

describe('request row id stamp (React fiber of Zalo Web, survey 04/10/2026)', () => {
  /** Old React 16: `__reactInternalInstance$…`; the list item (level 1) holds `data`. */
  const withData = (el: Element, data: unknown) => {
    (el as unknown as Record<string, unknown>)['__reactInternalInstance$x'] = { memoizedProps: { className: 'card-wrapper' }, return: { memoizedProps: { data } } };
  };
  it('reads data.dataInfo.userId (received) and data.userId (sent), numbers only', () => {
    const root = mount(page(received(null, 'A') + received(null, 'B'), sent('0', 'C').replace(` ${STAMP_ATTR}="0"`, '')));
    const [a, b] = root.querySelectorAll('.card-wrapper.received--friend');
    const [c] = root.querySelectorAll('.card-wrapper.sent--friend');
    withData(a, { dataInfo: { userId: '4762148268765037131' } });
    withData(b, { dataInfo: { userId: 'abc' } });
    withData(c, { userId: 777 });
    expect(requestRowUserId(a)).toBe('4762148268765037131');
    expect(requestRowUserId(b)).toBeNull();
    expect(stampRequestRows(root)).toBe(2);
    expect(c.getAttribute(STAMP_ATTR)).toBe('777');
    expect(b.hasAttribute(STAMP_ATTR)).toBe(false);
  });
  it('stamps on the content script event, together with the friend list rows', () => {
    const root = mount(page(received(null, 'A'), ''));
    withData(root.querySelector('.card-wrapper')!, { dataInfo: { userId: '55' } });
    installContactIdStamp(window);
    document.dispatchEvent(new CustomEvent(STAMP_EVENT));
    expect(root.querySelector('.card-wrapper')!.getAttribute(STAMP_ATTR)).toBe('55');
  });
});
