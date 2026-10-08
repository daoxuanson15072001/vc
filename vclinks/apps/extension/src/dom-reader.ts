import { DEFAULT_DOM_SELECTORS, type DomSelectors } from '@vclinks/shared';
import {
  MEDIA_SELECTORS,
  detectCard,
  detectFiles,
  detectBlobImages,
  detectCall,
  detectImages,
  detectLocation,
  detectReminder,
  detectSticker,
  detectVideo,
  detectVoice,
  guard,
  inferKind,
  mediaLinkOwners,
  safeUrl,
  type CallInfo,
  type CardInfo,
  type FileInfo,
  type LocationInfo,
  type MediaSelectors,
  type MessageKind,
  type ReminderInfo,
  type VideoInfo,
  type VoiceInfo,
} from './dom-media';
import { classifyBubble, type BubbleStructure } from './dom-survey';

/**
 * Reads message content from the Zalo Web DOM — i.e. what the page already shows
 * the user — since the IndexedDB copy is ciphertext (docs/04-ky-thuat/zalo-web/zalo-web-extraction.md).
 * Each chat bubble is `[id^="<bubbleIdPrefix><cliMsgId>"]`; content is joined to its
 * metadata by cliMsgId on the backend. We never decrypt and never open or scroll
 * conversations here: this only reads what is already rendered.
 *
 * Selectors come from the active field mapping (`spec.dom`), so a Zalo UI change
 * is fixed by approving new selectors, not by rebuilding the extension.
 *
 * Pure DOM parsing, no chrome.* — unit-tested with happy-dom.
 */

export interface DomMessage {
  cliMsgId: string;
  direction: 'in' | 'out';
  text: string | null;
  images: string[];
  /** Photos Zalo shows only as `blob:` object URLs (encrypted chats): uploaded as bytes, never stored as URLs. */
  blobImages?: string[];
  /**
   * Sender name shown above an incoming bubble in groups (first bubble of a run),
   * carried by extractMessages to the next incoming bubbles of the run.
   */
  senderName?: string;
  links: string[];
  /** Media fields (dom-media.ts). Always set by extractOne; optional for hand-built values. */
  files?: FileInfo[];
  voice?: VoiceInfo | null;
  video?: VideoInfo | null;
  card?: CardInfo | null;
  location?: LocationInfo | null;
  call?: CallInfo | null;
  reminder?: ReminderInfo | null;
  /** Reply bubbles: the quoted message as shown on screen (kept out of `text`). */
  quote?: QuoteInfo | null;
  kind?: MessageKind;
  /** Surveyed structure (dom-survey.ts); `unknown` bubbles are never stored. */
  structure?: BubbleStructure;
}

export interface QuoteInfo {
  senderName?: string;
  text?: string;
}

/**
 * Quote block of a reply bubble, inside the text element (surveyed on real Zalo
 * Web 28/09/2026): `.message-quote-fragment__container` holding `.quote-name`
 * and `.message-quote-fragment__description`.
 */
export const QUOTE_SELECTORS = {
  container: '.message-quote-fragment__container',
  name: '.quote-name',
  text: '.message-quote-fragment__description',
} as const;

/** Sender name above a received group bubble (surveyed 28/09/2026). */
export const SENDER_NAME_SELECTOR = '.message-sender-name-content .truncate';

const visibleText = (el: Element | null | undefined) => cleanText((el as HTMLElement | null)?.innerText ?? el?.textContent ?? null);

/** The quoted sender and text of a reply bubble, or null. */
export function readQuote(el: Element): { quote: QuoteInfo; container: Element } | null {
  const container = el.querySelector(QUOTE_SELECTORS.container);
  if (!container) return null;
  const senderName = visibleText(container.querySelector(QUOTE_SELECTORS.name))?.slice(0, 200);
  const text = visibleText(container.querySelector(QUOTE_SELECTORS.text))?.slice(0, 2000);
  return { quote: { ...(senderName ? { senderName } : {}), ...(text ? { text } : {}) }, container };
}

