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
} from '../compose';
import type { SendOutcome } from '../sender';
import { findSidebar, parseThreadPath, readActiveThread, readThreadMessages } from './reader';
import { DEFAULT_MESSENGER_SELECTORS, type MessengerSelectors } from './selectors';

/**
 * Messenger sender: types a Dashboard-approved message into the Messenger
 * composer of the user's own tab. Same safety rules as the Zalo sender
 * (sender.ts / compose.ts), plus a slower, human pace for Facebook:
 * - the thread is opened by clicking its sidebar link (never by URL
 *   navigation), then verified from the address bar;
 * - text goes in with execCommand('insertText'), one message per line;
 * - the composer must read back exactly the approved line, else it is
 *   cleared and Enter is never pressed;
 * - Enter is pressed exactly once per line, then the composer must empty and
 *   a new outgoing bubble with that text must appear;
 * - nothing happens while the user is active in the tab.
 */

export interface FbSenderTiming {
  maxScrollSteps: number;
  openTimeoutMs: number;
  inputClearTimeoutMs: number;
  confirmTimeoutMs: number;
  /** Minimum gap between two Enter presses (lines). */
  minGapMs: number;
  /** Extra random pause (0..jitterMs) before typing, to avoid a robotic rhythm. */
  jitterMs: number;
  /** "Reading" pause after opening a thread and before typing. */
  thinkMs: number;
  pollStepMs: number;
}

export const FB_DEFAULT_TIMING: FbSenderTiming = {
  maxScrollSteps: 15,
  openTimeoutMs: 8000,
  inputClearTimeoutMs: 4000,
  confirmTimeoutMs: 15_000,
  minGapMs: 8000,
  jitterMs: 4000,
  thinkMs: 2500,
  pollStepMs: 200,
};

export interface FbSendDeps {
  doc: Document;
  loc: { pathname: string };
  sel?: MessengerSelectors;
  timing?: Partial<FbSenderTiming>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  /** True while the user is typing/clicking in this tab: abort before typing / Enter. */
  isUserActive?: () => boolean;
  /** Sidebar scroller override (tests: happy-dom has no layout). */
  findScroller?: (doc: Document, sel: MessengerSelectors) => Element | null;
}

export const FB_ERR = {
  badThreadId: 'threadId không hợp lệ',
  notFound: 'không thấy hội thoại trong danh sách Messenger',
  notActive: 'không xác nhận được hội thoại đang mở trên Messenger',
  locked: 'hội thoại mã hóa đầu cuối đang khóa (cần nhập mã PIN trên Messenger)',
  noInput: 'không thấy ô soạn tin Messenger',
  inputBusy: 'ô soạn tin Messenger đang có nội dung chưa gửi, không ghi đè',
  userActive: 'người dùng đang thao tác trên tab Messenger, hoãn gửi',
  mismatch: 'nội dung trong ô soạn tin không khớp bản đã duyệt, đã xóa và không gửi',
  notSent: 'Messenger chưa gửi (ô soạn tin vẫn còn nội dung), đã xóa',
  unconfirmed: 'không thấy tin vừa gửi trong khung chat — kiểm tra trên Messenger trước khi gửi lại',
  empty: 'nội dung rỗng',
} as const;

function ctx(deps: FbSendDeps) {
  return {
    sel: deps.sel ?? DEFAULT_MESSENGER_SELECTORS,
    t: { ...FB_DEFAULT_TIMING, ...deps.timing },
    sleep: deps.sleep ?? realSleep,
    now: deps.now ?? Date.now,
    random: deps.random ?? Math.random,
  };
}

/** Sidebar scroll container: nearest scrollable ancestor of the conversation list. */
export function findSidebarScroller(doc: Document, sel: MessengerSelectors): Element | null {
  const box = findSidebar(doc, sel);
  for (let el: Element | null = box; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 10) {
      const oy = doc.defaultView?.getComputedStyle(el).overflowY;
      if (oy === 'auto' || oy === 'scroll') return el;
    }
  }
  return null;
}

function findThreadLink(doc: Document, threadId: string, sel: MessengerSelectors): HTMLElement | null {
  const box = findSidebar(doc, sel);
  if (!box) return null;
  for (const a of box.querySelectorAll<HTMLElement>(sel.sidebarThreadLink)) {
    if (parseThreadPath(a.getAttribute('href'))?.threadId === threadId) return a;
  }
  return null;
}

function composer(doc: Document, sel: MessengerSelectors): HTMLElement | null {
  return doc.querySelector<HTMLElement>(sel.composer);
}

