/**
 * Every Messenger DOM selector in one declarative object (the Messenger
 * counterpart of `DomSelectors` for Zalo). Messenger ships hashed, frequently
 * rotated class names, so nothing here relies on classes: only ARIA roles /
 * labels, `dir="auto"` text containers, link shapes and document structure.
 *
 * STATUS: UNVERIFIED. Written without access to a logged-in Messenger; every
 * key must be checked against the real page with the survey checklist in
 * docs/04-ky-thuat/kenh/facebook-personal.md §6 before relying on it. The health check
 * (reader.ts `checkMessengerHealth`) reports the keys that do not match as a
 * `dom_selectors` drift so breakage is visible on the Dashboard.
 *
 * An approved mapping may override any key at runtime via `spec.messengerDom`
 * (see `mergeMessengerSelectors`), once the API/shared schema carries it.
 */
export interface MessengerSelectors {
  /** Container of the open conversation's message list. */
  messageList: string;
  /** One row of the message list (a message, a time separator, "seen", typing…). */
  messageRow: string;
  /** Explicit time separator inside a row. Rows whose whole text parses as a date/time are separators too. */
  timeSeparator: string;
  /** Attributes that may carry a real Messenger message id (`mid.$…`), tried in order. */
  messageIdAttrs: string[];
  /** Headings naming the sender of a message group (visually hidden in Messenger). */
  senderHeading: string;
  /** Sender heading texts meaning "the owner sent this" (case-insensitive; exact or followed by a space/colon). */
  outgoingLabels: string[];
  /** Row texts that are delivery status / typing indicators, not messages (exact, case-insensitive). */
  ignoreRowTexts: string[];
  /** Text containers of a message body (outermost match per subtree is used). */
  messageText: string;
  /** Content image hosts (substring of the URL host). Everything else is ignored. */
  imageHosts: string[];
  /** Images to ignore even on content hosts (emoji, stickers UI, static assets). */
  imageSkip: string;
  /** Images smaller than this (width/height attributes) are avatars/emoji. */
  minImageSize: number;
  /** Attachment (file) links. */
  fileLink: string;
  /** Composer (Lexical contenteditable). */
  composer: string;
  /** Left conversation list. */
  sidebar: string;
  /** Conversation links inside the sidebar (href carries the thread id). */
  sidebarThreadLink: string;
  /** Unread markers in a sidebar row: aria-label / text (case-insensitive substring). */
  unreadLabels: string[];
  /** Links to the logged-in owner's own profile (owner id comes from the href). */
  ownProfileLink: string;
  /** E2EE chat locked behind the PIN / "restore messages" prompt. */
  e2eeLockedLabels: string[];
}

export const DEFAULT_MESSENGER_SELECTORS: MessengerSelectors = {
  messageList: [
    '[role="main"] [role="grid"]',
    '[role="main"] [aria-label^="Messages in conversation"]',
    '[role="main"] [aria-label^="Tin nhắn trong cuộc trò chuyện"]',
  ].join(', '),
  messageRow: '[role="row"]',
  timeSeparator: '[data-scope="date_break"], [role="separator"]',
  messageIdAttrs: ['data-message-id', 'data-mid', 'data-testid-mid'],
  senderHeading: 'h4, h5, [data-scope="sender_name"]',
  outgoingLabels: ['You sent', 'Bạn đã gửi'],
  ignoreRowTexts: [
    'Seen', 'Đã xem', 'Sent', 'Đã gửi', 'Delivered', 'Đã nhận', 'Sending', 'Đang gửi',
    'Seen by everyone', 'Mọi người đã xem',
  ],
  messageText: '[dir="auto"]',
  imageHosts: ['fbcdn.net', 'fbsbx.com'],
  imageSkip: 'emoji|rsrc\\.php|static\\.xx\\.fbcdn\\.net|/images/emoji|sticker',
  minImageSize: 64,
  fileLink: 'a[href*="cdn.fbsbx.com"], a[download]',
  composer: '[role="main"] [role="textbox"][contenteditable="true"], [role="textbox"][contenteditable="true"][aria-label]',
  sidebar: [
    '[role="navigation"][aria-label="Chats"]',
    '[role="navigation"][aria-label="Đoạn chat"]',
    '[aria-label="Chats"][role="grid"]',
    '[aria-label="Đoạn chat"][role="grid"]',
    '[role="navigation"]',
  ].join(', '),
  sidebarThreadLink: 'a[href*="/t/"]',
  unreadLabels: ['unread', 'chưa đọc'],
  ownProfileLink: [
    'a[aria-label="Your profile" i]',
    'a[aria-label="Trang cá nhân của bạn" i]',
    '[role="banner"] a[href*="profile.php?id="][aria-label]',
  ].join(', '),
  e2eeLockedLabels: ['Enter your PIN', 'Nhập mã PIN', 'Restore your messages', 'Khôi phục tin nhắn'],
};

/** Keys the health check reports (also the `missing[]` values of the drift). */
export const MESSENGER_SELECTOR_KEYS = Object.keys(DEFAULT_MESSENGER_SELECTORS) as (keyof MessengerSelectors)[];

/** Checks a CSS selector compiles, without throwing. */
function validSelector(sel: unknown, doc?: Document): sel is string {
  if (typeof sel !== 'string' || !sel.trim() || sel.length > 2000) return false;
  try {
    (doc ?? globalThis.document)?.createDocumentFragment().querySelector(sel);
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies an override (e.g. `spec.messengerDom` of an approved mapping) over the
 * defaults. Keys with a wrong type or an invalid selector are ignored, never
 * trusted blindly.
 */
export function mergeMessengerSelectors(override: unknown): MessengerSelectors {
  const out: MessengerSelectors = { ...DEFAULT_MESSENGER_SELECTORS };
  if (!override || typeof override !== 'object') return out;
  const o = override as Record<string, unknown>;
  const outRec = out as unknown as Record<string, unknown>;
  for (const key of MESSENGER_SELECTOR_KEYS) {
    const def = DEFAULT_MESSENGER_SELECTORS[key];
    const v = o[key];
    if (v === undefined) continue;
    if (Array.isArray(def)) {
      if (Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length <= 200)) outRec[key] = v.slice(0, 50);
    } else if (typeof def === 'number') {
      if (typeof v === 'number' && v >= 0 && v <= 10_000) outRec[key] = v;
    } else if (key === 'imageSkip') {
      try {
        if (typeof v === 'string' && v.length <= 500) {
          new RegExp(v, 'i');
          outRec[key] = v;
        }
      } catch {
        /* invalid regex: keep default */
      }
    } else if (validSelector(v)) {
      outRec[key] = v;
    }
  }
  return out;
}
