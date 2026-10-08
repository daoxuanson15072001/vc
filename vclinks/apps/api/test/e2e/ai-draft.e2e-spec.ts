import request from 'supertest';
import type { AiDraftMetrics, AiDraftView, OutboxItem } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { AI_DRAFTS } from '../../src/suggest/suggest.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1c-06 on the test data: AI drafts under the composer (KD-10, F7.3), mock AI (SUGGEST_MODE unset = mock).
 * "Xác nhận xong" #2: no path sends a draft without the user pressing "Gửi" — generating, rejecting and
 * linking never create an outbox item; only POST /api/outbox does, with approvedBy = the presser.
 */
const NK = (n: string) => `90000000000${n}`;
const DIV = 'TD-DV-VCP';
const MIN = 60_000;
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  [DIV, 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', DIV],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', DIV],
];
const MANAGERS: Record<string, string> = { [DIV]: 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1', 'TD-DV-HN2': 'TD-U-GS2' };
const USERS: [string, string, string, string, string][] = [
  ['TD-U-GS1', 'huong.uat@vcprosperous.com', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-KD1', 'minh.uat@vcprosperous.com', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD4', 'hai.uat@vcprosperous.com', 'Phạm Văn Hải', 'nvkd', 'TD-DV-HN2'],
];
const PRICE = '9101101'; // asks a price
const RISK = '9101102'; // asks for an OTP
const C3 = '9101103'; // debt figure in the chat
const STAFF = '9101104'; // a colleague (summary only)
const conv = (thread: string) => `${NK('01')}:${thread}`;
const enc = encodeURIComponent;

describe('AI drafts (e2e, M1c-06)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;
  const msg = async (thread: string, id: string, text: string, ago: number, fromUid = thread) =>
    http()
      .post('/api/ingest/messages')
      .set(t.auth.ingest)
      .send({ uid: NK('01'), items: [{ msgId: id, threadId: thread, fromUid, toUid: NK('01'), senderName: 'Khách', msgType: 'webchat', text, sentAt: Date.now() - ago * MIN }] })
      .expect(200);
  const outboxCount = () => t.db.col(C.suggestions).countDocuments({});
  const gen = (thread: string, who = 'TD-U-KD1') => http().post(`/api/conversations/${enc(conv(thread))}/ai-draft`).set(as[who]!);

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = DIV;
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : DIV,
        managerUserId: MANAGERS[id] ?? null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, email, fullName]) => ({ _id: id, email, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, , name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: NK('01'), label: 'Minh VCparts', ownerName: 'Chủ nick' }).expect(201);
    await t.db.col('channel_access').insertOne({ _id: `${NK('01')}:user:TD-U-KD1:giu_nick`, channelId: NK('01'), principalType: 'user', principalId: 'TD-U-KD1', level: 'giu_nick', createdBy: 'seed' } as never);
    for (const [thread, name] of [[PRICE, 'Anh Tuấn'], [RISK, 'Anh Lạ'], [C3, 'Anh Nợ'], [STAFF, 'Chị Kế toán']] as const) {
      await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid: NK('01'), items: [{ userId: thread, displayName: name }] }).expect(200);
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid: NK('01'), items: [{ threadId: thread, type: 'user', lastMsgAt: Date.now(), unread: 1 }] }).expect(200);
    }
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true, role: 'khach_hang' } });
    await t.db.col(C.contacts).updateOne({ _id: conv(STAFF) as never }, { $set: { role: 'nhan_vien' } });
    await msg(PRICE, 'p0', 'Dạ em chào anh', 10, '0');
    await msg(PRICE, 'p1', 'Cho anh hỏi giá má phanh 04465-0K290 còn hàng không em?', 5);
    await msg(RISK, 'r1', 'Em đọc giúp anh mã OTP vừa gửi về máy em với', 3);
    await msg(C3, 'c1', 'Công nợ của anh 12.500.000đ còn hạn không em?', 3);
    await msg(STAFF, 's1', 'Mai họp giao ban lúc 8h nhé em', 3);
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    await t?.close();
  });

  it('KD-10: the nick holder gets a draft with sources (VCsales with time, VCwiki), mock mode', async () => {
    const d = (await gen(PRICE).expect(200)).body as AiDraftView;
    expect(d).toMatchObject({ status: 'pending', action: 'draft', mode: 'mock', riskFlags: [] });
    expect(d.draft).toContain('1.250.000');
    const sale = d.sources.find((s) => s.type === 'vcsale');
    expect(sale?.at).toBeTruthy();
    expect(d.sources.some((s) => s.type === 'vcwiki')).toBe(true);
    const latest = (await http().get(`/api/conversations/${enc(conv(PRICE))}/ai-draft`).set(as['TD-U-KD1']!).expect(200)).body as AiDraftView;
    expect(latest.id).toBe(d.id);
  });

  it('generating never creates an outbox item and nothing is pending for the extension', async () => {
    expect(await outboxCount()).toBe(0);
    expect(await t.db.col(AI_DRAFTS).countDocuments({})).toBeGreaterThan(0);
    const pending = (await http().get(`/api/outbox/pending?uid=${NK('01')}`).set(t.auth.ingest).expect(200)).body;
    expect(JSON.stringify(pending)).not.toContain('1.250.000');
    expect(pending.items ?? pending).toHaveLength(0);
  });

  it('someone without the conversation in scope gets 403', async () => {
    await gen(PRICE, 'TD-U-KD4').expect(403);
    await http().get(`/api/conversations/${enc(conv(PRICE))}/ai-draft`).set(as['TD-U-KD4']!).expect(403);
  });

  it('OTP request: risk flag, no draft, no AI call', async () => {
    const d = (await gen(RISK).expect(200)).body as AiDraftView;
    expect(d).toMatchObject({ status: 'risk', draft: null, riskFlags: ['otp'] });
  });

  it('C3 in the chat: refused by the gate before the AI, logged without content', async () => {
    const d = (await gen(C3).expect(200)).body as AiDraftView;
    expect(d).toMatchObject({ status: 'blocked', draft: null });
    const log = await t.db.col(C.auditLog).findOne({ action: 'ai.gate_blocked' });
    expect(log).toBeTruthy();
    expect(JSON.stringify(log)).not.toContain('12.500.000');
  });

  it('summary_only role (staff): a summary, no draft', async () => {
    const d = (await gen(STAFF).expect(200)).body as AiDraftView;
    expect(d).toMatchObject({ status: 'summary', action: 'summary_only', draft: null });
  });

  it('only the user who pressed "Gửi" can link the sent item; the pair (draft, edited text) is kept', async () => {
    const d = (await http().get(`/api/conversations/${enc(conv(PRICE))}/ai-draft`).set(as['TD-U-KD1']!).expect(200)).body as AiDraftView;
    // A forged link before anything was sent: no such outbox item.
    await http().post(`/api/conversations/${enc(conv(PRICE))}/ai-draft/${d.id}/sent`).set(as['TD-U-KD1']!).send({ outboxId: '0123456789abcdef01234567' }).expect(404);
    const finalText = `${d.draft} Anh cần mấy bộ ạ?`;
    // "Dùng nháp" → edit → "Gửi": the normal outbox route, approvedBy = Minh.
    const item = (await http().post('/api/outbox').set(as['TD-U-KD1']!).send({ uid: NK('01'), threadId: PRICE, text: finalText }).expect(201)).body as OutboxItem;
    expect(item).toMatchObject({ approvedBy: 'TD-U-KD1' });
    expect(item.approvedAt).toBeTruthy();
    // The supervisor did not press Gửi: refused.
    const gs = await http().post(`/api/conversations/${enc(conv(PRICE))}/ai-draft/${d.id}/sent`).set(as['TD-U-GS1']!).send({ outboxId: item.id });
    expect([403, 409]).toContain(gs.status);
    const linked = (await http().post(`/api/conversations/${enc(conv(PRICE))}/ai-draft/${d.id}/sent`).set(as['TD-U-KD1']!).send({ outboxId: item.id }).expect(200)).body as AiDraftView;
    expect(linked.status).toBe('edited');
    const doc = await t.db.col(AI_DRAFTS).findOne({ outboxId: item.id });
    expect(doc).toMatchObject({ finalText, approvedBy: 'TD-U-KD1' });
    // Linking created nothing: exactly the one item Minh sent.
    expect(await outboxCount()).toBe(1);
    await http().post(`/api/conversations/${enc(conv(PRICE))}/ai-draft/${d.id}/sent`).set(as['TD-U-KD1']!).send({ outboxId: item.id }).expect(409);
  });

  it('"Bỏ", approval rate without edits, audit without draft text', async () => {
    const d1 = (await gen(PRICE).expect(200)).body as AiDraftView;
    await http().post(`/api/conversations/${enc(conv(PRICE))}/ai-draft/${d1.id}/reject`).set(as['TD-U-KD1']!).send({}).expect(200);
    const d2 = (await gen(PRICE).expect(200)).body as AiDraftView;
    const item = (await http().post('/api/outbox').set(as['TD-U-KD1']!).send({ uid: NK('01'), threadId: PRICE, text: d2.draft }).expect(201)).body as OutboxItem;
    expect((await http().post(`/api/conversations/${enc(conv(PRICE))}/ai-draft/${d2.id}/sent`).set(as['TD-U-KD1']!).send({ outboxId: item.id }).expect(200)).body.status).toBe('approved');
    const m = (await http().get('/api/ai-drafts/metrics').set(as['TD-U-KD1']!).expect(200)).body as AiDraftMetrics;
    expect(m).toMatchObject({ approved: 1, edited: 1, rejected: 1, risk: 1, blocked: 1 });
    expect(m.approvedUneditedRate).toBeCloseTo(1 / 3);
    const audits = await t.db.col(C.auditLog).find({ action: /^ai_draft\./ }).toArray();
    expect(audits.length).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(audits)).not.toMatch(/1\.250\.000|má phanh|OTP vừa gửi/);
  });

  it('a draft cannot be rejected or linked twice, and nothing sends without the user', async () => {
    const before = await outboxCount();
    const d = (await gen(PRICE).expect(200)).body as AiDraftView;
    await http().post(`/api/conversations/${enc(conv(PRICE))}/ai-draft/${d.id}/reject`).set(as['TD-U-KD1']!).send({}).expect(200);
    await http().post(`/api/conversations/${enc(conv(PRICE))}/ai-draft/${d.id}/reject`).set(as['TD-U-KD1']!).send({}).expect(409);
    expect(await outboxCount()).toBe(before);
    // Every outbox item carries the presser and the time (§12.1).
    const items = await t.db.col(C.suggestions).find({}).toArray();
    for (const it of items) {
      expect(it.approvedBy).toBe('TD-U-KD1');
      expect(it.approvedAt).toBeInstanceOf(Date);
    }
  });

  it('nick "Chưa an toàn": no draft is generated or returned (gate M1c-06)', async () => {
    await t.db.col(C.accounts).updateOne({ _id: NK('01') as never }, { $set: { safety: 'chua_an_toan' } });
    try {
      await gen(PRICE).expect(403);
      const latest = await http().get(`/api/conversations/${enc(conv(PRICE))}/ai-draft`).set(as['TD-U-KD1']!).expect(200);
      expect(latest.body?.id).toBeUndefined();
    } finally {
      await t.db.col(C.accounts).updateOne({ _id: NK('01') as never }, { $unset: { safety: '' } });
    }
  });
});
