import { FRIEND_TARGET_BLOCKED, friendTargetAllowed, type OutboxItem } from '@vclinks/shared';
import { clickLikeUser, normalizeText, realSleep, waitFor } from './compose';
import { STAMP_ATTR, STAMP_EVENT } from './contact-id-stamp';
import { REQUEST_BUTTON_TEXT, REQUEST_SELECTORS, findRequestScroller, openFriendRequestsPage } from './friend-request-reader';
import type { ActionDeps } from './sender-actions';
import type { SendOutcome } from './sender';

/**
 * Friend-request commands (M1a-04, MH-SZ-10, QT-SZ-12), driven through Zalo
 * Web's own UI like the other outbox commands (sender-actions.ts):
 *
 * | Command        | Zalo Web UI                                                                       |
 * |----------------|-----------------------------------------------------------------------------------|
 * | friend_accept  | Danh bạ → "Lời mời kết bạn" → the request card → button "Đồng ý"                  |
 * | friend_reject  | same page → button "Từ chối" (a confirm dialog, if any, is confirmed)             |
 * | friend_request | sidebar `btn_Main_AddFrd` → `#FIND_FRIEND` → phone → "Tìm kiếm" → "Kết bạn" → greeting |
 *
 * The page of the requests and the "Thêm bạn" dialog were surveyed on the live
 * app on 04/10/2026; the step after pressing "Kết bạn" (the greeting dialog) is
 * written defensively and is verified in the real test. On any doubt the dialog
 * is closed and a short Vietnamese reason is reported; nothing is ever sent twice.
 * The sender never opens the new friend's conversation: the greeting of an
 * accepted request is a separate, approved `send_text` command made by the API.
 */

const SEL = {
  addFriend: '[data-id="btn_Main_AddFrd"]',
  dialog: '#FIND_FRIEND',
  phone: '[data-id="txt_Main_AddFrd_Phone"]',
  search: '[data-id="btn_Main_AddFrd_Search"]',
  cancel: '[data-id="btn_Main_AddFrd_CXL"]',
  close: '.modal-header-icon',
  modal: '.zl-modal__dialog',
  button: '.z--btn--v2',
  /** Profile page Zalo shows for a searched number (surveyed 04/10/2026): its buttons live in `.pi-primary-action-section`. */
  profile: '.pi-info-layout',
  profileActions: '.pi-primary-action-section',
  /** "Có thể bạn quen" entries: never pressed. */
  suggestion: '.find-friend-suggestion-item',
} as const;

export const FRIEND_ERR = {
  noPage: 'không mở được trang Lời mời kết bạn của Zalo Web',
  rowNotFound: 'không thấy lời mời này trên trang Lời mời kết bạn (có thể đã được xử lý trên điện thoại)',
  nameMismatch: 'tên trên lời mời không khớp bản đã duyệt, không bấm',
  noButton: (what: string) => `không thấy nút "${what}" trên lời mời`,
  notDone: 'Zalo chưa đổi trạng thái sau khi bấm (lời mời vẫn còn), kiểm tra trên Zalo trước khi thử lại',
  dialog: 'Zalo hiện hộp thoại chưa biết sau khi bấm, đã đóng và không làm tiếp',
  noAddButton: 'không thấy nút "Thêm bạn" trên Zalo Web',
  noPhoneInput: 'không thấy ô số điện thoại của hộp "Thêm bạn"',
  noResult: 'Zalo không trả kết quả tìm số điện thoại',
  notFound: 'số này chưa đăng ký Zalo hoặc người dùng không cho tìm bằng số điện thoại',
  alreadyFriend: 'đã là bạn bè trên Zalo, không gửi lời mời',
  noSendButton: 'không thấy nút "Kết bạn" trên kết quả tìm kiếm',
  notConfirmed: 'không xác nhận được lời mời đã gửi — kiểm tra trên Zalo trước khi gửi lại',
} as const;