/** Message text without the quote block Zalo renders inside the same element. */
function stripQuote(full: string | null, quoteEl: Element | null): string | null {
  if (!full || !quoteEl) return full;
  const q = visibleText(quoteEl);
  if (!q) return full;
  const at = full.indexOf(q);
  return at < 0 ? full : cleanText(full.slice(0, at) + full.slice(at + q.length));
}

const bubbleSelector = (sel: DomSelectors) => `[id^="${sel.bubbleIdPrefix}"]`;
const threadItemSelector = (sel: DomSelectors) => `[${sel.threadIdAttr}]`;

function cleanText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').trim();
  return t.length ? t : null;
}

/**
 * Parses one bubble element. Returns null if it is not a bubble. Media
 * detectors (dom-media.ts) run independently: one throwing never hides the
 * text or another detector's result.
 */
export function extractOne(
  el: Element,
  sel: DomSelectors = DEFAULT_DOM_SELECTORS,
  media: MediaSelectors = MEDIA_SELECTORS,
): DomMessage | null {
  const id = el.id;
  if (!id.startsWith(sel.bubbleIdPrefix)) return null;
  // Album (group photo) bubbles carry `<cliMsgId>_<fromUid>_<threadId>` after the
  // prefix (seen 28/09/2026); the cliMsgId is always the first segment.
  const cliMsgId = id.slice(sel.bubbleIdPrefix.length).split('_')[0];
  if (!cliMsgId) return null;

  const textEl = el.querySelector(sel.text);
  const direction: 'in' | 'out' = el.querySelector(sel.sentMarker) ? 'out' : 'in';
  const quoted = guard(() => readQuote(el), null);
  // innerText (real browser) respects line breaks; textContent is the happy-dom fallback.
  const text = stripQuote(visibleText(textEl), quoted?.container ?? null);

  // Avatars, emoji and stickers render as <img> too; they are not message images.
  const skip = sel.imageSkip ? new RegExp(sel.imageSkip, 'i') : null;
  const images = guard(() => detectImages(el, skip, media), []);
  const blobImages = guard(() => detectBlobImages(el, skip, media), []);
  // Download / media URLs belong to files/voice/video, not to message links.
  const owners = guard(() => mediaLinkOwners(el, media), []);
  const links = [...el.querySelectorAll('a[href]')]
    .filter((a) => !owners.some((o) => o.contains(a)) && !quoted?.container.contains(a))
    // Typed links are content, so http: is kept too (media URLs stay https-only).
    .map((a) => a.getAttribute('href') || '')
    .filter((u) => /^https?:\/\//i.test(u));

  const files = guard(() => detectFiles(el, media), []);
  const voice = guard(() => detectVoice(el, media), null);
  const video = guard(() => detectVideo(el, media), null);
  const card = guard(() => detectCard(el, media), null);
  const sticker = guard(() => detectSticker(el, media), false);
  const location = guard(() => detectLocation(el, media), null);
  const call = guard(() => detectCall(el, media), null);
  const reminder = guard(() => detectReminder(el, media), null);
  const uniqLinks = [...new Set(links)];
  const kind = inferKind({ text, images, links: uniqLinks, files, voice, video, card, sticker, location, call, reminder });

  const structure = guard(() => classifyBubble(el, sel), 'unknown' as BubbleStructure);
  const senderName = direction === 'in' ? guard(() => senderNameOf(el), undefined) : undefined;

  return {
    cliMsgId,
    direction,
    text,
    images,
    ...(blobImages.length ? { blobImages } : {}),
    ...(senderName ? { senderName } : {}),
    links: uniqLinks,
    files,
    voice,
    video,
    card,
    ...(location ? { location } : {}),
    ...(call ? { call } : {}),
    ...(reminder ? { reminder } : {}),
    ...(quoted && (quoted.quote.senderName || quoted.quote.text) ? { quote: quoted.quote } : {}),
    ...(senderName ? { senderName } : {}),
    kind,
    structure,
  };
}

/** Extracts every rendered message bubble under `root`. */
export function extractMessages(root: ParentNode, sel: DomSelectors = DEFAULT_DOM_SELECTORS): DomMessage[] {
  const out: DomMessage[] = [];
  let runSender: string | undefined;
  for (const el of root.querySelectorAll(bubbleSelector(sel))) {
    const m = extractOne(el, sel);
    if (!m) continue;
    // Zalo prints the sender only on the first incoming bubble of a run.
    if (m.direction === 'out') runSender = undefined;
    else if (m.senderName) runSender = m.senderName;
    else if (runSender) m.senderName = runSender;
    out.push(m);
  }
  return out;
}

/** Sender name printed above an incoming bubble (not the name inside a quoted message). */
const SENDER_NAME = '.message-sender-name-content';
function senderNameOf(el: Element): string | undefined {
  for (const n of el.querySelectorAll(SENDER_NAME)) {
    if (n.closest('[class*="quote" i]')) continue;
    const t = cleanText((n as HTMLElement).innerText ?? n.textContent);
    if (t) return t.split('\n')[0].slice(0, 200);
  }
  return undefined;
}

/** Keeps only messages whose cliMsgId is not already in `seen` (for the passive watcher). */
export function filterNew(messages: DomMessage[], seen: ReadonlySet<string>): DomMessage[] {
  return messages.filter((m) => !seen.has(m.cliMsgId));
}

/**
 * Finds the scrollable ancestor of the message list (to load older messages by
 * scrolling up). Walks up from a rendered bubble to the nearest vertically
 * scrollable element. Returns null when nothing is scrollable (nothing rendered).
 */
export function findMessageScroller(root: ParentNode, sel: DomSelectors = DEFAULT_DOM_SELECTORS): Element | null {
  const bubble = root.querySelector(bubbleSelector(sel));
  let el: Element | null = bubble?.parentElement ?? null;
  while (el) {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    const oy = style?.overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) return el;
    el = el.parentElement;
  }
  return null;
}

