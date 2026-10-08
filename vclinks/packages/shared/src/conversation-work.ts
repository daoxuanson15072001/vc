import { z } from 'zod';

/*
 * Work on a conversation inside VClinks (docs 00 MH-UI-10, 01 §3.1 conv.claim / conv.assign / conv.transfer /
 * conv.note / conv.label): who handles it ("người xử lý"), internal notes the customer never sees, and VClinks
 * labels. None of it goes through the outbox. On a personal nick with a holder the holder always handles the
 * conversation (02 DK-21), so claim / assign / transfer apply to channels without a holder (OA, Fanpage…).
 */

/** Author may edit or delete their note this long after writing it (00 MH-UI-08). */
export const NOTE_EDIT_MINUTES = 15;
export const NOTE_MAX_LEN = 2000;
/** VClinks labels a conversation may carry. */
export const LABELS_PER_CONVERSATION = 5;
/** Colours offered for a VClinks label (antd Tag presets). */
export const LABEL_COLORS = ['blue', 'green', 'orange', 'red', 'purple', 'cyan', 'gold', 'magenta'] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

const userId = z.string().trim().min(1).max(100);

export const conversationAssignSchema = z.object({ userId, reason: z.string().trim().max(300).optional() }).strict();
export type ConversationAssignInput = z.output<typeof conversationAssignSchema>;

/** "Chuyển cho…" always needs a reason (00 MH-UI-10). */
export const conversationTransferSchema = z
  .object({ userId, reason: z.string().trim().min(10, 'Lý do chuyển cần ít nhất 10 ký tự').max(300) })
  .strict();
export type ConversationTransferInput = z.output<typeof conversationTransferSchema>;

export const noteInputSchema = z
  .object({
    text: z.string().trim().min(1, 'Ghi chú trống').max(NOTE_MAX_LEN),
    /** User ids picked with @ (only people who see the conversation are kept). */
    mentions: z.array(userId).max(20).default([]),
  })
  .strict();
export type NoteInput = z.output<typeof noteInputSchema>;

export const notePatchSchema = z.object({ text: z.string().trim().min(1, 'Ghi chú trống').max(NOTE_MAX_LEN) }).strict();

export const labelInputSchema = z.object({ name: z.string().trim().min(1).max(40), color: z.enum(LABEL_COLORS) }).strict();
export type LabelInput = z.output<typeof labelInputSchema>;

export const setLabelsSchema = z.object({ labelIds: z.array(z.string().min(1).max(40)).max(LABELS_PER_CONVERSATION) }).strict();

export const CONVERSATION_EVENT_TYPES = ['claim', 'assign', 'transfer', 'release'] as const;
export type ConversationEventType = (typeof CONVERSATION_EVENT_TYPES)[number];

/** A note or an event line of the thread (`GET /api/conversations/:id/notes`). */
export interface ConversationNote {
  id: string;
  kind: 'note' | 'event';
  /** Note text (null for events). */
  text: string | null;
  mentions: { id: string; name: string }[];
  authorId: string;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
  /** The author may still edit / delete it (within NOTE_EDIT_MINUTES). */
  canEdit: boolean;
  event?: { type: ConversationEventType; toId: string | null; toName: string | null; reason: string | null };
}

/** People who see the conversation: the assign / transfer picker and the @ list of notes. */
export interface ConversationPerson {
  id: string;
  name: string;
  /** Handles the conversation now. */
  handler: boolean;
}

export interface ConversationLabel {
  id: string;
  name: string;
  color: LabelColor;
}

/** Line shown in the thread for an event (00 MH-UI-08 "dòng sự kiện"). */
export function conversationEventText(n: Pick<ConversationNote, 'authorName' | 'event'>): string {
  const e = n.event;
  if (!e) return '';
  if (e.type === 'claim') return `${n.authorName} đã nhận hội thoại`;
  if (e.type === 'release') return `${n.authorName} trả hội thoại về Chưa phân công`;
  if (e.type === 'assign') return `${n.authorName} đã phân công hội thoại cho ${e.toName ?? '?'}${e.reason ? `. Lý do: ${e.reason}` : ''}`;
  return `${n.authorName} đã chuyển hội thoại cho ${e.toName ?? '?'}. Lý do: ${e.reason ?? ''}`;
}
