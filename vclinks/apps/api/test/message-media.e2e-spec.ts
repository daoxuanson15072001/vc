import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';

const UID = '111';
// Smallest valid PNG / JPEG headers followed by filler: the server only sniffs magic bytes.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png-body-1')]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpeg-body-2')]);
const GIF = Buffer.from('GIF89a-body-3');
const b64 = (b: Buffer) => b.toString('base64');

describe('message media upload (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  const tok = { ingest: '', dashboard: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const upload = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/ingest/message-media').set(auth(tok.ingest)).send(body);

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_media_test');
    app = await createApp({ logger: false });
    await app.init();
    const tokens = app.get(TokenService);
    tok.ingest = await tokens.create('test-ingest', ['ingest']);
    tok.dashboard = await tokens.create('test-dashboard', ['dashboard']);
    const http = request(app.getHttpServer());
    await http.post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: 'Zalo test' }).expect(201);
    await http
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        items: [
          ...[1, 2, 3].map((n) => ({
            msgId: String(n),
            cliMsgId: String(1790592468580 + n),
            threadId: 'g9',
            fromUid: '222',
            toUid: 'g9',
            msgType: '2',
            // One album: three photo messages with adjacent cliMsgIds; siblings
            // may be stamped slightly *before* the first (seen on Zalo).
            sentAt: 1727500000000 + (n === 1 ? 100 : n === 2 ? 0 : 50),
            contentStatus: 'pending',
            encrypted: true,
          })),
          {
            msgId: '4',
            cliMsgId: '1790592528000',
            threadId: 'g9',
            fromUid: '222',
            toUid: 'g9',
            msgType: '2',
            // A later, separate photo: not part of the album.
            sentAt: 1727500060000,
            contentStatus: 'pending',
            encrypted: true,
          },
        ],
      })
      .expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('stores album photos in bubble order, dedups by sha256 and fills the pending message', async () => {
    const base = { uid: UID, cliMsgId: '1790592468581', capturedAt: Date.now() };
    const second = await upload({ ...base, index: 1, mime: 'image/jpeg', dataBase64: b64(JPG) }).expect(200);
    const first = await upload({ ...base, index: 0, mime: 'image/png', dataBase64: b64(PNG) }).expect(200);
    const again = await upload({ ...base, index: 0, mime: 'image/png', dataBase64: b64(PNG) }).expect(200);
    const third = await upload({ ...base, index: 2, mime: 'image/gif', dataBase64: b64(GIF) }).expect(200);
    expect(first.body.matched).toBe(true);
    expect(first.body.mediaId).toMatch(/^[a-f0-9]{64}$/);
    expect(again.body.mediaId).toBe(first.body.mediaId);

    const msgs = await request(app.getHttpServer())
      .get(`/api/conversations/${encodeURIComponent(`${UID}:g9`)}/messages`)
      .set(auth(tok.dashboard))
      .expect(200);
    const byMsg = (id: string) => msgs.body.items.find((x: { msgId: string }) => x.msgId === id);
    const [m, s2, s3, later] = ['1', '2', '3', '4'].map(byMsg);
    // The other album messages point at the first one; the later photo still waits.
    expect([s2.albumOf, s3.albumOf]).toEqual([`${UID}:1`, `${UID}:1`]);
    expect(s2.contentStatus).toBe('complete');
    expect(later.albumOf).toBeUndefined();
    expect(later.contentStatus).toBe('pending');
    expect(m.contentStatus).toBe('complete');
    expect(m.encrypted).toBeUndefined();
    expect(m.mediaImages).toEqual([first.body.mediaId, second.body.mediaId, third.body.mediaId]);
    expect(m.kind).toBe('image');
  });

  it('keeps uploaded photos when the DOM capture of the same bubble (caption) arrives later', async () => {
    const r = await upload({ uid: UID, cliMsgId: '1790592468581', index: 0, mime: 'image/png', dataBase64: b64(PNG), capturedAt: 1 });
    await request(app.getHttpServer())
      .post('/api/ingest/message-content')
      .set(auth(tok.ingest))
      .send({ uid: UID, items: [{ cliMsgId: '1790592468581', text: 'Ảnh hàng về', capturedAt: Date.now() }] })
      .expect(200);
    const msgs = await request(app.getHttpServer())
      .get(`/api/conversations/${encodeURIComponent(`${UID}:g9`)}/messages`)
      .set(auth(tok.dashboard))
      .expect(200);
    const head = msgs.body.items.find((x: { msgId: string }) => x.msgId === '1');
    expect(head.text).toBe('Ảnh hàng về');
    expect(head.mediaImages).toContain(r.body.mediaId);
  });

  it('serves the bytes to authenticated clients only, with the stored mime', async () => {
    const r = await upload({ uid: UID, cliMsgId: '1790592468581', index: 0, mime: 'image/png', dataBase64: b64(PNG), capturedAt: 1 });
    const id = r.body.mediaId as string;
    // The extension (ingest) may read media too: it hands outbox attachments to Zalo Web.
    await request(app.getHttpServer()).get(`/api/media/${id}`).expect(401);
    const got = await request(app.getHttpServer()).get(`/api/media/${id}`).set(auth(tok.dashboard)).buffer(true).expect(200);
    expect(got.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(got.body as Buffer, PNG)).toBe(0);
    await request(app.getHttpServer()).get('/api/media/not-an-id').set(auth(tok.dashboard)).expect(404);
  });

  it('rejects bytes that do not match the declared image type, and reports unknown messages as unmatched', async () => {
    const bad = await upload({
      uid: UID,
      cliMsgId: '1790592468581',
      index: 0,
      mime: 'image/png',
      dataBase64: b64(Buffer.from('<script>alert(1)</script>')),
      capturedAt: 1,
    });
    expect(bad.status).toBe(400);
    const none = await upload({ uid: UID, cliMsgId: 'nope', index: 0, mime: 'image/png', dataBase64: b64(PNG), capturedAt: 1 });
    expect(none.status).toBe(200);
    expect(none.body).toEqual({ matched: false });
  });
});
