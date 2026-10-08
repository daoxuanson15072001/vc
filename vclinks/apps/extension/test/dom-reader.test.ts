// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { DEFAULT_DOM_SELECTORS } from '@vclinks/shared';
import {
  hasUnreadMark,
  DOM_SCHEMA_VERSION,
  checkDomHealth,
  collectSidebarNames,
  extractMessages,
  extractThreadNames,
  readActiveThreadId,
  filterNew,
  toContentItems,
} from '../src/dom-reader';

/** Builds a chat-frame DOM close to Zalo Web's structure (survey 2026-09-28). */
function chat(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

const received = (cli: string, text: string) => `
  <div id="bb_msg_id_${cli}" class="chat-message">
    <div id="message-frame_${cli}">
      <div data-id="div_ReceivedMsg_Text">${text}</div>
    </div>
  </div>`;

const sent = (cli: string, text: string) => `
  <div id="bb_msg_id_${cli}" class="chat-message">
    <div data-id="div_SentMsg_Text">${text}</div>
  </div>`;

describe('extractMessages', () => {
  it('reads text and direction from rendered bubbles', () => {
    const root = chat(received('111', 'Chào anh, báo giá lọc gió') + sent('112', 'Ok em gửi ngay'));
    const msgs = extractMessages(root);
    expect(msgs).toEqual([
      { cliMsgId: '111', direction: 'in', text: 'Chào anh, báo giá lọc gió', images: [], links: [], files: [], voice: null, video: null, card: null, kind: 'text', structure: 'known:text' },
      { cliMsgId: '112', direction: 'out', text: 'Ok em gửi ngay', images: [], links: [], files: [], voice: null, video: null, card: null, kind: 'text', structure: 'known:text' },
    ]);
  });

  it('reads a sent file bubble as outgoing (only its reaction button says "Sent")', () => {
    const file = (cli: string, react: string) => `
      <div id="bb_msg_id_${cli}" class="chat-message me">
        <div class="file-message__container"><div>bao-gia.pdf</div></div>
        <div data-id="${react}"><i class="iconlike"></i></div>
      </div>`;
    const msgs = extractMessages(chat(file('301', 'btn_SentMsg_React') + file('302', 'btn_LastSentMsg_React') + file('303', 'btn_ReceivedMsg_React')));
    expect(msgs.map((m) => [m.cliMsgId, m.direction])).toEqual([
      ['301', 'out'],
      ['302', 'out'],
      ['303', 'in'],
    ]);
  });

  it('collects real images and links but skips avatar/emoji/sticker', () => {
    const root = chat(`
      <div id="bb_msg_id_200" class="chat-message">
        <div data-id="div_ReceivedMsg_Text">Xem ảnh này</div>
        <img src="https://zalo.me/avatar/u1.jpg" />
        <img src="https://f.zalo.me/photo/real-photo.jpg" />
        <img src="https://stc.zalo.me/emoji/smile.png" />
        <a href="https://vcparts.vn/oe/12345">link phụ tùng</a>
        <a href="/relative/skip">bỏ qua</a>
      </div>`);
    const [m] = extractMessages(root);
    expect(m.images).toEqual(['https://f.zalo.me/photo/real-photo.jpg']);
    expect(m.links).toEqual(['https://vcparts.vn/oe/12345']);
  });

  it('ignores non-bubble elements', () => {
    const root = chat('<div id="other">x</div><div id="bb_msg_id_">empty</div>');
    expect(extractMessages(root)).toEqual([]);
  });
});

describe('sender names (real structure, 2026-09-28)', () => {
  const recv = (cli: string, name: string | null, text: string, quote = '') => `
    <div id="bb_msg_id_${cli}" class="chat-message">
      ${name ? `<div class="message-sender-name-wrapper"><div class="message-sender-name-content clickable">${name}</div></div>` : ''}
      ${quote ? `<div class="quote-banner"><div class="message-sender-name-content">${quote}</div></div>` : ''}
      <div data-id="div_ReceivedMsg_Text"><span>${text}</span></div>
    </div>`;
  const sent = (cli: string, text: string) => `
    <div id="bb_msg_id_${cli}" class="chat-message"><div data-id="div_SentMsg_Text"><span>${text}</span></div></div>`;

  it('reads the name on the first bubble of a run and carries it to the next ones, never across own messages', () => {
    const root = chat(
      recv('1', 'VCpart An', 'a') + recv('2', null, 'b') + sent('3', 'c') + recv('4', null, 'd') + recv('5', 'Hữu', 'e', 'VCpart An'),
    );
    const ms = extractMessages(root, DEFAULT_DOM_SELECTORS);
    expect(ms.map((m) => m.senderName ?? null)).toEqual(['VCpart An', 'VCpart An', null, null, 'Hữu']);
  });

  it('adds sender names to content items (both /ingest/message-content and /ingest/dom-messages accept them)', () => {
    const ms = extractMessages(chat(recv('1', 'VCpart An', 'a')), DEFAULT_DOM_SELECTORS);
    expect(toContentItems(ms, 1)[0].senderName).toBe('VCpart An');
  });
});

describe('bubble ids', () => {
  it('takes the cliMsgId from an album id `<cliMsgId>_<fromUid>_<threadId>`', () => {
    const root = chat(`
      <div id="bb_msg_id_1790594547183_2817553855005566243_g4469801440488432189" class="chat-message">
        <div data-id="div_ReceivedMsg_GrpPhoto" class="card--group-photo"><img class="zimg-el" src="https://cdn.example/a.jpg"></div>
      </div>`);
    const [m] = extractMessages(root, DEFAULT_DOM_SELECTORS);
    expect(m.cliMsgId).toBe('1790594547183');
    expect(m.images).toEqual(['https://cdn.example/a.jpg']);
  });
});

describe('toContentItems', () => {
  it('keeps only bubbles with content and stamps schema + capturedAt', () => {
    const msgs = [
      { cliMsgId: '1', direction: 'in' as const, text: 'có nội dung', images: [], links: [] },
      { cliMsgId: '2', direction: 'out' as const, text: null, images: [], links: [] }, // empty (e.g. sticker)
      { cliMsgId: '3', direction: 'in' as const, text: null, images: ['https://f.zalo.me/a.jpg'], links: [] },
    ];
    const items = toContentItems(msgs, 1790000000000);
    expect(items.map((i) => i.cliMsgId)).toEqual(['1', '3']);
    expect(items[0]).toEqual({
      cliMsgId: '1',
      direction: 'in',
      text: 'có nội dung',
      capturedAt: 1790000000000,
      schemaVersion: DOM_SCHEMA_VERSION,
    });
    expect(items[1].images).toEqual(['https://f.zalo.me/a.jpg']);
    expect(items[1].text).toBeUndefined();
  });
});

describe('extractThreadNames', () => {
  function sidebar(html: string): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  }

  it('reads threadId (anim-data-id) and name, flags groups by the g prefix', () => {
    const root = sidebar(`
      <div data-id="div_TabMsg_ThrdChItem" anim-data-id="123456789">
        <div data-id="div_ThrdChItem_Title">Anh Minh Gara</div>
        <div>tin nhắn xem trước… 14:42</div>
      </div>
      <div data-id="div_TabMsg_ThrdChItem" anim-data-id="g987654321">
        <div data-id="div_ThrdChItem_Title">Nhóm phụ tùng VC</div>
      </div>`);
    expect(extractThreadNames(root)).toEqual([
      { threadId: '123456789', name: 'Anh Minh Gara', isGroup: false },
      { threadId: 'g987654321', name: 'Nhóm phụ tùng VC', isGroup: true },
    ]);
  });

  it('falls back to the first line and strips a trailing time when no title element', () => {
    const root = sidebar(`
      <div anim-data-id="555">
        Chị Lan Kho    16:05
        xem trước tin nhắn cuối
      </div>`);
    expect(extractThreadNames(root)).toEqual([{ threadId: '555', name: 'Chị Lan Kho', isGroup: false }]);
  });

  it('de-duplicates by threadId and skips items without a name', () => {
    const root = sidebar(`
      <div anim-data-id="1"><div data-id="div_ThrdChItem_Title">A</div></div>
      <div anim-data-id="1"><div data-id="div_ThrdChItem_Title">A again</div></div>
      <div anim-data-id="2"></div>`);
    expect(extractThreadNames(root)).toEqual([{ threadId: '1', name: 'A', isGroup: false }]);
  });
});