export interface ThreadName {
  threadId: string;
  name: string;
  isGroup: boolean;
  /** Conversation avatar, https only. */
  avatar?: string;
  /** Unread counter from the badge ("99+" → 99). */
  unread?: number;
  /** Label chips shown on the item (e.g. "Khách hàng"). */
  labels?: string[];
  /** Zalo "thẻ phân loại" chip: `.conv__label[title]` (name) and its icon colour (surveyed 28/09/2026). */
  label?: { name: string; color?: string };
}

/*
 * Sidebar extraction is heuristic until real sidebar HTML is surveyed
 * (docs/04-ky-thuat/zalo-web/zalo-web-extraction.md). Items are `[anim-data-id=<threadId>]`; their
 * text holds the name, then preview / time / unread badge / label chips.
 * The last-message preview is deliberately never extracted.
 */

// Vietnamese relative/absolute time shown at the end of the name row.
const TIME_TOKEN =
  '(?:vừa xong|\\d{1,3}\\s*(?:giây|phút|giờ|ngày|tuần|tháng|năm)(?:\\s*trước)?|hôm qua|' +
  '\\d{1,2}[:h]\\d{2}|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)';
const TIME_TAIL = new RegExp(`\\s*${TIME_TOKEN}\\s*$`, 'i');
const TIME_ONLY = new RegExp(`^${TIME_TOKEN}$`, 'i');
// Unread counters: "5", "5+", "99+", "N" (Zalo shows "N" for "new").
const BADGE_TAIL = /\s*\d{1,3}\+\s*$/;
const BADGE_ONLY = /^(?:\d{1,3}\+?|N)$/;
// Preview lines: own-message prefix or attachment placeholders like "[Hình ảnh]".
const PREVIEW_LINE = /^(?:bạn\s*:|\[[^\]]{1,40}\])/i;

