import { FB_STORAGE_KEYS, isFbUid, type FbAccountStatus } from './messenger/status';
import type { SenderStatus } from './sender';
import { FB_SENDER_KEYS, readSenderConfig, type SenderConfig } from './sender-config';

/** Popup section "Facebook cá nhân (Messenger)": detected account, owner id fallback, send switch. */

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

function fmt(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
}

function setMsg(el: HTMLElement, text: string, cls: '' | 'ok' | 'warn' | 'err' | 'muted' = '') {
  el.textContent = text;
  el.className = `msg ${cls}`;
}

/** A status older than this means no Messenger tab is reporting. */
const STALE_MS = 5 * 60_000;

async function readStatus(): Promise<FbAccountStatus | null> {
  const got = await chrome.storage.local.get(FB_STORAGE_KEYS.status);
  return (got[FB_STORAGE_KEYS.status] as FbAccountStatus | undefined) ?? null;
}

async function render() {
  const statusEl = byId('fb-status');
  const ownerEl = byId<HTMLInputElement>('fb-owner');
  const enabledEl = byId<HTMLInputElement>('fb-sender-enabled');
  const senderMsg = byId('fb-sender-msg');
  if (!statusEl || !ownerEl || !enabledEl || !senderMsg) return;

  const st = await readStatus();
  const got = await chrome.storage.local.get([FB_STORAGE_KEYS.ownerOverride, FB_SENDER_KEYS.status]);
  if (document.activeElement !== ownerEl) ownerEl.value = (got[FB_STORAGE_KEYS.ownerOverride] as string | undefined) ?? '';

  if (!st) {
    setMsg(statusEl, 'Chưa thấy tab Messenger. Hãy mở https://www.messenger.com hoặc https://www.facebook.com/messages và đăng nhập.', 'muted');
  } else {
    const stale = Date.now() - Date.parse(st.updatedAt) > STALE_MS;
    const parts: string[] = [];
    if (st.uid) {
      parts.push(`Tài khoản ${st.uid}${st.ownerSource === 'manual' ? ' (ID nhập tay)' : ''}${st.registered ? '' : ' — chưa đăng ký với API'}.`);
    }
    parts.push(`Đã gửi ${st.postedMessages} tin, ${st.postedThreads} hội thoại từ lúc mở tab. Lấy gần nhất: ${fmt(st.lastCaptureAt)}.`);
    if (st.locked) parts.push('Hội thoại đang mở là chat mã hóa đầu cuối và đang khóa: hãy nhập mã PIN trên Messenger.');
    if (st.unanchored) parts.push(`${st.unanchored} tin phía trên chưa có mốc thời gian nên chưa lấy (cuộn lên một chút).`);
    if (st.broken.length) parts.push(`Selector cần kiểm tra lại: ${st.broken.join(', ')} (đã báo drift).`);
    if (st.lastError) parts.push(`Lỗi: ${st.lastError}`);
    if (stale) parts.push(`(cập nhật lúc ${fmt(st.updatedAt)} — tab Messenger có thể đã đóng)`);
    setMsg(statusEl, parts.join(' '), st.lastError || st.broken.length ? 'warn' : stale ? 'muted' : 'ok');
  }

  const cfg = await readSenderConfig(FB_SENDER_KEYS);
  enabledEl.checked = cfg.enabled;
  const sst = (got[FB_SENDER_KEYS.status] as Partial<SenderStatus> | undefined) ?? {};
  if (!cfg.enabled) {
    setMsg(senderMsg, 'Đang tắt: extension không gửi tin nào trên Facebook.', 'muted');
  } else {
    const parts = [
      `Đang bật cho ${cfg.uid}.`,
      `Kiểm tra lần cuối: ${fmt(sst.lastPollAt)}.`,
      `Đã gửi ${sst.sentCount ?? 0}, lỗi ${sst.failedCount ?? 0}.`,
    ];
    if (st?.uid && st.uid !== cfg.uid) parts.push(`Tab Messenger đang đăng nhập ${st.uid}, khác tài khoản đã bật: sẽ không gửi.`);
    if (sst.lastError) parts.push(`Lỗi gần nhất: ${sst.lastError}`);
    setMsg(senderMsg, parts.join(' '), sst.lastError || (st?.uid && st.uid !== cfg.uid) ? 'warn' : 'ok');
  }
}

async function saveSender(enabled: boolean) {
  const cur = await readSenderConfig(FB_SENDER_KEYS);
  const st = await readStatus();
  if (enabled && (!st?.uid || !isFbUid(st.uid))) {
    byId<HTMLInputElement>('fb-sender-enabled')!.checked = false;
    const msg = byId('fb-sender-msg');
    if (msg) setMsg(msg, 'Chưa xác định được tài khoản Facebook. Hãy mở Messenger (hoặc nhập ID) rồi bật lại.', 'err');
    return;
  }
  // Enabling binds the switch to the account currently logged in on Messenger.
  const next: SenderConfig = { enabled, uid: enabled ? st!.uid : cur.uid };
  if (next.uid !== cur.uid) await chrome.storage.local.remove(FB_SENDER_KEYS.status);
  await chrome.storage.local.set({ [FB_SENDER_KEYS.config]: next });
  await render();
}

async function saveOwner() {
  const ownerEl = byId<HTMLInputElement>('fb-owner');
  const msg = byId('fb-owner-msg');
  if (!ownerEl || !msg) return;
  const v = ownerEl.value.trim();
  if (v && !/^\d{1,25}$/.test(v)) return setMsg(msg, 'ID Facebook chỉ gồm chữ số.', 'err');
  if (v) await chrome.storage.local.set({ [FB_STORAGE_KEYS.ownerOverride]: v });
  else await chrome.storage.local.remove(FB_STORAGE_KEYS.ownerOverride);
  setMsg(msg, v ? 'Đã lưu. Tab Messenger áp dụng trong vòng 1 phút.' : 'Đã xóa, extension tự nhận ID từ trang.', 'ok');
}

document.addEventListener('DOMContentLoaded', () => {
  const enabledEl = byId<HTMLInputElement>('fb-sender-enabled');
  if (!enabledEl) return;
  void render();
  enabledEl.addEventListener('change', () => void saveSender(enabledEl.checked));
  byId('fb-owner-save')?.addEventListener('click', () => void saveOwner());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[FB_STORAGE_KEYS.status] || changes[FB_SENDER_KEYS.config] || changes[FB_SENDER_KEYS.status]) void render();
  });
});
