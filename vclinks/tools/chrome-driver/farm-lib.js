// "Máy Zalo" (docs/01-quan-ly-du-an/ke-hoach-zalo-ca-nhan-quet-qr.md): one Chrome profile per personal Zalo nick,
// connected by scanning a QR the Dashboard shows. Shared logic of farm-agent.js; pure functions are unit-tested in
// test/farm-lib.test.js.
//
// What the farm reads from Chrome, and nothing else:
//   - the tab list (/json/list), like the watchdog;
//   - on the Zalo LOGIN page only (id.zalo.me): whether the QR / "Mã QR hết hạn" block is visible, and a PNG of
//     the QR block — never a screenshot of chat.zalo.me;
//   - on chat.zalo.me: the NAMES of the IndexedDB databases (zdb_<uid>) to learn which account logged in;
//   - only when a nick moves to the direct mode (handover, plan P4): its zalo.me cookies, `z_uuid` and userAgent,
//     handed straight to the direct session (saved encrypted, CLAUDE.md §12.2 second exception), never logged.
// Never e2ee stores or message content, and no cookie or localStorage otherwise (§12.2, §12.3). It never logs in by
// itself, never types a password or OTP and never solves a CAPTCHA: a person scans the QR with the nick's phone.
const { execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const SLOT_ID_RE = /^zs_[a-f0-9]{16}$/;
/** CDP ports of farm slots: away from the shared driver (9333), the fleet (934x) and the agent (9400). */
const PORT_BASE = 9451;
const PORT_SPAN = 49;

const LOGIN_URL_RE = /^https:\/\/id\.zalo\.me\//;
const CHAT_URL_RE = /^https:\/\/chat\.zalo\.me(\/|$)/;

const isSlotId = (id) => typeof id === 'string' && SLOT_ID_RE.test(id);

/** Lowest free CDP port for a new slot, or null when the farm range is full. */
function allocatePort(used, base = PORT_BASE, span = PORT_SPAN) {
  const taken = new Set(used);
  for (let p = base; p < base + span; p++) if (!taken.has(p)) return p;
  return null;
}

/** Where the slot's Zalo tab is: down (Chrome not answering), login (QR page), chat (logged in), other. */
function pageOf(tabs) {
  if (!tabs) return 'down';
  const pages = tabs.filter((t) => t.type === 'page');
  if (pages.some((t) => LOGIN_URL_RE.test(t.url))) return 'login';
  if (pages.some((t) => CHAT_URL_RE.test(t.url))) return 'chat';
  return 'other';
}

/** Zalo uids from IndexedDB database names (`zdb_<uid>`), sorted and unique. */
function uidsFromDbNames(names) {
  const out = new Set();
  for (const n of names ?? []) {
    const m = /^zdb_(\d{1,30})$/.exec(String(n));
    if (m) out.add(m[1]);
  }
  return [...out].sort();
}

/** Login page state from the DOM probe: QR shown, QR expired, or scanned (QR gone, waiting for the phone). */
function loginView(probe) {
  if (!probe) return 'unknown';
  if (probe.expiredVisible) return 'expired';
  if (probe.qrVisible) return 'qr';
  return 'scanned';
}

/** Constant-time comparison of the shared farm key. */
function keyMatches(given, expected) {
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Registry of slots (id → port, uid) ----------------------------------------------------------

function registryPath(farmDir) {
  return path.join(farmDir, 'slots.json');
}

function loadRegistry(farmDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(registryPath(farmDir), 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveRegistry(farmDir, reg) {
  fs.mkdirSync(farmDir, { recursive: true, mode: 0o700 });
  const tmp = `${registryPath(farmDir)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(reg, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, registryPath(farmDir));
}

const slotDirs = (farmDir, id) => ({ dir: path.join(farmDir, id), profileDir: path.join(farmDir, id, 'profile'), extDir: path.join(farmDir, id, 'ext') });

// --- Chrome side effects --------------------------------------------------------------------------

function slotEnv(cfg, id, port) {
  const d = slotDirs(cfg.farmDir, id);
  return {
    ...process.env,
    DRIVER_PORT: String(port),
    DRIVER_PROFILE: d.profileDir,
    DRIVER_EXT: d.extDir,
    DRIVER_NAME: `VClinks · máy Zalo ${id} :${port}`,
    DRIVER_URL: 'https://chat.zalo.me',
    VCLINKS_API: cfg.api,
  };
}

/**
 * driver-config flags for a slot's options. The sender sends the messages approved on the Dashboard as soon as the
 * nick is bound (uid known), in every conversation: no per-nick send switch since 06/10/2026 (dev002). Before the
 * binding it stays off, so nothing goes out from an account the API has not checked.
 */
function optionFlags(opts) {
  const flags = ['--auto-sync-unread', opts.openUnread ? 'on' : 'off'];
  if (opts.uid) flags.push('--sender', 'on', '--uid', String(opts.uid), '--all-threads');
  else flags.push('--sender', 'off');
  return flags;
}

/** (Re)starts the slot's Chrome on Zalo Web with the extension, then points the extension at the API with the farm token. */
async function startSlot(cfg, id, port, opts = {}) {
  const d = slotDirs(cfg.farmDir, id);
  fs.mkdirSync(d.dir, { recursive: true, mode: 0o700 });
  const env = slotEnv(cfg, id, port);
  // Async: other slots keep answering while one Chrome starts.
  await promisify(execFile)(path.join(HERE, 'driver.sh'), ['--no-build'], { env: { ...env, DRIVER_NO_CONFIG: '1' }, timeout: 90_000 });
  try {
    await promisify(execFile)(process.execPath, [path.join(HERE, 'driver-config.js'), '--api', cfg.api, ...optionFlags(opts)], {
      env: { ...env, VCLINKS_TOKEN: cfg.token ?? '' },
      timeout: 60_000,
    });
  } catch (e) {
    // Exit 2 = the API answered an error to /api/me (e.g. not up yet): the profile is still configured.
    if (e.code !== 2) throw new Error(`driver-config failed: ${String(e.stderr || e.message).trim().slice(0, 300)}`);
  }
}

/** Applies per-nick options to the running extension (storage change: no restart needed). */
async function applyOptions(cfg, id, port, opts) {
  await promisify(execFile)(process.execPath, [path.join(HERE, 'driver-config.js'), ...optionFlags(opts)], {
    env: { ...slotEnv(cfg, id, port), VCLINKS_TOKEN: '' },
    timeout: 60_000,
  }).catch((e) => {
    // Exit 2 = /api/me answered an error: the option was still written.
    if (e.code !== 2) throw new Error(`driver-config failed: ${String(e.stderr || e.message).trim().slice(0, 300)}`);
  });
}

/** Stops the slot's Chrome (main process; helpers follow). */
function stopSlot(cfg, id) {
  const { profileDir } = slotDirs(cfg.farmDir, id);
  const ps = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
  const pids = ps
    .split('\n')
    .filter((l) => l.includes(`--user-data-dir=${profileDir} `) && !l.includes('--type='))
    .map((l) => Number(l.trim().split(/\s+/)[0]))
    .filter((n) => Number.isInteger(n) && n > 0);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  return pids.length;
}

/** Stops the slot and deletes its profile: the Zalo session on this server is gone for good. */
function wipeSlot(cfg, id) {
  stopSlot(cfg, id);
  const { dir } = slotDirs(cfg.farmDir, id);
  // Chrome may take a moment to exit and release its files.
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      execFileSync('sleep', ['1']);
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

async function tabsOf(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function openTab(port, url) {
  await fetch(`http://127.0.0.1:${port}/json/new?${url}`, { method: 'PUT', signal: AbortSignal.timeout(4000) }).catch(() => undefined);
}

async function withPage(port, urlRe, fn) {
  const { chromium } = require('playwright-core');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 8000 });
  try {
    const page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => urlRe.test(p.url()));
    if (!page) return null;
    return await fn(page);
  } finally {
    // Disconnects only: Chrome keeps running.
    await browser.close().catch(() => undefined);
  }
}

/** Visible QR / expired blocks of the login page (no other DOM is read). */
function probeLoginDom() {
  const shown = (el) => {
    if (!el) return false;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 40 && r.height > 40;
  };
  const qr = document.querySelector('.qrcode .qr-container svg') || document.querySelector('.qr-container svg') || document.querySelector('.qrcode svg');
  const expired = document.querySelector('.qrcode-expired');
  const expiredVisible = !!expired && shown(expired) && expired.getBoundingClientRect().height > 0;
  return { qrVisible: shown(qr), expiredVisible };
}

/**
 * Login page: state, optional refresh of an expired QR ("Lấy mã mới") and a PNG of the QR block.
 * Returns null when the slot is not on the login page.
 */
async function captureLogin(port, { wantQr = true, refresh = true } = {}) {
  return withPage(port, LOGIN_URL_RE, async (page) => {
    let probe = await page.evaluate(probeLoginDom);
    if (loginView(probe) === 'expired' && refresh) {
      await page.locator('.qrcode-expired a').first().click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      probe = await page.evaluate(probeLoginDom);
    }
    const view = loginView(probe);
    let png = null;
    if (wantQr && view === 'qr') {
      const target = page.locator('.qrcode .qr-container, .qr-container').first();
      const buf = await target.screenshot({ timeout: 4000, animations: 'disabled' }).catch(() => null);
      if (buf) png = `data:image/png;base64,${buf.toString('base64')}`;
    }
    return { view, png };
  });
}

/** Names of the IndexedDB databases of the chat page → uids. Null when not on chat.zalo.me. */
async function chatUids(port) {
  return withPage(port, CHAT_URL_RE, async (page) => {
    const names = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : []));
    return uidsFromDbNames(names);
  });
}

