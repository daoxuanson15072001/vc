/**
 * Media detectors for Zalo Web chat bubbles: images, voice, files, video,
 * business cards / link previews, stickers.
 *
 * Real samples (surveyed 2026-09-28) locked the anchors of photo, photo album,
 * file and link bubbles. Voice, video, sticker, gif, location and business card
 * are still guesses, so every detector stays defensive:
 *   1. `data-id` anchors — Zalo names them like `div_SentMsg_Text`. We match the
 *      `_`-separated tokens of each `data-id` against a regex (so `Profile` never
 *      matches `File`), plus optional exact CSS anchors to lock later.
 *   2. Tag fallbacks — `<img>`, `<video>`, `<audio>`, `<a download>`, and text
 *      such as "12.3 MB" or "0:15".
 * Every selector lives in `MEDIA_SELECTORS` so it can be locked from real HTML
 * (see `diagnoseBubble` and the console snippet in docs/04-ky-thuat/zalo-web/zalo-web-extraction.md §4.3).
 * Each detector is independent: one failing never hides another's result.
 *
 * Only `https:` URLs are kept; `blob:` URLs (object URLs that die with the tab)
 * and every other scheme are dropped. Pure DOM parsing, no chrome.*.
 */

export type MessageKind = 'text' | 'image' | 'voice' | 'file' | 'video' | 'card' | 'sticker' | 'location' | 'call' | 'reminder' | 'other';

export interface FileInfo {
  name: string;
  size?: string;
  ext?: string;
  url?: string;
}
export interface VoiceInfo {
  url?: string;
  durationSec?: number;
}
export interface VideoInfo {
  url?: string;
  thumb?: string;
  durationSec?: number;
}
export interface LocationInfo {
  lat?: number;
  lng?: number;
  title?: string;
  address?: string;
  url?: string;
}
export interface CallInfo {
  outcome: 'missed' | 'declined' | 'ended' | 'unknown';
  video?: boolean;
  durationSec?: number;
}
export interface ReminderInfo {
  title?: string;
  when?: string;
}
export interface CardInfo {
  title?: string;
  url?: string;
  userId?: string;
}

export interface MediaDetectorSpec {
  /** Tested against each `_`-separated token of every `data-id` inside the bubble. */
  dataIdToken: RegExp;
  /** Exact CSS anchors, matched in addition (empty until locked from real HTML). */
  anchors: string;
  /** Tag fallback: elements that imply this kind even without a data-id anchor. */
  tags: string;
}

/**
 * Single table of every media selector. Guesses until real HTML samples exist;
 * lock by filling `anchors` (and narrowing `dataIdToken`) once samples are in.
 */
