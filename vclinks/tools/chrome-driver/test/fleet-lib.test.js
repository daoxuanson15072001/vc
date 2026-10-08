// node --test tools/chrome-driver/test
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeConfig, classify, step, actionFor, canRestart, DEFAULTS } = require('../fleet-lib');

const zalo = { type: 'page', url: 'https://chat.zalo.me/' };
const login = { type: 'page', url: 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F' };
const sw = { type: 'service_worker', url: 'chrome-extension://x/background.js' };
const opts = { syncPeriodMin: 15, silentMin: 10, now: Date.parse('2026-10-04T10:00:00Z') };

test('config: defaults, per-profile dirs, and the shared 9333 driver is off limits', () => {
  const cfg = normalizeConfig({ fleetDir: '/srv/fleet', profiles: [{ name: 'nick1', port: 9341, uid: 123 }] });
  assert.equal(cfg.intervalSec, DEFAULTS.intervalSec);
  assert.deepEqual(cfg.profiles[0], {
    name: 'nick1', port: 9341, uid: '123', observeOnly: false,
    profileDir: '/srv/fleet/nick1/profile', extDir: '/srv/fleet/nick1/ext',
  });
  assert.equal(normalizeConfig({ profiles: [] }, { VCLINKS_API: 'https://api.x' }).api, 'https://api.x');
  assert.throws(() => normalizeConfig({ profiles: [{ name: 'a', port: 9333 }] }), /shared driver/);
  assert.throws(() => normalizeConfig({ profiles: [{ name: 'a', port: 9341 }, { name: 'b', port: 9341 }] }), /duplicate port/);
  assert.throws(() => normalizeConfig({ profiles: [{ name: 'A B', port: 9341 }] }), /bad profile name/);
});

test('classify: down, login screen, missing tab, silent extension, ok', () => {
  assert.deepEqual(classify(null, opts), { ok: false, reason: 'cdp_down' });
  assert.equal(classify([login, sw], opts).reason, 'qr');
  assert.equal(classify([sw, { type: 'page', url: 'about:blank' }], opts).reason, 'tab_missing');
  assert.equal(classify([zalo], { ...opts, lastSyncAt: '2026-10-04T09:30:00Z' }).reason, 'extension_silent');
  assert.deepEqual(classify([zalo], { ...opts, lastSyncAt: '2026-10-04T09:40:00Z' }), { ok: true });
  assert.deepEqual(classify([zalo], opts), { ok: true });
});

test('step: a problem is confirmed after N identical rounds, one good round clears it', () => {
  const bad = { ok: false, reason: 'qr' };
  let s = step(null, { ok: true }, 2);
  s = step(s, bad, 2);
  assert.deepEqual(s.confirmed, { ok: true });
  s = step(s, { ok: false, reason: 'cdp_down' }, 2);
  assert.deepEqual(s.confirmed, { ok: true }, 'a different reason restarts the count');
  s = step(s, { ok: false, reason: 'cdp_down' }, 2);
  assert.equal(s.confirmed.reason, 'cdp_down');
  s = step(s, { ok: true }, 2);
  assert.deepEqual(s.confirmed, { ok: true });
});

test('actions and restart budget', () => {
  assert.equal(actionFor('qr'), 'notify');
  assert.equal(actionFor('tab_missing'), 'open_tab');
  assert.equal(actionFor('cdp_down'), 'restart');
  assert.equal(actionFor('extension_silent'), 'restart');
  const now = 10_000_000;
  assert.equal(canRestart([now - 10, now - 20], now, 3), true);
  assert.equal(canRestart([now - 10, now - 20, now - 30], now, 3), false);
  assert.equal(canRestart([now - 3_700_000, now - 10, now - 20], now, 3), true);
});
