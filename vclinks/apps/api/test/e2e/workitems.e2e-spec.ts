import request from 'supertest';
import type { MockVcsaleClient } from '@vclinks/vcsale-client';
import { ROLE_MATRIX, type WorkitemDetail, type WorkitemSummary } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { ROUTE_PERMISSIONS } from '../../src/authz/route-permissions';
import { VCSALE_CLIENT } from '../../src/customers/customers.service';
import { C } from '../../src/db/db.service';
import { WorkitemsService } from '../../src/workitems/workitems.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1c-03: phiếu báo giá / hậu mãi, CSKH soạn ⇄ NVKD duyệt (03 QT-SZ-13…15, MH-SZ-15; 01 PQ-119…121).
 * UAT-SZ-94, 95, 96, 98 and UAT-PQ-119…122 as far as they can run without Zalo: the extension side is played by
 * claim + result calls; VCsales is the mock. Includes the proof that CSKH has no path to send on a nick.
 */
const NK = (n: string) => `90000000000${n}`;
const DIV = 'TD-DV-VCP';
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  [DIV, 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', DIV],
  ['TD-DV-CS', 'Nhóm CSKH VCparts', 'nhom_cskh', DIV],
  ['TD-DV-SA', 'Nhóm Sale admin VCparts', 'nhom_sale_admin', DIV],
];
const MANAGERS: Record<string, string> = { [DIV]: 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1', 'TD-DV-CS': 'TD-U-GSCS' };
const USERS: [string, string, string, string][] = [
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', DIV],
  ['TD-U-GS1', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Lê Thị Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD3', 'Trần Văn Tú', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-GSCS', 'Phạm Thị Mai', 'cskh', 'TD-DV-CS'],
  ['TD-U-CS1', 'Đỗ Thị Lan', 'cskh', 'TD-DV-CS'],
  ['TD-U-CS2', 'Vũ Thị Thu', 'cskh', 'TD-DV-CS'],
  ['TD-U-SA', 'Ngô Bích Ngọc', 'sale_admin', 'TD-DV-SA'],
];
const NICK = NK('01');
const NICK3 = NK('03');
const MP = '9101101'; // Garage Minh Phát, KH-TEST-0101, owner Minh
const K25 = '9302501'; // khách bảo hành trên nick của Tú
const SECRET = 'Báo giá bộ côn Hilux 2017 máy dầu, gọi em 0912 345 678';
const OTHER = 'Tin khác trong hội thoại không được chọn';

describe('Phiếu CSKH soạn – NVKD duyệt (e2e, M1c-03)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const saved = { div: process.env.AUTHZ_DEFAULT_DIVISION, jobs: process.env.WORKITEM_JOBS };
  let mock: MockVcsaleClient;
  let svc: WorkitemsService;
  const msgId = (uid: string, id: string) => `${uid}:${id}`;
  const notes = async (userId: string) => (await t.db.col<{ title: string; kind: string }>('notifications').find({ userId }).toArray()).map((n) => n.title);
  const outboxCount = () => t.db.col(C.suggestions).countDocuments({});

  const create = (body: Record<string, unknown>, who = 'TD-U-KD1') => http().post('/api/workitems').set(as[who]).send({ uid: NICK, threadId: MP, kind: 'bao_gia', messageIds: [msgId(NICK, 'm1'), msgId(NICK, 'm2')], ...body });
  /** A quote item prepared by Lan and waiting for Minh. */
  const prepared = async (no = 'BG-2026-0950'): Promise<WorkitemDetail> => {
    const c = (await create({ note: 'giá đại lý cấp 2' }).expect(201)).body as WorkitemDetail;
    const lan = c.assigneeId === 'TD-U-CS1' ? 'TD-U-CS1' : 'TD-U-CS2';
    await http().post(`/api/workitems/${c.id}/start`).set(as[lan]).expect(200);
    await http().patch(`/api/workitems/${c.id}`).set(as[lan]).send({ quoteNo: no, message: 'Dạ anh Tuấn, em gửi báo giá ạ' }).expect(200);
    return (await http().post(`/api/workitems/${c.id}/submit`).set(as[lan]).expect(200)).body as WorkitemDetail;
  };

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = DIV;
    process.env.WORKITEM_JOBS = 'off';
    t = await startE2EApp();
    mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
    svc = t.app.get(WorkitemsService);
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : DIV,
        managerUserId: MANAGERS[id] ?? null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    for (const [uid, holder, cust, name, phone] of [[NICK, 'TD-U-KD1', MP, 'Anh Tuấn Minh Phát', '0900 000 101'], [NICK3, 'TD-U-KD3', K25, 'Garage Phúc Lộc', '0900 002 501']] as const) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
      await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid, items: [{ userId: cust, displayName: name, phone }] }).expect(200);
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid, items: [{ threadId: cust, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
      await http()
        .post('/api/ingest/messages')
        .set(t.auth.ingest)
        .send({
          uid,
          items: [
            { msgId: 'm1', threadId: cust, fromUid: cust, toUid: uid, senderName: name, msgType: 'webchat', text: SECRET, sentAt: Date.now() - 3000 },
            { msgId: 'm2', threadId: cust, fromUid: cust, toUid: uid, senderName: name, msgType: 'webchat', text: 'lọc dầu, lọc gió', sentAt: Date.now() - 2000 },
            { msgId: 'm3', threadId: cust, fromUid: cust, toUid: uid, senderName: name, msgType: 'webchat', text: OTHER, sentAt: Date.now() - 1000 },
          ],
        })
        .expect(200);
    }
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    await http().post('/api/customers/sweep').set(as['TD-U-SA']).expect(200);
    await http().post('/api/customers/import').set(as['TD-U-SA']).send({}).expect(200);
    // Minh Phát: owner Minh, linked to KH-TEST-0101 (set by hand like quotes.e2e does for customers outside the import).
    const link = await t.db.col<{ accountId: string }>('identity_links').findOne({ _id: `${NICK}:${MP}` as never });
    await t.db.col('customer_accounts').updateOne(
      { _id: link!.accountId as never },
      { $set: { owners: [{ division: DIV, userId: 'TD-U-KD1', since: now, source: 'manual' }], erpLinks: [{ erp: 'vcsales', customerId: 'KH-TEST-0101', status: 'confirmed', confirmedBy: 'seed', confirmedAt: now }] } },
    );
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    for (const [k, v] of [['AUTHZ_DEFAULT_DIVISION', saved.div], ['WORKITEM_JOBS', saved.jobs]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await t?.close();
  });

  describe('hàng việc (D9-01, BR22)', () => {
    it('GĐ sets the queues; only CSKH of the division can be members; CSKH cannot set them', async () => {
      await http().put('/api/workitems/queues').set(as['TD-U-GD']).send({ divisionId: DIV, queue: 'ban_hang', members: ['TD-U-CS1'] }).expect(200);
      await http().put('/api/workitems/queues').set(as['TD-U-GD']).send({ divisionId: DIV, queue: 'hau_mai', members: ['TD-U-CS2'] }).expect(200);
      await http().put('/api/workitems/queues').set(as['TD-U-GD']).send({ divisionId: DIV, queue: 'hau_mai', members: ['TD-U-KD1'] }).expect(400);
      await http().put('/api/workitems/queues').set(as['TD-U-CS1']).send({ divisionId: DIV, queue: 'hau_mai', members: ['TD-U-CS1'] }).expect(403);
    });
  });

  describe('QT-SZ-14 tạo phiếu (UAT-SZ-93)', () => {
    it('NVKD creates a quote item from ≤ 10 chosen messages; it goes to Lan in "Bán hàng"; nothing is sent', async () => {
      const before = await outboxCount();
      const r = (await create({ note: 'giá đại lý cấp 2' }).expect(201)).body as WorkitemDetail;
      expect(r).toMatchObject({ kind: 'bao_gia', queue: 'ban_hang', status: 'moi', assigneeId: 'TD-U-CS1', approverId: 'TD-U-KD1' });
      expect(r.code).toMatch(/^TK-\d{4}$/);
      expect(await outboxCount()).toBe(before);
      expect((await notes('TD-U-CS1')).some((x) => x.includes(r.code))).toBe(true);
      // The notice never carries message text.
      expect((await notes('TD-U-CS1')).join(' ')).not.toContain('Hilux');
    });
    it('refuses messages of another conversation, more than 10, and people without ticket.create on the chat', async () => {
      await create({ messageIds: [msgId(NICK3, 'm1')] }).expect(400);
      await create({ messageIds: Array.from({ length: 11 }, (_, i) => `x${i}`) }).expect(400);
      await create({}, 'TD-U-KD2').expect(403);
      await create({}, 'TD-U-CS1').expect(403);
    });
  });

  describe('UAT-PQ-119 (phần M1c-03): CSKH chỉ thấy tin được chọn, SĐT bị che', () => {
    it('Lan reads only the chosen messages of the item, phone masked; the conversation itself stays closed', async () => {
      const r = (await create({}).expect(201)).body as WorkitemDetail;
      const d = (await http().get(`/api/workitems/${r.id}`).set(as['TD-U-CS1']).expect(200)).body as WorkitemDetail;
      expect(d.messages.map((m) => m.msgId)).toEqual(['m1', 'm2']);
      expect(JSON.stringify(d)).not.toContain(OTHER);
      expect(d.messages[0].text).not.toContain('0912 345 678');
      expect(d.messages[0].textMasked).toBe(1);
      // The holder sees the number in full.
      const m = (await http().get(`/api/workitems/${r.id}`).set(as['TD-U-KD1']).expect(200)).body as WorkitemDetail;
      expect(m.messages[0].text).toContain('0912 345 678');
      // CS orders_only stays closed: no access to the conversation or its messages.
      const conv = encodeURIComponent(`${NICK}:${MP}`);
      const res = await http().get(`/api/conversations/${conv}/messages`).set(as['TD-U-CS1']);
      expect([403, 404]).toContain(res.status);
      // Thu (other queue, not assigned) does not see the item at all.
      await http().get(`/api/workitems/${r.id}`).set(as['TD-U-CS2']).expect(404);
      // The audit has no text.
      const audit = await t.db.col('audit_log').find({ target: r.id }).toArray();
      expect(JSON.stringify(audit)).not.toContain('Hilux');
    });
  });

  describe('vòng duyệt (QT-SZ-15)', () => {
    it('CSKH can attach only an approved, valid quote; submit needs words and a quote', async () => {
      const c = (await create({}).expect(201)).body as WorkitemDetail;
      await http().post(`/api/workitems/${c.id}/start`).set(as['TD-U-CS1']).expect(200);
      await http().post(`/api/workitems/${c.id}/submit`).set(as['TD-U-CS1']).expect(422);
      await http().patch(`/api/workitems/${c.id}`).set(as['TD-U-CS1']).send({ quoteNo: 'BG-2026-0932' }).expect(422); // draft (UAT-OA-166)
      await http().patch(`/api/workitems/${c.id}`).set(as['TD-U-CS1']).send({ quoteNo: 'BG-2026-0902' }).expect(422); // expired
      await http().patch(`/api/workitems/${c.id}`).set(as['TD-U-CS1']).send({ quoteNo: 'BG-2026-0950' }).expect(200);
      await http().post(`/api/workitems/${c.id}/submit`).set(as['TD-U-CS1']).expect(422);
      await http().patch(`/api/workitems/${c.id}`).set(as['TD-U-CS1']).send({ message: 'Dạ em gửi báo giá ạ' }).expect(200);
      const s = (await http().post(`/api/workitems/${c.id}/submit`).set(as['TD-U-CS1']).expect(200)).body as WorkitemDetail;
      expect(s.status).toBe('cho_nvkd_duyet');
      expect((await notes('TD-U-KD1')).some((x) => x.includes(c.code) && x.startsWith('Cần làm ngay'))).toBe(true);
    });

    it('UAT-SZ-95: "Trả lại" needs a reason; return_count +1; Lan is told; past T-36 the supervisors are told', async () => {
      const p = await prepared();
      await http().post(`/api/workitems/${p.id}/return`).set(as['TD-U-KD1']).send({}).expect(400);
      const r = (await http().post(`/api/workitems/${p.id}/return`).set(as['TD-U-KD1']).send({ reason: 'sai_so_luong' }).expect(200)).body as WorkitemDetail;
      expect(r).toMatchObject({ status: 'tra_lai', returnCount: 1 });
      expect((await notes('TD-U-CS1')).some((x) => x.includes(p.code) && x.includes('Sai số lượng'))).toBe(true);
      for (let i = 2; i <= 3; i++) {
        await http().post(`/api/workitems/${p.id}/submit`).set(as['TD-U-CS1']).expect(200);
        await http().post(`/api/workitems/${p.id}/return`).set(as['TD-U-KD1']).send({ reason: 'gia_chua_dung', note: 'ghi chú tự do' }).expect(200);
      }
      const gs = await notes('TD-U-GS1');
      const gscs = await notes('TD-U-GSCS');
      expect(gs.some((x) => x.includes(p.code) && x.includes('3 lần'))).toBe(true);
      expect(gscs.some((x) => x.includes(p.code) && x.includes('3 lần'))).toBe(true);
      expect(gs.join(' ')).not.toContain('ghi chú tự do');
    });

    it('UAT-SZ-96: the quote cancelled on VCsales locks "Duyệt & gửi" with the reason; the API refuses too', async () => {
      const p = await prepared('BG-2026-0915');
      mock.editQuote('BG-2026-0915', { status: 'cancelled' });
      try {
        const d = (await http().get(`/api/workitems/${p.id}`).set(as['TD-U-KD1']).expect(200)).body as WorkitemDetail;
        expect(d.can.approve).toBe(false);
        expect(d.can.approveBlock).toBe('Báo giá BG-2026-0915 đang "Đã hủy" trên VCsales. Trả lại để CSKH làm lại.');
        const before = await outboxCount();
        const r = await http().post(`/api/workitems/${p.id}/approve`).set(as['TD-U-KD1']).send({ message: 'Dạ em gửi ạ' });
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(await outboxCount()).toBe(before);
        const after = (await http().get(`/api/workitems/${p.id}`).set(as['TD-U-KD1']).expect(200)).body as WorkitemDetail;
        expect(after.status).toBe('cho_nvkd_duyet');
      } finally {
        mock.editQuote('BG-2026-0915', { status: 'approved' });
      }
    });

    it('UAT-SZ-94: Minh edits the words and presses "Duyệt & gửi": send_quote through QuotesService, approvedBy = Minh; sent → Chờ khách; Lan told', async () => {
      const p = await prepared();
      const d = (await http().get(`/api/workitems/${p.id}`).set(as['TD-U-KD1']).expect(200)).body as WorkitemDetail;
      expect(d.can.approve).toBe(true);
      const msg = 'Dạ anh Tuấn, em gửi báo giá ạ. Giao trong ngày ạ';
      const a = (await http().post(`/api/workitems/${p.id}/approve`).set(as['TD-U-KD1']).send({ message: msg, quoteVersion: d.quote!.version }).expect(200)).body as WorkitemDetail;
      expect(a.status).toBe('da_gui_khach');
      const doc = await t.db.col<{ _id: unknown; action: string; approvedBy: string; approvedAt: Date; quote: { no: string; message: string } }>(C.suggestions).findOne({ action: 'send_quote', 'quote.no': 'BG-2026-0950' } as never, { sort: { createdAt: -1 } });
      expect(doc).toMatchObject({ approvedBy: 'TD-U-KD1', quote: { no: 'BG-2026-0950', message: msg } });
      expect(doc!.approvedAt).toBeInstanceOf(Date);
      // A second press does not queue a second command.
      await http().post(`/api/workitems/${p.id}/approve`).set(as['TD-U-KD1']).send({ message: msg }).expect(409);
      const id = String(doc!._id);
      await http().post(`/api/outbox/${id}/claim`).set(t.auth.ingest).expect(200);
      await http().post(`/api/outbox/${id}/result`).set(t.auth.ingest).send({ ok: true, sentAt: new Date().toISOString(), cliMsgId: 'c2', cliMsgIds: ['c1', 'c2'] }).expect(200);
      const after = (await http().get(`/api/workitems/${p.id}`).set(as['TD-U-KD1']).expect(200)).body as WorkitemDetail;
      expect(after.status).toBe('cho_khach');
      expect(after.history.map((h) => h.event)).toEqual(expect.arrayContaining(['create', 'start', 'submit', 'approve', 'sent']));
      expect((await notes('TD-U-CS1')).some((x) => x.includes(p.code) && x.startsWith('Để biết'))).toBe(true);
      // Logs carry no words.
      const audit = await t.db.col('audit_log').find({ target: p.id }).toArray();
      expect(JSON.stringify(audit)).not.toContain('Giao trong ngày');
    });

    it('"Tôi tự trả lời" closes the item with result NVKD tự xử lý; nothing is sent', async () => {
      const p = await prepared();
      const before = await outboxCount();
      const r = (await http().post(`/api/workitems/${p.id}/self-reply`).set(as['TD-U-KD1']).send({}).expect(200)).body as WorkitemDetail;
      expect(r).toMatchObject({ status: 'xong', result: 'nvkd_tu_xu_ly' });
      expect(await outboxCount()).toBe(before);
    });

    it('a cancelled send command brings the item back to "Chờ NVKD duyệt"', async () => {
      const p = await prepared();
      const d = (await http().get(`/api/workitems/${p.id}`).set(as['TD-U-KD1']).expect(200)).body as WorkitemDetail;
      const a = (await http().post(`/api/workitems/${p.id}/approve`).set(as['TD-U-KD1']).send({ message: 'Dạ ạ', quoteVersion: d.quote!.version }).expect(200)).body as WorkitemDetail;
      const doc = await t.db.col<{ _id: unknown }>(C.suggestions).findOne({}, { sort: { createdAt: -1 } });
      await http().post(`/api/outbox/${String(doc!._id)}/cancel`).set(as['TD-U-KD1']).send({ reason: 'user' }).expect(200);
      expect(a.status).toBe('da_gui_khach');
      const back = (await http().get(`/api/workitems/${p.id}`).set(as['TD-U-KD1']).expect(200)).body as WorkitemDetail;
      expect(back.status).toBe('cho_nvkd_duyet');
    });

    it('reminds the approver at 10′ and tells the supervisors at 20′ (working minutes); GS cannot approve (on_behalf closed)', async () => {
      const p = await prepared();
      const monday9 = new Date('2026-10-05T02:00:00.000Z'); // 09:00 Asia/Ho_Chi_Minh, Monday
      await t.db.col('work_items').updateOne({ _id: p.id } as never, { $set: { submittedAt: monday9 } });
      await svc.sweep(new Date(monday9.getTime() + 11 * 60_000));
      expect((await notes('TD-U-KD1')).some((x) => x.startsWith('Nhắc') && x.includes(p.code))).toBe(true);
      expect((await notes('TD-U-GS1')).some((x) => x.includes(p.code) && x.includes('chờ NVKD duyệt'))).toBe(false);
      await svc.sweep(new Date(monday9.getTime() + 21 * 60_000));
      expect((await notes('TD-U-GS1')).some((x) => x.includes(p.code) && x.includes('chờ NVKD duyệt quá 20'))).toBe(true);
      // Hương sees it in her tray (escalated) but "Duyệt & gửi" stays closed for her until the on_behalf cell is opened.
      const tray = (await http().get('/api/workitems').query({ view: 'approvals' }).set(as['TD-U-GS1']).expect(200)).body as WorkitemSummary[];
      expect(tray.map((x) => x.id)).toContain(p.id);
      await http().post(`/api/workitems/${p.id}/approve`).set(as['TD-U-GS1']).send({ message: 'x' }).expect(403);
    });
  });

  describe('UAT-PQ-121 · "CSKH không có đường gửi qua nick"', () => {
    it('CSKH has no route, outbox call or quote send on the nick; only workitem.approve reaches the send', async () => {
      const p = await prepared();
      const before = await outboxCount();
      const d = (await http().get(`/api/workitems/${p.id}`).set(as['TD-U-CS1']).expect(200)).body as WorkitemDetail;
      expect(d.can.approve).toBe(false);
      await http().post(`/api/workitems/${p.id}/approve`).set(as['TD-U-CS1']).send({ message: 'Dạ' }).expect(403);
      await http().post('/api/outbox').set(as['TD-U-CS1']).send({ uid: NICK, threadId: MP, text: 'gửi thẳng' }).expect(403);
      await http().post('/api/quotes/send').set(as['TD-U-CS1']).send({ uid: NICK, threadId: MP, no: 'BG-2026-0950', form: 'pdf', message: 'x', version: '1' }).expect(403);
      // The extension and MCP send paths (pending / claim / mark_sent) are device / agent tokens only: a CSKH session is refused.
      await http().get('/api/outbox/pending').set(as['TD-U-CS1']).expect(403);
      await http().post('/api/outbox/000000000000000000000000/claim').set(as['TD-U-CS1']).expect(403);
      await http().post('/mcp').set(as['TD-U-CS1']).send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).expect(403);
      // Every CS action on the item leaves the outbox untouched.
      await http().post(`/api/workitems/${p.id}/return`).set(as['TD-U-CS1']).send({ reason: 'khac' }).expect(403);
      expect(await outboxCount()).toBe(before);
      // Static: the only workitem route that may create a command is keyed on workitem.approve, which CSKH lacks.
      const wiRoutes = Object.entries(ROUTE_PERMISSIONS).filter(([k]) => k.includes('/api/workitems'));
      const sendRoutes = wiRoutes.filter(([k]) => k.endsWith('/approve'));
      expect(sendRoutes).toEqual([['POST /api/workitems/:id/approve', { kind: 'perm', key: 'workitem.approve' }]]);
      expect(ROLE_MATRIX.cskh['workitem.approve']).toBeUndefined();
      // canSend on the personal nick is refused for every CSKH, the CSKH manager included.
      const authz = t.app.get(AuthzService);
      for (const cs of ['TD-U-CS1', 'TD-U-CS2', 'TD-U-GSCS']) expect((await authz.canSend(await authz.subject(cs), NICK, MP)).allowed).toBe(false);
      expect(ROLE_MATRIX.cskh['quote.send']).toBeUndefined();
      // Minh has the button.
      const m = (await http().get(`/api/workitems/${p.id}`).set(as['TD-U-KD1']).expect(200)).body as WorkitemDetail;
      expect(m.can.approve).toBe(true);
    });
  });

  describe('UAT-PQ-122 + UAT-SZ-98: trực thay duyệt phiếu hậu mãi, Chờ hãng', () => {
    it('the item shows in Linh\'s tray (cover), not Tú\'s; Linh approves; approvedBy = Linh; after sending → Chờ hãng', async () => {
      const from = new Date(Date.now() - 3600_000);
      const to = new Date(Date.now() + 86_400_000);
      await t.db.col('access_grants').insertOne({
        _id: 'cover-1', userId: 'TD-U-KD2', type: 'truc_thay', targetType: 'channel', targetId: NICK3, rights: ['xem', 'tra_loi', 'ghi_chu'],
        from, to, reason: 'Nghỉ phép', requestedBy: 'TD-U-GS1', approvedBy: 'TD-U-GS1', approvedAt: from, status: 'hieu_luc', absentUserId: 'TD-U-KD3',
      } as never);
      t.app.get(AuthzService).invalidate();
      const c = (await http()
        .post('/api/workitems')
        .set(as['TD-U-KD3'])
        .send({ uid: NICK3, threadId: K25, kind: 'hau_mai', aftersalesType: 'bao_hanh', note: 'Bơm nước kêu, khách đòi bảo hành', messageIds: [msgId(NICK3, 'm1')] })
        .expect(201)).body as WorkitemDetail;
      expect(c).toMatchObject({ queue: 'hau_mai', assigneeId: 'TD-U-CS2' });
      await http().post(`/api/workitems/${c.id}/start`).set(as['TD-U-CS2']).expect(200);
      await http().patch(`/api/workitems/${c.id}`).set(as['TD-U-CS2']).send({ message: 'Đã tiếp nhận bảo hành, gửi hãng kiểm định, hẹn 07/10', afterSend: 'cho_hang' }).expect(200);
      await http().post(`/api/workitems/${c.id}/submit`).set(as['TD-U-CS2']).expect(422); // UAT-OA-169: "Nhập hạn hẹn."
      await http().patch(`/api/workitems/${c.id}`).set(as['TD-U-CS2']).send({ vendorDueAt: '2026-10-07T03:00:00.000Z' }).expect(200);
      await http().post(`/api/workitems/${c.id}/submit`).set(as['TD-U-CS2']).expect(200);
      const linh = (await http().get('/api/workitems').query({ view: 'approvals' }).set(as['TD-U-KD2']).expect(200)).body as WorkitemSummary[];
      const tu = (await http().get('/api/workitems').query({ view: 'approvals' }).set(as['TD-U-KD3']).expect(200)).body as WorkitemSummary[];
      expect(linh.map((x) => x.id)).toContain(c.id);
      expect(tu.map((x) => x.id)).not.toContain(c.id);
      expect((await http().get('/api/workitems/counts').set(as['TD-U-KD2']).expect(200)).body.approvals).toBeGreaterThanOrEqual(1);
      const a = (await http().post(`/api/workitems/${c.id}/approve`).set(as['TD-U-KD2']).send({ message: 'Đã tiếp nhận bảo hành, gửi hãng kiểm định, hẹn 07/10' }).expect(200)).body as WorkitemDetail;
      expect(a.status).toBe('da_gui_khach');
      const doc = await t.db.col<{ _id: unknown; approvedBy: string; sendSource?: string; uid: string }>(C.suggestions).findOne({ uid: NICK3 } as never, { sort: { createdAt: -1 } });
      expect(doc).toMatchObject({ approvedBy: 'TD-U-KD2', sendSource: 'truc_thay' });
      const id = String(doc!._id);
      await http().post(`/api/outbox/${id}/claim`).set(t.auth.ingest).expect(200);
      await http().post(`/api/outbox/${id}/result`).set(t.auth.ingest).send({ ok: true, sentAt: new Date().toISOString(), cliMsgId: 'c9' }).expect(200);
      const after = (await http().get(`/api/workitems/${c.id}`).set(as['TD-U-CS2']).expect(200)).body as WorkitemDetail;
      expect(after.status).toBe('cho_hang');
      expect(after.vendorDueAt).toBe('2026-10-07T03:00:00.000Z');
      // Back from the vendor and closed with a result.
      await http().post(`/api/workitems/${c.id}/vendor-back`).set(as['TD-U-CS2']).expect(200);
      await http().post(`/api/workitems/${c.id}/close`).set(as['TD-U-CS2']).send({ result: 'khach_dong_y' }).expect(400);
      const x = (await http().post(`/api/workitems/${c.id}/close`).set(as['TD-U-CS2']).send({ result: 'doi_moi' }).expect(200)).body as WorkitemDetail;
      expect(x).toMatchObject({ status: 'xong', result: 'doi_moi' });
    });
  });

  describe('giám sát CSKH chia lại (PQ-121)', () => {
    it('the CSKH manager reassigns; an NVKD cannot', async () => {
      const c = (await create({}).expect(201)).body as WorkitemDetail;
      await http().post(`/api/workitems/${c.id}/assign`).set(as['TD-U-KD1']).send({ assigneeId: 'TD-U-CS2' }).expect(403);
      const r = (await http().post(`/api/workitems/${c.id}/assign`).set(as['TD-U-GSCS']).send({ assigneeId: 'TD-U-CS2' }).expect(200)).body as WorkitemDetail;
      expect(r.assigneeId).toBe('TD-U-CS2');
      await http().post(`/api/workitems/${c.id}/assign`).set(as['TD-U-GSCS']).send({ assigneeId: 'TD-U-KD1' }).expect(400);
    });
  });
});