const fold = (s: string | null | undefined) => normalizeText(s).replace(/\s+/g, ' ').normalize('NFC').toLowerCase();
const visible = (el: Element | null | undefined): el is HTMLElement => !!el && (el as HTMLElement).getClientRects?.().length > 0;
const label = (el: Element) => fold((el as HTMLElement).innerText ?? el.textContent);
const foldAscii = (s: string) => fold(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
/** A button of the searched profile's own action section (never one of the suggestions). */
function profileButton(root: ParentNode, text: string): HTMLElement | null {
  for (const section of root.querySelectorAll<HTMLElement>(SEL.profileActions)) {
    if (section.closest(SEL.suggestion)) continue;
    const b = buttonByText(section, text);
    if (b) return b;
  }
  return null;
}
const failure = (error: string): SendOutcome => ({ ok: false, error, sentLines: 0 });
const done = (now: () => number): SendOutcome => ({ ok: true, cliMsgId: null, sentAt: new Date(now()), lines: 0 });

function env(deps: ActionDeps) {
  return {
    doc: deps.doc,
    sleep: deps.sleep ?? realSleep,
    now: deps.now ?? Date.now,
    step: deps.timing?.pollStepMs ?? 150,
  };
}

/** Button of a request card / dialog by its exact visible text. */
function buttonByText(root: ParentNode, text: string): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>(SEL.button)].find((b) => visible(b) && label(b) === fold(text)) ?? null;
}

/**
 * The received request card of `userId`: matched by the id the MAIN-world
 * helper stamps on the card, so two people with the same name never mix. The
 * page is expanded ("Xem thêm") and walked until the card shows.
 */
async function findReceivedRow(item: OutboxItem, deps: ActionDeps): Promise<HTMLElement | null> {
  const { doc, sleep, now, step } = env(deps);
  const userId = item.friend?.userId ?? '';
  const stampAll = () => doc.dispatchEvent(new CustomEvent(STAMP_EVENT));
  const probe = () => {
    stampAll();
    return [...doc.querySelectorAll<HTMLElement>(REQUEST_SELECTORS.receivedRow)].find((r) => r.getAttribute(STAMP_ATTR) === userId) ?? null;
  };
  const found = await waitFor(probe, 2500, step, sleep, now);
  if (found) return found;
  for (let i = 0; i < 15; i++) {
    const more = [...doc.querySelectorAll<HTMLElement>(REQUEST_SELECTORS.viewMore)].find(visible);
    if (!more) break;
    clickLikeUser(more);
    await sleep(400);
    const hit = probe();
    if (hit) return hit;
  }
  const scroller = findRequestScroller(doc);
  if (!scroller) return probe();
  for (let pos = 0, i = 0; i < 200; i++) {
    scroller.scrollTop = pos;
    await sleep(250);
    const hit = probe();
    if (hit) return hit;
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (pos >= max) break;
    pos = Math.min(pos + Math.max(Math.floor(scroller.clientHeight * 0.8), 40), max);
  }
  return null;
}

/** Closes a dialog the command opened: its close icon / cancel button, else Escape. */
function dismiss(doc: Document) {
  const modal = [...doc.querySelectorAll<HTMLElement>(SEL.modal)].find(visible);
  const close = modal?.querySelector<HTMLElement>(SEL.close) ?? modal?.querySelector<HTMLElement>(SEL.cancel);
  if (close) clickLikeUser(close);
  const target = doc.activeElement ?? doc.body;
  for (const type of ['keydown', 'keyup'] as const) {
    target.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  }
}

