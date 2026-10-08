import { createHash, timingSafeEqual } from 'node:crypto';
import type { MessageContentBody } from '@vclinks/shared';

/**
 * Zalo OA webhook events → VClinks message items.
 *
 * Payloads per developers.zalo.me ("Sự kiện người dùng gửi tin nhắn", "Sự kiện
 * Official Account gửi tin nhắn cho người dùng"):
 *   { app_id, event_name, sender: { id, admin_id? }, recipient: { id },
 *     message: { msg_id, text?, attachments?: [{ type, payload }], quote_msg_id? },
 *     user_id_by_app?, timestamp: "<ms>" }
 * For user_send_* the sender is the follower and the recipient the OA; for
 * oa_send_* (echo of anything the OA sent: API or OA chat tool) it is reversed.
 * The follower id used as threadId is the OA-scoped user id (`sender.id` /
 * `recipient.id`), the one the send and user-detail APIs accept.
 */

export interface ZaloOaAttachment {
  type?: string;
  payload?: Record<string, unknown>;
}

export interface ZaloOaEvent {
  app_id?: string;
  event_name?: string;
  sender?: { id?: string | number; admin_id?: string | number };
  recipient?: { id?: string | number };
  user_id_by_app?: string;
  message?: {
    msg_id?: string;
    text?: string;
    quote_msg_id?: string;
    attachments?: ZaloOaAttachment[];
  };
  timestamp?: string | number;
}

/** Inbound events stored as messages (others are acknowledged and ignored). */
export const USER_MESSAGE_EVENTS = new Set([
  'user_send_text',
  'user_send_image',
  'user_send_gif',
  'user_send_link',
  'user_send_audio',
  'user_send_video',
  'user_send_sticker',
  'user_send_location',
  'user_send_business_card',
  'user_send_file',
]);

/** Echo events of messages sent by the OA (Open API or the OA chat tool). */
export const OA_MESSAGE_EVENTS = new Set([
  'oa_send_text',
  'oa_send_image',
  'oa_send_gif',
  'oa_send_list',
  'oa_send_file',
  'oa_send_sticker',
]);

/** Message events the owner should enable in the app's webhook settings (docs). */
export const WEBHOOK_EVENTS = [...USER_MESSAGE_EVENTS, ...OA_MESSAGE_EVENTS];

/** Zalo media is served from these CDNs, which all answer on https even when the payload says http. */
const ZALO_MEDIA_HOST = /(^|\.)(zdn\.vn|zadn\.vn|zalo\.me|zaloapp\.com)$/i;

/**
 * Media URL to store: https only (CLAUDE.md content rules). Zalo CDN http URLs
 * are upgraded to https; any other non-https URL is dropped.
 */
export function mediaUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v || v.length > 4000) return undefined;
  try {
    const u = new URL(v);
    if (u.protocol === 'https:') return u.toString();
    if (u.protocol === 'http:' && ZALO_MEDIA_HOST.test(u.hostname)) {
      u.protocol = 'https:';
      return u.toString();
    }
  } catch {
    // not a URL
  }
  return undefined;
}

/** Link typed by a user: http(s) kept as-is (it is content, not a resource we fetch). */
function linkUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v || v.length > 4000) return undefined;
  try {
    const p = new URL(v).protocol;
    return p === 'https:' || p === 'http:' ? v : undefined;
  } catch {
    return undefined;
  }
}

const str = (v: unknown, max = 1000): string | undefined =>
  typeof v === 'string' && v ? v.slice(0, max) : typeof v === 'number' ? String(v) : undefined;

