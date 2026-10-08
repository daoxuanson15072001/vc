import { STREAMS, type Stream } from '@vclinks/shared';
import './popup-sender';
import './popup-fb';
import { pollPairing, startPairing, type PairingView } from './pairing';
import { PAIRING_ALARM, chromePairingDeps } from './pairing-chrome';
import type {
  StartCaptureMessage,
  StartCaptureNamesMessage,
  StartCaptureResponse,
  StartSyncMessage,
  StartSyncResponse,
  TestConnectionMessage,
  TestConnectionResponse,
} from './messages';
import {
  BACKFILL_PROGRESS_KEY,
  BACKFILL_START,
  BACKFILL_STOP,
  type BackfillProgress,
  type BackfillStartMessage,
  type BackfillStartResponse,
  type BackfillStopMessage,
  type BackfillStopResponse,
} from './backfill';
import {
  EMPTY_RUN_STATE,
  STORAGE_KEYS,
  type AccountRunStatus,
  type ExtensionConfig,
  type RunState,
  type StreamRunStats,
} from './status';

/** Popup UI (plain DOM, Vietnamese). */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const STREAM_LABEL: Record<Stream, string> = {
  contacts: 'Danh bạ',
  groups: 'Nhóm',
  conversations: 'Hội thoại',
  messages: 'Tin nhắn',
  reactions: 'Cảm xúc',
  labels: 'Thẻ phân loại',
  read_state: 'Đã đọc',
};

const STATE_LABEL: Record<string, string> = {
  pending: 'chờ',
  running: 'đang chạy',
  ok: 'xong',
  drift: 'lệch cấu trúc',
  error: 'lỗi',
};

const DRIFT_LABEL: Record<string, string> = {
  missing_db: 'thiếu DB',
  missing_store: 'thiếu store',
  missing_fields: 'thiếu trường bắt buộc',
  type_mismatch: 'sai kiểu',
  encrypted: 'dữ liệu bị mã hóa',
};

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function setMsg(el: HTMLElement, text: string, cls: '' | 'ok' | 'warn' | 'err' = '') {
  el.textContent = text;
  el.className = `msg ${cls}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

/** Match pattern for the API origin (ports are not part of Chrome match patterns). */
function originPattern(url: URL): string {
  return `${url.protocol}//${url.hostname}/*`;
}

async function loadSettings() {
  const got = await chrome.storage.local.get(STORAGE_KEYS.config);
  const cfg = got[STORAGE_KEYS.config] as ExtensionConfig | undefined;
  $<HTMLInputElement>('apiBaseUrl').value = cfg?.apiBaseUrl ?? '';
  $<HTMLInputElement>('token').value = cfg?.token ?? '';
  if (!cfg?.apiBaseUrl || !cfg?.token) ($('settings') as HTMLDetailsElement).open = true;
}

async function testConnection(msgEl: HTMLElement) {
  const res = (await chrome.runtime.sendMessage({ type: 'vclinks:test-connection' } satisfies TestConnectionMessage)) as
    | TestConnectionResponse
    | undefined;
  if (!res) return setMsg(msgEl, 'Không liên lạc được với service worker.', 'err');
  if (res.ok) {
    const scopes = res.scopes.join(', ') || '(không có)';
    if (!res.scopes.includes('ingest')) {
      return setMsg(msgEl, `Kết nối được (${res.name}) nhưng token thiếu scope "ingest". Scope: ${scopes}`, 'warn');
    }
    return setMsg(msgEl, `Kết nối OK — ${res.name}. Scope: ${scopes}`, 'ok');
  }
  if (res.status === 401) return setMsg(msgEl, 'Token không hợp lệ.', 'err');
  setMsg(msgEl, `Lỗi kết nối: ${res.message}`, 'err');
}

