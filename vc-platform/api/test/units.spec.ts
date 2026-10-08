import type { NestExpressApplication } from '@nestjs/platform-express';
import { ObjectId, type Db } from 'mongodb';
import request from 'supertest';
import { z } from 'zod';
import { createApp } from '../src/app.factory';
import { ChangeHandlers } from '../src/common/changes';
import { FakeClock } from '../src/common/clock';
import { C } from '../src/db/collections';
import { DB } from '../src/db/mongo';
import { HeadReports } from '../src/org/units/head-reports';
import type { OrgUnitDoc } from '../src/org/units/types';
import { ChangeService } from '../src/people/changes/change.service';
import { startIssuer, userClaims, type FakeIssuer } from './util/issuer';
import { quietLog, testEnv } from './util/mongo';

let app: NestExpressApplication;
let issuer: FakeIssuer;
let db: Db;
const clock = new FakeClock(new Date('2026-11-20T08:10:00Z')); // 15:10 20/11 Vietnam

const HC = ['hcns'];
const HC_VCP = ['hcns@VCPARTS'];
const QT = ['qtht'];
const tokens = new Map<string, string>();
async function signAll(...groups: string[][]) {
  const iat = Math.floor(clock.now().getTime() / 1000);
  for (const who of groups) tokens.set(who.join(','), await issuer.token(userClaims(`u-${who.join('-')}`, who), { iat, exp: iat + 40 * 86_400 }));
}
function call(method: 'get' | 'post' | 'patch' | 'delete', path: string, who: string[], body?: unknown) {
  const r = request(app.getHttpServer())[method](`/api/v1/admin/${path}`).set('Authorization', `Bearer ${tokens.get(who.join(','))}`);
  return body === undefined ? r : r.send(body as object);
}
const get = (path: string, who = HC) => call('get', `org-units${path}`, who);
const post = (path: string, body: unknown, who = HC) => call('post', `org-units${path}`, who, body);
const patch = (path: string, body: unknown, who = HC) => call('patch', `org-units${path}`, who, body);
const unit = (code: string) => db.collection<OrgUnitDoc>(C.orgUnits).findOne({ _id: code });
const rev = async (code: string) => (await unit(code))!.rev;
const create = (code: string, name: string, type: string, parent: string, extra: Record<string, unknown> = {}, who = HC) => post('', { code, name, type, parent_code: parent, ...extra }, who);

async function person(name: string, status = 'dang_lam'): Promise<ObjectId> {
  const _id = new ObjectId();
  await db.collection(C.people).insertOne({ _id, full_name: name, employee_code: name, status, legal_entity_code: 'VCPARTS', head_of_unit_codes: [] });
  return _id;
}
const position = (person_id: ObjectId, unit_code: string, extra: Record<string, unknown> = {}) =>
  db.collection(C.positions).insertOne({ person_id, unit_code, kind: 'chinh', start_on: '2026-01-01', end_on: null, active: true, ...extra });

let A: ObjectId; // head of Phòng Kinh doanh
let B: ObjectId;
let yen: ObjectId;

beforeAll(async () => {
  issuer = await startIssuer();
  app = await createApp({ env: testEnv({ OIDC_ISSUER: issuer.url }), clock, log: quietLog });
  await app.init();
  db = app.get(DB);
  await signAll(HC, HC_VCP, QT);
  for (const [code, tax] of [['VCPARTS', '0101234567'], ['VCSERVICE', '0101234568']]) {
    await call('post', 'catalogs/legal-entities', HC, { code, name: `Công ty ${code}`, short_name: code, tax_code: tax, hq_address: 'Hà Nội' }).expect(201);
  }
});
afterAll(async () => {
  await app.close();
  await issuer.close();
});

