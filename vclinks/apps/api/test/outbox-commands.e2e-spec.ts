import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { OutboxAttachment, OutboxItem } from '@vclinks/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { TokenService } from '../src/auth/token.service';

const UID = '5200';
const GROUP = 'g900';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png-body')]);
const PDF = Buffer.from('%PDF-1.4 bao gia');

describe('Outbox commands: images, files, name cards, polls, mentions (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication;
  const tok: Record<'dashboard' | 'ingest', string> = { dashboard: '', ingest: '' };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());
  const attach = async (fileName: string, mime: string, buf: Buffer) =>
    (
      await http()
        .post('/api/outbox/attachments')
        .set(auth(tok.dashboard))
        .send({ fileName, mime, dataBase64: buf.toString('base64') })
        .expect(200)
    ).body as OutboxAttachment;
  const create = (body: Record<string, unknown>) =>
    http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: UID, threadId: GROUP, ...body });

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri('vclinks_outbox_cmd_test');
    app = await createApp({ logger: false });
    await app.init();
    const tokens = app.get(TokenService);
    for (const s of ['dashboard', 'ingest'] as const) tok[s] = await tokens.create(`anh-${s}`, [s]);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: UID, label: 'Zalo test' }).expect(201);
    await http().post('/api/accounts').set(auth(tok.ingest)).send({ uid: 'zoa_1', label: 'OA' }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  it('uploads attachments (dashboard only) and serves them to the extension; non-images are downloads', async () => {
    await http().post('/api/outbox/attachments').set(auth(tok.ingest)).send({ fileName: 'a.png', mime: 'image/png', dataBase64: 'AAAA' }).expect(403);
    const img = await attach('anh.png', 'image/png', PNG);
    expect(img).toMatchObject({ name: 'anh.png', mime: 'image/png', size: PNG.length });
    const fake = await attach('fake.png', 'image/png', Buffer.from('<svg/>'));
    expect(fake.mime).toBe('application/octet-stream'); // claimed image that is not a raster

    const pdf = await attach('Báo giá.pdf', 'application/pdf', PDF);
    const got = await http().get(`/api/media/${pdf.id}`).set(auth(tok.ingest)).buffer(true).expect(200);
    expect(got.headers['content-disposition']).toContain("filename*=UTF-8''B%C3%A1o%20gi%C3%A1.pdf");
    expect(Buffer.compare(got.body as Buffer, PDF)).toBe(0);
  });

  it('creates approved commands labelled for lists, and hands their payload to the extension', async () => {
    const a = await attach('a.png', 'image/png', PNG);
    const pdf = await attach('bao-gia.pdf', 'application/pdf', PDF);
    const imgs = (await create({ action: 'send_images', attachments: [a.id] }).expect(201)).body as OutboxItem;
    expect(imgs).toMatchObject({ action: 'send_images', text: '[Ảnh]', status: 'approved', attachments: [{ id: a.id, name: 'a.png' }] });
    await create({ action: 'send_file', attachments: [pdf.id] }).expect(201);
    await create({ action: 'send_card', card: { name: '9C_Hiệp Lễ', withPhone: true } }).expect(201);
    await create({ action: 'create_poll', poll: { question: 'Ăn trưa?', options: ['Cơm', 'Phở'] } }).expect(201);
    await create({ text: 'Chào @A.A vợ', mentions: [{ name: 'A.A vợ' }] }).expect(201);
    await create({ action: 'send_sticker', sticker: { set: 'Củ hành', index: 3, thumbUrl: 'https://stc-chat.zdn.vn/images/stickers/default/thumb/3.png' } }).expect(201);

    // Older extensions / MCP (no commands=1) only ever get plain text: they would type "[Ảnh]".
    const legacy = (await http().get(`/api/outbox/pending?uid=${UID}`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[];
    expect(legacy).toEqual([]);
    const pending = (await http().get(`/api/outbox/pending?uid=${UID}&commands=1`).set(auth(tok.ingest)).expect(200)).body as OutboxItem[];
    expect(pending.map((p) => p.text)).toEqual(['[Ảnh]', '[File] bao-gia.pdf', '[Danh thiếp] 9C_Hiệp Lễ', '[Bình chọn] Ăn trưa?', 'Chào @A.A vợ']);
    const more = (await http().get(`/api/outbox?uid=${UID}&threadId=${GROUP}&limit=10`).set(auth(tok.dashboard)).expect(200)).body as OutboxItem[];
    const sticker = more.find((p) => p.action === 'send_sticker');
    expect(sticker).toMatchObject({ text: '[Sticker] Củ hành #3', sticker: { set: 'Củ hành', index: 3 } });
    expect(pending[4].mentions).toEqual([{ name: 'A.A vợ' }]);
    expect(pending[4].action).toBeUndefined();
    expect(pending[2].card).toEqual({ name: '9C_Hiệp Lễ', withPhone: true });
    expect(pending[3].poll).toEqual({ question: 'Ăn trưa?', options: ['Cơm', 'Phở'] });
  });

  it('lists the people who wrote in a group, most active first, for @mention suggestions', async () => {
    await http()
      .post('/api/ingest/messages')
      .set(auth(tok.ingest))
      .send({
        uid: UID,
        items: [
          { msgId: 'p1', cliMsgId: '1790000000001', threadId: GROUP, fromUid: '11', toUid: GROUP, msgType: '1', sentAt: 1, senderName: 'A.A vợ' },
          { msgId: 'p2', cliMsgId: '1790000000002', threadId: GROUP, fromUid: '11', toUid: GROUP, msgType: '1', sentAt: 2, senderName: 'A.A vợ' },
          { msgId: 'p3', cliMsgId: '1790000000003', threadId: GROUP, fromUid: '22', toUid: GROUP, msgType: '1', sentAt: 3, senderName: 'Vcparts Tú' },
          { msgId: 'p4', cliMsgId: '1790000000004', threadId: GROUP, fromUid: '0', toUid: GROUP, msgType: '1', sentAt: 4, senderName: 'Tôi' },
        ],
      })
      .expect(200);
    const r = await http().get(`/api/conversations/${encodeURIComponent(`${UID}:${GROUP}`)}/participants`).set(auth(tok.dashboard)).expect(200);
    expect(r.body).toEqual([
      { uid: '11', name: 'A.A vợ', messages: 2 },
      { uid: '22', name: 'Vcparts Tú', messages: 1 },
    ]);

    // Silent members are listed too when their name is known (1-1 conversation name from the sidebar,
    // or a plaintext contact); the account itself and nameless members are not.
    await http().post('/api/ingest/groups').set(auth(tok.ingest)).send({ uid: UID, items: [{ groupId: GROUP, memberIds: [UID, '11', '22', '33', '44', '55'], encrypted: true, raw: {} }] }).expect(200);
    await http().post('/api/ingest/conversations').set(auth(tok.ingest)).send({ uid: UID, items: [{ threadId: '33', type: 'user' }] }).expect(200);
    await http().post('/api/ingest/thread-names').set(auth(tok.ingest)).send({ uid: UID, items: [{ threadId: '33', name: 'Chị Lan Kho' }] }).expect(200);
    await http().post('/api/ingest/contacts').set(auth(tok.ingest)).send({ uid: UID, items: [{ userId: '44', displayName: 'Anh Minh Gara' }, { userId: '55', encrypted: true }] }).expect(200);
    const r2 = await http().get(`/api/conversations/${encodeURIComponent(`${UID}:${GROUP}`)}/participants`).set(auth(tok.dashboard)).expect(200);
    expect(r2.body).toEqual([
      { uid: '11', name: 'A.A vợ', messages: 2 },
      { uid: '22', name: 'Vcparts Tú', messages: 1 },
      { uid: '33', name: 'Chị Lan Kho', messages: 0 },
      { uid: '44', name: 'Anh Minh Gara', messages: 0 },
    ]);
  });

  it('refuses commands where Zalo Web cannot run them', async () => {
    const pdf = await attach('x.pdf', 'application/pdf', PDF);
    // A document is not a photo.
    await create({ action: 'send_images', attachments: [pdf.id] }).expect(400);
    // Unknown attachment id.
    await create({ action: 'send_file', attachments: ['f'.repeat(64)] }).expect(400);
    // Polls and mentions exist in groups only.
    await create({ threadId: '777', action: 'create_poll', poll: { question: 'q', options: ['a', 'b'] } }).expect(400);
    await create({ threadId: '777', text: 'Chào @An', mentions: [{ name: 'An' }] }).expect(400);
    // API channels (Zalo OA / Fanpage) send text only.
    await http().post('/api/outbox').set(auth(tok.dashboard)).send({ uid: 'zoa_1', threadId: '1', action: 'send_card', card: { name: 'An' } }).expect(400);
  });
});
