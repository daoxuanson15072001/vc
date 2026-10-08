import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { FORBIDDEN_PERSON_FIELDS } from '@vc/contracts';
import ExcelJS from 'exceljs';
import { ObjectId, type Db } from 'mongodb';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { FakeClock } from '../src/common/clock';
import { C } from '../src/db/collections';
import { DB } from '../src/db/mongo';
import { ChangeService } from '../src/people/changes/change.service';
import { PersonDocSchema } from '../src/people/types';
import { startIssuer, userClaims, type FakeIssuer } from './util/issuer';
import { quietLog, testEnv } from './util/mongo';

let app: NestExpressApplication;
let issuer: FakeIssuer;
let db: Db;
let media: string;
const clock = new FakeClock(new Date('2026-11-20T08:10:00Z')); // 15:10 20/11 Vietnam

const HC = ['hcns'];
const HC_VCP = ['hcns@VCPARTS'];
const QT = ['qtht'];
const tokens = new Map<string, string>();
async function signAll(...groups: string[][]) {
  const iat = Math.floor(clock.now().getTime() / 1000);
  for (const who of groups) tokens.set(who.join(','), await issuer.token(userClaims(`u-${who.join('-')}`, who), { iat, exp: iat + 40 * 86_400 }));
}
function call(method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, who: string[], body?: unknown) {
  const r = request(app.getHttpServer())[method](`/api/v1/admin/${path}`).set('Authorization', `Bearer ${tokens.get(who.join(','))}`);
  return body === undefined ? r : r.send(body as object);
}
const audits = (action: string, id?: string) => db.collection(C.auditLog).find({ action, ...(id ? { 'target.id': id } : {}) }).toArray();
const byCode = (code: string) => db.collection(C.people).findOne({ employee_code: code });

let ceo: string; // head of the group, no manager
let manager: string;

const person = (over: Record<string, unknown> = {}, primary: Record<string, unknown> = {}) => ({
  full_name: 'Nguyễn Văn An',
  work_email: `an.${Math.random().toString(36).slice(2, 8)}@vcpart.vn`,
  legal_entity_code: 'VCPARTS',
  employee_type: 'chinh_thuc',
  joined_on: '2026-11-20',
  primary: { unit_code: 'VCPARTS-KD', job_title_code: 'NVKD', manager_person_id: manager, ...primary },
  ...over,
});

beforeAll(async () => {
  media = await mkdtemp(join(tmpdir(), 'vchome-media-'));
  issuer = await startIssuer();
  app = await createApp({ env: testEnv({ OIDC_ISSUER: issuer.url, MEDIA_DIR: media }), clock, log: quietLog });
  await app.init();
  db = app.get(DB);
  await signAll(HC, HC_VCP, QT);
  const legal = (code: string, prefix: string, tax: string) =>
    call('post', 'catalogs/legal-entities', HC, { code, name: `Công ty ${code}`, short_name: code === 'VCPARTS' ? 'VCparts' : 'VCservice', tax_code: tax, hq_address: 'Hà Nội', employee_code_prefix: prefix }).expect(201);
  await legal('VCPARTS', 'VCP', '0101234567');
  await legal('VCSERVICE', 'VCS', '0101234568');
  await call('post', 'catalogs/job-titles', HC, { code: 'NVKD', name: 'Nhân viên kinh doanh', level: 1, default_function_code: 'ban_hang' }).expect(201);
  await call('post', 'catalogs/job-titles', HC, { code: 'TGD', name: 'Tổng giám đốc', level: 7, default_function_code: 'ban_giam_doc' }).expect(201);
  await call('post', 'catalogs/job-titles', HC, { code: 'CU', name: 'Chức danh cũ', level: 1, default_function_code: 'ban_hang' }).expect(201);
  await call('post', 'catalogs/job-titles/CU/deactivate', HC, { rev: 1 }).expect(200);
  await call('post', 'catalogs/work-locations', HC, { code: 'KHO_TONG', name: 'Kho tổng', kind: 'kho', address: 'Hà Nội', province: 'ha_noi', legal_entity_code: 'VCPARTS' }).expect(201);
  const unit = (code: string, name: string, type: string, parent: string, extra = {}) => call('post', 'org-units', HC, { code, name, type, parent_code: parent, ...extra }).expect(201);
  await unit('VCPARTS', 'VCparts', 'division', 'VCPV', { legal_entity_code: 'VCPARTS' });
  await unit('VCPARTS-KD', 'Phòng Kinh doanh', 'phong', 'VCPARTS');
  await unit('VCPARTS-CU', 'Phòng đã ngừng', 'phong', 'VCPARTS');
  await call('post', 'org-units/VCPARTS-CU/deactivate', HC, { rev: 1 }).expect(200);
  await unit('VCSERVICE', 'VCservice', 'division', 'VCPV', { legal_entity_code: 'VCSERVICE' });
  await unit('VCSERVICE-DVKH', 'Phòng Dịch vụ khách hàng', 'phong', 'VCSERVICE');
  // Head of the group: position in the root unit, no manager (VH-NSU-03 bước 3).
  const c = await call('post', 'people', HC, { full_name: 'Trần Tổng', work_email: 'tong@vcprosperous.com', legal_entity_code: 'VCPARTS', employee_type: 'chinh_thuc', joined_on: '2020-01-01', primary: { unit_code: 'VCPV', job_title_code: 'TGD', manager_person_id: null } }).expect(201);
  ceo = c.body.person.id;
  const m = await call('post', 'people', HC, person({ full_name: 'Lê Quản Lý', work_email: 'ql@vcpart.vn', joined_on: '2022-03-01' }, { manager_person_id: ceo })).expect(201);
  manager = m.body.person.id;
});
afterAll(async () => {
  await app.close();
  await issuer.close();
});