describe('Cây đơn vị (VH-ORG-01)', () => {
  test('Migration tạo sẵn đơn vị gốc loại Tập đoàn', async () => {
    const r = await get('').expect(200);
    expect(r.body.root_code).toBe('VCPV');
    expect(r.body.items).toEqual([expect.objectContaining({ code: 'VCPV', name: 'Tập đoàn VC Phồn Vinh', type: 'tap_doan', parent_code: null, depth: 1, status: 'hoat_dong' })]);
  });

  test('Thêm đơn vị: pháp nhân chọn khi nằm thẳng dưới Tập đoàn, tự lấy theo cha ở dưới; ancestors, division tự tính', async () => {
    expect((await create('VCPARTS', 'VCparts', 'division', 'VCPV').expect(422)).body.message).toBe('Chọn pháp nhân cho đơn vị nằm thẳng dưới Tập đoàn.');
    const r = await create('VCPARTS', 'VCparts', 'division', 'VCPV', { legal_entity_code: 'VCPARTS' }).expect(201);
    expect(r.body.change).toMatchObject({ status: 'da_ap', message: 'Đã lưu, có hiệu lực từ 20/11/2026.' });
    expect(r.body.unit).toMatchObject({ code: 'VCPARTS', ancestors: ['VCPV'], division_code: 'VCPARTS', legal_entity_code: 'VCPARTS', effective_from_on: '2026-11-20', depth: 2 });
    await create('VCSERVICE', 'VCservice', 'division', 'VCPV', { legal_entity_code: 'VCSERVICE' }).expect(201);
    await create('VCPARTS-KD', 'Phòng Kinh doanh', 'phong', 'VCPARTS').expect(201);
    expect((await create('X1', 'Tổ X', 'to_nhom', 'VCPARTS-KD', { legal_entity_code: 'VCSERVICE' }).expect(422)).body.message).toBe('Pháp nhân của đơn vị này tự lấy theo đơn vị cha.');
    const hn1 = await create('VCPARTS-KD-HN1', 'Tổ KD Hà Nội 1', 'to_nhom', 'VCPARTS-KD', { short_name: 'Tổ HN1', function_code: 'ban_hang' }).expect(201);
    expect(hn1.body.unit).toMatchObject({ ancestors: ['VCPV', 'VCPARTS', 'VCPARTS-KD'], division_code: 'VCPARTS', legal_entity_code: 'VCPARTS', function_code: 'ban_hang', depth: 4 });
    await create('VCPARTS-KD-HN2', 'Tổ KD Hà Nội 2', 'to_nhom', 'VCPARTS-KD').expect(201);
    await create('VCSERVICE-DVKH', 'Phòng Dịch vụ khách hàng', 'phong', 'VCSERVICE').expect(201);
    const rows = await db.collection(C.auditLog).find({ action: 'org_unit.create' }).toArray();
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ effective_on: '2026-11-20', target: { type: 'org_unit', id: 'VCPARTS' }, source: { type: 'man_hinh' } });
  });

  test('Luật đặt cha theo loại; Tổ / Nhóm lồng một cấp; mã, tên trùng — đúng câu 04', async () => {
    expect((await create('VCPARTS-X', 'Division lạc', 'division', 'VCPARTS-KD').expect(422)).body.message).toBe('Division chỉ đặt dưới Tập đoàn, Pháp nhân.');
    expect((await create('VCPARTS-Y', 'Phòng lạc', 'phong', 'VCPARTS-KD-HN1').expect(422)).body.message).toBe('Khối / Phòng chỉ đặt dưới Tập đoàn, Pháp nhân, Division, Khối / Phòng.');
    expect((await create('VCPV2', 'Tập đoàn 2', 'tap_doan', 'VCPV').expect(422)).body.message).toBe('Chỉ có một đơn vị gốc loại Tập đoàn.');
    // A Tổ may hold Tổ one level deep (02 VH-BR-06, like VClinks); a second level is refused.
    await create('VCPARTS-KD-HN1-A', 'Nhóm HN1 A', 'to_nhom', 'VCPARTS-KD-HN1').expect(201);
    expect((await create('VCPARTS-KD-HN1-A1', 'Nhóm lồng hai cấp', 'to_nhom', 'VCPARTS-KD-HN1-A').expect(422)).body.message).toBe('Tổ / Nhóm chỉ chứa được Tổ / Nhóm con một cấp.');
    expect((await create('vcp kd', 'Tên', 'phong', 'VCPARTS').expect(400)).body.message).toBe('Mã đơn vị gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới.');
    expect((await create('VCPARTS-KD', 'Tên khác', 'phong', 'VCPARTS').expect(422)).body.message).toBe('Mã VCPARTS-KD đã dùng cho đơn vị Phòng Kinh doanh (Hoạt động). Mã không được dùng lại.');
    expect((await create('VCPARTS-KD2', 'phòng  kinh DOANH', 'phong', 'VCPARTS').expect(422)).body.message).toBe('Tên Phòng Kinh doanh đã có trong cùng đơn vị cha.');
    expect((await create('VCPARTS-Z', 'Tên', 'phong', 'KHONGCO').expect(422)).body.message).toBe('Đơn vị KHONGCO không có.');
  });

  test('Tiêu chí 2: chuyển Division vào đơn vị nằm dưới chính nó bị chặn vì tạo vòng', async () => {
    const r = await post('/VCPARTS/move', { parent_code: 'VCPARTS-KD-HN1', rev: await rev('VCPARTS') }).expect(422);
    expect(r.body.message).toBe('Không chuyển được: Tổ KD Hà Nội 1 đang nằm dưới VCparts. Chuyển thế này sẽ tạo vòng.');
    expect(await post('/VCPV/move', { parent_code: 'VCPARTS', rev: 1 }).expect(422).then((x) => x.body.message)).toBe('Đơn vị gốc không chuyển, ngừng hay xoá được.');
  });

  test('Chuyển cha: tính lại ancestors, division, pháp nhân cho cả nhánh trong một giao dịch', async () => {
    const r = await post('/VCPARTS-KD/move', { parent_code: 'VCSERVICE', rev: await rev('VCPARTS-KD'), reason: 'QĐ 15/2026' }).expect(200);
    expect(r.body.change).toMatchObject({ status: 'da_ap' });
    expect(await unit('VCPARTS-KD-HN1-A')).toMatchObject({ ancestors: ['VCPV', 'VCSERVICE', 'VCPARTS-KD', 'VCPARTS-KD-HN1'], division_code: 'VCSERVICE', legal_entity_code: 'VCSERVICE' });
    const row = await db.collection(C.auditLog).findOne({ action: 'org_unit.move', 'target.id': 'VCPARTS-KD' });
    expect(row).toMatchObject({ before: { parent_code: 'VCPARTS', division_code: 'VCPARTS' }, after: { parent_code: 'VCSERVICE', division_code: 'VCSERVICE', branch_updated: 4 }, reason: 'QĐ 15/2026' });
    await post('/VCPARTS-KD/move', { parent_code: 'VCPARTS', rev: await rev('VCPARTS-KD') }).expect(200);
    expect(await unit('VCPARTS-KD-HN1')).toMatchObject({ ancestors: ['VCPV', 'VCPARTS', 'VCPARTS-KD'], division_code: 'VCPARTS', legal_entity_code: 'VCPARTS' });
    // Stale rev: 409.
    await post('/VCPARTS-KD/move', { parent_code: 'VCSERVICE', rev: 1 }).expect(409);
  });

  test('Cây sâu tối đa 8 cấp, cả khi thêm và khi chuyển cả nhánh', async () => {
    // VCPV 1 › VCPARTS 2 › KD 3 › P4 › P5 › P6 › P7 › T8
    let parent = 'VCPARTS-KD';
    for (const n of [4, 5, 6, 7]) {
      await create(`P${n}`, `Phòng cấp ${n}`, 'phong', parent).expect(201);
      parent = `P${n}`;
    }
    await create('T8', 'Tổ cấp 8', 'to_nhom', 'P7').expect(201);
    expect((await create('T9', 'Tổ cấp 9', 'to_nhom', 'T8').expect(422)).body.message).toBe('Cây đơn vị sâu tối đa 8 cấp.');
    // P5 (with 3 levels below) under HN1-A's sibling level would reach 9.
    await create('P3B', 'Phòng nhánh', 'phong', 'P4').expect(201);
    await create('P3C', 'Phòng nhánh 2', 'phong', 'P3B').expect(201);
    expect((await post('/P5/move', { parent_code: 'P3C', rev: await rev('P5') }).expect(422)).body.message).toBe('Cây đơn vị sâu tối đa 8 cấp.');
  });

  test('Tìm không dấu ra đúng nhánh (tiêu chí 4); đơn vị ngừng vẫn trong danh sách với trạng thái (tiêu chí 5)', async () => {
    const r = await get('?q=to kd ha noi 1').expect(200);
    const items = [...r.body.items].sort((a: { depth: number }, b: { depth: number }) => a.depth - b.depth);
    expect(items.map((i: { code: string; matched: boolean }) => `${i.code}${i.matched ? '*' : ''}`)).toEqual(['VCPV', 'VCPARTS', 'VCPARTS-KD', 'VCPARTS-KD-HN1*']);
  });
});

