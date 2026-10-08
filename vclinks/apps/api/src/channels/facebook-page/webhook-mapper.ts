import { isSafeContentUrl, type ContentFile, type MessageContentBody, type MessageContentKind } from '@vclinks/shared';

/**
 * Pure mapping of Messenger Platform webhook events to VClinks message items
 * (validated afterwards by `messageItemSchema` in IngestService).
 *
 * Payload shapes: developers.facebook.com/docs/messenger-platform/webhooks and
 * .../reference/webhook-events/{messages,message-echoes,messaging_postbacks}.
 * The raw payload is never stored as-is: only the fields below are kept.
 */

export interface FbAttachment {
  type?: string;
  payload?: { url?: string; title?: string; sticker_id?: number | string } | null;
  title?: string;
}

export interface FbMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    app_id?: number | string;
    attachments?: FbAttachment[];
    reply_to?: { mid?: string };
    quick_reply?: { payload?: string };
  };
  postback?: { mid?: string; title?: string; payload?: string };
}

export interface FbWebhookBody {
  object?: string;
  entry?: { id?: string; time?: number; messaging?: FbMessagingEvent[] }[];
}

export interface MappedMessage {
  /** PSID of the customer the conversation is with (thread id). */
  customerId: string;
  isEcho: boolean;
  item: Record<string, unknown>;
}

/** Messages sent by the Page itself (echoes) carry this sender, per CLAUDE.md §4.4. */
export const PAGE_SENDER = '0';

function fileNameOf(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop();
    if (last) return decodeURIComponent(last).slice(0, 500);
  } catch {
    // fall through
  }
  return 'Tệp đính kèm';
}

/** Builds the stored `content` (same contract as DOM-captured content) from attachments. Only https URLs are kept. */
export function attachmentsContent(atts: FbAttachment[] | undefined): { body?: MessageContentBody; kind?: MessageContentKind } {
  if (!atts?.length) return {};
  const images: string[] = [];
  const links: string[] = [];
  const files: ContentFile[] = [];
  const body: MessageContentBody = {};
  let kind: MessageContentKind | undefined;
  const setKind = (k: MessageContentKind) => {
    kind = kind && kind !== k ? 'other' : k;
  };
  for (const a of atts) {
    const url = a.payload?.url;
    const safe = isSafeContentUrl(url) ? url : undefined;
    switch (a.type) {
      case 'image':
        if (a.payload?.sticker_id != null) setKind('sticker');
        else setKind('image');
        if (safe) images.push(safe);
        break;
      case 'audio':
        setKind('voice');
        if (safe) body.voice = { url: safe };
        break;
      case 'video':
      case 'reel':
      case 'ig_reel':
        setKind('video');
        if (safe) body.video = { url: safe };
        break;
      case 'file':
        setKind('file');
        if (safe) files.push({ name: fileNameOf(safe), url: safe });
        break;
      case 'fallback':
        // Shared links (e.g. a URL the customer pasted).
        setKind('card');
        if (safe) body.card = { title: (a.title ?? a.payload?.title)?.slice(0, 1000), url: safe };
        if (safe) links.push(safe);
        break;
      default:
        // template, location, product... kept as "other" without payload.
        setKind('other');
    }
  }
  if (images.length) body.images = images;
  if (links.length) body.links = links;
  if (files.length) body.files = files;
  if (kind) body.kind = kind;
  return { body: Object.keys(body).length ? body : undefined, kind };
}

/**
 * Maps one `messaging` event of a Page to a message item, or null when the
 * event is not a message (delivery, read, reaction, unsend...).
 */
export function mapMessagingEvent(pageId: string, ev: FbMessagingEvent): MappedMessage | null {
  const senderId = ev.sender?.id;
  const recipientId = ev.recipient?.id;
  if (!senderId || !recipientId || typeof ev.timestamp !== 'number') return null;

  if (ev.message) {
    const m = ev.message;
    if (!m.mid || m.is_deleted) return null;
    const isEcho = m.is_echo === true || senderId === pageId;
    const customerId = isEcho ? recipientId : senderId;
    const { body, kind } = attachmentsContent(m.attachments);
    const item: Record<string, unknown> = {
      msgId: m.mid,
      cliMsgId: m.mid,
      threadId: customerId,
      fromUid: isEcho ? PAGE_SENDER : customerId,
      toUid: isEcho ? customerId : PAGE_SENDER,
      msgType: m.text != null && !m.attachments?.length ? 'text' : (kind ?? 'text'),
      text: m.text ?? undefined,
      content: body,
      quote: m.reply_to?.mid ? { msgId: m.reply_to.mid } : undefined,
      sentAt: ev.timestamp,
      contentStatus: 'complete',
      raw: { source: 'fb_webhook', ...(isEcho ? { isEcho: true } : {}), ...(m.app_id != null ? { appId: String(m.app_id) } : {}) },
    };
    return { customerId, isEcho, item: stripUndefined(item) };
  }

  if (ev.postback) {
    // A button tap by the customer: stored as a message with the button title.
    const p = ev.postback;
    const msgId = p.mid ?? `pb_${senderId}_${ev.timestamp}`;
    return {
      customerId: senderId,
      isEcho: false,
      item: stripUndefined({
        msgId,
        threadId: senderId,
        fromUid: senderId,
        toUid: PAGE_SENDER,
        msgType: 'postback',
        text: p.title ?? undefined,
        sentAt: ev.timestamp,
        contentStatus: 'complete',
        raw: { source: 'fb_webhook', postback: true },
      }),
    };
  }
  return null;
}

function stripUndefined(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
