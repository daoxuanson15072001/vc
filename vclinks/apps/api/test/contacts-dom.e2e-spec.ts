import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { ContactDomResult, ContactListResponse } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';

const UID = '5300';

describe('Danh bạ: friend list from the Zalo Web DOM (M1a-03)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  const tok: Record<'dashboard' | 'ingest', string> = { dashboard: '', ingest: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());
  const post = async (body: object) =>
    (await http().post(`/api/contacts/${UID}/dom`).set(auth(tok.ingest)).send(body).expect(200)).body as ContactDomResult;
  const list = async (qs = '') =>
    (await http().get(`/api/contacts?uid=${UID}${qs}`).set(auth(tok.dashboard)).expect(200)).body as ContactListResponse;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_contacts_dom_test');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    for (const s of ['dashboard', 'ingest'] as const) tok[s] = await tokens.create(`anh-${s}`, [s]);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: 'Nick thử' }).expect(201);
    // IndexedDB sync: names and phone are ciphertext, so the contact is metadata only.
    await http()
      .post('/api/ingest/contacts')
      .set(auth(tok.ingest))
      .send({ uid: UID, items: [{ userId: '101', isFriend: true, encrypted: true }] })
      .expect(200);
    await db.col(C.conversations).insertMany([
      { _id: `${UID}:101` as never, uid: UID, threadId: '101', type: 'user', name: 'Tuấn Trần', lastMsgAt: new Date('2026-10-01') },
      { _id: `${UID}:303` as never, uid: UID, threadId: '303', type: 'user', name: 'Chị Hoa', lastMsgAt: new Date('2026-10-03') },
      { _id: `${UID}:g1` as never, uid: UID, threadId: 'g1', type: 'group', name: 'Trùng tên' },
      { _id: `${UID}:404` as never, uid: UID, threadId: '404', type: 'user', name: 'Trùng tên' },
      { _id: `${UID}:405` as never, uid: UID, threadId: '405', type: 'user', name: 'Trùng tên' },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const walk1 = [
    { userId: '101', name: 'A Tuấn – Minh Phát', avatar: 'https://ava.example/1.jpg', labels: ['Khách hàng'] },
    { userId: '202', name: 'Đức Phụ Tùng' },
    { name: 'Chị Hoa' }, // no id on the row: tied by name to the 1-1 conversation
    { name: 'Trùng tên' }, // two 1-1 conversations share it: "chưa ghép"
    { name: 'Người lạ' }, // no conversation: "chưa ghép"
  ];

  it('stores rows by id or by name, counts the unmatched, and is idempotent', async () => {
    const r = await post({ walkId: 'walk-1', friendCount: 5, complete: true, last: true, items: walk1 });
    expect(r).toEqual({ matched: 3, matchedByName: 1, unmatched: 2, rejected: 0 });
    const again = await post({ walkId: 'walk-2', friendCount: 5, complete: true, last: true, items: walk1 });
    expect(again.matched).toBe(3);
    expect(await db.col(C.contacts).countDocuments({ uid: UID })).toBe(3);

    const page = await list();
    expect(page.total).toBe(3);
    expect(page.stats).toMatchObject({ friendCount: 5, stored: 3, unmatched: 2 });
    expect(page.stats.readAt).toBeTruthy();
    const tuan = page.items.find((i) => i.userId === '101')!;
    expect(tuan).toMatchObject({ name: 'A Tuấn – Minh Phát', labels: ['Khách hàng'], conversationId: `${UID}:101` });
    expect(page.items.find((i) => i.userId === '202')!.conversationId).toBeNull();
  });

  it('keeps the DOM name through a metadata-only IndexedDB sync and the profile shows it', async () => {
    await http()
      .post('/api/ingest/contacts')
      .set(auth(tok.ingest))
      .send({ uid: UID, items: [{ userId: '101', isFriend: true, encrypted: true }] })
      .expect(200);
    const prof = (await http().get(`/api/contacts/${UID}/101`).set(auth(tok.dashboard)).expect(200)).body as { displayName: string };
    expect(prof.displayName).toBe('A Tuấn – Minh Phát');
  });

  it('picks up a renamed alias on the next walk', async () => {
    await post({ walkId: 'walk-3', items: [{ userId: '101', name: 'Anh Tuấn gara Cầu Giấy' }] });
    expect((await list('&q=cau giay')).items.map((i) => i.userId)).toEqual(['101']);
  });

  it('searches without accents and sorts by name or by last message', async () => {
    expect((await list('&q=duc')).items.map((i) => i.userId)).toEqual(['202']);
    expect((await list('&sort=recent')).items.map((i) => i.userId)).toEqual(['303', '101', '202']);
    const names = (await list()).items.map((i) => i.name);
    expect(names).toEqual(['Anh Tuấn gara Cầu Giấy', 'Chị Hoa', 'Đức Phụ Tùng']);
    expect((await list('&pageSize=1&page=2')).items).toHaveLength(1);
  });

  it('marks friends missing from a complete walk as removed, unless the walk saw too few rows', async () => {
    // Saw 2 of 5: too few, nobody is removed.
    await post({ walkId: 'walk-4', friendCount: 5, complete: true, last: true, items: walk1.slice(0, 2) });
    expect((await list()).total).toBe(3);
    // Zalo now shows 2 friends and the walk saw both: 303 left the list.
    await post({ walkId: 'walk-5', friendCount: 2, complete: true, last: true, items: walk1.slice(0, 2) });
    const page = await list();
    expect(page.items.map((i) => i.userId).sort()).toEqual(['101', '202']);
    expect(page.stats).toMatchObject({ friendCount: 2, stored: 2, unmatched: 0 });
  });

  it('rejects sensitive or unknown fields, bad ids and the wrong scope', async () => {
    const r = await post({
      walkId: 'walk-6',
      items: [{ userId: '909', name: 'X', refresh_token: 'abc' }, { userId: 'abc', name: 'Y' }, { userId: '910', name: '' }],
    });
    expect(r).toMatchObject({ matched: 0, rejected: 3 });
    await http().post(`/api/contacts/${UID}/dom`).set(auth(tok.ingest)).send({ walkId: 'w', items: [] }).expect(400);
    await http().post(`/api/contacts/${UID}/dom`).set(auth(tok.dashboard)).send({ walkId: 'walk-7', items: [] }).expect(403);
    await http().get(`/api/contacts?uid=${UID}`).set(auth(tok.ingest)).expect(403);
    await http().post('/api/contacts/9999/dom').set(auth(tok.ingest)).send({ walkId: 'walk-8', items: [] }).expect(404);
  });
});
