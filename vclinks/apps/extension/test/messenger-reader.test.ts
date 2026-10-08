// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { contactItemSchema, conversationItemSchema, messageItemSchema, threadNameItemSchema } from '@vclinks/shared';
import {
  checkMessengerHealth,
  parseThreadPath,
  profileIdFromHref,
  readOwnerId,
  readSidebar,
  readThreadMessages,
  toContactItems,
  toConversationItems,
  toMessageItems,
  toThreadNameItems,
  unwrapLink,
} from '../src/messenger/reader';
import { DEFAULT_MESSENGER_SELECTORS, mergeMessengerSelectors } from '../src/messenger/selectors';
import { parseTimeLabel } from '../src/messenger/time';
import { deriveMessageId, hash64 } from '../src/messenger/ids';
import { GROUP_ID, OWNER_ID, PARTNER_ID, inc, out, page, seen, sep, sepPlain, sidebar } from './messenger-fixtures';

/** Monday 28/09/2026 15:00 local time. */
const NOW = new Date(2026, 8, 28, 15, 0, 0).getTime();
const DAY = 86_400_000;
const at = (d: number, h: number, m: number) => new Date(2026, 8, d, h, m, 0).getTime();

function render(html: string) {
  document.body.innerHTML = html;
  return document;
}

describe('thread / owner ids', () => {
  it('parses Messenger thread paths and URLs', () => {
    expect(parseThreadPath('/t/123456/')).toEqual({ threadId: '123456', e2ee: false });
    expect(parseThreadPath('/e2ee/t/987654')).toEqual({ threadId: '987654', e2ee: true });
    expect(parseThreadPath('/messages/t/555')).toEqual({ threadId: '555', e2ee: false });
    expect(parseThreadPath('/messages/e2ee/t/555/?x=1')).toEqual({ threadId: '555', e2ee: true });
    expect(parseThreadPath('https://www.facebook.com/messages/t/42')).toEqual({ threadId: '42', e2ee: false });
    expect(parseThreadPath('https://evil.example/t/42')).toBeNull();
    expect(parseThreadPath('/marketplace/t/42')).toBeNull();
  });

  it('reads the owner id only from a profile link with a numeric id', () => {
    expect(profileIdFromHref('/profile.php?id=100001111111111')).toBe('100001111111111');
    expect(profileIdFromHref('https://www.facebook.com/100001111111111/')).toBe('100001111111111');
    expect(profileIdFromHref('https://www.facebook.com/some.vanity')).toBeNull();
    expect(profileIdFromHref('https://example.com/profile.php?id=100001111111111')).toBeNull();
    render(page({ rows: '', banner: `<a aria-label="Trang cá nhân của bạn" href="/profile.php?id=${OWNER_ID}"><img></a>` }));
    expect(readOwnerId(document)).toBe(OWNER_ID);
    render(page({ rows: '', banner: '<a aria-label="Your profile" href="/some.vanity"></a>' }));
    expect(readOwnerId(document)).toBeNull();
  });

  it('unwraps l.facebook.com redirect links', () => {
    expect(unwrapLink('https://l.facebook.com/l.php?u=https%3A%2F%2Fvcparts.vn%2Fsp%2F1&h=AT0')).toBe('https://vcparts.vn/sp/1');
    expect(unwrapLink('javascript:alert(1)')).toBeNull();
  });
});

