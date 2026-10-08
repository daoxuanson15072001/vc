import request from 'supertest';
import { SELF_EDIT_MESSAGE, type AdminUser, type MePermissions, type RoleColumn } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * Custom roles (docs 01 PQ-06, PQ-42, MH-PQ-05, UAT-PQ-10, UAT-PQ-11): Admin copies a system role and only removes
 * or narrows scopes; holders get the narrowed rights; the base role is fixed; a held role cannot be deleted; a copy
 * of a sensitive role needs a second person; unit changes and the import keep the custom role.
 */
const NK = '9000000000011';
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', 'TD-DV-VCP'],
];
const USERS: [string, string, string | null, string | null][] = [
  ['TD-U-AD', 'Đặng Văn Quân', 'admin', 'GOC'],
  ['TD-U-QS', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-NEW', 'Vũ Thị Lan', null, null],
];

describe('custom roles (e2e, MH-PQ-05)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const saved = process.env.AUTHZ_DEFAULT_DIVISION;
  const roles = async () => (await http().get('/api/admin/roles').set(as['TD-U-AD']!).expect(200)).body.roles as RoleColumn[];
  const me = async (who: string) => (await http().get('/api/me/permissions').set(as[who]!).expect(200)).body as MePermissions;
  const user = async (id: string) => (await http().get(`/api/admin/users/${id}`).set(as['TD-U-AD']!).expect(200)).body as AdminUser;
  const sendQuote = () => http().post('/api/quotes/send').set(as['TD-U-NEW']!).send({ uid: NK, threadId: 'K1' });
  const intern = { name: 'NVKD thực tập', baseRole: 'nvkd', description: 'Nhân viên mới, chưa tự gửi báo giá', picks: { 'quote.send': [] } };

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : 'TD-DV-VCP', managerUserId: null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.filter(([, , role]) => role).map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    // The new person holds a nick with one customer thread (the quote route checks the chat first).
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: NK, label: 'Nick 11' }).expect(201);
    await t.db.col('channel_access').insertOne({ _id: `${NK}:user:TD-U-NEW:giu_nick`, channelId: NK, principalType: 'user', principalId: 'TD-U-NEW', level: 'giu_nick', createdBy: 'seed' } as never);
    await t.db.col(C.conversations).insertOne({ _id: `${NK}:K1`, uid: NK, threadId: 'K1', type: 'user', lastMsgAt: now, unread: 0 } as never);
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = saved;
    await t?.close();
  });

  it('UAT-PQ-11: the director reads the matrix but cannot create a role', async () => {
    const r = await http().get('/api/admin/roles').set(as['TD-U-GD']!).expect(200);
    expect(r.body.roles).toHaveLength(10);
    expect((r.body.roles as RoleColumn[]).every((x) => x.system)).toBe(true);
    await http().post('/api/admin/custom-roles').set(as['TD-U-GD']!).send(intern).expect(403);
  });

  it('refuses scopes wider than the base role and duplicate names', async () => {
    const wide = await http().post('/api/admin/custom-roles').set(as['TD-U-AD']!).send({ ...intern, picks: { 'conv.view': ['DV'] } }).expect(400);
    expect(wide.body.message).toContain('Vượt quyền của vai trò gốc NVKD.');
    const extra = await http().post('/api/admin/custom-roles').set(as['TD-U-AD']!).send({ ...intern, picks: { 'msg.delete': ['ALL'] } }).expect(400);
    expect(extra.body.message).toContain('Vượt quyền');
    await http().post('/api/admin/custom-roles').set(as['TD-U-AD']!).send({ ...intern, name: 'Kế toán' }).expect(409);
    await http().post('/api/admin/custom-roles').set(as['TD-U-AD']!).send({ ...intern, name: 'x' }).expect(400);
  });

  it('UAT-PQ-10: creates "NVKD thực tập" without "Gửi báo giá"', async () => {
    const r = await http().post('/api/admin/custom-roles').set(as['TD-U-AD']!).send(intern).expect(201);
    expect(r.body.message).toBe('Đã tạo vai trò NVKD thực tập.');
    expect(r.body.role).toMatchObject({ roleKey: 'tc_nvkd_thuc_tap', system: false, baseRole: 'nvkd', assignedCount: 0 });
    await http().post('/api/admin/custom-roles').set(as['TD-U-AD']!).send({ ...intern, name: 'nvkd THỰC TẬP' }).expect(409);
    const list = await roles();
    expect(list).toHaveLength(11);
    const col = list.find((x) => x.roleKey === 'tc_nvkd_thuc_tap')!;
    expect(col.permissions['quote.send']).toBeUndefined();
    expect(col.permissions['conv.view']).toEqual({ s: ['CT', 'NICK'] });
    const meta = await http().get('/api/admin/meta').set(as['TD-U-AD']!).expect(200);
    expect(meta.body.customRoles).toEqual([{ id: 'tc_nvkd_thuc_tap', name: 'NVKD thực tập', baseRole: 'nvkd', unitType: 'to_ban_hang', sensitive: false }]);
  });

  it('assigns it: the holder has the NVKD rights except "Gửi báo giá"', async () => {
    const bad = await http()
      .post('/api/admin/users/TD-U-NEW/assignments')
      .set(as['TD-U-AD']!)
      .send({ roleKey: 'cskh', customRoleId: 'tc_nvkd_thuc_tap', orgUnitId: 'TD-DV-HN1' })
      .expect(400);
    expect(bad.body.message).toContain('dựa trên');
    const r = await http()
      .post('/api/admin/users/TD-U-NEW/assignments')
      .set(as['TD-U-AD']!)
      .send({ roleKey: 'nvkd', customRoleId: 'tc_nvkd_thuc_tap', orgUnitId: 'TD-DV-HN1' })
      .expect(201);
    expect(r.body.applied).toBe(true);
    const u = await user('TD-U-NEW');
    expect(u.assignments).toEqual([expect.objectContaining({ roleKey: 'nvkd', customRoleId: 'tc_nvkd_thuc_tap', customRoleName: 'NVKD thực tập', orgUnitName: 'Tổ HN1' })]);
    const p = await me('TD-U-NEW');
    expect(p.roles).toEqual([expect.objectContaining({ roleKey: 'nvkd', customRoleId: 'tc_nvkd_thuc_tap', customRoleName: 'NVKD thực tập' })]);
    expect(p.permissions['conv.view']).toBeDefined();
    expect(p.permissions['quote.view']).toBeDefined();
    expect(p.permissions['quote.send']).toBeUndefined();
    await sendQuote().expect(403);
    // The user list filters by the custom role.
    const list = await http().get('/api/admin/users').query({ role: 'tc_nvkd_thuc_tap' }).set(as['TD-U-AD']!).expect(200);
    expect((list.body.items as AdminUser[]).map((x) => x.id)).toEqual(['TD-U-NEW']);
  });

  it('cannot delete a held role, cannot change its base; an edit applies to the holders', async () => {
    const del = await http().delete('/api/admin/custom-roles/tc_nvkd_thuc_tap').set(as['TD-U-AD']!).expect(409);
    expect(del.body.message).toBe('Còn 1 người đang có vai trò này.');
    const base = await http().put('/api/admin/custom-roles/tc_nvkd_thuc_tap').set(as['TD-U-AD']!).send({ ...intern, baseRole: 'giam_sat_bh' }).expect(400);
    expect(base.body.message).toBe('Không đổi được vai trò gốc sau khi tạo.');
    const r = await http()
      .put('/api/admin/custom-roles/tc_nvkd_thuc_tap')
      .set(as['TD-U-AD']!)
      .send({ ...intern, picks: { 'cust.view': ['CT'] } })
      .expect(200);
    expect(r.body.message).toBe('Đã lưu vai trò NVKD thực tập. Áp dụng cho 1 người.');
    const p = await me('TD-U-NEW');
    expect(p.permissions['quote.send']).toBeDefined();
    expect(p.permissions['cust.view']!.scopes).toEqual(['CT']);
    expect((await sendQuote()).status).not.toBe(403);
    const audit = await t.db.col<{ action: string; detail?: Record<string, unknown> }>(C.auditLog).find({ action: 'role.update' } as never).toArray();
    expect(audit.at(-1)?.detail).toMatchObject({ baseRole: 'nvkd', changedKeys: expect.arrayContaining(['quote.send', 'cust.view']) });
  });

  it('a change of unit keeps the custom role (never widened back to NVKD)', async () => {
    await http().post('/api/admin/users/TD-U-NEW/change-unit').set(as['TD-U-AD']!).send({ fromOrgUnitId: 'TD-DV-HN1', toOrgUnitId: 'TD-DV-HN2' }).expect(200);
    const u = await user('TD-U-NEW');
    expect(u.assignments).toEqual([expect.objectContaining({ roleKey: 'nvkd', customRoleId: 'tc_nvkd_thuc_tap', orgUnitId: 'TD-DV-HN2' })]);
  });

  it('PQ-42: a copy of a sensitive role waits for the second person', async () => {
    const r = await http()
      .post('/api/admin/custom-roles')
      .set(as['TD-U-AD']!)
      .send({ name: 'GĐ chỉ xem tổ', baseRole: 'giam_doc_bh', description: '', picks: { 'conv.view': ['TO'], 'conv.reply': [] } })
      .expect(201);
    const id = r.body.role.roleKey as string;
    const add = await http()
      .post('/api/admin/users/TD-U-KD1/assignments')
      .set(as['TD-U-AD']!)
      .send({ roleKey: 'giam_doc_bh', customRoleId: id, orgUnitId: 'TD-DV-VCP' })
      .expect(201);
    expect(add.body).toMatchObject({ applied: false, message: 'Vai trò GĐ chỉ xem tổ chờ Ban giám đốc / Kiểm soát duyệt.' });
    // Waiting requests count as holders.
    await http().delete(`/api/admin/custom-roles/${id}`).set(as['TD-U-AD']!).expect(409);
    const reqs = await http().get('/api/admin/role-requests').set(as['TD-U-QS']!).expect(200);
    const req = (reqs.body as { id: string; change: { customRoleId?: string; customRoleName?: string } }[]).find((x) => x.change.customRoleId === id)!;
    expect(req.change.customRoleName).toBe('GĐ chỉ xem tổ');
    await http().post(`/api/admin/role-requests/${req.id}/approve`).set(as['TD-U-QS']!).expect(200);
    const p = await me('TD-U-KD1');
    expect(p.roles.map((x) => x.customRoleName ?? x.roleKey).sort()).toEqual(['GĐ chỉ xem tổ', 'nvkd']);
    expect(p.permissions['conv.view']!.scopes).toEqual(expect.arrayContaining(['TO']));
    expect(p.permissions['conv.view']!.scopes).not.toContain('DV');
  });

  it('NT6: nobody edits a custom role they hold', async () => {
    const r = await http()
      .post('/api/admin/custom-roles')
      .set(as['TD-U-AD']!)
      .send({ name: 'Admin hạn chế', baseRole: 'admin', description: '', picks: { 'msg.delete': [] } })
      .expect(201);
    const id = r.body.role.roleKey as string;
    await t.db.col('role_assignments').insertOne({ _id: `TD-U-AD:${id}:GOC`, userId: 'TD-U-AD', roleKey: 'admin', customRoleId: id, orgUnitId: 'GOC', createdBy: 'seed', createdAt: new Date() } as never);
    const edit = await http().put(`/api/admin/custom-roles/${id}`).set(as['TD-U-AD']!).send({ name: 'Admin hạn chế', baseRole: 'admin', description: '', picks: {} }).expect(403);
    expect(edit.body.message).toBe(SELF_EDIT_MESSAGE);
  });

  it('import: the vai_tro column takes a custom role code (MH-PQ-15)', async () => {
    const csv = [
      'email,ho_ten,sdt_noi_bo,vai_tro,ma_don_vi,truong_nhom,tu_ngay,den_ngay,nick_giu,kenh_chinh_thuc,ly_do',
      'moi.tt@vcprosperous.com,Đỗ Văn Tâm,,tc_nvkd_thuc_tap,TD-DV-HN1,,,,,,',
      'moi.tt2@vcprosperous.com,Đỗ Văn Tú,,tc_khong_co,TD-DV-HN1,,,,,,',
    ].join('\n');
    const file = { fileName: 'nguoi-dung.csv', contentBase64: Buffer.from(csv, 'utf8').toString('base64') };
    const pre = await http().post('/api/admin/users/import/preview').set(as['TD-U-AD']!).send(file).expect(200);
    // Rows come back errors first; line 1 is the header.
    expect(Object.fromEntries(pre.body.rows.map((x: { line: number; outcome: string }) => [x.line, x.outcome]))).toEqual({ 2: 'them', 3: 'loi' });
    const ok = await http()
      .post('/api/admin/users/import')
      .set(as['TD-U-AD']!)
      .send({ ...file, contentBase64: Buffer.from(csv.split('\n').slice(0, 2).join('\n'), 'utf8').toString('base64') })
      .expect(200);
    expect(ok.body.summary).toContain('1 thêm mới');
    const a = await t.db.col<{ userId: string; customRoleId?: string; roleKey: string }>('role_assignments').findOne({ customRoleId: 'tc_nvkd_thuc_tap', orgUnitId: 'TD-DV-HN1' } as never);
    expect(a).toMatchObject({ roleKey: 'nvkd' });
  });
});
