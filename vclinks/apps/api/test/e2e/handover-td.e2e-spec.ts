import request from 'supertest';
import { ObjectId } from 'mongodb';
import { HANDOVER_TEXT, type HandoverPlanPreview, type HandoverResult, type OffboardPreview, type OutboxItem } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { TokenService } from '../../src/auth/token.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { HandoverService } from '../../src/handover/handover.service';
import { DEFAULT_TENANT, runAsTenant } from '../../src/db/tenant-context';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * M1b-11 on the TD data: offboarding and handover (MH-PQ-04, PQ-33/34/51, QT-SZ-11, GS-05).
 * UAT-PQ-67 (lock: device token, waiting commands), UAT-PQ-68 (handover, "Chưa an toàn", confirm),
 * UAT-PQ-95 (GS continues the handover), UAT-DK-67 (Chia đều skips Vắng / Nghỉ phép), the 4 h / 20 h / 24 h
 * clock (PQ-34), the daily reminder (PQ-51) and "old person gets 403 on the old conversation".
 */
const NK = (n: string) => `90000000000${n}`;
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', 'TD-DV-VCP'],
];
const MANAGERS: Record<string, string> = { 'TD-DV-VCP': 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1', 'TD-DV-HN2': 'TD-U-GS2' };
const USERS: [string, string, string, string][] = [
  ['TD-U-AD', 'Đặng Văn Quân', 'admin', 'GOC'],
  ['TD-U-QS', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-GS1', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-GS2', 'Hồ Văn Đức', 'giam_sat_bh', 'TD-DV-HN2'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD3', 'Lê Văn Tú', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD4', 'Phạm Văn Hải', 'nvkd', 'TD-DV-HN2'],
  ['TD-U-KD5', 'Đỗ Văn Toàn', 'nvkd', 'TD-DV-HN2'],
  ['TD-U-KD6', 'Vũ Văn Sáu', 'nvkd', 'TD-DV-HN2'],
  ['TD-U-KD7', 'Bùi Văn Bảy', 'nvkd', 'TD-DV-HN2'],
];
const CUSTOMER = (uid: string) => `91${uid.slice(-4)}`;
const H = 3600_000;

describe('M1b-11: nghỉ việc và bàn giao (e2e, TD data)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const savedDivision = process.env.AUTHZ_DEFAULT_DIVISION;
  const enc = encodeURIComponent;
  const owners = (userId: string) => t.db.col('customer_accounts').find({ 'owners.userId': userId } as never).toArray();
  const notices = async (who: string) => ((await http().get('/api/notifications').set(as[who]).expect(200)).body as { items: { title: string }[] }).items.map((i) => i.title);

  /** Customers of a leaver: `n` accounts, the first one with a conversation on `uid` assigned to him. */
  async function seedCustomers(userId: string, prefix: string, n: number, extra: { region?: string; tags?: string[] }[] = []) {
    const now = new Date();
    for (let i = 0; i < n; i++) {
      await t.db.col('customer_accounts').insertOne({
        _id: `${prefix}${i}`,
        name: `Khách ${prefix}${i}`,
        type: 'garage',
        region: extra[i]?.region ?? null,
        status: 'active',
        mergedInto: null,
        owners: [{ division: 'TD-DV-VCP', userId, since: now, source: 'vcsales_import' }],
        erpLinks: [],
        tags: extra[i]?.tags ?? [],
        createdFrom: 'manual',
        createdAt: now,
        updatedAt: now,
      } as never);
    }
  }

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId,
        divisionId: type === 'division' ? id : type === 'goc' ? null : parentId,
        managerUserId: MANAGERS[id] ?? null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };

    // NK05: Toàn's nick with one customer conversation, assigned to him.
    const uid = NK('05');
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid, label: 'Toàn VCparts' }).expect(201);
    const c = CUSTOMER(uid);
    await http().post('/api/ingest/contacts').set(t.auth.ingest).send({ uid, items: [{ userId: c, displayName: `Khách ${c}`, phone: '0900000005' }] }).expect(200);
    await http().post('/api/ingest/conversations').set(t.auth.ingest).send({ uid, items: [{ threadId: c, type: 'user', lastMsgAt: Date.now(), unread: 0 }] }).expect(200);
    await http()
      .post('/api/ingest/messages')
      .set(t.auth.ingest)
      .send({ uid, items: [{ msgId: 'm05', threadId: c, fromUid: c, toUid: uid, senderName: 'Khách', msgType: 'webchat', text: 'Chào em', sentAt: Date.now() }] })
      .expect(200);
    await t.db.col('channel_access').insertOne({ _id: `${uid}:user:TD-U-KD5:giu_nick`, channelId: uid, principalType: 'user', principalId: 'TD-U-KD5', level: 'giu_nick', createdBy: 'seed' } as never);
    await t.db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    await t.db.col(C.conversations).updateOne({ _id: `${uid}:${c}` } as never, { $set: { assigneeId: 'TD-U-KD5' } });
    await seedCustomers('TD-U-KD5', 'K18', 3, [{ tags: ['Hạng A'] }, {}, {}]);
    await t.db.col('identity_links').insertOne({ _id: `${uid}:${c}`, identityId: `${uid}:${c}`, uid, userId: c, channel: 'zalo', contactId: `${uid}:${c}`, accountId: 'K180', state: 'linked', linkedBy: 'seed', linkedAt: now, firstSeenAt: now } as never);
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = savedDivision;
    await t?.close();
  });

  describe('UAT-PQ-67: Khóa ngay', () => {
    let deviceToken = '';
    let deviceId = '';
    const items: OutboxItem[] = [];

    it('step 1 lists the device and the waiting commands; lock cuts them and keeps the content', async () => {
      const made = await t.app.get(TokenService).createWithId('Laptop Toàn', ['ingest'], undefined, { kind: 'device', uids: [NK('05')], deviceName: 'Laptop Toàn' });
      deviceToken = made.token;
      deviceId = made.id;
      for (const text of ['Tin chờ một', 'Tin chờ hai']) {
        items.push((await http().post('/api/outbox').set(as['TD-U-KD5']).send({ uid: NK('05'), threadId: CUSTOMER(NK('05')), text }).expect(201)).body as OutboxItem);
      }
      const pre = (await http().get('/api/admin/users/TD-U-KD5/offboard-preview').set(as['TD-U-GD']).expect(200)).body as OffboardPreview;
      expect(pre).toMatchObject({ customers: 3, pendingCommands: 2, managedUnits: [] });
      expect(pre.deviceTokens.map((d) => d.id)).toEqual([deviceId]);
      expect(pre.nicks.map((n) => n.uid)).toEqual([NK('05')]);
      // The device works before the lock.
      await http().get(`/api/outbox/pending?uid=${NK('05')}`).set({ Authorization: `Bearer ${deviceToken}` }).expect(200);

      const r = await http().post('/api/admin/users/TD-U-KD5/offboard').set(as['TD-U-GD']).send({ reason: 'Nghỉ việc theo đơn' }).expect(200);
      expect(r.body.message).toBe(HANDOVER_TEXT.locked('Đỗ Văn Toàn', 1, 2));
      await http().get(`/api/outbox/pending?uid=${NK('05')}`).set({ Authorization: `Bearer ${deviceToken}` }).expect(401);
      for (const it of items) {
        const d = await t.db.col(C.suggestions).findOne({ _id: new ObjectId(it.id) } as never);
        expect(d).toMatchObject({ status: 'needs_reapproval', holdReason: 'approver_offboarded', finalText: it.text });
      }
      expect(await t.db.col(C.auditLog).countDocuments({ action: 'outbox.needs_reapproval', 'detail.reason': 'approver_offboarded' })).toBe(2);
      expect(await notices('TD-U-AD')).toEqual(expect.arrayContaining([expect.stringContaining('Đã khóa tài khoản Đỗ Văn Toàn')]));
      await http().post(`/api/outbox/${items[0]!.id}/retry`).set(as['TD-U-KD5']).expect(401);
    });

    it('a command approved by him after the lock is held by canDispatch, never handed out', async () => {
      const d = await t.app.get(AuthzService).canDispatch('TD-U-KD5', NK('05'), CUSTOMER(NK('05')));
      expect(d).toEqual({ allowed: false, reason: 'approver_offboarded' });
    });

    it('only an Admin may keep a shared company device', async () => {
      await http().post('/api/admin/users/TD-U-KD6/offboard').set(as['TD-U-GD']).send({ reason: 'Thử giữ máy', keepDeviceTokenIds: ['x'] }).expect(403);
    });
  });

  describe('UAT-PQ-95 / PQ-68: GS continues, handover, "Chưa an toàn"', () => {
    let result: HandoverResult;

    it('GS has no "Nghỉ việc…" / "Mở khóa" but can continue the handover inside the team', async () => {
      await http().post('/api/admin/users/TD-U-KD5/offboard').set(as['TD-U-GS2']).send({ reason: 'Thử khóa bởi GS' }).expect(403);
      await http().post('/api/admin/users/TD-U-KD5/unlock').set(as['TD-U-GS2']).send({}).expect(403);
      const pre = (await http().get('/api/admin/users/TD-U-KD5/offboard-preview').set(as['TD-U-GS2']).expect(200)).body as OffboardPreview;
      expect(pre.customers).toBe(3);
      expect(pre.openConversations).toBe(1);
      expect(pre.nickLoad).toEqual([{ uid: NK('05'), needsReapproval: 2, pendingFriendRequests: 0, unansweredConversations: expect.any(Number) }]);
      // Outside the team: a different team's leaver is refused.
      await http().get('/api/admin/users/TD-U-KD1/offboard-preview').set(as['TD-U-GS2']).expect(403);
    });

    it('refuses an unlocked person, receivers outside the team and an incomplete plan', async () => {
      await http().post('/api/admin/users/TD-U-KD6/handover/preview').set(as['TD-U-GS2']).send({ mode: 'one', toUserIds: ['TD-U-KD4'] }).expect(409);
      await http().post('/api/admin/users/TD-U-KD5/handover/preview').set(as['TD-U-GS2']).send({ mode: 'one', toUserIds: ['TD-U-KD1'] }).expect(400);
      await http().post('/api/admin/users/TD-U-KD5/handover').set(as['TD-U-GS2']).send({ mode: 'one', toUserIds: ['TD-U-KD4'], channels: [] }).expect(400);
      expect((await owners('TD-U-KD5')).length).toBe(3);
    });

    it('hands over customers, the following conversation and the nick in one call; the nick is unsafe', async () => {
      result = (
        await http()
          .post('/api/admin/users/TD-U-KD5/handover')
          .set(as['TD-U-GS2'])
          .send({ mode: 'one', toUserIds: ['TD-U-KD4'], channels: [{ uid: NK('05'), toUserId: 'TD-U-KD4', phoneLogoutConfirmed: false }] })
          .expect(200)
      ).body as HandoverResult;
      expect(result).toMatchObject({ customersMoved: 3, conversationsMoved: 1, nicksMoved: 1, unsafeNicks: 1 });
      expect(result.message).toBe(HANDOVER_TEXT.done(3, 1, 'Phạm Văn Hải') + HANDOVER_TEXT.unsafe(1));
      expect((await owners('TD-U-KD4')).map((a) => a._id).sort()).toEqual(['K180', 'K181', 'K182']);
      expect((await owners('TD-U-KD5')).length).toBe(0);
      expect(await t.db.col(C.conversations).findOne({ _id: `${NK('05')}:${CUSTOMER(NK('05'))}` } as never)).toMatchObject({ assigneeId: 'TD-U-KD4' });
      expect(await t.db.col('channel_access').find({ channelId: NK('05'), level: 'giu_nick' } as never).toArray()).toMatchObject([{ principalId: 'TD-U-KD4' }]);
      expect(await t.db.col(C.accounts).findOne({ _id: NK('05') } as never)).toMatchObject({ unsafe: true, safety: 'chua_an_toan' });
      const rec = (await http().get('/api/admin/users/TD-U-KD5/handovers').set(as['TD-U-GS2']).expect(200)).body as { customers: number; channels: { phoneLogoutConfirmed: boolean }[] }[];
      expect(rec).toMatchObject([{ customers: 3, channels: [{ phoneLogoutConfirmed: false }] }]);
      // The audit and the record keep counts and ids, never message text or phone numbers.
      const audit = await t.db.col(C.auditLog).findOne({ action: 'user.handover' } as never);
      expect(JSON.stringify(audit)).not.toMatch(/Tin chờ|0900000005/);
      expect(await notices('TD-U-KD4')).toEqual(expect.arrayContaining(['Bạn nhận bàn giao 3 khách từ Đỗ Văn Toàn.']));
    });

    it('nobody sends through the unsafe nick, the new holder included; "Duyệt lại" is locked too', async () => {
      const conv = `${NK('05')}:${CUSTOMER(NK('05'))}`;
      const acc = (await http().get(`/api/conversations/${enc(conv)}/access`).set(as['TD-U-KD4']).expect(200)).body;
      expect(acc.canReply).toBe(false);
      expect(acc.replyReason).toMatch(/chưa an toàn/i);
      await http().post('/api/outbox').set(as['TD-U-KD4']).send({ uid: NK('05'), threadId: CUSTOMER(NK('05')), text: 'Em Hải nhận chăm anh ạ' }).expect(403);
      // The two commands of Toàn stay Cần duyệt lại (holder changed does not touch them) and cannot be re-approved yet.
      const held = (await http().get(`/api/outbox?uid=${NK('05')}&status=needs_reapproval`).set(as['TD-U-KD4']).expect(200)).body as OutboxItem[];
      expect(held.length).toBe(2);
      await http().post(`/api/outbox/${held[0]!.id}/reapprove`).set(as['TD-U-KD4']).expect(403);
    });

    it('a person with channel.safety_confirm confirms; sending and "Duyệt lại" open', async () => {
      await http().post(`/api/admin/channel-access/${NK('05')}/safety-confirm`).set(as['TD-U-KD7']).send({}).expect(403);
      const r = await http().post(`/api/admin/channel-access/${NK('05')}/safety-confirm`).set(as['TD-U-GD']).send({}).expect(200);
      expect(r.body.message).toBe(HANDOVER_TEXT.safeConfirmed('Toàn VCparts'));
      await http().post(`/api/admin/channel-access/${NK('05')}/safety-confirm`).set(as['TD-U-GD']).send({}).expect(409);
      expect(await t.db.col(C.accounts).findOne({ _id: NK('05') } as never)).toMatchObject({ unsafe: false, safety: 'an_toan', safetyConfirmedBy: 'TD-U-GD' });
      const rec = (await http().get('/api/admin/users/TD-U-KD5/handovers').set(as['TD-U-GS2']).expect(200)).body as { channels: { phoneLogoutConfirmed: boolean }[] }[];
      expect(rec[0]!.channels[0]!.phoneLogoutConfirmed).toBe(true);
      const held = (await http().get(`/api/outbox?uid=${NK('05')}&status=needs_reapproval`).set(as['TD-U-KD4']).expect(200)).body as OutboxItem[];
      const re = (await http().post(`/api/outbox/${held[0]!.id}/reapprove`).set(as['TD-U-KD4']).expect(200)).body as OutboxItem;
      expect(re).toMatchObject({ status: 'approved', approvedBy: 'TD-U-KD4' });
      await http().post(`/api/outbox/${held[1]!.id}/cancel`).set(as['TD-U-KD4']).send({}).expect(200);
      await http().post('/api/outbox').set(as['TD-U-KD4']).send({ uid: NK('05'), threadId: CUSTOMER(NK('05')), text: 'Em Hải nhận chăm anh ạ' }).expect(201);
    });

    it('after the handover the old person gets 403 on his old conversation (and 401 on the revoked session)', async () => {
      const conv = `${NK('05')}:${CUSTOMER(NK('05'))}`;
      await http().get(`/api/conversations/${enc(conv)}/access`).set(as['TD-U-KD5']).expect(401);
      // A session that somehow survived (created after the lock): the engine still refuses.
      const survivor = { Authorization: `Bearer ${await t.app.get(SessionService).create({ _id: 'TD-U-KD5', fullName: 'Đỗ Văn Toàn' })}` };
      await http().get(`/api/conversations/${enc(conv)}/access`).set(survivor).expect(403);
      await http().get(`/api/conversations/${enc(conv)}/messages`).set(survivor).expect(403);
      await http().post('/api/outbox').set(survivor).send({ uid: NK('05'), threadId: CUSTOMER(NK('05')), text: 'Toàn còn gửi được?' }).expect(403);
    });
  });

  describe('UAT-DK-67: Chia đều skips Vắng and Nghỉ phép', () => {
    it('six customers go to the only available receiver; the others are listed with the reason', async () => {
      await seedCustomers('TD-U-KD6', 'D67', 6);
      await t.db.col(C.users).updateOne({ _id: 'TD-U-KD2' } as never, { $set: { presence: { status: 'away' } } });
      const to = new Date(Date.now() + 2 * 24 * H);
      await t.db.col('access_grants').insertOne({ _id: 'leave_tu', userId: 'TD-U-KD1', type: 'truc_thay', targetType: 'channel', targetId: NK('05'), rights: ['xem'], from: new Date(Date.now() - H), to, reason: 'x', requestedBy: 'TD-U-GS1', approvedBy: 'TD-U-GS1', status: 'hieu_luc', absentUserId: 'TD-U-KD3' } as never);
      t.app.get(AuthzService).invalidate();
      await http().post('/api/admin/users/TD-U-KD6/offboard').set(as['TD-U-GD']).send({ reason: 'Nghỉ việc theo đơn' }).expect(200);
      const body = { mode: 'even', toUserIds: ['TD-U-KD1', 'TD-U-KD2', 'TD-U-KD3'] };
      const plan = (await http().post('/api/admin/users/TD-U-KD6/handover/preview').set(as['TD-U-GD']).send(body).expect(200)).body as HandoverPlanPreview;
      const dd = new Date(to.getTime() + 7 * H);
      const label = `Nghỉ phép tới ${String(dd.getUTCDate()).padStart(2, '0')}/${String(dd.getUTCMonth() + 1).padStart(2, '0')}`;
      expect(plan.rows).toMatchObject([{ userId: 'TD-U-KD1', customers: 6 }]);
      expect(plan.excluded).toEqual(expect.arrayContaining([
        { userId: 'TD-U-KD2', name: 'Trần Thùy Linh', reason: 'Vắng' },
        { userId: 'TD-U-KD3', name: 'Lê Văn Tú', reason: label },
      ]));
      expect(plan.total).toBe(6);
      // "Chia đều" between two available people splits 3 / 3; a hand pick still reaches an absent person.
      await t.db.col(C.users).updateOne({ _id: 'TD-U-KD2' } as never, { $unset: { presence: '' } });
      const even = (await http().post('/api/admin/users/TD-U-KD6/handover/preview').set(as['TD-U-GD']).send({ mode: 'even', toUserIds: ['TD-U-KD1', 'TD-U-KD2'] }).expect(200)).body as HandoverPlanPreview;
      expect(even.rows.map((r) => r.customers).sort()).toEqual([3, 3]);
      const picked = (await http().post('/api/admin/users/TD-U-KD6/handover/preview').set(as['TD-U-GD']).send({ mode: 'pick', toUserIds: [], picks: Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`D67${i}`, 'TD-U-KD3'])) }).expect(400)).body;
      expect(JSON.stringify(picked)).toContain('1 khách');
      const done = (await http().post('/api/admin/users/TD-U-KD6/handover').set(as['TD-U-GD']).send({ mode: 'region', toUserIds: ['TD-U-KD1', 'TD-U-KD2'] }).expect(200)).body as HandoverResult;
      expect(done).toMatchObject({ customersMoved: 6, nicksMoved: 0 });
      expect((await owners('TD-U-KD6')).length).toBe(0);
    });
  });

  describe('PQ-34 / PQ-51: reminders at 4 h and 20 h, fallback at 24 h, daily unsafe reminder', () => {
    it('reminds the supervisors at 4 h and 20 h once, and after 24 h sends customers to "Chưa phân công"', async () => {
      await seedCustomers('TD-U-KD7', 'K7', 2);
      await http().post('/api/admin/users/TD-U-KD7/offboard').set(as['TD-U-GD']).send({ reason: 'Nghỉ việc đột xuất' }).expect(200);
      const left = (await t.db.col(C.users).findOne({ _id: 'TD-U-KD7' } as never)) as unknown as { leftAt: Date };
      const svc = t.app.get(HandoverService);
      const run = (hours: number) => runAsTenant(DEFAULT_TENANT, () => svc.processDue(new Date(left.leftAt.getTime() + hours * H)));
      expect(await run(3)).toMatchObject({ reminded: 0, fallback: 0 });
      expect(await run(5)).toMatchObject({ reminded: 1 });
      expect(await run(6)).toMatchObject({ reminded: 0 });
      expect(await run(21)).toMatchObject({ reminded: 1, fallback: 0 });
      const remind = (await notices('TD-U-GS2')).filter((n) => n.includes('chưa bàn giao xong'));
      expect(remind.length).toBe(2);
      expect((await notices('TD-U-AD')).some((n) => n.includes('chưa bàn giao xong'))).toBe(true);
      expect((await owners('TD-U-KD7')).length).toBe(2);
      expect(await run(25)).toMatchObject({ fallback: 1 });
      expect((await owners('TD-U-KD7')).length).toBe(0);
      expect(await t.db.col('customer_accounts').countDocuments({ _id: { $in: ['K70', 'K71'] }, owners: { $size: 0 } } as never)).toBe(2);
      expect(await run(26)).toMatchObject({ fallback: 0 });
      expect((await notices('TD-U-GD')).some((n) => n.startsWith('Quá 24 giờ: 2 khách của Bùi Văn Bảy'))).toBe(true);
    });

    it('an unsafe nick reminds its people once a day from 08:30 (VN)', async () => {
      await t.db.col(C.accounts).updateOne({ _id: NK('05') } as never, { $set: { unsafe: true, safety: 'chua_an_toan' } });
      const svc = t.app.get(HandoverService);
      // Yesterday (VN): every probe lies in the past whatever the wall clock, so the reminders written now (stamped
      // with the real time) always count as "already sent since 08:30" of that day. With today's date the probes are
      // in the future before 08:30 VN and the 09:00 probe reminded again (test bug, not a reminder bug).
      const vn = new Date(Date.now() + 7 * H - 24 * H);
      const at = (h: number, m: number) => new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), h - 7, m));
      const count = (when: Date) => runAsTenant(DEFAULT_TENANT, () => svc.processDue(when)).then((r) => r.unsafeReminders);
      expect(await count(at(8, 0))).toBe(0);
      expect(await count(at(8, 31))).toBeGreaterThan(0);
      expect(await count(at(9, 0))).toBe(0);
      expect((await notices('TD-U-KD4')).some((n) => n.includes('chưa xác nhận đăng xuất khỏi điện thoại cũ'))).toBe(true);
    });
  });
});
