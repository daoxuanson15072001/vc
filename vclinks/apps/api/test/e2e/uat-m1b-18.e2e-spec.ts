import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import request from 'supertest';
import { TOKEN_TEXT } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { HandoverService } from '../../src/handover/handover.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-18: the three UAT cases M1b-17 left failing.
 * UAT-PQ-70 "Tạo yêu cầu quyền hộ", UAT-PQ-72 drawer "Phạm vi ảnh hưởng", UAT-PQ-82 "Sắp nghỉ" => token reads only,
 * and the reminder on the expected last day.
 */
const NK = (n: string) => `90000000000${n}`;
const CUSTOMER = (uid: string) => `91${uid.slice(-4)}`;
const UNITS: [string, string, string, string | null, string | null][] = [
  ['GOC', 'Tập đoàn', 'goc', null, null],
  ['DV-A', 'Division A', 'division', 'GOC', 'U-GD'],
  ['TO-1', 'Tổ 1', 'to_ban_hang', 'DV-A', null],
  ['TO-2', 'Tổ 2', 'to_ban_hang', 'DV-A', null],
];
const USERS: [string, string, string, string][] = [
  ['U-AD', 'Quân Admin', 'admin', 'GOC'],
  ['U-GD', 'Thắng GĐ', 'giam_doc_bh', 'DV-A'],
  ['U-KD1', 'Minh NVKD', 'nvkd', 'TO-1'],
  ['U-KD2', 'Linh NVKD', 'nvkd', 'TO-1'],
  ['U-KD4', 'Hải NVKD', 'nvkd', 'TO-2'],
];

