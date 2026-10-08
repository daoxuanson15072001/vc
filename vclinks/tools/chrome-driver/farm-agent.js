// "Máy Zalo" agent: a small HTTP service the VClinks API calls to run one Chrome profile per personal Zalo nick
// and relay the login QR to the Dashboard (docs/01-quan-ly-du-an/ke-hoach-zalo-ca-nhan-quet-qr.md,
// ops: docs/06-van-hanh/chrome-driver.md "Máy Zalo"). Listens on 127.0.0.1 only and wants the shared key.
//
//   GET    /health                      {ok, slots, max}
//   POST   /slots/:id/start {mode?, handoverAfterMin?}  start (or keep) the slot: Chrome on Zalo Web, or a direct
//                                        zca-js session (mode "direct"); handoverAfterMin: Zalo Web first for the
//                                        history, then the agent moves the nick to direct that long after the scan
//   POST   /slots/:id/handover          Zalo Web → direct now: the session of the Chrome profile goes to zca-js;
//                                        Chrome stops, its profile stays 7 days to go back (plan P4)
//   POST   /slots/:id/rollback          direct → Zalo Web again, with the kept Chrome profile
//   GET    /slots/:id/state?qr=1        {page, view?, qr?, uids}; qr only on the login page
//   POST   /slots/:id/meta  {uid}       remember the nick's uid once the API bound it: session reports start, a direct
//                                        slot starts ingesting, and every nick sends the messages approved on the
//                                        Dashboard from then on (no per-nick send switch since 06/10/2026, dev002)
//   POST   /slots/:id/options {openUnread}  per-nick option: open unread conversations to read their content
//   POST   /slots/:id/reset             wipe the profile and start again on the QR page
//   POST   /slots/:id/sync-history      ask the phone for older messages ("Đồng bộ tin nhắn")
//   GET    /slots/:id/stickers?q=       direct slots: Zalo's sticker search (id, category, type, image) → {items}
//   DELETE /slots/:id                   stop Chrome and delete the profile (the Zalo session is gone)
//
// Env: ZALO_FARM_KEY (required), ZALO_FARM_PORT (9400), ZALO_FARM_MAX (8), ZALO_FARM_DIR (~/.vclinks-fleet/farm),
//      VCLINKS_API (http://localhost:3100), VCLINKS_TOKEN (ingest token for the extensions and session reports).
// Every 30 s it restarts a slot whose Chrome died (budget 3 / hour), reopens a missing Zalo tab and reports each
// known nick's session (ok / lost: qr | cdp_down) to POST /api/accounts/:uid/session like the watchdog.
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const lib = require('./farm-lib');
const { step } = require('./fleet-lib');
const { DirectSessions } = require('./farm-direct');

const cfg = {
  key: process.env.ZALO_FARM_KEY || '',
  port: Number(process.env.ZALO_FARM_PORT || 9400),
  max: Number(process.env.ZALO_FARM_MAX || 8),
  farmDir: (process.env.ZALO_FARM_DIR || path.join(os.homedir(), '.vclinks-fleet', 'farm')).replace(/^~(?=\/|$)/, os.homedir()),
  api: (process.env.VCLINKS_API || 'http://localhost:3100').replace(/\/+$/, ''),
  token: process.env.VCLINKS_TOKEN || '',
  intervalMs: Number(process.env.ZALO_FARM_INTERVAL_MS || 30_000),
  /** 64 hex characters: encrypts the saved Zalo sessions of direct slots (session.enc). */
  sessionKeyHex: process.env.ZALO_FARM_SESSION_KEY || '',
};
if (!cfg.key || cfg.key.length < 24) {
  console.error('ZALO_FARM_KEY missing or shorter than 24 characters');
  process.exit(1);
}

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
let registry = lib.loadRegistry(cfg.farmDir);
// Direct sessions read the slot record (bound uid) from the registry at each use.
const direct = new DirectSessions(cfg, log, { slotOf: (id) => registry[id] });
const isDirect = (slot) => slot?.mode === 'direct';
/** After a handover the Chrome profile stays this long, to go back to Zalo Web; then it is deleted. */
const KEEP_CHROME_MS = 7 * 24 * 3600_000;
const HANDOVER_AFTER_MAX_MIN = 24 * 60;
/** Per slot runtime: session debounce, restart times, a lock while starting, last QR capture (1 s cache). */
const runtime = new Map();
const rt = (id) => {
  if (!runtime.has(id)) runtime.set(id, { tracker: null, restarts: [], busy: null, qrCache: null, stopped: false, blankRounds: 0 });
  return runtime.get(id);
};

