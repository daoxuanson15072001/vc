import request from 'supertest';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

const UID = '9000000000101';

describe('e2e: driver watchdog → account session (lost / restored)', () => {
  let t: E2EApp;

  beforeAll(async () => {
    t = await startE2EApp();
    await request(t.app.getHttpServer()).post('/api/accounts').set(t.auth.ingest).send({ uid: UID, label: 'Nick watchdog' }).expect(201);
  });
  afterAll(async () => {
    await t?.close();
  });

  const report = (body: object, auth = t.auth.ingest) =>
    request(t.app.getHttpServer()).post(`/api/accounts/${UID}/session`).set(auth).send(body);
  const audits = (action: string) => t.db.col(C.auditLog).countDocuments({ action, target: UID });

  it('heartbeats without audit noise, then records lost and restored once each', async () => {
    let res = await report({ state: 'ok', source: 'watchdog:test' }).expect(200);
    expect(res.body).toMatchObject({ state: 'ok', changed: true, lastSyncAt: null });
    res = await report({ state: 'ok', source: 'watchdog:test' }).expect(200);
    expect(res.body.changed).toBe(false);
    expect(await audits('account.session_restored')).toBe(0);

    res = await report({ state: 'lost', reason: 'qr', source: 'watchdog:test' }).expect(200);
    expect(res.body.changed).toBe(true);
    await report({ state: 'lost', reason: 'qr', source: 'watchdog:test' }).expect(200);
    expect(await audits('account.session_lost')).toBe(1);

    const list = await request(t.app.getHttpServer()).get('/api/accounts').set(t.auth.dashboard).expect(200);
    const acc = list.body.find((a: { uid: string }) => a.uid === UID);
    expect(acc.session).toMatchObject({ state: 'lost', reason: 'qr', source: 'watchdog:test' });

    await report({ state: 'ok', source: 'watchdog:test' }).expect(200);
    expect(await audits('account.session_restored')).toBe(1);
  });

  it('rejects bad input, unknown accounts and non-ingest tokens', async () => {
    await report({ state: 'lost' }).expect(400);
    await report({ state: 'ok', cookie: 'x' }).expect(400);
    await report({ state: 'ok' }, t.auth.dashboard).expect(403);
    await request(t.app.getHttpServer())
      .post('/api/accounts/9000000000999/session')
      .set(t.auth.ingest)
      .send({ state: 'ok' })
      .expect(404);
  });
});
