/**
 * Message ids for Messenger. The DOM normally exposes no message id, so:
 *
 * 1. If a row carries one of `messageIdAttrs` (a real `mid.$…`), that value is
 *    the id (`idSource: 'dom'`).
 * 2. Otherwise the id is derived deterministically (`idSource: 'derived'`):
 *
 *      d_ + hash64( threadId | anchorMinute | senderKey | signature | occurrence )
 *
 *    - anchorMinute: epoch minute of the nearest time separator above the row,
 *      parsed to an absolute time (time.ts), so relative labels ("Hôm nay",
 *      "Hôm qua", weekday) give the same value on later days.
 *    - senderKey: '0' for the owner, else the sender's profile id, else a hash
 *      of the displayed sender name.
 *    - signature: normalised text + stable file names of images (CDN path tail,
 *      without the expiring query string) + attachment names.
 *    - occurrence: 0,1,2… among rows with the same (anchor, sender, signature)
 *      under that separator — so "ok" sent twice in a block gets two ids.
 *
 * Rows with no separator above them in the rendered DOM have no anchor and are
 * NOT ingested (their id would not be stable). Limits: see
 * docs/04-ky-thuat/kenh/facebook-personal.md §4 (edits → new id, occurrence shift when
 * an earlier identical row is not rendered, locale/format change of labels).
 */

/** 64-bit FNV-1a as two 32-bit lanes (different offsets), hex. Deterministic, no crypto needed. */
export function hash64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000193 + 0x100) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/** Stable part of a CDN URL: last path segment, no query (fbcdn signatures expire). */
export function stableUrlKey(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.split('/').filter(Boolean).pop() ?? '';
    return tail || u.hostname;
  } catch {
    return '';
  }
}

export interface IdParts {
  threadId: string;
  anchor: number;
  senderKey: string;
  signature: string;
  occurrence: number;
}

export function deriveMessageId(p: IdParts): string {
  const minute = Math.floor(p.anchor / 60_000);
  return `d_${hash64([p.threadId, minute, p.senderKey, p.signature, p.occurrence].join('\u0001'))}`;
}

/** Sender key for a display name when no profile id is available. */
export function nameKey(name: string): string {
  return `n_${hash64(name.normalize('NFC').trim().toLowerCase())}`;
}

/** Accepts only id-looking values from DOM attributes. */
export function cleanDomId(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  return /^[\w.$:+=-]{6,120}$/.test(s) ? s : null;
}
