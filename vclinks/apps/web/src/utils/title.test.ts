import { describe, expect, it } from 'vitest';
import { baseTitle, formatTitle, pageTitleOf } from './title';

describe('pageTitleOf', () => {
  it('maps menu routes and their sub paths', () => {
    expect(pageTitleOf('/conversations')).toBe('Tin nhắn');
    expect(pageTitleOf('/conversations/abc')).toBe('Tin nhắn');
    expect(pageTitleOf('/customers')).toBe('Khách hàng');
    expect(pageTitleOf('/admin')).toBe('Quản trị');
  });
  it('prefers the longest prefix', () => {
    expect(pageTitleOf('/customers/erp-matching')).toBe('Đối chiếu mã KH');
    expect(pageTitleOf('/contacts/requests')).toBe('Lời mời kết bạn');
    expect(pageTitleOf('/admin/users/1/offboard')).toBe('Người dùng');
  });
  it('returns null for unknown paths', () => {
    expect(pageTitleOf('/nope')).toBeNull();
  });
});

describe('formatTitle / baseTitle', () => {
  it('appends the app name only when there is a part', () => {
    expect(formatTitle('Tin nhắn')).toBe('Tin nhắn · VClinks');
    expect(formatTitle(null)).toBe('VClinks');
  });
  it('strips the unread badge', () => {
    expect(baseTitle('(3) Tin nhắn · VClinks')).toBe('Tin nhắn · VClinks');
    expect(baseTitle('(99+) VClinks')).toBe('VClinks');
    expect(baseTitle('')).toBe('VClinks');
  });
});
