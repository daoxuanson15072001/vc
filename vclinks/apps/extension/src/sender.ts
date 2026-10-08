import { DEFAULT_DOM_SELECTORS, isFriendAction, isSendPaceRefusal, type DomSelectors, type OutboxItem, type OutboxResult } from '@vclinks/shared';
import {
  clearInput,
  clickLikeUser,
  editorText,
  insertText,
  normalizeText,
  pressEnterOnce,
  realSleep,
  splitLines,
  waitFor,
} from './compose';
import { readActiveThread } from './backfill';
import { extractMessages, findMessageScroller, findSidebarScroller, hasUnreadMark, readActiveThreadId, threadItemName } from './dom-reader';

export { normalizeText, splitLines } from './compose';

/**
 * Sender: types and sends messages the user approved on the Dashboard into the
 * Zalo Web tab. Off by default (popup toggle "Cho phép gửi tin từ Dashboard").
 *
 * Rules (docs/04-ky-thuat/zalo-web/zalo-web-extraction.md §7), learned from real failures:
 * - No synthetic keys while composing (Shift+Enter corrupts text and a stray
 *   Enter sends a half-typed draft). Text goes in with execCommand('insertText').
 * - `insertLineBreak` and synthetic paste are ignored by Zalo, so a multi-line
 *   message is sent as one message per non-empty line, in order.
 * - Before sending, `#richInput.innerText` must equal the approved line exactly
 *   (after nbsp / zero-width / edge-whitespace normalisation). On mismatch the
 *   input is cleared and Enter is never pressed.
 * - Enter is pressed exactly once per line, only after that check.
 *
 * Every step verifies before acting; any doubt ends in a `failed` result with a
 * short Vietnamese reason (never the message text). Pure DOM + injected deps so
 * it is unit-tested with happy-dom.
 */

export interface SenderApi {
  /** `waitSec` > 0 asks the API to hold the request until something is approved (long-poll). */
  pending(uid: string, waitSec?: number): Promise<OutboxItem[]>;
  claim(id: string): Promise<OutboxItem>;
  result(id: string, r: OutboxResult): Promise<unknown>;
}

export interface SenderTiming {
  /** Sidebar scroll attempts when the conversation is not rendered (virtual list). */
  maxScrollSteps: number;
  /** Wait for the clicked conversation to become the active one. */
  openTimeoutMs: number;
  /** Input still holding the text after this long ⇒ Zalo did not send. */
  inputClearTimeoutMs: number;
  /** Wait for the outgoing bubble. */
  confirmTimeoutMs: number;
  /**
   * Minimum gap between two Enter presses (lines or items). A human sending two
   * messages back to back takes about this long; lowered from 3 s on 2026-09-28
   * (owner decision) to cut send latency.
   */
  minGapMs: number;
  pollStepMs: number;
  /**
   * Reply to a message no longer rendered (03 §8 D33, SZ "replyTarget"): scroll
   * the chat up at most this many times, one history load per `replyScrollMs`.
   */
  replyScrollMax: number;
  replyScrollMs: number;
}

export const DEFAULT_TIMING: SenderTiming = {
  // The sidebar loop stops early at the bottom of the list; this is only a cap.
  maxScrollSteps: 200,
  openTimeoutMs: 5000,
  inputClearTimeoutMs: 3000,
  confirmTimeoutMs: 10_000,
  minGapMs: 1500,
  pollStepMs: 150,
  replyScrollMax: 10,
  replyScrollMs: 1000,
};

export interface SendDeps {
  doc: Document;
  dom?: DomSelectors;
  timing?: Partial<SenderTiming>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Sidebar scroller override (tests: happy-dom has no layout). */
  findScroller?: (doc: Document, dom: DomSelectors) => Element | null;
  /** Message list scroller override (tests), used to scroll up to a reply target. */
  findMessageScroller?: (doc: Document, dom: DomSelectors) => Element | null;
  /** Also accept the chat header showing the clicked item's name (read-only callers only). */
  confirmByHeader?: boolean;
  /**
   * Display name of the conversation (from the Dashboard). When the item is not
   * in the rendered sidebar, it is looked up through Zalo's search box.
   */
  name?: string;
  /** Friend command allowlist (SenderConfig.onlyFriendTargets). */
  friendTargets?: string[];
  /**
   * cliMsgIds known to belong to this conversation. A rendered bubble carrying
   * one of them proves the right conversation is open (ids are per message, so
   * unlike names they cannot collide).
   */
  confirmCliMsgIds?: string[];
  /**
   * Brings this tab (and its window) to the front. Chrome rejects
   * execCommand('insertText') in a document without focus, which is the normal
   * case: the user approves on the Dashboard in another tab/window.
   */
  focusTab?: () => Promise<void>;
  /** Send the (first line of the) message as a Zalo "Trả lời" to this cliMsgId. */
  replyToCliMsgId?: string;
  /**
   * Refuse to open a conversation with unread messages (opening it would tell
   * the sender they were seen). The item must then be in the rendered sidebar:
   * Zalo's search results do not show unread marks, so search is not used.
   */
  refuseUnread?: boolean;
  /**
   * With `refuseUnread`: open unread conversations anyway (an explicit confirmed Dashboard request, or a nick of the
   * máy Zalo whose owner accepted "Đã xem"). Zalo search is allowed again then: it was only avoided because its
   * results hide unread marks, and the conversation is still confirmed by its bubbles / header after opening.
   */
  allowUnread?: boolean;
}

