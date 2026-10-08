import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';

const UID = '111';
const CONV = `${UID}:222`;
const enc = encodeURIComponent;

describe('Conversation fetch requests (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  const tok = { ingest: '', dashboard: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_fetch_test');
    app = await createApp({ logger: false });
    await app.init();
    const tokens = app.get(TokenService);
    tok.ingest = await tokens.create('test-ingest', ['ingest']);
    tok.dashboard = await tokens.create('test-dashboard', ['dashboard']);
    await app
      .get(DbService)
      .col(C.conversations)
      .insertMany([
        { _id: CONV as never, uid: UID, threadId: '222', type: 'user', name: 'Anh Tú', lastMsgAt: new Date() },
        { _id: 'zoa_1:9' as never, uid: 'zoa_1', threadId: '9', type: 'user', lastMsgAt: new Date() },
      ]);
    await app
      .get(DbService)
      .col(C.messages)
      .insertMany([
        { _id: `${UID}:m1` as never, uid: UID, threadId: '222', msgId: 'm1', cliMsgId: 'c1', sentAt: new Date(1000) },
        { _id: `${UID}:m2` as never, uid: UID, threadId: '222', msgId: 'm2', cliMsgId: 'c2', sentAt: new Date(2000) },
        { _id: `${UID}:m3` as never, uid: UID, threadId: '999', msgId: 'm3', cliMsgId: 'c3', sentAt: new Date(3000) },
      ]);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('GET /conversations/:id returns the header item', async () => {
    const http = request(app.getHttpServer());
    const r = await http.get(`/api/conversations/${enc(CONV)}`).set(auth(tok.dashboard)).expect(200);
    expect(r.body).toMatchObject({ id: CONV, uid: UID, threadId: '222', name: 'Anh Tú', channel: 'zalo' });
    await http.get(`/api/conversations/${enc(`${UID}:nope`)}`).set(auth(tok.dashboard)).expect(404);
  });

  it('queues, dedups, hands out, claims once and records the result', async () => {
    const http = request(app.getHttpServer());
    const none = await http.get(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).expect(200);
    expect(none.body).toEqual({ status: 'none', extension: null, otherLoggedIn: null });

    await http.post(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.ingest)).expect(403);
    const a = await http.post(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).expect(200);
    expect(a.body).toMatchObject({ id: CONV, status: 'pending' });
    const b = await http.post(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).expect(200);
    expect(b.body.requestedAt).toBe(a.body.requestedAt);

    await http.get(`/api/fetch-requests/pending?uid=${UID}`).set(auth(tok.dashboard)).expect(403);
    const p = await http.get(`/api/fetch-requests/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200);
    expect(p.body.map((x: { id: string }) => x.id)).toEqual([CONV]);
    // Name for the search box and newest-first cliMsgIds of this thread only, so the
    // extension can find and then confirm the conversation on Zalo Web.
    expect(p.body[0]).toMatchObject({ name: 'Anh Tú', recentCliMsgIds: ['c2', 'c1'] });

    const c = await http.post(`/api/fetch-requests/${enc(CONV)}/claim`).set(auth(tok.ingest)).expect(200);
    expect(c.body.status).toBe('running');
    await http.post(`/api/fetch-requests/${enc(CONV)}/claim`).set(auth(tok.ingest)).expect(409);
    const p2 = await http.get(`/api/fetch-requests/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200);
    expect(p2.body).toEqual([]);

    await http.post(`/api/fetch-requests/${enc(CONV)}/result`).set(auth(tok.ingest)).send({ ok: false }).expect(400);
    const done = await http
      .post(`/api/fetch-requests/${enc(CONV)}/result`)
      .set(auth(tok.ingest))
      .send({ ok: true, reason: 'reached_start', posted: 42 })
      .expect(200);
    expect(done.body).toMatchObject({ status: 'done', reason: 'reached_start', posted: 42 });
    await http.post(`/api/fetch-requests/${enc(CONV)}/result`).set(auth(tok.ingest)).send({ ok: true }).expect(409);

    // A new request re-arms the same document.
    const again = await http.post(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).expect(200);
    expect(again.body).toMatchObject({ status: 'pending' });
    expect(again.body.posted).toBeUndefined();
  });

  it('only an explicit confirmed request (onBehalf) tells the extension to open the chat although it is unread', async () => {
    const http = request(app.getHttpServer());
    const next = async (body?: object) => {
      await http.post(`/api/fetch-requests/${enc(CONV)}/claim`).set(auth(tok.ingest));
      await http.post(`/api/fetch-requests/${enc(CONV)}/result`).set(auth(tok.ingest)).send({ ok: true });
      const r = body ? await http.post(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).send(body) : await http.post(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard));
      expect(r.status).toBe(200);
      return (await http.get(`/api/fetch-requests/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body[0] as { allowUnread?: boolean };
    };
    await http.post(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).expect(200);
    const plain = (await http.get(`/api/fetch-requests/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body[0] as { allowUnread?: boolean };
    expect(plain.allowUnread).toBeUndefined();
    expect((await next({ onBehalf: true })).allowUnread).toBe(true);
    // The next automatic request does not inherit it.
    expect((await next()).allowUnread).toBeUndefined();
    // A confirmed request joins one that is already queued.
    await http.post(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).send({ onBehalf: true }).expect(200);
    expect((await http.get(`/api/fetch-requests/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body[0].allowUnread).toBe(true);
  });

  it('reports extension presence from polls; a tab logged in elsewhere gets nothing', async () => {
    const http = request(app.getHttpServer());
    await http.post(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).expect(200);
    const other = await http.get('/api/fetch-requests/pending?uid=555&loggedIn=1').set(auth(tok.ingest)).expect(200);
    expect(other.body).toEqual([]);
    const mine = await http
      .get(`/api/fetch-requests/pending?uid=${UID}&loggedIn=0&waiting=user_active`)
      .set(auth(tok.ingest))
      .expect(200);
    expect(mine.body).toEqual([]);
    const s = await http.get(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).expect(200);
    expect(s.body.extension).toMatchObject({ online: true, loggedIn: false, waiting: 'user_active' });
    expect(s.body.otherLoggedIn).toEqual({ uid: '555', label: '555' });

    await http.get(`/api/fetch-requests/pending?uid=${UID}&loggedIn=1`).set(auth(tok.ingest)).expect(200);
    const s2 = await http.get(`/api/conversations/${enc(CONV)}/fetch`).set(auth(tok.dashboard)).expect(200);
    expect(s2.body.extension).toMatchObject({ online: true, loggedIn: true, waiting: null });
    expect(s2.body.otherLoggedIn).toBeNull();
    await http.get(`/api/fetch-requests/pending?uid=${UID}&loggedIn=x`).set(auth(tok.ingest)).expect(400);
  });

  it('refuses API channels and unknown conversations', async () => {
    const http = request(app.getHttpServer());
    await http.post(`/api/conversations/${enc('zoa_1:9')}/fetch`).set(auth(tok.dashboard)).expect(400);
    await http.post(`/api/conversations/${enc(`${UID}:404`)}/fetch`).set(auth(tok.dashboard)).expect(404);
  });
});
