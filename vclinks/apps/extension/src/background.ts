import { OUTBOX_LIMITS } from '@vclinks/shared';
import { API_OPS, ApiError, HttpApiClient, type ApiClient } from './api';
import type {
  ApiCallResponse,
  BackgroundMessage,
  CaptureNamesRequest,
  CaptureRequest,
  CaptureResponse,
  FetchCall,
  StartCaptureResponse,
  StartSyncResponse,
  SyncRequest,
  SyncRequestResponse,
  TestConnectionResponse,
} from './messages';
import { EMPTY_RUN_STATE, STORAGE_KEYS, type ExtensionConfig, type RunState } from './status';
import { FB_SENDER_KEYS, readSenderConfig, type FbOutboxCall, type OutboxCall } from './sender-config';
import { FB_STORAGE_KEYS, isFbTabUrl, isFbUid } from './messenger/status';
import { LEGACY_ALARMS, migrateLegacyStorage } from './legacy';
import { maybeRotateToken, pollPairing } from './pairing';
import { PAIRING_ALARM, chromePairingDeps } from './pairing-chrome';

/**
 * Background service worker: holds the API settings, performs every fetch to the
 * VClinks API (no page CORS here), schedules syncs with chrome.alarms and keeps the
 * last run status in chrome.storage.local for the popup.
 */

const ALARM = 'vclinks-sync';
const PERIOD_MIN = 15;
const ZALO_URL = 'https://chat.zalo.me/*';

async function getConfig(): Promise<ExtensionConfig | null> {
  const got = await chrome.storage.local.get(STORAGE_KEYS.config);
  const cfg = got[STORAGE_KEYS.config] as ExtensionConfig | undefined;
  return cfg?.apiBaseUrl && cfg?.token ? cfg : null;
}

async function getRunState(): Promise<RunState> {
  const got = await chrome.storage.local.get(STORAGE_KEYS.run);
  return { ...EMPTY_RUN_STATE, ...(got[STORAGE_KEYS.run] as Partial<RunState> | undefined) };
}

// Serialize read-modify-write of the run state.
let runStateQueue: Promise<unknown> = Promise.resolve();
function patchRunState(patch: Partial<RunState>): Promise<void> {
  const next = runStateQueue.then(async () => {
    const cur = await getRunState();
    await chrome.storage.local.set({ [STORAGE_KEYS.run]: { ...cur, ...patch } });
  });
  runStateQueue = next.catch(() => undefined);
  return next;
}

async function client(): Promise<HttpApiClient> {
  const cfg = await getConfig();
  if (!cfg) throw new ApiError(0, 'Chưa cấu hình API URL và token');
  return new HttpApiClient(cfg.apiBaseUrl, cfg.token);
}

function errorResponse(e: unknown): { ok: false; status: number; message: string } {
  if (e instanceof ApiError) return { ok: false, status: e.status, message: e.message };
  return { ok: false, status: 0, message: (e instanceof Error ? e.message : String(e)).slice(0, 300) };
}

async function handleApiCall(op: string, args: unknown[]): Promise<ApiCallResponse> {
  if (!(API_OPS as readonly string[]).includes(op) || !Array.isArray(args)) {
    return { ok: false, status: 400, message: 'unknown op' };
  }
  try {
    const api = await client();
    const fn = api[op as keyof ApiClient] as (...a: unknown[]) => Promise<unknown>;
    return { ok: true, data: await fn.apply(api, args) };
  } catch (e) {
    const res = errorResponse(e);
    if (res.status === 401) await patchRunState({ authError: true });
    return res;
  }
}

/**
 * API calls from a Messenger tab: a restricted subset, and only for `fb_<id>`
 * accounts / Facebook streams, so a Facebook page can never write into a Zalo
 * account (or anything else) even if its content script were confused.
 */
