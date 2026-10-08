// Multi-profile Chrome driver: one Chrome for Testing profile per Zalo account.
// Profiles come from fleet.json (see fleet.example.json); FLEET_CONFIG overrides the path.
//
//   node fleet.js status                      state of every profile (port up, Zalo tab, login screen)
//   node fleet.js start [name...]             build the extension once, then (re)start the profiles
//   node fleet.js start --no-build [name...]
//   node fleet.js stop [name...]
//   node fleet.js config <name> -- <driver-config flags>   e.g. -- --sender on --uid 123 --only-threads g1
//
// Env: VCLINKS_API (overrides fleet.json "api"), VCLINKS_TOKEN (ingest token, stored in each
// started profile's extension; never printed). The shared driver on port 9333 is never touched.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { loadConfig, selectProfiles, tabsOf, classify, startProfile, stopProfile, configureProfile } = require('./fleet-lib');

const REPO = path.resolve(__dirname, '..', '..');

async function status(cfg, profiles) {
  for (const p of profiles) {
    const obs = classify(await tabsOf(p.port), cfg);
    console.log(`${p.name.padEnd(16)} :${p.port}  uid=${p.uid ?? '-'}  ${obs.ok ? 'ok' : obs.reason}${p.observeOnly ? '  (chỉ theo dõi)' : ''}`);
  }
}

(async () => {
  const argv = process.argv.slice(2);
  const cmd = argv.shift();
  const cfg = loadConfig();
  if (cmd === 'status') return status(cfg, selectProfiles(cfg, argv));
  if (cmd === 'start') {
    const noBuild = argv.includes('--no-build');
    const profiles = selectProfiles(cfg, argv.filter((a) => a !== '--no-build'));
    if (!noBuild) {
      execFileSync('pnpm', ['--filter', '@vclinks/shared', 'build'], { cwd: REPO, stdio: 'ignore' });
      execFileSync('pnpm', ['--filter', '@vclinks/extension', 'build'], { cwd: REPO, stdio: 'inherit' });
    }
    for (const p of profiles) {
      if (p.observeOnly) console.log(`${p.name}: chỉ theo dõi, bỏ qua`);
      else startProfile(cfg, p);
    }
    return;
  }
  if (cmd === 'stop') {
    for (const p of selectProfiles(cfg, argv)) if (!p.observeOnly) stopProfile(p);
    return;
  }
  if (cmd === 'config') {
    const [name, sep, ...rest] = argv;
    if (!name || sep !== '--') throw new Error('usage: node fleet.js config <name> -- <driver-config flags>');
    return configureProfile(cfg, selectProfiles(cfg, [name])[0], rest);
  }
  throw new Error('usage: node fleet.js status|start|stop|config (see the header of fleet.js)');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