export const MEDIA_SELECTORS = {
  image: {
    dataIdToken: /^(photo|grpphoto|image|img|picture|pic)/i,
    // Locked 2026-09-28: single photo `div_*Msg_Photo`, album `div_*Msg_GrpPhoto`.
    anchors: '[data-id$="Msg_Photo"], [data-id$="Msg_GrpPhoto"], .card--group-photo',
    tags: 'img',
  },
  voice: {
    dataIdToken: /^(voice|audio|record)/i,
    anchors: '',
    tags: 'audio',
  },
  file: {
    dataIdToken: /^(file|document|doc|attach)/i,
    // Locked 2026-09-28: file bubbles have no dedicated data-id, only this class.
    anchors: '.file-message__container',
    tags: 'a[download]',
  },
  video: {
    dataIdToken: /^video/i,
    anchors: '',
    tags: 'video',
  },
  /** Business card (danh thiếp, msgType 6) and web content preview (msgType 52). */
  card: {
    dataIdToken: /^(card|namecard|contact|recommend|webcontent|preview)/i,
    // Locked 2026-09-28: link / web content bubble `div_*Msg_Link` (msgType 52).
    anchors: '[data-id$="Msg_Link"]',
    tags: '',
  },
  sticker: {
    dataIdToken: /^(sticker|gif)/i,
    anchors: '',
    tags: '',
  },
  /**
   * L5 kinds (M1c-08). No real sample yet: these are declared guesses (data-id tokens + text), to be locked from
   * a real bubble the owner sends in the test group. Anchors stay empty until then.
   */
  location: {
    dataIdToken: /^(location|map|geo|gps)/i,
    anchors: '',
    tags: '',
  },
  call: {
    dataIdToken: /^(call|missedcall|videocall)/i,
    anchors: '',
    tags: '',
  },
  reminder: {
    dataIdToken: /^(reminder|remind|calendar|schedule|appointment)/i,
    anchors: '',
    tags: '',
  },
  /** Sub-parts inside a matched anchor. */
  parts: {
    /** Message photo inside an image anchor (locked; excludes avatars/icons). */
    photo: 'img.zimg-el',
    /** File bubble parts (locked 2026-09-28). */
    fileName: '.file-message__content-title .truncate',
    fileTitle: '.file-message__content-title[title]',
    fileSize: '.file-message__content-info-size',
    fileLink: 'a.file-message__actions.download',
    /** Element holding a file name / card title. */
    name: '[data-id*="Name" i], [data-id*="Title" i], [class*="name" i], [class*="title" i]',
    /** Element holding a duration ("0:15"). */
    duration: '[data-id*="Duration" i], [class*="duration" i], [data-id*="Length" i]',
    /** Elements to ignore when parsing durations (message clock time, e.g. "14:42"). */
    timeSkip: '[data-id*="Time" i], [class*="send-time" i], [class*="clock" i]',
    /** Attributes that may carry a media URL before the element loads it. */
    urlAttrs: ['src', 'data-src', 'data-url', 'data-href', 'href'],
    /** Attributes that may carry a Zalo user id on a business card. */
    userIdAttrs: ['data-uid', 'data-user-id', 'data-userid', 'data-uin'],
  },
  /** Coordinates in a map link or attribute: `q=21.02,105.85`, `@21.02,105.85`, `ll=…`, `lat=…&lng=…`. */
  coordsInUrl: /(?:[?&](?:q|ll|query|center)=|@)(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)|[?&]lat=(-?\d{1,2}(?:\.\d+)?)&(?:lng|lon|long)=(-?\d{1,3}(?:\.\d+)?)/i,
  /** Call wording (Vietnamese UI): outcome by keyword. */
  callMissed: /nhỡ|không trả lời|bị lỡ/i,
  callDeclined: /từ chối|đã hủy|đã huỷ/i,
  callVideo: /video/i,
  /** Reminder time as written: "09:00 05/10/2026", "05/10/2026 09:00", "09:00 ngày 05/10". */
  reminderWhen: /\d{1,2}:\d{2}(?:\s+(?:ngày\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+\d{1,2}:\d{2})?/,
  /** Sticker/emoji image URLs. */
  stickerSrc: /sticker|emoticon/i,
  /**
   * Images that are UI, not message content: the reaction ("like") icon that
   * Zalo renders under every bubble (`.../iconlike_....png`, seen 28/09/2026),
   * emoji sprites and other icons. Applied on top of the mapping's `imageSkip`.
   */
  uiImageSrc: /iconlike|\/icon[_-]|\/icons?\/|emoji|\/assets\//i,
  /** Reaction / like buttons: nothing inside them is message content. */
  reactionAnchors: '[data-id$="Msg_React"], [class*="reaction" i]',
  /** Displayed file size, e.g. "12.3 MB", "850 KB". */
  sizeText: /(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|TB)\b/i,
  /** Duration text: m:ss or h:mm:ss, or `15"`. */
  durationText: /(?:^|\s)(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\s|$)|(\d{1,4})\s*(?:"|s\b|giây)/i,
  /** File name with an extension. */
  fileName: /[^\s/\\]+\.([a-z0-9]{1,8})$/i,
  /** Zalo profile link carrying a user id, for cards. */
  profileUrl: /^https:\/\/(?:[a-z]+\.)?zalo\.me\/(\d{6,25})(?:[/?#]|$)/i,
} as const satisfies Record<string, unknown>;

export type MediaSelectors = typeof MEDIA_SELECTORS;
type DetectorKey = 'image' | 'voice' | 'file' | 'video' | 'card' | 'sticker' | 'location' | 'call' | 'reminder';

/** Keeps https URLs only (blob:, http:, data:, javascript: are dropped). */
export function safeUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u).protocol === 'https:' ? u : undefined;
  } catch {
    return undefined;
  }
}

function text(el: Element | null | undefined): string {
  if (!el) return '';
  const raw = (el as HTMLElement).innerText ?? el.textContent ?? '';
  return raw.replace(/ /g, ' ').trim();
}

function dataIdMatches(el: Element, re: RegExp): boolean {
  const v = el.getAttribute('data-id');
  return !!v && v.split('_').some((t) => re.test(t));
}

function safeQueryAll(root: ParentNode, css: string): Element[] {
  if (!css) return [];
  try {
    return [...root.querySelectorAll(css)];
  } catch {
    return []; // invalid selector must never break extraction
  }
}

/** Keeps only the outermost elements (drops ones nested in another match). */
function outermost(els: Element[]): Element[] {
  const uniq = [...new Set(els)];
  return uniq.filter((e) => !uniq.some((o) => o !== e && o.contains(e)));
}

/** Elements inside `bubble` anchoring detector `key` (data-id token, CSS anchor, tag fallback). */
export function findAnchors(bubble: Element, key: DetectorKey, table: MediaSelectors = MEDIA_SELECTORS): Element[] {
  const spec = table[key] as MediaDetectorSpec;
  const byId = [...bubble.querySelectorAll('[data-id]')].filter((e) => dataIdMatches(e, spec.dataIdToken));
  return outermost([...byId, ...safeQueryAll(bubble, spec.anchors), ...safeQueryAll(bubble, spec.tags)]);
}

function firstUrl(scope: Element, table: MediaSelectors, css = '*'): string | undefined {
  const els = [scope, ...safeQueryAll(scope, css)];
  for (const el of els) {
    const cur = (el as HTMLMediaElement).currentSrc;
    const u = safeUrl(cur);
    if (u) return u;
    for (const a of table.parts.urlAttrs) {
      const v = safeUrl(el.getAttribute(a));
      if (v) return v;
    }
  }
  return undefined;
}

/** Parses "0:15", "1:02:03", `15"` into seconds. Ignores message clock times. */
export function parseDuration(s: string, table: MediaSelectors = MEDIA_SELECTORS): number | undefined {
  const m = table.durationText.exec(s);
  if (!m) return undefined;
  if (m[4] != null) return Number(m[4]);
  const h = m[1] != null ? Number(m[1]) : 0;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function durationOf(anchor: Element, table: MediaSelectors): number | undefined {
  const media = (anchor.matches('audio, video') ? anchor : anchor.querySelector('audio, video')) as HTMLMediaElement | null;
  if (media && Number.isFinite(media.duration) && media.duration > 0) return Math.round(media.duration);
  const explicit = safeQueryAll(anchor, table.parts.duration)[0];
  if (explicit) return parseDuration(text(explicit), table);
  // Parse the anchor text without clock-time nodes.
  const clone = anchor.cloneNode(true) as Element;
  for (const t of safeQueryAll(clone, table.parts.timeSkip)) t.remove();
  return parseDuration(text(clone) || clone.textContent || '', table);
}

// ---------------------------------------------------------------- detectors

/** Voice (msgType 3). `<audio>` appears only after Play, so URL is often absent. */
export function detectVoice(bubble: Element, table: MediaSelectors = MEDIA_SELECTORS): VoiceInfo | null {
  const [anchor] = findAnchors(bubble, 'voice', table);
  if (!anchor) return null;
  const url = firstUrl(anchor, table, 'audio, source, [data-src], [data-url]');
  const durationSec = durationOf(anchor, table);
  return { ...(url ? { url } : {}), ...(durationSec != null ? { durationSec } : {}) };
}

/** Video (msgType 18): URL (often blob: → dropped), poster/thumbnail, duration. */
export function detectVideo(bubble: Element, table: MediaSelectors = MEDIA_SELECTORS): VideoInfo | null {
  const [anchor] = findAnchors(bubble, 'video', table);
  if (!anchor) return null;
  const video = (anchor.matches('video') ? anchor : anchor.querySelector('video')) as HTMLVideoElement | null;
  const url = video ? firstUrl(video, table, 'source') : safeUrl(anchor.querySelector('a[href]')?.getAttribute('href'));
  const thumb =
    safeUrl(video?.getAttribute('poster')) ??
    safeUrl((anchor.querySelector('img') as HTMLImageElement | null)?.currentSrc || anchor.querySelector('img')?.getAttribute('src'));
  const durationSec = durationOf(anchor, table);
  return {
    ...(url ? { url } : {}),
    ...(thumb ? { thumb } : {}),
    ...(durationSec != null ? { durationSec } : {}),
  };
}

/** Files (msgType 19): name, displayed size, extension, download link. */
export function detectFiles(bubble: Element, table: MediaSelectors = MEDIA_SELECTORS): FileInfo[] {
  const out: FileInfo[] = [];
  for (const anchor of findAnchors(bubble, 'file', table)) {
    const link = (
      anchor.matches('a') ? anchor : safeQueryAll(anchor, table.parts.fileLink)[0] ?? anchor.querySelector('a[download], a[href]')
    ) as HTMLAnchorElement | null;
    const lines = text(anchor)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const candidates = [
      text(safeQueryAll(anchor, table.parts.fileName)[0]),
      safeQueryAll(anchor, table.parts.fileTitle)[0]?.getAttribute('title'),
      link?.getAttribute('download'),
      text(safeQueryAll(anchor, table.parts.name)[0]),
      anchor.getAttribute('title'),
      link?.getAttribute('title'),
      lines.find((l) => table.fileName.test(l)),
    ].filter((s): s is string => !!s && !!s.trim());
    // A bare `<a download>` (tag fallback) usually shows its size in a sibling.
    const parent = anchor.parentElement;
    const sizeScope =
      anchor.matches('a') && parent && parent !== bubble && bubble.contains(parent) ? parent : anchor;
    const sizeEl = safeQueryAll(anchor, table.parts.fileSize)[0];
    const sizeSrc = sizeEl ? text(sizeEl) || sizeEl.getAttribute('title') || '' : text(sizeScope) || sizeScope.textContent || '';
    const sizeMatch = table.sizeText.exec(sizeSrc);
    const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}` : undefined;
    const name = candidates.find((c) => table.fileName.test(c.trim()))?.trim() ?? candidates[0]?.trim();
    if (!name && !size) continue;
    const ext = name ? table.fileName.exec(name)?.[1]?.toLowerCase() : undefined;
    const url = safeUrl(link?.getAttribute('href'));
    out.push({
      name: (name ?? '(không rõ tên)').slice(0, 500),
      ...(size ? { size } : {}),
      ...(ext ? { ext } : {}),
      ...(url ? { url } : {}),
    });
  }
  return out;
}

/** Business card (msgType 6) / web content preview (msgType 52). */
export function detectCard(bubble: Element, table: MediaSelectors = MEDIA_SELECTORS): CardInfo | null {
  const [anchor] = findAnchors(bubble, 'card', table);
  if (!anchor) return null;
  const titleEl = safeQueryAll(anchor, table.parts.name)[0];
  const title = (text(titleEl) || text(anchor).split('\n').map((s) => s.trim()).find(Boolean) || '').slice(0, 1000);
  const url = safeUrl(anchor.querySelector('a[href]')?.getAttribute('href') ?? anchor.getAttribute('href'));
  let userId: string | undefined;
  for (const el of [anchor, ...anchor.querySelectorAll('*')]) {
    for (const a of table.parts.userIdAttrs) {
      const v = el.getAttribute(a);
      if (v && /^\d{1,25}$/.test(v)) userId = v;
    }
    if (userId) break;
  }
  if (!userId && url) userId = table.profileUrl.exec(url)?.[1];
  if (!title && !url && !userId) return null;
  return { ...(title ? { title } : {}), ...(url ? { url } : {}), ...(userId ? { userId } : {}) };
}

/** Text lines of a block: one per element holding its own text (works without layout, e.g. happy-dom innerText). */
function lines(el: Element): string[] {
  const out: string[] = [];
  const walk = (n: Element) => {
    const own = [...n.childNodes]
      .filter((c) => c.nodeType === 3)
      .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
    if (own) out.push(own);
    for (const c of n.children) {
      if (!['SCRIPT', 'STYLE'].includes(c.tagName)) walk(c);
    }
  };
  walk(el);
  return out;
}

/** Valid [lat, lng] from two numbers, or undefined. */
function coords(a: unknown, b: unknown): { lat: number; lng: number } | undefined {
  const lat = Number(a);
  const lng = Number(b);
  if (a === null || a === undefined || b === null || b === undefined || a === '' || b === '') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

/** Location (msgType 17): coordinates from data attributes or the map link, title / address from the bubble text. */
export function detectLocation(bubble: Element, table: MediaSelectors = MEDIA_SELECTORS): LocationInfo | null {
  const [anchor] = findAnchors(bubble, 'location', table);
  if (!anchor) return null;
  const href = anchor.querySelector('a[href]')?.getAttribute('href') ?? anchor.getAttribute('href') ?? '';
  const url = safeUrl(href);
  let c = coords(anchor.getAttribute('data-lat') ?? anchor.querySelector('[data-lat]')?.getAttribute('data-lat'), anchor.getAttribute('data-lng') ?? anchor.querySelector('[data-lng]')?.getAttribute('data-lng'));
  if (!c && href) {
    const m = table.coordsInUrl.exec(decodeURIComponent(href));
    if (m) c = coords(m[1] ?? m[3], m[2] ?? m[4]);
  }
  const ls = lines(anchor);
  const title = ls[0]?.slice(0, 500);
  const address = ls.length > 1 ? ls.slice(1).join(', ').slice(0, 1000) : undefined;
  if (!c && !url && !title) return null;
  return { ...(c ?? {}), ...(title ? { title } : {}), ...(address ? { address } : {}), ...(url ? { url } : {}) };
}

/** Call line (cuộc gọi đến / đi / nhỡ): outcome by wording, duration when shown. */
export function detectCall(bubble: Element, table: MediaSelectors = MEDIA_SELECTORS): CallInfo | null {
  const [anchor] = findAnchors(bubble, 'call', table);
  if (!anchor) return null;
  const t = text(anchor);
  if (!t) return null;
  const durationSec = durationOf(anchor, table);
  const outcome: CallInfo['outcome'] = table.callMissed.test(t)
    ? 'missed'
    : table.callDeclined.test(t)
      ? 'declined'
      : durationSec != null
        ? 'ended'
        : 'unknown';
  return { outcome, ...(table.callVideo.test(t) ? { video: true } : {}), ...(durationSec != null && outcome === 'ended' ? { durationSec } : {}) };
}

/** Appointment reminder (nhắc hẹn): title (first line) and the time as written. */
export function detectReminder(bubble: Element, table: MediaSelectors = MEDIA_SELECTORS): ReminderInfo | null {
  const [anchor] = findAnchors(bubble, 'reminder', table);
  if (!anchor) return null;
  const ls = lines(anchor);
  if (!ls.length) return null;
  const whenLine = ls.find((l) => table.reminderWhen.test(l));
  const when = whenLine ? table.reminderWhen.exec(whenLine)?.[0]?.slice(0, 200) : undefined;
  const title = ls.find((l) => l !== whenLine)?.slice(0, 1000);
  if (!title && !when) return null;
  return { ...(title ? { title } : {}), ...(when ? { when } : {}) };
}

/** Sticker / gif: only affects `kind`, never content. */
export function detectSticker(bubble: Element, table: MediaSelectors = MEDIA_SELECTORS): boolean {
  if (findAnchors(bubble, 'sticker', table).length) return true;
  return [...bubble.querySelectorAll('img')].some((i) => table.stickerSrc.test(i.getAttribute('src') ?? ''));
}

/**
 * Message images (msgType 2). Skips avatars/emoji/stickers (`skip`), and images
 * that belong to another media block (video thumbnail, file icon, card avatar).
 */
export function detectImages(bubble: Element, skip: RegExp | null, table: MediaSelectors = MEDIA_SELECTORS): string[] {
  return [...new Set(imageSources(bubble, skip, table).filter((u) => !!safeUrl(u)))];
}

/**
 * Photos of a bubble that Zalo shows as `blob:` object URLs (decrypted in the
 * page). They die with the tab, so the extension reads the bytes and uploads
 * them; the schema would drop the URLs themselves.
 */
export function detectBlobImages(bubble: Element, skip: RegExp | null, table: MediaSelectors = MEDIA_SELECTORS): string[] {
  return [...new Set(imageSources(bubble, skip, table).filter((u) => u.startsWith('blob:')))];
}

/** Candidate photo URLs of a bubble, any scheme, minus UI images and media owned by other detectors. */
function imageSources(bubble: Element, skip: RegExp | null, table: MediaSelectors): string[] {
  const owned = [
    ...findAnchors(bubble, 'video', table),
    ...findAnchors(bubble, 'file', table),
    ...findAnchors(bubble, 'card', table),
    ...findAnchors(bubble, 'voice', table),
    ...findAnchors(bubble, 'sticker', table),
    ...findAnchors(bubble, 'location', table),
    ...findAnchors(bubble, 'call', table),
    ...findAnchors(bubble, 'reminder', table),
    ...safeQueryAll(bubble, table.reactionAnchors),
  ];
  // Locked path: photos (`img.zimg-el`) inside photo / album anchors.
  const locked = findAnchors(bubble, 'image', table).flatMap((a) => safeQueryAll(a, table.parts.photo));
  const pool = locked.length ? locked : [...bubble.querySelectorAll('img')];
  return pool
    .filter((i) => !owned.some((o) => o.contains(i)))
    .map((i) => (i as HTMLImageElement).currentSrc || i.getAttribute('src') || '')
    .filter((u) => !!u && !skip?.test(u) && !table.stickerSrc.test(u) && !table.uiImageSrc.test(u));
}

/** Anchors of blocks whose links are not "message links" (download / media URLs). */
export function mediaLinkOwners(bubble: Element, table: MediaSelectors = MEDIA_SELECTORS): Element[] {
  return [
    ...findAnchors(bubble, 'file', table),
    ...findAnchors(bubble, 'video', table),
    ...findAnchors(bubble, 'voice', table),
    ...findAnchors(bubble, 'location', table),
  ];
}

/** Runs `fn`, returning `fallback` if it throws, so one detector never breaks the others. */
export function guard<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export interface MediaParts {
  text: string | null;
  images: string[];
  links: string[];
  files: FileInfo[];
  voice: VoiceInfo | null;
  video: VideoInfo | null;
  card: CardInfo | null;
  sticker: boolean;
  location?: LocationInfo | null;
  call?: CallInfo | null;
  reminder?: ReminderInfo | null;
}

/** Infers the message kind from what was detected (media wins over text caption). */
export function inferKind(p: MediaParts): MessageKind {
  if (p.voice) return 'voice';
  if (p.video) return 'video';
  if (p.files.length) return 'file';
  if (p.card) return 'card';
  if (p.location) return 'location';
  if (p.call) return 'call';
  if (p.reminder) return 'reminder';
  if (p.images.length) return 'image';
  if (p.sticker) return 'sticker';
  if (p.text || p.links.length) return 'text';
  return 'other';
}

// ---------------------------------------------------------------- diagnostics

export interface BubbleDiagnosis {
  /** Distinct `data-id` values inside the bubble (structure only, never text). */
  dataIds: string[];
  /** Media-ish tags present: img, video, audio, source, picture, canvas, a[download], a[href]. */
  mediaTags: string[];
}

/** Structural fingerprint of one bubble, to lock `MEDIA_SELECTORS` from real HTML. */
export function diagnoseBubble(el: Element): BubbleDiagnosis {
  const dataIds = new Set<string>();
  for (const e of [el, ...el.querySelectorAll('[data-id]')]) {
    const v = e.getAttribute('data-id');
    if (v) dataIds.add(v.slice(0, 200));
  }
  const mediaTags = new Set<string>();
  for (const t of ['img', 'video', 'audio', 'source', 'picture', 'canvas']) if (el.querySelector(t)) mediaTags.add(t);
  if (el.querySelector('a[download]')) mediaTags.add('a[download]');
  if (el.querySelector('a[href]')) mediaTags.add('a[href]');
  return { dataIds: [...dataIds].sort(), mediaTags: [...mediaTags].sort() };
}
