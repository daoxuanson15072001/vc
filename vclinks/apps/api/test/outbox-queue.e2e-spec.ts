import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { OutboxCounts, OutboxItem } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';
import { startOfDayVn } from '../src/outbox/outbox.service';

const UID = '5200';
const MIN = 60_000;

/**
 * M1a-05: outbox queue states (03 Sơ đồ 2): expired after 30 min (SZ-11),
 * awaiting_confirm when the nick reconnects (SZ-28), cancel, confirm, counts.
 */
describe('Outbox queue: expiry, reconnect hold, cancel, confirm (M1a-05)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  const tok: Record<'minh' | 'lan' | 'ingest', string> = { minh: '', lan: '', ingest: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_outbox_queue_test');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    tok.minh = await tokens.create('minh', ['dashboard']);
    tok.lan = await tokens.create('lan', ['dashboard']);
    tok.ingest = await tokens.create('ext', ['ingest']);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: 'Zalo test' }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await db.col(C.suggestions).deleteMany({});
    await db.col(C.messages).deleteMany({});
    await db.col(C.extensionPresence).deleteMany({});
  });

  /** Inserts an approved item as if Minh pressed Gửi `agoMs` ago. */
  const seed = async (agoMs: number, extra: Record<string, unknown> = {}) => {
    const at = new Date(Date.now() - agoMs);
    const _id = new ObjectId();
    await db.col(C.suggestions).insertOne({
      _id,
      uid: UID,
      threadId: '900',
      draft: 'Dạ anh',
      finalText: 'Dạ anh',
      status: 'approved',
      source: 'manual',
      approvedBy: 'minh',
      approvedAt: at,
      createdAt: at,
      statusAt: at,
      ...extra,
    });
    return _id.toHexString();
  };
  const status = async (id: string) => (await db.col(C.suggestions).findOne({ _id: new ObjectId(id) }))?.status;
  const pending = async () =>
    ((await http().get(`/api/outbox/pending?uid=${UID}&commands=1`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[]).map((x) => x.id);
  const presence = (agoMs: number, loggedIn: boolean | null = true) =>
    db.col(C.extensionPresence).updateOne({ _id: UID as never }, { $set: { lastSeenAt: new Date(Date.now() - agoMs), loggedIn } }, { upsert: true });

  it('SZ-11: an item waiting over 30 minutes becomes expired, is never handed out, and can be retried or cancelled', async () => {
    const old = await seed(31 * MIN);
    const fresh = await seed(10_000);
    await presence(5_000);
    expect(await pending()).toEqual([fresh]);
    expect(await status(old)).toBe('expired');
    const doc = await db.col(C.suggestions).findOne({ _id: new ObjectId(old) });
    // "Treo {n} phút" counts from the deadline, not from the sweep.
    expect((doc!.statusAt as Date).getTime()).toBe((doc!.approvedAt as Date).getTime() + 30 * MIN);
    await http().post(`/api/outbox/${old}/claim`).set(auth(tok.ingest)).expect(409);

    const retried = (await http().post(`/api/outbox/${old}/retry`).set(auth(tok.lan)).expect(200)).body as OutboxItem;
    expect(retried).toMatchObject({ status: 'approved', approvedBy: 'lan' });
    expect(Date.now() - Date.parse(retried.approvedAt)).toBeLessThan(5_000);

    const audit = await db.col(C.auditLog).find({ target: old }).sort({ at: 1 }).toArray();
    expect(audit.map((a) => a.action)).toEqual(['outbox.expired', 'outbox.retry']);
  });

  it('SZ-28 b: heartbeat after a red period holds items that waited > 2 min; younger ones are sent as usual', async () => {
    const waited = await seed(3 * MIN);
    const young = await seed(60_000);
    await presence(3 * MIN); // silent for 3 minutes: nick was red
    await http().get(`/api/fetch-requests/pending?uid=${UID}&loggedIn=1`).set(auth(tok.ingest)).expect(200);
    expect(await status(waited)).toBe('awaiting_confirm');
    expect(await status(young)).toBe('approved');
    expect(await pending()).toEqual([young]);
    const audit = await db.col(C.auditLog).find({ target: waited }).toArray();
    expect(audit.map((a) => a.action)).toEqual(['outbox.awaiting_confirm']);
  });

  it('SZ-28 b: the outbox poll itself detects the reconnect (no fresh heartbeat yet), including after a Zalo logout', async () => {
    const a = await seed(5 * MIN);
    expect(await pending()).toEqual([]); // no presence row at all
    expect(await status(a)).toBe('awaiting_confirm');

    const b = await seed(4 * MIN);
    await presence(1_000, false); // fresh but logged out → red
    await http().get(`/api/fetch-requests/pending?uid=${UID}&loggedIn=1`).set(auth(tok.ingest)).expect(200);
    expect(await status(b)).toBe('awaiting_confirm');
  });

  it('a nick that stayed online does not hold anything', async () => {
    const a = await seed(3 * MIN);
    await presence(10_000);
    await http().get(`/api/fetch-requests/pending?uid=${UID}&loggedIn=1`).set(auth(tok.ingest)).expect(200);
    expect(await pending()).toEqual([a]);
  });

  it('Gửi ngay: only the approver, as a re-approval; never past the 30-minute deadline', async () => {
    const id = await seed(5 * MIN, { status: 'awaiting_confirm' });
    expect(await pending()).toEqual([]);
    await http().post(`/api/outbox/${id}/confirm`).set(auth(tok.lan)).expect(403);
    const ok = (await http().post(`/api/outbox/${id}/confirm`).set(auth(tok.minh)).expect(200)).body as OutboxItem;
    expect(ok).toMatchObject({ status: 'approved', approvedBy: 'minh' });
    expect(Date.now() - Date.parse(ok.approvedAt)).toBeLessThan(5_000);
    await presence(1_000);
    expect(await pending()).toEqual([id]);
    await http().post(`/api/outbox/${id}/confirm`).set(auth(tok.minh)).expect(409);

    const late = await seed(31 * MIN, { status: 'awaiting_confirm' });
    await http().post(`/api/outbox/${late}/confirm`).set(auth(tok.minh)).expect(409);
    expect(await status(late)).toBe('expired');
  });

  it('cancel: from waiting / failed / expired / awaiting; never while sending; "copied" only while waiting', async () => {
    const waiting = await seed(10_000);
    const failed = await seed(10_000, { status: 'failed', error: 'x' });
    const sending = await seed(10_000, { status: 'sending', claimedAt: new Date() });
    const sent = await seed(10_000, { status: 'sent', sentAt: new Date() });

    const c = (await http().post(`/api/outbox/${waiting}/cancel`).set(auth(tok.minh)).send({ reason: 'copied' }).expect(200)).body as OutboxItem;
    expect(c).toMatchObject({ status: 'cancelled', cancelReason: 'copied' });
    await http().post(`/api/outbox/${failed}/cancel`).set(auth(tok.minh)).send({ reason: 'copied' }).expect(409);
    await http().post(`/api/outbox/${failed}/cancel`).set(auth(tok.minh)).send({}).expect(200);
    const busy = await http().post(`/api/outbox/${sending}/cancel`).set(auth(tok.minh)).send({}).expect(409);
    expect(busy.body.message).toContain('không bỏ được');
    await http().post(`/api/outbox/${sent}/cancel`).set(auth(tok.minh)).send({}).expect(409);
    await http().post(`/api/outbox/${sent}/cancel`).set(auth(tok.minh)).send({ reason: 'bogus' }).expect(400);
    await http().post(`/api/outbox/${waiting}/cancel`).set(auth(tok.ingest)).send({}).expect(403);

    // Cancelled items are gone from the default list and are never handed out.
    const list = (await http().get(`/api/outbox?uid=${UID}`).set(auth(tok.minh)).expect(200)).body as OutboxItem[];
    expect(list.map((x) => x.id).sort()).toEqual([sending, sent].sort());
    expect(await pending()).toEqual([]);
    const audit = await db.col(C.auditLog).findOne({ target: waiting, action: 'outbox.cancel' });
    expect(audit?.detail).toMatchObject({ reason: 'copied' });
  });

  it('claim counts attempts and stamps statusAt', async () => {
    const id = await seed(5_000);
    await presence(1_000);
    await http().post(`/api/outbox/${id}/claim`).set(auth(tok.ingest)).expect(200);
    await http().post(`/api/outbox/${id}/result`).set(auth(tok.ingest)).send({ ok: false, error: 'mismatch' }).expect(200);
    await http().post(`/api/outbox/${id}/retry`).set(auth(tok.minh)).expect(200);
    await http().post(`/api/outbox/${id}/claim`).set(auth(tok.ingest)).expect(200);
    const [it] = (await http().get(`/api/outbox?uid=${UID}`).set(auth(tok.minh)).expect(200)).body as OutboxItem[];
    expect(it).toMatchObject({ status: 'sending', attempts: 2 });
    expect(Date.now() - Date.parse(it.statusAt!)).toBeLessThan(5_000);
  });

  it('list: mine + status filters; attention statuses sort longest-hanging first', async () => {
    const f1 = await seed(10 * MIN, { status: 'failed', statusAt: new Date(Date.now() - 2 * MIN) });
    const f2 = await seed(9 * MIN, { status: 'failed', statusAt: new Date(Date.now() - 8 * MIN) });
    await seed(5_000, { approvedBy: 'lan' });
    const mine = (await http().get(`/api/outbox?mine=1&status=failed,expired`).set(auth(tok.minh)).expect(200)).body as OutboxItem[];
    expect(mine.map((x) => x.id)).toEqual([f2, f1]);
    const lan = (await http().get(`/api/outbox?mine=1`).set(auth(tok.lan)).expect(200)).body as OutboxItem[];
    expect(lan).toHaveLength(1);
    await http().get(`/api/outbox?status=nope`).set(auth(tok.minh)).expect(400);
  });

  it('counts: per status, attention badge, sent today (Asia/Ho_Chi_Minh), mine', async () => {
    await seed(10_000);
    await seed(10_000, { status: 'failed' });
    await seed(10_000, { status: 'awaiting_confirm' });
    await seed(31 * MIN); // expires on read
    await seed(10_000, { status: 'sent', sentAt: new Date() });
    await seed(10_000, { status: 'sent', sentAt: new Date(startOfDayVn(new Date()).getTime() - 1000) });
    await seed(10_000, { status: 'failed', approvedBy: 'lan' });
    const c = (await http().get('/api/outbox/counts?mine=1').set(auth(tok.minh)).expect(200)).body as OutboxCounts;
    expect(c).toEqual({ approved: 1, sending: 0, failed: 1, expired: 1, awaiting_confirm: 1, needs_reapproval: 0, sentToday: 1, attention: 3 });
    const all = (await http().get(`/api/outbox/counts?uid=${UID}`).set(auth(tok.minh)).expect(200)).body as OutboxCounts;
    expect(all.failed).toBe(2);
  });

  it('startOfDayVn: 00:00 UTC+7', () => {
    expect(startOfDayVn(new Date('2026-10-04T16:59:00Z')).toISOString()).toBe('2026-10-03T17:00:00.000Z');
    expect(startOfDayVn(new Date('2026-10-04T17:00:00Z')).toISOString()).toBe('2026-10-04T17:00:00.000Z');
  });

  it('SZ-28 d: awaiting items carry the newest phone-sent message of the thread after the item was created', async () => {
    const createdAt = new Date(Date.now() - 5 * MIN);
    const id = await seed(5 * MIN, { status: 'awaiting_confirm' });
    await db.col(C.suggestions).insertOne({
      _id: new ObjectId(), uid: UID, threadId: '900', draft: 'v', finalText: 'v', status: 'sent', source: 'manual',
      approvedBy: 'minh', approvedAt: createdAt, createdAt, cliMsgId: 'via-vclinks', sentAt: new Date(),
    });
    await db.col(C.messages).insertMany([
      { _id: `${UID}:a` as never, uid: UID, threadId: '900', fromUid: '0', cliMsgId: 'before', text: 'cũ', sentAt: new Date(createdAt.getTime() - 1000) },
      { _id: `${UID}:b` as never, uid: UID, threadId: '900', fromUid: '0', cliMsgId: 'phone', text: 'x'.repeat(80), sentAt: new Date(createdAt.getTime() + MIN) },
      { _id: `${UID}:c` as never, uid: UID, threadId: '900', fromUid: '0', cliMsgId: 'via-vclinks', text: 'v', sentAt: new Date(createdAt.getTime() + 2 * MIN) },
      { _id: `${UID}:d` as never, uid: UID, threadId: '900', fromUid: '777', cliMsgId: 'khach', text: 'k', sentAt: new Date(createdAt.getTime() + 3 * MIN) },
    ]);
    const list = (await http().get(`/api/outbox?uid=${UID}&status=awaiting_confirm`).set(auth(tok.minh)).expect(200)).body as OutboxItem[];
    const it = list.find((x) => x.id === id)!;
    expect(it.phoneDuplicate).toEqual({ at: new Date(createdAt.getTime() + MIN).toISOString(), preview: 'x'.repeat(60) });
  });

  it('00 §3.3a: own messages without an outbox item are marked fromPhone', async () => {
    await seed(MIN, { status: 'sent', cliMsgId: 'via', sentAt: new Date() });
    await db.col(C.messages).insertMany([
      { _id: `${UID}:p1` as never, uid: UID, threadId: '900', msgId: 'p1', fromUid: '0', cliMsgId: 'via', text: 'a', sentAt: new Date(1000) },
      { _id: `${UID}:p2` as never, uid: UID, threadId: '900', msgId: 'p2', fromUid: '0', cliMsgId: 'phone', text: 'b', sentAt: new Date(2000) },
      { _id: `${UID}:p3` as never, uid: UID, threadId: '900', msgId: 'p3', fromUid: '777', cliMsgId: 'k', text: 'c', sentAt: new Date(3000) },
    ]);
    const page = (await http().get(`/api/conversations/${UID}:900/messages`).set(auth(tok.minh)).expect(200)).body;
    expect(page.items.map((m: { msgId: string; fromPhone?: boolean }) => [m.msgId, !!m.fromPhone])).toEqual([
      ['p1', false],
      ['p2', true],
      ['p3', false],
    ]);
  });
});