/** `friend_accept` / `friend_reject`: press the request card's button and see the card leave the list. */
async function answerRequest(item: OutboxItem, deps: ActionDeps, accept: boolean): Promise<SendOutcome> {
  const { doc, sleep, now, step } = env(deps);
  const friend = item.friend;
  if (!friend?.userId || !friend.name) return failure('thiếu thông tin lời mời');
  const opened = await openFriendRequestsPage({ doc, sleep });
  if (!opened.ok) return failure(opened.error || FRIEND_ERR.noPage);
  try {
    const row = await findReceivedRow(item, deps);
    if (!row) return failure(FRIEND_ERR.rowNotFound);
    if (fold(row.querySelector(REQUEST_SELECTORS.name)?.textContent) !== fold(friend.name)) return failure(FRIEND_ERR.nameMismatch);
    const text = accept ? REQUEST_BUTTON_TEXT.accept : REQUEST_BUTTON_TEXT.reject;
    const button = buttonByText(row, text);
    if (!button) return failure(FRIEND_ERR.noButton(text));
    row.scrollIntoView?.({ block: 'nearest' });
    clickLikeUser(button);
    const leftList = () => ![...doc.querySelectorAll(REQUEST_SELECTORS.receivedRow)].some((r) => r.getAttribute(STAMP_ATTR) === friend.userId);
    // Zalo may open a dialog right after the press (seen live 04/10/2026 after Đồng ý, while the request is
    // already accepted). A reject may ask "are you sure": confirm it (the person already approved the command).
    // After Đồng ý the dialog is only dismissed, or, when it offers a text box and an alias was approved,
    // the alias is typed and saved. The proof of success is always the card leaving the list.
    const settled = await waitFor(() => leftList() || [...doc.querySelectorAll<HTMLElement>(SEL.modal)].find(visible) || null, 4000, step, sleep, now);
    if (settled && settled !== true) {
      const buttons = [...settled.querySelectorAll<HTMLElement>(SEL.button)].filter(visible);
      if (!accept) {
        const confirm = buttons.find((b) => ['từ chối', 'xác nhận', 'đồng ý'].includes(label(b)));
        if (!confirm) {
          dismiss(doc);
          return failure(FRIEND_ERR.dialog);
        }
        clickLikeUser(confirm);
      } else {
        const box = settled.querySelector<HTMLInputElement>('input[type="text"], input:not([type])');
        const save = buttons.find((b) => ['lưu', 'xác nhận', 'hoàn tất', 'ok', 'đồng ý'].includes(label(b)));
        if (box && friend.alias && save) {
          setValue(box, friend.alias);
          await sleep(300);
          clickLikeUser(save);
          await sleep(600);
        }
        dismiss(doc);
      }
    }
    const gone = await waitFor(() => leftList() || null, 8000, step, sleep, now);
    if (!gone) return failure(FRIEND_ERR.notDone);
    return done(now);
  } finally {
    opened.restore();
  }
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.focus();
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** `friend_request`: "Thêm bạn" dialog → phone → search → "Kết bạn" → greeting → confirm. */
async function sendRequest(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  const { doc, sleep, now, step } = env(deps);
  const friend = item.friend;
  if (!friend?.phone) return failure('thiếu số điện thoại');
  const add = doc.querySelector<HTMLElement>(SEL.addFriend);
  if (!add || !visible(add)) return failure(FRIEND_ERR.noAddButton);
  clickLikeUser(add);
  const dialog = await waitFor(() => doc.querySelector<HTMLElement>(SEL.dialog), 4000, step, sleep, now);
  const input = dialog?.querySelector<HTMLInputElement>(SEL.phone);
  if (!dialog || !input) {
    dismiss(doc);
    return failure(FRIEND_ERR.noPhoneInput);
  }
  try {
    setValue(input, friend.phone);
    await sleep(300);
    const search = dialog.querySelector<HTMLElement>(SEL.search);
    if (!search) return failure('không thấy nút "Tìm kiếm" của hộp "Thêm bạn"');
    clickLikeUser(search);
    // The result replaces the search form (the phone input leaves the dialog). Until then the dialog still
    // offers "Có thể bạn quen" with its own "Kết bạn" buttons, which must never be pressed (they would
    // send a request to a stranger). Only the profile's own action section counts.
    const outcome = await waitFor(
      () => {
        const d = doc.querySelector<HTMLElement>(SEL.dialog);
        if (!d) return null;
        const plain = foldAscii(label(d));
        if (/chua dang ky|khong tim thay|khong ton tai|khong cho phep tim/.test(plain)) return 'notfound' as const;
        if (d.querySelector(SEL.phone) || !d.querySelector(SEL.profile)) return null;
        if (profileButton(d, 'Kết bạn')) return 'addable' as const;
        if (profileButton(d, 'Nhắn tin')) return 'friend' as const;
        return null;
      },
      12_000,
      step,
      sleep,
      now,
    );
    if (!outcome) return failure(FRIEND_ERR.noResult);
    if (outcome === 'notfound') return failure(FRIEND_ERR.notFound);
    if (outcome === 'friend') return failure(FRIEND_ERR.alreadyFriend);
    const addBtn = profileButton(dialog, 'Kết bạn');
    if (!addBtn) return failure(FRIEND_ERR.noSendButton);
    clickLikeUser(addBtn);
    // Zalo may ask for a greeting in a second dialog (survey of the real step pending): fill it, then confirm.
    await sleep(900);
    const greetBox = [...doc.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('.zl-modal__dialog textarea, .zl-modal__dialog input[type="text"]')].find(
      (e) => visible(e) && !e.matches(SEL.phone) && !e.closest(SEL.suggestion),
    );
    if (greetBox && friend.greeting) {
      setValue(greetBox, friend.greeting);
      await sleep(250);
    }
    if (greetBox) {
      const modal = greetBox.closest<HTMLElement>(SEL.modal);
      const confirm = modal && [...modal.querySelectorAll<HTMLElement>(SEL.button)].filter((b) => visible(b) && !b.closest(SEL.suggestion) && label(b) === 'kết bạn').pop();
      if (!confirm) return failure(FRIEND_ERR.noSendButton);
      clickLikeUser(confirm);
    }
    // Success needs positive evidence: the profile no longer offers "Kết bạn" and offers withdrawing instead.
    const sent = await waitFor(
      () => {
        const d = doc.querySelector<HTMLElement>(SEL.dialog);
        if (!d || profileButton(d, 'Kết bạn')) return null;
        return [...d.querySelectorAll<HTMLElement>(`${SEL.profile} ${SEL.button}`)].some((b) => /thu hoi|huy (loi moi|yeu cau)|da gui/.test(foldAscii(label(b)))) || null;
      },
      8000,
      step,
      sleep,
      now,
    );
    if (!sent) return failure(FRIEND_ERR.notConfirmed);
    return done(now);
  } finally {
    await closeFindDialog(doc, sleep);
  }
}

/**
 * Closes "Thêm bạn": on a profile page the header has a back arrow before the
 * close icon (seen live 04/10/2026: pressing the first icon only went back to
 * the search form), so the last icon is pressed, repeated until it is gone.
 */
async function closeFindDialog(doc: Document, sleep: (ms: number) => Promise<void>) {
  for (let i = 0; i < 3; i++) {
    const d = doc.querySelector<HTMLElement>(SEL.dialog);
    if (!d) return;
    const icons = [...d.querySelectorAll<HTMLElement>(SEL.close)].filter(visible);
    const last = icons[icons.length - 1];
    if (last) clickLikeUser(last);
    else dismiss(doc);
    await sleep(500);
  }
}

export async function sendFriendCommand(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  // Second check, independent of the API: without an allowlist entry matching this very person nothing is pressed.
  if (!friendTargetAllowed(deps.friendTargets, { userId: item.friend?.userId, phone: item.friend?.phone })) return failure(FRIEND_TARGET_BLOCKED);
  return dispatchFriend(item, deps);
}

function dispatchFriend(item: OutboxItem, deps: ActionDeps): Promise<SendOutcome> {
  switch (item.action) {
    case 'friend_accept':
      return answerRequest(item, deps, true);
    case 'friend_reject':
      return answerRequest(item, deps, false);
    default:
      return sendRequest(item, deps);
  }
}
