import { describe, expect, it } from 'vitest';
import { friendRequestDomBatchSchema, friendTargetAllowed, parseFriendTargets, friendRequestDomItemSchema, normalizeVnPhone } from '../src/friend-request';

describe('friend request rows', () => {
  it('accepts a row with id and keeps it strict', () => {
    const r = friendRequestDomItemSchema.parse({ userId: 123, name: 'Hương', message: 'Kết bạn nhé', source: 'Từ số điện thoại', dateText: '03/08' });
    expect(r.userId).toBe('123');
    expect(friendRequestDomItemSchema.safeParse({ userId: '1', name: 'A', token: 'x' }).success).toBe(false);
    expect(friendRequestDomItemSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(friendRequestDomItemSchema.safeParse({ userId: 'abc', name: 'A' }).success).toBe(false);
  });
  it('drops a non-https avatar instead of rejecting the row', () => {
    expect(friendRequestDomItemSchema.parse({ userId: '1', name: 'A', avatar: 'http://x/y.png' }).avatar).toBeUndefined();
  });
  it('batch needs a direction', () => {
    expect(friendRequestDomBatchSchema.safeParse({ items: [] }).success).toBe(false);
    expect(friendRequestDomBatchSchema.parse({ direction: 'sent', items: [] }).complete).toBe(false);
  });
  it('normalizes Vietnamese phone numbers', () => {
    expect(normalizeVnPhone('+84 912 345 678')).toBe('0912345678');
    expect(normalizeVnPhone('0912.345.678')).toBe('0912345678');
    expect(normalizeVnPhone('84912345678')).toBe('0912345678');
    expect(normalizeVnPhone('12345')).toBeNull();
  });
});

describe('friend target allowlist', () => {
  it('blocks everything when missing or empty, allows only named people, * lifts it', () => {
    expect(friendTargetAllowed(undefined, { userId: '1' })).toBe(false);
    expect(friendTargetAllowed([], { phone: '0342808374' })).toBe(false);
    expect(friendTargetAllowed(['0342808374', '6497853381290224663'], { phone: '+84 342 808 374' })).toBe(true);
    expect(friendTargetAllowed(['0342808374', '6497853381290224663'], { userId: '6497853381290224663' })).toBe(true);
    expect(friendTargetAllowed(['0342808374'], { userId: '123', phone: '0912345678' })).toBe(false);
    expect(friendTargetAllowed(['0342808374'], {})).toBe(false);
    expect(friendTargetAllowed(['*'], { userId: '9' })).toBe(true);
    expect(parseFriendTargets(' a, b;c  d ')).toEqual(['a', 'b', 'c', 'd']);
  });
});
