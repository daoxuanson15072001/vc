import request from 'supertest';
import { C } from '../../src/db/db.service';
import { EventsService } from '../../src/events/events.service';
import { startE2EApp, type E2EApp } from './helpers';

// M1b-01: append-only event log, read back per object.
const UID = '9000000000301';
const THREAD = '9100000000301';
const SECRET = 'Nội dung tin không được vào nhật ký';

describe('event log (e2e)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await startE2EApp();
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: UID, label: 'Nick sự kiện' }).expect(201);
  });
  afterAll(async () => {
    await t?.close();
  });

  it('logs account registration and ingest batches on the account, without message content', async () => {
    const item = { msgId: '1', threadId: THREAD, fromUid: THREAD, toUid: UID, msgType: 'webchat', text: SECRET, sentAt: 1727500000000 };
    await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: UID, items: [item] }).expect(200);
    // An unchanged re-send is not logged.
    await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: UID, items: [item] }).expect(200);

    const res = await http().get('/api/events').query({ kind: 'account', id: UID }).set(t.auth.dashboard).expect(200);
    expect(res.body.map((e: { type: string }) => e.type)).toEqual(['ingest.batch', 'account.register']);
    expect(res.body[0]).toMatchObject({ subject: { kind: 'account', id: UID }, data: { stream: 'messages', accepted: 1 } });
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it('logs the outbox lifecycle on the outbox item', async () => {
    const created = await http().post('/api/outbox').set(t.auth.dashboard).send({ uid: UID, threadId: THREAD, text: SECRET }).expect(201);
    const id = created.body.id as string;
    await http().post(`/api/outbox/${id}/claim`).set(t.auth.ingest).expect(200);
    await http().post(`/api/outbox/${id}/result`).set(t.auth.ingest).send({ ok: true, sentAt: new Date().toISOString() }).expect(200);
    const res = await http().get('/api/events').query({ kind: 'outbox', id }).set(t.auth.dashboard).expect(200);
    expect(res.body.map((e: { type: string }) => e.type)).toEqual(['outbox.sent', 'outbox.claim', 'outbox.create']);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it('exposes append() to other modules and validates it', async () => {
    const events = t.app.get(EventsService);
    await events.append({ type: 'account.session_lost', subject: { kind: 'account', id: UID }, actor: 'driver', data: { reason: 'test' } });
    await expect(events.append({ type: 'Bad Type', subject: { kind: 'account', id: UID }, actor: 'x' })).rejects.toThrow();
    const res = await http().get('/api/events').query({ kind: 'account', id: UID, type: 'account.session_lost' }).set(t.auth.dashboard).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tenant_id).toBeUndefined();
  });

  it('is read-only over HTTP and needs a kind and the dashboard scope', async () => {
    await http().get('/api/events').set(t.auth.dashboard).expect(400);
    await http().get('/api/events').query({ kind: 'account' }).set(t.auth.ingest).expect(403);
    const any = await t.db.col(C.events).findOne({});
    await http().delete(`/api/events/${String(any?._id)}`).set(t.auth.dashboard).expect(404);
    await http().patch(`/api/events/${String(any?._id)}`).set(t.auth.dashboard).send({}).expect(404);
    await http().post('/api/events').set(t.auth.dashboard).send({ type: 'x' }).expect(404);
  });

  it('pages with before and limit', async () => {
    const all = (await http().get('/api/events').query({ kind: 'account', id: UID }).set(t.auth.dashboard).expect(200)).body;
    const first = (await http().get('/api/events').query({ kind: 'account', id: UID, limit: 1 }).set(t.auth.dashboard).expect(200)).body;
    expect(first).toHaveLength(1);
    const older = (
      await http().get('/api/events').query({ kind: 'account', id: UID, before: first[0].at }).set(t.auth.dashboard).expect(200)
    ).body;
    expect(older.length).toBeLessThan(all.length);
  });
});
