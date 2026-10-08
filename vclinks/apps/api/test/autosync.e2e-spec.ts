import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AutoSyncPlanItem } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';

const UID = '111';
const T0 = Date.UTC(2026, 8, 14);
const DAY = 86_400_000;

/** Seeds one conversation and its messages (`pending` of them still missing content). */
async function seed(db: DbService, threadId: string, o: { total: number; pending: number; lastAt: number; name?: string }) {
  await db.col(C.conversations).insertOne({
    _id: `${UID}:${threadId}` as never,
    uid: UID,
    threadId,
    lastMsgAt: new Date(o.lastAt),
    ...(o.name ? { name: o.name } : {}),
  });
  await db.col(C.messages).insertMany(
    Array.from({ length: o.total }, (_, i) => ({
      _id: `${UID}:${threadId}-${i}` as never,
      uid: UID,
      threadId,
      msgId: `${threadId}-${i}`,
      cliMsgId: String(o.lastAt - (o.total - i) * 1000),
      // Oldest first; the first `pending` messages are the ones missing content.
      sentAt: new Date(T0 + i * DAY),
      contentStatus: i < o.pending ? 'pending' : 'complete',
    })),
  );
}

describe('automatic content sync plan (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  let ingest = '';
  let dashboard = '';
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const plan = async () =>
    (await request(app.getHttpServer()).get(`/api/autosync/plan?uid=${UID}`).set(auth(ingest)).expect(200))
      .body as AutoSyncPlanItem[];
  const result = (body: Record<string, unknown>, status = 200) =>
    request(app.getHttpServer()).post('/api/autosync/result').set(auth(ingest)).send({ uid: UID, ...body }).expect(status);

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_autosync');
    app = await createApp({ logger: false });
    await app.listen(0);
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    ingest = await tokens.create('test-ingest', ['ingest']);
    dashboard = await tokens.create('test-dashboard', ['dashboard']);
    await seed(db, 'g1', { total: 6, pending: 4, lastAt: T0 + 10 * DAY, name: 'Kho VCS' });
    await seed(db, 'u2', { total: 3, pending: 1, lastAt: T0 + 20 * DAY });
    await seed(db, 'u3', { total: 2, pending: 0, lastAt: T0 + 30 * DAY });
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('needs the ingest scope', async () => {
    await request(app.getHttpServer()).get(`/api/autosync/plan?uid=${UID}`).set(auth(dashboard)).expect(403);
  });

  it('lists conversations still missing content, newest first, with open hints', async () => {
    const p = await plan();
    expect(p.map((i) => [i.threadId, i.pending, i.deepDone])).toEqual([
      ['u2', 1, false],
      ['g1', 4, false],
    ]);
    expect(p[1].name).toBe('Kho VCS');
    expect(p[1].recentCliMsgIds).toHaveLength(6);
  });

  it('keeps unread conversations out for a while', async () => {
    await result({ threadId: 'u2', mode: 'screen', outcome: 'skipped_unread' });
    expect((await plan()).map((i) => i.threadId)).toEqual(['g1']);
  });

  it('counts only what Zalo Web can still show and does not repeat a deep pass that found nothing new', async () => {
    // Deep pass reached the banner "before 16/09": the 2 older pending messages are unreachable.
    await result({
      threadId: 'g1',
      mode: 'deep',
      outcome: 'done',
      reason: 'web_history_start',
      posted: 0,
      webHistoryFrom: T0 + 2 * DAY,
    });
    const conv = await db.col(C.conversations).findOne({ _id: `${UID}:g1` as never });
    expect(conv?.webHistoryFrom).toEqual(new Date(T0 + 2 * DAY));
    expect(conv?.autoSync).toMatchObject({ lastMode: 'deep', lastOutcome: 'done', pendingAfter: 2 });
    expect(conv?.autoSync?.deepDoneAt).toBeInstanceOf(Date);
    // Same 2 left: skipped.
    expect(await plan()).toEqual([]);

    // A new message arrives without content: back in the plan, now stopping at the pending ids.
    await db.col(C.messages).insertOne({
      _id: `${UID}:g1-new` as never,
      uid: UID,
      threadId: 'g1',
      msgId: 'g1-new',
      cliMsgId: '999',
      sentAt: new Date(T0 + 11 * DAY),
      contentStatus: 'pending',
    });
    expect((await plan()).map((i) => [i.threadId, i.pending, i.deepDone])).toEqual([['g1', 3, true]]);
  });

  it('marks a Dashboard fetch that reached the history start as a deep pass', async () => {
    await db.col(C.accounts).insertOne({ _id: UID as never, channel: 'zalo', label: 'Zalo' });
    const http = request(app.getHttpServer());
    await http.post(`/api/conversations/${UID}:u2/fetch`).set(auth(dashboard)).expect(200);
    const pending = await http.get(`/api/fetch-requests/pending?uid=${UID}`).set(auth(ingest)).expect(200);
    expect(pending.body[0]).toMatchObject({ threadId: 'u2', deep: true });
    await http.post(`/api/fetch-requests/${UID}:u2/claim`).set(auth(ingest)).expect(200);
    await http
      .post(`/api/fetch-requests/${UID}:u2/result`)
      .set(auth(ingest))
      .send({ ok: true, reason: 'web_history_start', posted: 1, webHistoryFrom: T0 })
      .expect(200);
    const conv = await db.col(C.conversations).findOne({ _id: `${UID}:u2` as never });
    expect(conv?.autoSync?.deepDoneAt).toBeInstanceOf(Date);
    await http.post(`/api/conversations/${UID}:u2/fetch`).set(auth(dashboard)).expect(200);
    const again = await http.get(`/api/fetch-requests/pending?uid=${UID}`).set(auth(ingest)).expect(200);
    expect(again.body[0]).toMatchObject({ threadId: 'u2', deep: false });
  });

  it('keeps a finished deep pass out when content was captured passively since (pending went down)', async () => {
    // u3 had no pending; give it 3, finish a deep pass, then capture 2 of them passively.
    await db.col(C.messages).updateMany({ uid: UID, threadId: 'u3' }, { $set: { contentStatus: 'pending' } });
    await result({ threadId: 'u3', mode: 'deep', outcome: 'done', reason: 'web_history_start' });
    await db.col(C.messages).updateOne({ uid: UID, threadId: 'u3' }, { $set: { contentStatus: 'complete' } });
    expect((await plan()).map((i) => i.threadId)).not.toContain('u3');
  });

  it('returns more than the default 20 items when asked (the extension asks for the maximum)', async () => {
    const r = await request(app.getHttpServer()).get(`/api/autosync/plan?uid=${UID}&limit=200`).set(auth(ingest)).expect(200);
    expect(Array.isArray(r.body)).toBe(true);
    await request(app.getHttpServer()).get(`/api/autosync/plan?uid=${UID}&limit=500`).set(auth(ingest)).expect(400);
  });

  it('leaves messages older than the Web history start out of pending-content', async () => {
    const r = await request(app.getHttpServer()).get(`/api/threads/g1/pending-content?uid=${UID}`).set(auth(ingest)).expect(200);
    // g1: 4 old pending (2 before the banner date) + 1 new = 3 still reachable.
    expect(r.body.cliMsgIds).toHaveLength(3);
  });

  it('long-polls fetch requests: a Dashboard request wakes the waiting extension at once', async () => {
    const http = request(app.getHttpServer());
    const started = Date.now();
    const poll = http.get(`/api/fetch-requests/pending?uid=${UID}&loggedIn=1&wait=10`).set(auth(ingest));
    await new Promise((r) => setTimeout(r, 300));
    await request(app.getHttpServer()).post(`/api/conversations/${UID}:g1/fetch`).set(auth(dashboard)).expect(200);
    const res = await poll.expect(200);
    expect(res.body.map((f: { threadId: string }) => f.threadId)).toContain('g1');
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('rejects malformed results', async () => {
    await result({ threadId: 'g1', mode: 'deep', outcome: 'nope' }, 400);
  });

  it('a message that arrived after the last pass is planned at once, whatever that pass decided', async () => {
    // u3 was skipped (unread) a moment ago: normally out for 10 minutes.
    await result({ threadId: 'u3', mode: 'screen', outcome: 'skipped_unread' });
    const at = new Date(Date.now() + 1000);
    await db.col(C.messages).insertOne({ _id: `${UID}:u3-new` as never, uid: UID, threadId: 'u3', msgId: 'u3-new', cliMsgId: '1234', sentAt: at, contentStatus: 'pending' });
    const item = (await plan()).find((i) => i.threadId === 'u3');
    expect(item?.newestPendingAt).toBe(at.toISOString());
  });
});
