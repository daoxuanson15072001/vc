import { cleanDomId, deriveMessageId, nameKey, stableUrlKey } from './ids';
import { DEFAULT_MESSENGER_SELECTORS, type MessengerSelectors } from './selectors';
import { parseTimeLabel } from './time';

/**
 * Reads what Messenger already renders in the user's own tab: the open
 * conversation's messages and the left conversation list. Read-only: never
 * clicks, opens, scrolls or marks anything read, never reads cookies, web
 * storage, IndexedDB or tokens, never calls Facebook endpoints.
 *
 * Pure DOM parsing (no chrome.*), unit-tested with happy-dom on fixture HTML.
 * All selectors come from `MessengerSelectors` (UNVERIFIED, see selectors.ts).
 */

// ---- Thread / owner ids --------------------------------------------------------

export interface ThreadRef {
  threadId: string;
  /** End-to-end encrypted chat (`/e2ee/t/<id>`). */
  e2ee: boolean;
}

const THREAD_PATH = /^\/(?:messages\/)?(e2ee\/)?t\/([\w.-]{1,128})\/?$/;
const FB_HOSTS = /^(?:www\.|web\.)?(?:messenger\.com|facebook\.com)$/i;

/** Thread id from a Messenger path or URL (`/t/<id>`, `/e2ee/t/<id>`, `/messages/t/<id>`…). */
export function parseThreadPath(pathOrUrl: string | null | undefined): ThreadRef | null {
  if (!pathOrUrl) return null;
  let path = pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) {
    try {
      const u = new URL(pathOrUrl);
      if (!FB_HOSTS.test(u.hostname)) return null;
      path = u.pathname;
    } catch {
      return null;
    }
  } else {
    path = pathOrUrl.split(/[?#]/)[0];
  }
  const m = THREAD_PATH.exec(path);
  return m ? { threadId: m[2], e2ee: !!m[1] } : null;
}

/** The conversation open in this tab, from the address bar path. */
export function readActiveThread(loc: { pathname: string }): ThreadRef | null {
  return parseThreadPath(loc.pathname);
}

/** Numeric Facebook user id from a profile link (`/profile.php?id=…`, `/<digits>`), else null. */
export function profileIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  let u: URL;
  try {
    u = new URL(href, 'https://www.facebook.com');
  } catch {
    return null;
  }
  if (!FB_HOSTS.test(u.hostname)) return null;
  if (/\/profile\.php$/.test(u.pathname)) {
    const id = u.searchParams.get('id');
    return id && /^\d{5,25}$/.test(id) ? id : null;
  }
  const m = /^\/(\d{5,25})\/?$/.exec(u.pathname);
  return m ? m[1] : null;
}

/** Owner's numeric id from their own profile link in the page chrome, or null (vanity URL / not rendered). */
export function readOwnerId(doc: ParentNode, sel: MessengerSelectors = DEFAULT_MESSENGER_SELECTORS): string | null {
  for (const a of doc.querySelectorAll<HTMLAnchorElement>(sel.ownProfileLink)) {
    const id = profileIdFromHref(a.getAttribute('href'));
    if (id) return id;
  }
  return null;
}

// ---- Helpers -------------------------------------------------------------------

