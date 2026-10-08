import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';
import { sentAtFromCliMsgId } from '../src/ingest/ingest.service';

const UID = '111';
const GROUP = 'g9';
const CONV = `${UID}:${GROUP}`;
// cliMsgIds are the client clock in ms (28/09/2026 and 21/09/2026).
const KNOWN = '1790594552830';
const OLD_IN = '1789950000000';
const OLD_IN_2 = '1789950004000';
const OLD_OUT = '1789950008000';
const OLD_PHOTO = '1789950012000';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png')]);

describe('DOM-only messages (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  const tok = { ingest: '', dashboard: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());
  const messages = async () =>
    (await http().get(`/api/conversations/${encodeURIComponent(CONV)}/messages`).set(auth(tok.dashboard)).expect(200)).body
      .items as Record<string, unknown>[];

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_dom_test');
    app = await createApp({ logger: false });
    await app.init();
    const tokens = app.get(TokenService);
    tok.ingest = await tokens.create('test-ingest', ['ingest']);
    tok.dashboard = await tokens.create('test-dashboard', ['dashboard']);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: 'Zalo test' }).expect(201);
    await http()
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        items: [
          { msgId: 'm1', cliMsgId: KNOWN, threadId: GROUP, fromUid: '222', toUid: GROUP, msgType: '1', sentAt: Number(KNOWN), encrypted: true, contentStatus: 'pending' },
        ],
      })
      .expect(200);
    await app
      .get(DbService)
      .col(C.contacts)
      .insertOne({ _id: `${UID}:333` as never, uid: UID, userId: '333', displayName: 'VCpart An' });
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('derives the send time from the cliMsgId and rejects implausible ids', () => {
    expect(sentAtFromCliMsgId('1790594547183')?.toISOString()).toBe('2026-09-28T11:22:27.183Z');
    expect(sentAtFromCliMsgId('123')).toBeNull();
    expect(sentAtFromCliMsgId('9999999999999')).toBeNull();
  });

  it('joins known bubbles and creates the older ones, with senders resolved or kept by name', async () => {
    const now = Date.now();
    const r = await http()
      .post('/api/ingest/dom-messages')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        threadId: GROUP,
        items: [
          { cliMsgId: KNOWN, direction: 'in', text: 'xk bán', capturedAt: now },
          { cliMsgId: OLD_IN, direction: 'in', text: 'Tin cũ 1', senderName: 'VCpart An', capturedAt: now },
          { cliMsgId: OLD_IN_2, direction: 'in', text: 'Tin cũ 2', senderName: 'Người lạ', capturedAt: now },
          { cliMsgId: OLD_OUT, direction: 'out', text: 'Em trả lời', capturedAt: now },
        ],
      })
      .expect(200);
    expect(r.body).toMatchObject({ matched: 1, created: 3, unmatched: [] });

    const items = await messages();
    const by = (cli: string) => items.find((m) => m.cliMsgId === cli)!;
    expect(by(KNOWN)).toMatchObject({ text: 'xk bán', contentStatus: 'complete' });
    expect(by(OLD_IN)).toMatchObject({ text: 'Tin cũ 1', fromUid: '333', senderName: 'VCpart An', sentAt: '2026-09-21T00:20:00.000Z' });
    expect(by(OLD_IN_2)).toMatchObject({ fromUid: 'dom:Người lạ', senderName: 'Người lạ' });
    expect(by(OLD_OUT)).toMatchObject({ fromUid: '0', text: 'Em trả lời' });

    // Idempotent: sending the same bubbles again creates nothing new.
    const again = await http()
      .post('/api/ingest/dom-messages')
      .set(auth(tok.ingest))
      .send({ uid: UID, threadId: GROUP, items: [{ cliMsgId: OLD_IN, direction: 'in', text: 'Tin cũ 1', capturedAt: now }] })
      .expect(200);
    expect(again.body.created).toBe(0);
    expect((await messages()).length).toBe(4);
  });

  it('creates a photo-only bubble from its upload, and never in an unknown conversation', async () => {
    const up = await http()
      .post('/api/ingest/message-media')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        cliMsgId: OLD_PHOTO,
        index: 0,
        mime: 'image/png',
        dataBase64: PNG.toString('base64'),
        capturedAt: Date.now(),
        dom: { threadId: GROUP, direction: 'in', senderName: 'VCpart An' },
      })
      .expect(200);
    expect(up.body.matched).toBe(true);
    const photo = (await messages()).find((m) => m.cliMsgId === OLD_PHOTO)!;
    expect(photo).toMatchObject({ contentStatus: 'complete', fromUid: '333', mediaImages: [up.body.mediaId] });

    const r = await http()
      .post('/api/ingest/dom-messages')
      .set(auth(tok.ingest))
      .send({ uid: UID, threadId: 'g-unknown', items: [{ cliMsgId: '1789950099000', direction: 'in', text: 'x', capturedAt: 1 }] })
      .expect(200);
    expect(r.body.created).toBe(0);
  });

  it('creates nothing when the batch holds a known bubble of another conversation (wrong chat on screen)', async () => {
    await http()
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        items: [
          { msgId: 'x1', cliMsgId: '1789960000000', threadId: '555', fromUid: '555', toUid: UID, msgType: '1', sentAt: 1789960000000, encrypted: true, contentStatus: 'pending' },
        ],
      })
      .expect(200);
    const r = await http()
      .post('/api/ingest/dom-messages')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        threadId: GROUP,
        items: [
          { cliMsgId: '1789960000000', direction: 'in', text: 'tin của hội thoại 555', capturedAt: 1 },
          { cliMsgId: '1789960004000', direction: 'in', text: 'không được tạo vào g9', capturedAt: 1 },
        ],
      })
      .expect(200);
    expect(r.body).toMatchObject({ created: 0, threadMismatch: true });
    expect((await messages()).some((m) => m.cliMsgId === '1789960004000')).toBe(false);
  });

  it('moves the content onto the real message when IndexedDB metadata with the same cliMsgId arrives', async () => {
    await http()
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        items: [
          { msgId: 'm9', cliMsgId: OLD_IN, threadId: GROUP, fromUid: '333', toUid: GROUP, msgType: '1', sentAt: Number(OLD_IN) + 900, encrypted: true, contentStatus: 'pending' },
        ],
      })
      .expect(200);
    const same = (await messages()).filter((m) => m.cliMsgId === OLD_IN);
    expect(same).toHaveLength(1);
    expect(same[0]).toMatchObject({ id: `${UID}:m9`, text: 'Tin cũ 1', contentStatus: 'complete' });
  });
});
