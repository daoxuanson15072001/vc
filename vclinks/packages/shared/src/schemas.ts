import { z } from 'zod';
import { channelOfUid, channelSchema } from './channels';

/** Max records per ingest batch (REST and MCP). */
export const MAX_BATCH_SIZE = 500;

/** Core streams: every field mapping must define them (v1, 28/09/2026). */
export const CORE_STREAMS = ['contacts', 'groups', 'conversations', 'messages'] as const;
/**
 * Streams added later (night of 28/09/2026: reactions, labels, read state). A
 * mapping may omit them; the extension then skips the stream and the API fills
 * them into the active mapping from the defaults on startup.
 */
export const OPTIONAL_STREAMS = ['reactions', 'labels', 'read_state'] as const;
export const STREAMS = [...CORE_STREAMS, ...OPTIONAL_STREAMS] as const;
export type Stream = (typeof STREAMS)[number];
export const streamSchema = z.enum(STREAMS);

export const CONTACT_ROLES = [
  'khach_hang',
  'dai_ly_gara',
  'nha_cung_cap',
  'nhan_vien',
  'quan_ly',
  'doi_tac',
  'ngan_hang',
  'co_quan_nha_nuoc',
  'gia_dinh_ban_be',
  'oa_doanh_nghiep',
  'khac',
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

/** Zalo uids / ids are numeric strings, but numbers occasionally leak through. */
const zid = z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(128));

/** Epoch millis; Zalo stores `sendDttm` as a numeric string. */
const epochMs = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .pipe(z.number().int().positive());

const optStr = z.string().max(10_000).nullish();
const raw = z.record(z.unknown()).optional();
/** Set by the extension when a record was ingested as metadata only (ciphertext dropped). */
const encrypted = z.boolean().optional();

export const uidSchema = zid;

export const contactItemSchema = z
  .object({
    userId: zid,
    displayName: optStr,
    zaloName: optStr,
    username: optStr,
    phone: optStr,
    avatar: optStr,
    gender: z.union([z.number(), z.string()]).nullish(),
    isFriend: z.boolean().optional(),
    isOA: z.boolean().optional(),
    bizInfo: z.unknown().optional(),
    lastActionTime: epochMs.nullish(),
    encrypted,
    raw,
  })
  .strict();

export const groupItemSchema = z
  .object({
    groupId: zid,
    name: optStr,
    avatar: optStr,
    memberIds: z.array(zid).max(10_000).optional(),
    adminIds: z.array(zid).max(10_000).optional(),
    creatorId: zid.nullish(),
    encrypted,
    raw,
  })
  .strict();

export const conversationItemSchema = z
  .object({
    threadId: zid,
    type: z.enum(['user', 'group']),
    lastMsgAt: epochMs.nullish(),
    unread: z.number().int().min(0).nullish(),
    labels: z.array(z.string().max(200)).max(100).optional(),
    pinned: z.boolean().optional(),
    /** Zalo label (thẻ phân loại) id from `conversation.label`; the name comes from the sidebar DOM. */
    labelId: zid.nullish(),
    raw,
  })
  .strict();

