import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import request from 'supertest';
import { SELF_EDIT_MESSAGE, TOKEN_TEXT } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { TokenService } from '../../src/auth/token.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-06: channel assignment, device tokens bound to nicks, personal MCP tokens (docs 01 MH-PQ-06 / 08 / 09).
 * UAT-PQ-50 (own MCP token), 51 (device bound to a nick), 52 (revoke), 66 (no MCP token made for others),
 * 75 (pairing, replace the old machine), 91 (nick awaiting confirmation).
 */
const NK = (n: string) => `90000000000${n}`;
const CUSTOMER = (uid: string) => `91${uid.slice(-4)}`;
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn', 'goc', null],
  ['DV-A', 'Division A', 'division', 'GOC'],
  ['DV-B', 'Division B', 'division', 'GOC'],
  ['TO-1', 'Tổ 1', 'to_ban_hang', 'DV-A'],
  ['CS-A', 'Nhóm CSKH A', 'nhom_cskh', 'DV-A'],
];
const USERS: [string, string, string, string][] = [
  ['U-AD', 'Quân Admin', 'admin', 'GOC'],
  ['U-GD', 'Thắng GĐ', 'giam_doc_bh', 'DV-A'],
  ['U-KD1', 'Minh NVKD', 'nvkd', 'TO-1'],
  ['U-KD2', 'Linh NVKD', 'nvkd', 'TO-1'],
  ['U-KD4', 'Hải NVKD', 'nvkd', 'TO-1'],
  ['U-CS', 'Thu CSKH', 'cskh', 'CS-A'],
  ['U-KDB', 'Lộc NVKD B', 'nvkd', 'DV-B'],
];

