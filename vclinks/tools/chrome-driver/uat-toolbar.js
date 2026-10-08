// UAT thanh công cụ soạn tin (sticker, tin nhắn nhanh, số tài khoản) trên Chrome driver.
// Chạy: DASH=http://localhost:5174 SKIP=TC17 node tools/chrome-driver/uat-toolbar.js (driver đang mở; một tab Dashboard đã đăng nhập).
// Dashboard mở trong một Chromium headless riêng (token lấy từ tab Dashboard đã đăng nhập trong driver); Zalo chỉ được đọc qua CDP.
// Chỉ gửi vào nhóm test "Kiểm thử vclink". Kết quả in ra JSON; ảnh chụp vào docs/uat-<ngày>/.
// UAT of the composer toolbar on the Chrome driver: real clicks on the Dashboard, verification on Zalo Web
// (DOM + IndexedDB) and via the API. Sends only to the TEST GROUP; asserts the open thread before every send.
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const GROUP = 'g6910418193163461340', UID = '476214826876503713', NAME = 'Kiểm thử vclink', CONV = `${UID}:${GROUP}`;
const DASH = process.env.DASH || 'http://localhost:5173';
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // Hà Nội date, YYYY-MM-DD
const SHOT = process.env.UAT_SHOTS || path.join(__dirname, '..', '..', 'docs', 'uat-' + today);
fs.mkdirSync(SHOT, { recursive: true });
const norm = (t) => (t || '').replace(/ /g, ' ').normalize('NFC').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP = (process.env.SKIP || '').split(',').filter(Boolean);
const results = [];
const tc = async (id, title, fn) => { if (SKIP.includes(id)) return results.push({ id, title, pass: null, skipped: true }); const t0 = Date.now(); try { const detail = await fn(); results.push({ id, title, pass: true, detail, ms: Date.now() - t0 }); } catch (e) { results.push({ id, title, pass: false, detail: String(e && e.message ? e.message : e).slice(0, 400), ms: Date.now() - t0 }); } };