describe('filterNew', () => {
  it('keeps only messages whose cliMsgId is not already seen', () => {
    const msgs = [
      { cliMsgId: 'a', direction: 'in' as const, text: 'x', images: [], links: [] },
      { cliMsgId: 'b', direction: 'in' as const, text: 'y', images: [], links: [] },
    ];
    expect(filterNew(msgs, new Set(['a'])).map((m) => m.cliMsgId)).toEqual(['b']);
  });
});

describe('selectors from the mapping', () => {
  it('reads a changed Zalo UI once new selectors are supplied, without code changes', () => {
    const root = chat(`
      <div id="msg_777" class="m">
        <p data-role="body">Còn hàng không em?</p>
        <span data-role="mine"></span>
      </div>`);
    // Default selectors no longer match the new structure…
    expect(extractMessages(root)).toEqual([]);
    // …the approved mapping fixes it.
    const sel = { ...DEFAULT_DOM_SELECTORS, bubbleIdPrefix: 'msg_', text: '[data-role="body"]', sentMarker: '[data-role="mine"]' };
    expect(extractMessages(root, sel)).toEqual([
      { cliMsgId: '777', direction: 'out', text: 'Còn hàng không em?', images: [], links: [], files: [], voice: null, video: null, card: null, kind: 'text', structure: 'known:text' },
    ]);
  });

  it('uses the mapping for sidebar items and the group prefix', () => {
    const root = chat(`<div data-thread="grp_1"><b data-t="n">Nhóm kho</b></div>`);
    const sel = { ...DEFAULT_DOM_SELECTORS, threadIdAttr: 'data-thread', threadTitle: '[data-t="n"]', groupIdPrefix: 'grp_' };
    expect(extractThreadNames(root, sel)).toEqual([{ threadId: 'grp_1', name: 'Nhóm kho', isGroup: true }]);
  });
});

