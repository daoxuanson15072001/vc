import type { FriendRequestDirection, FriendRequestDomItem } from '@vclinks/shared';
import { clickLikeUser } from './compose';
import { CONTACT_SELECTORS } from './contact-reader';
import { REQUEST_ROW_SELECTOR, STAMP_ATTR, STAMP_EVENT } from './contact-id-stamp';

/**
 * FriendRequestReader: reads Zalo Web's Danh bạ → "Lời mời kết bạn" page
 * (03 MH-SZ-10, QT-SZ-12): the received and the sent requests, as plaintext
 * from the DOM (IndexedDB keeps names as ciphertext). It only opens the page,
 * expands "Xem thêm" and scrolls; it never presses Đồng ý, Từ chối or Thu hồi,
 * and never opens a conversation. Selectors from the survey of 04/10/2026
 * (docs/04-ky-thuat/zalo-web/zalo-dom-selectors.md).
 */
export const REQUEST_SELECTORS = {
  contactTab: CONTACT_SELECTORS.contactTab,
  messageTab: CONTACT_SELECTORS.messageTab,
  menuItem: CONTACT_SELECTORS.menuItem,
  /** Exact text of the menu entry (not "Lời mời vào nhóm và cộng đồng"). */
  requestMenuText: 'Lời mời kết bạn',
  /** Headers "Lời mời đã nhận (4)", "Lời mời đã gửi (71)", "Gợi ý kết bạn (65)". */
  listTitle: '.card-list-title',
  row: REQUEST_ROW_SELECTOR,
  receivedRow: '.card-wrapper.received--friend',
  sentRow: '.card-wrapper.sent--friend',
  name: '.card-name .name',
  /** "03/08 - Từ số điện thoại" on received rows, "Bạn đã gửi lời mời" on sent rows. */
  extra: '.card-name .extra',
  message: '.card-message__content',
  avatar: '.zavatar img',
  /** Buttons of a row (text identifies them; the CSS classes are shared by all buttons). */
  button: '.card-cta .z--btn--v2',
  viewMore: '.view-more__btn',
} as const;

export const REQUEST_BUTTON_TEXT = { accept: 'Đồng ý', reject: 'Từ chối', recall: 'Thu hồi lời mời' } as const;

const COUNT_RE: Record<FriendRequestDirection, RegExp> = {
  received: /^Lời mời đã nhận\s*\((\d{1,6})\)$/,
  sent: /^Lời mời đã gửi\s*\((\d{1,6})\)$/,
};

const text = (el: Element | null | undefined) =>
  ((el as HTMLElement | null)?.innerText ?? el?.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** Count of a list header, or null when that list is not shown. */
export function readRequestCount(root: ParentNode, direction: FriendRequestDirection): number | null {
  for (const el of root.querySelectorAll(REQUEST_SELECTORS.listTitle)) {
    const m = COUNT_RE[direction].exec(text(el));
    if (m) return Number(m[1]);
  }
  return null;
}

/** Request rows currently rendered, by direction. A row without a stamped id is skipped (the API needs one). */
export function extractRequestRows(root: ParentNode): Record<FriendRequestDirection, FriendRequestDomItem[]> {
  const out: Record<FriendRequestDirection, FriendRequestDomItem[]> = { received: [], sent: [] };
  for (const row of root.querySelectorAll(REQUEST_SELECTORS.row)) {
    const direction: FriendRequestDirection = row.matches(REQUEST_SELECTORS.sentRow) ? 'sent' : 'received';
    const name = text(row.querySelector(REQUEST_SELECTORS.name));
    const id = row.getAttribute(STAMP_ATTR);
    if (!name || !id || !/^\d{1,40}$/.test(id)) continue;
    const item: FriendRequestDomItem = { userId: id, name: name.slice(0, 200) };
    const [date, ...src] = text(row.querySelector(REQUEST_SELECTORS.extra)).split(' - ');
    if (direction === 'received' && src.length) {
      if (date) item.dateText = date.slice(0, 40);
      item.source = src.join(' - ').slice(0, 100);
    }
    const message = text(row.querySelector(REQUEST_SELECTORS.message));
    if (direction === 'received' && message) item.message = message.slice(0, 500);
    const avatar = row.querySelector(REQUEST_SELECTORS.avatar)?.getAttribute('src') ?? '';
    if (/^https:\/\/\S+$/i.test(avatar) && avatar.length <= 2000) item.avatar = avatar;
    out[direction].push(item);
  }
  return out;
}

/** Scroll container of the page (the nearest scrollable ancestor of a request card). */
export function findRequestScroller(root: ParentNode): Element | null {
  let el: Element | null = root.querySelector(REQUEST_SELECTORS.row)?.parentElement ?? null;
  while (el) {
    const oy = el.ownerDocument.defaultView?.getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) return el;
    el = el.parentElement;
  }
  return null;
}

export interface OpenRequestsDeps {
  doc: Document;
  sleep: (ms: number) => Promise<void>;
  /** Longest wait for the page to render after switching tabs (ms). */
  renderTimeoutMs?: number;
}

async function waitFor<T>(probe: () => T | null | undefined | false, sleep: (ms: number) => Promise<void>, timeoutMs: number) {
  for (let waited = 0; ; waited += 200) {
    const v = probe();
    if (v) return v;
    if (waited >= timeoutMs) return null;
    await sleep(200);
  }
}