const FB_STREAMS = ['messages', 'contacts', 'conversations'];
function fbCallAllowed(op: string, args: unknown[]): boolean {
  const a0 = args[0] as Record<string, unknown> | string | undefined;
  switch (op) {
    case 'getActiveMapping':
      return args.length === 0;
    case 'registerAccount':
      return typeof a0 === 'object' && !!a0 && isFbUid(a0.uid) && a0.channel === 'fb_personal';
    case 'ingest':
      return typeof a0 === 'string' && FB_STREAMS.includes(a0) && isFbUid(args[1]) && Array.isArray(args[2]);
    case 'ingestThreadNames':
      return isFbUid(a0) && Array.isArray(args[1]);
    case 'reportDrift':
      return typeof a0 === 'object' && !!a0 && isFbUid(a0.uid) && a0.kind === 'dom_selectors';
    default:
      return false;
  }
}

async function handleFbApiCall(op: string, args: unknown[]): Promise<ApiCallResponse> {
  if (!Array.isArray(args) || !fbCallAllowed(op, args)) return { ok: false, status: 403, message: 'forbidden' };
  return handleApiCall(op, args);
}

async function startSync(full: boolean, trigger: 'alarm' | 'manual'): Promise<StartSyncResponse> {
  if (!(await getConfig())) return { ok: false, reason: 'no_config' };
  const tabs = await chrome.tabs.query({ url: ZALO_URL });
  if (!tabs.length) return { ok: false, reason: 'no_tab' };

  const req: SyncRequest = { type: 'vclinks:sync', full, extensionVersion: chrome.runtime.getManifest().version };
  let busy = false;
  // Prefer the active tab; any chat.zalo.me tab sees the same IndexedDB.
  tabs.sort((a, b) => Number(b.active) - Number(a.active));
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    try {
      const res = (await chrome.tabs.sendMessage(tab.id, req)) as SyncRequestResponse | undefined;
      if (res?.accepted) {
        await patchRunState({
          running: true,
          full,
          trigger,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          authError: false,
          lastError: null,
        });
        return { ok: true };
      }
      if (res && !res.accepted) busy = true;
    } catch {
      // No content script in this tab (opened before the extension was installed/reloaded).
    }
  }
  return { ok: false, reason: busy ? 'busy' : 'no_content' };
}

async function startCapture(req: CaptureRequest | CaptureNamesRequest): Promise<StartCaptureResponse> {
  if (!(await getConfig())) return { ok: false, reason: 'no_config' };
  // The DOM is per-tab, so capture must target the visible tab, not just any.
  const tabs = await chrome.tabs.query({ url: ZALO_URL });
  if (!tabs.length) return { ok: false, reason: 'no_tab' };
  tabs.sort((a, b) => Number(b.active) - Number(a.active));
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    try {
      const res = (await chrome.tabs.sendMessage(tab.id, req)) as CaptureResponse | undefined;
      if (res) return res;
    } catch {
      // No content script in this tab.
    }
  }
  return { ok: false, reason: 'no_tab' };
}

/**
 * Injects file-hook.js into the Zalo tab's MAIN world. The manifest injects it
 * at document_start, but a tab that loaded before the extension (restored at
 * browser start, or open during an update) misses it. Idempotent in the page.
 */
async function injectFileHook(tabId: number | undefined, frameId: number | undefined): Promise<ApiCallResponse> {
  const cfg = await readSenderConfig();
  if (!cfg.enabled || tabId === undefined) return { ok: false, status: 403, message: 'Chưa bật gửi tin từ Dashboard' };
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId ?? 0] },
    world: 'MAIN',
    files: ['file-hook.js'],
  });
  return { ok: true, data: true };
}

/**
 * Outbox calls from the Zalo tab's sender. Refused unless the user enabled
 * sending in the popup, and only for the configured account.
 */
/** Long-poll length for /outbox/pending, clamped to what the API accepts. */
function waitParam(sec: number | undefined): string {
  if (!sec || !Number.isFinite(sec)) return '';
  return `&wait=${Math.min(25, Math.max(0, Math.floor(sec)))}`;
}

