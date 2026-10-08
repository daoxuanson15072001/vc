import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';

const UID = '111';
const msg = (id: number, threadId: string, contentStatus: 'pending' | 'partial' | 'complete') => ({
  msgId: String(id),
  cliMsgId: `c${id}`,
  threadId,
  fromUid: '222',
  toUid: UID,
  msgType: 'webchat',
  sentAt: 1727500000000 + id * 1000,
  contentStatus,
  ...(contentStatus === 'complete' ? { text: `Tin ${id}` } : { encrypted: true }),
});

describe('GET /api/threads/:threadId/pending-content (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  const tok = { ingest: '', dashboard: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_pending_test');
    app = await createApp({ logger: false });
    await app.init();
    const tokens = app.get(TokenService);
    tok.ingest = await tokens.create('test-ingest', ['ingest']);
    tok.dashboard = await tokens.create('test-dashboard', ['dashboard']);
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: 'Zalo test' }).expect(201);
    await http
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        items: [msg(1, '222', 'pending'), msg(2, '222', 'partial'), msg(3, '222', 'complete'), msg(4, '999', 'pending'), msg(5, '333', 'pending')],
      })
      .expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('lists pending/partial cliMsgIds of the thread, newest first, ingest scope only', async () => {
    const http = request(app.getHttpServer());
    await http.get(`/api/threads/222/pending-content?uid=${UID}`).set(auth(tok.dashboard)).expect(403);
    await http.get('/api/threads/222/pending-content').set(auth(tok.ingest)).expect(400);
    const r = await http.get(`/api/threads/222/pending-content?uid=${UID}`).set(auth(tok.ingest)).expect(200);
    expect(r.body).toEqual({ threadId: '222', cliMsgIds: ['c2', 'c1'], truncated: false });
  });

  it('accepts the sidebar "g" prefix for groups', async () => {
    const r = await request(app.getHttpServer())
      .get(`/api/threads/g333/pending-content?uid=${UID}`)
      .set(auth(tok.ingest))
      .expect(200);
    expect(r.body.cliMsgIds).toEqual(['c5']);
  });
});
