/**
 * SSO-00 (thiết kế SSO mục 8): thử kỹ thuật Keycloak với Google giả. Mỗi ca ứng với một điểm cần kiểm.
 * Điểm (1) Google nhận 2 hosted domain chỉ kiểm được với Google thật (cần I3); ở đây kiểm lớp chặn domain của VC ID.
 */
import { expect, test } from '@playwright/test';
import { addToGroup, admin, APP, appState, deleteUserIfAny, findUser, KC, loginFakeGoogle } from './helpers';

test.describe.configure({ mode: 'serial' });

const LAN = 'lan.nguyen@vcprosperous.com';
const BINH = 'binh.tran@vcpart.vn';
const GMAIL = 'an.canhan@gmail.com';

test.beforeAll(async () => {
  // Bắt đầu sạch: xoá user đã có ở realm vc (lần chạy trước), giữ user của Google giả.
  for (const e of [LAN, BINH, GMAIL]) await deleteUserIfAny('vc', e);
});

test('(2) kc_idp_hint: vào thẳng trang Google, không qua trang đăng nhập của VC ID', async ({ page }) => {
  await page.goto(APP);
  await expect(page).toHaveURL(/\/realms\/gia-google\/protocol\/openid-connect\/auth/);
});

test('Lần đầu chưa có nhóm app: app từ chối app_not_granted (D-BA-37: không có nhóm mặc định)', async ({ page }) => {
  await page.goto(APP);
  await loginFakeGoogle(page, LAN);
  await expect(page.locator('#ma-loi')).toHaveText('app_not_granted');
  const u = await findUser('vc', LAN);
  expect(u, 'đăng nhập lần đầu tạo user ở VC ID').toBeTruthy();
  expect(u!.attributes?.hd).toEqual(['vcprosperous.com']);
});

test('(3) Có nhóm app: vào được, token có sub, email, hd, groups, sid', async ({ page }) => {
  const u = (await findUser('vc', LAN))!;
  await addToGroup('vc', u.id, 'app-app-mau');
  await page.goto(APP);
  await loginFakeGoogle(page, LAN);
  await expect(page.locator('#xin-chao')).toContainText('Lan');
  const me = await (await page.request.get(`${APP}/api/me`)).json();
  expect(me.sub).toBe(u.id);
  expect(me.claims.email).toBe(LAN);
  expect(me.claims.email_verified).toBe(true);
  expect(me.claims.hd).toBe('vcprosperous.com');
  expect(me.claims.groups).toContain('app-app-mau');
  expect(me.sid).toBeTruthy();
});

test('Phiên chung: mở app lần nữa trong phiên khác của app không hỏi lại Google', async ({ page, context }) => {
  // Đăng nhập một lần rồi xoá cookie của app (giả như mở app thứ hai): VC ID còn phiên nên trả code ngay.
  await page.goto(APP);
  await loginFakeGoogle(page, LAN);
  await expect(page.locator('#xin-chao')).toBeVisible();
  const cookies = (await context.cookies()).filter((c) => !c.domain.includes('localhost') || c.name !== 'app_mau_session');
  await context.clearCookies();
  await context.addCookies(cookies);
  await page.goto(APP);
  await expect(page.locator('#xin-chao')).toBeVisible();
});

test('(4) Đăng xuất phía máy chủ: khoá phiên ở VC ID thì app nhận logout_token và huỷ phiên theo sid', async ({ page }) => {
  await page.goto(APP);
  await loginFakeGoogle(page, LAN);
  await expect(page.locator('#xin-chao')).toBeVisible();
  const u = (await findUser('vc', LAN))!;
  // Đếm theo sub: app mẫu có thể còn phiên của user cùng email đã bị xoá ở lượt chạy trước.
  const before = (await appState()).sessions.filter((s) => s.sub === u.id).length;
  expect(before).toBeGreaterThan(0);
  await admin('POST', `/vc/users/${u.id}/logout`);
  await expect.poll(async () => (await appState()).sessions.filter((s) => s.sub === u.id).length, { timeout: 10_000 }).toBe(0);
  const ev = (await appState()).events.filter((e) => e.type === 'backchannel_logout');
  expect(ev.length).toBeGreaterThan(0);
  expect((await page.request.get(`${APP}/api/me`)).status()).toBe(401);
});

test('Đăng xuất từ app: trang xác nhận tiếng Việt "Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?"', async ({ page }) => {
  await page.goto(APP);
  await loginFakeGoogle(page, LAN);
  await expect(page.locator('#xin-chao')).toBeVisible();
  const { redirect } = await (await page.request.post(`${APP}/api/auth/logout`)).json();
  await page.goto(redirect);
  await expect(page.getByText('Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?')).toBeVisible();
  // VC Home có thể chưa chạy: chỉ cần trình duyệt được chuyển tới trang "đã đăng xuất" của VC Home.
  const toHome = page.waitForRequest(/\/da-dang-xuat/);
  await page.locator('#kc-logout').click();
  await toHome;
});