const NAME_NODE = '[data-id*="DisplayName" i], [data-id*="Title" i], [data-id*="Name" i]';
const NAME_CLASS = '[class*="conv-item-title"], [class*="truncate"]';
const UNREAD_NODE = '[data-id*="Unread" i], [class*="unread" i], [class*="badge" i]';
const LABEL_NODE = '[data-id*="Label" i], [class*="label" i], [class*="tag" i]';
const AVATAR_IMG = '[data-id*="Avatar" i] img, [class*="avatar" i] img, img[class*="avatar" i], img';

const INLINE_TAGS = new Set(['SPAN', 'B', 'I', 'EM', 'STRONG', 'A', 'MARK', 'SMALL', 'U', 'SUB', 'SUP', 'FONT']);

const norm = (s: string) => s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();

/**
 * Visual lines of an element. A real browser's innerText already breaks lines
 * at block/flex boundaries; when it yields a single line (happy-dom, or no
 * layout) we rebuild lines by grouping text nodes under their nearest
 * non-inline ancestor.
 */
function textLines(el: Element): string[] {
  const it = (el as HTMLElement).innerText;
  if (typeof it === 'string' && it.includes('\n')) return it.split('\n').map(norm).filter(Boolean);
  const lines: string[] = [];
  let block: Node | null = null;
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let b: Node | null = n.parentNode;
    while (b && b !== el && INLINE_TAGS.has((b as Element).tagName)) b = b.parentNode;
    const parts = (n.textContent ?? '').split('\n');
    parts.forEach((p, i) => {
      if (b === block && i === 0 && lines.length) lines[lines.length - 1] += p;
      else lines.push(p);
    });
    block = b;
  }
  return lines.map(norm).filter(Boolean);
}

/** Strips time and badge tails; returns null for lines that are not a name. */
function cleanNameLine(line: string, labels: ReadonlySet<string>): string | null {
  let s = norm(line);
  for (let i = 0; i < 3; i++) {
    const next = s.replace(BADGE_TAIL, '').replace(TIME_TAIL, '').trim();
    if (next === s) break;
    s = next;
  }
  if (!s || TIME_ONLY.test(s) || BADGE_ONLY.test(s) || PREVIEW_LINE.test(s) || labels.has(s.toLowerCase())) return null;
  return s.slice(0, 500);
}

/** Zalo Web 28/09/2026: `<div class="conv__label" title="HEAD" style="color: rgb(…)"><i class="fa fa-icon-solid-label-filled"/></div>`. */
const LABEL_CHIP = '.conv__label[title]';

function labelChipOf(item: Element): { name: string; color?: string } | null {
  const el = item.querySelector<HTMLElement>(LABEL_CHIP);
  const name = norm(el?.getAttribute('title') ?? '');
  if (!el || !name || name.length > 100) return null;
  const color = (el.style?.color || '').trim();
  return color && color.length <= 50 ? { name, color } : { name };
}

function labelsOf(item: Element): string[] {
  const out = new Set<string>();
  for (const el of item.querySelectorAll(LABEL_NODE)) {
    if (el.querySelector(LABEL_NODE)) continue; // take the innermost chip only
    const t = norm(el.textContent ?? '');
    if (t && t.length <= 40 && !BADGE_ONLY.test(t) && !TIME_ONLY.test(t)) out.add(t);
  }
  return [...out].slice(0, 20);
}

function unreadOf(item: Element, lines: string[]): number | undefined {
  const parse = (t: string) => {
    const m = /^(\d{1,3})\+?$/.exec(norm(t));
    return m ? Number(m[1]) : undefined;
  };
  for (const el of item.querySelectorAll(UNREAD_NODE)) {
    const n = parse(el.textContent ?? '');
    if (n != null) return n;
  }
  // Without a badge node only the unambiguous "N+" form counts.
  for (const l of lines) if (/^\d{1,3}\+$/.test(l)) return parse(l);
  return undefined;
}

