import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AccountStatus, OutboxItem } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { ChannelSenderRegistry, type ChannelSendResult } from '../src/channels/channel-sender';
import { CredentialsService } from '../src/channels/credentials.service';
import { C, DbService } from '../src/db/db.service';
import { OutboxDispatcher } from '../src/outbox/outbox.dispatcher';

const ZALO = '5200';
const PAGE = 'fbp_777';

describe('Multi-channel: accounts, outbox routing, dispatcher, credentials', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  const sent: OutboxItem[] = [];
  let nextResult: ChannelSendResult = { ok: true, externalMsgId: 'm_1' };
  const tok: Record<'dashboard' | 'ingest' | 'mcp', string> = { dashboard: '', ingest: '', mcp: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_channels_test');
    process.env.OUTBOX_DISPATCHER = 'off';
    process.env.CREDENTIALS_KEY = Buffer.alloc(32, 7).toString('base64');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    app.get(ChannelSenderRegistry).register({
      channel: 'fb_page',
      send: async (item) => {
        sent.push(item);
        return nextResult;
      },
    });
    const tokens = app.get(TokenService);
    for (const s of ['dashboard', 'ingest', 'mcp'] as const) tok[s] = await tokens.create(`anh-${s}`, [s]);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: ZALO, label: 'Zalo' }).expect(201);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: PAGE, label: 'Page', channel: 'fb_page' }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
    delete process.env.OUTBOX_DISPATCHER;
    delete process.env.CREDENTIALS_KEY;
  });

  beforeEach(async () => {
    sent.length = 0;
    nextResult = { ok: true, externalMsgId: 'm_1' };
    await db.col(C.suggestions).deleteMany({});
  });

  const create = async (uid: string, text = 'Dạ em chào anh') =>
    (await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid, threadId: '900', text }).expect(201))
      .body as OutboxItem;

  it('rejects a uid whose prefix contradicts the channel, and reports channels', async () => {
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: '123', label: 'x', channel: 'fb_page' }).expect(400);
    const accounts = (await http().get('/api/accounts').set(auth(tok.dashboard)).expect(200)).body as AccountStatus[];
    expect(Object.fromEntries(accounts.map((a) => [a.uid, a.channel]))).toEqual({ [ZALO]: 'zalo', [PAGE]: 'fb_page' });
  });

  it('never hands API-channel items to the extension or MCP', async () => {
    const page = await create(PAGE);
    const zalo = await create(ZALO);
    expect(page.channel).toBe('fb_page');
    const all = (await http().get('/api/outbox/pending').set(auth(tok.ingest)).expect(200)).body as OutboxItem[];
    expect(all.map((i) => i.id)).toEqual([zalo.id]);
    expect((await http().get(`/api/outbox/pending?uid=${PAGE}`).set(auth(tok.ingest)).expect(200)).body).toEqual([]);
    await http().post(`/api/outbox/${page.id}/claim`).set(auth(tok.ingest)).expect(409);
  });

  it('dispatcher sends approved API-channel items and records the outcome', async () => {
    const page = await create(PAGE);
    await app.get(OutboxDispatcher).sweep();
    expect(sent.map((i) => i.id)).toEqual([page.id]);
    const doc = await db.col(C.suggestions).findOne({ _id: new ObjectId(page.id) });
    expect(doc).toMatchObject({ status: 'sent', cliMsgId: 'm_1', claimedBy: 'dispatcher:fb_page' });

    nextResult = { ok: false, error: 'outside 24h window' };
    const failed = await create(PAGE);
    await app.get(OutboxDispatcher).sweep();
    expect(await db.col(C.suggestions).findOne({ _id: new ObjectId(failed.id) })).toMatchObject({
      status: 'failed',
      error: 'outside 24h window',
    });
  });

  it('dispatcher never sends an item without approval fields', async () => {
    await db.col(C.suggestions).insertOne({
      uid: PAGE,
      threadId: '900',
      draft: 't',
      finalText: 't',
      status: 'approved',
      source: 'suggest',
      approvedAt: new Date(),
      createdAt: new Date(),
    });
    await app.get(OutboxDispatcher).sweep();
    expect(sent).toEqual([]);
  });

  it('stores credentials encrypted and never in plaintext', async () => {
    const creds = app.get(CredentialsService);
    await creds.put(PAGE, { pageAccessToken: 'EAAG-super-secret' }, { expiresAt: new Date(Date.now() + 1000) });
    expect(await creds.get<{ pageAccessToken: string }>(PAGE)).toEqual({ pageAccessToken: 'EAAG-super-secret' });
    const raw = await db.col('channel_credentials').findOne({ _id: PAGE as never });
    expect(JSON.stringify(raw)).not.toContain('super-secret');
    expect((await creds.list('fb_page')).map((c) => c.uid)).toEqual([PAGE]);
  });
});