describe('Ngừng, xoá (VH-ORG-01 bước 5, 6)', () => {
  test('Tiêu chí 3: ngừng đơn vị còn 2 người bị chặn, câu nêu đúng số; chuyển hết người thì ngừng được, không còn trong ô chọn', async () => {
    const p1 = await person('Người 1');
    const p2 = await person('Người 2');
    await position(p1, 'VCPARTS-KD-HN2');
    await position(p2, 'VCPARTS-KD-HN2', { kind: 'kiem_nhiem' });
    const r = await post('/VCPARTS-KD-HN2/deactivate', { rev: await rev('VCPARTS-KD-HN2') }).expect(422);
    expect(r.body.message).toBe('Đơn vị còn 2 vị trí đang hiệu lực và 0 đơn vị con đang hoạt động. Chuyển hết người và đơn vị con trước khi ngừng.');
    expect((await post('/VCPARTS-KD/deactivate', { rev: await rev('VCPARTS-KD') }).expect(422)).body.message).toBe(
      'Đơn vị còn 0 vị trí đang hiệu lực và 3 đơn vị con đang hoạt động. Chuyển hết người và đơn vị con trước khi ngừng.',
    );
    await db.collection(C.positions).updateMany({ unit_code: 'VCPARTS-KD-HN2' }, { $set: { active: false, end_on: '2026-11-19' } });
    const ok = await post('/VCPARTS-KD-HN2/deactivate', { rev: await rev('VCPARTS-KD-HN2'), reason: 'Gộp vào HN1' }).expect(200);
    // Made and stopped the same day: its last day is that day.
    expect(ok.body).toMatchObject({ status: 'ngung', effective_to_on: '2026-11-20' });
    const active = (await get('?status=hoat_dong')).body.items.map((i: { code: string }) => i.code);
    expect(active).not.toContain('VCPARTS-KD-HN2');
    expect((await get('')).body.items.find((i: { code: string }) => i.code === 'VCPARTS-KD-HN2').status).toBe('ngung');
    expect((await create('HN2-CON', 'Tổ con', 'to_nhom', 'VCPARTS-KD-HN2').expect(422)).body.message).toBe('Đơn vị cha Tổ KD Hà Nội 2 đã ngừng, không thêm hoặc chuyển đơn vị vào được.');
  });

  test('Xoá mềm đơn vị tạo nhầm; đã từng có vị trí hoặc còn con thì không; mã không dùng lại', async () => {
    await create('NHAM', 'Đơn vị tạo nhầm', 'phong', 'VCPARTS').expect(201);
    expect((await call('delete', `org-units/NHAM?rev=1`, HC).expect(200)).body).toEqual({ code: 'NHAM', deleted: true });
    await get('/NHAM').expect(404);
    expect((await get('')).body.items.map((i: { code: string }) => i.code)).not.toContain('NHAM');
    expect((await create('NHAM', 'Tạo lại', 'phong', 'VCPARTS').expect(422)).body.message).toBe('Mã NHAM đã dùng cho đơn vị Đơn vị tạo nhầm (Đã xoá). Mã không được dùng lại.');
    expect((await call('delete', `org-units/VCPARTS-KD-HN2?rev=${await rev('VCPARTS-KD-HN2')}`, HC).expect(422)).body.message).toBe('Đơn vị đã từng có vị trí, không xoá được. Hãy chuyển sang Ngừng.');
    expect((await call('delete', `org-units/P7?rev=${await rev('P7')}`, HC).expect(422)).body.message).toBe('Đơn vị còn 1 đơn vị con. Chuyển hoặc xoá đơn vị con trước.');
    expect((await call('delete', 'org-units/VCPV?rev=1', HC).expect(422)).body.message).toBe('Đơn vị gốc không chuyển, ngừng hay xoá được.');
    expect(await db.collection(C.auditLog).countDocuments({ action: 'org_unit.delete', 'target.id': 'NHAM' })).toBe(1);
  });
});