export const messageItemSchema = z
  .object({
    msgId: zid,
    cliMsgId: zid.nullish(),
    threadId: zid,
    fromUid: zid,
    toUid: zid.nullish(),
    senderName: optStr,
    msgType: z.string().max(100).nullish(),
    originMsgType: z.string().max(100).nullish(),
    /** Plain text body, when the Zalo `message` field is a string. */
    text: z.string().max(100_000).nullish(),
    /** Structured body (attachments, stickers, links...), when `message` is an object. */
    content: z.unknown().optional(),
    quote: z.unknown().optional(),
    mentions: z.array(z.unknown()).max(500).nullish(),
    sentAt: epochMs,
    serverTime: epochMs.nullish(),
    e2eeStatus: z.union([z.number(), z.string()]).nullish(),
    syncFromMobile: z.union([z.boolean(), z.number()]).nullish(),
    /**
     * 'pending' = metadata ingested, text/content still to come from the DOM;
     * 'partial' = captured but incomplete (e.g. voice seen before its URL loaded).
     */
    contentStatus: z.enum(['pending', 'partial', 'complete']).optional(),
    /**
     * Where the plaintext came from when the sender is not the extension: 'direct' = the máy Zalo's zca-js
     * listener (docs/01-quan-ly-du-an/ke-hoach-zalo-truc-tiep-zca-js.md). It is what Zalo delivered, so a later
     * metadata-only (encrypted) re-ingest of the same message never wipes it, like a DOM capture.
     */
    contentSource: z.enum(['direct']).optional(),
    /**
     * Zalo delivery state of an own message (`message.status`). The code meaning is
     * UNVERIFIED against real Zalo Web: this comment once said 3 = "Đã gửi", while the
     * Dashboard (ZALO_MSG_STATUS_TEXT) shows 1 = gửi, 2 = nhận, 3 = xem from a 29/09/2026
     * observation. Pending reconciliation with Zalo Web; do not change the mapping before that.
     */
    status: z.number().int().nullish(),
    /** Self-destruct timer in ms (`message.ttl`), 0/absent = none. */
    ttl: z.number().int().min(0).nullish(),
    /** Forwarded from another chat (`message.reference.data.fwLvl` > 0). */
    forwarded: z.boolean().optional(),
    /** Group system event (member added/left, rename...): `act` + actor + affected members. */
    systemEvent: z
      .object({
        act: z.string().max(100),
        actorId: zid.nullish(),
        memberIds: z.array(zid).max(500).optional(),
      })
      .strict()
      .optional(),
    encrypted,
    raw,
  })
  .strict();

/** `r_db_<uid>.reaction`: who reacted with which icon on a message. Keys are uids (or "0" = me). */
export const reactionItemSchema = z
  .object({
    msgId: zid,
    cliMsgId: zid.nullish(),
    threadId: zid,
    /** `{ [reactorUid]: { [iconId]: count } }` exactly as Zalo stores it. */
    reactions: z.record(z.string().max(64), z.record(z.string().max(16), z.number().int().min(0))).optional(),
    /**
     * One reaction event instead of the whole map (direct nicks: zca-js reports reactions one by one).
     * `icon` null = the reactor took their reactions back. The API folds it into the stored map.
     */
    delta: z.object({ reactor: zid, icon: z.string().min(1).max(16).nullable() }).strict().optional(),
    currentIcon: z.number().int().nullish(),
    lastSender: zid.nullish(),
    lastUpdate: epochMs.nullish(),
    raw,
  })
  .strict();

/** `zdb_<uid>.label`: Zalo "thẻ phân loại". `name` is ciphertext at rest, so it arrives from the sidebar DOM instead. */
export const labelItemSchema = z
  .object({
    labelId: zid,
    name: optStr,
    color: z.string().max(50).nullish(),
    emoji: z.string().max(50).nullish(),
    conversationIds: z.array(zid).max(10_000).optional(),
    createdAt: epochMs.nullish(),
    encrypted,
    raw,
  })
  .strict();

/** `msginfo_<uid>.unreadInfo`: the newest message this account has read per thread. */
export const readStateItemSchema = z
  .object({
    threadId: zid,
    lastReadMsgId: zid.nullish(),
    at: epochMs.nullish(),
    raw,
  })
  .strict();

export const itemSchemas = {
  contacts: contactItemSchema,
  groups: groupItemSchema,
  conversations: conversationItemSchema,
  messages: messageItemSchema,
  reactions: reactionItemSchema,
  labels: labelItemSchema,
  read_state: readStateItemSchema,
} as const;

export type ContactItem = z.output<typeof contactItemSchema>;
export type GroupItem = z.output<typeof groupItemSchema>;
export type ConversationItem = z.output<typeof conversationItemSchema>;
export type MessageItem = z.output<typeof messageItemSchema>;
export type ReactionItem = z.output<typeof reactionItemSchema>;
export type LabelItem = z.output<typeof labelItemSchema>;
export type ReadStateItem = z.output<typeof readStateItemSchema>;
export type ItemOf<S extends Stream> = z.output<(typeof itemSchemas)[S]>;

