import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DEFAULT_FIELD_MAPPING, type IngestResult } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';
import { MappingService } from '../src/mapping/mapping.service';

const UID = '111';
const msg = (id: number, over: Record<string, unknown> = {}) => ({
  msgId: String(id),
  threadId: '222',
  fromUid: id % 2 ? '222' : '0',
  toUid: id % 2 ? UID : '222',
  senderName: 'Anh Minh',
  msgType: 'webchat',
  text: `Tin ${id}`,
  sentAt: 1727500000000 + id * 1000,
  raw: { msgId: String(id), e2eeStatus: 0 },
  ...over,
});

describe('VClinks ingest → dashboard (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  let baseUrl: string;
  const tok: Record<'dashboard' | 'ingest' | 'mcp', string> = { dashboard: '', ingest: '', mcp: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_test');
    app = await createApp({ logger: false });
    await app.listen(0);
    baseUrl = await app.getUrl();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    for (const s of ['dashboard', 'ingest', 'mcp'] as const) tok[s] = await tokens.create(`test-${s}`, [s]);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('requires a token and the right scope', async () => {
    await request(app.getHttpServer()).get('/api/accounts').expect(401);
    await request(app.getHttpServer()).get('/api/accounts').set(auth('vcz_wrong')).expect(401);
    await request(app.getHttpServer()).get('/api/accounts').set(auth(tok.ingest)).expect(403);
    await request(app.getHttpServer()).get('/api/health').expect(200);
    const me = await request(app.getHttpServer()).get('/api/me').set(auth(tok.ingest)).expect(200);
    expect(me.body).toEqual({ name: 'test-ingest', scopes: ['ingest'] });
  });

  it('refuses ingest for an unregistered account', async () => {
    await request(app.getHttpServer())
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({ uid: '999', items: [msg(1)] })
      .expect(404);
  });

  it('registers an account without overwriting a renamed label', async () => {
    const http = request(app.getHttpServer());
    const r1 = await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: `Zalo ${UID}` }).expect(201);
    expect(r1.body).toEqual({ uid: UID, label: `Zalo ${UID}`, created: true });
    await http.patch(`/api/accounts/${UID}`).set(auth(tok.dashboard)).send({ label: 'Zalo chính' }).expect(200);
    const r2 = await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: `Zalo ${UID}` }).expect(201);
    expect(r2.body).toEqual({ uid: UID, label: 'Zalo chính', created: false });
  });

  it('upserts messages idempotently, rejects sensitive items and advances the checkpoint', async () => {
    const http = request(app.getHttpServer());
    await http
      .post('/api/ingest/contacts')
      .set(auth(tok.ingest))
      .send({ uid: UID, items: [{ userId: '222', displayName: 'Anh Minh Gara', isFriend: true, lastActionTime: 1727400000000 }] })
      .expect(200);

    const items = [1, 2, 3, 4].map((i) => msg(i));
    const first = await http.post('/api/ingest/messages').set(auth(tok.ingest)).send({ uid: UID, items }).expect(200);
    expect(first.body).toEqual<IngestResult>({
      accepted: 4,
      updated: 0,
      unchanged: 0,
      rejected: [],
      checkpoint: 1727500004000,
    });

    // Re-run the same batch plus one poisoned item: no duplicates, secret rejected.
    const poisoned = msg(5, { raw: { e2ee_session: 'secret' } });
    const again = await http
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({ uid: UID, items: [...items, poisoned] })
      .expect(200);
    expect(again.body.accepted).toBe(0);
    expect(again.body.updated).toBe(0);
    expect(again.body.unchanged).toBe(4);
    expect(again.body.rejected).toEqual([{ index: 4, id: '5', reason: expect.stringMatching(/^sensitive_field: raw\.e2ee_session/) }]);

    expect(await db.col(C.messages).countDocuments({ uid: UID })).toBe(4);
    const stored = await db.col(C.messages).findOne({ _id: `${UID}:1` as never });
    expect(stored?.sentAt).toBeInstanceOf(Date);
    expect(JSON.stringify(await db.col(C.messages).find().toArray())).not.toMatch(/e2ee_session/);

    // An edit on the source updates in place.
    const edited = await http
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({ uid: UID, items: [msg(4, { text: 'Tin 4 (đã sửa)' })] })
      .expect(200);
    expect(edited.body).toMatchObject({ accepted: 0, updated: 1 });

    const cp = await http.get(`/api/checkpoints/${UID}/messages`).set(auth(tok.ingest)).expect(200);
    expect(cp.body).toEqual({ uid: UID, stream: 'messages', cursor: 1727500004000, sourceCount: null });
  });

  it('re-ingesting a message as encrypted metadata clears its stored ciphertext', async () => {
    // Own account so message counts of UID stay untouched for later assertions.
    const ENC_UID = '777';
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: ENC_UID, label: 'Zalo 777' }).expect(201);

    // First a complete message with text.
    await http
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({ uid: ENC_UID, items: [msg(7)] })
      .expect(200);
    let stored = await db.col(C.messages).findOne({ _id: `${ENC_UID}:7` as never });
    expect(stored?.text).toBe('Tin 7');

    // Then the same msgId comes back encrypted (metadata only, no text/senderName).
    const meta = {
      msgId: '7',
      threadId: '222',
      fromUid: '222',
      toUid: ENC_UID,
      msgType: 'webchat',
      sentAt: 1727500007000,
      encrypted: true,
      contentStatus: 'pending' as const,
      raw: { msgId: '7', e2eeStatus: 0 },
    };
    await http.post('/api/ingest/messages').set(auth(tok.ingest)).send({ uid: ENC_UID, items: [meta] }).expect(200);

    stored = await db.col(C.messages).findOne({ _id: `${ENC_UID}:7` as never });
    expect(stored?.text).toBeUndefined(); // old ciphertext text removed
    expect(stored?.senderName).toBeUndefined();
    expect(stored?.encrypted).toBe(true);
    expect(stored?.contentStatus).toBe('pending');
    expect(stored?.msgType).toBe('webchat'); // metadata kept
  });

  it('joins DOM-captured content onto a message by cliMsgId', async () => {
    const U = '888';
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: U, label: 'Zalo 888' }).expect(201);

    // Metadata-only (encrypted) message carrying a cliMsgId.
    const meta = {
      msgId: '900',
      cliMsgId: 'cli900',
      threadId: '222',
      fromUid: '222',
      msgType: 'webchat',
      sentAt: 1727500900000,
      encrypted: true,
      contentStatus: 'pending' as const,
      raw: { msgId: '900' },
    };
    await http.post('/api/ingest/messages').set(auth(tok.ingest)).send({ uid: U, items: [meta] }).expect(200);

    const res = await http
      .post('/api/ingest/message-content')
      .set(auth(tok.ingest))
      .send({
        uid: U,
        items: [
          { cliMsgId: 'cli900', direction: 'in', text: 'Nội dung từ DOM', capturedAt: 1727500950000, schemaVersion: 'zalo-v1' },
          { cliMsgId: 'khong-co', text: 'chưa có metadata', capturedAt: 1727500950000 },
        ],
      })
      .expect(200);
    expect(res.body.matched).toBe(1);
    expect(res.body.unmatched).toEqual(['khong-co']);

    const stored = await db.col(C.messages).findOne({ _id: `${U}:900` as never });
    expect(stored?.text).toBe('Nội dung từ DOM');
    expect(stored?.contentStatus).toBe('complete');
    expect(stored?.encrypted).toBe(false);
    expect(stored?.contentSource).toBe('dom');

    // Content carrying a secret is refused, never stored.
    const bad = await http
      .post('/api/ingest/message-content')
      .set(auth(tok.ingest))
      .send({ uid: U, items: [{ cliMsgId: 'cli900', text: 'x', capturedAt: 1, refresh_token: 'zzz' }] })
      .expect(200);
    expect(bad.body.matched).toBe(0);
    expect(bad.body.rejected[0].reason).toMatch(/sensitive_field/);
  });

  it('keeps DOM-captured content when the message is re-ingested as encrypted metadata', async () => {
    const U = '8801';
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: U, label: 'Zalo 8801' }).expect(201);
    const meta = {
      msgId: '901', cliMsgId: 'cli901', threadId: '222', fromUid: '222', msgType: '1', sentAt: 1727500900000,
      encrypted: true, contentStatus: 'pending' as const, raw: { msgId: '901' },
    };
    const ingestMeta = () => http.post('/api/ingest/messages').set(auth(tok.ingest)).send({ uid: U, items: [meta] }).expect(200);
    await ingestMeta();
    await http
      .post('/api/ingest/message-content')
      .set(auth(tok.ingest))
      .send({ uid: U, items: [{ cliMsgId: 'cli901', text: 'Báo giá má phanh', capturedAt: 1727500950000 }] })
      .expect(200);

    // Next sync re-sends the record (drift sample / full re-sync): content must survive.
    const again = await ingestMeta();
    expect(again.body.updated).toBe(0);
    const stored = await db.col(C.messages).findOne({ _id: `${U}:901` as never });
    expect(stored?.text).toBe('Báo giá má phanh');
    expect(stored?.encrypted).toBe(false);
    expect(stored?.contentStatus).toBe('complete');
    expect(stored?.attachmentIds).toEqual([]);
  });

  it('flags a recalled message and keeps the content captured before the recall', async () => {
    const U = '8802';
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: U, label: 'Zalo 8802' }).expect(201);
    const meta = (msgId: string, msgType: string, over: Record<string, unknown> = {}) => ({
      msgId, cliMsgId: `c${msgId}`, threadId: '222', fromUid: '222', msgType, sentAt: 1727500900000,
      encrypted: true, contentStatus: 'pending' as const, raw: { msgId }, ...over,
    });
    const recall = (msgId: string) =>
      meta(msgId, '20', { text: '[Đã thu hồi]', contentStatus: 'complete' as const });
    const ingest = (items: unknown[]) => http.post('/api/ingest/messages').set(auth(tok.ingest)).send({ uid: U, items }).expect(200);

    // r1 was captured from the DOM before the recall; r2 never was.
    await ingest([meta('r1', '1'), meta('r2', '2')]);
    await http
      .post('/api/ingest/message-content')
      .set(auth(tok.ingest))
      .send({ uid: U, items: [{ cliMsgId: 'cr1', text: 'Số TK 0123', capturedAt: 1727500950000 }] })
      .expect(200);
    await ingest([recall('r1'), recall('r2')]);

    const r1 = await db.col(C.messages).findOne({ _id: `${U}:r1` as never });
    expect(r1).toMatchObject({ text: 'Số TK 0123', recalled: true, recalledFromMsgType: '1', msgType: '20', encrypted: false });
    const r2 = await db.col(C.messages).findOne({ _id: `${U}:r2` as never });
    expect(r2).toMatchObject({ text: '[Đã thu hồi]', recalled: true, recalledFromMsgType: '2', contentStatus: 'complete', encrypted: false });

    // Re-sending the recall every sync changes nothing.
    const again = await ingest([recall('r1'), recall('r2')]);
    expect(again.body.updated).toBe(0);

    const page = await http.get(`/api/conversations/${U}:222/messages`).set(auth(tok.dashboard)).expect(200);
    const view = page.body.items.find((m: { msgId: string }) => m.msgId === 'r1');
    expect(view).toMatchObject({ text: 'Số TK 0123', recalled: true });
  });

  it('M1a-06: a recall in a group (DOM bubble id = cliMsgId) flags the same record, seen by the group thread', async () => {
    const U = '8806';
    const G = 'g6910418193163461340';
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: U, label: 'Zalo 8806' }).expect(201);
    const ingest = (items: unknown[]) => http.post('/api/ingest/messages').set(auth(tok.ingest)).send({ uid: U, items }).expect(200);
    // IndexedDB metadata of a member's message: threadId = group id (with its `g` prefix), content encrypted.
    const meta = (msgType: string, over: Record<string, unknown> = {}) => ({
      msgId: '8315910213340', cliMsgId: '1790641200110', threadId: G, fromUid: '225112513000081189', msgType,
      sentAt: 1727500900000, encrypted: true, contentStatus: 'pending' as const, raw: { msgId: '8315910213340' }, ...over,
    });
    await ingest([meta('1')]);
    // The DOM bubble `bb_msg_id_1790641200110` of the group matches the record by (uid, cliMsgId).
    const content = await http
      .post('/api/ingest/message-content')
      .set(auth(tok.ingest))
      .send({ uid: U, items: [{ cliMsgId: '1790641200110', text: 'Báo giá lọc gió', capturedAt: 1727500950000 }] })
      .expect(200);
    expect(content.body.unmatched ?? []).toEqual([]);
    // Zalo keeps msgId / cliMsgId and turns the record into msgType 20 (chat.undo).
    await ingest([meta('20', { text: '[Đã thu hồi]', contentStatus: 'complete' as const })]);
    expect(await db.col(C.messages).countDocuments({ uid: U })).toBe(1);
    const page = await http.get(`/api/conversations/${U}:${G}/messages`).set(auth(tok.dashboard)).expect(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.items[0]).toMatchObject({ text: 'Báo giá lọc gió', recalled: true, cliMsgId: '1790641200110' });
  });

  it('stores DOM media content; voice without URL is partial and never downgrades a complete capture', async () => {
    const U = '889';
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: U, label: 'Zalo 889' }).expect(201);
    const meta = (msgId: string, cli: string) => ({
      msgId, cliMsgId: cli, threadId: '222', fromUid: '222', sentAt: 1727500900000, encrypted: true, contentStatus: 'pending' as const, raw: { msgId },
    });
    await http
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({ uid: U, items: [meta('m1', 'v1'), meta('m2', 'f1')] })
      .expect(200);

    const post = (items: unknown[]) => http.post('/api/ingest/message-content').set(auth(tok.ingest)).send({ uid: U, items }).expect(200);

    // Voice seen before Play: duration only, blob URL dropped → partial.
    await post([
      { cliMsgId: 'v1', kind: 'voice', voice: { url: 'blob:https://chat.zalo.me/x', durationSec: 15 }, capturedAt: 1727500950000 },
      {
        cliMsgId: 'f1',
        kind: 'file',
        files: [{ name: 'bao-gia.pdf', size: '12.3 MB', ext: 'pdf', url: 'javascript:alert(1)' }],
        links: ['javascript:alert(1)', 'https://vcparts.vn/p/1'],
        capturedAt: 1727500950000,
      },
    ]);
    let v = await db.col(C.messages).findOne({ _id: `${U}:m1` as never });
    expect(v?.contentStatus).toBe('partial');
    expect(v?.content).toEqual({ voice: { durationSec: 15 }, kind: 'voice' });
    const f = await db.col(C.messages).findOne({ _id: `${U}:m2` as never });
    expect(f?.contentStatus).toBe('complete');
    expect(f?.content).toEqual({ files: [{ name: 'bao-gia.pdf', size: '12.3 MB', ext: 'pdf' }], links: ['https://vcparts.vn/p/1'], kind: 'file' });

    // Re-captured after Play → complete.
    await post([{ cliMsgId: 'v1', kind: 'voice', voice: { url: 'https://voice.zdn.vn/a.aac', durationSec: 15 }, capturedAt: 1727500960000 }]);
    v = await db.col(C.messages).findOne({ _id: `${U}:m1` as never });
    expect(v?.contentStatus).toBe('complete');
    expect(v?.content.voice.url).toBe('https://voice.zdn.vn/a.aac');

    // A later partial capture does not overwrite the stored URL.
    const again = await post([{ cliMsgId: 'v1', kind: 'voice', voice: { durationSec: 15 }, capturedAt: 1727500970000 }]);
    expect(again.body.matched).toBe(1);
    v = await db.col(C.messages).findOne({ _id: `${U}:m1` as never });
    expect(v?.contentStatus).toBe('complete');
    expect(v?.content.voice.url).toBe('https://voice.zdn.vn/a.aac');
  });

  it('stores a conversation name read from the sidebar (thread-names)', async () => {
    const U = '999';
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: U, label: 'Zalo 999' }).expect(201);
    // Encrypted contact (name withheld) + a message that derives the conversation.
    await http.post('/api/ingest/contacts').set(auth(tok.ingest)).send({ uid: U, items: [{ userId: '222', encrypted: true }] }).expect(200);
    await http
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({
        uid: U,
        items: [{ msgId: '9001', cliMsgId: 'c9001', threadId: '222', fromUid: '222', sentAt: 1727501000000, encrypted: true, contentStatus: 'pending', raw: { msgId: '9001' } }],
      })
      .expect(200);
    const nameOf = (body: { items: { threadId: string; name: string | null }[] }) =>
      body.items.find((i) => i.threadId === '222')?.name;

    // Before names: withheld because the contact is encrypted.
    let list = await http.get('/api/conversations').query({ uid: U }).set(auth(tok.dashboard)).expect(200);
    expect(nameOf(list.body)).toBeNull();

    const res = await http
      .post('/api/ingest/thread-names')
      .set(auth(tok.ingest))
      .send({ uid: U, items: [{ threadId: '222', name: 'Chị Lan Kho' }, { threadId: 'khong-co', name: 'X' }] })
      .expect(200);
    expect(res.body.matched).toBe(1);
    expect(res.body.unmatched).toEqual(['khong-co']);

    // After: the DOM name is shown even though the contact stayed encrypted.
    list = await http.get('/api/conversations').query({ uid: U }).set(auth(tok.dashboard)).expect(200);
    expect(nameOf(list.body)).toBe('Chị Lan Kho');
  });

  it('rejects oversize batches and bad streams', async () => {
    const http = request(app.getHttpServer());
    const big = Array.from({ length: 501 }, (_, i) => msg(1000 + i));
    await http.post('/api/ingest/messages').set(auth(tok.ingest)).send({ uid: UID, items: big }).expect(400);
    await http.post('/api/ingest/secrets').set(auth(tok.ingest)).send({ uid: UID, items: [msg(1)] }).expect(400);
  });

  it('lists pinned conversations first and filters unread ones', async () => {
    const U = '8803';
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: U, label: 'Zalo 8803' }).expect(201);
    await http
      .post('/api/ingest/conversations')
      .set(auth(tok.ingest))
      .send({
        uid: U,
        items: [
          { threadId: 'a', type: 'user', lastMsgAt: 1727500003000, unread: 0 },
          { threadId: 'b', type: 'user', lastMsgAt: 1727500001000, unread: 2, pinned: true },
          { threadId: 'c', type: 'user', lastMsgAt: 1727500002000 },
        ],
      })
      .expect(200);
    // c has only the sidebar badge (DOM) as its unread count.
    await http.post('/api/ingest/thread-names').set(auth(tok.ingest)).send({ uid: U, items: [{ threadId: 'c', name: 'Khách C', unread: 5 }] }).expect(200);

    const all = await http.get('/api/conversations').query({ uid: U }).set(auth(tok.dashboard)).expect(200);
    expect(all.body.items.map((c: { threadId: string }) => c.threadId)).toEqual(['b', 'a', 'c']);
    expect(all.body.items[0]).toMatchObject({ pinned: true, unread: 2 });
    expect(all.body.items[1]).not.toHaveProperty('pinned');

    const unread = await http.get('/api/conversations').query({ uid: U, unread: 1 }).set(auth(tok.dashboard)).expect(200);
    expect(unread.body.items.map((c: { threadId: string; unread: number }) => [c.threadId, c.unread])).toEqual([['b', 2], ['c', 5]]);
  });

  it('ingests reactions, labels and read state; the dashboard shows reactions and the Zalo label', async () => {
    const U = '8804';
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: U, label: 'Zalo 8804' }).expect(201);
    const post = (stream: string, items: unknown[]) => http.post(`/api/ingest/${stream}`).set(auth(tok.ingest)).send({ uid: U, items }).expect(200);
    await post('messages', [{ msgId: 'm1', cliMsgId: 'c1', threadId: '222', fromUid: '0', msgType: '1', text: 'Chào anh @Minh', mentions: [{ uid: '333', pos: 9, len: 5, type: 0 }], status: 3, forwarded: true, sentAt: 1727500000000, raw: {} },
      { msgId: 'm2', cliMsgId: 'c2', threadId: '222', fromUid: '222', msgType: '21', sentAt: 1727500001000, systemEvent: { act: 'add_member', actorId: '222', memberIds: ['333'] }, ttl: 86400000, raw: {} }]);
    await post('conversations', [{ threadId: '222', type: 'user', lastMsgAt: 1727500001000, labelId: 7 }]);
    // Label store: name is ciphertext and never arrives; colour does.
    const lab = await post('labels', [{ labelId: '7', color: '#d91b1b', conversationIds: ['222'], encrypted: true, raw: { id: 7 } }]);
    expect(lab.body.accepted).toBe(1);
    // Sidebar chip names it.
    await http.post('/api/ingest/thread-names').set(auth(tok.ingest)).send({ uid: U, items: [{ threadId: '222', name: 'Xưởng Minh', label: { name: 'HEAD', color: 'rgb(217, 27, 27)' } }] }).expect(200);
    const rea = await post('reactions', [{ msgId: 'm1', cliMsgId: 'c1', threadId: '222', reactions: { '0': { '3': 2 }, '333': { '5': 1 } }, currentIcon: 3, lastSender: '0', lastUpdate: 1727500002000 }]);
    expect(rea.body).toMatchObject({ accepted: 1, checkpoint: 1727500002000 });
    const rs = await post('read_state', [{ threadId: '222', lastReadMsgId: 'm2', at: 1727500003000 }]);
    expect(rs.body.accepted).toBe(1);
    // Re-sending is idempotent.
    expect((await post('reactions', [{ msgId: 'm1', cliMsgId: 'c1', threadId: '222', reactions: { '0': { '3': 2 }, '333': { '5': 1 } }, currentIcon: 3, lastSender: '0', lastUpdate: 1727500002000 }])).body.updated).toBe(0);

    const stored = await db.col(C.labels).findOne({ _id: `${U}:7` as never });
    expect(stored).toMatchObject({ labelId: '7', color: '#d91b1b', domName: 'HEAD', domColor: 'rgb(217, 27, 27)' });
    expect(stored?.name).toBeUndefined();

    const list = await http.get('/api/conversations').query({ uid: U }).set(auth(tok.dashboard)).expect(200);
    expect(list.body.items[0]).toMatchObject({ threadId: '222', label: { id: '7', name: 'HEAD', color: 'rgb(217, 27, 27)' } });

    const page = await http.get(`/api/conversations/${U}:222/messages`).set(auth(tok.dashboard)).expect(200);
    const m1 = page.body.items.find((m: { msgId: string }) => m.msgId === 'm1');
    expect(m1).toMatchObject({ status: 3, forwarded: true, mentions: [{ uid: '333', pos: 9, len: 5 }], reactions: { total: 3, icons: [{ icon: '3', emoji: '👍', count: 2 }, { icon: '5', emoji: '😆', count: 1 }], mine: '3' } });
    const m2 = page.body.items.find((m: { msgId: string }) => m.msgId === 'm2');
    expect(m2).toMatchObject({ systemEvent: { act: 'add_member', actorId: '222', memberIds: ['333'] }, ttl: 86400000 });
    expect(m2).not.toHaveProperty('reactions');

    const status = await http.get('/api/accounts').set(auth(tok.dashboard)).expect(200);
    const acc = status.body.find((a: { uid: string }) => a.uid === U);
    expect(acc.streams.find((s: { stream: string }) => s.stream === 'reactions')).toMatchObject({ dbCount: 1 });
    expect(acc.streams.find((s: { stream: string }) => s.stream === 'labels')).toMatchObject({ dbCount: 1 });
  });

  it('shows conversations and messages on the dashboard', async () => {
    const http = request(app.getHttpServer());
    const list = await http.get('/api/conversations').query({ uid: UID }).set(auth(tok.dashboard)).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      id: `${UID}:222`,
      threadId: '222',
      type: 'user',
      name: 'Anh Minh Gara',
      messageCount: 4,
      lastMsgAt: new Date(1727500004000).toISOString(),
    });

    const search = await http.get('/api/conversations').query({ q: 'gara' }).set(auth(tok.dashboard)).expect(200);
    expect(search.body.total).toBe(1);

    const page = await http
      .get(`/api/conversations/${encodeURIComponent(`${UID}:222`)}/messages`)
      .query({ limit: 3 })
      .set(auth(tok.dashboard))
      .expect(200);
    expect(page.body.hasMore).toBe(true);
    expect(page.body.items.map((m: { msgId: string }) => m.msgId)).toEqual(['2', '3', '4']);
    expect(page.body.items[2].text).toBe('Tin 4 (đã sửa)');
    expect(page.body.items[0]).not.toHaveProperty('raw');

    const older = await http
      .get(`/api/conversations/${encodeURIComponent(`${UID}:222`)}/messages`)
      .query({ before: page.body.items[0].sentAt })
      .set(auth(tok.dashboard))
      .expect(200);
    expect(older.body).toMatchObject({ hasMore: false, items: [{ msgId: '1' }] });
  });

  it('compares IndexedDB counts with stored counts', async () => {
    const http = request(app.getHttpServer());
    await http
      .post('/api/sync/report')
      .set(auth(tok.ingest))
      .send({ uid: UID, sourceCounts: { messages: 4, contacts: 2 }, mappingVersion: 1 })
      .expect(200);
    const res = await http.get('/api/accounts').set(auth(tok.dashboard)).expect(200);
    const acc = res.body[0];
    expect(acc.label).toBe('Zalo chính');
    expect(acc.lastSyncAt).not.toBeNull();
    const by = Object.fromEntries(acc.streams.map((s: { stream: string }) => [s.stream, s]));
    expect(by.messages).toMatchObject({ sourceCount: 4, dbCount: 4, cursor: 1727500004000 });
    expect(by.contacts).toMatchObject({ sourceCount: 2, dbCount: 1 });
    // Derived conversation is not counted against the IndexedDB conversation store.
    expect(by.conversations).toMatchObject({ sourceCount: null, dbCount: 0 });
  });

  describe('field mapping & drift', () => {
    it('fills streams and fields the defaults gained into the active mapping as a new system version', async () => {
      const svc = app.get(MappingService);
      const before = await svc.active();
      // Pretend the active mapping is the original v1: no optional streams, no labelId.
      const { reactions, labels, read_state, ...core } = before.spec.streams;
      const conv = { ...core.conversations, fields: { threadId: 'userId', isGroup: 'isGroup' } };
      await db.col(C.fieldMappings).updateOne({ _id: before.id as never }, { $set: { spec: { ...before.spec, streams: { ...core, conversations: conv } } } });
      const added = await svc.upgradeFromDefaults();
      expect(added).toEqual(expect.arrayContaining(['conversations.pinned', 'conversations.labelId', 'reactions', 'labels', 'read_state']));
      const after = await svc.active();
      expect(after.version).toBe(before.version + 1);
      expect(after.spec.streams.reactions?.store).toBe('reaction');
      expect(after.spec.streams.conversations.fields.labelId).toBe('label');
      expect(after.spec.streams.messages.fields.body).toBe('message'); // untouched
      expect(after.note).toMatch(/reactions/);
      expect((await svc.list()).filter((m: { status: string }) => m.status === 'active')).toHaveLength(1);
      // Second run: nothing to add.
      expect(await svc.upgradeFromDefaults()).toEqual([]);
      // Restore v1 so the mapping tests below keep their version numbers.
      await db.col(C.fieldMappings).deleteOne({ _id: after.id as never });
      await db.col(C.fieldMappings).updateOne({ _id: before.id as never }, { $set: { status: 'active', spec: before.spec } });
      await db.col(C.auditLog).deleteMany({ action: 'mapping.upgrade' });
    });

    it('serves the seeded v1 mapping and records drift once per kind', async () => {
      const http = request(app.getHttpServer());
      const active = await http.get('/api/mapping/active').set(auth(tok.ingest)).expect(200);
      expect(active.body).toMatchObject({ version: 1, status: 'active', spec: DEFAULT_FIELD_MAPPING });

      const drift = { uid: UID, stream: 'messages', mappingVersion: 1, kind: 'missing_fields', missing: ['msgId'], observedKeys: ['id', 'content'], sampleSize: 50, failedCount: 50 };
      const d1 = await http.post('/api/mapping/drift').set(auth(tok.ingest)).send(drift).expect(200);
      const d2 = await http.post('/api/mapping/drift').set(auth(tok.ingest)).send(drift).expect(200);
      expect(d2.body.id).toBe(d1.body.id);
      const open = await http.get('/api/mapping/drifts').query({ status: 'open' }).set(auth(tok.dashboard)).expect(200);
      expect(open.body).toHaveLength(1);
    });
  });

  describe('MCP /mcp', () => {
    const connect = async (token: string) => {
      const client = new Client({ name: 'e2e', version: '1.0.0' });
      await client.connect(
        new StreamableHTTPClientTransport(new URL('/mcp', baseUrl), { requestInit: { headers: auth(token) } }),
      );
      return client;
    };
    const parse = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0].text);

    it('rejects callers without the mcp scope', async () => {
      await request(app.getHttpServer()).post('/mcp').set(auth(tok.ingest)).send({}).expect(403);
    });

    it('lists tools and ingests idempotently through MCP', async () => {
      const client = await connect(tok.mcp);
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(
        expect.arrayContaining([
          'register_account',
          'get_checkpoint',
          'get_sync_status',
          'get_field_mapping',
          'propose_field_mapping',
          'ingest_contacts',
          'ingest_groups',
          'ingest_conversations',
          'ingest_messages',
        ]),
      );

      expect(parse(await client.callTool({ name: 'register_account', arguments: { uid: '333', label: 'Zalo phụ' } }))).toMatchObject({ created: true });
      await client.callTool({ name: 'ingest_groups', arguments: { uid: '333', items: [{ groupId: 'g1', name: 'VCparts - Kho', memberIds: ['1', '2'] }] } });
      const items = [msg(1, { threadId: 'g1', toUid: 'g1' }), msg(2, { threadId: 'g1', toUid: 'g1' })];
      const r1 = parse(await client.callTool({ name: 'ingest_messages', arguments: { uid: '333', items } }));
      const r2 = parse(await client.callTool({ name: 'ingest_messages', arguments: { uid: '333', items } }));
      expect(r1).toMatchObject({ accepted: 2, rejected: [] });
      expect(r2).toMatchObject({ accepted: 0, updated: 0, unchanged: 2 });
      expect(JSON.stringify(r1)).not.toMatch(/Tin 1/); // response never echoes data

      const bad = parse(await client.callTool({ name: 'ingest_contacts', arguments: { uid: '333', items: [{ userId: '9', refresh_token: 'x' }] } }));
      expect(bad.rejected[0].reason).toMatch(/refresh_token/);

      const conv = await request(app.getHttpServer()).get('/api/conversations').query({ uid: '333' }).set(auth(tok.dashboard)).expect(200);
      expect(conv.body.items[0]).toMatchObject({ threadId: 'g1', type: 'group', name: 'VCparts - Kho', messageCount: 2 });

      const status = parse(await client.callTool({ name: 'get_sync_status', arguments: { uid: '333' } }));
      expect(status[0].streams.find((s: { stream: string }) => s.stream === 'messages').dbCount).toBe(2);
      await client.close();
    });

    it('lets Claude propose a mapping that only takes effect after dashboard approval', async () => {
      const client = await connect(tok.mcp);
      const spec = structuredClone(DEFAULT_FIELD_MAPPING);
      spec.streams.messages.fields.msgId = 'id';

      const badSpec = structuredClone(DEFAULT_FIELD_MAPPING);
      badSpec.streams.messages.store = 'e2ee_session';
      const refused = await client.callTool({ name: 'propose_field_mapping', arguments: { spec: badSpec } });
      expect(refused.isError).toBe(true);

      const proposed = parse(await client.callTool({ name: 'propose_field_mapping', arguments: { spec, note: 'msgId đổi thành id' } }));
      expect(proposed).toEqual({ id: 'mapping-v2', version: 2, status: 'proposed' });
      await client.close();

      const http = request(app.getHttpServer());
      let active = await http.get('/api/mapping/active').set(auth(tok.ingest)).expect(200);
      expect(active.body.version).toBe(1);

      await http.post('/api/mapping/mapping-v2/approve').set(auth(tok.ingest)).expect(403);
      await http.post('/api/mapping/mapping-v2/approve').set(auth(tok.dashboard)).expect(200);
      active = await http.get('/api/mapping/active').set(auth(tok.ingest)).expect(200);
      expect(active.body).toMatchObject({ version: 2, approvedBy: 'test-dashboard' });
      expect(active.body.spec.streams.messages.fields.msgId).toBe('id');

      const all = await http.get('/api/mapping').set(auth(tok.dashboard)).expect(200);
      expect(all.body.map((m: { status: string }) => m.status)).toEqual(['active', 'superseded']);
      const open = await http.get('/api/mapping/drifts').query({ status: 'open' }).set(auth(tok.dashboard)).expect(200);
      expect(open.body).toHaveLength(0);

      const audit = await db.col(C.auditLog).find({ action: /^mapping\./ }).toArray();
      expect(audit.map((a) => a.action)).toEqual(['mapping.propose', 'mapping.approve']);
    });
  });
});
