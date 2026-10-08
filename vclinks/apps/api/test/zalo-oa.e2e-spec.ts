import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { OutboxItem } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { CredentialsService } from '../src/channels/credentials.service';
import { ZOA_ACCOUNTS } from '../src/channels/zalo-oa/zalo-oa.store';
import { ZaloOaTokenService } from '../src/channels/zalo-oa/zalo-oa.tokens';
import { ZaloOaWebhookService } from '../src/channels/zalo-oa/zalo-oa.webhook.service';
import { C, DbService } from '../src/db/db.service';
import { OutboxDispatcher } from '../src/outbox/outbox.dispatcher';

const APP_ID = '3608465249409039';
const APP_SECRET = 'app-secret-key-xyz';
const BASE = 'https://vc.example.com';
const OA_ID = '388613280878808645';
const UID = `zoa_${OA_ID}`;
const USER = '246845883529197922';

/**
 * In-memory stand-in for Zalo's OAuth + OA Open API, served through a mocked
 * global fetch. It enforces the real rules that matter here: codes and refresh
 * tokens are single-use, and the old access token dies when a new one is issued.
 */
class FakeZalo {
  challenge = '';
  code = 'AUTH_CODE_1';
  validRefresh = new Set<string>();
  validAccess = new Set<string>();
  refreshUsed: string[] = [];
  issued: string[] = [];
  userDetailCalls = 0;
  csCalls: { token: string; userId: string; text: string }[] = [];
  /** Next /message/cs answers (else success). */
  csQueue: unknown[] = [];
  networkDown = false;
  private n = 0;

  issue() {
    this.n++;
    const at = `AT_secret_${this.n}_${Math.random().toString(36).slice(2)}`;
    const rt = `RT_secret_${this.n}_${Math.random().toString(36).slice(2)}`;
    this.validAccess.clear(); // the previous access token dies
    this.validAccess.add(at);
    this.validRefresh.add(rt);
    this.issued.push(at, rt);
    return { access_token: at, refresh_token: rt, expires_in: '90000' };
  }

  async handle(url: string, init: RequestInit = {}): Promise<Response> {
    const json = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
    if (this.networkDown) throw new TypeError('fetch failed');
    const headers = new Headers(init.headers as HeadersInit);
    const u = new URL(url);

    if (u.host === 'oauth.zaloapp.com' && u.pathname === '/v4/oa/access_token') {
      if (headers.get('secret_key') !== APP_SECRET) return json({ error: -14002, error_name: 'Invalid secret key' });
      const f = new URLSearchParams(String(init.body));
      if (f.get('app_id') !== APP_ID) return json({ error: -14001, error_name: 'Invalid app_id' });
      if (f.get('grant_type') === 'authorization_code') {
        const verifier = f.get('code_verifier') ?? '';
        const ok = createHash('sha256').update(verifier).digest('base64url') === this.challenge;
        if (f.get('code') !== this.code || !ok) return json({ error: -14019, error_name: 'Invalid code or verifier' });
        this.code = ''; // single use
        return json(this.issue());
      }
      if (f.get('grant_type') === 'refresh_token') {
        const rt = f.get('refresh_token') ?? '';
        this.refreshUsed.push(rt);
        await new Promise((r) => setTimeout(r, 40)); // widen race windows
        if (!this.validRefresh.delete(rt)) return json({ error: -14014, error_name: 'Invalid refresh token' });
        return json(this.issue());
      }
    }

    if (u.host === 'openapi.zalo.me') {
      const token = headers.get('access_token') ?? '';
      if (u.searchParams.has('access_token')) throw new Error('token must never be in a URL');
      if (!this.validAccess.has(token)) return json({ error: -216, message: 'Access token is invalid' });
      if (u.pathname === '/v2.0/oa/getoa') {
        return json({ error: 0, message: 'Success', data: { oa_id: OA_ID, name: 'VC Parts OA', avatar: 'http://s160-ava-talk.zadn.vn/a/oa.jpg' } });
      }
      if (u.pathname === '/v3.0/oa/user/detail') {
        this.userDetailCalls++;
        const { user_id } = JSON.parse(u.searchParams.get('data') ?? '{}');
        return json({
          error: 0,
          message: 'Success',
          data: { user_id, display_name: 'Anh Tuấn', avatars: { '120': 'https://s120-ava-talk.zadn.vn/u.jpg', '240': 'https://s240-ava-talk.zadn.vn/u.jpg' } },
        });
      }
      if (u.pathname === '/v3.0/oa/message/cs' && init.method === 'POST') {
        const body = JSON.parse(String(init.body));
        this.csCalls.push({ token, userId: body.recipient.user_id, text: body.message.text });
        const next = this.csQueue.shift();
        if (next) return json(next);
        return json({ error: 0, message: 'Success', data: { message_id: `mid_${this.csCalls.length}`, user_id: body.recipient.user_id, sent_time: String(Date.now()) } });
      }
    }
    return json({ error: -1, message: `unexpected ${u.host}${u.pathname}` }, 404);
  }
}