function persist() {
  lib.saveRegistry(cfg.farmDir, registry);
}

/** Starts the slot once at a time; concurrent callers wait for the same start. */
async function ensureStarted(id, mode, opts = {}) {
  const r = rt(id);
  if (r.busy) return r.busy;
  r.busy = (async () => {
    let slot = registry[id];
    if (!slot) {
      if (Object.keys(registry).length >= cfg.max) throw Object.assign(new Error(`Máy Zalo đã đủ ${cfg.max} nick`), { status: 409 });
      const port = lib.allocatePort(Object.values(registry).map((s) => s.port));
      if (!port) throw Object.assign(new Error('Hết cổng cho nick mới'), { status: 409 });
      slot = registry[id] = { port, uid: null, mode: mode === 'direct' ? 'direct' : 'browser', createdAt: new Date().toISOString() };
      const after = Number(opts.handoverAfterMin);
      if (slot.mode === 'browser' && after > 0) slot.handoverAfterMin = Math.min(HANDOVER_AFTER_MAX_MIN, Math.round(after));
      persist();
    }
    r.stopped = false;
    if (isDirect(slot)) {
      if (!direct.phase(id) || direct.phase(id) === 'lost' || direct.phase(id) === 'error') {
        log(`${id}: starting the direct session`);
        direct.start(id);
        r.restarts.push(Date.now());
      }
      return slot;
    }
    if (!(await lib.tabsOf(slot.port))) {
      log(`${id}: starting Chrome on :${slot.port}`);
      await lib.startSlot(cfg, id, slot.port, { openUnread: !!slot.openUnread, uid: slot.uid });
      r.restarts.push(Date.now());
    }
    return slot;
  })().finally(() => {
    r.busy = null;
  });
  return r.busy;
}

/** Facts about the slot's mode the API keeps in step: current mode, planned move to direct, Zalo Web kept to go back. */
function modeFacts(slot) {
  return { mode: slot.mode ?? 'browser', handoverAt: slot.handoverAt ?? null, chromeKept: isDirect(slot) && !!slot.chromeUntil && lib.hasChromeProfile(cfg, slot.id) };
}

async function state(id, wantQr) {
  const slot = registry[id];
  if (!slot) return { page: 'unknown', uids: [] };
  return { ...(await pageState(id, slot, wantQr)), ...modeFacts({ ...slot, id }) };
}

async function pageState(id, slot, wantQr) {
  if (isDirect(slot)) return direct.state(id, wantQr);
  const page = lib.pageOf(await lib.tabsOf(slot.port));
  if (page === 'login') {
    const r = rt(id);
    if (wantQr && r.qrCache && Date.now() - r.qrCache.at < 1000) return r.qrCache.value;
    const login = await lib.captureLogin(slot.port, { wantQr, refresh: wantQr }).catch((e) => ({ view: 'unknown', png: null, error: e.message }));
    const value = { page, view: login?.view ?? 'unknown', qr: login?.png ?? null, uids: [] };
    if (wantQr) r.qrCache = { at: Date.now(), value };
    return value;
  }
  if (page === 'chat') return { page, uids: (await lib.chatUids(slot.port).catch(() => null)) ?? [] };
  return { page, uids: [] };
}