describe('M1b-18: PQ-70, PQ-72, PQ-82 (e2e)', () => {
  let t: E2EApp;
  let baseUrl: string;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const saved = process.env.AUTHZ_DEFAULT_DIVISION;
  const clients: Client[] = [];
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const conv = (uid: string) => `${uid}:${CUSTOMER(uid)}`;
  const SECRET_TEXT = 'Hoàng Long hỏi giá phanh';

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'DV-A';
    t = await startE2EApp();
    baseUrl = await t.app.getUrl();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId, manager]) => ({
        _id: id, code: id, name, type, parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : 'DV-A',
        managerUserId: manager, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = bearer(await sessions.create({ _id: id, fullName: name }));
    for (const [uid, holder] of [[NK('01'), 'U-KD1'], [NK('04'), 'U-KD4']]) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      const c = CUSTOMER(uid);
      await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid, items: [{ userId: c, displayName: `Khách ${c}`, phone: `0900000${uid.slice(-3)}` }] }).expect(200);
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid, items: [{ threadId: c, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
      await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid, items: [{ msgId: `m${uid.slice(-2)}`, threadId: c, fromUid: c, toUid: uid, senderName: 'Khách', msgType: 'webchat', text: SECRET_TEXT, sentAt: Date.now() }] }).expect(200);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
    }
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    t.app.get(AuthzService).invalidate();
    await http().put('/api/admin/token-settings').set(as['U-AD']).send({ divisions: [], roles: ['nvkd'] }).expect(200);
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = saved;
    for (const c of clients) await c.close();
    await t?.close();
  });

  describe('UAT-PQ-70: Tạo yêu cầu quyền hộ', () => {
    const body = { targetId: '', right: 'xem', durationHours: 24, reason: 'Hỗ trợ đối chiếu đơn hàng của khách' };
    let grantId = '';

    it('the check offers the button only when viewing is refused and somebody can approve', async () => {
      const r = await http().get('/api/admin/users/U-KD2/effective').query({ target: conv(NK('01')) }).set(as['U-AD']).expect(200);
      expect(r.body.results[0]).toMatchObject({ canRequestGrant: true, approverName: 'Thắng GĐ' });
      const own = await http().get('/api/admin/users/U-KD1/effective').query({ target: conv(NK('01')) }).set(as['U-AD']).expect(200);
      expect(own.body.results[0].canRequestGrant).toBe(false);
    });

    it('files a pending request in the name of the checked person, grants nothing, notifies him', async () => {
      body.targetId = conv(NK('01'));
      await http().post('/api/admin/users/U-KD2/grant-request').set(as['U-KD1']).send(body).expect(403);
      await http().post('/api/admin/users/U-KD2/grant-request').set(as['U-AD']).send({ ...body, reason: 'ngắn' }).expect(400);
      await http().post('/api/admin/users/U-NOBODY/grant-request').set(as['U-AD']).send(body).expect(404);
      const r = await http().post('/api/admin/users/U-KD2/grant-request').set(as['U-AD']).send(body).expect(201);
      grantId = r.body.id;
      expect(r.body).toMatchObject({ status: 'cho_duyet', approverId: 'U-GD' });
      const g = (await t.db.col('access_grants').findOne({ _id: grantId as never })) as unknown as Record<string, unknown>;
      expect(g).toMatchObject({ userId: 'U-KD2', requestedBy: 'U-AD', status: 'cho_duyet', approverId: 'U-GD' });
      // Still ✖: nothing was granted.
      const after = await http().get('/api/admin/users/U-KD2/effective').query({ target: conv(NK('01')) }).set(as['U-AD']).expect(200);
      expect(after.body.results[0].checks.find((c: { key: string }) => c.key === 'conv.view').allowed).toBe(false);
      expect(await t.db.col('notifications').countDocuments({ userId: 'U-KD2', kind: 'grant_on_behalf' })).toBe(1);
      // Same request twice is refused.
      await http().post('/api/admin/users/U-KD2/grant-request').set(as['U-AD']).send(body).expect(409);
    });

    it('the approver sees it; the Admin cannot approve it; the audit line has no reason text', async () => {
      await http().post(`/api/access-grants/${grantId}/approve`).set(as['U-AD']).send({}).expect(403);
      const log = await t.db.col(C.auditLog).findOne({ action: 'grant.request_on_behalf', target: conv(NK('01')) });
      expect(log).toMatchObject({ actor: 'user:U-AD', detail: { onBehalfOf: 'U-KD2' } });
      expect(JSON.stringify(log)).not.toContain('đối chiếu đơn hàng');
    });

    it('a director who would approve it himself cannot file it on behalf (no self-approval loop)', async () => {
      // U-KD4 sits in TO-2 (no manager): the approver for him is U-GD, so U-GD may not file it for him.
      const chk = await http().get('/api/admin/users/U-KD4/effective').query({ target: conv(NK('01')) }).set(as['U-GD']).expect(200);
      expect(chk.body.results[0]).toMatchObject({ canRequestGrant: false, approverName: 'Thắng GĐ' });
      expect(chk.body.results[0].checks[0].allowed).toBe(false);
      const r = await http().post('/api/admin/users/U-KD4/grant-request').set(as['U-GD']).send({ ...body, targetId: conv(NK('01')) }).expect(400);
      expect(r.body.message).toContain('không tự tạo rồi tự duyệt');
      expect(await t.db.col('access_grants').countDocuments({ userId: 'U-KD4', requestedBy: 'U-GD' })).toBe(0);
    });
  });

  describe('UAT-PQ-72: Phạm vi ảnh hưởng', () => {
    let tokenId = '';
    it('lists calls, conversations and IPs of a token, never the token or message text', async () => {
      const made = await http().post('/api/settings/tokens').set(as['U-KD1']).send({ name: 'Claude Desktop', days: 30, groups: ['doc'] }).expect(201);
      tokenId = made.body.id;
      const c = new Client({ name: 'e2e', version: '1.0.0' });
      await c.connect(new StreamableHTTPClientTransport(new URL('/mcp', baseUrl), { requestInit: { headers: bearer(made.body.secret) } }));
      clients.push(c);
      await c.callTool({ name: 'search_messages', arguments: { query: 'Hoàng Long' } });
      await c.callTool({ name: 'search_messages', arguments: { query: 'phanh' } });
      const r = await http().get(`/api/admin/tokens/${tokenId}/impact`).set(as['U-AD']).expect(200);
      expect(r.body).toMatchObject({ tokenId, name: 'Claude Desktop', ownerName: 'Minh NVKD', calls: 2, conversationCount: 1, conversations: [conv(NK('01'))] });
      expect(r.body.recent).toHaveLength(2);
      expect(r.body.recent[0].tool).toBe('search_messages');
      const text = JSON.stringify(r.body);
      expect(text).not.toContain(made.body.secret);
      expect(text).not.toContain(SECRET_TEXT);
    });
    it('only token managers; unknown token is 404', async () => {
      await http().get(`/api/admin/tokens/${tokenId}/impact`).set(as['U-KD1']).expect(403);
      await http().get('/api/admin/tokens/nope/impact').set(as['U-AD']).expect(404);
    });
  });

  describe('UAT-PQ-82: Sắp nghỉ => token reads only, reminder on the day', () => {
    let secret = '';
    let tokenId = '';
    it('before the flag, a person can hold an "Đề xuất" token', async () => {
      const list = await http().get('/api/settings/tokens').set(as['U-KD2']).expect(200);
      expect(list.body.canPropose).toBe(true);
      const r = await http().post('/api/settings/tokens').set(as['U-KD2']).send({ name: 'Token đề xuất', days: 30, groups: ['doc', 'de_xuat'] }).expect(201);
      secret = r.body.secret;
      tokenId = r.body.id;
      expect(((await t.db.col(C.apiTokens).findOne({ _id: tokenId as never })) as unknown as { groups: string[] }).groups).toEqual(['doc', 'de_xuat']);
    });

    it('setting the flag lowers the existing token to "Đọc" at once and blocks a new "Đề xuất"', async () => {
      await http().post('/api/admin/users/U-KD2/pre-leave').set(as['U-AD']).send({ expectedDate: '2026-10-18', reason: 'Đã nộp đơn xin nghỉ việc' }).expect(200);
      expect(((await t.db.col(C.apiTokens).findOne({ _id: tokenId as never })) as unknown as { groups: string[] }).groups).toEqual(['doc']);
      // The old string still works for reading (no 401), only the group changed.
      const c = new Client({ name: 'e2e', version: '1.0.0' });
      await c.connect(new StreamableHTTPClientTransport(new URL('/mcp', baseUrl), { requestInit: { headers: bearer(secret) } }));
      clients.push(c);
      const r = await http().post('/api/settings/tokens').set(as['U-KD2']).send({ name: 'Token mới', days: 30, groups: ['doc', 'de_xuat'] }).expect(403);
      expect(r.body.message).toBe(TOKEN_TEXT.preLeaveNoPropose);
      const list = await http().get('/api/settings/tokens').set(as['U-KD2']).expect(200);
      expect(list.body).toMatchObject({ canPropose: false, proposeReason: TOKEN_TEXT.preLeaveNoPropose });
      await http().post('/api/settings/tokens').set(as['U-KD2']).send({ name: 'Token chỉ đọc', days: 30, groups: ['doc'] }).expect(201);
      const audit = await t.db.col(C.auditLog).findOne({ action: 'user.pre_leave', target: 'U-KD2' });
      expect(audit).toMatchObject({ detail: { tokensLowered: 1 } });
    });

    it('on the expected last day the managers and Admin get one reminder a day (nothing is locked)', async () => {
      const day = new Date(Date.UTC(2026, 9, 18, 2, 0, 0)); // 09:00 Vietnam
      const h = t.app.get(HandoverService);
      const r1 = await h.processDue(day);
      expect(r1.preLeaveDue).toBe(2);
      const notes = await t.db.col('notifications').find({ kind: 'pre_leave_due:U-KD2' }).toArray();
      expect(notes.map((n) => n.userId).sort()).toEqual(['U-AD', 'U-GD']);
      expect(String(notes[0]!.title)).toContain('Linh NVKD');
      // The test clock is in the future: stamp the notices with it, as a real run would.
      await t.db.col('notifications').updateMany({ kind: 'pre_leave_due:U-KD2' }, { $set: { at: day } });
      expect((await h.processDue(new Date(day.getTime() + 3600_000))).preLeaveDue).toBe(0);
      expect((await t.db.col(C.users).findOne({ _id: 'U-KD2' as never }) as unknown as { status: string }).status).toBe('hoat_dong');
      // Before the day: nothing.
      await t.db.col('notifications').deleteMany({});
      expect((await h.processDue(new Date(Date.UTC(2026, 9, 17, 2, 0, 0)))).preLeaveDue).toBe(0);
    });
  });
});