describe('parseTimeLabel', () => {
  it('parses Vietnamese and English separator labels', () => {
    expect(parseTimeLabel('10:32', NOW)).toBe(at(28, 10, 32));
    expect(parseTimeLabel('Hôm nay lúc 10:32', NOW)).toBe(at(28, 10, 32));
    expect(parseTimeLabel('Hôm qua lúc 21:05', NOW)).toBe(at(27, 21, 5));
    expect(parseTimeLabel('Yesterday at 9:05 PM', NOW)).toBe(at(27, 21, 5));
    expect(parseTimeLabel('T5 08:00', NOW)).toBe(at(24, 8, 0)); // 28/09/2026 is a Monday
    expect(parseTimeLabel('Thứ Tư 08:00', NOW)).toBe(at(23, 8, 0));
    expect(parseTimeLabel('Thu 8:00 AM', NOW)).toBe(at(24, 8, 0));
    expect(parseTimeLabel('12 Tháng 9, 2026 lúc 10:32', NOW)).toBe(at(12, 10, 32));
    expect(parseTimeLabel('Sep 12, 2026, 10:32 AM', NOW)).toBe(at(12, 10, 32));
    expect(parseTimeLabel('12/9/2026 10:32', NOW)).toBe(at(12, 10, 32));
  });

  it('resolves relative labels to the same instant on later days', () => {
    const today = parseTimeLabel('10:32', NOW);
    expect(parseTimeLabel('Hôm qua lúc 10:32', NOW + DAY)).toBe(today);
    expect(parseTimeLabel('T2 10:32', NOW + 3 * DAY)).toBe(today);
  });

  it('treats a time later than now as yesterday, and rejects free text', () => {
    expect(parseTimeLabel('23:50', at(28, 0, 5))).toBe(at(27, 23, 50));
    expect(parseTimeLabel('hẹn anh lúc 10:30 nhé', NOW)).toBeNull();
    expect(parseTimeLabel('Chào anh', NOW)).toBeNull();
    expect(parseTimeLabel('', NOW)).toBeNull();
  });
});

const IMG = 'https://scontent.xx.fbcdn.net/v/t1.15752-9/461234567_1234_n.jpg?_nc_cat=1&oh=00_AAA&oe=66FF';
const FILE = 'https://cdn.fbsbx.com/v/t59.2708-21/bao_gia.pdf/bao_gia.pdf?_nc_cat=1&oh=abc';

function thread1to1() {
  return page({
    sidebar: sidebar([{ id: PARTNER_ID, name: 'Anh Tuấn Gara', unread: true }]),
    rows: [
      out('Tin cũ phía trên, chưa có mốc thời gian'),
      sep('Hôm nay lúc 10:32'),
      inc('Anh Tuấn Gara', 'Chào em, báo giá lọc gió Vios 2020'),
      inc('Anh Tuấn Gara', '', { heading: false, image: IMG }),
      inc('Anh Tuấn Gara', 'ok', { heading: false, avatarId: PARTNER_ID }),
      out('Dạ em gửi anh ạ'),
      inc('', '', { heading: false, file: { name: 'bao_gia.pdf', url: FILE } }).replace('<div role="row">', '<div role="row"><h5>Bạn đã gửi</h5>'),
      out('ok', false),
      out('ok', false),
      seen(),
      inc('Anh Tuấn Gara', 'Xem ở đây', {
        link: 'https://l.facebook.com/l.php?u=https%3A%2F%2Fvcparts.vn%2Floc-gio&h=AT1',
      }),
    ].join(''),
  });
}

