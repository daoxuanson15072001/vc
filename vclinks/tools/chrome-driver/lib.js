// Shared helpers for the VClinks Chrome driver tools (CDP over playwright-core).
// The driver is a Chrome for Testing instance started by driver.sh with
// --remote-debugging-port (DRIVER_PORT, default 9333) and the unpacked extension
// copy in DRIVER_EXT (default ~/.vclinks-chrome-ext).
const { chromium } = require('playwright-core');
const { createHash } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');

const PORT = Number(process.env.DRIVER_PORT || 9333);
const EXT_DIR = process.env.DRIVER_EXT || path.join(os.homedir(), '.vclinks-chrome-ext');

/** Chrome derives an unpacked extension's id from the sha256 of its absolute path. */
function extensionIdFromPath(dir) {
  const hex = createHash('sha256').update(path.resolve(dir)).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

const EXT_ID = process.env.DRIVER_EXT_ID || extensionIdFromPath(EXT_DIR);

async function connect() {
  try {
    return await chromium.connectOverCDP(`http://localhost:${PORT}`);
  } catch (e) {
    throw new Error(`no Chrome driver on port ${PORT} (start it with: pnpm driver). ${e.message}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The extension's service worker. MV3 workers stop when idle, so if none is
 * running we open the popup page once, which wakes the worker, then close it.
 */
async function serviceWorker(browser) {
  const ctx = browser.contexts()[0];
  const find = () => ctx.serviceWorkers().find((w) => w.url().startsWith(`chrome-extension://${EXT_ID}/`));
  let sw = find();
  if (sw) return sw;
  const page = await ctx.newPage();
  try {
    await page.goto(`chrome-extension://${EXT_ID}/popup.html`).catch(() => undefined);
    for (let i = 0; i < 20 && !(sw = find()); i++) await sleep(250);
  } finally {
    await page.close().catch(() => undefined);
  }
  if (!sw) throw new Error(`extension ${EXT_ID} is not loaded in the driver (a reload unloads a --load-extension extension); restart it with: pnpm driver`);
  return sw;
}

/** First page whose URL contains `match`. */
function page(browser, match) {
  const pages = browser.contexts().flatMap((c) => c.pages());
  const p = pages.find((x) => x.url().includes(match));
  if (!p) throw new Error(`no page matching "${match}"; open: ${pages.map((x) => x.url()).join(', ')}`);
  return p;
}

module.exports = { PORT, EXT_DIR, EXT_ID, connect, serviceWorker, page, sleep };
