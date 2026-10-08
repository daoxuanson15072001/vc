// Configure the VClinks extension running in the Chrome driver (chrome.storage.local),
// without touching the popup UI. All flags are optional; nothing given = --show.
//
//   node driver-config.js --show
//   node driver-config.js --api http://localhost:3000
//   VCLINKS_TOKEN=... node driver-config.js --api http://localhost:3000    (ingest token, from env)
//   node driver-config.js --sender on --uid 476214826876503713 --only-threads g691...,g123...
//   node driver-config.js --friend-targets 0342808374,6497853381290224663   # who friend commands may touch (empty/none = nobody)
//   node driver-config.js --all-threads        # remove the thread whitelist (owner's decision only)
//   node driver-config.js --sender off
//   node driver-config.js --auto-sync off   # stop opening conversations while idle (on by default)
//   node driver-config.js --auto-sync-unread on   # also open conversations with unread messages (sender sees "Đã xem"; máy Zalo option)
//
// The token is never printed. --show also calls GET /api/me through the worker
// to prove the API address and token work from inside the extension.
const { connect, serviceWorker, EXT_ID } = require('./lib');

function parseArgs(argv) {
  const out = { show: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${a}`);
      return v;
    };
    if (a === '--show') out.show = true;
    else if (a === '--api') out.api = next();
    else if (a === '--token') out.token = next();
    else if (a === '--sender') out.sender = next();
    else if (a === '--uid') out.uid = next();
    else if (a === '--only-threads') out.onlyThreadIds = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--friend-targets') out.onlyFriendTargets = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--all-threads') out.onlyThreadIds = [];
    else if (a === '--auto-sync') out.autoSync = next();
    else if (a === '--auto-sync-unread') out.autoSyncUnread = next();
    else throw new Error(`unknown flag ${a}`);
  }
  if (out.token === undefined && process.env.VCLINKS_TOKEN) out.token = process.env.VCLINKS_TOKEN;
  if (out.api) {
    const u = new URL(out.api);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost') throw new Error('API must be https:// or http://localhost');
    out.api = u.origin + u.pathname.replace(/\/+$/, '');
  }
  if (out.sender !== undefined && !['on', 'off'].includes(out.sender)) throw new Error('--sender takes on|off');
  if (out.autoSync !== undefined && !['on', 'off'].includes(out.autoSync)) throw new Error('--auto-sync takes on|off');
  if (out.autoSyncUnread !== undefined && !['on', 'off'].includes(out.autoSyncUnread)) throw new Error('--auto-sync-unread takes on|off');
  return out;
}

// Runs inside the service worker. Keys mirror STORAGE_KEYS in apps/extension/src.
async function applyInWorker(patch) {
  const KEY = {
    config: 'vclinksConfig',
    sender: 'vclinksSender',
    build: 'vclinksDevBuildId',
    status: 'vclinksSenderStatus',
    autoSync: 'vclinksAutoSync',
  };
  const cur = await chrome.storage.local.get(Object.values(KEY));
  const config = { ...(cur[KEY.config] ?? {}) };
  const sender = { enabled: false, uid: null, ...(cur[KEY.sender] ?? {}) };
  let changed = false;
  if (patch.api) { config.apiBaseUrl = patch.api; changed = true; }
  if (patch.token) { config.token = patch.token; changed = true; }
  if (patch.sender) { sender.enabled = patch.sender === 'on'; changed = true; }
  if (patch.uid) { sender.uid = patch.uid; changed = true; }
  if (patch.onlyThreadIds) {
    if (patch.onlyThreadIds.length) sender.onlyThreadIds = patch.onlyThreadIds;
    else delete sender.onlyThreadIds;
    changed = true;
  }
  if (patch.onlyFriendTargets) {
    if (patch.onlyFriendTargets.length) sender.onlyFriendTargets = patch.onlyFriendTargets;
    else delete sender.onlyFriendTargets;
    changed = true;
  }
  if (changed) await chrome.storage.local.set({ [KEY.config]: config, [KEY.sender]: sender });
  if (patch.autoSync || patch.autoSyncUnread) {
    const cur2 = { ...(cur[KEY.autoSync] ?? {}) };
    if (patch.autoSync) cur2.enabled = patch.autoSync === 'on';
    if (patch.autoSyncUnread) cur2.openUnread = patch.autoSyncUnread === 'on';
    await chrome.storage.local.set({ [KEY.autoSync]: cur2 });
  }

  let me = null;
  if (config.apiBaseUrl && config.token) {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/me`, { headers: { Authorization: `Bearer ${config.token}` } });
      me = res.ok ? await res.json() : { error: `HTTP ${res.status}` };
    } catch (e) {
      me = { error: String(e && e.message ? e.message : e) };
    }
  }
  let onDisk = null;
  try {
    onDisk = (await (await fetch(chrome.runtime.getURL('build-id.json'), { cache: 'no-store' })).json()).id ?? null;
  } catch {}
  return {
    changed,
    apiBaseUrl: config.apiBaseUrl ?? null,
    hasToken: !!config.token,
    me,
    sender,
    autoSync: patch.autoSync ? patch.autoSync === 'on' : (cur[KEY.autoSync]?.enabled !== false),
    autoSyncOpenUnread: patch.autoSyncUnread ? patch.autoSyncUnread === 'on' : cur[KEY.autoSync]?.openUnread === true,
    build: { running: cur[KEY.build] ?? null, onDisk },
    senderStatus: cur[KEY.status] ?? null,
  };
}

(async () => {
  const patch = parseArgs(process.argv.slice(2));
  const browser = await connect();
  try {
    const sw = await serviceWorker(browser);
    const result = await sw.evaluate(applyInWorker, patch);
    console.log(JSON.stringify({ extensionId: EXT_ID, ...result }, null, 2));
    if (result.me && result.me.error) process.exitCode = 2;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
