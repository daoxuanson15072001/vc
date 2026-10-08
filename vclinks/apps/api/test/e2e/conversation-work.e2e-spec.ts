import request from 'supertest';
import type { ConversationInboxFields, ConversationLabel, ConversationListItem, ConversationNote, ConversationPerson } from '@vclinks/shared';
import { SessionService } from '../../src/auth/session.service';
import { AuthzService } from '../../src/authz/authz.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

/*
 * Work on a conversation (00 MH-UI-08 / MH-UI-10, 01 §3.1): claim / assign / transfer / release of the handler on
 * an official channel, never on a personal nick with a holder (02 DK-21); internal notes with @mentions, edited by
 * the author within 15 minutes and seen only by people who see the conversation; VClinks labels.
 */
const NK = '9000000000001';
const OA = 'zoa_9000000000101';
const UNITS: [string, string, string, string | null][] = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-CS', 'Nhóm CSKH', 'nhom_cskh', 'TD-DV-VCP'],
];
const USERS: [string, string, string, string][] = [
  ['TD-U-GD', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-KD1', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-CS1', 'Lê Thu', 'cskh', 'TD-DV-CS'],
  ['TD-U-CS2', 'Phạm Hà', 'cskh', 'TD-DV-CS'],
];

type Item = ConversationListItem & ConversationInboxFields;

