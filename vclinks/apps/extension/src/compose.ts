/**
 * Channel-neutral helpers for typing an approved message into a web chat's
 * compose box like a human: shared by the Zalo sender (sender.ts) and the
 * Messenger sender (messenger/sender.ts). Pure DOM, no chrome.*.
 *
 * Rules (docs/04-ky-thuat/zalo-web/zalo-web-extraction.md §7): no synthetic keys while composing,
 * text goes in with execCommand('insertText'), the box is compared 100% with
 * the approved text before Enter, and Enter is pressed exactly once.
 */

export const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Normalisation used on both sides of every text comparison. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\r/g, '')
    .trim();
}

/** One message per non-empty line (synthetic line breaks are unreliable in chat editors). */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => normalizeText(l))
    .filter((l) => l.length > 0);
}

export async function waitFor<T>(
  fn: () => T | null | undefined | false,
  timeoutMs: number,
  step: number,
  sleep: (ms: number) => Promise<void>,
  now: () => number,
): Promise<T | null> {
  const end = now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (now() >= end) return null;
    await sleep(step);
  }
}

/**
 * Pointer + mouse sequence at the element's centre. Zalo's dialogs (e.g. the
 * name-card picker) close on a press without pointer events / coordinates,
 * treating it as a click outside (live check 28/09/2026).
 */
export function clickLikeUser(el: HTMLElement) {
  const view = el.ownerDocument.defaultView ?? undefined;
  const r = el.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, view, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  const Pointer = (view as (Window & typeof globalThis) | undefined)?.PointerEvent;
  const pointer = (type: string) => {
    if (Pointer) el.dispatchEvent(new Pointer(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  };
  pointer('pointerdown');
  el.dispatchEvent(new MouseEvent('mousedown', init));
  pointer('pointerup');
  el.dispatchEvent(new MouseEvent('mouseup', init));
  el.dispatchEvent(new MouseEvent('click', init));
}

export function selectAllIn(el: HTMLElement) {
  const doc = el.ownerDocument;
  const sel = doc.getSelection();
  if (!sel) return;
  const range = doc.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Visible text of an editable element (innerText in a real browser, textContent in happy-dom). */
export function editorText(input: HTMLElement): string {
  return normalizeText(input.innerText ?? input.textContent);
}

/** Clears the compose box via the editor's own delete command. */
export function clearInput(input: HTMLElement) {
  input.focus();
  selectAllIn(input);
  input.ownerDocument.execCommand('delete', false);
  if (editorText(input)) {
    // Fallback so a rejected draft can never be sent later by the user's Enter.
    input.replaceChildren();
  }
}

/** Replaces the (empty) box content with `line` through the editor's insertText command. */
export function insertText(input: HTMLElement, line: string) {
  input.focus();
  selectAllIn(input);
  input.ownerDocument.execCommand('insertText', false, line);
}

/** Puts the caret at the end of the last line's text (Zalo ignores input placed after its line <div>s). */
function caretAtEnd(input: HTMLElement) {
  input.focus();
  const doc = input.ownerDocument;
  const sel = doc.getSelection();
  if (!sel) return;
  const range = doc.createRange();
  let n: Node = input;
  while (n.lastChild && n.lastChild.nodeName !== 'BR') n = n.lastChild;
  if (n.lastChild?.nodeName === 'BR') range.setStartBefore(n.lastChild);
  else if (n.nodeType === Node.TEXT_NODE) range.setStart(n, (n as Text).length);
  else {
    range.selectNodeContents(n);
    range.collapse(false);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Types `text` at the end of the editor, keeping what is already there (mentions are built piece by piece). */
export function appendText(input: HTMLElement, text: string) {
  caretAtEnd(input);
  input.ownerDocument.execCommand('insertText', false, text);
}

/** One Backspace at the end of the editor. */
export function backspaceAtEnd(input: HTMLElement) {
  caretAtEnd(input);
  input.ownerDocument.execCommand('delete');
}

export function pressEnterOnce(input: HTMLElement) {
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    const ev = new KeyboardEvent(type, {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    // keyCode/which are not settable through the init dict in Chrome.
    Object.defineProperty(ev, 'keyCode', { get: () => 13 });
    Object.defineProperty(ev, 'which', { get: () => 13 });
    input.dispatchEvent(ev);
  }
}
