import type { ContactDomItem } from '@vclinks/shared';
import { CONTACT_ROW_SELECTOR, STAMP_ATTR, STAMP_EVENT } from './contact-id-stamp';

/**
 * ContactReader: reads the Zalo Web friend list ("Danh bạ" → "Danh sách bạn
 * bè") from the DOM (03 MH-SZ-09, BA §11.6 L3 F1–F3). IndexedDB keeps friend
 * names and phone numbers as ciphertext; the list shows the plaintext name
 * (the alias / tên gợi nhớ when one is set). It never opens a profile or a
 * conversation: switching to the Danh bạ tab and scrolling its list marks
 * nothing read. Selectors from the survey of 04/10/2026
 * (docs/04-ky-thuat/zalo-web/zalo-dom-selectors.md).
 */
export const CONTACT_SELECTORS = {
  /** Left rail "Danh bạ" tab (no data-id). */
  contactTab: '[data-translate-title="STR_TAB_CONTACT"], [title="Danh bạ"]',
  /** Left rail "Tin nhắn" tab, to give the user back the chat view. */
  messageTab: '[data-id="div_Main_TabMsg"]',
  /** Menu entries of the Danh bạ page; the friend list one is found by its text. */
  menuItem: '.menu-item',
  friendMenuText: 'Danh sách bạn bè',
  /** Header "Bạn bè (621)". */
  listTitle: '.card-list-title',
  row: CONTACT_ROW_SELECTOR,
  name: '.name-wrapper .name',
  business: '.z-business-label',
  label: '.label .description',
  avatar: '.zavatar img',
} as const;

const FRIEND_COUNT = /^Bạn bè\s*\((\d{1,6})\)$/;

const text = (el: Element | null | undefined) =>
  ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** "Bạn bè (N)" from the list header, or null when the friend list is not shown. */
export function readFriendCount(root: ParentNode): number | null {
  for (const el of root.querySelectorAll(CONTACT_SELECTORS.listTitle)) {
    const m = FRIEND_COUNT.exec(text(el));
    if (m) return Number(m[1]);
  }
  return null;
}

/** Rows currently rendered (virtual list: only what is on screen). */
export function extractContactRows(root: ParentNode): ContactDomItem[] {
  const out: ContactDomItem[] = [];
  for (const row of root.querySelectorAll(CONTACT_SELECTORS.row)) {
    const name = text(row.querySelector(CONTACT_SELECTORS.name));
    if (!name) continue;
    const item: ContactDomItem = { name: name.slice(0, 200) };
    const id = row.getAttribute(STAMP_ATTR);
    if (id && /^\d{1,40}$/.test(id)) item.userId = id;
    const src = row.querySelector(CONTACT_SELECTORS.avatar)?.getAttribute('src') ?? '';
    if (/^https:\/\/\S+$/i.test(src) && src.length <= 2000) item.avatar = src;
    const labels = [...row.querySelectorAll(CONTACT_SELECTORS.label)].map(text).filter((l) => l && l.length <= 100);
    if (labels.length) item.labels = [...new Set(labels)].slice(0, 20);
    if (row.querySelector(CONTACT_SELECTORS.business)) item.business = true;
    out.push(item);
  }
  return out;
}

/** Scroll container of the friend list (the nearest scrollable ancestor of a row). */
export function findContactScroller(root: ParentNode): Element | null {
  let el: Element | null = root.querySelector(CONTACT_SELECTORS.row)?.parentElement ?? null;
  while (el) {
    const oy = el.ownerDocument.defaultView?.getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) return el;
    el = el.parentElement;
  }
  return null;
}

export interface CollectContactsOptions {
  /** Scroller to walk; found from the first row when omitted. */
  scroller?: Element | null;
  sleep?: (ms: number) => Promise<void>;
  /** Pause after each scroll step for the virtual list to render (ms). */
  stepDelayMs?: number;
  /** Upper bound on scroll steps (Zalo caps friends at a few thousand). */
  maxSteps?: number;
  /** Asks the MAIN-world helper to put the user id on the rendered rows. */
  stamp?: () => void;
  /** Checked between steps: true (someone uses the tab) ends the walk early. */
  shouldStop?: () => boolean;
}

export interface CollectedContacts {
  items: ContactDomItem[];
  /** True when the walk reached the end of the list. */
  complete: boolean;
}

/** Same row seen twice (virtual list re-render) counts once: by id, else by name. */
const rowKey = (r: ContactDomItem) => (r.userId ? `id:${r.userId}` : `name:${r.name}`);

/**
 * Walks the friend list one viewport at a time (jumping to the bottom would
 * skip rows: a virtual list renders only what is on screen), like
 * collectSidebarNames, and puts the scroll position back at the end.
 */