const sign = (raw: string, timestamp: string, secret = APP_SECRET) =>
  createHash('sha256').update(APP_ID + raw + timestamp + secret).digest('hex');

describe('Zalo OA channel: connect, webhook, tokens, sender', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  let zalo: FakeZalo;
  let dashboard = '';
  const realFetch = global.fetch;
  /** Every HTTP response body seen by the test, checked for leaked tokens at the end. */
  const seen: string[] = [];
  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${dashboard}` });

  const hook = async (event: Record<string, unknown>, opts: { sig?: string; prefix?: boolean } = {}) => {
    const raw = JSON.stringify(event);
    const sig = opts.sig ?? sign(raw, String(event.timestamp));
    const res = await http()
      .post('/api/webhooks/zalo-oa')
      .set('Content-Type', 'application/json')
      .set('X-ZEvent-Signature', opts.prefix ? `mac=${sig}` : sig)
      .send(raw);
    seen.push(res.text);
    return res;
  };

  const userText = (msgId: string, text: string, ts = Date.now()) => ({
    app_id: APP_ID,
    sender: { id: USER },
    user_id_by_app: '552177279717587730',
    recipient: { id: OA_ID },
    event_name: 'user_send_text',
    message: { text, msg_id: msgId },
    timestamp: String(ts),
  });

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    Object.assign(process.env, {
      MONGO_URI: mongo.getUri('vclinks_zalo_oa_test'),
      OUTBOX_DISPATCHER: 'off',
      ZALO_OA_TOKEN_REFRESH: 'off',
      CREDENTIALS_KEY: Buffer.alloc(32, 9).toString('base64'),
      ZALO_OA_APP_ID: APP_ID,
      ZALO_OA_SECRET_KEY: APP_SECRET,
      PUBLIC_BASE_URL: BASE,
    });
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    dashboard = await app.get(TokenService).create('anh-dashboard', ['dashboard']);
    zalo = new FakeZalo();
    global.fetch = ((url: string | URL | Request, init?: RequestInit) => zalo.handle(String(url), init)) as typeof fetch;
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await app?.close();
    await mongo?.stop();
    for (const k of ['OUTBOX_DISPATCHER', 'ZALO_OA_TOKEN_REFRESH', 'CREDENTIALS_KEY', 'ZALO_OA_APP_ID', 'ZALO_OA_SECRET_KEY', 'PUBLIC_BASE_URL']) {
      delete process.env[k];
    }
  });

  it('connects an OA with OAuth v4 + PKCE and stores tokens only encrypted', async () => {
    const res = await http().get('/api/channels/zalo-oa/connect').set(auth()).expect(200);
    const url = new URL(res.body.url);
    expect(`${url.origin}${url.pathname}`).toBe('https://oauth.zaloapp.com/v4/oa/permission');
    expect(url.searchParams.get('app_id')).toBe(APP_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(`${BASE}/api/channels/zalo-oa/callback`);
    const state = url.searchParams.get('state')!;
    zalo.challenge = url.searchParams.get('code_challenge')!;
    expect(zalo.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // A forged state is refused before any token exchange.
    const bad = await http().get('/api/channels/zalo-oa/callback').query({ code: zalo.code, state: 'forged', oa_id: OA_ID }).expect(302);
    expect(bad.headers.location).toBe(`${BASE}/channels?zalo_oa=error&reason=invalid_state`);

    const cb = await http().get('/api/channels/zalo-oa/callback').query({ code: zalo.code, state, oa_id: OA_ID }).expect(302);
    expect(cb.headers.location).toBe(`${BASE}/channels?zalo_oa=connected&uid=${UID}`);
    // The state is single use.
    const again = await http().get('/api/channels/zalo-oa/callback').query({ code: 'x', state, oa_id: OA_ID }).expect(302);
    expect(again.headers.location).toContain('reason=invalid_state');

    expect(await db.col(C.accounts).findOne({ _id: UID as never })).toMatchObject({ channel: 'zalo_oa', label: 'VC Parts OA' });
    const creds = await app.get(CredentialsService).get<{ accessToken: string }>(UID);
    expect(zalo.validAccess.has(creds!.accessToken)).toBe(true);

    const st = await http().get('/api/channels/zalo-oa').set(auth()).expect(200);
    seen.push(st.text);
    expect(st.body.webhookUrl).toBe(`${BASE}/api/webhooks/zalo-oa`);
    expect(st.body.accounts).toEqual([
      expect.objectContaining({ uid: UID, oaId: OA_ID, name: 'VC Parts OA', avatar: 'https://s160-ava-talk.zadn.vn/a/oa.jpg', hasCredentials: true, needsReconnect: false }),
    ]);
    expect(Date.parse(st.body.accounts[0].accessExpiresAt) - Date.now()).toBeGreaterThan(24 * 3600_000);
  });

  it('drops webhooks with a missing or wrong signature (answers 200, ingests nothing)', async () => {
    // Zalo's console "Kiểm tra" only saves the webhook URL on a 200, so bad signatures are dropped, not refused.
    const dropped = (r: { status: number; body: unknown }) => {
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: false });
    };
    const ev = userText('m_sig', 'xin chào');
    const raw = JSON.stringify(ev);
    dropped(await http().post('/api/webhooks/zalo-oa').set('Content-Type', 'application/json').send(raw));
    dropped(await hook(ev, { sig: sign(raw, ev.timestamp, 'wrong-secret') }));
    // Body tampered after signing.
    const sig = sign(raw, ev.timestamp);
    dropped(
      await http()
        .post('/api/webhooks/zalo-oa')
        .set('Content-Type', 'application/json')
        .set('X-ZEvent-Signature', sig)
        .send(raw.replace('xin chào', 'chuyển tiền')),
    );
    // Another app's event, even correctly signed for it.
    dropped(await hook({ ...ev, app_id: '999' }));
    expect(await db.col(C.messages).countDocuments({ uid: UID })).toBe(0);
  });

  it('maps inbound and OA-echo events, and ingests re-deliveries idempotently', async () => {
    const t0 = Date.now() - 60_000;
    expect((await hook(userText('m_in_1', 'Báo giá lọc gió Vios 2019', t0))).status).toBe(200);
    // `mac=` prefixed header form is accepted too.
    expect((await hook(userText('m_in_1', 'Báo giá lọc gió Vios 2019', t0), { prefix: true })).status).toBe(200);
    await hook({
      app_id: APP_ID,
      sender: { id: USER },
      recipient: { id: OA_ID },
      event_name: 'user_send_image',
      message: {
        msg_id: 'm_in_img',
        attachments: [
          { type: 'image', payload: { thumbnail: 'http://t.f6.photo.talk.zdn.vn/a.jpg', url: 'http://f6.photo.talk.zdn.vn/a.jpg' } },
          { type: 'image', payload: { url: 'http://evil.example.com/b.jpg' } },
        ],
      },
      timestamp: String(t0 + 1000),
    });
    await hook({
      app_id: APP_ID,
      sender: { id: OA_ID, admin_id: '4267886274574868951' },
      recipient: { id: USER },
      event_name: 'oa_send_text',
      message: { text: 'Dạ em gửi anh báo giá ạ', msg_id: 'm_out_1' },
      user_id_by_app: '552177279717587730',
      timestamp: String(t0 + 2000),
    });
    // Non-message events are acknowledged and ignored.
    expect((await hook({ app_id: APP_ID, event_name: 'follow', follower: { id: USER }, oa_id: OA_ID, timestamp: String(t0) })).status).toBe(200);

    const msgs = await db.col(C.messages).find({ uid: UID }).sort({ sentAt: 1 }).toArray();
    expect(msgs.map((m) => m._id)).toEqual([`${UID}:m_in_1`, `${UID}:m_in_img`, `${UID}:m_out_1`]);
    expect(msgs[0]).toMatchObject({ threadId: USER, fromUid: USER, toUid: OA_ID, text: 'Báo giá lọc gió Vios 2019', msgType: 'user_send_text' });
    expect(msgs[1].content).toEqual({ images: ['https://f6.photo.talk.zdn.vn/a.jpg'], kind: 'image' });
    expect(msgs[2]).toMatchObject({ threadId: USER, fromUid: '0', toUid: USER, text: 'Dạ em gửi anh báo giá ạ' });
    expect(msgs.every((m) => m.raw === undefined)).toBe(true);
    const conv = await db.col(C.conversations).findOne({ _id: `${UID}:${USER}` as never });
    expect(conv).toMatchObject({ type: 'user', messageCount: 3 });

    // Follower profile: fetched once for all these events (at most once a day).
    await app.get(ZaloOaWebhookService).idle();
    expect(zalo.userDetailCalls).toBe(1);
    expect(await db.col(C.contacts).findOne({ _id: `${UID}:${USER}` as never })).toMatchObject({
      displayName: 'Anh Tuấn',
      avatar: 'https://s240-ava-talk.zadn.vn/u.jpg',
    });
  });

  it('never uses a refresh token twice, even under concurrent refreshes', async () => {
    const tokens = app.get(ZaloOaTokenService);
    const creds = app.get(CredentialsService);
    const stale = (await creds.get<{ accessToken: string }>(UID))!.accessToken;
    zalo.refreshUsed = [];

    // Same process: callers share one refresh.
    const results = await Promise.all([
      ...Array.from({ length: 5 }, () => tokens.refresh(UID, stale)),
      // Bypass the in-process gate: only the Mongo lease protects these two.
      (tokens as unknown as { refreshLocked(u: string, s?: string): Promise<string> }).refreshLocked(UID, stale),
      (tokens as unknown as { refreshLocked(u: string, s?: string): Promise<string> }).refreshLocked(UID, stale),
    ]);
    expect(zalo.refreshUsed).toHaveLength(1);
    expect(new Set(results).size).toBe(1);
    expect(zalo.validAccess.has(results[0])).toBe(true);

    // Proactive sweep: a token about to expire is refreshed once; repeated sweeps reuse nothing.
    await db.col(ZOA_ACCOUNTS).updateOne({ _id: UID as never }, { $set: { accessExpiresAt: new Date(Date.now() + 60_000) } });
    await creds.put(UID, (await creds.get(UID))!, { expiresAt: new Date(Date.now() + 60_000) });
    await Promise.all([tokens.refreshDue(), tokens.refreshDue(), tokens.getAccessToken(UID)]);
    expect(new Set(zalo.refreshUsed).size).toBe(zalo.refreshUsed.length);
    expect(zalo.refreshUsed.length).toBe(2);
    const exp = (await creds.list('zalo_oa')).find((c) => c.uid === UID)!.expiresAt!;
    expect(exp.getTime() - Date.now()).toBeGreaterThan(24 * 3600_000);
  });

  describe('sender', () => {
    const send = async (text: string) => {
      const res = await http().post('/api/outbox').set(auth()).send({ uid: UID, threadId: USER, text }).expect(201);
      seen.push(res.text);
      return res.body as OutboxItem;
    };
    const doc = (id: string) => db.col(C.suggestions).findOne({ _id: new ObjectId(id) });

    beforeEach(() => {
      zalo.csQueue = [];
      zalo.networkDown = false;
    });

    it('sends customer-service text and records the sent message', async () => {
      const item = await send('Dạ lọc gió Vios 2019 giá 180.000đ ạ');
      await app.get(OutboxDispatcher).sweep();
      const d = await doc(item.id);
      expect(d).toMatchObject({ status: 'sent', claimedBy: 'dispatcher:zalo_oa' });
      const mid = d!.cliMsgId as string;
      expect(zalo.csCalls.at(-1)).toMatchObject({ userId: USER, text: 'Dạ lọc gió Vios 2019 giá 180.000đ ạ' });
      expect(await db.col(C.messages).findOne({ _id: `${UID}:${mid}` as never })).toMatchObject({ fromUid: '0', threadId: USER });
    });

    it('maps Zalo errors to Vietnamese reasons', async () => {
      const cases: [unknown, string][] = [
        [{ error: -230, message: 'User has not interacted with the OA in the past 7 days' }, 'Khách không tương tác với OA trong 7 ngày qua'],
        [{ error: -211, message: 'Out of quota' }, 'hết hạn mức'],
        [{ error: -32, message: 'Your OA reached limit call api' }, 'giới hạn tốc độ'],
        [{ error: -9999, message: 'weird' }, 'mã -9999'],
      ];
      for (const [answer, reason] of cases) {
        zalo.csQueue = [answer];
        const item = await send('Dạ vâng ạ');
        await app.get(OutboxDispatcher).sweep();
        const d = await doc(item.id);
        expect(d).toMatchObject({ status: 'failed' });
        expect(d!.error).toContain(reason);
      }
      zalo.networkDown = true;
      const item = await send('Dạ vâng ạ');
      await app.get(OutboxDispatcher).sweep();
      expect((await doc(item.id))!.error).toBe('Không kết nối được Zalo, hãy thử lại sau');
    });

    it('refreshes once and retries once when the access token is rejected', async () => {
      zalo.validAccess.clear(); // token revoked on Zalo's side; our expiry still looks fine
      zalo.refreshUsed = [];
      const a = await send('Tin 1');
      const b = await send('Tin 2');
      const disp = app.get(OutboxDispatcher);
      await Promise.all([disp.dispatch(a), disp.dispatch(b)]);
      expect((await doc(a.id))!.status).toBe('sent');
      expect((await doc(b.id))!.status).toBe('sent');
      expect(zalo.refreshUsed).toHaveLength(1);
    });

    it('marks the OA for reconnection when the refresh token is rejected', async () => {
      zalo.validAccess.clear();
      zalo.validRefresh.clear();
      const item = await send('Tin 3');
      await app.get(OutboxDispatcher).sweep();
      expect(await doc(item.id)).toMatchObject({ status: 'failed', error: 'OA cần được kết nối lại trên trang Kênh kết nối' });
      const st = await http().get('/api/channels/zalo-oa').set(auth()).expect(200);
      seen.push(st.text);
      expect(st.body.accounts[0]).toMatchObject({ needsReconnect: true });
      // The proactive sweep leaves it alone (its refresh token is dead).
      zalo.refreshUsed = [];
      await db.col(ZOA_ACCOUNTS).updateOne({ _id: UID as never }, { $set: { accessExpiresAt: new Date() } });
      await app.get(ZaloOaTokenService).refreshDue();
      expect(zalo.refreshUsed).toEqual([]);
    });
  });

  it('disconnect deletes credentials and keeps history', async () => {
    const r = await http().delete(`/api/channels/zalo-oa/${UID}`).set(auth()).expect(200);
    seen.push(r.text);
    expect(await app.get(CredentialsService).get(UID)).toBeNull();
    expect(await db.col(C.messages).countDocuments({ uid: UID })).toBeGreaterThan(0);
    const st = await http().get('/api/channels/zalo-oa').set(auth()).expect(200);
    seen.push(st.text);
    expect(st.body.accounts[0]).toMatchObject({ status: 'disconnected', hasCredentials: false });
  });

  it('never exposes a token in responses, audit_log or plaintext collections', async () => {
    expect(zalo.issued.length).toBeGreaterThan(4);
    const dumps = [
      ...seen,
      JSON.stringify(await db.col(C.auditLog).find({}).toArray()),
      JSON.stringify(await db.col(C.accounts).find({}).toArray()),
      JSON.stringify(await db.col(ZOA_ACCOUNTS).find({}).toArray()),
      JSON.stringify(await db.col(C.messages).find({}).toArray()),
      JSON.stringify(await db.col(C.contacts).find({}).toArray()),
      JSON.stringify(await db.col(C.suggestions).find({}).toArray()),
      JSON.stringify(await db.col('channel_credentials').find({}).toArray()),
    ];
    const audit = await db.col(C.auditLog).find({ action: /^zalo_oa\./ }).toArray();
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['zalo_oa.connect', 'zalo_oa.token_refresh', 'zalo_oa.disconnect']));
    for (const t of zalo.issued) for (const d of dumps) expect(d).not.toContain(t);
    for (const d of dumps) expect(d).not.toContain('secret_');
  });
});
