import { describe, expect, it } from 'vitest';
import type { ChatMessage, OutboxItem } from '../types';
import {
  fileExt,
  findQuoted,
  fmtSize,
  initials,
  isOwnMessage,
  layoutMessages,
  mergeMessages,
  messageSummary,
  safeUrl,
  splitLinks,
  visibleOutbox,
} from './chat';

const msg = (id: string, fromUid: string, sentAt: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  msgId: id,
  threadId: 't1',
  fromUid,
  senderName: null,
  msgType: 'webchat',
  text: `text ${id}`,
  sentAt,
  ...extra,
});

describe('layoutMessages', () => {
  const g = (senderKey: string, sentAt: string) => ({ senderKey, sentAt });

  it('groups consecutive messages from one sender within 5 minutes', () => {
    const out = layoutMessages([
      g('a', '2026-09-28T03:00:00Z'),
      g('a', '2026-09-28T03:04:00Z'),
      g('a', '2026-09-28T03:10:00Z'), // gap > 5 min → new run
      g('b', '2026-09-28T03:11:00Z'), // new sender → new run
    ]);
    expect(out.map((x) => [x.firstInRun, x.lastInRun])).toEqual([
      [true, false],
      [false, true],
      [true, true],
      [true, true],
    ]);
    expect(out[0].daySeparator).toBe('2026-09-28');
    expect(out.slice(1).every((x) => x.daySeparator === null)).toBe(true);
  });

  it('breaks runs and inserts a separator on a new Vietnam day', () => {
    // 16:58Z and 17:01Z straddle midnight in UTC+7.
    const out = layoutMessages([g('a', '2026-09-27T16:58:00Z'), g('a', '2026-09-27T17:01:00Z')]);
    expect(out[1].daySeparator).toBe('2026-09-28');
    expect(out[1].firstInRun).toBe(true);
    expect(out[0].lastInRun).toBe(true);
  });
});

describe('helpers', () => {
  it('initials takes the last two words', () => {
    expect(initials('Nguyễn Văn An')).toBe('VA');
    expect(initials('an')).toBe('A');
    expect(initials('')).toBe('?');
  });
  it('isOwnMessage recognises account and self uids', () => {
    expect(isOwnMessage('123', '123')).toBe(true);
    expect(isOwnMessage('0', '123')).toBe(true);
    expect(isOwnMessage('999', '123')).toBe(false);
  });
  it('safeUrl only allows http(s)/blob', () => {
    expect(safeUrl('https://f.zalo.me/a.jpg')).toBe('https://f.zalo.me/a.jpg');
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl(null)).toBeUndefined();
  });
  it('fmtSize and fileExt', () => {
    expect(fmtSize(512)).toBe('512 B');
    expect(fmtSize(1536)).toBe('1,5 KB');
    expect(fileExt('Bao gia.XLSX')).toBe('xlsx');
    expect(fileExt('x', '.PDF')).toBe('pdf');
  });
  it('mergeMessages dedupes by id and sorts by time (later list wins)', () => {
    const a = msg('1', 'x', '2026-09-28T03:00:00.000Z', { text: 'old' });
    const b = msg('1', 'x', '2026-09-28T03:00:00.000Z', { text: 'new' });
    const c = msg('0', 'x', '2026-09-28T02:00:00.000Z');
    const out = mergeMessages([a], [b, c]);
    expect(out.map((m) => m.id)).toEqual(['0', '1']);
    expect(out[1].text).toBe('new');
  });
});