describe('Sửa đơn vị', () => {
  test('Tên, tên ngắn, email nhóm, thứ tự áp ngay; mã và cha không sửa ở đây; loại chỉ đổi khi chưa từng có vị trí', async () => {
    const r = await patch('/VCPARTS-KD-HN1', { name: 'Tổ KD Hà Nội 1', short_name: 'HN1', group_email: 'to-hn1@vcpart.vn', rev: await rev('VCPARTS-KD-HN1') }).expect(200);
    expect(r.body).toMatchObject({ short_name: 'HN1', group_email: 'to-hn1@vcpart.vn' });
    expect((await patch('/VCPARTS-KD-HN1', { group_email: 'to@gmail.com', rev: r.body.rev }).expect(400)).body.message).toBe('Email nhóm phải thuộc vcprosperous.com hoặc vcpart.vn.');
    expect((await patch('/VCPARTS-KD-HN1', { code: 'HN1', rev: r.body.rev }).expect(422)).body.message).toBe('Mã không đổi được sau khi tạo.');
    expect((await patch('/VCPARTS-KD-HN1', { parent_code: 'VCSERVICE', rev: r.body.rev }).expect(422)).body.message).toBe('Đổi đơn vị cha bằng thao tác "Chuyển".');
    expect((await patch('/VCPARTS-KD-HN2', { type: 'phong', rev: await rev('VCPARTS-KD-HN2') }).expect(422)).body.message).toBe('Loại đơn vị không đổi được khi đơn vị đã từng có vị trí.');
    const t = await patch('/P3C', { type: 'to_nhom', rev: await rev('P3C') }).expect(200);
    expect(t.body.type).toBe('to_nhom');
    expect((await db.collection(C.auditLog).findOne({ action: 'org_unit.update', 'target.id': 'VCPARTS-KD-HN1' }))!.before).toEqual({ short_name: 'Tổ HN1', group_email: null });
  });
});

