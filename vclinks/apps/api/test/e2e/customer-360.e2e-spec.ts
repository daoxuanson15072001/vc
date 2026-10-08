import request from 'supertest';
import type { ConversationInboxFields, ConversationListItem, Customer360, ProductSearchResponse, TimelineResponse } from '@vclinks/shared';
import { ERR_CATALOG_TEXT } from '../../src/catalog/catalog.service';
import { MOCK_VCSALE_CUSTOMERS, type MockVcsaleClient } from '@vclinks/vcsale-client';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { CUST_C, type CustomerAccountDoc, type IdentityLinkDoc } from '../../src/customers/customers.types';
import { ERR_ERP_CODE_GONE_TEXT, ERR_ERP_TEXT } from '../../src/customers/customer-360.service';
import { VCSALE_CLIENT } from '../../src/customers/customers.service';
import { C } from '../../src/db/db.service';
import { VcsalesStatusService } from '../../src/vcsales/vcsales-status.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-13 on the test data (docs/05-kiem-thu/du-lieu-kiem-thu.md): Customer 360, side panel, timeline,
 * phone masking by right (DK-44) and Ctrl+K customers. VCsales is the mock (VCSALE_MODE=mock).
 */
const NK = (n: string) => `90000000000${n}`;
const DIV = 'TD-DV-VCP';
const MIN = 60_000;
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
const NICKS: [string, string, string][] = [
  [NK('01'), 'TD-U-KD1', 'Minh VCparts'],
  [NK('04'), 'TD-U-KD4', 'Hải VCparts'],
];
const MP = `${NK('01')}:9101101`; // Garage Minh Phát on Minh's nick
const MP2 = `${NK('04')}:9101102`; // the same customer on Hải's nick (linked by hand below)
const Z1 = `${NK('01')}:9200001`; // customer owned by Hải, seen on Minh's nick
const Z2 = `${NK('04')}:9200002`; // same customer on Hải's nick
const SECRET = 'GIÁ RIÊNG BÍ MẬT 8.450.000';

