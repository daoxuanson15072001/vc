import { z } from 'zod';
import { OUTBOX_MAX_TEXT } from './outbox';

/**
 * Quick replies ("mẫu câu", BA F3.2): company-wide message templates the
 * Dashboard inserts into the composer with `/shortcut` or from the toolbar.
 * They replace Zalo's own per-account "Tin nhắn nhanh" and "Gửi nhanh số tài
 * khoản" buttons (kind `bank` = a bank account template). Inserting only fills
 * the composer: the user still reads and presses send, which is the approval.
 */

export const QUICK_REPLY_KINDS = ['text', 'bank'] as const;
export type QuickReplyKind = (typeof QUICK_REPLY_KINDS)[number];

/** Variables a template may contain, replaced on insert. */
/** `{ten_nguoi_giu_nick}` (M1b-10, QT-SZ-10): the nick holder's name; equals `{ten_nv}` when the sender holds the nick. */
export const QUICK_REPLY_VARS = ['ten_khach', 'ten_nv', 'ten_nguoi_giu_nick'] as const;
export type QuickReplyVar = (typeof QUICK_REPLY_VARS)[number];

export const QUICK_REPLY_LIMITS = { shortcut: 32, title: 100, text: OUTBOX_MAX_TEXT } as const;

const shortcutRe = /^[a-z0-9_-]{1,32}$/;

export const quickReplyInputSchema = z
  .object({
    /** What the user types after `/` (lowercase letters, digits, `_`, `-`). */
    shortcut: z.string().trim().toLowerCase().regex(shortcutRe, 'phím tắt chỉ gồm chữ thường, số, _ và -'),
    title: z.string().trim().min(1).max(QUICK_REPLY_LIMITS.title),
    text: z.string().trim().min(1).max(QUICK_REPLY_LIMITS.text),
    kind: z.enum(QUICK_REPLY_KINDS).default('text'),
  })
  .strict();
export type QuickReplyInput = z.input<typeof quickReplyInputSchema>;

export const quickReplyPatchSchema = quickReplyInputSchema.partial().strict();
export type QuickReplyPatch = z.input<typeof quickReplyPatchSchema>;

export interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  text: string;
  kind: QuickReplyKind;
  createdBy: string;
  /** ISO timestamp. */
  updatedAt: string;
}

/**
 * Fills `{ten_khach}` / `{ten_nv}` with the given values. An unknown value
 * keeps its placeholder, so the user sees what is still to fill in.
 */
export function renderQuickReply(text: string, vars: Partial<Record<QuickReplyVar, string | null | undefined>>): string {
  return text.replace(/\{(ten_khach|ten_nv|ten_nguoi_giu_nick)\}/g, (m, k: QuickReplyVar) => {
    const v = vars[k]?.trim();
    return v ? v : m;
  });
}

/**
 * The `/shortcut` token being typed right before `caret` (at the start of the
 * text or after whitespace): its start offset and the letters typed so far.
 */
export function matchShortcut(text: string, caret: number): { start: number; query: string } | null {
  const head = text.slice(0, caret);
  const m = /(?:^|\s)\/([a-z0-9_-]*)$/i.exec(head);
  if (!m) return null;
  return { start: caret - m[1].length - 1, query: m[1].toLowerCase() };
}

/** Templates matching a typed query: shortcut prefix first, then title / shortcut contains. */
export function filterQuickReplies<T extends { shortcut: string; title: string }>(list: readonly T[], query: string, limit = 8): T[] {
  const q = query.toLowerCase();
  const starts = list.filter((r) => r.shortcut.startsWith(q));
  const rest = list.filter((r) => !r.shortcut.startsWith(q) && (r.shortcut.includes(q) || r.title.toLowerCase().includes(q)));
  return [...starts, ...rest].slice(0, limit);
}
