import request from 'supertest';
import { type ConversationInboxFields, type ConversationListItem, type InboxSummary } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { clearSlaCache } from '../../src/conversations/inbox-state';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-09: inbox by scope, owner, "chưa trả lời" and SLA on the TD data (docs 03 SZ-21, UAT-SZ-86/87,
 * 01 UAT-PQ-15 NVKD sees only his nick), plus the outbox buttons checked like creating the item.
 * The division works 24/7 here so the SLA minutes are exact whatever time the suite runs.
 */
const NK = (n: string) => `90000000000${n}`;
const MIN = 60_000;
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', 'TD-DV-VCP'],
];
const MANAGERS: Record<string, string> = { 'TD-DV-VCP': 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1', 'TD-DV-HN2': 'TD-U-GS2' };
const USERS: [string, string, string, string][] = [
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-GS1', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-GS2', 'Hồ Văn Đức', 'giam_sat_bh', 'TD-DV-HN2'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-QS', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
];
const ALL_DAY: [string, string][] = [['00:00', '24:00']];

describe('inbox: scopes, owner, unanswered, SLA (e2e, M1b-09)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;
  const saved = { cache: process.env.SLA_CACHE_MS };
  const msg = (uid: string, threadId: string, id: string, from: 'customer' | 'nick', minutesAgo: number) => ({
    msgId: id,
    threadId,
    fromUid: from === 'customer' ? threadId : '0',
    toUid: from === 'customer' ? uid : threadId,
    senderName: from === 'customer' ? 'Khách' : 'Nick',
    msgType: 'webchat',
    text: `tin ${id}`,
    sentAt: Date.now() - minutesAgo * MIN,
  });
  const ingest = async (uid: string, ...items: ReturnType<typeof msg>[]) => {
    await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid, items }).expect(200);
  };
  const list = async (who: string, query = '') =>
    (await http().get(`/api/conversations${query}`).set(as[who]).expect(200)).body as { total: number; items: (ConversationListItem & ConversationInboxFields)[] };
  const ids = async (who: string, query = '') => (await list(who, query)).items.map((i) => i.threadId);

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    process.env.SLA_CACHE_MS = '0';
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
    const allDay = { '0': ALL_DAY, '1': ALL_DAY, '2': ALL_DAY, '3': ALL_DAY, '4': ALL_DAY, '5': ALL_DAY, '6': ALL_DAY };
    await t.db.col('sla_settings').insertOne({ _id: 'default', slaMinutes: 15, warnRatio: 0.25, calendar: { weekdays: allDay, holidays: [] } } as never);

    for (const [uid, holder] of [[NK('01'), 'TD-U-KD1'], [NK('02'), 'TD-U-KD2']] as const) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
    }
    // TD-K05 / K07 / K15 on Minh's nick: customer messages 5, 12 and 20 minutes ago (UAT-SZ-87).
    for (const [thread, ago] of [['K05', 5], ['K07', 12], ['K15', 20]] as const) {
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid: NK('01'), items: [{ threadId: thread, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
      await ingest(NK('01'), msg(NK('01'), thread, `${thread}-1`, 'customer', ago));
    }
    // K20: answered. K30 on Linh's nick: waiting.
    await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid: NK('01'), items: [{ threadId: 'K20', type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
    await ingest(NK('01'), msg(NK('01'), 'K20', 'K20-1', 'customer', 30), msg(NK('01'), 'K20', 'K20-2', 'nick', 25));
    await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid: NK('02'), items: [{ threadId: 'K30', type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
    await ingest(NK('02'), msg(NK('02'), 'K30', 'K30-1', 'customer', 40));
    // An official channel conversation nobody took, and one assigned to Linh.
    const OA = 'zoa_9000000000101';
    await t.db.col(C.accounts).insertOne({ _id: OA, label: 'VCparts OA', channel: 'zalo_oa' } as never);
    await t.db.col('channel_access').insertOne({ _id: `${OA}:user:TD-U-GD:gui`, channelId: OA, principalType: 'user', principalId: 'TD-U-GD', level: 'gui', createdBy: 'seed' } as never);
    for (const thread of ['O1', 'O2']) {
      await t.db.col(C.conversations).insertOne({ _id: `${OA}:${thread}`, uid: OA, threadId: thread, type: 'user', lastMsgAt: now, unread: 0 } as never);
    }
    await t.db.col(C.conversations).updateOne({ _id: `${OA}:O2` } as never, { $set: { assigneeId: 'TD-U-KD2' } });
    clearSlaCache();
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    if (saved.cache === undefined) delete process.env.SLA_CACHE_MS;
    await t?.close();
  });

  describe('chưa trả lời (SZ-21)', () => {
    it('waits since the first customer message; a conversation the nick answered is not waiting', async () => {
      expect((await ids('TD-U-KD1', '?scope=mine&unanswered=1')).sort()).toEqual(['K05', 'K07', 'K15']);
      const k20 = (await list('TD-U-KD1', '?scope=mine')).items.find((i) => i.threadId === 'K20')!;
      expect(k20.unansweredSince).toBeNull();
      expect(k20.sla).toBeNull();
    });

    it('sorts "chờ lâu nhất" first, and the wait is the real send time', async () => {
      const r = await list('TD-U-KD1', '?scope=mine&unanswered=1');
      expect(r.items.map((i) => i.threadId)).toEqual(['K15', 'K07', 'K05']);
      const waited = Date.now() - Date.parse(r.items[0]!.unansweredSince!);
      expect(waited).toBeGreaterThan(19 * MIN);
      expect(waited).toBeLessThan(21 * MIN);
    });

    it('UAT-SZ-87: SLA 15 min: 5 min no chip, 12 min "⏰ 3′", 20 min "Quá 5′"', async () => {
      const by = Object.fromEntries((await list('TD-U-KD1', '?scope=mine&unanswered=1')).items.map((i) => [i.threadId, i.sla]));
      expect(by.K05).toMatchObject({ level: 'ok' });
      expect(by.K05!.text).toBeUndefined();
      expect(by.K07).toMatchObject({ level: 'warn', text: '⏰ 3′' });
      expect(by.K15).toMatchObject({ level: 'over', text: 'Quá 5′' });
      expect(await ids('TD-U-KD1', '?scope=mine&overSla=1')).toEqual(['K15']);
    });

    it('a reply typed on the phone (fromUid 0) ends the wait and stops the SLA', async () => {
      await ingest(NK('01'), msg(NK('01'), 'K15', 'K15-2', 'nick', 2));
      expect((await ids('TD-U-KD1', '?scope=mine&unanswered=1')).sort()).toEqual(['K05', 'K07']);
      expect(await ids('TD-U-KD1', '?scope=mine&overSla=1')).toEqual([]);
      const k15 = (await list('TD-U-KD1', '?scope=mine')).items.find((i) => i.threadId === 'K15')!;
      expect(k15).toMatchObject({ unansweredSince: null, sla: null });
      // The customer writes again: waiting restarts from the new message, not the old one.
      await ingest(NK('01'), msg(NK('01'), 'K15', 'K15-3', 'customer', 1));
      const again = (await list('TD-U-KD1', '?scope=mine')).items.find((i) => i.threadId === 'K15')!;
      expect(Date.now() - Date.parse(again.unansweredSince!)).toBeLessThan(2 * MIN);
    });
  });

  describe('scopes and owner', () => {
    it('NVKD sees only the conversations of his nick, in every scope (UAT-PQ-15)', async () => {
      expect((await ids('TD-U-KD1')).sort()).toEqual(['K05', 'K07', 'K15', 'K20']);
      expect((await ids('TD-U-KD1', '?scope=all')).sort()).toEqual(['K05', 'K07', 'K15', 'K20']);
      expect(await ids('TD-U-KD1', '?scope=unassigned')).toEqual([]);
      expect(await ids('TD-U-KD1', `?scope=all&uid=${NK('02')}`)).toEqual([]);
      const s = (await http().get('/api/conversations/inbox').set(as['TD-U-KD1']).expect(200)).body as InboxSummary;
      expect(s.scopes).toEqual(['mine']);
      expect(s.unanswered).toBe(3);
    });

    it('owner is the nick holder (personal) or the assignee (official)', async () => {
      const r = await list('TD-U-GD', '?scope=all');
      const owner = Object.fromEntries(r.items.map((i) => [i.threadId, i.ownerId ?? null]));
      expect(owner).toMatchObject({ K05: 'TD-U-KD1', K30: 'TD-U-KD2', O1: null, O2: 'TD-U-KD2' });
      expect(r.items.find((i) => i.threadId === 'K05')!.ownerName).toBe('Nguyễn Văn Minh');
    });

    it('director: "Của tôi" is empty, "Tất cả" the division, filter by owner and "Chưa phân công"', async () => {
      expect(await ids('TD-U-GD', '?scope=mine')).toEqual([]);
      expect((await ids('TD-U-GD', '?scope=all')).sort()).toEqual(['K05', 'K07', 'K15', 'K20', 'K30', 'O1', 'O2']);
      expect((await ids('TD-U-GD', '?scope=all&ownerId=TD-U-KD2')).sort()).toEqual(['K30', 'O2']);
      expect(await ids('TD-U-GD', '?scope=unassigned')).toEqual(['O1']);
      // The team supervisor sees his team's nicks, not the official channel.
      expect((await ids('TD-U-GS1', '?scope=all')).sort()).toEqual(['K05', 'K07', 'K15', 'K20', 'K30']);
      // "Của tôi" also holds conversations assigned to the person (official channels), while visible to him.
      const o1 = `zoa_9000000000101:O1`;
      await t.db.col(C.conversations).updateOne({ _id: o1 } as never, { $set: { assigneeId: 'TD-U-GD' } });
      expect(await ids('TD-U-GD', '?scope=mine')).toEqual(['O1']);
      expect(await ids('TD-U-GD', '?scope=unassigned')).toEqual([]);
      await t.db.col(C.conversations).updateOne({ _id: o1 } as never, { $unset: { assigneeId: '' } });
    });

    it('supervisor bar: scopes, counters and unanswered per owner (MH-SZ-01 #4b, #4c)', async () => {
      const s = (await http().get('/api/conversations/inbox').set(as['TD-U-GD']).expect(200)).body as InboxSummary;
      expect(s.scopes).toEqual(['mine', 'unassigned', 'all']);
      expect(s.counts).toMatchObject({ mine: 0, unassigned: 1, all: 7 });
      expect(s.unanswered).toBe(4);
      expect(s.byOwner[0]).toMatchObject({ userId: 'TD-U-KD1', count: 3 });
      expect(s.byOwner[1]).toMatchObject({ userId: 'TD-U-KD2', count: 1 });
      expect(s.overSla).toBe(1);
    });

    it('another team supervisor sees nothing of this team', async () => {
      expect(await ids('TD-U-GS2', '?scope=all')).toEqual([]);
    });
  });

  describe('outbox buttons check the nick like creating the item', () => {
    let itemId: string;
    beforeAll(async () => {
      const r = await http().post('/api/outbox').set(as['TD-U-KD1']).send({ uid: NK('01'), threadId: 'K05', text: 'Dạ em chào anh' }).expect(201);
      itemId = r.body.id;
      await t.db.col(C.suggestions).updateOne({ _id: new (require('mongodb').ObjectId)(itemId) } as never, { $set: { status: 'failed', error: 'x' } });
    });
    const status = async () => (await t.db.col(C.suggestions).findOne({ _id: new (require('mongodb').ObjectId)(itemId) } as never))?.status;

    it('someone who can read the item but not send on that nick (Kiểm soát) is refused, the item is untouched', async () => {
      for (const action of ['retry', 'confirm', 'cancel']) {
        await http().post(`/api/outbox/${itemId}/${action}`).set(as['TD-U-QS']).send({}).expect(403);
      }
      expect(await status()).toBe('failed');
    });

    it('people outside the data scope do not even find the item', async () => {
      for (const who of ['TD-U-GS2', 'TD-U-KD2']) {
        for (const action of ['retry', 'confirm', 'cancel']) await http().post(`/api/outbox/${itemId}/${action}`).set(as[who]).send({}).expect(404);
      }
      expect(await status()).toBe('failed');
    });

    it('a nick flagged unsafe locks the buttons for its holder too', async () => {
      await t.db.col(C.accounts).updateOne({ _id: NK('01') } as never, { $set: { unsafe: true } });
      t.app.get(AuthzService).invalidate();
      await http().post(`/api/outbox/${itemId}/retry`).set(as['TD-U-KD1']).expect(403);
      await t.db.col(C.accounts).updateOne({ _id: NK('01') } as never, { $unset: { unsafe: '' } });
      t.app.get(AuthzService).invalidate();
    });

    it('the holder retries and cancels his own command', async () => {
      await http().post(`/api/outbox/${itemId}/retry`).set(as['TD-U-KD1']).expect(200);
      expect(await status()).toBe('approved');
      await http().post(`/api/outbox/${itemId}/cancel`).set(as['TD-U-KD1']).send({}).expect(200);
      expect(await status()).toBe('cancelled');
    });
  });

  describe('Xong / Mở lại (plan B2)', () => {
    const K05 = encodeURIComponent(`${NK('01')}:K05`);

    it('closes with an outcome: out of Cần trả lời, listed under Đã xong with who and why, logged', async () => {
      await http().post(`/api/conversations/${K05}/done`).set(as['TD-U-KD1']).send({ outcome: 'hoi_gia' }).expect(200);
      expect(await ids('TD-U-KD1', '?scope=mine&unanswered=1')).not.toContain('K05');
      const done = await list('TD-U-KD1', '?scope=mine&state=done');
      expect(done.items.map((i) => i.threadId)).toEqual(['K05']);
      expect(done.items[0]!.done).toMatchObject({ outcome: 'hoi_gia', byName: 'Nguyễn Văn Minh' });
      expect(await ids('TD-U-KD1', '?scope=mine&state=waiting')).toContain('K20');
      expect(await ids('TD-U-KD1', '?scope=mine&state=waiting')).not.toContain('K05');
      const log = await t.db.col(C.auditLog).findOne({ action: 'conversation.done', target: `${NK('01')}:K05` } as never);
      expect(log).toMatchObject({ actor: 'user:TD-U-KD1', detail: { outcome: 'hoi_gia' } });
    });

    it('rejects an unknown outcome and refuses people outside the conversation', async () => {
      await http().post(`/api/conversations/${K05}/done`).set(as['TD-U-KD1']).send({ outcome: 'xyz' }).expect(400);
      const res = await http().post(`/api/conversations/${encodeURIComponent(`${NK('02')}:K30`)}/done`).set(as['TD-U-KD1']).send({});
      expect([403, 404]).toContain(res.status);
    });

    it('a new customer message reopens it by itself; Mở lại reopens by hand', async () => {
      await ingest(NK('01'), msg(NK('01'), 'K05', 'K05-2', 'customer', 0));
      expect(await ids('TD-U-KD1', '?scope=mine&unanswered=1')).toContain('K05');
      expect(await ids('TD-U-KD1', '?scope=mine&state=done')).toEqual([]);
      // Closed again, then reopened by hand.
      await http().post(`/api/conversations/${K05}/done`).set(as['TD-U-KD1']).send({}).expect(200);
      await http().post(`/api/conversations/${K05}/reopen`).set(as['TD-U-KD1']).send({}).expect(200);
      const k05 = (await list('TD-U-KD1', '?scope=mine')).items.find((i) => i.threadId === 'K05')!;
      expect(k05.done).toBeNull();
      expect(k05.unansweredSince).not.toBeNull();
    });
  });

  describe('tên từ danh bạ khi Zalo mã hóa (tên đọc từ màn hình)', () => {
    const K15 = encodeURIComponent(`${NK('01')}:K15`);
    beforeAll(async () => {
      // A friend whose IndexedDB record is ciphertext but whose name was read from the Zalo friend list.
      await t.db.col(C.contacts).insertOne({ _id: `${NK('01')}:K15`, uid: NK('01'), userId: 'K15', encrypted: true, domName: 'Khách Mười Lăm', domAvatar: 'https://example.test/a.png' } as never);
      await ingest(NK('01'), { ...msg(NK('01'), 'K15', 'K15-nn', 'customer', 1), senderName: undefined as never });
    });

    it('the conversation takes the friend-list name and avatar when the sidebar gave none', async () => {
      const k15 = (await list('TD-U-KD1', '?scope=mine')).items.find((i) => i.threadId === 'K15')!;
      expect(k15.name).toBe('Khách Mười Lăm');
      expect(k15.avatar).toBe('https://example.test/a.png');
    });

    it('a message without a bubble name shows the friend-list name; one with a bubble name keeps it', async () => {
      const r = (await http().get(`/api/conversations/${K15}/messages`).set(as['TD-U-KD1']).expect(200)).body as { items: { msgId: string; senderName: string | null }[] };
      expect(r.items.find((m) => m.msgId === 'K15-nn')?.senderName).toBe('Khách Mười Lăm');
      expect(r.items.find((m) => m.msgId === 'K15-1')?.senderName).toBe('Khách');
    });

    it('the list preview names the last sender from the friend list too', async () => {
      const k15 = (await list('TD-U-KD1', '?scope=mine')).items.find((i) => i.threadId === 'K15')!;
      expect(k15.lastMessage?.senderName).toBe('Khách Mười Lăm');
    });
  });
});
