import request from 'supertest';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

const UID = '9000000000001';
const THREAD = '9000000000002';

describe('e2e sample: ingest → read conversation (real MongoDB, temp database)', () => {
  let t: E2EApp;

  beforeAll(async () => {
    t = await startE2EApp();
  });
  afterAll(async () => {
    await t?.close();
  });

  it('uses a throwaway database, not vclinks', () => {
    expect(t.dbName).toMatch(/^vclinks_test_[0-9a-f]{8}$/);
    expect(t.db.db.databaseName).toBe(t.dbName);
  });

  it('ingests messages and reads them back through the conversation API', async () => {
    const http = request(t.app.getHttpServer());
    await http.post('/api/accounts').set(t.auth.ingest).send({ uid: UID, label: 'Nick mẫu' }).expect(201);
    await http
      .post('/api/ingest/conversations')
      .set(t.auth.ingest)
      .send({ uid: UID, items: [{ threadId: THREAD, type: 'user', lastMsgAt: 1727500003000 }] })
      .expect(200);
    const items = [1, 2, 3].map((i) => ({
      msgId: String(i),
      threadId: THREAD,
      fromUid: i % 2 ? THREAD : '0',
      toUid: i % 2 ? UID : THREAD,
      msgType: 'webchat',
      text: `Tin mẫu ${i}`,
      sentAt: 1727500000000 + i * 1000,
    }));
    const res = await http.post('/api/ingest/messages').set(t.auth.ingest).send({ uid: UID, items }).expect(200);
    expect(res.body).toMatchObject({ accepted: 3, updated: 0, rejected: [] });

    const list = await http.get('/api/conversations').query({ uid: UID }).set(t.auth.dashboard).expect(200);
    expect(JSON.stringify(list.body)).toContain(THREAD);

    const page = await http.get(`/api/conversations/${UID}:${THREAD}/messages`).set(t.auth.dashboard).expect(200);
    const texts = JSON.stringify(page.body);
    for (const i of [1, 2, 3]) expect(texts).toContain(`Tin mẫu ${i}`);
    expect(await t.db.col(C.messages).countDocuments({ uid: UID })).toBe(3);
  });
});