test('Gmail cá nhân bị chặn ở VC ID với câu tiếng Việt, không tạo user', async ({ page }) => {
  await page.goto(APP);
  await loginFakeGoogle(page, GMAIL);
  await expect(page.getByText('Tài khoản này không thuộc công ty')).toBeVisible();
  // Trang lỗi của theme vc (thiết kế SSO 5.1.6): nút chọn tài khoản khác, thời điểm để báo IT.
  await expect(page.getByRole('link', { name: 'Chọn tài khoản khác' })).toBeVisible();
  await expect(page.locator('#vc-thoi-diem')).toHaveText(/^Thời điểm: \d{2}:\d{2} \d{2}\/\d{2}\/\d{4}/);
  expect(await findUser('vc', GMAIL)).toBeUndefined();
});

test('Trang đăng nhập VC ID chuyển thẳng sang Google, không có form mật khẩu', async ({ page }) => {
  const q = new URLSearchParams({
    client_id: 'vchome',
    redirect_uri: `${process.env.VCHOME_URL ?? 'http://localhost:5173'}/callback`,
    response_type: 'code',
    scope: 'openid',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
  });
  await page.goto(`${KC}/realms/vc/protocol/openid-connect/auth?${q}`);
  await expect(page).toHaveURL(/\/realms\/gia-google\//);
});

test('Đăng xuất thẳng ở VC ID (không có app gửi về): "Bạn đã đăng xuất." và link về VC Home', async ({ page }) => {
  await page.goto(APP);
  await loginFakeGoogle(page, LAN);
  await expect(page.locator('#xin-chao')).toBeVisible();
  await page.goto(`${KC}/realms/vc/protocol/openid-connect/logout`);
  await page.locator('#kc-logout').click();
  await expect(page.getByRole('heading', { name: 'Bạn đã đăng xuất.' })).toBeVisible();
  await expect(page.getByText('Phiên ở VC Home, VClinks, VCwiki và các ứng dụng khác đã đóng.')).toBeVisible();
  await expect(page.getByRole('link', { name: '« Về VC Home' })).toHaveAttribute('href', process.env.VCHOME_URL ?? 'http://localhost:5173');
});

test('(8) Tạo sẵn user có liên kết Google: đăng nhập vào thẳng user đó, không tạo user mới', async ({ page }) => {
  const g = (await admin<any[]>('GET', `/gia-google/users?email=${encodeURIComponent(BINH)}&exact=true`))[0];
  const id = await (async () => {
    await admin('POST', '/vc/users', {
      username: BINH,
      email: BINH,
      emailVerified: true,
      enabled: true,
      firstName: 'Bình',
      lastName: 'Trần Văn',
      attributes: { hd: ['vcpart.vn'], vc_trang_thai: ['du_dieu_kien'] },
      federatedIdentities: [{ identityProvider: 'google', userId: g.id, userName: BINH }],
      groups: ['app-app-mau'],
    });
    return (await findUser('vc', BINH))!.id as string;
  })();
  await page.goto(APP);
  await loginFakeGoogle(page, BINH);
  await expect(page.locator('#xin-chao')).toContainText('Bình');
  const me = await (await page.request.get(`${APP}/api/me`)).json();
  expect(me.sub).toBe(id);
  expect(me.claims.vc_trang_thai).toBe('du_dieu_kien');
  const all = await admin<any[]>('GET', `/vc/users?email=${encodeURIComponent(BINH)}`);
  expect(all).toHaveLength(1);
});

test('(7) Mapper vh_roles kiểu JSON nhiều giá trị ra mảng đối tượng {role, unit}', async ({ page }) => {
  const u = (await findUser('vc', BINH))!;
  await admin('PUT', `/vc/users/${u.id}`, {
    ...u,
    attributes: {
      ...u.attributes,
      'vh_roles_app-mau': [JSON.stringify({ role: 'nvkd', unit: 'VCP-TBH1' }), JSON.stringify({ role: 'cskh', unit: 'VCS-CSKH' })],
    },
  });
  await admin('POST', `/vc/users/${u.id}/logout`);
  await page.goto(APP);
  await loginFakeGoogle(page, BINH);
  const me = await (await page.request.get(`${APP}/api/me`)).json();
  expect(me.claims.vh_roles).toEqual([
    { role: 'nvkd', unit: 'VCP-TBH1' },
    { role: 'cskh', unit: 'VCS-CSKH' },
  ]);
});

test('Nhật ký sự kiện VC ID ghi LOGIN theo client (dùng cho VH-ADM-06)', async () => {
  const ev = await admin<any[]>('GET', `/vc/events?type=LOGIN&client=app-mau&max=5`);
  expect(ev.length).toBeGreaterThan(0);
  expect(ev[0].clientId).toBe('app-mau');
  void KC;
});