async function handleOutbox(call: OutboxCall): Promise<ApiCallResponse> {
  const cfg = await readSenderConfig();
  if (!cfg.enabled || !cfg.uid) return { ok: false, status: 403, message: 'Chưa bật gửi tin từ Dashboard' };
  try {
    const api = await client();
    const enc = encodeURIComponent;
    switch (call.op) {
      case 'pending':
        if (call.uid !== cfg.uid) return { ok: false, status: 403, message: 'Sai tài khoản gửi' };
        // commands=1: this build performs photos / files / cards / polls / @mentions (sender-actions.ts).
        return {
          ok: true,
          data: await api.request('GET', `/api/outbox/pending?uid=${enc(call.uid)}&commands=1&onlyThreads=${enc((cfg.onlyThreadIds ?? []).join(','))}${waitParam(call.waitSec)}`),
        };
      case 'claim':
        return { ok: true, data: await api.request('POST', `/api/outbox/${enc(call.id)}/claim`, {}) };
      case 'result':
        return { ok: true, data: await api.request('POST', `/api/outbox/${enc(call.id)}/result`, call.result) };
      case 'media':
        if (!/^[a-f0-9]{64}$/.test(call.id)) return { ok: false, status: 400, message: 'bad media id' };
        return { ok: true, data: await api.download(`/api/media/${call.id}`, OUTBOX_LIMITS.attachmentBytes) };
      default:
        return { ok: false, status: 400, message: 'unknown op' };
    }
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Outbox calls from a Messenger tab's sender: refused unless the user enabled
 * "Cho phép gửi tin trên Facebook", and only for the configured fb_ account.
 */
async function handleFbOutbox(call: FbOutboxCall): Promise<ApiCallResponse> {
  const cfg = await readSenderConfig(FB_SENDER_KEYS);
  if (!cfg.enabled || !cfg.uid || !isFbUid(cfg.uid)) {
    return { ok: false, status: 403, message: 'Chưa bật gửi tin trên Facebook' };
  }
  try {
    const api = await client();
    const enc = encodeURIComponent;
    switch (call.op) {
      case 'pending':
        if (call.uid !== cfg.uid) return { ok: false, status: 403, message: 'Sai tài khoản gửi' };
        return { ok: true, data: await api.request('GET', `/api/outbox/pending?uid=${enc(call.uid)}${waitParam(call.waitSec)}`) };
      case 'claim':
        return { ok: true, data: await api.request('POST', `/api/outbox/${enc(call.id)}/claim`, {}) };
      case 'result':
        return { ok: true, data: await api.request('POST', `/api/outbox/${enc(call.id)}/result`, call.result) };
      default:
        return { ok: false, status: 400, message: 'unknown op' };
    }
  } catch (e) {
    return errorResponse(e);
  }
}

/** Fetch-request calls from a Zalo tab (fetcher.ts). Ids only; the token stays here. */
async function handleFetch(call: FetchCall): Promise<ApiCallResponse> {
  try {
    const api = await client();
    const enc = encodeURIComponent;
    switch (call.op) {
      case 'pending':
      {
        const q = new URLSearchParams({ uid: call.uid });
        if (call.presence?.loggedIn != null) q.set('loggedIn', call.presence.loggedIn ? '1' : '0');
        if (call.presence?.waiting) q.set('waiting', call.presence.waiting);
        const wait = waitParam(call.waitSec);
        if (wait) q.set('wait', wait.slice('&wait='.length));
        const data = await api.request('GET', `/api/fetch-requests/pending?${q}`);
        // Only the tab logged in to this nick may run its sync.
        if (call.presence?.loggedIn !== false) void pickSyncRequest(call.uid);
        return { ok: true, data };
      }
      case 'claim':
        return { ok: true, data: await api.request('POST', `/api/fetch-requests/${enc(call.id)}/claim`, {}) };
      case 'result':
        return { ok: true, data: await api.request('POST', `/api/fetch-requests/${enc(call.id)}/result`, call.result) };
      default:
        return { ok: false, status: 400, message: 'unknown op' };
    }
  } catch (e) {
    return errorResponse(e);
  }
}

/** Min time between two "Đồng bộ ngay" checks of one nick (the heartbeat may come every second). */
const SYNC_REQUEST_CHECK_MS = 15_000;
const syncRequestCheckedAt = new Map<string, number>();

/**
 * "Đồng bộ ngay" from the Dashboard /sync page (M1a-06): piggybacks on the
 * fetch heartbeat, takes the nick's open request and starts the same sync as
 * the popup button. Read-only on Zalo Web, so no approval is involved.
 */
async function pickSyncRequest(uid: string): Promise<void> {
  const now = Date.now();
  if (now - (syncRequestCheckedAt.get(uid) ?? 0) < SYNC_REQUEST_CHECK_MS) return;
  syncRequestCheckedAt.set(uid, now);
  try {
    const api = await client();
    const res = (await api.request('POST', '/api/sync/requests/claim', { uid })) as { request: { full?: boolean } | null };
    if (res?.request) await startSync(!!res.request.full, 'manual');
  } catch {
    // An older API without the route, or offline: the next heartbeat tries again.
  }
}

async function testConnection(): Promise<TestConnectionResponse> {
  try {
    const me = await (await client()).me();
    await patchRunState({ authError: false });
    return { ok: true, name: me.name, scopes: me.scopes };
  } catch (e) {
    const res = errorResponse(e);
    if (res.status === 401) await patchRunState({ authError: true });
    return res;
  }
}

async function handle(msg: BackgroundMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const fromZaloTab = !!sender.tab && sender.url?.startsWith('https://chat.zalo.me/') === true;
  const fromFbTab = !!sender.tab && isFbTabUrl(sender.url);
  switch (msg.type) {
    case 'vclinks:fb-api':
      if (!fromFbTab) return { ok: false, status: 403, message: 'forbidden' };
      return handleFbApiCall(msg.op, msg.args);
    case 'vclinks:fb-status':
      if (!fromFbTab || !msg.status) return;
      await chrome.storage.local.set({ [FB_STORAGE_KEYS.status]: msg.status });
      return;
    case 'vclinks:api':
      if (!fromZaloTab) return { ok: false, status: 403, message: 'forbidden' };
      return handleApiCall(msg.op, msg.args);
    case 'vclinks:status':
      if (!fromZaloTab || !msg.account?.uid) return;
      await chrome.storage.local.set({ [`${STORAGE_KEYS.accountPrefix}${msg.account.uid}`]: msg.account });
      return;
    case 'vclinks:run-finished':
      if (!fromZaloTab) return;
      await patchRunState({
        running: false,
        finishedAt: new Date().toISOString(),
        lastError: msg.error,
        ...(msg.authError ? { authError: true } : {}),
        mappingVersion: msg.mappingVersion,
        accountsFound: msg.accountsFound,
      });
      return;
    case 'vclinks:start-sync':
      if (sender.tab) return; // popup only
      return startSync(!!msg.full, 'manual');
    case 'vclinks:test-connection':
      if (sender.tab) return;
      return testConnection();
    case 'vclinks:start-capture':
      if (sender.tab) return; // popup only
      return startCapture({ type: 'vclinks:capture' });
    case 'vclinks:start-capture-names':
      if (sender.tab) return; // popup only
      return startCapture({ type: 'vclinks:capture-names' });
  }
}

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  const m = msg as BackgroundMessage;
  if (typeof m?.type !== 'string' || !m.type.startsWith('vclinks:') || m.type === ('vclinks:sync' as string)) return;
  if (m.type === ('vclinks:fb-outbox' as string)) {
    if (!sender.tab || !isFbTabUrl(sender.url)) return;
    handleFbOutbox(msg as FbOutboxCall).then(sendResponse, (e) => sendResponse(errorResponse(e)));
    return true;
  }
  if (m.type === ('vclinks:fetch' as string)) {
    if (!sender.tab || sender.url?.startsWith('https://chat.zalo.me/') !== true) return;
    handleFetch(msg as FetchCall).then(sendResponse, (e) => sendResponse(errorResponse(e)));
    return true;
  }
  if (m.type === ('vclinks:focus-tab' as string)) {
    // The Zalo sender needs its tab focused to type (execCommand needs focus).
    const tab = sender.tab;
    if (!tab?.id || sender.url?.startsWith('https://chat.zalo.me/') !== true) return;
    Promise.all([chrome.windows.update(tab.windowId, { focused: true }), chrome.tabs.update(tab.id, { active: true })]).then(
      () => sendResponse({ ok: true }),
      (e) => sendResponse(errorResponse(e)),
    );
    return true;
  }
  if (m.type === ('vclinks:outbox' as string)) {
    if (!sender.tab || sender.url?.startsWith('https://chat.zalo.me/') !== true) return;
    if ((msg as OutboxCall).op === 'inject-file-hook') {
      injectFileHook(sender.tab.id, sender.frameId).then(sendResponse, (e) => sendResponse(errorResponse(e)));
      return true;
    }
    handleOutbox(msg as OutboxCall).then(sendResponse, (e) => sendResponse(errorResponse(e)));
    return true;
  }
  handle(m, sender).then(sendResponse, (e) => sendResponse(errorResponse(e)));
  return true; // async response
});

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM);
  if (!existing) await chrome.alarms.create(ALARM, { periodInMinutes: PERIOD_MIN, delayInMinutes: 1 });
}

