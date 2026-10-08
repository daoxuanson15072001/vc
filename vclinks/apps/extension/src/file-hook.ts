/**
 * MAIN-world hook on chat.zalo.me (manifest `world: "MAIN"`, document_start).
 *
 * Zalo Web's "Gửi hình ảnh" / "Chọn File" buttons create an
 * `<input type="file">` and call `.click()` on it, which opens the OS file
 * picker. The content script cannot reach that picker, so it "arms" this hook
 * with the approved files first; the next file-input click then receives them
 * (`input.files` + `change`) instead of opening the picker. Verified on the live
 * Zalo Web 28/09/2026: the photo is sent right away, a file likewise.
 *
 * Safety: one shot, expires after ARM_TTL_MS, and refuses when the input's
 * `accept` list does not allow every file (reported back, nothing is set).
 * Talks to the content script with window.postMessage only; carries no text.
 */

export const HOOK_SOURCE = 'vclinks-file-hook';
export const CS_SOURCE = 'vclinks-content';
export const ARM_TTL_MS = 10_000;

export interface ArmFilesMessage {
  source: typeof CS_SOURCE;
  type: 'arm-files';
  nonce: string;
  files: { name: string; type: string; buffer: ArrayBuffer }[];
}

export type HookReply =
  | { source: typeof HOOK_SOURCE; type: 'armed'; nonce: string }
  | { source: typeof HOOK_SOURCE; type: 'consumed'; nonce: string; count: number; accept: string; multiple: boolean }
  | { source: typeof HOOK_SOURCE; type: 'refused'; nonce: string; reason: string }
  | { source: typeof HOOK_SOURCE; type: 'expired'; nonce: string };

/** True when every file name is allowed by an `accept` attribute (".png, .jpg, image/*"; empty = any). */
export function acceptAllows(accept: string, files: { name: string; type: string }[]): boolean {
  const rules = accept
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (!rules.length) return true;
  return files.every((f) => {
    const name = f.name.toLowerCase();
    const type = f.type.toLowerCase();
    return rules.some((r) =>
      r.startsWith('.') ? name.endsWith(r) : r.endsWith('/*') ? type.startsWith(r.slice(0, -1)) : type === r,
    );
  });
}

const INSTALLED = Symbol.for('vclinks.fileHook');

export function installFileHook(win: Window & typeof globalThis): void {
  // May run twice (manifest + on-demand injection by the background): keep one hook.
  const flag = win as unknown as Record<symbol, boolean>;
  if (flag[INSTALLED]) return;
  Object.defineProperty(win, INSTALLED, { value: true });
  const proto = win.HTMLInputElement.prototype;
  const origClick = proto.click;
  let armed: { msg: ArmFilesMessage; timer: ReturnType<typeof setTimeout> } | null = null;
  const reply = (r: HookReply) => win.postMessage(r, win.location.origin);

  win.addEventListener('message', (ev: MessageEvent) => {
    if (ev.source !== win) return;
    const msg = ev.data as ArmFilesMessage | undefined;
    if (!msg || msg.source !== CS_SOURCE || msg.type !== 'arm-files' || !Array.isArray(msg.files)) return;
    if (armed) clearTimeout(armed.timer);
    const timer = setTimeout(() => {
      if (armed?.msg.nonce === msg.nonce) {
        armed = null;
        reply({ source: HOOK_SOURCE, type: 'expired', nonce: msg.nonce });
      }
    }, ARM_TTL_MS);
    armed = { msg, timer };
    reply({ source: HOOK_SOURCE, type: 'armed', nonce: msg.nonce });
  });

  proto.click = function (this: HTMLInputElement) {
    if (this.type !== 'file' || !armed) return origClick.call(this);
    const { msg, timer } = armed;
    armed = null;
    clearTimeout(timer);
    const files = msg.files.map((f) => new win.File([f.buffer], f.name, { type: f.type }));
    if (!acceptAllows(this.accept, files)) {
      reply({ source: HOOK_SOURCE, type: 'refused', nonce: msg.nonce, reason: `accept=${this.accept}` });
      return;
    }
    if (files.length > 1 && !this.multiple) {
      reply({ source: HOOK_SOURCE, type: 'refused', nonce: msg.nonce, reason: 'multiple not allowed' });
      return;
    }
    const dt = new win.DataTransfer();
    for (const f of files) dt.items.add(f);
    this.files = dt.files;
    this.dispatchEvent(new win.Event('input', { bubbles: true }));
    this.dispatchEvent(new win.Event('change', { bubbles: true }));
    reply({ source: HOOK_SOURCE, type: 'consumed', nonce: msg.nonce, count: files.length, accept: this.accept, multiple: this.multiple });
  };
}
