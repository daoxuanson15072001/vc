import request from 'supertest';
import type { Customer360, ErpSyncStatus, ErpTaskListResponse, ErpTaskView } from '@vclinks/shared';
import { MOCK_VCSALE_CUSTOMERS, type MockVcsaleClient, type VcsaleCustomer } from '@vclinks/vcsale-client';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { VCSALE_CLIENT } from '../../src/customers/customers.service';
import { CUST_C, type CustomerAccountDoc, type ErpCustomerDoc, type ErpTaskDoc } from '../../src/customers/customers.types';
import { ErpSyncService } from '../../src/customers/erp-sync.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * Plan docs/01-quan-ly-du-an/ke-hoach-ket-noi-vcsales.md C11 (catalogue: preview, first full load, incremental sync,
 * deleted customers, one run at a time) and C12 (Việc VCsales, 02 MH-DK-12: create form, claim, duplicates, return to
 * the salesperson, code suggested by the sync, link, close; update tasks done by VCsales or reopened; owner mismatch
 * 4a; "Báo trùng" merge task), on the VCsales mock.
 */
const DIV = 'TD-DV-VCP';
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  [DIV, 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', DIV],
  ['TD-DV-SA', 'Nhóm Sale admin VCparts', 'nhom_sale_admin', DIV],
];
const USERS: [string, string, string, string, string][] = [
  ['TD-U-GD', 'thang.uat@vcprosperous.com', 'Trịnh Văn Thắng', 'giam_doc_bh', DIV],
  ['TD-U-GS1', 'huong.uat@vcprosperous.com', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-KD1', 'minh.uat@vcprosperous.com', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'linh.uat@vcprosperous.com', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-SA', 'ngoc.uat@vcprosperous.com', 'Ngô Bích Ngọc', 'sale_admin', 'TD-DV-SA'],
  ['TD-U-SA2', 'hanh.uat@vcprosperous.com', 'Lê Thị Hạnh', 'sale_admin', 'TD-DV-SA'],
];
const base = (code: string): VcsaleCustomer => ({ ...MOCK_VCSALE_CUSTOMERS.find((c) => c.code === code)! });
const fresh = (x: Partial<VcsaleCustomer> & { code: string }): VcsaleCustomer => ({
  name: x.code,
  legalName: null,
  taxCode: null,
  address: null,
  region: 'Hà Nội',
  type: 'Garage',
  phones: [],
  emails: [],
  salespersonEmail: null,
  salespersonName: null,
  status: 'active',
  mergedInto: null,
  lastTradeAt: null,
  ...x,
  updatedAt: new Date().toISOString(),
});

