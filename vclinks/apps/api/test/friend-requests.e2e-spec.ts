import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { ContactGroupsResponse, FriendRequestListResponse, OutboxItem } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';

const UID = '5400';

/**
 * M1a-04: friend requests (MH-SZ-10, QT-SZ-12, SZ-09): the lists read from
 * Zalo Web, accept / reject / new-request commands, the 30 s gap and the daily
 * limit (held, never dropped), the contact that exists once a request is accepted.
 */
describe('Friend requests (M1a-04)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  const tok: Record<'minh' | 'ingest', string> = { minh: '', ingest: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_friend_test');
    process.env.FRIEND_TARGETS = '*';
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    tok.minh = await tokens.create('minh', ['dashboard']);
    tok.ingest = await tokens.create('ext', ['ingest']);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: 'Zalo test' }).expect(201);
  });

  afterAll(async () => {
    delete process.env.FRIEND_TARGETS;
    await app?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    for (const c of [C.suggestions, C.friendRequests, C.contacts, C.extensionPresence, C.auditLog]) await db.col(c).deleteMany({});
    await db.col('friend_request_lists').deleteMany({});
    // The nick is green: a fresh heartbeat, so nothing is held after a reconnect.
    await db.col(C.extensionPresence).updateOne({ _id: UID as never }, { $set: { lastSeenAt: new Date(), loggedIn: true } }, { upsert: true });
  });

  const read = (direction: 'received' | 'sent', items: unknown[], extra: Record<string, unknown> = {}) =>
    http().post(`/api/contacts/${UID}/friend-requests/dom`).set(auth(tok.ingest)).send({ direction, complete: true, items, ...extra });
  const list = async (direction = 'received', status?: string) =>
    (await http().get('/api/friend-requests').query({ uid: UID, direction, ...(status ? { status } : {}) }).set(auth(tok.minh)).expect(200)).body as FriendRequestListResponse;
  const create = (body: Record<string, unknown>) => http().post('/api/outbox').set(auth(tok.minh)).send({ uid: UID, ...body });
  const pending = async () =>
    ((await http().get(`/api/outbox/pending?uid=${UID}&commands=1`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[]).map((x) => x.id);
  const status = async (id: string) => (await db.col(C.suggestions).findOne({ _id: new ObjectId(id) }))?.status;
  const invite = (userId: string, name: string, extra: Record<string, unknown> = {}) => ({ userId, name, message: `Chào, mình là ${name}`, source: 'Từ số điện thoại', dateText: '03/08', ...extra });

  it('stores the received list, keeps its order, and marks requests that vanished from a complete read as gone', async () => {
    await read('received', [invite('11', 'Hoàng Đạt'), invite('12', 'Hương'), { name: 'không có id' }], { count: 2 }).expect(200).expect({ stored: 2, rejected: 1 });
    const r = await list();
    expect(r.items.map((i) => i.name)).toEqual(['Hoàng Đạt', 'Hương']);
    expect(r).toMatchObject({ pending: 2, zaloCount: 2 });
    expect(r.items[0]).toMatchObject({ message: 'Chào, mình là Hoàng Đạt', source: 'Từ số điện thoại', status: 'pending' });
    // Same rows again: nothing duplicated.
    await read('received', [invite('11', 'Hoàng Đạt'), invite('12', 'Hương')], { count: 2 }).expect(200);
    expect(await db.col(C.friendRequests).countDocuments({})).toBe(2);
    // Hương is handled on the phone: absent from the next complete read.
    await read('received', [invite('11', 'Hoàng Đạt')], { count: 1 }).expect(200);
    expect((await list()).items.map((i) => i.name)).toEqual(['Hoàng Đạt']);
    expect((await list('received', 'gone')).items.map((i) => i.name)).toEqual(['Hương']);
    // A partial read (Xem thêm not finished) never marks anything gone.
    await read('sent', [invite('21', 'A'), invite('22', 'B'), invite('23', 'C')], { count: 71 }).expect(200);
    await read('sent', [invite('21', 'A')], { count: 71 }).expect(200);
    expect((await list('sent')).pending).toBe(3);
  });

  it('rejects secrets and unknown fields in a row (strict schema)', async () => {
    await read('received', [{ userId: '1', name: 'A', token: 'x' }]).expect(200).expect({ stored: 0, rejected: 1 });
    await http().post(`/api/contacts/${UID}/friend-requests/dom`).set(auth(tok.minh)).send({ direction: 'received', items: [] }).expect(403);
  });

  it('accept: approved command → extension claims → result → request accepted and the contact has a profile (alias first)', async () => {
    await read('received', [invite('11', 'Hoàng Đạt')]);
    const made = (await create({ threadId: '11', action: 'friend_accept', friend: { userId: '11', name: 'Hoàng Đạt', alias: 'Đạt gara', greeting: 'Chào anh Đạt' } }).expect(201)).body as OutboxItem;
    expect(made).toMatchObject({ action: 'friend_accept', text: '[Kết bạn] Hoàng Đạt', status: 'approved', approvedBy: 'minh', friend: { alias: 'Đạt gara' } });
    expect((await list()).items[0].commandStatus).toBe('approved');
    // Second command for the same request is refused while the first waits.
    await create({ threadId: '11', action: 'friend_reject', friend: { userId: '11', name: 'Hoàng Đạt' } }).expect(409);

    const [item] = (await http().get(`/api/outbox/pending?uid=${UID}&commands=1`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[];
    expect(item).toMatchObject({ id: made.id, friend: { userId: '11', greeting: 'Chào anh Đạt' } });
    await http().post(`/api/outbox/${made.id}/claim`).set(auth(tok.ingest)).expect(200);
    await http().post(`/api/outbox/${made.id}/result`).set(auth(tok.ingest)).send({ ok: true, sentAt: new Date().toISOString() }).expect(200);

    expect((await list()).items).toEqual([]);
    expect((await list('received', 'accepted')).items[0]).toMatchObject({ userId: '11', status: 'accepted' });
    const contact = await db.col(C.contacts).findOne({ _id: `${UID}:11` as never });
    expect(contact).toMatchObject({ uid: UID, userId: '11', inFriendList: true, domName: 'Đạt gara' });
    // The greeting is its own approved send_text command by the same approver, to the new friend's thread.
    const greeting = await db.col(C.suggestions).findOne({ action: { $exists: false }, threadId: '11' });
    expect(greeting).toMatchObject({ status: 'approved', approvedBy: 'minh', finalText: 'Chào anh Đạt', uid: UID });
    expect(await db.col(C.conversations).findOne({ _id: `${UID}:11` as never })).toMatchObject({ type: 'user', name: 'Đạt gara' });
    // No message bubble and no text in the audit trail.
    const audit = await db.col(C.auditLog).find({ target: made.id }).toArray();
    expect(audit.map((a) => a.action)).toEqual(['outbox.create', 'outbox.claim', 'outbox.sent']);
    expect(JSON.stringify(audit)).not.toContain('Chào anh Đạt');
  });

  it('the greeting is skipped (acceptance stands) while the nick is limited to a test group', async () => {
    await read('received', [invite('13', 'Lan')]);
    await http().get(`/api/outbox/pending?uid=${UID}&commands=1&onlyThreads=g900`).set(auth(tok.ingest)).expect(200);
    const made = (await create({ threadId: '13', action: 'friend_accept', friend: { userId: '13', name: 'Lan', greeting: 'Chào chị Lan' } }).expect(201)).body as OutboxItem;
    await http().post(`/api/outbox/${made.id}/claim`).set(auth(tok.ingest)).expect(200);
    await http().post(`/api/outbox/${made.id}/result`).set(auth(tok.ingest)).send({ ok: true }).expect(200);
    expect((await list('received', 'accepted')).items[0].userId).toBe('13');
    expect(await db.col(C.suggestions).countDocuments({ action: { $exists: false } })).toBe(0);
    expect((await db.col(C.auditLog).find({ action: 'outbox.greeting_skipped' }).toArray()).length).toBe(1);
  });

  it('reject, and commands for requests Zalo does not list are refused', async () => {
    await read('received', [invite('12', 'Hương')]);
    await create({ threadId: '99', action: 'friend_accept', friend: { userId: '99', name: 'Ai đó' } }).expect(400);
    const made = (await create({ threadId: '12', action: 'friend_reject', friend: { userId: '12', name: 'Hương' } }).expect(201)).body as OutboxItem;
    expect(made.text).toBe('[Từ chối kết bạn] Hương');
    await http().post(`/api/outbox/${made.id}/claim`).set(auth(tok.ingest)).expect(200);
    await http().post(`/api/outbox/${made.id}/result`).set(auth(tok.ingest)).send({ ok: false, error: 'không thấy nút Từ chối' }).expect(200);
    // A failed command leaves the request pending (nothing happened on Zalo).
    expect((await list()).items[0]).toMatchObject({ status: 'pending', commandStatus: 'failed' });
    expect(await db.col(C.contacts).countDocuments({})).toBe(0);
  });

  it('SZ-09: two requests in a row — the second is HELD (still approved, not dropped) until 30 s after the first claim, with the nick green', async () => {
    const a = (await create({ threadId: '0912345678', action: 'friend_request', friend: { phone: '0912345678', greeting: 'Chào anh' } }).expect(201)).body as OutboxItem;
    const b = (await create({ threadId: '0912345679', action: 'friend_request', friend: { phone: '+84 912 345 679' } }).expect(201)).body as OutboxItem;
    expect(a.text).toBe('[Mời kết bạn] 0912345678');
    expect((await db.col(C.suggestions).findOne({ _id: new ObjectId(b.id) }))?.friend).toMatchObject({ phone: '0912345679' });

    expect(await pending()).toEqual([a.id]); // only one per nick, the other waits
    await http().post(`/api/outbox/${a.id}/claim`).set(auth(tok.ingest)).expect(200);
    await http().post(`/api/outbox/${a.id}/result`).set(auth(tok.ingest)).send({ ok: true }).expect(200);

    expect(await pending()).toEqual([]);
    await http().post(`/api/outbox/${b.id}/claim`).set(auth(tok.ingest)).expect(409); // too early: held, not failed
    expect(await status(b.id)).toBe('approved');
    expect((await db.col(C.suggestions).findOne({ _id: new ObjectId(b.id) }))?.attempts).toBeUndefined();
    expect((await list()).quota.nextAllowedAt).not.toBeNull();

    // 31 seconds later the nick is still green and the second one is delivered within the 2-minute hold window.
    await db.col(C.suggestions).updateOne({ _id: new ObjectId(a.id) }, { $set: { claimedAt: new Date(Date.now() - 31_000) } });
    await db.col(C.extensionPresence).updateOne({ _id: UID as never }, { $set: { lastSeenAt: new Date() } });
    expect(await pending()).toEqual([b.id]);
    expect(await status(b.id)).toBe('approved');
    await http().post(`/api/outbox/${b.id}/claim`).set(auth(tok.ingest)).expect(200);
    expect(await status(b.id)).toBe('sending');
    expect((await db.col(C.suggestions).findOne({ _id: new ObjectId(b.id) }))?.attempts).toBe(1);
  });

  it('SZ-09: 20 requests a day per nick; the 21st is refused at creation (the Dashboard locks the button)', async () => {
    for (let i = 0; i < 20; i++) {
      const phone = `09123456${String(i).padStart(2, '0')}`;
      await create({ threadId: phone, action: 'friend_request', friend: { phone } }).expect(201);
    }
    const q = (await list()).quota;
    expect(q).toMatchObject({ limit: 20, usedToday: 20, remaining: 0 });
    const r = await create({ threadId: '0988888888', action: 'friend_request', friend: { phone: '0988888888' } }).expect(400);
    expect(JSON.stringify(r.body)).toContain('đủ 20 lời mời');
    // A cancelled one gives its place back.
    const first = await db.col(C.suggestions).findOne({ action: 'friend_request' });
    await http().post(`/api/outbox/${first!._id.toHexString()}/cancel`).set(auth(tok.minh)).send({}).expect(200);
    await create({ threadId: '0988888888', action: 'friend_request', friend: { phone: '0988888888' } }).expect(201);
    // Same number twice while the first waits.
    await create({ threadId: '0988888888', action: 'friend_request', friend: { phone: '0988 888 888' } }).expect(400); // quota again (20 used)
  });

  it('refuses a malformed phone, and friend commands work although the nick is limited to a test group', async () => {
    await create({ threadId: '123', action: 'friend_request', friend: { phone: '12345' } }).expect(400);
    await create({ threadId: '123', action: 'friend_request', friend: { phone: '0123' } }).expect(400);
    // Test phase: the extension reports it only sends into group g900.
    await http().get(`/api/outbox/pending?uid=${UID}&commands=1&onlyThreads=g900`).set(auth(tok.ingest)).expect(200);
    await create({ threadId: '555', text: 'Chào' }).expect(400);
    await create({ threadId: '0912345678', action: 'friend_request', friend: { phone: '0912345678' } }).expect(201);
  });

  it('allowlist: without FRIEND_TARGETS (or for a person not on it) every friend command is refused with 400 and nothing is queued', async () => {
    await read('received', [invite('11', 'Hoàng Đạt'), invite('12', 'Hương')]);
    const body = (o: Record<string, unknown>) => create(o);
    try {
      process.env.FRIEND_TARGETS = '';
      await body({ threadId: '11', action: 'friend_accept', friend: { userId: '11', name: 'Hoàng Đạt' } }).expect(400);
      await body({ threadId: '0342808374', action: 'friend_request', friend: { phone: '0342808374' } }).expect(400);
      process.env.FRIEND_TARGETS = '0342808374, 11';
      await body({ threadId: '12', action: 'friend_accept', friend: { userId: '12', name: 'Hương' } }).expect(400);
      await body({ threadId: '12', action: 'friend_reject', friend: { userId: '12', name: 'Hương' } }).expect(400);
      await body({ threadId: '0912345678', action: 'friend_request', friend: { phone: '0912345678' } }).expect(400);
      expect(await db.col(C.suggestions).countDocuments({})).toBe(0);
      await body({ threadId: '0342808374', action: 'friend_request', friend: { phone: '+84 342 808 374' } }).expect(201);
      await body({ threadId: '11', action: 'friend_accept', friend: { userId: '11', name: 'Hoàng Đạt' } }).expect(201);
    } finally {
      process.env.FRIEND_TARGETS = '*';
    }
  });

  it('a request waiting over 30 minutes expires like any command (never runs by itself)', async () => {
    const a = (await create({ threadId: '0912345678', action: 'friend_request', friend: { phone: '0912345678' } }).expect(201)).body as OutboxItem;
    const old = new Date(Date.now() - 31 * 60_000);
    await db.col(C.suggestions).updateOne({ _id: new ObjectId(a.id) }, { $set: { approvedAt: old, createdAt: old } });
    expect(await pending()).toEqual([]);
    expect(await status(a.id)).toBe('expired');
  });

  it('Danh bạ tab Nhóm lists group conversations with member counts', async () => {
    await db.col(C.conversations).insertMany([
      { _id: `${UID}:g1` as never, uid: UID, threadId: 'g1', type: 'group', name: 'Nhóm gara', lastMsgAt: new Date('2026-10-01') },
      { _id: `${UID}:g2` as never, uid: UID, threadId: 'g2', type: 'group', name: 'Kiểm thử vclink', lastMsgAt: new Date('2026-10-03') },
      { _id: `${UID}:77` as never, uid: UID, threadId: '77', type: 'user', name: 'Một người', lastMsgAt: new Date('2026-10-04') },
    ]);
    await db.col(C.groups).insertOne({ _id: `${UID}:g1` as never, uid: UID, groupId: 'g1', memberIds: ['1', '2', '3'] });
    const r = (await http().get('/api/contacts/groups').query({ uid: UID }).set(auth(tok.minh)).expect(200)).body as ContactGroupsResponse;
    expect(r.total).toBe(2);
    expect(r.items.map((g) => [g.name, g.memberCount])).toEqual([['Kiểm thử vclink', null], ['Nhóm gara', 3]]);
    const q = (await http().get('/api/contacts/groups').query({ uid: UID, q: 'gara' }).set(auth(tok.minh)).expect(200)).body as ContactGroupsResponse;
    expect(q.items.map((g) => g.threadId)).toEqual(['g1']);
    await db.col(C.conversations).deleteMany({});
    await db.col(C.groups).deleteMany({});
  });
});
