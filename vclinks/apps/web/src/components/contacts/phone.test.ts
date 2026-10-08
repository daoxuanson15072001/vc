import { describe, expect, it } from 'vitest';
import { formatPhone, maskPhone } from './PhoneText';

describe('phone display (03 MH-SZ-09 #7)', () => {
  it('groups a 10-digit number as on the wireframe', () => {
    expect(formatPhone('0900000101')).toBe('0900 000 101');
    expect(formatPhone('+84 900 000 101')).toBe('+84 900 000 101');
  });
  it('masks the middle digits', () => {
    expect(maskPhone('0900000101')).toBe('0900 *** 101');
    expect(maskPhone('12')).toBe('***');
  });
});
