import { z } from 'zod';
import { maskEmail, maskPhone } from './permissions';

/**
 * Phone numbers and emails typed inside a message body (L-02, NĐ 13/2023): a person who may not see the
 * customer's phone must not read it from the text either. The detector errs on the side of masking: any run
 * that looks like a Vietnamese phone number (0xx, +84, 84; spaces, dots or dashes allowed between digits)
 * and any email address. Plain dates, times and short numbers do not match; a long order code that happens
 * to look like a phone number is masked too, which is acceptable (the "Hiện" button still shows it).
 */
const SEP = '[\\s.\\-]?';
// The look-behind makes a local part start only at the beginning of a run: without it every position inside a long
// run of letters / digits rescans to the end of the run (quadratic: a 100 kB message took 8 s, ReDoS).
const EMAIL_SRC = '(?<![A-Za-z0-9._%+\\-])[A-Za-z0-9._%+\\-]+@[A-Za-z0-9\\-]+(?:\\.[A-Za-z0-9\\-]+)*\\.[A-Za-z]{2,}';
// +84 / 84 / 0, then a mobile prefix (3,5,7,8,9) with 8 more digits, or an area code 2x with 8 more digits.
const PHONE_SRC = `(?<![\\d+])(?:\\+?84|0)${SEP}(?:[35789]|2\\d)(?:${SEP}\\d){8}(?!\\d)`;
const CONTACT_SRC = `${EMAIL_SRC}|${PHONE_SRC}`;

export type TextContactKind = 'phone' | 'email';
export interface TextContactSpan {
  kind: TextContactKind;
  start: number;
  end: number;
  value: string;
}

/** Phones and emails of a text, in order of appearance (the index is what "Hiện" sends back). */
export function findContactsInText(text: string | null | undefined): TextContactSpan[] {
  if (!text) return [];
  const out: TextContactSpan[] = [];
  for (const m of text.matchAll(new RegExp(CONTACT_SRC, 'g'))) {
    const value = m[0];
    out.push({ kind: value.includes('@') ? 'email' : 'phone', start: m.index ?? 0, end: (m.index ?? 0) + value.length, value });
  }
  return out;
}

/** Same text with every phone / email replaced by its masked form (`0900 *** 950`, `ga***@example.vn`). */
export function maskContactsInText(text: string): { text: string; count: number } {
  const spans = findContactsInText(text);
  if (!spans.length) return { text, count: 0 };
  let out = '';
  let at = 0;
  for (const s of spans) {
    out += text.slice(at, s.start) + (s.kind === 'email' ? maskEmail(s.value) : maskPhone(s.value));
    at = s.end;
  }
  return { text: out + text.slice(at), count: spans.length };
}

const MASKED_RE = /\d{4} \*\*\* \d{3}|[^\s@*]{1,2}\*\*\*@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}/g;

export interface MaskedTextPart {
  text: string;
  /** Index among the masked contacts of the message (what `POST /api/reveal/message` takes); absent for plain text. */
  maskIndex?: number;
  kind?: TextContactKind;
}

/** Splits an already masked text into plain parts and masked contacts, for the "Hiện" buttons. */
export function splitMaskedText(text: string, count: number): MaskedTextPart[] {
  const parts: MaskedTextPart[] = [];
  let at = 0;
  let k = 0;
  for (const m of text.matchAll(MASKED_RE)) {
    if (k >= count) break;
    const i = m.index ?? 0;
    if (i > at) parts.push({ text: text.slice(at, i) });
    parts.push({ text: m[0], maskIndex: k++, kind: m[0].includes('@') ? 'email' : 'phone' });
    at = i + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

/** `POST /api/reveal/message`: show the `index`-th masked phone / email of one message (logged, never with the value). */
export const revealMessageInputSchema = z
  .object({
    messageId: z.string().min(1).max(300),
    index: z.number().int().min(0).max(200),
    where: z.string().max(100).optional(),
    action: z.enum(['view', 'copy', 'call']).default('view'),
  })
  .strict();
export type RevealMessageInput = z.infer<typeof revealMessageInputSchema>;