// ---- Dev auto-reload (unpacked only) ----------------------------------------
// `pnpm dev:ext` rebuilds on every code change and stamps build/build-id.json.
// An unpacked extension serves its files straight from disk, so polling that file
// tells us a new build is there: reload the extension, then the Zalo tabs so the
// new content script runs. Store-installed builds (with update_url) never do this;
// Chrome updates those itself.
const DEV_RELOAD_ALARM = 'vclinks-dev-reload';
const IS_UNPACKED = !('update_url' in chrome.runtime.getManifest());

async function diskBuildId(): Promise<string | null> {
  try {
    const res = await fetch(chrome.runtime.getURL('build-id.json'), { cache: 'no-store' });
    return ((await res.json()) as { id?: string }).id ?? null;
  } catch {
    return null;
  }
}

/** Remembers which build is running; called whenever the extension (re)loads. */
async function recordLoadedBuild() {
  await chrome.storage.local.set({ [STORAGE_KEYS.devBuildId]: await diskBuildId() });
}

async function checkForNewBuild() {
  const got = await chrome.storage.local.get(STORAGE_KEYS.devBuildId);
  const loaded = got[STORAGE_KEYS.devBuildId] as string | null | undefined;
  const onDisk = await diskBuildId();
  if (!onDisk || onDisk === loaded) return;
  // Let a running sync finish (retry next tick), unless its state looks stuck.
  const run = await getRunState();
  if (run.running && run.startedAt && Date.now() - Date.parse(run.startedAt) < 10 * 60_000) return;
  console.info(`VClinks: new build ${onDisk}, reloading`);
  chrome.runtime.reload();
}

