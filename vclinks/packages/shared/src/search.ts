import { z } from 'zod';
import { foldVi } from './contact-list';

/**
 * Message search (M1c-05, MH-SZ-14, I2, I4). Keys and query parsing live here so the API, the tests and
 * the web hint ("Gợi ý loại mã") agree on one normalisation: lower case, accent-free (đ -> d), and codes
 * (phone, OE, plate) compacted without spaces, dots or dashes.
 */

export const SEARCH_MIN_CHARS = 2;
/** A phone-only query needs this many digits (MH-SZ-14 #1). */
export const SEARCH_MIN_PHONE_DIGITS = 4;
/** A phone-only query on a channel where the viewer may not see phones must be a whole number (no prefix oracle). */
export const SEARCH_FULL_PHONE_DIGITS = 9;
const MAX_KEYS = 200;
const MAX_KEY_LEN = 40;

export type SearchCodeKind = 'phone' | 'plate' | 'oe';

/** A compacted code in the text, e.g. `0900.123.456` -> `0900123456`. */
export function compactCode(s: string): string {
  return foldVi(s).replace(/[^0-9a-z]/g, '');
}

/** Vietnamese mobile numbers as typed: `+84 900 123 456` and `0900123456` give the same compact key. */
function phoneKeys(digits: string): string[] {
  if (digits.length === 11 && digits.startsWith('84')) return [`0${digits.slice(2)}`, digits];
  if (digits.length === 10 && digits.startsWith('0')) return [digits, `84${digits.slice(1)}`];
  return [digits];
}

/** Plate such as `30A-123.45`, `51F 12345`, `29B1-234.56`: 2 digits, 1-2 letters/digit, then 4-5 digits. */
const PLATE_RE = /\b(\d{2}[a-z][a-z0-9]?)[ .\-]?(\d{3})[ .\-]?(\d{2})\b|\b(\d{2}[a-z][a-z0-9]?)[ .\-]?(\d{4,5})\b/g;
/** Digit groups of a spaced phone: `0900 123 456`. */
const SPACED_PHONE_RE = /(?<![0-9])\+?\d{2,4}(?: \d{2,4}){2,3}(?![0-9])/g;
/** Runs joined by `.` `-` `_` `/` (OE codes `04465-0D130`, dotted phones `0900.123.456`). */
const JOINED_RE = /[0-9a-z]+(?:[.\-_/][0-9a-z]+)+/g;

/**
 * Keys stored in `messages.searchKeys`: every accent-free word, plus compacted codes found in the text.
 * Deterministic, so the API re-derives the keys of the live text to confirm a hit (a stale key never
 * shows erased or edited content).
 */
export function searchKeysOf(text: string | null | undefined): string[] {
  if (!text) return [];
  const f = foldVi(text);
  const keys = new Set<string>();
  const add = (k: string) => {
    if (k && k.length <= MAX_KEY_LEN && keys.size < MAX_KEYS) keys.add(k);
  };
  for (const w of f.split(/[^0-9a-z]+/)) add(w);
  for (const m of f.matchAll(JOINED_RE)) {
    const c = m[0].replace(/[^0-9a-z]/g, '');
    if (c.length >= 4 && /\d/.test(c)) add(c);
  }
  for (const m of f.matchAll(SPACED_PHONE_RE)) {
    const d = m[0].replace(/\D/g, '');
    if (d.length >= 9 && d.length <= 11) phoneKeys(d).forEach(add);
  }
  for (const m of f.matchAll(PLATE_RE)) add(compactCode(m[0]));
  for (const k of [...keys]) if (/^\d{9,11}$/.test(k)) phoneKeys(k).forEach(add);
  return [...keys];
}

export interface SearchTerm {
  /** `word`: a word, matched as a prefix when long enough; `phrase`: quoted, matched as written. */
  kind: 'word' | 'phrase' | 'code';
  /** Accent-free, lower case. For `code`: the compact form. */
  text: string;
  /** Extra compact forms of a code (`+84` form of a phone). */
  alt?: string[];
}

export interface ParsedSearch {
  terms: SearchTerm[];
  /** Whole query is one code: its kind (hint tag, MH-SZ-14 #4), else null. */
  codeKind: SearchCodeKind | null;
  /** The query is only a phone number (digits and separators). */
  phoneOnly: boolean;
  /** Digits of a phone-only query. */
  digits: string;
}

const PHONE_ONLY_RE = /^\+?[\d][\d .\-]*$/;

/**
 * Parses what the user typed. Several words must all be present (any order); `"..."` is an exact phrase;
 * a single phone / plate / OE-like token is looked up by its compact form. Returns null when too short.
 */