function onSaveSettings(ev: SubmitEvent) {
  ev.preventDefault();
  const msgEl = $('settings-msg');
  const rawUrl = $<HTMLInputElement>('apiBaseUrl').value.trim();
  const token = $<HTMLInputElement>('token').value.trim();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return setMsg(msgEl, 'Địa chỉ API không hợp lệ.', 'err');
  }
  const isLocal = url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    return setMsg(msgEl, 'Chỉ chấp nhận https://… hoặc http://localhost.', 'err');
  }
  if (!token) return setMsg(msgEl, 'Hãy nhập token.', 'err');

  // permissions.request must run directly inside the user gesture.
  chrome.permissions.request({ origins: [originPattern(url)] }).then(
    async (granted) => {
      if (!granted) return setMsg(msgEl, `Chưa cấp quyền truy cập ${url.origin}.`, 'err');
      const cfg: ExtensionConfig = { apiBaseUrl: url.origin + url.pathname.replace(/\/+$/, ''), token };
      await chrome.storage.local.set({ [STORAGE_KEYS.config]: cfg });
      setMsg(msgEl, 'Đã lưu. Đang kiểm tra kết nối…');
      await testConnection(msgEl);
    },
    (e) => setMsg(msgEl, `Không xin được quyền: ${String(e?.message ?? e)}`, 'err'),
  );
}

const START_ERROR: Record<string, string> = {
  no_config: 'Chưa cấu hình địa chỉ API và token.',
  no_tab: 'Chưa mở Zalo Web. Hãy mở https://chat.zalo.me và đăng nhập, rồi bấm lại.',
  no_content: 'Tab Zalo Web chưa nạp extension. Hãy tải lại (F5) tab chat.zalo.me rồi bấm lại.',
  busy: 'Đang có một lượt đồng bộ chạy.',
};

async function startSync(full: boolean) {
  const msgEl = $('sync-msg');
  setMsg(msgEl, 'Đang yêu cầu đồng bộ…');
  const res = (await chrome.runtime.sendMessage({ type: 'vclinks:start-sync', full } satisfies StartSyncMessage)) as
    | StartSyncResponse
    | undefined;
  if (!res) return setMsg(msgEl, 'Không liên lạc được với service worker.', 'err');
  if (res.ok) return setMsg(msgEl, full ? 'Đã bắt đầu đồng bộ lại toàn bộ.' : 'Đã bắt đầu đồng bộ.', 'ok');
  setMsg(msgEl, START_ERROR[res.reason] ?? res.reason, res.reason === 'busy' ? 'warn' : 'err');
}

const CAPTURE_ERROR: Record<string, string> = {
  no_config: 'Chưa cấu hình địa chỉ API và token.',
  no_tab: 'Chưa mở Zalo Web. Hãy mở và mở một hội thoại, rồi bấm lại.',
  none: 'Không thấy tin nào trên màn hình. Hãy mở một hội thoại rồi bấm lại.',
  busy: 'Đang có một lượt chạy khác.',
  error: 'Lỗi khi lấy nội dung.',
};

async function startCapture() {
  const msgEl = $('capture-msg');
  setMsg(msgEl, 'Đang đọc nội dung màn hình…');
  const res = (await chrome.runtime.sendMessage({ type: 'vclinks:start-capture' } satisfies StartCaptureMessage)) as
    | StartCaptureResponse
    | undefined;
  if (!res) return setMsg(msgEl, 'Không liên lạc được với service worker.', 'err');
  if (res.ok) {
    return setMsg(msgEl, `Đã lấy ${res.captured} tin, ghép ${res.matched} tin vào hội thoại.`, 'ok');
  }
  const detail = 'message' in res ? res.message : undefined;
  // For a runtime error, surface the real cause instead of the generic label.
  const text = res.reason === 'error' && detail ? `Lỗi: ${detail}` : (CAPTURE_ERROR[res.reason] ?? detail ?? res.reason);
  setMsg(msgEl, text, res.reason === 'busy' ? 'warn' : 'err');
}

async function startCaptureNames() {
  const msgEl = $('capture-msg');
  setMsg(msgEl, 'Đang đọc tên hội thoại từ danh sách…');
  const res = (await chrome.runtime.sendMessage({ type: 'vclinks:start-capture-names' } satisfies StartCaptureNamesMessage)) as
    | StartCaptureResponse
    | undefined;
  if (!res) return setMsg(msgEl, 'Không liên lạc được với service worker.', 'err');
  if (res.ok) return setMsg(msgEl, `Đã đọc ${res.captured} tên, gắn ${res.matched} vào hội thoại.`, 'ok');
  const detail = 'message' in res ? res.message : undefined;
  const text = res.reason === 'error' && detail ? `Lỗi: ${detail}` : (CAPTURE_ERROR[res.reason] ?? detail ?? res.reason);
  setMsg(msgEl, text, res.reason === 'busy' ? 'warn' : 'err');
}