describe('visibleOutbox', () => {
  const ob = (id: string, extra: Partial<OutboxItem>): OutboxItem => ({
    id,
    uid: 'u1',
    threadId: 't1',
    text: 'Chào anh',
    status: 'approved',
    approvedBy: 'me',
    approvedAt: '2026-09-28T03:00:00.000Z',
    createdAt: '2026-09-28T03:00:00.000Z',
    ...extra,
  });

  it('hides cancelled items; keeps expired and awaiting-confirm ones (also for state commands)', () => {
    const out = visibleOutbox(
      [
        ob('a', { status: 'cancelled' }),
        ob('b', { status: 'expired' }),
        ob('c', { status: 'awaiting_confirm' }),
        ob('d', { status: 'expired', action: 'react' }),
        ob('e', { status: 'approved', action: 'react' }),
      ],
      [],
      'u1',
    );
    expect(out.map((o) => o.id)).toEqual(['b', 'c', 'd']);
  });

  it('keeps unsent items and hides sent ones once the real message is synced', () => {
    const messages = [msg('m1', 'u1', '2026-09-28T03:00:05.000Z', { cliMsgId: 'c1', text: 'khác' })];
    const out = visibleOutbox(
      [
        ob('a', { status: 'approved' }),
        ob('b', { status: 'sent', cliMsgId: 'c1', sentAt: '2026-09-28T03:00:04.000Z' }),
        ob('c', { status: 'sent', cliMsgId: 'c2', sentAt: '2026-09-28T03:00:04.000Z' }),
        ob('d', { status: 'failed' }),
      ],
      messages,
      'u1',
    );
    expect(out.map((o) => o.id)).toEqual(['a', 'c', 'd']);
  });

  it('falls back to matching own text (per line) when there is no cliMsgId', () => {
    const messages = [
      msg('m1', '0', '2026-09-28T03:00:05.000Z', { text: 'dòng 1' }),
      msg('m2', '0', '2026-09-28T03:00:06.000Z', { text: 'dòng 2' }),
    ];
    const out = visibleOutbox([ob('a', { status: 'sent', text: 'dòng 1\ndòng 2', sentAt: '2026-09-28T03:00:04.000Z' })], messages, 'u1');
    expect(out).toEqual([]);
  });

  describe('id matching and text fallback', () => {
    const sentOb = (id: string, extra: Partial<OutboxItem>) => ob(id, { status: 'sent', sentAt: '2026-09-28T03:00:04.000Z', ...extra });

    it('hides by cliMsgId even when the text differs', () => {
      const messages = [msg('m1', '0', '2026-09-28T03:00:05.000Z', { cliMsgId: 'c1', text: 'khác hẳn' })];
      expect(visibleOutbox([sentOb('a', { cliMsgId: 'c1' })], messages, 'u1')).toEqual([]);
    });

    it('multi-line: hidden only when every cliMsgId is loaded', () => {
      const one = [msg('m1', '0', '2026-09-28T03:00:05.000Z', { cliMsgId: 'c1', text: 'x' })];
      const both = [...one, msg('m2', '0', '2026-09-28T03:00:06.000Z', { cliMsgId: 'c2', text: 'y' })];
      const item = sentOb('a', { text: 'x\ny', cliMsgId: 'c2', cliMsgIds: ['c1', 'c2'] });
      expect(visibleOutbox([item], one, 'u1').map((o) => o.id)).toEqual(['a']);
      expect(visibleOutbox([item], both, 'u1')).toEqual([]);
    });

    it('two identical sends with one real message: only one bubble is hidden', () => {
      const messages = [msg('m1', '0', '2026-09-28T03:00:05.000Z', { text: 'ok' })];
      const out = visibleOutbox(
        [
          sentOb('a', { text: 'ok', createdAt: '2026-09-28T03:00:01.000Z' }),
          sentOb('b', { text: 'ok', createdAt: '2026-09-28T03:00:02.000Z' }),
        ],
        messages,
        'u1',
      );
      expect(out.map((o) => o.id)).toEqual(['b']);
    });

    it('two identical sends with two real messages: both hidden', () => {
      const messages = [msg('m1', '0', '2026-09-28T03:00:05.000Z', { text: 'ok' }), msg('m2', '0', '2026-09-28T03:00:07.000Z', { text: 'ok' })];
      const out = visibleOutbox([sentOb('a', { text: 'ok' }), sentOb('b', { text: 'ok', createdAt: '2026-09-28T03:00:02.000Z' })], messages, 'u1');
      expect(out).toEqual([]);
    });

    it('a real message already claimed by id is not reused by a no-id item', () => {
      const messages = [msg('m1', '0', '2026-09-28T03:00:05.000Z', { cliMsgId: 'c1', text: 'ok' })];
      const out = visibleOutbox([sentOb('a', { text: 'ok', cliMsgId: 'c1' }), sentOb('b', { text: 'ok', createdAt: '2026-09-28T03:00:02.000Z' })], messages, 'u1');
      expect(out.map((o) => o.id)).toEqual(['b']);
    });

    it('text fallback ignores a real message older than the 2-minute window', () => {
      const messages = [msg('m1', '0', '2026-09-28T02:50:00.000Z', { text: 'Chào anh' })];
      expect(visibleOutbox([sentOb('a', {})], messages, 'u1').map((o) => o.id)).toEqual(['a']);
    });

    it('item with ids does not fall back to text when its ids are missing', () => {
      const messages = [msg('m1', '0', '2026-09-28T03:00:05.000Z', { text: 'Chào anh' })];
      expect(visibleOutbox([sentOb('a', { cliMsgId: 'c9' })], messages, 'u1').map((o) => o.id)).toEqual(['a']);
    });
  });
});

