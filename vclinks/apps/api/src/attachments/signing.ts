import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';

/** Signed, expiring link payload (upload URL or download link). */
export interface LinkPayload {
  /** put = upload URL, get = download link. */
  k: 'put' | 'get';
  /** Attachment id. */
  id: string;
  tenant: string;
  /** Expiry, epoch seconds. */
  exp: number;
}

// Without a configured key, links die with the process: acceptable (they live 10-15 minutes).
const FALLBACK_KEY = randomBytes(32);

function key(): Buffer {
  const k = process.env.ATTACHMENT_SIGNING_KEY || process.env.CREDENTIALS_KEY;
  return k ? createHmac('sha256', 'vclinks-attachment-link').update(k).digest() : FALLBACK_KEY;
}

const mac = (body: string) => createHmac('sha256', key()).update(body).digest('base64url');

export function signLink(p: LinkPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  return `${body}.${mac(body)}`;
}

/** Verifies signature, kind and expiry; every failure is the same 403 (no hints). */
export function verifyLink(token: string, kind: LinkPayload['k'], nowMs = Date.now()): LinkPayload {
  const refuse = () => new ForbiddenException('Liên kết không hợp lệ hoặc đã hết hạn');
  const [body, sig] = String(token).split('.');
  if (!body || !sig) throw refuse();
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) throw refuse();
  let p: LinkPayload;
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LinkPayload;
  } catch {
    throw refuse();
  }
  if (p.k !== kind || typeof p.id !== 'string' || typeof p.tenant !== 'string' || !(p.exp * 1000 > nowMs)) throw refuse();
  return p;
}