export type SendOutcome =
  | { ok: true; cliMsgId: string | null; sentAt: Date; lines: number; replyCliMsgId?: string | null; cliMsgIds?: string[] }
  | { ok: false; error: string; sentLines: number };

export const ERR = {
  badThreadId: 'threadId không hợp lệ',
  notFound: 'không tìm thấy hội thoại',
  tabHidden: 'tab Zalo đang ẩn nên Zalo Web không tải danh sách hội thoại; hãy chuyển sang tab chat.zalo.me',
  notActive: 'không xác nhận được hội thoại đang mở',
  unread: 'hội thoại có tin chưa đọc trên Zalo; không tự mở để Zalo không báo "đã xem" cho người gửi',
  noInput: 'không thấy ô soạn tin (#richInput)',
  noFocus: 'tab Zalo không có focus nên không gõ được; hãy để tab chat.zalo.me ở phía trước',
  inputBusy: 'ô soạn tin đang có nội dung chưa gửi, không ghi đè',
  mismatch: 'nội dung trong ô soạn tin không khớp bản đã duyệt, đã xóa và không gửi',
  notSent: 'Zalo chưa gửi (ô soạn tin vẫn còn nội dung), đã xóa',
  unconfirmed: 'không thấy tin vừa gửi trong khung chat — kiểm tra trên Zalo trước khi gửi lại',
  empty: 'nội dung rỗng',
  replyTarget: 'không thấy tin cần trả lời trong khung chat Zalo dù đã tự cuộn lên tìm (tin đã trôi quá xa); bấm "Gửi không trích dẫn" để gửi nội dung này không kèm trích dẫn',
  replyButton: 'không thấy nút "Trả lời" của Zalo khi rê chuột lên tin cần trả lời',
  replyBanner: 'Zalo không mở khung trích dẫn sau khi bấm "Trả lời", đã hủy và không gửi',
  replyBusy: 'ô soạn tin đang trả lời một tin khác, không ghi đè',
} as const;

/**
 * Zalo Web's reply UI (surveyed on real Zalo Web 28/09/2026): hovering a bubble
 * renders its `.floating-menu-wrapper` with the "Trả lời" button; clicking it
 * shows `.quote-banner` above the compose box (closed by `.quote-close`) and, in
 * groups, pre-fills `#richInput` with an @mention of the quoted sender.
 */
export const REPLY_SELECTORS = {
  button: '.floating-menu-wrapper [data-translate-title="STR_REPLY_MSG"]',
  banner: '#chatInput .quote-banner',
  close: '.quote-close',
  hoverTarget: '.message-content-wrapper',
} as const;

const INPUT_SELECTOR = '#richInput';
const THREAD_ITEM_DATA_ID = 'div_TabMsg_ThrdChItem';
const SEARCH_SELECTOR = '[data-id="txt_Main_Search"]';
/** Zalo's conversation row inside a sidebar item / search result (the element its click handler is on). */
const CONV_ROW = '.conv-item';
/** Name node of a conversation in the "Liên hệ" section of search results. */
const RESULT_NAME = '.conv-item-title__name, [class*="title__name"]';

/**
 * The element Zalo actually listens on. A sidebar item (`threadIdAttr`) is a
 * virtual-list wrapper (`msg-item`); its click handler sits on the `.conv-item`
 * row inside, so dispatching on the wrapper opens nothing (verified 28/09/2026).
 */
export function clickTarget(item: HTMLElement): HTMLElement {
  return item.querySelector<HTMLElement>(CONV_ROW) ?? (item.firstElementChild as HTMLElement | null) ?? item;
}

/** Sidebar `threadIdAttr` values that may denote this thread (groups carry a prefix, e.g. `g`). */
export function threadCandidates(threadId: string, dom: DomSelectors): string[] {
  const p = dom.groupIdPrefix;
  if (!p || threadId.startsWith(p)) return [threadId];
  return [threadId, `${p}${threadId}`];
}

function findThreadItem(doc: Document, candidates: string[], dom: DomSelectors): { el: HTMLElement; id: string } | null {
  for (const id of candidates) {
    const all = [...doc.querySelectorAll<HTMLElement>(`[${dom.threadIdAttr}="${id}"]`)];
    const el = all.find((e) => e.getAttribute('data-id') === THREAD_ITEM_DATA_ID) ?? all[0];
    if (el) return { el, id };
  }
  return null;
}

/** The editable element of Zalo's main search box (`txt_Main_Search`), if rendered. */
export function findSearchBox(doc: Document): HTMLInputElement | HTMLElement | null {
  const el = doc.querySelector<HTMLElement>(SEARCH_SELECTOR);
  if (!el) return null;
  if (el instanceof HTMLInputElement || el.isContentEditable) return el;
  return el.querySelector<HTMLElement>('input, [contenteditable="true"]');
}

/** Sets the search text the way a user would (React listens to `input`). */
function setSearchText(box: HTMLInputElement | HTMLElement, text: string) {
  box.focus();
  if (box instanceof HTMLInputElement) {
    const proto = Object.getPrototypeOf(box) as object;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(box, text);
    else box.value = text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    if (text) insertText(box, text);
    else clearInput(box);
  }
}