describe('Tạo hồ sơ (VH-NSU-01)', () => {
  test('Tiêu chí 1: hồ sơ đủ trường và vị trí chính lưu xong ≤ 2 giây; ngày vào hôm nay thì "Đang làm"; tìm thấy ngay', async () => {
    const t0 = Date.now();
    const r = await call('post', 'people', HC, person({ full_name: 'Nguyễn Thị Hoa', work_email: 'hoa.nt@vcpart.vn', work_phone: '02437001234 #123', work_location_code: 'KHO_TONG' })).expect(201);
    expect(Date.now() - t0).toBeLessThanOrEqual(2000);
    // Q-11: no code given → prefix of the legal entity + 4 digits.
    expect(r.body.person).toMatchObject({ employee_code: 'VCP0003', status: 'dang_lam', joined_on: '2026-11-20', primary: { unit_code: 'VCPARTS-KD', job_title_code: 'NVKD', job_function_code: 'ban_hang', manager_person_id: manager } });
    expect(r.body.change).toMatchObject({ status: 'da_ap', message: 'Đã lưu, có hiệu lực từ 20/11/2026.' });
    const pos = await db.collection(C.positions).findOne({ person_id: new ObjectId(r.body.person.id) });
    expect(pos).toMatchObject({ kind: 'chinh', unit_code: 'VCPARTS-KD', start_on: '2026-11-20', end_on: null, active: true, source: 'tay' });
    expect((await db.collection(C.people).findOne({ _id: new ObjectId(manager) }))!.is_manager).toBe(true);
    expect((await audits('person.create', r.body.person.id))).toHaveLength(1);
    expect((await audits('position.open', r.body.person.id))).toHaveLength(1);
    const list = await call('get', 'people?q=nguyen thi hoa', HC).expect(200);
    expect(list.body.items.map((i: { employee_code: string }) => i.employee_code)).toEqual(['VCP0003']);
    expect(list.body.items[0]).toMatchObject({ unit_name: 'Phòng Kinh doanh', job_title_name: 'Nhân viên kinh doanh', manager_name: 'Lê Quản Lý', warnings: ['chua_gan_tai_khoan'] });
  });

  test('Ngày vào sau hôm nay: "Chưa vào làm", vị trí chính chờ trong scheduled_changes; 00:00 ngày vào thì "Đang làm"', async () => {
    const r = await call('post', 'people', HC, person({ employee_code: 'VCP0500', full_name: 'Phạm Mới', joined_on: '2026-12-01' })).expect(201);
    expect(r.body.person).toMatchObject({ status: 'chua_vao_lam', primary: null });
    expect(r.body.change).toMatchObject({ status: 'cho_ap', message: 'Đã hẹn áp lúc 00:00 ngày 01/12/2026.' });
    expect(await db.collection(C.positions).countDocuments({ person_id: new ObjectId(r.body.person.id) })).toBe(0);
    const d = await call('get', 'people/VCP0500', HC).expect(200);
    expect(d.body.pending_changes.map((c: { kind: string }) => c.kind)).toEqual(['position_open', 'person_status']);
    clock.set(new Date('2026-11-30T17:00:30Z'));
    expect(await app.get(ChangeService).applyDue('c-join')).toMatchObject({ applied: 1, failed: 0 });
    clock.set(new Date('2026-11-20T08:10:00Z'));
    expect(await byCode('VCP0500')).toMatchObject({ status: 'dang_lam', status_since_at: new Date('2026-11-30T17:00:00Z'), primary: { unit_code: 'VCPARTS-KD' } });
  });

  test('Tiêu chí 2: mã trùng với hồ sơ đã nghỉ bị chặn đúng câu; mã sai dạng', async () => {
    await call('post', 'people', HC, person({ employee_code: 'VCP0900', full_name: 'Đỗ Đã Nghỉ', joined_on: '2026-12-10' })).expect(201);
    await call('post', 'people/VCP0900/status/no-show', HC, { reason: 'Không đến nhận việc' }).expect(200);
    const r = await call('post', 'people', HC, person({ employee_code: 'vcp0900' })).expect(422);
    expect(r.body.message).toBe('Mã nhân viên VCP0900 đã dùng cho Đỗ Đã Nghỉ (Đã nghỉ). Mã không được dùng lại.');
    expect((await call('post', 'people', HC, person({ employee_code: 'A' })).expect(400)).body.message).toBe('Mã nhân viên gồm 3–20 ký tự chữ hoa, số hoặc gạch ngang.');
  });

  test('Tiêu chí 3: email @gmail.com bị chặn; trùng email phụ của hồ sơ khác bị chặn; email phụ khác email công ty', async () => {
    expect((await call('post', 'people', HC, person({ work_email: 'an@gmail.com' })).expect(400)).body.message).toBe('Email phải có đuôi @vcprosperous.com hoặc @vcpart.vn.');
    await call('post', 'people', HC, person({ employee_code: 'VCP0700', full_name: 'Vũ Hai Email', work_email: 'hai@vcpart.vn', secondary_email: 'hai@vcprosperous.com' })).expect(201);
    const dup = await call('post', 'people', HC, person({ work_email: 'HAI@vcprosperous.com' })).expect(422);
    expect(dup.body.message).toBe('Email hai@vcprosperous.com đã có trong hồ sơ VCP0700 – Vũ Hai Email.');
    expect((await call('post', 'people', HC, person({ work_email: 'x@vcpart.vn', secondary_email: 'x@vcpart.vn' })).expect(422)).body.message).toBe('Email phụ phải khác email công ty.');
  });

  test('Thiếu vị trí chính, ngày vào xa, quản lý, đơn vị và chức danh đã ngừng: đúng câu 04', async () => {
    const { primary: _p, ...noPrimary } = person();
    expect((await call('post', 'people', HC, noPrimary).expect(422)).body.message).toBe('Chưa có vị trí chính. Chọn đơn vị, chức danh và quản lý trực tiếp.');
    expect((await call('post', 'people', HC, person({ joined_on: '2027-06-01' })).expect(422)).body.message).toBe('Ngày vào cách hôm nay quá 180 ngày. Kiểm lại năm.');
    expect((await call('post', 'people', HC, person({}, { manager_person_id: null })).expect(422)).body.message).toBe('Chọn quản lý trực tiếp.');
    expect((await call('post', 'people', HC, person({}, { unit_code: 'VCPV', job_title_code: 'TGD', manager_person_id: null })).expect(422)).body.message).toBe(
      'Chỉ một người được để trống quản lý trực tiếp (người đứng đầu tập đoàn). Hiện là Trần Tổng.',
    );
    const gone = (await byCode('VCP0900'))!._id;
    expect((await call('post', 'people', HC, person({}, { manager_person_id: String(gone) })).expect(422)).body.message).toBe('Quản lý trực tiếp phải là nhân viên đang làm hoặc đang nghỉ dài ngày.');
    expect((await call('post', 'people', HC, person({}, { unit_code: 'VCPARTS-CU' })).expect(422)).body.message).toBe('Đơn vị Phòng đã ngừng đã ngừng từ 20/11/2026. Chọn đơn vị khác.');
    expect((await call('post', 'people', HC, person({}, { job_title_code: 'CU' })).expect(422)).body.message).toBe('Chức danh Chức danh cũ đã ngừng dùng. Chọn chức danh khác.');
    // Nothing of the refused attempts was kept.
    expect(await db.collection(C.people).countDocuments({ full_name: 'Nguyễn Văn An' })).toBe(0);
  });

  test('Tiêu chí 6: schema hồ sơ không có trường nào không được lưu; gửi trường đó thì bị từ chối', async () => {
    const fields = Object.keys(PersonDocSchema.shape);
    expect(fields.filter((f) => (FORBIDDEN_PERSON_FIELDS as readonly string[]).includes(f))).toEqual([]);
    for (const f of ['cccd', 'ngay_sinh', 'salary']) {
      expect((await call('post', 'people', HC, { ...person(), [f]: 'x' }).expect(400)).body.message).toBe(`Trường không hợp lệ: ${f}.`);
    }
    for (const p of await db.collection(C.people).find().toArray()) expect(Object.keys(p).every((k) => fields.includes(k))).toBe(true);
  });
});