/** Source id of an item, used for `_id = ${uid}:${id}` and reject reports. */
export const ITEM_ID_FIELD: Record<Stream, string> = {
  contacts: 'userId',
  groups: 'groupId',
  conversations: 'threadId',
  messages: 'msgId',
  reactions: 'msgId',
  labels: 'labelId',
  read_state: 'threadId',
};

/** Target field used as incremental-sync cursor (null = always full sync). */
export const STREAM_CURSOR: Record<Stream, string | null> = {
  contacts: 'lastActionTime',
  groups: null,
  conversations: 'lastMsgAt',
  messages: 'sentAt',
  reactions: 'lastUpdate',
  labels: null,
  read_state: 'at',
};

/**
 * Zalo reaction icon ids → emoji, as shown in Zalo Web's picker (👍 ❤️ 😆 😮 😢 😡).
 * Ids observed in `r_db_<uid>.reaction` on 28/09/2026: 0, 3, 5, 20, 32 (2 from the picker order).
 */
export const REACTION_EMOJI: Readonly<Record<string, string>> = {
  '0': '❤️',
  '3': '👍',
  '5': '😆',
  '32': '😮',
  '2': '😢',
  '20': '😡',
};
/** Zalo's own text codes for the same icons (what the picker renders), for the extension's `react` command. */
export const REACTION_CODE: Readonly<Record<string, string>> = {
  '0': '/-heart',
  '3': '/-strong',
  '5': ':>',
  '32': ':o',
  '2': ':-((',
  '20': ':-h',
};

export const ingestBatchSchema = z.object({
  uid: uidSchema,
  /** Items are validated one by one so a bad record never sinks the whole batch. */
  items: z.array(z.unknown()).min(1).max(MAX_BATCH_SIZE),
});

/**
 * Only `https:` URLs are kept from DOM-captured content. Anything else
 * (`blob:` object URLs that die with the tab, `http:`, `data:`, `javascript:`...)
 * is silently dropped rather than rejecting the whole item, so the message
 * itself is never lost because of one bad attribute.
 */
export function isSafeContentUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 4000) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Optional URL: non-https values become undefined. */
const safeUrl = z
  .string()
  .max(4000)
  .nullish()
  .transform((v) => (isSafeContentUrl(v) ? v : undefined));

/** URL list: non-https entries are dropped. */
const safeUrlList = z
  .array(z.string().max(4000))
  .max(200)
  .optional()
  .transform((a) => a?.filter(isSafeContentUrl));

/**
 * Links typed in a message are message content, not resources we fetch, so
 * plain `http:` is kept too; other schemes (`javascript:`, `data:`...) are dropped.
 */
export function isSafeLinkUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 4000) return false;
  try {
    const p = new URL(v).protocol;
    return p === 'https:' || p === 'http:';
  } catch {
    return false;
  }
}

const linkUrlList = z
  .array(z.string().max(4000))
  .max(200)
  .optional()
  .transform((a) => a?.filter(isSafeLinkUrl));

const durationSec = z.number().min(0).max(86_400).optional();

/** Kind of a message as inferred from the rendered bubble. */
export const MESSAGE_CONTENT_KINDS = ['text', 'image', 'voice', 'file', 'video', 'card', 'sticker', 'location', 'call', 'reminder', 'other'] as const;
export type MessageContentKind = (typeof MESSAGE_CONTENT_KINDS)[number];

export const contentFileSchema = z
  .object({
    name: z.string().min(1).max(500),
    /** Size as displayed by Zalo, e.g. "12.3 MB". */
    size: z.string().max(50).optional(),
    ext: z.string().max(20).optional(),
    url: safeUrl,
  })
  .strict();

export const contentVoiceSchema = z.object({ url: safeUrl, durationSec }).strict();

export const contentVideoSchema = z.object({ url: safeUrl, thumb: safeUrl, durationSec }).strict();

/** Business card (danh thiếp) or link preview. */
export const contentCardSchema = z
  .object({
    title: z.string().max(1000).optional(),
    url: safeUrl,
    userId: z.string().max(128).optional(),
  })
  .strict();

