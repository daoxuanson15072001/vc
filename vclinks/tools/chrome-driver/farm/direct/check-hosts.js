// Image build check of the máy Zalo direct mode (docs/01-quan-ly-du-an/ke-hoach-zalo-truc-tiep-zca-js.md, P5):
// the code of zca-js may only name Zalo hosts, plus npm's registry for the library's update check, which the agent
// turns off (checkUpdate: false). Hosts Zalo hands out at login (service map, websocket) are not in the code and
// are not checked here. A new version that names any other host fails the build until someone has read its code.
// Usage: node check-hosts.js [package dir, default node_modules/zca-js]
const fs = require('node:fs');
const path = require('node:path');

const ALLOWED = [/(^|\.)zalo\.me$/, /^registry\.npmjs\.org$/];
// A literal host only: `https://${domain}` (built from cookie domains or Zalo's answers) does not match.
const URL_RE = /\b(?:https?|wss?):\/\/([A-Za-z0-9.-]+)/g;

/** Hosts named in a piece of code, sorted, without duplicates. */
function hostsIn(text) {
  const out = new Set();
  for (const m of String(text).matchAll(URL_RE)) out.add(m[1].toLowerCase().replace(/\.$/, ''));
  return [...out].sort();
}

/** The hosts that are not Zalo's (or the allowed registry). */
function unexpectedHosts(hosts) {
  return hosts.filter((h) => !ALLOWED.some((re) => re.test(h)));
}

function codeFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') out.push(...codeFiles(p));
    } else if (/\.(c|m)?js$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, 'node_modules', 'zca-js'));
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const hosts = new Set();
  for (const f of codeFiles(root)) for (const h of hostsIn(fs.readFileSync(f, 'utf8'))) hosts.add(h);
  const all = [...hosts].sort();
  const bad = unexpectedHosts(all);
  if (bad.length) {
    console.error(`zca-js ${version}: its code names hosts that are not Zalo's: ${bad.join(', ')}. Read the new code before allowing them in tools/chrome-driver/farm/direct/check-hosts.js.`);
    process.exit(1);
  }
  console.log(`zca-js ${version}: ${all.length} host(s) named in its code, all allowed: ${all.join(', ')}`);
}

module.exports = { hostsIn, unexpectedHosts };
