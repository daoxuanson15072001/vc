import type { NestExpressApplication } from '@nestjs/platform-express';
import ExcelJS from 'exceljs';
import type { Db } from 'mongodb';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { FakeClock } from '../src/common/clock';
import { C } from '../src/db/collections';
import { DB } from '../src/db/mongo';
import { CatalogService } from '../src/org/catalogs/catalog.service';
import { ChangeService } from '../src/people/changes/change.service';
import { startIssuer, userClaims, type FakeIssuer } from './util/issuer';
import { quietLog, testEnv } from './util/mongo';

let app: NestExpressApplication;
let issuer: FakeIssuer;
let db: Db;
const clock = new FakeClock(new Date('2026-11-20T08:10:00Z')); // 15:10 20/11 Vietnam

const HC = ['hcns']; // HC-NS of the whole group
const HC_VCP = ['hcns@VCPARTS']; // HC-NS of one legal entity
type Who = string[];

const tokens = new Map<string, string>();
/** Signed once at the fake clock's start, valid 40 days (the clock moves to 01/12 in one test). */
async function signAll(...groups: Who[]) {
  const iat = Math.floor(clock.now().getTime() / 1000);
  for (const who of groups) tokens.set(who.join(','), await issuer.token(userClaims(`u-${who.join('-')}`, who), { iat, exp: iat + 40 * 86_400 }));
}
function call(method: 'get' | 'post' | 'patch' | 'delete', path: string, who: Who, body?: unknown) {
  const r = request(app.getHttpServer())[method](`/api/v1/admin/catalogs/${path}`).set('Authorization', `Bearer ${tokens.get(who.join(','))}`);
  return body === undefined ? r : r.send(body as object);
}
const get = (path: string, who: Who = HC) => call('get', path, who);
const post = (path: string, body: unknown, who: Who = HC) => call('post', path, who, body);
const patch = (path: string, body: unknown, who: Who = HC) => call('patch', path, who, body);
const del = (path: string, who: Who = HC) => call('delete', path, who);
const audit = (action: string, id: string) => db.collection(C.auditLog).find({ action, 'target.id': id }).toArray();

const title = (code: string, name: string, fn = 'ban_hang') => ({ code, name, level: 1, default_function_code: fn });
const legal = (code: string, tax: string, name = `Công ty ${code}`) => ({ code, name, short_name: code, tax_code: tax, hq_address: 'Hà Nội', email_domains: ['vcpart.vn'] });
const location = (code: string, legalCode: string | null, name = `Kho ${code}`) => ({ code, name, kind: 'kho', address: 'Số 1 Ví Dụ', province: 'ha_noi', legal_entity_code: legalCode });

beforeAll(async () => {
  issuer = await startIssuer();
  app = await createApp({ env: testEnv({ OIDC_ISSUER: issuer.url }), clock, log: quietLog });
  await app.init();
  db = app.get(DB);
  await signAll(HC, HC_VCP, ['qtht']);
});
afterAll(async () => {
  await app.close();
  await issuer.close();
});

describe('Chức năng (VH-ORG-03)', () => {
  test('Tiêu chí 1: lúc khởi tạo có đủ 10 chức năng Q-02, đúng thứ tự', async () => {
    const r = await get('job-functions').expect(200);
    expect(r.body.items.map((f: { code: string; name: string }) => `${f.code}:${f.name}`)).toEqual([
      'ban_hang:Bán hàng',
      'cskh:CSKH',
      'sale_admin:Sale admin',
      'ke_toan:Kế toán',
      'ky_thuat:Kỹ thuật / dịch vụ',
      'kho:Kho',
      'marketing:Marketing',
      'nhan_su:Nhân sự',
      'it:IT',
      'ban_giam_doc:Ban giám đốc',
    ]);
    expect(r.body.items[0]).toMatchObject({ status: 'dang_dung', rev: 1, usage: { positions: 0, rules: 0 }, can_edit: true });
  });

  test('Mã sai dạng, tên trùng (không phân biệt dấu): đúng câu 04', async () => {
    expect((await post('job-functions', { code: 'Ban-Hang', name: 'X' }).expect(400)).body.message).toBe('Mã chức năng gồm 2–30 ký tự chữ thường không dấu, số hoặc gạch dưới.');
    expect((await post('job-functions', { code: 'ban_hang_2', name: 'ban  HANG' }).expect(422)).body.message).toBe("Chức năng 'Bán hàng' đã có.");
  });

  test('Tiêu chí 3: ngừng "Kho" khi còn 1 vị trí đang hiệu lực bị chặn, câu nêu đúng số', async () => {
    await db.collection(C.positions).insertMany([
      { person_id: 'p1', job_function_code: 'kho', job_title_code: 'X', active: true },
      { person_id: 'p2', job_function_code: 'kho', job_title_code: 'X', active: false },
    ]);
    const r = await post('job-functions/kho/deactivate', { rev: 1 }).expect(422);
    expect(r.body.message).toBe('Chức năng đang gắn với 1 vị trí và 0 luật cấp quyền. Chuyển vị trí và sửa luật trước khi ngừng.');
    expect((await get('job-functions/kho').expect(200)).body).toMatchObject({ status: 'dang_dung', usage: { positions: 1 } });
  });

  test('Tiêu chí 4: ô mã chỉ đọc; gọi thẳng API đổi mã bị từ chối', async () => {
    const r = await patch('job-functions/it', { code: 'cntt', rev: 1 }).expect(422);
    expect(r.body.message).toBe('Mã không đổi được sau khi tạo.');
    expect((await get('job-functions/it')).body.code).toBe('it');
  });
});

