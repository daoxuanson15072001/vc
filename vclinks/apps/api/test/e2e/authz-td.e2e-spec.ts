import request from 'supertest';
import { NO_ACCESS_TEXT, SELF_EDIT_MESSAGE } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-04 at API level, on the TD data (docs/05-kiem-thu/du-lieu-kiem-thu.md §2, §3): the "không được thấy"
 * cases of docs 01 §7.2 that the current data model can express (UAT-PQ-02, 04, 06, 15, 16, 17, 19, 20),
 * the phone masking (MH-PQ-12), temporary grants (YC), legacy tokens and GET /api/me/permissions.
 * Customer owners, assignees and tickets arrive with M1b-09 / M1b-12: their cases are not here yet.
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

describe('permissions on the TD data (e2e, M1b-04)', () => {
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

  const listIds = async (who: string, query = '') =>
    ((await http().get(`/api/conversations${query}`).set(as[who]).expect(200)).body as { items: { id: string }[] }).items.map((i) => i.id).sort();

  describe('UAT-PQ-15/16/17: NVKD sees only his nick', () => {
    it('lists only conversations of the nick he holds, and only that nick in the account picker', async () => {
      expect(await listIds('TD-U-KD1')).toEqual([conv(NK('01'))]);
      const accounts = (await http().get('/api/accounts').set(as['TD-U-KD1']).expect(200)).body as { uid: string }[];
      expect(accounts.map((a) => a.uid)).toEqual([NK('01')]);
    });

    it('a direct link to a conversation of another nick is 403 and leaks nothing', async () => {
      const r = await http().get(`/api/conversations/${encodeURIComponent(conv(NK('04')))}`).set(as['TD-U-KD1']).expect(403);
      expect(r.body.message).toBe(NO_ACCESS_TEXT.api);
      expect(JSON.stringify(r.body)).not.toContain('Khách');
      await http().get(`/api/conversations/${encodeURIComponent(conv(NK('04')))}/messages`).set(as['TD-U-KD1']).expect(403);
    });

    it('listing another nick returns 200 with nothing, total 0', async () => {
      const r = await http().get(`/api/conversations?uid=${NK('04')}`).set(as['TD-U-KD1']).expect(200);
      expect(r.body).toMatchObject({ items: [], total: 0 });
      const c = await http().get(`/api/contacts?uid=${NK('04')}`).set(as['TD-U-KD1']).expect(200);
      expect(c.body.items).toEqual([]);
    });

    it('sending into a conversation of another nick is 403 and nothing is queued', async () => {
      await http().post('/api/outbox').set(as['TD-U-KD1']).send({ uid: NK('04'), threadId: CUSTOMER(NK('04')), text: 'Chào anh' }).expect(403);
      expect(await t.db.col(C.suggestions).countDocuments({ uid: NK('04') })).toBe(0);
    });
  });

  describe('UAT-PQ-19: supervisors and directors by tree', () => {
    it('GS of HN1 sees the nicks of his team, GS of HN2 does not see Minh (HN1)', async () => {
      expect(await listIds('TD-U-GS1')).toEqual([conv(NK('01')), conv(NK('02'))].sort());
      expect(await listIds('TD-U-GS2')).toEqual([conv(NK('04'))]);
      await http().get(`/api/conversations/${encodeURIComponent(conv(NK('01')))}`).set(as['TD-U-GS2']).expect(403);
    });

    it('GĐ VCparts sees the whole division (not VCedu); GĐ VCedu only VCedu', async () => {
      expect(await listIds('TD-U-GD')).toEqual([conv(NK('01')), conv(NK('02')), conv(NK('04')), `${OA1}:777`].sort());
      expect(await listIds('TD-U-GDE')).toEqual([conv(NK('08'))]);
      expect(await listIds('TD-U-KDE')).toEqual([conv(NK('08'))]);
    });
  });

  describe('UAT-PQ-20: CSKH, sale admin, admin, controller', () => {
    it('CSKH sees the OA its group is assigned to, never a sales nick (no ticket)', async () => {
      expect(await listIds('TD-U-CS2')).toEqual([`${OA1}:777`]);
      await http().get(`/api/conversations/${encodeURIComponent(conv(NK('01')))}`).set(as['TD-U-CS2']).expect(403);
      await http().post('/api/outbox').set(as['TD-U-CS2']).send({ uid: NK('01'), threadId: CUSTOMER(NK('01')), text: 'x' }).expect(403);
    });

    it('sale admin and admin read no chat (YC); admin still sees every channel status', async () => {
      expect(await listIds('TD-U-SA')).toEqual([]);
      expect(await listIds('TD-U-AD')).toEqual([]);
      const accounts = (await http().get('/api/accounts').set(as['TD-U-AD']).expect(200)).body as { uid: string }[];
      expect(accounts.map((a) => a.uid).sort()).toEqual([...NICKS.map((n) => n[0]), OA1].sort());
    });

    it('Ban giám đốc / Kiểm soát reads everything (logged) and can never send', async () => {
      expect((await listIds('TD-U-QS')).length).toBe(5);
      await http().get(`/api/conversations/${encodeURIComponent(conv(NK('04')))}`).set(as['TD-U-QS']).expect(200);
      expect(await t.db.col(C.auditLog).countDocuments({ actor: 'user:TD-U-QS', action: 'conversation.view' })).toBe(1);
      await http().post('/api/outbox').set(as['TD-U-QS']).send({ uid: NK('04'), threadId: CUSTOMER(NK('04')), text: 'x' }).expect(403);
    });
  });

  describe('temporary grant (YC, §2.6)', () => {
    it('opens exactly the granted conversation, logged each time', async () => {
      await t.db.col('access_grants').insertOne({
        _id: 'g1',
        userId: 'TD-U-KD1',
        type: 'xem_ngoai_pham_vi',
        targetType: 'conversation',
        targetId: conv(NK('04')),
        rights: ['xem'],
        from: new Date(Date.now() - 1000),
        to: new Date(Date.now() + 3600_000),
        reason: 'Khách gọi hotline hỏi đơn',
        requestedBy: 'TD-U-KD1',
        status: 'hieu_luc',
      } as never);
      await http().get(`/api/conversations/${encodeURIComponent(conv(NK('04')))}`).set(as['TD-U-KD1']).expect(200);
      expect(await listIds('TD-U-KD1')).toEqual([conv(NK('01')), conv(NK('04'))].sort());
      expect(await t.db.col(C.auditLog).countDocuments({ actor: 'user:TD-U-KD1', action: 'conversation.view', 'detail.via': 'YC' })).toBe(1);
      // View only: no reply through a nick he does not hold.
      await http().post('/api/outbox').set(as['TD-U-KD1']).send({ uid: NK('04'), threadId: CUSTOMER(NK('04')), text: 'x' }).expect(403);
      await t.db.col('access_grants').deleteOne({ _id: 'g1' } as never);
    });
  });

  describe('phone masking (MH-PQ-12, D6)', () => {
    it('the nick holder sees the full number; his supervisor sees it masked with "Hiện"', async () => {
      const own = await http().get(`/api/contacts?uid=${NK('01')}`).set(as['TD-U-KD1']).expect(200);
      expect(own.body.items[0].phone).toBe('0900000001');
      const gs = await http().get(`/api/contacts?uid=${NK('01')}`).set(as['TD-U-GS1']).expect(200);
      expect(gs.body.items[0]).toMatchObject({ phone: '0900 *** 001', phoneMasked: true, phoneRevealable: true });
    });

    it('"Hiện" returns the number and logs phone.reveal without it', async () => {
      const r = await http().post('/api/reveal').set(as['TD-U-GS1']).send({ field: 'phone', uid: NK('01'), userId: CUSTOMER(NK('01')), where: 'MH-SZ-01' }).expect(200);
      expect(r.body.phone).toBe('0900000001');
      const log = await t.db.col(C.auditLog).findOne({ action: 'phone.reveal', actor: 'user:TD-U-GS1' });
      expect(log).toBeTruthy();
      expect(JSON.stringify(log)).not.toContain('0900000001');
      // CSKH cannot reveal a number of a sales nick.
      await http().post('/api/reveal').set(as['TD-U-CS2']).send({ field: 'phone', uid: NK('01'), userId: CUSTOMER(NK('01')) }).expect(403);
    });
  });

  describe('administration routes (UAT-PQ-02, 04, 06, 65)', () => {
    it('UAT-PQ-02: GS sees only the path to his team and cannot change the tree', async () => {
      const units = (await http().get('/api/admin/org-units').set(as['TD-U-GS1']).expect(200)).body as { id: string }[];
      expect(units.map((u) => u.id).sort()).toEqual(['GOC', 'TD-DV-HN1', 'TD-DV-VCP']);
      await http().post('/api/admin/org-units').set(as['TD-U-GS1']).send({ name: 'Tổ X', type: 'to_ban_hang', parentId: 'TD-DV-VCP' }).expect(403);
    });

    it('UAT-PQ-04: GĐ VCparts lists only VCparts people, cannot add people', async () => {
      const r = await http().get('/api/admin/users?pageSize=100').set(as['TD-U-GD']).expect(200);
      const ids = (r.body.items as { id: string }[]).map((u) => u.id);
      expect(ids).toContain('TD-U-KD1');
      expect(ids).not.toContain('TD-U-KDE');
      expect((await http().get('/api/admin/users?q=Trang').set(as['TD-U-GD']).expect(200)).body.total).toBe(0);
      await http().post('/api/admin/users').set(as['TD-U-GD']).send({ email: 'x.uat@vcprosperous.com', fullName: 'X', assignments: [] }).expect(403);
      await http().get('/api/admin/users/TD-U-KDE').set(as['TD-U-GD']).expect(403);
    });

    it('UAT-PQ-06: NVKD calling an admin API gets 403', async () => {
      await http().get('/api/admin/users').set(as['TD-U-KD1']).expect(403);
      await http().get('/api/admin/org-units').set(as['TD-U-KD1']).expect(403);
    });

    it('UAT-PQ-65: Admin cannot edit himself', async () => {
      const r = await http().patch('/api/admin/users/TD-U-AD').set(as['TD-U-AD']).send({ fullName: 'Quân 2' }).expect(403);
      expect(r.body.message).toBe(SELF_EDIT_MESSAGE);
    });

    it('reading the tree never writes (no root created by a GET)', async () => {
      await t.db.col('org_units').deleteOne({ _id: 'GOC' } as never);
      const units = (await http().get('/api/admin/org-units').set(as['TD-U-AD']).expect(200)).body as { id: string }[];
      expect(units.some((u) => u.id === 'GOC')).toBe(true);
      expect(await t.db.col('org_units').countDocuments({ _id: 'GOC' } as never)).toBe(0);
    });
  });

  describe('GET /api/me/permissions', () => {
    it('gives the NVKD his keys and scopes, without admin keys', async () => {
      const r = await http().get('/api/me/permissions').set(as['TD-U-KD1']).expect(200);
      expect(r.body.permissions['conv.view']).toMatchObject({ scopes: ['CT', 'NICK'], mode: 'full' });
      expect(r.body.permissions['org.edit']).toBeUndefined();
      expect(r.body.heldChannels).toEqual([NK('01')]);
      expect(r.body.roles).toEqual([expect.objectContaining({ roleKey: 'nvkd', orgUnitId: 'TD-DV-HN1' })]);
    });
  });

  describe('M1b-05 screens: no access (MH-PQ-11), access request, read-only (D8-02)', () => {
    const grants = () => t.db.col<{ _id: string; userId: string; status: string; approverId?: string; rights: string[]; reason: string }>('access_grants');

    it('UAT-UI-39: a foreign conversation and a missing one answer the same 403 (form B)', async () => {
      const foreign = await http().get(`/api/conversations/${encodeURIComponent(conv(NK('04')))}/messages`).set(as['TD-U-KD1']).expect(403);
      const missing = await http().get(`/api/conversations/${encodeURIComponent('zalo:khongco')}/messages`).set(as['TD-U-KD1']).expect(403);
      expect(foreign.body.message).toBe(NO_ACCESS_TEXT.api);
      expect(missing.body.message).toBe(foreign.body.message);
      expect(JSON.stringify(foreign.body)).not.toContain('Hải');
    });

    it('UAT-UI-40: approver of Minh asking for Hải\'s customer is the division director (PQ-30)', async () => {
      const target = conv(NK('04'));
      const a = await http().get('/api/access-grants/approver').query({ targetId: target }).set(as['TD-U-KD1']).expect(200);
      expect(a.body).toMatchObject({ approverId: 'TD-U-GD', approverName: 'Trịnh Văn Thắng', replyLocked: true });
      // Empty reason: refused, nothing stored.
      await http().post('/api/access-grants').set(as['TD-U-KD1']).send({ targetId: target, right: 'xem', durationHours: 24, reason: '' }).expect(400);
      expect(await grants().countDocuments({ userId: 'TD-U-KD1' })).toBe(0);
      const ok = await http()
        .post('/api/access-grants')
        .set(as['TD-U-KD1'])
        .send({ targetId: target, right: 'xem', durationHours: 24, reason: 'Khách gọi hotline hỏi đơn' })
        .expect(201);
      expect(ok.body).toMatchObject({ status: 'cho_duyet', approverId: 'TD-U-GD', approverName: 'Trịnh Văn Thắng' });
      const row = await grants().findOne({ _id: ok.body.id });
      expect(row).toMatchObject({ userId: 'TD-U-KD1', status: 'cho_duyet', approverId: 'TD-U-GD', rights: ['xem'] });
      // The supervisor of the requester (GS tổ HN1) is not the approver; the audit line holds no reason text.
      const log = JSON.stringify(await t.db.col(C.auditLog).find({ action: 'grant.request' }).toArray());
      expect(log).toContain('TD-U-GD');
      expect(log).not.toContain('hotline');
      // Same object again: duplicate.
      const dup = await http().post('/api/access-grants').set(as['TD-U-KD1']).send({ targetId: target, reason: 'Khách gọi hotline hỏi đơn' }).expect(409);
      expect(dup.body.message).toBe('Bạn đã có yêu cầu đang chờ duyệt cho đối tượng này.');
    });

    it('same team goes to the team supervisor; reply on a personal nick is refused; unknown target is 404; observers cannot ask', async () => {
      const a = await http().get('/api/access-grants/approver').query({ targetId: conv(NK('02')) }).set(as['TD-U-KD1']).expect(200);
      expect(a.body.approverName).toBe('Nguyễn Thị Hương');
      const reply = await http().post('/api/access-grants').set(as['TD-U-KD1']).send({ targetId: conv(NK('02')), right: 'tra_loi', reason: 'Cần trả lời khách giúp đồng nghiệp' }).expect(400);
      expect(reply.body.message).toContain('Trực thay');
      const gone = await http().post('/api/access-grants').set(as['TD-U-KD1']).send({ targetId: 'zalo:khongco', reason: 'Khách gọi hotline hỏi đơn' }).expect(404);
      expect(gone.body.message).toBe('Không tìm thấy đối tượng với mã này.');
      await http().post('/api/access-grants').set(as['TD-U-QS']).send({ targetId: conv(NK('02')), reason: 'Khách gọi hotline hỏi đơn' }).expect(403);
    });

    it('viewer has no compose box, NVKD does on his own nick; foreign conversation is 403', async () => {
      const own = await http().get(`/api/conversations/${encodeURIComponent(conv(NK('01')))}/access`).set(as['TD-U-KD1']).expect(200);
      expect(own.body).toMatchObject({ canReply: true, replyReason: null, sendMode: null, autoFetch: true });
      const viewer = await http().get(`/api/conversations/${encodeURIComponent(conv(NK('01')))}/access`).set(as['TD-U-QS']).expect(200);
      expect(viewer.body).toMatchObject({ canReply: false, replyReason: 'Bạn chỉ có quyền xem hội thoại này.', autoFetch: false });
      await http().get(`/api/conversations/${encodeURIComponent(conv(NK('04')))}/access`).set(as['TD-U-KD1']).expect(403);
    });

    it('roles matrix (MH-PQ-05): readable by Admin, Director and Observer; not by NVKD (menu hidden)', async () => {
      const r = await http().get('/api/admin/roles').set(as['TD-U-AD']).expect(200);
      expect(r.body.roles).toHaveLength(10);
      expect(r.body.keys[0]).toMatchObject({ key: 'conv.view', label: expect.any(String), section: expect.any(String) });
      await http().get('/api/admin/roles').set(as['TD-U-QS']).expect(200);
      await http().get('/api/admin/roles').set(as['TD-U-KD1']).expect(403);
      const me = await http().get('/api/me/permissions').set(as['TD-U-KD1']).expect(200);
      for (const k of ['org.view', 'user.view', 'role.view']) expect(me.body.permissions[k]).toBeUndefined();
    });
  });

  describe('legacy tokens without a user', () => {
    it('work only with AUTHZ_LEGACY_TOKENS=1', async () => {
      await http().get('/api/conversations').set(t.auth.dashboard).expect(200);
      process.env.AUTHZ_LEGACY_TOKENS = '0';
      try {
        const r = await http().get('/api/conversations').set(t.auth.dashboard).expect(403);
        expect(r.body.message).toContain('không gắn với người dùng');
        // Device tokens keep their own routes.
        await http().get(`/api/checkpoints/${NK('01')}/messages`).set(t.auth.ingest).expect(200);
      } finally {
        process.env.AUTHZ_LEGACY_TOKENS = '1';
      }
    });
  });
});