/**
 * Unread marks on a sidebar item, surveyed on Zalo Web 29/09/2026: the preview
 * row gets `z-conv-message --unread`, the item shows `conv-action__unread-v2`
 * and a `z-noti-badge` (a counter, or only a dot when the chat is muted).
 */
const UNREAD_MARK = '[class*="--unread"], [class*="__unread"], .z-noti-badge, [class*="noti-badge"]';

/**
 * True when the sidebar item shows any unread mark, with or without a number.
 * Deliberately broad: automatic runs never open such a conversation, because
 * opening it tells the sender the messages were seen.
 */
export function hasUnreadMark(item: Element): boolean {
  if (item.querySelector(UNREAD_MARK)) return true;
  return unreadOf(item, textLines(item)) != null;
}

function avatarOf(item: Element): string | undefined {
  for (const img of item.querySelectorAll(AVATAR_IMG)) {
    const u = (img as HTMLImageElement).currentSrc || img.getAttribute('src') || '';
    // Emoji/stickers in the preview render as <img> too; they are not avatars.
    if (/^https:\/\//i.test(u) && u.length <= 2000 && !/emoji|sticker/i.test(u)) return u;
  }
  return undefined;
}

/**
 * Best-effort conversation name of one sidebar item. Tries, in order: the
 * mapping's `threadTitle`, a data-id name node, class-name fallbacks, then the
 * item's lines. Time/badge tails, label chips and preview lines are rejected.
 */
function pickName(item: Element, sel: DomSelectors, labels: ReadonlySet<string> = new Set()): string | null {
  const nodes: Element[] = [];
  for (const q of [sel.threadTitle, NAME_NODE, NAME_CLASS]) {
    try {
      nodes.push(...item.querySelectorAll(q));
    } catch {
      /* invalid selector from a mapping: skip */
    }
  }
  for (const n of nodes) {
    const first = textLines(n)[0];
    const name = first ? cleanNameLine(first, labels) : null;
    if (name) return name;
  }
  for (const line of textLines(item)) {
    const name = cleanNameLine(line, labels);
    if (name) return name;
  }
  return null;
}

/**
 * Reads conversation names from the sidebar list. Each item carries the threadId
 * in `threadIdAttr`; the name is plaintext on screen. Reading the sidebar never
 * opens a conversation, so nothing is marked read. Also picks up avatar (https),
 * unread count and label chips when present; never the message preview.
 */
export function extractThreadNames(root: ParentNode, sel: DomSelectors = DEFAULT_DOM_SELECTORS): ThreadName[] {
  const out: ThreadName[] = [];
  const seen = new Set<string>();
  for (const item of root.querySelectorAll(threadItemSelector(sel))) {
    const threadId = item.getAttribute(sel.threadIdAttr);
    if (!threadId || seen.has(threadId)) continue;
    const labels = labelsOf(item);
    const name = pickName(item, sel, new Set(labels.map((l) => l.toLowerCase())));
    if (!name) continue;
    seen.add(threadId);
    const t: ThreadName = { threadId, name, isGroup: !!sel.groupIdPrefix && threadId.startsWith(sel.groupIdPrefix) };
    const avatar = avatarOf(item);
    const unread = unreadOf(item, textLines(item));
    if (avatar) t.avatar = avatar;
    if (unread != null) t.unread = unread;
    if (labels.length) t.labels = labels;
    const chip = labelChipOf(item);
    if (chip) t.label = chip;
    out.push(t);
  }
  return out;
}

/** Display name of one sidebar item (same rules as extractThreadNames). */
export function threadItemName(item: Element, sel: DomSelectors = DEFAULT_DOM_SELECTORS): string | null {
  return pickName(item, sel, new Set(labelsOf(item).map((l) => l.toLowerCase())));
}

const ACTIVE_CLASS = /(?:^|[-_])(?:selected|active)$/i;

function isActive(el: Element): boolean {
  if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-current')) return true;
  return [...el.classList].some((c) => ACTIVE_CLASS.test(c));
}

/**
 * threadId of the currently open conversation, read from the highlighted
 * sidebar item (class `*selected`/`*active` or aria-selected/aria-current on the
 * item, an ancestor wrapper, or a direct child). Null when none is highlighted.
 */
export function readActiveThreadId(root: ParentNode, sel: DomSelectors = DEFAULT_DOM_SELECTORS): string | null {
  for (const item of root.querySelectorAll(threadItemSelector(sel))) {
    const wrapper = item.parentElement;
    const candidates = [item, ...item.children];
    if (wrapper && wrapper.querySelectorAll(threadItemSelector(sel)).length === 1) candidates.push(wrapper);
    if (candidates.some(isActive)) return item.getAttribute(sel.threadIdAttr) || null;
  }
  return null;
}

/** Sidebar list scroller, to load all names (virtual list). Side-effect free. */
export function findSidebarScroller(root: ParentNode, sel: DomSelectors = DEFAULT_DOM_SELECTORS): Element | null {
  const item = root.querySelector(threadItemSelector(sel));
  let el: Element | null = item?.parentElement ?? null;
  while (el) {
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    const oy = style?.overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) return el;
    el = el.parentElement;
  }
  return null;
}

