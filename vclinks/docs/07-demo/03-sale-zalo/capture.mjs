import { createRequire } from 'node:module';
import path from 'node:path';
// playwright-core comes from the repo's pnpm store; uses the locally installed Google Chrome
const { chromium } = createRequire(import.meta.url)(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core'));
import fs from 'node:fs';
const OUT=path.join(path.dirname(new URL(import.meta.url).pathname), 'work');
for (const d of ['raw','shots','meta']) fs.mkdirSync(OUT+'/'+d, { recursive: true });
const FILES = process.argv.slice(2);
const b = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:false, args:['--disable-blink-features=AutomationControlled']});
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.goto('https://claude.ai/artifact/8cAKkTjtb94BTCWFoErv1p', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(15000);
const host = p.frames().find(f=>f.url().includes('frame.claudeusercontent.com'));
const base = host.url().split('?')[0];
let fe;
for (const f of p.frames().filter(f=>f.url()==='about:srcdoc')) { const e = await f.frameElement(); if (await e.getAttribute('title')==='Main.dc.html') fe = e; }
const tpl = await fe.getAttribute('srcdoc');
const bodyAt = tpl.indexOf('<body>');
const shotCtx = await b.newContext();
for (const file of FILES) {
  const B = JSON.parse(await host.evaluate(async u => (await fetch(u)).text(), base + 'project/canvas.json')).boards;
  const findEl = async (name) => { for (const f of p.frames().filter(f=>f.url()==='about:srcdoc')) { try { const e = await f.frameElement(); if (await e.getAttribute('title')===name) return e; } catch {} } return null; };
  let el = null;
  for (let k=0; k<12 && !el; k++) {
    el = await findEl(file); if (el) break;
    // pick any rendered known board as anchor to get the canvas transform
    let anchor=null, an=null;
    for (const f of p.frames().filter(f=>f.url()==='about:srcdoc')) { try { const e=await f.frameElement(); const t=await e.getAttribute('title'); const r=await e.boundingBox(); if (B[t] && r && r.width>0) { anchor=r; an=t; break; } } catch {} }
    if (!anchor) { await p.waitForTimeout(1500); continue; }
    const sc = anchor.width / B[an].w;
    const tx = anchor.x + (B[file].x - B[an].x)*sc + Math.min(B[file].w*sc,600)/2, ty = anchor.y + (B[file].y - B[an].y)*sc + 200;
    await p.mouse.move(800,500);
    await p.mouse.wheel(Math.max(-3000,Math.min(3000,tx-800)), Math.max(-3000,Math.min(3000,ty-500)));
    await p.waitForTimeout(2500);
  }
  if (!el) { console.log(file, 'NOT FOUND'); continue; }
  const raw = await host.evaluate(async u => (await fetch(u)).text(), base + 'project/' + file);
  const fr = await el.contentFrame();
  let last=-1;
  for (let k=0;k<30;k++){ const n = await fr.evaluate(()=>document.readyState==='complete' ? document.querySelectorAll('body *').length : 0).catch(()=>0); if (n>50 && n===last) break; last=n; await p.waitForTimeout(1000); }
  const html = (await fr.evaluate(() => '<!doctype html>' + document.documentElement.outerHTML)).replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const m = raw.match(/"\$preview":\{"width":(\d+),"height":(\d+)/); const w = m ? +m[1] : 1440;
  const sp = await shotCtx.newPage({ viewport: { width: w, height: 900 } });
  await sp.setContent(html.replace(/<base [^>]*>/, '<base href="'+base+'project/">'), { waitUntil: 'load' }).catch(()=>{});
  await sp.waitForTimeout(1500);
  const stem = file.replace('.dc.html','');
  fs.writeFileSync(OUT+'/raw/'+stem+'.html', html);
  await sp.screenshot({ path: OUT+'/shots/'+stem+'.png', fullPage: true });
  const meta = await sp.evaluate(() => {
    const out = []; const seen = new Set();
    for (const el of document.querySelectorAll('h1,h2,h3,h4,.an,button,[class*=title],[class*=label]')) {
      const t = (el.innerText||'').trim().replace(/\s+/g,' '); if (!t || t.length>70) continue;
      const r = el.getBoundingClientRect(); if (r.width<2) continue;
      const k = t+Math.round(r.y); if (seen.has(k)) continue; seen.add(k);
      out.push([el.tagName.toLowerCase()+(el.classList.contains('an')?'.an':''), t, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]);
    }
    return { h: document.documentElement.scrollHeight, items: out };
  });
  fs.writeFileSync(OUT+'/meta/'+stem+'.json', JSON.stringify(meta));
  console.log(stem, w+'x'+meta.h, meta.items.length);
  await sp.close();
}
await b.close();
