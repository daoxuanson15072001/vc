/*
 * "Đang soạn tin…" (direct nicks, realtime `typing`): RealtimeBridge turns the server event into a window event the
 * open chat listens to; a new message of that conversation ends it. Ids only (CLAUDE.md §12.3).
 */
export const TYPING_EVENT = 'vclinks:typing';

export interface TypingDetail {
  uid: string;
  threadId: string;
  /** Zalo uid of whoever types (groups: to name them). */
  who?: string;
  /** The conversation got a message: stop showing it. */
  stop?: boolean;
}

/** How long the line stays after the last typing event (Zalo sends one every few seconds while typing). */
export const TYPING_SHOW_MS = 6000;

export function emitTyping(detail: TypingDetail): void {
  window.dispatchEvent(new CustomEvent<TypingDetail>(TYPING_EVENT, { detail }));
}

/** The header line: 1-1 "Đang soạn tin…"; group "<name> đang soạn tin…" (or "Có người" when the name is unknown). */
export function typingText(isGroup: boolean, name?: string | null): string {
  if (!isGroup) return 'Đang soạn tin…';
  return `${name?.trim() || 'Có người'} đang soạn tin…`;
}
