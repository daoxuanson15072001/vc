import { describe, expect, it } from 'vitest';
import { hitLink, searchUrl, splitMarks } from './search';

describe('hitLink', () => {
  it('opens the conversation on the message', () => {
    expect(hitLink({ conversationId: '123:K1', msgId: 'a b' })).toBe('/conversations/123%3AK1?msg=a%20b');
  });
});

describe('splitMarks', () => {
  it('cuts the snippet by the marks', () => {
    expect(splitMarks('cần má phanh', [[4, 6], [7, 12]])).toEqual([
      { text: 'cần ', bold: false },
      { text: 'má', bold: true },
      { text: ' ', bold: false },
      { text: 'phanh', bold: true },
    ]);
  });
  it('without marks the whole snippet is plain', () => {
    expect(splitMarks('abc', [])).toEqual([{ text: 'abc', bold: false }]);
  });
});

describe('searchUrl', () => {
  it('drops empty values', () => {
    expect(searchUrl({ q: 'má phanh', uid: ['1', '2'] })).toBe('/search?q=m%C3%A1+phanh&uid=1%2C2');
  });
});
