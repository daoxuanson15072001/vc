import request from 'supertest';
import type { VcsalesHealthView, VcsalesStatusResponse } from '@vclinks/shared';
import type { MockVcsaleClient } from '@vclinks/vcsale-client';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { VCSALE_CLIENT } from '../../src/customers/customers.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * Quản trị → "Kết nối VCsales" (plan docs/01-quan-ly-du-an/ke-hoach-ket-noi-vcsales.md C5, C6): connection state
 * with outage time and recovery, and the matching of VCsales salespersons with VClinks users by e-mail.
 */
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
];
// Two of the six mock VCsales staff have a VClinks account (same e-mail, other case).
const USERS: [string, string, string, string, string][] = [
  ['VS-U-AD', 'Đặng Văn Quân', 'vs-u-ad@vcprosperous.com', 'admin', 'GOC'],
  ['VS-U-GD', 'Trịnh Văn Thắng', 'vs-u-gd@vcprosperous.com', 'giam_doc_bh', 'TD-DV-VCP'],
  ['VS-U-KD1', 'Nguyễn Văn Minh', 'minh.uat@vcprosperous.com', 'nvkd', 'TD-DV-HN1'],
  ['VS-U-KD2', 'Trần Thùy Linh', 'linh.uat@vcprosperous.com', 'nvkd', 'TD-DV-HN1'],
];

describe('Kết nối VCsales (e2e, plan C5 + C6)', () => {
  let t: E2EApp;
  let mock: MockVcsaleClient;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const status = async (who = 'VS-U-AD', refresh = false) =>
    (await http().get('/api/admin/vcsales').query(refresh ? { refresh: '1' } : {}).set(as[who]!).expect(200)).body as VcsalesStatusResponse;
  const ping = async () => (await http().post('/api/admin/vcsales/ping').set(as['VS-U-AD']!).expect(200)).body as VcsalesHealthView;

  beforeAll(async () => {
    t = await startE2EApp();
    mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : 'TD-DV-VCP', managerUserId: null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName, email]) => ({ _id: id, email, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    mock.down = false;
    await t?.close();
  });

  it('the first visit checks VCsales; the staff list says who is matched by e-mail and who is not', async () => {
    const r = await status();
    expect(r.health).toMatchObject({ mode: 'mock', ok: true, error: null, downSince: null, version: 'mock' });
    expect(Date.now() - Date.parse(r.health.checkedAt!)).toBeLessThan(10_000);
    expect(r.staff.error).toBeNull();
    expect(r.staff.counts).toEqual({ total: 6, matched: 2, no_user: 4, no_email: 0, duplicated_email: 0 });
    const minh = r.staff.rows.find((x) => x.email === 'minh.uat@vcprosperous.com')!;
    expect(minh).toMatchObject({ state: 'matched', user: { id: 'VS-U-KD1', fullName: 'Nguyễn Văn Minh' } });
    // Unmatched first: what the admin has to fix is on top.
    expect(r.staff.rows[0]!.state).toBe('no_user');
  });

  it('a VCsales outage: "Kiểm tra ngay" reports it with the time it started, the last staff list stays; then it recovers', async () => {
    const before = await status();
    mock.down = true;
    const down = await ping();
    expect(down).toMatchObject({ ok: false, error: expect.stringMatching(/VCsales/) });
    expect(down.downSince).toBe(down.checkedAt);
    expect(down.lastOkAt).toBe(before.health.lastOkAt);
    const again = await ping();
    expect(again.downSince).toBe(down.downSince);
    const r = await status('VS-U-AD', true);
    expect(r.health.ok).toBe(false);
    expect(r.staff.error).toMatch(/VCsales/);
    expect(r.staff.rows).toHaveLength(6);
    expect(r.staff.fetchedAt).toBe(before.staff.fetchedAt);
    mock.down = false;
    const up = await ping();
    expect(up).toMatchObject({ ok: true, error: null, downSince: null });
    expect(up.lastOkAt).toBe(up.checkedAt);
  });

  it('a new VClinks account with the e-mail of a VCsales salesperson is matched at the next visit', async () => {
    await t.db.col(C.users).insertOne({ _id: 'VS-U-KD3', email: 'hai.uat@vcprosperous.com', fullName: 'Phạm Văn Hải', status: 'cho_kich_hoat' } as never);
    const r = await status();
    expect(r.staff.counts.matched).toBe(3);
    expect(r.staff.rows.find((x) => x.email === 'hai.uat@vcprosperous.com')).toMatchObject({ state: 'matched', user: { id: 'VS-U-KD3', status: 'cho_kich_hoat' } });
  });

  it('the sales director reads it; a salesperson cannot', async () => {
    expect((await status('VS-U-GD')).staff.counts.total).toBe(6);
    await http().get('/api/admin/vcsales').set(as['VS-U-KD1']!).expect(403);
    await http().post('/api/admin/vcsales/ping').set(as['VS-U-KD1']!).expect(403);
  });
});
