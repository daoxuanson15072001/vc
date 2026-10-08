import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comingSoon, myApps, type CatalogApp } from '../src/lib/catalog';
import { authErrorCode, errorText, greeting, safeNext, stamp, statusNotice } from '../src/lib/messages';

const a = (key: string, x: Partial<CatalogApp> = {}): CatalogApp => ({
  key,
  name: key,
  description: '',
  url: `https://${key}.vcprosperous.com/`,
  icon: `/icons/${key}.svg`,
  group: `app-${key}`,
  status: 'live',
  order: 10,
  ...x,
});
const apps = [a('vclinks', { order: 10 }), a('vcwiki', { order: 20, status: 'beta' }), a('vcsale', { order: 30, status: 'coming_soon', url: null }), a('cu', { status: 'retired' }), a('vchome', { order: 1 })];

test('Ô app: chỉ live/beta có nhóm trong token; không có VC Home, app ngừng, app sắp có (VH-HOM-01)', () => {
  assert.deepEqual(myApps(apps, ['app-vclinks', 'app-vcwiki', 'app-vcsale', 'app-cu', 'app-vchome']).map((x) => x.key), ['vclinks', 'vcwiki']);
  assert.deepEqual(myApps(apps, ['app-vclinks']).map((x) => x.key), ['vclinks']);
  assert.deepEqual(myApps(apps, []), []);
  assert.deepEqual(comingSoon(apps).map((x) => x.key), ['vcsale']);
});

test('Ô đã ghim đứng trước theo thứ tự ghim, rồi theo thứ tự quản trị', () => {
  const g = ['app-vclinks', 'app-vcwiki'];
  assert.deepEqual(myApps(apps, g, ['vcwiki']).map((x) => x.key), ['vcwiki', 'vclinks']);
  assert.deepEqual(myApps(apps, g, ['khong-con', 'vclinks']).map((x) => x.key), ['vclinks', 'vcwiki']);
});

test('Câu trạng thái theo vc_trang_thai (VH-MH-02)', () => {
  assert.equal(statusNotice('du_dieu_kien', 'it@x'), undefined);
  assert.match(statusNotice('chua_bat_2_buoc', 'it@x')!.text, /chưa bật xác thực 2 bước/);
  assert.match(statusNotice('loai_tru', 'it@x')!.text, /tài khoản dùng chung hoặc tài khoản dịch vụ/);
  assert.match(statusNotice(undefined, 'it@vcprosperous.com')!.text, /đang được kiểm tra.*it@vcprosperous\.com/);
});

test('Lời chào theo giờ Việt Nam', () => {
  assert.equal(greeting(new Date('2026-10-08T04:59:00Z'), 'Lan'), 'Chào buổi sáng, Lan'); // 11:59
  assert.equal(greeting(new Date('2026-10-08T05:00:00Z'), 'Lan'), 'Chào buổi chiều, Lan'); // 12:00
  assert.equal(greeting(new Date('2026-10-08T10:59:00Z'), 'Lan'), 'Chào buổi chiều, Lan'); // 17:59
  assert.equal(greeting(new Date('2026-10-08T11:00:00Z'), 'Lan'), 'Chào buổi tối, Lan'); // 18:00
  assert.equal(stamp(new Date('2026-10-08T01:42:00Z')), '08:42 08/10/2026');
});

test('next chỉ nhận đường dẫn trong VC Home', () => {
  assert.equal(safeNext('/ho-so'), '/ho-so');
  assert.equal(safeNext('/ho-so?tab=phien'), '/ho-so?tab=phien');
  for (const bad of ['https://evil.example/', '//evil.example', '/\\evil.example', 'ho-so', '/callback?code=x', '/loi?ma=x', '/da-dang-xuat', undefined, 42]) {
    assert.equal(safeNext(bad), '/', String(bad));
  }
});

test('Mã lỗi: câu theo bảng, mã lạ dùng câu chung', () => {
  assert.equal(errorText('outside_domain').secondary, 'select_account');
  assert.equal(errorText('app_not_granted').secondary, 'home');
  assert.equal(errorText('khong_co').title, 'Có lỗi khi đăng nhập');
  assert.equal(authErrorCode({ error: 'access_denied' }), 'cancelled');
  assert.equal(authErrorCode(new Error('No matching state found in storage')), 'state_invalid');
  assert.equal(authErrorCode(new TypeError('Failed to fetch')), 'idp_unreachable');
  assert.equal(authErrorCode({ error: 'server_error' }), 'loi_chung');
});
