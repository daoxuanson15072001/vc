import { NON_MESSAGE_ACTIONS } from '@vclinks/shared';
import type { ChatMessage, OutboxItem } from '../types';
import { dayKey } from './time';

/** Self uids Zalo Web writes in `fromUid` for outgoing messages. Keep in sync with packages/shared mapping.ts. */
export const SELF_UIDS = new Set(['0', '-1']);

/** Consecutive messages from the same sender within this gap form one run. */
export const RUN_GAP_MS = 5 * 60 * 1000;

export function isOwnMessage(fromUid: string | null | undefined, accountUid: string): boolean {
  if (!fromUid) return false;
  return fromUid === accountUid || SELF_UIDS.has(fromUid);
}

export interface LayoutItem<T> {
  item: T;
  /** Render a day separator before this item (label key = day). */
  daySeparator: string | null;
  /** First message of a run: show sender name + avatar. */
  firstInRun: boolean;
  /** Last message of a run: show the time. */
  lastInRun: boolean;
}

interface Groupable {
  sentAt: string;
  senderKey: string;
}

/**
 * Splits a chronological list into day sections and sender runs.
 * A run breaks on a different sender, a gap over 5 minutes, or a new day.
 */
export function layoutMessages<T extends Groupable>(items: T[]): LayoutItem<T>[] {
  const out: LayoutItem<T>[] = [];
  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    const prev = items[i - 1];
    const next = items[i + 1];
    const day = dayKey(cur.sentAt);
    const newDay = !prev || dayKey(prev.sentAt) !== day;
    out.push({
      item: cur,
      daySeparator: newDay ? day : null,
      firstInRun: newDay || !sameRun(prev, cur),
      lastInRun: !next || dayKey(next.sentAt) !== day || !sameRun(cur, next),
    });
  }
  return out;
}

function sameRun(a: Groupable, b: Groupable): boolean {
  if (a.senderKey !== b.senderKey) return false;
  const gap = Math.abs(new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  return gap <= RUN_GAP_MS;
}

/** Up to two initials for an avatar fallback ("Nguyễn Văn An" → "VA"; Zalo uses the last words). */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const pick = words.length === 1 ? [words[0]] : words.slice(-2);
  return pick
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toUpperCase();
}

/** Muted fallback avatar tones: light background + dark text of the same hue (text contrast ≥ 7:1). */
const AVATAR_COLORS: { bg: string; fg: string }[] = [
  { bg: '#dbe8ff', fg: '#0b3d91' },
  { bg: '#ede6da', fg: '#5a4a2e' },
  { bg: '#e3e6ee', fg: '#2e3a57' },
  { bg: '#e7e2ec', fg: '#4b3a5c' },
  { bg: '#dde8df', fg: '#24563a' },
  { bg: '#f1e3dd', fg: '#6b2f1e' },
  { bg: '#e6e3f3', fg: '#3b2f6b' },
  { bg: '#e0e9f0', fg: '#1f4459' },
];

