import { DEFAULT_DOM_SELECTORS, REACTION_CODE, type DomSelectors, type OutboxItem } from '@vclinks/shared';
import { appendText, backspaceAtEnd, clearInput, clickLikeUser, editorText, insertText, normalizeText, realSleep, waitFor } from './compose';
import { detectSticker } from './dom-media';
import { extractMessages } from './dom-reader';
import { CS_SOURCE, HOOK_SOURCE, type ArmFilesMessage, type HookReply } from './file-hook';
import { sendFriendCommand } from './sender-friend';
import { ERR, findBubble, findComposer, hoverLikeUser, locateThreadItem, openConversation, sendToThread, submitComposer, type SendDeps, type SendOutcome } from './sender';

/**
 * Outbox commands other than plain text, driven through Zalo Web's own UI
 * (selectors surveyed on the live app 28/09/2026, docs/04-ky-thuat/zalo-web/zalo-web-extraction.md §7.2):
 *
 * | Command     | Zalo Web UI                                                              |
 * |-------------|--------------------------------------------------------------------------|
 * | send_images | `[icon="Photo_24_Line"]` → file input (hooked) → sent at once           |
 * | send_file   | `[icon="Attach_24_Line"]` → `div_CX_Select` → file input (hooked)        |
 * | send_card   | `div_CT_Menu` → search `txt_CT_Search` → `div_CT_CTItem` → `btn_CT_Share` |
 * | send_sticker| `div_Sticker_Menu` → set tab `div_StickerMenu_SetItem[title]` → item `div_StickerMenu_RecentItem` (thumb = `.sticker` background) → sent at once |
 * | create_poll | `div_More_Menu` → `div_MoreMenu_Poll` → question + options → `btn_CreatePoll_Create` |
 * | @mentions   | type `@` in `#richInput` → `#mentionPopover .mention-popover__item[title]` → `span.clnMention` |
 * | react       | hover bubble → hover `[data-id$="Msg_React"]` → `.reaction-emoji-list .reaction-emoji-icon` (text = Zalo code, e.g. `/-strong`) |
 * | pin / read  | sidebar item → hover → `[icon="More_24_Line"]` → `.popover-v3 .zmenu-item` ("Ghim hội thoại", "Đánh dấu chưa đọc"…) |
 *
 * Same rules as text (sender.ts): open + verify the conversation first, check
 * every step in the DOM, and on any doubt cancel (Escape / Hủy) and report a
 * short Vietnamese reason. Nothing here ever sends a second time on its own.
 */

export interface ActionDeps extends SendDeps {
  /** Page window (postMessage to the MAIN-world file hook). */
  win?: Window;
  /** Bytes of an outbox attachment (GET /api/media/:id through the background). */
  fetchMedia?: (id: string) => Promise<{ buffer: ArrayBuffer; mime: string }>;
  /**
   * Injects the MAIN-world file hook when it is missing (a tab that loaded
   * before the extension, e.g. restored at browser start); true when injected.
   */
  injectFileHook?: () => Promise<boolean>;
}

const ENTER_SETTLE_MS = 400;
/** Name-card search: typing attempts and the pause after each (Zalo may wipe an early one). */
const CARD_SEARCH_ATTEMPTS = 4;
const CARD_SEARCH_SETTLE_MS = 500;

export const ACTION_ERR = {
  noMedia: 'extension chưa hỗ trợ tải tệp đính kèm',
  hookMissing: 'không đưa được tệp vào Zalo (bộ chặn chọn file chưa sẵn sàng, hãy tải lại tab Zalo)',
  hookRefused: 'Zalo không nhận loại tệp này ở nút đã chọn',
  pickerNotOpened: 'Zalo không mở hộp chọn tệp',
  noButton: (what: string) => `không thấy nút "${what}" trên Zalo Web`,
  notConfirmed: (what: string) => `không thấy ${what} vừa gửi trong khung chat — kiểm tra trên Zalo trước khi gửi lại`,
  cardNotFound: 'không tìm thấy đúng một danh thiếp có tên này',
  cardSearch: 'Zalo không giữ tên trong ô tìm danh thiếp',
  cardNotSelected: 'không chọn được danh thiếp',
  phoneToggle: 'không đặt được ô "Gửi kèm số điện thoại" đúng như đã duyệt',
  pollForm: 'không điền được biểu mẫu bình chọn',
  stickerPanel: 'Zalo không mở bảng sticker',
  stickerSet: (name: string) => `bảng sticker của Zalo không có bộ "${name}"`,
  stickerItem: 'không thấy đúng sticker đã chọn trong bộ (vị trí hoặc ảnh thu nhỏ không khớp)',
  mentionMultiline: 'tin có @nhắc tên phải nằm trên một dòng',
  mentionNotFound: (name: string) => `không thấy "${name}" trong danh sách @nhắc tên của nhóm`,
  mentionMismatch: 'nội dung @nhắc tên trong ô soạn tin không khớp bản đã duyệt, đã xóa và không gửi',
  inputBusy: 'ô soạn tin đang có nội dung chưa gửi, không ghi đè',
  reactTarget: 'không thấy tin cần thả cảm xúc trong khung chat Zalo (có thể đã trôi lên quá xa)',
  reactPicker: 'Zalo không mở bảng chọn cảm xúc',
  reactIcon: (code: string) => `bảng chọn cảm xúc của Zalo không có biểu tượng ${code}`,
  reactNotShown: 'cảm xúc không hiện lên tin sau khi bấm',
  convItem: 'không thấy hội thoại trong danh sách bên trái của Zalo Web',
  convMenu: 'không mở được menu "Thêm" của hội thoại',
  convMenuItem: (what: string) => `menu hội thoại của Zalo không có mục "${what}"`,
  convNotApplied: (what: string) => `Zalo chưa đổi trạng thái sau khi bấm "${what}"`,
} as const;

