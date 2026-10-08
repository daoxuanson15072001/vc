// node sw.js "<expression>" — evaluate JS in the extension's service worker of the driver.
// Example: node sw.js "chrome.storage.local.get('vclinksSenderStatus')"
const { connect, serviceWorker } = require('./lib');
(async () => {
  const expr = process.argv[2];
  if (!expr) throw new Error('usage: node sw.js "<expression>"');
  const browser = await connect();
  try {
    const sw = await serviceWorker(browser);
    console.log(JSON.stringify(await sw.evaluate(expr), null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