describe('conversation work: handler, internal notes, labels (e2e)', () => {
  let t: E2EApp;
  const http = () => request(t.app.getHttpServer());
  const as: Record<string, { Authorization: string }> = {};
  const saved = process.env.AUTHZ_DEFAULT_DIVISION;
  const path = (id: string, rest = '') => `/api/conversations/${encodeURIComponent(id)}${rest}`;
  const item = async (who: string, id: string, query = '?scope=all') =>
    ((await http().get(`/api/conversations${query}`).set(as[who]!).expect(200)).body.items as Item[]).find((i) => i.id === id);
  const noticesOf = async (userId: string) => t.db.col<{ title: string; kind: string; link?: string }>('notifications').find({ userId } as never).toArray();

  beforeAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = 'TD-DV-VCP';
    t = await startE2EApp();
    const now = new Date();
    await t.db.col('org_units').insertMany(
      UNITS.map(([id, name, type, parentId]) => ({
        _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : 'TD-DV-VCP', managerUserId: null, active: true, createdAt: now, updatedAt: now,
      })) as never,
    );
    await t.db.col(C.users).insertMany(USERS.map(([id, fullName]) => ({ _id: id, email: `${id.toLowerCase()}@vcprosperous.com`, fullName, status: 'hoat_dong' })) as never);
    await t.db.col('role_assignments').insertMany(
      USERS.map(([id, , role, unit]) => ({ _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now })) as never,
    );
    const sessions = t.app.get(SessionService);
    for (const [id, name] of USERS) as[id] = { Authorization: `Bearer ${await sessions.create({ _id: id, fullName: name })}` };

    // Personal nick held by Minh, one customer thread.
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: NK, label: 'Nick 01' }).expect(201);
    await t.db.col('channel_access').insertOne({ _id: `${NK}:user:TD-U-KD1:giu_nick`, channelId: NK, principalType: 'user', principalId: 'TD-U-KD1', level: 'giu_nick', createdBy: 'seed' } as never);
    await t.db.col(C.conversations).insertOne({ _id: `${NK}:K1`, uid: NK, threadId: 'K1', type: 'user', lastMsgAt: now, unread: 0 } as never);
    // Official account: the director and both CSKH send on it; sales do not see it.
    await t.db.col(C.accounts).insertOne({ _id: OA, label: 'VCparts OA', channel: 'zalo_oa' } as never);
    for (const u of ['TD-U-GD', 'TD-U-CS1', 'TD-U-CS2']) {
      await t.db.col('channel_access').insertOne({ _id: `${OA}:user:${u}:gui`, channelId: OA, principalType: 'user', principalId: u, level: 'gui', createdBy: 'seed' } as never);
    }
    for (const thread of ['O1', 'O2']) {
      await t.db.col(C.conversations).insertOne({ _id: `${OA}:${thread}`, uid: OA, threadId: thread, type: 'user', lastMsgAt: now, unread: 0 } as never);
    }
    t.app.get(AuthzService).invalidate();
  });
  afterAll(async () => {
    process.env.AUTHZ_DEFAULT_DIVISION = saved;
    await t?.close();
  });

  it('a personal nick with a holder: its holder handles it, no claim / assign / transfer', async () => {
    const k1 = await item('TD-U-GD', `${NK}:K1`);
    expect(k1).toMatchObject({ assignable: false, ownerId: 'TD-U-KD1' });
    const r = await http().post(path(`${NK}:K1`, '/assign')).set(as['TD-U-GD']!).send({ userId: 'TD-U-KD2' }).expect(409);
    expect(r.body.message).toMatch(/người giữ nick \(Nguyễn Văn Minh\)/);
    await http().post(path(`${NK}:K1`, '/claim')).set(as['TD-U-GD']!).expect(409);
  });

  it('Nhận: the first click wins; the conversation leaves "Chưa phân công" and shows an event line', async () => {
    expect(await item('TD-U-CS1', `${OA}:O1`, '?scope=unassigned')).toMatchObject({ assignable: true, assigneeId: null });
    await http().post(path(`${OA}:O1`, '/claim')).set(as['TD-U-CS1']!).expect(200);
    const lost = await http().post(path(`${OA}:O1`, '/claim')).set(as['TD-U-CS2']!).expect(409);
    expect(lost.body.message).toMatch(/vừa được Lê Thu nhận/);
    expect(await item('TD-U-CS1', `${OA}:O1`, '?scope=mine')).toMatchObject({ assigneeId: 'TD-U-CS1', ownerName: 'Lê Thu' });
    expect(await item('TD-U-CS2', `${OA}:O1`, '?scope=unassigned')).toBeUndefined();
    const notes = (await http().get(path(`${OA}:O1`, '/notes')).set(as['TD-U-CS2']!).expect(200)).body as ConversationNote[];
    expect(notes).toEqual([expect.objectContaining({ kind: 'event', authorName: 'Lê Thu', event: expect.objectContaining({ type: 'claim' }) })]);
    // Sales do not see the official account at all.
    expect([403, 404]).toContain((await http().post(path(`${OA}:O2`, '/claim')).set(as['TD-U-KD1']!)).status);
  });

  it('Phân công / Chuyển: only to someone who sees the conversation; a transfer needs a reason; notices; Trả về', async () => {
    const people = (await http().get(path(`${OA}:O2`, '/people')).set(as['TD-U-GD']!).expect(200)).body as ConversationPerson[];
    expect(people.map((p) => p.id).sort()).toEqual(['TD-U-CS1', 'TD-U-CS2', 'TD-U-GD']);
    const no = await http().post(path(`${OA}:O2`, '/assign')).set(as['TD-U-GD']!).send({ userId: 'TD-U-KD2' }).expect(400);
    expect(no.body.message).toMatch(/Trần Thùy Linh không xem được hội thoại này/);

    await http().post(path(`${OA}:O2`, '/assign')).set(as['TD-U-GD']!).send({ userId: 'TD-U-CS2', reason: 'Khách quen của Hà' }).expect(200);
    expect(await item('TD-U-CS2', `${OA}:O2`, '?scope=mine')).toMatchObject({ assigneeId: 'TD-U-CS2' });
    expect((await noticesOf('TD-U-CS2')).map((n) => [n.kind, n.title])).toContainEqual(['conversation.assigned', expect.stringMatching(/Trịnh Văn Thắng phân công cho bạn hội thoại .*Lý do: Khách quen của Hà/)]);

    await http().post(path(`${OA}:O2`, '/transfer')).set(as['TD-U-CS2']!).send({ userId: 'TD-U-CS1', reason: 'ngắn' }).expect(400);
    await http().post(path(`${OA}:O2`, '/transfer')).set(as['TD-U-CS2']!).send({ userId: 'TD-U-CS1', reason: 'Khách hỏi hàng hậu mãi, Thu đang theo' }).expect(200);
    expect(await item('TD-U-CS1', `${OA}:O2`, '?scope=mine')).toMatchObject({ assigneeId: 'TD-U-CS1' });
    expect((await noticesOf('TD-U-CS1')).some((n) => n.kind === 'conversation.assigned' && /Phạm Hà chuyển cho bạn/.test(n.title))).toBe(true);
    const lines = ((await http().get(path(`${OA}:O2`, '/notes')).set(as['TD-U-GD']!).expect(200)).body as ConversationNote[]).map((n) => [n.event?.type, n.event?.toName, n.event?.reason]);
    expect(lines).toEqual([
      ['assign', 'Phạm Hà', 'Khách quen của Hà'],
      ['transfer', 'Lê Thu', 'Khách hỏi hàng hậu mãi, Thu đang theo'],
    ]);

    await http().post(path(`${OA}:O2`, '/release')).set(as['TD-U-CS1']!).expect(200);
    expect(await item('TD-U-GD', `${OA}:O2`, '?scope=unassigned')).toMatchObject({ assigneeId: null });
    await http().post(path(`${OA}:O2`, '/release')).set(as['TD-U-CS1']!).expect(409);
    expect(await t.db.col(C.auditLog).countDocuments({ action: { $in: ['conversation.claim', 'conversation.assign', 'conversation.transfer', 'conversation.release'] } } as never)).toBe(4);
  });

  it('notes: never sent, @mention only people who see it, author edits within 15 minutes', async () => {
    const outboxBefore = await t.db.col(C.suggestions).countDocuments({});
    const note = (await http()
      .post(path(`${OA}:O1`, '/notes'))
      .set(as['TD-U-CS1']!)
      .send({ text: 'Khách hẹn chiều mai lấy hàng @Phạm Hà @Trần Thùy Linh', mentions: ['TD-U-CS2', 'TD-U-KD2'] })
      .expect(201)).body as ConversationNote;
    expect(note).toMatchObject({ kind: 'note', authorName: 'Lê Thu', canEdit: true, mentions: [{ id: 'TD-U-CS2', name: 'Phạm Hà' }] });
    expect(await t.db.col(C.suggestions).countDocuments({})).toBe(outboxBefore);
    const mention = (await noticesOf('TD-U-CS2')).find((n) => n.kind === 'note.mention')!;
    expect(mention.title).toMatch(/Lê Thu nhắc bạn trong ghi chú nội bộ ở hội thoại/);
    expect(mention.title).not.toContain('lấy hàng');
    expect(mention.link).toBe(`/conversations/${encodeURIComponent(`${OA}:O1`)}?note=${note.id}`);
    expect((await noticesOf('TD-U-KD2')).some((n) => n.kind === 'note.mention')).toBe(false);

    // Someone else's note, or too late: refused.
    await http().patch(path(`${OA}:O1`, `/notes/${note.id}`)).set(as['TD-U-CS2']!).send({ text: 'sửa hộ' }).expect(403);
    const edited = (await http().patch(path(`${OA}:O1`, `/notes/${note.id}`)).set(as['TD-U-CS1']!).send({ text: 'Khách hẹn sáng mai' }).expect(200)).body as ConversationNote;
    expect(edited).toMatchObject({ text: 'Khách hẹn sáng mai', editedAt: expect.any(String) });
    await t.db.col('conversation_notes').updateOne({ _id: note.id } as never, { $set: { createdAt: new Date(Date.now() - 16 * 60_000) } });
    await http().delete(path(`${OA}:O1`, `/notes/${note.id}`)).set(as['TD-U-CS1']!).expect(403);
    const fresh = (await http().post(path(`${OA}:O1`, '/notes')).set(as['TD-U-CS1']!).send({ text: 'ghi nhầm' }).expect(201)).body as ConversationNote;
    await http().delete(path(`${OA}:O1`, `/notes/${fresh.id}`)).set(as['TD-U-CS1']!).expect(200);
    const left = ((await http().get(path(`${OA}:O1`, '/notes')).set(as['TD-U-GD']!).expect(200)).body as ConversationNote[]).filter((n) => n.kind === 'note');
    expect(left.map((n) => n.id)).toEqual([note.id]);
    expect(left[0]!.canEdit).toBe(false);

    // People outside the channel never read the notes.
    expect([403, 404]).toContain((await http().get(path(`${OA}:O1`, '/notes')).set(as['TD-U-KD2']!)).status);
    // The nick holder notes on his own conversation; the director reads it.
    await http().post(path(`${NK}:K1`, '/notes')).set(as['TD-U-KD1']!).send({ text: 'Khách ưu tiên' }).expect(201);
    expect(((await http().get(path(`${NK}:K1`, '/notes')).set(as['TD-U-GD']!).expect(200)).body as ConversationNote[]).map((n) => n.text)).toEqual(['Khách ưu tiên']);
  });

  it('VClinks labels: one name once, up to 5 per conversation, list filter, deleting takes it off', async () => {
    const vip = (await http().post('/api/conversation-labels').set(as['TD-U-CS1']!).send({ name: 'VIP', color: 'gold' }).expect(201)).body as ConversationLabel;
    const again = (await http().post('/api/conversation-labels').set(as['TD-U-CS2']!).send({ name: 'vip', color: 'red' }).expect(201)).body as ConversationLabel;
    expect(again.id).toBe(vip.id);
    await http().put(path(`${OA}:O1`, '/labels')).set(as['TD-U-CS1']!).send({ labelIds: [vip.id] }).expect(200);
    expect((await item('TD-U-GD', `${OA}:O1`))?.vcLabels).toEqual([{ id: vip.id, name: 'VIP', color: 'gold' }]);
    const filtered = (await http().get(`/api/conversations?scope=all&vcLabelId=${vip.id}`).set(as['TD-U-GD']!).expect(200)).body.items as Item[];
    expect(filtered.map((i) => i.id)).toEqual([`${OA}:O1`]);
    await http().put(path(`${OA}:O1`, '/labels')).set(as['TD-U-CS1']!).send({ labelIds: ['a', 'b', 'c', 'd', 'e', 'f'] }).expect(400);
    await http().put(path(`${OA}:O1`, '/labels')).set(as['TD-U-CS1']!).send({ labelIds: ['lb_khong_co'] }).expect(400);
    // Sales cannot label a conversation they do not see.
    expect([403, 404]).toContain((await http().put(path(`${OA}:O1`, '/labels')).set(as['TD-U-KD1']!).send({ labelIds: [] })).status);

    await http().delete(`/api/conversation-labels/${vip.id}`).set(as['TD-U-GD']!).expect(200);
    expect((await item('TD-U-GD', `${OA}:O1`))?.vcLabels).toEqual([]);
    expect((await http().get('/api/conversation-labels').set(as['TD-U-CS1']!).expect(200)).body).toEqual([]);
  });
});
