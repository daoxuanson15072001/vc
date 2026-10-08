import request from 'supertest';
import { ERP_CODE_TAKEN_TEXT } from '@vclinks/shared';
import { MOCK_VCSALE_CUSTOMERS, type MockVcsaleClient } from '@vclinks/vcsale-client';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { CustomersService, VCSALE_CLIENT } from '../../src/customers/customers.service';
import { CUST_C, type CustomerAccountDoc, type CustomerContactDoc, type IdentityLinkDoc } from '../../src/customers/customers.types';
import { migrateCustomers, undoCustomersMigration } from '../../src/customers/migrate-customers.lib';
import { C } from '../../src/db/db.service';
import { CUSTOMER_OWNERSHIP, type CustomerOwnership } from '../../src/conversations/conversations.service';
import { SUBJECT_RESOLVER, type SubjectResolver } from '../../src/security/subject-resolver';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-12 on the test data (docs/05-kiem-thu/du-lieu-kiem-thu.md §4.1, VCsales mock):
 * - migration of existing identities: idempotent, counts unchanged, exact undo;
 * - VCsales catalogue import: first owners (D8-06), re-run creates nothing (Xác nhận xong #2);
 * - D8-05 automatic merge of a new identity, one-touch undo + merge lock;
 * - "khách của tôi" in the permission engine (responsibleIds), customer visibility by scope;
 * - UAT-DK-27 (code already linked), UAT-DK-87 (GĐ reads "Đối chiếu mã KH", GS refused);
 * - the Danh bạ "Vai trò" filter.
 */
const MOCK_VCSALE_CUSTOMERS_COUNT = MOCK_VCSALE_CUSTOMERS.length;
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
  ['TD-U-GS2', 'duc.uat@vcprosperous.com', 'Hồ Văn Đức', 'giam_sat_bh', 'TD-DV-HN2'],
  ['TD-U-KD1', 'minh.uat@vcprosperous.com', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'linh.uat@vcprosperous.com', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD4', 'hai.uat@vcprosperous.com', 'Phạm Văn Hải', 'nvkd', 'TD-DV-HN2'],
  ['TD-U-SA', 'ngoc.uat@vcprosperous.com', 'Ngô Bích Ngọc', 'sale_admin', 'TD-DV-SA'],
];
const NICKS: [string, string][] = [
  [NK('01'), 'TD-U-KD1'],
  [NK('02'), 'TD-U-KD2'],
  [NK('04'), 'TD-U-KD4'],
];
/** Channel identities: [nick, userId, name, phone, days since first seen]. */
const IDENTITIES: [string, string, string, string, number][] = [
  // TD-K01 Garage Minh Phát's owner adds Minh's nick today: new identity, phone V2 = ERP V3, same person in charge.
  [NK('01'), '9101101', 'Anh Tuấn Minh Phát', '0900 000 101', 0],
  // TD-K09 Kiên (Linh's customer) messages Minh's nick: new, but another sale in charge (kịch bản D) → suggestion.
  [NK('01'), '9100950', 'Kiên', '0900 000 950', 0],
  // TD-K12 Garage Hòa Bình on Hải's nick for a month (history) → clean-up suggestion only.
  [NK('04'), '9100960', 'Anh Hòa', '0900 000 960', 30],
  // TD-K27 Gara Khoa Minh: no ERP code (only the noise code KH-TEST-0388 by name), UAT-DK-87.
  [NK('04'), '9100381', 'Gara Khoa Minh', '0900 000 381', 30],
];

describe('customer model on the TD data (e2e, M1b-12)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;
  const link = (id: string) => t.db.col<IdentityLinkDoc>(CUST_C.identityLinks).findOne({ _id: id });
  const count = (name: string) => t.db.col(name).countDocuments({});

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = DIV;
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id,
        code: id,
        name,
        type,
        parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : DIV,
        managerUserId: MANAGERS[id] ?? null,
        active: true,
        createdAt: now,
        updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, email, fullName]) => ({ _id: id, email, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, , name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    for (const [uid, holder] of NICKS) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
    }
    for (const [uid, userId, displayName, phone, days] of IDENTITIES) {
      await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid, items: [{ userId, displayName, phone }] }).expect(200);
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid, items: [{ threadId: userId, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
      await http()
        .post('/api/ingest/messages')
        .set(t.auth.ingest)
        .send({ uid, items: [{ msgId: `m${userId}`, threadId: userId, fromUid: userId, toUid: uid, senderName: displayName, msgType: 'webchat', text: 'Chào em', sentAt: Date.now() }] })
        .expect(200);
      if (days) await t.db.col(C.contacts).updateOne({ _id: `${uid}:${userId}` } as never, { $set: { ingestedAt: new Date(now.getTime() - days * 86_400_000) } });
    }
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    await t?.close();
  });

  describe('migration of existing identities (dữ liệu thật an toàn, chạy lại không trùng, có cách lùi)', () => {
    it('creates one profile per identity, re-run creates nothing, source counts unchanged, undo removes exactly the run', async () => {
      const db = t.db.db;
      const dry = await migrateCustomers(db, { tenant: 'vcpv', runId: 'mc_dry', dryRun: true });
      expect(dry.created.links).toBe(IDENTITIES.length);
      expect(await count(CUST_C.identityLinks)).toBe(0);

      const r1 = await migrateCustomers(db, { tenant: 'vcpv', runId: 'mc_1' });
      expect(r1.ok).toBe(true);
      expect(r1.created).toEqual({ accounts: 4, contacts: 4, points: 4, links: 4 });
      for (const s of Object.values(r1.source)) expect(s.after).toBe(s.before);
      const r2 = await migrateCustomers(db, { tenant: 'vcpv', runId: 'mc_2' });
      expect(r2.created).toEqual({ accounts: 0, contacts: 0, points: 0, links: 0 });
      expect(r2.skippedExisting).toBe(4);
      expect(await count(CUST_C.identityLinks)).toBe(4);

      const u = await undoCustomersMigration(db, { tenant: 'vcpv', runId: 'mc_1' });
      expect(u.refused).toBeNull();
      expect(u.deleted).toEqual({ accounts: 4, contacts: 4, points: 4, links: 4 });
      for (const n of [CUST_C.accounts, CUST_C.contacts, CUST_C.points, CUST_C.identityLinks]) expect(await count(n)).toBe(0);
      expect(await count(C.contacts)).toBe(IDENTITIES.length);
      expect(await count(C.messages)).toBe(IDENTITIES.length);
    });
  });

  describe('sweep and VCsales catalogue import', () => {
    it('sweep gives every identity its own profile (F5.1)', async () => {
      const r = await http().post('/api/customers/sweep').set(as['TD-U-SA']).expect(200);
      expect(r.body.profilesCreated).toBe(IDENTITIES.length);
      expect((await link(`${NK('01')}:9101101`))?.state).toBe('new');
    });

    it('NVKD cannot import (cust.import is DV only)', async () => {
      await http().post('/api/customers/import').set(as['TD-U-KD1']).send({}).expect(403);
    });

    it('imports the mock catalogue with first owners, auto-merges the new identity (D8-05), suggests the rest', async () => {
      const r = await http().post('/api/customers/import').set(as['TD-U-SA']).send({}).expect(200);
      expect(r.body).toMatchObject({ erp: 'vcsales', fetched: MOCK_VCSALE_CUSTOMERS_COUNT, created: MOCK_VCSALE_CUSTOMERS_COUNT, unchanged: 0 });
      // Minh, Linh, Hải, Hương exist as users; Tú and Toàn do not (stay "Chưa phân công").
      expect(r.body.ownersSet).toBe(MOCK_VCSALE_CUSTOMERS_COUNT - 6);
      expect(r.body.ownerUnmatched).toBe(5);
      expect(r.body.autoMerged).toBe(1);
      expect(r.body.suggestions).toBeGreaterThanOrEqual(2);

      const minhPhat = await t.db.col<CustomerAccountDoc>(CUST_C.accounts).findOne({ 'erpLinks.customerId': 'KH-TEST-0101' } as never);
      expect(minhPhat?.owners).toEqual([expect.objectContaining({ division: DIV, userId: 'TD-U-KD1', source: 'vcsales_import' })]);
      const l = await link(`${NK('01')}:9101101`);
      expect(l).toMatchObject({ accountId: minhPhat!._id, state: 'auto' });
      // M1b-14 port: identities of the customer, customer of the identity.
      const resolver = t.app.get<SubjectResolver>(SUBJECT_RESOLVER);
      expect(await resolver.identityIdsOfAccount(minhPhat!._id)).toEqual([`${NK('01')}:9101101`]);
      expect(await resolver.accountOfIdentity(`${NK('01')}:9101101`)).toBe(minhPhat!._id);
      // M1b-09 port: "khách của tôi".
      expect(await t.app.get<CustomerOwnership>(CUSTOMER_OWNERSHIP).conversationIdsOf('TD-U-KD1')).toContain(`${NK('01')}:9101101`);
      expect(await t.app.get(CustomersService).conversationIdsOf('TD-U-KD4')).not.toContain(`${NK('01')}:9101101`);

      const kien = await link(`${NK('01')}:9100950`);
      expect(kien?.state).toBe('new'); // Linh's customer on Minh's nick: suggestion, not merged
      const sug = (await http().get('/api/customers/merge-suggestions').set(as['TD-U-SA']).expect(200)).body as { a: { contactId: string }; b: { contactId: string }; cleanup: boolean; score: number }[];
      const hoaBinh = await link(`${NK('04')}:9100960`);
      const hb = sug.find((s) => [s.a.contactId, s.b.contactId].includes(hoaBinh!.contactId));
      expect(hb).toMatchObject({ cleanup: true });
      expect(sug.some((s) => [s.a.contactId, s.b.contactId].includes(kien!.contactId))).toBe(true);
    });

    it('re-running the import creates nothing (Xác nhận xong #2)', async () => {
      const before = await Promise.all([CUST_C.accounts, CUST_C.contacts, CUST_C.points, CUST_C.identityLinks, CUST_C.erpCustomers].map(count));
      const r = await http().post('/api/customers/import').set(as['TD-U-SA']).send({}).expect(200);
      expect(r.body).toMatchObject({ created: 0, updated: 0, unchanged: MOCK_VCSALE_CUSTOMERS_COUNT, ownersSet: 0, autoMerged: 0, suggestions: 0 });
      const after = await Promise.all([CUST_C.accounts, CUST_C.contacts, CUST_C.points, CUST_C.identityLinks, CUST_C.erpCustomers].map(count));
      expect(after).toEqual(before);
      expect(await t.db.col(CUST_C.accounts).countDocuments({ 'erpLinks.customerId': 'KH-TEST-0101' } as never)).toBe(1);
    });

    it('a phone on two VCsales codes is "Dùng chung nhiều khách" (DK-57)', async () => {
      const p = await t.db.col(CUST_C.points).find({ value: '0900000301' }).toArray();
      expect(p.length).toBe(2);
      expect(p.every((x) => x.state === 'shared_many')).toBe(true);
    });
  });

  describe('owner in the permission engine and customer visibility', () => {
    it('the owner is responsible for the conversation (scope CT)', async () => {
      const target = await t.app.get(AuthzService).conversationTarget(NK('01'), '9101101');
      expect(target.responsibleIds).toEqual(['TD-U-KD1']);
    });

    it('Minh sees his customer; Hải (other team) does not see it in the list nor by id', async () => {
      const minhPhat = await t.db.col<CustomerAccountDoc>(CUST_C.accounts).findOne({ 'erpLinks.customerId': 'KH-TEST-0101' } as never);
      const mine = (await http().get('/api/customers?q=Minh%20Ph%C3%A1t').set(as['TD-U-KD1']).expect(200)).body;
      expect(mine.items.map((i: { id: string }) => i.id)).toContain(minhPhat!._id);
      const hai = (await http().get('/api/customers?pageSize=100').set(as['TD-U-KD4']).expect(200)).body;
      expect(hai.items.map((i: { id: string }) => i.id)).not.toContain(minhPhat!._id);
      await http().get(`/api/customers/${minhPhat!._id}`).set(as['TD-U-KD4']).expect(404);
      const d = (await http().get(`/api/customers/${minhPhat!._id}`).set(as['TD-U-KD1']).expect(200)).body;
      expect(d.contacts[0].identities.map((i: { identityId: string }) => i.identityId)).toContain(`${NK('01')}:9101101`);
      expect(d.erpLinks).toEqual([expect.objectContaining({ erp: 'vcsales', customerId: 'KH-TEST-0101', status: 'confirmed' })]);
      // GĐ sees the whole division.
      const gd = (await http().get('/api/customers?pageSize=100').set(as['TD-U-GD']).expect(200)).body;
      expect(gd.items.map((i: { id: string }) => i.id)).toContain(minhPhat!._id);
    });

    it('by-identity needs the channel: Minh opens his nick identity, Hải is refused', async () => {
      await http().get(`/api/customers/by-identity/${NK('01')}/9101101`).set(as['TD-U-KD1']).expect(200);
      await http().get(`/api/customers/by-identity/${NK('01')}/9101101`).set(as['TD-U-KD4']).expect(403);
    });
  });

  describe('one-touch undo of the automatic merge (DK-11, "Không phải người này")', () => {
    it('restores the identity to its own profile, locks the pair, and the next sweep does not merge again', async () => {
      const minhPhat = await t.db.col<CustomerAccountDoc>(CUST_C.accounts).findOne({ 'erpLinks.customerId': 'KH-TEST-0101' } as never);
      const ops = (await http().get(`/api/customers/${minhPhat!._id}/operations`).set(as['TD-U-KD1']).expect(200)).body as { id: string; op: string }[];
      const auto = ops.find((o) => o.op === 'auto_merge')!;
      expect(auto).toBeDefined();
      await http().post(`/api/customers/merge-operations/${auto.id}/undo`).set(as['TD-U-KD4']).expect(404); // not Hải's customer
      const r = await http().post(`/api/customers/merge-operations/${auto.id}/undo`).set(as['TD-U-KD1']).expect(200);
      expect(r.body.undoneAt).toBeTruthy();
      const l = await link(`${NK('01')}:9101101`);
      expect(l?.state).toBe('new');
      expect(l?.accountId).not.toBe(minhPhat!._id);
      const own = await t.db.col<CustomerContactDoc>(CUST_C.contacts).findOne({ _id: l!.contactId });
      expect(own).toMatchObject({ status: 'active', mergedInto: null });
      expect(own!.mergeLocks.length).toBe(1);
      await http().post(`/api/customers/merge-operations/${auto.id}/undo`).set(as['TD-U-KD1']).expect(409);

      const s = await http().post('/api/customers/sweep').set(as['TD-U-SA']).expect(200);
      expect(s.body.autoMerged).toBe(0);
      expect((await link(`${NK('01')}:9101101`))?.accountId).toBe(l!.accountId);
      // Identity ids never changed (M1b-14 keys).
      expect(await t.db.col(CUST_C.identityLinks).countDocuments({})).toBe(IDENTITIES.length);
    });
  });

  describe('ERP links (MH-DK-10, MH-DK-13)', () => {
    it('UAT-DK-27: confirming a code already linked to another account is refused with the warning', async () => {
      const l = await link(`${NK('01')}:9101101`);
      const r = await http().post(`/api/customers/${l!.accountId}/erp-links`).set(as['TD-U-SA']).send({ customerId: 'KH-TEST-0101' }).expect(409);
      expect(r.body.message).toBe(ERP_CODE_TAKEN_TEXT('Garage Minh Phát'));
      expect(r.body.otherAccountId).toBeTruthy();
    });

    it('UAT-DK-87: GĐ reads the matching list without confirm rights; GS is refused', async () => {
      const gd = (await http().get('/api/customers/erp-matching').set(as['TD-U-GD']).expect(200)).body as {
        canConfirm: boolean;
        items: { accountId: string; accountName: string; candidates: { customerId: string; score: number }[] }[];
      };
      expect(gd.canConfirm).toBe(false);
      const row = gd.items.find((i) => i.accountName === 'Gara Khoa Minh');
      expect(row?.candidates[0]).toMatchObject({ customerId: 'KH-TEST-0388', score: 40 });
      expect((await http().get('/api/customers/erp-matching').set(as['TD-U-SA']).expect(200)).body.canConfirm).toBe(true);
      await http().post(`/api/customers/${row!.accountId}/erp-links`).set(as['TD-U-GD']).send({ customerId: 'KH-TEST-0388' }).expect(403);
      await http().get('/api/customers/erp-matching').set(as['TD-U-GS1']).expect(403);
    });

    it('NVKD cannot confirm; SA confirms a code fetched from VCsales, once per ERP (BR11); ERP phones become V3', async () => {
      const l = await link(`${NK('04')}:9100381`);
      // The noise code has its own imported account: taken.
      const taken = await http().post(`/api/customers/${l!.accountId}/erp-links`).set(as['TD-U-SA']).send({ customerId: 'KH-TEST-0388' }).expect(409);
      expect(taken.body.message).toBe(ERP_CODE_TAKEN_TEXT('Gara Khoa Minh'));
      // A code created on VCsales after the import (D8-20): fetched on confirm.
      const mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
      mock.upsert({ ...MOCK_VCSALE_CUSTOMERS[0], code: 'KH-TEST-0381', name: 'Gara Khoa Minh', phones: ['0900 000 381'], salespersonEmail: 'hai.uat@vcprosperous.com' });
      await http().post(`/api/customers/${l!.accountId}/erp-links`).set(as['TD-U-KD4']).send({ customerId: 'KH-TEST-0381' }).expect(403);
      const ok = (await http().post(`/api/customers/${l!.accountId}/erp-links`).set(as['TD-U-SA']).send({ customerId: 'KH-TEST-0381' }).expect(200)).body;
      expect(ok.erpLinks).toEqual([expect.objectContaining({ customerId: 'KH-TEST-0381', status: 'confirmed' })]);
      const pts = await t.db.col(CUST_C.points).find({ accountId: l!.accountId, value: '0900000381' }).toArray();
      expect(pts.length).toBeGreaterThan(0);
      expect(pts.every((p) => p.level === 'V3')).toBe(true);
      const again = await http().post(`/api/customers/${l!.accountId}/erp-links`).set(as['TD-U-SA']).send({ customerId: 'KH-TEST-0302' }).expect(409);
      expect(again.body.message).toContain('một mã mỗi bộ ERP');
    });

    it('VCsales down: confirm of an unknown code answers 503 with the MH-DK-10 text', async () => {
      const mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
      const l = await link(`${NK('04')}:9100960`);
      mock.down = true;
      try {
        const r = await http().post(`/api/customers/${l!.accountId}/erp-links`).set(as['TD-U-SA']).send({ customerId: 'KH-TEST-9999' }).expect(503);
        expect(r.body.message).toContain('Không kết nối được VCsales');
      } finally {
        mock.down = false;
      }
    });
  });

  describe('Danh bạ: Vai trò filter (MH-SZ-09 #4)', () => {
    it('filters by role and by "none"', async () => {
      await t.db.col(C.contacts).updateOne({ _id: `${NK('01')}:9101101` } as never, { $set: { role: 'dai_ly_gara' } });
      const r = (await http().get(`/api/contacts?uid=${NK('01')}&role=dai_ly_gara`).set(t.auth.dashboard).expect(200)).body;
      expect(r.items.map((i: { userId: string; role: string }) => [i.userId, i.role])).toEqual([['9101101', 'dai_ly_gara']]);
      const none = (await http().get(`/api/contacts?uid=${NK('01')}&role=none`).set(t.auth.dashboard).expect(200)).body;
      expect(none.items.map((i: { userId: string }) => i.userId)).toEqual(['9100950']);
      await http().get(`/api/contacts?uid=${NK('01')}&role=boss`).set(t.auth.dashboard).expect(400);
    });
  });
});