function renderRun(run: RunState) {
  const box = $('run');
  box.replaceChildren();
  if (run.authError) box.append(el('div', 'Token không hợp lệ hoặc đã bị thu hồi. Cần ghép lại thiết bị bằng mã ghép (Cài đặt) và nhờ quản trị viên duyệt.', 'err'));
  if (run.running) {
    box.append(el('div', `Đang đồng bộ${run.full ? ' lại toàn bộ' : ''} (từ ${fmtTime(run.startedAt)})…`, 'warn'));
  } else if (run.finishedAt) {
    box.append(el('div', `Lượt gần nhất xong lúc ${fmtTime(run.finishedAt)}`, 'muted'));
  } else {
    box.append(el('div', 'Chưa đồng bộ lần nào.', 'muted'));
  }
  if (run.mappingVersion != null) box.append(el('div', `Bảng ánh xạ phiên bản ${run.mappingVersion}`, 'muted'));
  if (run.accountsFound === 0) {
    box.append(el('div', 'Không thấy tài khoản Zalo nào trong IndexedDB (đã đăng nhập Zalo Web chưa?).', 'warn'));
  }
  if (run.lastError && !run.authError) box.append(el('div', `Lỗi: ${run.lastError}`, 'err'));
}

function streamRow(stream: Stream, s: StreamRunStats | undefined): HTMLTableRowElement {
  const tr = el('tr');
  const state = s ? (s.drift ? `${STATE_LABEL.drift}: ${DRIFT_LABEL[s.drift] ?? s.drift}` : STATE_LABEL[s.state]) : '—';
  const cells = [
    STREAM_LABEL[stream],
    s?.sourceCount ?? '—',
    s?.sent ?? 0,
    s?.accepted ?? 0,
    s?.updated ?? 0,
    s?.rejected ?? 0,
    s?.skipped ?? 0,
  ];
  for (const c of cells) tr.append(el('td', String(c)));
  const td = el('td', state, s?.state === 'error' || s?.drift ? 'err' : s?.state === 'ok' ? 'ok' : '');
  if (s?.error) td.title = s.error;
  tr.append(td);
  return tr;
}

function renderAccounts(accounts: AccountRunStatus[]) {
  const box = $('accounts');
  box.replaceChildren();
  for (const [i, a] of accounts.sort((x, y) => x.uid.localeCompare(y.uid)).entries()) {
    const wrap = el('div', undefined, 'account');
    wrap.append(el('b', `Nick Zalo số ${i + 1}`));
    wrap.append(
      el(
        'div',
        `${STATE_LABEL[a.state] ?? a.state}${a.full ? ' (toàn bộ)' : ''} · bắt đầu ${fmtTime(a.startedAt)} · xong ${fmtTime(a.finishedAt)}`,
        a.state === 'error' || a.state === 'drift' ? 'err' : a.state === 'ok' ? 'ok' : 'muted',
      ),
    );
    const table = el('table');
    const head = el('tr');
    for (const h of ['Stream', 'Gốc', 'Gửi', 'Mới', 'Cập nhật', 'Từ chối', 'Bỏ qua', 'Trạng thái']) head.append(el('th', h));
    table.append(head);
    for (const s of STREAMS) table.append(streamRow(s, a.streams[s]));
    wrap.append(table);
    for (const e of a.errors.slice(0, 5)) wrap.append(el('div', e, 'err'));
    if (Object.values(a.streams).some((s) => s?.drift === 'encrypted')) {
      wrap.append(
        el('div', 'Zalo Web đang mã hóa dữ liệu trong IndexedDB: stream bị mã hóa đã dừng đẩy, không nạp bản mã vào VClinks.', 'warn'),
      );
    }
    if (Object.values(a.streams).some((s) => s?.drift && s.drift !== 'encrypted')) {
      wrap.append(
        el('div', 'Cấu trúc IndexedDB đã đổi: stream bị lệch đã dừng đẩy và đã báo drift. Chờ duyệt bảng ánh xạ mới trên Dashboard.', 'warn'),
      );
    }
    box.append(wrap);
  }
}

