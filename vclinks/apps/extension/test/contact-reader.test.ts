// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { contactDomItemSchema } from '@vclinks/shared';
import { STAMP_ATTR, STAMP_EVENT, installContactIdStamp, rowUserId, stampContactRows } from '../src/contact-id-stamp';
import {
  collectContactRows,
  extractContactRows,
  readFriendCount,
  readFriendList,
} from '../src/contact-reader';

/** One friend-list row, structure of Zalo Web surveyed 04/10/2026 (texts invented). */
const row = (name: string, opts: { id?: string; label?: string; business?: boolean; avatar?: string } = {}) => `
  <div class="contact-item-v2-wrapper has--border"${opts.id ? ` ${STAMP_ATTR}="${opts.id}"` : ''}>
    <div class="friend-info">
      <div class="rel zavatar-container"><div class="zavatar zavatar-l"><img class="a-child" src="${opts.avatar ?? 'https://s160-ava-talk.zadn.vn/a.jpg'}"></div></div>
      <div class="detail-info">
        <div class="name-wrapper"><span class="name${opts.business ? ' has--tag' : ''}">${name}</span>${
          opts.business ? '<div class="z-business-label">Business</div>' : ''
        }</div>
        ${opts.label ? `<div class="label"><i class="fa fa-solid-tag"></i><div class="description right">${opts.label}</div></div>` : ''}
      </div>
    </div>
    <div class="action"><div icon="ic_them" class="icon__action__more"></div></div>
  </div>`;

const page = (rows: string, count = 3) => `
  <div class="card-list-title">Bạn bè (${count})</div>
  <div class="scroller" style="overflow: scroll">${rows}</div>`;

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

describe('extractContactRows / readFriendCount', () => {
  it('reads name, stamped id, label, business badge and https avatar only', () => {
    const root = mount(
      page(
        row('A Tuấn – Minh Phát', { id: '101', label: 'Khách hàng' }) +
          row('VCparts OA', { id: '202', business: true, avatar: 'blob:https://chat.zalo.me/x' }) +
          row('Chưa có id') +
          row('   '),
      ),
    );
    expect(readFriendCount(root)).toBe(3);
    const rows = extractContactRows(root);
    expect(rows).toEqual([
      { name: 'A Tuấn – Minh Phát', userId: '101', avatar: 'https://s160-ava-talk.zadn.vn/a.jpg', labels: ['Khách hàng'] },
      { name: 'VCparts OA', userId: '202', business: true },
      { name: 'Chưa có id', avatar: 'https://s160-ava-talk.zadn.vn/a.jpg' },
    ]);
    // What the reader sends passes the API's strict schema.
    for (const r of rows) expect(contactDomItemSchema.safeParse(r).success).toBe(true);
  });

  it('returns null when no friend list header is shown', () => {
    expect(readFriendCount(mount('<div class="card-list-title">Nhóm và cộng đồng (3)</div>'))).toBeNull();
  });
});

describe('contact id stamp (MAIN world)', () => {
  const withFiber = (el: Element, itemId: unknown) => {
    const parent = { memoizedProps: { itemId, style: {} }, return: null };
    (el as unknown as Record<string, unknown>)['__reactInternalInstance$abc'] = { memoizedProps: { className: 'x' }, return: parent };
  };

  it('copies the React itemId onto rows and ignores non-numeric ids', () => {
    const root = mount(page(row('A') + row('B') + row('C')));
    const [a, b, c] = root.querySelectorAll('.contact-item-v2-wrapper');
    withFiber(a, '476214826876503713');
    withFiber(b, 'abc');
    expect(rowUserId(a)).toBe('476214826876503713');
    expect(rowUserId(c)).toBeNull();
    expect(stampContactRows(root)).toBe(1);
    expect(a.getAttribute(STAMP_ATTR)).toBe('476214826876503713');
    expect(b.hasAttribute(STAMP_ATTR)).toBe(false);
  });

  it('stamps on the content script event', () => {
    const root = mount(page(row('A')));
    withFiber(root.querySelector('.contact-item-v2-wrapper')!, 99);
    installContactIdStamp(window);
    document.dispatchEvent(new CustomEvent(STAMP_EVENT));
    expect(root.querySelector('.contact-item-v2-wrapper')!.getAttribute(STAMP_ATTR)).toBe('99');
  });
});