/**
 * Location message (msgType 17, M1c-08). Personal data: shown only to whoever can open the conversation,
 * never written to logs. Coordinates are optional because the bubble may show only an address.
 */
export const contentLocationSchema = z
  .object({
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    title: z.string().max(500).optional(),
    address: z.string().max(1000).optional(),
    /** Map link (https only). */
    url: safeUrl,
  })
  .strict();

/** Call line in the chat ("Cuộc gọi nhỡ", "Cuộc gọi đến 02:15"), for CSKH reports (BA C21). */
export const CALL_OUTCOMES = ['missed', 'declined', 'ended', 'unknown'] as const;
export const contentCallSchema = z
  .object({
    outcome: z.enum(CALL_OUTCOMES),
    video: z.boolean().optional(),
    durationSec,
  })
  .strict();

/** Appointment reminder (nhắc hẹn, BA C17): title and the time as written on the bubble. */
export const contentReminderSchema = z
  .object({
    title: z.string().max(1000).optional(),
    /** Time as shown on the bubble (e.g. "09:00 05/10/2026"); `at` holds epoch ms when it could be parsed. */
    when: z.string().max(200).optional(),
    at: epochMs.optional(),
  })
  .strict();

/** Quote block of a reply bubble ("Trả lời"): who and what was quoted, as shown on screen. */
export const contentQuoteSchema = z
  .object({
    senderName: z.string().max(200).optional(),
    text: z.string().max(2000).optional(),
  })
  .strict();

/**
 * One message's content captured from the Zalo Web DOM (what the user already
 * sees on screen), joined to its metadata by `cliMsgId`. This is the only way to
 * read message content, since the IndexedDB copy is ciphertext. No ciphertext,
 * tokens or E2EE material is ever part of this payload.
 */
export const messageContentItemSchema = z
  .object({
    cliMsgId: zid,
    direction: z.enum(['in', 'out']).optional(),
    text: z.string().max(100_000).nullish(),
    images: safeUrlList,
    links: linkUrlList,
    files: z.array(contentFileSchema).max(50).optional(),
    voice: contentVoiceSchema.nullish(),
    video: contentVideoSchema.nullish(),
    card: contentCardSchema.nullish(),
    location: contentLocationSchema.nullish(),
    call: contentCallSchema.nullish(),
    reminder: contentReminderSchema.nullish(),
    /** Reply bubbles: the quoted message, kept out of `text`. */
    quote: contentQuoteSchema.nullish(),
    /** Group bubbles: the sender's display name shown above the first bubble of a run. */
    senderName: z.string().trim().min(1).max(200).optional(),
    kind: z.enum(MESSAGE_CONTENT_KINDS).optional(),
    /** Legacy (pre-media extractor): same as `voice.url`. */
    voiceUrl: safeUrl,
    capturedAt: epochMs,
    schemaVersion: z.string().max(50).optional(),
  })
  .strict();

/** Sender name shown above an incoming bubble (groups), carried to the next bubbles of the run. */
export const domSenderNameSchema = z.string().trim().min(1).max(200).optional();

/** Placement of a photo whose message may exist only in the DOM (see domMessagesBatchSchema). */
export const domPlacementSchema = z
  .object({
    threadId: zid,
    direction: z.enum(['in', 'out']),
    senderName: domSenderNameSchema,
  })
  .strict();

/**
 * One photo of a message uploaded as bytes. Zalo Web shows photos of encrypted
 * chats as `blob:` object URLs (decrypted in the page), which die with the tab,
 * so the extension reads the bytes and uploads them. Raster images only.
 */
export const MESSAGE_MEDIA_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const MESSAGE_MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export const messageMediaUploadSchema = z
  .object({
    uid: uidSchema,
    cliMsgId: zid,
    /** Position of the photo in the bubble (albums), for display order. */
    index: z.number().int().min(0).max(199),
    mime: z.enum(MESSAGE_MEDIA_MIMES),
    /** Base64 of the bytes (≤ 10 MB decoded; checked again server-side). */
    dataBase64: z
      .string()
      .min(8)
      .max(Math.ceil((MESSAGE_MEDIA_MAX_BYTES * 4) / 3) + 8)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    capturedAt: epochMs,
    /** Fetch requests only: create the message from the DOM when its metadata is missing. */
    dom: domPlacementSchema.optional(),
  })
  .strict();
