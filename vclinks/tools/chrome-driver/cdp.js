// node cdp.js <url-substring> <file.js | expression> — evaluate JS in the first driver page
// whose URL contains <url-substring> (page world, i.e. Zalo's own window) and print the result.
// Example: node cdp.js chat.zalo.me "document.title"
const fs = require('node:fs');
const { connect, page } = require('./lib');
(async () => {
  const [match, src] = process.argv.slice(2);
  if (!match || !src) throw new Error('usage: node cdp.js <url-substring> <file.js|expression>');
  const code = fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : src;
  const browser = await connect();
  try {
    console.log(JSON.stringify(await page(browser, match).evaluate(code), null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
