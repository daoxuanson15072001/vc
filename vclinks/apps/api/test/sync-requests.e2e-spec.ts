import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';

const UID = '5400';

/** M1a-06: "Đồng bộ ngay" on /sync, Dashboard → API → extension (claimed with the fetch heartbeat). */
describe('Sync requests: Đồng bộ ngay (M1a-06)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  const tok: Record<'dash' | 'ingest', string> = { dash: '', ingest: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_sync_requests_test');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    tok.dash = await tokens.create('minh', ['dashboard']);
    tok.ingest = await tokens.create('ext', ['ingest']);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: 'Zalo test' }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('the Dashboard asks, the extension claims once, a second claim gets nothing', async () => {
    const claim = () => http().post('/api/sync/requests/claim').set(auth(tok.ingest)).send({ uid: UID }).expect(200);
    expect((await claim()).body).toEqual({ request: null });

    const asked = await http().post('/api/sync/requests').set(auth(tok.dash)).send({ uid: UID }).expect(200);
    expect(asked.body).toMatchObject({ uid: UID, status: 'pending', full: false, requestedBy: 'minh' });
    expect((await http().get(`/api/sync/requests/${UID}`).set(auth(tok.dash)).expect(200)).body.request.status).toBe('pending');

    const got = await claim();
    expect(got.body.request).toMatchObject({ uid: UID, status: 'claimed', full: false });
    expect((await claim()).body).toEqual({ request: null });
    expect((await http().get(`/api/sync/requests/${UID}`).set(auth(tok.dash)).expect(200)).body.request).toMatchObject({ status: 'claimed' });

    const audit = await db.col(C.auditLog).find({ action: { $in: ['sync.request', 'sync.request_claimed'] } }).toArray();
    expect(audit.map((a) => a.action).sort()).toEqual(['sync.request', 'sync.request_claimed']);
  });

  it('asking again while one waits keeps a single request; a stale one is not handed out', async () => {
    await http().post('/api/sync/requests').set(auth(tok.dash)).send({ uid: UID, full: true }).expect(200);
    await http().post('/api/sync/requests').set(auth(tok.dash)).send({ uid: UID, full: true }).expect(200);
    expect(await db.col(C.syncRequests).countDocuments({ uid: UID })).toBe(1);
    await db.col(C.syncRequests).updateOne({ _id: UID as never }, { $set: { requestedAt: new Date(Date.now() - 11 * 60_000) } });
    expect((await http().post('/api/sync/requests/claim').set(auth(tok.ingest)).send({ uid: UID }).expect(200)).body).toEqual({ request: null });
  });

  it('refuses unknown nicks, API channels, and the wrong scopes', async () => {
    await http().post('/api/sync/requests').set(auth(tok.dash)).send({ uid: '999999' }).expect(404);
    await http().post('/api/sync/requests').set(auth(tok.dash)).send({ uid: 'zoa_123' }).expect(400);
    await http().post('/api/sync/requests').set(auth(tok.dash)).send({ uid: UID, extra: 1 }).expect(400);
    await http().post('/api/sync/requests/claim').set(auth(tok.dash)).send({ uid: UID }).expect(403);
  });
});
