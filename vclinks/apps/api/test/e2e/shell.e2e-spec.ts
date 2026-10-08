import request from 'supertest';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

// M1b-08: Ctrl+K quick search (name, phone, customer code, ≤ 1 s on seed data, scoped, masked), own profile and status.
const NICK_A = '900000000001';
const NICK_B = '900000000002';

describe('app shell API (e2e, M1b-08)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  let kd: { Authorization: string };
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'DV';
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      [
        { _id: 'GOC', code: 'GOC', name: 'Tập đoàn', type: 'goc', parentId: null, divisionId: null },
        { _id: 'DV', code: 'DV', name: 'Division', type: 'division', parentId: 'GOC', divisionId: 'DV' },
        { _id: 'T1', code: 'T1', name: 'Tổ 1', type: 'to_ban_hang', parentId: 'DV', divisionId: 'DV' },
      ].map((u) => ({ ...u, managerUserId: null, active: true, createdAt: now, updatedAt: now })) as never,
    );
    await t.db.col(C.users).insertOne({ _id: 'U-KD', email: 'kd@vcprosperous.com', fullName: 'Nguyễn Văn Minh', status: 'hoat_dong' } as never);
    await t.db.col('role_assignments').insertOne({ _id: 'U-KD:nvkd:T1', userId: 'U-KD', roleKey: 'nvkd', orgUnitId: 'T1', createdBy: 'seed', createdAt: now } as never);
    kd = { Authorization: `Bearer ${await t.app.get(SessionService).create({ _id: 'U-KD', fullName: 'Nguyễn Văn Minh' })}` };
    for (const uid of [NICK_A, NICK_B]) await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-1)}` }).expect(201);
    await t.db.col('channel_access').insertOne({ _id: `${NICK_A}:user:U-KD:giu_nick`, channelId: NICK_A, principalType: 'user', principalId: 'U-KD', level: 'giu_nick', createdBy: 'seed' } as never);

    const names = ['Nguyễn Văn An', 'Lê Thị Bình', 'Trần Quốc Cường', 'Phạm Minh Đức', 'Hoàng Thu Hà'];
    const docs = Array.from({ length: 5000 }, (_, i) => {
      const name = `${names[i % 5]} ${i}`;
      return { _id: `${NICK_B}:c${i}`, uid: NICK_B, userId: `c${i}`, domName: name, domNameFold: name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'), phone: `09${String(10000000 + i).slice(0, 8)}`, inFriendList: true };
    });
    docs.push({ _id: `${NICK_A}:k1`, uid: NICK_A, userId: 'k1', domName: 'Khách Của Minh', domNameFold: 'khach cua minh', phone: '0987654321', inFriendList: true, customerCode: 'KH-0001' } as never);
    await t.db.col(C.contacts).insertMany(docs as never);
    await t.db.col(C.conversations).insertOne({ _id: `${NICK_A}:k1`, uid: NICK_A, threadId: 'k1', type: 'user', lastMsgAt: now, unread: 0 } as never);
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    await t?.close();
  });

  const search = (q: string, who = t?.auth.dashboard) => http().get('/api/search/quick').query({ q }).set(who);

  it('finds by name without diacritics, by phone digits and by customer code in ≤ 1 s, phone masked', async () => {
    const byName = await search('tran quoc cuong 7').expect(200);
    expect(byName.body.tookMs).toBeLessThan(1000);
    expect(byName.body.items.length).toBeGreaterThan(0);
    const byPhone = await search('0987654321').expect(200);
    expect(byPhone.body.items[0]).toMatchObject({ userId: 'k1', phone: '0987 *** 321', conversationId: `${NICK_A}:k1` });
    const byCode = await search('kh-0001').expect(200);
    expect(byCode.body.items[0]).toMatchObject({ userId: 'k1', customerCode: 'KH-0001' });
    expect(JSON.stringify(byPhone.body)).not.toContain('0987654321');
  });

  it('answers within a second on 5 000 contacts', async () => {
    const t0 = Date.now();
    await search('nguyen van').expect(200);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('a user only finds contacts of the nick he holds', async () => {
    const r = await search('nguyen van', kd).expect(200);
    expect(r.body.items).toEqual([]);
    const own = await search('khach cua', kd).expect(200);
    expect(own.body.items.map((i: { userId: string }) => i.userId)).toEqual(['k1']);
  });

  it('rejects an empty query', async () => {
    await search('').expect(400);
  });

  it('profile and manual status: default online, field with end time, expires, validation', async () => {
    const p = await http().get('/api/me/profile').set(kd).expect(200);
    expect(p.body).toMatchObject({ userId: 'U-KD', name: 'Nguyễn Văn Minh', status: 'online' });
    const until = new Date(Date.now() + 3600_000).toISOString();
    await http().put('/api/me/status').set(kd).send({ status: 'field', until }).expect(200);
    expect((await http().get('/api/me/profile').set(kd)).body).toMatchObject({ status: 'field', until });
    await http().put('/api/me/status').set(kd).send({ status: 'online', until }).expect(400);
    await http().put('/api/me/status').set(kd).send({ status: 'field', until: new Date(Date.now() - 1000).toISOString() }).expect(400);
    await http().put('/api/me/status').set(kd).send({ status: 'bogus' }).expect(400);
    await t.db.col(C.users).updateOne({ _id: 'U-KD' } as never, { $set: { 'presence.until': new Date(Date.now() - 1000) } });
    expect((await http().get('/api/me/profile').set(kd)).body.status).toBe('online');
    await http().put('/api/me/status').set(t.auth.dashboard).send({ status: 'away' }).expect(400);
  });

  it('notifications skeleton is empty', async () => {
    expect((await http().get('/api/notifications').set(kd).expect(200)).body).toEqual({ items: [], unread: 0 });
  });
});