const SEL = {
  photo: '[icon="Photo_24_Line"]',
  attach: '[icon="Attach_24_Line"]',
  fileSelect: '[data-id="div_CX_Select"]',
  cardMenu: '[data-id="div_CT_Menu"]',
  cardSearch: '[data-id="txt_CT_Search"]',
  cardItem: '[data-id="div_CT_CTItem"]',
  cardSelected: '.create-group__selected-section',
  cardPhoneToggle: '.create-group__snd-with-num-container',
  cardShare: '[data-id="btn_CT_Share"]',
  cardCancel: '[data-id="btn_CT_CXL"]',
  /** Sticker panel (live structure 29/09/2026). The set page reuses the "Recent" section and item ids. */
  stickerButton: '[data-id="div_Sticker_Menu"]',
  stickerSection: '[data-id="div_StickerMenu_Recent"]',
  stickerSetTab: '[data-id="div_StickerMenu_SetItem"]',
  stickerItem: '[data-id="div_StickerMenu_RecentItem"]',
  stickerThumb: '.sticker',
  chatHeader: 'header#header',
  moreMenu: '[data-id="div_More_Menu"]',
  pollEntry: '[data-id="div_MoreMenu_Poll"]',
  pollAddOption: '[data-id="div_CreatePoll_AddOpt"]',
  pollCreate: '[data-id="btn_CreatePoll_Create"]',
  /** A poll in the chat is a group notice without a bubble id (live check 28/09/2026). */
  pollInChat: '.group-poll-message-container',
  pollQuestion: '.question__poll',
  pollCancel: '[data-id="btn_CreatePoll_CXL"]',
  modal: '.zl-modal',
  input: '#richInput',
  mentionItem: '#mentionPopover .mention-popover__item',
  mentionChip: 'span.clnMention',
  /** Reactions (live structure 28/09/2026). */
  reactButton: '[data-id$="Msg_React"]',
  reactPicker: '.reaction-emoji-list',
  reactIcon: '.reaction-emoji-icon',
  reactList: '[data-id$="_ReactList"]',
  /** Sidebar item menu. */
  convMore: '[icon="More_24_Line"]',
  popoverItem: '.popover-v3 .zmenu-item, .popover-v3 [class*="menu-item"]',
  convPinned: '.conv__pinned, .conv-action__pin',
  convUnread: '.conv-action__unread-v2, .z-conv-message.--unread',
} as const;

/** Menu labels in Zalo's conversation "Thêm" menu (Vietnamese UI, 28/09/2026). */
const CONV_MENU = {
  pin: 'Ghim hội thoại',
  unpin: 'Bỏ ghim hội thoại',
  markRead: 'Đánh dấu đã đọc',
  markUnread: 'Đánh dấu chưa đọc',
} as const;

const fold = (s: string | null | undefined) => normalizeText(s).replace(/\s+/g, ' ').normalize('NFC');
const visible = (el: Element | null | undefined): el is HTMLElement =>
  !!el && (el as HTMLElement).getClientRects?.().length > 0;

function ctx(deps: ActionDeps) {
  return {
    dom: deps.dom ?? DEFAULT_DOM_SELECTORS,
    sleep: deps.sleep ?? realSleep,
    now: deps.now ?? Date.now,
    step: deps.timing?.pollStepMs ?? 150,
    doc: deps.doc,
    win: deps.win ?? (deps.doc.defaultView as Window),
  };
}

type Fail = { ok: false; error: string; sentLines: number };
const fail = (error: string): Fail => ({ ok: false, error, sentLines: 0 });

/** The open modal dialog, if any. */
function openModal(doc: Document): HTMLElement | null {
  return [...doc.querySelectorAll<HTMLElement>(SEL.modal)].find(visible) ?? null;
}

/** Closes menus / dialogs we opened: the dialog's cancel button, else Escape. */
function dismiss(doc: Document, cancelSel?: string) {
  const cancel = cancelSel ? doc.querySelector<HTMLElement>(cancelSel) : null;
  if (cancel && visible(cancel)) clickLikeUser(cancel);
  const target = doc.activeElement ?? doc.body;
  for (const type of ['keydown', 'keyup'] as const) {
    target.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  }
}

