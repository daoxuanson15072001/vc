import ExcelJS from 'exceljs';
import request from 'supertest';
import { SessionService } from '../../src/auth/session.service';
import { C } from '../../src/db/db.service';
import { PeopleService } from '../../src/org/people.service';
import { startE2EApp, type E2EApp } from './helpers';

// M1b-03: org tree, users, bulk import. Cases follow MH-PQ-01, 02, 03, 15 and UAT-PQ-7, 40, 63, 65, 81, 93.
describe('org tree, users and bulk import (e2e)', () => {
  let t: E2EApp;
  let sessions: SessionService;
  const http = () => request(t.app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  let ad: { Authorization: string }; // TD-U-AD, a real login session
  let qs: { Authorization: string }; // TD-U-QS
  const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
  const csv = (...lines: string[]) => b64('\uFEFF' + lines.join('\n') + '\n');
  const post = (url: string, body: unknown, h = ad) => http().post(url).set(h).send(body as object);

  async function unit(code: string, name: string, type: string, parentId: string) {
    const r = await post('/api/admin/org-units', { code, name, type, parentId }).expect(201);
    return r.body as { id: string };
  }

  beforeAll(async () => {
    t = await startE2EApp();
    sessions = t.app.get(SessionService);
    const users = t.db.col(C.users);
    await users.insertMany([
      { _id: 'TD-U-AD', email: 'quan.uat@vcprosperous.com', fullName: 'Đặng Văn Quân', status: 'hoat_dong' },
      { _id: 'TD-U-QS', email: 'vinh.uat@vcprosperous.com', fullName: 'Phan Quốc Vinh', status: 'hoat_dong' },
      { _id: 'TD-U-CT', email: 'dat.uat@vcprosperous.com', fullName: 'Lương Tiến Đạt', status: 'hoat_dong' },
    ] as never);
    ad = as(await sessions.create({ _id: 'TD-U-AD', fullName: 'Đặng Văn Quân' }));
    qs = as(await sessions.create({ _id: 'TD-U-QS', fullName: 'Phan Quốc Vinh' }));
    // The admin / controller roles themselves are seeded straight in the DB (the first Admin cannot approve himself).
    await t.db.col('role_assignments').insertMany([
      { _id: 'TD-U-QS:quan_sat:GOC', userId: 'TD-U-QS', roleKey: 'quan_sat', orgUnitId: 'GOC', createdBy: 'seed', createdAt: new Date() },
      { _id: 'TD-U-AD:admin:GOC', userId: 'TD-U-AD', roleKey: 'admin', orgUnitId: 'GOC', createdBy: 'seed', createdAt: new Date() },
    ] as never);
  });
  afterAll(async () => {
    await t?.close();
  });

  describe('org tree (MH-PQ-01)', () => {
    it('creates the root on first read and lists it', async () => {
      const r = await http().get('/api/admin/org-units').set(ad).expect(200);
      expect(r.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'GOC', type: 'goc', parentId: null })]));
    });

    it('builds division -> team -> sub-team and refuses wrong placement with the spec sentence', async () => {
      await unit('VCPARTS', 'Division VCparts', 'division', 'GOC');
      await unit('HN1', 'Tổ bán hàng HN1', 'to_ban_hang', 'VCPARTS');
      const sub = await unit('HN1-A', 'Tổ con HN1-A', 'to_ban_hang', 'HN1');
      expect(sub.id).toBe('HN1-A');
      const deep = await post('/api/admin/org-units', { code: 'HN1-A1', name: 'Tổ con cấp ba', type: 'to_ban_hang', parentId: 'HN1-A' }).expect(400);
      expect(JSON.stringify(deep.body)).toContain('một cấp tổ con');
      const wrong = await post('/api/admin/org-units', { name: 'Nhóm CSKH sai', type: 'nhom_cskh', parentId: 'HN1' }).expect(400);
      expect(wrong.body.message).toBe('Nhóm CSKH chỉ đặt dưới Division.');
      const team = await post('/api/admin/org-units', { name: 'Tổ sai', type: 'to_ban_hang', parentId: 'GOC' }).expect(400);
      expect(team.body.message).toBe('Tổ bán hàng chỉ đặt dưới Division hoặc Tổ bán hàng.');
      await post('/api/admin/org-units', { code: 'DUP', name: 'tổ bán hàng hn1', type: 'to_ban_hang', parentId: 'VCPARTS' }).expect(409);
      await unit('NHOM_CSKH', 'Nhóm CSKH VCparts', 'nhom_cskh', 'VCPARTS');
      await unit('VCEDU', 'Division VCedu', 'division', 'GOC');
      await unit('TVTS', 'Tổ Tư vấn tuyển sinh', 'to_ban_hang', 'VCEDU');
    });

    it('moves a unit (checks the target, reports who is affected) and refuses cycles', async () => {
      await unit('HN2', 'Tổ bán hàng HN2', 'to_ban_hang', 'VCPARTS');
      const moved = await post('/api/admin/org-units/HN2/move', { parentId: 'HN1' }).expect(200);
      expect(moved.body.unit.parentId).toBe('HN1');
      expect(moved.body.unit.divisionId).toBe('VCPARTS');
      await post('/api/admin/org-units/HN1/move', { parentId: 'HN2' }).expect(400);
      await post('/api/admin/org-units/HN2/move', { parentId: 'VCPARTS' }).expect(200);
    });

    it('"Ngừng" is refused while the unit has members, allowed when empty, and can be undone', async () => {
      const u = await post('/api/admin/users', {
        email: 'minh.uat@vcprosperous.com',
        fullName: 'Nguyễn Văn Minh',
        assignments: [{ roleKey: 'nvkd', orgUnitId: 'HN1' }],
      }).expect(201);
      expect(u.body.user.assignments).toHaveLength(1);
      const busy = await post('/api/admin/org-units/HN1/deactivate', {}).expect(409);
      expect(busy.body.message).toBe('Ngừng hoặc chuyển các đơn vị con trước.');
      const busy2 = await post('/api/admin/org-units/HN1-A/deactivate', {}).expect(200);
      expect(busy2.body.active).toBe(false);
      await post('/api/admin/org-units/HN1-A/reactivate', {}).expect(200);
      await post('/api/admin/users/' + u.body.user.id + '/assignments/' + encodeURIComponent('x'), {}).expect(404);
      // Member count shows in the list.
      const list = await http().get('/api/admin/org-units').set(ad).expect(200);
      expect(list.body.find((x: { id: string }) => x.id === 'HN1').memberCount).toBe(1);
    });
  });

  describe('users (MH-PQ-02, 03)', () => {
    it('UAT-PQ-07: NVKD at a CSKH group is refused with the exact sentence', async () => {
      const u = await post('/api/admin/users', { email: 'thu.uat@vcprosperous.com', fullName: 'Hoàng Thị Thu', assignments: [{ roleKey: 'cskh', orgUnitId: 'NHOM_CSKH' }] }).expect(201);
      const r = await post(`/api/admin/users/${u.body.user.id}/assignments`, { roleKey: 'nvkd', orgUnitId: 'NHOM_CSKH' }).expect(400);
      expect(r.body.message).toBe('Vai trò NVKD phải đặt ở Tổ bán hàng.');
    });

    it('validates the form: domain, duplicate email, phone; lists with accent-free search', async () => {
      await post('/api/admin/users', { email: 'x@example.vn', fullName: 'Ngoài domain', assignments: [] }).expect(400);
      await post('/api/admin/users', { email: 'MINH.uat@vcprosperous.com', fullName: 'Trùng', assignments: [] }).expect(409);
      await post('/api/admin/users', { email: 'sdt.uat@vcprosperous.com', fullName: 'Sai SĐT', phone: '123', assignments: [] }).expect(400);
      const r = await http().get('/api/admin/users').query({ q: 'nguyen van minh' }).set(ad).expect(200);
      expect(r.body.items.map((x: { email: string }) => x.email)).toEqual(['minh.uat@vcprosperous.com']);
      const byUnit = await http().get('/api/admin/users').query({ orgUnitId: 'VCPARTS' }).set(ad).expect(200);
      expect(byUnit.body.total).toBeGreaterThanOrEqual(2);
    });

    it('a manager flag sets the unit manager, asks before replacing, and obeys the unit-type rule', async () => {
      const gs = await post('/api/admin/users', { email: 'huong.uat@vcprosperous.com', fullName: 'Nguyễn Thị Hương', assignments: [{ roleKey: 'giam_sat_bh', orgUnitId: 'HN1', lead: true }] }).expect(201);
      expect(gs.body.user.assignments[0].lead).toBe(true);
      const gs2 = await post('/api/admin/users', { email: 'duc.uat@vcprosperous.com', fullName: 'Hồ Văn Đức', assignments: [] }).expect(201);
      const ask = await post(`/api/admin/users/${gs2.body.user.id}/assignments`, { roleKey: 'giam_sat_bh', orgUnitId: 'HN1', lead: true }).expect(409);
      expect(ask.body.message).toBe('Thay Nguyễn Thị Hương làm quản lý Tổ bán hàng HN1?');
      await post(`/api/admin/users/${gs2.body.user.id}/assignments?replaceManager=1`, { roleKey: 'giam_sat_bh', orgUnitId: 'HN1', lead: true }).expect(201);
      const nvkd = await post('/api/admin/users', { email: 'linh.uat@vcprosperous.com', fullName: 'Trần Thùy Linh', assignments: [] }).expect(201);
      const bad = await post(`/api/admin/users/${nvkd.body.user.id}/assignments`, { roleKey: 'nvkd', orgUnitId: 'HN1', lead: true }).expect(400);
      expect(bad.body.message).toContain('không làm quản lý');
    });

    it('the last role of an active user cannot be removed', async () => {
      const list = await http().get('/api/admin/users').query({ q: 'thu.uat' }).set(ad).expect(200);
      const u = list.body.items[0];
      const r = await http().delete(`/api/admin/users/${u.id}/assignments/${encodeURIComponent(u.assignments[0].id)}`).set(ad).expect(409);
      expect(r.body.message).toBe('Không gỡ vai trò cuối của người đang hoạt động.');
    });
  });

  describe('UAT-PQ-65: no self-edit, second person approves sensitive roles', () => {
    it('Admin cannot add a role to himself, in the UI flow or by calling the API directly', async () => {
      const r = await post('/api/admin/users/TD-U-AD/assignments', { roleKey: 'quan_sat', orgUnitId: 'GOC' }).expect(403);
      expect(r.body.message).toBe('Không sửa được quyền của chính bạn.');
      await http().delete('/api/admin/users/TD-U-AD/assignments/' + encodeURIComponent('TD-U-AD:admin:GOC')).set(ad).expect(403);
      await post('/api/admin/users/TD-U-AD/lock', { reason: 'tự khóa chính mình' }).expect(403);
    });

    it('a cross-division GĐ role waits for Ban giám đốc; the requester cannot approve; QS approves', async () => {
      const gs = (await http().get('/api/admin/users').query({ q: 'huong.uat' }).set(ad)).body.items[0];
      const r = await post(`/api/admin/users/${gs.id}/assignments`, { roleKey: 'giam_doc_bh', orgUnitId: 'VCEDU' }).expect(201);
      expect(r.body).toMatchObject({ applied: false, approverRule: 'quan_sat', message: 'Vai trò Giám đốc bán hàng chờ Ban giám đốc / Kiểm soát duyệt.' });
      expect((await http().get(`/api/admin/users/${gs.id}`).set(ad)).body.assignments.some((a: { roleKey: string }) => a.roleKey === 'giam_doc_bh')).toBe(false);
      await post(`/api/admin/role-requests/${r.body.requestId}/approve`, {}).expect(403); // requester
      await post(`/api/admin/role-requests/${r.body.requestId}/approve`, {}, as(t.auth.dashboard.Authorization.slice(7))).expect(403); // plain token
      const ok = await post(`/api/admin/role-requests/${r.body.requestId}/approve`, {}, qs).expect(200);
      expect(ok.body.request.status).toBe('da_duyet');
      expect((await http().get(`/api/admin/users/${gs.id}`).set(ad)).body.assignments.some((a: { roleKey: string; orgUnitId: string }) => a.roleKey === 'giam_doc_bh' && a.orgUnitId === 'VCEDU')).toBe(true);
    });

    it('quan_sat for someone else waits for the group approver, not for Ban giám đốc', async () => {
      const sa = await post('/api/admin/users', { email: 'ngoc.uat@vcprosperous.com', fullName: 'Ngô Bích Ngọc', assignments: [] }).expect(201);
      const r = await post(`/api/admin/users/${sa.body.user.id}/assignments`, { roleKey: 'quan_sat', orgUnitId: 'GOC' }).expect(201);
      expect(r.body).toMatchObject({ applied: false, approverRule: 'nguoi_duyet_tap_doan' });
      // The group approver (Q-PQ-17) is TD-U-CT: with it set, QS can no longer decide.
      await t.db.col('security_settings').updateOne({ _id: 'main' } as never, { $set: { groupApprover: 'TD-U-CT' } }, { upsert: true });
      await post(`/api/admin/role-requests/${r.body.requestId}/approve`, {}, qs).expect(403);
      const ct = as(await sessions.create({ _id: 'TD-U-CT', fullName: 'Lương Tiến Đạt' }));
      await post(`/api/admin/role-requests/${r.body.requestId}/approve`, {}, ct).expect(200);
      await t.db.col('security_settings').deleteOne({ _id: 'main' } as never);
    });

    it('the requester can withdraw their own request', async () => {
      const u = await post('/api/admin/users', { email: 'huy.uat@vcprosperous.com', fullName: 'Người Hủy', assignments: [] }).expect(201);
      const r = await post(`/api/admin/users/${u.body.user.id}/assignments`, { roleKey: 'quan_sat', orgUnitId: 'GOC' }).expect(201);
      await post(`/api/admin/role-requests/${r.body.requestId}/cancel`, {}, qs).expect(403);
      await post(`/api/admin/role-requests/${r.body.requestId}/cancel`, {}).expect(200);
      expect((await http().get('/api/admin/role-requests').set(ad)).body.some((x: { id: string }) => x.id === r.body.requestId)).toBe(false);
    });
  });

  describe('UAT-PQ-63: bulk import from file', () => {
    const header = 'email,ho_ten,sdt_noi_bo,vai_tro,ma_don_vi,truong_nhom,tu_ngay,den_ngay,nick_giu,kenh_chinh_thuc,ly_do';
    const people = Array.from({ length: 56 }, (_, i) => `nv${i}.uat@vcprosperous.com,Nhân Viên ${i},,nvkd,HN2,,,,,,`);
    const good = [
      header,
      'gsb.uat@vcprosperous.com,Giám Sát B,0912345678,giam_sat_bh,HN2,co,,,,,',
      'cs.uat@vcprosperous.com,Chăm Sóc A,,cskh,NHOM_CSKH,co,,,,,',
      ...people,
    ];
    const bad = [
      'sai-loai.uat@vcprosperous.com,Sai Loại,,nvkd,NHOM_CSKH,,,,,,', // role at wrong unit type
      'x@example.vn,Ngoài Domain,,nvkd,HN2,,,,,,', // outside domain
      'nv1.uat@vcprosperous.com,Khác Họ Tên,,nvkd,HN2,,,,,,', // same email, different name
      'quan.uat@vcprosperous.com,Đặng Văn Quân,,nvkd,HN2,,,,,,', // the importer himself
    ];

    it('preview reports exactly the bad lines with reasons and writes nothing; commit refuses', async () => {
      const before = await t.db.col(C.users).countDocuments();
      const file = { fileName: 'nguoi-dung-vcparts.csv', contentBase64: csv(...good, ...bad) };
      const p = await post('/api/admin/users/import/preview', file).expect(200);
      expect(p.body).toMatchObject({ total: 62, loi: 4, them: 58 });
      const errs = p.body.rows.filter((r: { outcome: string }) => r.outcome === 'loi');
      expect(errs.map((e: { message: string }) => e.message)).toEqual(
        expect.arrayContaining([
          'Vai trò NVKD phải đặt ở Tổ bán hàng.',
          'Email ngoài domain.',
          expect.stringContaining('khác họ tên'),
          'Không sửa được quyền của chính bạn.',
        ]),
      );
      expect(p.body.rows[0].outcome).toBe('loi'); // errors on top
      expect(await t.db.col(C.users).countDocuments()).toBe(before);
      const c = await post('/api/admin/users/import', file).expect(200);
      expect(c.body.summary).toBe('Sửa 4 dòng lỗi rồi kiểm tra lại. Chưa có gì được ghi.');
      expect(await t.db.col(C.users).countDocuments()).toBe(before);
    });

    it('after the fix every person gets roles, managers are set, and each has a user.create audit line', async () => {
      const file = { fileName: 'nguoi-dung-vcparts.csv', contentBase64: csv(...good) };
      const p = await post('/api/admin/users/import/preview', file).expect(200);
      expect(p.body).toMatchObject({ loi: 0, them: 58 });
      const c = await post('/api/admin/users/import', file).expect(200);
      expect(c.body.summary).toBe('Đã nhập 58 người: 58 thêm mới, 0 cập nhật, 0 chờ duyệt vai trò nhnhạy cảm.'.replace('nhnhạy', 'nhạy'));
      const hn2 = (await http().get('/api/admin/org-units').set(ad)).body.find((u: { id: string }) => u.id === 'HN2');
      expect(hn2.managerName).toBe('Giám Sát B');
      expect(hn2.memberCount).toBe(57);
      const cs = (await http().get('/api/admin/org-units').set(ad)).body.find((u: { id: string }) => u.id === 'NHOM_CSKH');
      expect(cs.managerName).toBe('Chăm Sóc A');
      const audits = await t.db.col(C.auditLog).countDocuments({ action: 'user.create', 'detail.via': 'import' });
      expect(audits).toBe(58);
      // Run again: nothing changes.
      const again = await post('/api/admin/users/import/preview', file).expect(200);
      expect(again.body).toMatchObject({ loi: 0, them: 0, doi: 0, khongDoi: 58 });
    });

    it('an existing person gaining a sensitive cross-division role becomes a pending request; cross-division needs den_ngay', async () => {
      const noEnd = [header, 'nv3.uat@vcprosperous.com,Nhân Viên 3,,nvkd,TVTS,,,,,,'];
      const p1 = await post('/api/admin/users/import/preview', { fileName: 'a.csv', contentBase64: csv(...noEnd) }).expect(200);
      expect(p1.body.rows[0].message).toBe('Gán chéo division cần có den_ngay (tối đa 90 ngày).');
      const soon = new Date(Date.now() + 30 * 86400000);
      const dmy = `${String(soon.getUTCDate()).padStart(2, '0')}/${String(soon.getUTCMonth() + 1).padStart(2, '0')}/${soon.getUTCFullYear()}`;
      const withEnd = [header, `nv3.uat@vcprosperous.com,Nhân Viên 3,,nvkd,TVTS,,,${dmy},,,`];
      const c = await post('/api/admin/users/import', { fileName: 'a.csv', contentBase64: csv(...withEnd) }).expect(200);
      expect(c.body).toMatchObject({ choDuyet: 1, summary: 'Đã nhập 0 người: 0 thêm mới, 0 cập nhật, 1 chờ duyệt vai trò nhạy cảm.' });
    });

    it('accepts xlsx, rejects other types, and an empty file gets the spec sentence', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Dữ liệu');
      ws.addRow(header.split(','));
      ws.addRow(['xlsx.uat@vcprosperous.com', 'Người Xlsx', '', 'nvkd', 'HN2', '', '', '', '', '', '']);
      const buf = Buffer.from(await wb.xlsx.writeBuffer());
      const ok = await post('/api/admin/users/import/preview', { fileName: 'n.xlsx', contentBase64: buf.toString('base64') }).expect(200);
      expect(ok.body).toMatchObject({ them: 1, loi: 0 });
      const wrong = await post('/api/admin/users/import/preview', { fileName: 'n.txt', contentBase64: b64('x') }).expect(400);
      expect(wrong.body.message).toBe('File không đúng mẫu. Tải file mẫu và thử lại.');
      const empty = await post('/api/admin/users/import/preview', { fileName: 'n.csv', contentBase64: csv(header) }).expect(400);
      expect(empty.body.message).toBe('File không có dòng nào. Kiểm tra lại dòng tiêu đề và dữ liệu.');
    });

    it('template and current-state files download and re-import cleanly', async () => {
      const tpl = await http().get('/api/admin/users/import/template?format=csv').set(ad).expect(200);
      expect(tpl.text).toContain('email,ho_ten,sdt_noi_bo,vai_tro');
      const xl = await http().get('/api/admin/users/import/template?format=xlsx').set(ad).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      expect((xl.body as Buffer).subarray(0, 2).toString()).toBe('PK');
      const cur = await http().get('/api/admin/users/import/current?format=csv').set(ad).expect(200);
      const re = await post('/api/admin/users/import/preview', { fileName: 'hien-trang.csv', contentBase64: Buffer.from(cur.text, 'utf8').toString('base64') }).expect(200);
      expect(re.body.them).toBe(0);
      // The current file contains the importer's own admin row: it must be reported, not applied.
      expect(re.body.rows.filter((r: { outcome: string }) => r.outcome === 'loi').every((r: { message: string }) => r.message === 'Không sửa được quyền của chính bạn.')).toBe(true);
    });
  });

  describe('org tree import from file (MH-PQ-01 #10, E4 trial with TD data)', () => {
    const h = 'ma_don_vi,ten,loai,ma_cha,email_quan_ly';
    it('creates the tree in any row order, warns about unknown managers, and refuses bad rows without writing', async () => {
      const rows = [
        h,
        'HN9,Tổ HN9,to_ban_hang,KBH,chua.co@vcprosperous.com',
        'KBH,Khối bán hàng,division,,',
        'HN9A,Tổ con HN9A,Tổ bán hàng,HN9,',
        'MK,Nhóm Marketing,nhom_marketing,KBH,',
      ];
      const p = await post('/api/admin/org-units/import/preview', { fileName: 'cay.csv', contentBase64: csv(...rows) }).expect(200);
      // Rows are valid only if their parent exists: HN9 sits under division KBH, which the file creates.
      expect(p.body).toMatchObject({ loi: 0, them: 4 });
      expect(p.body.rows.find((r: { key: string }) => r.key === 'HN9').warnings[0]).toContain('chưa có trong VClinks');
      const c = await post('/api/admin/org-units/import', { fileName: 'cay.csv', contentBase64: csv(...rows) }).expect(200);
      expect(c.body.summary).toBe('Đã nhập 4 đơn vị.');
      const list = (await http().get('/api/admin/org-units').set(ad)).body as Array<{ id: string; parentId: string; divisionId: string }>;
      expect(list.find((u) => u.id === 'HN9A')).toMatchObject({ parentId: 'HN9', divisionId: 'KBH' });
      const bad = [h, 'KBH2,Khối 2,division,,', 'X1,Nhóm sai,nhom_cskh,HN9,', 'X1,Trùng mã,division,,', 'Y2,Tổ ba cấp,to_ban_hang,HN9A,'];
      const pb = await post('/api/admin/org-units/import/preview', { fileName: 'bad.csv', contentBase64: csv(...bad) }).expect(200);
      expect(pb.body.loi).toBe(3);
      const cb = await post('/api/admin/org-units/import', { fileName: 'bad.csv', contentBase64: csv(...bad) }).expect(200);
      expect(cb.body.summary).toContain('Chưa có gì được ghi');
      expect((await http().get('/api/admin/org-units').set(ad)).body.some((u: { id: string }) => u.id === 'KBH2')).toBe(false);
    });
  });

  describe('lock, leave, change of unit', () => {
    it('UAT-PQ-40 (part): "Khóa ngay" ends the sessions at once and login is refused', async () => {
      const u = await post('/api/admin/users', { email: 'toan.uat@vcprosperous.com', fullName: 'Đỗ Văn Toàn', assignments: [{ roleKey: 'nvkd', orgUnitId: 'HN1' }] }).expect(201);
      const toan = as(await sessions.create({ _id: u.body.user.id, fullName: 'Đỗ Văn Toàn' }));
      await http().get('/api/me').set(toan).expect(200);
      const r = await post(`/api/admin/users/${u.body.user.id}/offboard`, { reason: 'Nghỉ việc theo đơn' }).expect(200);
      expect(r.body.message).toContain('Đã khóa tài khoản Đỗ Văn Toàn.');
      expect(r.body.user.status).toBe('nghi_viec');
      await http().get('/api/me').set(toan).expect(401);
      await post(`/api/admin/users/${u.body.user.id}/offboard`, { reason: 'Nghỉ việc theo đơn' }).expect(409);
    });

    it('UAT-PQ-81 (part): lock needs a reason of 10+ chars, ends sessions, unlock restores', async () => {
      const u = await post('/api/admin/users', { email: 'khoa.uat@vcprosperous.com', fullName: 'Người Khóa', assignments: [{ roleKey: 'nvkd', orgUnitId: 'HN1' }] }).expect(201);
      const tok = as(await sessions.create({ _id: u.body.user.id, fullName: 'Người Khóa' }));
      await post(`/api/admin/users/${u.body.user.id}/lock`, { reason: 'ngắn' }).expect(400);
      const l = await post(`/api/admin/users/${u.body.user.id}/lock`, { reason: 'Gửi danh thiếp nick riêng cho khách' }).expect(200);
      expect(l.body.status).toBe('tam_khoa');
      await http().get('/api/me').set(tok).expect(401);
      const un = await post(`/api/admin/users/${u.body.user.id}/unlock`, {}).expect(200);
      expect(un.body.status).toBe('hoat_dong');
    });

    it('UAT-PQ-93 (part): a division change is scheduled, not applied early, applied when due, and cross-division becomes a request', async () => {
      const u = await post('/api/admin/users', { email: 'linh2.uat@vcprosperous.com', fullName: 'Trần Thùy Linh', assignments: [{ roleKey: 'nvkd', orgUnitId: 'HN1' }] }).expect(201);
      const id = u.body.user.id;
      const when = new Date(Date.now() + 3600_000);
      const s = await post(`/api/admin/users/${id}/change-unit`, { fromOrgUnitId: 'HN1', toOrgUnitId: 'TVTS', effectiveAt: when.toISOString() }).expect(200);
      expect(s.body.applied).toBe(false);
      expect(s.body.message).toMatch(/^Sẽ chuyển Trần Thùy Linh sang Tổ Tư vấn tuyển sinh lúc \d\d\/\d\d\/\d{4} \d\d:\d\d\.$/);
      const people = t.app.get(PeopleService);
      expect(await people.applyDue(new Date())).toBe(0); // before the time nothing changes
      expect((await http().get(`/api/admin/users/${id}`).set(ad)).body.assignments[0].orgUnitId).toBe('HN1');
      expect(await people.applyDue(new Date(when.getTime() + 1000))).toBe(1);
      const after = (await http().get(`/api/admin/users/${id}`).set(ad)).body;
      // VCedu is another division: the new role waits for approval, the old one is gone.
      expect(after.assignments).toHaveLength(0);
      expect(after.pending).toHaveLength(1);
      expect(after.pending[0].change).toMatchObject({ roleKey: 'nvkd', orgUnitId: 'TVTS' });
      // Same-division change applies immediately.
      const v = await post('/api/admin/users', { email: 'khoi.uat@vcprosperous.com', fullName: 'Lâm Văn Khôi', assignments: [{ roleKey: 'nvkd', orgUnitId: 'HN1' }] }).expect(201);
      const now = await post(`/api/admin/users/${v.body.user.id}/change-unit`, { fromOrgUnitId: 'HN1', toOrgUnitId: 'HN2' }).expect(200);
      expect(now.body).toMatchObject({ applied: true, message: 'Đã chuyển Lâm Văn Khôi sang Tổ bán hàng HN2.' });
      await post(`/api/admin/users/${v.body.user.id}/change-unit`, { fromOrgUnitId: 'HN2', toOrgUnitId: 'NHOM_CSKH' }).expect(400);
    });
  });

  it('tokens of the extension and MCP are unaffected and admin routes still need a token', async () => {
    await http().get('/api/admin/users').expect(401);
    await http().get('/api/admin/users').set(t.auth.ingest).expect(403);
    await http().get('/api/admin/users').set(t.auth.dashboard).expect(200);
  });
});
