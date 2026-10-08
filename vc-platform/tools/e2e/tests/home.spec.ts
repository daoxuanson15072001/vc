/**
 * VC Home (SSO-03) với VC ID local và Google giả: VH-MH-01, 02, 03; UAT-SSO-01, 04, 07, 08, 20, 21, 22.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { admin, APP, deleteUserIfAny, findUser, HOME, loginFakeGoogle, provisioner, setDirectory } from './helpers';

test.describe.configure({ mode: 'serial' });

const LAN = 'lan.nguyen@vcprosperous.com';
const CHUA_2_BUOC = 'moi.chua2buoc@vcprosperous.com';
const CSKH = 'cskh.test@vcpart.vn';

test.beforeAll(async () => {
  for (const e of [CHUA_2_BUOC, CSKH]) await deleteUserIfAny('vc', e);
  setDirectory();
  provisioner('sync', '--apply');
});

// Chạy với nginx (home/scripts/nginx-local.sh) thì trang có CSP như production: không được có vi phạm nào.
const cspViolations: string[] = [];
test.beforeEach(({ page }) => {
  cspViolations.length = 0;
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text());
  });
});
test.afterEach(() => {
  expect(cspViolations).toEqual([]);
});

async function signIn(page: Page, email: string, path = '/'): Promise<void> {
  await page.goto(`${HOME}${path}`);
  await page.getByRole('button', { name: 'Đăng nhập bằng tài khoản công ty' }).click();
  await loginFakeGoogle(page, email);
}

async function expectNoSeriousA11yIssues(page: Page): Promise<void> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('Trang chào: câu đúng VH-MH-01, không lỗi truy cập nghiêm trọng', async ({ page }) => {
  await page.goto(HOME);
  await expect(page.getByRole('heading', { level: 1, name: 'VC Home' })).toBeVisible();
  await expect(page.getByText('Cổng làm việc của nhân viên VC Phồn Vinh.')).toBeVisible();
  await expect(page.getByText('Cần giúp? Gửi email tới')).toBeVisible();
  await expectNoSeriousA11yIssues(page);
});

test('UAT-SSO-01: đăng nhập từ VC Home, thấy lời chào và ô app theo nhóm; ô "Sắp có" mờ', async ({ page }) => {
  await signIn(page, LAN);
  await expect(page).toHaveURL(`${HOME}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Chào buổi (sáng|chiều|tối), Lan$/);
  const grid = page.getByTestId('luoi-app');
  await expect(grid.locator('.vh-tile-name')).toHaveText(['VClinks', 'VCwiki', /App mẫu/]);
  await expect(grid.locator('[data-app="app_mau"]')).toContainText('Thử nghiệm');
  await expect(page.locator('[data-app="vcsale"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('trang-thai')).toHaveCount(0);
  await expectNoSeriousA11yIssues(page);
});

test('Tải lại trang không phải đăng nhập lại; token chỉ nằm trong bộ nhớ', async ({ page }) => {
  await signIn(page, LAN);
  await expect(page.getByTestId('luoi-app')).toBeVisible();
  const toGoogle: string[] = [];
  page.on('request', (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame() && r.url().includes('/realms/gia-google/')) toGoogle.push(r.url());
  });
  await page.reload();
  await expect(page.getByTestId('luoi-app')).toBeVisible();
  expect(toGoogle).toEqual([]);
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toMatch(/access_token|id_token|refresh_token/);
});

test('UAT-SSO-04: bấm ô app thì vào thẳng app, không hỏi đăng nhập', async ({ page }) => {
  await signIn(page, LAN);
  await page.locator('[data-app="app_mau"] a').click();
  await expect(page).toHaveURL(new RegExp(`^${APP}`));
  await expect(page.locator('#xin-chao')).toBeVisible();
});

test('Ghim ô: lên đầu và giữ sau khi tải lại (VH-HOM-01 tiêu chí 3)', async ({ page }) => {
  await signIn(page, LAN);
  const names = page.getByTestId('luoi-app').locator('.vh-tile-name');
  await page.getByRole('button', { name: 'Tuỳ chọn cho VCwiki' }).click();
  await page.getByRole('menuitem', { name: 'Ghim lên đầu' }).click();
  await expect(names.first()).toHaveText('VCwiki');
  await page.reload();
  await expect(names.first()).toHaveText('VCwiki');
  await page.getByRole('button', { name: 'Tuỳ chọn cho VCwiki' }).click();
  await page.getByRole('menuitem', { name: 'Bỏ ghim' }).click();
  await expect(names.first()).toHaveText('VClinks');
});

test('Hồ sơ GĐ A: email, tên miền, app được dùng, nguồn Google; mở thẳng /ho-so thì đăng nhập xong về đúng trang', async ({ page }) => {
  await signIn(page, LAN, '/ho-so');
  await expect(page).toHaveURL(`${HOME}/ho-so`);
  await expect(page.getByRole('heading', { level: 1, name: 'Hồ sơ của tôi' })).toBeVisible();
  await expect(page.getByTestId('email')).toHaveText(LAN);
  await expect(page.getByText('Tên miền: vcprosperous.com')).toBeVisible();
  await expect(page.getByTestId('app-duoc-dung').getByRole('link')).toHaveText(['VClinks', 'VCwiki', 'App mẫu']);
  await expect(page.getByText('Thông tin lấy từ Google Workspace, sửa ở Google.')).toBeVisible();
  await expectNoSeriousA11yIssues(page);
});

test('UAT-SSO-08: đăng xuất ở VC Home không có trang xác nhận, mọi app mất phiên', async ({ page }) => {
  await signIn(page, LAN);
  await page.goto(APP);
  await expect(page.locator('#xin-chao')).toBeVisible();
  await page.goto(HOME);
  await page.getByRole('button', { name: /Menu tài khoản của Lan/ }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(`${HOME}/da-dang-xuat`);
  await expect(page.getByRole('heading', { level: 1, name: 'Bạn đã đăng xuất khỏi mọi ứng dụng' })).toBeVisible();
  await expect.poll(async () => (await page.request.get(`${APP}/api/me`)).status(), { timeout: 10_000 }).toBe(401);
});

test('UAT-SSO-07: đăng xuất ở app khác thì tab VC Home mất phiên trong ≤ 10 giây', async ({ page, context }) => {
  await signIn(page, LAN);
  await expect(page.getByTestId('luoi-app')).toBeVisible();
  const other = await context.newPage();
  await other.goto(APP);
  await expect(other.locator('#xin-chao')).toBeVisible();
  const { redirect } = await (await other.request.post(`${APP}/api/auth/logout`)).json();
  await other.goto(redirect);
  await other.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(`${HOME}/da-dang-xuat`, { timeout: 10_000 });
});

test('UAT-SSO-09 phía VC Home: quản trị khoá phiên ở VC ID thì tab đang dùng mất phiên ở lượt kiểm sau', async ({ page }) => {
  // Kiểm mỗi 3 giây thay vì 60 giây để ca chạy nhanh.
  await page.route('**/config.json', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), sessionCheckSeconds: 3 } });
  });
  await signIn(page, LAN);
  await expect(page.getByTestId('luoi-app')).toBeVisible();
  const u = (await findUser('vc', LAN))!;
  await admin('POST', `/vc/users/${u.id}/logout`);
  await expect(page.getByRole('heading', { level: 1, name: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('luoi-app')).toHaveCount(0);
});