export interface CollectNamesOptions {
  /** Scroller to walk; found from the first sidebar item when omitted. */
  scroller?: Element | null;
  sleep?: (ms: number) => Promise<void>;
  /** Pause after each scroll step for the virtual list to render (ms). */
  stepDelayMs?: number;
  /** Upper bound on scroll steps, so a list that keeps growing cannot spin forever. */
  maxSteps?: number;
}

/**
 * Reads every conversation name from the sidebar by walking its virtual list
 * one viewport at a time (jumping straight to the bottom would skip the items
 * in between: a virtual list only renders what is on screen). At the end it
 * waits two extra rounds for lazy loading, then puts the scroll position back.
 * Scrolling the sidebar never opens a conversation, so nothing is marked read.
 */
export async function collectSidebarNames(
  root: ParentNode,
  sel: DomSelectors = DEFAULT_DOM_SELECTORS,
  opts: CollectNamesOptions = {},
): Promise<ThreadName[]> {
  const byId = new Map<string, ThreadName>();
  const absorb = () => {
    for (const n of extractThreadNames(root, sel)) byId.set(n.threadId, n);
  };
  absorb();
  const scroller = opts.scroller === undefined ? findSidebarScroller(root, sel) : opts.scroller;
  if (!scroller) return [...byId.values()];
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const delay = opts.stepDelayMs ?? 350;
  const maxSteps = opts.maxSteps ?? 400;
  const start = scroller.scrollTop;
  let pos = 0;
  let atEnd = 0;
  for (let i = 0; i < maxSteps; i++) {
    scroller.scrollTop = pos;
    await sleep(delay);
    absorb();
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (pos >= max) {
      // Bottom reached: give lazy loading two rounds to append more items.
      if (++atEnd > 2) break;
      continue;
    }
    atEnd = 0;
    pos = Math.min(pos + Math.max(Math.floor(scroller.clientHeight * 0.8), 40), max);
  }
  scroller.scrollTop = start; // restore the user's view
  return [...byId.values()];
}

export interface MessageContentPayloadItem {
  cliMsgId: string;
  direction: 'in' | 'out';
  text?: string | null;
  images?: string[];
  links?: string[];
  files?: FileInfo[];
  voice?: VoiceInfo;
  video?: VideoInfo;
  card?: CardInfo;
  location?: LocationInfo;
  call?: CallInfo;
  reminder?: ReminderInfo;
  quote?: QuoteInfo;
  senderName?: string;
  kind?: MessageKind;
  capturedAt: number;
  schemaVersion: string;
}

export const DOM_SCHEMA_VERSION = 'zalo-v1';

/** Minimum bubbles on screen before "none has content" counts as drift. */
const HEALTH_MIN_BUBBLES = 5;

