import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import type { RealtimeEvent } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { clearSlaCache } from '../../src/conversations/inbox-state';
import { C } from '../../src/db/db.service';
import { runAsTenant } from '../../src/db/tenant-context';
import { SlaMonitorService } from '../../src/realtime/sla-monitor.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1c-07: realtime SSE and the SLA watch.
 * (1) a customer message shows on the Dashboard stream within 5 s of the API accepting it, only for users
 *     who may see that nick (data scope), and the payload carries ids only;
 * (2) a wait past the SLA notifies the supervisor inside working hours, once, and stays silent outside them.
 */
const NK = (n: string) => `90000000000${n}`;
const MIN = 60_000;
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
];
const MANAGERS: Record<string, string> = { 'TD-DV-VCP': 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1' };
const USERS: [string, string, string, string][] = [
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-GS1', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
];
const ALL_DAY: [string, string][] = [['00:00', '24:00']];
const calendar = (windows: [string, string][]) => ({
  weekdays: Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, windows])),
  holidays: [],
});

interface Stream {
  events: RealtimeEvent[];
  ended: () => boolean;
  raw: () => string;
  close(): void;
}

describe('realtime SSE and SLA watch (e2e, M1c-07)', () => {
  let t: E2EApp;
  let port = 0;
  const http$ = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const saved = { division: process.env.AUTHZ_DEFAULT_DIVISION, cache: process.env.SLA_CACHE_MS, poll: process.env.REALTIME_POLL_MS, recheck: process.env.REALTIME_RECHECK_MS };
  const streams: Stream[] = [];

  const open = (headers: Record<string, string>): Promise<Stream> =>
    new Promise((resolve, reject) => {
      const events: RealtimeEvent[] = [];
      let buf = '';
      let all = '';
      let ended = false;
      const req = http.request({ host: '127.0.0.1', port, path: '/api/realtime/stream', headers }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          buf += chunk;
          all += chunk;
          let i: number;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const data = block.split('\n').find((l) => l.startsWith('data: '));
            if (data) events.push(JSON.parse(data.slice(6)) as RealtimeEvent);
          }
        });
        res.on('end', () => (ended = true));
        const s: Stream = { events, ended: () => ended, raw: () => all, close: () => req.destroy() };
        streams.push(s);
        // Give the server a moment to register the subscription.
        setTimeout(() => resolve(s), 150);
      });
      req.on('error', (e) => (e as NodeJS.ErrnoException).code === 'ECONNRESET' || reject(e));
      req.end();
    });
  const until = async (cond: () => boolean, ms: number) => {
    const t0 = Date.now();
    while (!cond() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 50));
    return Date.now() - t0;
  };
  const msg = (uid: string, threadId: string, id: string, minutesAgo: number) => ({
    msgId: id, threadId, fromUid: threadId, toUid: uid, senderName: 'Khách', msgType: 'webchat', text: `nội dung bí mật ${id}`, sentAt: Date.now() - minutesAgo * MIN,
  });
  const ingest = (uid: string, ...items: ReturnType<typeof msg>[]) => http$().post('/api/ingest/messages').set(t.auth.ingest).send({ uid, items }).expect(200);
  const seedThread = (uid: string, thread: string) =>
    http$().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid, items: [{ threadId: thread, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
  const setCalendar = async (windows: [string, string][]) => {
    await t.db.col('sla_settings').updateOne({ _id: 'default' } as never, { $set: { slaMinutes: 15, warnRatio: 0.25, calendar: calendar(windows) } }, { upsert: true });
    clearSlaCache();
  };

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    process.env.SLA_CACHE_MS = '0';
    process.env.REALTIME_POLL_MS = '200';
    process.env.REALTIME_RECHECK_MS = '300';
    t = await startE2EApp();
    port = (t.app.getHttpServer().address() as AddressInfo).port;
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : parentId,
        managerUserId: MANAGERS[id] ?? null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never);
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    await setCalendar(ALL_DAY);
    for (const [uid, holder] of [[NK('01'), 'TD-U-KD1'], [NK('02'), 'TD-U-KD2']] as const) {
      await http$().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
    }
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    for (const s of streams) s.close();
    process.env.AUTHZ_DEFAULT_DIVISION = saved.division;
    for (const [k, v] of [['SLA_CACHE_MS', saved.cache], ['REALTIME_POLL_MS', saved.poll], ['REALTIME_RECHECK_MS', saved.recheck]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await t?.close();
  });

  it('rejects an anonymous stream', async () => {
    await http$().get('/api/realtime/stream').expect(401);
  });

  it('shows a new message within 5 s, only to users who may see the nick, with ids only', async () => {
    await seedThread(NK('01'), 'R1');
    const kd1 = await open(as['TD-U-KD1']!);
    const kd2 = await open(as['TD-U-KD2']!);
    const gd = await open(as['TD-U-GD']!);
    const sent = Date.now();
    await ingest(NK('01'), msg(NK('01'), 'R1', 'R1-1', 0));
    const waited = await until(() => kd1.events.some((e) => e.type === 'message.new'), 5000);
    expect(Date.now() - sent).toBeLessThan(5000);
    expect(waited).toBeLessThan(5000);
    expect(kd1.events.find((e) => e.type === 'message.new')).toMatchObject({ uid: NK('01'), threadId: 'R1', id: `${NK('01')}:R1` });
    await until(() => gd.events.some((e) => e.type === 'message.new'), 3000);
    expect(gd.events.some((e) => e.type === 'message.new')).toBe(true);
    // Linh holds the other nick: she gets nothing about Minh's conversation.
    await new Promise((r) => setTimeout(r, 1200));
    expect(kd2.events.filter((e) => e.type === 'message.new')).toHaveLength(0);
    // No message text or name travels on the stream.
    expect(kd1.raw()).not.toContain('bí mật');
    expect(kd1.raw()).not.toContain('Khách');
  });

  it('does not announce old history or the nick\'s own messages', async () => {
    await seedThread(NK('01'), 'R2');
    const kd1 = await open(as['TD-U-KD1']!);
    await ingest(NK('01'), msg(NK('01'), 'R2', 'R2-old', 120), { ...msg(NK('01'), 'R2', 'R2-own', 0), fromUid: '0' });
    await new Promise((r) => setTimeout(r, 1000));
    expect(kd1.events.filter((e) => e.threadId === 'R2')).toHaveLength(0);
  });

  it('pushes a red nick only to users who may see it', async () => {
    const kd1 = await open(as['TD-U-KD1']!);
    const kd2 = await open(as['TD-U-KD2']!);
    await http$().post(`/api/accounts/${NK('01')}/session`).set(t.auth.ingest).send({ state: 'lost', reason: 'qr' }).expect((r) => expect(r.status).toBeLessThan(300));
    await until(() => kd1.events.some((e) => e.type === 'account.red'), 5000);
    expect(kd1.events.find((e) => e.type === 'account.red')).toMatchObject({ uid: NK('01') });
    await new Promise((r) => setTimeout(r, 800));
    expect(kd2.events.some((e) => e.type === 'account.red')).toBe(false);
  });

  it('ends an open stream when the session is revoked (lock / offboarding)', async () => {
    const sessions = t.app.get(SessionService);
    const token = await sessions.create({ _id: 'TD-U-KD2', fullName: 'Trần Thùy Linh' });
    const s = await open({ Authorization: `Bearer ${token}` });
    expect(s.ended()).toBe(false);
    await sessions.revoke(token);
    await until(() => s.ended(), 3000);
    expect(s.ended()).toBe(true);
  });

  describe('SLA watch', () => {
    const notices = async (userId: string) => t.db.col('notifications').find({ userId, kind: 'sla_breach' } as never).toArray();
    const sweep = (at = new Date()) => runAsTenant('default', () => t.app.get(SlaMonitorService).sweep(at));

    it('says nothing outside working hours, notifies the supervisor once inside them', async () => {
      await seedThread(NK('01'), 'S1');
      await ingest(NK('01'), msg(NK('01'), 'S1', 'S1-1', 20));
      // Closed: no working window at all.
      await setCalendar([]);
      expect(await sweep()).toBe(0);
      expect(await notices('TD-U-GS1')).toHaveLength(0);
      // Open: 20 minutes without an answer, SLA 15.
      await setCalendar(ALL_DAY);
      const gs = await open(as['TD-U-GS1']!);
      expect(await sweep()).toBeGreaterThanOrEqual(1);
      const got = await notices('TD-U-GS1');
      expect(got).toHaveLength(1);
      expect(got[0]!.title).not.toContain('bí mật');
      expect(got[0]!.link).toContain(encodeURIComponent(`${NK('01')}:S1`));
      // The notice also arrives on the supervisor's stream; the nick holder gets none.
      await until(() => gs.events.some((e) => e.type === 'notification' && e.kind === 'sla_breach'), 4000);
      expect(gs.events.some((e) => e.type === 'notification' && e.kind === 'sla_breach')).toBe(true);
      expect(await notices('TD-U-KD1')).toHaveLength(0);
      // Once per wait.
      expect(await sweep()).toBe(0);
      expect(await notices('TD-U-GS1')).toHaveLength(1);
    });

    it('Q14: a wait whose deadline passed more than 3 days ago is not announced; one from 2 days ago is', async () => {
      await setCalendar(ALL_DAY);
      await seedThread(NK('01'), 'S-OLD');
      await ingest(NK('01'), msg(NK('01'), 'S-OLD', 'S-OLD-1', 5 * 24 * 60));
      const before = (await notices('TD-U-GS1')).length;
      expect(await sweep()).toBe(0);
      expect(await notices('TD-U-GS1')).toHaveLength(before);
      await seedThread(NK('01'), 'S-RECENT');
      await ingest(NK('01'), msg(NK('01'), 'S-RECENT', 'S-RECENT-1', 2 * 24 * 60));
      expect(await sweep()).toBe(1);
      expect(await notices('TD-U-GS1')).toHaveLength(before + 1);
    });

    it('does not notify for a wait still inside the SLA', async () => {
      await seedThread(NK('02'), 'S2');
      await ingest(NK('02'), msg(NK('02'), 'S2', 'S2-1', 5));
      const before = (await notices('TD-U-GS1')).length;
      await sweep();
      expect(await notices('TD-U-GS1')).toHaveLength(before);
    });
  });
});
