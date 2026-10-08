import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GoogleUser } from '../src/google.js';
import { plan, type KcUser } from '../src/sync.js';

const o = { defaultGroups: ['app-vclinks', 'app-vcwiki'], companyDomains: ['vcprosperous.com', 'vcpart.vn'] };
const g = (email: string, x: Partial<GoogleUser> = {}): GoogleUser => ({
  id: `g-${email}`,
  email,
  domain: email.split('@')[1],
  suspended: false,
  archived: false,
  isEnrolledIn2Sv: true,
  ...x,
});
const k = (email: string, x: Partial<KcUser> = {}): KcUser => ({
  id: `k-${email}`,
  username: email,
  email,
  enabled: true,
  attributes: { vc_trang_thai: ['du_dieu_kien'] },
  groups: ['app-vclinks', 'app-vcwiki'],
  ...x,
});
const kinds = (p: ReturnType<typeof plan>) => p.actions.map((a) => `${a.kind}:${a.email}`);

test('Người đủ điều kiện chưa có user: tạo sẵn kèm nhóm app (D-BA-37, UAT-SSO-23)', () => {
  const p = plan([g('moi@vcpart.vn')], [], [], o);
  assert.deepEqual(kinds(p), ['tao_user:moi@vcpart.vn']);
  assert.deepEqual((p.actions[0] as any).groups, o.defaultGroups);
});

test('Chưa bật 2 bước: không tạo sẵn; có user thì gỡ nhóm và ghi trạng thái (UAT-SSO-22)', () => {
  assert.deepEqual(kinds(plan([g('a@vcprosperous.com', { isEnrolledIn2Sv: false })], [], [], o)), []);
  const p = plan([g('a@vcprosperous.com', { isEnrolledIn2Sv: false })], [k('a@vcprosperous.com')], [], o);
  assert.deepEqual(kinds(p), ['dat_trang_thai:a@vcprosperous.com', 'go_nhom:a@vcprosperous.com']);
  assert.equal((p.actions[0] as any).value, 'chua_bat_2_buoc');
});

test('Hộp thư dùng chung trong danh sách loại trừ: không vào app (UAT-SSO-21, D-BA-39)', () => {
  const ex = [{ email: 'cskh@vcpart.vn', loai: 'hop_thu_chung' as const }];
  assert.deepEqual(kinds(plan([g('cskh@vcpart.vn')], [], ex, o)), []);
  const p = plan([g('cskh@vcpart.vn')], [k('cskh@vcpart.vn', { groups: ['app-vclinks'] })], ex, o);
  assert.deepEqual(kinds(p), ['dat_trang_thai:cskh@vcpart.vn', 'go_nhom:cskh@vcpart.vn']);
  assert.equal((p.actions[0] as any).value, 'loai_tru');
});

test('Bật 2 bước rồi: lượt sau cấp lại nhóm', () => {
  const p = plan([g('a@vcprosperous.com')], [k('a@vcprosperous.com', { attributes: { vc_trang_thai: ['chua_bat_2_buoc'] }, groups: [] })], [], o);
  assert.deepEqual(kinds(p), ['dat_trang_thai:a@vcprosperous.com', 'them_nhom:a@vcprosperous.com']);
});

test('Google khoá, lưu trữ hoặc xoá: khoá trên VC ID (VH-AUT-07)', () => {
  const p = plan(
    [g('s@vcprosperous.com', { suspended: true }), g('r@vcprosperous.com', { archived: true }), g('o@vcprosperous.com')],
    [k('s@vcprosperous.com'), k('r@vcprosperous.com'), k('x@vcprosperous.com')],
    [],
    o,
  );
  assert.deepEqual(kinds(p).sort(), ['khoa_google:r@vcprosperous.com', 'khoa_google:s@vcprosperous.com', 'khoa_google:x@vcprosperous.com', 'tao_user:o@vcprosperous.com'].sort());
});

test('Không bao giờ tự mở khoá; chỉ báo khi Google hoạt động lại', () => {
  const p = plan([g('a@vcprosperous.com')], [k('a@vcprosperous.com', { enabled: false, attributes: { vc_trang_thai: ['du_dieu_kien'], vc_khoa: ['google'] } })], [], o);
  assert.deepEqual(kinds(p), ['bao_mo_lai:a@vcprosperous.com']);
});

test('Danh sách Google rỗng hoặc ít hơn 50% lần trước: dừng, không đổi gì', () => {
  assert.match(plan([], [k('a@vcprosperous.com')], [], o).stop!, /rỗng/);
  const p = plan([g('a@vcprosperous.com')], [k('a@vcprosperous.com')], [], { ...o, previousGoogleCount: 10 });
  assert.match(p.stop!, /50%/);
  assert.equal(p.actions.length, 0);
});

test('Gỡ nhóm của hơn 20 người trong một lượt: giữ lại chờ xác nhận, việc khác vẫn chạy', () => {
  const many = Array.from({ length: 21 }, (_, i) => `n${i}@vcprosperous.com`);
  const google = [...many.map((e) => g(e, { isEnrolledIn2Sv: false })), g('moi@vcpart.vn')];
  const p = plan(google, many.map((e) => k(e)), [], o);
  assert.match(p.held!, /21 người/);
  assert.ok(!p.actions.some((a) => a.kind === 'go_nhom'));
  assert.ok(p.actions.some((a) => a.kind === 'tao_user'));
  const confirmed = plan(google, many.map((e) => k(e)), [], { ...o, confirmBulk: true });
  assert.equal(confirmed.actions.filter((a) => a.kind === 'go_nhom').length, 21);
});

test('Bỏ qua tài khoản dịch vụ của Keycloak và domain ngoài công ty', () => {
  const p = plan([g('a@vcprosperous.com')], [k('a@vcprosperous.com'), { ...k('x@other.com'), username: 'x' }, { ...k(''), username: 'service-account-vc-provisioner', email: undefined }], [], o);
  assert.deepEqual(kinds(p), []);
});
