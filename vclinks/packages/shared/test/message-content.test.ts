import { describe, expect, it } from 'vitest';
import { isSafeContentUrl, messageContentItemSchema, validateContentItems } from '../src';

const base = { cliMsgId: 'c1', capturedAt: 1790000000000 };

describe('message content schema: media fields', () => {
  it('accepts files, voice, video, card and kind', () => {
    const r = messageContentItemSchema.safeParse({
      ...base,
      direction: 'in',
      kind: 'file',
      files: [{ name: 'bao-gia.pdf', size: '12.3 MB', ext: 'pdf', url: 'https://f.zalo.me/f/bao-gia.pdf' }],
      voice: { url: 'https://v.zalo.me/a.aac', durationSec: 15 },
      video: { url: 'https://v.zalo.me/v.mp4', thumb: 'https://f.zalo.me/t.jpg', durationSec: 42 },
      card: { title: 'Anh Minh Gara', userId: '123456789', url: 'https://zalo.me/123456789' },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.files?.[0]).toEqual({ name: 'bao-gia.pdf', size: '12.3 MB', ext: 'pdf', url: 'https://f.zalo.me/f/bao-gia.pdf' });
    expect(r.data.voice?.durationSec).toBe(15);
    expect(r.data.card?.userId).toBe('123456789');
  });

  it('accepts a voice without URL (partial capture)', () => {
    const r = messageContentItemSchema.safeParse({ ...base, kind: 'voice', voice: { durationSec: 8 } });
    expect(r.success && r.data.voice).toEqual({ durationSec: 8 });
  });

  it('drops non-https URLs (blob:, http:, javascript:, data:) instead of rejecting the item', () => {
    const r = messageContentItemSchema.safeParse({
      ...base,
      images: ['https://f.zalo.me/a.jpg', 'blob:https://chat.zalo.me/xyz', 'javascript:alert(1)', 'data:image/png;base64,AA'],
      links: ['http://plain.example', 'https://vcparts.vn/oe/1', 'javascript:alert(1)'],
      files: [{ name: 'x.zip', url: 'javascript:alert(1)' }],
      voice: { url: 'blob:https://chat.zalo.me/abc', durationSec: 3 },
      video: { url: 'data:video/mp4;base64,AA', thumb: 'https://f.zalo.me/t.jpg' },
      card: { title: 't', url: 'vbscript:x' },
      voiceUrl: 'blob:https://chat.zalo.me/abc',
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.images).toEqual(['https://f.zalo.me/a.jpg']);
    // Typed links are content: http: is kept, other schemes dropped.
    expect(r.data.links).toEqual(['http://plain.example', 'https://vcparts.vn/oe/1']);
    expect(r.data.files?.[0].url).toBeUndefined();
    expect(r.data.voice?.url).toBeUndefined();
    expect(r.data.video?.url).toBeUndefined();
    expect(r.data.video?.thumb).toBe('https://f.zalo.me/t.jpg');
    expect(r.data.card?.url).toBeUndefined();
    expect(r.data.voiceUrl).toBeUndefined();
  });

  it('rejects unknown kinds, unknown keys and files without a name', () => {
    expect(messageContentItemSchema.safeParse({ ...base, kind: 'weird' }).success).toBe(false);
    expect(messageContentItemSchema.safeParse({ ...base, voice: { durationSec: 1, extra: 1 } }).success).toBe(false);
    expect(messageContentItemSchema.safeParse({ ...base, files: [{ size: '1 MB' }] }).success).toBe(false);
    expect(messageContentItemSchema.safeParse({ ...base, message: 'ciphertext' }).success).toBe(false);
  });

  it('still refuses E2EE material and tokens, including nested inside media objects', () => {
    const { valid, rejected } = validateContentItems([
      { ...base, e2ee_session: 'x' },
      { ...base, voice: { durationSec: 1, access_token: 'y' } },
      { ...base, files: [{ name: 'a.pdf', refresh_token: 'z' }] },
      { ...base, card: { title: 't', cookie: 'c' } },
      { ...base, text: 'ok' },
    ]);
    expect(valid.map((v) => v.index)).toEqual([4]);
    expect(rejected.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    for (const r of rejected) expect(r.reason).toMatch(/^sensitive_field/);
  });

  it('isSafeContentUrl only allows https', () => {
    expect(isSafeContentUrl('https://a.b/c')).toBe(true);
    expect(isSafeContentUrl('HTTPS://a.b/c')).toBe(true);
    expect(isSafeContentUrl('blob:https://a.b/c')).toBe(false);
    expect(isSafeContentUrl('http://a.b')).toBe(false);
    expect(isSafeContentUrl('not a url')).toBe(false);
    expect(isSafeContentUrl(undefined)).toBe(false);
  });
});

describe('message content schema: L5 kinds (M1c-08)', () => {
  it('accepts location, call and reminder, drops a non-https map link', () => {
    const r = messageContentItemSchema.safeParse({
      ...base,
      kind: 'location',
      location: { lat: 21.0285, lng: 105.8542, title: 'Kho test', address: '1 Phố Test', url: 'http://maps.example/x' },
      call: { outcome: 'missed', video: false },
      reminder: { title: 'Hẹn giao hàng', when: '09:00 05/10/2026', at: 1790000000000 },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.location?.url).toBeUndefined();
    expect(r.data.location?.lat).toBe(21.0285);
    expect(r.data.call?.outcome).toBe('missed');
    expect(r.data.reminder?.title).toBe('Hẹn giao hàng');
  });

  it('rejects out-of-range coordinates and unknown call outcomes', () => {
    expect(messageContentItemSchema.safeParse({ ...base, location: { lat: 123, lng: 0 } }).success).toBe(false);
    expect(messageContentItemSchema.safeParse({ ...base, call: { outcome: 'weird' } }).success).toBe(false);
  });
});
