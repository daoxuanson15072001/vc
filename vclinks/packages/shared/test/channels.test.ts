import { describe, expect, it } from 'vitest';
import { channelAccountUid, channelOfUid, registerAccountSchema, sourceIdOfUid, uidChannelFilter } from '../src';

describe('channels', () => {
  it('maps uids to channels by prefix', () => {
    expect(channelOfUid('8123456789')).toBe('zalo');
    expect(channelOfUid('zoa_42')).toBe('zalo_oa');
    expect(channelOfUid('fbp_42')).toBe('fb_page');
    expect(channelOfUid('fb_42')).toBe('fb_personal');
    expect(channelAccountUid('fb_page', '99')).toBe('fbp_99');
    expect(sourceIdOfUid('fbp_99')).toBe('99');
    expect(sourceIdOfUid('8123')).toBe('8123');
  });

  it('builds a uid filter per channel', () => {
    const zalo = uidChannelFilter('zalo').$not as RegExp;
    expect(zalo.test('fbp_1')).toBe(true);
    expect(zalo.test('8123')).toBe(false);
    expect(uidChannelFilter('fb_page')).toEqual({ $regex: '^fbp_' });
  });

  it('defaults and checks the channel on account registration', () => {
    expect(registerAccountSchema.parse({ uid: '8123', label: 'A' }).channel).toBe('zalo');
    expect(registerAccountSchema.parse({ uid: 'fbp_1', label: 'P' }).channel).toBe('fb_page');
    expect(registerAccountSchema.safeParse({ uid: '8123', label: 'A', channel: 'fb_page' }).success).toBe(false);
  });
});