async function reloadZaloTabs() {
  for (const tab of await chrome.tabs.query({ url: ZALO_URL })) {
    if (tab.id !== undefined) await chrome.tabs.reload(tab.id).catch(() => undefined);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') {
    void migrateLegacyStorage(chrome.storage.local).catch(() => undefined);
    for (const a of LEGACY_ALARMS) void chrome.alarms.clear(a);
  }
  void ensureAlarm();
  if (!IS_UNPACKED) return;
  void recordLoadedBuild();
  // A reload leaves the old content scripts orphaned: reload the Zalo tabs.
  if (details.reason === 'update') void reloadZaloTabs();
});
chrome.runtime.onStartup.addListener(() => {
  void ensureAlarm();
  if (IS_UNPACKED) void recordLoadedBuild();
});
void ensureAlarm();
if (IS_UNPACKED) void chrome.alarms.create(DEV_RELOAD_ALARM, { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DEV_RELOAD_ALARM) {
    void checkForNewBuild().catch(() => undefined);
    return;
  }
  if (alarm.name === PAIRING_ALARM) {
    // The popup may be closed while the Admin types the code: keep polling until done.
    void pollPairing(chromePairingDeps()).then((v) => {
      if (v.state !== 'waiting') void chrome.alarms.clear(PAIRING_ALARM);
    });
    return;
  }
  if (alarm.name !== ALARM) return;
  void maybeRotateToken(chromePairingDeps()).catch(() => undefined);
  void startSync(false, 'alarm').catch(() => undefined);
});