/** Leaves the search box empty so the sidebar shows the normal list again. */
function clearSearch(box: HTMLInputElement | HTMLElement) {
  setSearchText(box, '');
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  box.blur();
}

/**
 * Search result row of a thread: Zalo gives each result `.conv-item` an id
 * `<kind>-item-<threadId>` (e.g. `group-item-g6910418193163461340`, live check
 * 04/10/2026), so a result is matched by id first and by name only as a fallback.
 */
function resultById(doc: Document, candidates: string[], dom: DomSelectors): HTMLElement | null {
  for (const id of candidates) {
    for (const el of doc.querySelectorAll<HTMLElement>(`${CONV_ROW}[id$="-item-${id}"]`)) {
      if (!el.closest(`[${dom.threadIdAttr}]`)) return el;
    }
  }
  return null;
}

/** Search result rows (outside the sidebar), for the not-found diagnostics. */
function resultRows(doc: Document, dom: DomSelectors): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(CONV_ROW)].filter((el) => !el.closest(`[${dom.threadIdAttr}]`));
}

type SearchOutcome = { ok: true } | { ok: false; why: string };

/**
 * Types `name` into Zalo's search box and clicks the matching result: an item
 * carrying `threadIdAttr` when Zalo renders one, else the result row whose id
 * names the thread, else the row whose name matches (exact before prefix). The
 * caller still confirms the opened conversation by bubbles / header / sidebar.
 * Zalo may wipe text typed right after the box mounts, so the query is typed
 * once more halfway through the wait. The box is cleared afterwards.
 */
async function openViaSearch(candidates: string[], name: string | undefined, deps: SendDeps): Promise<SearchOutcome> {
  const dom = deps.dom ?? DEFAULT_DOM_SELECTORS;
  const t = { ...DEFAULT_TIMING, ...deps.timing };
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const query = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!query) return { ok: false, why: 'chưa có tên hội thoại để tìm' };
  const box = findSearchBox(deps.doc);
  if (!box) return { ok: false, why: 'không thấy ô tìm kiếm của Zalo' };
  setSearchText(box, query);
  const find = (): HTMLElement | null => {
    const byId = findThreadItem(deps.doc, candidates, dom);
    if (byId) return clickTarget(byId.el);
    const row = resultById(deps.doc, candidates, dom);
    if (row) return row;
    let prefix: HTMLElement | null = null;
    for (const el of deps.doc.querySelectorAll<HTMLElement>(RESULT_NAME)) {
      if (el.closest(`[${dom.threadIdAttr}]`)) continue; // sidebar, not a result
      if (foldName(el.textContent) === foldName(query)) return el.closest<HTMLElement>(CONV_ROW) ?? el;
      if (!prefix && sameName(el.textContent, query)) prefix = el.closest<HTMLElement>(CONV_ROW) ?? el;
    }
    return prefix;
  };
  const half = Math.max(t.pollStepMs, Math.floor(t.openTimeoutMs / 2));
  let target = await waitFor(find, half, t.pollStepMs, sleep, now);
  if (!target) {
    // Typed text wiped, or Zalo missed the event: type it again once.
    setSearchText(box, '');
    setSearchText(box, query);
    target = await waitFor(find, t.openTimeoutMs - half, t.pollStepMs, sleep, now);
  }
  if (!target) {
    const typed = 'value' in box ? (box as HTMLInputElement).value : box.textContent ?? '';
    const rows = resultRows(deps.doc, dom).length;
    clearSearch(box);
    const why =
      foldName(typed) !== foldName(query)
        ? 'ô tìm kiếm của Zalo không giữ chữ đã gõ'
        : rows
          ? `tìm kiếm có ${rows} kết quả nhưng không khớp hội thoại`
          : 'tìm kiếm không có kết quả (tên hội thoại có thể đã đổi trên Zalo)';
    return { ok: false, why };
  }
  target.scrollIntoView?.({ block: 'nearest' });
  clickLikeUser(target);
  await sleep(t.pollStepMs);
  clearSearch(box);
  return { ok: true };
}

/** True when a rendered bubble carries one of the conversation's known cliMsgIds. */
function bubbleConfirms(doc: Document, dom: DomSelectors, ids: ReadonlySet<string>): boolean {
  if (!ids.size) return false;
  return extractMessages(doc, dom).some((m) => ids.has(m.cliMsgId));
}

/**
 * Opens the conversation `threadId` in the sidebar and verifies it is the
 * active one. Returns the sidebar id actually opened, or an error.
 */