/** Sets a React-controlled <input> value the way typing would. */
export function setInputValue(input: HTMLInputElement, value: string) {
  input.focus();
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Outgoing bubble ids on screen (to spot the one this command creates). */
function outIds(doc: Document, dom: DomSelectors): Set<string> {
  return new Set(extractMessages(doc, dom).filter((m) => m.direction === 'out').map((m) => m.cliMsgId));
}

async function waitNewOut(deps: ActionDeps, before: Set<string>, timeoutMs = 15_000, accept?: (el: Element) => boolean) {
  const { doc, dom, sleep, now, step } = ctx(deps);
  return waitFor(
    () => {
      // Any new outgoing bubble that passes `accept` (a re-rendered album can show up as "new" too).
      const fresh = extractMessages(doc, dom).filter((x) => x.direction === 'out' && !before.has(x.cliMsgId));
      return (
        fresh.find((m) => {
          if (!accept) return true;
          const el = doc.querySelector(`[id^="${dom.bubbleIdPrefix}${m.cliMsgId}"]`);
          return !!el && accept(el);
        }) ?? null
      );
    },
    timeoutMs,
    step,
    sleep,
    now,
  );
}

// ---- files (photos / documents) ---------------------------------------------------

let nonceSeq = 0;

/** Arms the MAIN-world hook; resolves with its reply once the file input consumed (or refused) the files. */
function armFiles(win: Window, files: ArmFilesMessage['files'], timeoutMs: number): {
  armed: Promise<boolean>;
  done: Promise<HookReply | null>;
} {
  const nonce = `vc${Date.now().toString(36)}${(nonceSeq++).toString(36)}`;
  let onArmed!: (v: boolean) => void;
  let onDone!: (v: HookReply | null) => void;
  const armed = new Promise<boolean>((r) => (onArmed = r));
  const done = new Promise<HookReply | null>((r) => (onDone = r));
  const listener = (ev: MessageEvent) => {
    const d = ev.data as HookReply | undefined;
    if (ev.source !== win || !d || d.source !== HOOK_SOURCE || d.nonce !== nonce) return;
    if (d.type === 'armed') return onArmed(true);
    win.removeEventListener('message', listener);
    onDone(d);
  };
  win.addEventListener('message', listener);
  setTimeout(() => onArmed(false), 1500);
  setTimeout(() => {
    win.removeEventListener('message', listener);
    onDone(null);
  }, timeoutMs);
  const msg: ArmFilesMessage = { source: CS_SOURCE, type: 'arm-files', nonce, files };
  win.postMessage(msg, win.location.origin);
  return { armed, done };
}

async function loadFiles(item: OutboxItem, deps: ActionDeps) {
  if (!deps.fetchMedia) throw new Error(ACTION_ERR.noMedia);
  const out: ArmFilesMessage['files'] = [];
  for (const a of item.attachments ?? []) {
    const { buffer, mime } = await deps.fetchMedia(a.id);
    out.push({ name: a.name, type: mime || a.mime, buffer });
  }
  return out;
}

/** Photos (send_images) or one document (send_file) through Zalo's own buttons. */
export async function sendFiles(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  const { doc, dom, win, sleep, now, step } = ctx(deps);
  // A quote goes as its PDF (a file) or as page images (M1c-02).
  const isImages = item.action === 'send_images' || (item.action === 'send_quote' && item.quote?.form === 'image');
  let files: ArmFilesMessage['files'];
  try {
    files = await loadFiles(item, deps);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  if (!files.length) return fail('không có tệp đính kèm');

  const opened = await openConversation(item.threadId, deps);
  if (!opened.ok) return fail(opened.error);

  const button = doc.querySelector<HTMLElement>(isImages ? SEL.photo : SEL.attach);
  if (!visible(button)) return fail(ACTION_ERR.noButton(isImages ? 'Gửi hình ảnh' : 'Đính kèm File'));

  const before = outIds(doc, dom);
  let hook = armFiles(win, files, 8000);
  if (!(await hook.armed)) {
    if (!(await deps.injectFileHook?.().catch(() => false))) return fail(ACTION_ERR.hookMissing);
    hook = armFiles(win, files, 8000);
    if (!(await hook.armed)) return fail(ACTION_ERR.hookMissing);
  }
  clickLikeUser(button);
  if (!isImages) {
    const select = await waitFor(() => [...doc.querySelectorAll<HTMLElement>(SEL.fileSelect)].find(visible), 3000, step, sleep, now);
    if (!select) {
      dismiss(doc);
      return fail(ACTION_ERR.noButton('Chọn File'));
    }
    clickLikeUser(select);
  }
  const reply = await hook.done;
  if (!reply || reply.type === 'expired') {
    dismiss(doc);
    return fail(ACTION_ERR.pickerNotOpened);
  }
  if (reply.type === 'refused') return fail(`${ACTION_ERR.hookRefused} (${reply.reason})`);

  // Zalo sends at once; confirm with the new outgoing bubble of the right kind.
  const names = files.map((f) => fold(f.name));
  const bubble = await waitNewOut(deps, before, 30_000, (el) =>
    isImages
      ? !!el.querySelector('[data-id$="Msg_Photo"], [data-id$="Msg_GrpPhoto"], img.zimg-el')
      : !!el.querySelector('.file-message__container') && names.some((n) => fold(el.textContent).replace(/\s/g, '').includes(n.replace(/\s/g, ''))),
  );
  if (!bubble) return { ok: false, error: ACTION_ERR.notConfirmed(isImages ? 'ảnh' : 'file'), sentLines: 0 };
  return { ok: true, cliMsgId: bubble.cliMsgId, sentAt: new Date(now()), lines: 1 };
}

// ---- quote (M1c-02) ----------------------------------------------------------------

/**
 * `send_quote`: the quote's PDF (or page images) through Zalo's own file / photo buttons, then the words that
 * go with it as a normal message. Both parts are confirmed by their own bubble. When the file went out but the
 * words did not, the error says so (a person must look at Zalo before trying again: no blind resend).
 */
export async function sendQuote(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  const quote = item.quote;
  if (!quote) return fail('thiếu thông tin báo giá');
  const file = await sendFiles(item, deps);
  if (!file.ok) return file;
  const words = quote.message.trim();
  if (!words) return file;
  await ctx(deps).sleep(deps.timing?.minGapMs ?? QUOTE_GAP_MS);
  const text = await sendToThread(item.threadId, words, deps);
  if (!text.ok) {
    return { ok: false, error: `đã gửi file báo giá ${quote.no} nhưng chưa gửi được lời nhắn (${text.error}); hãy kiểm tra Zalo, đừng gửi lại file`, sentLines: 1 };
  }
  const ids = [file.cliMsgId, ...(text.cliMsgIds ?? [text.cliMsgId])].filter((x): x is string => !!x);
  return { ok: true, cliMsgId: text.cliMsgId, ...(ids.length > 1 ? { cliMsgIds: ids } : {}), sentAt: text.sentAt, lines: 1 + text.lines };
}

/** Pause between the quote file and its words. */
const QUOTE_GAP_MS = 1500;

// ---- name card -------------------------------------------------------------------

/** True when a card-dialog row shows exactly this name (in its own element; the phone is a sibling). */
function cardRowHasName(row: Element, want: string): boolean {
  const leaves = [row, ...row.querySelectorAll('*')].filter((e) => !e.children.length);
  return leaves.some((e) => fold(e.textContent) === want);
}

export async function sendCard(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  const { doc, dom, sleep, now, step } = ctx(deps);
  const card = item.card;
  if (!card) return fail('thiếu danh thiếp');
  const opened = await openConversation(item.threadId, deps);
  if (!opened.ok) return fail(opened.error);

  const menu = doc.querySelector<HTMLElement>(SEL.cardMenu);
  if (!visible(menu)) return fail(ACTION_ERR.noButton('Gửi danh thiếp'));
  clickLikeUser(menu);
  const search = await waitFor(() => doc.querySelector<HTMLInputElement>(SEL.cardSearch), 4000, step, sleep, now);
  if (!search) {
    dismiss(doc);
    return fail(ACTION_ERR.noButton('Tìm danh thiếp'));
  }
  const cancel = () => dismiss(doc, SEL.cardCancel);
  const want = fold(card.name);
  // Zalo clears the search box right after the dialog mounts (live check
  // 29/09/2026): a name typed too early is wiped and the list stays unfiltered,
  // so only contacts already in the default list could be found. Type, let it
  // settle, and type again while the box does not hold the name.
  const holdsName = () => fold(doc.querySelector<HTMLInputElement>(SEL.cardSearch)?.value) === want;
  for (let attempt = 0; attempt < CARD_SEARCH_ATTEMPTS && !holdsName(); attempt++) {
    const box = doc.querySelector<HTMLInputElement>(SEL.cardSearch);
    if (!box) break;
    setInputValue(box, card.name);
    await sleep(CARD_SEARCH_SETTLE_MS);
  }
  if (!holdsName()) {
    cancel();
    return fail(ACTION_ERR.cardSearch);
  }
  // Wait for the filtered list to settle on rows with this exact name (and the box still holding it).
  const rows = await waitFor(
    () => {
      if (!holdsName()) return null;
      const r = [...doc.querySelectorAll(SEL.cardItem)].filter((x) => cardRowHasName(x, want));
      return r.length ? r : null;
    },
    5000,
    step,
    sleep,
    now,
  );
  if (!rows || rows.length !== 1) {
    cancel();
    return fail(ACTION_ERR.cardNotFound);
  }
  clickLikeUser(rows[0] as HTMLElement);
  const selected = await waitFor(
    () => {
      const s = doc.querySelector(SEL.cardSelected);
      return s && fold(s.textContent).includes(want) ? s : null;
    },
    3000,
    step,
    sleep,
    now,
  );
  // Exactly one card selected: the counter reads "1/9".
  if (!selected || !/(^|\D)1\/\d+/.test(selected.textContent ?? '')) {
    cancel();
    return fail(ACTION_ERR.cardNotSelected);
  }
  // "Gửi kèm số điện thoại" is ON by default (live check 28/09/2026): set it to what was approved, then verify.
  const phoneBox = () => doc.querySelector<HTMLElement>(SEL.cardPhoneToggle);
  const phoneOn = () => !!phoneBox()?.querySelector('.z-checkbox')?.classList.contains('--active');
  if (!phoneBox()) {
    cancel();
    return fail(ACTION_ERR.phoneToggle);
  }
  if (phoneOn() !== !!card.withPhone) {
    clickLikeUser(phoneBox()!);
    await waitFor(() => (phoneOn() === !!card.withPhone ? true : null), 2000, step, sleep, now);
  }
  if (phoneOn() !== !!card.withPhone) {
    cancel();
    return fail(ACTION_ERR.phoneToggle);
  }
  const share = doc.querySelector<HTMLElement>(SEL.cardShare);
  if (!visible(share)) {
    cancel();
    return fail(ACTION_ERR.noButton('Gửi danh thiếp'));
  }
  const before = outIds(doc, dom);
  clickLikeUser(share);
  const bubble = await waitNewOut(deps, before, 15_000);
  if (!bubble) return { ok: false, error: ACTION_ERR.notConfirmed('danh thiếp'), sentLines: 0 };
  return { ok: true, cliMsgId: bubble.cliMsgId, sentAt: new Date(now()), lines: 1 };
}

// ---- sticker -----------------------------------------------------------------------

/** Thumbnail URL of a sticker panel item (its `.sticker` child's background image). */
export function stickerThumbUrl(item: Element): string | null {
  const el = item.querySelector<HTMLElement>(SEL.stickerThumb) ?? (item as HTMLElement);
  const style = el.getAttribute('style') ?? '';
  const m = /url\((['"]?)(.*?)\1\)/.exec(style);
  return m ? m[2].replace(/&quot;/g, '') : null;
}

/** Closes the sticker panel: Zalo closes it on a click outside (the chat header), Escape is the fallback. */
async function closeStickerPanel(deps: ActionDeps) {
  const { doc, sleep, step } = ctx(deps);
  const open = () => [...doc.querySelectorAll<HTMLElement>(SEL.stickerSection)].some(visible);
  if (!open()) return;
  const header = doc.querySelector<HTMLElement>(SEL.chatHeader);
  if (header) clickLikeUser(header);
  await sleep(step);
  if (open()) dismiss(doc);
}

/**
 * `send_sticker`: open the panel, switch to the approved set, click the item
 * whose thumbnail matches (or the n-th one), and confirm the sticker bubble.
 * Zalo sends at once on the click, so the item is checked before clicking and
 * never clicked twice.
 */
export async function sendSticker(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  const { doc, dom, sleep, now, step } = ctx(deps);
  const want = item.sticker;
  if (!want) return fail('thiếu thông tin sticker');
  const opened = await openConversation(item.threadId, deps);
  if (!opened.ok) return fail(opened.error);

  const button = doc.querySelector<HTMLElement>(SEL.stickerButton);
  if (!visible(button)) return fail(ACTION_ERR.noButton('Gửi Sticker'));
  clickLikeUser(button);
  const section = await waitFor(() => [...doc.querySelectorAll<HTMLElement>(SEL.stickerSection)].find(visible), 4000, step, sleep, now);
  if (!section) return fail(ACTION_ERR.stickerPanel);
  const root = section.closest<HTMLElement>('.popover-v3') ?? section.parentElement ?? section;
  const bail = async (error: string) => {
    await closeStickerPanel(deps);
    return fail(error);
  };

  const wantSet = fold(want.set);
  const tab = [...root.querySelectorAll<HTMLElement>(SEL.stickerSetTab)].find((t) => fold(t.getAttribute('title')) === wantSet);
  if (!tab) return bail(ACTION_ERR.stickerSet(want.set));
  clickLikeUser(tab);
  // The set page renders its items in the same section; wait until it shows this set.
  const items = await waitFor(
    () => {
      const sec = [...doc.querySelectorAll<HTMLElement>(SEL.stickerSection)].find(visible);
      if (!sec || !fold(sec.textContent).includes(wantSet)) return null;
      const list = [...sec.querySelectorAll<HTMLElement>(SEL.stickerItem)].filter(visible);
      return list.length ? list : null;
    },
    4000,
    step,
    sleep,
    now,
  );
  if (!items) return bail(ACTION_ERR.stickerSet(want.set));

  let pick: HTMLElement | undefined;
  if (want.thumbUrl) {
    const matches = items.filter((el) => stickerThumbUrl(el) === want.thumbUrl);
    if (matches.length === 1) pick = matches[0];
  } else {
    pick = items[want.index - 1];
  }
  if (!pick) return bail(ACTION_ERR.stickerItem);

  const before = outIds(doc, dom);
  clickLikeUser(pick);
  const bubble = await waitNewOut(deps, before, 15_000, (el) => detectSticker(el) || !!el.querySelector('.sticker, [data-id$="Msg_Sticker"]'));
  await closeStickerPanel(deps);
  if (!bubble) return { ok: false, error: ACTION_ERR.notConfirmed('sticker'), sentLines: 0 };
  return { ok: true, cliMsgId: bubble.cliMsgId, sentAt: new Date(now()), lines: 1 };
}

// ---- poll --------------------------------------------------------------------------

export async function createPoll(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  const { doc, dom, sleep, now, step } = ctx(deps);
  const poll = item.poll;
  if (!poll) return fail('thiếu nội dung bình chọn');
  const opened = await openConversation(item.threadId, deps);
  if (!opened.ok) return fail(opened.error);

  const more = doc.querySelector<HTMLElement>(SEL.moreMenu);
  if (!visible(more)) return fail(ACTION_ERR.noButton('Tùy chọn thêm'));
  clickLikeUser(more);
  const entry = await waitFor(() => [...doc.querySelectorAll<HTMLElement>(SEL.pollEntry)].find(visible), 3000, step, sleep, now);
  if (!entry) {
    dismiss(doc);
    return fail(ACTION_ERR.noButton('Tạo bình chọn'));
  }
  clickLikeUser(entry);
  const modal = await waitFor(() => (doc.querySelector(SEL.pollCreate) ? openModal(doc) : null), 4000, step, sleep, now);
  const cancel = () => dismiss(doc, SEL.pollCancel);
  if (!modal) {
    dismiss(doc);
    return fail(ACTION_ERR.noButton('Tạo bình chọn'));
  }
  const question = modal.querySelector<HTMLElement>('[contenteditable="true"], .rich-input');
  if (!question) {
    cancel();
    return fail(ACTION_ERR.pollForm);
  }
  insertText(question, poll.question);
  const optionInputs = () => [...modal.querySelectorAll<HTMLInputElement>('input')].filter((i) => /Lựa chọn/i.test(i.placeholder));
  // Zalo starts with two option rows; add the rest.
  for (let i = optionInputs().length; i < poll.options.length; i++) {
    const add = modal.querySelector<HTMLElement>(SEL.pollAddOption);
    if (!add) break;
    clickLikeUser(add);
    await waitFor(() => optionInputs().length > i, 2000, step, sleep, now);
  }
  const inputs = optionInputs();
  if (inputs.length < poll.options.length) {
    cancel();
    return fail(ACTION_ERR.pollForm);
  }
  poll.options.forEach((o, i) => setInputValue(inputs[i], o));
  await sleep(step);
  // Verify the whole form before creating.
  const okForm =
    fold(editorText(question)) === fold(poll.question) &&
    poll.options.every((o, i) => fold(inputs[i].value) === fold(o)) &&
    inputs.slice(poll.options.length).every((i) => !i.value.trim());
  if (!okForm) {
    cancel();
    return fail(ACTION_ERR.pollForm);
  }
  const create = modal.querySelector<HTMLElement>(SEL.pollCreate);
  if (!visible(create)) {
    cancel();
    return fail(ACTION_ERR.noButton('Tạo bình chọn'));
  }
  const before = outIds(doc, dom);
  const want = fold(poll.question);
  const pollsNamed = () => [...doc.querySelectorAll(SEL.pollInChat)].filter((c) => fold(c.querySelector(SEL.pollQuestion)?.textContent) === want).length;
  const pollsBefore = pollsNamed();
  clickLikeUser(create);
  const closed = await waitFor(() => !openModal(doc), 8000, step, sleep, now);
  if (!closed) {
    cancel();
    return fail(ACTION_ERR.pollForm);
  }
  // The poll shows up as a group notice (no bubble id, so no cliMsgId): one more poll with this question.
  const shown = await waitFor(() => (pollsNamed() > pollsBefore ? true : null), 15_000, step, sleep, now);
  if (!shown) {
    // Older layouts rendered polls as a bubble.
    const bubble = await waitNewOut(deps, before, 1000, (el) => fold(el.textContent).includes(want));
    if (!bubble) return { ok: false, error: ACTION_ERR.notConfirmed('bình chọn'), sentLines: 0 };
    return { ok: true, cliMsgId: bubble.cliMsgId, sentAt: new Date(now()), lines: 1 };
  }
  return { ok: true, cliMsgId: null, sentAt: new Date(now()), lines: 1 };
}

// ---- text with @mentions -------------------------------------------------------------

/** Splits text into plain parts and `@Name` parts for the given names (longest names first). */
export function splitMentions(text: string, names: string[]): { text: string; mention?: string }[] {
  const sorted = [...new Set(names)].sort((a, b) => b.length - a.length);
  const out: { text: string; mention?: string }[] = [];
  let rest = text;
  while (rest) {
    let best: { at: number; name: string } | null = null;
    for (const n of sorted) {
      const at = rest.indexOf(`@${n}`);
      if (at >= 0 && (!best || at < best.at)) best = { at, name: n };
    }
    if (!best) {
      out.push({ text: rest });
      break;
    }
    if (best.at > 0) out.push({ text: rest.slice(0, best.at) });
    out.push({ text: `@${best.name}`, mention: best.name });
    rest = rest.slice(best.at + best.name.length + 1);
  }
  return out;
}

export async function sendMentions(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  const { doc, dom, sleep, now, step } = ctx(deps);
  const text = normalizeText(item.text);
  if (/\n/.test(text)) return fail(ACTION_ERR.mentionMultiline);
  const opened = await openConversation(item.threadId, deps);
  if (!opened.ok) return fail(opened.error);
  // Zalo re-renders #richInput while a mention is picked: always use the current element.
  const cur = () => doc.querySelector<HTMLElement>(SEL.input);
  const first = await findComposer(doc, { step, sleep, now });
  if (!first) return fail(ERR.noInput);
  if (editorText(first)) return fail(ACTION_ERR.inputBusy);
  const input = () => cur() ?? first;

  const parts = splitMentions(text, (item.mentions ?? []).map((m) => m.name));
  let afterMention = false;
  for (const [i, p] of parts.entries()) {
    if (!p.mention) {
      // Zalo adds a space after a picked mention: do not type a second one.
      const t = afterMention && p.text.startsWith(' ') ? p.text.slice(1) : p.text;
      if (t) appendText(input(), t);
      afterMention = false;
      continue;
    }
    // Zalo opens its @ list on a lone "@" (not when "@Name" is inserted at once); the name then filters it.
    appendText(input(), '@');
    await waitFor(() => doc.querySelector(SEL.mentionItem), 3000, step, sleep, now);
    appendText(input(), p.mention);
    const want = fold(p.mention);
    const lower = want.toLowerCase();
    // Pick only once the list is filtered by the typed name (the unfiltered list already has the row;
    // picking then makes Zalo replace just the "@" and leave the name behind as text).
    const row = await waitFor(
      () => {
        const rows = [...doc.querySelectorAll<HTMLElement>(SEL.mentionItem)];
        if (!rows.every((r) => fold(r.getAttribute('title')).toLowerCase().includes(lower))) return null;
        return rows.find((r) => fold(r.getAttribute('title')) === want) ?? null;
      },
      3000,
      step,
      sleep,
      now,
    );
    if (!row) {
      clearInput(input());
      return fail(ACTION_ERR.mentionNotFound(p.mention));
    }
    clickLikeUser(row);
    const chip = await waitFor(
      () => [...input().querySelectorAll(SEL.mentionChip)].find((c) => fold(c.getAttribute('data-mention')) === fold(`@${p.mention}`)),
      2000,
      step,
      sleep,
      now,
    );
    if (!chip) {
      clearInput(input());
      return fail(ACTION_ERR.mentionNotFound(p.mention));
    }
    afterMention = true;
    // "@Name, ..." (no space in the approved text): remove the space Zalo added after the chip.
    const next = parts[i + 1];
    if (next && !next.mention && next.text && !next.text.startsWith(' ')) {
      backspaceAtEnd(input());
      afterMention = false;
    }
  }

  // Exact check before Enter: same text and one chip per mention, in order.
  const chips = [...input().querySelectorAll(SEL.mentionChip)].map((c) => fold(c.getAttribute('data-mention')));
  const wantChips = parts.filter((p) => p.mention).map((p) => fold(`@${p.mention}`));
  if (fold(editorText(input())) !== fold(text) || chips.join('|') !== wantChips.join('|')) {
    clearInput(input());
    return fail(ACTION_ERR.mentionMismatch);
  }
  // Zalo applies typed pieces asynchronously: an immediate Enter can be ignored (live check 28/09/2026).
  await sleep(ENTER_SETTLE_MS);
  const before = outIds(doc, dom);
  await submitComposer(doc, input(), { step, sleep, now });
  const cleared = await waitFor(() => (editorText(input()) ? null : true), deps.timing?.inputClearTimeoutMs ?? 3000, step, sleep, now);
  if (!cleared) {
    // Never leave an approved text sitting in the composer.
    clearInput(input());
    return fail(ERR.notSent);
  }
  const bubble = await waitNewOut(deps, before, deps.timing?.confirmTimeoutMs ?? 10_000);
  if (!bubble) return { ok: false, error: ACTION_ERR.notConfirmed('tin'), sentLines: 0 };
  return { ok: true, cliMsgId: bubble.cliMsgId, sentAt: new Date(now()), lines: 1 };
}

/** Routes an approved outbox item to the right driver. */
/**
 * `react`: hover the message, hover its reaction button so Zalo shows the picker,
 * click the icon whose code matches, confirm the reaction list on the bubble.
 * The button itself is never clicked: that would apply the default icon.
 */
export async function reactToMessage(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  const { doc, dom, sleep, now, step } = ctx(deps);
  const r = item.reaction;
  if (!r) return fail('thiếu thông tin cảm xúc');
  const code = REACTION_CODE[r.icon];
  if (!code) return fail(ACTION_ERR.reactIcon(r.icon));
  const opened = await openConversation(item.threadId, deps);
  if (!opened.ok) return fail(opened.error);
  const bubble = findBubble(doc, dom, r.cliMsgId);
  if (!bubble) return fail(ACTION_ERR.reactTarget);
  bubble.scrollIntoView?.({ block: 'center' });
  // Zalo's own reaction list, before: the click must change it (a bubble may already carry reactions).
  const reactState = () => {
    const list = bubble.querySelector(SEL.reactList);
    return list ? `${list.className}|${list.querySelectorAll('.react-icon').length}|${fold(list.querySelector('.total-reacts')?.textContent)}` : '';
  };
  const before = reactState();
  hoverLikeUser(bubble.querySelector<HTMLElement>('.message-content-wrapper') ?? bubble);
  const button = await waitFor(() => bubble.querySelector<HTMLElement>(SEL.reactButton), 2000, step, sleep, now);
  if (!button) return fail(ACTION_ERR.reactPicker);
  hoverLikeUser(button);
  const icon = await waitFor(
    () => {
      const picker = [...doc.querySelectorAll<HTMLElement>(SEL.reactPicker)].find(visible);
      if (!picker) return null;
      return [...picker.querySelectorAll<HTMLElement>(SEL.reactIcon)].find((i) => fold(i.textContent) === code) ?? null;
    },
    3000,
    step,
    sleep,
    now,
  );
  if (!icon) {
    const picker = [...doc.querySelectorAll<HTMLElement>(SEL.reactPicker)].find(visible);
    return fail(picker ? ACTION_ERR.reactIcon(code) : ACTION_ERR.reactPicker);
  }
  clickLikeUser(icon);
  const changed = await waitFor(() => (reactState() !== before && reactState() !== '' ? true : null), 4000, step, sleep, now);
  if (!changed) return fail(ACTION_ERR.reactNotShown);
  return { ok: true, cliMsgId: r.cliMsgId, sentAt: new Date(now()), lines: 0 };
}

/**
 * `pin_conversation` / `mark_read` / `mark_unread`: the sidebar item's own
 * "Thêm" menu. When Zalo already shows the wanted state (the menu offers the
 * opposite action), nothing is clicked and the command counts as done.
 */
export async function setConversationState(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  const { doc, sleep, now, step } = ctx(deps);
  const want =
    item.action === 'pin_conversation'
      ? { click: item.pin === false ? CONV_MENU.unpin : CONV_MENU.pin, already: item.pin === false ? CONV_MENU.pin : CONV_MENU.unpin }
      : item.action === 'mark_unread'
        ? { click: CONV_MENU.markUnread, already: CONV_MENU.markRead }
        : { click: CONV_MENU.markRead, already: CONV_MENU.markUnread };
  const located = await locateThreadItem(item.threadId, deps);
  if (!located.ok) return fail(located.error);
  if (!located.item) return fail(ACTION_ERR.convItem);
  const el = located.item.el;
  el.scrollIntoView?.({ block: 'nearest' });
  hoverLikeUser(el);
  const more = await waitFor(() => el.querySelector<HTMLElement>(SEL.convMore), 2000, step, sleep, now);
  if (!more) return fail(ACTION_ERR.convMenu);
  clickLikeUser(more);
  const items = await waitFor(
    () => {
      const rows = [...doc.querySelectorAll<HTMLElement>(SEL.popoverItem)].filter(visible);
      return rows.length ? rows : null;
    },
    3000,
    step,
    sleep,
    now,
  );
  if (!items) return fail(ACTION_ERR.convMenu);
  const byText = (label: string) => items.find((row) => fold(row.textContent).startsWith(fold(label)));
  const target = byText(want.click);
  if (!target) {
    dismiss(doc);
    // Zalo offers the opposite action only when the wanted state already holds.
    if (byText(want.already)) return { ok: true, cliMsgId: null, sentAt: new Date(now()), lines: 0 };
    return fail(ACTION_ERR.convMenuItem(want.click));
  }
  clickLikeUser(target);
  await sleep(ENTER_SETTLE_MS);
  // Verify from the item when Zalo exposes the state there (pin icon, unread badge).
  // Zalo re-renders the virtual list (a pinned item moves to the top), so the
  // item is looked up again for every check instead of trusting `el`.
  const current = () => doc.querySelector<HTMLElement>(`[${(deps.dom ?? DEFAULT_DOM_SELECTORS).threadIdAttr}="${located.item!.id}"]`) ?? el;
  const check =
    item.action === 'pin_conversation'
      ? () => !!current().querySelector(SEL.convPinned) === (item.pin !== false)
      : item.action === 'mark_unread'
        ? () => !!current().querySelector(SEL.convUnread)
        : () => !current().querySelector(SEL.convUnread);
  const applied = await waitFor(() => (check() ? true : null), 5000, step, sleep, now);
  if (!applied) return fail(ACTION_ERR.convNotApplied(want.click));
  return { ok: true, cliMsgId: null, sentAt: new Date(now()), lines: 0 };
}

export function sendOutboxItem(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  switch (item.action) {
    case 'react':
      return reactToMessage(item, deps);
    case 'pin_conversation':
    case 'mark_read':
    case 'mark_unread':
      return setConversationState(item, deps);
    case 'friend_accept':
    case 'friend_reject':
    case 'friend_request':
      return sendFriendCommand(item, deps);
    case 'send_images':
    case 'send_file':
      return sendFiles(item, deps);
    case 'send_quote':
      return sendQuote(item, deps);
    case 'send_card':
      return sendCard(item, deps);
    case 'send_sticker':
      return sendSticker(item, deps);
    case 'create_poll':
      return createPoll(item, deps);
    default:
      return item.mentions?.length ? sendMentions(item, deps) : sendToThread(item.threadId, item.text, deps);
  }
}