async function reportSession(id, slot, obs) {
  if (!slot.uid || !cfg.token) return;
  const r = rt(id);
  r.tracker = step(r.tracker, obs, 2);
  const confirmed = r.tracker.confirmed;
  if (!confirmed) return;
  const body = confirmed.ok ? { state: 'ok', source: 'may-zalo' } : { state: 'lost', reason: confirmed.reason, source: 'may-zalo' };
  await fetch(`${cfg.api}/api/accounts/${slot.uid}/session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  }).catch((e) => log(`${id}: session report failed: ${e.message}`));
}

/** Waits until the slot's Chrome no longer answers on its port (at most 15 s). */
async function chromeDown(port) {
  for (let i = 0; i < 30; i++) {
    if (!(await lib.tabsOf(port))) return true;
    await new Promise((res) => setTimeout(res, 500));
  }
  return false;
}

/**
 * Zalo Web → direct (plan P4): the session of the slot's Chrome profile (cookies, z_uuid, userAgent) goes to a zca-js
 * session; Chrome stops and its profile stays KEEP_CHROME_MS to go back. When Zalo refuses the session, or it is
 * another account, Chrome comes back on and nothing changes.
 */
async function handover(id) {
  const slot = registry[id];
  if (!slot || isDirect(slot)) throw Object.assign(new Error('Nick này không chạy qua Zalo Web'), { status: 409 });
  if (!slot.uid) throw Object.assign(new Error('Nick chưa kết nối xong'), { status: 409 });
  if (!cfg.sessionKeyHex) throw Object.assign(new Error('Máy Zalo chưa có khóa phiên (ZALO_FARM_SESSION_KEY)'), { status: 503 });
  const r = rt(id);
  if (r.busy) await r.busy.catch(() => undefined);
  r.busy = (async () => {
    const creds = await lib.readZaloSession(slot.port).catch(() => null);
    if (!creds) throw Object.assign(new Error('Không đọc được phiên Zalo Web của nick (Zalo Web chưa mở xong?)'), { status: 409 });
    r.stopped = true;
    lib.stopSlot(cfg, id);
    await chromeDown(slot.port);
    const back = async (message, status) => {
      r.stopped = false;
      await lib.startSlot(cfg, id, slot.port, { openUnread: !!slot.openUnread, uid: slot.uid }).catch((e) => log(`${id}: Chrome restart failed: ${e.message}`));
      return Object.assign(new Error(message), { status });
    };
    let uid;
    try {
      uid = await direct.adopt(id, creds);
    } catch (e) {
      log(`${id}: handover refused by Zalo (${e && e.code ? e.code : 'error'}), back to Zalo Web`);
      throw await back('Zalo không nhận phiên chuyển sang, nick vẫn chạy qua Zalo Web', 502);
    }
    if (uid !== slot.uid) {
      direct.forget(id);
      throw await back('Phiên đọc được là của tài khoản khác, nick vẫn chạy qua Zalo Web', 409);
    }
    slot.mode = 'direct';
    slot.handoverAt = null;
    slot.chromeUntil = new Date(Date.now() + KEEP_CHROME_MS).toISOString();
    persist();
    r.stopped = false;
    r.tracker = null;
    log(`${id}: moved to the direct session; Zalo Web profile kept until ${slot.chromeUntil}`);
    return slot;
  })().finally(() => {
    r.busy = null;
  });
  return r.busy;
}

/** Direct → Zalo Web again with the kept Chrome profile (the direct session and its files are dropped). */
async function rollback(id) {
  const slot = registry[id];
  if (!slot || !isDirect(slot)) throw Object.assign(new Error('Nick này không chạy trực tiếp'), { status: 409 });
  if (!lib.hasChromeProfile(cfg, id)) {
    throw Object.assign(new Error('Không còn hồ sơ Zalo Web của nick (đã quá 7 ngày, hoặc nick kết nối thẳng ở chế độ trực tiếp): ngắt rồi quét QR lại ở chế độ Zalo Web'), { status: 409 });
  }
  direct.forget(id);
  slot.mode = 'browser';
  slot.chromeUntil = null;
  persist();
  rt(id).tracker = null;
  await ensureStarted(id);
  log(`${id}: back to Zalo Web`);
  return slot;
}

/** Direct slot: restart a dropped session (not one taken by another Zalo Web), report it, keep presence alive. */
async function directRound(id, slot, r) {
  // The Zalo Web profile kept after a handover goes after KEEP_CHROME_MS.
  if (slot.chromeUntil && Date.now() > Date.parse(slot.chromeUntil)) {
    lib.wipeChrome(cfg, id);
    slot.chromeUntil = null;
    persist();
    log(`${id}: Zalo Web profile deleted (kept ${KEEP_CHROME_MS / 86_400_000} days after the move to direct)`);
  }
  const st = direct.state(id, false);
  if (st.page === 'down' && st.lost !== 'duplicate_web' && direct.phase(id) !== 'starting') {
    r.restarts = r.restarts.filter((t) => Date.now() - t < 3600_000);
    if (r.restarts.length < 3) await ensureStarted(id).catch((e) => log(`${id}: restart failed: ${e.message}`));
    else log(`${id}: restart budget used up for the direct session`);
  }
  const obs =
    st.page === 'chat' ? { ok: true } : st.page === 'login' ? { ok: false, reason: 'qr' } : { ok: false, reason: st.lost === 'duplicate_web' ? 'duplicate_web' : 'direct_down' };
  await reportSession(id, slot, obs);
  // Heartbeat the Dashboard reads as "this nick is served" (the fetch-requests poll doubles as presence).
  if (st.page === 'chat' && slot.uid && cfg.token) {
    await fetch(`${cfg.api}/api/fetch-requests/pending?uid=${slot.uid}&loggedIn=1`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  }
}

/** One monitor round: keep every slot's Chrome (or direct session) up and report sessions. */
async function round() {
  for (const [id, slot] of Object.entries(registry)) {
    const r = rt(id);
    if (r.busy || r.stopped) continue;
    if (isDirect(slot)) {
      await directRound(id, slot, r);
      continue;
    }
    const tabs = await lib.tabsOf(slot.port);
    const page = lib.pageOf(tabs);
    if (page === 'down') {
      const recent = r.restarts.filter((t) => Date.now() - t < 3600_000);
      r.restarts = recent;
      if (recent.length < 3) await ensureStarted(id).catch((e) => log(`${id}: restart failed: ${e.message}`));
      else log(`${id}: restart budget used up; check ${lib.slotDirs(cfg.farmDir, id).profileDir}/driver.log`);
    } else if (page === 'other') {
      await lib.openTab(slot.port, 'https://chat.zalo.me');
    } else if (page === 'chat') {
      // Blank Zalo Web (no conversation rendered) two rounds in a row: reload the tab.
      const n = await lib.chatRendered(slot.port).catch(() => null);
      r.blankRounds = n === 0 ? r.blankRounds + 1 : 0;
      if (r.blankRounds >= 2) {
        log(`${id}: Zalo Web is blank, reloading the tab`);
        r.blankRounds = 0;
        await lib.reloadChat(slot.port).catch((e) => log(`${id}: reload failed: ${e.message}`));
      }
    }
    const obs = page === 'chat' ? { ok: true } : page === 'login' ? { ok: false, reason: 'qr' } : page === 'down' ? { ok: false, reason: 'cdp_down' } : { ok: false, reason: 'tab_missing' };
    await reportSession(id, slot, obs);
    // Planned move to direct (nick created "Trực tiếp, lấy cả tin cũ"): Zalo Web had its time to bring the history.
    if (page === 'chat' && slot.handoverAt && Date.now() >= Date.parse(slot.handoverAt)) {
      slot.handoverAt = null;
      persist();
      await handover(id).catch((e) => log(`${id}: planned move to direct failed: ${e.message}`));
    }
  }
}

// --- HTTP ------------------------------------------------------------------------------------------

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw Object.assign(new Error('body too large'), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

async function handle(req, res) {
  if (!lib.keyMatches(req.headers['x-farm-key'], cfg.key)) return send(res, 401, { error: 'unauthorized' });
  const url = new URL(req.url, 'http://farm');
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, slots: Object.keys(registry).length, max: cfg.max });
  const m = /^\/slots\/([^/]+)(?:\/([a-z-]+))?$/.exec(url.pathname);
  if (!m || !lib.isSlotId(m[1])) return send(res, 404, { error: 'not found' });
  const [, id, action] = m;
  const known = !!registry[id];

  if (req.method === 'POST' && action === 'start') {
    const { mode, handoverAfterMin } = await readJson(req);
    const slot = await ensureStarted(id, mode, { handoverAfterMin });
    return send(res, 200, { port: slot.port, mode: slot.mode ?? 'browser' });
  }
  if (!known) return send(res, 404, { error: 'no such slot' });
  if (req.method === 'GET' && !action) return send(res, 200, await state(id, url.searchParams.get('qr') === '1'));
  if (req.method === 'POST' && action === 'meta') {
    const { uid } = await readJson(req);
    if (uid !== null && !/^\d{1,30}$/.test(String(uid))) return send(res, 400, { error: 'bad uid' });
    const first = !registry[id].uid && uid !== null;
    registry[id].uid = uid === null ? null : String(uid);
    const slot = registry[id];
    // First binding of a nick created "Trực tiếp, lấy cả tin cũ": the move to direct is planned from now.
    if (first && slot.handoverAfterMin && !isDirect(slot)) slot.handoverAt = new Date(Date.now() + slot.handoverAfterMin * 60_000).toISOString();
    persist();
    if (isDirect(slot)) direct.kick(id);
    // Chrome: the extension's sender needs the uid; turn it on (or off) live.
    else if (await lib.tabsOf(slot.port)) {
      await lib.applyOptions(cfg, id, slot.port, { openUnread: !!slot.openUnread, uid: slot.uid }).catch((e) => log(`${id}: sender setup failed: ${e.message}`));
    }
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && action === 'options') {
    const body = await readJson(req);
    if (body.openUnread !== undefined && typeof body.openUnread !== 'boolean') return send(res, 400, { error: 'openUnread must be a boolean' });
    const slot = registry[id];
    if (body.openUnread !== undefined) slot.openUnread = body.openUnread;
    persist();
    if (isDirect(slot)) return send(res, 200, { ok: true });
    // Applied live when Chrome runs (extension storage); otherwise the next start passes them.
    const opts = { openUnread: !!slot.openUnread, uid: slot.uid };
    if (await lib.tabsOf(slot.port)) await lib.applyOptions(cfg, id, slot.port, opts);
    log(`${id}: openUnread=${opts.openUnread}`);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && action === 'reset' && isDirect(registry[id])) {
    rt(id).tracker = null;
    direct.reset(id);
    log(`${id}: direct session dropped, new QR`);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && action === 'reset') {
    rt(id).stopped = true;
    lib.wipeSlot(cfg, id);
    rt(id).tracker = null;
    log(`${id}: profile wiped, starting again on the QR page`);
    await ensureStarted(id);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && action === 'handover') {
    const slot = await handover(id);
    return send(res, 200, { ok: true, ...modeFacts({ ...slot, id }) });
  }
  if (req.method === 'POST' && action === 'rollback') {
    const slot = await rollback(id);
    return send(res, 200, { ok: true, ...modeFacts({ ...slot, id }) });
  }
  if (req.method === 'GET' && action === 'stickers') {
    if (!isDirect(registry[id])) return send(res, 409, { error: 'Nick này gửi qua Zalo Web' });
    const items = await direct.stickers(id, url.searchParams.get('q') || '').catch((e) => {
      log(`${id}: sticker search failed (${e && e.code ? e.code : 'error'})`);
      return [];
    });
    if (items === null) return send(res, 409, { error: 'Nick chưa kết nối' });
    return send(res, 200, { items });
  }
  if (req.method === 'POST' && action === 'sync-history' && isDirect(registry[id])) return send(res, 200, { requested: false });
  if (req.method === 'POST' && action === 'sync-history') {
    const clicked = await lib.requestHistorySync(registry[id].port).catch((e) => {
      log(`${id}: sync-history failed: ${e.message}`);
      return null;
    });
    return send(res, 200, { requested: !!clicked });
  }
  if (req.method === 'DELETE' && !action) {
    rt(id).stopped = true;
    if (isDirect(registry[id])) direct.forget(id);
    lib.wipeSlot(cfg, id);
    delete registry[id];
    runtime.delete(id);
    persist();
    log(`${id}: disconnected, profile deleted`);
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => send(res, e.status || 500, { error: e.message }));
});
server.listen(cfg.port, '127.0.0.1', () => log(`máy Zalo agent on 127.0.0.1:${cfg.port}, ${Object.keys(registry).length} slot(s), max ${cfg.max}`));

// Bring back every known slot after a container restart, then watch them.
(async () => {
  for (const id of Object.keys(registry)) await ensureStarted(id).catch((e) => log(`${id}: start failed: ${e.message}`));
  setInterval(() => void round().catch((e) => log(`round failed: ${e.message}`)), cfg.intervalMs);
})();