describe('checkDomHealth', () => {
  const sidebarItem = '<div anim-data-id="1"><div data-id="div_ThrdChItem_Title">A</div></div>';

  it('reports nothing when the DOM matches', () => {
    const root = chat(sidebarItem + received('1', 'x') + sent('2', 'y'));
    expect(checkDomHealth(root).broken).toEqual([]);
    expect(checkDomHealth(root).observedKeys).toEqual([]);
  });

  it('flags the text selector when many bubbles have no readable content', () => {
    const bubbles = [1, 2, 3, 4, 5]
      .map((i) => `<div id="bb_msg_id_${i}"><div data-id="div_RecvMsg_Body_v2">bí mật ${i}</div></div>`)
      .join('');
    const h = checkDomHealth(chat(sidebarItem + bubbles));
    expect(h.broken).toEqual(['text']);
    expect(h.observedKeys).toContain('data-id=div_RecvMsg_Body_v2');
    // Structural hints only, never message text.
    expect(h.observedKeys.join(' ')).not.toContain('bí mật');
  });

  it('flags the sidebar attribute when no conversation item is found', () => {
    const h = checkDomHealth(chat('<div id="conv_1234567890">A</div>'));
    expect(h.broken).toEqual(['threadIdAttr']);
    expect(h.observedKeys).toContain('id^=conv_');
  });

  it('does not treat "no conversation open" as drift', () => {
    expect(checkDomHealth(chat(sidebarItem)).broken).toEqual([]);
  });
});

