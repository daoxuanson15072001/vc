// node iso.js "<expression>" — evaluate JS in the extension's isolated world of the Zalo tab
// (where content.js runs; the context is named "VClinks" by the content script).
const { connect, page, sleep } = require('./lib');
(async () => {
  const expr = process.argv[2];
  if (!expr) throw new Error('usage: node iso.js "<expression>"');
  const browser = await connect();
  try {
    const p = page(browser, 'chat.zalo.me');
    const session = await p.context().newCDPSession(p);
    const contexts = [];
    session.on('Runtime.executionContextCreated', (e) => contexts.push(e.context));
    await session.send('Runtime.enable');
    await sleep(500);
    const ctx = contexts.find((c) => c.name === 'VClinks');
    if (!ctx) throw new Error('no "VClinks" isolated world in the Zalo tab (reload the tab so content.js runs)');
    const r = await session.send('Runtime.evaluate', { expression: expr, contextId: ctx.id, awaitPromise: true, returnByValue: true });
    console.log(JSON.stringify(r.result.value ?? r, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
