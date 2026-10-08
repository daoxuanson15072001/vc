// node --test tools/chrome-driver/test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isSlotId, allocatePort, pageOf, uidsFromDbNames, loginView, keyMatches, loadRegistry, saveRegistry, optionFlags, zaloCookies, PORT_BASE } = require('../farm-lib');

const login = { type: 'page', url: 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F' };
const chat = { type: 'page', url: 'https://chat.zalo.me/' };
const sw = { type: 'service_worker', url: 'chrome-extension://x/background.js' };

test('slot ids: only zs_ + 16 hex (they become directory names)', () => {
  assert.ok(isSlotId('zs_0123456789abcdef'));
  for (const bad of ['zs_0123', '../etc', 'zs_0123456789ABCDEF', 'zs_0123456789abcdef/..', null]) assert.equal(isSlotId(bad), false);
});

test('ports: lowest free in the farm range, null when full', () => {
  assert.equal(allocatePort([]), PORT_BASE);
  assert.equal(allocatePort([PORT_BASE, PORT_BASE + 2]), PORT_BASE + 1);
  assert.equal(allocatePort([9500, 9501], 9500, 2), null);
});

test('page: down, login (QR), chat, other; the login page wins over a chat tab', () => {
  assert.equal(pageOf(null), 'down');
  assert.equal(pageOf([sw, login]), 'login');
  assert.equal(pageOf([chat, login]), 'login');
  assert.equal(pageOf([sw, chat]), 'chat');
  assert.equal(pageOf([sw, { type: 'page', url: 'about:blank' }]), 'other');
});

test('uids come from zdb_<uid> database names only', () => {
  assert.deepEqual(uidsFromDbNames(['zdb_222', 'msginfo_222', 'r_db_222', 'zdb_111', 'zdb_111', 'zdb_x', 'e2ee_222']), ['111', '222']);
  assert.deepEqual(uidsFromDbNames(undefined), []);
});

test('login view: expired beats QR, no QR and no expiry means scanned', () => {
  assert.equal(loginView({ qrVisible: true, expiredVisible: false }), 'qr');
  assert.equal(loginView({ qrVisible: true, expiredVisible: true }), 'expired');
  assert.equal(loginView({ qrVisible: false, expiredVisible: false }), 'scanned');
  assert.equal(loginView(null), 'unknown');
});

test('farm key: exact match only', () => {
  const key = 'k'.repeat(32);
  assert.ok(keyMatches(key, key));
  assert.equal(keyMatches('k'.repeat(31), key), false);
  assert.equal(keyMatches(undefined, key), false);
  assert.equal(keyMatches(key, ''), false);
});

test('registry: saved with owner-only permissions and read back', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'farm-'));
  try {
    saveRegistry(dir, { zs_0123456789abcdef: { port: PORT_BASE, uid: null } });
    assert.deepEqual(loadRegistry(dir), { zs_0123456789abcdef: { port: PORT_BASE, uid: null } });
    if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir, 'slots.json')).mode & 0o777, 0o600);
    assert.deepEqual(loadRegistry(path.join(dir, 'missing')), {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('extension options: the sender is on as soon as the nick is bound (no send switch), off before', () => {
  assert.deepEqual(optionFlags({ openUnread: false, uid: null }), ['--auto-sync-unread', 'off', '--sender', 'off']);
  assert.deepEqual(optionFlags({ openUnread: true, uid: '836061738303156140' }), ['--auto-sync-unread', 'on', '--sender', 'on', '--uid', '836061738303156140', '--all-threads']);
});

test('handover (P4): only zalo.me cookies go to the direct session, in the form zca-js reads', () => {
  const out = zaloCookies([
    { name: 'zpw_sek', value: 'v1', domain: '.chat.zalo.me', path: '/', expires: 1893456000, httpOnly: true, secure: true },
    { name: 'zpsid', value: 'v2', domain: 'id.zalo.me', path: '/', expires: -1, httpOnly: false, secure: true },
    { name: 'other', value: 'x', domain: '.example.test', path: '/', expires: -1 },
    { name: 'evil', value: 'x', domain: 'zalo.me.evil.test', path: '/', expires: -1 },
  ]);
  assert.deepEqual(out, [
    { key: 'zpw_sek', value: 'v1', domain: 'chat.zalo.me', path: '/', httpOnly: true, secure: true, expires: new Date(1893456000 * 1000).toISOString() },
    { key: 'zpsid', value: 'v2', domain: 'id.zalo.me', path: '/', httpOnly: false, secure: true, expires: 'Infinity' },
  ]);
  assert.deepEqual(zaloCookies(undefined), []);
});
