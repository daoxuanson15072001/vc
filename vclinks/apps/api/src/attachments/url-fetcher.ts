import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type FetchFailure = 'blocked' | 'expired' | 'too_large' | 'network';

export class AttachmentFetchError extends Error {
  constructor(readonly reason: FetchFailure) {
    super(reason);
  }
}

/**
 * Hosts the server may download from: Zalo CDN only (an arbitrary URL in a message must never make the server fetch it).
 * dlfl.vn, flchat.vn: Zalo's file CDN. A `share.file` link (`file-stal-*.dlfl.vn`) redirects to `file-stal-*.flchat.vn`,
 * then to a regional `*.flchat.vn` host (seen on links from zca-js, 06/10/2026); every hop is checked.
 */
const DEFAULT_HOSTS = 'zdn.vn,zadn.vn,zalo.me,zaloapp.com,dlfl.vn,flchat.vn';

export function allowedHost(url: URL): boolean {
  const hosts = (process.env.ATTACHMENT_FETCH_HOSTS || DEFAULT_HOSTS).split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  const h = url.hostname.toLowerCase();
  if (!hosts.some((s) => h === s || h.endsWith(`.${s}`))) return false;
  // Plain http only for tests / lab (explicit switch).
  return url.protocol === 'https:' || (url.protocol === 'http:' && process.env.ATTACHMENT_FETCH_ALLOW_HTTP === '1');
}

/** Loopback, private, link-local, CGNAT, multicast and other non-public addresses (v4 and v6). */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return isPrivateAddress(mapped[1]);
    return s === '::' || s === '::1' || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || s.startsWith('ff') || s.startsWith('64:ff9b:');
  }
  return true;
}

/**
 * The host of an allowed name must resolve to public addresses only (a CDN name pointed at an internal IP,
 * DNS rebinding). Checked on every hop; fetch resolves again, so this narrows the window, it does not close it.
 * Lab / tests may point an allowed name at localhost with ATTACHMENT_FETCH_ALLOW_PRIVATE=1.
 */
async function assertPublicHost(url: URL): Promise<void> {
  if (process.env.ATTACHMENT_FETCH_ALLOW_PRIVATE === '1') return;
  let addrs: { address: string }[];
  try {
    addrs = await lookup(url.hostname, { all: true });
  } catch {
    throw new AttachmentFetchError('network');
  }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new AttachmentFetchError('blocked');
}

/** Downloads one file of a message from its (expiring) link into memory, with host allow-list and size cap. */
@Injectable()
export class UrlFetcher {
  async fetchBytes(rawUrl: string, maxBytes: number): Promise<{ buf: Buffer; mime: string | null }> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new AttachmentFetchError('blocked');
    }
    for (let hop = 0; hop < 4; hop++) {
      if (!allowedHost(url)) throw new AttachmentFetchError('blocked');
      await assertPublicHost(url);
      let res: Response;
      try {
        res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
      } catch {
        throw new AttachmentFetchError('network');
      }
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        try {
          url = new URL(res.headers.get('location')!, url);
        } catch {
          throw new AttachmentFetchError('blocked');
        }
        continue;
      }
      if ([401, 403, 404, 410].includes(res.status)) throw new AttachmentFetchError('expired');
      if (!res.ok || !res.body) throw new AttachmentFetchError('network');
      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > maxBytes) throw new AttachmentFetchError('too_large');
      const chunks: Buffer[] = [];
      let total = 0;
      try {
        for await (const c of res.body as unknown as AsyncIterable<Uint8Array>) {
          total += c.byteLength;
          if (total > maxBytes) throw new AttachmentFetchError('too_large');
          chunks.push(Buffer.from(c));
        }
      } catch (e) {
        if (e instanceof AttachmentFetchError) throw e;
        throw new AttachmentFetchError('network');
      }
      return { buf: Buffer.concat(chunks), mime: res.headers.get('content-type')?.split(';')[0]?.trim() || null };
    }
    throw new AttachmentFetchError('blocked');
  }
}