/** Opens `threadId` by clicking its sidebar link and verifies it from the address bar. */
export async function openFbThread(threadId: string, deps: FbSendDeps): Promise<{ ok: true } | { ok: false; error: string }> {
  const { sel, t, sleep, now } = ctx(deps);
  const { doc, loc } = deps;
  if (!/^[\w.-]{1,128}$/.test(threadId)) return { ok: false, error: FB_ERR.badThreadId };
  if (readActiveThread(loc)?.threadId === threadId) return { ok: true };

  let link = findThreadLink(doc, threadId, sel);
  if (!link) {
    const scroller = (deps.findScroller ?? findSidebarScroller)(doc, sel);
    if (scroller) {
      const start = scroller.scrollTop;
      for (let i = 0; i < t.maxScrollSteps && !link; i++) {
        const before = scroller.scrollTop;
        scroller.scrollTop = before + Math.max(200, Math.floor(scroller.clientHeight * 0.8));
        await sleep(600);
        link = findThreadLink(doc, threadId, sel);
        if (scroller.scrollTop === before) break;
      }
      if (!link) scroller.scrollTop = start; // restore the user's view
    }
  }
  if (!link) return { ok: false, error: FB_ERR.notFound };

  link.scrollIntoView?.({ block: 'nearest' });
  clickLikeUser(link);
  const ok = await waitFor(
    () => readActiveThread(loc)?.threadId === threadId && !!composer(doc, sel),
    t.openTimeoutMs,
    t.pollStepMs,
    sleep,
    now,
  );
  return ok ? { ok: true } : { ok: false, error: FB_ERR.notActive };
}

/** Outgoing messages with exactly this text in the open thread (all rendered rows). */
function outgoingWithText(deps: FbSendDeps, threadId: string, line: string, includeUnanchored = true): string[] {
  const { sel, now } = ctx(deps);
  return readThreadMessages(deps.doc, { threadId, now: now(), includeUnanchored }, sel)
    .messages.filter((m) => m.direction === 'out' && normalizeText(m.text) === line)
    .map((m) => m.msgId);
}

async function sendLine(
  threadId: string,
  line: string,
  deps: FbSendDeps,
): Promise<{ ok: true; msgId: string | null } | { ok: false; error: string }> {
  const { sel, t, sleep, now } = ctx(deps);
  const { doc } = deps;

  const input = await waitFor(() => composer(doc, sel), 3000, t.pollStepMs, sleep, now);
  if (!input) return { ok: false, error: FB_ERR.noInput };
  // Never overwrite something the user typed.
  if (editorText(input)) return { ok: false, error: FB_ERR.inputBusy };
  if (deps.isUserActive?.()) return { ok: false, error: FB_ERR.userActive };

  insertText(input, line);

  if (editorText(input) !== line) {
    clearInput(input);
    return { ok: false, error: FB_ERR.mismatch };
  }
  // Last check right before the irreversible step.
  if (deps.isUserActive?.() || readActiveThread(deps.loc)?.threadId !== threadId) {
    clearInput(input);
    return { ok: false, error: deps.isUserActive?.() ? FB_ERR.userActive : FB_ERR.notActive };
  }

  const before = outgoingWithText(deps, threadId, line).length;
  pressEnterOnce(input);

  const cleared = await waitFor(() => !editorText(input), t.inputClearTimeoutMs, t.pollStepMs, sleep, now);
  if (!cleared) {
    clearInput(input);
    return { ok: false, error: FB_ERR.notSent };
  }
  const confirmed = await waitFor(() => outgoingWithText(deps, threadId, line).length > before, t.confirmTimeoutMs, t.pollStepMs, sleep, now);
  if (!confirmed) return { ok: false, error: FB_ERR.unconfirmed };
  // Stable (anchored) id of the new bubble, same as the reader will ingest; null if not anchored yet.
  const ids = outgoingWithText(deps, threadId, line, false);
  return { ok: true, msgId: ids.at(-1) ?? null };
}

/**
 * Sends an approved text to Messenger thread `threadId`, one message per
 * non-empty line. Stops at the first failure and reports how many lines went out.
 */
export async function sendFbToThread(threadId: string, text: string, deps: FbSendDeps): Promise<SendOutcome> {
  const { sel, t, sleep, now, random } = ctx(deps);
  const lines = splitLines(text);
  if (!lines.length) return { ok: false, error: FB_ERR.empty, sentLines: 0 };
  if (deps.isUserActive?.()) return { ok: false, error: FB_ERR.userActive, sentLines: 0 };

  const opened = await openFbThread(threadId, deps);
  if (!opened.ok) {
    const locked = readThreadMessages(deps.doc, { threadId, now: now() }, sel).locked;
    return { ok: false, error: locked ? FB_ERR.locked : opened.error, sentLines: 0 };
  }

  let last: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    await sleep(i === 0 ? t.thinkMs + Math.floor(random() * t.jitterMs) : t.minGapMs + Math.floor(random() * t.jitterMs));
    // The user may have switched conversation meanwhile: re-verify, never re-navigate mid-message.
    if (readActiveThread(deps.loc)?.threadId !== threadId) return partial(FB_ERR.notActive, i, lines.length);
    const r = await sendLine(threadId, lines[i], deps);
    if (!r.ok) return partial(r.error, i, lines.length);
    last = r.msgId;
  }
  return { ok: true, cliMsgId: last, sentAt: new Date(now()), lines: lines.length };
}

function partial(error: string, sent: number, total: number): SendOutcome {
  return { ok: false, error: total > 1 ? `đã gửi ${sent}/${total} dòng; ${error}` : error, sentLines: sent };
}
