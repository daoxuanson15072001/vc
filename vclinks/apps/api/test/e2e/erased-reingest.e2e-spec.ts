import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { ERASED_TEXT } from '@vclinks/shared';
import { C } from '../../src/db/db.service';
import { DEFAULT_TENANT } from '../../src/db/tenant-context';
import { TENANT_FIELD } from '../../src/db/tenant-collection';
import { startE2EApp, type E2EApp } from './helpers';

// Gate M1b-12: with CUSTOMER_ENCRYPTION off, a re-sync from the extension must not write back plaintext
// content of an erased customer (erased_subjects, or a customer profile stamped erasedAt).
describe('erased customers stay erased on re-ingest, encryption off (e2e)', () => {
  const UID = 'zuid_erased_off';
  const P = 'peerErased';
  const Q = 'peerKept';
  const R = 'peerProfileErased';
  let t: E2EApp;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const k of ['CUSTOMER_ENCRYPTION', 'CUSTOMER_KEK', 'ERASURE_LEDGER_DB']) saved[k] = process.env[k];
    process.env.CUSTOMER_ENCRYPTION = '0';
    delete process.env.CUSTOMER_KEK;
    process.env.ERASURE_LEDGER_DB = `vclinks_test_ledger_${randomBytes(4).toString('hex')}`;
    t = await startE2EApp();
  });

  afterAll(async () => {
    if (t) {
      await t.db.db.client.db(process.env.ERASURE_LEDGER_DB!).dropDatabase();
      await t.close();
    }
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  const http = () => request(t.app.getHttpServer());
  const msg = (peer: string, i: number, text: string, cliMsgId?: string) => ({
    msgId: `${peer}-${i}`,
    ...(cliMsgId ? { cliMsgId } : {}),
    threadId: peer,
    fromUid: peer,
    toUid: UID,
    msgType: 'webchat',
    text,
    sentAt: 1727600000000 + i,
  });
  const push = (items: unknown[]) => http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: UID, items }).expect(200);
  const raw = (peer: string) => t.db.unscoped(C.messages).find({ uid: UID, threadId: peer }).toArray();

  it('setup: plaintext stored while nobody is erased', async () => {
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: UID, label: 'Nick xóa' }).expect(201);
    await http()
      .post('/api/ingest/conversations')
      .set(t.auth.ingest)
      .send({ uid: UID, items: [P, Q, R].map((p) => ({ threadId: p, type: 'user', lastMsgAt: 1727600009000 })) })
      .expect(200);
    await push([msg(P, 1, 'Bí mật P một', '1727600000001'), msg(Q, 1, 'Tin Q giữ'), msg(R, 1, 'Bí mật R một')]);
    expect((await raw(P))[0].text).toBe('Bí mật P một');
  });

  it('erased identity (erased_subjects): re-pushed, new and DOM content are stored as the placeholder', async () => {
    await http().post('/api/security/erase').set(t.auth.dashboard).send({ identityId: `${UID}:${P}`, confirm: true }).expect(200);
    expect((await raw(P))[0]).toMatchObject({ text: ERASED_TEXT, erased: true });

    // The extension re-syncs the same message, then a new one arrives.
    await push([msg(P, 1, 'Bí mật P một', '1727600000001'), msg(P, 2, 'Bí mật P hai', '1727600000002'), msg(Q, 2, 'Tin Q mới')]);
    // DOM capture of the same bubbles (Zalo path).
    await http()
      .post('/api/ingest/message-content')
      .set(t.auth.ingest)
      .send({ uid: UID, items: [{ cliMsgId: '1727600000001', capturedAt: 1727600000101, text: 'Bí mật P một (DOM)' }] })
      .expect(200);

    const docs = await raw(P);
    expect(docs).toHaveLength(2);
    for (const d of docs) expect(d).toMatchObject({ text: ERASED_TEXT, erased: true });
    expect(JSON.stringify(docs)).not.toContain('Bí mật');

    // Other customers keep their content.
    expect((await raw(Q)).map((d) => d.text).sort()).toEqual(['Tin Q giữ', 'Tin Q mới']);
  });

  it('customer profile stamped erasedAt (M1b-12 link, not in erased_subjects): re-pushed content is scrubbed', async () => {
    const tenant = { [TENANT_FIELD]: DEFAULT_TENANT };
    const now = new Date();
    await t.db.unscoped('customer_accounts').insertOne({ _id: 'ca_gate_r', ...tenant, name: 'R', status: 'active', owners: [], erpLinks: [], erasedAt: now, erasedBy: 'gate' } as never);
    await t.db.unscoped('customer_contacts').insertOne({ _id: 'cc_gate_r', ...tenant, accountId: 'ca_gate_r', name: 'R', status: 'active', erasedAt: now } as never);
    await t.db
      .unscoped('identity_links')
      .insertOne({ _id: `${UID}:${R}`, ...tenant, identityId: `${UID}:${R}`, uid: UID, userId: R, channel: 'zalo', contactId: 'cc_gate_r', accountId: 'ca_gate_r', state: 'confirmed' } as never);

    await push([msg(R, 1, 'Bí mật R một'), msg(R, 2, 'Bí mật R hai')]);
    const docs = await raw(R);
    expect(docs).toHaveLength(2);
    for (const d of docs) expect(d).toMatchObject({ text: ERASED_TEXT, erased: true });
    expect(JSON.stringify(docs)).not.toContain('Bí mật');
    expect((await raw(Q)).every((d) => d.text !== ERASED_TEXT)).toBe(true);
  });
});
