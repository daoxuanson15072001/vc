import request from 'supertest';
import { NO_ACCESS_TEXT } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { CUST_C, type CustomerAccountDoc, type IdentityLinkDoc } from '../../src/customers/customers.types';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-16 (UAT M1b): the "không được thấy" matrix of docs 01 §7.2 (target M1: 100% of the cases pass).
 * One seed from the TD data (docs/05-kiem-thu/du-lieu-kiem-thu.md §2, §3): 12 users, 4 Zalo nicks + 1 OA,
 * one customer conversation per channel. Every user is checked against EVERY conversation: what he may see
 * must be listed, and for everything else the read, the messages, the contacts and the send are refused
 * without leaking a name or a text. On top: moving a person between teams (PQ-08), an expired grant (PQ-32),
 * a customer of another division (PQ-22) and the read-only observer (PQ-39).
 */
const NK = (n: string) => `90000000000${n}`;
const OA1 = 'zoa_9000000000101';
const CUSTOMER = (uid: string) => `91${uid.slice(-4)}`;
const SECRET = (uid: string) => `BÍ MẬT-${uid.slice(-2)}`;
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-CS', 'Nhóm CSKH VCparts', 'nhom_cskh', 'TD-DV-VCP'],
  ['TD-DV-SA', 'Nhóm Sale admin VCparts', 'nhom_sale_admin', 'TD-DV-VCP'],
  ['TD-DV-VCE', 'Division VCedu', 'division', 'GOC'],
  ['TD-DV-TVTS', 'Tổ Tư vấn tuyển sinh', 'to_ban_hang', 'TD-DV-VCE'],
];
const MANAGERS: Record<string, string> = { 'TD-DV-VCP': 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1', 'TD-DV-HN2': 'TD-U-GS2', 'TD-DV-VCE': 'TD-U-GDE' };
const USERS: [string, string, string, string][] = [
  ['TD-U-AD', 'Đặng Văn Quân', 'admin', 'GOC'],
  ['TD-U-QS', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-GS1', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-GS2', 'Hồ Văn Đức', 'giam_sat_bh', 'TD-DV-HN2'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD4', 'Phạm Văn Hải', 'nvkd', 'TD-DV-HN2'],
  ['TD-U-CS2', 'Hoàng Thị Thu', 'cskh', 'TD-DV-CS'],
  ['TD-U-SA', 'Ngô Bích Ngọc', 'sale_admin', 'TD-DV-SA'],
  ['TD-U-GDE', 'Phùng Văn Lộc', 'giam_doc_bh', 'TD-DV-VCE'],
  ['TD-U-KDE', 'Lưu Thu Trang', 'nvkd', 'TD-DV-TVTS'],
];
const NICKS: [string, string, string | null][] = [
  [NK('01'), 'TD-U-KD1', null],
  [NK('02'), 'TD-U-KD2', null],
  [NK('04'), 'TD-U-KD4', null],
  [NK('08'), 'TD-U-KDE', 'TD-DV-VCE'],
];
const CONV = {
  n01: `${NK('01')}:${CUSTOMER(NK('01'))}`,
  n02: `${NK('02')}:${CUSTOMER(NK('02'))}`,
  n04: `${NK('04')}:${CUSTOMER(NK('04'))}`,
  n08: `${NK('08')}:${CUSTOMER(NK('08'))}`,
  oa: `${OA1}:777`,
};
const ALL = Object.values(CONV);
/** Who may see which conversation (docs 01 §3, §7.2 PQ-15, 16, 17, 19, 20, 22, 56). */
const VISIBLE: Record<string, string[]> = {
  'TD-U-KD1': [CONV.n01],
  'TD-U-KD2': [CONV.n02],
  'TD-U-KD4': [CONV.n04],
  'TD-U-GS1': [CONV.n01, CONV.n02],
  'TD-U-GS2': [CONV.n04],
  'TD-U-GD': [CONV.n01, CONV.n02, CONV.n04, CONV.oa],
  'TD-U-GDE': [CONV.n08],
  'TD-U-KDE': [CONV.n08],
  'TD-U-CS2': [CONV.oa],
  'TD-U-SA': [],
  'TD-U-AD': [],
  'TD-U-QS': ALL,
};

describe('UAT M1b: ca "không được thấy" (e2e, M1b-16)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;
  const enc = encodeURIComponent;
  const listIds = async (who: string) =>
    ((await http().get('/api/conversations').set(as[who]).expect(200)).body as { items: { id: string }[] }).items.map((i) => i.id).sort();

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : UNITS.find((u) => u[0] === parentId)![0],
        managerUserId: MANAGERS[id] ?? null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    for (const [uid, holder, division] of NICKS) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      const c = CUSTOMER(uid);
      await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid, items: [{ userId: c, displayName: `Khách ${c}`, phone: `0900000${uid.slice(-3)}` }] }).expect(200);
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid, items: [{ threadId: c, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
      await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid, items: [{ msgId: `m${uid.slice(-2)}`, threadId: c, fromUid: c, toUid: uid, senderName: 'Khách', msgType: 'webchat', text: SECRET(uid), sentAt: Date.now() }] }).expect(200);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
      if (division) await t.db.col(C.accounts).updateOne({ _id: uid } as never, { $set: { divisionId: division } });
    }
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    await t.db.col(C.accounts).insertOne({ _id: OA1, label: 'VCparts OA', channel: 'zalo_oa' } as never);
    await t.db.col(C.conversations).insertOne({ _id: CONV.oa, uid: OA1, threadId: '777', type: 'user', lastMsgAt: now, unread: 0 } as never);
    await t.db.col(C.messages).insertOne({ _id: `${OA1}:oa1`, uid: OA1, threadId: '777', msgId: 'oa1', fromUid: '777', text: 'BÍ MẬT-OA', sentAt: now } as never);
    await t.db.col('channel_access').insertOne({ _id: `${OA1}:org_unit:TD-DV-CS:gui`, channelId: OA1, principalType: 'org_unit', principalId: 'TD-DV-CS', level: 'gui', createdBy: 'seed' } as never);
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    await t?.close();
  });

  describe('every user against every conversation (PQ-15, 16, 17, 19, 20, 22, 56)', () => {
    it.each(Object.keys(VISIBLE))('%s lists exactly the conversations he may see', async (who) => {
      expect(await listIds(who)).toEqual([...VISIBLE[who]].sort());
    });

    it.each(Object.keys(VISIBLE))('%s: everything else is refused, empty or silent, without a name or a text', async (who) => {
      const hidden = ALL.filter((c) => !VISIBLE[who].includes(c));
      for (const id of hidden) {
        const one = await http().get(`/api/conversations/${enc(id)}`).set(as[who]).expect(403);
        expect(one.body.message).toBe(NO_ACCESS_TEXT.api);
        const msgs = await http().get(`/api/conversations/${enc(id)}/messages`).set(as[who]).expect(403);
        for (const body of [one.body, msgs.body]) expect(JSON.stringify(body)).not.toMatch(/Khách 91|BÍ MẬT/);
        const uid = id.split(':')[0];
        const sent = await http().post('/api/outbox').set(as[who]).send({ uid, threadId: id.slice(uid.length + 1), text: 'thử' });
        expect(sent.status).toBe(403);
        const contacts = await http().get(`/api/contacts?uid=${uid}`).set(as[who]);
        expect([200, 403]).toContain(contacts.status);
        if (contacts.status === 200) expect(contacts.body.items).toEqual([]);
      }
      expect(await t.db.col(C.suggestions).countDocuments({ uid: { $in: hidden.map((h) => h.split(':')[0]) } })).toBe(0);
    });

    it('a user without a session or with an ingest token reads nothing', async () => {
      await http().get('/api/conversations').expect(401);
      await http().get(`/api/conversations/${enc(CONV.n01)}`).set(t.auth.ingest).expect(403);
    });
  });

  describe('UAT-PQ-08: moving a salesperson to another team moves what the supervisors see', () => {
    it('Hương (HN1) loses Linh\'s nick, Đức (HN2) gains it, and the log has user.update (change=unit) but no owner.change', async () => {
      expect(await listIds('TD-U-GS1')).toContain(CONV.n02);
      const r = await http().post('/api/admin/users/TD-U-KD2/change-unit').set(as['TD-U-AD']).send({ fromOrgUnitId: 'TD-DV-HN1', toOrgUnitId: 'TD-DV-HN2' });
      expect(r.status).toBe(200);
      t.app.get(AuthzService).invalidate();
      expect(await listIds('TD-U-GS1')).toEqual([CONV.n01]);
      expect(await listIds('TD-U-GS2')).toEqual([CONV.n02, CONV.n04].sort());
      await http().get(`/api/conversations/${enc(CONV.n02)}`).set(as['TD-U-GS1']).expect(403);
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'user.update', 'detail.change': 'unit', target: 'TD-U-KD2' })).toBeGreaterThan(0);
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'owner.change' })).toBe(0);
      // Put things back: the other cases of this file expect the original tree.
      await http().post('/api/admin/users/TD-U-KD2/change-unit').set(as['TD-U-AD']).send({ fromOrgUnitId: 'TD-DV-HN2', toOrgUnitId: 'TD-DV-HN1' }).expect(200);
      t.app.get(AuthzService).invalidate();
      expect(await listIds('TD-U-GS1')).toEqual([CONV.n01, CONV.n02].sort());
    });
  });

  describe('UAT-PQ-32: a view grant ends by itself', () => {
    const grant = (id: string, to: Date, status = 'hieu_luc') =>
      t.db.col('access_grants').insertOne({
        _id: id, userId: 'TD-U-SA', type: 'xem_ngoai_pham_vi', targetType: 'conversation', targetId: CONV.n01, rights: ['xem'],
        from: new Date(Date.now() - 3_600_000), to, reason: 'Đối chiếu đơn hàng', requestedBy: 'TD-U-SA', status,
      } as never);

    it('while valid: readable but no composer; after expiry: 403 again', async () => {
      await grant('g32', new Date(Date.now() + 3_600_000));
      await http().get(`/api/conversations/${enc(CONV.n01)}`).set(as['TD-U-SA']).expect(200);
      const access = (await http().get(`/api/conversations/${enc(CONV.n01)}/access`).set(as['TD-U-SA']).expect(200)).body;
      expect(access.canCompose ?? access.compose ?? false).toBeFalsy();
      await http().post('/api/outbox').set(as['TD-U-SA']).send({ uid: NK('01'), threadId: CUSTOMER(NK('01')), text: 'x' }).expect(403);
      await t.db.col('access_grants').updateOne({ _id: 'g32' } as never, { $set: { to: new Date(Date.now() - 1000) } });
      t.app.get(AuthzService).invalidate();
      await http().get(`/api/conversations/${enc(CONV.n01)}`).set(as['TD-U-SA']).expect(403);
      expect(await listIds('TD-U-SA')).toEqual([]);
    });

    it('a grant that was never approved opens nothing', async () => {
      await grant('g32b', new Date(Date.now() + 3_600_000), 'cho_duyet');
      t.app.get(AuthzService).invalidate();
      await http().get(`/api/conversations/${enc(CONV.n01)}`).set(as['TD-U-SA']).expect(403);
    });
  });

  describe('UAT-PQ-39: the observer reads but never writes', () => {
    it('Ban giám đốc has no composer and no send on any conversation', async () => {
      const access = (await http().get(`/api/conversations/${enc(CONV.n01)}/access`).set(as['TD-U-QS']).expect(200)).body;
      expect(access.canCompose ?? access.compose ?? false).toBeFalsy();
      for (const id of ALL) {
        const uid = id.split(':')[0];
        await http().post('/api/outbox').set(as['TD-U-QS']).send({ uid, threadId: id.slice(uid.length + 1), text: 'x' }).expect(403);
      }
    });
  });

  describe('UAT-PQ-27 / PQ-108 (L-02): a phone number or email typed inside a message is masked for non-owners', () => {
    // docs 01 §7.2 PQ-27 step 1: "Anh gọi em số 0900 *** 950 [Hiện] nhé" for a supervisor. Fixed in M1b-17:
    // the API masks every phone-like run and email in message text, with a logged "Hiện" per number.
    const messageId = `${NK('01')}:pq27`;
    const read = async (who: string) => (await http().get(`/api/conversations/${enc(CONV.n01)}/messages`).set(as[who]).expect(200)).body.items.find((x: { msgId: string }) => x.msgId === 'pq27');

    beforeAll(async () => {
      await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: NK('01'), items: [{ msgId: 'pq27', threadId: CUSTOMER(NK('01')), fromUid: '0', toUid: CUSTOMER(NK('01')), senderName: 'Minh', msgType: 'webchat', text: 'Anh gọi em số 0900000950 hoặc 0900 111 222, mail minh.phat@example.vn nhé, hẹn 14:30 ngày 04/10/2026', sentAt: Date.now() }] }).expect(200);
    });

    it('supervisor reads the message with every number and email masked, times and dates intact', async () => {
      const m = await read('TD-U-GS1');
      expect(m.text).toBe('Anh gọi em số 0900 *** 950 hoặc 0900 *** 222, mail mi***@example.vn nhé, hẹn 14:30 ngày 04/10/2026');
      expect(m.textMasked).toBe(3);
      expect(JSON.stringify(m)).not.toMatch(/0900000950|0900 111 222|minh\.phat/);
    });

    it('gác cổng: captions of a card, a location and a reminder are masked too', async () => {
      await t.db.col(C.messages).updateOne({ _id: messageId as never }, { $set: { 'content.reminder': { title: 'Gọi lại 0900000950' }, 'content.location': { address: 'Số 1, ĐT 0900 111 222' }, 'content.card': { title: 'minh.phat@example.vn' } } });
      try {
        const m = await read('TD-U-GS1');
        expect(m.reminder.title).toBe('Gọi lại 0900 *** 950');
        expect(JSON.stringify(m)).not.toMatch(/0900000950|0900 111 222|minh\.phat/);
      } finally {
        await t.db.col(C.messages).updateOne({ _id: messageId as never }, { $unset: { 'content.reminder': '', 'content.location': '', 'content.card': '' } });
      }
    });

    it('gác cổng: a voice transcript (M1c-04) is masked like the message text', async () => {
      const att = 'att-pq27';
      const base = { uid: NK('01'), threadId: CUSTOMER(NK('01')) };
      await t.db.col(C.attachments).insertOne({ _id: att, ...base, messageId, subject: CUSTOMER(NK('01')), kind: 'audio', status: 'stored', attempts: 0 } as never);
      await t.db.col(C.asrJobs).insertOne({ _id: att, ...base, status: 'done' } as never);
      await t.db.col(C.transcripts).insertOne({ _id: att, ...base, attachmentId: att, messageId, text: 'em gọi 0900000950, mail minh.phat@example.vn', model: 'test' } as never);
      try {
        const m = await read('TD-U-GS1');
        const tr = m.attachments?.find((a: { id: string }) => a.id === att)?.transcript;
        expect(tr?.text).toBe('em gọi 0900 *** 950, mail mi***@example.vn');
        expect(JSON.stringify(m)).not.toMatch(/0900000950|minh\.phat/);
      } finally {
        await t.db.col(C.attachments).deleteOne({ _id: att } as never);
        await t.db.col(C.asrJobs).deleteOne({ _id: att } as never);
        await t.db.col(C.transcripts).deleteOne({ _id: att } as never);
      }
    });

    it('PQ-108: the quote and the conversation list preview are masked too', async () => {
      const list = (await http().get('/api/conversations').set(as['TD-U-GS1']).expect(200)).body;
      expect(JSON.stringify(list)).not.toMatch(/0900000950|0900 111 222|minh\.phat/);
    });

    it('the person who may reveal gets the number on "Hiện", with a phone.reveal line that has no number', async () => {
      const before = await t.db.col(C.auditLog).countDocuments({ action: 'phone.reveal' });
      const m = await read('TD-U-GS1');
      if (!m.textRevealable) return; // supervisor may not reveal on this channel: then no button, and the call below must be refused
      const r = await http().post('/api/reveal/message').set(as['TD-U-GS1']).send({ messageId, index: 0 }).expect(200);
      expect(r.body.value).toBe('0900000950');
      const rows = await t.db.col(C.auditLog).find({ action: 'phone.reveal' }).toArray();
      expect(rows.length).toBe(before + 1);
      expect(JSON.stringify(rows)).not.toContain('0900000950');
    });

    it('a user who may not reveal gets no button and a refusal', async () => {
      const m = await read('TD-U-GS1');
      if (m.textRevealable) return;
      expect(m.textRevealable).toBe(false);
      await http().post('/api/reveal/message').set(as['TD-U-GS1']).send({ messageId, index: 0 }).expect(403);
    });

    it('gác cổng: nobody who may not open the conversation can reveal, whatever the channel scope (conv.view)', async () => {
      for (const [who] of USERS) {
        if (VISIBLE[who]!.includes(CONV.n01)) continue;
        const r = await http().post('/api/reveal/message').set(as[who]).send({ messageId, index: 0 });
        expect([who, r.status]).not.toEqual([who, 200]);
        expect(JSON.stringify(r.body)).not.toContain('0900000950');
      }
    });

    it('a user outside the scope cannot reveal either (404/403, no value)', async () => {
      const r = await http().post('/api/reveal/message').set(as['TD-U-KDE']).send({ messageId, index: 0 });
      expect([403, 404]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain('0900000950');
    });
  });

  describe('UAT-PQ-09 / PQ-70 (L-01): the Admin explains why a person sees or does not see a conversation', () => {
    const explain = (who: string, target: string) => http().get('/api/admin/users/' + who + '/effective').query({ target }).set(as['TD-U-AD']);

    it('a person with access: ✔ view with a reason, and no content or phone in the answer', async () => {
      const r = (await explain('TD-U-KD1', CONV.n01).expect(200)).body;
      expect(r.results).toHaveLength(1);
      const view = r.results[0].checks.find((c: { key: string }) => c.key === 'conv.view');
      expect(view.allowed).toBe(true);
      expect(view.reason).toBeTruthy();
      expect(JSON.stringify(r)).not.toMatch(/0900000|Anh gọi em/);
    });

    it('a person without access: ✖ view with how to see it, and the lookup is logged without a number', async () => {
      const r = (await explain('TD-U-KD4', CONV.n01).expect(200)).body;
      const res = r.results[0];
      expect(res.checks.find((c: { key: string }) => c.key === 'conv.view').allowed).toBe(false);
      expect(res.howToSee).toContain('Cách thấy');
      const log = await t.db.col(C.auditLog).find({ action: 'permission.explain' }).toArray();
      expect(log.length).toBeGreaterThan(0);
    });

    it('PQ-70: found by the customer phone, the answer has the code and an abbreviated name, never the phone', async () => {
      const contact = (await t.db.col(C.contacts).findOne({ _id: `${NK('01')}:${CUSTOMER(NK('01'))}` as never })) as { phone?: string; displayName?: string } | null;
      expect(contact?.phone).toBeTruthy();
      const r = (await explain('TD-U-KD4', contact!.phone!).expect(200)).body;
      expect(r.results.map((x: { conversationId: string }) => x.conversationId)).toContain(CONV.n01);
      const body = JSON.stringify(r);
      expect(body).not.toContain(contact!.phone!);
      if (contact!.displayName) expect(body).not.toContain(contact!.displayName);
    });

    it('gác cổng: a supervisor only learns about conversations he may open himself', async () => {
      const ask = (target: string) => http().get('/api/admin/users/TD-U-KD4/effective').query({ target }).set(as['TD-U-GS2']).expect(200);
      expect((await ask(CONV.n04)).body.results).toHaveLength(1);
      const outside = (await ask(CONV.n01)).body;
      expect(outside.results).toHaveLength(0);
      expect(JSON.stringify(outside)).not.toContain(CONV.n01);
    });

    it('a short text matches nothing; only people with permission.explain may ask', async () => {
      expect((await explain('TD-U-KD4', 'ab').expect(200)).body.note).toBeTruthy();
      await http().get('/api/admin/users/TD-U-KD4/effective').query({ target: CONV.n01 }).set(as['TD-U-KD1']).expect(403);
    });
  });

  describe('UAT-PQ-62: the access log can only be read', () => {
    it('no one can delete or edit it through the API, and the rows stay', async () => {
      const before = await t.db.col(C.auditLog).countDocuments({});
      for (const who of ['TD-U-AD', 'TD-U-QS']) {
        for (const m of ['delete', 'put', 'patch'] as const) {
          const r = await http()[m]('/api/admin/audit').set(as[who]);
          expect([403, 404, 405]).toContain(r.status);
        }
      }
      expect(await t.db.col(C.auditLog).countDocuments({})).toBeGreaterThanOrEqual(before);
    });
  });

  describe('UAT-UI-131 (API part): 5,000 conversations on one account still list fast', () => {
    it('inbox and list answer within 3 s and return a bounded page', async () => {
      const base = Date.now();
      await t.db.col(C.conversations).insertMany(
        Array.from({ length: 5000 }, (_, i) => ({ _id: `${NK('01')}:bulk${i}`, uid: NK('01'), threadId: `bulk${i}`, type: 'user', lastMsgAt: new Date(base - i * 1000), unread: 0 })) as never,
      );
      const t0 = Date.now();
      const inbox = await http().get('/api/conversations/inbox').set(as['TD-U-KD1']).expect(200);
      const list = await http().get('/api/conversations').set(as['TD-U-KD1']).expect(200);
      const ms = Date.now() - t0;
      expect(ms).toBeLessThan(3000);
      expect(inbox.body).toBeTruthy();
      expect((list.body.items as unknown[]).length).toBeLessThanOrEqual(500);
      await t.db.col(C.conversations).deleteMany({ threadId: /^bulk/ } as never);
    });
  });

  describe('UAT-PQ-22 / PQ-47 / PQ-113 / PQ-114: customers across teams and divisions', () => {
    let account = '';
    beforeAll(async () => {
      await http().post('/api/customers/sweep').set(as['TD-U-SA']).expect(200);
      const link = (await t.db.col<IdentityLinkDoc>(CUST_C.identityLinks).findOne({ _id: CONV.n01 as never }))!;
      account = link.accountId;
      await t.db.col<CustomerAccountDoc>(CUST_C.accounts).updateOne({ _id: account }, { $set: { owners: [{ division: 'TD-DV-VCP', userId: 'TD-U-KD1', since: new Date(), source: 'manual' }] } });
      t.app.get(AuthzService).invalidate();
    });

    it.each(['TD-U-KDE', 'TD-U-KD4', 'TD-U-KD2', 'TD-U-CS2'])('%s opens the customer of Minh: 404, no name, no phone', async (who) => {
      const r = await http().get(`/api/customers/${account}/360`).set(as[who]);
      expect([403, 404]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toMatch(/Khách 91|0900000|BÍ MẬT/);
    });

    it('the owner and his supervisor open it; the phone is masked for the supervisor', async () => {
      await http().get(`/api/customers/${account}/360`).set(as['TD-U-KD1']).expect(200);
      const gs = await http().get(`/api/customers/${account}/360`).set(as['TD-U-GS1']).expect(200);
      expect(JSON.stringify(gs.body)).not.toContain('0900000001');
    });

    it('the sale admin sees no message of the customer in the timeline (events only)', async () => {
      const r = await http().get(`/api/customers/${account}/timeline`).set(as['TD-U-SA']);
      if (r.status === 200) {
        expect((r.body.events as { kind: string; text?: string }[]).filter((e) => e.kind === 'message' && e.text)).toEqual([]);
        expect(JSON.stringify(r.body)).not.toContain('BÍ MẬT');
      } else expect([403, 404]).toContain(r.status);
    });

    it('the customer list of the division director has no VCedu customer and the VCedu one sees no VCparts customer', async () => {
      const kde = await http().get('/api/customers').set(as['TD-U-KDE']);
      if (kde.status === 200) expect(JSON.stringify(kde.body)).not.toMatch(/Khách 91(?!0008)/);
      const list = await http().get('/api/customers').set(as['TD-U-GD']);
      if (list.status === 200) expect(JSON.stringify(list.body)).not.toContain('Khách 910008');
    });
  });
});