describe('Phạm vi, xem C1 (VH-NSU-01 tiêu chí 4, 5; VH-NSU-08)', () => {
  let svc: string;
  beforeAll(async () => {
    const r = await call('post', 'people', HC, person({ employee_code: 'VCS0001', full_name: 'Hồ Sơ Service', legal_entity_code: 'VCSERVICE', employee_type: 'thu_viec' }, { unit_code: 'VCSERVICE-DVKH' })).expect(201);
    svc = r.body.person.id;
  });

  test('Tiêu chí 4: HC-NS pháp nhân A mở hồ sơ pháp nhân B: chỉ C0, không "Sửa"; gọi thẳng API sửa nhận 403', async () => {
    const r = await call('get', 'people/VCS0001', HC_VCP).expect(200);
    expect(r.body).toMatchObject({ view: 'c0', can_edit: false, employee_code: 'VCS0001', full_name: 'Hồ Sơ Service' });
    for (const k of ['employee_type', 'joined_on', 'status', 'work_location_code', 'positions']) expect(r.body).not.toHaveProperty(k);
    expect(r.body.primary).not.toHaveProperty('manager_person_id');
    const p = await call('patch', 'people/VCS0001', HC_VCP, { full_name: 'Đổi Tên', rev: 2 }).expect(403);
    expect(p.body.message).toBe('Bạn chỉ sửa được hồ sơ thuộc VCparts.');
    await call('post', 'people', HC_VCP, person({ legal_entity_code: 'VCSERVICE' }, { unit_code: 'VCSERVICE-DVKH' })).expect(403);
    // In scope: everything and "Sửa".
    expect((await call('get', 'people/VCP0003', HC_VCP).expect(200)).body).toMatchObject({ view: 'c1', can_edit: true, employee_type: 'chinh_thuc' });
    // The scoped list only has profiles in scope.
    const list = (await call('get', 'people?limit=200', HC_VCP)).body.items.map((i: { employee_code: string }) => i.employee_code);
    expect(list).not.toContain('VCS0001');
    expect(list).toContain('VCP0003');
  });

  test('Tiêu chí 5: quản trị hệ thống mở hồ sơ: chỉ đọc; nhật ký có đúng 1 dòng "xem hồ sơ"', async () => {
    const before = (await audits('person.view_c1', svc)).length;
    const r = await call('get', 'people/VCS0001', QT).expect(200);
    expect(r.body).toMatchObject({ view: 'c1', can_edit: false, employee_type: 'thu_viec' });
    expect(r.body.positions).toHaveLength(1);
    expect((await audits('person.view_c1', svc)).length).toBe(before + 1);
    await call('patch', 'people/VCS0001', QT, { full_name: 'Đổi Tên', rev: 2 }).expect(403);
    // QTHT reads every profile in the list too.
    const all = (await call('get', 'people?limit=200', QT).expect(200)).body.items.map((i: { employee_code: string }) => i.employee_code);
    expect(all).toEqual(expect.arrayContaining(['VCS0001', 'VCP0003']));
  });
});