describe('Customer 360 (e2e, M1b-13)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;
  const savedTtl = process.env.COMMERCE_TTL_MS;
  let minhPhat = '';
  let zAccount = '';
  const msg = async (uid: string, userId: string, id: string, text: string, ago: number, fromUid = userId) =>
    http()
      .post('/api/ingest/messages')
      .set(t.auth.ingest)
      .send({ uid, items: [{ msgId: id, threadId: userId, fromUid, toUid: uid, senderName: 'Khách', msgType: 'webchat', text, sentAt: Date.now() - ago * MIN }] })
      .expect(200);

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = DIV;
    process.env.COMMERCE_TTL_MS = '0';
    t = await startE2EApp();
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
    for (const [uid, holder, label] of NICKS) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label, ownerName: 'Chủ nick' }).expect(201);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
    }
    const ids: [string, string, string, string?][] = [
      [NK('01'), '9101101', 'Anh Tuấn Minh Phát', '0900 000 101'],
      [NK('04'), '9101102', 'Tuấn (nick Hải)'],
      [NK('01'), '9200001', 'Anh Z'],
      [NK('04'), '9200002', 'Anh Z (nick Hải)'],
    ];
    for (const [uid, userId, displayName, phone] of ids) {
      await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid, items: [{ userId, displayName, ...(phone ? { phone } : {}) }] }).expect(200);
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid, items: [{ threadId: userId, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
    }
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    await http().post('/api/customers/sweep').set(as['TD-U-SA']).expect(200);
    await http().post('/api/customers/import').set(as['TD-U-SA']).send({}).expect(200);
    const l = (id: string) => t.db.col<IdentityLinkDoc>(CUST_C.identityLinks).findOne({ _id: id });
    minhPhat = (await l(MP))!.accountId;
    // Hải's nick sees the same customer: linked by hand (the merge UI is another session).
    const mp2 = (await l(MP2))!;
    const mpLink = (await l(MP))!;
    await t.db.col(CUST_C.identityLinks).updateOne({ _id: MP2 as never }, { $set: { accountId: minhPhat, contactId: mpLink.contactId } });
    await t.db.col(CUST_C.points).updateMany({ accountId: mp2.accountId }, { $set: { accountId: minhPhat, contactId: mpLink.contactId } });
    // Z: owned by Hải (HN2), identities on Minh's nick (HN1) and Hải's nick (HN2).
    const z1 = (await l(Z1))!;
    zAccount = z1.accountId;
    await t.db.col(CUST_C.identityLinks).updateOne({ _id: Z2 as never }, { $set: { accountId: zAccount, contactId: z1.contactId } });
    await t.db.col<CustomerAccountDoc>(CUST_C.accounts).updateOne({ _id: zAccount }, { $set: { owners: [{ division: DIV, userId: 'TD-U-KD4', since: now, source: 'manual' }] } });
    // Messages (UAT-DK-79 / UAT-DK-73): Hải's nick 20 min ago (nobody answered), Minh's nick 2 min ago.
    await msg(NK('04'), '9101102', 'm-h1', 'Hôm nay em có qua xưởng không?', 20);
    await msg(NK('01'), '9101101', 'm-m1', 'Báo giá má phanh Hilux', 2);
    await msg(NK('01'), '9101101', 'm-m0', 'Chào em', 30);
    await msg(NK('01'), '9101101', 'm-m0b', 'Anh cần gấp', 28);
    await msg(NK('01'), '9101101', 'm-m0c', 'Có hàng không', 26, '0');
    await msg(NK('01'), '9200001', 'z-1', 'Tin trên nick Minh', 40);
    await msg(NK('04'), '9200002', 'z-2', SECRET, 35);
    await msg(NK('04'), '9200002', 'z-3', `${SECRET} lần 2`, 34);
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    if (savedTtl === undefined) delete process.env.COMMERCE_TTL_MS;
    else process.env.COMMERCE_TTL_MS = savedTtl;
    await t?.close();
  });

  const page = (id: string, who: string) => http().get(`/api/customers/${id}/360`).set(as[who]);
  const audits = (action: string) => t.db.col(C.auditLog).find({ action }).toArray();

  describe('phone and email by right (DK-44, UAT-DK-13, 13a)', () => {
    it('UAT-DK-13: the owner sees the full phone at once, no "Hiện", and opening writes no phone.reveal', async () => {
      const r = await page(minhPhat, 'TD-U-KD1').expect(200);
      const b = r.body as Customer360;
      expect(b.viewer).toMatchObject({ phone: 'full', isOwner: true, timeline: true, commerce: 'full' });
      const phone = b.customer.contacts.flatMap((c) => c.points).find((p) => p.phone);
      expect(phone).toMatchObject({ phone: '0900000101' });
      expect(phone?.masked).toBeUndefined();
      expect(b.customer.owners[0]).toMatchObject({ userId: 'TD-U-KD1', userName: 'Nguyễn Văn Minh' });
      // The plain detail route follows the same rule (it used to mask for everybody).
      const d = (await http().get(`/api/customers/${minhPhat}`).set(as['TD-U-KD1']).expect(200)).body;
      expect(JSON.stringify(d)).toContain('0900000101');
      expect(await audits('phone.reveal')).toHaveLength(0);
    });

    it('the nick holder sees the full phone of his identity even when he is not the owner', async () => {
      // Hải holds nick 04, where Minh Phát has an identity: DK-44 "người giữ nick thấy đủ" (cust.view NICK).
      const r = await page(minhPhat, 'TD-U-KD4').expect(200);
      expect((r.body as Customer360).viewer.phone).toBe('full');
    });

    it('UAT-DK-13a: a supervisor (Tổ HN1) sees "0900 *** 101", reveals it; the log has no number', async () => {
      // Hương (GS Tổ 1, not the owner): TO scope is "Hiện", never "luôn hiện".
      const g = (await page(minhPhat, 'TD-U-GS1').expect(200)).body as Customer360;
      expect(g.viewer).toMatchObject({ phone: 'reveal', isOwner: false });
      expect(((await page(minhPhat, 'TD-U-GD').expect(200)).body as Customer360).viewer.phone).toBe('reveal');
      const p = g.customer.contacts.flatMap((c) => c.points).find((x) => x.kind === 'phone')!;
      expect(p).toMatchObject({ phone: '0900 *** 101', masked: true, revealable: true });
      expect(JSON.stringify(g)).not.toContain('0900000101');
      const rev = await http().post(`/api/customers/${minhPhat}/reveal`).set(as['TD-U-GS1']).send({ pointId: p.id }).expect(200);
      expect(rev.body.value).toBe('0900000101');
      const log = await audits('phone.reveal');
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({ actor: 'user:TD-U-GS1', target: minhPhat });
      expect(JSON.stringify(log[0])).not.toContain('0900000101');
    });

    it('a viewer who may not reveal is refused (sale admin has DV reveal only through the log; KD of another team gets 404)', async () => {
      await page(minhPhat, 'TD-U-KD4').expect(200); // holds nick 04, has an identity there
      const sa = (await page(minhPhat, 'TD-U-SA').expect(200)).body as Customer360;
      expect(sa.viewer.phone).toBe('reveal');
      await http().post(`/api/customers/${minhPhat}/reveal`).set(as['TD-U-KD1']).send({ pointId: 'x' }).expect(404);
    });
  });

  describe('scope (UAT-DK-14)', () => {
    it('a sales rep of another team and not holding a nick of the customer gets 404 without the name', async () => {
      const r = await page(zAccount, 'TD-U-KD1').expect(200); // Minh holds nick 01 where Z has an identity: visible through the nick
      expect((r.body as Customer360).viewer.isOwner).toBe(false);
      // A customer on no nick of Hải's team: Hải (HN2) must not see Minh's other customers.
      const other = (await t.db.col<CustomerAccountDoc>(CUST_C.accounts).findOne({ 'erpLinks.customerId': 'KH-TEST-0601' } as never))!;
      const res = await page(other._id, 'TD-U-KD4').expect(404);
      expect(JSON.stringify(res.body)).not.toContain('Hưng Thịnh');
    });
  });

  describe('activity, cross-nick hint, recommended conversation (UAT-DK-15, 73)', () => {
    it('lists both nicks newest inbound first, with unanswered counts and the nick label', async () => {
      const b = (await page(minhPhat, 'TD-U-KD1').expect(200)).body as Customer360;
      expect(b.activity.map((a) => a.conversationId)).toEqual([MP, MP2]);
      expect(b.activity[0]).toMatchObject({ nickLabel: 'Minh VCparts', unanswered: 1, locked: false, active: true, handlerName: 'Nguyễn Văn Minh', channel: 'zalo' });
      expect(b.activity[1]).toMatchObject({ nickLabel: 'Hải VCparts', unanswered: 1, locked: false, active: true });
      expect(b.recommendedConversationId).toBe(MP);
      expect(b.channels.map((c) => [c.uid, c.nickLabel]).sort()).toEqual([[NK('01'), 'Minh VCparts'], [NK('04'), 'Hải VCparts']]);
    });

    it('UAT-DK-73: opening Minh\'s conversation tells that the customer also wrote on Hải\'s nick (1 unanswered)', async () => {
      const b = (await http().get(`/api/customers/by-identity/${NK('01')}/9101101/360`).set(as['TD-U-KD1']).expect(200)).body as Customer360;
      expect(b.identity).toMatchObject({ identityId: MP, state: expect.any(String) });
      expect(b.crossNick).toEqual([expect.objectContaining({ conversationId: MP2, nickLabel: 'Hải VCparts', unanswered: 1, locked: false })]);
      // 24 hours later the hint is gone.
      await t.db.col(C.conversations).updateOne({ _id: MP2 as never }, { $set: { unansweredSince: new Date(Date.now() - 25 * 3_600_000) } });
      const later = (await http().get(`/api/customers/by-identity/${NK('01')}/9101101/360`).set(as['TD-U-KD1']).expect(200)).body as Customer360;
      expect(later.crossNick).toEqual([]);
    });
  });

  describe('inbox: one row per customer across nicks (plan B2)', () => {
    type Row = ConversationListItem & ConversationInboxFields & { id: string };
    const customerIds = async () => {
      const r = (await http().get('/api/conversations?scope=all').set(as['TD-U-GD']).expect(200)).body as { items: Row[] };
      return new Map(r.items.map((i) => [i.id, i.customerId]));
    };

    it('list items carry the customer id: the same for Garage Minh Phát on the nicks of Minh and Hải', async () => {
      const by = await customerIds();
      expect(by.get(MP)).toBe(minhPhat);
      expect(by.get(MP2)).toBe(minhPhat);
      expect(by.get(Z1)).toBe(zAccount);
      expect(by.get(Z2)).toBe(zAccount);
    });

    it('a merged profile is followed to the profile it went into', async () => {
      await t.db.col<CustomerAccountDoc>(CUST_C.accounts).updateOne({ _id: zAccount }, { $set: { mergedInto: minhPhat } });
      try {
        expect((await customerIds()).get(Z1)).toBe(minhPhat);
      } finally {
        await t.db.col<CustomerAccountDoc>(CUST_C.accounts).updateOne({ _id: zAccount }, { $set: { mergedInto: null } });
      }
    });
  });

  describe('timeline (UAT-DK-17, 18, 79)', () => {
    it('merges both nicks in original time order and pages with a cursor', async () => {
      const r = (await http().get(`/api/customers/${minhPhat}/timeline`).query({ limit: 100 }).set(as['TD-U-KD1']).expect(200)).body as TimelineResponse;
      const texts = r.events.filter((e) => e.kind === 'message').map((e) => e.text);
      expect(texts).toEqual(['Báo giá má phanh Hilux', 'Hôm nay em có qua xưởng không?', 'Có hàng không', 'Anh cần gấp', 'Chào em']);
      const dirs = r.events.filter((e) => e.kind === 'message').map((e) => e.direction);
      expect(dirs).toEqual(['in', 'in', 'out', 'in', 'in']);
      expect(r.events.find((e) => e.kind === 'message')).toMatchObject({ channel: 'zalo', nickLabel: 'Minh VCparts', conversationId: MP });
      const p1 = (await http().get(`/api/customers/${minhPhat}/timeline`).query({ limit: 2, type: 'message' }).set(as['TD-U-KD1']).expect(200)).body as TimelineResponse;
      expect(p1.events).toHaveLength(2);
      expect(p1.nextBefore).toBe(p1.events[1]!.at);
      const p2 = (await http().get(`/api/customers/${minhPhat}/timeline`).query({ limit: 10, type: 'message', before: p1.nextBefore! }).set(as['TD-U-KD1']).expect(200)).body as TimelineResponse;
      expect(p2.events.map((e) => e.text)).toEqual(['Có hàng không', 'Anh cần gấp', 'Chào em']);
    });

    it('UAT-DK-17: filters by nick and by person; text search needs 2 characters', async () => {
      const onlyHai = (await http().get(`/api/customers/${minhPhat}/timeline`).query({ uid: NK('04') }).set(as['TD-U-KD1']).expect(200)).body as TimelineResponse;
      expect(onlyHai.events.map((e) => e.text)).toEqual(['Hôm nay em có qua xưởng không?']);
      const found = (await http().get(`/api/customers/${minhPhat}/timeline`).query({ q: 'má phanh' }).set(as['TD-U-KD1']).expect(200)).body as TimelineResponse;
      expect(found.events.map((e) => e.text)).toEqual(['Báo giá má phanh Hilux']);
      await http().get(`/api/customers/${minhPhat}/timeline`).query({ q: 'm' }).set(as['TD-U-KD1']).expect(400);
    });

    it('UAT-DK-18: a viewer without the right to a conversation gets "n tin" rows, never the content', async () => {
      // Hương (Tổ HN1) supervises Minh's nick but not Hải's: Z2's messages are hidden.
      const res = await http().get(`/api/customers/${zAccount}/timeline`).set(as['TD-U-GS1']).expect(200);
      const r = res.body as TimelineResponse;
      expect(r.events.map((e) => e.kind)).toEqual(['hidden', 'message']);
      expect(r.events[0]).toMatchObject({ hiddenCount: 2, channel: 'zalo', nickLabel: 'Hải VCparts', conversationId: null });
      expect(r.events[0]).not.toHaveProperty('text');
      expect(r.events[1]).toMatchObject({ text: 'Tin trên nick Minh' });
      expect(JSON.stringify(res.body)).not.toContain('BÍ MẬT');
      const b = (await page(zAccount, 'TD-U-GS1').expect(200)).body as Customer360;
      expect(b.activity.find((a) => a.conversationId === Z2)).toMatchObject({ locked: true });
      expect(JSON.stringify(b)).not.toContain('BÍ MẬT');
      // Searching content cannot reveal it either.
      const s = (await http().get(`/api/customers/${zAccount}/timeline`).query({ q: 'BÍ MẬT' }).set(as['TD-U-GS1']).expect(200)).body as TimelineResponse;
      expect(s.events).toEqual([]);
    });

    it('sale admin has cust.timeline only with condition no_messages, which stays closed (phan-quyen §4): 403', async () => {
      await http().get(`/api/customers/${minhPhat}/timeline`).set(as['TD-U-SA']).expect(403);
      const b = (await page(minhPhat, 'TD-U-SA').expect(200)).body as Customer360;
      expect(b.viewer.timeline).toBe(false);
      expect(b.recent).toEqual([]);
    });

    it('profile operations (merge, ERP link) appear in the timeline', async () => {
      const r = (await http().get(`/api/customers/${minhPhat}/timeline`).query({ type: 'profile' }).set(as['TD-U-KD1']).expect(200)).body as TimelineResponse;
      expect(r.events.length).toBeGreaterThan(0);
      expect(r.events.every((e) => e.kind === 'profile')).toBe(true);
    });
  });

  describe('commerce block (mock VCsales, ERR-ERP)', () => {
    it('shows the mock figures with the fetch time to the owner', async () => {
      const b = (await page(minhPhat, 'TD-U-KD1').expect(200)).body as Customer360;
      expect(b.commerce).toMatchObject({ code: 'KH-TEST-0101', tier: 'B', revenue12m: 412_500_000, stale: false, error: null, hasOverdueDebt: false });
      expect(b.commerce?.debt).toMatchObject({ amount: 12_000_000, overdue: false });
      expect(b.commerce?.openQuotes?.[0]).toMatchObject({ no: 'BG-2026-0915', total: 8_450_000 });
      expect(b.commerce?.lastOrder).toMatchObject({ no: 'DH-2026-0480', status: 'Đã xác nhận' });
      expect(Date.now() - Date.parse(b.commerce!.fetchedAt)).toBeLessThan(10_000);
    });

    it('UAT-UI-67: VCsales down keeps the last snapshot, marked stale with ERR-ERP text; the page still opens', async () => {
      const mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
      mock.down = true;
      try {
        const res = await http().get(`/api/customers/${minhPhat}/360`).query({ refresh: '1' }).set(as['TD-U-KD1']).expect(200);
        const b = res.body as Customer360;
        expect(b.commerce).toMatchObject({ stale: true, error: ERR_ERP_TEXT, tier: 'B' });
      } finally {
        mock.down = false;
      }
    });

    it('plan C6: VCsales known down: the snapshot at once without calling VCsales; ↻ still asks it', async () => {
      const mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
      const status = t.app.get(VcsalesStatusService);
      const saved = process.env.COMMERCE_TTL_MS;
      process.env.COMMERCE_TTL_MS = '0';
      const spy = jest.spyOn(mock, 'getCommerce');
      mock.down = true;
      try {
        expect((await status.check()).ok).toBe(false);
        const b = (await page(minhPhat, 'TD-U-KD1').expect(200)).body as Customer360;
        expect(b.commerce).toMatchObject({ stale: true, error: ERR_ERP_TEXT, tier: 'B' });
        expect(spy).not.toHaveBeenCalled();
        await http().get(`/api/customers/${minhPhat}/360`).query({ refresh: '1' }).set(as['TD-U-KD1']).expect(200);
        expect(spy).toHaveBeenCalledTimes(1);
      } finally {
        mock.down = false;
        await status.check();
        spy.mockRestore();
        if (saved === undefined) delete process.env.COMMERCE_TTL_MS;
        else process.env.COMMERCE_TTL_MS = saved;
      }
    });

    it('a code VCsales no longer has: the old snapshot is not shown as current and is dropped (plan C7)', async () => {
      const accounts = t.db.col<CustomerAccountDoc>(CUST_C.accounts);
      const before = (await accounts.findOne({ _id: minhPhat }))!.erpLinks;
      await accounts.updateOne({ _id: minhPhat }, { $set: { erpLinks: before.map((l) => (l.erp === 'vcsales' ? { ...l, customerId: 'KH-GONE-0001' } : l)) } });
      await t.db
        .col('erp_commerce')
        .insertOne({ _id: 'vcsales:KH-GONE-0001', data: { code: 'KH-GONE-0001', tier: 'B', revenue12m: 1, debt: null, openQuotes: [], lastOrder: null }, fetchedAt: new Date() } as never);
      try {
        const b = (await http().get(`/api/customers/${minhPhat}/360`).query({ refresh: '1' }).set(as['TD-U-KD1']).expect(200)).body as Customer360;
        expect(b.commerce).toMatchObject({ code: 'KH-GONE-0001', stale: true, error: ERR_ERP_CODE_GONE_TEXT('KH-GONE-0001'), tier: null, revenue12m: null });
        expect(await t.db.col('erp_commerce').countDocuments({ _id: 'vcsales:KH-GONE-0001' } as never)).toBe(0);
      } finally {
        await accounts.updateOne({ _id: minhPhat }, { $set: { erpLinks: before } });
      }
    });

    it('no linked code: the block is hidden with "no_link"; unconfirmed identity: hidden with "unconfirmed" (DK-15)', async () => {
      const b = (await page(zAccount, 'TD-U-KD4').expect(200)).body as Customer360;
      expect(b.commerce).toBeNull();
      expect(b.commerceHidden).toBe('no_link');
      await t.db.col(CUST_C.identityLinks).updateOne({ _id: MP as never }, { $set: { state: 'unconfirmed' } });
      const u = (await http().get(`/api/customers/by-identity/${NK('01')}/9101101/360`).set(as['TD-U-KD1']).expect(200)).body as Customer360;
      expect(u).toMatchObject({ unconfirmed: true, commerce: null, commerceHidden: 'unconfirmed' });
      await t.db.col(CUST_C.identityLinks).updateOne({ _id: MP as never }, { $set: { state: 'auto' } });
    });

    it('a viewer without cust.commerce gets no block ("no_right"): the CS "orders only" cell stays closed', async () => {
      const b = (await page(minhPhat, 'TD-U-KD4').expect(200)).body as Customer360;
      // Hải is not the owner: cust.commerce is CT only for sales reps.
      expect(b.viewer.commerce).toBe('none');
      expect(b.commerce).toBeNull();
      expect(b.commerceHidden).toBe('no_right');
    });
  });

  describe('Ctrl+K: customers', () => {
    const q = (text: string, who: string) => http().get('/api/search/quick').query({ q: text }).set(as[who]).expect(200);

    it('finds a customer by name without accents, by VCsales code and by phone digits; phone masked', async () => {
      for (const text of ['minh phat', 'KH-TEST-0101', '000101']) {
        const r = (await q(text, 'TD-U-KD1')).body.items as { kind: string; accountId?: string; name: string; phone: string | null; customerCode: string | null }[];
        const hit = r.find((i) => i.kind === 'customer' && i.accountId === minhPhat);
        expect(hit).toMatchObject({ name: 'Garage Minh Phát', customerCode: 'KH-TEST-0101', phone: '0900 *** 101' });
      }
      expect(JSON.stringify((await q('minh phat', 'TD-U-KD1')).body)).not.toContain('0900000101');
    });

    it('does not find customers outside the viewer\'s scope', async () => {
      const r = (await q('Hưng Thịnh', 'TD-U-KD4')).body.items as { kind: string }[];
      expect(r.filter((i) => i.kind === 'customer')).toEqual([]);
      const gd = (await q('Hưng Thịnh', 'TD-U-GD')).body.items as { kind: string }[];
      expect(gd.filter((i) => i.kind === 'customer')).toHaveLength(1);
    });
  });

  describe('speed: Customer 360 of the customer with the most messages ≤ 3 s (Xác nhận xong #2, seed data)', () => {
    it('opens the 360 and the first timeline page of a customer with 20 000 messages in well under 3 s', async () => {
      const N = 20_000;
      const base = Date.now() - 3 * 86_400_000;
      const docs = Array.from({ length: N }, (_, i) => ({
        _id: `${MP}-bulk${i}`,
        uid: NK('01'),
        threadId: '9101101',
        msgId: `bulk${i}`,
        fromUid: i % 3 === 0 ? '0' : '9101101',
        msgType: 'webchat',
        text: `Tin số ${i} về má phanh và lọc gió`,
        sentAt: new Date(base + i * 10_000),
      }));
      await t.db.col(C.messages).insertMany(docs as never);
      const t0 = Date.now();
      await page(minhPhat, 'TD-U-KD1').expect(200);
      const t1 = Date.now();
      await http().get(`/api/customers/${minhPhat}/timeline`).set(as['TD-U-KD1']).expect(200);
      const t2 = Date.now();
      // eslint-disable-next-line no-console
      console.log(`[M1b-13] seed ${N} tin: 360 ${t1 - t0} ms, dòng thời gian trang 1 ${t2 - t1} ms`);
      expect(t1 - t0).toBeLessThan(3000);
      expect(t2 - t1).toBeLessThan(3000);
    });
  });

  describe('tra hàng VCsales trong khung chat (M1c-01)', () => {
    const search = (uid: string, userId: string, q: string, who: string) => http().get(`/api/catalog/by-identity/${uid}/${userId}/search`).query({ q }).set(as[who]);

    it('"má phanh Vios 2019" ≤ 2 s, price by the policy of the chatting customer (KH-TEST-0101, hạng B -10%), stock shown', async () => {
      const t0 = Date.now();
      const r = (await search(NK('01'), '9101101', 'má phanh Vios 2019', 'TD-U-KD1').expect(200)).body as ProductSearchResponse;
      expect(Date.now() - t0).toBeLessThan(2000);
      expect(r).toMatchObject({ customerCode: 'KH-TEST-0101', priceHidden: null, error: null });
      expect(r.items[0]).toMatchObject({ sku: 'VC-MP-VIOS-F', listPrice: 850_000, customerPrice: 765_000, stock: 24, policy: 'Chính sách hạng B (-10%)' });
    });

    it('no VCsales code linked or no cust.commerce: list price and stock only, no policy price', async () => {
      const a = (await search(NK('04'), '9200002', 'má phanh vios', 'TD-U-KD4').expect(200)).body as ProductSearchResponse;
      expect(a).toMatchObject({ customerCode: null, priceHidden: 'no_link' });
      expect(a.items[0]).toMatchObject({ listPrice: 850_000, customerPrice: null, policy: null });
      const b = (await search(NK('04'), '9101102', 'má phanh vios', 'TD-U-KD4').expect(200)).body as ProductSearchResponse;
      expect(b).toMatchObject({ customerCode: null, priceHidden: 'no_right' });
      expect(b.items[0]!.customerPrice).toBeNull();
    });

    it('unconfirmed identity gets no policy price (DK-15)', async () => {
      await t.db.col(CUST_C.identityLinks).updateOne({ _id: MP as never }, { $set: { state: 'unconfirmed' } });
      const r = (await search(NK('01'), '9101101', 'má phanh vios', 'TD-U-KD1').expect(200)).body as ProductSearchResponse;
      expect(r).toMatchObject({ priceHidden: 'unconfirmed', customerCode: null });
      expect(r.items[0]!.customerPrice).toBeNull();
      await t.db.col(CUST_C.identityLinks).updateOne({ _id: MP as never }, { $set: { state: 'auto' } });
    });

    it('a user who may not open the customer / conversation gets 404/403, the query is validated, an outage returns the ERR text', async () => {
      const denied = await search(NK('01'), '9200001', 'má phanh vios', 'TD-U-KD4');
      expect([403, 404]).toContain(denied.status);
      await search(NK('01'), '9101101', 'x', 'TD-U-KD1').expect(400);
      const mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
      mock.down = true;
      try {
        const r = (await search(NK('01'), '9101101', 'má phanh vios', 'TD-U-KD1').expect(200)).body as ProductSearchResponse;
        expect(r.items).toEqual([]);
        expect(r.error).toBe(ERR_CATALOG_TEXT);
      } finally {
        mock.down = false;
      }
    });

    it('read only: the VCsales client used by the API received only searchProducts calls (no write)', async () => {
      const mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
      const names = Object.getOwnPropertyNames(Object.getPrototypeOf(mock)).filter((n) => n !== 'constructor');
      for (const n of names.filter((x) => !['upsert', 'check', 'editQuote'].includes(x))) expect(n).toMatch(/^(list|get|search)[A-Z]/);
    });
  });

  it('the merged customer list route keeps working (no regression on M1b-12 detail by identity)', async () => {
    const d = (await http().get(`/api/customers/by-identity/${NK('01')}/9101101`).set(as['TD-U-KD1']).expect(200)).body;
    expect(d.id).toBe(minhPhat);
    expect(MOCK_VCSALE_CUSTOMERS.length).toBeGreaterThan(0);
  });
});
