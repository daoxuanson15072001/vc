/*
 * Panels next to the chat (e.g. Tra hàng, M1c-01) put text into the compose box without touching ChatPane
 * state: a window event the mounted Composer listens to. This only fills the box; sending stays a separate
 * action by a person (CLAUDE.md §12.1).
 */
export const COMPOSER_INSERT_EVENT = 'vclinks:composer-insert';

export function insertIntoComposer(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(COMPOSER_INSERT_EVENT, { detail: text }));
}

/*
 * "Gửi báo giá" (M1c-02): the quote tab of the side panel asks the send box (owned by the composer tools, which
 * know the sending nick and the template variables) to open on a given quote. Opening the box sends nothing:
 * only the "Gửi báo giá" button inside it does, and that click is the approval (CLAUDE.md §12.1).
 */
export const OPEN_SEND_QUOTE_EVENT = 'vclinks:open-send-quote';

export function openSendQuote(no?: string): void {
  window.dispatchEvent(new CustomEvent<{ no?: string }>(OPEN_SEND_QUOTE_EVENT, { detail: { no } }));
}