export type MessageMediaUpload = z.input<typeof messageMediaUploadSchema>;

export interface MessageMediaResult {
  /** False when no message with this cliMsgId exists for the account (metadata not synced yet). */
  matched: boolean;
  /** Stored media id (sha256 of the bytes); same bytes ⇒ same id. */
  mediaId?: string;
}

export type ContentFile = z.output<typeof contentFileSchema>;
export type ContentVoice = z.output<typeof contentVoiceSchema>;
export type ContentVideo = z.output<typeof contentVideoSchema>;
export type ContentCard = z.output<typeof contentCardSchema>;
export type ContentQuote = z.output<typeof contentQuoteSchema>;
export type ContentLocation = z.output<typeof contentLocationSchema>;
export type ContentCall = z.output<typeof contentCallSchema>;
export type ContentReminder = z.output<typeof contentReminderSchema>;

/** Shape stored in `messages.content` for DOM-captured content (and returned in MessageView.content). */
export interface MessageContentBody {
  images?: string[];
  /** Photos uploaded as bytes (ids for GET /api/media/:id), in bubble order. */
  mediaImages?: string[];
  links?: string[];
  files?: ContentFile[];
  voice?: ContentVoice;
  video?: ContentVideo;
  card?: ContentCard;
  location?: ContentLocation;
  call?: ContentCall;
  reminder?: ContentReminder;
  quote?: ContentQuote;
  kind?: MessageContentKind;
}

export type MessageContentItem = z.output<typeof messageContentItemSchema>;

export const messageContentBatchSchema = z.object({
  uid: uidSchema,
  items: z.array(z.unknown()).min(1).max(MAX_BATCH_SIZE),
});

/**
 * DOM-only messages: bubbles Zalo Web still shows but whose metadata is gone
 * from IndexedDB (older history). Sent only by a Dashboard fetch request, where
 * the account and the open conversation are known for sure. Items are content
 * items (validated with messageContentItemSchema) plus the sender name shown
 * above the bubble; the send time is taken from the cliMsgId (client ms clock).
 */
export const domMessagesBatchSchema = z.object({
  uid: uidSchema,
  threadId: zid,
  items: z.array(z.unknown()).min(1).max(MAX_BATCH_SIZE),
});

export interface DomMessagesResult extends MessageContentResult {
  /** Messages created from the DOM only (no IndexedDB metadata). */
  created: number;
  /**
   * The batch holds bubbles of another conversation (the chat on screen is not
   * the requested thread): content was joined where it belongs, nothing created.
   */
  threadMismatch?: boolean;
}

/**
 * A conversation's display name read from the Zalo Web sidebar list (which is
 * plaintext on screen). Reading the sidebar never opens a conversation, so it
 * does not mark anything read. Joined to a conversation by threadId.
 */
export const threadNameItemSchema = z
  .object({
    threadId: zid,
    name: z.string().min(1).max(500),
    isGroup: z.boolean().optional(),
    // Non-https avatars are dropped (not rejected) so the name still lands.
    avatar: z.preprocess(
      (v) => (typeof v === 'string' && v.length <= 2000 && /^https:\/\/[^\s]+$/i.test(v) ? v : undefined),
      z.string().url().max(2000).optional(),
    ),
    unread: z.number().int().min(0).max(100000).optional(),
    labels: z.array(z.string().min(1).max(100)).max(20).optional(),
    /** Zalo label chip on the item: name (plaintext on screen) and its colour. */
    label: z.object({ name: z.string().min(1).max(100), color: z.string().max(50).optional() }).strict().optional(),
  })
  .strict();

export type ThreadNameItem = z.output<typeof threadNameItemSchema>;

export const threadNamesBatchSchema = z.object({
  uid: uidSchema,
  items: z.array(z.unknown()).min(1).max(MAX_BATCH_SIZE),
});

export interface ThreadNamesResult {
  matched: number;
  unmatched: string[];
  rejected: RejectedItem[];
}