function fmtSize(v: unknown): string | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Builds `content` (MessageContentBody) and a fallback text from attachments. */
function contentOf(event: string, attachments: ZaloOaAttachment[]): { content?: MessageContentBody; text?: string } {
  const images: string[] = [];
  const links: string[] = [];
  const files: NonNullable<MessageContentBody['files']> = [];
  let voice: MessageContentBody['voice'];
  let video: MessageContentBody['video'];
  let card: MessageContentBody['card'];
  let kind: MessageContentBody['kind'];
  let text: string | undefined;

  for (const a of attachments.slice(0, 50)) {
    const p = (a?.payload ?? {}) as Record<string, unknown>;
    switch (a?.type) {
      case 'image':
      case 'gif': {
        const u = mediaUrl(p.url) ?? mediaUrl(p.thumbnail);
        if (u) images.push(u);
        kind ??= 'image';
        break;
      }
      case 'sticker': {
        const u = mediaUrl(p.url);
        if (u) images.push(u);
        kind ??= 'sticker';
        break;
      }
      case 'audio':
        voice = { url: mediaUrl(p.url) };
        kind ??= 'voice';
        break;
      case 'video':
        video = { url: mediaUrl(p.url), thumb: mediaUrl(p.thumbnail) };
        kind ??= 'video';
        break;
      case 'link': {
        const l = linkUrl(p.url);
        if (l) links.push(l);
        card = { title: str(p.title) ?? str(p.description), url: mediaUrl(p.url) };
        kind ??= 'card';
        break;
      }
      case 'file': {
        const name = str(p.name, 500) ?? 'file';
        files.push({ name, size: fmtSize(p.size), ext: str(p.type, 20), url: mediaUrl(p.url) });
        kind ??= 'file';
        break;
      }
      case 'location': {
        const c = (p.coordinates ?? {}) as Record<string, unknown>;
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          links.push(`https://www.google.com/maps?q=${lat},${lng}`);
          text = `[Vị trí] ${lat}, ${lng}`;
        }
        kind ??= 'other';
        break;
      }
      default: {
        // business card, list/template echoes: keep a title/link when present.
        const u = mediaUrl(p.url);
        const title = str(p.title) ?? str(p.description) ?? str(p.name);
        if (u || title) card = { title, url: u };
        const thumb = mediaUrl(p.thumbnail);
        if (thumb) images.push(thumb);
        kind ??= event.endsWith('business_card') ? 'card' : 'other';
      }
    }
  }

  const strip = <T extends object>(o: T): T =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  const body = strip({
    images: images.length ? images : undefined,
    links: links.length ? links : undefined,
    files: files.length ? files.map(strip) : undefined,
    voice: voice ? strip(voice) : undefined,
    video: video ? strip(video) : undefined,
    card: card && (card.title || card.url) ? strip(card) : undefined,
    kind,
  });
  return { content: Object.keys(body).length ? body : undefined, text };
}

export interface MappedEvent {
  oaId: string;
  /** Follower (OA-scoped user id) = threadId. */
  userId: string;
  direction: 'in' | 'out';
  /** A messageItemSchema-shaped item (validated again by IngestService). */
  item: Record<string, unknown>;
}

/**
 * Maps one webhook event to a message item, or null for events that are not
 * messages (follow, seen, reactions...) or that miss ids. OA-sent messages get
 * fromUid '0'. No raw payload is stored.
 */
export function mapEvent(ev: ZaloOaEvent): MappedEvent | null {
  const name = ev.event_name ?? '';
  const inbound = USER_MESSAGE_EVENTS.has(name);
  const outbound = OA_MESSAGE_EVENTS.has(name);
  if (!inbound && !outbound) return null;
  const senderId = ev.sender?.id != null ? String(ev.sender.id) : '';
  const recipientId = ev.recipient?.id != null ? String(ev.recipient.id) : '';
  const msgId = ev.message?.msg_id != null ? String(ev.message.msg_id) : '';
  const oaId = inbound ? recipientId : senderId;
  const userId = inbound ? senderId : recipientId;
  const sentAt = Number(ev.timestamp);
  if (!oaId || !userId || !msgId || !Number.isFinite(sentAt) || sentAt <= 0) return null;

  const { content, text: fallback } = contentOf(name, Array.isArray(ev.message?.attachments) ? ev.message!.attachments! : []);
  const text = typeof ev.message?.text === 'string' && ev.message.text ? ev.message.text : fallback;
  const item: Record<string, unknown> = {
    msgId,
    threadId: userId,
    fromUid: inbound ? userId : '0',
    toUid: inbound ? oaId : userId,
    msgType: name,
    sentAt: Math.trunc(sentAt),
    contentStatus: 'complete',
  };
  if (text != null) item.text = text;
  if (content) item.content = content;
  if (ev.message?.quote_msg_id) item.quote = { msgId: String(ev.message.quote_msg_id) };
  return { oaId, userId, direction: inbound ? 'in' : 'out', item };
}

/**
 * Verifies `X-ZEvent-Signature` = sha256(appId + rawBody + timestamp + OAsecretKey)
 * (hex), as documented on each webhook event page. The header may carry a
 * `mac=` prefix. `timestamp` is the event's own `timestamp` field.
 * A blank key never verifies (anyone knowing the app id could forge it).
 */
export function verifyZaloSignature(opts: {
  appId: string;
  secret: string;
  rawBody: Buffer | undefined;
  timestamp: unknown;
  header: string | undefined;
}): boolean {
  const { appId, secret, rawBody, timestamp, header } = opts;
  if (!appId || !secret || !rawBody?.length || !header) return false;
  if (typeof timestamp !== 'string' && typeof timestamp !== 'number') return false;
  const given = header.trim().replace(/^mac\s*=\s*/i, '').toLowerCase();
  const expected = createHash('sha256')
    .update(appId)
    .update(rawBody)
    .update(String(timestamp))
    .update(secret)
    .digest('hex');
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
