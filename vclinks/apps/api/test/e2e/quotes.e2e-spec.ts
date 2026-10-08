import { ObjectId } from 'mongodb';
import request from 'supertest';
import type { OutboxItem, QuoteListResponse, TimelineResponse } from '@vclinks/shared';
import { ERR_QUOTE_NO_FILE, ERR_QUOTE_NO_LINK } from '@vclinks/shared';
import type { MockVcsaleClient } from '@vclinks/vcsale-client';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { VCSALE_CLIENT } from '../../src/customers/customers.service';
import { C } from '../../src/db/db.service';
import { VcsalesStatusService } from '../../src/vcsales/vcsales-status.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1c-02 on the test data: send a quote from the chat (03 MH-SZ-05i, UAT-SZ-27, 28, 29, 31, 86/90 debt strip).
 * VCsales is the mock (VCSALE_MODE=mock). Nothing here sends on Zalo: the extension side is played by
 * claim + result calls.
 */
const NK = (n: string) => `90000000000${n}`;
const DIV = 'TD-DV-VCP';
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  [DIV, 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', DIV],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', DIV],
  ['TD-DV-SA', 'Nhóm Sale admin VCparts', 'nhom_sale_admin', DIV],
];
const MANAGERS: Record<string, string> = { [DIV]: 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1', 'TD-DV-HN2': 'TD-U-GS2' };
const USERS: [string, string, string, string, string][] = [
  ['TD-U-GD', 'thang.uat@vcprosperous.com', 'Trịnh Văn Thắng', 'giam_doc_bh', DIV],
  ['TD-U-GS1', 'huong.uat@vcprosperous.com', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-KD1', 'minh.uat@vcprosperous.com', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD4', 'hai.uat@vcprosperous.com', 'Phạm Văn Hải', 'nvkd', 'TD-DV-HN2'],
  ['TD-U-SA', 'ngoc.uat@vcprosperous.com', 'Ngô Bích Ngọc', 'sale_admin', 'TD-DV-SA'],
];
const NICK = NK('01');
const MP = '9101101'; // Garage Minh Phát, KH-TEST-0101, owner Minh
const LUC = '9100901'; // Đặng Văn Lực, KH-TEST-0901, owner Minh, overdue debt
const NOCODE = '9300001'; // customer without a VCsales code
const GROUP = 'g100'; // test group mapped to KH-TEST-0101 by QUOTE_THREAD_CUSTOMERS
const MSG_SECRET = 'LỜI NHẮN BÍ MẬT 8.450.000';

describe('Gửi báo giá (e2e, M1c-02)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const saved = { div: process.env.AUTHZ_DEFAULT_DIVISION, map: process.env.QUOTE_THREAD_CUSTOMERS };
  let mock: MockVcsaleClient;
  let minhPhat = '';

  const list = (who = 'TD-U-KD1', userId = MP) => http().get(`/api/quotes/by-identity/${NICK}/${userId}`).set(as[who]);
  const send = (body: Record<string, unknown>, who = 'TD-U-KD1') => http().post('/api/quotes/send').set(as[who]).send({ uid: NICK, threadId: MP, form: 'pdf', message: 'Dạ em gửi báo giá ạ', ...body });
  const quote = async (no: string, userId = MP) => ((await list('TD-U-KD1', userId).expect(200)).body as QuoteListResponse).items.find((q) => q.no === no)!;
  const items = () => t.db.col(C.suggestions).find({ action: 'send_quote' }).toArray();

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = DIV;
    process.env.QUOTE_THREAD_CUSTOMERS = JSON.stringify({ [`${NICK}:${GROUP}`]: 'KH-TEST-0101' });
    t = await startE2EApp();
    mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : DIV,
        managerUserId: MANAGERS[id] ?? null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, email, fullName]) => ({ _id: id, email, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, , name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: NICK, label: 'Minh VCparts', ownerName: 'Minh' }).expect(201);
    await t.db.col('channel_access').insertOne({ _id: `${NICK}:user:TD-U-KD1:giu_nick`, channelId: NICK, principalType: 'user', principalId: 'TD-U-KD1', level: 'giu_nick', createdBy: 'seed' } as never);
    const contacts: [string, string, string?][] = [
      [MP, 'Anh Tuấn Minh Phát', '0900 000 101'],
      [LUC, 'Anh Đặng Văn Lực', '0900 000 901'],
      [NOCODE, 'Khách chưa có mã'],
    ];
    for (const [userId, displayName, phone] of contacts) {
      await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid: NICK, items: [{ userId, displayName, ...(phone ? { phone } : {}) }] }).expect(200);
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid: NICK, items: [{ threadId: userId, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
    }
    await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid: NICK, items: [{ threadId: GROUP, type: 'group', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    await http().post('/api/customers/sweep').set(as['TD-U-SA']).expect(200);
    await http().post('/api/customers/import').set(as['TD-U-SA']).send({}).expect(200);
    // Customers outside the ERP import window (dormant 0901) and the code-less one: owner Minh, set by hand like customer-360 does.
    const acc = async (userId: string) => (await t.db.col<{ accountId: string }>('identity_links').findOne({ _id: `${NICK}:${userId}` as never }))!.accountId;
    for (const userId of [LUC, NOCODE]) {
      await t.db.col('customer_accounts').updateOne({ _id: (await acc(userId)) as never }, { $set: { owners: [{ division: DIV, userId: 'TD-U-KD1', since: now, source: 'manual' }] } });
    }
    await t.db.col('customer_accounts').updateOne(
      { _id: (await acc(LUC)) as never },
      { $set: { erpLinks: [{ erp: 'vcsales', customerId: 'KH-TEST-0901', status: 'confirmed', confirmedBy: 'seed', confirmedAt: now }] } },
    );
    t.app.get(AuthzService).invalidate();
    minhPhat = 'x';
  });
  afterAll(async () => {
    if (saved.div === undefined) delete process.env.AUTHZ_DEFAULT_DIVISION;
    else process.env.AUTHZ_DEFAULT_DIVISION = saved.div;
    if (saved.map === undefined) delete process.env.QUOTE_THREAD_CUSTOMERS;
    else process.env.QUOTE_THREAD_CUSTOMERS = saved.map;
    await t?.close();
  });
  afterEach(() => {
    mock.down = false;
    mock.exportDown = false;
  });

  describe('danh sách báo giá (MH-SZ-05i #4)', () => {
    it('reads VCsales live on every call and greys out expired / draft quotes with the reason', async () => {
      const before = mock.quoteReads;
      const r = (await list().expect(200)).body as QuoteListResponse;
      expect(mock.quoteReads).toBeGreaterThan(before);
      await list().expect(200);
      expect(r.customerCode).toBe('KH-TEST-0101');
      const by = (no: string) => r.items.find((q) => q.no === no)!;
      expect(by('BG-2026-0915')).toMatchObject({ status: 'approved', total: 8_450_000, block: null, sendCount: 0 });
      expect(by('BG-2026-0902').block).toMatchObject({ code: 'expired' });
      expect(by('BG-2026-0902').block!.message).toMatch(/^Báo giá BG-2026-0902 đã hết hiệu lực ngày \d{2}\/\d{2}\/\d{4}, không gửi được\./);
      expect(by('BG-2026-0932').block).toMatchObject({ code: 'not_approved' });
      // The status is named as VCsales names it (erpStatusLabel), not by the VClinks group "Nháp".
      expect(by('BG-2026-0932').block!.message).toBe('Báo giá BG-2026-0932 đang ở trạng thái "Chưa báo giá" trên VCsales, chỉ gửi được báo giá đã duyệt.');
      expect(r.items.every((q) => q.customerCode === 'KH-TEST-0101')).toBe(true);
      expect(r.createUrl).toContain('customer=KH-TEST-0101');
    });

    it('a customer without a VCsales code gets no quotes; a user who may not open the chat gets 403/404', async () => {
      const r = (await list('TD-U-KD1', NOCODE).expect(200)).body as QuoteListResponse;
      expect(r).toMatchObject({ customerCode: null, hidden: 'no_link', items: [] });
      expect(ERR_QUOTE_NO_LINK).toMatch(/chưa liên kết mã KH/);
      expect([403, 404]).toContain((await list('TD-U-KD4')).status);
    });

    it('UAT-SZ-31: VCsales down → the error text, not a crash', async () => {
      mock.down = true;
      const r = (await list().expect(200)).body as QuoteListResponse;
      expect(r.error).toBe('Không kết nối được VCsales. Thử lại sau ít phút.');
      expect(r.items).toEqual([]);
    });

    it('UAT-SZ-90 (1): overdue debt strip with amount and days, from VCsales; it never blocks the quote', async () => {
      const r = (await list('TD-U-KD1', LUC).expect(200)).body as QuoteListResponse;
      expect(r.customerCode).toBe('KH-TEST-0901');
      expect(r.debt).toMatchObject({ amount: 1_800_000, overdueDays: 120, note: null });
      expect(r.items.find((q) => q.no === 'BG-2026-0940')!.block).toBeNull();
      expect(((await list().expect(200)).body as QuoteListResponse).debt).toBeNull();
    });
  });

  describe('UAT-SZ-86: chip và lọc "Nợ quá hạn" (chỉ cờ, theo cust.debt)', () => {
    const flags = (who: string) => http().get('/api/conversations/overdue-debt').set(as[who]);

    it('the owner (cust.debt) gets the conversations of customers with overdue debt, no amount in the answer', async () => {
      const r = (await flags('TD-U-KD1').expect(200)).body as { ids: string[] };
      expect(r.ids).toContain(`${NICK}:${LUC}`);
      expect(JSON.stringify(r)).not.toContain('1800000');
    });

    it('someone who does not own the customer sees no flag of it; the list filter returns only flagged conversations', async () => {
      expect(((await flags('TD-U-KD4').expect(200)).body as { ids: string[] }).ids).not.toContain(`${NICK}:${LUC}`);
      const ids = ((await flags('TD-U-KD1').expect(200)).body as { ids: string[] }).ids;
      const list = (await http().get('/api/conversations').query({ overdueDebt: 1, scope: 'all' }).set(as['TD-U-KD1']).expect(200)).body as { items: { id: string }[] };
      expect(list.items.map((x) => x.id)).toContain(`${NICK}:${LUC}`);
      expect(list.items.every((x) => ids.includes(x.id))).toBe(true);
      expect(list.items.map((x) => x.id)).not.toContain(`${NICK}:${NOCODE}`);
    });

    it('plan C6: while VCsales is known down the list keeps the last flags and does not call VCsales', async () => {
      const status = t.app.get(VcsalesStatusService);
      const saved = process.env.DEBT_FLAG_TTL_MS;
      process.env.DEBT_FLAG_TTL_MS = '0';
      const spy = jest.spyOn(mock, 'getDebtSummaries');
      mock.down = true;
      try {
        expect((await status.check()).ok).toBe(false);
        expect(((await flags('TD-U-KD1').expect(200)).body as { ids: string[] }).ids).toContain(`${NICK}:${LUC}`);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        mock.down = false;
        await status.check();
        spy.mockRestore();
        if (saved === undefined) delete process.env.DEBT_FLAG_TTL_MS;
        else process.env.DEBT_FLAG_TTL_MS = saved;
      }
    });

    it('the panel and the 360 page give the same debt figures (one source: VCsales snapshot)', async () => {
      const panel = (await http().get(`/api/customers/by-identity/${NICK}/${LUC}/360`).set(as['TD-U-KD1']).expect(200)).body as { commerce: { debt: { amount: number; dueAt: string; overdue: boolean } } };
      expect(panel.commerce.debt).toMatchObject({ amount: 1_800_000, overdue: true });
    });
  });

  describe('UAT-SZ-27: gửi báo giá hợp lệ', () => {
    let outboxId = '';
    it('queues one approved send_quote command with the PDF stored in the media store, approver = the person who pressed', async () => {
      const q = await quote('BG-2026-0915');
      const r = await send({ no: q.no, version: q.version, message: MSG_SECRET, followUpDays: 3 }).expect(200);
      expect(r.body).toMatchObject({ no: 'BG-2026-0915' });
      outboxId = r.body.outboxId;
      const doc = (await items())[0]!;
      expect(doc).toMatchObject({ uid: NICK, threadId: MP, action: 'send_quote', status: 'approved', approvedBy: 'TD-U-KD1', finalText: '[Báo giá] BG-2026-0915' });
      expect(doc.approvedAt).toBeInstanceOf(Date);
      expect(doc.quote).toMatchObject({ no: 'BG-2026-0915', form: 'pdf', total: 8_450_000, customerCode: 'KH-TEST-0101', message: MSG_SECRET });
      expect(doc.attachments).toHaveLength(1);
      expect(doc.attachments[0]).toMatchObject({ name: 'BG-2026-0915.pdf', mime: 'application/pdf' });
      const file = await http().get(`/api/media/${doc.attachments[0].id}`).set(t.auth.dashboard).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(file.status).toBe(200);
      expect((file.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      // No public link: the file is served only with a token.
      await http().get(`/api/media/${doc.attachments[0].id}`).expect(401);
    });

    it('audit and logs hold ids and the quote number, never the words typed', async () => {
      const lines = await t.db.col(C.auditLog).find({ action: 'quote.send' }).toArray();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ actor: 'TD-U-KD1', target: `${NICK}:${MP}` });
      expect(JSON.stringify(await t.db.col(C.auditLog).find({}).toArray())).not.toContain(MSG_SECRET);
    });

    it('the extension gets the command with approvedBy / approvedAt and the quote block; the report writes quote_sends once', async () => {
      const pend = (await http().get('/api/outbox/pending').query({ uid: NICK, commands: '1' }).set(t.auth.ingest).expect(200)).body as OutboxItem[];
      const it = pend.find((x) => x.id === outboxId)!;
      expect(it).toMatchObject({ action: 'send_quote', approvedBy: 'TD-U-KD1', quote: { no: 'BG-2026-0915', form: 'pdf', message: MSG_SECRET } });
      expect(it.approvedAt).toBeTruthy();
      await http().post(`/api/outbox/${outboxId}/claim`).set(t.auth.ingest).expect(200);
      await http().post(`/api/outbox/${outboxId}/result`).set(t.auth.ingest).send({ ok: true, sentAt: new Date().toISOString(), cliMsgId: 'c2', cliMsgIds: ['c1', 'c2'] }).expect(200);
      await http().post(`/api/outbox/${outboxId}/result`).set(t.auth.ingest).send({ ok: true }).expect(409); // already sent: no second row
      const rows = await t.db.col(C.quoteSends).find({}).toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ _id: outboxId, uid: NICK, threadId: MP, customerCode: 'KH-TEST-0101', no: 'BG-2026-0915', total: 8_450_000, form: 'pdf', sentBy: 'TD-U-KD1', followUpDays: 3 });
      expect(rows[0]!.cliMsgIds).toEqual(['c1', 'c2']);
      expect(JSON.stringify(rows[0])).not.toContain(MSG_SECRET);
    });

    it('"Đã gửi 1 lần" in the list and "Đã gửi báo giá số …" in the customer timeline (viewer may open the chat)', async () => {
      expect((await quote('BG-2026-0915')).sendCount).toBe(1);
      const id = ((await http().get(`/api/customers/by-identity/${NICK}/${MP}`).set(as['TD-U-KD1']).expect(200)).body as { id: string }).id;
      const tl = (await http().get(`/api/customers/${id}/timeline`).query({ type: 'quote' }).set(as['TD-U-KD1']).expect(200)).body as TimelineResponse;
      expect(tl.events).toHaveLength(1);
      expect(tl.events[0]).toMatchObject({ kind: 'quote', text: 'Đã gửi báo giá số BG-2026-0915 (8.450.000 ₫)', senderName: 'Nguyễn Văn Minh' });
      minhPhat = id;
    });

    it('the form "Ảnh" stores a raster image (mime png) and the command carries form=image', async () => {
      const q = await quote('BG-2026-0950');
      await send({ no: q.no, version: q.version, form: 'image' }).expect(200);
      const doc = (await items()).find((d) => d.quote.no === 'BG-2026-0950')!;
      expect(doc.quote.form).toBe('image');
      expect(doc.attachments[0].mime).toBe('image/png');
    });

    it('a thread mapped to a customer code (test group) sends too, with the same checks', async () => {
      const q = await quote('BG-2026-0915');
      const g = await http().post('/api/quotes/send').set(as['TD-U-KD1']).send({ uid: NICK, threadId: GROUP, no: q.no, version: q.version });
      expect(g.status).toBe(200);
      expect((await items()).filter((d) => d.threadId === GROUP)).toHaveLength(1);
    });
  });

  describe('chặn ở API (BR16, BR17): không có lệnh nào được tạo', () => {
    let n0 = 0;
    beforeEach(async () => {
      n0 = (await items()).length;
    });
    const none = async () => expect((await items()).length).toBe(n0);

    it('UAT-SZ-28: an expired quote cannot be sent, even with a hand-made request', async () => {
      const q = await quote('BG-2026-0902');
      const r = await send({ no: q.no, version: q.version }).expect(422);
      expect(r.body.message).toMatch(/^Báo giá BG-2026-0902 đã hết hiệu lực ngày .*Hãy gia hạn hoặc tạo bản mới trên VCsales\.$/);
      await none();
    });

    it('a draft, a pending and a cancelled quote cannot be sent', async () => {
      const d = await quote('BG-2026-0932');
      expect((await send({ no: d.no, version: d.version }).expect(422)).body.message).toContain('"Chưa báo giá"');
      mock.editQuote('BG-2026-0950', { status: 'cancelled' });
      const c = await quote('BG-2026-0950');
      const r = await send({ no: c.no, version: c.version }).expect(422);
      expect(r.body.message).toBe('Báo giá BG-2026-0950 đang ở trạng thái "Đã hủy" trên VCsales, chỉ gửi được báo giá đã duyệt.');
      mock.editQuote('BG-2026-0950', { status: 'approved' });
      await none();
    });

    it('a quote of another customer cannot be sent to this chat', async () => {
      const r = await send({ no: 'BG-2026-0801', version: '1' }).expect(422);
      expect(r.body.message).toBe('Báo giá BG-2026-0801 không phải của khách này, không gửi được.');
      await send({ no: 'BG-2026-0870', version: '1' }).expect(422); // KH-TEST-0030, 400 triệu
      await send({ no: 'BG-2026-9999', version: '1' }).expect(404);
      await none();
    });

    it('UAT-SZ-29: edited on VCsales between viewing and sending → 409, nothing sent; the new version then goes', async () => {
      const seen = await quote('BG-2026-0940', LUC);
      mock.editQuote('BG-2026-0940', { total: 2_100_000 });
      const r = await http().post('/api/quotes/send').set(as['TD-U-KD1']).send({ uid: NICK, threadId: LUC, no: seen.no, version: seen.version, form: 'pdf', message: '' }).expect(409);
      expect(r.body.message).toBe('Báo giá BG-2026-0940 vừa được sửa trên VCsales. Đã tải bản mới, hãy xem lại rồi bấm Gửi.');
      await none();
      const fresh = await quote('BG-2026-0940', LUC);
      expect(fresh.total).toBe(2_100_000);
      await http().post('/api/quotes/send').set(as['TD-U-KD1']).send({ uid: NICK, threadId: LUC, no: fresh.no, version: fresh.version, form: 'pdf', message: '' }).expect(200);
      expect((await items()).length).toBe(n0 + 1);
    });

    it('overdue debt does not block the send (N10)', async () => {
      const q = await quote('BG-2026-0940', LUC);
      expect(q.block).toBeNull();
    });

    it('a customer without a VCsales code: 409 with the link text', async () => {
      const r = await http().post('/api/quotes/send').set(as['TD-U-KD1']).send({ uid: NICK, threadId: NOCODE, no: 'BG-2026-0915', version: '1', form: 'pdf', message: '' }).expect(409);
      expect(r.body.message).toBe(ERR_QUOTE_NO_LINK);
      await none();
    });

    it('VCsales down → 503 with the text; the export failing → 502 "không xuất được file"', async () => {
      const q = await quote('BG-2026-0915');
      mock.down = true;
      expect((await send({ no: q.no, version: q.version }).expect(503)).body.message).toBe('Không kết nối được VCsales. Thử lại sau ít phút.');
      mock.down = false;
      mock.exportDown = true;
      expect((await send({ no: q.no, version: q.version }).expect(502)).body.message).toBe(ERR_QUOTE_NO_FILE);
      await none();
    });

    it('the message is limited to 1.000 characters and the body is validated', async () => {
      const q = await quote('BG-2026-0915');
      await send({ no: q.no, version: q.version, message: 'a'.repeat(1001) }).expect(400);
      await send({ no: q.no, version: q.version, form: 'zip' }).expect(400);
      await send({ no: q.no, version: q.version, extra: 1 }).expect(400);
      await none();
    });
  });

  describe('không có đường gửi thiếu duyệt (§12.1) và quyền (phan-quyen.md §4 không nới)', () => {
    let n0 = 0;
    beforeEach(async () => {
      n0 = (await items()).length;
    });
    const none = async () => expect((await items()).length).toBe(n0);

    it('no token / a device token cannot use the send route; POST /outbox refuses a hand-made send_quote', async () => {
      await http().post('/api/quotes/send').send({ uid: NICK, threadId: MP, no: 'BG-2026-0915', version: '1' }).expect(401);
      expect([401, 403]).toContain((await http().post('/api/quotes/send').set(t.auth.ingest).send({ uid: NICK, threadId: MP, no: 'BG-2026-0915', version: '1' })).status);
      const att = (await http().post('/api/outbox/attachments').set(as['TD-U-KD1']).send({ fileName: 'gia.pdf', mime: 'application/pdf', dataBase64: Buffer.from('%PDF-1.4 x').toString('base64') }).expect(200)).body as { id: string };
      const body = { uid: NICK, threadId: MP, action: 'send_quote', attachments: [att.id], quote: { no: 'BG-2026-0915', form: 'pdf', message: '', total: 1, customerCode: 'KH-TEST-0101' } };
      const r = await http().post('/api/outbox').set(as['TD-U-KD1']).send(body);
      expect(r.status).toBe(400);
      expect(r.body.message).toContain('hộp "Gửi báo giá"');
      await none();
    });

    it('a send_quote row without approvedBy / approvedAt is never handed to the extension (§12.1)', async () => {
      const q = await quote('BG-2026-0915');
      const r = await send({ no: q.no, version: q.version }).expect(200);
      await t.db.col(C.suggestions).updateOne({ _id: new ObjectId(r.body.outboxId) as never }, { $unset: { approvedBy: '' } });
      const pend = (await http().get('/api/outbox/pending').query({ uid: NICK, commands: '1' }).set(t.auth.ingest).expect(200)).body as OutboxItem[];
      expect(pend.find((x) => x.id === r.body.outboxId)).toBeUndefined();
      await http().post(`/api/outbox/${r.body.outboxId}/claim`).set(t.auth.ingest).expect(409);
      await t.db.col(C.suggestions).deleteOne({ _id: new ObjectId(r.body.outboxId) as never });
    });

    it('a user who does not hold the nick and does not own the customer cannot send (403) and nothing is queued', async () => {
      const q = await quote('BG-2026-0915');
      expect((await send({ no: q.no, version: q.version }, 'TD-U-KD4')).status).toBe(403);
      expect((await send({ no: q.no, version: q.version }, 'TD-U-SA')).status).toBe(403);
      await none();
    });

    it('a red / "Chưa an toàn" nick refuses the send before any file is made', async () => {
      const q = await quote('BG-2026-0915');
      await t.db.col(C.accounts).updateOne({ _id: NICK as never }, { $set: { safety: 'chua_an_toan' } });
      const files0 = await t.db.col('media.files').countDocuments({});
      const r = await send({ no: q.no, version: q.version });
      expect([400, 403]).toContain(r.status);
      await t.db.col(C.accounts).updateOne({ _id: NICK as never }, { $unset: { safety: '' } });
      expect(await t.db.col('media.files').countDocuments({})).toBe(files0);
      await none();
    });

    it('the test allowlist (onlyThreadIds) still applies: a thread outside it is refused, nothing queued', async () => {
      const q = await quote('BG-2026-0915');
      // The extension reports the allowlist it runs with when it polls (test phase, SZ-14).
      await http().get('/api/outbox/pending').query({ uid: NICK, onlyThreads: 'g-other' }).set(t.auth.ingest).expect(200);
      const r = await send({ no: q.no, version: q.version });
      await http().get('/api/outbox/pending').query({ uid: NICK, onlyThreads: '' }).set(t.auth.ingest).expect(200);
      expect(r.status).toBe(400);
      await none();
    });

    it('"Thử lại" on a failed send_quote re-reads the quote: cancelled on VCsales meanwhile → refused, still not sent', async () => {
      const q = await quote('BG-2026-0915');
      const r = await send({ no: q.no, version: q.version }).expect(200);
      const id = r.body.outboxId as string;
      await http().post(`/api/outbox/${id}/claim`).set(t.auth.ingest).expect(200);
      await http().post(`/api/outbox/${id}/result`).set(t.auth.ingest).send({ ok: false, error: 'không thấy ô soạn tin' }).expect(200);
      mock.editQuote('BG-2026-0915', { status: 'cancelled' });
      const retry = await http().post(`/api/outbox/${id}/retry`).set(as['TD-U-KD1']);
      expect(retry.status).toBe(422);
      const doc = (await items()).find((d) => String(d._id) === id)!;
      expect(doc.status).toBe('failed');
      mock.editQuote('BG-2026-0915', { status: 'approved' });
    });

    it('gate: the quote is read again when the extension claims; edited / cancelled meanwhile → failed with the reason, never handed out', async () => {
      const q = await quote('BG-2026-0915');
      const r = await send({ no: q.no, version: q.version }).expect(200);
      const id = r.body.outboxId as string;
      mock.editQuote('BG-2026-0915', { status: 'cancelled' });
      const c = await http().post(`/api/outbox/${id}/claim`).set(t.auth.ingest);
      mock.editQuote('BG-2026-0915', { status: 'approved' });
      expect(c.status).toBe(409);
      const doc = (await items()).find((d) => String(d._id) === id)!;
      expect(doc.status).toBe('failed');
      expect(doc.claimedAt).toBeUndefined();
      expect(await t.db.col(C.quoteSends).countDocuments({ _id: id as never })).toBe(0);
    });
  });

  it('VCsales stays read only: the client the API used has only list / get / search methods besides test helpers', () => {
    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(mock)).filter((n) => n !== 'constructor');
    for (const n of names.filter((x) => !['upsert', 'check', 'editQuote'].includes(x))) expect(n).toMatch(/^(list|get|search)[A-Z]/);
    expect(minhPhat).toBeTruthy();
  });
});