export async function openConversation(threadId: string, deps: SendDeps): Promise<{ ok: true } | { ok: false; error: string }> {
  const dom = deps.dom ?? DEFAULT_DOM_SELECTORS;
  const t = { ...DEFAULT_TIMING, ...deps.timing };
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const { doc } = deps;
  if (!/^[\w-]{1,128}$/.test(threadId)) return { ok: false, error: ERR.badThreadId };
  const candidates = threadCandidates(threadId, dom);

  const known = new Set(deps.confirmCliMsgIds ?? []);
  const active = readActiveThreadId(doc, dom);
  if (active && candidates.includes(active)) return { ok: true };
  // Already open (e.g. the user opened it), just not recognisable from the sidebar.
  if (!active && bubbleConfirms(doc, dom, known)) return { ok: true };

  const located = await locateThreadItem(threadId, deps);
  if (!located.ok) return located;
  const found = located.item;
  const target = found?.id ?? candidates[0];
  // Sidebar item name (or the Dashboard's name on the search path) for the header check.
  const name = normalizeName(found ? threadItemName(found.el, dom) : deps.name);
  const header = () => normalizeName(readActiveThread(doc, dom).header);
  // A known cliMsgId on screen is the strongest signal and is accepted for every
  // caller; the header is a heuristic accepted only when asked for.
  const isOpen = () =>
    candidates.includes(readActiveThreadId(doc, dom) ?? '') ||
    bubbleConfirms(doc, dom, known) ||
    (!!deps.confirmByHeader && !!name && sameName(header(), name));

  if (deps.refuseUnread) {
    if (!found && !deps.allowUnread) return { ok: false, error: `${ERR.notFound} (${sidebarDiagnostics(doc, dom, deps)})` };
    if (found && !deps.allowUnread && hasUnreadMark(found.el)) return { ok: false, error: ERR.unread };
  }
  if (found) {
    found.el.scrollIntoView?.({ block: 'nearest' });
    clickLikeUser(clickTarget(found.el));
  } else {
    const searched = await openViaSearch(candidates, deps.name, deps);
    if (!searched.ok) return { ok: false, error: `${ERR.notFound} (${sidebarDiagnostics(doc, dom, deps)}; ${searched.why})` };
  }
  const opened = await waitFor(isOpen, t.openTimeoutMs, t.pollStepMs, sleep, now);
  const sel = readActiveThreadId(doc, dom);
  if (opened) return { ok: true };
  const h = header();
  // Lengths only (never names) so a mismatch can be diagnosed from the error text.
  const lens = `tên ở danh sách ${foldName(name).length} ký tự, tiêu đề ${foldName(h).length} ký tự`;
  const detail = `mục đang chọn: ${sel ? (sel === target ? 'đúng' : 'khác') : 'không nhận ra'}, tiêu đề khung chat: ${
    h ? (sameName(h, name) ? 'khớp' : `không khớp (${lens})`) : 'không đọc được'
  }`;
  return { ok: false, error: `${ERR.notActive} (${detail})` };
}

/**
 * Finds the sidebar item of `threadId`, scrolling the virtual list when it is not
 * rendered. `item` is null when the list has no such item (the caller may still
 * try Zalo's search). Shared by openConversation and the conversation commands
 * (pin, mark read/unread) that act on the item's own menu.
 */
export async function locateThreadItem(
  threadId: string,
  deps: SendDeps,
): Promise<{ ok: true; item: { el: HTMLElement; id: string } | null } | { ok: false; error: string }> {
  const dom = deps.dom ?? DEFAULT_DOM_SELECTORS;
  const t = { ...DEFAULT_TIMING, ...deps.timing };
  const sleep = deps.sleep ?? realSleep;
  const { doc } = deps;
  const candidates = threadCandidates(threadId, dom);
  let found: { el: HTMLElement; id: string } | null = findThreadItem(doc, candidates, dom);
  if (!found) {
    // A background tab is throttled: the virtual list barely renders while we
    // scroll, so "not found" would be wrong. Ask for the tab instead.
    if (doc.visibilityState === 'hidden') return { ok: false, error: ERR.tabHidden };
    const scroller = (deps.findScroller ?? findSidebarScroller)(doc, dom);
    if (scroller) {
      scroller.scrollTop = 0;
      for (let i = 0; i < t.maxScrollSteps && !found; i++) {
        await sleep(350);
        found = findThreadItem(doc, candidates, dom);
        if (found) break;
        const before = scroller.scrollTop;
        scroller.scrollTop = before + Math.max(200, Math.floor(scroller.clientHeight * 0.8));
        if (scroller.scrollTop === before && i > 0) {
          // Bottom reached: one last look after the list re-renders.
          await sleep(350);
          found = findThreadItem(doc, candidates, dom);
          break;
        }
      }
    }
  }
  return { ok: true, item: found };
}

const normalizeName = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase() || null;

/** Letters and digits only (NFC, lowercase): drops emoji, punctuation, ellipsis and spacing. */
export const foldName = (s: string | null | undefined) =>
  (s ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Loose name equality between the sidebar item and the chat header. The sidebar
 * reader strips trailing time/badge tokens (a name ending in "12/9" loses it)
 * and the two places render emoji differently, so equal after folding or one a
 * prefix of the other (shorter side ≥ 4 chars) counts as the same name.
 */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = foldName(a);
  const y = foldName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && long.startsWith(short);
}

/** Structure-only summary of the sidebar when a conversation is not found (no names). */
function sidebarDiagnostics(doc: Document, dom: DomSelectors, deps: SendDeps): string {
  const items = doc.querySelectorAll(`[${dom.threadIdAttr}]`);
  const groups = [...items].filter((e) => e.getAttribute(dom.threadIdAttr)?.startsWith(dom.groupIdPrefix || '\u0000')).length;
  const scroller = (deps.findScroller ?? findSidebarScroller)(doc, dom);
  const hidden = doc.visibilityState === 'hidden';
  return `danh sách trái có ${items.length} mục (${groups} nhóm), ${scroller ? 'cuộn được' : 'không cuộn được'}${hidden ? ', tab Zalo đang ẩn' : ''}`;
}

