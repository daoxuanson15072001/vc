import type { ChatMessage } from '../types';

export interface SharedItem {
  id: string;
  msgId: string;
  fromUid: string | null;
  senderName: string | null;
  sentAt: string;
  images?: string[];
  mediaImages?: string[];
  video?: { url?: string | null; thumb?: string | null; durationSec?: number | null };
  files?: { name: string; size?: number | string | null; ext?: string | null; url?: string | null }[];
  links?: string[];
  card?: { title?: string | null; url?: string | null; userId?: string | null };
}

/** Lower-case without Vietnamese accents, so "gia" finds "giá". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * "Tìm trong hội thoại" over the messages already loaded in the chat (MH-SZ-07 #10). It is a stop-gap: the
 * server-side search of M1c-05 replaces it and covers the whole history; until then the panel says so.
 */
export function searchLoaded(messages: ChatMessage[], query: string, limit = 50): ChatMessage[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const out: ChatMessage[] = [];
  for (let i = messages.length - 1; i >= 0 && out.length < limit; i--) {
    const m = messages[i];
    if (m.systemEvent) continue;
    const hay = fold([m.text ?? '', m.senderName ?? '', m.files?.map((f) => f.name).join(' ') ?? '', m.location?.title ?? '', m.reminder?.title ?? ''].join(' '));
    if (hay.includes(q)) out.push(m);
  }
  return out;
}

/** Groups items (newest first) by local day for the Media grid. */
export function groupByDay<T extends { sentAt: string }>(items: T[]): { day: string; items: T[] }[] {
  const out: { day: string; items: T[] }[] = [];
  for (const it of items) {
    const d = new Date(it.sentAt);
    const p = (n: number) => String(n).padStart(2, '0');
    const day = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    const last = out[out.length - 1];
    if (last?.day === day) last.items.push(it);
    else out.push({ day, items: [it] });
  }
  return out;
}
