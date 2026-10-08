import request from 'supertest';
import type { AccountHealth, ErpSearchRow, MySession, SlaSettingsList } from '@vclinks/shared';
import { SessionService, deviceOf } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { slaConfigFor } from '../../src/conversations/inbox-state';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * Fixes of the 06/10/2026 system check (docs/05-kiem-thu/uat/2026-10-06/bo-test-toan-he-thong.md): "SLA và giờ làm
 * việc" per division (config.sla: the sales director edits their division, Admin reads), "Phiên đăng nhập" with
 * sign-out on the server, manual VCsales search for "Liên kết mã KH", and the máy Zalo mode in the nick health.
 */
const VCP = 'TD-DV-VCP';
const VCE = 'TD-DV-VCE';
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  [VCP, 'Division VCparts', 'division', 'GOC'],
  [VCE, 'Division VCe', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', VCP],
];
const USERS: [string, string, string, string][] = [
  ['TD-U-AD', 'Admin hệ thống', 'admin', 'GOC'],
  ['TD-U-GD', 'Giám đốc VCparts', 'giam_doc_bh', VCP],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
];
const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('settings and sessions after the system check (e2e)', () => {
  let t: E2EApp;
  const as: Record<string, { Authorization: string }> = {};
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : VCP, managerUserId: null, active: true, createdAt: now, updatedAt: now,
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
    await t?.close();
  });

  const weekday = (from: string, to: string) => [[from, to]];
  const body = (minutes: number) => ({
    slaMinutes: minutes,
    warnRatio: 0.3,
    calendar: { weekdays: { '1': weekday('08:00', '17:00'), '2': weekday('08:00', '17:00'), '3': weekday('08:00', '17:00'), '4': weekday('08:00', '17:00'), '5': weekday('08:00', '17:00') }, holidays: ['2026-12-31'] },
  });

  it('SLA: the sales director edits their division only; Admin reads everything; others have no access', async () => {
    const gd = (await http().get('/api/admin/sla-settings').set(as['TD-U-GD']!).expect(200)).body as SlaSettingsList;
    expect(gd.divisions.map((d) => [d.divisionId, d.canEdit])).toEqual([[VCP, true]]);
    expect(gd.defaultIsBuiltIn).toBe(true);
    expect(gd.divisions[0]).toMatchObject({ own: false, config: { slaMinutes: 15 } });

    const admin = (await http().get('/api/admin/sla-settings').set(as['TD-U-AD']!).expect(200)).body as SlaSettingsList;
    expect(admin.divisions.map((d) => [d.divisionName, d.canEdit])).toEqual([
      ['Division VCe', false],
      ['Division VCparts', false],
    ]);
    await http().put(`/api/admin/sla-settings/${VCP}`).set(as['TD-U-AD']!).send(body(30)).expect(403);
    await http().get('/api/admin/sla-settings').set(as['TD-U-KD1']!).expect(403);
    await http().put(`/api/admin/sla-settings/${VCE}`).set(as['TD-U-GD']!).send(body(30)).expect(403);

    const saved = (await http().put(`/api/admin/sla-settings/${VCP}`).set(as['TD-U-GD']!).send(body(30)).expect(200)).body as SlaSettingsList;
    expect(saved.divisions[0]).toMatchObject({ own: true, updatedBy: 'TD-U-GD', config: { slaMinutes: 30, warnRatio: 0.3, calendar: { holidays: ['2026-12-31'] } } });
    // The inbox reads it at once (cache dropped on save).
    expect((await slaConfigFor(t.db, VCP)).slaMinutes).toBe(30);
    expect(await t.db.col(C.auditLog).findOne({ action: 'config.sla_update', target: VCP } as never)).toBeTruthy();

    await http()
      .put(`/api/admin/sla-settings/${VCP}`)
      .set(as['TD-U-GD']!)
      .send({ ...body(30), calendar: { weekdays: { '1': [['17:00', '08:00']] }, holidays: [] } })
      .expect(400);
    await http().put(`/api/admin/sla-settings/${VCP}`).set(as['TD-U-GD']!).send({ ...body(30), slaMinutes: 0 }).expect(400);

    const back = (await http().delete(`/api/admin/sla-settings/${VCP}`).set(as['TD-U-GD']!).expect(200)).body as SlaSettingsList;
    expect(back.divisions[0]).toMatchObject({ own: false, config: { slaMinutes: 15 } });
    expect((await slaConfigFor(t.db, VCP)).slaMinutes).toBe(15);
  });

  it('sessions: my sign-ins with the browser, sign out one, the others, and "Thoát" ends this one on the server', async () => {
    const sessions = t.app.get(SessionService);
    const user = { _id: 'TD-U-KD2', fullName: 'Trần Thùy Linh' };
    const here = await sessions.create(user, undefined, deviceOf(CHROME_WIN));
    const phone = await sessions.create(user, undefined, deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'));
    const auth = (tok: string) => ({ Authorization: `Bearer ${tok}` });

    const list = (await http().get('/api/auth/sessions').set(auth(here)).expect(200)).body as MySession[];
    expect(list.find((s) => s.current)).toMatchObject({ device: 'Chrome · Windows' });
    expect(list.map((s) => s.device)).toContain('Safari · iOS');
    const other = list.find((s) => s.device === 'Safari · iOS')!;

    // Someone else's session cannot be ended from here.
    const adminList = (await http().get('/api/auth/sessions').set(as['TD-U-AD']!).expect(200)).body as MySession[];
    await http().post(`/api/auth/sessions/${adminList[0]!.id}/revoke`).set(auth(here)).expect(404);

    await http().post(`/api/auth/sessions/${other.id}/revoke`).set(auth(here)).expect(200);
    await http().get('/api/me').set(auth(phone)).expect(401);

    const third = await sessions.create(user);
    expect((await http().post('/api/auth/sessions/revoke-others').set(auth(here)).expect(200)).body.revoked).toBeGreaterThanOrEqual(2);
    await http().get('/api/me').set(auth(third)).expect(401);
    await http().get('/api/me').set(auth(here)).expect(200);

    await http().post('/api/auth/logout').set(auth(here)).expect(200);
    await http().get('/api/me').set(auth(here)).expect(401);
    // A device token is not a dashboard sign-in.
    await http().get('/api/auth/sessions').set(t.auth.ingest).expect(403);
  });

  it('Liên kết mã KH: VCsales search by code or name, phones masked, at least 3 characters', async () => {
    const byCode = (await http().get('/api/customers/erp-search').query({ q: 'KH-TEST-0101' }).set(t.auth.dashboard).expect(200)).body as ErpSearchRow[];
    expect(byCode).toEqual([expect.objectContaining({ code: 'KH-TEST-0101', name: 'Garage Minh Phát' })]);
    expect(byCode[0]!.phones.length).toBeGreaterThan(0);
    for (const p of byCode[0]!.phones) expect(p).toMatch(/\*\*\*/);
    const byName = (await http().get('/api/customers/erp-search').query({ q: 'minh phat' }).set(t.auth.dashboard).expect(200)).body as ErpSearchRow[];
    expect(byName.map((r) => r.code)).toContain('KH-TEST-0101');
    expect((await http().get('/api/customers/erp-search').query({ q: 'ga' }).set(t.auth.dashboard).expect(200)).body).toEqual([]);
    await http().get('/api/customers/erp-search').query({ q: 'Garage' }).set(as['TD-U-KD1']!).expect(403);
  });

  it('nick health says how the máy Zalo runs it', async () => {
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: '9100000000321', label: 'Nick máy Zalo' }).expect(201);
    const health = async () => ((await http().get('/api/accounts/health').set(t.auth.dashboard).expect(200)).body as AccountHealth[]).find((h) => h.uid === '9100000000321')!;
    expect((await health()).farmMode).toBeNull();
    await t.db.col('zalo_slots').insertOne({ _id: 'zs_00000000000000aa', uid: '9100000000321', state: 'da_ket_noi', mode: 'direct' } as never);
    expect((await health()).farmMode).toBe('direct');
    await t.db.col('zalo_slots').updateOne({ _id: 'zs_00000000000000aa' } as never, { $set: { mode: 'browser' } });
    expect((await health()).farmMode).toBe('browser');
    await t.db.col('zalo_slots').updateOne({ _id: 'zs_00000000000000aa' } as never, { $set: { state: 'da_ngat' } });
    expect((await health()).farmMode).toBeNull();
  });
});