/** Zalo's send button next to the composer (paper plane). */
export const SEND_BUTTON_SELECTOR = '[icon="Sent-msg_24_Line"]';

/**
 * Zalo's "Định dạng tin nhắn" (rich text) mode replaces `#richInput` with a
 * different editor (`.input-v4`, random id) and marks the composer container
 * `--rtf-mode` (live check 29/09/2026). The mode is sticky per tab, so a
 * user who opened it once would block every send. Leaving it is one click
 * on the same toolbar button, and it does not touch a draft.
 */
export const RTF_SELECTORS = {
  container: '.chat-box-input-container.--rtf-mode',
  toggle: '[data-id="div_RTF_Menu"]',
} as const;

/**
 * The plain composer (`#richInput`), leaving Zalo's rich-text mode first when
 * that is what hides it. Null when neither is there within the timeout.
 */
export async function findComposer(
  doc: Document,
  wait: { step: number; sleep: (ms: number) => Promise<void>; now: () => number },
  timeoutMs = 3000,
): Promise<HTMLElement | null> {
  const find = () => doc.querySelector<HTMLElement>(INPUT_SELECTOR);
  const input = find();
  if (input) return input;
  const toggle = doc.querySelector(RTF_SELECTORS.container) ? doc.querySelector<HTMLElement>(RTF_SELECTORS.toggle) : null;
  if (toggle) clickLikeUser(toggle);
  return waitFor(find, timeoutMs, wait.step, wait.sleep, wait.now);
}

/**
 * Sends what is in the composer. Clicks Zalo's send button: a synthetic Enter
 * from the content script's isolated world is ignored by Zalo Web (live check
 * 28/09/2026: the text stays in the composer). Enter is only the fallback when
 * the button is not rendered.
 */
export async function submitComposer(
  doc: Document,
  input: HTMLElement,
  wait: { step: number; sleep: (ms: number) => Promise<void>; now: () => number },
) {
  // The button only shows once the composer has text.
  const button = await waitFor(
    () => [...doc.querySelectorAll<HTMLElement>(SEND_BUTTON_SELECTOR)].find((b) => b.getClientRects().length) ?? null,
    1000,
    wait.step,
    wait.sleep,
    wait.now,
  );
  if (button) clickLikeUser(button);
  else pressEnterOnce(input);
}

/**
 * The rendered bubble of `cliMsgId`: its own bubble id, or (album photos after
 * the first) the bubble whose `data-qid` (`<msgId>@<cliMsgId>_<fromUid>_<threadId>`)
 * names it.
 */
export function findBubble(doc: Document, dom: DomSelectors, cliMsgId: string): HTMLElement | null {
  if (!/^\w{1,128}$/.test(cliMsgId)) return null;
  const prefix = dom.bubbleIdPrefix;
  for (const el of doc.querySelectorAll<HTMLElement>(`[id^="${prefix}${cliMsgId}"]`)) {
    const rest = el.id.slice(prefix.length + cliMsgId.length);
    if (rest === '' || rest.startsWith('_')) return el;
  }
  return doc.querySelector(`[data-qid*="@${cliMsgId}_"]`)?.closest<HTMLElement>(`[id^="${prefix}"]`) ?? null;
}

export function hoverLikeUser(el: HTMLElement) {
  const view = el.ownerDocument.defaultView ?? undefined;
  for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove'] as const) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: !type.endsWith('enter'), cancelable: true, view }));
  }
}

/** Closes Zalo's reply banner, if open (a failed reply must not linger on the next send). */
export function cancelReply(doc: Document) {
  const close = doc.querySelector<HTMLElement>(`${REPLY_SELECTORS.banner} ${REPLY_SELECTORS.close}`);
  if (close) close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: doc.defaultView ?? undefined }));
}

/**
 * Scrolls the open chat up until the bubble of `cliMsgId` is rendered (03 §8
 * D33): at most `replyScrollMax` history loads, one per `replyScrollMs`, and
 * stops early when two scrolls in a row load nothing (start of Web history).
 * Reading only: nothing is clicked, so a miss leaves the chat as it was apart
 * from the scroll position.
 */
export async function scrollToBubble(cliMsgId: string, deps: SendDeps): Promise<HTMLElement | null> {
  const dom = deps.dom ?? DEFAULT_DOM_SELECTORS;
  const t = { ...DEFAULT_TIMING, ...deps.timing };
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const { doc } = deps;
  const scroller = (deps.findMessageScroller ?? findMessageScroller)(doc, dom);
  if (!scroller) return null;
  const count = () => doc.querySelectorAll(`[id^="${dom.bubbleIdPrefix}"]`).length;
  let idle = 0;
  for (let i = 0; i < t.replyScrollMax && idle < 2; i++) {
    const before = count();
    // -scrollHeight reaches the top of both normal and column-reverse lists.
    scroller.scrollTop = -scroller.scrollHeight;
    const found = await waitFor(() => findBubble(doc, dom, cliMsgId), t.replyScrollMs, t.pollStepMs, sleep, now);
    if (found) return found;
    idle = count() > before ? 0 : idle + 1;
  }
  return null;
}

