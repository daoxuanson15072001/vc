// Shared logic of the multi-profile Chrome driver (fleet.js, watchdog.js).
// One Chrome profile per Zalo account, each with its own CDP port, profile dir and
// extension copy. Pure functions here are unit-tested in test/fleet-lib.test.js.
// Never reads page contents, cookies or storage: only the tab list from /json/list.
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** Port of the shared single-profile driver (pnpm driver). The fleet never touches it. */
const SHARED_DRIVER_PORT = 9333;

const DEFAULTS = {
  api: 'http://localhost:3000',
  fleetDir: path.join(os.homedir(), '.vclinks-fleet'),
  intervalSec: 60,
  /** Consecutive bad rounds before a problem is reported (and acted on). */
  confirmRounds: 2,
  /** Extension alarm period (apps/extension/src/background.ts PERIOD_MIN). */
  syncPeriodMin: 15,
  /** Extension is "silent" when its last sync report is older than syncPeriodMin + silentMin. */
  silentMin: 10,
  /** Restart budget per profile, to avoid a restart loop when Chrome cannot come up. */
  maxRestartsPerHour: 3,
};

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,30}$/;

function configPath() {
  return process.env.FLEET_CONFIG || path.join(__dirname, 'fleet.json');
}

/** Reads and validates the fleet config; VCLINKS_API overrides `api`. */
function loadConfig(file = configPath()) {
  if (!fs.existsSync(file)) throw new Error(`no fleet config at ${file} (copy fleet.example.json to fleet.json)`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return normalizeConfig(raw, process.env);
}

function normalizeConfig(raw, env = {}) {
  const cfg = { ...DEFAULTS, ...raw, profiles: [] };
  if (env.VCLINKS_API) cfg.api = env.VCLINKS_API;
  cfg.fleetDir = cfg.fleetDir.replace(/^~(?=\/|$)/, os.homedir());
  const names = new Set();
  const ports = new Set();
  for (const p of raw.profiles ?? []) {
    if (!NAME_RE.test(p.name ?? '')) throw new Error(`bad profile name "${p.name}" (a-z, 0-9, -)`);
    const port = Number(p.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`profile ${p.name}: bad port ${p.port}`);
    if (port === SHARED_DRIVER_PORT) throw new Error(`profile ${p.name}: port ${SHARED_DRIVER_PORT} belongs to the shared driver (pnpm driver)`);
    if (names.has(p.name)) throw new Error(`duplicate profile name ${p.name}`);
    if (ports.has(port)) throw new Error(`duplicate port ${port}`);
    if (p.uid !== undefined && !/^\d{1,30}$/.test(String(p.uid))) throw new Error(`profile ${p.name}: uid must be the Zalo uid (digits)`);
    names.add(p.name);
    ports.add(port);
    cfg.profiles.push({
      name: p.name,
      port,
      uid: p.uid === undefined ? null : String(p.uid),
      /** Watch and report only; never restart (e.g. a profile someone else drives). */
      observeOnly: !!p.observeOnly,
      profileDir: path.join(cfg.fleetDir, p.name, 'profile'),
      extDir: path.join(cfg.fleetDir, p.name, 'ext'),
    });
  }
  return cfg;
}

/** Picks profiles by name; no names = all. */
function selectProfiles(cfg, names) {
  if (!names.length) return cfg.profiles;
  return names.map((n) => {
    const p = cfg.profiles.find((x) => x.name === n);
    if (!p) throw new Error(`no profile "${n}" in fleet config`);
    return p;
  });
}

/**
 * One observation of a profile from its CDP tab list.
 * @param tabs  /json/list result, or null when the port did not answer
 * @param lastSyncAt  ISO time of the extension's last sync report (from the API), or null
 * @returns {{ok: true} | {ok: false, reason: string, detail?: string}}
 */
function classify(tabs, { now = Date.now(), lastSyncAt = null, syncPeriodMin, silentMin } = {}) {
  if (!tabs) return { ok: false, reason: 'cdp_down' };
  const pages = tabs.filter((t) => t.type === 'page');
  // Logged out: Zalo redirects chat.zalo.me to its login (QR) page.
  if (pages.some((t) => /^https:\/\/id\.zalo\.me\//.test(t.url))) return { ok: false, reason: 'qr' };
  if (!pages.some((t) => /^https:\/\/chat\.zalo\.me(\/|$)/.test(t.url))) return { ok: false, reason: 'tab_missing' };
  if (lastSyncAt) {
    const ageMin = (now - Date.parse(lastSyncAt)) / 60000;
    if (ageMin > syncPeriodMin + silentMin) return { ok: false, reason: 'extension_silent', detail: `last sync ${Math.round(ageMin)} min ago` };
  }
  return { ok: true };
}

/**
 * Debounces observations: a problem counts only after `confirmRounds` identical bad
 * rounds; one good round clears it. Returns the new tracker state and the state to report.
 */
function step(prev, obs, confirmRounds) {
  const st = prev ?? { confirmed: null, pending: null, count: 0 };
  if (obs.ok) return { confirmed: { ok: true }, pending: null, count: 0 };
  const same = st.pending && st.pending.reason === obs.reason;
  const count = same ? st.count + 1 : 1;
  const confirmed = count >= confirmRounds ? obs : st.confirmed;
  return { confirmed, pending: obs, count };
}

/** What to do about a confirmed problem. `qr` needs a person (never log in automatically, §12.2). */
function actionFor(reason) {
  if (reason === 'tab_missing') return 'open_tab';
  if (reason === 'cdp_down' || reason === 'extension_silent') return 'restart';
  return 'notify';
}

/** Sliding one-hour restart budget. */
function canRestart(history, now, maxPerHour) {
  return history.filter((t) => now - t < 3600_000).length < maxPerHour;
}

async function fetchJson(url, { timeoutMs = 5000, method = 'GET', headers, body } = {}) {
  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.replace(/\?.*/, '')}`);
  return res.json();
}

/** Tab list of a profile, or null when Chrome is not answering (down or hung). */
async function tabsOf(port) {
  try {
    return await fetchJson(`http://127.0.0.1:${port}/json/list`);
  } catch {
    return null;
  }
}

// --- Side effects: start / stop / configure one profile -------------------------

const HERE = __dirname;

function profileEnv(cfg, p) {
  return {
    ...process.env,
    DRIVER_PORT: String(p.port),
    DRIVER_PROFILE: p.profileDir,
    DRIVER_EXT: p.extDir,
    DRIVER_NAME: `VClinks · ${p.name} :${p.port}`,
    VCLINKS_API: cfg.api,
  };
}

/** (Re)starts one profile with the existing extension build, then points its extension at the API. */
function startProfile(cfg, p) {
  fs.mkdirSync(path.dirname(p.profileDir), { recursive: true });
  const env = profileEnv(cfg, p);
  execFileSync(path.join(HERE, 'driver.sh'), ['--no-build'], { env: { ...env, DRIVER_NO_CONFIG: '1' }, stdio: 'inherit' });
  configureProfile(cfg, p, ['--api', cfg.api]);
}

function configureProfile(cfg, p, args) {
  const r = spawnSync(process.execPath, [path.join(HERE, 'driver-config.js'), ...args], {
    env: profileEnv(cfg, p),
    encoding: 'utf8',
  });
  if (r.status !== 0 && r.status !== 2) throw new Error(`driver-config failed for ${p.name}: ${r.stderr.trim()}`);
  const out = JSON.parse(r.stdout);
  console.log(`${p.name}: api=${out.apiBaseUrl} token=${out.hasToken ? 'có' : 'CHƯA'} sender=${out.sender?.enabled ? 'bật' : 'tắt'}${out.me?.error ? ` (API: ${out.me.error})` : ''}`);
}

function stopProfile(p) {
  const ps = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
  const pids = ps
    .split('\n')
    .filter((l) => l.includes(`--user-data-dir=${p.profileDir} `) && !l.includes('--type='))
    .map((l) => Number(l.trim().split(/\s+/)[0]));
  for (const pid of pids) process.kill(pid, 'SIGTERM');
  console.log(`${p.name}: ${pids.length ? `stopped (pid ${pids.join(',')})` : 'not running'}`);
}

module.exports = {
  startProfile,
  stopProfile,
  configureProfile,
  DEFAULTS,
  SHARED_DRIVER_PORT,
  configPath,
  loadConfig,
  normalizeConfig,
  selectProfiles,
  classify,
  step,
  actionFor,
  canRestart,
  fetchJson,
  tabsOf,
};
