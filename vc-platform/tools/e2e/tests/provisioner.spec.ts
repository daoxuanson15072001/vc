/**
 * vc-provisioner chạy thật với Keycloak local và Directory giả: UAT-SSO-09, 10, 21, 22, 23 (thiết kế SSO mục 9.2).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { APP, appState, deleteUserIfAny, findUser, loginFakeGoogle } from './helpers';

test.describe.configure({ mode: 'serial' });

const PROV = resolve(__dirname, '../../../provisioner');
const tmp = mkdtempSync(join(tmpdir(), 'vc-prov-'));
const directoryFile = join(tmp, 'directory.json');
const baseDirectory = JSON.parse(readFileSync(join(PROV, 'fixtures/directory.dev.json'), 'utf8')) as any[];

function provisioner(...args: string[]): string {
  return execFileSync('npx', ['tsx', 'src/cli.ts', ...args], {
    cwd: PROV,
    env: { ...process.env, DIRECTORY_FILE: directoryFile, PROVISIONER_STATE_FILE: join(tmp, 'state.json') },
    encoding: 'utf8',
  });
}
function setDirectory(change: (rows: any[]) => any[] = (r) => r): void {
  writeFileSync(directoryFile, JSON.stringify(change(structuredClone(baseDirectory))));
}
async function openApp(page: Page, email: string): Promise<void> {
  await page.goto(APP);
  await loginFakeGoogle(page, email);
}
const PEOPLE = ['lan.nguyen@vcprosperous.com', 'hung.qtht@vcprosperous.com', 'cskh.test@vcpart.vn', 'moi.chua2buoc@vcprosperous.com', 'da.nghi@vcprosperous.com', 'nguoi.moi@vcpart.vn'];

test.beforeAll(async () => {
  for (const e of PEOPLE) await deleteUserIfAny('vc', e);
  setDirectory();
  provisioner('sync', '--apply');
});

test('UAT-SSO-23: người mới đủ điều kiện được tạo sẵn, lần đầu đăng nhập có ngay nhóm app', async ({ page }) => {
  const pre = await findUser('vc', 'nguoi.moi@vcpart.vn');
  expect(pre?.attributes?.vc_trang_thai).toEqual(['du_dieu_kien']);
  await openApp(page, 'nguoi.moi@vcpart.vn');
  await expect(page.locator('#xin-chao')).toBeVisible();
  const me = await (await page.request.get(`${APP}/api/me`)).json();
  expect(me.sub).toBe(pre!.id);
  expect(me.claims.groups).toEqual(expect.arrayContaining(['app-vclinks', 'app-vcwiki', 'app-app-mau']));
});

test('UAT-SSO-21: hộp thư dùng chung vào được VC ID nhưng không có nhóm app, trạng thái loai_tru', async ({ page }) => {
  await openApp(page, 'cskh.test@vcpart.vn');
  await expect(page.locator('#ma-loi')).toHaveText('app_not_granted');
  provisioner('sync', '--apply');
  expect((await findUser('vc', 'cskh.test@vcpart.vn'))?.attributes?.vc_trang_thai).toEqual(['loai_tru']);
});

test('UAT-SSO-22: chưa bật 2 bước thì không vào app; bật xong, lượt đồng bộ sau có nhóm app', async ({ page }) => {
  await openApp(page, 'moi.chua2buoc@vcprosperous.com');
  await expect(page.locator('#ma-loi')).toHaveText('app_not_granted');
  provisioner('sync', '--apply');
  expect((await findUser('vc', 'moi.chua2buoc@vcprosperous.com'))?.attributes?.vc_trang_thai).toEqual(['chua_bat_2_buoc']);
  setDirectory((rows) => rows.map((r) => (r.email.startsWith('moi.chua2buoc') ? { ...r, isEnrolledIn2Sv: true } : r)));
  provisioner('sync', '--apply');
  await page.context().clearCookies();
  await openApp(page, 'moi.chua2buoc@vcprosperous.com');
  await expect(page.locator('#xin-chao')).toBeVisible();
  setDirectory();
});

test('UAT-SSO-10: tài khoản bị khoá trên Google thì VC ID khoá, không đăng nhập lại được', async ({ page }) => {
  // Google giả vẫn cho đăng nhập (không biết trạng thái Directory), nên tạo được user để thử khoá.
  await openApp(page, 'da.nghi@vcprosperous.com');
  await expect(page.locator('#ma-loi')).toHaveText('app_not_granted');
  provisioner('sync', '--apply');
  const u = await findUser('vc', 'da.nghi@vcprosperous.com');
  expect(u?.enabled).toBe(false);
  expect(u?.attributes?.vc_khoa).toEqual(['google']);
  await page.context().clearCookies();
  await openApp(page, 'da.nghi@vcprosperous.com');
  await expect(page.getByText('Tài khoản đã bị khoá. Liên hệ quản trị viên.')).toBeVisible();
});

test('UAT-SSO-09: khoá khẩn cấp thì mọi app mất phiên trong vài giây, mở khoá thì vào lại được', async ({ page }) => {
  await openApp(page, 'lan.nguyen@vcprosperous.com');
  await expect(page.locator('#xin-chao')).toBeVisible();
  const lan = (await findUser('vc', 'lan.nguyen@vcprosperous.com'))!;
  // Đếm theo sub: app mẫu có thể còn phiên của user cùng email đã bị xoá ở lượt chạy trước.
  expect((await appState()).sessions.filter((s) => s.sub === lan.id).length).toBeGreaterThan(0);
  provisioner('disable', 'lan.nguyen@vcprosperous.com', '--reason', 'Thử UAT-SSO-09');
  await expect.poll(async () => (await appState()).sessions.filter((s) => s.sub === lan.id).length, { timeout: 10_000 }).toBe(0);
  await page.context().clearCookies();
  await openApp(page, 'lan.nguyen@vcprosperous.com');
  await expect(page.getByText('Tài khoản đã bị khoá. Liên hệ quản trị viên.')).toBeVisible();
  provisioner('enable', 'lan.nguyen@vcprosperous.com');
  await page.context().clearCookies();
  await openApp(page, 'lan.nguyen@vcprosperous.com');
  await expect(page.locator('#xin-chao')).toBeVisible();
});

test('Báo cáo "ai được vào app" cho chủ dự án duyệt (I9)', () => {
  const r = JSON.parse(provisioner('report', '--json'));
  expect(r.statuses.du_dieu_kien).toEqual(expect.arrayContaining(['lan.nguyen@vcprosperous.com', 'nguoi.moi@vcpart.vn']));
  expect(r.statuses.loai_tru).toEqual(['cskh.test@vcpart.vn']);
  expect(r.statuses.bi_khoa).toEqual(['da.nghi@vcprosperous.com']);
});