/**
 * Puts the compose box in "Trả lời" mode for `cliMsgId`: hover its bubble,
 * click Zalo's reply button, and wait for the quote banner. The caller has
 * checked the compose box was empty; Zalo's @mention pre-fill is replaced by
 * the approved text in sendLine.
 */
async function startReply(cliMsgId: string, deps: SendDeps): Promise<{ ok: true } | { ok: false; error: string }> {
  const dom = deps.dom ?? DEFAULT_DOM_SELECTORS;
  const t = { ...DEFAULT_TIMING, ...deps.timing };
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const { doc } = deps;
  if (doc.querySelector(REPLY_SELECTORS.banner)) return { ok: false, error: ERR.replyBusy };
  const bubble = findBubble(doc, dom, cliMsgId) ?? (await scrollToBubble(cliMsgId, deps));
  if (!bubble) return { ok: false, error: ERR.replyTarget };
  bubble.scrollIntoView?.({ block: 'center' });
  const button = await waitFor(
    () => {
      hoverLikeUser(bubble.querySelector<HTMLElement>(REPLY_SELECTORS.hoverTarget) ?? bubble);
      return bubble.querySelector<HTMLElement>(REPLY_SELECTORS.button);
    },
    2000,
    t.pollStepMs,
    sleep,
    now,
  );
  if (!button) return { ok: false, error: ERR.replyButton };
  clickLikeUser(button);
  const banner = await waitFor(() => doc.querySelector(REPLY_SELECTORS.banner), 2000, t.pollStepMs, sleep, now);
  if (!banner) return { ok: false, error: ERR.replyBanner };
  return { ok: true };
}

/**
 * Types one line, verifies it, presses Enter once and confirms the bubble.
 * With `replyTo`, the line is sent as a Zalo "Trả lời" to that cliMsgId.
 */
async function sendLine(
  line: string,
  deps: SendDeps,
  replyTo?: string,
): Promise<{ ok: true; cliMsgId: string | null } | { ok: false; error: string }> {
  const dom = deps.dom ?? DEFAULT_DOM_SELECTORS;
  const t = { ...DEFAULT_TIMING, ...deps.timing };
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const { doc } = deps;

  const input = await findComposer(doc, { step: t.pollStepMs, sleep, now });
  if (!input) return { ok: false, error: ERR.noInput };
  // Never overwrite something the user typed (Zalo keeps per-conversation drafts).
  if (editorText(input)) return { ok: false, error: ERR.inputBusy };
  if (replyTo) {
    const r = await startReply(replyTo, deps);
    if (!r.ok) {
      // Leave nothing behind: no banner, no @mention pre-fill.
      if (r.error !== ERR.replyBusy) cancelReply(doc);
      if (editorText(input)) clearInput(input);
      return r;
    }
  }

  const focused = () => typeof doc.hasFocus !== 'function' || doc.hasFocus();
  if (!focused() && deps.focusTab) {
    await deps.focusTab().catch(() => undefined);
    await waitFor(focused, 2000, t.pollStepMs, sleep, now);
  }

  // Replaces the whole box, including Zalo's @mention pre-fill of a reply.
  insertText(input, line);

  if (editorText(input) !== line) {
    const unfocused = !focused();
    clearInput(input);
    if (replyTo) cancelReply(doc);
    return { ok: false, error: unfocused ? ERR.noFocus : ERR.mismatch };
  }

  const before = new Set(extractMessages(doc, dom).map((m) => m.cliMsgId));
  await submitComposer(doc, input, { step: t.pollStepMs, sleep, now });

  // Zalo re-renders #richInput after sending: check the current element, not the one we typed into.
  const current = () => doc.querySelector<HTMLElement>(INPUT_SELECTOR) ?? input;
  const cleared = await waitFor(() => !editorText(current()), t.inputClearTimeoutMs, t.pollStepMs, sleep, now);
  if (!cleared) {
    clearInput(current());
    if (replyTo) cancelReply(doc);
    return { ok: false, error: ERR.notSent };
  }

  const bubble = await waitFor(
    () =>
      extractMessages(doc, dom).find(
        (m) => m.direction === 'out' && !before.has(m.cliMsgId) && normalizeText(m.text) === line,
      ),
    t.confirmTimeoutMs,
    t.pollStepMs,
    sleep,
    now,
  );
  if (!bubble) return { ok: false, error: ERR.unconfirmed };
  return { ok: true, cliMsgId: bubble.cliMsgId };
}

/**
 * Sends an approved text to `threadId`: open + verify the conversation, then
 * each non-empty line as its own message. Stops at the first failed line and
 * reports how many lines already went out (so a human never blindly resends).
 */
