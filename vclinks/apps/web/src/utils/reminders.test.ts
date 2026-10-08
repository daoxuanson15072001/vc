import { describe, expect, it } from 'vitest';
import { addLocalReminder, listLocalReminders } from './reminders';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('local reminders (until the task module exists)', () => {
  it('stores newest first and caps the note', () => {
    const s = memory();
    expect(addLocalReminder('userA', { conversationId: 'u:1', msgId: 'm1', at: '2026-10-05T02:00:00.000Z', note: 'a' }, s)).toBe(true);
    expect(addLocalReminder('userA', { conversationId: 'u:1', msgId: 'm2', at: '2026-10-06T02:00:00.000Z', note: 'x'.repeat(900) }, s)).toBe(true);
    const list = listLocalReminders('userA', s);
    expect(list.map((r) => r.msgId)).toEqual(['m2', 'm1']);
    expect(list[0].note).toHaveLength(500);
  });
  it('returns false when storage is blocked or missing, and [] for corrupt data', () => {
    expect(addLocalReminder('userA', { conversationId: 'u:1', msgId: 'm1', at: 'x', note: '' }, null)).toBe(false);
    expect(addLocalReminder('userA', { conversationId: 'u:1', msgId: 'm1', at: 'x', note: '' }, { getItem: () => null, setItem: () => { throw new Error('full'); } })).toBe(false);
    expect(listLocalReminders('userA', { getItem: () => '{not json', setItem: () => undefined })).toEqual([]);
  });
  it('keeps reminders per user and refuses without a user', () => {
    const s = memory();
    expect(addLocalReminder('userA', { conversationId: 'u:1', msgId: 'm1', at: 'x', note: 'riêng A' }, s)).toBe(true);
    expect(listLocalReminders('userB', s)).toEqual([]);
    expect(addLocalReminder(undefined, { conversationId: 'u:1', msgId: 'm1', at: 'x', note: '' }, s)).toBe(false);
  });
});
