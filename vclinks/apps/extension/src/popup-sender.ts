import type { SenderStatus } from './sender';
import { SENDER_KEYS, readSenderConfig, type SenderConfig } from './sender-config';
import { STORAGE_KEYS } from './status';

/** Popup section "Gửi tin từ Dashboard": toggle + account, and the sender's status. */

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

function fmt(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
}

async function knownUids(): Promise<string[]> {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all)
    .filter((k) => k.startsWith(STORAGE_KEYS.accountPrefix))
    .map((k) => k.slice(STORAGE_KEYS.accountPrefix.length))
    .sort();
}

async function render() {
  const enabledEl = byId<HTMLInputElement>('sender-enabled');
  const uidEl = byId<HTMLSelectElement>('sender-uid');
  const msgEl = byId('sender-msg');
  if (!enabledEl || !uidEl || !msgEl) return;
  const cfg = await readSenderConfig();
  const uids = await knownUids();
  if (cfg.uid && !uids.includes(cfg.uid)) uids.unshift(cfg.uid);

  enabledEl.checked = cfg.enabled;
  uidEl.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = uids.length ? '— Chọn tài khoản —' : '— Chưa có tài khoản (hãy đồng bộ trước) —';
  uidEl.append(none);
  for (const [i, u] of uids.entries()) {
    const o = document.createElement('option');
    o.value = u;
    // Never show the raw uid to the user (03 MH-SZ-12a): number the nicks instead.
    o.textContent = `Nick Zalo số ${i + 1}`;
    uidEl.append(o);
  }
  uidEl.value = cfg.uid ?? '';

  const got = await chrome.storage.local.get(SENDER_KEYS.status);
  const st = (got[SENDER_KEYS.status] as Partial<SenderStatus> | undefined) ?? {};
  if (!cfg.enabled) {
    msgEl.textContent = 'Đang tắt: extension không gửi tin nào.';
    msgEl.className = 'msg muted';
  } else if (!cfg.uid) {
    msgEl.textContent = 'Hãy chọn tài khoản Zalo đang đăng nhập.';
    msgEl.className = 'msg warn';
  } else {
    const parts = [
      `Đang bật cho Zalo ${cfg.uid}.`,
      `Kiểm tra lần cuối: ${fmt(st.lastPollAt)}.`,
      `Đã gửi ${st.sentCount ?? 0}, lỗi ${st.failedCount ?? 0}.`,
    ];
    if (st.lastError) parts.push(`Lỗi gần nhất: ${st.lastError}`);
    msgEl.textContent = parts.join(' ');
    msgEl.className = `msg ${st.lastError ? 'warn' : 'ok'}`;
  }
}

async function save(patch: Partial<SenderConfig>) {
  const cur = await readSenderConfig();
  const next: SenderConfig = { ...cur, ...patch };
  // Enabling requires an explicit account; otherwise stay off.
  if (next.enabled && !next.uid) next.enabled = false;
  await chrome.storage.local.set({ [SENDER_KEYS.config]: next });
  if (patch.uid !== undefined && patch.uid !== cur.uid) {
    await chrome.storage.local.remove(SENDER_KEYS.status);
  }
  await render();
}

document.addEventListener('DOMContentLoaded', () => {
  const enabledEl = byId<HTMLInputElement>('sender-enabled');
  const uidEl = byId<HTMLSelectElement>('sender-uid');
  if (!enabledEl || !uidEl) return;
  void render();
  enabledEl.addEventListener('change', () => void save({ enabled: enabledEl.checked }));
  uidEl.addEventListener('change', () => void save({ uid: uidEl.value || null }));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes[SENDER_KEYS.status] || changes[SENDER_KEYS.config])) void render();
  });
});