export async function collectContactRows(root: ParentNode, opts: CollectContactsOptions = {}): Promise<CollectedContacts> {
  const byKey = new Map<string, ContactDomItem>();
  const absorb = () => {
    opts.stamp?.();
    for (const r of extractContactRows(root)) {
      // A row first read without id (not stamped yet) is replaced once its id is known.
      if (r.userId) byKey.delete(`name:${r.name}`);
      else if ([...byKey.values()].some((x) => x.userId && x.name === r.name)) continue;
      byKey.set(rowKey(r), r);
    }
  };
  absorb();
  const scroller = opts.scroller === undefined ? findContactScroller(root) : opts.scroller;
  if (!scroller) return { items: [...byKey.values()], complete: byKey.size > 0 };
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const delay = opts.stepDelayMs ?? 300;
  const maxSteps = opts.maxSteps ?? 600;
  const start = scroller.scrollTop;
  let pos = 0;
  let atEnd = 0;
  let complete = false;
  for (let i = 0; i < maxSteps; i++) {
    if (opts.shouldStop?.()) break;
    scroller.scrollTop = pos;
    await sleep(delay);
    absorb();
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (pos >= max) {
      // Bottom reached: give lazy rendering two rounds before calling it complete.
      if (++atEnd > 2) {
        complete = true;
        break;
      }
      continue;
    }
    atEnd = 0;
    pos = Math.min(pos + Math.max(Math.floor(scroller.clientHeight * 0.8), 40), max);
  }
  scroller.scrollTop = start;
  return { items: [...byKey.values()], complete };
}

export interface ReadFriendListDeps {
  doc: Document;
  sleep: (ms: number) => Promise<void>;
  shouldStop?: () => boolean;
  stepDelayMs?: number;
  /** Longest wait for the friend list to render after switching tabs (ms). */
  renderTimeoutMs?: number;
}

export type FriendListRead =
  | { ok: true; items: ContactDomItem[]; friendCount: number | null; complete: boolean }
  | { ok: false; error: string };

async function waitFor<T>(probe: () => T | null | undefined, sleep: (ms: number) => Promise<void>, timeoutMs: number) {
  for (let waited = 0; ; waited += 200) {
    const v = probe();
    if (v) return v;
    if (waited >= timeoutMs) return null;
    await sleep(200);
  }
}

/**
 * Opens Danh bạ → Danh sách bạn bè, walks it, then switches back to the
 * Tin nhắn tab (unless the friend list was already on screen). Error texts are
 * Vietnamese: they reach the popup / logs as is.
 */
export async function readFriendList(deps: ReadFriendListDeps): Promise<FriendListRead> {
  const { doc, sleep } = deps;
  const timeout = deps.renderTimeoutMs ?? 6000;
  const stamp = () => doc.dispatchEvent(new CustomEvent(STAMP_EVENT));
  const wasOpen = !!doc.querySelector(CONTACT_SELECTORS.row) && readFriendCount(doc) != null;
  try {
    if (!wasOpen) {
      const tab = doc.querySelector<HTMLElement>(CONTACT_SELECTORS.contactTab);
      if (!tab) return { ok: false, error: 'Không thấy nút Danh bạ trên Zalo Web' };
      tab.click();
      const menu = await waitFor(
        () =>
          [...doc.querySelectorAll<HTMLElement>(CONTACT_SELECTORS.menuItem)].find(
            (m) => text(m) === CONTACT_SELECTORS.friendMenuText,
          ),
        sleep,
        timeout,
      );
      if (!menu) return { ok: false, error: 'Không mở được trang Danh bạ của Zalo Web' };
      if (!/\bselected\b/.test(menu.className)) menu.click();
    }
    const shown = await waitFor(() => readFriendCount(doc) != null && doc.querySelector(CONTACT_SELECTORS.row), sleep, timeout);
    if (!shown) {
      // "Bạn bè (0)" renders no row: an empty friend list is a valid result.
      if (readFriendCount(doc) === 0) return { ok: true, items: [], friendCount: 0, complete: true };
      return { ok: false, error: 'Danh sách bạn bè của Zalo Web không hiện' };
    }
    const friendCount = readFriendCount(doc);
    const { items, complete } = await collectContactRows(doc, {
      sleep,
      stamp,
      shouldStop: deps.shouldStop,
      stepDelayMs: deps.stepDelayMs,
    });
    return { ok: true, items, friendCount, complete };
  } finally {
    if (!wasOpen) doc.querySelector<HTMLElement>(CONTACT_SELECTORS.messageTab)?.click();
  }
}
