import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { OutboxItem } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';

const UID = '5300';
const OTHER = '5301';

/**
 * M1a-06: per-nick send pace (03 SZ-04, BA §11.7 ZR3). Ten commands approved at
 * once go out one gap apart, none is lost; the pace is configurable per nick
 * and can never be set to bulk sending.
 */
describe('Outbox send pace per nick (M1a-06)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  const tok: Record<'dash' | 'ingest', string> = { dash: '', ingest: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.SEND_PACE_DISABLED = '0';
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_outbox_pace_test');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    tok.dash = await tokens.create('minh', ['dashboard']);
    tok.ingest = await tokens.create('ext', ['ingest']);
    for (const uid of [UID, OTHER]) await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid, label: `Zalo ${uid}` }).expect(201);
  });

  afterAll(async () => {
    process.env.SEND_PACE_DISABLED = '1';
    await app?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await db.col(C.suggestions).deleteMany({});
    await db.col(C.sendPaceSlots).deleteMany({});
  });

  const create = async (uid: string, i: number) =>
    (await http().post('/api/outbox').set(auth(tok.dash)).send({ uid, threadId: '900', text: `Tin ${i}` }).expect(201)).body as OutboxItem;
  const pending = async (uid: string) =>
    (await http().get(`/api/outbox/pending?uid=${uid}&commands=1`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[];

  it('rejects a pace outside the bounds and stores a valid one per nick', async () => {
    await http().patch(`/api/accounts/${UID}`).set(auth(tok.dash)).send({ sendPace: { gapMs: 200 } }).expect(400);
    await http().patch(`/api/accounts/${UID}`).set(auth(tok.dash)).send({ sendPace: { perMinute: 100 } }).expect(400);
    await http().patch(`/api/accounts/${UID}`).set(auth(tok.dash)).send({ sendPace: { gapMs: 1000, perMinute: 30 } }).expect(200);
    const acc = await db.col<{ _id: string; sendPace?: unknown }>(C.accounts).findOne({ _id: UID });
    expect(acc?.sendPace).toEqual({ gapMs: 1000, perMinute: 30 });
  });

  it('10 commands approved at once go out at least one gap apart, in order, none lost', async () => {
    await http().patch(`/api/accounts/${UID}`).set(auth(tok.dash)).send({ sendPace: { gapMs: 1000, perMinute: 30 } }).expect(200);
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push((await create(UID, i)).id);

    const claimedAt: number[] = [];
    const order: string[] = [];
    let refused = 0;
    const deadline = Date.now() + 25_000;
    while (order.length < 10 && Date.now() < deadline) {
      const list = await pending(UID);
      // Held commands stay listed (nothing looks lost) and stay approved.
      expect(list.length).toBe(Math.min(5, 10 - order.length)); // PENDING_LIMIT = 5
      const res = await http().post(`/api/outbox/${list[0].id}/claim`).set(auth(tok.ingest));
      if (res.status === 409) {
        refused++;
        expect(res.body.message).toContain('Chưa tới nhịp gửi của nick');
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }
      expect(res.status).toBe(200);
      claimedAt.push(Date.now());
      order.push(list[0].id);
      await http().post(`/api/outbox/${list[0].id}/result`).set(auth(tok.ingest)).send({ ok: true, sentAt: new Date().toISOString() }).expect(200);
    }
    expect(order).toEqual(ids);
    expect(refused).toBeGreaterThan(0);
    const stored = await db
      .col(C.suggestions)
      .find({ uid: UID })
      .sort({ claimedAt: 1 })
      .toArray();
    expect(stored.map((d) => d.status)).toEqual(Array(10).fill('sent'));
    const starts = stored.map((d) => (d.claimedAt as Date).getTime());
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(1000);
  }, 40_000);

  it('the pace is per nick: another nick is not held', async () => {
    const a = await create(UID, 1);
    const b = await create(OTHER, 1);
    const a2 = await create(UID, 2);
    await http().post(`/api/outbox/${a.id}/claim`).set(auth(tok.ingest)).expect(200);
    await http().post(`/api/outbox/${b.id}/claim`).set(auth(tok.ingest)).expect(200);
    await http().post(`/api/outbox/${a2.id}/claim`).set(auth(tok.ingest)).expect(409);
    expect((await db.col(C.suggestions).findOne({ _id: new ObjectId(a2.id) }))?.status).toBe('approved');
  });

  it('two claims of one nick at the same moment: only one passes (atomic slot)', async () => {
    const x = await create(UID, 1);
    const y = await create(UID, 2);
    const res = await Promise.all([x, y].map((it) => http().post(`/api/outbox/${it.id}/claim`).set(auth(tok.ingest))));
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db.col(C.suggestions).countDocuments({ uid: UID, status: 'approved' })).toBe(1);
  });

  it('per-minute cap holds once the window is full', async () => {
    await http().patch(`/api/accounts/${OTHER}`).set(auth(tok.dash)).send({ sendPace: { gapMs: 1000, perMinute: 2 } }).expect(200);
    // Two commands claimed 5 s and 3 s ago fill the window of 2.
    const now = Date.now();
    await db.col(C.suggestions).insertMany(
      [5000, 3000].map((ago) => ({ uid: OTHER, threadId: '900', status: 'sent', source: 'manual', claimedAt: new Date(now - ago) })),
    );
    const c = await create(OTHER, 3);
    const res = await http().post(`/api/outbox/${c.id}/claim`).set(auth(tok.ingest)).expect(409);
    expect(res.body.message).toContain('tối đa 2 lệnh mỗi phút');
  });
});