describe('Trưởng đơn vị (VH-ORG-04)', () => {
  beforeAll(async () => {
    A = await person('Nguyễn Văn A');
    B = await person('Trần Thị B');
    yen = await person('Lê Thị Yến');
    await position(A, 'VCPARTS-KD');
    await position(B, 'VCPARTS-KD-HN1');
    await position(yen, 'VCSERVICE-DVKH');
  });

  test('Tiêu chí 1: người không có vị trí trong đơn vị hay đơn vị cha trực tiếp bị chặn đúng câu', async () => {
    const r = await post('/VCPARTS-KD-HN1/head', { person_id: String(yen) }).expect(422);
    expect(r.body.message).toBe('Người được chọn chưa có vị trí trong Tổ KD Hà Nội 1 hoặc đơn vị cha trực tiếp. Thêm vị trí (chính hoặc kiêm nhiệm) trước.');
    const gone = await person('Đã nghỉ', 'da_nghi');
    await position(gone, 'VCPARTS-KD', { active: false });
    expect((await post('/VCPARTS-KD/head', { person_id: String(gone) }).expect(422)).body.message).toBe('Chỉ chọn được nhân viên đang làm.');
    expect((await post('/VCPARTS-KD-HN2/head', { person_id: String(A) }).expect(422)).body.message).toBe('Đơn vị đã ngừng, không đặt trưởng được.');
  });

  test('Đặt trưởng hôm nay: áp ngay, có lịch sử, people.head_of_unit_codes; người ở đơn vị cha trực tiếp cũng hợp lệ', async () => {
    const r = await post('/VCPARTS-KD/head', { person_id: String(A) }).expect(200);
    expect(r.body.change).toMatchObject({ status: 'da_ap' });
    expect(await unit('VCPARTS-KD')).toMatchObject({ head_person_id: A, head_history: [{ person_id: A, from_on: '2026-11-20', to_on: null }] });
    expect((await db.collection(C.people).findOne({ _id: A }))!.head_of_unit_codes).toEqual(['VCPARTS-KD']);
    // A (position in KD) may head HN1, the unit right under KD; one person may head several units.
    await post('/VCPARTS-KD-HN1/head', { person_id: String(A) }).expect(200);
    expect((await db.collection(C.people).findOne({ _id: A }))!.head_of_unit_codes).toEqual(['VCPARTS-KD', 'VCPARTS-KD-HN1']);
    const d = await get('/VCPARTS-KD').expect(200);
    expect(d.body).toMatchObject({ head: { person_id: String(A), name: 'Nguyễn Văn A' }, path: [{ code: 'VCPV' }, { code: 'VCPARTS' }, { code: 'VCPARTS-KD', name: 'Phòng Kinh doanh' }] });
  });

  test('Mỗi đơn vị một trưởng: đặt người thứ hai mà không chọn "Thay trưởng" bị chặn (VH-UAT-27 bước 4)', async () => {
    await position(B, 'VCPARTS-KD', { kind: 'kiem_nhiem' });
    const r = await post('/VCPARTS-KD/head', { person_id: String(B), effective_on: '2026-12-01' }).expect(422);
    expect(r.body.message).toBe('Phòng Kinh doanh đã có trưởng Nguyễn Văn A. Mỗi đơn vị chỉ có một trưởng. Chọn "Thay trưởng" để Nguyễn Văn A thôi từ ngày 30/11/2026.');
    expect((await post('/VCPARTS-KD/head', { person_id: String(A), replace_current: true }).expect(422)).body.message).toBe('Nguyễn Văn A đang là trưởng Phòng Kinh doanh.');
  });

  test('Thay trưởng hiệu lực 01/12: lúc 00:00 B là trưởng, A thôi từ 30/11; câu hỏi cập nhật quản lý có số người', async () => {
    for (let i = 0; i < 8; i++) await position(await person(`NV ${i}`), 'VCPARTS-KD', { manager_person_id: A });
    expect((await get('/VCPARTS-KD/head/preview').expect(200)).body).toEqual({ current_head: { person_id: String(A), name: 'Nguyễn Văn A' }, reports_count: 8, update_reports_available: false });
    const r = await post('/VCPARTS-KD/head', { person_id: String(B), effective_on: '2026-12-01', replace_current: true, reason: 'QĐ bổ nhiệm 20/2026' }).expect(200);
    expect(r.body.change).toMatchObject({ status: 'cho_ap', message: 'Đã hẹn áp lúc 00:00 ngày 01/12/2026.' });
    expect((await unit('VCPARTS-KD'))!.head_person_id).toEqual(A);
    clock.set(new Date('2026-11-30T17:00:20Z'));
    expect(await app.get(ChangeService).applyDue('c-head')).toMatchObject({ applied: 1, failed: 0 });
    clock.set(new Date('2026-11-20T08:10:00Z'));
    expect(await unit('VCPARTS-KD')).toMatchObject({
      head_person_id: B,
      head_history: [
        { person_id: A, from_on: '2026-11-20', to_on: '2026-11-30' },
        { person_id: B, from_on: '2026-12-01', to_on: null },
      ],
    });
    expect((await db.collection(C.people).findOne({ _id: A }))!.head_of_unit_codes).toEqual(['VCPARTS-KD-HN1']);
    expect((await db.collection(C.people).findOne({ _id: B }))!.head_of_unit_codes).toEqual(['VCPARTS-KD']);
    expect(await db.collection(C.auditLog).findOne({ action: 'org_unit.head_set', 'target.id': 'VCPARTS-KD', 'after.head_person_id': String(B) })).toMatchObject({
      effective_on: '2026-12-01',
      reason: 'QĐ bổ nhiệm 20/2026',
      actor: { type: 'he_thong' },
    });
  });

  test('Giao kèo "cập nhật quản lý": bên cung cấp (B-07) thêm dòng vào cùng nhóm với trưởng mới', async () => {
    app.get(ChangeHandlers).register({
      kind: 'thu_doi_quan_ly',
      category: 'nguoi',
      permission: 'nhan_su.sua',
      schema: z.object({ manager: z.string() }),
      conflictKeys: (it) => [`position:${it.target.id}:manager`],
      describe: () => 'đổi quản lý',
      validate: async () => {},
      affectedPeople: async () => [],
      apply: async () => {},
    });
    app.get(HeadReports).register({
      items: async (db2, session, code, oldHead, newHead) => {
        const reports = await db2.collection(C.positions).find({ unit_code: code, manager_person_id: oldHead, active: true }, { session }).toArray();
        return reports.map((p) => ({ kind: 'thu_doi_quan_ly', target: { type: 'position' as const, id: String(p._id) }, payload: { manager: String(newHead) } }));
      },
    });
    await position(A, 'VCPARTS-KD', { kind: 'kiem_nhiem' });
    await position(await person('Báo cáo B'), 'VCPARTS-KD', { manager_person_id: B });
    const r = await post('/VCPARTS-KD/head', { person_id: String(A), replace_current: true, effective_on: '2026-12-15' }).expect(200);
    const docs = await db.collection(C.scheduledChanges).find({ group_id: new ObjectId(r.body.change.group_id) }).sort({ seq: 1 }).toArray();
    expect(docs.map((d) => d.kind)).toEqual(['unit_head', 'thu_doi_quan_ly']);
    await call('post', `scheduled-changes/${r.body.change.group_id}/cancel`, HC, { reason: 'Thử xong' }).expect(200);
  });

  test('Bỏ trưởng (person_id null): đơn vị "Chưa có trưởng"', async () => {
    await post('/VCPARTS-KD-HN1/head', { person_id: null }).expect(200);
    expect((await unit('VCPARTS-KD-HN1'))!.head_person_id).toBeNull();
    expect((await get('')).body.items.find((i: { code: string }) => i.code === 'VCPARTS-KD-HN1')).toMatchObject({ head_person_id: null, head_name: null });
  });
});

