import request from 'supertest';
import type { OutboxItem } from '@vclinks/shared';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/** Stored documents read back loosely: each assertion names the fields it checks. */
type Loose = { _id: string; [k: string]: unknown };

// Direct (zca-js) nicks of the máy Zalo: what the API keeps for them
// (docs/01-quan-ly-du-an/ke-hoach-zalo-truc-tiep-zca-js.md, P2 / P3).
const UID = '9100000000001';
const GROUP = 'g9100000000555';
const CUSTOMER = '9100000000777';

describe('direct nick (zca-js): ingest and outbox', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const T = Date.now() - 60_000;

  beforeAll(async () => {
    t = await startE2EApp();
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: UID, label: 'Nick trực tiếp' }).expect(201);
  });
  afterAll(async () => {
    await t?.close();
  });

  const ingest = async (stream: string, items: unknown[]) =>
    (await http().post(`/api/ingest/${stream}`).set(t.auth.ingest).send({ uid: UID, items }).expect(200)).body as {
      accepted: number;
      updated: number;
      rejected: unknown[];
    };
  const stored = (msgId: string) => t.db.col<Loose>(C.messages).findOne({ _id: `${UID}:${msgId}` });

  it('keeps direct text and media when the extension later re-ingests the message as metadata only', async () => {
    const res = await ingest('messages', [
      { msgId: 'd1', cliMsgId: '1791257266839', threadId: GROUP, fromUid: CUSTOMER, senderName: 'Khách A', msgType: 'webchat', text: 'Xin chào shop', sentAt: T, contentStatus: 'complete', contentSource: 'direct' },
      {
        msgId: 'd2',
        cliMsgId: '1791257266900',
        threadId: GROUP,
        fromUid: CUSTOMER,
        msgType: 'chat.photo',
        sentAt: T + 1000,
        content: { images: ['https://photo.example.test/a.jpg'], kind: 'image' },
        contentStatus: 'complete',
        contentSource: 'direct',
      },
    ]);
    expect(res).toMatchObject({ accepted: 2, rejected: [] });

    await ingest('messages', [
      { msgId: 'd1', cliMsgId: '1791257266839', threadId: GROUP, fromUid: CUSTOMER, msgType: 'webchat', sentAt: T, encrypted: true, contentStatus: 'pending' },
      { msgId: 'd2', cliMsgId: '1791257266900', threadId: GROUP, fromUid: CUSTOMER, msgType: 'chat.photo', sentAt: T + 1000, encrypted: true, contentStatus: 'pending' },
    ]);
    expect(await stored('d1')).toMatchObject({ text: 'Xin chào shop', senderName: 'Khách A', contentStatus: 'complete', contentSource: 'direct', encrypted: false });
    expect(await stored('d2')).toMatchObject({ content: { images: ['https://photo.example.test/a.jpg'], kind: 'image' }, contentSource: 'direct' });

    const page = await http().get(`/api/conversations/${UID}:${GROUP}/messages`).set(t.auth.dashboard).expect(200);
    const body = JSON.stringify(page.body);
    expect(body).toContain('Xin chào shop');
    expect(body).toContain('https://photo.example.test/a.jpg');
  });

  it('a reply to a file quotes the file name, as Zalo shows it', async () => {
    const DM_F = '9100000000888';
    await ingest('messages', [
      { msgId: 'f1', cliMsgId: '1791257299001', threadId: DM_F, fromUid: DM_F, msgType: 'share.file', sentAt: T + 50_000, content: { kind: 'file', files: [{ name: 'bao-gia.pdf', size: '12 KB', url: 'https://dl.example.test/bao-gia.pdf' }] }, contentStatus: 'complete', contentSource: 'direct' },
      { msgId: 'f2', cliMsgId: '1791257299002', threadId: DM_F, fromUid: '0', msgType: 'webchat', text: 'Dạ em nhận rồi', sentAt: T + 51_000, quote: { cliMsgId: '1791257299001', ownerId: DM_F, msg: '' }, contentStatus: 'complete', contentSource: 'direct' },
    ]);
    const page = await http().get(`/api/conversations/${UID}:${DM_F}/messages`).set(t.auth.dashboard).expect(200);
    expect(JSON.stringify(page.body)).toContain('[Tệp] bao-gia.pdf');
  });

  it('a recall reported on its own keeps the send time and the text captured before it', async () => {
    await ingest('messages', [
      { msgId: 'd3', cliMsgId: '1791257267000', threadId: GROUP, fromUid: CUSTOMER, msgType: 'webchat', text: 'Tin sẽ thu hồi', sentAt: T + 2000, contentStatus: 'complete', contentSource: 'direct' },
    ]);
    await ingest('messages', [{ msgId: 'd3', cliMsgId: '1791257267000', threadId: GROUP, fromUid: CUSTOMER, msgType: '20', sentAt: T + 90_000 }]);
    const d = await stored('d3');
    expect(d).toMatchObject({ text: 'Tin sẽ thu hồi', recalled: true, recalledFromMsgType: 'webchat', msgType: '20' });
    expect((d?.sentAt as Date).getTime()).toBe(T + 2000);
  });

  it('folds reaction events into the stored map, in order, without wiping other reactors', async () => {
    await ingest('reactions', [{ msgId: 'd1', threadId: GROUP, reactions: { '111': { '0': 1 } } }]);
    const res = await ingest('reactions', [
      { msgId: 'd1', threadId: GROUP, delta: { reactor: '222', icon: '3' } },
      { msgId: 'd1', threadId: GROUP, delta: { reactor: '0', icon: '0' } },
      { msgId: 'd1', threadId: GROUP, delta: { reactor: '222', icon: '3' } },
      { msgId: 'd1', threadId: GROUP, delta: { reactor: '111', icon: null } },
    ]);
    expect(res.rejected).toEqual([]);
    const r = await t.db.col<Loose>(C.reactions).findOne({ _id: `${UID}:d1` });
    expect(r?.reactions).toEqual({ '222': { '3': 2 }, '0': { '0': 1 } });
    expect(r).toMatchObject({ totals: { '3': 2, '0': 1 }, total: 3 });
    expect(r).not.toHaveProperty('delta');
  });

  it('outbox: the poll carries the replied message; the result does not cut the text the listener delivered', async () => {
    const item = (
      await http()
        .post('/api/outbox')
        .set(t.auth.dashboard)
        .send({ uid: UID, threadId: GROUP, text: 'Dạ shop chào anh\nGiá 120k ạ', replyToCliMsgId: '1791257266839' })
        .expect(201)
    ).body as OutboxItem;
    const pending = (await http().get('/api/outbox/pending').query({ uid: UID, commands: '1' }).set(t.auth.ingest).expect(200)).body as OutboxItem[];
    const polled = pending.find((p) => p.id === item.id);
    expect(polled?.target).toMatchObject({ msgId: 'd1', cliMsgId: '1791257266839', fromUid: CUSTOMER, msgType: 'webchat', text: 'Xin chào shop' });
    expect(Date.parse(polled?.target?.sentAt ?? '')).toBe(T);

    await http().post(`/api/outbox/${item.id}/claim`).set(t.auth.ingest).send({}).expect(200);
    // The listener's echo of the sent message arrives before the agent reports the result.
    await ingest('messages', [
      { msgId: 'd9', cliMsgId: '1791257299999', threadId: GROUP, fromUid: '0', msgType: 'webchat', text: 'Dạ shop chào anh\nGiá 120k ạ', sentAt: Date.now(), contentStatus: 'complete', contentSource: 'direct' },
    ]);
    await http()
      .post(`/api/outbox/${item.id}/result`)
      .set(t.auth.ingest)
      .send({ ok: true, sentAt: new Date().toISOString(), cliMsgId: '1791257299999', cliMsgIds: ['1791257299999'], replyCliMsgId: '1791257299999' })
      .expect(200);
    expect(await stored('d9')).toMatchObject({ text: 'Dạ shop chào anh\nGiá 120k ạ', contentSource: 'direct' });
    const sent = (await http().get('/api/outbox').query({ uid: UID }).set(t.auth.dashboard).expect(200)).body as OutboxItem[];
    expect(sent.find((s) => s.id === item.id)).toMatchObject({ status: 'sent', cliMsgId: '1791257299999' });
  });

  it('a máy Zalo nick takes commands right away: there is no per-nick send switch', async () => {
    const slots = t.db.col<Loose>('zalo_slots');
    await slots.insertOne({ _id: 'zs_send_test', uid: UID, mode: 'direct', state: 'da_ket_noi', sendEnabled: false } as never);
    try {
      const health = ((await http().get('/api/accounts/health').set(t.auth.dashboard).expect(200)).body as Record<string, unknown>[]).find((h) => h.uid === UID);
      expect(health).toMatchObject({ canSend: true });
      expect(health).not.toHaveProperty('sendOff');
      await http().post('/api/outbox').set(t.auth.dashboard).send({ uid: UID, threadId: GROUP, text: 'Dạ' }).expect(201);
    } finally {
      await slots.deleteOne({ _id: 'zs_send_test' });
    }
  });

  it('unread of a direct nick: each new customer message adds one, an own message resets, a re-ingest never counts twice', async () => {
    const DM = '9100000000888';
    const unread = async () => (await t.db.col<Loose>(C.conversations).findOne({ _id: `${UID}:${DM}` }))?.unread;
    const m = (msgId: string, fromUid: string, at: number) => ({ msgId, cliMsgId: `c${msgId}`, threadId: DM, fromUid, msgType: 'webchat', text: 'x', sentAt: at, contentStatus: 'complete', contentSource: 'direct' });
    await ingest('messages', [m('u1', DM, T), m('u2', DM, T + 1000)]);
    expect(await unread()).toBe(2);
    await ingest('messages', [m('u1', DM, T), m('u2', DM, T + 1000)]);
    expect(await unread()).toBe(2);
    await ingest('messages', [m('u3', '0', T + 2000), m('u4', DM, T + 3000)]);
    expect(await unread()).toBe(1);
    // The nick read it on another device.
    const r = (await http().post('/api/ingest/message-status').set(t.auth.ingest).send({ uid: UID, items: [{ threadId: DM, event: 'read' }] }).expect(200)).body;
    expect(r).toMatchObject({ updated: 1, rejected: [] });
    expect(await unread()).toBe(0);
  });

  it('own messages: "Đã gửi" on arrival, then delivered / seen up to a message; never back down on a re-ingest', async () => {
    const DM = '9100000000999';
    const own = (msgId: string, at: number) => ({ msgId, cliMsgId: `c${msgId}`, threadId: DM, fromUid: '0', msgType: 'webchat', text: 'Dạ', sentAt: at, status: 1, contentStatus: 'complete', contentSource: 'direct' });
    await ingest('messages', [own('s1', T), own('s2', T + 1000), own('s3', T + 2000)]);
    const status = async (id: string) => (await stored(id))?.status;
    expect(await status('s1')).toBe(1);
    const post = (items: unknown[]) => http().post('/api/ingest/message-status').set(t.auth.ingest).send({ uid: UID, items }).expect(200);
    await post([{ threadId: DM, event: 'delivered', msgId: 's3' }]);
    expect([await status('s1'), await status('s2'), await status('s3')]).toEqual([2, 2, 2]);
    await post([{ threadId: DM, event: 'seen', msgId: 's2' }]);
    expect([await status('s1'), await status('s2'), await status('s3')]).toEqual([3, 3, 2]);
    // A later "delivered" for an older message never lowers "Đã xem"; a catch-up re-ingest neither.
    await post([{ threadId: DM, event: 'delivered', msgId: 's1' }]);
    await ingest('messages', [own('s1', T)]);
    expect(await status('s1')).toBe(3);
    const bad = (await post([{ threadId: DM, event: 'nope' }, { threadId: DM, event: 'seen', msgId: 'missing' }])).body;
    expect(bad.rejected).toHaveLength(1);
    expect(bad.updated).toBe(0);
  });

  it('group system lines: shown in the group, but no unread, no "new message" chime', async () => {
    const before = await t.db.col('realtime_events').countDocuments({ type: 'message.new', uid: UID } as never);
    const unreadBefore = (await t.db.col<Loose>(C.conversations).findOne({ _id: `${UID}:${GROUP}` }))?.unread ?? 0;
    await ingest('messages', [
      { msgId: `sys:9100000000555:join:${Date.now()}`, threadId: GROUP, fromUid: CUSTOMER, senderName: 'Chị Lan', msgType: 'group.event', sentAt: Date.now(), systemEvent: { act: 'join', actorId: CUSTOMER }, contentStatus: 'complete', contentSource: 'direct' },
    ]);
    const conv = await t.db.col<Loose>(C.conversations).findOne({ _id: `${UID}:${GROUP}` });
    expect(conv?.unread ?? 0).toBe(unreadBefore);
    expect(await t.db.col('realtime_events').countDocuments({ type: 'message.new', uid: UID } as never)).toBe(before);
  });

  it('typing: a realtime event for the conversation, nothing stored; only for ingest tokens', async () => {
    await http().post('/api/ingest/typing').set(t.auth.ingest).send({ uid: UID, threadId: GROUP, who: CUSTOMER }).expect(200);
    const ev = await t.db.col('realtime_events').findOne({ type: 'typing', uid: UID } as never);
    expect(ev).toMatchObject({ type: 'typing', id: `${UID}:${GROUP}`, threadId: GROUP, kind: CUSTOMER });
    await http().post('/api/ingest/typing').set(t.auth.ingest).send({ uid: UID, threadId: GROUP, text: 'x' }).expect(400);
    await http().post('/api/ingest/typing').set(t.auth.dashboard).send({ uid: UID, threadId: GROUP }).expect(403);
  });

  it('sticker search: a nick not on the máy Zalo answers direct: false (the composer keeps the default set)', async () => {
    const r = (await http().get('/api/zalo/stickers').query({ uid: UID, q: 'chào' }).set(t.auth.dashboard).expect(200)).body;
    expect(r).toEqual({ direct: false, items: [] });
  });

  it('rejects an unknown content source and a malformed reaction event', async () => {
    const res = await ingest('messages', [{ msgId: 'x1', threadId: GROUP, fromUid: CUSTOMER, sentAt: T, contentSource: 'dom' }]);
    expect(res.accepted).toBe(0);
    expect(res.rejected).toHaveLength(1);
    const r = await ingest('reactions', [{ msgId: 'd1', threadId: GROUP, delta: { reactor: '222' } }]);
    expect(r.rejected).toHaveLength(1);
  });
});
