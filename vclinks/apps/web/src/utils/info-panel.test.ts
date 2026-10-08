import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import { fold, groupByDay, searchLoaded } from './info-panel';

const msg = (id: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id, msgId: id, threadId: 't', fromUid: 'u', sentAt: '2026-10-04T03:00:00.000Z', ...extra }) as ChatMessage;

describe('info panel helpers', () => {
  it('fold ignores accents and case', () => {
    expect(fold('Báo GIÁ Đại lý')).toBe('bao gia dai ly');
  });
  it('searchLoaded finds text, file name, location title; newest first; needs 2 characters', () => {
    const list = [
      msg('1', { text: 'Anh cần báo giá lọc gió' }),
      msg('2', { files: [{ name: 'bao-gia-thang-10.pdf' }] }),
      msg('3', { location: { title: 'Kho Gia Lâm' } }),
      msg('4', { text: 'Dạ vâng', systemEvent: { act: 'join' } }),
    ];
    expect(searchLoaded(list, 'gia').map((m) => m.id)).toEqual(['3', '2', '1']);
    expect(searchLoaded(list, 'g')).toEqual([]);
    expect(searchLoaded(list, 'khong co')).toEqual([]);
  });
  it('groupByDay groups consecutive items of one day', () => {
    const g = groupByDay([{ sentAt: '2026-10-04T10:00:00.000Z' }, { sentAt: '2026-10-04T09:00:00.000Z' }, { sentAt: '2026-10-03T09:00:00.000Z' }]);
    expect(g.map((x) => [x.day, x.items.length])).toEqual([['04/10/2026', 2], ['03/10/2026', 1]]);
  });
});