describe('VH-BR-25 và phạm vi HC-NS', () => {
  test('Chuyển nhánh có ≥ 21 người: chờ quản trị hệ thống thứ hai xác nhận, chưa đổi gì', async () => {
    await create('VCPARTS-KHO', 'Phòng Kho', 'phong', 'VCPARTS').expect(201);
    await create('VCPARTS-KHO-1', 'Tổ kho 1', 'to_nhom', 'VCPARTS-KHO').expect(201);
    for (let i = 0; i < 21; i++) await position(await person(`Kho ${i}`), i % 2 ? 'VCPARTS-KHO' : 'VCPARTS-KHO-1');
    const r = await post('/VCPARTS-KHO/move', { parent_code: 'VCSERVICE', rev: await rev('VCPARTS-KHO') }).expect(200);
    expect(r.body.change).toMatchObject({ status: 'cho_xac_nhan', affected_people: 21 });
    expect((await unit('VCPARTS-KHO-1'))!.division_code).toBe('VCPARTS');
    await call('post', `scheduled-changes/${r.body.change.group_id}/confirm`, QT).expect(200);
    expect(await unit('VCPARTS-KHO-1')).toMatchObject({ division_code: 'VCSERVICE', legal_entity_code: 'VCSERVICE' });
  });

  test('HC-NS một pháp nhân chỉ sửa đơn vị trong phạm vi', async () => {
    await patch('/VCPARTS-KD', { description: 'Kinh doanh phía Bắc', rev: await rev('VCPARTS-KD') }, HC_VCP).expect(200);
    expect((await patch('/VCSERVICE-DVKH', { description: 'x', rev: await rev('VCSERVICE-DVKH') }, HC_VCP).expect(403)).body.message).toBe('Đơn vị nằm ngoài phạm vi HC-NS của bạn.');
    await create('VCS-MOI', 'Phòng mới', 'phong', 'VCSERVICE', {}, HC_VCP).expect(403);
    await post('/VCPARTS-KD/move', { parent_code: 'VCSERVICE', rev: await rev('VCPARTS-KD') }, HC_VCP).expect(403);
    const list = (await get('', HC_VCP)).body.items;
    expect(list.find((i: { code: string }) => i.code === 'VCPARTS-KD').can_edit).toBe(true);
    expect(list.find((i: { code: string }) => i.code === 'VCSERVICE').can_edit).toBe(false);
    await get('', QT).expect(403);
    // Re-pointing an in-scope unit to another legal entity is outside the scope.
    await create('VCPARTS-RIENG', 'Khối riêng', 'phong', 'VCPV', { legal_entity_code: 'VCPARTS' }, HC_VCP).expect(201);
    expect((await patch('/VCPARTS-RIENG', { legal_entity_code: 'VCSERVICE', rev: 1 }, HC_VCP).expect(403)).body.message).toBe('Đơn vị nằm ngoài phạm vi HC-NS của bạn.');
    await patch('/VCPARTS-RIENG', { legal_entity_code: 'VCSERVICE', rev: 1 }).expect(200);
    // hcns@<root unit> is HC-NS of the whole group.
    await signAll(['hcns@VCPV']);
    expect((await get('', ['hcns@VCPV'])).body.items.every((i: { can_edit: boolean }) => i.can_edit)).toBe(true);
    expect((await call('get', 'catalogs/legal-entities', ['hcns@VCPV'])).body.can_create).toBe(true);
  });
});

