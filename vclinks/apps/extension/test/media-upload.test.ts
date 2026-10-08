import { describe, expect, it, vi } from 'vitest';
import type { MessageMediaUpload } from '@vclinks/shared';
import { blobPhotosOf, createMediaUploader, sniffImageMime, toBase64 } from '../src/media-upload';

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);
const blobOf = (b: Uint8Array) => new Blob([new Uint8Array(b)]);

describe('sniffImageMime / toBase64', () => {
  it('recognises raster images by magic bytes only', () => {
    expect(sniffImageMime(JPG)).toBe('image/jpeg');
    expect(sniffImageMime(PNG)).toBe('image/png');
    expect(sniffImageMime(new TextEncoder().encode('RIFF1234WEBPVP8 '))).toBe('image/webp');
    expect(sniffImageMime(new TextEncoder().encode('GIF89a...'))).toBe('image/gif');
    expect(sniffImageMime(new TextEncoder().encode('<svg xmlns="..."/>'))).toBeNull();
  });
  it('encodes large buffers without overflowing the stack', () => {
    const big = new Uint8Array(300_000).fill(65);
    expect(toBase64(big)).toBe(Buffer.from(big).toString('base64'));
  });
});

describe('createMediaUploader', () => {
  function setup(known: Record<string, string[]>, files: Record<string, Uint8Array>) {
    const sent: MessageMediaUpload[] = [];
    const up = createMediaUploader({
      read: vi.fn(async (url: string) => {
        if (!files[url]) throw new Error('revoked');
        return blobOf(files[url]);
      }),
      uids: async () => Object.keys(known),
      upload: vi.fn(async (b: MessageMediaUpload) => {
        sent.push(b);
        return known[b.uid]?.includes(String(b.cliMsgId)) ? { matched: true, mediaId: 'x' } : { matched: false };
      }),
      now: () => 42,
    });
    return { up, sent };
  }

  it('uploads album photos in order to the account that knows the message, once per session', async () => {
    const { up, sent } = setup({ a: [], b: ['c1'] }, { 'blob:1': JPG, 'blob:2': PNG });
    const photos = blobPhotosOf([{ cliMsgId: 'c1', blobImages: ['blob:1', 'blob:2'] }, { cliMsgId: 'c2' }]);
    expect(up.add(photos)).toBe(2);
    expect(up.add(photos)).toBe(0); // re-render of the same bubble
    await up.idle();
    const toB = sent.filter((s) => s.uid === 'b');
    expect(toB.map((s) => [s.index, s.mime])).toEqual([
      [0, 'image/jpeg'],
      [1, 'image/png'],
    ]);
    expect(toB[0]).toMatchObject({ cliMsgId: 'c1', capturedAt: 42, dataBase64: toBase64(JPG) });
    expect(up.stats).toMatchObject({ queued: 2, uploaded: 2, unmatched: 0 });
  });

  it('skips non-images and counts revoked URLs, without stopping the queue', async () => {
    const { up, sent } = setup({ a: ['c1'] }, { 'blob:ok': JPG, 'blob:svg': new TextEncoder().encode('<svg/>') });
    up.add([
      { cliMsgId: 'c1', index: 0, url: 'blob:gone' },
      { cliMsgId: 'c1', index: 1, url: 'blob:svg' },
      { cliMsgId: 'c1', index: 2, url: 'blob:ok' },
    ]);
    await up.idle();
    expect(sent.map((s) => s.index)).toEqual([2]);
    expect(up.stats).toMatchObject({ failed: 1, skipped: 1, uploaded: 1 });
  });
});

describe('blobPhotosOf with a fetch target', () => {
  it('pins the account and carries the placement so the API can create DOM-only messages', () => {
    const [p] = blobPhotosOf([{ cliMsgId: '9', direction: 'in', senderName: 'An', blobImages: ['blob:x'] }], {
      uid: 'u1',
      threadId: 'g9',
    });
    expect(p).toEqual({ cliMsgId: '9', index: 0, url: 'blob:x', uid: 'u1', dom: { threadId: 'g9', direction: 'in', senderName: 'An' } });
  });

  it('uploads only to the pinned account', async () => {
    const sent: MessageMediaUpload[] = [];
    const up = createMediaUploader({
      read: async () => new Blob([new Uint8Array(JPG)]),
      uids: async () => ['other', 'u1'],
      upload: async (b) => {
        sent.push(b);
        return { matched: true };
      },
    });
    up.add(blobPhotosOf([{ cliMsgId: '9', blobImages: ['blob:x'] }], { uid: 'u1', threadId: 'g9' }));
    await up.idle();
    expect(sent.map((s) => s.uid)).toEqual(['u1']);
    expect(sent[0].dom).toEqual({ threadId: 'g9', direction: 'in' });
  });
});

describe('DOM placement validity', () => {
  it('drops the placement of queued photos once the run found the wrong chat', async () => {
    const sent: MessageMediaUpload[] = [];
    let ok = true;
    const up = createMediaUploader({
      read: async () => new Blob([new Uint8Array(JPG)]),
      uids: async () => [],
      upload: async (b) => {
        sent.push(b);
        return { matched: false };
      },
    });
    up.add(blobPhotosOf([{ cliMsgId: '9', blobImages: ['blob:x'] }], { uid: 'u1', threadId: 'g9', valid: () => ok }));
    ok = false;
    await up.idle();
    expect(sent[0].dom).toBeUndefined();
  });
});
