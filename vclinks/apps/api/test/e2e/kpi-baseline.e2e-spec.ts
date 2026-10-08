import request from 'supertest';
import type { KpiReport } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { clearSlaCache } from '../../src/conversations/inbox-state';
import { C } from '../../src/db/db.service';
import { MetricsService, KPI_DAILY, vnDay } from '../../src/metrics/metrics.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-15: baseline KPI of one seeded day checked by hand (FRT, % over SLA, over 2 h, via VClinks, login share),
 * idempotent job, scope of the numbers, and a CSV without message text or phone numbers.
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
  ['TD-U-QS', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
];
const ALL_DAY: [string, string][] = [['00:00', '24:00']];
const DAY = vnDay(Date.now() - 2 * 24 * 3600_000);
/** Instant at hh:mm VN time of the seeded day. */
const at = (hhmm: string) => Date.parse(`${DAY}T${hhmm}:00+07:00`);

describe('KPI baseline (e2e, M1b-15)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;
  const savedCache = process.env.SLA_CACHE_MS;
  const msg = (uid: string, thread: string, id: string, from: 'customer' | 'nick', when: string, cliMsgId?: string) => ({
    msgId: id, threadId: thread, fromUid: from === 'customer' ? thread : '0', toUid: from === 'customer' ? uid : thread,
    senderName: 'x', msgType: 'webchat', text: `NOIDUNG-BI-MAT ${id} 0912345678`, sentAt: at(when), ...(cliMsgId ? { cliMsgId } : {}),
  });
  const ingest = (uid: string, ...items: ReturnType<typeof msg>[]) => http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid, items }).expect(200);
  const kpi = async (who: string, q = '') => (await http().get(`/api/metrics/kpi?from=${DAY}&to=${DAY}${q}`).set(as[who]).expect(200)).body as KpiReport;

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
    for (const [uid, holder, unit] of [[NK('01'), 'TD-U-KD1', 'HN1'], [NK('02'), 'TD-U-GS2', 'HN2']] as const) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: `seed-${unit}` } as never);
    }
    // Nick 01: A answered in 10 min from VClinks, B in 20 min from the phone, C in 150 min, D never answered.
    await ingest(NK('01'), msg(NK('01'), 'A', 'A1', 'customer', '10:00'), msg(NK('01'), 'A', 'A2', 'nick', '10:10', 'cli-A2'));
    await ingest(NK('01'), msg(NK('01'), 'B', 'B1', 'customer', '11:00'), msg(NK('01'), 'B', 'B2', 'nick', '11:20', 'cli-B2'));
    await ingest(NK('01'), msg(NK('01'), 'C', 'C1', 'customer', '12:00'), msg(NK('01'), 'C', 'C2', 'nick', '14:30', 'cli-C2'));
    await ingest(NK('01'), msg(NK('01'), 'D', 'D1', 'customer', '15:00'));
    // Nick 02: one turn answered in 5 min. A second customer message before the reply does not open a new turn.
    await ingest(NK('02'), msg(NK('02'), 'E', 'E1', 'customer', '09:00'), msg(NK('02'), 'E', 'E1b', 'customer', '09:02'), msg(NK('02'), 'E', 'E2', 'nick', '09:05', 'cli-E2'));
    await t.db.col(C.suggestions).insertOne({ uid: NK('01'), threadId: 'A', status: 'sent', cliMsgId: 'cli-A2', finalText: 'x', source: 'manual', createdAt: now } as never);
    // Sign-ins on that day: KD1 and GS1 (twice) and the system; 5 active users.
    await t.db.col(C.auditLog).insertMany([
      { actor: 'TD-U-KD1', action: 'login', target: 'TD-U-KD1', at: new Date(at('08:00')) },
      { actor: 'TD-U-GS1', action: 'login', target: 'TD-U-GS1', at: new Date(at('08:05')) },
      { actor: 'TD-U-GS1', action: 'login', target: 'TD-U-GS1', at: new Date(at('13:00')) },
      { actor: 'system', action: 'login_denied', target: 'x@y.z', at: new Date(at('09:00')) },
    ] as never);
    clearSlaCache();
    t.app.get(AuthzService).invalidate();
    await t.app.get(MetricsService).run(DAY, DAY);
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    if (savedCache === undefined) delete process.env.SLA_CACHE_MS;
    else process.env.SLA_CACHE_MS = savedCache;
    await t?.close();
  });

  it('matches the hand calculation for nick 01', async () => {
    const r = await kpi('TD-U-QS', '&by=account');
    const n1 = r.rows.find((x) => x.uid === NK('01'))!;
    expect(n1).toMatchObject({ turns: 4, answered: 3, open: 1, breached: 3, over15: 3, over120: 2, viaVclinks: 1, fromPhone: 2, frtMedian: 20, frtP90: 150, pctBreached: 75, pctViaVclinks: 33.3 });
    const n2 = r.rows.find((x) => x.uid === NK('02'))!;
    expect(n2).toMatchObject({ turns: 1, answered: 1, open: 0, breached: 0, frtMedian: 5, pctBreached: 0 });
  });

  it('totals: FRT is the median of all answered turns, not an average of nicks', async () => {
    const r = await kpi('TD-U-QS');
    expect(r.totals).toMatchObject({ turns: 5, answered: 4, breached: 3, pctBreached: 60, frtMedian: 10, frtP90: 150, pctViaVclinks: 25 });
    expect(r.login).toMatchObject({ pctLoggedIn: 40 });
    expect(r.login!.days).toEqual([{ day: DAY, loggedIn: 2, active: 5 }]);
  });

  it('is idempotent: running again changes nothing and adds no documents', async () => {
    const before = await t.db.col(KPI_DAILY).countDocuments({});
    const a = await kpi('TD-U-QS');
    await t.app.get(MetricsService).run(DAY, DAY);
    expect(await t.db.col(KPI_DAILY).countDocuments({})).toBe(before);
    expect(before).toBe(2);
    const b = await kpi('TD-U-QS');
    expect(b.totals).toEqual(a.totals);
  });

  it('scope: a supervisor sees only the nicks of his scope, login share only for the whole company', async () => {
    const gs2 = await kpi('TD-U-GS2');
    expect(gs2.totals.turns).toBeLessThanOrEqual(1);
    expect(gs2.rows.every((x) => x.uid !== NK('01'))).toBe(true);
    expect(gs2.login).toBeNull();
    const gd = await kpi('TD-U-GD', '&by=account');
    expect(gd.login).toBeNull();
    expect(gd.rows.find((x) => x.uid === NK('01'))).toBeDefined();
  });

  it('a salesperson (scope CT, customers of mine: owner data lands with M1b-12) sees no nick numbers and cannot export', async () => {
    const r = await kpi('TD-U-KD1', '&by=account');
    expect(r.rows).toEqual([]);
    expect(r.login).toBeNull();
    await http().get('/api/metrics/kpi/export').set(as['TD-U-KD1']).expect(403);
  });

  it('CSV: one row per day and nick plus a total, no message text and no phone number', async () => {
    const res = await http().get(`/api/metrics/kpi/export?from=${DAY}&to=${DAY}`).set(as['TD-U-QS']).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const text = res.text;
    expect(text).toContain('Nick 01');
    expect(text.split('\r\n').filter(Boolean)).toHaveLength(1 + 2 + 1);
    expect(text).not.toContain('NOIDUNG-BI-MAT');
    expect(text).not.toMatch(/09\d{8}/);
    expect(text).not.toContain(NK('01'));
  });
});
