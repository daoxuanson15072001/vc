import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import type { AttachmentView, MessageView } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { AttachmentsService } from '../../src/attachments/attachments.service';
import { signLink, verifyLink } from '../../src/attachments/signing';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1c-04: company file store and voice-to-text on the test data (mock ASR, no model).
 * "Xác nhận xong": voice note -> job -> transcript within a minute; a file whose Zalo link expired
 * still opens from the store; files follow the data scope; links expire; erasure deletes files and transcripts.
 */
const NK = '9300000000001';
const DIV = 'TD-DV-VCP';
const MIN = 60_000;
const AUDIO = Buffer.concat([Buffer.from('ftypM4A '), Buffer.from('voice-note-bytes-1234567890')]);
const PDF = Buffer.from('%PDF-1.4 quote-bytes');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const conv = `${NK}:cust1`;
const enc = encodeURIComponent;

describe('company file store + voice-to-text (e2e, M1c-04)', () => {
  let t: E2EApp;
  let cdn: Server;
  let cdnUp = true;
  let base = '';
  const as: Record<string, { Authorization: string }> = {};
  const http = () => request(t.app.getHttpServer());
  const saved = { ...process.env };

  beforeAll(async () => {
    process.env.ASR_MODE = 'mock';
    process.env.ATTACHMENT_FETCH_HOSTS = '127.0.0.1';
    process.env.ATTACHMENT_FETCH_ALLOW_HTTP = '1';
    process.env.ATTACHMENT_FETCH_ALLOW_PRIVATE = '1';
    process.env.AUTHZ_DEFAULT_DIVISION = DIV;
    cdn = createServer((req, res) => {
      if (!cdnUp) return void res.writeHead(404).end();
      const body = req.url === '/voice.m4a' ? AUDIO : PDF;
      res.writeHead(200, { 'Content-Type': req.url === '/voice.m4a' ? 'audio/mp4' : 'application/pdf' }).end(body);
    });
    await new Promise<void>((r) => cdn.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(cdn.address() as AddressInfo).port}`;

    t = await startE2EApp();
    const now = new Date();
    const units: [string, string, string, string | null][] = [
      ['GOC', 'Tập đoàn', 'goc', null],
      [DIV, 'Division VCparts', 'division', 'GOC'],
      ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', DIV],
      ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', DIV],
    ];
    await t.db.col('org_units').insertMany(
      units.map(([id, name, type, parentId]) => ({ _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : DIV, managerUserId: null, active: true, createdAt: now, updatedAt: now })) as never,
    );
    const users: [string, string, string, string][] = [
      ['TD-U-KD1', 'minh.uat@vcprosperous.com', 'Minh', 'TD-DV-HN1'],
      ['TD-U-KD4', 'hai.uat@vcprosperous.com', 'Hải', 'TD-DV-HN2'],
    ];
    await t.db.col(C.users).insertMany(users.map(([id, email, fullName]) => ({ _id: id, email, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(users.map(([id, , , unit]) => ({ _id: `${id}:nvkd:${unit}`, userId: id, roleKey: 'nvkd', orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never);
    const sessions = t.app.get(SessionService);
    for (const [id, , name] of users) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: NK, label: 'Nick test' }).expect(201);
    await t.db.col('channel_access').insertOne({ _id: `${NK}:user:TD-U-KD1:giu_nick`, channelId: NK, principalType: 'user', principalId: 'TD-U-KD1', level: 'giu_nick', createdBy: 'seed' } as never);
    await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid: NK, items: [{ threadId: 'cust1', type: 'user', lastMsgAt: Date.now(), unread: 1 }] }).expect(200);
    t.app.get(AuthzService).invalidate();
  });

  afterAll(async () => {
    process.env = saved;
    await new Promise((r) => cdn?.close(r));
    await t?.close();
  });

  const msg = (id: string, ago = 5) =>
    http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid: NK, items: [{ msgId: id, cliMsgId: `17000000000${id.length}${id}`, threadId: 'cust1', fromUid: 'cust1', toUid: NK, msgType: 'chat.voice', encrypted: true, contentStatus: 'pending', sentAt: Date.now() - ago * MIN }] }).expect(200);
  // The content schema keeps https links only; the lab CDN is http, so content is written like the ingest does and the hook is called.
  const content = async (cliMsgId: string, c: Record<string, unknown>) => {
    const m = (await t.db.col(C.messages).findOneAndUpdate({ uid: NK, cliMsgId }, { $set: { content: c, contentStatus: 'complete', encrypted: false } }, { returnDocument: 'after' }))!;
    await t.app.get(AttachmentsService).noteMessages(NK, { _id: m._id });
  };
  const messages = async (who = 'TD-U-KD1') =>
    (await http().get(`/api/conversations/${enc(conv)}/messages`).set(as[who]!).expect(200)).body.items as MessageView[];
  const wait = async <T>(fn: () => Promise<T | undefined>, ms = 15_000): Promise<T> => {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v !== undefined) return v;
      if (Date.now() > end) throw new Error('timeout');
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  it('voice note: Zalo link -> company store -> transcript, messages.text = "[Ghi âm] ..." (mock, well under a minute)', async () => {
    await msg('v1');
    const cli = (await t.db.col(C.messages).findOne({ _id: `${NK}:v1` as never }))!.cliMsgId as string;
    const t0 = Date.now();
    await content(cli, { voice: { url: `${base}/voice.m4a`, durationSec: 30 } });
    const att = await wait(async () => {
      const m = (await messages()).find((x) => x.msgId === 'v1');
      const a = m?.attachments?.[0];
      return a?.transcript?.status === 'done' ? { m, a } : undefined;
    });
    expect(Date.now() - t0).toBeLessThan(60_000);
    expect(att.a).toMatchObject({ kind: 'audio', status: 'stored', mime: 'audio/mp4', transcript: { status: 'done' } });
    expect(att.m!.text).toMatch(/^\[Ghi âm\] /);
    expect(att.a.transcript?.text).toBeTruthy();
    // The expiring link is dropped once the bytes are kept.
    const row = await t.db.col(C.attachments).findOne({ _id: att.a.id as never });
    expect(row?.sourceUrl).toBeUndefined();
    expect(row?.mediaId).toBe(sha(AUDIO));
    // M1c-05: the transcript is searchable right away (the message already had search keys, the sweep would skip it).
    const found = (await http().get(`/api/search/messages?q=${enc('mô phỏng')}`).set(as['TD-U-KD1']!).expect(200)).body as { items: { msgId: string }[] };
    expect(found.items.map((i) => i.msgId)).toContain('v1');
    const other = (await http().get(`/api/search/messages?q=${enc('mô phỏng')}`).set(as['TD-U-KD4']!).expect(200)).body as { items: { msgId: string }[] };
    expect(other.items.map((i) => i.msgId)).not.toContain('v1');
  });

  it('a file whose Zalo link has expired still opens from the store; the second capture does not duplicate', async () => {
    await msg('f1');
    const cli = (await t.db.col(C.messages).findOne({ _id: `${NK}:f1` as never }))!.cliMsgId as string;
    await content(cli, { files: [{ name: 'bao-gia.pdf', url: `${base}/bao-gia.pdf`}] });
    const a = await wait(async () => (await messages()).find((x) => x.msgId === 'f1')?.attachments?.find((x) => x.status === 'stored'));
    cdnUp = false; // Zalo link now dead
    await content(cli, { files: [{ name: 'bao-gia.pdf', url: `${base}/bao-gia.pdf`}] });
    const got = await http().get(`/api/attachments/${enc(a.id)}/file`).set(as['TD-U-KD1']!).buffer(true).expect(200);
    expect(Buffer.compare(got.body as Buffer, PDF)).toBe(0);
    // PDF opens in the browser's viewer (06/10/2026), under its own name.
    expect(got.headers['content-disposition']).toBe("inline; filename*=UTF-8''bao-gia.pdf");
    expect(got.headers['cache-control']).toContain('no-store');
    expect(await t.db.col(C.attachments).countDocuments({ messageId: `${NK}:f1` })).toBe(1);
    cdnUp = true;
  });

  it('the real ingest route registers the files of a captured message (https link, unreachable host -> failed, never stored)', async () => {
    await msg('h1');
    const cli = (await t.db.col(C.messages).findOne({ _id: `${NK}:h1` as never }))!.cliMsgId as string;
    await http().post('/api/ingest/message-content').set(t.auth.ingest).send({ uid: NK, items: [{ cliMsgId: cli, capturedAt: Date.now(), files: [{ name: 'a.pdf', url: 'https://127.0.0.1:9/a.pdf' }] }] }).expect(200);
    const row = await wait(async () => (await t.db.col(C.attachments).findOne({ messageId: `${NK}:h1` })) ?? undefined);
    expect(row.kind).toBe('file');
    expect(row.status).not.toBe('stored');
  });

  it('a link that is already dead is marked expired (not retried forever) and never fetches hosts off the allow-list', async () => {
    await msg('x1');
    const cli = (await t.db.col(C.messages).findOne({ _id: `${NK}:x1` as never }))!.cliMsgId as string;
    cdnUp = false;
    await content(cli, { files: [{ name: 'a.pdf', url: `${base}/a.pdf` }, { name: 'evil.pdf', url: 'https://evil.example.com/a.pdf' }] });
    await wait(async () => ((await t.db.col(C.attachments).countDocuments({ messageId: `${NK}:x1`, status: { $in: ['expired', 'failed'] } })) === 2 ? true : undefined));
    const rows = await t.db.col(C.attachments).find({ messageId: `${NK}:x1` }).sort({ _id: 1 }).toArray();
    expect(rows.map((r) => r.status).sort()).toEqual(['expired', 'failed']);
    cdnUp = true;
  });

  it('files follow the data scope: another team gets 404, the nick holder 200; signed links expire', async () => {
    const a = (await messages()).find((x) => x.msgId === 'f1')!.attachments![0]!;
    await http().get(`/api/attachments/${enc(a.id)}/file`).set(as['TD-U-KD4']!).expect(404);
    await http().get(`/api/attachments/${enc(a.id)}/link`).set(as['TD-U-KD4']!).expect(404);
    await http().get(`/api/attachments/${enc(a.id)}/file`).expect(401);
    const link = (await http().get(`/api/attachments/${enc(a.id)}/link`).set(as['TD-U-KD1']!).expect(200)).body as { url: string; expiresAt: string };
    expect(Date.parse(link.expiresAt) - Date.now()).toBeLessThanOrEqual(10 * MIN);
    const r = await http().get(link.url).buffer(true).expect(200);
    expect(Buffer.compare(r.body as Buffer, PDF)).toBe(0);
    const part = await http().get(link.url).set('Range', 'bytes=0-3').buffer(true).expect(206);
    expect((part.body as Buffer).toString()).toBe('%PDF');
    // Expired or tampered links are refused.
    const old = signLink({ k: 'get', id: a.id, tenant: 'vcpv', exp: Math.floor(Date.now() / 1000) - 1 });
    await http().get(`/api/attachments/dl/${old}`).expect(403);
    await http().get(`${link.url}x`).expect(403);
    expect(() => verifyLink(link.url.split('/').pop()!, 'put')).toThrow();
  });

  it('create_upload_url -> PUT -> confirm_upload: bad checksum refused, good one queues the transcript', async () => {
    await msg('u1');
    const up = (await http().post('/api/attachments/upload-url').set(t.auth.ingest).send({ uid: NK, messageId: `${NK}:u1`, fileName: 'ghi-am.m4a', mime: 'audio/mp4', size: AUDIO.length }).expect(200)).body as { uploadId: string; url: string; expiresAt: string };
    expect(Date.parse(up.expiresAt) - Date.now()).toBeGreaterThan(14 * MIN);
    expect(Date.parse(up.expiresAt) - Date.now()).toBeLessThanOrEqual(15 * MIN);
    // more bytes than declared: refused
    await http().put(up.url).set('Content-Type', 'application/octet-stream').send(Buffer.concat([AUDIO, Buffer.from('more')])).expect(400);
    await http().put(up.url).set('Content-Type', 'application/octet-stream').send(AUDIO).expect(200);
    await http().post('/api/attachments/confirm').set(t.auth.ingest).send({ uploadId: up.uploadId, checksum: '0'.repeat(64) }).expect(400);
    // after a bad confirm the row is failed; ask again for a clean run
    const up2 = (await http().post('/api/attachments/upload-url').set(t.auth.ingest).send({ uid: NK, messageId: `${NK}:u1`, fileName: 'ghi-am.m4a', mime: 'audio/mp4', size: AUDIO.length }).expect(200)).body;
    await http().put(up2.url).set('Content-Type', 'application/octet-stream').send(AUDIO).expect(200);
    const ok = await http().post('/api/attachments/confirm').set(t.auth.ingest).send({ uploadId: up2.uploadId, checksum: sha(AUDIO) }).expect(200);
    expect(ok.body).toMatchObject({ status: 'stored', transcript: 'queued' });
    const a = await wait(async () => (await messages()).find((x) => x.msgId === 'u1')?.attachments?.find((x) => x.transcript?.status === 'done'));
    expect(a.status).toBe('stored');
    // dashboard tokens cannot ask for upload URLs; unknown message is 404
    await http().post('/api/attachments/upload-url').set(as['TD-U-KD1']!).send({ uid: NK, messageId: `${NK}:u1`, fileName: 'a', mime: 'audio/mp4', size: 5 }).expect(403);
    await http().post('/api/attachments/upload-url').set(t.auth.ingest).send({ uid: NK, messageId: `${NK}:nope`, fileName: 'a', mime: 'audio/mp4', size: 5 }).expect(404);
    // the PUT URL is single use
    await http().put(up2.url).set('Content-Type', 'application/octet-stream').send(AUDIO).expect(404);
  });

  it('live mode: jobs wait for the worker, which claims, reads audio and posts the text (and a failed job can be retried)', async () => {
    process.env.ASR_MODE = 'live';
    try {
      await msg('w1');
      const cli = (await t.db.col(C.messages).findOne({ _id: `${NK}:w1` as never }))!.cliMsgId as string;
      await content(cli, { voice: { url: `${base}/voice.m4a` } });
      const queued = await wait(async () => (await messages()).find((x) => x.msgId === 'w1')?.attachments?.find((x) => x.transcript));
      expect(queued.transcript?.status).toBe('queued');
      // the worker token cannot be a dashboard user's
      await http().post('/api/asr/jobs/claim').set(as['TD-U-KD1']!).expect(403);
      let job = (await http().post('/api/asr/jobs/claim').set(t.auth.ingest).expect(200)).body;
      while (job.jobId && job.attachmentId !== queued.id) {
        await http().post(`/api/asr/jobs/${enc(job.jobId)}/fail`).set(t.auth.ingest).send({ error: 'other' }).expect(200);
        job = (await http().post('/api/asr/jobs/claim').set(t.auth.ingest).expect(200)).body;
      }
      expect(job.attachmentId).toBe(queued.id);
      const audio = await http().get(job.audioPath).set(t.auth.ingest).buffer(true).expect(200);
      expect(Buffer.compare(audio.body as Buffer, AUDIO)).toBe(0);
      await http().post(`/api/asr/jobs/${enc(job.jobId)}/result`).set(t.auth.ingest).send({ text: 'xin chào anh', model: 'faster-whisper-small', lang: 'vi' }).expect(200);
      const m = (await messages()).find((x) => x.msgId === 'w1')!;
      expect(m.text).toBe('[Ghi âm] xin chào anh');
      expect(m.attachments?.[0]?.transcript).toMatchObject({ status: 'done', text: 'xin chào anh' });
      // no more running job: audio is closed
      await http().get(job.audioPath).set(t.auth.ingest).expect(404);
    } finally {
      process.env.ASR_MODE = 'mock';
    }
  });

  it('failed transcription shows as failed and "Thử lại" requeues it', async () => {
    process.env.ASR_MODE = 'live';
    try {
      await msg('r1');
      const cli = (await t.db.col(C.messages).findOne({ _id: `${NK}:r1` as never }))!.cliMsgId as string;
      await content(cli, { voice: { url: `${base}/voice.m4a` } });
      const a = await wait(async () => (await messages()).find((x) => x.msgId === 'r1')?.attachments?.find((x) => x.transcript));
      await t.db.col(C.asrJobs).updateOne({ _id: a.id as never }, { $set: { status: 'failed', attempts: 3 } });
      const failed = (await messages()).find((x) => x.msgId === 'r1')!.attachments![0] as AttachmentView;
      expect(failed.transcript?.status).toBe('failed');
      process.env.ASR_MODE = 'mock';
      const r = await http().post(`/api/attachments/${enc(a.id)}/transcribe`).set(as['TD-U-KD1']!).expect(200);
      expect(r.body.transcript.status).toBe('done');
    } finally {
      process.env.ASR_MODE = 'mock';
    }
  });

  it('erasure by customer deletes files, transcripts and bytes', async () => {
    const svc = t.app.get(AttachmentsService);
    const before = await t.db.col(C.attachments).countDocuments({});
    expect(before).toBeGreaterThan(3);
    const r = await svc.purgeSubjects([`${NK}:cust1`]);
    expect(r.files).toBeGreaterThanOrEqual(2);
    expect(r.transcripts).toBeGreaterThanOrEqual(3);
    expect(await t.db.col(C.attachments).countDocuments({})).toBe(0);
    expect(await t.db.col(C.transcripts).countDocuments({})).toBe(0);
    expect(await t.db.db.collection('media.files').countDocuments({ 'metadata.source': 'attachment' })).toBe(0);
  });
});