/** Stable colors per key so the same contact always gets the same fallback avatar. */
export function avatarColors(key: string | null | undefined): { bg: string; fg: string } {
  const s = key ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/** Background part of {@link avatarColors}. */
export function avatarColor(key: string | null | undefined): string {
  return avatarColors(key).bg;
}

/** Only allow http(s)/blob URLs from synced data (blocks javascript:, data: html, etc.). */
export function safeUrl(u: string | null | undefined): string | undefined {
  if (!u || typeof u !== 'string') return undefined;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(u, base);
    return ['http:', 'https:', 'blob:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** Bytes → "1,2 MB". */
export function fmtSize(bytes: number | string | null | undefined): string {
  // The extension sends the size as Zalo displays it, e.g. "12.3 MB".
  if (typeof bytes === 'string') return bytes.trim();
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  const n = u === 0 ? String(Math.round(v)) : v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `${n} ${units[u]}`;
}

/** File extension from an explicit ext or the file name, lower-case without the dot. */
export function fileExt(name: string | null | undefined, ext?: string | null): string {
  if (ext) return ext.replace(/^\./, '').toLowerCase();
  const m = /\.([a-z0-9]{1,8})$/i.exec(name ?? '');
  return m ? m[1].toLowerCase() : '';
}

const MATCH_WINDOW_MS = 2 * 60 * 1000;

/**
 * Outbox items still worth showing at the bottom of the thread. A 'sent' item
 * is hidden once its real message(s) show up in the synced list:
 * 1. by cliMsgId(s): hidden when EVERY id (all lines of a multi-line send) is loaded;
 * 2. only when the item has no id at all: own messages with the same text(s)
 *    sent within MATCH_WINDOW_MS. Each real message is consumed by at most one
 *    outbox item, so two identical "ok" sends never hide each other's bubble
 *    with a single message.
 */
export function visibleOutbox(outbox: OutboxItem[], messages: ChatMessage[], accountUid: string): OutboxItem[] {
  const byCli = new Map<string, ChatMessage>();
  for (const m of messages) if (m.cliMsgId) byCli.set(m.cliMsgId, m);
  const own = messages.filter((m) => isOwnMessage(m.fromUid, accountUid) && m.text);
  const consumed = new Set<string>();
  const hidden = new Set<string>();
  const sent = outbox
    .filter((o) => o.status === 'sent' && !(o.action && (NON_MESSAGE_ACTIONS as readonly string[]).includes(o.action)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const idsOf = (o: OutboxItem) => (o.cliMsgIds?.length ? o.cliMsgIds : o.cliMsgId ? [o.cliMsgId] : []);

  // Pass 1: id matches (reliable), they also reserve their real messages.
  for (const o of sent) {
    const ids = idsOf(o);
    if (ids.length && ids.every((id) => byCli.has(id))) {
      hidden.add(o.id);
      for (const id of ids) consumed.add(byCli.get(id)!.id);
    }
  }
  // Pass 2: text fallback for items without any id.
  for (const o of sent) {
    if (hidden.has(o.id) || idsOf(o).length) continue;
    const since = new Date(o.sentAt ?? o.createdAt).getTime() - MATCH_WINDOW_MS;
    const pool = own.filter((m) => !consumed.has(m.id) && new Date(m.sentAt).getTime() >= since);
    // Multi-line text is sent as one Zalo message per line.
    const lines = o.text.split('\n').map((l) => l.trim()).filter(Boolean);
    const wanted = lines.length > 1 ? lines : [o.text.trim()];
    const picked: string[] = [];
    for (const w of wanted) {
      const hit = pool.find((m) => m.text!.trim() === w && !picked.includes(m.id));
      if (!hit) break;
      picked.push(hit.id);
    }
    if (wanted.length > 0 && picked.length === wanted.length) {
      hidden.add(o.id);
      for (const id of picked) consumed.add(id);
    }
  }

  return outbox
    .filter((o) => {
      // "Bỏ lệnh" / "Hủy gửi": the bubble disappears (MH-SZ-03 #38b).
      if (o.status === 'cancelled') return false;
      // Reactions / pin / read marks change state on Zalo, they are not bubbles.
      if (o.action && (NON_MESSAGE_ACTIONS as readonly string[]).includes(o.action)) {
        return o.status === 'failed' || o.status === 'expired' || o.status === 'awaiting_confirm' || o.status === 'needs_reapproval';
      }
      return !hidden.has(o.id);
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Merges message pages, de-duplicated by id, in chronological order. */
export function mergeMessages(...lists: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const list of lists) for (const m of list) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id));
}

/**
 * Splits message text into plain parts and http(s) links. Zalo renders typed
 * links as plain text (no <a>), so the DOM capture has none; the Dashboard
 * makes them clickable. Trailing punctuation stays outside the link.
 */
export function splitLinks(text: string): { text: string; url?: string }[] {
  const out: { text: string; url?: string }[] = [];
  const re = /https?:\/\/[^\s<>"']+/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let raw = m[0];
    const trail = raw.match(/[.,;:!?)\]]+$/)?.[0] ?? '';
    if (trail) raw = raw.slice(0, -trail.length);
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const url = safeUrl(raw);
    out.push(url ? { text: raw, url } : { text: raw });
    last = m.index + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

const QUOTE_PREVIEW_MAX = 160;

/** One-line summary of a message for a quote block: its text, else what it carries. */
export function messageSummary(m: ChatMessage): string {
  const text = m.text?.replace(/\s+/g, ' ').trim();
  if (text) return text.length > QUOTE_PREVIEW_MAX ? `${text.slice(0, QUOTE_PREVIEW_MAX)}…` : text;
  if (m.images?.length || m.mediaImages?.length) return '[Hình ảnh]';
  if (m.video) return '[Video]';
  if (m.voice) return '[Ghi âm]';
  if (m.files?.length) return `[Tệp] ${m.files[0].name}`;
  if (m.card) return '[Danh thiếp]';
  if (m.location) return `[Vị trí] ${m.location.title ?? ''}`.trim();
  if (m.call) return '[Cuộc gọi]';
  if (m.reminder) return `[Nhắc hẹn] ${m.reminder.title ?? ''}`.trim();
  if (m.links?.length) return m.links[0];
  return '[Tin nhắn]';
}

/**
 * The loaded message a quote points to: by cliMsgId / msgId, else (Zalo DOM
 * quotes carry no id) the newest earlier message whose text starts like the
 * quoted text, from the same sender name when known.
 */
export function findQuoted(
  quote: { cliMsgId?: string | null; msgId?: string | null; senderName?: string | null; text?: string | null },
  messages: ChatMessage[],
  before?: string,
): ChatMessage | undefined {
  if (quote.cliMsgId) {
    const hit = messages.find((m) => m.cliMsgId === quote.cliMsgId);
    if (hit) return hit;
  }
  if (quote.msgId) {
    const hit = messages.find((m) => m.msgId === quote.msgId);
    if (hit) return hit;
  }
  const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
  const head = norm(quote.text).slice(0, 40);
  if (!head) return undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (before && m.sentAt >= before) continue;
    if (quote.senderName && m.senderName && norm(m.senderName) !== norm(quote.senderName)) continue;
    if (norm(m.text).startsWith(head)) return m;
  }
  return undefined;
}
