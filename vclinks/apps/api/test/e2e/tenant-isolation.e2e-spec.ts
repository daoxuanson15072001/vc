import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import request from 'supertest';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

// M1b-01: data of tenant A (default `vcpv`) is never readable with a tenant B session.
const UID_A = '9000000000101';
const UID_B = '9000000000201';
const THREAD_A = '9100000000101';
const THREAD_B = '9100000000201';

const msg = (uid: string, thread: string, i: number) => ({
  msgId: `${uid}-${i}`,
  threadId: thread,
  fromUid: thread,
  toUid: uid,
  msgType: 'webchat',
  text: `Tin ${uid} số ${i}`,
  sentAt: 1727500000000 + i * 1000,
});

describe('tenant_id: tenant A data is invisible to tenant B (e2e)', () => {
  let t: E2EApp;
  let authB: E2EApp['auth'];
  const http = () => request(t.app.getHttpServer());

  const seed = async (auth: E2EApp['auth'], uid: string, thread: string) => {
    await http().post('/api/accounts').set(auth.ingest).send({ uid, label: `Nick ${uid}` }).expect(201);
    await http()
      .post('/api/ingest/contacts')
      .set(auth.ingest)
      .send({ uid, items: [{ userId: thread, displayName: `Khách ${thread}` }] })
      .expect(200);
    await http()
      .post('/api/ingest/messages')
      .set(auth.ingest)
      .send({ uid, items: [1, 2].map((i) => msg(uid, thread, i)) })
      .expect(200);
  };

  beforeAll(async () => {
    t = await startE2EApp();
    authB = await t.authFor('tenant_b');
    await seed(t.auth, UID_A, THREAD_A);
    await seed(authB, UID_B, THREAD_B);
  });
  afterAll(async () => {
    await t?.close();
  });

  it('stamps tenant_id on every record written through the API', async () => {
    for (const col of [C.accounts, C.contacts, C.conversations, C.messages, C.checkpoints, C.auditLog, C.events]) {
      const raw = t.db.unscoped(col);
      expect(await raw.countDocuments({ tenant_id: { $exists: false } })).toBe(0);
    }
    expect(await t.db.unscoped(C.messages).countDocuments({ uid: UID_A, tenant_id: 'vcpv' })).toBe(2);
    expect(await t.db.unscoped(C.messages).countDocuments({ uid: UID_B, tenant_id: 'tenant_b' })).toBe(2);
  });

  it('lists only the own tenant on the Dashboard API', async () => {
    const accB = await http().get('/api/accounts').set(authB.dashboard).expect(200);
    expect(JSON.stringify(accB.body)).toContain(UID_B);
    expect(JSON.stringify(accB.body)).not.toContain(UID_A);

    const convB = await http().get('/api/conversations').set(authB.dashboard).expect(200);
    expect(JSON.stringify(convB.body)).toContain(THREAD_B);
    expect(JSON.stringify(convB.body)).not.toContain(THREAD_A);

    const convA = await http().get('/api/conversations').set(t.auth.dashboard).expect(200);
    expect(JSON.stringify(convA.body)).toContain(THREAD_A);
    expect(JSON.stringify(convA.body)).not.toContain(THREAD_B);
  });

  it('refuses direct reads of tenant A objects with a tenant B session', async () => {
    await http().get(`/api/conversations/${UID_A}:${THREAD_A}`).set(authB.dashboard).expect(404);
    const page = await http().get(`/api/conversations/${UID_A}:${THREAD_A}/messages`).set(authB.dashboard);
    expect(JSON.stringify(page.body)).not.toContain(`Tin ${UID_A}`);
    const contact = await http().get(`/api/contacts/${UID_A}/${THREAD_A}`).set(authB.dashboard);
    expect(JSON.stringify(contact.body)).not.toContain(`Khách ${THREAD_A}`);
    const ev = await http().get('/api/events').query({ kind: 'account', id: UID_A }).set(authB.dashboard).expect(200);
    expect(ev.body).toEqual([]);
  });

  it('refuses writes into tenant A accounts from tenant B', async () => {
    await http()
      .post('/api/ingest/messages')
      .set(authB.ingest)
      .send({ uid: UID_A, items: [msg(UID_A, THREAD_A, 9)] })
      .expect(404);
    await http().post('/api/accounts').set(authB.ingest).send({ uid: UID_A, label: 'Chiếm nick' }).expect(409);
    expect(await t.db.unscoped(C.messages).countDocuments({ uid: UID_A })).toBe(2);
    expect((await t.db.unscoped(C.accounts).findOne({ _id: UID_A as never }))?.label).toBe(`Nick ${UID_A}`);
  });

  it('keeps the tenant through MCP tool calls', async () => {
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    const base = await t.app.getUrl();
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', base.replace('[::1]', 'localhost')), {
        requestInit: { headers: authB.mcp },
      }),
    );
    try {
      const r = await client.callTool({ name: 'get_sync_status', arguments: {} });
      const text = (r as { content: { text: string }[] }).content[0].text;
      expect(text).toContain(UID_B);
      expect(text).not.toContain(UID_A);
    } finally {
      await client.close();
    }
  });
});
