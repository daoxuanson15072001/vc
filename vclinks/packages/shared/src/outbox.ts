import { z } from 'zod';
import { channelSchema } from './channels';
import { outboxQuoteSchema } from './quote';
import { REACTION_EMOJI } from './schemas';

/**
 * Outbox: messages the user approved on the Dashboard. Extension channels
 * (personal Zalo / Facebook) are sent by the VClinks Extension (or by Claude
 * over MCP); API channels (Zalo OA, Fanpage) by the API's outbox dispatcher. Stored in the `suggestions`
 * collection. Invariant: nothing is handed out or marked sent without
 * `approvedBy` + `approvedAt` (CLAUDE.md §12 rule 1).
 */

export const OUTBOX_STATUSES = ['approved', 'sending', 'sent', 'failed', 'expired', 'awaiting_confirm', 'needs_reapproval', 'cancelled'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

/** Vietnamese names of the statuses (03 Sơ đồ 2, MH-SZ-13). */
export const OUTBOX_STATUS_LABELS: Record<OutboxStatus, string> = {
  approved: 'Đang chờ gửi',
  sending: 'Đang gửi',
  sent: 'Đã gửi',
  failed: 'Gửi lỗi',
  expired: 'Quá hạn — chưa gửi',
  awaiting_confirm: 'Chờ xác nhận gửi',
  needs_reapproval: 'Cần duyệt lại',
  cancelled: 'Đã bỏ',
};

/**
 * Why an item went to `needs_reapproval` (01 PQ-51, 03 QT-SZ-11 #1, D40): its approver was locked or
 * left, the nick changed holder, or at send time the approver may no longer send on that nick
 * (`canDispatch`). Shown in the bubble as "Cần duyệt lại (…)".
 */
export const OUTBOX_HOLD_REASONS = ['approver_offboarded', 'approver_locked', 'holder_changed', 'approver_no_send'] as const;
export type OutboxHoldReason = (typeof OUTBOX_HOLD_REASONS)[number];
export const OUTBOX_HOLD_REASON_LABELS: Record<OutboxHoldReason, string> = {
  approver_offboarded: 'người duyệt đã nghỉ việc',
  approver_locked: 'người duyệt đã bị khóa',
  holder_changed: 'đã đổi người giữ nick',
  approver_no_send: 'người duyệt không còn quyền gửi trên nick này',
};

/**
 * Who actually sent on someone else's nick (SZ-22 `sendSource`, QT-SZ-10): "trả lời thay" (GS/GĐ, PQ-16)
 * or "trực thay" (active cover grant, PQ-32). Absent = the nick holder himself.
 */
export const OUTBOX_SEND_SOURCES = ['tra_loi_thay', 'truc_thay'] as const;
export type OutboxSendSource = (typeof OUTBOX_SEND_SOURCES)[number];

/** Bubble label of an item sent on someone else's nick (00 §3.3a, PQ-32). */
export function onBehalfLabel(source: OutboxSendSource, senderName: string, holderName: string): string {
  return source === 'truc_thay' ? `Gửi bởi ${senderName} (trực thay ${holderName})` : `Gửi bởi ${senderName} (trả lời thay ${holderName})`;
}

/** SZ-11: an item not sent within 30 minutes of its approval becomes `expired` and never runs by itself. */
export const OUTBOX_EXPIRE_MS = 30 * 60_000;
/**
 * SZ-28 (b): when a nick comes back online (after being red), approved items
 * that already waited longer than this are not sent: they become
 * `awaiting_confirm` until the approver presses "Gửi ngay".
 */
export const OUTBOX_RECONNECT_HOLD_MS = 2 * 60_000;
/** A claim older than this is "stale": the outcome is unknown, a human may retry. */
export const OUTBOX_STALE_SENDING_MS = 2 * 60_000;

/**
 * What moves an item between statuses. `claim`/`sent`/`fail` come from the
 * sender (extension, MCP, dispatcher); `expire`/`reconnect` from the API's own
 * clock and presence; `hold` from the system when the approver lost the right to
 * send (lock, offboarding, holder change, `canDispatch` at send time);
 * `retry`/`confirm`/`reapprove`/`cancel` from a person on the Dashboard.
 * `retry`, `confirm` and `reapprove` are re-approvals: they stamp a new approvedBy/approvedAt.
 */
export const OUTBOX_EVENTS = ['claim', 'sent', 'fail', 'expire', 'reconnect', 'hold', 'retry', 'confirm', 'reapprove', 'cancel'] as const;
export type OutboxEvent = (typeof OUTBOX_EVENTS)[number];

/**
 * The outbox state machine (03 Sơ đồ 2, with `Cần duyệt lại` from M1b-10). Every status write in the API goes through a query whose
 * `status` condition is `outboxSources(event, to)`. `sent` from `approved` is
 * MCP `mark_sent` (Claude sent without claiming); `retry` from `sending` only
 * when the claim is stale (checked by the API). `needs_reapproval` has no
 * `retry` and never expires or runs by itself: only `reapprove` (nick holder /
 * "Trực nick", a new approvedBy/approvedAt) or `cancel` leave it (D40, PQ-51).
 * An item being sent (`sending`) is never held: its outcome is recorded as usual.
 */
export const OUTBOX_TRANSITIONS: readonly { from: OutboxStatus; event: OutboxEvent; to: OutboxStatus }[] = [
  { from: 'approved', event: 'claim', to: 'sending' },
  { from: 'sending', event: 'sent', to: 'sent' },
  { from: 'approved', event: 'sent', to: 'sent' },
  { from: 'sending', event: 'fail', to: 'failed' },
  { from: 'approved', event: 'expire', to: 'expired' },
  { from: 'awaiting_confirm', event: 'expire', to: 'expired' },
  { from: 'approved', event: 'reconnect', to: 'awaiting_confirm' },
  { from: 'failed', event: 'retry', to: 'approved' },
  { from: 'expired', event: 'retry', to: 'approved' },
  { from: 'sending', event: 'retry', to: 'approved' },
  { from: 'awaiting_confirm', event: 'confirm', to: 'approved' },
  { from: 'approved', event: 'cancel', to: 'cancelled' },
  { from: 'failed', event: 'cancel', to: 'cancelled' },
  { from: 'expired', event: 'cancel', to: 'cancelled' },
  { from: 'awaiting_confirm', event: 'cancel', to: 'cancelled' },
  { from: 'approved', event: 'hold', to: 'needs_reapproval' },
  { from: 'failed', event: 'hold', to: 'needs_reapproval' },
  { from: 'expired', event: 'hold', to: 'needs_reapproval' },
  { from: 'awaiting_confirm', event: 'hold', to: 'needs_reapproval' },
  { from: 'needs_reapproval', event: 'reapprove', to: 'approved' },
  { from: 'needs_reapproval', event: 'cancel', to: 'cancelled' },
];

/** Target status of `event` from `from`, or null when the state machine has no such edge. */
export function outboxTransition(from: OutboxStatus, event: OutboxEvent): OutboxStatus | null {
  return OUTBOX_TRANSITIONS.find((t) => t.from === from && t.event === event)?.to ?? null;
}

/** Statuses `event` may start from (the `status: { $in }` of the API's update query). */
export function outboxSources(event: OutboxEvent): OutboxStatus[] {
  return OUTBOX_TRANSITIONS.filter((t) => t.event === event).map((t) => t.from);
}

/** Statuses that need the approver's attention: the red badge on "Lệnh gửi" (MH-SZ-13, SZ-24). */
export const OUTBOX_ATTENTION: readonly OutboxStatus[] = ['failed', 'expired', 'awaiting_confirm', 'needs_reapproval'];

/** Why an item was cancelled: plain "Bỏ lệnh", or "Sao chép và bỏ lệnh" (SZ-28 a). */
export const OUTBOX_CANCEL_REASONS = ['user', 'copied'] as const;
export type OutboxCancelReason = (typeof OUTBOX_CANCEL_REASONS)[number];

export const outboxCancelSchema = z.object({ reason: z.enum(OUTBOX_CANCEL_REASONS).default('user') }).strict();

/** Dashboard → GET /outbox (MH-SZ-13 filters). */
export const outboxListQuerySchema = z.object({
  uid: z.string().trim().min(1).max(128).optional(),
  threadId: z.string().trim().min(1).max(128).optional(),
  /** One status, or several comma-separated. Absent = every status but `cancelled`. */
  status: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : undefined))
    .pipe(z.array(z.enum(OUTBOX_STATUSES)).optional()),
  /** '1' = only items the caller approved ("Của tôi"). */
  mine: z.enum(['0', '1']).optional(),
  /** '1' = items others sent on nicks the caller holds ("Người khác gửi trên nick tôi", QT-SZ-10 #5, 30 days). */
  onBehalf: z.enum(['0', '1']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /outbox/counts: items per status for the filter chips and the nav badge. `sentToday` counts since 00:00 Asia/Ho_Chi_Minh. */
export interface OutboxCounts {
  approved: number;
  sending: number;
  failed: number;
  expired: number;
  awaiting_confirm: number;
  needs_reapproval: number;
  sentToday: number;
  /** failed + expired + awaiting_confirm + needs_reapproval: the red badge. */
  attention: number;
}

/** Max characters of one outbox message. */
export const OUTBOX_MAX_TEXT = 2000;

const id = z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(128));

/**
 * What an outbox item does on Zalo Web (feature map §5: outbox "commands").
 * Absent = `send_text`, so older items and clients keep working. Everything but
 * plain text is personal-Zalo only for now (the extension drives Zalo's own UI).
 */
export const OUTBOX_ACTIONS = ['send_text', 'send_images', 'send_file', 'send_quote', 'send_card', 'send_sticker', 'create_poll', 'react', 'pin_conversation', 'mark_read', 'mark_unread', 'friend_accept', 'friend_reject', 'friend_request'] as const;
export type OutboxAction = (typeof OUTBOX_ACTIONS)[number];
/**
 * Friend-request commands (M1a-04, MH-SZ-10): accept / reject a received
 * request, send a new one by phone number. They change Zalo state without a
 * message bubble, are approved like every command (CLAUDE.md §12.1) and are not
 * tied to a conversation (`threadId` is the user id, or the phone for a new request).
 */
export const FRIEND_ACTIONS: readonly OutboxAction[] = ['friend_accept', 'friend_reject', 'friend_request'];
export const isFriendAction = (a: OutboxAction | undefined): boolean => !!a && FRIEND_ACTIONS.includes(a);
/** Commands that change state on Zalo without producing a message bubble. */
export const NON_MESSAGE_ACTIONS: readonly OutboxAction[] = ['react', 'pin_conversation', 'mark_read', 'mark_unread', ...FRIEND_ACTIONS];

/** Limits mirrored from Zalo Web's own UI (surveyed 28/09/2026). */
export const OUTBOX_LIMITS = {
  images: 10,
  mentions: 20,
  /** "Đã chọn x/9" in the name-card dialog; VClinks sends one card per command. */
  pollQuestion: 200,
  pollOption: 120,
  pollOptionsMin: 2,
  pollOptionsMax: 30,
  /** Sticker set title and position within the set (Zalo's default set has 40). */
  stickerSet: 60,
  stickerIndex: 500,
  /** Bytes per uploaded attachment (JSON body carries base64). */
  attachmentBytes: 10 * 1024 * 1024,
  /** SZ-09: at least this long between two new friend requests of one nick (ms). */
  friendGapMs: 30_000,
  /** SZ-09: new friend requests per nick per day (Asia/Ho_Chi_Minh). */
  friendPerDay: 20,
  /** Greeting of a friend request / acceptance (Zalo's own limit is 150). */
  friendGreeting: 150,
  /** Alias ("tên gợi nhớ") length. */
  friendAlias: 50,
} as const;

const mediaId = z.string().regex(/^[a-f0-9]{64}$/, 'invalid attachment id');
const shortText = (max: number) => z.string().trim().min(1).max(max);

/** `@Name` in a group message: the name must match an entry of Zalo's mention list exactly. */
export const outboxMentionSchema = z.object({
  name: shortText(100),
  /** Zalo user id when known (display only; Zalo resolves by the picked entry). */
  uid: z.string().trim().max(64).optional(),
});

export const outboxCardSchema = z.object({
  /** Contact name exactly as listed in Zalo's "Gửi danh thiếp" dialog. */
  name: shortText(100),
  userId: z.string().trim().max(64).optional(),
  /** Tick "Gửi kèm số điện thoại" in the dialog. */
  withPhone: z.boolean().optional(),
});

/** `react`: Zalo icon id (REACTION_CODE keys) on a message of the thread. */
export const outboxReactionSchema = z.object({
  cliMsgId: z.string().trim().min(1).max(128),
  icon: z.enum(['0', '3', '5', '32', '2', '20']),
});

export type OutboxReaction = z.infer<typeof outboxReactionSchema>;

/**
 * `friend_*` payload. accept / reject: `userId` + `name` (as listed in the
 * request row); accept may carry the alias (tên gợi nhớ) and a greeting sent
 * once the request is accepted. request: `phone` (Vietnamese number, digits
 * only) + optional greeting.
 */
export const outboxFriendSchema = z
  .object({
    userId: z.string().regex(/^\d{1,40}$/).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    // Spaces, dots and dashes are allowed as typed; the API normalises it to 0xxxxxxxxx (normalizeVnPhone).
    phone: z.string().trim().regex(/^\+?[\d\s.()-]{9,20}$/, 'số điện thoại không hợp lệ').optional(),
    alias: z.string().trim().min(1).max(OUTBOX_LIMITS.friendAlias).optional(),
    greeting: z.string().trim().min(1).max(OUTBOX_LIMITS.friendGreeting).optional(),
  })
  .strict();
export type OutboxFriend = z.infer<typeof outboxFriendSchema>;

/**
 * `send_sticker`: a sticker of one of the sets in Zalo Web's sticker panel
 * (`div_StickerMenu_SetItem[title]`), by position in that set. `thumbUrl` is
 * the thumbnail Zalo shows for it (the panel item's background image); when
 * given, the extension sends only the item with exactly this thumbnail.
 */
export const outboxStickerSchema = z.object({
  set: shortText(OUTBOX_LIMITS.stickerSet),
  index: z.number().int().min(1).max(OUTBOX_LIMITS.stickerIndex),
  thumbUrl: z.string().trim().url().max(500).optional(),
  /**
   * Direct (zca-js) nicks: the Zalo sticker itself, picked from Zalo's sticker search (GET /api/zalo/stickers).
   * The extension sends by set and position instead.
   */
  id: z.number().int().positive().optional(),
  cateId: z.number().int().min(0).optional(),
  type: z.number().int().min(0).optional(),
});
export type OutboxSticker = z.infer<typeof outboxStickerSchema>;

export const outboxPollSchema = z.object({
  question: shortText(OUTBOX_LIMITS.pollQuestion),
  options: z.array(shortText(OUTBOX_LIMITS.pollOption)).min(OUTBOX_LIMITS.pollOptionsMin).max(OUTBOX_LIMITS.pollOptionsMax),
});

export const outboxCreateSchema = z
  .object({
    uid: id,
    threadId: id,
    action: z.enum(OUTBOX_ACTIONS).optional(),
    /** send_text only (required there). Every `@Name` of `mentions` must appear in it. */
    text: z.string().trim().min(1).max(OUTBOX_MAX_TEXT).optional(),
    mentions: z.array(outboxMentionSchema).max(OUTBOX_LIMITS.mentions).optional(),
    /** send_images (1..10) / send_file (exactly 1): ids from POST /outbox/attachments. */
    attachments: z.array(mediaId).max(OUTBOX_LIMITS.images).optional(),
    /** send_quote only: set by POST /quotes/send (the API re-checks the quote); POST /outbox refuses it. */
    quote: outboxQuoteSchema.optional(),
    card: outboxCardSchema.optional(),
    sticker: outboxStickerSchema.optional(),
    poll: outboxPollSchema.optional(),
    reaction: outboxReactionSchema.optional(),
    /** pin_conversation: true = ghim, false = bỏ ghim. */
    pin: z.boolean().optional(),
    /** friend_accept / friend_reject / friend_request. */
    friend: outboxFriendSchema.optional(),
    replyToCliMsgId: z.string().trim().min(1).max(128).optional(),
  })
  .superRefine((v, ctx) => {
    const action = v.action ?? 'send_text';
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    };
    const only = (fields: (keyof typeof v)[]) => {
      for (const f of ['text', 'mentions', 'attachments', 'quote', 'card', 'sticker', 'poll', 'reaction', 'pin', 'friend'] as const) {
        need(fields.includes(f) || v[f] === undefined, f, `not allowed for ${action}`);
      }
    };
    switch (action) {
      case 'send_text':
        need(!!v.text, 'text', 'required');
        only(['text', 'mentions']);
        for (const m of v.mentions ?? []) need(!!v.text?.includes(`@${m.name}`), 'mentions', `@${m.name} is not in the text`);
        break;
      case 'send_images':
        need(!!v.attachments?.length, 'attachments', 'at least one image');
        only(['attachments']);
        break;
      case 'send_file':
        need(v.attachments?.length === 1, 'attachments', 'exactly one file');
        only(['attachments']);
        break;
      case 'send_quote':
        need(!!v.quote, 'quote', 'required');
        need(v.quote?.form === 'image' ? !!v.attachments?.length : v.attachments?.length === 1, 'attachments', v.quote?.form === 'image' ? 'at least one image' : 'exactly one file');
        need(!v.replyToCliMsgId, 'replyToCliMsgId', 'not allowed for send_quote');
        only(['attachments', 'quote']);
        break;
      case 'send_card':
        need(!!v.card, 'card', 'required');
        only(['card']);
        break;
      case 'send_sticker':
        need(!!v.sticker, 'sticker', 'required');
        only(['sticker']);
        break;
      case 'create_poll':
        need(!!v.poll, 'poll', 'required');
        only(['poll']);
        break;
      case 'react':
        need(!!v.reaction, 'reaction', 'required');
        need(!v.replyToCliMsgId, 'replyToCliMsgId', 'not allowed for react');
        only(['reaction']);
        break;
      case 'pin_conversation':
        need(typeof v.pin === 'boolean', 'pin', 'required');
        only(['pin']);
        break;
      case 'mark_read':
      case 'mark_unread':
        only([]);
        break;
      case 'friend_accept':
        need(!!v.friend?.userId && !!v.friend?.name, 'friend', 'userId and name are required');
        need(!v.friend?.phone, 'friend', 'phone is not allowed for friend_accept');
        need(!v.replyToCliMsgId, 'replyToCliMsgId', 'not allowed for friend_accept');
        only(['friend']);
        break;
      case 'friend_reject':
        need(!!v.friend?.userId && !!v.friend?.name, 'friend', 'userId and name are required');
        need(!v.friend?.phone && !v.friend?.alias && !v.friend?.greeting, 'friend', 'only userId and name are allowed for friend_reject');
        need(!v.replyToCliMsgId, 'replyToCliMsgId', 'not allowed for friend_reject');
        only(['friend']);
        break;
      case 'friend_request':
        need(!!v.friend?.phone, 'friend', 'phone is required');
        need(!v.friend?.userId, 'friend', 'userId is not allowed for friend_request');
        need(!v.replyToCliMsgId, 'replyToCliMsgId', 'not allowed for friend_request');
        only(['friend']);
        break;
    }
  });
