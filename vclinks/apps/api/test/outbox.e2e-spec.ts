import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { OutboxItem } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';

const UID = '5100';
const SECRET_TEXT = 'Nội dung bí mật không được vào log';

describe('Outbox: Dashboard → extension send (approval invariant)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  let baseUrl: string;
  const tok: Record<'dashboard' | 'ingest' | 'mcp', string> = { dashboard: '', ingest: '', mcp: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_outbox_test');
    app = await createApp({ logger: false });
    await app.listen(0);
    baseUrl = await app.getUrl();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    for (const s of ['dashboard', 'ingest', 'mcp'] as const) tok[s] = await tokens.create(`anh-${s}`, [s]);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: 'Zalo test' }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await db.col(C.suggestions).deleteMany({});
  });

  const create = async (text = 'Dạ em chào anh', threadId = '900') =>
    (await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: UID, threadId, text }).expect(201))
      .body as OutboxItem;

  it('creates an approved item stamped with the approver; only dashboard scope may create', async () => {
    await http().post('/api/outbox').set(auth(tok.ingest)).send({ uid: UID, threadId: '900', text: 'x' }).expect(403);
    await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: UID, threadId: '900', text: '   ' }).expect(400);
    await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: '404', threadId: '900', text: 'x' }).expect(404);

    const it = await create(`  ${SECRET_TEXT}  `);
    expect(it).toMatchObject({ uid: UID, threadId: '900', text: SECRET_TEXT, status: 'approved', approvedBy: 'anh-dashboard' });
    expect(Date.parse(it.approvedAt)).not.toBeNaN();

    const stored = await db.col(C.suggestions).findOne({ _id: new ObjectId(it.id) });
    expect(stored).toMatchObject({ draft: SECRET_TEXT, finalText: SECRET_TEXT, status: 'approved', source: 'manual' });

    const audit = await db.col(C.auditLog).find({ target: it.id }).toArray();
    expect(audit.map((a) => a.action)).toEqual(['outbox.create']);
    expect(JSON.stringify(audit)).not.toContain(SECRET_TEXT);
  });

  it('pending excludes items missing approvedBy / approvedAt, oldest first, max 5', async () => {
    const base = { uid: UID, threadId: '900', draft: 't', finalText: 't', status: 'approved', source: 'suggest', createdAt: new Date() };
    await db.col(C.suggestions).insertMany([
      { ...base, approvedAt: new Date() }, // no approvedBy
      { ...base, approvedBy: 'x' }, // no approvedAt
      { ...base, approvedBy: '', approvedAt: new Date() }, // empty approver
      { ...base, approvedBy: 'x', approvedAt: '2026-09-28T00:00:00Z' }, // not a date
      { ...base, status: 'pending', approvedBy: 'x', approvedAt: new Date() }, // not approved
    ]);
    await http().get(`/api/outbox/pending?uid=${UID}`).set(auth(tok.dashboard)).expect(403);
    expect((await http().get(`/api/outbox/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body).toEqual([]);

    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push((await create(`tin ${i}`)).id);
    const pending = (await http().get(`/api/outbox/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[];
    expect(pending.map((p) => p.id)).toEqual(ids.slice(0, 5));
    expect((await http().get('/api/outbox/pending?uid=other').set(auth(tok.ingest)).expect(200)).body).toEqual([]);

    // Unapproved items cannot be claimed either.
    const unapproved = await db.col(C.suggestions).findOne({ approvedBy: { $exists: false } });
    await http().post(`/api/outbox/${unapproved!._id.toHexString()}/claim`).set(auth(tok.ingest)).expect(409);
  });

  it('pending carries the conversation name and newest cliMsgIds so the extension can open it via search', async () => {
    await db.col(C.conversations).insertOne({ _id: `${UID}:901` as never, uid: UID, threadId: '901', name: 'Kho Kim Đồng' });
    await db.col(C.messages).insertMany([
      { _id: `${UID}:m1` as never, uid: UID, threadId: '901', cliMsgId: 'c1', sentAt: new Date(1000) },
      { _id: `${UID}:m2` as never, uid: UID, threadId: '901', cliMsgId: 'c2', sentAt: new Date(2000) },
    ]);
    await create('tin', '901');
    const [p] = (await http().get(`/api/outbox/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[];
    expect(p).toMatchObject({ threadId: '901', name: 'Kho Kim Đồng', recentCliMsgIds: ['c2', 'c1'] });
    await db.col(C.conversations).deleteMany({});
    await db.col(C.messages).deleteMany({});
  });

  it('claim is atomic: concurrent claims yield exactly one winner', async () => {
    const it = await create();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => http().post(`/api/outbox/${it.id}/claim`).set(auth(tok.ingest))),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    const won = results.find((r) => r.status === 200)!.body as OutboxItem;
    expect(won.status).toBe('sending');
    expect((await http().get(`/api/outbox/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body).toEqual([]);
    await http().post('/api/outbox/000000000000000000000000/claim').set(auth(tok.ingest)).expect(404);
    await http().post('/api/outbox/not-an-id/claim').set(auth(tok.ingest)).expect(404);
  });

  it('result: the sent text lands on the message at once; a DOM capture is never overwritten', async () => {
    const ingestMsg = (msgId: string, cliMsgId: string, extra: Record<string, unknown> = {}) =>
      http()
        .post('/api/ingest/messages')
        .set(auth(tok.ingest))
        .send({ uid: UID, items: [{ msgId, cliMsgId, threadId: '900', fromUid: '0', msgType: '1', sentAt: Date.now(), encrypted: true, contentStatus: 'pending', ...extra }] })
        .expect(200);
    const sendOk = async (text: string, ids: string[]) => {
      const it = await create(text);
      await http().post(`/api/outbox/${it.id}/claim`).set(auth(tok.ingest)).expect(200);
      await http()
        .post(`/api/outbox/${it.id}/result`)
        .set(auth(tok.ingest))
        .send({ ok: true, cliMsgId: ids[ids.length - 1], ...(ids.length > 1 ? { cliMsgIds: ids } : {}) })
        .expect(200);
    };
    const textOf = async (msgId: string) => db.col<{ _id: string }>(C.messages).findOne({ _id: `${UID}:${msgId}` }, { projection: { text: 1, contentSource: 1, contentStatus: 1, encrypted: 1 } });

    // Metadata first, then mark_sent.
    await ingestMsg('m1', 'cli-m1');
    await sendOk('Dạ em gửi anh báo giá', ['cli-m1']);
    expect(await textOf('m1')).toMatchObject({ text: 'Dạ em gửi anh báo giá', contentSource: 'outbox', contentStatus: 'complete', encrypted: false });

    // mark_sent first (multi-line: one Zalo message per line), metadata later; a re-ingest keeps the text.
    await sendOk('Dòng 1\n\nDòng 2', ['cli-a', 'cli-b']);
    await ingestMsg('ma', 'cli-a');
    await ingestMsg('mb', 'cli-b');
    await ingestMsg('mb', 'cli-b');
    expect(await textOf('ma')).toMatchObject({ text: 'Dòng 1', contentSource: 'outbox' });
    expect(await textOf('mb')).toMatchObject({ text: 'Dòng 2', contentSource: 'outbox', encrypted: false });

    // Already captured from the screen: left alone.
    await ingestMsg('md', 'cli-d');
    await db.col<{ _id: string }>(C.messages).updateOne({ _id: `${UID}:md` }, { $set: { text: 'từ màn hình', contentSource: 'dom', contentStatus: 'complete', encrypted: false } });
    await sendOk('khác', ['cli-d']);
    expect(await textOf('md')).toMatchObject({ text: 'từ màn hình', contentSource: 'dom' });
    await db.col(C.messages).deleteMany({ uid: UID });
  });

  it('result: only a claimed item can be marked; sent and failed are audited without text', async () => {
    const it = await create(SECRET_TEXT);
    // Not claimed yet → 409.
    await http().post(`/api/outbox/${it.id}/result`).set(auth(tok.ingest)).send({ ok: true }).expect(409);
    await http().post(`/api/outbox/${it.id}/claim`).set(auth(tok.ingest)).expect(200);
    await http().post(`/api/outbox/${it.id}/result`).set(auth(tok.ingest)).send({ ok: false }).expect(400);
    const sent = (
      await http()
        .post(`/api/outbox/${it.id}/result`)
        .set(auth(tok.ingest))
        .send({ ok: true, sentAt: '2026-09-28T03:00:00.000Z', cliMsgId: 'cli-1' })
        .expect(200)
    ).body as OutboxItem;
    expect(sent).toMatchObject({ status: 'sent', sentAt: '2026-09-28T03:00:00.000Z', cliMsgId: 'cli-1' });
    // Second result for the same item is refused.
    await http().post(`/api/outbox/${it.id}/result`).set(auth(tok.ingest)).send({ ok: true }).expect(409);

    const audit = await db.col(C.auditLog).find({ target: it.id }).sort({ at: 1 }).toArray();
    expect(audit.map((a) => a.action)).toEqual(['outbox.create', 'outbox.claim', 'outbox.sent']);
    expect(JSON.stringify(audit)).not.toContain(SECRET_TEXT);

    const list = (await http().get(`/api/outbox?uid=${UID}&threadId=900`).set(auth(tok.dashboard)).expect(200)).body;
    expect(list.map((x: OutboxItem) => x.status)).toEqual(['sent']);
  });

  it('a claimed item whose approval was stripped cannot be marked sent', async () => {
    const it = await create();
    await http().post(`/api/outbox/${it.id}/claim`).set(auth(tok.ingest)).expect(200);
    await db.col(C.suggestions).updateOne({ _id: new ObjectId(it.id) }, { $unset: { approvedAt: '' } });
    await http().post(`/api/outbox/${it.id}/result`).set(auth(tok.ingest)).send({ ok: true }).expect(409);
  });

  it('failed → retry re-approves by the current principal; fresh sending cannot be retried', async () => {
    const it = await create();
    await http().post(`/api/outbox/${it.id}/claim`).set(auth(tok.ingest)).expect(200);
    await http().post(`/api/outbox/${it.id}/retry`).set(auth(tok.dashboard)).expect(409); // sending, not stale
    await http()
      .post(`/api/outbox/${it.id}/result`)
      .set(auth(tok.ingest))
      .send({ ok: false, error: 'không tìm thấy hội thoại' })
      .expect(200);
    await http().post(`/api/outbox/${it.id}/retry`).set(auth(tok.ingest)).expect(403);
    const again = (await http().post(`/api/outbox/${it.id}/retry`).set(auth(tok.dashboard)).expect(200)).body;
    expect(again).toMatchObject({ status: 'approved', approvedBy: 'anh-dashboard' });
    expect(again.error).toBeUndefined();

    // A claim older than 2 minutes may be re-approved by a human.
    await http().post(`/api/outbox/${it.id}/claim`).set(auth(tok.ingest)).expect(200);
    await db
      .col(C.suggestions)
      .updateOne({ _id: new ObjectId(it.id) }, { $set: { claimedAt: new Date(Date.now() - 3 * 60_000) } });
    await http().post(`/api/outbox/${it.id}/retry`).set(auth(tok.dashboard)).expect(200);
  });

  it('state commands: react / pin / mark read go only to command-capable clients and are mirrored on success', async () => {
    await db.col(C.suggestions).deleteMany({ uid: UID });
    // A stored message to react on, and its conversation.
    await http().post('/api/ingest/messages').set(auth(tok.ingest)).send({ uid: UID, items: [{ msgId: 'rm1', cliMsgId: 'rc1', threadId: '900', fromUid: '900', msgType: '1', text: 'ok', sentAt: 1727500000000, raw: {} }] }).expect(200);
    await http().post('/api/ingest/conversations').set(auth(tok.ingest)).send({ uid: UID, items: [{ threadId: '900', type: 'user', lastMsgAt: 1727500000000, unread: 2 }] }).expect(200);

    // Unknown message → 400; wrong icon → 400.
    await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: UID, threadId: '900', action: 'react', reaction: { cliMsgId: 'nope', icon: '3' } }).expect(400);
    await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: UID, threadId: '900', action: 'react', reaction: { cliMsgId: 'rc1', icon: '9' } }).expect(400);
    const react = (await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: UID, threadId: '900', action: 'react', reaction: { cliMsgId: 'rc1', icon: '3' } }).expect(201)).body as OutboxItem;
    expect(react).toMatchObject({ action: 'react', reaction: { cliMsgId: 'rc1', icon: '3' }, text: '[Cảm xúc 👍]', status: 'approved' });
    const pin = (await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: UID, threadId: '900', action: 'pin_conversation', pin: true }).expect(201)).body as OutboxItem;
    const read = (await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: UID, threadId: '900', action: 'mark_read' }).expect(201)).body as OutboxItem;

    // Plain clients never see commands; command-capable ones do.
    expect((await http().get(`/api/outbox/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body).toEqual([]);
    const pending = (await http().get(`/api/outbox/pending?uid=${UID}&commands=1`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[];
    expect(pending.map((p) => p.action)).toEqual(['react', 'pin_conversation', 'mark_read']);

    for (const it of [react, pin, read]) {
      await http().post(`/api/outbox/${it.id}/claim`).set(auth(tok.ingest)).expect(200);
      await http().post(`/api/outbox/${it.id}/result`).set(auth(tok.ingest)).send({ ok: true, sentAt: new Date().toISOString(), ...(it.action === 'react' ? { cliMsgId: 'rc1' } : {}) }).expect(200);
    }
    // Mirrored right away: the reaction pill, the pin, the read mark.
    const r = await db.col(C.reactions).findOne({ _id: `${UID}:rm1` as never });
    expect(r).toMatchObject({ msgId: 'rm1', threadId: '900', totals: { '3': 1 }, byUser: { '0': '3' }, total: 1, mirrored: true });
    const conv = await db.col(C.conversations).findOne({ _id: `${UID}:900` as never });
    expect(conv).toMatchObject({ pinned: true, unread: 0 });
    const page = await http().get(`/api/conversations/${UID}:900/messages`).set(auth(tok.dashboard)).expect(200);
    expect(page.body.items.find((m: { msgId: string }) => m.msgId === 'rm1').reactions).toEqual({ total: 1, icons: [{ icon: '3', emoji: '👍', count: 1 }], mine: '3' });
    const list = await http().get('/api/outbox').query({ uid: UID, threadId: '900' }).set(auth(tok.dashboard)).expect(200);
    expect(list.body.map((o: OutboxItem) => o.status)).toEqual(['sent', 'sent', 'sent']);
  });

  it('long-polls /pending: an empty queue is held until a message is approved', async () => {
    await db.col(C.suggestions).deleteMany({ uid: UID });
    const t0 = Date.now();
    // Nothing pending: the request is held, then answered as soon as the Dashboard creates an item.
    const held = http().get(`/api/outbox/pending?uid=${UID}&wait=10`).set(auth(tok.ingest));
    await new Promise((r) => setTimeout(r, 300));
    const created = await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: UID, threadId: '222', text: 'Dạ có ngay' }).expect(201);
    const res = await held.expect(200);
    expect(res.body.map((i: OutboxItem) => i.id)).toEqual([created.body.id]);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(elapsed).toBeLessThan(3000); // answered by the notify, not by the 10 s timeout

    // Something already pending: answered at once even with wait.
    const t1 = Date.now();
    await http().get(`/api/outbox/pending?uid=${UID}&wait=10`).set(auth(tok.ingest)).expect(200);
    expect(Date.now() - t1).toBeLessThan(1000);

    // Empty queue and a short wait: returns [] after the wait.
    await db.col(C.suggestions).deleteMany({ uid: UID });
    const t2 = Date.now();
    expect((await http().get(`/api/outbox/pending?uid=${UID}&wait=1`).set(auth(tok.ingest)).expect(200)).body).toEqual([]);
    expect(Date.now() - t2).toBeGreaterThanOrEqual(900);

    await http().get(`/api/outbox/pending?uid=${UID}&wait=60`).set(auth(tok.ingest)).expect(400);
  });

  it('MCP list_pending_suggestions (claim) + mark_sent enforce approval', async () => {
    const it = await create();
    const bare = await db.col(C.suggestions).insertOne({
      uid: UID,
      threadId: '900',
      draft: 't',
      finalText: 't',
      status: 'approved',
      source: 'suggest',
      createdAt: new Date(),
    } as never);

    const client = new Client({ name: 'test', version: '0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', baseUrl), {
        requestInit: { headers: auth(tok.mcp) },
      }),
    );
    const call = async (name: string, args: Record<string, unknown>) => {
      const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
      return { isError: !!r.isError, body: JSON.parse(r.content[0].text) };
    };

    const listed = await call('list_pending_suggestions', { uid: UID });
    expect(listed.body.items.map((x: OutboxItem) => x.id)).toEqual([it.id]);

    const claimed = await call('list_pending_suggestions', { uid: UID, claim: true });
    expect(claimed.body.items).toHaveLength(1);
    expect(claimed.body.items[0]).toMatchObject({ id: it.id, status: 'sending' });

    const denied = await call('mark_sent', { suggestionId: bare.insertedId.toHexString() });
    expect(denied.isError).toBe(true);

    const ok = await call('mark_sent', { suggestionId: it.id, zaloMsgId: 'z1' });
    expect(ok.body).toMatchObject({ id: it.id, status: 'sent' });
    expect((await db.col(C.auditLog).findOne({ target: it.id, action: 'outbox.sent' }))?.actor).toBe('mcp:anh-mcp');
    await client.close();
  });
});
