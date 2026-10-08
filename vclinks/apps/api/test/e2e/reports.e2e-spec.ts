import request from 'supertest';
import ExcelJS from 'exceljs';
import type { ReportOverview, ReportTurnList } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { clearSlaCache } from '../../src/conversations/inbox-state';
import { C } from '../../src/db/db.service';
import { MetricsService, vnDay } from '../../src/metrics/metrics.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1c-09: basic reports. Figures on the screens equal the raw turns of the seed (BC-14, UAT-BC-01, 02, 06, 07, 08, 10,
 * 12), nobody sees beyond his scope (BC-12), and the Excel file holds no message text and no phone number (BC-18).
 * The division works 24/7 so waits are plain minutes whatever the time the suite runs.
 */
const NK = (n: string) => `90000000000${n}`;
const MIN = 60_000;
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', 'TD-DV-VCP'],
];
const USERS: [string, string, string, string][] = [
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-GS1', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-GS2', 'Hồ Văn Đức', 'giam_sat_bh', 'TD-DV-HN2'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD3', 'Phạm Văn Hải', 'nvkd', 'TD-DV-HN2'],
  ['TD-U-QS', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
];
const HOLDERS: [string, string][] = [[NK('01'), 'TD-U-KD1'], [NK('02'), 'TD-U-KD2'], [NK('03'), 'TD-U-KD3']];
const ALL_DAY: [string, string][] = [['00:00', '24:00']];
const DAY = vnDay(Date.now() - 3 * 24 * 3600_000);
const PREV = vnDay(Date.now() - 4 * 24 * 3600_000);
const at = (day: string, hhmm: string) => Date.parse(`${day}T${hhmm}:00+07:00`);

/** The raw turns of the seed: nick, thread, start (hh:mm), wait in minutes, reply from VClinks? One table drives data and checks. */
const RAW: { nick: string; thread: string; start: string; wait: number; vclinks: boolean }[] = [
  { nick: '01', thread: 'T1', start: '09:00', wait: 6, vclinks: true },
  { nick: '01', thread: 'T2', start: '10:00', wait: 20, vclinks: false },
  { nick: '01', thread: 'T3', start: '13:00', wait: 20, vclinks: true },
  { nick: '01', thread: 'T4', start: '14:00', wait: 5, vclinks: true },
  { nick: '01', thread: 'T5', start: '16:00', wait: 12, vclinks: true },
  { nick: '02', thread: 'T6', start: '09:30', wait: 10, vclinks: true },
  { nick: '02', thread: 'T7', start: '15:00', wait: 30, vclinks: true },
  { nick: '03', thread: 'T8', start: '11:00', wait: 8, vclinks: true },
];
/** Previous day, nick 01 only: two turns, 30 and 40 minutes. */
const RAW_PREV = [{ thread: 'P1', start: '09:00', wait: 30 }, { thread: 'P2', start: '10:00', wait: 40 }];

const nearestRank = (v: number[], p: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};
const stats = (rows: typeof RAW) => {
  const w = rows.map((r) => r.wait);
  const breached = rows.filter((r) => r.wait > 15).length;
  const via = rows.filter((r) => r.vclinks).length;
  return {
    turns: rows.length, answered: rows.length, breached,
    frtMedian: nearestRank(w, 50), frtP90: nearestRank(w, 90),
    pctBreached: Math.round((breached / rows.length) * 1000) / 10, pctViaVclinks: Math.round((via / rows.length) * 1000) / 10,
  };
};

describe('Reports (e2e, M1c-09)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;
  const savedCache = process.env.SLA_CACHE_MS;
  const msg = (uid: string, thread: string, id: string, from: 'customer' | 'nick', when: number, cliMsgId?: string) => ({
    msgId: id, threadId: thread, fromUid: from === 'customer' ? thread : '0', toUid: from === 'customer' ? uid : thread,
    senderName: 'x', msgType: 'webchat', text: `NOIDUNG-BI-MAT ${id} 0912345678`, sentAt: when, ...(cliMsgId ? { cliMsgId } : {}),
  });
  const ingest = (uid: string, ...items: ReturnType<typeof msg>[]) => http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid, items }).expect(200);
  const q = (day = DAY, extra = '') => `from=${day}&to=${day}${extra}`;
  const overview = async (who: string, extra = '') => (await http().get(`/api/reports/performance?${q(DAY, extra)}`).set(as[who]).expect(200)).body as ReportOverview;
  const nick = (n: string) => NK(n);

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    process.env.SLA_CACHE_MS = '0';
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : parentId,
        managerUserId: null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never);
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    const allDay = { '0': ALL_DAY, '1': ALL_DAY, '2': ALL_DAY, '3': ALL_DAY, '4': ALL_DAY, '5': ALL_DAY, '6': ALL_DAY };
    await t.db.col('sla_settings').insertOne({ _id: 'default', slaMinutes: 15, warnRatio: 0.25, calendar: { weekdays: allDay, holidays: [] } } as never);
    for (const [uid, holder] of HOLDERS) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
    }
    for (const r of RAW) {
      const uid = nick(r.nick);
      const start = at(DAY, r.start);
      await ingest(uid, msg(uid, r.thread, `${r.thread}-c`, 'customer', start), msg(uid, r.thread, `${r.thread}-n`, 'nick', start + r.wait * MIN, `cli-${r.thread}`));
      if (r.vclinks) await t.db.col(C.suggestions).insertOne({ uid, threadId: r.thread, status: 'sent', cliMsgId: `cli-${r.thread}`, finalText: 'x', source: 'manual', createdAt: now } as never);
    }
    for (const r of RAW_PREV) {
      const start = at(PREV, r.start);
      await ingest(nick('01'), msg(nick('01'), r.thread, `${r.thread}-c`, 'customer', start), msg(nick('01'), r.thread, `${r.thread}-n`, 'nick', start + r.wait * MIN, `cli-${r.thread}`));
    }
    // One customer shows a phone number as its display name: it must never reach a report.
    await t.db.col(C.contacts).insertMany([
      { _id: `${nick('01')}:T2`, uid: nick('01'), userId: 'T2', displayName: '0912 345 678' },
      { _id: `${nick('01')}:T3`, uid: nick('01'), userId: 'T3', displayName: 'Anh Bình' },
    ] as never);
    clearSlaCache();
    t.app.get(AuthzService).invalidate();
    await t.app.get(MetricsService).run(PREV, DAY);
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    if (savedCache === undefined) delete process.env.SLA_CACHE_MS;
    else process.env.SLA_CACHE_MS = savedCache;
    await t?.close();
  });

  it('UAT-BC-01/02/06: a supervisor sees one row per salesperson of her team, equal to the raw turns', async () => {
    const o = await overview('TD-U-GS1', '&compare=0');
    expect(o.mode).toBe('nvkd');
    const minh = o.rows.find((r) => r.label === 'Nguyễn Văn Minh')!;
    expect(minh).toMatchObject({ turns: 5, frtMedian: 12, frtP90: 20, breached: 2, pctBreached: 40, pctViaVclinks: 80, viaVclinks: 4, fromPhone: 1 });
    expect(minh).toMatchObject(stats(RAW.filter((r) => r.nick === '01')));
    const linh = o.rows.find((r) => r.label === 'Trần Thùy Linh')!;
    expect(linh).toMatchObject(stats(RAW.filter((r) => r.nick === '02')));
    expect(o.rows.map((r) => r.label)).not.toContain('Phạm Văn Hải');
    // Team total: the median of every turn (12), not an average of medians (BC-14).
    expect(o.totals).toMatchObject({ turns: 7, frtMedian: 12, frtP90: 30, breached: 3, pctBreached: 42.9, pctViaVclinks: 85.7 });
    expect(o.totals).toMatchObject(stats(RAW.filter((r) => r.nick !== '03')));
  });

  it('UAT-BC-07: a salesperson sees his own numbers and the team average, no colleague, no export', async () => {
    const o = await overview('TD-U-KD1');
    expect(o.mode).toBe('self');
    expect(o.rows).toHaveLength(1);
    expect(o.rows[0]).toMatchObject({ label: 'Của tôi', turns: 5, pctBreached: 40 });
    expect(o.team).toMatchObject({ members: 2, turnsPerMember: 3.5, summary: { pctBreached: 42.9 } });
    expect(o.teams).toEqual([]);
    expect(o.canExport).toBe(false);
    const text = JSON.stringify(o);
    for (const name of ['Linh', 'Hương', 'Hải', 'Đức', 'Thắng']) expect(text).not.toContain(name);
    // A team parameter does not open anything (00 R6).
    const forced = await overview('TD-U-KD1', '&team=TD-DV-HN2');
    expect(forced.rows).toHaveLength(1);
    expect(forced.totals.turns).toBe(5);
    await http().get(`/api/reports/performance/export?${q()}`).set(as['TD-U-KD1']).expect(403);
    await http().get(`/api/reports/performance/turns?${q()}`).set(as['TD-U-KD1']).expect(200);
  });

  it('a salesperson cannot read the turns of a colleague through a row key', async () => {
    await http().get(`/api/reports/performance/turns?${q(DAY, '&row=user:TD-U-KD2')}`).set(as['TD-U-KD1']).expect(403);
  });

  it('UAT-BC-08: the team list holds only her teams, a team outside the scope is ignored', async () => {
    const hn1 = (await overview('TD-U-GS1')).teams;
    expect(hn1.map((x) => x.name)).toEqual(['Tổ HN1']);
    const forced = await overview('TD-U-GS1', '&team=TD-DV-HN2');
    expect(forced.appliedTeam).toBeNull();
    expect(forced.rows.map((r) => r.label).sort()).toEqual(['Nguyễn Văn Minh', 'Trần Thùy Linh']);
    const duc = await overview('TD-U-GS2', '&team=TD-DV-HN1');
    expect(duc.rows.map((r) => r.label)).toEqual(['Phạm Văn Hải']);
    const gd = await overview('TD-U-GD');
    expect(gd.teams.map((x) => x.name)).toEqual(['Tổ HN1', 'Tổ HN2']);
    expect(gd.rows).toHaveLength(3);
    expect((await overview('TD-U-GD', '&team=TD-DV-HN2')).rows.map((r) => r.label)).toEqual(['Phạm Văn Hải']);
  });

  it('UAT-BC-10: the previous period of the same length is returned for the delta', async () => {
    const o = await overview('TD-U-GS1', '&compare=1');
    expect(o.prevFrom).toBe(PREV);
    expect(o.prevTo).toBe(PREV);
    const minh = o.rows.find((r) => r.label === 'Nguyễn Văn Minh')!;
    expect(minh.prev).toMatchObject({ turns: 2, frtMedian: 30, frtP90: 40, breached: 2, pctBreached: 100 });
    expect(o.prevTotals).toMatchObject({ turns: 2 });
    expect(o.rows.find((r) => r.label === 'Trần Thùy Linh')!.prev).toBeNull();
    expect((await overview('TD-U-GS1', '&compare=0')).prevFrom).toBeNull();
  });

  it('management sees teams, never a person (BC-12)', async () => {
    const o = await overview('TD-U-QS');
    expect(o.mode).toBe('team');
    expect(o.rows.map((r) => `${r.kind}:${r.label}`).sort()).toEqual(['team:Tổ HN1', 'team:Tổ HN2']);
    expect(o.rows.find((r) => r.label === 'Tổ HN1')).toMatchObject({ turns: 7, pctBreached: 42.9 });
    const text = JSON.stringify(o);
    for (const name of ['Minh', 'Linh', 'Hải']) expect(text).not.toContain(name);
    expect(o.canExport).toBe(true);
    // No customer line and no person through the turn list or the detail file.
    await http().get(`/api/reports/performance/turns?${q()}`).set(as['TD-U-QS']).expect(403);
    await http().get(`/api/reports/performance/export?${q(DAY, '&detail=1')}`).set(as['TD-U-QS']).expect(403);
    await http().get(`/api/reports/performance/export?${q()}`).set(as['TD-U-QS']).expect(200);
  });

  it('UAT-BC-12: the list of turns past their SLA is exactly the 3 raw turns, with no text and no phone', async () => {
    const r = (await http().get(`/api/reports/performance/turns?${q(DAY, '&breachedOnly=1')}`).set(as['TD-U-GS1']).expect(200)).body as ReportTurnList;
    expect(r.truncated).toBe(false);
    expect(r.rows).toHaveLength(3);
    expect(r.rows.map((x) => x.threadId).sort()).toEqual(['T2', 'T3', 'T7']);
    const t2 = r.rows.find((x) => x.threadId === 'T2')!;
    expect(t2).toMatchObject({ waitMin: 20, slaMin: 15, source: 'phone', holderName: 'Nguyễn Văn Minh', result: 'answered' });
    expect(t2.customerName).toBe('***');
    expect(r.rows.find((x) => x.threadId === 'T3')!.customerName).toBe('Anh Bình');
    const text = JSON.stringify(r);
    expect(text).not.toContain('NOIDUNG');
    expect(r.rows.map((x) => x.customerName).join(' ')).not.toMatch(/\d{6,}/);
    // One salesperson's row only.
    const one = (await http().get(`/api/reports/performance/turns?${q(DAY, '&row=user:TD-U-KD2')}`).set(as['TD-U-GS1']).expect(200)).body as ReportTurnList;
    expect(one.rows.map((x) => x.threadId).sort()).toEqual(['T6', 'T7']);
    // A row of another team is out of reach.
    await http().get(`/api/reports/performance/turns?${q(DAY, '&row=user:TD-U-KD3')}`).set(as['TD-U-GS1']).expect(403);
  });

  const download = async (who: string, extra: string) => {
    const res = await http().get(`/api/reports/performance/export?${q(DAY, extra)}`).set(as[who]).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    return res;
  };
  const sheets = async (buf: Buffer) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    return wb;
  };

  it('UAT-BC-11/13: aggregate file without per-customer rows, detail file equal to the raw turns, both logged', async () => {
    const a = await download('TD-U-GS1', '');
    expect(a.status).toBe(200);
    expect(a.headers['content-disposition']).toMatch(/vclinks_bao-cao-hieu-suat_\d{8}_\d{4}\.xlsx/);
    const wa = await sheets(a.body as Buffer);
    expect(wa.worksheets.map((s) => s.name)).toEqual(['Tóm tắt', 'Theo NVKD', 'Định nghĩa']);
    const d = await download('TD-U-GS1', '&detail=1');
    const wd = await sheets(d.body as Buffer);
    expect(wd.worksheets.map((s) => s.name)).toEqual(['Tóm tắt', 'Theo NVKD', 'Lượt chờ', 'Định nghĩa']);
    const ws = wd.getWorksheet('Lượt chờ')!;
    const waits: number[] = [];
    let over = 0;
    ws.eachRow((row, i) => {
      if (i === 1 || typeof row.getCell(7).value !== 'number') return;
      waits.push(row.getCell(7).value as number);
      if (String(row.getCell(9).value).startsWith('Quá hạn')) over++;
    });
    expect(waits).toHaveLength(7);
    expect(nearestRank(waits, 50)).toBe(12);
    expect(over).toBe(3);
    const everything = [wa, wd].map((w) => w.worksheets.map((s) => JSON.stringify(s.getSheetValues())).join('')).join('');
    expect(everything).not.toContain('NOIDUNG');
    expect(everything).not.toMatch(/\d{9,}/);
    expect(everything).toContain('Xuất bởi td-u-gs1@vcprosperous.com');
    const logged = await t.db.col(C.auditLog).find({ action: 'export.report', actor: 'user:TD-U-GS1' }).toArray();
    expect(logged.map((x) => (x.detail as { detail: string }).detail).sort()).toEqual(['chi_tiet', 'tong_hop']);
    expect(JSON.stringify(logged)).not.toContain('Minh');
  });

  it('a manager of a division can export, an export outside the scope is impossible', async () => {
    const gd = await download('TD-U-GD', '&team=TD-DV-HN2');
    expect(gd.status).toBe(200);
    const w = await sheets(gd.body as Buffer);
    const rows = JSON.stringify(w.getWorksheet('Theo NVKD')!.getSheetValues());
    expect(rows).toContain('Phạm Văn Hải');
    expect(rows).not.toContain('Nguyễn Văn Minh');
  });

  it('gate: a TD viewer who holds a nick sees only his own turn lines; names cannot inject formulas or leak e-mail', async () => {
    await t.db.col(C.contacts).insertOne({ _id: `${nick('01')}:T1`, uid: nick('01'), userId: 'T1', displayName: '=HYPERLINK("http://x") khach@gmail.com' } as never);
    const gs = (await http().get(`/api/reports/performance/turns?${q()}`).set(as['TD-U-GS1']).expect(200)).body as ReportTurnList;
    const t1 = gs.rows.find((x) => x.threadId === 'T1')!;
    expect(t1.customerName).not.toContain('@');
    const file = await sheets((await download('TD-U-GS1', '&detail=1')).body as Buffer);
    const names: string[] = [];
    file.getWorksheet('Lượt chờ')!.eachRow((row, i) => { if (i > 1 && typeof row.getCell(7).value === 'number') names.push(String(row.getCell(6).value)); });
    expect(names.filter((n) => /^[=+\-@]/.test(n))).toEqual([]);
    expect(names.some((n) => n.startsWith("'="))).toBe(true);

    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: nick('04'), label: 'Nick 04' }).expect(201);
    await t.db.col('channel_access').insertOne({ _id: `${nick('04')}:user:TD-U-QS:giu_nick`, channelId: nick('04'), principalType: 'user', principalId: 'TD-U-QS', level: 'giu_nick', createdBy: 'seed' } as never);
    t.app.get(AuthzService).invalidate();
    const r = await http().get(`/api/reports/performance/turns?${q()}`).set(as['TD-U-QS']);
    if (r.status === 200) expect((r.body as ReportTurnList).rows.filter((x) => x.uid !== nick('04'))).toEqual([]);
    else expect(r.status).toBe(403);
    const d = await download('TD-U-QS', '&detail=1');
    if (d.status === 200) {
      const w = await sheets(d.body as Buffer);
      const sheet = JSON.stringify(w.getWorksheet('Lượt chờ')?.getSheetValues() ?? []);
      for (const name of ['Minh', 'Linh', 'Hải', 'Anh Bình']) expect(sheet).not.toContain(name);
    } else expect(d.status).toBe(403);
  });
});
