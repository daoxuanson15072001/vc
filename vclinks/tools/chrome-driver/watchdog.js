// Watchdog of the multi-profile Chrome driver (fleet.json). Every intervalSec it checks each
// profile through its CDP tab list only (no page content):
//   - port not answering (Chrome down or hung)  → cdp_down          → restart the profile
//   - no chat.zalo.me tab                        → tab_missing       → open the tab again
//   - Zalo login (QR) page                       → qr                → report; a person scans the QR
//   - extension's last sync report too old       → extension_silent  → restart the profile
// A problem counts after confirmRounds identical rounds (default 2 × 60 s). Each round it reports
// the confirmed state of profiles that have a uid to POST /api/accounts/:uid/session, which
// records account.session_lost / account.session_restored. It never logs in or types an OTP (§12.2).
//
//   VCLINKS_TOKEN=<ingest token> node watchdog.js            run forever
//   VCLINKS_TOKEN=<ingest token> node watchdog.js --once     one round (for tests)
//
// Env: VCLINKS_API overrides fleet.json "api"; WATCHDOG_SOURCE names this machine (default: hostname).
const os = require('node:os');
const { loadConfig, classify, step, actionFor, canRestart, fetchJson, tabsOf, startProfile } = require('./fleet-lib');

const cfg = loadConfig();
const token = process.env.VCLINKS_TOKEN;
const source = `watchdog@${process.env.WATCHDOG_SOURCE || os.hostname()}`.slice(0, 100);
const once = process.argv.includes('--once');
/** Per profile: debounce tracker, last sync seen by the API, restart times. */
const mem = new Map(cfg.profiles.map((p) => [p.name, { tracker: null, lastSyncAt: null, restarts: [], lastLogged: null }]));

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

async function report(p, confirmed) {
  if (!p.uid || !token || !confirmed) return null;
  const body = confirmed.ok
    ? { state: 'ok', source }
    : { state: 'lost', reason: confirmed.reason, source, ...(confirmed.detail ? { detail: confirmed.detail } : {}) };
  try {
    return await fetchJson(`${cfg.api}/api/accounts/${p.uid}/session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    log(`${p.name}: report failed: ${e.message}`);
    return null;
  }
}

async function act(p, m, reason) {
  const action = actionFor(reason);
  if (action === 'notify' || p.observeOnly) {
    if (reason === 'qr') log(`${p.name}: Zalo đang ở màn đăng nhập — cần người trực quét lại QR`);
    return;
  }
  if (action === 'open_tab') {
    await fetch(`http://127.0.0.1:${p.port}/json/new?https://chat.zalo.me`, { method: 'PUT' }).catch(() => undefined);
    log(`${p.name}: reopened chat.zalo.me tab`);
    return;
  }
  const now = Date.now();
  if (!canRestart(m.restarts, now, cfg.maxRestartsPerHour)) {
    log(`${p.name}: restart budget used up (${cfg.maxRestartsPerHour}/h); waiting for a person`);
    return;
  }
  m.restarts.push(now);
  log(`${p.name}: restarting (${reason})`);
  try {
    startProfile(cfg, p);
  } catch (e) {
    log(`${p.name}: restart failed: ${e.message}`);
  }
}

async function round() {
  for (const p of cfg.profiles) {
    const m = mem.get(p.name);
    const obs = classify(await tabsOf(p.port), { ...cfg, lastSyncAt: m.lastSyncAt });
    const wasConfirmed = m.tracker?.confirmed;
    m.tracker = step(m.tracker, obs, cfg.confirmRounds);
    const c = m.tracker.confirmed;
    const label = c ? (c.ok ? 'ok' : c.reason) : 'checking';
    if (label !== m.lastLogged) {
      log(`${p.name} (:${p.port}): ${label}${c && !c.ok && c.detail ? ` — ${c.detail}` : ''}`);
      m.lastLogged = label;
    }
    const res = await report(p, c);
    if (res) m.lastSyncAt = res.lastSyncAt;
    // Act once when a problem gets confirmed, then again on every further confirmed bad round
    // only for restart-type problems (bounded by the restart budget).
    if (c && !c.ok && m.tracker.count >= cfg.confirmRounds) {
      const fresh = !wasConfirmed || wasConfirmed.ok || wasConfirmed.reason !== c.reason;
      if (fresh || actionFor(c.reason) !== 'notify') await act(p, m, c.reason);
      // After acting, start counting again so the next action waits confirmRounds rounds.
      m.tracker = { ...m.tracker, count: 0 };
    }
  }
}

(async () => {
  if (!cfg.profiles.length) throw new Error('fleet.json has no profiles');
  if (!token) log('VCLINKS_TOKEN not set: watching without reporting to the API');
  log(`watchdog ${source}: ${cfg.profiles.length} profile(s), every ${cfg.intervalSec}s, API ${cfg.api}`);
  do {
    await round();
    if (!once) await new Promise((r) => setTimeout(r, cfg.intervalSec * 1000));
  } while (!once);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