describe('splitLinks', () => {
  it('turns typed http(s) URLs into links and keeps the rest as text', () => {
    expect(splitLinks('Em gửi đơn https://docs.google.com/spreadsheets/d/19Y2e/edit?gid=4#gid=4 @Đức nhé')).toEqual([
      { text: 'Em gửi đơn ' },
      { text: 'https://docs.google.com/spreadsheets/d/19Y2e/edit?gid=4#gid=4', url: 'https://docs.google.com/spreadsheets/d/19Y2e/edit?gid=4#gid=4' },
      { text: ' @Đức nhé' },
    ]);
  });
  it('leaves trailing punctuation outside, and plain text untouched', () => {
    expect(splitLinks('xem http://a.vn/x.')).toEqual([{ text: 'xem ' }, { text: 'http://a.vn/x', url: 'http://a.vn/x' }, { text: '.' }]);
    expect(splitLinks('không có link')).toEqual([{ text: 'không có link' }]);
    expect(splitLinks('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }]);
  });
});

describe('reply quotes', () => {
  const list = [
    msg('a', 'u1', '2026-09-28T10:00:00Z', { cliMsgId: 'c1', senderName: 'VCpart An', text: 'A0004208700 Má phanh  trước' }),
    msg('b', 'u2', '2026-09-28T10:05:00Z', { cliMsgId: 'c2', senderName: 'Đức sale', text: 'A0004208700 Má phanh trước (bản khác)' }),
    msg('c', 'u2', '2026-09-28T10:10:00Z', { cliMsgId: 'c3', text: null, images: ['https://x/1.jpg'] }),
  ];

  it('finds the quoted message by id first, then by sender name + leading text before the reply', () => {
    expect(findQuoted({ cliMsgId: 'c2' }, list)?.id).toBe('b');
    expect(findQuoted({ msgId: 'a' }, list)?.id).toBe('a');
    expect(findQuoted({ senderName: 'VCpart An', text: 'A0004208700 Má phanh trước' }, list, '2026-09-28T11:00:00Z')?.id).toBe('a');
    // Without a sender, the newest earlier match wins; later messages are ignored.
    expect(findQuoted({ text: 'A0004208700 Má phanh' }, list, '2026-09-28T10:04:00Z')?.id).toBe('a');
    expect(findQuoted({ text: 'không có' }, list)).toBeUndefined();
  });

  it('summarises a message on one line, or by what it carries', () => {
    expect(messageSummary(msg('x', 'u', '2026-09-28T10:00:00Z', { text: 'Dòng 1\nDòng 2' }))).toBe('Dòng 1 Dòng 2');
    expect(messageSummary(list[2])).toBe('[Hình ảnh]');
    expect(messageSummary(msg('y', 'u', '2026-09-28T10:00:00Z', { text: 'x'.repeat(200) })).length).toBe(161);
  });
});
