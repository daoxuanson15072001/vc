import { describe, expect, it } from 'vitest';
import { filterQuickReplies, matchShortcut, quickReplyInputSchema, renderQuickReply } from '../src/quick-replies';

describe('quick replies', () => {
  it('normalises the shortcut and rejects bad ones', () => {
    expect(quickReplyInputSchema.parse({ shortcut: ' BaoHanh ', title: ' Bảo hành ', text: ' Dạ anh ' })).toEqual({
      shortcut: 'baohanh',
      title: 'Bảo hành',
      text: 'Dạ anh',
      kind: 'text',
    });
    expect(quickReplyInputSchema.safeParse({ shortcut: 'bảo hành', title: 'x', text: 'y' }).success).toBe(false);
    expect(quickReplyInputSchema.safeParse({ shortcut: 'a/b', title: 'x', text: 'y' }).success).toBe(false);
    expect(quickReplyInputSchema.safeParse({ shortcut: 'stk', title: 'x', text: 'y', kind: 'bank' }).success).toBe(true);
    expect(quickReplyInputSchema.safeParse({ shortcut: 'stk', title: 'x', text: 'y', extra: 1 }).success).toBe(false);
  });

  it('fills variables and keeps unknown ones visible', () => {
    expect(renderQuickReply('Chào {ten_khach}, em là {ten_nv}.', { ten_khach: 'anh Kiên', ten_nv: 'Tú' })).toBe('Chào anh Kiên, em là Tú.');
    expect(renderQuickReply('Chào {ten_khach}', {})).toBe('Chào {ten_khach}');
    // M1b-10 /traloithay template (QT-SZ-10).
    expect(renderQuickReply('Dạ em là {ten_nv}, trưởng nhóm của {ten_nguoi_giu_nick}.', { ten_nv: 'Hương', ten_nguoi_giu_nick: 'Minh' })).toBe('Dạ em là Hương, trưởng nhóm của Minh.');
    expect(renderQuickReply('Chào {ten_khach}', { ten_khach: '  ' })).toBe('Chào {ten_khach}');
  });

  it('finds the /shortcut token being typed at the caret', () => {
    expect(matchShortcut('/bao', 4)).toEqual({ start: 0, query: 'bao' });
    expect(matchShortcut('Dạ /BAO', 7)).toEqual({ start: 3, query: 'bao' });
    expect(matchShortcut('/', 1)).toEqual({ start: 0, query: '' });
    expect(matchShortcut('a/b', 3)).toBeNull();
    expect(matchShortcut('/bao rồi', 8)).toBeNull();
    expect(matchShortcut('/bao rồi', 4)).toEqual({ start: 0, query: 'bao' });
  });

  it('ranks shortcut prefixes before title matches', () => {
    const list = [
      { shortcut: 'giaohang', title: 'Giao hàng' },
      { shortcut: 'bh', title: 'Bảo hành' },
      { shortcut: 'baogia', title: 'Báo giá' },
    ];
    expect(filterQuickReplies(list, 'b').map((r) => r.shortcut)).toEqual(['bh', 'baogia']);
    expect(filterQuickReplies(list, 'hành').map((r) => r.shortcut)).toEqual(['bh']);
    expect(filterQuickReplies(list, '').map((r) => r.shortcut)).toEqual(['giaohang', 'bh', 'baogia']);
  });
});