async function renderStatus() {
  const all = await chrome.storage.local.get(null);
  renderRun({ ...EMPTY_RUN_STATE, ...(all[STORAGE_KEYS.run] as Partial<RunState> | undefined) });
  renderAccounts(
    Object.entries(all)
      .filter(([k]) => k.startsWith(STORAGE_KEYS.accountPrefix))
      .map(([, v]) => v as AccountRunStatus),
  );
}

document.addEventListener('DOMContentLoaded', () => {
  void loadSettings();
  void renderStatus();
  $<HTMLFormElement>('settings-form').addEventListener('submit', onSaveSettings);
  $('sync-now').addEventListener('click', () => void startSync(false));
  $('sync-full').addEventListener('click', () => void startSync(true));
  $('capture-now').addEventListener('click', () => void startCapture());
  $('capture-names').addEventListener('click', () => void startCaptureNames());
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'local') void renderStatus();
  });
});

// ---- Backfill: load older messages of the conversation open on Zalo Web ----

const BACKFILL_REASON: Record<string, string> = {
  reached_start: 'Đã tới tin cũ nhất Zalo Web cho xem.',
  all_pending_seen: 'Đã lấy đủ các tin đang chờ nội dung.',
  max_scrolls: 'Đã cuộn tối đa 200 lần; bấm lại để lấy tiếp.',
  stopped: 'Đã dừng theo yêu cầu.',
  thread_changed: 'Đã dừng vì bạn chuyển sang hội thoại khác.',
  tab_hidden: 'Đã dừng vì tab Zalo bị ẩn (Zalo Web không tải tin cũ khi tab ở nền). Hãy để tab hiện rồi bấm lại.',
  no_conversation: 'Chưa mở hội thoại nào (hoặc hội thoại chưa có tin). Hãy mở một hội thoại rồi bấm lại.',
  rate_limited: 'Đã đạt giới hạn 20 hội thoại/giờ. Hãy thử lại sau.',
  error: 'Lỗi khi lấy tin cũ.',
};

/** The Zalo Web tab to talk to: the active one first. */
async function zaloTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://chat.zalo.me/*' });
  tabs.sort((a, b) => Number(b.active) - Number(a.active));
  return tabs.find((t) => t.id !== undefined)?.id ?? null;
}

function renderBackfill(p: BackfillProgress | undefined) {
  const msgEl = $('backfill-msg');
  const running = p?.state === 'running';
  $<HTMLButtonElement>('backfill-start').disabled = running;
  $<HTMLButtonElement>('backfill-stop').disabled = !running;
  if (!p) return setMsg(msgEl, '');
  const counts =
    `${p.scrolls} lần cuộn · thấy ${p.seen} tin · gửi ${p.posted} nội dung (ghép ${p.matched})` +
    (p.pendingTotal != null ? ` · tin chờ: ${p.pendingSeen}/${p.pendingTotal}` : '');
  if (running) return setMsg(msgEl, `Đang lấy tin cũ… ${counts}`, 'warn');
  const reason = p.reason ? (BACKFILL_REASON[p.reason] ?? p.reason) : '';
  const detail = p.state === 'error' && p.message ? ` ${p.message}` : '';
  const cls = p.state === 'done' ? 'ok' : p.state === 'error' ? 'err' : 'warn';
  setMsg(msgEl, `${reason}${detail} ${p.reason === 'rate_limited' || p.reason === 'no_conversation' ? '' : counts}`.trim(), cls);
}

async function loadBackfill() {
  const got = await chrome.storage.local.get(BACKFILL_PROGRESS_KEY);
  renderBackfill(got[BACKFILL_PROGRESS_KEY] as BackfillProgress | undefined);
}

async function startBackfill() {
  const msgEl = $('backfill-msg');
  const tabId = await zaloTabId();
  if (tabId == null) return setMsg(msgEl, 'Chưa mở Zalo Web. Hãy mở một hội thoại trên chat.zalo.me rồi bấm lại.', 'err');
  setMsg(msgEl, 'Đang bắt đầu…');
  let res: BackfillStartResponse | undefined;
  try {
    res = (await chrome.tabs.sendMessage(tabId, { type: BACKFILL_START } satisfies BackfillStartMessage)) as
      | BackfillStartResponse
      | undefined;
  } catch {
    res = undefined;
  }
  if (!res) return setMsg(msgEl, 'Tab Zalo Web chưa nạp extension. Hãy tải lại (F5) tab chat.zalo.me rồi bấm lại.', 'err');
  if (!res.accepted) return setMsg(msgEl, 'Đang có một lượt lấy tin cũ chạy.', 'warn');
}