export function parseSearchQuery(raw: string): ParsedSearch | null {
  const q = raw.trim();
  if (!q) return null;
  const digits = q.replace(/\D/g, '');
  const phoneOnly = PHONE_ONLY_RE.test(q) && digits.length >= SEARCH_MIN_PHONE_DIGITS;
  if (phoneOnly) {
    const keys = phoneKeys(digits);
    return { terms: [{ kind: 'code', text: keys[0]!, alt: keys.slice(1) }], codeKind: 'phone', phoneOnly: true, digits };
  }
  if (q.replace(/"/g, '').trim().length < SEARCH_MIN_CHARS) return null;
  const terms: SearchTerm[] = [];
  // Quoted phrases first, then spaced phones / plates (several tokens, one code), then the remaining words.
  let rest = q.replace(/"([^"]+)"/g, (_, p: string) => {
    const t = foldVi(p);
    if (t) terms.push({ kind: 'phrase', text: t });
    return ' ';
  });
  rest = foldVi(rest).replace(SPACED_PHONE_RE, (m) => {
    const d = m.replace(/\D/g, '');
    if (d.length < 9 || d.length > 11) return m;
    const keys = phoneKeys(d);
    terms.push({ kind: 'code', text: keys[0]!, alt: keys.slice(1) });
    return ' ';
  });
  rest = rest.replace(PLATE_RE, (m) => {
    terms.push({ kind: 'code', text: compactCode(m) });
    return ' ';
  });
  for (const tok of rest.split(/\s+/)) {
    if (!tok) continue;
    const compact = compactCode(tok);
    const joined = /[.\-_/]/.test(tok) && /\d/.test(compact) && compact.length >= 4;
    if (joined) terms.push({ kind: 'code', text: compact });
    else for (const w of tok.split(/[^0-9a-z]+/)) if (w) terms.push({ kind: 'word', text: w });
  }
  if (!terms.length) return null;
  const only = terms.length === 1 && terms[0]!.kind === 'code' ? terms[0]! : null;
  const codeKind: SearchCodeKind | null = only ? (/^\d{2}[a-z]/.test(only.text) && /\d{4,5}$/.test(only.text) ? 'plate' : 'oe') : null;
  return { terms, codeKind, phoneOnly: false, digits: '' };
}

/** Words shorter than this are matched exactly; longer ones as a prefix (index-friendly anchored regex). */
export const PREFIX_MIN = 3;

/** Whether the live text satisfies every term (used to confirm candidates and to drop stale index hits). */
export function textMatches(text: string, parsed: ParsedSearch): boolean {
  const f = foldVi(text);
  const keys = new Set(searchKeysOf(text));
  const keyList = [...keys];
  return parsed.terms.every((t) => {
    if (t.kind === 'phrase') return f.includes(t.text);
    if (t.kind === 'code') return [t.text, ...(t.alt ?? [])].some((c) => keys.has(c) || (c.length >= SEARCH_MIN_PHONE_DIGITS && keyList.some((k) => k.startsWith(c))));
    return t.text.length < PREFIX_MIN ? keys.has(t.text) : keyList.some((k) => k.startsWith(t.text));
  });
}

/**
 * Character ranges of the original text to bold: folds char by char so the offsets stay valid. Looks for
 * the words / phrases / codes of the query.
 */
export function highlightRanges(text: string, parsed: ParsedSearch): [number, number][] {
  let folded = '';
  const map: number[] = []; // folded index -> original index
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const fc = c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    for (const ch of fc) {
      folded += ch;
      map.push(i);
    }
  }
  const out: [number, number][] = [];
  const find = (needle: string, loose: boolean) => {
    if (!needle) return;
    const pat = loose ? needle.split('').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[ .\\-_/]?') : needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const m of folded.matchAll(new RegExp(loose ? pat : `(?<![0-9a-z])${pat}`, 'g'))) {
      const s = map[m.index!]!;
      const e = (map[m.index! + m[0].length - 1] ?? s) + 1;
      out.push([s, e]);
    }
  };
  for (const t of parsed.terms) {
    if (t.kind === 'code') find(t.text, true);
    else find(t.text, false);
  }
  out.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

export const searchMessagesQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  /** Restrict to some nicks (comma separated) or one conversation (`uid` + `threadId`). */
  uid: z.string().trim().max(500).optional(),
  threadId: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).max(50).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchMessagesQuery = z.infer<typeof searchMessagesQuerySchema>;

export interface SearchHit {
  /** Message id `${uid}:${msgId}`. */
  id: string;
  uid: string;
  threadId: string;
  /** Conversation id `${uid}:${threadId}`: the link target is `/conversations/{id}?msg={msgId}`. */
  conversationId: string;
  msgId: string;
  senderName: string | null;
  fromSelf: boolean;
  sentAt: string;
  /** Excerpt of the (masked) text and the ranges to bold, relative to `snippet`. */
  snippet: string;
  marks: [number, number][];
  /** Voice message already turned into text. */
  voice: boolean;
  /** Conversation title (contact or group name) and the nick it belongs to. */
  title: string;
  accountLabel: string | null;
  accountOwner: string | null;
}

export interface SearchMessagesResponse {
  items: SearchHit[];
  page: number;
  hasMore: boolean;
  tookMs: number;
  codeKind: SearchCodeKind | null;
  /** Set when a phone-only query was too short for a channel whose phones the viewer may not see. */
  note?: string;
}
