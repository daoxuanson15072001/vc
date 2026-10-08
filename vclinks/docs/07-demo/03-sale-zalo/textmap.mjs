import { createRequire } from 'node:module';
import path from 'node:path';
// playwright-core comes from the repo's pnpm store; uses the locally installed Google Chrome
const { chromium } = createRequire(import.meta.url)(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core'));
import fs from 'node:fs';
const D=path.join(path.dirname(new URL(import.meta.url).pathname), 'work');
const b = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
for (const f of fs.readdirSync(D+'/raw')) {
  await p.setContent(fs.readFileSync(D+'/raw/'+f,'utf8'), { waitUntil: 'domcontentloaded' }).catch(()=>{});
  const items = await p.evaluate(() => {
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      const own = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').replace(/\s+/g,' ').trim();
      if (!own) continue;
      const r = el.getBoundingClientRect(); if (r.width<1||r.height<1) continue;
      const cs = getComputedStyle(el);
      out.push([own.slice(0,90), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), parseFloat(cs.fontSize), +cs.fontWeight>=600?1:0, el.tagName.toLowerCase()]);
    }
    return out;
  });
  fs.writeFileSync(D+'/meta/'+f.replace('.html','.text.json'), JSON.stringify(items));
  console.log(f, items.length);
}
await b.close();