describe('readThreadMessages', () => {
  it('reads text, images, files, links, sender and direction of rendered rows', () => {
    render(thread1to1());
    const r = readThreadMessages(document, { threadId: PARTNER_ID, now: NOW });
    expect(r).toMatchObject({ list: true, separators: 1, unanchored: 1, locked: false });
    const simple = r.messages.map((m) => ({
      d: m.direction,
      from: m.fromUid,
      name: m.senderName,
      text: m.text,
      images: m.images,
      files: m.files,
      links: m.links,
      kind: m.kind,
    }));
    expect(simple).toEqual([
      { d: 'in', from: PARTNER_ID, name: 'Anh Tuấn Gara', text: 'Chào em, báo giá lọc gió Vios 2020', images: [], files: [], links: [], kind: 'text' },
      { d: 'in', from: PARTNER_ID, name: 'Anh Tuấn Gara', text: null, images: [IMG], files: [], links: [], kind: 'image' },
      { d: 'in', from: PARTNER_ID, name: 'Anh Tuấn Gara', text: 'ok', images: [], files: [], links: [], kind: 'text' },
      { d: 'out', from: '0', name: null, text: 'Dạ em gửi anh ạ', images: [], files: [], links: [], kind: 'text' },
      { d: 'out', from: '0', name: null, text: null, images: [], files: [{ name: 'bao_gia.pdf', url: FILE }], links: [], kind: 'file' },
      { d: 'out', from: '0', name: null, text: 'ok', images: [], files: [], links: [], kind: 'text' },
      { d: 'out', from: '0', name: null, text: 'ok', images: [], files: [], links: [], kind: 'text' },
      {
        d: 'in', from: PARTNER_ID, name: 'Anh Tuấn Gara', text: 'Xem ở đây liên kết',
        images: [], files: [], links: ['https://vcparts.vn/loc-gio'], kind: 'text',
      },
    ]);
    // Times: separator + position, strictly increasing.
    const times = r.messages.map((m) => m.sentAt);
    expect(times[0]).toBe(at(28, 10, 32));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('skips avatars, emoji and the "seen" row', () => {
    render(thread1to1());
    const r = readThreadMessages(document, { threadId: PARTNER_ID, now: NOW });
    const allImages = r.messages.flatMap((m) => m.images);
    expect(allImages).toEqual([IMG]);
    expect(r.messages.some((m) => m.text === 'Đã xem')).toBe(false);
  });

  it('uses the separator fallback (plain row whose text is a time)', () => {
    render(page({ rows: sepPlain('Hôm qua lúc 21:05') + out('Dạ vâng') }));
    const r = readThreadMessages(document, { threadId: PARTNER_ID, now: NOW });
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].sentAt).toBe(at(27, 21, 5));
  });

  it('in groups: senders by name, profile id carried over the whole run from the avatar row', () => {
    render(
      page({
        rows: [
          sep('09:00'),
          inc('Chị Lan', 'Anh Hùng ơi'),
          inc('Chị Lan', 'hàng về chưa', { heading: false, avatarId: '100003333333333' }),
          inc('Anh Minh', 'Chưa em'),
        ].join(''),
      }),
    );
    const r = readThreadMessages(document, { threadId: GROUP_ID, isGroup: true, now: NOW });
    expect(r.messages.map((m) => [m.senderName, m.fromUid])).toEqual([
      ['Chị Lan', '100003333333333'],
      ['Chị Lan', '100003333333333'],
      ['Anh Minh', expect.stringMatching(/^n_[0-9a-f]{16}$/)],
    ]);
  });

  it('prefers a real message id attribute when the DOM has one', () => {
    render(page({ rows: sep('09:00') + out('Chào anh').replace('<div role="row">', '<div role="row" data-message-id="mid.$cAAAbcdEFGH123">') }));
    const [m] = readThreadMessages(document, { threadId: PARTNER_ID, now: NOW }).messages;
    expect(m).toMatchObject({ msgId: 'mid.$cAAAbcdEFGH123', idSource: 'dom' });
  });

  it('flags a locked E2EE chat', () => {
    render('<div role="main"><div>Nhập mã PIN để khôi phục tin nhắn</div></div>');
    const r = readThreadMessages(document, { threadId: PARTNER_ID, now: NOW });
    expect(r).toMatchObject({ list: false, locked: true, messages: [] });
  });
});

