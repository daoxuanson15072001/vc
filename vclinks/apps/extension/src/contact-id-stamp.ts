/**
 * MAIN-world helper for the ContactReader (contact-reader.ts), bundled into
 * file-hook.js. Zalo Web's friend list rows ("Danh bạ" → "Danh sách bạn bè")
 * carry no user id in their attributes; the id is only on the React row
 * component (`itemId`, also its key). The content script runs in an isolated
 * world and cannot see React internals, so on request this copies the id onto
 * the row as `data-vclinks-uid` (attributes are shared across worlds).
 *
 * Read-only towards Zalo: it never calls Zalo code, never reads text, tokens or
 * storage; it only writes one attribute with a numeric id.
 */

export const STAMP_EVENT = 'vclinks:stamp-contacts';
export const STAMP_ATTR = 'data-vclinks-uid';
export const CONTACT_ROW_SELECTOR = '.contact-item-v2-wrapper';

/** Fiber levels walked up from a row to its list-item component. */
const MAX_FIBER_UP = 6;

interface FiberLike {
  key?: unknown;
  memoizedProps?: unknown;
  return?: FiberLike | null;
}

const fiberKeyOf = (row: Element) =>
  Object.keys(row).find((k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));

/** Zalo user id of a friend-list row from its React fiber, or null. */
export function rowUserId(row: Element): string | null {
  const fiberKey = fiberKeyOf(row);
  let f = fiberKey ? ((row as unknown as Record<string, FiberLike>)[fiberKey] ?? null) : null;
  for (let i = 0; i < MAX_FIBER_UP && f; i++) {
    const props = f.memoizedProps as { itemId?: unknown } | null | undefined;
    const id = props && typeof props === 'object' ? props.itemId : undefined;
    if ((typeof id === 'string' || typeof id === 'number') && /^\d{1,40}$/.test(String(id))) return String(id);
    f = f.return ?? null;
  }
  return null;
}

/** Stamps every rendered friend-list row; returns how many got an id. */
export function stampContactRows(root: ParentNode): number {
  let n = 0;
  for (const row of root.querySelectorAll(CONTACT_ROW_SELECTOR)) {
    const id = rowUserId(row);
    if (id) {
      row.setAttribute(STAMP_ATTR, id);
      n++;
    } else if (fiberKeyOf(row)) row.removeAttribute(STAMP_ATTR); // a React row without id: drop a stale stamp
  }
  return n;
}

/** Rows of Danh bạ → Lời mời kết bạn (received and sent), surveyed 04/10/2026. */
export const REQUEST_ROW_SELECTOR = '.card-wrapper.received--friend, .card-wrapper.sent--friend';
/** Fiber levels walked up from a request card to the component that holds its `data`. */
const MAX_REQUEST_FIBER_UP = 3;

/**
 * Zalo user id of a request card: the list item component carries
 * `data.userId` (sent) or `data.dataInfo.userId` (received); numbers only.
 */
export function requestRowUserId(row: Element): string | null {
  const fiberKey = fiberKeyOf(row);
  let f = fiberKey ? ((row as unknown as Record<string, FiberLike>)[fiberKey] ?? null) : null;
  for (let i = 0; i < MAX_REQUEST_FIBER_UP && f; i++) {
    const data = (f.memoizedProps as { data?: { userId?: unknown; dataInfo?: { userId?: unknown } } } | null | undefined)?.data;
    const id = data && typeof data === 'object' ? (data.userId ?? data.dataInfo?.userId) : undefined;
    if ((typeof id === 'string' || typeof id === 'number') && /^\d{1,40}$/.test(String(id))) return String(id);
    f = f.return ?? null;
  }
  return null;
}

/** Stamps every rendered request card; returns how many got an id. */
export function stampRequestRows(root: ParentNode): number {
  let n = 0;
  for (const row of root.querySelectorAll(REQUEST_ROW_SELECTOR)) {
    const id = requestRowUserId(row);
    if (id) {
      row.setAttribute(STAMP_ATTR, id);
      n++;
    } else if (fiberKeyOf(row)) row.removeAttribute(STAMP_ATTR);
  }
  return n;
}

/** Listens for the content script's request; dispatchEvent is synchronous, so rows are stamped on return. */
export function installContactIdStamp(win: Window): void {
  win.document.addEventListener(STAMP_EVENT, () => {
    try {
      stampContactRows(win.document);
      stampRequestRows(win.document);
    } catch {
      // Never break Zalo Web; the reader falls back to matching by name.
    }
  });
}
