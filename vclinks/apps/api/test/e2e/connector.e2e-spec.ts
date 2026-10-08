import request from 'supertest';
import { ConnectorModule } from '../../src/app.module';
import { OutboxDispatcher } from '../../src/outbox/outbox.dispatcher';
import { startE2EApp, type E2EApp } from './helpers';

// M1b-01: the connector process runs without the web/Dashboard API (BA §2.2 #7).
const UID = '9000000000401';
const THREAD = '9100000000401';

describe('connector process alone (web off) (e2e)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await startE2EApp({ module: ConnectorModule });
  });
  afterAll(async () => {
    await t?.close();
  });

  it('does not serve the Dashboard / MCP routes', async () => {
    await http().get('/api/conversations').set(t.auth.dashboard).expect(404);
    await http().get('/api/events').query({ kind: 'account' }).set(t.auth.dashboard).expect(404);
    await http().post('/mcp').set(t.auth.mcp).send({}).expect(404);
    await http().get('/api/health').expect(200);
  });

  it('still receives ingest from the extension', async () => {
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: UID, label: 'Nick connector' }).expect(201);
    const items = [1, 2].map((i) => ({
      msgId: String(i),
      threadId: THREAD,
      fromUid: THREAD,
      toUid: UID,
      msgType: 'webchat',
      text: `Tin ${i}`,
      sentAt: 1727500000000 + i,
    }));
    const r = await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: UID, items }).expect(200);
    expect(r.body).toMatchObject({ accepted: 2, rejected: [] });
  });

  it('still delivers the outbox: extension pull → claim → result, and runs the dispatcher', async () => {
    expect(t.app.get(OutboxDispatcher)).toBeDefined();
    const created = await http().post('/api/outbox').set(t.auth.dashboard).send({ uid: UID, threadId: THREAD, text: 'Dạ em chào anh' }).expect(201);
    const pending = await http().get('/api/outbox/pending').query({ uid: UID }).set(t.auth.ingest).expect(200);
    expect(pending.body.map((i: { id: string }) => i.id)).toContain(created.body.id);
    await http().post(`/api/outbox/${created.body.id}/claim`).set(t.auth.ingest).expect(200);
    const done = await http()
      .post(`/api/outbox/${created.body.id}/result`)
      .set(t.auth.ingest)
      .send({ ok: true, sentAt: new Date().toISOString() })
      .expect(200);
    expect(done.body.status).toBe('sent');
  });
});