/**
 * Number of conversation items Zalo Web rendered in its sidebar (a count of elements, no text). Zalo Web sometimes
 * stays a blank white page after Chrome restarts; 0 for a while means the tab needs a reload. Null when not on chat.
 */
async function chatRendered(port) {
  return withPage(port, CHAT_URL_RE, (page) => page.evaluate(() => document.querySelectorAll('[anim-data-id]').length));
}

/** Reloads the Zalo Web tab (the login stays in the profile). */
async function reloadChat(port) {
  return withPage(port, CHAT_URL_RE, (page) => page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 }).then(() => true));
}

/** Cookies of zalo.me and its subdomains, in the form zca-js reads (tough-cookie JSON: key, ISO expiry). */
function zaloCookies(cookies) {
  return (Array.isArray(cookies) ? cookies : [])
    .filter((c) => c && c.name && /(^|\.)zalo\.me$/i.test(String(c.domain || '').replace(/^\./, '')))
    .map((c) => ({
      key: String(c.name),
      value: String(c.value ?? ''),
      domain: String(c.domain).replace(/^\./, ''),
      path: c.path || '/',
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
      expires: Number(c.expires) > 0 ? new Date(Number(c.expires) * 1000).toISOString() : 'Infinity',
    }));
}

/**
 * The Zalo Web session of the slot's Chrome: cookies of zalo.me, the device id `z_uuid` (zca-js "imei") and the
 * userAgent, to move the nick to a direct zca-js session (plan P4; CLAUDE.md §12.2, second exception). It never leaves
 * the máy Zalo and is never logged. Null when the slot is not on chat.zalo.me or something is missing.
 */
