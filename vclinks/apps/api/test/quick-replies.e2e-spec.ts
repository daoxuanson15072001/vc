import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { QuickReply } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';
import { C, DbService } from '../src/db/db.service';

describe('Quick replies (mẫu câu) CRUD', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  let db: DbService;
  const tok: Record<'dashboard' | 'ingest', string> = { dashboard: '', ingest: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_quick_replies_test');
    app = await createApp({ logger: false });
    await app.init();
    db = app.get(DbService);
    const tokens = app.get(TokenService);
    for (const s of ['dashboard', 'ingest'] as const) tok[s] = await tokens.create(`anh-${s}`, [s]);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('creates, lists, updates and deletes templates; shortcuts are unique; dashboard scope only', async () => {
    await http().post('/api/quick-replies').set(auth(tok.ingest)).send({ shortcut: 'bh', title: 'Bảo hành', text: 'x' }).expect(403);
    await http().post('/api/quick-replies').set(auth(tok.dashboard)).send({ shortcut: 'bảo hành', title: 'Bảo hành', text: 'x' }).expect(400);

    const bh = (
      await http()
        .post('/api/quick-replies')
        .set(auth(tok.dashboard))
        .send({ shortcut: 'BH', title: 'Bảo hành', text: 'Dạ {ten_khach}, sản phẩm bảo hành 12 tháng ạ.' })
        .expect(201)
    ).body as QuickReply;
    expect(bh).toMatchObject({ shortcut: 'bh', title: 'Bảo hành', kind: 'text', createdBy: 'anh-dashboard' });
    await http().post('/api/quick-replies').set(auth(tok.dashboard)).send({ shortcut: 'bh', title: 'Trùng', text: 'y' }).expect(409);
    const stk = (
      await http()
        .post('/api/quick-replies')
        .set(auth(tok.dashboard))
        .send({ shortcut: 'stk', title: 'STK VCparts', text: 'VCB 0011 0022 3344 - CTCP VC Phồn Vinh', kind: 'bank' })
        .expect(201)
    ).body as QuickReply;

    const list = (await http().get('/api/quick-replies').set(auth(tok.dashboard)).expect(200)).body as QuickReply[];
    expect(list.map((r) => r.shortcut)).toEqual(['stk', 'bh']); // bank first (sorted by kind), then text

    const upd = (await http().patch(`/api/quick-replies/${bh.id}`).set(auth(tok.dashboard)).send({ title: 'Bảo hành 12T' }).expect(200)).body as QuickReply;
    expect(upd.title).toBe('Bảo hành 12T');
    await http().patch(`/api/quick-replies/${bh.id}`).set(auth(tok.dashboard)).send({ shortcut: 'stk' }).expect(409);
    await http().patch(`/api/quick-replies/${'0'.repeat(24)}`).set(auth(tok.dashboard)).send({ title: 'x' }).expect(404);

    await http().delete(`/api/quick-replies/${stk.id}`).set(auth(tok.dashboard)).expect(200);
    await http().delete(`/api/quick-replies/${stk.id}`).set(auth(tok.dashboard)).expect(404);
    expect(((await http().get('/api/quick-replies').set(auth(tok.dashboard)).expect(200)).body as QuickReply[]).length).toBe(1);

    // Audit carries ids and shortcuts, never template text.
    const audits = await db.col(C.auditLog).find({ action: /^quick_reply\./ }).toArray();
    expect(audits.map((a) => a.action)).toEqual(['quick_reply.create', 'quick_reply.create', 'quick_reply.update', 'quick_reply.delete']);
    expect(JSON.stringify(audits)).not.toContain('bảo hành 12 tháng');
  });
});