// SYNTHETIC fixtures: plausible Zalo Web sidebar structures written by hand
// until real sidebar HTML is captured (docs/04-ky-thuat/zalo-web/zalo-web-extraction.md). Replace
// with the real dump once available.
describe('sidebar item as rendered by Zalo Web on 28/09/2026 (real structure, names replaced)', () => {
  const item = `
    <div class="msg-item  pinned" data-id="div_TabMsg_ThrdChItem" anim-data-id="g826086630741042764" style="height: 78px;">
      <div class="gridv2 conv-item conv-rel pinned lv-2 fluid tiny grid-fluid-8">
        <div class="flx flx-center conv-item__avatar grd-ava lv-2 grid-item"><div class="rel zavatar-container conversationList__avatar"><div class="zavatar zavatar-l zavatar-single"><img alt="" src="https://ava-grp-talk.zadn.vn/x/y.jpg" class="a-child"></div></div></div>
        <div class="conv-status grid-item"></div>
        <div-16 class="conv-item-title__name truncate grid-item"><div class="truncate">3.VCPARTS KHO KIM ĐỒNG</div></div-16>
        <div class="conv-item-title__more rel grid-item"><div class="flx flx-al-c"><div class="flx flx-center"><span class="preview-time"><span>2 <span data-translate-inner="STR_HOURS">giờ</span></span></span></div></div>
          <div id="conv-title-action" class="flx flx-al-c absolute"><div icon="More_24_Line" class="z--btn--v2 conv-action__menu-v2" title="Thêm"><i class="fa fa-More_24_Line pre"></i></div></div></div>
        <div class="conv-item-body flx flx-al-c truncate grid-item"><div class="conv-item-body__main truncate flx flx-al-c w100">
          <div class="conv__label" title="HEAD" style="color: rgb(217, 27, 27);"><i class="fa fa-icon-solid-label-filled"></i></div>
          <div class="z-conv-message --unread"><div class="z-conv-message__preview-message"><span class="z-conv-message__preview-sender-name">Minh&nbsp;</span><div class="inline"><span class="inline">hàng về chưa</span></div></div></div>
        </div></div>
        <div class="conv-item-body__action hasOption grid-item"><div class="conv-action__pin conv__pinned"><i class="fa fa-Pin_24_Filled undefined"></i></div></div>
      </div>
    </div>`;

  it('reads the name, the label chip (title + colour) and the group flag; never the preview text', () => {
    const root = document.createElement('div');
    root.innerHTML = item;
    const [t] = extractThreadNames(root);
    expect(t).toMatchObject({ threadId: 'g826086630741042764', name: '3.VCPARTS KHO KIM ĐỒNG', isGroup: true, label: { name: 'HEAD', color: 'rgb(217, 27, 27)' } });
    expect(t.avatar).toBe('https://ava-grp-talk.zadn.vn/x/y.jpg');
    expect(JSON.stringify(t)).not.toContain('hàng về chưa');
  });
});

describe('sidebar hardening (synthetic fixtures)', () => {
  function sb(html: string): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  }

  it('A: dedicated title node + time + badge + avatar + label chip', () => {
    const root = sb(`
      <div data-id="div_TabMsg_ThrdChItem" anim-data-id="123">
        <div class="avatar"><img src="https://s120-ava-talk.zadn.vn/a/b.jpg"></div>
        <div class="conv-item-body">
          <div class="conv-item-title">
            <div data-id="div_ThrdChItem_DisplayName" class="truncate">Anh Minh Gara</div>
            <div class="time">5 phút</div>
          </div>
          <div class="preview"><span class="label-chip">Khách hàng</span><span>Bạn: báo giá lọc gió nhé</span></div>
          <div class="unread-badge">5+</div>
        </div>
      </div>`);
    expect(extractThreadNames(root)).toEqual([
      {
        threadId: '123',
        name: 'Anh Minh Gara',
        isGroup: false,
        avatar: 'https://s120-ava-talk.zadn.vn/a/b.jpg',
        unread: 5,
        labels: ['Khách hàng'],
      },
    ]);
  });

  it('B: no name node — first line wins, time tails and badges stripped', () => {
    const cases: [string, string][] = [
      ['<div>Chị Lan Kho</div><div>Hôm qua</div>', 'Chị Lan Kho'],
      ['<div>Nhóm phụ tùng VC 12/09</div><div>[Hình ảnh]</div>', 'Nhóm phụ tùng VC'],
      ['<div>Kho Hà Nội 2 giờ</div><div>ok anh</div>', 'Kho Hà Nội'],
      ['<div>Đại lý Tuấn vừa xong</div>', 'Đại lý Tuấn'],
      ['<div>Anh Hùng 14:05 99+</div>', 'Anh Hùng'],
      ['<div>Sếp Tâm 3 ngày</div>', 'Sếp Tâm'],
    ];
    for (const [inner, expected] of cases) {
      const root = sb(`<div anim-data-id="g1">${inner}</div>`);
      expect(extractThreadNames(root)[0]?.name).toBe(expected);
    }
  });

  it('C: never returns a preview/time/badge line as the name', () => {
    const root = sb(`
      <div anim-data-id="1"><div>Bạn: đã gửi</div><div>Anh Long</div></div>
      <div anim-data-id="2"><div>[Hình ảnh]</div></div>
      <div anim-data-id="3"><div>14:05</div><div>99+</div></div>`);
    expect(extractThreadNames(root)).toEqual([{ threadId: '1', name: 'Anh Long', isGroup: false }]);
  });

  it('D: label chip before the name is not taken as the name', () => {
    const root = sb(`
      <div anim-data-id="7">
        <div data-id="div_ThrdChItem_Label">HEAD</div>
        <div><span>Chủ xưởng </span><b>Bình</b></div>
        <span data-id="div_ThrdChItem_Unread">3</span>
      </div>`);
    expect(extractThreadNames(root)).toEqual([
      { threadId: '7', name: 'Chủ xưởng Bình', isGroup: false, unread: 3, labels: ['HEAD'] },
    ]);
  });

  it('E: drops non-https avatars and emoji images; no unread without a badge', () => {
    const root = sb(`
      <div anim-data-id="8">
        <img class="avatar" src="http://insecure/a.jpg">
        <div data-id="div_ThrdChItem_Title">Anh Phúc</div>
        <div>ok <img src="https://zalo.me/emoji/1.png"></div>
        <div>12</div>
      </div>`);
    const [t] = extractThreadNames(root);
    expect(t).toEqual({ threadId: '8', name: 'Anh Phúc', isGroup: false });
  });

  it('F: an invalid mapping selector falls back to heuristics', () => {
    const root = sb(`<div anim-data-id="9"><div data-id="x_Title">Chị Hoa</div></div>`);
    const sel = { ...DEFAULT_DOM_SELECTORS, threadTitle: '[[bad' };
    expect(extractThreadNames(root, sel)[0]?.name).toBe('Chị Hoa');
  });
});