describe('deterministic message ids', () => {
  it('are stable across re-reads, re-renders, new messages and later days', () => {
    render(thread1to1());
    const first = readThreadMessages(document, { threadId: PARTNER_ID, now: NOW }).messages.map((m) => m.msgId);
    expect(first.every((id) => /^d_[0-9a-f]{16}$/.test(id))).toBe(true);
    expect(new Set(first).size).toBe(first.length); // the two identical "ok" get distinct ids

    // Same DOM read again.
    expect(readThreadMessages(document, { threadId: PARTNER_ID, now: NOW }).messages.map((m) => m.msgId)).toEqual(first);

    // Next day: the label now says "Hôm qua", the list re-rendered and a new message arrived.
    const nextDay = thread1to1().replace('Hôm nay lúc 10:32', 'Hôm qua lúc 10:32') ;
    render(nextDay.replace('</div>\n      <div role="textbox"', `${sep('08:00')}${inc('Anh Tuấn Gara', 'Em ơi')}</div>\n      <div role="textbox"`));
    const later = readThreadMessages(document, { threadId: PARTNER_ID, now: NOW + DAY }).messages;
    expect(later.map((m) => m.msgId).slice(0, first.length)).toEqual(first);
    expect(later).toHaveLength(first.length + 1);
  });

  it('differ between threads, and the hash is deterministic', () => {
    const parts = { anchor: at(28, 10, 32), senderKey: '0', signature: 'ok', occurrence: 0 };
    expect(deriveMessageId({ threadId: '1', ...parts })).toBe(deriveMessageId({ threadId: '1', ...parts }));
    expect(deriveMessageId({ threadId: '1', ...parts })).not.toBe(deriveMessageId({ threadId: '2', ...parts }));
    expect(hash64('abc')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('sidebar', () => {
  it('reads names, unread, group and e2ee flags without the last-message preview', () => {
    render(
      sidebar([
        { id: PARTNER_ID, name: 'Anh Tuấn Gara', unread: true },
        { id: GROUP_ID, name: 'Nhóm Đại lý miền Bắc', group: true },
        { id: '100004444444444', name: 'Chị Hoa', e2ee: true },
      ]),
    );
    expect(readSidebar(document)).toEqual([
      { threadId: PARTNER_ID, e2ee: false, name: 'Anh Tuấn Gara', unread: true, isGroup: false, avatar: `https://scontent.xx.fbcdn.net/v/a_${PARTNER_ID}.jpg` },
      { threadId: GROUP_ID, e2ee: false, name: 'Nhóm Đại lý miền Bắc', unread: false, isGroup: true, avatar: `https://scontent.xx.fbcdn.net/v/g1_${GROUP_ID}.jpg` },
      { threadId: '100004444444444', e2ee: true, name: 'Chị Hoa', unread: false, isGroup: false, avatar: 'https://scontent.xx.fbcdn.net/v/a_100004444444444.jpg' },
    ]);
  });
});

describe('API items', () => {
  it('are valid under the shared ingest schemas', () => {
    render(thread1to1());
    const threads = readSidebar(document);
    const r = readThreadMessages(document, { threadId: PARTNER_ID, now: NOW });
    const msgs = toMessageItems(r);
    expect(msgs.length).toBe(8);
    for (const m of msgs) expect(messageItemSchema.safeParse(m).success).toBe(true);
    expect(msgs[3]).toMatchObject({ threadId: PARTNER_ID, fromUid: '0', msgType: 'fb.text', contentStatus: 'complete' });
    const contacts = toContactItems(r, threads[0]);
    expect(contacts).toEqual([{ userId: PARTNER_ID, displayName: 'Anh Tuấn Gara' }]);
    for (const c of contacts) expect(contactItemSchema.safeParse(c).success).toBe(true);
    for (const c of toConversationItems(threads)) expect(conversationItemSchema.safeParse(c).success).toBe(true);
    for (const n of toThreadNameItems(threads)) expect(threadNameItemSchema.safeParse(n).success).toBe(true);
  });
});

describe('health check', () => {
  const loc = { pathname: `/t/${PARTNER_ID}` };

  it('is clean on the fixture', () => {
    render(thread1to1());
    expect(checkMessengerHealth(document, loc, DEFAULT_MESSENGER_SELECTORS, { ownerKnown: true, now: NOW }).broken).toEqual([]);
  });

  it('names the broken keys and sends structure only (no text)', () => {
    render(thread1to1().replace(/role="row"/g, 'role="listitem"').replace('role="textbox"', 'role="none"'));
    const h = checkMessengerHealth(document, loc, DEFAULT_MESSENGER_SELECTORS, { ownerKnown: false, now: NOW });
    expect(h.broken).toEqual(['messageRow', 'composer', 'ownProfileLink']);
    expect(h.observedKeys).toContain('role=listitem');
    expect(h.observedKeys.join(' ')).not.toMatch(/Tuấn|báo giá|ok/);
  });

  it('accepts a selector override and ignores invalid values', () => {
    const sel = mergeMessengerSelectors({ messageRow: '[role="listitem"]', composer: '[[invalid', minImageSize: 'x' });
    expect(sel.messageRow).toBe('[role="listitem"]');
    expect(sel.composer).toBe(DEFAULT_MESSENGER_SELECTORS.composer);
    expect(sel.minImageSize).toBe(DEFAULT_MESSENGER_SELECTORS.minImageSize);
  });
});
