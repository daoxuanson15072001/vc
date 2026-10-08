import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { OutboxItem } from '@vclinks/shared';
import { createHmac } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { CredentialsService } from '../src/channels/credentials.service';
import { FacebookPageSender, OUTSIDE_WINDOW_ERROR } from '../src/channels/facebook-page/facebook-page.sender';
import { FacebookWebhookService } from '../src/channels/facebook-page/facebook-webhook.service';
import { C, DbService } from '../src/db/db.service';
import { OutboxDispatcher } from '../src/outbox/outbox.dispatcher';

const APP_SECRET = 'test-app-secret';
const VERIFY = 'verify-me';
const PAGE_ID = '1100';
const UID = `fbp_${PAGE_ID}`;
const PSID = '7001';
const USER_CODE = 'code-abc';
const SHORT_TOKEN = 'EAA-SHORT-USER-TOKEN';
const LONG_TOKEN = 'EAA-LONG-USER-TOKEN';
const PAGE_TOKEN = 'EAA-PAGE-TOKEN-SECRET';
const SECRETS = [APP_SECRET, SHORT_TOKEN, LONG_TOKEN, PAGE_TOKEN];

type Json = Record<string, unknown>;
interface FakeResponse {
  status?: number;
  json: unknown;
}

describe('Fanpage Facebook channel', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  let dashboard = '';
  const auth = () => ({ Authorization: `Bearer ${dashboard}` });
  const http = () => request(app.getHttpServer());

  /** Every HTTP response body the tests saw, checked for leaked secrets at the end. */
  const responses: string[] = [];
  const keep = <T extends { text?: string; headers?: Record<string, string> }>(r: T) => {
    responses.push(r.text ?? '', JSON.stringify(r.headers ?? {}));
    return r;
  };

  /** Graph API calls: [method, url, body]. */
  const calls: { method: string; url: URL; body?: Json }[] = [];
  let graph: (method: string, url: URL, body?: Json) => FakeResponse;
  const realFetch = global.fetch;

  const defaultGraph = (method: string, url: URL): FakeResponse => {
    const p = url.pathname;
    if (p.endsWith('/oauth/access_token')) {
      if (url.searchParams.get('grant_type') === 'fb_exchange_token')
        return { json: { access_token: LONG_TOKEN, expires_in: 5e6 } };
      return url.searchParams.get('code') === USER_CODE
        ? { json: { access_token: SHORT_TOKEN } }
        : { status: 400, json: { error: { code: 100 } } };
    }
    if (p.endsWith('/me/accounts'))
      return { json: { data: [{ id: PAGE_ID, name: 'VCparts Fanpage', access_token: PAGE_TOKEN }] } };
    if (p.endsWith(`/${PAGE_ID}/subscribed_apps`)) return { json: { success: true } };
    if (p.endsWith(`/${PAGE_ID}/messages`) && method === 'POST') return { json: { recipient_id: PSID, message_id: 'm_sent_1' } };
    if (/\/\d+$/.test(p) && method === 'GET') {
      return {
        json: { name: 'Nguyễn Văn Khách', profile_pic: 'https://platform-lookaside.fbsbx.com/p.jpg', id: p.split('/').pop() },
      };
    }
    return { status: 404, json: { error: { code: 803 } } };
  };

  const sign = (raw: string, secret = APP_SECRET) => `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  const deliver = (body: unknown, signature?: string) => {
    const raw = JSON.stringify(body);
    const req = http().post('/api/webhooks/facebook').set('Content-Type', 'application/json');
    if (signature !== '') req.set('X-Hub-Signature-256', signature ?? sign(raw));
    return req.send(raw);
  };
  const event = (messaging: Json[], pageId = PAGE_ID) => ({
    object: 'page',
    entry: [{ id: pageId, time: Date.now(), messaging }],
  });
  const inbound = (mid: string, text: string, ts = Date.now()) => ({
    sender: { id: PSID },
    recipient: { id: PAGE_ID },
    timestamp: ts,
    message: { mid, text },
  });

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_fbpage_test');
    process.env.OUTBOX_DISPATCHER = 'off';
    process.env.CREDENTIALS_KEY = Buffer.alloc(32, 9).toString('base64');
    process.env.FB_APP_ID = '999';
    process.env.FB_APP_SECRET = APP_SECRET;
    process.env.FB_VERIFY_TOKEN = VERIFY;
    process.env.PUBLIC_BASE_URL = 'https://vclinks.test';

    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname !== 'graph.facebook.com') return realFetch(input, init);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Json) : undefined;
      calls.push({ method, url, body });
      const r = graph(method, url, body);
      return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
    });
    graph = defaultGraph;

    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    dashboard = await app.get(TokenService).create('anh-dashboard', ['dashboard']);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
    jest.restoreAllMocks();
    for (const k of ['OUTBOX_DISPATCHER', 'CREDENTIALS_KEY', 'FB_APP_ID', 'FB_APP_SECRET', 'FB_VERIFY_TOKEN', 'PUBLIC_BASE_URL'])
      delete process.env[k];
  });

  beforeEach(() => {
    calls.length = 0;
    graph = defaultGraph;
  });

  describe('connect flow', () => {
    it('requires the dashboard scope', async () => {
      keep(await http().get('/api/channels/facebook-page/connect').expect(401));
    });

    it('rejects a callback with an unknown state', async () => {
      const r = keep(await http().get(`/api/channels/facebook-page/callback?code=${USER_CODE}&state=forged`).expect(302));
      expect(r.headers.location).toBe('https://vclinks.test/channels?fb_page=error&reason=state');
      expect(calls).toHaveLength(0);
    });

    it('connects every granted page: account, encrypted token, webhook subscription', async () => {
      const c = keep(await http().get('/api/channels/facebook-page/connect').set(auth()).expect(200));
      const dialog = new URL(c.body.url);
      expect(dialog.origin + dialog.pathname).toMatch(/^https:\/\/www\.facebook\.com\/v\d+\.0\/dialog\/oauth$/);
      expect(dialog.searchParams.get('redirect_uri')).toBe('https://vclinks.test/api/channels/facebook-page/callback');
      expect(dialog.searchParams.get('scope')).toContain('pages_messaging');
      const state = dialog.searchParams.get('state')!;

      const r = keep(await http().get(`/api/channels/facebook-page/callback?code=${USER_CODE}&state=${state}`).expect(302));
      expect(r.headers.location).toBe('https://vclinks.test/channels?fb_page=ok&connected=1&failed=0');

      const sub = calls.find((x) => x.url.pathname.endsWith('/subscribed_apps'))!;
      expect(sub.method).toBe('POST');
      expect(sub.url.searchParams.get('subscribed_fields')).toBe('messages,message_echoes,messaging_postbacks');
      expect(sub.url.searchParams.get('appsecret_proof')).toMatch(/^[0-9a-f]{64}$/);

      expect(await db.col(C.accounts).findOne({ _id: UID as never })).toMatchObject({
        channel: 'fb_page',
        label: 'VCparts Fanpage',
      });
      expect(await app.get(CredentialsService).get(UID)).toEqual({ pageAccessToken: PAGE_TOKEN });
      // The user token is used once and never stored.
      expect(await db.col('channel_credentials').countDocuments({})).toBe(1);

      // State is single-use.
      const again = keep(await http().get(`/api/channels/facebook-page/callback?code=${USER_CODE}&state=${state}`).expect(302));
      expect(again.headers.location).toContain('reason=state');
    });

    it('reports status without any secret', async () => {
      const r = keep(await http().get('/api/channels/facebook-page').set(auth()).expect(200));
      expect(r.body.webhookUrl).toBe('https://vclinks.test/api/webhooks/facebook');
      expect(r.body.configured).toEqual({
        appId: true,
        appSecret: true,
        verifyToken: true,
        publicBaseUrl: true,
        credentialsKey: true,
      });
      expect(r.body.pages).toEqual([
        expect.objectContaining({ uid: UID, pageId: PAGE_ID, status: 'connected', subscribed: true, hasCredentials: true }),
      ]);
      expect(r.text).not.toContain(VERIFY);
    });
  });

  describe('webhook', () => {
    it('answers the verification challenge only with the right verify token', async () => {
      const ok = keep(
        await http().get(`/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=12345`).expect(200),
      );
      expect(ok.text).toBe('12345');
      keep(await http().get('/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1').expect(403));
    });

    it('rejects missing or wrong signatures', async () => {
      const body = event([inbound('m_bad', 'hello')]);
      keep(await deliver(body, '').expect(401));
      keep(await deliver(body, sign(JSON.stringify(body), 'other-secret')).expect(401));
      keep(await deliver(body, 'sha256=abc').expect(401));
      expect(await db.col(C.messages).countDocuments({ uid: UID })).toBe(0);
    });

    it('maps inbound and echo messages, derives the conversation, fetches the profile once', async () => {
      const t0 = Date.now() - 60_000;
      const body = event([
        inbound('m_in_1', 'Có má phanh Vios 2019 không shop?', t0),
        {
          sender: { id: PSID },
          recipient: { id: PAGE_ID },
          timestamp: t0 + 1000,
          message: {
            mid: 'm_in_2',
            attachments: [
              { type: 'image', payload: { url: 'https://scontent.xx.fbcdn.net/a.jpg' } },
              { type: 'file', payload: { url: 'http://insecure/x.pdf' } },
            ],
          },
        },
        {
          sender: { id: PAGE_ID },
          recipient: { id: PSID },
          timestamp: t0 + 2000,
          message: { mid: 'm_echo_1', is_echo: true, app_id: 123, text: 'Dạ có ạ' },
        },
        { sender: { id: PSID }, recipient: { id: PAGE_ID }, timestamp: t0 + 3000, read: { watermark: t0 } },
      ]);
      keep(await deliver(body).expect(200));
      await app.get(FacebookWebhookService).drain();

      const msgs = await db.col(C.messages).find({ uid: UID }).sort({ sentAt: 1 }).toArray();
      expect(msgs.map((m) => m._id)).toEqual([`${UID}:m_in_1`, `${UID}:m_in_2`, `${UID}:m_echo_1`]);
      expect(msgs[0]).toMatchObject({
        threadId: PSID,
        fromUid: PSID,
        text: 'Có má phanh Vios 2019 không shop?',
        msgType: 'text',
      });
      expect(msgs[1]).toMatchObject({
        fromUid: PSID,
        msgType: 'other',
        content: { images: ['https://scontent.xx.fbcdn.net/a.jpg'] },
      });
      expect(msgs[1].content.files).toBeUndefined(); // non-https dropped
      expect(msgs[2]).toMatchObject({ threadId: PSID, fromUid: '0', toUid: PSID, text: 'Dạ có ạ', raw: { isEcho: true } });

      expect(await db.col(C.conversations).findOne({ _id: `${UID}:${PSID}` as never })).toMatchObject({
        type: 'user',
        messageCount: 3,
      });
      expect(await db.col(C.contacts).findOne({ _id: `${UID}:${PSID}` as never })).toMatchObject({
        displayName: 'Nguyễn Văn Khách',
        avatar: 'https://platform-lookaside.fbsbx.com/p.jpg',
      });
      expect(calls.filter((c) => c.url.pathname.endsWith(`/${PSID}`))).toHaveLength(1);
    });

    it('is idempotent on re-delivery and refreshes the profile at most once a day', async () => {
      const t0 = Date.now() - 60_000;
      const body = event([inbound('m_in_1', 'Có má phanh Vios 2019 không shop?', t0)]);
      keep(await deliver(body).expect(200));
      keep(await deliver(body).expect(200));
      await app.get(FacebookWebhookService).drain();
      expect(await db.col(C.messages).countDocuments({ uid: UID })).toBe(3);
      expect(await db.col(C.conversations).findOne({ _id: `${UID}:${PSID}` as never })).toMatchObject({ messageCount: 3 });
      expect(calls.filter((c) => c.url.pathname.endsWith(`/${PSID}`))).toHaveLength(0);
    });

    it('ignores deliveries for pages that are not connected', async () => {
      keep(await deliver(event([inbound('m_other', 'x')], '5555')).expect(200));
      expect(await db.col(C.messages).countDocuments({ _id: 'fbp_5555:m_other' as never })).toBe(0);
    });
  });

  describe('sender', () => {
    const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
      id: 'x',
      uid: UID,
      channel: 'fb_page',
      threadId: PSID,
      text: 'Dạ bên em còn hàng ạ',
      status: 'sending',
      approvedBy: 'anh',
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      ...over,
    });

    it('sends with messaging_type RESPONSE inside the 24h window (through the dispatcher)', async () => {
      const created = keep(
        await http().post('/api/outbox').set(auth()).send({ uid: UID, threadId: PSID, text: 'Dạ bên em còn hàng ạ' }).expect(201),
      ).body as OutboxItem;
      await app.get(OutboxDispatcher).sweep();
      const send = calls.find((c) => c.url.pathname.endsWith(`/${PAGE_ID}/messages`))!;
      expect(send.method).toBe('POST');
      expect(send.body).toEqual({
        recipient: { id: PSID },
        messaging_type: 'RESPONSE',
        message: { text: 'Dạ bên em còn hàng ạ' },
      });
      expect(await db.col(C.suggestions).findOne({ _id: new ObjectId(created.id) })).toMatchObject({
        status: 'sent',
        cliMsgId: 'm_sent_1',
      });
    });

    it('refuses outside the 24h window without calling Graph', async () => {
      const sender = app.get(FacebookPageSender);
      const r = await sender.send(item({ threadId: '8888' }));
      expect(r.ok).toBe(false);
      expect(r.error).toContain(OUTSIDE_WINDOW_ERROR);

      await db
        .col(C.messages)
        .insertOne({
          _id: `${UID}:old` as never,
          uid: UID,
          threadId: '8889',
          fromUid: '8889',
          sentAt: new Date(Date.now() - 25 * 3600_000),
        });
      const old = await sender.send(item({ threadId: '8889' }));
      expect(old.error).toMatch(/Tin cuối của khách: /);
      expect(calls).toHaveLength(0);
    });

    it('maps Graph errors to short Vietnamese reasons', async () => {
      const sender = app.get(FacebookPageSender);
      const cases: [Json, RegExp][] = [
        [{ code: 10, error_subcode: 2018278 }, /Ngoài khung 24 giờ/],
        [{ code: 551, error_subcode: 1545041 }, /không nhận tin/],
        [{ code: 613 }, /giới hạn/],
        [{ code: 200 }, /pages_messaging/],
        [{ code: 190 }, /kết nối lại/],
      ];
      for (const [error, re] of cases) {
        graph = () => ({ status: 400, json: { error: { ...error, message: `leaky ${PAGE_TOKEN}`, fbtrace_id: 't' } } });
        const r = await sender.send(item());
        expect(r).toEqual({ ok: false, error: expect.stringMatching(re) });
        expect(r.error).not.toContain(PAGE_TOKEN);
        expect(r.error).not.toContain('Dạ bên em');
      }
      // 190 flags the page for reconnection.
      const s = keep(await http().get('/api/channels/facebook-page').set(auth()).expect(200));
      expect(s.body.pages[0].tokenInvalidAt).toEqual(expect.any(String));

      graph = () => {
        throw new Error('network down');
      };
      expect((await sender.send(item())).error).toMatch(/Graph API/);
    });
  });

  describe('disconnect', () => {
    it('unsubscribes, deletes the token, keeps history, and stops ingest', async () => {
      const r = keep(await http().delete(`/api/channels/facebook-page/${UID}`).set(auth()).expect(200));
      expect(r.body).toEqual({ ok: true, unsubscribed: true });
      expect(calls.find((c) => c.method === 'DELETE')?.url.pathname).toMatch(new RegExp(`/${PAGE_ID}/subscribed_apps$`));
      expect(await app.get(CredentialsService).get(UID)).toBeNull();
      expect(await db.col(C.messages).countDocuments({ uid: UID })).toBeGreaterThan(0);

      keep(await deliver(event([inbound('m_after', 'còn không')])).expect(200));
      expect(await db.col(C.messages).countDocuments({ _id: `${UID}:m_after` as never })).toBe(0);
      expect(
        (await app.get(FacebookPageSender).send({ ...({} as OutboxItem), uid: UID, threadId: PSID, text: 't' })).error,
      ).toMatch(/chưa kết nối/);
      keep(await http().delete('/api/channels/facebook-page/5200').set(auth()).expect(400));
    });
  });

  describe('secrets', () => {
    it('never exposes tokens or the app secret in responses or the audit log', async () => {
      const audit = JSON.stringify(await db.col(C.auditLog).find({}).toArray());
      expect(audit).toContain('fb_page.connect');
      for (const s of SECRETS) {
        expect(audit).not.toContain(s);
        for (const body of responses) expect(body).not.toContain(s);
      }
      // Nothing secret leaked into ingested documents either.
      const stored = JSON.stringify([
        ...(await db.col(C.messages).find({}).toArray()),
        ...(await db.col(C.contacts).find({}).toArray()),
        ...(await db.col('fb_pages').find({}).toArray()),
      ]);
      for (const s of SECRETS) expect(stored).not.toContain(s);
    });
  });
});