function textOf(el: Element | null | undefined): string {
  if (!el) return '';
  const raw = (el as HTMLElement).innerText ?? el.textContent ?? '';
  return raw.replace(/ /g, ' ').replace(/[​-‍﻿]/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

const lower = (s: string) => s.toLocaleLowerCase('vi');

/** Unwraps Facebook's outbound link redirector (l.facebook.com / l.messenger.com). */
export function unwrapLink(href: string): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (/^l\.(facebook|messenger)\.com$/i.test(u.hostname) && u.pathname === '/l.php') {
    const target = u.searchParams.get('u');
    return target && /^https?:\/\//i.test(target) ? target : null;
  }
  return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
}

function isHttps(u: string | null | undefined): u is string {
  if (!u) return false;
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Outermost matches of `selector` under `root` that are not inside any `exclude` element. */
function outermost(root: Element, selector: string, exclude: Element[]): Element[] {
  const all = [...root.querySelectorAll(selector)];
  return all.filter(
    (el) => !all.some((o) => o !== el && o.contains(el)) && !exclude.some((x) => x === el || x.contains(el)),
  );
}

function sizeAttr(img: HTMLImageElement, name: 'width' | 'height'): number | null {
  const v = Number(img.getAttribute(name));
  return Number.isFinite(v) && v > 0 ? v : null;
}

// ---- Messages ------------------------------------------------------------------

export type FbMessageKind = 'text' | 'image' | 'file' | 'other';

export interface FbFile {
  name: string;
  url?: string;
}

export interface FbDomMessage {
  msgId: string;
  idSource: 'dom' | 'derived';
  direction: 'in' | 'out';
  /** '0' for the owner; profile id / thread id / name key for others. */
  fromUid: string;
  senderName: string | null;
  text: string | null;
  images: string[];
  links: string[];
  files: FbFile[];
  kind: FbMessageKind;
  /** Separator time + position in the block (ms), so order is kept. */
  sentAt: number;
}

export interface ReadResult {
  threadId: string;
  messages: FbDomMessage[];
  /** Message-list container found. */
  list: boolean;
  rows: number;
  separators: number;
  headings: number;
  /** Message rows skipped because no time separator is rendered above them. */
  unanchored: number;
  /** E2EE chat waiting for the PIN: nothing readable. */
  locked: boolean;
}

export interface ReadContext {
  threadId: string;
  /** From the sidebar (group avatar heuristic); false when unknown. */
  isGroup?: boolean;
  now: number;
  /** Also return rows above the first separator (anchor 0, unstable ids). Sender confirmation only — never ingested. */
  includeUnanchored?: boolean;
}

function topLevelRows(list: Element, sel: MessengerSelectors): Element[] {
  const rows = [...list.querySelectorAll(sel.messageRow)];
  return rows.filter((r) => {
    const parentRow = r.parentElement?.closest(sel.messageRow);
    return !parentRow || !list.contains(parentRow);
  });
}

function isOutgoingLabel(text: string, sel: MessengerSelectors): boolean {
  const t = lower(text);
  return sel.outgoingLabels.some((l) => {
    const x = lower(l);
    return t === x || t.startsWith(`${x} `) || t.startsWith(`${x}:`);
  });
}

/** "Nguyễn A sent" / "Nguyễn A đã gửi" → "Nguyễn A". */
function senderNameFrom(heading: string): string | null {
  const n = heading.replace(/\s+(sent|đã gửi)\s*:?$/i, '').trim();
  return n.length ? n.slice(0, 200) : null;
}

function isLockedE2ee(doc: ParentNode, sel: MessengerSelectors): boolean {
  const main = doc.querySelector('[role="main"]') ?? (doc as Document).body ?? null;
  const t = lower(textOf(main as Element | null));
  return !!t && sel.e2eeLockedLabels.some((l) => t.includes(lower(l)));
}

function rowImages(row: Element, sel: MessengerSelectors, exclude: Element[]): string[] {
  const skip = new RegExp(sel.imageSkip, 'i');
  const out: string[] = [];
  for (const img of row.querySelectorAll<HTMLImageElement>('img[src]')) {
    if (exclude.some((x) => x.contains(img))) continue;
    const src = img.getAttribute('src') ?? '';
    if (!isHttps(src) || skip.test(src)) continue;
    const host = new URL(src).hostname;
    if (!sel.imageHosts.some((h) => host === h || host.endsWith(`.${h}`))) continue;
    const w = sizeAttr(img, 'width');
    const h = sizeAttr(img, 'height');
    if ((w != null && w < sel.minImageSize) || (h != null && h < sel.minImageSize)) continue;
    if (!out.includes(src)) out.push(src);
  }
  return out;
}

function rowFiles(row: Element, sel: MessengerSelectors): { files: FbFile[]; anchors: Element[] } {
  const anchors = [...row.querySelectorAll<HTMLAnchorElement>(sel.fileLink)];
  const files: FbFile[] = [];
  for (const a of anchors) {
    const href = a.getAttribute('href') ?? '';
    const name = (a.getAttribute('download') || textOf(a) || stableUrlKey(href)).slice(0, 500);
    if (!name) continue;
    files.push(isHttps(href) ? { name, url: href } : { name });
  }
  return { files, anchors };
}

/** Avatar links (profile links wrapping an image), used for the sender id and excluded from content. */
function avatarLinks(row: Element): HTMLAnchorElement[] {
  return [...row.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(
    (a) => !!a.querySelector('img, svg') && !!profileIdFromHref(a.getAttribute('href')),
  );
}

function rowLinks(row: Element, exclude: Element[]): string[] {
  const out: string[] = [];
  for (const a of row.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (exclude.some((x) => x === a || x.contains(a))) continue;
    const u = unwrapLink(a.getAttribute('href') ?? '');
    if (!u || parseThreadPath(u)) continue;
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

function rowDomId(row: Element, sel: MessengerSelectors): string | null {
  for (const attr of sel.messageIdAttrs) {
    if (!/^[\w-]{1,64}$/.test(attr)) continue;
    const el = row.hasAttribute(attr) ? row : row.querySelector(`[${attr}]`);
    const id = cleanDomId(el?.getAttribute(attr));
    if (id) return id;
  }
  return null;
}

/**
 * Time of a separator row, or null. Explicit `timeSeparator` match first; else
 * a row without media whose WHOLE text is a date/time label (a heading such as
 * <h4>Hôm nay 10:32</h4> included). Known ambiguity: a continuation row whose
 * only text is a bare time ("10:30") reads as a separator.
 */
function separatorTime(row: Element, sel: MessengerSelectors, now: number, hasMedia: boolean): number | null {
  const explicit = row.matches(sel.timeSeparator) ? row : row.querySelector(sel.timeSeparator);
  if (explicit) return parseTimeLabel(textOf(explicit), now);
  if (hasMedia) return null;
  return parseTimeLabel(textOf(row), now);
}

interface Sender {
  direction: 'in' | 'out';
  name: string | null;
  /** Key for derived ids: '0' owner, 'in' (1:1) or a name hash (groups). Never avatar-based. */
  idKey: string;
}

interface RawRow {
  row: Element;
  sender: Sender;
  runIndex: number;
  domId: string | null;
  text: string | null;
  images: string[];
  links: string[];
  files: FbFile[];
  anchor: number;
  posInBlock: number;
}

/**
 * Reads the rendered messages of the open conversation `ctx.threadId`.
 * Rows above the first rendered time separator are skipped (counted in
 * `unanchored`): their derived id would not be stable.
 */
export function readThreadMessages(
  doc: ParentNode,
  ctx: ReadContext,
  sel: MessengerSelectors = DEFAULT_MESSENGER_SELECTORS,
): ReadResult {
  const res: ReadResult = {
    threadId: ctx.threadId,
    messages: [],
    list: false,
    rows: 0,
    separators: 0,
    headings: 0,
    unanchored: 0,
    locked: false,
  };
  const list = doc.querySelector(sel.messageList);
  if (!list) {
    res.locked = isLockedE2ee(doc, sel);
    return res;
  }
  res.list = true;
  const rows = topLevelRows(list, sel);
  res.rows = rows.length;

  let anchor: number | null = null;
  let posInBlock = 0;
  let sender: Sender | null = null;
  let runIndex = 0;
  const raws: RawRow[] = [];
  /** Profile ids seen on avatars, per sender run (Messenger shows the avatar on the run's last row). */
  const runProfile = new Map<number, string>();
  const ignore = new Set(sel.ignoreRowTexts.map(lower));

  for (const row of rows) {
    const headings = [...row.querySelectorAll(sel.senderHeading)];
    const avatars = avatarLinks(row);
    const { files, anchors: fileAnchors } = rowFiles(row, sel);
    const exclude: Element[] = [...headings, ...avatars, ...fileAnchors];
    const textEls = outermost(row, sel.messageText, exclude);
    const text = textEls.map((e) => textOf(e)).filter(Boolean).join('\n') || null;
    const images = rowImages(row, sel, [...headings, ...avatars]);
    const links = rowLinks(row, [...avatars, ...fileAnchors]);
    const sep = separatorTime(row, sel, ctx.now, images.length > 0 || files.length > 0);
    if (sep != null) {
      anchor = sep;
      posInBlock = 0;
      res.separators++;
      continue;
    }

    if (headings.length) {
      res.headings++;
      const h = textOf(headings[0]);
      const out = isOutgoingLabel(h, sel);
      const name = out ? null : senderNameFrom(h);
      const next: Sender = {
        direction: out ? 'out' : 'in',
        name,
        idKey: out ? '0' : ctx.isGroup && name ? nameKey(name) : 'in',
      };
      if (!sender || sender.idKey !== next.idKey || sender.direction !== next.direction) runIndex++;
      sender = next;
    }

    if (!text && !images.length && !files.length && !links.length) continue; // seen / typing / empty
    if (!headings.length && text && ignore.has(lower(text)) && !images.length && !files.length) continue;
    if (!sender) continue; // no sender known yet (heading above the rendered range)

    if (sender.direction === 'in') {
      const pid = avatars.map((a) => profileIdFromHref(a.getAttribute('href'))).find(Boolean);
      if (pid) runProfile.set(runIndex, pid);
    }
    if (anchor == null) {
      res.unanchored++;
      if (!ctx.includeUnanchored) continue;
    }
    raws.push({
      row,
      sender,
      runIndex,
      domId: rowDomId(row, sel),
      text,
      images,
      links,
      files,
      anchor: anchor ?? 0,
      posInBlock: posInBlock++,
    });
  }

  const occurrences = new Map<string, number>();
  for (const r of raws) {
    const signature = [
      r.text ?? '',
      r.images.map(stableUrlKey).join(','),
      r.files.map((f) => f.name).join(','),
      r.text || r.images.length || r.files.length ? '' : r.links.join(','),
    ].join('\u0002');
    const occKey = `${r.anchor}\u0001${r.sender.idKey}\u0001${signature}`;
    const occurrence = occurrences.get(occKey) ?? 0;
    occurrences.set(occKey, occurrence + 1);

    const msgId =
      r.domId ??
      deriveMessageId({ threadId: ctx.threadId, anchor: r.anchor, senderKey: r.sender.idKey, signature, occurrence });

    let fromUid = '0';
    if (r.sender.direction === 'in') {
      fromUid =
        runProfile.get(r.runIndex) ??
        (!ctx.isGroup ? ctx.threadId : r.sender.name ? nameKey(r.sender.name) : `t_${ctx.threadId}`);
    }
    const kind: FbMessageKind = r.text ? 'text' : r.images.length ? 'image' : r.files.length ? 'file' : 'other';
    res.messages.push({
      msgId,
      idSource: r.domId ? 'dom' : 'derived',
      direction: r.sender.direction,
      fromUid,
      senderName: r.sender.direction === 'out' ? null : r.sender.name,
      text: r.text,
      images: r.images,
      links: r.links,
      files: r.files,
      kind,
      sentAt: r.anchor + r.posInBlock,
    });
  }
  return res;
}

// ---- Sidebar -------------------------------------------------------------------

export interface FbSidebarThread {
  threadId: string;
  e2ee: boolean;
  name: string | null;
  unread: boolean;
  /** Composite avatar (2+ images) ⇒ group. UNVERIFIED heuristic. */
  isGroup: boolean;
  avatar: string | null;
}

/** The conversation list container: the first `sidebar` match holding thread links. */
export function findSidebar(doc: ParentNode, sel: MessengerSelectors = DEFAULT_MESSENGER_SELECTORS): Element | null {
  for (const el of doc.querySelectorAll(sel.sidebar)) {
    if (el.querySelector(sel.sidebarThreadLink)) return el;
  }
  return null;
}

function unreadIn(link: Element, sel: MessengerSelectors): boolean {
  const labels = [link, ...link.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? '');
  // Visually hidden status text, but never the last-message preview ([dir=auto]).
  for (const n of link.querySelectorAll('span, div')) {
    if (n.closest('[dir="auto"]') || n.children.length) continue;
    labels.push(n.textContent ?? '');
  }
  const hay = labels.map(lower);
  return sel.unreadLabels.some((u) => hay.some((h) => h.includes(lower(u))));
}

/** Conversations listed in the sidebar (what is rendered; never scrolls or opens anything). */
export function readSidebar(doc: ParentNode, sel: MessengerSelectors = DEFAULT_MESSENGER_SELECTORS): FbSidebarThread[] {
  const box = findSidebar(doc, sel);
  if (!box) return [];
  const byId = new Map<string, FbSidebarThread>();
  for (const a of box.querySelectorAll<HTMLAnchorElement>(sel.sidebarThreadLink)) {
    const ref = parseThreadPath(a.getAttribute('href'));
    if (!ref || byId.has(ref.threadId)) continue;
    const nameEl = a.querySelector(sel.messageText);
    const name = (textOf(nameEl) || a.getAttribute('aria-label') || '').split('\n')[0].trim().slice(0, 500) || null;
    const imgs = [...a.querySelectorAll<HTMLImageElement>('img[src]')]
      .map((i) => i.getAttribute('src') ?? '')
      .filter(isHttps);
    byId.set(ref.threadId, {
      threadId: ref.threadId,
      e2ee: ref.e2ee,
      name,
      unread: unreadIn(a, sel),
      isGroup: new Set(imgs.map(stableUrlKey)).size >= 2,
      avatar: imgs[0] ?? null,
    });
  }
  return [...byId.values()];
}

// ---- Health check --------------------------------------------------------------

export interface MessengerHealth {
  /** Selector keys that look broken (drift `missing[]`). */
  broken: string[];
  /** Structural hints only (roles, attribute names, data-scope values) — never text. */
  observedKeys: string[];
  rows: number;
}

/**
 * Checks the selectors against the rendered page. Only meaningful once the
 * page has settled (the caller waits a grace period after load).
 */
export function checkMessengerHealth(
  doc: Document,
  loc: { pathname: string },
  sel: MessengerSelectors,
  opts: { ownerKnown: boolean; now: number },
): MessengerHealth {
  const broken: string[] = [];
  const active = readActiveThread(loc);
  let rows = 0;
  if (active) {
    const r = readThreadMessages(doc, { threadId: active.threadId, now: opts.now }, sel);
    rows = r.rows;
    if (!r.locked) {
      if (!r.list) broken.push('messageList');
      else if (!r.rows) broken.push('messageRow');
      else if (r.rows >= 3) {
        if (!r.separators) broken.push('timeSeparator');
        if (!r.headings) broken.push('senderHeading');
      }
      if (!doc.querySelector(sel.composer)) broken.push('composer');
    }
  }
  if (!findSidebar(doc, sel)) broken.push('sidebarThreadLink');
  if (!opts.ownerKnown) broken.push('ownProfileLink');
  return { broken, observedKeys: observedKeys(doc), rows };
}

/** Roles, data-* attribute names and data-scope/data-testid values seen in the main area. */
export function observedKeys(doc: Document): string[] {
  const keys = new Set<string>();
  const root = doc.querySelector('[role="main"]') ?? doc.body;
  if (!root) return [];
  let n = 0;
  for (const el of root.querySelectorAll('*')) {
    if (++n > 5000 || keys.size >= 150) break;
    const role = el.getAttribute('role');
    if (role && /^[a-z]{1,30}$/.test(role)) keys.add(`role=${role}`);
    for (const attr of el.getAttributeNames()) {
      if (attr.startsWith('data-') && /^[\w-]{1,60}$/.test(attr)) keys.add(attr);
      if (attr === 'aria-label') keys.add(`aria-label@${el.tagName.toLowerCase()}`);
    }
    for (const a of ['data-scope', 'data-testid']) {
      const v = el.getAttribute(a);
      if (v && /^[a-z_-]{1,60}$/i.test(v)) keys.add(`${a}=${v}`);
    }
    if (el.getAttribute('contenteditable') === 'true') keys.add(`contenteditable@${el.tagName.toLowerCase()}`);
  }
  return [...keys].sort().slice(0, 150);
}

// ---- API items -----------------------------------------------------------------

/** Items for `POST /api/ingest/messages` (valid under messageItemSchema). */
export function toMessageItems(r: ReadResult): Record<string, unknown>[] {
  return r.messages.map((m) => ({
    msgId: m.msgId,
    cliMsgId: m.msgId,
    threadId: r.threadId,
    fromUid: m.fromUid,
    senderName: m.senderName,
    msgType: `fb.${m.kind}`,
    text: m.text,
    content: {
      images: m.images,
      links: m.links,
      files: m.files,
      kind: m.kind,
    },
    sentAt: m.sentAt,
    contentStatus: 'complete',
  }));
}

/** Items for `POST /api/ingest/contacts`: the 1:1 partner and group senders with a numeric id. */
export function toContactItems(
  r: ReadResult,
  thread: FbSidebarThread | undefined,
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  if (thread && !thread.isGroup && thread.name && /^\d{5,25}$/.test(r.threadId)) {
    byId.set(r.threadId, { userId: r.threadId, displayName: thread.name, isFriend: undefined });
  }
  for (const m of r.messages) {
    if (m.direction !== 'in' || !m.senderName || !/^\d{5,25}$/.test(m.fromUid) || byId.has(m.fromUid)) continue;
    byId.set(m.fromUid, { userId: m.fromUid, displayName: m.senderName });
  }
  return [...byId.values()].map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)));
}

/** Items for `POST /api/ingest/conversations`. */
export function toConversationItems(threads: FbSidebarThread[]): Record<string, unknown>[] {
  return threads.map((t) => ({ threadId: t.threadId, type: t.isGroup ? 'group' : 'user', unread: t.unread ? 1 : 0 }));
}

/** Items for `POST /api/ingest/thread-names`. */
export function toThreadNameItems(threads: FbSidebarThread[]): Record<string, unknown>[] {
  return threads
    .filter((t) => t.name)
    .map((t) => ({
      threadId: t.threadId,
      name: t.name,
      isGroup: t.isGroup,
      unread: t.unread ? 1 : 0,
      ...(t.avatar ? { avatar: t.avatar } : {}),
    }));
}