test('VH-UAT-27: 5 thao tác sai đều bị chặn, không thay đổi nào được lưu', async () => {
  const snapshot = async () => (await db.collection<OrgUnitDoc>(C.orgUnits).find().sort({ _id: 1 }).toArray()).map(({ updated_at: _u, ...u }) => u);
  const before = await snapshot();
  const audits = await db.collection(C.auditLog).countDocuments();
  const hn1 = 'VCPARTS-KD-HN1';
  // 1. VCPARTS under Tổ HN1; 2. a child for Tổ HN1-A (already nested); 3. stop Tổ HN1 with people; 4. second head; 5. Yến head of HN1.
  const results = [
    await post('/VCPARTS/move', { parent_code: hn1, rev: await rev('VCPARTS') }),
    await create('HN1-A-CON', 'Con của tổ lồng', 'to_nhom', 'VCPARTS-KD-HN1-A'),
    await post(`/${hn1}/deactivate`, { rev: await rev(hn1) }),
    await post('/VCPARTS-KD/head', { person_id: String(yen) }),
    await post(`/${hn1}/head`, { person_id: String(yen) }),
  ];
  expect(results.map((r) => `${r.status} ${r.body.message}`)).toEqual([
    '422 Không chuyển được: Tổ KD Hà Nội 1 đang nằm dưới VCparts. Chuyển thế này sẽ tạo vòng.',
    '422 Tổ / Nhóm chỉ chứa được Tổ / Nhóm con một cấp.',
    '422 Đơn vị còn 1 vị trí đang hiệu lực và 1 đơn vị con đang hoạt động. Chuyển hết người và đơn vị con trước khi ngừng.',
    '422 Phòng Kinh doanh đã có trưởng Trần Thị B. Mỗi đơn vị chỉ có một trưởng. Chọn "Thay trưởng" để Trần Thị B thôi từ ngày 19/11/2026.',
    '422 Người được chọn chưa có vị trí trong Tổ KD Hà Nội 1 hoặc đơn vị cha trực tiếp. Thêm vị trí (chính hoặc kiêm nhiệm) trước.',
  ]);
  expect(await snapshot()).toEqual(before);
  expect(await db.collection(C.auditLog).countDocuments()).toBe(audits);
});

