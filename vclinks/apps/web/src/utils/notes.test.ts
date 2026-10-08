import { describe, expect, it } from 'vitest';
import { mentionParts, placeNotes, staffMentioned } from './notes';

const m = (id: string, min: number) => ({ id, sentAt: new Date(Date.UTC(2026, 9, 6, 9, min)).toISOString() });
const n = (id: string, min: number) => ({ id, createdAt: new Date(Date.UTC(2026, 9, 6, 9, min)).toISOString() });

describe('placeNotes (00 MH-UI-08: a note shows where it was written)', () => {
  it('puts each note before the first later message, the newest after the thread', () => {
    const { before, after } = placeNotes([m('a', 10), m('b', 20), m('c', 30)], [n('n2', 25), n('n1', 15), n('n3', 40), n('n0', 20)], true);
    expect([...before.entries()].map(([k, v]) => [k, v.map((x) => x.id)])).toEqual([
      ['b', ['n1']],
      ['c', ['n0', 'n2']],
    ]);
    expect(after.map((x) => x.id)).toEqual(['n3']);
  });

  it('keeps notes older than the loaded window for later, unless everything is loaded', () => {
    expect(placeNotes([m('a', 10)], [n('old', 5)], false).before.size).toBe(0);
    expect(placeNotes([m('a', 10)], [n('old', 5)], true).before.get('a')!.map((x) => x.id)).toEqual(['old']);
    expect(placeNotes([], [n('x', 1)], false).after.map((x) => x.id)).toEqual(['x']);
  });
});

describe('mentions in notes and in messages to the customer', () => {
  it('splits the text around @Name (longest name first)', () => {
    expect(mentionParts('Nhờ @Lê Thu Hà xem, @Lê Thu nữa', ['Lê Thu', 'Lê Thu Hà'])).toEqual([
      { text: 'Nhờ ', mention: false },
      { text: '@Lê Thu Hà', mention: true },
      { text: ' xem, ', mention: false },
      { text: '@Lê Thu', mention: true },
      { text: ' nữa', mention: false },
    ]);
    expect(mentionParts('không ai', [])).toEqual([{ text: 'không ai', mention: false }]);
  });

  it('finds colleagues written as @Name, but not the group members picked from Zalo', () => {
    expect(staffMentioned('Dạ anh, @Lê Thu sẽ gọi lại', ['Lê Thu', 'Phạm Hà'])).toEqual(['Lê Thu']);
    expect(staffMentioned('@Lê Thu ơi', ['Lê Thu'], ['Lê Thu'])).toEqual([]);
    expect(staffMentioned('Lê Thu sẽ gọi', ['Lê Thu'])).toEqual([]);
  });
});
