/**
 * VC Home API (B-02) with the real dev VC ID: the SPA's access token carries `aud: vchome-api` and
 * `resource_access.vchome.roles` (keycloak/vchome-roles.dev.yaml, applied by apply-vchome-roles).
 * Needs compose.dev.yml (Keycloak, MongoDB, api) and VC Home on :5173 for /api.
 */
import { createHash, randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { applyHomeRoles, HOME, KC, loginFakeGoogle, provisioner, setDirectory } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  // Users exist (pre-created by vc-provisioner) and hold their dev VC Home roles, whatever ran before.
  setDirectory();
  provisioner('sync', '--apply');
  applyHomeRoles();
});

/** Authorization code + PKCE for client vchome; the redirect to /callback is caught so the SPA does not use the code. */
async function vchomeTokens(page: Page, email: string): Promise<{ access_token: string; id_token: string }> {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const redirect = `${HOME}/callback`;
  // Playwright cannot intercept a redirect hop, so the SPA's scripts are blocked: /callback loads without using the code.
  await page.route(/\/assets\/.*\.js$/, (route) => route.abort());
  const q = new URLSearchParams({ client_id: 'vchome', redirect_uri: redirect, response_type: 'code', scope: 'openid', code_challenge: challenge, code_challenge_method: 'S256', state: 's', kc_idp_hint: 'google' });
  await page.goto(`${KC}/realms/vc/protocol/openid-connect/auth?${q}`);
  await loginFakeGoogle(page, email);
  await page.waitForURL((u) => u.href.startsWith(`${redirect}?`) && u.searchParams.has('code'));
  const callback = page.url();
  const res = await fetch(`${KC}/realms/vc/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'vchome', code: new URL(callback).searchParams.get('code')!, redirect_uri: redirect, code_verifier: verifier }),
  });
  expect(res.status).toBe(200);
  return res.json();
}

async function me(token: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${HOME}/api/v1/me`, { headers: { authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json() };
}

test('QTHT: token của VC Home dùng được cho API, có vai trò qtht và quyền tương ứng', async ({ page }) => {
  const { access_token } = await vchomeTokens(page, 'hung.qtht@vcprosperous.com');
  const claims = JSON.parse(Buffer.from(access_token.split('.')[1], 'base64url').toString());
  expect([claims.aud].flat()).toContain('vchome-api');
  expect(claims.resource_access.vchome.roles).toEqual(['qtht']);
  const r = await me(access_token);
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ email: 'hung.qtht@vcprosperous.com', home_roles: ['qtht'], role_conflicts: [] });
  expect(r.body.permissions).toEqual(expect.arrayContaining(['tai_khoan.khoa', 'nhan_su.xem']));
});

test('HC-NS theo pháp nhân: hcns@VCPARTS', async ({ page }) => {
  const { access_token } = await vchomeTokens(page, 'binh.tran@vcpart.vn');
  const r = await me(access_token);
  expect(r.body).toMatchObject({ home_roles: ['hcns@VCPARTS'], hcns_scope: ['VCPARTS'] });
  expect(r.body.permissions).toEqual(expect.arrayContaining(['nhan_su.sua', 'co_cau.sua']));
});

test('Nhân viên không giữ vai trò quản trị: không có quyền quản trị; id_token không dùng thay access token được', async ({ page }) => {
  const { access_token, id_token } = await vchomeTokens(page, 'lan.nguyen@vcprosperous.com');
  const r = await me(access_token);
  expect(r.status).toBe(200);
  expect(r.body.home_roles).toEqual([]);
  expect((await me(id_token)).status).toBe(401);
});

test('Không có token: 401 dạng lỗi chung, có X-Correlation-Id', async () => {
  const res = await fetch(`${HOME}/api/v1/me`);
  expect(res.status).toBe(401);
  expect(res.headers.get('x-correlation-id')).toBeTruthy();
  expect(await res.json()).toEqual({ code: 'unauthorized', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
});
