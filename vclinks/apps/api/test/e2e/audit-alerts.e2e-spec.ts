import request from 'supertest';
import ExcelJS from 'exceljs';
import { auditGroupOf } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AlertsService } from '../../src/audit/alerts.service';
import { AuditService } from '../../src/audit/audit.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-07: access log (MH-PQ-10) and abnormal-access alerts (MH-PQ-14) on the TD data. UAT-PQ-28, 72 (R5 part),
 * 86, 87, 88 (log shape; the `mcp.call` lines are written here as M1b-06 will write them) and the log rule:
 * no message text and no full phone number in any log line (CLAUDE.md §12.3).
 */
const NK = '900000000001';
const NK4 = '900000000004';
const CUSTOMER = '910001';
const PHONE = '0912345678';
const SECRET_TEXT = 'Nội dung bí mật của khách hàng Minh Phát';
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', 'TD-DV-VCP'],
];
const MANAGERS: Record<string, string> = { 'TD-DV-VCP': 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1', 'TD-DV-HN2': 'TD-U-GS2' };
const USERS: [string, string, string, string][] = [
  ['TD-U-AD', 'Đặng Văn Quân', 'admin', 'GOC'],
  ['TD-U-QS', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-GS1', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-GS2', 'Hồ Văn Đức', 'giam_sat_bh', 'TD-DV-HN2'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD4', 'Phạm Văn Hải', 'nvkd', 'TD-DV-HN2'],
];

describe('access log and alerts (e2e, M1b-07)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;
  const alertsOf = async (who: string, q = '') => (await http().get(`/api/admin/alerts${q}`).set(as[who]).expect(200)).body as { items: { id: string; rule: string; summary: string; status: string }[]; newCount: number };
  const log = async (who: string, q: string) => (await http().get(`/api/admin/audit?${q}`).set(as[who]).expect(200)).body as { items: { action: string; actorId: string; target: string }[]; total: number };

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : parentId,
        managerUserId: MANAGERS[id] ?? null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    for (const [uid, holder] of [[NK, 'TD-U-KD1'], [NK4, 'TD-U-KD4']]) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid, items: [{ userId: CUSTOMER, displayName: 'Garage Minh Phát', phone: PHONE }] }).expect(200);
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid, items: [{ threadId: CUSTOMER, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
      await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid, items: [{ msgId: `m${uid.slice(-2)}`, threadId: CUSTOMER, fromUid: CUSTOMER, toUid: uid, senderName: 'Khách', msgType: 'webchat', text: SECRET_TEXT, sentAt: Date.now() }] }).expect(200);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
    }
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    await t?.close();
  });

  describe('UAT-PQ-28: R1 phone reveals', () => {
    it('the 41st reveal in an hour warns the supervisor and alerts GD and QS, not him', async () => {
      let last: { body: { warning?: string } } | undefined;
      for (let i = 0; i < 41; i++) {
        last = await http().post('/api/reveal').set(as['TD-U-GS1']).send({ field: 'phone', uid: NK, userId: CUSTOMER, where: 'MH-SZ-01' }).expect(200);
        if (i < 40) expect(last.body.warning).toBeUndefined();
      }
      expect(last!.body.warning).toBe('Bạn đã hiện SĐT nhiều lần trong 1 giờ. Quản lý của bạn đã được thông báo.');
      for (const who of ['TD-U-GD', 'TD-U-QS']) {
        const a = (await alertsOf(who)).items.filter((x) => x.rule === 'R1');
        expect(a).toHaveLength(1);
        expect(a[0]).toMatchObject({ status: 'moi', summary: 'Nguyễn Thị Hương đã hiện SĐT 41 lần trong 1 giờ qua.' });
      }
      expect((await alertsOf('TD-U-GS1')).items).toEqual([]);
      // A salesperson holds no alert key: he cannot even open the list.
      await http().get('/api/admin/alerts').set(as['TD-U-KD1']).expect(403);
      // Another team's supervisor and the admin are not recipients of R1.
      expect((await alertsOf('TD-U-GS2')).items).toEqual([]);
    });

    it('a 42nd reveal does not raise a second alert while the first is open', async () => {
      await http().post('/api/reveal').set(as['TD-U-GS1']).send({ field: 'phone', uid: NK, userId: CUSTOMER }).expect(200);
      expect((await alertsOf('TD-U-GD')).items.filter((x) => x.rule === 'R1')).toHaveLength(1);
    });
  });

  describe('UAT-PQ-87: R2 profile opening against the person own average', () => {
    it('60 profiles of his own in 30 minutes, usual 8 a day: alert to GS, GD, QS with the usual level', async () => {
      const day = 86_400_000;
      const hist = [];
      for (let d = 1; d <= 30; d++) for (let i = 0; i < 8; i++) hist.push({ actor: 'user:TD-U-KD1', action: 'customer.view', target: `OLD-${d}-${i}`, at: new Date(Date.now() - d * day) });
      await t.db.col(C.auditLog).insertMany(hist as never);
      for (let i = 0; i < 60; i++) await t.db.audit('user:TD-U-KD1', 'customer.view', `TD-K${i}`);
      for (const who of ['TD-U-GS1', 'TD-U-GD', 'TD-U-QS']) {
        const a = (await alertsOf(who)).items.filter((x) => x.rule === 'R2');
        expect(a).toHaveLength(1);
        expect(a[0]!.summary).toMatch(/^Nguyễn Văn Minh đã mở 60 hồ sơ khác nhau trong \d+ phút \(mức thường 8\/ngày\)\.$/);
      }
      await http().get('/api/admin/alerts').set(as['TD-U-KD1']).expect(403);
    });

    it('opening 10 profiles on an ordinary day raises nothing', async () => {
      for (let i = 0; i < 10; i++) await t.db.audit('user:TD-U-KD2', 'customer.view', `TD-X${i}`);
      expect((await alertsOf('TD-U-QS')).items.filter((x) => x.summary.includes('Trần Thùy Linh'))).toEqual([]);
    });
  });

  describe('R3, R4, R5, R8, R9 rules', () => {
    it('R3: an export with phones alerts GD and QS even for one file', async () => {
      await t.db.audit('user:TD-U-KD2', 'export.create', 'XK-0001', { rows: 12, withPhone: true });
      const a = (await alertsOf('TD-U-QS')).items.filter((x) => x.rule === 'R3');
      expect(a).toHaveLength(1);
      expect(a[0]!.summary).toContain('kèm SĐT');
    });

    it('R4: AI over 200 calls an hour alerts GD, QS and the admin', async () => {
      for (let i = 0; i < 201; i++) await t.db.audit('token:Claude Desktop KD2', 'mcp.call', 'search_messages', { userId: 'TD-U-KD2', targets: [`TD-K${i % 5}`] });
      for (const who of ['TD-U-QS', 'TD-U-AD']) expect((await alertsOf(who)).items.filter((x) => x.rule === 'R4')).toHaveLength(1);
    });

    it('R5: a call at 23:30 Vietnam time alerts the supervisor and the director; a noon call does not', async () => {
      const svc = t.app.get(AlertsService);
      // 23:30 in Hanoi on a Tuesday is 16:30 UTC.
      await svc.evaluate({ actor: 'user:TD-U-KD4', action: 'conversation.view', target: `${NK4}:${CUSTOMER}`, at: new Date('2026-09-29T16:30:00Z') });
      await svc.evaluate({ actor: 'user:TD-U-KD1', action: 'conversation.view', target: `${NK}:${CUSTOMER}`, at: new Date('2026-09-29T05:00:00Z') });
      const gs2 = (await alertsOf('TD-U-GS2')).items.filter((x) => x.rule === 'R5');
      expect(gs2).toHaveLength(1);
      expect(gs2[0]!.summary).toBe('Phạm Văn Hải truy cập ngoài giờ (23h).');
      expect((await alertsOf('TD-U-GD')).items.filter((x) => x.rule === 'R5')).toHaveLength(1);
      // GS1 supervises KD1 (noon call: no alert), not KD4.
      expect((await alertsOf('TD-U-GS1')).items.filter((x) => x.rule === 'R5')).toEqual([]);
    });

    it('R8: a fourth grant request in a week alerts GD and QS', async () => {
      for (let i = 0; i < 4; i++) await t.db.audit('user:TD-U-KD4', 'grant.request', `${NK}:${CUSTOMER}`, { right: 'xem' });
      expect((await alertsOf('TD-U-QS')).items.filter((x) => x.rule === 'R8')).toHaveLength(1);
    });

    it('rules that need data not recorded yet are listed but off', async () => {
      const rules = (await http().get('/api/admin/alert-rules').set(as['TD-U-AD']).expect(200)).body as { code: string; enabled: boolean; ready: boolean }[];
      expect(rules.map((r) => r.code)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11']);
      expect(rules.filter((r) => !r.ready).map((r) => r.code)).toEqual(['R10', 'R11']);
      expect(rules.find((r) => r.code === 'R6')!.enabled).toBe(true);
      expect(rules.find((r) => r.code === 'R10')!.enabled).toBe(false);
      await http().put('/api/admin/alert-rules/R10').set(as['TD-U-AD']).send({ enabled: true }).expect(400);
    });
  });

  describe('handling alerts', () => {
    it('the note needs 10 to 500 characters; handling moves the status and is logged with ids only', async () => {
      const a = (await alertsOf('TD-U-GD')).items.find((x) => x.rule === 'R1')!;
      await http().post(`/api/admin/alerts/${a.id}/seen`).set(as['TD-U-GD']).expect(200);
      expect((await alertsOf('TD-U-GD', '?status=da_xem')).items.map((x) => x.id)).toContain(a.id);
      await http().post(`/api/admin/alerts/${a.id}/handle`).set(as['TD-U-GD']).send({ note: 'ngắn' }).expect(400);
      const done = await http().post(`/api/admin/alerts/${a.id}/handle`).set(as['TD-U-GD']).send({ note: 'Đã hỏi lại, tổ đang rà soát khách cũ.' }).expect(200);
      expect(done.body.status).toBe('da_xu_ly');
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'alert.handle', target: a.id })).toBe(1);
      // QS still sees it and it is already handled.
      expect((await alertsOf('TD-U-QS', '?status=da_xu_ly')).items.map((x) => x.id)).toContain(a.id);
    });

    it('the person of an alert and a stranger get 404, as if it did not exist', async () => {
      const a = (await alertsOf('TD-U-QS')).items.find((x) => x.rule === 'R2')!;
      await http().post(`/api/admin/alerts/${a.id}/seen`).set(as['TD-U-KD1']).expect(403); // no alert key at all
      await http().post(`/api/admin/alerts/${a.id}/seen`).set(as['TD-U-GS2']).expect(404); // other team: not a recipient
    });
  });

  describe('rule settings', () => {
    it('Admin saves a threshold, QS only proposes', async () => {
      const saved = await http().put('/api/admin/alert-rules/R8').set(as['TD-U-AD']).send({ threshold: 5 }).expect(200);
      expect(saved.body.threshold).toBe(5);
      await http().put('/api/admin/alert-rules/R8').set(as['TD-U-QS']).send({ threshold: 2 }).expect(403);
      await http().put('/api/admin/alert-rules/R8').set(as['TD-U-AD']).send({ recipients: [] }).expect(400);
      await http().post('/api/admin/alert-rules/R8/propose').set(as['TD-U-QS']).send({ reason: 'Ngưỡng 5 lần là cao quá', proposal: { threshold: 3 } }).expect(200);
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'alert.propose' })).toBe(1);
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'alert.config', 'detail.notifyQuanSat': true })).toBe(1);
      await http().put('/api/admin/alert-rules/R8').set(as['TD-U-AD']).send({ threshold: 3 }).expect(200);
    });
  });

  describe('UAT-PQ-86: looking at one person is itself logged and told to that person', () => {
    it('GS1 filters the log by KD1: line in KD1 activity and audit.view_person; KD1 cannot open the log', async () => {
      const r = await log('TD-U-GS1', 'groups=&actor=TD-U-KD1');
      expect(r.items.length).toBeGreaterThan(0);
      expect(r.items.every((x) => x.actorId === 'TD-U-KD1')).toBe(true);
      const mine = (await http().get('/api/me/activity').set(as['TD-U-KD1']).expect(200)).body as { text: string; action: string }[];
      const line = mine.find((x) => x.action === 'audit.view_person')!;
      expect(line.text).toMatch(/^Giám sát bán hàng Nguyễn Thị Hương đã xem nhật ký của bạn \(\d{2}\/\d{2}\/\d{4}\)$/);
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'audit.view_person', target: 'TD-U-KD1' })).toBe(1);
      await http().get('/api/admin/audit').set(as['TD-U-KD1']).expect(403);
    });

    it('looking at yourself is not logged', async () => {
      await log('TD-U-GS1', 'groups=&actor=TD-U-GS1');
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'audit.view_person', target: 'TD-U-GS1' })).toBe(0);
    });
  });

  describe('scope of the log (audit.view)', () => {
    it('GS1 reads his team only, GD the division, QS and AD everything; the default filter is phone, export, delete', async () => {
      const gs1 = await log('TD-U-GS1', 'groups=');
      expect(gs1.items.some((x) => x.actorId === 'TD-U-KD4')).toBe(false);
      expect(gs1.items.some((x) => x.actorId === 'TD-U-KD1')).toBe(true);
      const gd = await log('TD-U-GD', 'groups=');
      expect(gd.items.some((x) => x.actorId === 'TD-U-KD4')).toBe(true);
      const qs = await log('TD-U-QS', 'groups=&pageSize=200');
      expect(qs.items.some((x) => x.actorId === 'Claude Desktop KD2')).toBe(true);
      const def = await log('TD-U-QS', 'pageSize=200');
      expect(def.items.every((x) => ['truy_cap', 'xuat', 'xoa'].includes(auditGroupOf(x.action)))).toBe(true);
      expect(def.items.some((x) => x.action === 'mcp.call')).toBe(false);
    });

    it('a range over 92 days is refused', async () => {
      await http().get('/api/admin/audit?from=2026-01-01&to=2026-09-30').set(as['TD-U-QS']).expect(400);
    });
  });

  describe('UAT-PQ-88: AI reads are traceable by customer code', () => {
    it('mcp.call lines carry targets; searching a code finds them; activity counts customers and conversations', async () => {
      await t.db.audit('token:Claude Desktop KD1', 'mcp.call', 'search_messages', { userId: 'TD-U-KD1', targets: ['TD-K01', `${NK}:TD-H01`, `${NK}:TD-H20`] });
      const r = await log('TD-U-QS', 'groups=&target=TD-K01&actorType=ai');
      expect(r.items.filter((x) => x.action === 'mcp.call')).toHaveLength(1);
      const mine = (await http().get('/api/me/activity').set(as['TD-U-KD1']).expect(200)).body as { text: string }[];
      expect(mine.some((x) => /^AI đã đọc 1 khách, 2 hội thoại/.test(x.text))).toBe(true);
    });
  });

  describe('export and overview', () => {
    it('GD exports the log to xlsx and the export is logged; KD1 cannot', async () => {
      const res = await http().get('/api/admin/audit/export?groups=').set(as['TD-U-GD']).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      expect(res.headers['content-disposition']).toMatch(/nhat-ky-\d{8}\.xlsx/);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as never);
      expect(wb.worksheets[0]!.getRow(1).getCell(1).value).toBe('Thời điểm');
      expect(wb.worksheets[0]!.rowCount).toBeGreaterThan(5);
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'audit.export' })).toBe(1);
      await http().get('/api/admin/audit/export').set(as['TD-U-KD1']).expect(403);
    });

    it('overview gives counts per group and the top people', async () => {
      const o = (await http().get('/api/admin/audit/overview?period=week').set(as['TD-U-QS']).expect(200)).body as { groups: Record<string, number>; top: Record<string, { actorName: string; count: number }[]> };
      expect(o.groups.truy_cap).toBeGreaterThan(40);
      expect(o.top['phone.reveal'][0]).toMatchObject({ actorName: 'Nguyễn Thị Hương' });
      await http().get('/api/admin/audit/overview').set(as['TD-U-GS1']).expect(403);
    });
  });

  describe('L-03 (UAT-PQ-60, PQ-72): the log records the address; only Admin and the observer read it; R6 flags a new address', () => {
    it('a line written by a request carries its address; Admin and QS see it, GD and GS do not', async () => {
      await http().post('/api/reveal').set(as['TD-U-GS2']).set('CF-Connecting-IP', '203.0.113.9').send({ field: 'phone', uid: NK4, userId: CUSTOMER, where: 'MH-SZ-01' }).expect(200);
      const stored = await t.db.col(C.auditLog).find({ actor: 'user:TD-U-GS2', action: 'phone.reveal' }).toArray();
      expect(stored.at(-1)).toMatchObject({ ip: '203.0.113.9' });
      const rows = async (who: string) => (await log(who, 'groups=&pageSize=200')).items.filter((x) => x.actorId === 'TD-U-GS2' && x.action === 'phone.reveal') as { ip?: string }[];
      for (const who of ['TD-U-AD', 'TD-U-QS']) expect((await rows(who)).some((x) => x.ip === '203.0.113.9')).toBe(true);
      for (const who of ['TD-U-GD', 'TD-U-GS2']) {
        const r = await rows(who);
        expect(r.length).toBeGreaterThan(0);
        expect(JSON.stringify(r)).not.toContain('203.0.113.9');
      }
      // The activity of one person and the export never carry the address.
      expect(JSON.stringify((await http().get('/api/me/activity').set(as['TD-U-GS2'])).body)).not.toContain('203.0.113.9');
    });

    it('gác cổng: CF-Connecting-IP is ignored unless the request comes from a trusted proxy', async () => {
      const saved = process.env.TRUSTED_PROXY_IPS;
      process.env.TRUSTED_PROXY_IPS = '';
      try {
        await http().post('/api/reveal').set(as['TD-U-GS2']).set('CF-Connecting-IP', '203.0.113.77').send({ field: 'phone', uid: NK4, userId: CUSTOMER, where: 'MH-SZ-01' }).expect(200);
      } finally {
        if (saved === undefined) delete process.env.TRUSTED_PROXY_IPS;
        else process.env.TRUSTED_PROXY_IPS = saved;
      }
      const last = (await t.db.col(C.auditLog).find({ actor: 'user:TD-U-GS2', action: 'phone.reveal' }).toArray()).at(-1) as { ip?: string };
      expect(last.ip).toBeTruthy();
      expect(last.ip).not.toBe('203.0.113.77');
    });

    it('gác cổng: addresses older than the retention are removed, the line stays (NĐ 13)', async () => {
      const old = new Date(Date.now() - 200 * 86_400_000);
      await t.db.col(C.auditLog).insertOne({ actor: 'user:TD-U-KD1', action: 'login', target: 'TD-U-KD1', at: old, detail: {}, ip: '192.0.2.200' } as never);
      expect(await t.app.get(AuditService).dropOldIps()).toBeGreaterThan(0);
      const row = (await t.db.col(C.auditLog).findOne({ actor: 'user:TD-U-KD1', at: old } as never)) as { ip?: string } | null;
      expect(row).toBeTruthy();
      expect(row!.ip).toBeUndefined();
    });

    it('R6: a login from an address not seen in 30 days alerts GS and Admin, without the address; a known one does not', async () => {
      const svc = t.app.get(AlertsService);
      const now = new Date();
      await t.db.col(C.auditLog).insertMany([{ actor: 'user:TD-U-KD2', action: 'login', target: 'TD-U-KD2', at: new Date(now.getTime() - 5 * 86_400_000), detail: {}, ip: '198.51.100.1' }] as never);
      await svc.evaluate({ actor: 'user:TD-U-KD2', action: 'login', target: 'TD-U-KD2', at: new Date(now.getTime() - 1000), ip: '198.51.100.1' });
      expect((await alertsOf('TD-U-AD')).items.filter((x) => x.rule === 'R6')).toEqual([]);
      await svc.evaluate({ actor: 'user:TD-U-KD2', action: 'login', target: 'TD-U-KD2', at: now, ip: '203.0.113.77' });
      for (const who of ['TD-U-GS1', 'TD-U-AD']) {
        const a = (await alertsOf(who)).items.filter((x) => x.rule === 'R6');
        expect(a).toHaveLength(1);
        expect(JSON.stringify(a)).not.toContain('203.0.113.77');
      }
    });
  });

  describe('L-05 (UAT-PQ-82): the "Sắp nghỉ" flag and rule R7', () => {
    it('GS sets the flag on his own team only; the list shows it; R7 alerts GS, GD and QS once he opens 10 or more different profiles', async () => {
      await http().post('/api/admin/users/TD-U-KD4/pre-leave').set(as['TD-U-GS1']).send({ expectedDate: '2026-10-18', reason: 'Đã nộp đơn xin nghỉ việc' }).expect(403);
      await http().post('/api/admin/users/TD-U-KD1/pre-leave').set(as['TD-U-GS1']).send({ expectedDate: '2026-10-18', reason: 'ngắn' }).expect(400);
      const set = (await http().post('/api/admin/users/TD-U-KD1/pre-leave').set(as['TD-U-GS1']).send({ expectedDate: '2026-10-18', reason: 'Đã nộp đơn xin nghỉ việc' }).expect(200)).body;
      expect(set.preLeave.date).toBe('2026-10-18');
      await http().post('/api/admin/users/TD-U-KD1/pre-leave').set(as['TD-U-KD2']).send({ expectedDate: '2026-10-18', reason: 'Đã nộp đơn xin nghỉ việc' }).expect(403);
      for (let i = 0; i < 10; i++) await t.db.audit('user:TD-U-KD1', 'customer.view', `TD-K-PL${i}`, {});
      for (const who of ['TD-U-GS1', 'TD-U-GD', 'TD-U-QS']) {
        const a = (await alertsOf(who)).items.filter((x) => x.rule === 'R7');
        expect(a).toHaveLength(1);
        expect(a[0]!.summary).toMatch(/^Nguyễn Văn Minh \(Sắp nghỉ\) đã mở \d+ hồ sơ khác nhau trong 24 giờ\.$/);
      }
      await http().get('/api/admin/alerts').set(as['TD-U-KD1']).expect(403);
      await http().delete('/api/admin/users/TD-U-KD1/pre-leave').set(as['TD-U-GS1']).expect(200);
      expect((await http().get('/api/admin/users/TD-U-KD1').set(as['TD-U-AD']).expect(200)).body.preLeave).toBeNull();
    });
  });

  describe('log rule (§12.3): no message text, no full phone number', () => {
    it('lines written with content keys or a phone number are cleaned', async () => {
      await t.db.audit('user:TD-U-KD1', 'outbox.create', 'x1', { text: SECRET_TEXT, phone: PHONE, note: `gọi ${PHONE} nhé`, count: 3 });
      const line = await t.db.col(C.auditLog).findOne({ target: 'x1' });
      expect(line!.detail).toEqual({ note: 'gọi [SĐT đã ẩn] nhé', count: 3 });
    });

    it('after every flow above, no stored log line, alert or API answer holds the text or the number', async () => {
      const stored = JSON.stringify([
        await t.db.col(C.auditLog).find({}).toArray(),
        await t.db.col(C.events).find({}).toArray(),
        await t.db.col(C.alerts).find({}).toArray(),
      ]);
      expect(stored).not.toContain(SECRET_TEXT);
      expect(stored).not.toContain(PHONE);
      const api = JSON.stringify([
        await log('TD-U-QS', 'groups=&pageSize=200'),
        await alertsOf('TD-U-QS'),
        (await http().get('/api/me/activity').set(as['TD-U-KD1'])).body,
        (await http().get('/api/events?kind=phone').set(t.auth.dashboard)).body,
      ]);
      expect(api).not.toContain(SECRET_TEXT);
      expect(api).not.toContain(PHONE);
    });
  });
});
