import request from 'supertest';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1c-08: info panel tabs (Media / File / Link) and the L5 message kinds (location, call, reminder, video)
 * through the real ingest -> conversation API. Fixtures are synthetic (no customer data).
 */
const UID = '9100000000001';
const THREAD = '9100000000002';
const CONV = `${UID}:${THREAD}`;
const T0 = 1790000000000;

describe('panel thông tin + loại tin L5 (e2e, M1c-08)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await startE2EApp();
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: UID, label: 'Nick mẫu' }).expect(201);
    const kinds: [string, string][] = [
      ['1', 'webchat'], ['2', 'chat.photo'], ['3', 'share.file'], ['4', 'webchat'], ['5', 'chat.location.new'],
      ['6', 'chat.video.msg'], ['7', 'webchat'], ['8', 'webchat'],
    ];
    const items = kinds.map(([n, type], i) => ({
      msgId: `m${n}`, cliMsgId: `cli${n}`, threadId: THREAD, fromUid: THREAD, toUid: UID, msgType: type, sentAt: T0 + i * 1000,
      encrypted: true, contentStatus: 'pending' as const,
    }));
    await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: UID, items }).expect(200);
    const cap = T0 + 60_000;
    const res = await http()
      .post('/api/ingest/message-content')
      .set(t.auth.ingest)
      .send({
        uid: UID,
        items: [
          { cliMsgId: 'cli1', text: 'Chào anh', capturedAt: cap },
          { cliMsgId: 'cli2', kind: 'image', images: ['https://f.example.test/a.jpg'], capturedAt: cap },
          { cliMsgId: 'cli3', kind: 'file', files: [{ name: 'bao-gia.pdf', size: '60 KB', url: 'https://f.example.test/bao-gia.pdf' }], capturedAt: cap },
          { cliMsgId: 'cli4', kind: 'text', text: 'Xem https://vcparts.example.test/p/1', links: ['https://vcparts.example.test/p/1'], capturedAt: cap },
          { cliMsgId: 'cli5', kind: 'location', location: { lat: 21.0285, lng: 105.8542, title: 'Kho Test', url: 'https://maps.example.test/?q=21.0285,105.8542' }, capturedAt: cap },
          { cliMsgId: 'cli6', kind: 'video', video: { thumb: 'https://f.example.test/t.jpg', durationSec: 12 }, capturedAt: cap },
          { cliMsgId: 'cli7', kind: 'call', call: { outcome: 'missed' }, capturedAt: cap },
          { cliMsgId: 'cli8', kind: 'reminder', reminder: { title: 'Hẹn giao hàng', when: '09:00 05/10/2026' }, capturedAt: cap },
        ],
      })
      .expect(200);
    expect(res.body.matched).toBe(8);
  });
  afterAll(async () => {
    await t?.close();
  });

  const shared = async (kind: string, extra = '') =>
    (await http().get(`/api/conversations/${encodeURIComponent(CONV)}/shared?kind=${kind}${extra}`).set(t.auth.dashboard).expect(200)).body as {
      items: Record<string, unknown>[];
      hasMore: boolean;
    };

  it('lists photos and videos, files and links of the thread, newest first', async () => {
    const media = await shared('media');
    expect(media.items.map((i) => i.msgId)).toEqual(['m6', 'm2']);
    expect(media.items[1].images).toEqual(['https://f.example.test/a.jpg']);
    expect((await shared('file')).items.map((i) => i.msgId)).toEqual(['m3']);
    const links = await shared('link');
    expect(links.items.map((i) => i.msgId)).toEqual(['m4']);
    expect(links.items[0].links).toEqual(['https://vcparts.example.test/p/1']);
  });

  it('pages with before/limit and rejects an unknown kind', async () => {
    const first = await shared('media', '&limit=1');
    expect(first.items).toHaveLength(1);
    expect(first.hasMore).toBe(true);
    const next = await shared('media', `&limit=1&before=${encodeURIComponent(first.items[0].sentAt as string)}`);
    expect(next.items.map((i) => i.msgId)).toEqual(['m2']);
    expect(next.hasMore).toBe(false);
    await http().get(`/api/conversations/${encodeURIComponent(CONV)}/shared?kind=raw`).set(t.auth.dashboard).expect(400);
  });

  it('returns location, call, reminder and video content on the messages', async () => {
    const res = await http().get(`/api/conversations/${encodeURIComponent(CONV)}/messages`).set(t.auth.dashboard).expect(200);
    const by = Object.fromEntries((res.body.items as Record<string, unknown>[]).map((m) => [m.msgId as string, m]));
    expect(by.m5.location).toMatchObject({ lat: 21.0285, lng: 105.8542, title: 'Kho Test' });
    expect(by.m5.kind).toBe('location');
    expect(by.m6.video).toMatchObject({ durationSec: 12 });
    expect(by.m7.call).toEqual({ outcome: 'missed' });
    expect(by.m8.reminder).toEqual({ title: 'Hẹn giao hàng', when: '09:00 05/10/2026' });
  });

  it('announces content captured for a recent message (message.content), once per thread, ids only', async () => {
    const RT_THREAD = '9100000000099';
    const now = Date.now();
    await http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: UID, items: [{ msgId: 'mrt', cliMsgId: 'clirt', threadId: RT_THREAD, fromUid: RT_THREAD, toUid: UID, msgType: 'webchat', sentAt: now - 30_000, encrypted: true, contentStatus: 'pending' }] }).expect(200);
    await http().post('/api/ingest/message-content').set(t.auth.ingest).send({ uid: UID, items: [{ cliMsgId: 'clirt', kind: 'text', text: 'xin chào', capturedAt: now }] }).expect(200);
    const evs = await t.db.unscoped('realtime_events').find({ type: 'message.content', uid: UID } as never).toArray();
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ id: `${UID}:${RT_THREAD}`, threadId: RT_THREAD });
    expect(JSON.stringify(evs[0])).not.toContain('xin chào');
    // Captured again (already complete): no new event.
    await http().post('/api/ingest/message-content').set(t.auth.ingest).send({ uid: UID, items: [{ cliMsgId: 'clirt', kind: 'text', text: 'xin chào', capturedAt: now + 1000 }] }).expect(200);
    expect(await t.db.unscoped('realtime_events').countDocuments({ type: 'message.content', uid: UID } as never)).toBe(1);
  });

  it('shows the new kinds as the conversation preview', async () => {
    await http()
      .post('/api/ingest/message-content')
      .set(t.auth.ingest)
      .send({ uid: UID, items: [{ cliMsgId: 'cli8', kind: 'reminder', reminder: { title: 'Hẹn giao hàng' }, capturedAt: T0 + 70_000 }] })
      .expect(200);
    const conv = (await http().get(`/api/conversations/${encodeURIComponent(CONV)}`).set(t.auth.dashboard)).body;
    expect(conv.lastMessage?.text).toBe('[Nhắc hẹn]');
  });
});
