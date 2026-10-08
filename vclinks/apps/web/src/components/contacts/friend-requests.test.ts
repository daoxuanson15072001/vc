import { describe, expect, it } from 'vitest';
import { commandLabel, isFriendCommand } from './friend-requests';

describe('friend request helpers (M1a-04)', () => {
  it('knows the friend commands (they have no conversation to open)', () => {
    expect(isFriendCommand('friend_accept')).toBe(true);
    expect(isFriendCommand('friend_request')).toBe(true);
    expect(isFriendCommand('send_images')).toBe(false);
    expect(isFriendCommand(undefined)).toBe(false);
  });
  it('labels the command waiting on a request in Vietnamese', () => {
    expect(commandLabel('approved')).toBe('Đang chờ thực hiện trên Zalo');
    expect(commandLabel('failed')).toContain('xem Lệnh gửi');
    expect(commandLabel(null)).toBeNull();
    expect(commandLabel('sent')).toBeNull();
  });
});