export async function sendToThread(threadId: string, text: string, deps: SendDeps): Promise<SendOutcome> {
  const t = { ...DEFAULT_TIMING, ...deps.timing };
  const sleep = deps.sleep ?? realSleep;
  const lines = splitLines(text);
  if (!lines.length) return { ok: false, error: ERR.empty, sentLines: 0 };

  const opened = await openConversation(threadId, deps);
  if (!opened.ok) return { ok: false, error: opened.error, sentLines: 0 };

  let last: string | null = null;
  const allIds: string[] = [];
  let replyCliMsgId: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      await sleep(t.minGapMs);
      // The user may have switched conversation meanwhile: re-verify.
      const still = await openConversation(threadId, deps);
      if (!still.ok) return partial(still.error, i, lines.length);
    }
    // Only the first line carries the quote (one Zalo message per line).
    const replyTo = i === 0 ? deps.replyToCliMsgId : undefined;
    const r = await sendLine(lines[i], deps, replyTo);
    if (!r.ok) return partial(r.error, i, lines.length);
    last = r.cliMsgId;
    if (r.cliMsgId) allIds.push(r.cliMsgId);
    if (replyTo) replyCliMsgId = r.cliMsgId;
  }
  return {
    ok: true,
    cliMsgId: last,
    ...(allIds.length > 1 ? { cliMsgIds: allIds } : {}),
    sentAt: new Date((deps.now ?? Date.now)()),
    lines: lines.length,
    ...(deps.replyToCliMsgId ? { replyCliMsgId } : {}),
  };
}

function partial(error: string, sent: number, total: number): SendOutcome {
  return { ok: false, error: total > 1 ? `đã gửi ${sent}/${total} dòng; ${error}` : error, sentLines: sent };
}

// ---- Polling loop -------------------------------------------------------------

export interface SenderStatus {
  enabled: boolean;
  uid: string | null;
  lastPollAt: string | null;
  lastSentAt: string | null;
  lastError: string | null;
  sentCount: number;
  failedCount: number;
}

export interface LoopDeps extends SendDeps {
  api: SenderApi;
  /** Current config (read on every tick so the popup toggle applies at once). */
  config: () => Promise<{ enabled: boolean; uid: string | null; onlyThreadIds?: string[]; onlyFriendTargets?: string[] }>;
  /** Uids with a zdb_<uid> database in this browser. */
  knownUids: () => Promise<string[]>;
  /** Selectors from the active mapping. */
  selectors?: () => Promise<DomSelectors>;
  /** Epoch ms of the last real user keystroke/click in this tab. */
  lastUserActivity?: () => number;
  /** `event` marks one item finished (for the popup counters). */
  onStatus?: (patch: Partial<SenderStatus>, event?: 'sent' | 'failed') => void;
  log?: (m: string) => void;
  /**
   * Channel hooks (defaults: personal Zalo). The Messenger sender plugs its own
   * `send` and item filter in here so the claim → send → result loop is shared.
   */
  send?: (threadId: string, text: string, deps: LoopDeps) => Promise<SendOutcome>;
  /** Zalo: sends a whole outbox command (photos, file, card, poll, @mentions); see sender-actions.ts. */
  sendItem?: (item: OutboxItem, deps: LoopDeps) => Promise<SendOutcome>;
  /** Extra per-item check before claiming (e.g. channel). */
  acceptItem?: (item: OutboxItem) => boolean;
  /** Checked before each claim; false stops this poll (rate limit). */
  allowSend?: () => boolean;
  /** Max items sent per poll (default: all pending). */
  maxPerPoll?: number;
  /** Shown when the configured uid is not logged in here. */
  notHereError?: (uid: string) => string;
  /** Long-poll length asked from the API (default LONG_POLL_SEC; 0 = plain poll). */
  waitSec?: number;
}

/**
 * No sending while the user is typing/clicking in the Zalo tab. Lowered from
 * 15 s on 2026-09-28 (owner decision): the pause only has to outlast a click
 * or a burst of typing, not a whole conversation.
 */
export const USER_IDLE_MS = 5_000;

/**
 * Seconds the API holds an empty /pending request. Must stay under 30 s: Chrome
 * ends an MV3 service worker whose fetch gets no response within 30 s.
 */
export const LONG_POLL_SEC = 20;

/** Focuses this tab when it is hidden or unfocused (no-op without `focusTab`). */
async function bringTabForward(deps: LoopDeps, sleep: (ms: number) => Promise<void>, now: () => number, step: number) {
  const { doc } = deps;
  const ready = () => doc.visibilityState !== 'hidden' && (typeof doc.hasFocus !== 'function' || doc.hasFocus());
  if (ready() || !deps.focusTab) return;
  await deps.focusTab().catch(() => undefined);
  await waitFor(ready, 2000, step, sleep, now);
}

