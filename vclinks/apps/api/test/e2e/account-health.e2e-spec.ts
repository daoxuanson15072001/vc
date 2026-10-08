import request from 'supertest';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

const UID = '9000000000201';
const TEST_THREAD = 'g100';

describe('e2e: account health + send gate (SZ-10, SZ-14) + device pairing (PQ-52)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const health = async () => (await http().get(`/api/accounts/${UID}/health`).set(t.auth.dashboard).expect(200)).body;
  const beat = (lastSeenAt: Date, loggedIn: boolean | null = true) =>
    t.db.col(C.extensionPresence).updateOne({ _id: UID as never }, { $set: { lastSeenAt, loggedIn, waiting: null, by: 'e2e' } }, { upsert: true });
  const send = (threadId: string) => http().post('/api/outbox').set(t.auth.dashboard).send({ uid: UID, threadId, text: 'Dạ em chào anh' });

  beforeAll(async () => {
    t = await startE2EApp();
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: UID, label: 'Nick sức khỏe' }).expect(201);
  });
  afterAll(async () => {
    await t?.close();
  });

  it('goes green → red (offline) and refuses new commands with a business sentence', async () => {
    await beat(new Date());
    expect(await health()).toMatchObject({ level: 'green', canSend: true });
    await send(TEST_THREAD).expect(201);

    await beat(new Date(Date.now() - 3 * 60_000));
    expect(await health()).toMatchObject({ level: 'red', canSend: false });
    const res = await send(TEST_THREAD).expect(400);
    expect(res.body.message).toMatch(/mất kết nối/);

    await beat(new Date());
    await send(TEST_THREAD).expect(201);
  });

  it('refuses a flagged "Chưa an toàn" nick even when the dot would be green', async () => {
    await t.db.col(C.accounts).updateOne({ _id: UID as never }, { $set: { unsafe: true } });
    expect(await health()).toMatchObject({ level: 'unsafe', canSend: false });
    await send(TEST_THREAD).expect(400);
    await t.db.col(C.accounts).updateOne({ _id: UID as never }, { $unset: { unsafe: '' } });
  });

  it('refuses threads outside onlyThreadIds reported by the extension poll', async () => {
    await http().get('/api/outbox/pending').query({ uid: UID, onlyThreads: TEST_THREAD }).set(t.auth.ingest).expect(200);
    expect((await health()).onlyThreadIds).toEqual([TEST_THREAD]);
    const res = await send('u555').expect(400);
    expect(res.body.message).toMatch(/Giai đoạn thử/);
    await send(TEST_THREAD).expect(201);
    await http().get('/api/outbox/pending').query({ uid: UID, onlyThreads: '' }).set(t.auth.ingest).expect(200);
    await send('u555').expect(201);
  });

  it('"Báo Admin" sends once per 30 minutes', async () => {
    const first = await http().post(`/api/accounts/${UID}/notify-admin`).set(t.auth.dashboard).expect(200);
    const second = await http().post(`/api/accounts/${UID}/notify-admin`).set(t.auth.dashboard).expect(200);
    expect([first.body.sent, second.body.sent]).toEqual([true, false]);
  });

  it('lists health of all accounts', async () => {
    const res = await http().get('/api/accounts/health').set(t.auth.dashboard).expect(200);
    expect(res.body.map((h: { uid: string }) => h.uid)).toContain(UID);
    await http().get('/api/accounts/9000000000999/health').set(t.auth.dashboard).expect(404);
  });

  it('pairs a device by 6-digit code: token handed over once, wrong key refused', async () => {
    const req = await http().post('/api/devices/pairings').send({ deviceName: 'May test' }).expect(201);
    expect(req.body.code).toMatch(/^\d{6}$/);
    const poll = (key = req.body.pollKey) => http().get(`/api/devices/pairings/${req.body.id}`).query({ pollKey: key });
    expect((await poll().expect(200)).body.status).toBe('pending');
    await poll('x'.repeat(30)).expect(404);

    await http().post('/api/devices/pairings/approve').set(t.auth.ingest).send({ code: req.body.code }).expect(403);
    await http().post('/api/devices/pairings/approve').set(t.auth.dashboard).send({ code: '000000' }).expect(404);
    await http().post('/api/devices/pairings/approve').set(t.auth.dashboard).send({ code: req.body.code }).expect(200);

    const got = (await poll().expect(200)).body;
    expect(got.status).toBe('approved');
    expect((await poll().expect(200)).body).toEqual({ status: 'used' });
    await http().get('/api/outbox/pending').set({ Authorization: `Bearer ${got.token}` }).expect(200);
  });

  it('rotates a device token: old stays valid until the new one is committed', async () => {
    const req = await http().post('/api/devices/pairings').send({ deviceName: 'May xoay' }).expect(201);
    await http().post('/api/devices/pairings/approve').set(t.auth.dashboard).send({ code: req.body.code }).expect(200);
    const old = (await http().get(`/api/devices/pairings/${req.body.id}`).query({ pollKey: req.body.pollKey })).body.token as string;
    const oldAuth = { Authorization: `Bearer ${old}` };
    const { token } = (await http().post('/api/devices/token/rotate').set(oldAuth).expect(200)).body;
    const newAuth = { Authorization: `Bearer ${token}` };
    await http().get('/api/outbox/pending').set(oldAuth).expect(200);
    await http().post('/api/devices/token/commit').set(newAuth).send({ token: old }).expect(401);
    expect((await http().post('/api/devices/token/commit').set(newAuth).send({ token }).expect(200)).body.revoked).toBe(1);
    expect(await t.db.col(C.apiTokens).countDocuments({ revokedAt: { $exists: true } })).toBeGreaterThanOrEqual(1);
  });
});
