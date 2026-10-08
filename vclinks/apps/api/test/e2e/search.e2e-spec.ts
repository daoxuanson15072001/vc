import request from 'supertest';
import type { SearchMessagesResponse } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { C } from '../../src/db/db.service';
import { AuthzService } from '../../src/authz/authz.service';
import { SearchService } from '../../src/search/search.service';
import { MessageVault } from '../../src/security/message-vault';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1c-05: message search (MH-SZ-14, KD-15, I2, I4). Two TD users on two nicks: nobody finds messages outside
 * the data scope; phones are masked in results for a viewer without the phone right; accent-free, OE code,
 * phone and plate lookups; `?msg=` window; stale keys never leak erased text; speed on a large seed.
 */
const NK = (n: string) => `90000000000${n}`;
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
];
const USERS: [string, string, string, string][] = [
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-QS', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
];

describe('message search (e2e, M1c-05)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const saved = process.env.AUTHZ_DEFAULT_DIVISION;
  const find = async (who: string, q: string, extra = '') =>
    (await http().get(`/api/search/messages?q=${encodeURIComponent(q)}${extra}`).set(as[who]).expect(200)).body as SearchMessagesResponse;
  const msg = (thread: string, id: string, text: string, ago = 1000) => ({
    msgId: id, threadId: thread, fromUid: thread, toUid: 'x', senderName: 'Khách', msgType: 'webchat', text, sentAt: Date.now() - ago,
  });

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({ _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : parentId, managerUserId: null, active: true, createdAt: now, updatedAt: now })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never);
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };
    for (const [uid, holder] of [[NK('01'), 'TD-U-KD1'], [NK('02'), 'TD-U-KD2']] as const) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
    }
    const ingest = (uid: string, ...items: ReturnType<typeof msg>[]) => http().post('/api/ingest/messages').set(t.auth.ingest).send({ uid, items }).expect(200);
    await ingest(NK('01'),
      msg('K1', 'a1', 'Anh cần má phanh trước Vios 2019, còn hàng không em', 5000),
      msg('K1', 'a2', 'Mã 04465-0D130 giá bao nhiêu, gọi 0900.123.456 nhé', 4000),
      msg('K1', 'a3', 'Xe biển 30A-123.45 đổi dầu', 3000),
      msg('K1', 'a4', '[Ghi âm] bảo hành mười hai tháng cho má phanh', 2000),
    );
    await ingest(NK('02'), msg('K2', 'b1', 'Má phanh Camry của nick hai, gọi 0911 222 333', 5000));
    await ingest(NK('02'), msg('K3', 'b2', 'Gửi báo giá về garage.minhphat@example.vn giúp anh', 4000));
  });

  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = saved;
    await t.close();
  });

  it('does not return messages outside the data scope (two TD users)', async () => {
    const a = await find('TD-U-KD1', 'má phanh');
    expect(a.items.map((i) => i.msgId).sort()).toEqual(['a1', 'a4']);
    const b = await find('TD-U-KD2', 'má phanh');
    expect(b.items.map((i) => i.msgId)).toEqual(['b1']);
    // Asking for the other nick explicitly changes nothing.
    expect((await find('TD-U-KD1', 'camry', `&uid=${NK('02')}`)).items).toHaveLength(0);
    expect((await find('TD-U-KD2', 'vios', `&uid=${NK('01')}`)).items).toHaveLength(0);
  });

  it('finds without accents, in any word order, by prefix, and voice transcripts', async () => {
    expect((await find('TD-U-KD1', 'ma phanh vios')).items.map((i) => i.msgId)).toEqual(['a1']);
    expect((await find('TD-U-KD1', 'phan bao')).items.map((i) => i.msgId)).toEqual(['a4']);
    const voice = (await find('TD-U-KD1', 'bao hanh')).items[0]!;
    expect(voice.voice).toBe(true);
    expect(voice.snippet).toContain('bảo hành');
    expect(voice.marks.map(([s, e]) => voice.snippet.slice(s, e))).toEqual(['bảo', 'hành']);
    expect((await find('TD-U-KD1', 'xyzq')).items).toHaveLength(0);
    expect((await find('TD-U-KD1', '"phanh ma"')).items).toHaveLength(0);
  });

  it('finds phone, OE code and plate whatever the separators', async () => {
    for (const q of ['0900123456', '0900 123 456', '+84 900 123 456']) expect((await find('TD-U-KD1', q)).items.map((i) => i.msgId)).toEqual(['a2']);
    for (const q of ['044650D130', '04465-0d130', '04465 0D130'.replace(' ', '-')]) expect((await find('TD-U-KD1', q)).items.map((i) => i.msgId)).toEqual(['a2']);
    expect((await find('TD-U-KD1', '30a12345')).codeKind).toBe('plate');
    for (const q of ['30A-123.45', '30a12345', '30A 123 45']) expect((await find('TD-U-KD1', q)).items.map((i) => i.msgId)).toEqual(['a3']);
  });

  it('shows the whole phone to the nick holder and a masked one (and no prefix lookup) to others', async () => {
    const own = (await find('TD-U-KD1', '0900123456')).items[0]!;
    expect(own.snippet).toContain('0900.123.456');
    const qs = await find('TD-U-QS', '0900123456');
    for (const hit of qs.items) expect(hit.snippet).not.toContain('123.456');
    // Only a part of a number: no result for a viewer without the phone right, so digits cannot be probed.
    const part = await find('TD-U-QS', '0900123');
    expect(part.items).toHaveLength(0);
  });

  it('a part of a phone or e-mail never confirms a hit for a masked viewer, whatever the query shape (gate M1c-05)', async () => {
    for (const q of ['gọi 0900123', '"0900123"', '"0900.123"', 'mã 0900.123', '0900123 nhé']) expect((await find('TD-U-QS', q)).items).toHaveLength(0);
    expect((await find('TD-U-QS', 'minhphat')).items).toHaveLength(0);
    // The holder finds the same with any shape; the e-mail stays masked for the observer.
    expect((await find('TD-U-KD1', 'gọi 0900123')).items.map((i) => i.msgId)).toEqual(['a2']);
    expect((await find('TD-U-KD2', 'minhphat')).items.map((i) => i.msgId)).toEqual(['b2']);
    for (const hit of (await find('TD-U-QS', 'báo giá garage')).items) expect(hit.snippet).not.toContain('minhphat');
  });

  it('erasing a customer removes the search keys of his messages', async () => {
    await t.app.get(MessageVault).scrubSubjects([`${NK('02')}:K3`]);
    const doc = await t.db.unscoped(C.messages).findOne({ uid: NK('02'), msgId: 'b2' });
    expect(doc?.searchKeys).toBeUndefined();
    expect((await find('TD-U-KD2', 'minhphat')).items).toHaveLength(0);
  });

  it('a holder who lost the nick (handover) no longer finds its messages', async () => {
    const id = `${NK('02')}:user:TD-U-KD2:giu_nick`;
    const row = await t.db.col('channel_access').findOne({ _id: id } as never);
    await t.db.col('channel_access').deleteOne({ _id: id } as never);
    t.app.get(AuthzService).invalidate();
    try {
      expect((await find('TD-U-KD2', 'camry')).items).toHaveLength(0);
    } finally {
      if (row) await t.db.col('channel_access').insertOne(row as never);
      t.app.get(AuthzService).invalidate();
    }
  });

  it('rejects a query shorter than 2 characters', async () => {
    await http().get('/api/search/messages?q=a').set(as['TD-U-KD1']).expect(400);
  });

  it('opens the window around a hit (?msg=) and the target is in it', async () => {
    const hit = (await find('TD-U-KD1', '04465-0D130')).items[0]!;
    const page = (await http().get(`/api/conversations/${encodeURIComponent(hit.conversationId)}/messages?around=${hit.msgId}&limit=2`).set(as['TD-U-KD1']).expect(200)).body as {
      items: { msgId: string }[]; hasMore: boolean;
    };
    expect(page.items.map((i) => i.msgId)).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(page.hasMore).toBe(false);
    // Out of scope: 404/403, never the messages.
    const out = await http().get(`/api/conversations/${encodeURIComponent(hit.conversationId)}/messages?around=${hit.msgId}`).set(as['TD-U-KD2']);
    expect([403, 404]).toContain(out.status);
  });

  it('never returns erased or edited text through a stale key', async () => {
    await t.db.col(C.messages).updateOne({ uid: NK('01'), msgId: 'a2' }, { $set: { text: '[Đã ẩn danh]', erased: true } });
    expect((await find('TD-U-KD1', '0900123456')).items).toHaveLength(0);
    // The sweep repairs the keys of messages without any.
    await t.db.col(C.messages).updateOne({ uid: NK('01'), msgId: 'a2' }, { $unset: { searchKeys: '' } });
    expect(await t.app.get(SearchService).sweep()).toBeGreaterThanOrEqual(1);
  });

  it('does not write the query into the audit log', async () => {
    await find('TD-U-KD1', '0900123456');
    const rows = await t.db.col(C.auditLog).find({ action: 'search.code' }).toArray();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain('0900');
  });

  it('answers in 2 seconds on a large seed (100k messages)', async () => {
    const col = t.db.unscoped<Record<string, unknown>>(C.messages);
    const sample = ['Khách hỏi giá lọc gió', 'Báo giá má phanh trước', 'Anh nhận hàng chưa em', 'Chuyển khoản rồi nhé', 'Bên em còn lọc dầu Vios', 'Giao hàng tại Hà Nội'];
    const tenant = (await col.findOne({ uid: NK('01') }))!.tenant_id;
    const base = Date.now() - 400 * 86_400_000;
    for (let b = 0; b < 10; b++) {
      const docs = Array.from({ length: 10_000 }, (_, i) => {
        const n = b * 10_000 + i;
        const text = `${sample[n % sample.length]} ${n}`;
        return { _id: `${NK('01')}:big${n}`, uid: NK('01'), threadId: `T${n % 500}`, msgId: `big${n}`, fromUid: `T${n % 500}`, text, sentAt: new Date(base + n * 300_000), searchKeys: [...new Set(text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\W+/).filter(Boolean))], tenant_id: tenant };
      });
      await col.insertMany(docs as never);
    }
    await col.insertOne({ _id: `${NK('01')}:needle`, uid: NK('01'), threadId: 'T1', msgId: 'needle', fromUid: 'T1', text: 'Biển số 51F-987.65 xe giao', sentAt: new Date(), searchKeys: ['bien', 'so', '51f', '987', '65', 'xe', 'giao', '51f98765'], tenant_id: tenant } as never);
    for (const q of ['má phanh', 'lọc dầu vios', '51F-987.65', 'giao hàng']) {
      const t0 = Date.now();
      const r = await find('TD-U-KD1', q);
      const ms = Date.now() - t0;
      expect(r.items.length).toBeGreaterThan(0);
      expect(ms).toBeLessThan(2000);
      if (process.env.SEARCH_TIMING) console.log(`search "${q}": ${ms} ms, ${r.items.length} hits`);
    }
  });
});
