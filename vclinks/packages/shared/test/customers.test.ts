import { describe, expect, it } from 'vitest';
import { companyEmailSchema, contactListQuerySchema, identityIdOf, isCompanyEmail, normalizeEmail, normalizePhone, splitIdentityId } from '../src';

describe('normalizePhone (DK-03)', () => {
  it.each([
    ['0900 000 101', '0900000101'],
    ['+84 900.000.101', '0900000101'],
    ['84900000101', '0900000101'],
    ['0900-000-101', '0900000101'],
    ['01688888888', '0388888888'],
    ['0120 123 4567', '0701234567'],
    ['024 3333 4444', '02433334444'],
  ])('%s → %s', (raw, out) => expect(normalizePhone(raw)).toBe(out));

  it.each(['1900 1234', '18001234', '12345', 'abc0900000101', '', null, '0100000000'])('rejects %s', (raw) =>
    expect(normalizePhone(raw as string)).toBeNull(),
  );

  it('drops company numbers', () => expect(normalizePhone('0900000101', ['0900 000 101'])).toBeNull());
});

describe('normalizeEmail (DK-19)', () => {
  it('lower-cases, strips gmail dots and +tags, refuses company and invalid addresses', () => {
    expect(normalizeEmail(' Khoa.Gara@Example.vn ')).toBe('khoa.gara@example.vn');
    expect(normalizeEmail('k.h.o.a+shop@gmail.com')).toBe('khoa@gmail.com');
    expect(normalizeEmail('minh@vcprosperous.com')).toBeNull();
    expect(normalizeEmail('Cskh@VCpart.vn')).toBeNull();
    expect(normalizeEmail('not-an-email')).toBeNull();
  });
});

describe('identity ids', () => {
  it('round-trips uid:userId', () => {
    expect(splitIdentityId(identityIdOf('zoa_123', '456'))).toEqual({ uid: 'zoa_123', userId: '456' });
    expect(splitIdentityId('broken')).toBeNull();
  });
});

describe('contact list role filter', () => {
  it('accepts a role of CLAUDE.md §5 or none, refuses others', () => {
    expect(contactListQuerySchema.parse({ uid: '1', role: 'khach_hang' }).role).toBe('khach_hang');
    expect(contactListQuerySchema.parse({ uid: '1', role: 'none' }).role).toBe('none');
    expect(contactListQuerySchema.safeParse({ uid: '1', role: 'boss' }).success).toBe(false);
  });
});

describe('company email domains (01 PQ-10)', () => {
  it('accepts vcprosperous.com and vcpart.vn, nothing else', () => {
    expect(isCompanyEmail(' Minh@VCprosperous.com ')).toBe(true);
    expect(isCompanyEmail('cskh@vcpart.vn')).toBe(true);
    expect(isCompanyEmail('cskh@vcpart.vn.example.com')).toBe(false);
    expect(isCompanyEmail('x@gmail.com')).toBe(false);
    expect(isCompanyEmail('a@b@vcpart.vn')).toBe(false);
    expect(companyEmailSchema.safeParse('cskh@vcpart.vn').success).toBe(true);
    expect(companyEmailSchema.safeParse('cskh@gmail.com').error?.issues[0].message).toBe('Email phải kết thúc @vcprosperous.com hoặc @vcpart.vn.');
  });
});
