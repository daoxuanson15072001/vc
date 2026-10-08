import { describe, expect, it } from 'vitest';
import { pickLoggedIn, toPresence } from '../src/account-detect';

describe('pickLoggedIn', () => {
  it('picks the account that knows most sidebar ids', () => {
    expect(pickLoggedIn(new Map([['a', 12], ['b', 2]]), 12)).toBe('a');
  });
  it('returns null without a clear winner or enough evidence', () => {
    expect(pickLoggedIn(new Map([['a', 6], ['b', 6]]), 12)).toBeNull();
    expect(pickLoggedIn(new Map([['a', 5]]), 12)).toBeNull(); // under 60%
    expect(pickLoggedIn(new Map([['a', 2]]), 2)).toBeNull(); // sample too small
    expect(pickLoggedIn(new Map([['a', null]]), 12)).toBeNull();
  });
  it('marks presence per uid', () => {
    expect(toPresence(['a', 'b'], 'b')).toEqual([
      { uid: 'a', loggedIn: false },
      { uid: 'b', loggedIn: true },
    ]);
    expect(toPresence(['a'], null)).toEqual([{ uid: 'a', loggedIn: null }]);
  });
});
