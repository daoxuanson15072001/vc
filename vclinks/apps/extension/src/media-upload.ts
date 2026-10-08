import { MESSAGE_MEDIA_MAX_BYTES, type MessageMediaResult, type MessageMediaUpload } from '@vclinks/shared';

/**
 * Uploads message photos that Zalo Web only has as `blob:` object URLs
 * (photos of encrypted chats are decrypted in the page). The bytes are read
 * as soon as a bubble is seen, because the object URL can be revoked when the
 * virtual list unmounts the bubble, then uploaded one at a time.
 *
 * Only raster images whose magic bytes match are sent; the server checks again.
 * No chrome.* here: fetch/upload are injected, so it is unit-tested.
 */

export interface BlobPhoto {
  cliMsgId: string;
  /** Position in the bubble (album order). */
  index: number;
  url: string;
  /**
   * DOM-only mode (fetch requests): the account and placement are known, so
   * the API may create the message when IndexedDB no longer has it.
   */
  uid?: string;
  dom?: NonNullable<MessageMediaUpload['dom']>;
  /** Checked right before upload: false drops `dom` (the run found the wrong chat on screen). */
  domValid?: () => boolean;
}

export interface MediaUploaderDeps {
  /** Reads an object URL (the page's fetch, from the content script). */
  read: (url: string) => Promise<Blob>;
  /** Accounts to try, in order; the first that knows the cliMsgId wins. */
  uids: () => Promise<string[]>;
  upload: (body: MessageMediaUpload) => Promise<MessageMediaResult>;
  now?: () => number;
  log?: (m: string) => void;
}

/** Mime from magic bytes (the blob's declared type can be empty). */
export function sniffImageMime(b: Uint8Array): MessageMediaUpload['mime'] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 6 && /^GIF8[79]a$/.test(ascii(0, 6))) return 'image/gif';
  return null;
}

/** Base64 of bytes, chunked so large photos do not overflow the call stack. */
export function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

export function createMediaUploader(deps: MediaUploaderDeps) {
  const now = deps.now ?? Date.now;
  // `${cliMsgId}:${url}` already queued this session.
  const seen = new Set<string>();
  let chain: Promise<unknown> = Promise.resolve();
  const stats = { queued: 0, uploaded: 0, unmatched: 0, skipped: 0, failed: 0 };

  async function send(p: BlobPhoto, bytes: Promise<Uint8Array | null>) {
    const b = await bytes;
    if (!b) return void stats.failed++;
    const mime = sniffImageMime(b);
    if (!mime || b.length > MESSAGE_MEDIA_MAX_BYTES) return void stats.skipped++;
    const body: MessageMediaUpload = {
      uid: '',
      cliMsgId: p.cliMsgId,
      index: p.index,
      mime,
      dataBase64: toBase64(b),
      capturedAt: now(),
    };
    if (p.dom && (p.domValid?.() ?? true)) body.dom = p.dom;
    for (const uid of p.uid ? [p.uid] : await deps.uids()) {
      const r = await deps.upload({ ...body, uid });
      if (r.matched) return void stats.uploaded++;
    }
    stats.unmatched++;
  }

  return {
    stats,
    /** Queues photos; bytes are read right away, uploads run one at a time. Returns how many were new. */
    add(photos: BlobPhoto[]): number {
      let added = 0;
      for (const p of photos) {
        const key = `${p.cliMsgId}:${p.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        added++;
        stats.queued++;
        const bytes = deps
          .read(p.url)
          .then(async (blob) => new Uint8Array(await blob.arrayBuffer()))
          .catch((e) => {
            deps.log?.(`VClinks media: could not read a photo: ${errMsg(e)}`);
            return null;
          });
        chain = chain
          .then(() => send(p, bytes))
          .catch((e) => {
            stats.failed++;
            deps.log?.(`VClinks media: upload failed: ${errMsg(e)}`);
          });
      }
      return added;
    },
    /** Resolves when everything queued so far is done. */
    idle(): Promise<void> {
      return chain.then(() => undefined);
    },
  };
}

export type MediaUploader = ReturnType<typeof createMediaUploader>;

/** Blob photos of extracted messages, in bubble order (with placement in DOM-only mode). */
export function blobPhotosOf(
  msgs: { cliMsgId: string; direction?: 'in' | 'out'; senderName?: string; blobImages?: string[] }[],
  target?: { uid: string; threadId: string; valid?: () => boolean },
): BlobPhoto[] {
  return msgs.flatMap((m) =>
    (m.blobImages ?? []).map((url, index) => ({
      cliMsgId: m.cliMsgId,
      index,
      url,
      ...(target
        ? {
            uid: target.uid,
            ...(target.valid ? { domValid: target.valid } : {}),
            dom: {
              threadId: target.threadId,
              direction: m.direction ?? 'in',
              ...(m.senderName ? { senderName: m.senderName } : {}),
            },
          }
        : {}),
    })),
  );
}
