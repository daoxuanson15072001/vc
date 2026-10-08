// UAT nghiệm thu kênh Zalo cá nhân trên Chrome driver — chạy: node tools/chrome-driver/uat.js (driver đang mở, Dashboard :5173 đã đăng nhập trong driver).
// Chỉ gửi / đổi trạng thái trong nhóm test "Kiểm thử vclink". Kết quả in ra JSON; ảnh chụp vào docs/uat-<ngày>/.
// UAT on the Chrome driver: real clicks on the Dashboard (:5173), verification on Zalo Web (DOM + IndexedDB) and via the API.
// Sends/state changes only in the TEST GROUP. Produces a JSON result list + screenshots.
const { chromium } = require('playwright-core');
const GROUP = 'g6910418193163461340', UID = '476214826876503713', NAME = 'Kiểm thử vclink', CONV = `${UID}:${GROUP}`;
const SHOT = process.env.UAT_SHOTS || require('node:path').join(__dirname, '..', '..', 'docs', 'uat-' + new Date().toISOString().slice(0, 10));
require('node:fs').mkdirSync(SHOT, { recursive: true });
const norm = (t) => (t || '').replace(/ /g, ' ').normalize('NFC').trim();
const results = [];
const tc = async (id, title, fn) => { const t0 = Date.now(); try { const detail = await fn(); results.push({ id, title, pass: true, detail, ms: Date.now() - t0 }); } catch (e) { results.push({ id, title, pass: false, detail: String(e && e.message ? e.message : e).slice(0, 300), ms: Date.now() - t0 }); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9333');
  const ctx = b.contexts()[0];
  const dash = ctx.pages().find((p) => p.url().startsWith('http://localhost:5173'));
  const zalo = ctx.pages().find((p) => p.url().startsWith('https://chat.zalo.me'));
  const token = await dash.evaluate(() => localStorage.getItem('vclinks.token'));
  const api = (path, init) => dash.evaluate(async ({ path, init, token }) => { const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(init && init.headers) } }); return { status: res.status, body: await res.json().catch(() => null) }; }, { path, init, token });
  const waitOutbox = async (id, max = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const r = await api(`/api/outbox?uid=${UID}&threadId=${GROUP}&limit=10`); const o = (r.body || []).find((x) => x.id === id); if (o && (o.status === 'sent' || o.status === 'failed')) return o; await sleep(400); } throw new Error('outbox item did not finish in time'); };
  const zaloSidebar = () => zalo.evaluate((g) => { const el = document.querySelector(`[anim-data-id="${g}"]`); return el ? { pinned: !!el.querySelector('.conv__pinned'), unread: !!el.querySelector('.conv-action__unread-v2, .z-conv-message.--unread') } : null; }, GROUP);
  const waitZalo = async (pred, max = 15000) => { await zalo.bringToFront(); try { const t0 = Date.now(); let last; while (Date.now() - t0 < max) { last = await zaloSidebar(); if (last && pred(last)) return last; await sleep(500); } throw new Error('Zalo sidebar did not reach the expected state: ' + JSON.stringify(last)); } finally { await dash.bringToFront(); } };
  await zalo.bringToFront(); await sleep(300); await dash.bringToFront();

  // TC01 — conversation list, label chips
  await tc('TC01', 'Danh sách hội thoại tải, có chip thẻ phân loại (tên + màu như Zalo)', async () => {
    await dash.goto('http://localhost:5173/conversations'); await dash.waitForSelector('[role="listitem"]', { timeout: 15000 });
    await dash.waitForTimeout(1500);
    const n = await dash.$$eval('[role="listitem"]', (els) => els.length);
    const chips = await dash.$$eval('.conv-item__label', (els) => els.slice(0, 6).map((e) => ({ name: e.querySelector('.conv-item__label-name')?.textContent, color: e.style.color })));
    if (!chips.length) throw new Error('không thấy chip nhãn nào');
    const pins = await dash.$$eval('.conv-item__pin', (els) => els.length);
    await dash.screenshot({ path: `${SHOT}/01-danh-sach.png` });
    return { items: n, labelChips: chips, pinnedIcons: pins };
  });

  // TC02 — unread filter
  await tc('TC02', 'Bộ lọc "Chưa đọc" chỉ giữ hội thoại có tin chưa đọc', async () => {
    await dash.getByText('Chưa đọc', { exact: true }).first().click(); await dash.waitForTimeout(1500);
    const r = await dash.$$eval('[role="listitem"]', (els) => ({ total: els.length, withBadge: els.filter((e) => e.querySelector('.unread-badge')).length }));
    await dash.getByText('Tất cả', { exact: true }).first().click(); await dash.waitForTimeout(800);
    if (r.total !== r.withBadge) throw new Error(`có ${r.total - r.withBadge} mục không có badge chưa đọc`);
    return r;
  });

  // TC03 — sync page shows the new streams
  await tc('TC03', 'Trang Đồng bộ liệt kê 7 luồng (có Cảm xúc, Thẻ phân loại, Đã đọc) với số liệu', async () => {
    await dash.goto('http://localhost:5173/sync'); await dash.waitForSelector('table', { timeout: 15000 }); await dash.waitForTimeout(1500);
    const rows = await dash.$$eval('table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()).slice(0, 3)));
    const need = ['Cảm xúc', 'Thẻ phân loại', 'Đã đọc'];
    const found = need.filter((l) => rows.some((r) => r[0] === l));
    if (found.length !== 3) throw new Error('thiếu luồng: ' + need.filter((l) => !found.includes(l)).join(', ') + ' | rows=' + JSON.stringify(rows.slice(0, 10)));
    await dash.screenshot({ path: `${SHOT}/03-dong-bo.png` });
    return { rows: rows.filter((r) => need.includes(r[0]) || ['Tin nhắn', 'Hội thoại'].includes(r[0])) };
  });

  // TC04 — test group chat: reactions pill, "Đã gửi"
  await tc('TC04', 'Khung chat nhóm test: dải cảm xúc 👍 và trạng thái Đã gửi/Đã nhận/Đã xem dưới tin cuối của mình', async () => {
    await dash.goto(`http://localhost:5173/conversations/${encodeURIComponent(CONV)}`); await dash.waitForSelector('.chat-header__title', { timeout: 15000 });
    await dash.waitForSelector('.msg-row', { timeout: 15000 }); await dash.waitForTimeout(1500);
    const title = norm(await dash.$eval('.chat-header__title', (e) => e.textContent));
    if (title !== NAME.normalize('NFC')) throw new Error('tiêu đề khác: ' + title);
    const pill = await dash.$eval('.msg-row[data-msgid="8315498399272"] .bubble__reactions', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => null);
    if (!pill) throw new Error('không thấy dải cảm xúc trên tin 8315498399272');
    const status = await dash.$$eval('.bubble__status', (els) => els.map((e) => e.textContent.trim()));
    if (!status.some((s) => /Đã (gửi|nhận|xem)/.test(s))) throw new Error('không thấy trạng thái gửi dưới tin cuối: ' + JSON.stringify(status));
    await dash.screenshot({ path: `${SHOT}/04-khung-chat.png` });
    return { pill, status };
  });

  // TC05 — forwarded marker (Dashboard reads the DB only; nothing opens on Zalo)
  await tc('TC05', 'Tin chuyển tiếp hiện "Đã chuyển tiếp"', async () => {
    await dash.goto(`http://localhost:5173/conversations/${encodeURIComponent(`${UID}:g4550726413470303005`)}`); await dash.waitForSelector('.msg-row', { timeout: 15000 }); await dash.waitForTimeout(1200);
    const marks = await dash.$$eval('.bubble__forwarded', (els) => els.length);
    if (!marks) throw new Error('không thấy nhãn "Đã chuyển tiếp" trên trang mới nhất của hội thoại này');
    return { forwardedBubblesOnPage: marks };
  });

  // TC06 — pin / unpin from the Dashboard context menu
  await tc('TC06', 'Ghim và bỏ ghim nhóm test từ menu chuột phải; Zalo Web đổi trạng thái', async () => {
    await dash.goto('http://localhost:5173/conversations'); await dash.waitForSelector('[role="listitem"]', { timeout: 15000 }); await dash.waitForTimeout(1000);
    const item = dash.locator('[role="listitem"]', { hasText: NAME }).first();
    await item.waitFor({ timeout: 10000 });
    await item.click({ button: 'right' }); await dash.getByRole('menuitem', { name: /Ghim hội thoại/ }).click();
    const t0 = Date.now();
    const pinned = await waitZalo((s) => s.pinned);
    const tPin = Date.now() - t0;
    const waitDash = async (pred, max = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const n = await dash.locator('[role="listitem"]', { hasText: NAME }).first().evaluate((el) => ({ pin: !!el.querySelector('.conv-item__pin'), badge: !!el.querySelector('.unread-badge') })); if (pred(n)) return n; await sleep(700); } throw new Error('Dashboard list did not update in time'); };
    const dashState = await waitDash((n) => n.pin);
    const dashPin = dashState.pin ? 1 : 0;
    await dash.screenshot({ path: `${SHOT}/06-ghim.png` });
    await dash.locator('[role="listitem"]', { hasText: NAME }).first().click({ button: 'right' }); await dash.getByRole('menuitem', { name: /Bỏ ghim/ }).click();
    const unpinned = await waitZalo((s) => !s.pinned);
    await waitDash((n) => !n.pin);
    return { zaloAfterPin: pinned, msToPin: tPin, dashboardPinIcon: dashPin > 0, zaloAfterUnpin: unpinned };
  });

  // TC07 — mark unread / read
  await tc('TC07', 'Đánh dấu chưa đọc rồi đã đọc từ Dashboard; Zalo Web đổi trạng thái', async () => {
    const item = () => dash.locator('[role="listitem"]', { hasText: NAME }).first();
    await item().click({ button: 'right' }); await dash.getByRole('menuitem', { name: /Đánh dấu chưa đọc/ }).click();
    const unread = await waitZalo((s) => s.unread);
    const waitDash = async (pred, max = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const n = await item().evaluate((el) => ({ pin: !!el.querySelector('.conv-item__pin'), badge: !!el.querySelector('.unread-badge') })); if (pred(n)) return n; await sleep(700); } throw new Error('Dashboard list did not update in time'); };
    const badge = (await waitDash((n) => n.badge)).badge ? 1 : 0;
    await item().click({ button: 'right' }); await dash.getByRole('menuitem', { name: /Đánh dấu đã đọc/ }).click();
    const read = await waitZalo((s) => !s.unread);
    await waitDash((n) => !n.badge);
    return { zaloAfterUnread: unread, dashboardBadge: badge > 0, zaloAfterRead: read };
  });

  // TC08 — send text from the Composer (real typing + click Gửi)
  let sentCli = null;
  await tc('TC08', 'Gửi tin văn bản bằng khung soạn trên Dashboard; tin hiện trên Zalo Web', async () => {
    await dash.goto(`http://localhost:5173/conversations/${encodeURIComponent(CONV)}`); await dash.waitForSelector('.chat-header__title', { timeout: 15000 }); await dash.waitForTimeout(800);
    const title = norm(await dash.$eval('.chat-header__title', (e) => e.textContent));
    if (title !== NAME.normalize('NFC')) throw new Error('KHÔNG GỬI: tiêu đề khác nhóm test: ' + title);
    await dash.evaluate(() => localStorage.setItem('vclinks.composer.confirmed', '1'));
    const text = `UAT ${new Date().toLocaleTimeString('vi-VN')} — gửi text từ Dashboard`;
    await dash.getByLabel('Nội dung tin nhắn').click(); await dash.keyboard.type(text);
    const t0 = Date.now();
    await dash.getByRole('button', { name: 'Gửi', exact: true }).click();
    await dash.waitForTimeout(500);
    const list = await api(`/api/outbox?uid=${UID}&threadId=${GROUP}&limit=5`);
    const mine = (list.body || []).find((o) => o.text === text);
    if (!mine) throw new Error('không thấy lệnh trong outbox');
    const done = await waitOutbox(mine.id);
    const ms = Date.now() - t0;
    if (done.status !== 'sent') throw new Error('trạng thái ' + done.status + ': ' + done.error);
    sentCli = done.cliMsgId;
    const onZalo = await zalo.evaluate((cli) => { const el = document.getElementById('bb_msg_id_' + cli); return el ? { found: true, own: !!el.querySelector('[data-id^="div_SentMsg"],[data-id^="div_LastSentMsg"]'), text: el.querySelector('[data-id$="Msg_Text"]')?.innerText } : { found: false }; }, done.cliMsgId);
    if (!onZalo.found || onZalo.text !== text) throw new Error('trên Zalo: ' + JSON.stringify(onZalo));
    await dash.waitForTimeout(2500); await dash.screenshot({ path: `${SHOT}/08-gui-text.png` });
    return { ms, cliMsgId: done.cliMsgId, zalo: onZalo };
  });

  // TC09 — reply with quote from the Dashboard
  await tc('TC09', 'Trả lời trích dẫn từ Dashboard; Zalo Web hiện khối trích dẫn', async () => {
    const target = dash.locator('.msg-row[data-msgid="8315498399272"]');
    await target.scrollIntoViewIfNeeded(); await target.hover();
    await target.locator('[aria-label="Trả lời tin này"]').click();
    await dash.waitForSelector('.composer__reply', { timeout: 5000 });
    const text = `UAT trả lời trích dẫn ${new Date().toLocaleTimeString('vi-VN')}`;
    await dash.getByLabel('Nội dung tin nhắn').click(); await dash.keyboard.type(text);
    const t0 = Date.now();
    await dash.getByRole('button', { name: 'Gửi', exact: true }).click(); await dash.waitForTimeout(500);
    const list = await api(`/api/outbox?uid=${UID}&threadId=${GROUP}&limit=5`);
    const mine = (list.body || []).find((o) => o.text === text);
    if (!mine) throw new Error('không thấy lệnh trong outbox');
    if (mine.replyToCliMsgId !== '1790608559166') throw new Error('lệnh không mang replyToCliMsgId: ' + JSON.stringify(mine));
    const done = await waitOutbox(mine.id);
    const ms = Date.now() - t0;
    if (done.status !== 'sent') throw new Error('trạng thái ' + done.status + ': ' + done.error);
    const onZalo = await zalo.evaluate((cli) => { const el = document.getElementById('bb_msg_id_' + cli); return el ? { found: true, quote: !!el.querySelector('.message-quote-fragment__container'), text: el.querySelector('[data-id$="Msg_Text"]')?.innerText?.slice(0, 60) } : { found: false }; }, done.cliMsgId);
    if (!onZalo.found || !onZalo.quote) throw new Error('trên Zalo: ' + JSON.stringify(onZalo));
    await dash.waitForTimeout(2500); await dash.screenshot({ path: `${SHOT}/09-tra-loi.png` });
    return { ms, zalo: onZalo };
  });

  // TC10 — reaction picker intentionally hidden
  await tc('TC10', 'Nút thả cảm xúc trên Dashboard đang ẩn (Zalo chỉ nhận chuột thật)', async () => {
    const target = dash.locator('.msg-row[data-msgid="8315498399272"]'); await target.hover();
    const n = await dash.locator('[aria-label="Thả cảm xúc"]').count();
    if (n) throw new Error('nút thả cảm xúc vẫn hiện');
    return { hidden: true };
  });

  // TC11 — Zalo screenshot for evidence
  await tc('TC11', 'Ảnh chụp Zalo Web nhóm test sau UAT', async () => {
    await zalo.bringToFront(); await zalo.waitForTimeout(800);
    await zalo.screenshot({ path: `${SHOT}/11-zalo-nhom-test.png` });
    await dash.bringToFront();
    return { file: '11-zalo-nhom-test.png' };
  });

  // Cleanup: leave the test group unpinned and read whatever happened above.
  try {
    const st = await zaloSidebar();
    if (st?.pinned) { const r = await api('/api/outbox', { method: 'POST', body: JSON.stringify({ uid: UID, threadId: GROUP, action: 'pin_conversation', pin: false }) }); if (r.status === 201) await waitOutbox(r.body.id).catch(() => null); }
    if ((await zaloSidebar())?.unread) { const r = await api('/api/outbox', { method: 'POST', body: JSON.stringify({ uid: UID, threadId: GROUP, action: 'mark_read' }) }); if (r.status === 201) await waitOutbox(r.body.id).catch(() => null); }
    results.push({ id: 'CLEANUP', title: 'Trả nhóm test về trạng thái không ghim, đã đọc', pass: true, detail: await zaloSidebar(), ms: 0 });
  } catch (e) { results.push({ id: 'CLEANUP', title: 'Trả nhóm test về trạng thái không ghim, đã đọc', pass: false, detail: String(e.message), ms: 0 }); }
  await b.close();
  console.log(JSON.stringify(results, null, 1));
})().catch((e) => { console.error('ERR', e.message); console.log(JSON.stringify(results, null, 1)); process.exit(1); });