async function readZaloSession(port) {
  return withPage(port, CHAT_URL_RE, async (page) => {
    const cookie = zaloCookies(await page.context().cookies());
    const { imei, userAgent } = await page.evaluate(() => ({ imei: localStorage.getItem('z_uuid'), userAgent: navigator.userAgent }));
    const id = String(imei || '').replace(/^"|"$/g, '');
    if (!cookie.length || !id || !userAgent) return null;
    return { cookie, imei: id, userAgent };
  });
}

/** True while the slot's Chrome profile is on disk (a direct slot keeps it some days to go back to Zalo Web). */
function hasChromeProfile(cfg, id) {
  return fs.existsSync(slotDirs(cfg.farmDir, id).profileDir);
}

/** Deletes only the Chrome profile and extension copy of a slot (its direct session files stay). */
function wipeChrome(cfg, id) {
  stopSlot(cfg, id);
  const { profileDir, extDir } = slotDirs(cfg.farmDir, id);
  for (const d of [profileDir, extDir]) fs.rmSync(d, { recursive: true, force: true });
}

/** Labels Zalo Web uses for "sync recent messages from the phone" (verified on a real login, see the ops doc). */
const SYNC_LABELS = [/Đồng bộ ngay/i, /Đồng bộ tin nhắn/i];

/**
 * Asks the phone to send older messages, like Zalo Web's "Đồng bộ tin nhắn": clicks the first visible matching
 * control of the chat page. The person then taps "Đồng bộ ngay" on the phone. Best effort: returns what it clicked.
 */
async function requestHistorySync(port) {
  return withPage(port, CHAT_URL_RE, async (page) => {
    for (const label of SYNC_LABELS) {
      const target = page.getByText(label).first();
      if (await target.isVisible().catch(() => false)) {
        await target.click({ timeout: 3000 });
        await page.waitForTimeout(800);
        // A confirmation dialog may follow ("Đồng bộ ngay" / "Thực hiện").
        for (const confirm of [/^Đồng bộ ngay$/i, /^Thực hiện$/i, /^Đồng bộ$/i]) {
          const btn = page.getByRole('button', { name: confirm }).first();
          if (await btn.isVisible().catch(() => false)) {
            await btn.click({ timeout: 3000 }).catch(() => undefined);
            break;
          }
        }
        return String(label);
      }
    }
    return null;
  });
}

module.exports = {
  zaloCookies,
  readZaloSession,
  hasChromeProfile,
  wipeChrome,
  PORT_BASE,
  PORT_SPAN,
  isSlotId,
  allocatePort,
  pageOf,
  uidsFromDbNames,
  loginView,
  keyMatches,
  loadRegistry,
  saveRegistry,
  slotDirs,
  startSlot,
  applyOptions,
  optionFlags,
  stopSlot,
  wipeSlot,
  tabsOf,
  openTab,
  captureLogin,
  chatUids,
  chatRendered,
  reloadChat,
  requestHistorySync,
};
