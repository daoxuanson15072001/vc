import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { ERASED_TEXT } from '@vclinks/shared';
import { C } from '../../src/db/db.service';
import { runAsTenant, DEFAULT_TENANT } from '../../src/db/tenant-context';
import { reapplyErasures } from '../../src/scripts/reapply-erasures';
import { CUSTOMER_KEYS, CustomerKeysService, ERASED_SUBJECTS, type Sealed } from '../../src/security/customer-keys.service';
import { MessageVault } from '../../src/security/message-vault';
import { startE2EApp, type E2EApp } from './helpers';

// M1b-14 "Xác nhận xong" #2: destroying one customer's key makes his messages unreadable,
// other customers are not affected; a restored backup gets the erasure applied again.
describe('per-customer keys and erasure (e2e)', () => {
  const UID = 'zuid_keys';
  const A = 'peerA';
  const B = 'peerB';
  let t: E2EApp;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const k of ['CUSTOMER_ENCRYPTION', 'CUSTOMER_KEK', 'ERASURE_LEDGER_DB']) saved[k] = process.env[k];
    process.env.CUSTOMER_ENCRYPTION = '1';
    process.env.CUSTOMER_KEK = randomBytes(32).toString('base64');
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
  const texts = async (peer: string) => {
    const r = await http().get(`/api/conversations/${UID}:${peer}/messages`).set(t.auth.dashboard).expect(200);
    return (r.body.items as { text: string | null }[]).map((m) => m.text);
  };

  it('seals message content at rest and reads it back', async () => {
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: UID, label: 'Nick khóa' }).expect(201);
    await http()
      .post('/api/ingest/conversations')
      .set(t.auth.ingest)
      .send({ uid: UID, items: [A, B].map((p) => ({ threadId: p, type: 'user', lastMsgAt: 1727500009000 })) })
      .expect(200);
    const items = [A, B].flatMap((p, j) =>
      [1, 2].map((i) => ({
        msgId: `${p}-${i}`,
        threadId: p,
        fromUid: i === 1 ? p : '0',
        toUid: i === 1 ? UID : p,
        msgType: 'webchat',
        text: `Khách ${p} tin ${i}`,
        sentAt: 1727500000000 + j * 10 + i,
      })),
    );
    await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: UID, items }).expect(200);

    const raw = await t.db.unscoped(C.messages).find({ uid: UID }).toArray();
    expect(raw).toHaveLength(4);
    for (const m of raw) {
      expect(m.text).toBeUndefined();
      expect(m.sealed).toMatchObject({ v: 1, k: `${UID}:${m.threadId}` });
    }
    expect(JSON.stringify(raw)).not.toContain('Khách');
    expect(await t.db.unscoped(CUSTOMER_KEYS).countDocuments({ _id: { $in: [`${UID}:${A}`, `${UID}:${B}`] } as never })).toBe(2);
    // No key material in clear: the stored DEK is wrapped.
    expect(Object.keys((await t.db.unscoped(CUSTOMER_KEYS).findOne({}))!)).not.toContain('key');

    expect(await texts(A)).toEqual([`Khách ${A} tin 1`, `Khách ${A} tin 2`]);
    expect(await texts(B)).toEqual([`Khách ${B} tin 1`, `Khách ${B} tin 2`]);
  });

  it('re-ingest of the same messages keeps them sealed and readable (idempotent)', async () => {
    const items = [1, 2].map((i) => ({ msgId: `${A}-${i}`, threadId: A, fromUid: i === 1 ? A : '0', msgType: 'webchat', text: `Khách ${A} tin ${i}`, sentAt: 1727500000000 + i }));
    await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: UID, items }).expect(200);
    expect(await t.db.unscoped(C.messages).countDocuments({ uid: UID, text: { $exists: true } })).toBe(0);
    expect(await texts(A)).toEqual([`Khách ${A} tin 1`, `Khách ${A} tin 2`]);
  });

  it('seals content captured from the DOM after encrypted metadata (Zalo path), group sender keyed per member', async () => {
    const G = 'grp1';
    const CLI = '1789960000123';
    await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid: UID, items: [{ threadId: G, type: 'group', lastMsgAt: 1789960000123 }] }).expect(200);
    await http()
      .post('/api/ingest/messages')
      .set(t.auth.ingest)
      .send({ uid: UID, items: [{ msgId: 'g1', cliMsgId: CLI, threadId: G, fromUid: 'memberX', toUid: G, msgType: '1', sentAt: Number(CLI), encrypted: true, contentStatus: 'pending' }] })
      .expect(200);
    await http().post('/api/ingest/message-content').set(t.auth.ingest).send({ uid: UID, items: [{ cliMsgId: CLI, capturedAt: Number(CLI) + 5, text: 'Nội dung nhóm từ DOM' }] }).expect(200);
    const m = await t.db.unscoped(C.messages).findOne({ _id: `${UID}:g1` as never });
    expect(m?.text).toBeUndefined();
    expect(m?.sealed).toMatchObject({ k: `${UID}:memberX` });
    expect(await texts(G)).toEqual(['Nội dung nhóm từ DOM']);
  });

  it('refuses erasure without explicit confirmation', async () => {
    await http().post('/api/security/erase').set(t.auth.dashboard).send({ identityId: `${UID}:${A}` }).expect(400);
  });

  it('destroying the key of A makes only A unreadable', async () => {
    const keysSvc = t.app.get(CustomerKeysService);
    const sealedA = (await t.db.unscoped(C.messages).findOne({ _id: `${UID}:${A}-1` as never }))!.sealed as Sealed;
    const keyDocA = await t.db.unscoped(CUSTOMER_KEYS).findOne({ _id: `${UID}:${A}` as never });

    const r = await http().post('/api/security/erase').set(t.auth.dashboard).send({ identityId: `${UID}:${A}`, confirm: true }).expect(200);
    expect(r.body).toMatchObject({ subjects: 1, keysDestroyed: 1 });

    expect(await texts(A)).toEqual([ERASED_TEXT, ERASED_TEXT]);
    expect(await texts(B)).toEqual([`Khách ${B} tin 1`, `Khách ${B} tin 2`]);
    expect(await runAsTenant(DEFAULT_TENANT, () => keysSvc.open(sealedA))).toBeNull();

    // New content for an erased customer is never stored in clear.
    await http()
      .post('/api/ingest/messages')
      .set(t.auth.ingest)
      .send({ uid: UID, items: [{ msgId: `${A}-3`, threadId: A, fromUid: A, msgType: 'webchat', text: 'Tin mới của A', sentAt: 1727500000100 }] })
      .expect(200);
    const fresh = await t.db.unscoped(C.messages).findOne({ _id: `${UID}:${A}-3` as never });
    expect(fresh).toMatchObject({ text: ERASED_TEXT, erased: true });
    expect(JSON.stringify(fresh)).not.toContain('Tin mới');

    // Audit carries counts only.
    const audit = await t.db.unscoped(C.auditLog).findOne({ action: 'security.erase' });
    expect(audit?.detail).toMatchObject({ subjects: 1, keysDestroyed: 1 });

    // Simulate restoring a backup taken before the erasure: key back, erased list gone.
    await t.db.unscoped(CUSTOMER_KEYS).insertOne(keyDocA!);
    await t.db.unscoped(ERASED_SUBJECTS).deleteMany({});
    expect(await runAsTenant(DEFAULT_TENANT, () => keysSvc.open(sealedA))).not.toBeNull();

    const re = await runAsTenant(DEFAULT_TENANT, () => reapplyErasures(keysSvc, t.app.get(MessageVault)));
    expect(re).toMatchObject({ subjects: 1, keysDestroyed: 1 });
    expect(await runAsTenant(DEFAULT_TENANT, () => keysSvc.open(sealedA))).toBeNull();
    expect(await t.db.unscoped(ERASED_SUBJECTS).countDocuments({ _id: `${UID}:${A}` as never })).toBe(1);
    expect(await texts(B)).toEqual([`Khách ${B} tin 1`, `Khách ${B} tin 2`]);
  });

  it('with encryption off, erasure scrubs plaintext of that customer only', async () => {
    process.env.CUSTOMER_ENCRYPTION = '0';
    try {
      const P = 'peerC';
      const Q = 'peerD';
      await http()
        .post('/api/ingest/conversations')
        .set(t.auth.ingest)
        .send({ uid: UID, items: [P, Q].map((p) => ({ threadId: p, type: 'user', lastMsgAt: 1727500009000 })) })
        .expect(200);
      await http()
        .post('/api/ingest/messages')
        .set(t.auth.ingest)
        .send({ uid: UID, items: [P, Q].map((p, i) => ({ msgId: `${p}-1`, threadId: p, fromUid: p, msgType: 'webchat', text: `Rõ ${p}`, sentAt: 1727500001000 + i })) })
        .expect(200);
      expect(await texts(P)).toEqual([`Rõ ${P}`]);
      const r = await http().post('/api/security/erase').set(t.auth.dashboard).send({ identityId: `${UID}:${P}`, confirm: true }).expect(200);
      expect(r.body.scrubbed).toBe(1);
      expect(await texts(P)).toEqual([ERASED_TEXT]);
      expect(await texts(Q)).toEqual([`Rõ ${Q}`]);
    } finally {
      process.env.CUSTOMER_ENCRYPTION = '1';
    }
  });

  it('status shows counts, never key material', async () => {
    const r = await http().get('/api/security/status').set(t.auth.dashboard).expect(200);
    expect(r.body).toMatchObject({ encryptionEnabled: true, kekConfigured: true, erased: 2 });
    expect(JSON.stringify(r.body)).not.toContain(process.env.CUSTOMER_KEK!);
  });
});
