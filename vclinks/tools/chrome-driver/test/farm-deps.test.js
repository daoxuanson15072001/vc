// node --test tools/chrome-driver/test/*.test.js
// Plan P5 (docs/01-quan-ly-du-an/ke-hoach-zalo-truc-tiep-zca-js.md): the library of the direct mode is pinned,
// locked by hash, installed without scripts, and its code may only name Zalo hosts (checked at image build).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hostsIn, unexpectedHosts } = require('../farm/direct/check-hosts');

const DIRECT = path.join(__dirname, '..', 'farm', 'direct');

test('zca-js: one exact version, locked by sha512 from the npm registry, no install scripts', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(DIRECT, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(pkg.dependencies), ['zca-js']);
  assert.match(pkg.dependencies['zca-js'], /^\d+\.\d+\.\d+$/, 'an exact version, never a range');
  const lock = JSON.parse(fs.readFileSync(path.join(DIRECT, 'package-lock.json'), 'utf8'));
  assert.ok(lock.lockfileVersion >= 2);
  assert.equal(lock.packages['node_modules/zca-js'].version, pkg.dependencies['zca-js']);
  const deps = Object.entries(lock.packages).filter(([k]) => k);
  assert.ok(deps.length > 1);
  for (const [name, p] of deps) {
    assert.match(p.resolved || '', /^https:\/\/registry\.npmjs\.org\//, `${name} comes from the npm registry`);
    assert.match(p.integrity || '', /^sha512-/, `${name} is locked by hash`);
    assert.notEqual(p.hasInstallScript, true, `${name} has no install script`);
  }
});

test('the máy Zalo image installs it with npm ci, without scripts, then checks the hosts its code names', () => {
  const docker = fs.readFileSync(path.join(DIRECT, '..', 'Dockerfile'), 'utf8');
  const step = docker.split('\n').find((l) => l.startsWith('RUN') && l.includes('farm/direct'));
  assert.ok(step, 'a RUN step for farm/direct');
  assert.match(step, /npm ci\b/);
  assert.match(step, /--ignore-scripts/);
  assert.match(step, /node check-hosts\.js/);
  assert.ok(docker.split('\n').some((l) => l.startsWith('COPY') && l.includes('farm/direct/check-hosts.js')), 'the check is in the image before it runs');
});

test('host check: Zalo hosts and the (disabled) update check pass; anything else is named', () => {
  const code = [
    'const a = "https://id.zalo.me/account"; const b = `https://wpa.chat.zalo.me/api/login/getServerInfo`;',
    'const c = "https://registry.npmjs.org/zca-js"; const d = `https://${domain}`; const e = "wss://ws1-msg.chat.zalo.me/";',
    '// docs: https://developers.zalo.me/docs',
  ].join('\n');
  assert.deepEqual(hostsIn(code), ['developers.zalo.me', 'id.zalo.me', 'registry.npmjs.org', 'wpa.chat.zalo.me', 'ws1-msg.chat.zalo.me']);
  assert.deepEqual(unexpectedHosts(hostsIn(code)), []);
  assert.deepEqual(unexpectedHosts(hostsIn('fetch("https://collect.example.test/x"); fetch("http://zalo.me.evil.test/y")')), ['collect.example.test', 'zalo.me.evil.test']);
});