export interface DomHealth {
  bubbles: number;
  threadItems: number;
  /** Selector keys that look broken; empty when the DOM matches. */
  broken: (keyof DomSelectors)[];
  /** Structural hints for re-mapping: `data-id` values and id prefixes. Never text. */
  observedKeys: string[];
}

/**
 * Checks whether the selectors still fit the rendered page. Heuristics only:
 * no sidebar items at all means `threadIdAttr` broke; several bubbles with no
 * text, image or link means `text` broke. No bubbles is not drift by itself
 * (no conversation may be open). `observedKeys` carries attribute names/values
 * of the page structure — never message text — to help Claude propose a fix.
 */
export function checkDomHealth(root: ParentNode, sel: DomSelectors = DEFAULT_DOM_SELECTORS): DomHealth {
  const bubbles = extractMessages(root, sel);
  const threadItems = root.querySelectorAll(threadItemSelector(sel)).length;
  const broken: (keyof DomSelectors)[] = [];
  if (threadItems === 0) broken.push('threadIdAttr');
  if (bubbles.length >= HEALTH_MIN_BUBBLES && bubbles.every((m) => !hasMessageContent(m))) {
    broken.push('text');
  }

  const observed = new Set<string>();
  if (broken.length) {
    for (const el of root.querySelectorAll('[data-id]')) {
      observed.add(`data-id=${el.getAttribute('data-id')}`.slice(0, 200));
      if (observed.size >= 150) break;
    }
    // Ids with the numeric tail stripped, e.g. `bb_msg_id_123456789` → `id^=bb_msg_id_`.
    for (const el of root.querySelectorAll('[id]')) {
      const m = /^(\D+)\d{6,}$/.exec(el.id);
      if (m) observed.add(`id^=${m[1]}`.slice(0, 200));
      if (observed.size >= 200) break;
    }
  }
  return { bubbles: bubbles.length, threadItems, broken, observedKeys: [...observed].slice(0, 200) };
}

/** True when a bubble carries anything worth storing (text or any media). */
export function hasMessageContent(m: DomMessage): boolean {
  return (
    (m.text != null && m.text !== '') ||
    m.images.length > 0 ||
    m.links.length > 0 ||
    !!m.files?.length ||
    !!m.voice ||
    !!m.video ||
    !!m.card ||
    !!m.location ||
    !!m.call ||
    !!m.reminder
  );
}

/**
 * Turns extracted bubbles into /ingest/message-content items, keeping only
 * those that carry content (text, image, link, file, voice, video or card).
 * Empty bubbles (stickers, gifs) are skipped so they are not marked "content
 * complete". A voice without URL (the <audio> only appears after Play) is still
 * sent with its duration; the API stores it as `partial` for re-capture.
 */
export function toContentItems(messages: DomMessage[], capturedAt: number): MessageContentPayloadItem[] {
  const items: MessageContentPayloadItem[] = [];
  for (const m of messages) {
    if (!hasMessageContent(m)) continue;
    // Unsurveyed structure: keep the message pending rather than store a guess.
    if (m.structure === 'unknown') continue;
    items.push({
      cliMsgId: m.cliMsgId,
      direction: m.direction,
      ...(m.text != null ? { text: m.text } : {}),
      ...(m.images.length ? { images: m.images } : {}),
      ...(m.links.length ? { links: m.links } : {}),
      ...(m.files?.length ? { files: m.files } : {}),
      ...(m.voice ? { voice: m.voice } : {}),
      ...(m.video ? { video: m.video } : {}),
      ...(m.card ? { card: m.card } : {}),
      ...(m.location ? { location: m.location } : {}),
      ...(m.call ? { call: m.call } : {}),
      ...(m.reminder ? { reminder: m.reminder } : {}),
      ...(m.quote ? { quote: m.quote } : {}),
      ...(m.senderName ? { senderName: m.senderName } : {}),
      ...(m.kind ? { kind: m.kind } : {}),
      capturedAt,
      schemaVersion: DOM_SCHEMA_VERSION,
    });
  }
  return items;
}