/** A virtual list: only the rows of the current viewport are in the DOM. */
function virtualList(total: number, perView = 4) {
  const root = mount(page('', total));
  const scroller = root.querySelector('.scroller')!;
  const rowH = 100;
  let top = 0;
  const render = () => {
    const first = Math.floor(top / rowH);
    scroller.innerHTML = Array.from({ length: Math.min(perView, total - first) }, (_, i) =>
      row(`Bạn ${first + i}`, { id: String(1000 + first + i) }),
    ).join('');
  };
  Object.defineProperty(scroller, 'scrollHeight', { get: () => total * rowH });
  Object.defineProperty(scroller, 'clientHeight', { get: () => perView * rowH });
  Object.defineProperty(scroller, 'scrollTop', {
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, Math.min(v, total * rowH - perView * rowH));
      render();
    },
  });
  render();
  return { root, scroller };
}

describe('collectContactRows', () => {
  const noSleep = async () => undefined;

  it('walks the virtual list viewport by viewport and restores the scroll position', async () => {
    const { root, scroller } = virtualList(23);
    scroller.scrollTop = 500;
    const { items, complete } = await collectContactRows(root, { scroller, sleep: noSleep });
    expect(complete).toBe(true);
    expect(items.map((i) => i.userId).sort()).toEqual(Array.from({ length: 23 }, (_, i) => String(1000 + i)));
    expect(scroller.scrollTop).toBe(500);
  });

  it('stops early when someone uses the tab and reports the walk as partial', async () => {
    const { root, scroller } = virtualList(40);
    let steps = 0;
    const { items, complete } = await collectContactRows(root, { scroller, sleep: noSleep, shouldStop: () => ++steps > 2 });
    expect(complete).toBe(false);
    expect(items.length).toBeLessThan(40);
  });

  it('replaces a row read before its id was stamped', async () => {
    const root = mount(page(row('Lan')));
    let calls = 0;
    const stamp = () => {
      if (++calls > 1) root.querySelector('.contact-item-v2-wrapper')!.setAttribute(STAMP_ATTR, '7');
    };
    const scroller = root.querySelector('.scroller')!;
    Object.defineProperty(scroller, 'scrollHeight', { get: () => 100 });
    Object.defineProperty(scroller, 'clientHeight', { get: () => 100 });
    const { items } = await collectContactRows(root, { scroller, sleep: noSleep, stamp });
    expect(items).toEqual([{ name: 'Lan', userId: '7', avatar: 'https://s160-ava-talk.zadn.vn/a.jpg' }]);
  });
});

describe('readFriendList', () => {
  const noSleep = async () => undefined;

  it('opens Danh bạ → Danh sách bạn bè, reads it and goes back to Tin nhắn', async () => {
    mount(`
      <div class="leftbar-tab" title="Danh bạ"></div>
      <div data-id="div_Main_TabMsg"></div>
      <div id="view"></div>`);
    const clicks: string[] = [];
    document.querySelector('[title="Danh bạ"]')!.addEventListener('click', () => {
      clicks.push('contacts');
      document.getElementById('view')!.innerHTML =
        '<div class="menu-item">Danh sách nhóm và cộng đồng</div><div class="menu-item">Danh sách bạn bè</div>';
    });
    document.querySelector('[data-id="div_Main_TabMsg"]')!.addEventListener('click', () => clicks.push('messages'));
    document.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.classList?.contains('menu-item') && t.textContent === 'Danh sách bạn bè') {
        clicks.push('friends');
        document.getElementById('view')!.insertAdjacentHTML('beforeend', page(row('A', { id: '1' }) + row('B', { id: '2' }), 2));
      }
    });
    const r = await readFriendList({ doc: document, sleep: noSleep });
    expect(r).toMatchObject({ ok: true, friendCount: 2, complete: true });
    expect(r.ok && r.items.map((i) => i.userId)).toEqual(['1', '2']);
    expect(clicks).toEqual(['contacts', 'friends', 'messages']);
  });

  it('reports a clear error when Zalo Web shows no Danh bạ button', async () => {
    mount('<div data-id="div_Main_TabMsg"></div>');
    expect(await readFriendList({ doc: document, sleep: noSleep })).toEqual({
      ok: false,
      error: 'Không thấy nút Danh bạ trên Zalo Web',
    });
  });
});