describe('tokens and channel assignment (e2e, M1b-06)', () => {
  let t: E2EApp;
  let baseUrl: string;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const saved = process.env.AUTHZ_DEFAULT_DIVISION;
  const clients: Client[] = [];
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const mcp = async (token: string) => {
    const c = new Client({ name: 'e2e', version: '1.0.0' });
    await c.connect(new StreamableHTTPClientTransport(new URL('/mcp', baseUrl), { requestInit: { headers: bearer(token) } }));
    clients.push(c);
    return c;
  };
  const tool = async (c: Client, name: string, args: Record<string, unknown> = {}) => {
    const r = await c.callTool({ name, arguments: args });
    return JSON.parse((r as { content: { text: string }[] }).content[0].text);
  };

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'DV-A';
    t = await startE2EApp();
    baseUrl = await t.app.getUrl();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : UNITS.find((u) => u[0] === parentId)![0] === 'DV-A' ? 'DV-A' : parentId,
        managerUserId: null, active: true, createdAt: now, updatedAt: now,
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
      await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid, items: [{ msgId: `m${uid.slice(-2)}`, threadId: c, fromUid: c, toUid: uid, senderName: 'Khách', msgType: 'webchat', text: `Hoàng Long hỏi giá ${uid.slice(-2)}`, sentAt: Date.now() }] }).expect(200);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
    }
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = saved;
    for (const c of clients) await c.close();
    await t?.close();
  });

  describe('UAT-PQ-50 / 66 / 52: personal MCP token', () => {
    let secret = '';
    let tokenId = '';

    it('is off by default (NT2): the person cannot create one', async () => {
      const r = await http().post('/api/settings/tokens').set(as['U-KD1']).send({ name: 'Claude Desktop', days: 30 }).expect(403);
      expect(r.body.message).toBe(TOKEN_TEXT.selfMcpOff);
      const list = await http().get('/api/settings/tokens').set(as['U-KD1']).expect(200);
      expect(list.body).toMatchObject({ canCreate: false, items: [] });
    });

    it('only an Admin switches it on, for a role', async () => {
      await http().put('/api/admin/token-settings').set(as['U-KD1']).send({ divisions: [], roles: ['nvkd'] }).expect(403);
      await http().put('/api/admin/token-settings').set(as['U-AD']).send({ divisions: [], roles: ['nvkd'] }).expect(200);
    });

    it('creates for himself, shows the string once, never again', async () => {
      const r = await http().post('/api/settings/tokens').set(as['U-KD1']).send({ name: 'Claude Desktop', days: 30, groups: ['doc'] }).expect(201);
      secret = r.body.secret;
      tokenId = r.body.id;
      expect(secret).toMatch(/^vcz_/);
      const list = await http().get('/api/settings/tokens').set(as['U-KD1']).expect(200);
      expect(JSON.stringify(list.body)).not.toContain(secret);
      expect(JSON.stringify(list.body)).not.toContain('"hash"');
      // Stored as sha256 only.
      const doc = (await t.db.col(C.apiTokens).findOne({ _id: tokenId as never })) as unknown as { hash: string; token?: string };
      expect(doc.hash).toHaveLength(64);
      expect(JSON.stringify(doc)).not.toContain(secret);
      // The request has no user field: an unknown key is refused.
      await http().post('/api/settings/tokens').set(as['U-KD1']).send({ name: 'Cho người khác', userId: 'U-KD2' }).expect(400);
    });

    it('MCP returns only his nick; phone masked; tools limited to read', async () => {
      const c = await mcp(secret);
      const names = (await c.listTools()).tools.map((x) => x.name).sort();
      expect(names).toEqual(['get_contact_profile', 'search_messages']);
      const hits = await tool(c, 'search_messages', { query: 'Hoàng Long' });
      expect(hits.items.map((i: { uid: string }) => i.uid)).toEqual([NK('01')]);
      const mine = await tool(c, 'get_contact_profile', { uid: NK('01'), userId: CUSTOMER(NK('01')) });
      expect(mine.phone).toBe('0900 *** 001');
      const other = await tool(c, 'get_contact_profile', { uid: NK('04'), userId: CUSTOMER(NK('04')) });
      expect(other.error).toBeDefined();
      // Calls are logged without content, on behalf of the owner.
      const log = await t.db.col(C.auditLog).findOne({ action: 'mcp.call', 'detail.tokenId': tokenId });
      expect(log).toMatchObject({ detail: { onBehalfOf: 'U-KD1', userId: 'U-KD1', targets: [`${NK('01')}:${CUSTOMER(NK('01'))}`] } }); // M1b-16: "Hoạt động của tôi" and the search by code read these
      expect(JSON.stringify(log)).not.toContain('Hoàng Long');
    });

    it('does not work on the Dashboard API', async () => {
      await http().get('/api/conversations').set(bearer(secret)).expect(403);
      await http().post('/api/ingest/messages').set(bearer(secret)).send({ uid: NK('01'), items: [] }).expect(403);
    });

    it('Admin sees it in the table without any string, but cannot make one for somebody else (UAT-PQ-66)', async () => {
      const list = await http().get('/api/admin/tokens').set(as['U-AD']).expect(200);
      const row = list.body.find((r: { id: string }) => r.id === tokenId);
      expect(row).toMatchObject({ kind: 'mcp_user', ownerName: 'Minh NVKD' });
      expect(JSON.stringify(list.body)).not.toContain(secret);
      const r = await http().post('/api/admin/tokens').set(as['U-AD']).send({ kind: 'mcp', userId: 'U-GD', name: 'Hộ người khác' }).expect(403);
      expect(r.body.message).toBe(TOKEN_TEXT.noAdminMcp);
      await http().get('/api/admin/tokens').set(as['U-KD1']).expect(403);
    });

    it('limits 3 live tokens per person', async () => {
      await http().post('/api/settings/tokens').set(as['U-KD1']).send({ name: 'Token hai', days: 30 }).expect(201);
      await http().post('/api/settings/tokens').set(as['U-KD1']).send({ name: 'Token ba', days: 30 }).expect(201);
      const r = await http().post('/api/settings/tokens').set(as['U-KD1']).send({ name: 'Token bốn', days: 30 }).expect(409);
      expect(r.body.message).toBe(TOKEN_TEXT.tooMany);
    });

    it('revoking stops it at once (401) and records who and why; nobody revokes another person\'s from his own page', async () => {
      await http().post(`/api/settings/tokens/${tokenId}/revoke`).set(as['U-KD4']).send({ reason: 'het_dung' }).expect(404);
      await http().post(`/api/admin/tokens/${tokenId}/revoke`).set(as['U-AD']).send({ reason: 'nghi_lo' }).expect(200);
      await http().post('/mcp').set(bearer(secret)).set('Accept', 'application/json, text/event-stream').send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).expect(401);
      const list = await http().get('/api/admin/tokens?status=revoked').set(as['U-AD']).expect(200);
      expect(list.body.find((r: { id: string }) => r.id === tokenId)).toMatchObject({ revokedReason: 'nghi_lo', revokedBy: 'Quân Admin' });
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'token.revoke', 'detail.tokenId': tokenId })).toBe(1);
    });

    it('an expired token is refused', async () => {
      const r = await http().post('/api/settings/tokens').set(as['U-KD2']).send({ name: 'Hết hạn', days: 30 }).expect(201);
      await t.db.col(C.apiTokens).updateOne({ _id: r.body.id as never }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
      t.app.get(TokenService).forgetCache();
      await http().post('/mcp').set(bearer(r.body.secret)).set('Accept', 'application/json, text/event-stream').send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).expect(401);
    });
  });

  describe('UAT-PQ-75 / 51 / 52: device token bound to a nick', () => {
    let dev = '';
    let devId = '';
    let old = '';

    const pair = async (uids: string[], extra: Record<string, unknown> = {}) => {
      const rq = await http().post('/api/devices/pairings').send({ deviceName: 'Chrome driver' }).expect(201);
      const ap = await http().post('/api/devices/pairings/approve').set(as['U-AD']).send({ code: rq.body.code, uids, ...extra });
      expect(ap.status).toBe(200);
      expect(ap.body).not.toHaveProperty('token');
      // Nothing secret waits in the database between approval and pickup.
      const stored = await t.db.col('device_pairings').findOne({ _id: rq.body.id as never });
      expect(JSON.stringify(stored)).not.toMatch(/vcz_/);
      const poll = await http().get(`/api/devices/pairings/${rq.body.id}`).query({ pollKey: rq.body.pollKey }).expect(200);
      expect(poll.body.status).toBe('approved');
      const again = await http().get(`/api/devices/pairings/${rq.body.id}`).query({ pollKey: rq.body.pollKey }).expect(200);
      expect(again.body.status).toBe('used');
      return poll.body.token as string;
    };

    it('wrong or expired code gives the standard text', async () => {
      const r = await http().post('/api/devices/pairings/approve').set(as['U-AD']).send({ code: '000000', uids: [] }).expect(404);
      expect(r.body.message).toBe(TOKEN_TEXT.pairingBad);
      await http().post('/api/devices/pairings/approve').set(as['U-KD1']).send({ code: '000000', uids: [] }).expect(403);
    });

    it('pairs by code: the token goes to the extension, bound to the chosen nick', async () => {
      old = await pair([NK('01')], { deviceName: 'Chrome driver 1' });
      const row = (await http().get('/api/admin/tokens').set(as['U-AD']).expect(200)).body.find((r: { kind: string; deviceName: string }) => r.kind === 'device' && r.deviceName === 'Chrome driver 1');
      devId = row.id;
      expect(row.uids).toEqual([NK('01')]);
      dev = old;
    });

    it('UAT-PQ-51: another nick is 403 on ingest and read; the outbox shows only its own commands', async () => {
      const bad = await http().post('/api/ingest/messages').set(bearer(dev)).send({ uid: NK('04'), items: [] }).expect(403);
      expect(bad.body.message).toBe(TOKEN_TEXT.deviceNotAssigned);
      await http().get('/api/conversations').set(bearer(dev)).expect(403);
      await http().get(`/api/checkpoints/${NK('04')}/messages`).set(bearer(dev)).expect(403);
      await http().get(`/api/checkpoints/${NK('01')}/messages`).set(bearer(dev)).expect(200);
      const q = (uid: string, id: string) => ({ uid, threadId: CUSTOMER(uid), text: `Tin ${id}` });
      await http().post('/api/outbox').set(as['U-KD1']).send(q(NK('01'), 'một')).expect(201);
      await t.db.col(C.suggestions).insertOne({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' as never, uid: NK('04'), threadId: CUSTOMER(NK('04')), status: 'approved', draft: 'x', finalText: 'Tin bốn', approvedBy: 'x', approvedAt: new Date(), createdAt: new Date() } as never);
      const pend = await http().get('/api/outbox/pending').set(bearer(dev)).expect(200);
      expect(pend.body.length).toBeGreaterThan(0);
      expect(pend.body.every((i: { uid: string }) => i.uid === NK('01'))).toBe(true);
      await http().get('/api/outbox/pending').query({ uid: NK('04') }).set(bearer(dev)).expect(403);
      await http().post('/api/outbox/aaaaaaaaaaaaaaaaaaaaaaaa/claim').set(bearer(dev)).expect(403);
    });

    it('"Thay máy cũ": the new machine works, the old one gets 401 at once', async () => {
      const fresh = await pair([NK('01')], { deviceName: 'Chrome driver 2', replaceTokenId: devId });
      await http().get(`/api/checkpoints/${NK('01')}/messages`).set(bearer(fresh)).expect(200);
      await http().get(`/api/checkpoints/${NK('01')}/messages`).set(bearer(old)).expect(401);
      dev = fresh;
    });

    it('revoking the device stops it (401) and records the reason', async () => {
      const list = (await http().get('/api/admin/tokens').set(as['U-AD']).expect(200)).body;
      const id = list.find((r: { deviceName: string; revokedAt: string | null }) => r.deviceName === 'Chrome driver 2' && !r.revokedAt).id;
      await http().post(`/api/admin/tokens/${id}/revoke`).set(as['U-AD']).send({ reason: 'thay_may' }).expect(200);
      await http().get(`/api/checkpoints/${NK('01')}/messages`).set(bearer(dev)).expect(401);
      await http().post(`/api/admin/tokens/${id}/revoke`).set(as['U-AD']).send({ reason: 'sai' }).expect(400);
    });

    it('a token the Admin made for a sending agent is bound to personal nicks that have a holder', async () => {
      const ok = await http().post('/api/admin/tokens').set(as['U-AD']).send({ kind: 'agent', name: 'Tác tử gửi NK01', uids: [NK('01')], days: 30 }).expect(201);
      const c = await mcp(ok.body.secret);
      expect((await c.listTools()).tools.map((x) => x.name).sort()).toEqual(['list_pending_suggestions', 'mark_sent']);
      expect((await tool(c, 'list_pending_suggestions', { uid: NK('04') })).error).toBeDefined();
      expect((await tool(c, 'list_pending_suggestions', { limit: 5 })).items.every((i: { uid: string }) => i.uid === NK('01'))).toBe(true);
      await http().post('/api/admin/tokens').set(as['U-AD']).send({ kind: 'agent', name: 'Tác tử sai', uids: ['zoa_x'], days: 30 }).expect(400);
    });
  });

  describe('UAT-PQ-91: nick registered by an unknown device waits for an Admin', () => {
    let dev = '';
    const NEW = '900000000099';

    it('is created pending, its data is stored but shown to nobody', async () => {
      const rq = await http().post('/api/devices/pairings').send({ deviceName: 'Laptop Linh' }).expect(201);
      await http().post('/api/devices/pairings/approve').set(as['U-AD']).send({ code: rq.body.code, uids: [NK('04')] }).expect(200);
      dev = (await http().get(`/api/devices/pairings/${rq.body.id}`).query({ pollKey: rq.body.pollKey }).expect(200)).body.token;
      const r = await http().post('/api/accounts').set(bearer(dev)).send({ uid: NEW, label: 'Zalo cá nhân Linh' }).expect(201);
      expect(r.body).toMatchObject({ pending: true });
      await http().post('/api/ingest/messages').set(bearer(dev)).send({ uid: NEW, items: [{ msgId: 'p1', threadId: '777', fromUid: '777', toUid: NEW, senderName: 'K', msgType: 'webchat', text: 'riêng tư', sentAt: Date.now() }] }).expect(200);
      // Not visible to anybody, not even TĐ / GĐ.
      for (const who of ['U-AD', 'U-GD', 'U-KD1']) {
        const acc = (await http().get('/api/accounts').set(as[who]).expect(200)).body as { uid: string }[];
        expect(acc.map((a) => a.uid)).not.toContain(NEW);
        const conv = (await http().get('/api/conversations').set(as[who]).expect(200)).body as { items: { id: string }[] };
        expect(conv.items.map((i) => i.id).join()).not.toContain(NEW);
      }
      // An already declared nick it was not paired with is still refused.
      await http().post('/api/accounts').set(bearer(dev)).send({ uid: NK('01'), label: 'x' }).expect(403);
    });

    it('Admin sees counts (no content); a GĐ does not confirm; reject deletes and cuts the device off', async () => {
      const list = (await http().get('/api/admin/channel-access/pending').set(as['U-AD']).expect(200)).body;
      expect(list).toEqual([expect.objectContaining({ uid: NEW, records: 1, deviceName: expect.stringContaining('Laptop Linh') })]);
      expect(JSON.stringify(list)).not.toContain('riêng tư');
      await http().post(`/api/admin/channel-access/${NEW}/reject`).set(as['U-GD']).send({ reason: 'Không phải nick công ty' }).expect(403);
      await http().post(`/api/admin/channel-access/${NEW}/reject`).set(as['U-AD']).send({ reason: 'ngắn' }).expect(400);
      const r = await http().post(`/api/admin/channel-access/${NEW}/reject`).set(as['U-AD']).send({ reason: 'Không phải nick công ty' }).expect(200);
      expect(r.body.message).toBe('Đã từ chối nick Zalo cá nhân Linh và xóa 1 bản ghi đã nhận.');
      expect(await t.db.col(C.messages).countDocuments({ uid: NEW })).toBe(0);
      expect(await t.db.col(C.accounts).countDocuments({ _id: NEW } as never)).toBe(0);
      await http().post('/api/ingest/messages').set(bearer(dev)).send({ uid: NEW, items: [] }).expect(403);
      const log = await t.db.col(C.auditLog).findOne({ action: 'channel.reject', target: NEW });
      expect(JSON.stringify(log)).not.toContain('riêng tư');
    });

    it('confirm moves it into a division with a holder and the data appears by permission', async () => {
      const rq = await http().post('/api/devices/pairings').send({ deviceName: 'Laptop Hải' }).expect(201);
      await http().post('/api/devices/pairings/approve').set(as['U-AD']).send({ code: rq.body.code, uids: [NK('04')] }).expect(200);
      const d2 = (await http().get(`/api/devices/pairings/${rq.body.id}`).query({ pollKey: rq.body.pollKey }).expect(200)).body.token;
      await http().post('/api/accounts').set(bearer(d2)).send({ uid: '900000000098', label: 'Nick Hải riêng' }).expect(201);
      const r = await http().post('/api/admin/channel-access/900000000098/confirm').set(as['U-AD']).send({ divisionId: 'DV-A', holderUserId: 'U-KD2' }).expect(200);
      expect(r.body.message).toBe('Đã xác nhận nick Nick Hải riêng vào Division A.');
      const acc = (await http().get('/api/accounts').set(as['U-KD2']).expect(200)).body as { uid: string }[];
      expect(acc.map((a) => a.uid)).toEqual(['900000000098']);
    });
  });

  describe('MH-PQ-06: channel assignment', () => {
    it('lists channels with holders; a NVKD cannot open the screen', async () => {
      const r = await http().get('/api/admin/channel-access').set(as['U-AD']).expect(200);
      const nick = r.body.items.find((i: { uid: string }) => i.uid === NK('01'));
      expect(nick).toMatchObject({ holderName: 'Minh NVKD' });
      await http().get('/api/admin/channel-access').set(as['U-KD1']).expect(403);
    });

    it('a holder is exactly one person: replacing needs "replace" and a reason; removing is refused', async () => {
      const body = { principalType: 'user', principalId: 'U-KD2', level: 'giu_nick' };
      const c1 = await http().post(`/api/admin/channel-access/${NK('01')}`).set(as['U-AD']).send(body).expect(409);
      expect(c1.body.message).toContain('Đổi người giữ nick');
      await http().post(`/api/admin/channel-access/${NK('01')}?replace=1`).set(as['U-AD']).send(body).expect(400);
      await http().post(`/api/admin/channel-access/${NK('01')}?replace=1`).set(as['U-AD']).send({ ...body, note: 'Minh chuyển sang tổ khác' }).expect(201);
      const holders = await t.db.col('channel_access').find({ channelId: NK('01'), level: 'giu_nick' }).toArray();
      expect(holders.map((h) => h.principalId)).toEqual(['U-KD2']);
      const rm = await http().delete(`/api/admin/channel-access/${NK('01')}/${encodeURIComponent(`${NK('01')}:user:U-KD2:giu_nick`)}`).set(as['U-AD']).expect(409);
      expect(rm.body.message).toBe('Chọn người giữ nick mới thay vì gỡ.');
      // The new holder reads the nick, the old one no longer does.
      expect(((await http().get('/api/accounts').set(as['U-KD2']).expect(200)).body as { uid: string }[]).map((a) => a.uid)).toContain(NK('01'));
      expect(((await http().get('/api/accounts').set(as['U-KD1']).expect(200)).body as unknown[]).length).toBe(0);
    });

    it('PQ-41: nobody assigns himself; role limits; no cross-division', async () => {
      const self = await http().post(`/api/admin/channel-access/${NK('04')}?replace=1`).set(as['U-AD']).send({ principalType: 'user', principalId: 'U-AD', level: 'giu_nick', note: 'Tự gán cho mình' }).expect(403);
      expect(self.body.message).toBe(SELF_EDIT_MESSAGE);
      const cs = await http().post(`/api/admin/channel-access/${NK('04')}?replace=1`).set(as['U-AD']).send({ principalType: 'user', principalId: 'U-CS', level: 'giu_nick', note: 'CSKH không giữ nick' }).expect(400);
      expect(cs.body.message).toContain('không nhận mức');
      const cross = await http().post(`/api/admin/channel-access/${NK('04')}?replace=1`).set(as['U-AD']).send({ principalType: 'user', principalId: 'U-KDB', level: 'giu_nick', note: 'Chéo division thử' }).expect(409);
      expect(cross.body.message).toContain('division khác');
      await http().post(`/api/admin/channel-access/${NK('04')}`).set(as['U-AD']).send({ principalType: 'user', principalId: 'U-CS', level: 'gui' }).expect(400);
    });

    it('official channel: unit with "gui", edit the end date, remove', async () => {
      const OA = 'zoa_9000000000101';
      await t.db.col(C.accounts).insertOne({ _id: OA, label: 'OA A', channel: 'zalo_oa' } as never);
      t.app.get(AuthzService).invalidate();
      const add = await http().post(`/api/admin/channel-access/${OA}`).set(as['U-AD']).send({ principalType: 'org_unit', principalId: 'CS-A', level: 'gui' }).expect(201);
      expect(add.body.message).toContain('OA A');
      await http().post(`/api/admin/channel-access/${OA}`).set(as['U-AD']).send({ principalType: 'org_unit', principalId: 'CS-A', level: 'giu_nick' }).expect(400);
      await http().patch(`/api/admin/channel-access/${OA}/${encodeURIComponent(add.body.id)}`).set(as['U-AD']).send({ to: new Date(Date.now() + 86400000).toISOString() }).expect(200);
      await http().delete(`/api/admin/channel-access/${OA}/${encodeURIComponent(add.body.id)}`).set(as['U-AD']).expect(200);
      expect(await t.db.col('channel_access').countDocuments({ channelId: OA })).toBe(0);
    });
  });

  it('legacy tokens (no kind) keep working: the existing Chrome driver token is not bound', async () => {
    const legacy = await t.app.get(TokenService).create('Chrome driver - extension', ['ingest']);
    await http().get(`/api/checkpoints/${NK('04')}/messages`).set(bearer(legacy)).expect(200);
    await http().get(`/api/checkpoints/${NK('01')}/messages`).set(bearer(legacy)).expect(200);
  });
});