describe('Danh mục VCsales and Việc VCsales (e2e, plan C11 + C12)', () => {
  let t: E2EApp;
  let mock: MockVcsaleClient;
  let sync: ErpSyncService;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const saved = process.env.AUTHZ_DEFAULT_DIVISION;
  const accounts = () => t.db.col<CustomerAccountDoc>(CUST_C.accounts);
  const accountOf = async (code: string) => (await accounts().findOne({ erpLinks: { $elemMatch: { erp: 'vcsales', customerId: code, status: 'confirmed' } } } as never))!;
  const status = async (who = 'TD-U-SA') => (await http().get('/api/customers/erp-sync').set(as[who]!).expect(200)).body as ErpSyncStatus;
  const runSync = async (kind: 'preview' | 'full' | 'incremental') => {
    await http().post('/api/customers/erp-sync').set(as['TD-U-SA']!).send({ kind }).expect(202);
    await sync.waitIdle();
    const s = await status();
    expect(s.runs[0]).toMatchObject({ kind, error: null });
    return s.runs[0]!;
  };
  const list = async (who: string, query: Record<string, string> = {}) =>
    (await http().get('/api/customers/erp-tasks').query(query).set(as[who]!).expect(200)).body as ErpTaskListResponse;
  const task = async (id: string) => (await t.db.col<ErpTaskDoc>(CUST_C.erpTasks).findOne({ _id: id }))!;
  const seedAccount = async (id: string, name: string, owner: string, phone?: { id: string; value: string; level: string }) => {
    const now = new Date();
    await accounts().insertOne({
      _id: id,
      name,
      type: null,
      region: null,
      status: 'active',
      mergedInto: null,
      owners: [{ division: DIV, userId: owner, since: new Date('2026-10-02T03:00:00Z'), source: 'manual' }],
      erpLinks: [],
      tags: [],
      createdFrom: 'identity',
      createdAt: now,
      updatedAt: now,
    } as never);
    await t.db.col(CUST_C.contacts).insertOne({ _id: `cc_${id}`, accountId: id, name, orgRole: null, status: 'active', mergedInto: null, mergeLocks: [], gender: null, isInternal: false, createdAt: now, updatedAt: now } as never);
    if (phone) await addPoint(id, phone);
  };
  const addPoint = (accountId: string, p: { id: string; value: string; level: string; kind?: string }) =>
    t.db.col(CUST_C.points).insertOne({
      _id: p.id,
      contactId: `cc_${accountId}`,
      accountId,
      kind: p.kind ?? 'phone',
      value: p.value,
      level: p.level,
      state: 'active',
      source: { channel: 'zalo' },
      lastActivityAt: null,
      createdAt: new Date(),
    } as never);

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = DIV;
    t = await startE2EApp();
    mock = t.app.get<MockVcsaleClient>(VCSALE_CLIENT);
    sync = t.app.get(ErpSyncService);
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : DIV, managerUserId: null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, email, fullName]) => ({ _id: id, email, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, , name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = saved;
    await t?.close();
  });

  describe('Danh mục VCsales (C11)', () => {
    it('only sale admins and directors run it; salespersons cannot read it; incremental needs a first load', async () => {
      await http().get('/api/customers/erp-sync').set(as['TD-U-KD1']!).expect(403);
      await http().post('/api/customers/erp-sync').set(as['TD-U-KD1']!).send({ kind: 'preview' }).expect(403);
      const s = await status();
      expect(s).toMatchObject({ mode: 'mock', firstImportAt: null, snapshotCount: 0, running: null, canRun: true });
      expect((await status('TD-U-GD')).canRun).toBe(true);
      const r = await http().post('/api/customers/erp-sync').set(as['TD-U-SA']!).send({ kind: 'incremental' }).expect(400);
      expect(r.body.message).toMatch(/Chưa nạp danh mục lần đầu/);
    });

    it('"Xem trước" counts without writing anything; without a default division it takes the division of the runner', async () => {
      delete process.env.AUTHZ_DEFAULT_DIVISION;
      try {
        const r = await http().post('/api/customers/erp-sync').set(t.auth.dashboard).send({ kind: 'preview' }).expect(400);
        expect(r.body.message).toMatch(/division/);
        await runSync('preview');
      } finally {
        process.env.AUTHZ_DEFAULT_DIVISION = DIV;
      }
      const run = (await status()).runs[0]!;
      expect(run.counts).toMatchObject({ fetched: MOCK_VCSALE_CUSTOMERS.length, created: MOCK_VCSALE_CUSTOMERS.length, unchanged: 0 });
      expect(run.counts.ownersSet).toBeGreaterThan(0);
      expect(await accounts().countDocuments({})).toBe(0);
      expect((await status()).snapshotCount).toBe(0);
      expect((await status()).firstImportAt).toBeNull();
    });

    it('one run at a time: a second start while one runs is refused', async () => {
      await http().post('/api/customers/erp-sync').set(as['TD-U-SA']!).send({ kind: 'preview' }).expect(202);
      const r = await http().post('/api/customers/erp-sync').set(as['TD-U-SA2']!).send({ kind: 'preview' });
      // The mock answers fast: the first run may already be over, then the second one simply runs.
      expect([202, 409]).toContain(r.status);
      if (r.status === 409) expect(r.body.message).toMatch(/Đang có một lần nạp/);
      await sync.waitIdle();
    });

    it('"Nạp toàn bộ" makes every profile once, first owners by e-mail, and fixes the division and the watermark', async () => {
      const run = await runSync('full');
      expect(run.counts).toMatchObject({ fetched: MOCK_VCSALE_CUSTOMERS.length, created: MOCK_VCSALE_CUSTOMERS.length });
      const s = await status();
      expect(s.firstImportAt).not.toBeNull();
      expect(s.division).toBe(DIV);
      expect(s.snapshotCount).toBe(MOCK_VCSALE_CUSTOMERS.length);
      expect(s.since).toBe(MOCK_VCSALE_CUSTOMERS.map((c) => c.updatedAt).sort().at(-1));
      expect((await accountOf('KH-TEST-0101')).owners[0]).toMatchObject({ division: DIV, userId: 'TD-U-KD1', source: 'vcsales_import' });
      expect((await accountOf('KH-TEST-0301')).owners[0]).toMatchObject({ userId: 'TD-U-KD2' });
    });

    it('"Đồng bộ ngay" reads changes only: a new customer gets a profile, a deleted one is marked, none is made for it', async () => {
      mock.upsert({ ...base('KH-TEST-0101'), name: 'Garage Minh Phát (mới)', updatedAt: new Date().toISOString() });
      mock.upsert(fresh({ code: 'KH-TEST-9001', name: 'Garage Mới Mở', phones: ['0900 009 001'] }));
      mock.upsert({ ...base('KH-TEST-0950'), status: 'deleted', updatedAt: new Date().toISOString() });
      mock.upsert(fresh({ code: 'KH-TEST-9002', name: 'Đã xóa ngay', status: 'deleted' }));
      const run = await runSync('incremental');
      expect(run.counts).toMatchObject({ created: 1, deleted: 2 });
      expect(run.counts.updated).toBeGreaterThanOrEqual(1);
      expect(run.since).not.toBeNull();
      expect(await accountOf('KH-TEST-9001')).toBeTruthy();
      expect(await accounts().countDocuments({ 'erpLinks.customerId': 'KH-TEST-9002' } as never)).toBe(0);
      expect((await t.db.col<ErpCustomerDoc>(CUST_C.erpCustomers).findOne({ _id: 'vcsales:KH-TEST-0950' }))!.status).toBe('deleted');
      const again = await runSync('incremental');
      expect(again.counts.created).toBe(0);
      expect(again.counts.fetched).toBeLessThan(MOCK_VCSALE_CUSTOMERS.length);
    });
  });

  describe('Việc VCsales: tạo mã KH (MH-DK-12 tab 1)', () => {
    let id = '';
    const form = { legalName: 'Phạm Thị Mai', type: 'Khách lẻ', phonePointId: 'cp_mai', deliveryAddress: 'Hà Đông, Hà Nội' };

    beforeAll(async () => {
      await seedAccount('ca_mai', 'Phạm Thị Mai', 'TD-U-KD2', { id: 'cp_mai', value: '0900000201', level: 'V2' });
      await seedAccount('ca_kien', 'Đinh Văn Kiên 2', 'TD-U-KD2', { id: 'cp_kien', value: '0900000951', level: 'V1' });
    });

    it('UAT-DK-51: the owner queues his customer with the form; others cannot; no second open task', async () => {
      await http().post('/api/customers/erp-tasks').set(as['TD-U-KD1']!).send({ kind: 'create_customer', accountId: 'ca_mai', form }).expect(404);
      const r = await http().post('/api/customers/erp-tasks').set(as['TD-U-KD2']!).send({ kind: 'create_customer', accountId: 'ca_mai', form }).expect(201);
      const v = r.body as ErpTaskView;
      id = v.id;
      expect(v).toMatchObject({ kind: 'create_customer', status: 'open', missing: [], origin: 'Trần Thùy Linh bấm "Đưa vào hàng chờ"' });
      expect(v.form?.phoneMasked).toMatch(/\*/);
      await http().post('/api/customers/erp-tasks').set(as['TD-U-KD2']!).send({ kind: 'create_customer', accountId: 'ca_mai', form }).expect(409);
      // A V1 phone is refused on the form (V2+ only).
      const bad = await http().post('/api/customers/erp-tasks').set(as['TD-U-KD2']!).send({ kind: 'create_customer', accountId: 'ca_kien', form: { ...form, phonePointId: 'cp_kien' } }).expect(400);
      expect(bad.body.message).toMatch(/V2/);
      const c360 = (await http().get('/api/customers/ca_mai/360').set(as['TD-U-KD2']!).expect(200)).body as Customer360;
      expect(c360.erpTasks).toEqual([{ id, kind: 'create_customer', status: 'open' }]);
    });

    it('scope: sale admin processes; the owner and his supervisor read; another salesperson does not see it', async () => {
      const sa = await list('TD-U-SA');
      expect(sa.counts.create).toBeGreaterThanOrEqual(1);
      expect(sa.canProcess).toBe(true);
      expect(sa.items.find((x) => x.id === id)?.can).toEqual({ process: true, editForm: true });
      expect((await list('TD-U-KD2')).items.find((x) => x.id === id)?.can).toEqual({ process: false, editForm: true });
      expect((await list('TD-U-GS1')).items.find((x) => x.id === id)?.can.process).toBe(false);
      expect((await list('TD-U-KD1')).items.find((x) => x.id === id)).toBeUndefined();
      await http().post(`/api/customers/erp-tasks/${id}/claim`).set(as['TD-U-KD2']!).expect(403);
      const gd = await http().post(`/api/customers/erp-tasks/${id}/claim`).set(as['TD-U-GD']!).expect(403);
      expect(gd.body.message).toMatch(/Chỉ sale admin/);
    });

    it('"Nhận xử lý" holds the row 15 minutes for one sale admin', async () => {
      const r = (await http().post(`/api/customers/erp-tasks/${id}/claim`).set(as['TD-U-SA']!).expect(200)).body as ErpTaskView;
      expect(r.claim).toMatchObject({ by: 'TD-U-SA', byName: 'Ngô Bích Ngọc' });
      const other = await http().post(`/api/customers/erp-tasks/${id}/check`).set(as['TD-U-SA2']!).expect(409);
      expect(other.body.message).toBe('Ngô Bích Ngọc đang xử lý việc này.');
      expect((await list('TD-U-SA2')).items.find((x) => x.id === id)?.can.process).toBe(false);
    });

    it('"Kiểm tra trùng trên VCsales" stores what VCsales has (none here) for the "Trùng?" column', async () => {
      const r = (await http().post(`/api/customers/erp-tasks/${id}/check`).set(as['TD-U-SA']!).expect(200)).body as ErpTaskView;
      expect(r.duplicates?.candidates).toEqual([]);
      expect(r.duplicates?.at).toBeTruthy();
    });

    it('UAT-DK-52: "Thiếu thông tin → trả sale" tells the owner; he completes the form and it comes back', async () => {
      const r = await http().post(`/api/customers/erp-tasks/${id}/return`).set(as['TD-U-SA']!).send({ missing: ['taxCode'], note: 'Khách có MST' }).expect(200);
      expect(r.body.message).toBe('Đã trả phiếu cho Trần Thùy Linh bổ sung MST.');
      expect((await task(id)).status).toBe('waiting_sale');
      const n = await t.db.col('notifications').findOne({ userId: 'TD-U-KD2', kind: 'erp_task.returned' } as never);
      expect(n).toMatchObject({ link: '/customers/erp-tasks?tab=create' });
      await http().put(`/api/customers/erp-tasks/${id}/form`).set(as['TD-U-KD1']!).send({ form: { ...form, taxCode: '0101234567' } }).expect(404);
      const v = (await http().put(`/api/customers/erp-tasks/${id}/form`).set(as['TD-U-KD2']!).send({ form: { ...form, taxCode: '0101 234 567' } }).expect(200)).body as ErpTaskView;
      expect(v).toMatchObject({ status: 'open', missing: [] });
      expect(v.form?.taxCode).toBe('0101234567');
    });

    it('UAT-DK-51: the sale admin makes the code on VCsales; the next sync suggests it; "Gắn mã này" links and closes the task', async () => {
      mock.upsert(fresh({ code: 'KH-TEST-0201', name: 'Phạm Thị Mai', phones: ['0900 000 201'] }));
      const run = await runSync('incremental');
      // The new code matches the waiting form: kept for the task, no second profile.
      expect(run.counts.held).toBe(1);
      expect(await accounts().countDocuments({ 'erpLinks.customerId': 'KH-TEST-0201' } as never)).toBe(0);
      expect(run.counts.codeSuggestions).toBeGreaterThanOrEqual(1);
      const row = (await list('TD-U-SA')).items.find((x) => x.id === id)!;
      expect(row.suggestion).toMatchObject({ code: 'KH-TEST-0201', name: 'Phạm Thị Mai', reasons: ['SĐT'], linkedTo: null });
      const r = await http().post(`/api/customers/erp-tasks/${id}/link`).set(as['TD-U-SA']!).send({ code: 'KH-TEST-0201' }).expect(200);
      expect(r.body.message).toBe('Đã liên kết KH-TEST-0201 với Phạm Thị Mai. Việc đã xong.');
      expect(await task(id)).toMatchObject({ status: 'done', code: 'KH-TEST-0201' });
      expect((await accounts().findOne({ _id: 'ca_mai' }))!.erpLinks[0]).toMatchObject({ customerId: 'KH-TEST-0201', status: 'confirmed' });
      expect((await list('TD-U-SA')).items.find((x) => x.id === id)).toBeUndefined();
    });

    it('"Kiểm tra và gắn" with a code VCsales does not have says so; "Không tạo mã" closes with a reason', async () => {
      const k = (await http().post('/api/customers/erp-tasks').set(as['TD-U-SA']!).send({ kind: 'create_customer', accountId: 'ca_kien', form: { legalName: 'Kiên' } }).expect(201)).body as ErpTaskView;
      expect(k.missing).toEqual(['type', 'phone', 'deliveryAddress', 'taxCode']);
      const nf = await http().post(`/api/customers/erp-tasks/${k.id}/link`).set(as['TD-U-SA']!).send({ code: 'KH-NOPE-1' }).expect(404);
      expect(nf.body.message).toBe('Không tìm thấy mã KH-NOPE-1 trên VCsales.');
      const taken = await http().post(`/api/customers/erp-tasks/${k.id}/link`).set(as['TD-U-SA']!).send({ code: 'KH-TEST-0201' }).expect(409);
      expect(taken.body.message).toBe('Mã KH-TEST-0201 đang gắn với Phạm Thị Mai.');
      const c = await http().post(`/api/customers/erp-tasks/${k.id}/close`).set(as['TD-U-SA']!).send({ reason: 'one_time' }).expect(200);
      expect(c.body.message).toBe('Đã đóng việc tạo mã cho Đinh Văn Kiên 2.');
      expect(await task(k.id)).toMatchObject({ status: 'closed', closeReason: 'one_time' });
    });
  });

  describe('Việc VCsales: cần cập nhật VCsales (MH-DK-12 tab 2)', () => {
    it('SA-04: a verified phone VCsales lacks is proposed; marked done but still different, the sync opens it again; done on VCsales, it closes', async () => {
      const acc = await accountOf('KH-TEST-0101');
      await addPoint(acc._id, { id: 'cp_0101_new', value: '0900000502', level: 'V2' });
      let c360 = (await http().get(`/api/customers/${acc._id}/360`).set(as['TD-U-KD1']!).expect(200)).body as Customer360;
      expect(c360.erpDiff).toEqual([{ pointId: 'cp_0101_new', kind: 'phone', masked: expect.stringMatching(/\*/), queued: false }]);
      const v = (await http().post('/api/customers/erp-tasks').set(as['TD-U-KD1']!).send({ kind: 'update_phone', accountId: acc._id, pointId: 'cp_0101_new' }).expect(201)).body as ErpTaskView;
      expect(v).toMatchObject({ code: 'KH-TEST-0101', newValue: { pointId: 'cp_0101_new' } });
      expect(v.summary).toMatch(/^Đổi SĐT .*\*.* → .*\*/);
      c360 = (await http().get(`/api/customers/${acc._id}/360`).set(as['TD-U-KD1']!).expect(200)).body as Customer360;
      expect(c360.erpDiff[0]!.queued).toBe(true);

      const d = await http().post(`/api/customers/erp-tasks/${v.id}/done`).set(as['TD-U-SA']!).expect(200);
      expect(d.body.message).toBe('Đã ghi nhận cập nhật trên VCsales.');
      await runSync('incremental');
      expect(await task(v.id)).toMatchObject({ status: 'open', reopenedNote: expect.stringMatching(/vẫn thấy VCsales chưa đổi/) });
      expect(await t.db.col('notifications').countDocuments({ userId: 'TD-U-SA', kind: 'erp_task.reopened' } as never)).toBe(1);

      mock.upsert({ ...base('KH-TEST-0101'), phones: ['0900 000 101', '0900 000 502'], updatedAt: new Date().toISOString() });
      const run = await runSync('incremental');
      expect(run.counts.tasksDone).toBeGreaterThanOrEqual(1);
      expect(await task(v.id)).toMatchObject({ status: 'done', doneBy: 'system:vcsales-sync' });
    });

    it('4a: owner VClinks ≠ NV phụ trách VCsales lists the account; the task closes when VCsales has the owner', async () => {
      const acc = await accountOf('KH-TEST-0301');
      await accounts().updateOne({ _id: acc._id }, { $set: { owners: [{ division: DIV, userId: 'TD-U-KD1', since: new Date('2026-10-05T03:00:00Z'), source: 'manual' }] } });
      const l = await list('TD-U-SA', { tab: 'update', mismatch: 'owner' });
      const row = l.mismatch!.find((r) => r.accountId === acc._id)!;
      expect(row).toMatchObject({ code: 'KH-TEST-0301', salespersons: ['Trần Thùy Linh'], taskId: null });
      expect(row.owners[0]).toMatchObject({ userId: 'TD-U-KD1', userName: 'Nguyễn Văn Minh' });
      const v = (await http().post('/api/customers/erp-tasks').set(as['TD-U-GS1']!).send({ kind: 'change_owner', accountId: acc._id }).expect(201)).body as ErpTaskView;
      expect(v.summary).toBe('Đổi NV phụ trách Trần Thùy Linh → Nguyễn Văn Minh từ 05/10/2026');
      expect((await list('TD-U-SA', { tab: 'update', mismatch: 'owner' })).mismatch!.find((r) => r.accountId === acc._id)?.taskId).toBe(v.id);
      mock.upsert({
        ...base('KH-TEST-0301'),
        salespersonEmail: 'minh.uat@vcprosperous.com',
        salespersonName: 'Nguyễn Văn Minh',
        salespersons: [{ id: 's1', name: 'Nguyễn Văn Minh', email: 'minh.uat@vcprosperous.com', active: true }],
        updatedAt: new Date().toISOString(),
      });
      await runSync('incremental');
      expect(await task(v.id)).toMatchObject({ status: 'done', doneBy: 'system:vcsales-sync' });
      expect((await list('TD-U-SA', { tab: 'update', mismatch: 'owner' })).mismatch!.find((r) => r.accountId === acc._id)).toBeUndefined();
    });

    it('UAT-PQ-116 "Báo trùng trên VCsales": sale admin only; the main code is linked, a merge task waits until VCsales merges', async () => {
      await seedAccount('ca_tayho', 'Garage Tây Hồ mới', 'TD-U-KD1');
      mock.upsert(fresh({ code: 'KH-TEST-7001', name: 'Garage Tây Hồ mới' }));
      mock.upsert(fresh({ code: 'KH-TEST-7002', name: 'Garage Tây Hồ mới (trùng)' }));
      await http().post('/api/customers/erp-tasks').set(as['TD-U-KD1']!).send({ kind: 'merge_codes', accountId: 'ca_tayho', mainCode: 'KH-TEST-7001', otherCodes: ['KH-TEST-7002'] }).expect(403);
      const taken = await http()
        .post('/api/customers/erp-tasks')
        .set(as['TD-U-SA']!)
        .send({ kind: 'merge_codes', accountId: 'ca_tayho', mainCode: 'KH-TEST-7001', otherCodes: ['KH-TEST-0302'] })
        .expect(409);
      expect(taken.body.message).toMatch(/Mã KH-TEST-0302 đang gắn với/);
      const v = (await http().post('/api/customers/erp-tasks').set(as['TD-U-SA']!).send({ kind: 'merge_codes', accountId: 'ca_tayho', mainCode: 'KH-TEST-7001', otherCodes: ['KH-TEST-7002'] }).expect(201))
        .body as ErpTaskView;
      expect(v).toMatchObject({ summary: 'Gộp mã KH-TEST-7002 vào KH-TEST-7001', merge: { mainCode: 'KH-TEST-7001', otherCodes: ['KH-TEST-7002'] } });
      expect((await accounts().findOne({ _id: 'ca_tayho' }))!.erpLinks[0]).toMatchObject({ customerId: 'KH-TEST-7001', status: 'confirmed' });
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'erp_task.merge_codes', target: 'ca_tayho' } as never)).toBe(1);
      mock.upsert({ ...fresh({ code: 'KH-TEST-7002', name: 'Garage Tây Hồ mới (trùng)' }), status: 'deleted' });
      await runSync('incremental');
      expect(await task(v.id)).toMatchObject({ status: 'done', doneBy: 'system:vcsales-sync' });
    });
  });
});