/** True when the user touched the tab within USER_IDLE_MS. */
function userActive(deps: LoopDeps, now: () => number): boolean {
  return !!deps.lastUserActivity && now() - deps.lastUserActivity() < USER_IDLE_MS;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

/**
 * One poll: fetch pending for the configured uid and send them one at a time
 * (claim → send → result). Returns the number of items processed.
 */
export async function pollOnce(deps: LoopDeps): Promise<number> {
  const cfg = await deps.config();
  if (!cfg.enabled || !cfg.uid) return 0;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? realSleep;
  const t = { ...DEFAULT_TIMING, ...deps.timing };
  if (!(await deps.knownUids()).includes(cfg.uid)) {
    deps.onStatus?.({
      lastError: deps.notHereError?.(cfg.uid) ?? `tài khoản ${cfg.uid} không có trong Zalo Web này`,
    });
    return 0;
  }

  // The API holds this request until something is approved, so items are
  // picked up within one round trip instead of one poll period.
  const items = await deps.api.pending(cfg.uid, deps.waitSec ?? LONG_POLL_SEC);
  deps.onStatus?.({ lastPollAt: new Date(now()).toISOString() });
  let done = 0;
  for (const item of items) {
    if (done >= (deps.maxPerPoll ?? Infinity)) break;
    // The user is using the tab: give them the idle window once, then leave the
    // rest for the next poll rather than typing over their hands.
    if (userActive(deps, now)) {
      await sleep(USER_IDLE_MS - (now() - deps.lastUserActivity!()));
      if (userActive(deps, now)) break;
    }
    // Server-side invariant, double-checked here: never send an unapproved item.
    if (item.uid !== cfg.uid || !item.approvedBy || !item.approvedAt || item.status !== 'approved') continue;
    // Allowlisted browsers (test setups) leave every other conversation's items alone.
    // Friend requests have no conversation: they are approved one by one and paced by the API (SZ-09).
    if (cfg.onlyThreadIds?.length && !isFriendAction(item.action) && !cfg.onlyThreadIds.includes(item.threadId)) continue;
    if (deps.acceptItem && !deps.acceptItem(item)) continue;
    if (deps.allowSend && !deps.allowSend()) break;
    let claimed: OutboxItem;
    try {
      claimed = await deps.api.claim(item.id);
    } catch (e) {
      // The nick's send pace (M1a-06): the rest stays approved for a later poll.
      if (isSendPaceRefusal(e)) break;
      continue; // taken by another tab / Claude, or no longer approved
    }
    if (!claimed.approvedBy || !claimed.approvedAt) {
      await deps.api.result(claimed.id, { ok: false, error: 'thiếu thông tin duyệt' }).catch(() => undefined);
      continue;
    }
    const dom = deps.selectors ? await deps.selectors() : deps.dom;
    // Every command drives Zalo Web's UI: a background tab does not re-render its
    // lists (e.g. the name-card search stays unfiltered), so bring it forward first.
    await bringTabForward(deps, sleep, now, t.pollStepMs);
    let outcome: SendOutcome;
    try {
      // Lets a conversation outside the rendered sidebar be found via search and confirmed by its bubbles.
      const open = {
        ...deps,
        dom,
        friendTargets: cfg.onlyFriendTargets,
        name: item.name,
        confirmCliMsgIds: item.recentCliMsgIds,
        replyToCliMsgId: claimed.replyToCliMsgId,
      };
      outcome = deps.send
        ? await deps.send(claimed.threadId, claimed.text, deps)
        : deps.sendItem
          ? await deps.sendItem(claimed, open)
          : await sendToThread(claimed.threadId, claimed.text, open);
    } catch (e) {
      outcome = { ok: false, error: `lỗi khi gửi: ${errMsg(e)}`, sentLines: 0 };
    }
    const result: OutboxResult = outcome.ok
      ? {
          ok: true,
          sentAt: outcome.sentAt.toISOString(),
          ...(outcome.cliMsgId ? { cliMsgId: outcome.cliMsgId } : {}),
          ...(outcome.cliMsgIds?.length ? { cliMsgIds: outcome.cliMsgIds } : {}),
          ...(outcome.replyCliMsgId ? { replyCliMsgId: outcome.replyCliMsgId } : {}),
        }
      : { ok: false, error: outcome.error };
    try {
      await deps.api.result(claimed.id, result);
    } catch (e) {
      deps.log?.(`VClinks sender: could not report result for ${claimed.id}: ${errMsg(e)}`);
    }
    deps.log?.(`VClinks sender: ${claimed.id} → ${outcome.ok ? 'sent' : 'failed'}`);
    if (outcome.ok) deps.onStatus?.({ lastSentAt: new Date(now()).toISOString(), lastError: null }, 'sent');
    else deps.onStatus?.({ lastError: outcome.error }, 'failed');
    done++;
    await sleep(t.minGapMs);
  }
  return done;
}

/**
 * Gap between two polls. Each poll is a long-poll that the API holds up to
 * LONG_POLL_SEC when nothing is pending, so this only paces the reconnects.
 */
export const POLL_EVERY_MS = 1_000;

/**
 * Starts the poll loop in this tab. A Web Lock keeps a single sender across
 * several chat.zalo.me tabs. Returns a stop function.
 */
export function startSender(
  deps: LoopDeps,
  opts: { lockName?: string; everyMs?: number; firstDelayMs?: number } = {},
): () => void {
  const lockName = opts.lockName ?? 'vclinks-sender';
  const everyMs = opts.everyMs ?? POLL_EVERY_MS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (stopped) return;
    try {
      const locks = (globalThis.navigator as Navigator | undefined)?.locks;
      if (locks) {
        await locks.request(lockName, { ifAvailable: true }, async (lock) => {
          if (lock) await pollOnce(deps);
        });
      } else {
        await pollOnce(deps);
      }
    } catch (e) {
      deps.onStatus?.({ lastError: errMsg(e) });
    } finally {
      if (!stopped) timer = setTimeout(() => void tick(), everyMs);
    }
  };
  timer = setTimeout(() => void tick(), opts.firstDelayMs ?? 2000);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