const pageShown = (doc: Document) => readRequestCount(doc, 'received') != null || readRequestCount(doc, 'sent') != null;

export type OpenedRequests = { ok: true; restore: () => void } | { ok: false; error: string };

/**
 * Switches to Danh bạ → Lời mời kết bạn and waits for the page. `restore()`
 * gives the Tin nhắn tab back (a no-op when the page was already open).
 * The page never shows when both lists are empty: that is reported as an error
 * only when no header at all appears.
 */
export async function openFriendRequestsPage(deps: OpenRequestsDeps): Promise<OpenedRequests> {
  const { doc, sleep } = deps;
  const timeout = deps.renderTimeoutMs ?? 6000;
  const wasOpen = pageShown(doc);
  if (!wasOpen) {
    const tab = doc.querySelector<HTMLElement>(REQUEST_SELECTORS.contactTab);
    if (!tab) return { ok: false, error: 'Không thấy nút Danh bạ trên Zalo Web' };
    clickLikeUser(tab);
    const menu = await waitFor(
      () => [...doc.querySelectorAll<HTMLElement>(REQUEST_SELECTORS.menuItem)].find((m) => text(m) === REQUEST_SELECTORS.requestMenuText),
      sleep,
      timeout,
    );
    if (!menu) return { ok: false, error: 'Không mở được trang Danh bạ của Zalo Web' };
    if (!/\bselected\b/.test(menu.className)) clickLikeUser(menu);
  }
  const shown = await waitFor(() => pageShown(doc), sleep, timeout);
  const restore = () => {
    if (!wasOpen) doc.querySelector<HTMLElement>(REQUEST_SELECTORS.messageTab)?.click();
  };
  if (!shown) {
    restore();
    return { ok: false, error: 'Trang Lời mời kết bạn của Zalo Web không hiện' };
  }
  return { ok: true, restore };
}

export interface ReadRequestsDeps extends OpenRequestsDeps {
  shouldStop?: () => boolean;
  stepDelayMs?: number;
  /** Upper bound on "Xem thêm" presses and on scroll steps. */
  maxMore?: number;
  maxSteps?: number;
}

export type FriendRequestRead =
  | {
      ok: true;
      received: { items: FriendRequestDomItem[]; count: number | null; complete: boolean };
      sent: { items: FriendRequestDomItem[]; count: number | null; complete: boolean };
    }
  | { ok: false; error: string };

/**
 * Reads both lists: expands every "Xem thêm", walks the page one viewport at a
 * time (a virtual list renders only what is on screen) and puts the scroll
 * position back. A list is `complete` when the walk ended and it holds the
 * number its header announces.
 */
export async function readFriendRequests(deps: ReadRequestsDeps): Promise<FriendRequestRead> {
  const { doc, sleep } = deps;
  const opened = await openFriendRequestsPage(deps);
  if (!opened.ok) return opened;
  try {
    const stamp = () => doc.dispatchEvent(new CustomEvent(STAMP_EVENT));
    // "Xem thêm" is a plain expander of the list: pressing it changes nothing on Zalo.
    for (let i = 0; i < (deps.maxMore ?? 15); i++) {
      if (deps.shouldStop?.()) break;
      const more = [...doc.querySelectorAll<HTMLElement>(REQUEST_SELECTORS.viewMore)].find((b) => b.getClientRects().length > 0);
      if (!more) break;
      clickLikeUser(more);
      await sleep(deps.stepDelayMs ?? 400);
    }
    const byId = { received: new Map<string, FriendRequestDomItem>(), sent: new Map<string, FriendRequestDomItem>() };
    // A header scrolls out of the rendered window (virtual list): keep the last count seen while walking.
    const counts: Record<FriendRequestDirection, number | null> = { received: null, sent: null };
    const absorb = () => {
      stamp();
      for (const d of ['received', 'sent'] as const) counts[d] = readRequestCount(doc, d) ?? counts[d];
      const rows = extractRequestRows(doc);
      for (const d of ['received', 'sent'] as const) for (const r of rows[d]) byId[d].set(r.userId, r);
    };
    absorb();
    const scroller = findRequestScroller(doc);
    let walked = !scroller;
    if (scroller) {
      const start = scroller.scrollTop;
      let pos = 0;
      let atEnd = 0;
      for (let i = 0; i < (deps.maxSteps ?? 300); i++) {
        if (deps.shouldStop?.()) break;
        scroller.scrollTop = pos;
        await sleep(deps.stepDelayMs ?? 300);
        absorb();
        const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        if (pos >= max) {
          if (++atEnd > 2) {
            walked = true;
            break;
          }
          continue;
        }
        atEnd = 0;
        pos = Math.min(pos + Math.max(Math.floor(scroller.clientHeight * 0.8), 40), max);
      }
      scroller.scrollTop = start;
    }
    const list = (d: FriendRequestDirection) => {
      const count = readRequestCount(doc, d) ?? counts[d];
      const items = [...byId[d].values()];
      return { items, count, complete: walked && (count === null ? items.length === 0 : items.length >= count) };
    };
    return { ok: true, received: list('received'), sent: list('sent') };
  } finally {
    opened.restore();
  }
}