describe('Chức danh (VH-ORG-02)', () => {
  test('Tiêu chí 1: thêm "nhân viên  kinh doanh" khi đã có "Nhân viên kinh doanh" bị chặn đúng câu', async () => {
    const r = await post('job-titles', { ...title('NVKD', 'Nhân viên kinh doanh'), suggest_manager: false, description: 'Bán hàng khu vực' }).expect(201);
    expect(r.body).toMatchObject({ code: 'NVKD', name: 'Nhân viên kinh doanh', level: 1, status: 'dang_dung', status_from: '2026-11-20', order: 10, rev: 1 });
    const dup = await post('job-titles', title('NVKD2', 'nhân viên  kinh doanh')).expect(422);
    expect(dup.body.message).toBe("Chức danh 'Nhân viên kinh doanh' đã có (mã NVKD).");
    // Each write: one audit row.
    const rows = await audit('catalog.create', 'NVKD');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ target: { type: 'job_title', label: 'Nhân viên kinh doanh' }, after: { default_function_code: 'ban_hang', status: 'dang_dung' } });
  });

  test('Mã, cấp bậc sai dạng; chức năng mặc định phải đang dùng; mã đã có', async () => {
    const bad = await post('job-titles', { ...title('nvkd', 'Một tên'), level: 9 }).expect(400);
    expect(bad.body.message).toBe('Mã chức danh gồm 2–30 ký tự chữ hoa, số hoặc gạch dưới.');
    expect(bad.body.details.map((d: { path: string }) => d.path)).toEqual(['code', 'level']);
    expect((await post('job-titles', title('GSBH', 'Giám sát bán hàng', 'khong_co')).expect(422)).body.message).toBe('Chức năng khong_co không có.');
    expect((await post('job-titles', title('NVKD', 'Tên khác')).expect(422)).body.message).toBe('Mã NVKD đã có.');
    expect((await post('job-titles', { ...title('ABC', 'Tên khác'), la: 1 }).expect(400)).body.message).toBe('Trường không hợp lệ: la.');
    // Missing code keeps the sentence of the schema; a wrong type gets the Vietnamese fallback.
    expect((await post('job-titles', { name: 'Tên khác', level: 1, default_function_code: 'ban_hang' }).expect(400)).body.message).toBe('Mã chức danh gồm 2–30 ký tự chữ hoa, số hoặc gạch dưới.');
    expect((await post('job-titles', { ...title('ABC', 'Tên khác'), suggest_manager: 'co' }).expect(400)).body.message).toBe('Giá trị của trường suggest_manager không hợp lệ.');
  });

  test('Tiêu chí 2: ngừng chức danh có 12 người giữ: 12 vị trí giữ nguyên; không chọn được cho vị trí mới', async () => {
    await post('job-titles', title('NVTT', 'Nhân viên thị trường')).expect(201);
    await db.collection(C.positions).insertMany(Array.from({ length: 12 }, (_, i) => ({ person_id: `tt${i}`, job_title_code: 'NVTT', job_function_code: 'ban_hang', active: true })));
    const before = await db.collection(C.positions).find({ job_title_code: 'NVTT' }).toArray();
    expect((await get('job-titles?status=dang_dung')).body.items.find((t: { code: string }) => t.code === 'NVTT').usage.positions).toBe(12);
    const r = await post('job-titles/NVTT/deactivate', { rev: 1, reason: 'Gộp vào NVKD' }).expect(200);
    expect(r.body).toMatchObject({ status: 'ngung', rev: 2 });
    expect(await db.collection(C.positions).find({ job_title_code: 'NVTT' }).toArray()).toEqual(before);
    // The "new position" form lists titles in use only; the position service refuses a stopped one.
    expect((await get('job-titles?status=dang_dung')).body.items.map((t: { code: string }) => t.code)).not.toContain('NVTT');
    await expect(app.get(CatalogService).requireSelectable('job-titles', 'NVTT')).rejects.toMatchObject({ message: 'Chức danh Nhân viên thị trường đã ngừng, không chọn được cho dữ liệu mới.' });
    expect((await audit('catalog.deactivate', 'NVTT'))[0]).toMatchObject({ before: { status: 'dang_dung' }, after: { status: 'ngung' }, reason: 'Gộp vào NVKD' });
    // Tiêu chí 4 (dữ liệu): stopped titles are still listed, with their status.
    expect((await get('job-titles')).body.items.find((t: { code: string }) => t.code === 'NVTT').status).toBe('ngung');
    // Dùng lại.
    expect((await post('job-titles/NVTT/activate', { rev: 2 }).expect(200)).body.status).toBe('dang_dung');
  });

  test('Đổi tên: chỉ đổi tên hiển thị, nhật ký có trước và sau; rev cũ thì 409', async () => {
    const cur = (await get('job-titles/NVKD')).body;
    const r = await patch('job-titles/NVKD', { name: 'Nhân viên kinh doanh khu vực', rev: cur.rev }).expect(200);
    expect(r.body).toMatchObject({ name: 'Nhân viên kinh doanh khu vực', rev: cur.rev + 1 });
    expect((await audit('catalog.update', 'NVKD'))[0]).toMatchObject({ before: { name: 'Nhân viên kinh doanh' }, after: { name: 'Nhân viên kinh doanh khu vực' } });
    await patch('job-titles/NVKD', { name: 'Tên khác nữa', rev: cur.rev }).expect(409);
  });

  test('Xoá: chưa từng dùng thì xoá được; đã dùng (kể cả vị trí đã kết thúc) thì phải Ngừng', async () => {
    await post('job-titles', title('TAM', 'Chức danh tạm')).expect(201);
    expect((await del('job-titles/TAM?rev=1').expect(200)).body).toEqual({ code: 'TAM', deleted: true });
    expect(await audit('catalog.delete', 'TAM')).toHaveLength(1);
    await post('job-titles', title('CU', 'Chức danh cũ')).expect(201);
    await db.collection(C.positions).insertOne({ person_id: 'p9', job_title_code: 'CU', job_function_code: 'ban_hang', active: false });
    expect((await del('job-titles/CU?rev=1').expect(422)).body.message).toBe('Chức danh đã được dùng, không xoá được. Hãy chuyển sang Ngừng.');
    // A function that is some title's default counts as used.
    expect((await del('job-functions/ban_hang?rev=1').expect(422)).body.message).toBe('Chức năng đã được dùng, không xoá được. Hãy chuyển sang Ngừng.');
  });

  test('Hai người thêm cùng tên cùng lúc: một lưu được, một bị chặn (chỉ mục duy nhất)', async () => {
    const [a, b] = await Promise.all([post('job-titles', title('DUA', 'Thủ kho', 'kho')), post('job-titles', title('DUB', 'thủ  kho', 'kho'))]);
    expect([a.status, b.status].sort()).toEqual([201, 422]);
  });

  test('Xuất Excel: tiêu đề tiếng Việt, đủ chức danh kể cả đã ngừng', async () => {
    const r = await get('job-titles.xlsx').buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(r.headers['content-type']).toContain('spreadsheetml');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.body as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Chức danh');
    expect(ws.getRow(1).values).toEqual([undefined, 'Mã', 'Tên', 'Cấp bậc', 'Chức năng mặc định', 'Gợi ý là quản lý', 'Trạng thái', 'Số người đang giữ', 'Mô tả']);
    const nvtt = ws.getSheetValues().find((row) => Array.isArray(row) && row[1] === 'NVTT') as unknown[];
    expect(nvtt.slice(1, 8)).toEqual(['NVTT', 'Nhân viên thị trường', '1 · Nhân viên', 'ban_hang', 'Không', 'Đang dùng', 12]);
  });
});