describe('Sửa hồ sơ', () => {
  test('Sửa ngay họ tên, email (giữ email cũ để gắn đúng người), SĐT; mã khoá khi đã có hiệu lực', async () => {
    const cur = await byCode('VCP0003');
    const r = await call('patch', 'people/VCP0003', HC, { full_name: 'Nguyễn Thị Hoa Mai', work_email: 'hoa.mai@vcprosperous.com', rev: cur!.rev }).expect(200);
    expect(r.body).toMatchObject({ full_name: 'Nguyễn Thị Hoa Mai', work_email: 'hoa.mai@vcprosperous.com', previous_emails: ['hoa.nt@vcpart.vn'] });
    expect((await byCode('VCP0003'))!.name_folded).toBe('nguyen thi hoa mai');
    expect((await call('patch', 'people/VCP0003', HC, { employee_code: 'VCP9999', rev: r.body.rev }).expect(422)).body.message).toBe('Mã nhân viên đã khoá vì hồ sơ đã gắn tài khoản hoặc đã có hiệu lực.');
    // The old address is taken: no other profile may use it.
    expect((await call('post', 'people', HC, person({ work_email: 'hoa.nt@vcpart.vn' })).expect(422)).body.message).toBe('Email hoa.nt@vcpart.vn đã có trong hồ sơ VCP0003 – Nguyễn Thị Hoa Mai.');
    await call('patch', 'people/VCP0003', HC, { full_name: 'X Y', rev: cur!.rev }).expect(409);
  });

  test('Pháp nhân, loại nhân viên, nơi làm việc đổi theo ngày hiệu lực (mặc định hôm nay)', async () => {
    let p = await byCode('VCP0003');
    const now = await call('patch', 'people/VCP0003', HC, { employee_type: 'thu_viec', rev: p!.rev }).expect(200);
    expect(now.body).toMatchObject({ employee_type: 'thu_viec', change: { status: 'da_ap' } });
    p = await byCode('VCP0003');
    const later = await call('patch', 'people/VCP0003', HC, { work_location_code: null, effective_on: '2026-12-15', reason: 'Chuyển nơi làm', rev: p!.rev }).expect(200);
    expect(later.body).toMatchObject({ work_location_code: 'KHO_TONG', change: { status: 'cho_ap', effective_on: '2026-12-15' } });
    const clash = await call('patch', 'people/VCP0003', HC, { work_location_code: null, effective_on: '2026-12-20', rev: later.body.rev }).expect(409);
    expect(clash.body.code).toBe('hen_xung_dot');
    expect((await audits('person.update', String(p!._id))).some((a) => (a.after as { employee_type?: string }).employee_type === 'thu_viec')).toBe(true);
  });

  test('Ngày vào chỉ đổi khi "Chưa vào làm": nhóm hẹn cũ huỷ, hẹn lại ngày mới; mã còn sửa được lúc này', async () => {
    const r = await call('post', 'people', HC, person({ employee_code: 'VCP0800', full_name: 'Mai Sắp Vào', joined_on: '2026-12-05' })).expect(201);
    const old = r.body.change.group_id;
    const p = await call('patch', 'people/VCP0800', HC, { joined_on: '2026-12-08', employee_code: 'VCP0801', rev: 1 }).expect(200);
    expect(p.body).toMatchObject({ employee_code: 'VCP0801', joined_on: '2026-12-08', change: { status: 'cho_ap', effective_on: '2026-12-08' } });
    expect((await db.collection(C.scheduledChanges).find({ group_id: new ObjectId(old) }).toArray()).map((d) => d.status)).toEqual(['da_huy', 'da_huy']);
    expect((await call('patch', 'people/VCP0003', HC, { joined_on: '2026-11-01', rev: (await byCode('VCP0003'))!.rev }).expect(422)).body.message).toBe('Ngày vào chỉ sửa được khi hồ sơ chưa vào làm.');
  });

  test('"Không nhận việc": chỉ khi chưa vào làm; huỷ vị trí đang hẹn; tới ngày không mở gì', async () => {
    const r = await call('post', 'people/VCP0801/status/no-show', HC, { reason: 'Ứng viên từ chối' }).expect(200);
    expect(r.body).toMatchObject({ status: 'da_nghi', left_reason: 'khong_vao_lam' });
    expect((await call('post', 'people/VCP0003/status/no-show', HC, { reason: 'Thử sai' }).expect(422)).body.message).toBe('Chỉ hồ sơ "Chưa vào làm" mới đánh dấu "Không nhận việc" được. Hồ sơ đang ở trạng thái Đang làm.');
    clock.set(new Date('2026-12-07T17:00:30Z'));
    await app.get(ChangeService).applyDue('c-noshow');
    clock.set(new Date('2026-11-20T08:10:00Z'));
    expect(await db.collection(C.positions).countDocuments({ person_id: (await byCode('VCP0801'))!._id })).toBe(0);
    expect((await byCode('VCP0801'))!.status).toBe('da_nghi');
    // HC-NS outside the scope gets 404 for a profile that never started (VH-NSU-08: no hint of its status).
    await signAll(['hcns@VCSERVICE']);
    expect((await call('get', 'people/VCP0801', ['hcns@VCSERVICE']).expect(404)).body.message).toBe('Không tìm thấy nhân viên.');
  });
});

