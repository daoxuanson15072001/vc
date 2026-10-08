/**
 * Web-side view types. They extend the shared API types with optional fields
 * that the API is adding (media, previews, outbox). Every extra field is
 * optional so the Dashboard keeps working against an older API.
 */
import type { ConversationInboxFields, ConversationListItem, MessageView } from '@vclinks/shared';

export interface FileMedia {
  name: string;
  /** Bytes, or the size string Zalo displays ("12.3 MB"). */
  size?: number | string | null;
  ext?: string | null;
  url?: string | null;
}

export interface VoiceMedia {
  url?: string | null;
  durationSec?: number | null;
}

export interface VideoMedia {
  url?: string | null;
  thumb?: string | null;
  durationSec?: number | null;
}

export interface CardMedia {
  title?: string | null;
  url?: string | null;
  userId?: string | null;
}

/** Location (msgType 17). Personal data: only shown inside a conversation the viewer can open. */
export interface LocationMedia {
  lat?: number | null;
  lng?: number | null;
  title?: string | null;
  address?: string | null;
  url?: string | null;
}

export interface CallMedia {
  outcome: 'missed' | 'declined' | 'ended' | 'unknown';
  video?: boolean | null;
  durationSec?: number | null;
}

export interface ReminderMedia {
  title?: string | null;
  when?: string | null;
  at?: number | null;
}

export type ContentStatus = 'pending' | 'partial' | 'complete';

export interface ChatMessage extends Omit<MessageView, 'contentStatus'> {
  cliMsgId?: string | null;
  contentStatus?: ContentStatus;
  kind?: string | null;
  images?: string[] | null;
  /** Photos uploaded as bytes (ids for GET /api/media/:id; needs the Bearer token). */
  mediaImages?: string[] | null;
  links?: string[] | null;
  files?: FileMedia[] | null;
  voice?: VoiceMedia | null;
  video?: VideoMedia | null;
  card?: CardMedia | null;
  location?: LocationMedia | null;
  call?: CallMedia | null;
  reminder?: ReminderMedia | null;
}

export interface ChatConversation extends ConversationListItem, ConversationInboxFields {
  /** One-line preview of the last message, when the API provides it. */
  preview?: string | null;
  // lastMessage / memberCount come from the shared ConversationListItem.
}

export interface MessagesPage {
  items: ChatMessage[];
  hasMore: boolean;
  /** With `?around=`: newer messages exist beyond the window. */
  hasNewer?: boolean;
}

export type OutboxStatus = 'approved' | 'sending' | 'sent' | 'failed' | 'expired' | 'awaiting_confirm' | 'needs_reapproval' | 'cancelled';

export interface OutboxItem {
  id: string;
  uid: string;
  threadId: string;
  text: string;
  status: OutboxStatus;
  /** Approver's user id (token name for tokens without a user). */
  approvedBy: string;
  /** "Duyệt bởi" display name (M1b-10). */
  approvedByName?: string;
  approvedAt: string;
  /** Sent on someone else's nick (QT-SZ-10): trả lời thay / trực thay, and the holder's name. */
  sendSource?: 'tra_loi_thay' | 'truc_thay';
  onBehalfOfName?: string;
  /** needs_reapproval: why (PQ-51). */
  holdReason?: 'approver_offboarded' | 'approver_locked' | 'holder_changed' | 'approver_no_send';
  sentAt?: string | null;
  cliMsgId?: string | null;
  /** All cliMsgIds of a multi-line send (absent on older items). */
  cliMsgIds?: string[] | null;
  error?: string | null;
  createdAt: string;
  /** cliMsgId of the message this one replies to. */
  replyToCliMsgId?: string | null;
  /** Command (absent = plain text): send_images, send_file, send_card, create_poll, react, pin_conversation, mark_read, mark_unread. */
  action?: string | null;
  reaction?: { cliMsgId: string; icon: string } | null;
  pin?: boolean | null;
  /** Last status change, for "Treo {n} phút". */
  statusAt?: string;
  /** Sender attempts ("thử {n} lần"). */
  attempts?: number;
  cancelReason?: 'user' | 'copied';
  /** Conversation display name (GET /outbox). */
  name?: string;
  /** awaiting_confirm: newest message sent from the phone after the item was created (SZ-28 d). */
  phoneDuplicate?: { at: string; preview: string };
}