test('UAT-SSO-22: chưa xét thì "đang được kiểm tra"; chưa bật 2 bước thì không có ô app và có câu hướng dẫn', async ({ page }) => {
  await signIn(page, CHUA_2_BUOC);
  await expect(page.getByTestId('trang-thai')).toContainText('Tài khoản của bạn đang được kiểm tra. Thử lại sau 15 phút');
  await expect(page.getByTestId('luoi-app')).toHaveCount(0);
  provisioner('sync', '--apply');
  await page.reload();
  await expect(page.getByTestId('trang-thai')).toContainText('chưa bật xác thực 2 bước nên chưa vào được ứng dụng');
  await expect(page.getByTestId('luoi-app')).toHaveCount(0);
});

test('UAT-SSO-21: hộp thư dùng chung vào được VC Home, không có ô app, câu "tài khoản dùng chung"', async ({ page }) => {
  await signIn(page, CSKH);
  provisioner('sync', '--apply');
  await page.reload();
  await expect(page.getByTestId('trang-thai')).toContainText('Tài khoản này là tài khoản dùng chung hoặc tài khoản dịch vụ');
  await expect(page.getByTestId('luoi-app')).toHaveCount(0);
  await expect(page.locator('[data-app="vcsale"]')).toBeVisible();
});

test('Trang lỗi theo mã: câu, nút phụ, mã kèm giờ; mã lạ dùng câu chung', async ({ page }) => {
  await page.goto(`${HOME}/loi?ma=outside_domain`);
  await expect(page.getByRole('heading', { level: 1, name: 'Tài khoản này không thuộc công ty' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chọn tài khoản khác' })).toBeVisible();
  await expect(page.locator('#ma-loi')).toHaveText(/^Mã: outside_domain · \d{2}:\d{2} \d{2}\/\d{2}\/\d{4}$/);
  await expectNoSeriousA11yIssues(page);
  await page.goto(`${HOME}/loi?ma=app_not_granted`);
  await expect(page.getByRole('link', { name: 'Về trang chủ' })).toBeVisible();
  await page.goto(`${HOME}/loi?ma=<script>`);
  await expect(page.getByRole('heading', { level: 1, name: 'Có lỗi khi đăng nhập' })).toBeVisible();
  await expect(page.locator('#ma-loi')).toContainText('Mã: loi_chung');
  await page.goto(`${HOME}/khong-co-trang-nay`);
  await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveCSS('background-color', 'rgb(10, 87, 208)');
});

test('Chọn tài khoản khác: VC ID bỏ phiên cũ và hỏi lại Google', async ({ page }) => {
  await signIn(page, LAN);
  await expect(page.getByTestId('luoi-app')).toBeVisible();
  await page.goto(`${HOME}/loi?ma=outside_domain`);
  await page.getByRole('button', { name: 'Chọn tài khoản khác' }).click();
  // Google giả (Keycloak) nhận prompt=login: hỏi lại mật khẩu của tài khoản cũ, nút "Restart login" để đổi tài khoản
  // (Google thật hiện danh sách tài khoản vì IdP đặt prompt=select_account).
  await expect(page.getByText('Please re-authenticate to continue')).toBeVisible();
  await page.getByRole('button', { name: 'Restart login' }).click();
  await loginFakeGoogle(page, 'binh.tran@vcpart.vn');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/, Bình$/);
});

test.describe('Điện thoại 375 px (UAT-SSO-20)', () => {
  test.use({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });

  test('Lưới 1 cột, không cuộn ngang, vùng bấm ≥ 44 px', async ({ page }) => {
    await signIn(page, LAN);
    const tiles = page.getByTestId('luoi-app').locator('.vh-tile');
    await expect(tiles).toHaveCount(3);
    const xs = await tiles.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
    expect(new Set(xs).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const h = await tiles.first().locator('a').evaluate((e) => e.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(44);
    await expectNoSeriousA11yIssues(page);
  });
});