export type OutboxCreate = z.infer<typeof outboxCreateSchema>;

/** File attached to an outbox command (stored like message photos, by sha256). */
export const outboxAttachmentSchema = z.object({
  id: mediaId,
  name: z.string(),
  mime: z.string(),
  size: z.number(),
});
export type OutboxAttachment = z.infer<typeof outboxAttachmentSchema>;

/** Dashboard → API: one file for an outbox command, as base64. */
export const outboxAttachmentUploadSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(200)
      // No path parts or control characters: Zalo shows the name to recipients.
      .refine((n) => !/[\\/\u0000-\u001f]/.test(n), 'invalid file name'),
    mime: z.string().trim().min(1).max(120),
    dataBase64: z
      .string()
      .min(4)
      .max(Math.ceil((OUTBOX_LIMITS.attachmentBytes * 4) / 3) + 8)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
export type OutboxAttachmentUpload = z.input<typeof outboxAttachmentUploadSchema>;

/**
 * Human label of a command, stored as the item's text (the approval filter and
 * every list/audit keep working on text): "[2 ảnh]", "[File] bao-gia.pdf", …
 */
export function outboxLabel(c: {
  action?: OutboxAction;
  text?: string;
  attachments?: { name: string }[];
  quote?: { no: string };
  card?: { name: string };
  sticker?: { set: string; index: number };
  poll?: { question: string };
  reaction?: { icon: string };
  pin?: boolean;
  friend?: { name?: string; phone?: string };
}): string {
  switch (c.action ?? 'send_text') {
    case 'friend_accept':
      return `[Kết bạn] ${c.friend?.name ?? ''}`.trim();
    case 'friend_reject':
      return `[Từ chối kết bạn] ${c.friend?.name ?? ''}`.trim();
    case 'friend_request':
      return `[Mời kết bạn] ${c.friend?.name ?? c.friend?.phone ?? ''}`.trim();
    case 'react':
      return `[Cảm xúc ${REACTION_EMOJI[c.reaction?.icon ?? ''] ?? ''}]`.replace(' ]', ']');
    case 'pin_conversation':
      return c.pin === false ? '[Bỏ ghim hội thoại]' : '[Ghim hội thoại]';
    case 'mark_read':
      return '[Đánh dấu đã đọc]';
    case 'mark_unread':
      return '[Đánh dấu chưa đọc]';
    case 'send_images':
      return c.attachments && c.attachments.length > 1 ? `[${c.attachments.length} ảnh]` : '[Ảnh]';
    case 'send_file':
      return `[File] ${c.attachments?.[0]?.name ?? ''}`.trim();
    case 'send_quote':
      return `[Báo giá] ${c.quote?.no ?? ''}`.trim();
    case 'send_card':
      return `[Danh thiếp] ${c.card?.name ?? ''}`.trim();
    case 'send_sticker':
      return `[Sticker] ${c.sticker?.set ?? ''} #${c.sticker?.index ?? ''}`.replace(/\s+#/, ' #').trim();
    case 'create_poll':
      return `[Bình chọn] ${c.poll?.question ?? ''}`.trim();
    default:
      return c.text ?? '';
  }
}

export const outboxItemSchema = z.object({
  id: z.string(),
  uid: z.string(),
  channel: channelSchema,
  threadId: z.string(),
  text: z.string(),
  /** Absent on plain text items (send_text). */
  action: z.enum(OUTBOX_ACTIONS).optional(),
  mentions: z.array(outboxMentionSchema).optional(),
  attachments: z.array(outboxAttachmentSchema).optional(),
  quote: outboxQuoteSchema.optional(),
  card: outboxCardSchema.optional(),
  sticker: outboxStickerSchema.optional(),
  poll: outboxPollSchema.optional(),
  reaction: outboxReactionSchema.optional(),
  pin: z.boolean().optional(),
  friend: outboxFriendSchema.optional(),
  status: z.enum(OUTBOX_STATUSES),
  /** User id of the approver (signed-in user), or the token name for tokens without a user. */
  approvedBy: z.string(),
  /** Display name of the approver ("Duyệt bởi"); absent on items created before M1b-10. */
  approvedByName: z.string().optional(),
  /** ISO timestamp. */
  approvedAt: z.string(),
  /** Sent on someone else's nick: how, and the holder's name (bubble "Gửi bởi … (trực thay …)"). */
  sendSource: z.enum(OUTBOX_SEND_SOURCES).optional(),
  onBehalfOfName: z.string().optional(),
  /** `needs_reapproval` only: why. */
  holdReason: z.enum(OUTBOX_HOLD_REASONS).optional(),
  sentAt: z.string().optional(),
  cliMsgId: z.string().optional(),
  /** All cliMsgIds of a multi-line send (absent on older items). */
  cliMsgIds: z.array(z.string()).optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  /** ISO time of the last status change ("Treo {n} phút", MH-SZ-13 #4). */
  statusAt: z.string().optional(),
  /** How many times a sender claimed the item ("thử {n} lần"). */
  attempts: z.number().int().optional(),
  cancelReason: z.enum(OUTBOX_CANCEL_REASONS).optional(),
  /**
   * `awaiting_confirm` only (SZ-28 d): the newest message the nick sent outside
   * VClinks (phone) in this thread after the item was created. Dashboard only.
   */
  phoneDuplicate: z.object({ at: z.string(), preview: z.string() }).optional(),
  /**
   * Extension poll only (GET /outbox/pending), as for fetch requests: the
   * conversation's display name, to find it through Zalo Web search when it is
   * not in the rendered sidebar, and its newest cliMsgIds, to confirm the right
   * conversation is open before typing.
   */
  name: z.string().optional(),
  recentCliMsgIds: z.array(z.string()).optional(),
  /** cliMsgId of the message this one replies to (Zalo "Trả lời"). */
  replyToCliMsgId: z.string().optional(),
  /**
   * Extension poll only: the message a reply or a reaction points at, as stored (ids, type, author, send
   * time, text). A direct (zca-js) nick needs the message itself to quote or react, not just its cliMsgId.
   */
  target: z
    .object({
      msgId: z.string(),
      cliMsgId: z.string(),
      fromUid: z.string(),
      msgType: z.string().optional(),
      sentAt: z.string().optional(),
      ttl: z.number().optional(),
      text: z.string().optional(),
    })
    .optional(),
});
export type OutboxItem = z.infer<typeof outboxItemSchema>;

/** Extension → API after trying to send a claimed item. */
export const outboxResultSchema = z
  .object({
    ok: z.boolean(),
    /** ISO timestamp (JSON-safe: extension messages cannot carry Date objects). */
    sentAt: z.string().datetime({ offset: true }).optional(),
    cliMsgId: z.string().trim().min(1).max(128).optional(),
    /** Every line sent, in order (multi-line text = one Zalo message per line). `cliMsgId` stays the last one. */
    cliMsgIds: z.array(z.string().trim().min(1).max(128)).max(50).optional(),
    /** Reply items: cliMsgId of the message that carries the quote (the first line sent). */
    replyCliMsgId: z.string().trim().min(1).max(128).optional(),
    /** Short, fixed reason; never the message text. */
    error: z.string().trim().max(300).optional(),
  })
  .refine((r) => r.ok || !!r.error, { message: 'error is required when ok=false', path: ['error'] });
export type OutboxResult = z.input<typeof outboxResultSchema>;