describe('Pháp nhân, nơi làm việc (VH-ORG-07)', () => {
  test('Tiêu chí 1: mã số thuế "0101234567" và "0101234567-001" lưu được; "12345" bị chặn đúng câu', async () => {
    await post('legal-entities', legal('VCPARTS', '0101234567', 'Công ty TNHH VCparts')).expect(201);
    await post('legal-entities', legal('VCPV', '0101234567-001', 'Công ty CP VC Phồn Vinh')).expect(201);
    expect((await post('legal-entities', legal('VCX', '12345')).expect(400)).body.message).toBe('Mã số thuế gồm 10 chữ số, hoặc 10 chữ số, gạch ngang và 3 chữ số.');
    expect((await post('legal-entities', legal('VCY', '0101234567')).expect(422)).body.message).toBe('Mã số thuế đã có ở pháp nhân Công ty TNHH VCparts.');
    expect((await get('legal-entities/VCPARTS')).body).toMatchObject({ name_history: [{ name: 'Công ty TNHH VCparts', from_on: '2026-11-20' }], status_from: '2026-11-20' });
  });

  test('Tiêu chí 3: HC-NS phạm vi một pháp nhân chỉ xem, không thêm, sửa pháp nhân', async () => {
    const list = await get('legal-entities', HC_VCP).expect(200);
    expect(list.body.can_create).toBe(false);
    expect(list.body.items.every((i: { can_edit: boolean }) => !i.can_edit)).toBe(true);
    expect((await post('legal-entities', legal('VCZ', '0109999999'), HC_VCP).expect(403)).body.message).toBe('Chỉ HC-NS phạm vi toàn tập đoàn sửa được danh mục pháp nhân.');
    await patch('legal-entities/VCPARTS', { short_name: 'VCP', rev: 1 }, HC_VCP).expect(403);
    await post('legal-entities/VCPARTS/deactivate', { rev: 1 }, HC_VCP).expect(403);
    // Quản trị hệ thống has no co_cau.sua.
    await get('legal-entities', ['qtht']).expect(403);
  });

  test('Đổi tên pháp nhân có ngày hiệu lực: hẹn ngày thì job áp lúc 00:00, giữ tên cũ trong lịch sử', async () => {
    expect((await patch('legal-entities/VCPARTS', { name: 'Công ty CP VCparts', rev: 1 }).expect(422)).body.message).toBe('Đổi tên pháp nhân cần ngày hiệu lực (theo đăng ký kinh doanh mới).');
    const r = await patch('legal-entities/VCPARTS', { name: 'Công ty CP VCparts', short_name: 'VCparts JSC', effective_on: '2026-12-01', reason: 'ĐKKD thay đổi lần 3', rev: 1 }).expect(200);
    expect(r.body).toMatchObject({ name: 'Công ty TNHH VCparts', short_name: 'VCparts JSC', rev: 2, change: { status: 'cho_ap', message: 'Đã hẹn áp lúc 00:00 ngày 01/12/2026.' } });
    // HC-NS of one legal entity cannot cancel it either.
    await request(app.getHttpServer())
      .post(`/api/v1/admin/scheduled-changes/${r.body.change.group_id}/cancel`)
      .set('Authorization', `Bearer ${tokens.get(HC_VCP.join(','))}`)
      .send({ reason: 'Thử huỷ' })
      .expect(403);
    // A second rename while one is pending: asked (06 mục 1.5).
    const again = await patch('legal-entities/VCPARTS', { name: 'Công ty CP VC Parts', effective_on: '2026-12-05', rev: 2 }).expect(409);
    expect(again.body.message).toBe('Đã có thay đổi hẹn ngày 01/12/2026: đổi tên pháp nhân VCPARTS thành "Công ty CP VCparts". Thay đổi mới mâu thuẫn với thay đổi này. Huỷ thay đổi cũ và lưu thay đổi mới?');
    clock.set(new Date('2026-11-30T17:00:30Z'));
    expect(await app.get(ChangeService).applyDue('c-rename')).toMatchObject({ applied: 1 });
    const after = (await get('legal-entities/VCPARTS')).body;
    expect(after).toMatchObject({ name: 'Công ty CP VCparts', rev: 3 });
    expect(after.name_history).toEqual([
      { name: 'Công ty TNHH VCparts', from_on: '2026-11-20' },
      { name: 'Công ty CP VCparts', from_on: '2026-12-01' },
    ]);
    expect((await audit('legal_entity.rename', 'VCPARTS'))[0]).toMatchObject({ before: { name: 'Công ty TNHH VCparts' }, after: { name: 'Công ty CP VCparts' }, effective_on: '2026-12-01', reason: 'ĐKKD thay đổi lần 3' });
    // Today: applied at once.
    const now = await patch('legal-entities/VCPV', { name: 'Công ty CP Tập đoàn VC Phồn Vinh', effective_on: '2026-12-01', rev: 1 }).expect(200);
    expect(now.body).toMatchObject({ name: 'Công ty CP Tập đoàn VC Phồn Vinh', change: { status: 'da_ap' } });
    clock.set(new Date('2026-11-20T08:10:00Z'));
  });

  test('Ngừng pháp nhân còn nhân viên chưa nghỉ hoặc đơn vị đang hoạt động: bị chặn, câu nêu đúng số', async () => {
    await db.collection(C.people).insertMany([
      { employee_code: 'T-LE-1', legal_entity_code: 'VCPARTS', status: 'dang_lam' },
      { employee_code: 'T-LE-2', legal_entity_code: 'VCPARTS', status: 'nghi_dai_ngay' },
      { employee_code: 'T-LE-3', legal_entity_code: 'VCPARTS', status: 'da_nghi' },
    ]);
    await db.collection(C.orgUnits).insertMany([
      { _id: 'U1', legal_entity_code: 'VCPARTS', status: 'hoat_dong' },
      { _id: 'U2', legal_entity_code: 'VCPARTS', status: 'ngung' },
    ] as never[]);
    const rev = (await get('legal-entities/VCPARTS')).body.rev;
    expect((await post('legal-entities/VCPARTS/deactivate', { rev }).expect(422)).body.message).toBe('Pháp nhân còn 2 nhân viên và 1 đơn vị. Chuyển trước khi ngừng.');
  });

  test('Nơi làm việc: HC-NS một pháp nhân sửa được nơi của mình và nơi dùng chung, không sửa được của pháp nhân khác', async () => {
    await post('work-locations', location('KHO_TONG', 'VCPARTS', 'Kho tổng'), HC_VCP).expect(201);
    await post('work-locations', location('VP_CHUNG', null, 'Văn phòng chính'), HC_VCP).expect(201);
    expect((await post('work-locations', location('VP_VCPV', 'VCPV', 'Văn phòng VCPV'), HC_VCP).expect(403)).body.message).toBe(
      'Bạn chỉ sửa được nơi làm việc thuộc pháp nhân trong phạm vi của mình hoặc nơi làm việc dùng chung.',
    );
    await post('work-locations', location('VP_VCPV', 'VCPV', 'Văn phòng VCPV')).expect(201);
    await patch('work-locations/VP_VCPV', { address: 'Số 2', rev: 1 }, HC_VCP).expect(403);
    // Moving one's own location to another legal entity is refused too.
    await patch('work-locations/KHO_TONG', { legal_entity_code: 'VCPV', rev: 1 }, HC_VCP).expect(403);
    const list = (await get('work-locations', HC_VCP)).body;
    expect(Object.fromEntries(list.items.map((i: { code: string; can_edit: boolean }) => [i.code, i.can_edit]))).toEqual({ KHO_TONG: true, VP_CHUNG: true, VP_VCPV: false });
    expect((await post('work-locations', { ...location('X1', null), province: 'ha_tay' }).expect(400)).body.message).toBe('Chọn tỉnh, thành.');
    expect((await post('work-locations', location('X2', 'KHONGCO')).expect(422)).body.message).toBe('Pháp nhân KHONGCO không có.');
  });

  test('Tiêu chí 2: ngừng nơi làm việc còn 3 người bị chặn, câu nêu đúng số', async () => {
    await db.collection(C.people).insertMany([
      { employee_code: 'T-WL-1', work_location_code: 'KHO_TONG', status: 'dang_lam' },
      { employee_code: 'T-WL-2', work_location_code: 'KHO_TONG', status: 'tam_khoa' },
      { employee_code: 'T-WL-3', work_location_code: 'KHO_TONG', status: 'chua_vao_lam' },
      { employee_code: 'T-WL-4', work_location_code: 'KHO_TONG', status: 'da_nghi' },
    ]);
    expect((await post('work-locations/KHO_TONG/deactivate', { rev: 1 }).expect(422)).body.message).toBe('Nơi làm việc còn 3 nhân viên. Chuyển trước khi ngừng.');
    expect((await post('work-locations/VP_CHUNG/deactivate', { rev: 1 }).expect(200)).body.status).toBe('ngung');
    expect((await post('work-locations/VP_CHUNG/deactivate', { rev: 2 }).expect(422)).body.message).toBe('Nơi làm việc đang ở trạng thái Ngừng.');
  });

  test('Loại danh mục lạ: 404; tham số lặp không làm lỗi máy chủ; tìm không dấu', async () => {
    await get('chuc-vu').expect(404);
    await get('job-titles?q=a&q=b').expect(200);
    expect((await get('work-locations?q=kho tong')).body.items.map((i: { code: string }) => i.code)).toEqual(['KHO_TONG']);
  });
});
