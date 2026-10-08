import { describe, expect, it } from 'vitest';
import { clearAllDrafts, draftKeyFor, loadDraft, saveDraft } from './drafts';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe('drafts per conversation (D15)', () => {
  it('keeps a draft per conversation and removes it when the box is emptied', () => {
    const s = memory();
    saveDraft('u:1', 'Dạ em gửi anh báo giá', s);
    saveDraft('u:2', 'Chào chị', s);
    expect(loadDraft('u:1', s)).toBe('Dạ em gửi anh báo giá');
    expect(loadDraft('u:2', s)).toBe('Chào chị');
    saveDraft('u:1', '   ', s);
    expect(loadDraft('u:1', s)).toBe('');
    expect(s.m.has('vclinks.draft.u:1')).toBe(false);
  });
  it('never throws when storage is blocked', () => {
    const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(() => saveDraft('u:1', 'x', bad)).not.toThrow();
    expect(loadDraft('u:1', bad)).toBe('');
    expect(loadDraft('u:1', null)).toBe('');
  });
  it('caps a very long draft', () => {
    const s = memory();
    saveDraft('u:1', 'a'.repeat(9000), s);
    expect(loadDraft('u:1', s)).toHaveLength(4000);
  });
  it('keys drafts by user and clears them all on login / logout', () => {
    const m = new Map<string, string>([['vclinks.token', 't'], ['other', 'x']]);
    const s = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() {
        return m.size;
      },
    };
    expect(draftKeyFor(undefined, 'u:1')).toBeUndefined();
    saveDraft(draftKeyFor('userA', 'u:1')!, 'nháp của A', s);
    saveDraft(draftKeyFor('userB', 'u:1')!, 'nháp của B', s);
    expect(loadDraft(draftKeyFor('userB', 'u:1')!, s)).toBe('nháp của B');
    expect(loadDraft(draftKeyFor('userA', 'u:1')!, s)).toBe('nháp của A');
    clearAllDrafts(s);
    expect([...m.keys()].sort()).toEqual(['other', 'vclinks.token']);
    expect(() => clearAllDrafts(null)).not.toThrow();
  });
});