async function stopBackfill() {
  const tabId = await zaloTabId();
  let res: BackfillStopResponse | undefined;
  if (tabId != null) {
    try {
      res = (await chrome.tabs.sendMessage(tabId, { type: BACKFILL_STOP } satisfies BackfillStopMessage)) as
        | BackfillStopResponse
        | undefined;
    } catch {
      res = undefined;
    }
  }
  if (!res?.stopped) {
    // Nothing running in the page (e.g. the tab was reloaded): clear the stale state.
    const got = await chrome.storage.local.get(BACKFILL_PROGRESS_KEY);
    const p = got[BACKFILL_PROGRESS_KEY] as BackfillProgress | undefined;
    if (p?.state === 'running') {
      await chrome.storage.local.set({
        [BACKFILL_PROGRESS_KEY]: { ...p, state: 'stopped', reason: 'stopped', finishedAt: Date.now() },
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void loadBackfill();
  $('backfill-start').addEventListener('click', () => void startBackfill());
  $('backfill-stop').addEventListener('click', () => void stopBackfill());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[BACKFILL_PROGRESS_KEY]) {
      renderBackfill(changes[BACKFILL_PROGRESS_KEY].newValue as BackfillProgress | undefined);
    }
  });
});


// --- Pairing by 6-digit code (01 PQ-52) ---

let pairTimer: number | undefined;

function showPairing(v: PairingView) {
  const code = $('pair-code');
  const msg = $('pair-msg');
  code.textContent = v.state === 'waiting' ? v.code.replace(/(\d{3})(\d{3})/, '$1 $2') : '';
  if (v.state === 'waiting') setMsg(msg, 'Đang chờ Admin nhập mã này trên VClinks (mã dùng được 10 phút)…', 'warn');
  else if (v.state === 'paired') {
    setMsg(msg, 'Đã ghép máy thành công.', 'ok');
    void loadSettings();
    void testConnection($('settings-msg'));
  } else if (v.state === 'expired') setMsg(msg, 'Mã đã hết hạn. Bấm "Lấy mã ghép" để lấy mã mới.', 'err');
  else if (v.state === 'error') setMsg(msg, `Chưa ghép được: ${v.message}`, 'err');
  else setMsg(msg, '');
  if (v.state !== 'waiting' && pairTimer !== undefined) {
    window.clearInterval(pairTimer);
    pairTimer = undefined;
  }
}

function watchPairing() {
  if (pairTimer !== undefined) return;
  pairTimer = window.setInterval(() => void pollPairing(chromePairingDeps()).then(showPairing), 3000);
}

$('pair-start').addEventListener('click', () => {
  const rawUrl = $<HTMLInputElement>('apiBaseUrl').value.trim();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return setMsg($('pair-msg'), 'Hãy điền địa chỉ API ở ô bên dưới trước.', 'err');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
    return setMsg($('pair-msg'), 'Chỉ chấp nhận https://… hoặc http://localhost.', 'err');
  }
  // permissions.request must run directly inside the user gesture.
  chrome.permissions.request({ origins: [originPattern(url)] }).then(async (granted) => {
    if (!granted) return setMsg($('pair-msg'), `Chưa cấp quyền truy cập ${url.origin}.`, 'err');
    const base = url.origin + url.pathname.replace(/\/+$/, '');
    const v = await startPairing(base, `Chrome ${navigator.platform}`.slice(0, 80), chromePairingDeps());
    showPairing(v);
    if (v.state === 'waiting') {
      void chrome.alarms.create(PAIRING_ALARM, { periodInMinutes: 1, delayInMinutes: 0.5 });
      watchPairing();
    }
  });
});

void pollPairing(chromePairingDeps()).then((v) => {
  if (v.state === 'waiting') {
    showPairing(v);
    watchPairing();
  }
});