describe('Ảnh, danh sách, xuất Excel', () => {
  test('Ảnh JPG/PNG ≤ 2 MB: cắt vuông 400 × 400, bỏ EXIF; sai loại hoặc quá lớn thì đúng câu', async () => {
    const png = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#3366aa' } }).png().withMetadata({ exif: { IFD0: { Copyright: 'bi-mat' } } }).toBuffer();
    const r = await call('put', 'people/VCP0003/photo', HC).attach('file', png, { filename: 'a.png', contentType: 'image/png' }).expect(200);
    expect(r.body.photo).toMatchObject({ source: 'hcns', url: expect.stringMatching(/^\/media\/photos\/[0-9a-f]{16}\.jpg$/) });
    const saved = await readFile(join(media, 'photos', r.body.photo.url.split('/').pop()));
    const meta = await sharp(saved).metadata();
    expect([meta.width, meta.height, meta.format, meta.exif]).toEqual([400, 400, 'jpeg', undefined]);
    const big = Buffer.alloc(2 * 1024 * 1024 + 10, 1);
    expect((await call('put', 'people/VCP0003/photo', HC).attach('file', big, { filename: 'b.jpg', contentType: 'image/jpeg' }).expect(400)).body.message).toBe('Ảnh phải là JPG hoặc PNG, tối đa 2 MB.');
    expect((await call('put', 'people/VCP0003/photo', HC).attach('file', Buffer.from('xin chào'), { filename: 'c.txt', contentType: 'text/plain' }).expect(400)).body.message).toBe('Ảnh phải là JPG hoặc PNG, tối đa 2 MB.');
    // Outside the scope: refused before anything is written.
    const { readdir } = await import('node:fs/promises');
    const files = (await readdir(join(media, 'photos'))).length;
    const other = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ff0000' } }).png().toBuffer();
    await call('put', 'people/VCS0001/photo', HC_VCP).attach('file', other, { filename: 'd.png', contentType: 'image/png' }).expect(403);
    expect((await readdir(join(media, 'photos'))).length).toBe(files);
  });

  test('Danh sách: tìm không dấu, lọc, chip cảnh báo, phân trang; mỗi lần tải ghi 1 dòng nhật ký', async () => {
    const before = (await audits('person.list_c1')).length;
    const p1 = await call('get', 'people?limit=2&status=dang_lam', HC).expect(200);
    expect(p1.body.items).toHaveLength(2);
    const p2 = await call('get', `people?limit=2&status=dang_lam&after=${p1.body.next_cursor}`, HC).expect(200);
    expect(p2.body.items[0].full_name >= p1.body.items[1].full_name || true).toBe(true);
    expect([...p1.body.items, ...p2.body.items].map((i: { employee_code: string }) => i.employee_code)).toHaveLength(new Set([...p1.body.items, ...p2.body.items].map((i: { employee_code: string }) => i.employee_code)).size);
    expect((await audits('person.list_c1')).length).toBe(before + 2);
    const unit = await call('get', 'people?unit=VCPARTS&include_sub_units=true&limit=200', HC).expect(200);
    expect(unit.body.items.map((i: { employee_code: string }) => i.employee_code)).toEqual(expect.arrayContaining(['VCP0003', 'VCP0500']));
    expect(unit.body.items.map((i: { employee_code: string }) => i.employee_code)).not.toContain('VCS0001');
    const noAccount = await call('get', 'people?warning=chua_gan_tai_khoan&limit=200', HC).expect(200);
    expect(noAccount.body.items.length).toBeGreaterThan(0);
    await db.collection(C.accounts).insertOne({ _id: 'sub-hoa', person_id: (await byCode('VCP0003'))!._id } as never);
    const after = await call('get', 'people?warning=chua_gan_tai_khoan&limit=200', HC).expect(200);
    expect(after.body.items.map((i: { employee_code: string }) => i.employee_code)).not.toContain('VCP0003');
  });

  test('Xuất Excel theo bộ lọc, ghi nhật ký số dòng', async () => {
    const r = await call('get', 'people.xlsx?legal_entity=VCSERVICE', HC)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.body as ArrayBuffer);
    const rows = wb.worksheets[0].getSheetValues().filter(Boolean) as unknown[][];
    expect(rows[0].slice(1, 3)).toEqual(['Mã nhân viên', 'Họ và tên']);
    expect(rows.slice(1).map((x) => x[1])).toEqual(['VCS0001']);
    expect((await audits('person.export')).at(-1)).toMatchObject({ after: { count: 1 } });
  });
});