test('Cây 300 đơn vị trả về ≤ 300 ms', async () => {
  const now = new Date();
  const docs: OrgUnitDoc[] = [];
  for (let i = 0; i < 300; i++) {
    const parent = i < 20 ? 'VCPARTS' : `PERF${String(i % 20).padStart(3, '0')}`;
    const ancestors = i < 20 ? ['VCPV', 'VCPARTS'] : ['VCPV', 'VCPARTS', parent];
    docs.push({
      _id: `PERF${String(i).padStart(3, '0')}`,
      name: `Đơn vị đo ${i}`,
      name_folded: `don vi do ${i}`,
      short_name: null,
      type: i < 20 ? 'phong' : 'to_nhom',
      parent_code: parent,
      ancestors,
      division_code: 'VCPARTS',
      legal_entity_code: 'VCPARTS',
      function_code: null,
      head_person_id: null,
      head_history: [],
      status: 'hoat_dong',
      effective_from_on: '2026-11-20',
      effective_to_on: null,
      merged_into_code: null,
      order: i,
      group_email: null,
      description: '',
      deleted_at: null,
      event_seq: 1,
      created_at: now,
      updated_at: now,
      rev: 1,
    });
  }
  await db.collection<OrgUnitDoc>(C.orgUnits).insertMany(docs);
  await get('').expect(200); // warm-up
  const t0 = Date.now();
  const r = await get('').expect(200);
  const ms = Date.now() - t0;
  expect(r.body.items.length).toBeGreaterThan(300);
  expect(ms).toBeLessThanOrEqual(300);
});