describe('readActiveThreadId (synthetic fixtures)', () => {
  function sb(html: string): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  }

  it('finds the item with a selected/active class', () => {
    expect(readActiveThreadId(sb(`
      <div anim-data-id="1" class="msg-item"></div>
      <div anim-data-id="2" class="msg-item selected"></div>`))).toBe('2');
    expect(readActiveThreadId(sb(`<div anim-data-id="g5" class="item item--active"></div>`))).toBe('g5');
  });

  it('honours aria-selected and a single-item wrapper or direct child', () => {
    expect(readActiveThreadId(sb(`<div anim-data-id="3" aria-selected="true"></div>`))).toBe('3');
    expect(readActiveThreadId(sb(`
      <div class="row"><div anim-data-id="3"></div></div>
      <div class="row is-selected"><div anim-data-id="4"></div></div>`))).toBe('4');
    expect(readActiveThreadId(sb(`<div anim-data-id="6"><div class="conv-item conv-item-active"></div></div>`))).toBe('6');
  });

  it('returns null when nothing is highlighted (and ignores unrelated "inactive"/status classes)', () => {
    expect(readActiveThreadId(sb(`
      <div anim-data-id="1" class="inactive"></div>
      <div anim-data-id="2"><span class="online-dot"></span></div>`))).toBeNull();
  });
});

describe('reply bubbles (quote block, surveyed 2026-09-28)', () => {
  const reply = (cli: string) => `
    <div id="bb_msg_id_${cli}" class="chat-message">
      <div data-id="div_ReceivedMsg_Text" class="text-message__container">
        <div class="message-quote-fragment__container">
          <div class="message-quote-fragment__content-container">
            <div class="message-quote-fragment__title-wrapper"><div class="truncate quote-name">VCpart An</div></div>
            <div class="message-quote-fragment__description">A0004208700 Má phanh <a href="https://docs.google.com/x">link</a></div>
          </div>
        </div>
        <div><div class="overflow-hidden">Em gửi đơn a An</div></div>
      </div>
    </div>`;

  it('keeps the quoted message out of the text and reports it as quote', () => {
    const [m] = extractMessages(chat(reply('501')));
    expect(m.text).toBe('Em gửi đơn a An');
    expect(m.quote).toEqual({ senderName: 'VCpart An', text: 'A0004208700 Má phanh link' });
    // Links inside the quote belong to the quoted message, not to this one.
    expect(m.links).toEqual([]);
    expect(toContentItems([m], 1)[0]).toMatchObject({ text: 'Em gửi đơn a An', quote: { senderName: 'VCpart An' } });
  });

  it('reads the group sender name shown above a received bubble, never on sent ones', () => {
    const named = (cli: string, marker: string) => `
      <div id="bb_msg_id_${cli}"><div data-id="div_DisabledTargetEventLayer">
        <div class="message-sender-name-wrapper"><div class="message-sender-name-content clickable"><div class="truncate">Vcpart Đức sale</div></div></div>
        <div data-id="${marker}">Hàng về rồi</div>
      </div></div>`;
    const [a, b] = extractMessages(chat(named('601', 'div_ReceivedMsg_Text') + named('602', 'div_SentMsg_Text')));
    expect(a.senderName).toBe('Vcpart Đức sale');
    expect(a.text).toBe('Hàng về rồi');
    expect(b.senderName).toBeUndefined();
    expect(toContentItems([a], 1)[0].senderName).toBe('Vcpart Đức sale');
  });

  it('has no quote on a plain bubble', () => {
    const [m] = extractMessages(chat(received('502', 'Chào anh')));
    expect(m.quote).toBeUndefined();
  });
});