/**
 * Direct (zca-js) nicks: state changes that are not a message. `delivered` / `seen` = the other side received / read
 * the nick's own messages up to `msgId`; `read` = the nick itself read the thread on another device (unread to 0).
 */
export const MESSAGE_STATUS_EVENTS = ['delivered', 'seen', 'read'] as const;
export type MessageStatusEvent = (typeof MESSAGE_STATUS_EVENTS)[number];

export const messageStatusItemSchema = z
  .object({
    threadId: zid,
    event: z.enum(MESSAGE_STATUS_EVENTS),
    msgId: zid.nullish(),
  })
  .strict();
export type MessageStatusItem = z.output<typeof messageStatusItemSchema>;

export const messageStatusBatchSchema = z.object({
  uid: uidSchema,
  items: z.array(z.unknown()).min(1).max(MAX_BATCH_SIZE),
});

/** Direct nicks: someone is typing (realtime only, nothing stored). */
export const typingSchema = z
  .object({
    uid: uidSchema,
    threadId: zid,
    who: zid.nullish(),
  })
  .strict();

export interface MessageStatusResult {
  /** Messages whose status moved up, plus conversations set read. */
  updated: number;
  rejected: RejectedItem[];
}

export interface MessageContentResult {
  /** Content joined onto an existing message. */
  matched: number;
  /** cliMsgIds with no matching message yet (metadata not ingested). */
  unmatched: string[];
  rejected: RejectedItem[];
}

export const registerAccountSchema = z
  .object({
    uid: uidSchema,
    label: z.string().min(1).max(200),
    ownerName: z.string().max(200).optional(),
    /** Defaults to the channel implied by the uid prefix (unprefixed = personal Zalo). */
    channel: channelSchema.optional(),
  })
  .refine((a) => !a.channel || channelOfUid(a.uid) === a.channel, {
    message: 'uid prefix does not match channel',
    path: ['uid'],
  })
  .transform((a) => ({ ...a, channel: a.channel ?? channelOfUid(a.uid) }));

export const syncReportSchema = z.object({
  uid: uidSchema,
  /** Record count of each IndexedDB store at read time, keyed by stream. */
  sourceCounts: z.record(streamSchema, z.number().int().min(0)),
  mappingVersion: z.number().int().positive(),
  extensionVersion: z.string().max(50).optional(),
});

export const driftReportSchema = z.object({
  uid: uidSchema,
  stream: streamSchema,
  mappingVersion: z.number().int().positive(),
  kind: z.enum(['missing_db', 'missing_store', 'missing_fields', 'type_mismatch', 'encrypted', 'dom_selectors']),
  /** Missing target fields / store names / DOM selector keys. Never contains record values. */
  missing: z.array(z.string().max(200)).max(200).default([]),
  /** Key names observed on sample records (no values), to help re-mapping. */
  observedKeys: z.array(z.string().max(200)).max(500).default([]),
  observedStores: z.array(z.string().max(200)).max(500).default([]),
  sampleSize: z.number().int().min(0).default(0),
  failedCount: z.number().int().min(0).default(0),
});

/** What clients send (channel optional). */
export type RegisterAccountInput = z.input<typeof registerAccountSchema>;
/** After parsing: channel resolved. */
export type RegisterAccount = z.output<typeof registerAccountSchema>;
export type SyncReport = z.infer<typeof syncReportSchema>;
export type DriftReport = z.infer<typeof driftReportSchema>;

export interface RejectedItem {
  index: number;
  id?: string;
  reason: string;
}

export interface IngestResult {
  accepted: number;
  updated: number;
  unchanged: number;
  rejected: RejectedItem[];
  checkpoint: number | null;
}

export function docId(uid: string, id: string): string {
  return `${uid}:${id}`;
}

/**
 * Single source of truth for the delivery text of an own message by Zalo `message.status`.
 * Meaning pending reconciliation with real Zalo Web (see the note on `status` in the message schema).
 */
export const ZALO_MSG_STATUS_TEXT: Readonly<Record<number, string>> = { 1: 'Đã gửi', 2: 'Đã nhận', 3: 'Đã xem' };