(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9333');
  const ctx = b.contexts()[0];
  const zalo = ctx.pages().find((p) => p.url().startsWith('https://chat.zalo.me'));
  if (!zalo) throw new Error('no Zalo tab in the driver');
  // Token of a logged-in Dashboard tab in the driver; the UAT Dashboard itself runs in a separate headless Chromium.
  const logged = ctx.pages().find((p) => /^http:\/\/localhost:\d+/.test(p.url()));
  const token = logged ? await logged.evaluate(() => localStorage.getItem('vclinks.token')) : null;
  if (!token) throw new Error('no logged-in Dashboard tab in the driver to take the token from');
  const own = await chromium.launch({ headless: true });
  const dash = await (await own.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await dash.goto(`${DASH}/login`);
  await dash.evaluate((t) => localStorage.setItem('vclinks.token', t), token);
  const api = (p, init) => dash.evaluate(async ({ p, init, token }) => { const res = await fetch(p, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(init && init.headers) } }); return { status: res.status, body: await res.json().catch(() => null) }; }, { p, init, token });
  const waitOutbox = async (pred, max = 45000) => { const t0 = Date.now(); let last; while (Date.now() - t0 < max) { const r = await api(`/api/outbox?uid=${UID}&threadId=${GROUP}&limit=10`); last = (r.body || []).find(pred); if (last && (last.status === 'sent' || last.status === 'failed')) return last; await sleep(500); } throw new Error('outbox item did not finish in time: ' + JSON.stringify(last)); };
  /** Newest own bubble on Zalo Web with its cliMsgId, text and whether it holds a sticker image. */
  const zaloNewestOwn = () => zalo.evaluate(() => {
    const own = [...document.querySelectorAll('[id^="bb_msg_id_"]')].filter((el) => el.querySelector('[data-id^="div_SentMsg"], [data-id^="div_LastSentMsg"], [data-id^="btn_SentMsg"], [data-id^="btn_LastSentMsg"]'));
    const el = own[own.length - 1];
    if (!el) return null;
    return { cliMsgId: el.id.replace(/^bb_msg_id_/, '').split('_')[0], text: (el.innerText || '').slice(0, 200), sticker: !!el.querySelector('img[src*="emoticon"], img[src*="sticker"], .sticker'), header: document.querySelector('header#header')?.innerText?.split('\n')[0] };
  });
  const idbMessage = (cliMsgId) => zalo.evaluate(async ({ uid, cliMsgId }) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(`zdb_${uid}`); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return new Promise((res) => { const tx = db.transaction('message', 'readonly'); const req = tx.objectStore('message').openCursor(null, 'prev'); let n = 0; req.onsuccess = (e) => { const c = e.target.result; if (!c || n++ > 400) return res(null); const v = c.value; if (String(v.cliMsgId) === String(cliMsgId)) return res({ msgId: v.msgId, msgType: v.msgType, toUid: v.toUid, fromUid: v.fromUid, text: typeof v.message === 'string' ? v.message.slice(0, 120) : typeof v.message }); c.continue(); }; tx.oncomplete = () => { db.close(); }; });
  }, { uid: UID, cliMsgId });
  /** The Dashboard must show the test group right before any send (the driver window is shared). */
  const assertTestGroup = async () => { const t = norm(await dash.$eval('.chat-header__title', (e) => e.textContent)); if (t !== NAME.normalize('NFC')) throw new Error('Dashboard is not on the test group: ' + t); };
  const openGroup = async () => { await dash.goto(`${DASH}/conversations/${encodeURIComponent(CONV)}`); await dash.waitForSelector('.chat-header__title', { timeout: 20000 }); await dash.waitForSelector('textarea[aria-label="Nội dung tin nhắn"]', { timeout: 20000 }); await dash.waitForTimeout(1200); await assertTestGroup(); };
  /** Presses Enter in the composer and accepts the first-send confirmation if it shows. */
  const sendComposer = async () => {
    await assertTestGroup();
    const ta = dash.locator('textarea[aria-label="Nội dung tin nhắn"]');
    await ta.focus(); await ta.press('Enter');
    // First send in this browser profile: the Popconfirm asks once.
    const ok = dash.locator('.ant-popconfirm .ant-btn-primary').first();
    const shown = await ok.waitFor({ timeout: 3000 }).then(() => true, () => false);
    if (shown) { await assertTestGroup(); await ok.click(); }
    await dash.waitForTimeout(800);
    const left = await ta.inputValue();
    if (left.trim()) { await dash.screenshot({ path: `${SHOT}/debug-send.png` }); const msgs = await dash.$$eval('.ant-message-notice, .ant-notification-notice', (els) => els.map((e) => e.innerText)); throw new Error('ô soạn tin chưa được gửi (popconfirm ' + shown + '): ' + JSON.stringify(msgs)); }
  };
  const stamp = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  let created = [];

  // TC17 — sticker
  await tc('TC17', 'Gửi Sticker: chọn sticker #3 bộ "Củ hành" trên Dashboard → tiện ích gửi trên Zalo Web, có bong bóng sticker, IDB msgType 4', async () => {
    await openGroup();
    await dash.getByRole('button', { name: 'Gửi Sticker' }).click();
    await dash.waitForSelector('.sticker-picker__item', { timeout: 10000 });
    await dash.screenshot({ path: `${SHOT}/17-sticker-picker.png` });
    await dash.locator('.sticker-picker__item').nth(2).click();
    const modal = dash.locator('.ant-modal-confirm');
    await modal.waitFor({ timeout: 5000 });
    await assertTestGroup();
    const t0 = Date.now();
    await modal.locator('button', { hasText: 'Gửi' }).click();
    const o = await waitOutbox((x) => x.action === 'send_sticker' && Date.parse(x.createdAt) >= t0 - 5000);
    if (o.status !== 'sent') throw new Error('lệnh sticker thất bại: ' + o.error);
    await sleep(800);
    const z = await zaloNewestOwn();
    await zalo.screenshot({ path: `${SHOT}/17-sticker-zalo.png` });
    if (!z || !z.sticker) throw new Error('bong bóng mới nhất trên Zalo không phải sticker: ' + JSON.stringify(z));
    const idb = o.cliMsgId ? await idbMessage(o.cliMsgId) : null;
    return { outbox: { text: o.text, cliMsgId: o.cliMsgId, ms: Date.parse(o.sentAt) - t0 }, zalo: z, idb };
  });

  // TC18 — quick replies: /shortcut in the composer with variables
  await tc('TC18', 'Tin nhắn nhanh: tạo mẫu /uatbh, gõ "/uatbh" + Enter trong ô soạn → nội dung thay {ten_khach}; gửi → hiện trên Zalo', async () => {
    const r1 = await api('/api/quick-replies', { method: 'POST', body: JSON.stringify({ shortcut: 'uatbh', title: 'UAT bảo hành', text: `Dạ {ten_khach}, sản phẩm được bảo hành 12 tháng ạ (UAT ${stamp}).` }) });
    if (r1.status !== 201) throw new Error('không tạo được mẫu: ' + JSON.stringify(r1));
    created.push(r1.body.id);
    await openGroup();
    const ta = dash.locator('textarea[aria-label="Nội dung tin nhắn"]');
    await ta.click(); await ta.type('/uat', { delay: 40 });
    await dash.waitForSelector('.composer__slash-item', { timeout: 8000 });
    const items = await dash.$$eval('.composer__slash-item', (els) => els.map((e) => e.querySelector('.composer__slash-key').textContent));
    await dash.screenshot({ path: `${SHOT}/18-slash-picker.png` });
    await ta.press('Enter');
    await dash.waitForTimeout(300);
    const value = await ta.inputValue();
    if (!value.includes(`Dạ ${NAME}, sản phẩm được bảo hành 12 tháng ạ`)) throw new Error('nội dung chèn sai: ' + value);
    if (await dash.locator('.composer__slash-item').count()) throw new Error('danh sách gợi ý chưa đóng sau khi chèn');
    const t0 = Date.now();
    await sendComposer();
    const o = await waitOutbox((x) => !x.action && x.text === value.trim());
    if (o.status !== 'sent') throw new Error('gửi thất bại: ' + o.error);
    await sleep(800);
    const z = await zaloNewestOwn();
    if (!z || !norm(z.text).includes(norm(value).slice(0, 40))) throw new Error('Zalo không hiện tin vừa gửi: ' + JSON.stringify(z));
    return { suggestions: items, inserted: value, outbox: { cliMsgId: o.cliMsgId, ms: Date.parse(o.sentAt) - t0 } };
  });

  // TC19 — bank account template from the toolbar button
  await tc('TC19', 'Gửi nhanh số tài khoản: mẫu loại "bank" hiện trong nút → chèn → gửi → hiện trên Zalo', async () => {
    const r1 = await api('/api/quick-replies', { method: 'POST', body: JSON.stringify({ shortcut: 'uatstk', title: 'UAT STK VCparts', text: `Vietcombank 0011 0022 3344 - CTCP VC Phồn Vinh (UAT ${stamp})`, kind: 'bank' }) });
    if (r1.status !== 201) throw new Error('không tạo được mẫu: ' + JSON.stringify(r1));
    created.push(r1.body.id);
    await openGroup();
    await dash.getByRole('button', { name: 'Gửi nhanh số tài khoản' }).click();
    const mi = dash.getByRole('menuitem', { name: 'UAT STK VCparts' });
    await mi.waitFor({ timeout: 8000 });
    await dash.screenshot({ path: `${SHOT}/19-stk-menu.png` });
    await mi.click();
    const ta = dash.locator('textarea[aria-label="Nội dung tin nhắn"]');
    await dash.waitForTimeout(300);
    const value = await ta.inputValue();
    if (!value.startsWith('Vietcombank 0011 0022 3344')) throw new Error('nội dung chèn sai: ' + value);
    const t0 = Date.now();
    await sendComposer();
    const o = await waitOutbox((x) => !x.action && x.text === value.trim());
    if (o.status !== 'sent') throw new Error('gửi thất bại: ' + o.error);
    await sleep(800);
    const z = await zaloNewestOwn();
    await zalo.screenshot({ path: `${SHOT}/19-stk-zalo.png` });
    if (!z || !norm(z.text).includes('Vietcombank 0011 0022 3344')) throw new Error('Zalo không hiện tin vừa gửi: ' + JSON.stringify(z));
    return { inserted: value, outbox: { cliMsgId: o.cliMsgId, ms: Date.parse(o.sentAt) - t0 } };
  });

  // TC20 — manage templates in the modal
  await tc('TC20', 'Hộp "Tin nhắn nhanh": liệt kê mẫu, sửa tên mẫu, danh sách cập nhật', async () => {
    await openGroup();
    await dash.getByRole('button', { name: 'Tin nhắn nhanh' }).click();
    const modal = dash.locator('.ant-modal', { hasText: 'Tin nhắn nhanh (mẫu câu)' });
    await modal.waitFor({ timeout: 8000 });
    await modal.locator('.ant-list-item', { hasText: '/uatbh' }).waitFor({ timeout: 8000 });
    await dash.screenshot({ path: `${SHOT}/20-mau-cau.png` });
    await modal.getByRole('button', { name: 'Sửa /uatbh' }).click();
    const title = modal.locator('input[placeholder="Chính sách bảo hành"]');
    await title.fill('UAT bảo hành (đã sửa)');
    await modal.getByRole('button', { name: 'Lưu' }).click();
    await modal.locator('.ant-list-item', { hasText: 'UAT bảo hành (đã sửa)' }).waitFor({ timeout: 8000 });
    const rows = await modal.locator('.ant-list-item').allInnerTexts();
    await dash.keyboard.press('Escape');
    return { rows: rows.map((r) => r.replace(/\s+/g, ' ').slice(0, 80)) };
  });

  // cleanup: test templates
  for (const id of created) await api(`/api/quick-replies/${id}`, { method: 'DELETE' });

  fs.writeFileSync(`${SHOT}/ket-qua-toolbar.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await own.close();
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
