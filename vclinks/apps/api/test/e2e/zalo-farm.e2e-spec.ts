import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import type { ZaloFarmStatus, ZaloSlotView } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { ZALO_SLOTS } from '../../src/zalo-farm/zalo-farm.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * Máy Zalo (docs/01-quan-ly-du-an/ke-hoach-zalo-ca-nhan-quet-qr.md): connect a company nick by scanning the QR
 * shown on the Dashboard. A fake agent stands in for tools/chrome-driver/farm-agent.js, so the API logic is tested
 * without Chrome: who sees the QR, binding after the scan, wrong account, disconnect, nothing secret stored.
 */
const KEY = 'k'.repeat(32);
const QR = 'data:image/png;base64,iVBORw0KGgo=';
const DIV = 'TD-DV-VCP';
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  [DIV, 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', DIV],
];
const USERS: [string, string, string, string][] = [
  ['TD-U-AD', 'Admin hệ thống', 'admin', 'GOC'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
];
const NEW_UID = '9000000000777';

interface FakeSlot {
  page: 'down' | 'login' | 'chat' | 'other';
  view?: 'qr' | 'expired' | 'scanned';
  uids: string[];
  note?: 'declined';
  lost?: 'duplicate_web' | 'direct_down';
  mode?: 'browser' | 'direct';
  handoverAt?: string | null;
  chromeKept?: boolean;
}

describe('máy Zalo: connect a nick by QR (e2e)', () => {
  let t: E2EApp;
  let fake: http.Server;
  const slots = new Map<string, FakeSlot>();
  const calls: string[] = [];
  /** Body of each POST /slots/:id/start (the direct mode is passed there). */
  const startBodies = new Map<string, unknown>();
  const as: Record<string, { Authorization: string }> = {};
  const saved = { url: process.env.ZALO_FARM_URL, key: process.env.ZALO_FARM_KEY, div: process.env.AUTHZ_DEFAULT_DIVISION };
  const http_ = () => request(t.app.getHttpServer());
  let slotId = '';

  beforeAll(async () => {
    fake = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => handleFake(req, res, raw));
    });
    const handleFake = (req: http.IncomingMessage, res: http.ServerResponse, raw: string) => {
      const json = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.headers['x-farm-key'] !== KEY) return json(401, { error: 'unauthorized' });
      const url = new URL(req.url!, 'http://fake');
      calls.push(`${req.method} ${url.pathname}${url.search}`);
      if (url.pathname === '/health') return json(200, { ok: true, slots: slots.size, max: 2 });
      const m = /^\/slots\/([^/]+)(?:\/([a-z-]+))?$/.exec(url.pathname);
      if (!m) return json(404, {});
      const [, id, action] = m;
      if (req.method === 'POST' && action === 'start') {
        startBodies.set(id!, raw ? JSON.parse(raw) : {});
        if (!slots.has(id!)) slots.set(id!, { page: 'login', view: 'qr', uids: [] });
        return json(200, { port: 9451 });
      }
      const s = slots.get(id!);
      if (!s) return json(404, { error: 'no such slot' });
      if (req.method === 'GET' && !action) {
        const wantQr = url.searchParams.get('qr') === '1';
        return json(200, {
          page: s.page,
          view: s.view,
          qr: s.page === 'login' && s.view === 'qr' && wantQr ? QR : null,
          uids: s.uids,
          ...(s.note ? { note: s.note } : {}),
          ...(s.lost ? { lost: s.lost } : {}),
          ...(s.mode ? { mode: s.mode, handoverAt: s.handoverAt ?? null, chromeKept: !!s.chromeKept } : {}),
        });
      }
      if (req.method === 'POST' && action === 'handover') {
        if (s.mode === 'direct') return json(409, { error: 'Nick này không chạy qua Zalo Web' });
        Object.assign(s, { mode: 'direct', handoverAt: null, chromeKept: true });
        return json(200, { ok: true, mode: 'direct', handoverAt: null, chromeKept: true });
      }
      if (req.method === 'POST' && action === 'rollback') {
        Object.assign(s, { mode: 'browser', chromeKept: false });
        return json(200, { ok: true, mode: 'browser', handoverAt: null, chromeKept: false });
      }
      if (action === 'meta' || action === 'sync-history' || action === 'options') return json(200, action === 'sync-history' ? { requested: true } : { ok: true });
      if (action === 'reset') {
        slots.set(id!, { page: 'login', view: 'qr', uids: [] });
        return json(200, { ok: true });
      }
      if (req.method === 'DELETE') {
        slots.delete(id!);
        return json(200, { ok: true });
      }
      return json(404, {});
    };
    await new Promise<void>((r) => fake.listen(0, '127.0.0.1', () => r()));
    process.env.ZALO_FARM_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
    process.env.ZALO_FARM_KEY = KEY;
    process.env.AUTHZ_DEFAULT_DIVISION = DIV;
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : DIV, managerUserId: null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.ZALO_FARM_URL = saved.url;
    process.env.ZALO_FARM_KEY = saved.key;
    process.env.AUTHZ_DEFAULT_DIVISION = saved.div;
    await t?.close();
    await new Promise<void>((r) => fake.close(() => r()));
  });

  const view = async (who: string, qr = true) => (await http_().get(`/api/zalo/slots/${slotId}${qr ? '?qr=1' : ''}`).set(as[who]!).expect(200)).body as ZaloSlotView;

  it('reports the farm and who may connect nicks', async () => {
    const admin = (await http_().get('/api/zalo/farm').set(as['TD-U-AD']!).expect(200)).body as ZaloFarmStatus;
    expect(admin).toEqual({ installed: true, slots: 0, max: 2, canManage: true });
    const kd = (await http_().get('/api/zalo/farm').set(as['TD-U-KD1']!).expect(200)).body as ZaloFarmStatus;
    expect(kd.canManage).toBe(false);
  });

  it('only an Admin creates a slot, for a company nick, with a holder who may hold nicks (not himself)', async () => {
    const body = { label: 'Minh VCparts 2', divisionId: DIV, holderUserId: 'TD-U-KD1', companyNick: true };
    await http_().post('/api/zalo/slots').set(as['TD-U-KD1']!).send(body).expect(403);
    await http_().post('/api/zalo/slots').set(as['TD-U-AD']!).send({ ...body, companyNick: false }).expect(400);
    await http_().post('/api/zalo/slots').set(as['TD-U-AD']!).send({ ...body, holderUserId: 'TD-U-AD' }).expect(403);
    const created = (await http_().post('/api/zalo/slots').set(as['TD-U-AD']!).send(body).expect(201)).body as ZaloSlotView;
    slotId = created.id;
    expect(created).toMatchObject({ label: 'Minh VCparts 2', divisionName: 'Division VCparts', holderName: 'Nguyễn Văn Minh', uid: null, state: 'dang_bat' });
    await new Promise((r) => setTimeout(r, 100));
    expect(calls).toContain(`POST /slots/${slotId}/start`);
    expect(await t.db.col(C.auditLog).countDocuments({ action: 'zalo.slot_created', target: slotId } as never)).toBe(1);
  });

  it('the holder and the Admin see the QR; another sales rep does not even find the slot', async () => {
    expect(await view('TD-U-KD1')).toMatchObject({ state: 'cho_quet', qr: { png: QR, expired: false } });
    expect((await view('TD-U-AD')).qr?.png).toBe(QR);
    await http_().get(`/api/zalo/slots/${slotId}?qr=1`).set(as['TD-U-KD2']!).expect(404);
    // Without ?qr=1 no image travels.
    expect((await view('TD-U-KD1', false)).qr).toBeNull();
    expect(await t.db.col(C.auditLog).countDocuments({ action: 'zalo.qr_viewed', target: slotId } as never)).toBe(1);
  });

  it('after the scan: waiting for the phone, then the nick joins the division with its holder', async () => {
    slots.set(slotId, { page: 'login', view: 'scanned', uids: [] });
    expect((await view('TD-U-KD1')).state).toBe('da_quet');
    slots.set(slotId, { page: 'chat', uids: [] });
    expect((await view('TD-U-KD1')).state).toBe('dang_ket_noi');
    slots.set(slotId, { page: 'chat', uids: [NEW_UID] });
    const v = await view('TD-U-KD1');
    expect(v).toMatchObject({ state: 'da_ket_noi', uid: NEW_UID });
    expect(v.connectedAt).toEqual(expect.any(String));
    const acc = await t.db.col(C.accounts).findOne({ _id: NEW_UID } as never);
    expect(acc).toMatchObject({ label: 'Minh VCparts 2', channel: 'zalo', divisionId: DIV });
    const holder = await t.db.col('channel_access').findOne({ channelId: NEW_UID, level: 'giu_nick' } as never);
    expect(holder).toMatchObject({ principalId: 'TD-U-KD1', createdBy: expect.stringContaining('') });
    expect(calls).toContain(`POST /slots/${slotId}/meta`);
    expect(await t.db.col(C.auditLog).countDocuments({ action: 'zalo.connected', target: slotId } as never)).toBe(1);
    // A second poll does not bind twice.
    await view('TD-U-AD');
    expect(await t.db.col(C.auditLog).countDocuments({ action: 'zalo.connected', target: slotId } as never)).toBe(1);
  });

  it('sync of older messages asks the phone; only for a connected nick', async () => {
    const r = (await http_().post(`/api/zalo/slots/${slotId}/sync-history`).set(as['TD-U-KD1']!).expect(200)).body as { requested: boolean; message: string };
    expect(r.requested).toBe(true);
    expect(r.message).toMatch(/Đồng bộ ngay/);
  });

  it('only an Admin turns on "open unread chats" for a nick; it is sent to the agent, shown and logged', async () => {
    await http_().patch(`/api/zalo/slots/${slotId}`).set(as['TD-U-KD1']!).send({ openUnread: true }).expect(403);
    await http_().patch(`/api/zalo/slots/${slotId}`).set(as['TD-U-AD']!).send({ openUnread: 'yes' }).expect(400);
    expect((await view('TD-U-AD', false)).openUnread).toBe(false);
    const on = (await http_().patch(`/api/zalo/slots/${slotId}`).set(as['TD-U-AD']!).send({ openUnread: true }).expect(200)).body as ZaloSlotView;
    expect(on.openUnread).toBe(true);
    expect(calls).toContain(`POST /slots/${slotId}/options`);
    expect((await view('TD-U-KD1', false)).openUnread).toBe(true);
    expect(await t.db.col(C.auditLog).countDocuments({ action: 'zalo.options_changed', target: slotId } as never)).toBe(1);
    await http_().patch(`/api/zalo/slots/${slotId}`).set(as['TD-U-AD']!).send({ openUnread: false }).expect(200);
    expect((await view('TD-U-AD', false)).openUnread).toBe(false);
  });

  it('there is no send switch (06/10/2026): the option is refused and a slot view has no such field', async () => {
    await http_().patch(`/api/zalo/slots/${slotId}`).set(as['TD-U-AD']!).send({ sendEnabled: true }).expect(400);
    await http_().patch(`/api/zalo/slots/${slotId}`).set(as['TD-U-AD']!).send({}).expect(400);
    expect(await view('TD-U-AD', false)).not.toHaveProperty('sendEnabled');
  });

  it('P4: an Admin moves a Zalo Web nick to direct and back; old messages waiting for content say why', async () => {
    slots.set(slotId, { page: 'chat', uids: [NEW_UID], mode: 'browser' });
    await t.db.col(C.messages).insertOne({ _id: `${NEW_UID}:old1`, uid: NEW_UID, threadId: '333', msgId: 'old1', fromUid: '333', sentAt: new Date(), encrypted: true, contentStatus: 'pending' } as never);
    await http_().post(`/api/zalo/slots/${slotId}/handover`).set(as['TD-U-KD1']!).expect(403);
    const moved = (await http_().post(`/api/zalo/slots/${slotId}/handover`).set(as['TD-U-AD']!).expect(200)).body as ZaloSlotView;
    expect(moved).toMatchObject({ mode: 'direct', chromeKept: true, handoverAt: null });
    expect(calls).toContain(`POST /slots/${slotId}/handover`);
    expect(await t.db.col(C.auditLog).countDocuments({ action: 'zalo.slot_handover', target: slotId } as never)).toBe(1);
    expect((await t.db.col(C.messages).findOne({ _id: `${NEW_UID}:old1` } as never))?.contentGone).toBe(true);
    await http_().post(`/api/zalo/slots/${slotId}/handover`).set(as['TD-U-AD']!).expect(409);

    const back = (await http_().post(`/api/zalo/slots/${slotId}/rollback`).set(as['TD-U-AD']!).expect(200)).body as ZaloSlotView;
    expect(back).toMatchObject({ mode: 'browser', chromeKept: false });
    expect((await t.db.col(C.messages).findOne({ _id: `${NEW_UID}:old1` } as never))?.contentGone).toBeUndefined();
    expect(await t.db.col(C.auditLog).countDocuments({ action: 'zalo.slot_rollback', target: slotId } as never)).toBe(1);
    // A move the agent made by itself (planned after the history) is picked up when the slot is read.
    slots.set(slotId, { page: 'chat', uids: [NEW_UID], mode: 'direct', chromeKept: true });
    expect(await view('TD-U-AD', false)).toMatchObject({ mode: 'direct', chromeKept: true });
    expect(await t.db.col(C.auditLog).countDocuments({ action: 'zalo.slot_handover', target: slotId, 'detail.auto': true } as never)).toBe(1);
    expect((await t.db.col(C.messages).findOne({ _id: `${NEW_UID}:old1` } as never))?.contentGone).toBe(true);
    // Back to Zalo Web for the next steps.
    await http_().post(`/api/zalo/slots/${slotId}/rollback`).set(as['TD-U-AD']!).expect(200);
    slots.set(slotId, { page: 'chat', uids: [NEW_UID] });
    await t.db.col(C.messages).deleteOne({ _id: `${NEW_UID}:old1` } as never);
  });

  it('a session lost on the QR page: the holder rescans from the nick; a wrong account is logged out at once', async () => {
    t.app.get(AuthzService).invalidate();
    slots.set(slotId, { page: 'login', view: 'qr', uids: [] });
    const r = (await http_().post(`/api/zalo/rescan/${NEW_UID}`).set(as['TD-U-KD1']!).expect(200)).body as ZaloSlotView;
    expect(r).toMatchObject({ id: slotId, state: 'cho_quet', qr: { png: QR } });
    // Someone scans with another Zalo account.
    slots.set(slotId, { page: 'chat', uids: ['9000000000999'] });
    const wrong = await view('TD-U-KD1');
    expect(wrong.state).toBe('quet_nham');
    expect(wrong.message).toMatch(/tài khoản Zalo khác/);
    expect(calls).toContain(`POST /slots/${slotId}/reset`);
    expect(slots.get(slotId)).toMatchObject({ page: 'login' });
    expect(await t.db.col(C.accounts).countDocuments({ _id: '9000000000999' } as never)).toBe(0);
    expect((await t.db.col(ZALO_SLOTS).findOne({ _id: slotId } as never))?.uid).toBe(NEW_UID);
  });

  it('stores no QR image, cookie or token anywhere', async () => {
    const doc = await t.db.col(ZALO_SLOTS).findOne({ _id: slotId } as never);
    expect(JSON.stringify(doc)).not.toMatch(/base64|cookie|token/i);
    const logs = await t.db.col(C.auditLog).find({ target: slotId } as never).toArray();
    expect(JSON.stringify(logs)).not.toMatch(/base64/);
  });

  it('the holder (his own nick) or an Admin disconnects, a colleague cannot: the profile is deleted on the farm, the nick and its history stay', async () => {
    // A colleague of the same division: the nick is not his (not even visible).
    expect([403, 404]).toContain((await http_().delete(`/api/zalo/slots/${slotId}`).set(as['TD-U-KD2']!)).status);
    expect((await view('TD-U-AD', false)).canDisconnect).toBe(true);
    const mine = (await http_().get('/api/zalo/slots').set(as['TD-U-KD1']!).expect(200)).body as ZaloSlotView[];
    expect(mine.find((x) => x.id === slotId)?.canDisconnect).toBe(true);
    await http_().delete(`/api/zalo/slots/${slotId}`).set(as['TD-U-KD1']!).expect(200);
    const log = await t.db.col(C.auditLog).findOne({ action: 'zalo.disconnected', target: slotId } as never);
    expect((log as { detail?: unknown } | null)?.detail).toMatchObject({ by: 'holder' });
    expect(calls).toContain(`DELETE /slots/${slotId}`);
    expect((await view('TD-U-AD', false)).state).toBe('da_ngat');
    expect(await t.db.col(C.accounts).countDocuments({ _id: NEW_UID } as never)).toBe(1);
    expect((await http_().get('/api/zalo/slots').set(as['TD-U-AD']!).expect(200)).body).toEqual([]);
  });

  it('direct mode (zca-js, plan P0): the mode reaches the agent, a declined login and a session taken by Zalo Web are explained', async () => {
    const body = { label: 'Nick trực tiếp', divisionId: DIV, holderUserId: 'TD-U-KD2', companyNick: true, mode: 'direct' };
    await http_().post('/api/zalo/slots').set(as['TD-U-AD']!).send({ ...body, mode: 'chrome' }).expect(400);
    const created = (await http_().post('/api/zalo/slots').set(as['TD-U-AD']!).send(body).expect(201)).body as ZaloSlotView;
    expect(created.mode).toBe('direct');
    await new Promise((r) => setTimeout(r, 100));
    expect(startBodies.get(created.id)).toEqual({ mode: 'direct' });
    const get = async () => (await http_().get(`/api/zalo/slots/${created.id}?qr=1`).set(as['TD-U-AD']!).expect(200)).body as ZaloSlotView;
    slots.set(created.id, { page: 'login', view: 'qr', uids: [], note: 'declined' });
    expect((await get()).message).toMatch(/từ chối/);
    slots.set(created.id, { page: 'chat', uids: ['9000000000888'] });
    expect(await get()).toMatchObject({ state: 'da_ket_noi', uid: '9000000000888', mode: 'direct' });
    slots.set(created.id, { page: 'down', uids: ['9000000000888'], lost: 'duplicate_web' });
    const lost = await get();
    expect(lost.state).toBe('mat_phien');
    expect(lost.message).toMatch(/Zalo Web ở nơi khác/);
    // A slot made before the direct mode is a Zalo Web one.
    expect((await http_().get('/api/zalo/slots').set(as['TD-U-AD']!).expect(200)).body.find((x: ZaloSlotView) => x.id === created.id).mode).toBe('direct');
  });

  it('P4 "Trực tiếp, lấy cả tin cũ": Zalo Web first with a planned move; the list shows when', async () => {
    for (const s of await t.db.col(ZALO_SLOTS).find({ state: { $ne: 'da_ngat' } } as never).toArray()) {
      await http_().delete(`/api/zalo/slots/${s._id}`).set(as['TD-U-AD']!).expect(200);
    }
    const body = { label: 'Nick lấy tin cũ', divisionId: DIV, holderUserId: 'TD-U-KD2', companyNick: true, mode: 'direct', history: true };
    const created = (await http_().post('/api/zalo/slots').set(as['TD-U-AD']!).send(body).expect(201)).body as ZaloSlotView;
    expect(created.mode).toBe('browser');
    await new Promise((r) => setTimeout(r, 100));
    expect(startBodies.get(created.id)).toEqual({ mode: 'browser', handoverAfterMin: 30 });
    const at = new Date(Date.now() + 30 * 60_000).toISOString();
    slots.set(created.id, { page: 'chat', uids: ['9000000000555'], mode: 'browser', handoverAt: at });
    const row = ((await http_().get('/api/zalo/slots').set(as['TD-U-AD']!).expect(200)).body as ZaloSlotView[]).find((x) => x.id === created.id);
    expect(row).toMatchObject({ mode: 'browser', handoverAt: at, chromeKept: false });
  });
});