describe('collectSidebarNames', () => {
  /**
   * Virtual sidebar: 30 items of 60px in a 240px viewport; only the four items
   * under the current scrollTop are rendered, like Zalo Web's list.
   */
  function virtualSidebar(total = 30, itemH = 60, viewH = 240) {
    const scroller = document.createElement('div');
    let top = 0;
    const render = () => {
      const first = Math.floor(top / itemH);
      scroller.innerHTML = Array.from({ length: Math.ceil(viewH / itemH) }, (_, k) => first + k)
        .filter((i) => i < total)
        .map((i) => `<div anim-data-id="${i % 3 ? '' : 'g'}${1000 + i}"><div data-id="div_ThrdChItem_Title">Hội thoại ${i}</div></div>`)
        .join('');
    };
    Object.defineProperty(scroller, 'scrollHeight', { get: () => total * itemH });
    Object.defineProperty(scroller, 'clientHeight', { get: () => viewH });
    Object.defineProperty(scroller, 'scrollTop', {
      get: () => top,
      set: (v: number) => {
        top = Math.max(0, Math.min(v, total * itemH - viewH));
        render();
      },
    });
    render();
    return scroller;
  }

  it('walks the virtual list viewport by viewport and reads every item', async () => {
    const scroller = virtualSidebar();
    scroller.scrollTop = 600; // the user had scrolled down a bit
    const names = await collectSidebarNames(scroller, DEFAULT_DOM_SELECTORS, { scroller, sleep: async () => undefined });
    expect(names).toHaveLength(30);
    expect(names.map((n) => n.threadId)).toContain('g1000');
    expect(names.map((n) => n.threadId)).toContain('1029');
    expect(names.find((n) => n.threadId === '1016')?.name).toBe('Hội thoại 16');
    expect(scroller.scrollTop).toBe(600); // position restored
  });

  it('jumping straight to the bottom would have skipped the middle (regression guard)', () => {
    const scroller = virtualSidebar();
    const seen = new Set(extractThreadNames(scroller).map((n) => n.threadId));
    scroller.scrollTop = scroller.scrollHeight;
    for (const n of extractThreadNames(scroller)) seen.add(n.threadId);
    expect(seen.size).toBeLessThan(30);
  });

  it('returns the visible items when there is no scroller', async () => {
    const root = document.createElement('div');
    root.innerHTML = `<div anim-data-id="7"><div data-id="div_ThrdChItem_Title">Một mình</div></div>`;
    const names = await collectSidebarNames(root, DEFAULT_DOM_SELECTORS, { scroller: null });
    expect(names).toEqual([{ threadId: '7', name: 'Một mình', isGroup: false }]);
  });
});

describe('hasUnreadMark', () => {
  const item = (inner: string) => {
    document.body.innerHTML = `<div anim-data-id="g1"><div class="conv-item">Nhóm A${inner}</div></div>`;
    return document.querySelector('[anim-data-id]')!;
  };
  it('sees counters, dot badges and the --unread preview class (Zalo Web 29/09/2026)', () => {
    expect(hasUnreadMark(item('<div class="z-noti-badge --big --counter"><i class="z-noti-badge__content">4</i></div>'))).toBe(true);
    expect(hasUnreadMark(item('<i class="z-noti-badge --big --dot --noti-enable"></i>'))).toBe(true);
    expect(hasUnreadMark(item('<div class="z-conv-message --unread">Lan: ok</div>'))).toBe(true);
    expect(hasUnreadMark(item('<div>5+</div>'))).toBe(true);
  });
  it('is false for a read conversation', () => {
    expect(hasUnreadMark(item('<div class="z-conv-message">Lan: ok</div><span>14:05</span>'))).toBe(false);
  });
});
