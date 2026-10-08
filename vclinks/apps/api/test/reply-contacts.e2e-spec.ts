import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { ContactProfile, MessageView, OutboxItem } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';

const UID = '5200';
const FB = 'fb_5200';
const THREAD = 'g77';

describe('Reply ("Trả lời") and sender profile', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  const tok: Record<'dashboard' | 'ingest', string> = { dashboard: '', ingest: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());
  const msg = (cli: string, extra: Record<string, unknown> = {}) => ({
    _id: `${UID}:m${cli}` as never,
    uid: UID,
    threadId: THREAD,
    msgId: `m${cli}`,
    cliMsgId: cli,
    fromUid: 'u1',
    sentAt: new Date(Number(cli) * 1000),
    ...extra,
  });
  const messages = async () =>
    (
      (await http().get(`/api/conversations/${UID}:${THREAD}/messages`).set(auth(tok.dashboard)).expect(200)).body as {
        items: MessageView[];
      }
    ).items;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_reply_test');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    for (const s of ['dashboard', 'ingest'] as const) tok[s] = await tokens.create(`anh-${s}`, [s]);
    for (const uid of [UID, FB]) {
      await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid, label: uid }).expect(201);
    }
    await db.col(C.messages).insertMany([
      msg('1', { senderName: 'VCpart An', text: 'A0004208700 Má phanh trước BREMBO' }),
      // Reply captured from the Zalo DOM: quote block has no id.
      msg('2', { fromUid: 'u2', senderName: 'Đức sale', text: 'Em gửi đơn a An', content: { kind: 'text', quote: { senderName: 'VCpart An', text: 'A0004208700 Má phanh' } } }),
      // Webhook-style stored reference.
      msg('3', { fromUid: 'u2', text: 'Dạ', quoteRef: { msgId: 'm1' } }),
      msg('4', { encrypted: true }),
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('creates a reply only to a stored message of the same thread, on a channel that supports it', async () => {
    const post = (body: object) => http().post('/api/outbox').set(auth(tok.dashboard)).send(body);
    await post({ uid: UID, threadId: THREAD, text: 'Dạ', replyToCliMsgId: 'nope' }).expect(400);
    await post({ uid: UID, threadId: 'other', text: 'Dạ', replyToCliMsgId: '1' }).expect(400);
    await post({ uid: FB, threadId: THREAD, text: 'Dạ', replyToCliMsgId: '1' }).expect(400);
    const item = (await post({ uid: UID, threadId: THREAD, text: 'Dạ em nhận', replyToCliMsgId: '1' }).expect(201)).body as OutboxItem;
    expect(item.replyToCliMsgId).toBe('1');

    // The extension receives the target with the item and reports which message carries the quote.
    const [pending] = (await http().get(`/api/outbox/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[];
    expect(pending.replyToCliMsgId).toBe('1');
    await http().post(`/api/outbox/${item.id}/claim`).set(auth(tok.ingest)).expect(200);
    await http()
      .post(`/api/outbox/${item.id}/result`)
      .set(auth(tok.ingest))
      .send({ ok: true, cliMsgId: '9', replyCliMsgId: '9' })
      .expect(200);
    await db.col(C.messages).insertOne(msg('9', { fromUid: '0', text: 'Dạ em nhận' }));

    const sent = (await messages()).find((m) => m.cliMsgId === '9');
    expect(sent?.quote).toEqual({ cliMsgId: '1', msgId: 'm1', fromUid: 'u1', senderName: 'VCpart An', text: 'A0004208700 Má phanh trước BREMBO' });
  });

  it('shows DOM quotes and stored quote references on messages', async () => {
    const byCli = new Map((await messages()).map((m) => [m.cliMsgId, m]));
    expect(byCli.get('2')?.quote).toEqual({ cliMsgId: null, msgId: null, fromUid: null, senderName: 'VCpart An', text: 'A0004208700 Má phanh' });
    expect(byCli.get('3')?.quote).toMatchObject({ msgId: 'm1', cliMsgId: '1', senderName: 'VCpart An' });
    expect(byCli.get('1')?.quote).toBeUndefined();
  });

  it('never exposes an encrypted quoted message', async () => {
    await db.col(C.messages).insertOne(msg('5', { text: 'Ok', quoteRef: { cliMsgId: '4' } }));
    const m = (await messages()).find((x) => x.cliMsgId === '5');
    expect(m?.quote).toMatchObject({ cliMsgId: '4', senderName: null, text: null });
  });

  it('stores the quote block and group sender name captured from the Zalo DOM', async () => {
    await db.col(C.messages).insertOne(msg('6', { fromUid: 'u3', encrypted: true, contentStatus: 'pending' }));
    const r = await http()
      .post('/api/ingest/message-content')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        items: [{ cliMsgId: '6', direction: 'in', text: 'Em gửi', senderName: 'Kho Tú', quote: { senderName: 'VCpart An', text: 'Má phanh' }, capturedAt: Date.now() }],
      })
      .expect(200);
    expect(r.body.matched).toBe(1);
    const m = (await messages()).find((x) => x.cliMsgId === '6');
    expect(m).toMatchObject({ text: 'Em gửi', senderName: 'Kho Tú', quote: { senderName: 'VCpart An', text: 'Má phanh' } });
    // Unknown fields in a quote are rejected (strict schema).
    const bad = await http()
      .post('/api/ingest/message-content')
      .set(auth(tok.ingest))
      .send({ uid: UID, items: [{ cliMsgId: '6', text: 'x', quote: { token: 'abc' }, capturedAt: Date.now() }] });
    expect(bad.body.rejected).toHaveLength(1);
  });

  it('builds a sender profile from an encrypted contact, DOM sender names and group membership', async () => {
    await db.col(C.contacts).insertOne({ _id: `${UID}:u1` as never, uid: UID, userId: 'u1', isFriend: true, username: 't_abc', encrypted: true, tags: [] });
    await db.col(C.groups).insertOne({ _id: `${UID}:${THREAD}` as never, uid: UID, groupId: THREAD, encrypted: true, raw: { memberIds: ['u1', 'u2'] } });
    await db.col(C.conversations).insertOne({ _id: `${UID}:${THREAD}` as never, uid: UID, threadId: THREAD, type: 'group', name: 'Kho Kim Đồng' });

    await http().get(`/api/contacts/${UID}/u1`).set(auth(tok.ingest)).expect(403);
    const p = (await http().get(`/api/contacts/${UID}/u1?threadId=${THREAD}`).set(auth(tok.dashboard)).expect(200)).body as ContactProfile;
    expect(p).toMatchObject({
      userId: 'u1',
      channel: 'zalo',
      displayName: 'VCpart An',
      username: 't_abc',
      phone: null,
      isFriend: true,
      encrypted: true,
      known: true,
      directConversationId: null,
      commonGroups: [{ id: `${UID}:${THREAD}`, name: 'Kho Kim Đồng' }],
    });
    expect(p.stats).toMatchObject({ messages: 3, inThread: 3 });

    // A group member without a contact record still has a profile.
    const u2 = (await http().get(`/api/contacts/${UID}/u2`).set(auth(tok.dashboard)).expect(200)).body as ContactProfile;
    expect(u2).toMatchObject({ displayName: 'Đức sale', known: false, isFriend: null });
    await http().get(`/api/contacts/${UID}/nobody`).set(auth(tok.dashboard)).expect(404);
  });
});
