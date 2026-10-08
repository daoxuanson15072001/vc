import type { FieldMappingSpec } from './mapping';
import type { Channel } from './channels';
import type { Stream } from './schemas';
import type { AccountSession } from './session';

/** Response shapes of the REST API, shared by the Dashboard and the extension. */

export interface StreamStatus {
  stream: Stream;
  /** Records in the IndexedDB store at the last extension report. */
  sourceCount: number | null;
  sourceCountAt: string | null;
  /** Records stored in MongoDB for this account. */
  dbCount: number;
  cursor: number | null;
  lastIngestAt: string | null;
}

export interface AccountStatus {
  uid: string;
  channel: Channel;
  label: string;
  ownerName?: string;
  lastSyncAt: string | null;
  /** Web session health from the driver watchdog; null = never reported. */
  session: AccountSession | null;
  streams: StreamStatus[];
  openDrifts: number;
}

export interface CheckpointResponse {
  uid: string;
  stream: Stream;
  cursor: number | null;
  /** Source records counted by the previous run (null = never reported). */
  sourceCount?: number | null;
}

export interface ConversationListItem {
  id: string;
  uid: string;
  channel: Channel;
  threadId: string;
  type: 'user' | 'group';
  name: string | null;
  avatar: string | null;
  lastMsgAt: string | null;
  unread: number | null;
  messageCount: number;
  /** Name/avatar came from an encrypted contact record and are withheld. */
  encrypted?: boolean;
  /** Pinned on Zalo Web (`conversation.pinned`). */
  pinned?: boolean;
  /** Zalo label (thẻ phân loại) of the conversation: id from the store, name/colour from the sidebar. */
  label?: { id: string | null; name: string; color: string | null };
  /** Groups only, from `groups.memberIds`. */
  memberCount?: number;
  /** Plaintext preview of the last message (absent while it is still ciphertext). */
  lastMessage?: { text: string | null; fromUid: string | null; senderName: string | null };
}

export interface MessageView {
  /**
   * The nick moved to the direct mode while this message still waited for its content: there is no Zalo Web left to
   * read it from (plan P4), so "Đang chờ nội dung" would wait forever.
   */
  contentGone?: boolean;
  id: string;
  msgId: string;
  /** Joins the message to DOM captures and to sent outbox items. */
  cliMsgId?: string | null;
  threadId: string;
  fromUid: string;
  senderName: string | null;
  msgType: string | null;
  text: string | null;
  /** Phones / emails typed in `text` that were masked for this viewer (L-02); `textRevealable` = a "Hiện" button may be shown. */
  textMasked?: number;
  textRevealable?: boolean;
  content?: unknown;
  sentAt: string;
  /** Metadata-only record: text/senderName/content are withheld (ciphertext at rest). */
  encrypted?: boolean;
  /** 'pending' = content still to be captured from the DOM; 'partial' = captured but incomplete (e.g. voice without URL). */
  contentStatus?: 'pending' | 'partial' | 'complete';
  /** Recalled on Zalo (thu hồi); text/content keep what was captured before the recall. */
  recalled?: boolean;
  /** Part of an album whose photos are all shown on this message id (the album's first message). */
  albumOf?: string;
  /**
   * The message this one replies to (Zalo "Trả lời"): from the stored quote
   * reference or from the outbox item that sent it. Text/sender are filled
   * only when the quoted message is stored in plaintext.
   */
  quote?: QuoteView;
  /** Zalo delivery state of an own message (3 = "Đã gửi"). */
  status?: number;
  /** Self-destruct timer (ms) when the chat has "Tin nhắn tự xóa" on. */
  ttl?: number;
  forwarded?: boolean;
  /** Group system event line (member added/left, rename…). */
  systemEvent?: { act: string; actorId?: string | null; memberIds?: string[] };
  /** @mentions as Zalo stores them: offsets into the message text. */
  mentions?: { uid: string; pos: number; len: number }[];
  reactions?: ReactionsView;
  /** 00 §3.3a: the nick's own message that VClinks did not send ("Gửi từ điện thoại"). */
  fromPhone?: boolean;
  /** Files of the message kept in the company store (M1c-04); voice notes carry their transcript state. */
  attachments?: import('./attachments').AttachmentView[];
}

export interface ReactionsView {
  total: number;
  /** Per icon, most used first. `emoji` is the picker glyph for Zalo's icon id. */
  icons: { icon: string; emoji: string; count: number }[];
  /** Icon id this account reacted with, if any (Zalo stores it under uid "0"). */
  mine: string | null;
}

export interface QuoteView {
  cliMsgId: string | null;
  msgId: string | null;
  fromUid: string | null;
  senderName: string | null;
  /** First line(s) of the quoted text, or a kind label such as "[Hình ảnh]". */
  text: string | null;
}

/** One contact as seen from one account (GET /api/contacts/:uid/:userId). */
export interface ContactProfile {
  uid: string;
  userId: string;
  channel: Channel;
  /** Best plaintext name: contact record, else the latest DOM sender name, else the 1-1 chat name. */
  displayName: string | null;
  zaloName: string | null;
  username: string | null;
  phone: string | null;
  avatar: string | null;
  isFriend: boolean | null;
  isOA: boolean | null;
  /** The contact record exists but its text fields are Zalo ciphertext (withheld). */
  encrypted: boolean;
  /** No contact record at all (e.g. a group member who is not a friend). */
  known: boolean;
  lastActionTime: string | null;
  role: string | null;
  roleSource: string | null;
  division: string | null;
  orgEmail: string | null;
  orgDepartment: string | null;
  tags: string[];
  notes: string | null;
  /** Conversation id (`uid:threadId`) of the 1-1 chat with this contact, when stored. */
  directConversationId: string | null;
  /** Groups of this account the contact belongs to (by member list), newest activity first. */
  commonGroups: { id: string; name: string | null }[];
  /** Messages the contact sent, across this account / within `threadId` when given. */
  stats: { messages: number; inThread: number | null; firstAt: string | null; lastAt: string | null };
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export type MappingStatus = 'proposed' | 'active' | 'rejected' | 'superseded';

export interface FieldMappingRecord {
  id: string;
  version: number;
  status: MappingStatus;
  spec: FieldMappingSpec;
  note?: string;
  proposedBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface DriftRecord {
  id: string;
  uid: string;
  stream: Stream;
  mappingVersion: number;
  kind: string;
  missing: string[];
  observedKeys: string[];
  observedStores: string[];
  sampleSize: number;
  failedCount: number;
  status: 'open' | 'resolved';
  at: string;
}

/** What the login page may offer (GET /api/auth/config). */
export interface AuthConfig {
  ssoEnabled: boolean;
  tokenLogin: boolean;
}

/** One dashboard sign-in of the current user ("Phiên đăng nhập", Hồ sơ của tôi). */
export interface MySession {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  /** Browser and system read from the sign-in request, e.g. "Chrome · Windows"; null when unknown. */
  device: string | null;
  /** The session of this request. */
  current: boolean;
}

export interface WhoAmI {
  name: string;
  scopes: string[];
  /** Signed-in user id (absent for tokens without a user); outbox `approvedBy` holds it (M1b-10). */
  userId?: string;
}
