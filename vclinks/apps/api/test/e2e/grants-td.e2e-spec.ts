import request from 'supertest';
import { GRANT_BY_IDENTITY_MESSAGE, NO_ACCESS_TEXT, type AccessGrantList, type ConversationAccess, type OutboxItem } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { GrantsService } from '../../src/authz/grants.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-10 on the TD data (same fixture as authz-td): MH-PQ-07 approval screen and "Tất cả trong phạm vi"
 * (UAT-PQ-71, 85), leave request → cover (UAT-PQ-99), the cover on the composer and the outbox
 * (UAT-SZ-54), SZ-23 (no "Đã xem" when a supervisor opens a conversation), `needs_reapproval` and
 * `canDispatch` (D40, PQ-51), friend.respond on friend commands.
 */
const NK = (n: string) => `90000000000${n}`; // TD fake Zalo uids; TD-NK01 is the real driver nick, faked here.
const OA1 = 'zoa_9000000000101';
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-HCM1', 'Tổ HCM1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-CS', 'Nhóm CSKH VCparts', 'nhom_cskh', 'TD-DV-VCP'],
  ['TD-DV-SA', 'Nhóm Sale admin VCparts', 'nhom_sale_admin', 'TD-DV-VCP'],
  ['TD-DV-VCE', 'Division VCedu', 'division', 'GOC'],
  ['TD-DV-TVTS', 'Tổ Tư vấn tuyển sinh', 'to_ban_hang', 'TD-DV-VCE'],
];
const MANAGERS: Record<string, string> = { 'TD-DV-VCP': 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1', 'TD-DV-HN2': 'TD-U-GS2', 'TD-DV-HCM1': 'TD-U-GS2', 'TD-DV-VCE': 'TD-U-GDE' };
const USERS: [string, string, string, string][] = [
  ['TD-U-AD', 'Đặng Văn Quân', 'admin', 'GOC'],
  ['TD-U-QS', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-GS1', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-GS2', 'Hồ Văn Đức', 'giam_sat_bh', 'TD-DV-HN2'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD4', 'Phạm Văn Hải', 'nvkd', 'TD-DV-HN2'],
  ['TD-U-CS2', 'Hoàng Thị Thu', 'cskh', 'TD-DV-CS'],
  ['TD-U-SA', 'Ngô Bích Ngọc', 'sale_admin', 'TD-DV-SA'],
  ['TD-U-GDE', 'Phùng Văn Lộc', 'giam_doc_bh', 'TD-DV-VCE'],
  ['TD-U-KDE', 'Lưu Thu Trang', 'nvkd', 'TD-DV-TVTS'],
];
/** Nick → holder (TD §3.1) and division (default VCparts via AUTHZ_DEFAULT_DIVISION). */
const NICKS: [string, string, string | null][] = [
  [NK('01'), 'TD-U-KD1', null],
  [NK('02'), 'TD-U-KD2', null],
  [NK('04'), 'TD-U-KD4', null],
  [NK('08'), 'TD-U-KDE', 'TD-DV-VCE'],
];
/** One customer conversation per nick, thread = customer id; TD-H33 is on NK04 (Hải's nick). */
const CUSTOMER = (uid: string) => `91${uid.slice(-4)}`;

describe('M1b-10: trực thay, quyền tạm thời, Cần duyệt lại (e2e, TD data)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const conv = (uid: string) => `${uid}:${CUSTOMER(uid)}`;
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id,
        code: id,
        name,
        type,
        parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : UNITS.find((u) => u[0] === parentId)![0],
        managerUserId: MANAGERS[id] ?? null,
        active: true,
        createdAt: now,
        updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      [...USERS.map(([id, , role, unit]) => [id, role, unit]), ['TD-U-GS2', 'giam_sat_bh', 'TD-DV-HCM1']].map(([id, role, unit]) => ({
        _id: `${id}:${role}:${unit}`,
        userId: id,
        roleKey: role,
        orgUnitId: unit,
        createdBy: 'seed',
        createdAt: now,
      })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };

    // Channels: Zalo nicks through the real ingest API, the OA straight in the DB.
    for (const [uid, holder, division] of NICKS) {
      await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: `Nick ${uid.slice(-2)}` }).expect(201);
      const c = CUSTOMER(uid);
      await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid, items: [{ userId: c, displayName: `Khách ${c}`, phone: `0900000${uid.slice(-3)}` }] }).expect(200);
      await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid, items: [{ threadId: c, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
      await http()
        .post('/api/ingest/messages')
        .set(t.auth.ingest)
        .send({ uid, items: [{ msgId: `m${uid.slice(-2)}`, threadId: c, fromUid: c, toUid: uid, senderName: 'Khách', msgType: 'webchat', text: 'Chào em', sentAt: Date.now() }] })
        .expect(200);
      await t.db.col('channel_access').insertOne({ _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' } as never);
      if (division) await t.db.col(C.accounts).updateOne({ _id: uid } as never, { $set: { divisionId: division } });
    }
    // Friend-list flag normally comes from the DOM reader (M1a-03).
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    await t.db.col(C.accounts).insertOne({ _id: OA1, label: 'VCparts OA', channel: 'zalo_oa' } as never);
    await t.db.col(C.conversations).insertOne({ _id: `${OA1}:777`, uid: OA1, threadId: '777', type: 'user', lastMsgAt: now, unread: 0 } as never);
    await t.db.col('channel_access').insertOne({ _id: `${OA1}:org_unit:TD-DV-CS:gui`, channelId: OA1, principalType: 'org_unit', principalId: 'TD-DV-CS', level: 'gui', createdBy: 'seed' } as never);
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    await t?.close();
  });

  const enc = encodeURIComponent;
  const H = 3600_000;
  const iso = (ms: number) => new Date(ms).toISOString();
  const list = async (who: string, tab: string) => (await http().get(`/api/access-grants?tab=${tab}`).set(as[who]).expect(200)).body as AccessGrantList;
  const notices = async (who: string) => ((await http().get('/api/notifications').set(as[who]).expect(200)).body as { items: { title: string }[] }).items.map((i) => i.title);
  const access = async (who: string, id: string) => (await http().get(`/api/conversations/${enc(id)}/access`).set(as[who]).expect(200)).body as ConversationAccess;

  describe('UAT-PQ-71: xin quyền theo SĐT', () => {
    it('same answer whether the phone exists; the approver (GĐ) sees the customer', async () => {
      const body = { query: '0900000004', right: 'xem', durationHours: 24, reason: 'Khách gọi hỏi đơn hàng cũ' };
      const r = await http().post('/api/access-grants/by-identity').set(as['TD-U-GS1']).send(body).expect(200);
      expect(r.body.message).toBe(GRANT_BY_IDENTITY_MESSAGE);
      const pending = await list('TD-U-GD', 'pending');
      const row = pending.items.find((i) => i.userId === 'TD-U-GS1');
      expect(row?.targetLabel).toBe(`Khách ${CUSTOMER(NK('04'))}`);
      expect(row?.canApprove).toBe(true);
      // The requester only sees the id while waiting (MH-PQ-07 #3).
      const mine = await list('TD-U-GS1', 'mine');
      expect(mine.items.find((i) => i.id === row!.id)?.targetLabel).toBe(conv(NK('04')));

      const before = await t.db.col('access_grants').countDocuments({});
      const r2 = await http().post('/api/access-grants/by-identity').set(as['TD-U-GS1']).send({ ...body, query: '0999999999' }).expect(200);
      expect(r2.body.message).toBe(GRANT_BY_IDENTITY_MESSAGE);
      expect(await t.db.col('access_grants').countDocuments({})).toBe(before);
    });
  });

  describe('UAT-PQ-85: GĐ duyệt cho SA, GS thấy trong phạm vi', () => {
    let grantId = '';
    it('SA asks for a HN1 conversation, the approver is the GĐ (PQ-30); nobody approves his own request', async () => {
      const r = await http().post('/api/access-grants').set(as['TD-U-SA']).send({ targetId: conv(NK('01')), right: 'xem', durationHours: 24, reason: 'Đối chiếu đơn hàng với kế toán' }).expect(201);
      expect(r.body.approverId).toBe('TD-U-GD');
      grantId = r.body.id;
      await http().post(`/api/access-grants/${grantId}/approve`).set(as['TD-U-SA']).send({}).expect(403);
      await http().get(`/api/conversations/${enc(conv(NK('01')))}`).set(as['TD-U-SA']).expect(403);
    });

    it('GĐ approves (duration may only shrink); SA can read; GS1 got one line and sees it without "Thu hồi"', async () => {
      const r = await http().post(`/api/access-grants/${grantId}/approve`).set(as['TD-U-GD']).send({ durationHours: 168 }).expect(200);
      expect(r.body.message).toBe('Đã duyệt yêu cầu của Ngô Bích Ngọc.');
      const g = await t.db.col('access_grants').findOne({ _id: grantId } as never);
      expect(g?.status).toBe('hieu_luc');
      expect((g!.to as Date).getTime() - (g!.from as Date).getTime()).toBe(24 * H);
      await http().get(`/api/conversations/${enc(conv(NK('01')))}`).set(as['TD-U-SA']).expect(200);
      expect((await notices('TD-U-SA'))[0]).toMatch(/^Yêu cầu quyền của bạn đã được duyệt tới \d\d\/\d\d\/\d{4} \d\d:\d\d\.$/);
      expect((await notices('TD-U-GS1')).filter((n) => n.includes('Ngô Bích Ngọc'))).toHaveLength(1);

      const scope = await list('TD-U-GS1', 'scope');
      const row = scope.items.find((i) => i.id === grantId);
      expect(row).toMatchObject({ userName: 'Ngô Bích Ngọc', canRevoke: false, canReviewRequest: true });
      await http().post(`/api/access-grants/${grantId}/revoke`).set(as['TD-U-GS1']).expect(403);
      const rr = await http().post(`/api/access-grants/${grantId}/review-request`).set(as['TD-U-GS1']).expect(200);
      expect(rr.body.message).toBe('Đã gửi đề nghị xem lại tới Trịnh Văn Thắng.');
      // KD2 (no grant.approve / cover) has no scope tab.
      expect((await list('TD-U-KD2', 'scope')).tab).toBe('mine');
    });

    it('GĐ revokes: SA loses access at once (cache 0 in tests, ≤ 60 s in production)', async () => {
      const r = await http().post(`/api/access-grants/${grantId}/revoke`).set(as['TD-U-GD']).expect(200);
      expect(r.body.message).toBe('Đã thu hồi quyền của Ngô Bích Ngọc.');
      await http().get(`/api/conversations/${enc(conv(NK('01')))}`).set(as['TD-U-SA']).expect(403);
    });
  });

  describe('SZ-23 / D24: GS mở hội thoại của NVKD không làm "Đã xem"', () => {
    it('no automatic fetch for a non-holder; GS may fetch on purpose, logged', async () => {
      const a = await access('TD-U-GS1', conv(NK('01')));
      expect(a).toMatchObject({ autoFetch: false, canFetchOnBehalf: true, sendMode: 'tra_loi_thay', holderName: 'Nguyễn Văn Minh' });
      const r = await http().post(`/api/conversations/${enc(conv(NK('01')))}/fetch`).set(as['TD-U-GS1']).send({}).expect(403);
      expect(r.body.message).toContain('Đã xem');
      expect(await t.db.col(C.fetchRequests).countDocuments({})).toBe(0);
      await http().post(`/api/conversations/${enc(conv(NK('01')))}/fetch`).set(as['TD-U-GS1']).send({ onBehalf: true }).expect(200);
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'conversation.fetch_on_behalf', actor: 'user:TD-U-GS1' })).toBe(1);
      expect((await access('TD-U-KD1', conv(NK('01'))))).toMatchObject({ autoFetch: true, sendMode: null });
      await http().post(`/api/conversations/${enc(conv(NK('01')))}/fetch`).set(as['TD-U-KD1']).send({}).expect(200);
    });
  });

  describe('UAT-PQ-99 + UAT-SZ-54: đăng ký vắng → trực thay', () => {
    let coverId = '';
    it('KD1 registers leave; GS1 agrees by creating the cover with KD2 on NK01', async () => {
      const from = Date.now() + 5 * 60_000;
      const to = from + 34 * H;
      const r = await http().post('/api/leave-requests').set(as['TD-U-KD1']).send({ from: iso(from), to: iso(to), reason: 'Nghỉ phép gia đình', proposedCoverId: 'TD-U-KD2' }).expect(200);
      expect(r.body.message).toBe('Đã gửi đăng ký vắng tới Nguyễn Thị Hương.');
      await http().post('/api/leave-requests').set(as['TD-U-KD1']).send({ from: iso(from), to: iso(to), reason: 'Nghỉ phép gia đình' }).expect(409);
      const pending = await list('TD-U-GS1', 'pending');
      const leave = pending.items.find((i) => i.type === 'dang_ky_vang')!;
      expect(leave).toMatchObject({ absentUserId: 'TD-U-KD1', proposedCoverId: 'TD-U-KD2', canApprove: true });
      const opts = (await http().get('/api/access-grants/cover-options?absentUserId=TD-U-KD1').set(as['TD-U-GS1']).expect(200)).body;
      expect(opts.nicks.map((n: { uid: string }) => n.uid)).toEqual([NK('01')]);
      // Over 30 days and a missing nick are refused with the spec texts.
      const big = await http().post('/api/access-grants/covers').set(as['TD-U-GS1']).send({ absentUserId: 'TD-U-KD1', covers: [{ uid: NK('01'), userId: 'TD-U-KD2' }], from: iso(from), to: iso(from + 31 * 24 * H) }).expect(400);
      expect(big.body.message).toBe('Trực thay tối đa 30 ngày.');
      await http().post('/api/access-grants/covers').set(as['TD-U-GS1']).send({ absentUserId: 'TD-U-KD1', covers: [], from: iso(from), to: iso(to) }).expect(400);
      // NVKD cannot create covers.
      await http().post('/api/access-grants/covers').set(as['TD-U-KD2']).send({ absentUserId: 'TD-U-KD1', covers: [{ uid: NK('01'), userId: 'TD-U-KD2' }], from: iso(from), to: iso(to) }).expect(403);

      const c = await http()
        .post('/api/access-grants/covers')
        .set(as['TD-U-GS1'])
        .send({ absentUserId: 'TD-U-KD1', covers: [{ uid: NK('01'), userId: 'TD-U-KD2' }], from: iso(from), to: iso(to), leaveRequestId: leave.id })
        .expect(200);
      expect(c.body.message).toMatch(/^Đã giao Trần Thùy Linh trực thay Nguyễn Văn Minh từ \d\d\/\d\d\/\d{4} \d\d:\d\d đến \d\d\/\d\d\/\d{4} \d\d:\d\d\.$/);
      coverId = c.body.id;
      expect((await notices('TD-U-KD1')).some((n) => n.startsWith('Nguyễn Thị Hương đã đồng ý đăng ký vắng. Trần Thùy Linh trực nick'))).toBe(true);
      const overlap = await http().post('/api/access-grants/covers').set(as['TD-U-GS1']).send({ absentUserId: 'TD-U-KD1', covers: [{ uid: NK('01'), userId: 'TD-U-GS1' }], from: iso(from), to: iso(to) }).expect(409);
      expect(overlap.body.message).toBe('Nguyễn Văn Minh đã có trực thay trong khoảng này.');
      // Not started yet: KD2 does not see NK01.
      await http().get(`/api/conversations/${enc(conv(NK('01')))}`).set(as['TD-U-KD2']).expect(403);
    });

    it('when the cover starts: KD2 sees and sends from NK01 as "trực thay"; KD1 carries the leave flag', async () => {
      await t.db.col('access_grants').updateOne({ _id: coverId } as never, { $set: { from: new Date(Date.now() - 60_000) } });
      t.app.get(AuthzService).invalidate();
      const ids = ((await http().get('/api/conversations').set(as['TD-U-KD2']).expect(200)).body as { items: { id: string }[] }).items.map((i) => i.id);
      expect(ids).toContain(conv(NK('01')));
      const a = await access('TD-U-KD2', conv(NK('01')));
      expect(a).toMatchObject({ canReply: true, sendMode: 'truc_thay', holderName: 'Nguyễn Văn Minh', autoFetch: true });
      expect(a.coverUntil).toBeTruthy();
      const item = (await http().post('/api/outbox').set(as['TD-U-KD2']).send({ uid: NK('01'), threadId: CUSTOMER(NK('01')), text: 'Dạ em Linh trực thay anh Minh ạ' }).expect(201)).body as OutboxItem;
      expect(item).toMatchObject({ approvedBy: 'TD-U-KD2', approvedByName: 'Trần Thùy Linh', sendSource: 'truc_thay', onBehalfOfName: 'Nguyễn Văn Minh' });
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'reply_cover', actor: 'TD-U-KD2' })).toBe(1);
      const profile = (await http().get('/api/me/profile').set(as['TD-U-KD1']).expect(200)).body;
      expect(profile.leave).toMatchObject({ coverName: 'Trần Thùy Linh', active: true });
    });

    it('cover ended: KD2 loses NK01 at once', async () => {
      const r = await http().post(`/api/access-grants/${coverId}/end`).set(as['TD-U-GS1']).expect(200);
      expect(r.body.message).toBe('Đã kết thúc trực thay.');
      await http().get(`/api/conversations/${enc(conv(NK('01')))}`).set(as['TD-U-KD2']).expect(403);
    });
  });

  describe('18:00 summary (QT-SZ-10 #6)', () => {
    it('sends one line per absent person and nick per day, after 18:00 only', async () => {
      const now = Date.now();
      await t.db.col('access_grants').insertOne({ _id: 'cover_sum', userId: 'TD-U-KD2', type: 'truc_thay', targetType: 'channel', targetId: NK('01'), rights: ['xem', 'ghi_chu', 'tra_loi'], from: new Date(now - 48 * H), to: new Date(now + 48 * H), reason: 'x', requestedBy: 'TD-U-GS1', approvedBy: 'TD-U-GS1', status: 'hieu_luc', absentUserId: 'TD-U-KD1' } as never);
      const grants = t.app.get(GrantsService);
      const vnDay = new Date(now + 7 * H);
      const at = (h: number) => new Date(Date.UTC(vnDay.getUTCFullYear(), vnDay.getUTCMonth(), vnDay.getUTCDate(), h - 7, 5));
      expect(await grants.coverSummaries(at(17))).toBe(0);
      expect(await grants.coverSummaries(at(18))).toBe(1);
      expect(await grants.coverSummaries(at(19))).toBe(0);
      expect((await notices('TD-U-KD1')).some((n) => /^Trong lúc bạn vắng: Trần Thùy Linh trực nick .+, đã trả lời \d+ hội thoại, đã hiện SĐT \d+ lần\.$/.test(n))).toBe(true);
      await t.db.col('access_grants').deleteOne({ _id: 'cover_sum' } as never);
      t.app.get(AuthzService).invalidate();
    });
  });

  describe('D40 / PQ-51: Cần duyệt lại, canDispatch', () => {
    it('GS replies on behalf; once GS is locked the item becomes needs_reapproval and is never handed out', async () => {
      const item = (await http().post('/api/outbox').set(as['TD-U-GS1']).send({ uid: NK('01'), threadId: CUSTOMER(NK('01')), text: 'Dạ em là Hương, trưởng nhóm của anh Minh' }).expect(201)).body as OutboxItem;
      expect(item).toMatchObject({ approvedBy: 'TD-U-GS1', sendSource: 'tra_loi_thay', onBehalfOfName: 'Nguyễn Văn Minh' });
      // canDispatch at hand-out time: GS lost the right (status changed outside the lock flow).
      await t.db.col(C.users).updateOne({ _id: 'TD-U-GS1' } as never, { $set: { status: 'tam_khoa' } });
      t.app.get(AuthzService).invalidate();
      const pending = (await http().get(`/api/outbox/pending?uid=${NK('01')}`).set(t.auth.ingest).expect(200)).body as OutboxItem[];
      expect(pending.find((p) => p.id === item.id)).toBeUndefined();
      const held = await t.db.col(C.suggestions).findOne({ _id: new (require('mongodb').ObjectId)(item.id) } as never);
      expect(held).toMatchObject({ status: 'needs_reapproval', holdReason: 'approver_locked' });
      await t.db.col(C.users).updateOne({ _id: 'TD-U-GS1' } as never, { $set: { status: 'hoat_dong' } });
      t.app.get(AuthzService).invalidate();

      // No "Thử lại"; only the nick holder re-approves; GĐ / GS cannot re-approve or drop it.
      await http().post(`/api/outbox/${item.id}/retry`).set(as['TD-U-KD1']).expect(409);
      await http().post(`/api/outbox/${item.id}/reapprove`).set(as['TD-U-GD']).expect(403);
      await http().post(`/api/outbox/${item.id}/cancel`).set(as['TD-U-GD']).send({}).expect(403);
      const re = (await http().post(`/api/outbox/${item.id}/reapprove`).set(as['TD-U-KD1']).expect(200)).body as OutboxItem;
      expect(re).toMatchObject({ status: 'approved', approvedBy: 'TD-U-KD1', approvedByName: 'Nguyễn Văn Minh' });
      expect(Date.parse(re.approvedAt)).toBeGreaterThan(Date.parse(item.approvedAt) - 1);
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'outbox.reapprove', actor: 'TD-U-KD1' })).toBe(1);
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'outbox.needs_reapproval', target: item.id })).toBe(1);
    });

    it('locking a user through the admin route holds his waiting items at once', async () => {
      const item = (await http().post('/api/outbox').set(as['TD-U-GS1']).send({ uid: NK('01'), threadId: CUSTOMER(NK('01')), text: 'Tin thứ hai' }).expect(201)).body as OutboxItem;
      await http().post('/api/admin/users/TD-U-GS1/lock').set(as['TD-U-AD']).send({ reason: 'Kiểm thử khóa tài khoản' }).expect(200);
      const held = (await http().get(`/api/outbox?uid=${NK('01')}&status=needs_reapproval`).set(as['TD-U-KD1']).expect(200)).body as OutboxItem[];
      expect(held.map((h) => h.id)).toContain(item.id);
      expect(held.find((h) => h.id === item.id)?.holdReason).toBe('approver_locked');
      // "Của tôi" of the holder lists items waiting for his re-approval; "Người khác gửi trên nick tôi" too.
      const mine = (await http().get('/api/outbox?mine=1&status=needs_reapproval').set(as['TD-U-KD1']).expect(200)).body as OutboxItem[];
      expect(mine.map((h) => h.id)).toContain(item.id);
      const others = (await http().get('/api/outbox?onBehalf=1&status=needs_reapproval,approved,sent').set(as['TD-U-KD1']).expect(200)).body as OutboxItem[];
      expect(others.map((h) => h.id)).toContain(item.id);
      const counts = (await http().get(`/api/outbox/counts?uid=${NK('01')}`).set(as['TD-U-KD1']).expect(200)).body;
      expect(counts.needs_reapproval).toBeGreaterThanOrEqual(1);
      await http().post(`/api/outbox/${item.id}/cancel`).set(as['TD-U-KD1']).send({}).expect(200);
      await http().post('/api/admin/users/TD-U-GS1/unlock').set(as['TD-U-AD']).expect(200);
      // Locking ended his sessions: sign in again for the next cases.
      as['TD-U-GS1'] = { Authorization: `Bearer ${await t.app.get(SessionService).create({ _id: 'TD-U-GS1', fullName: 'Nguyễn Thị Hương' })}` };
    });
  });

  describe('friend.respond on friend commands (gác cổng M1a-04)', () => {
    it('a GS replying on behalf may not accept friend requests on the nick; the holder may', async () => {
      const body = { uid: NK('01'), threadId: '7777', action: 'friend_accept', friend: { userId: '7777', name: 'Khách lạ' } };
      const r = await http().post('/api/outbox').set(as['TD-U-GS1']).send(body).expect(403);
      expect(r.body.message).toBe(NO_ACCESS_TEXT.noPermission('friend.respond'));
      const ok = await http().post('/api/outbox').set(as['TD-U-KD1']).send(body);
      expect(ok.status).not.toBe(403);
    });
  });
});
