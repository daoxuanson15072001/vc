import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Db } from 'mongodb';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { FakeClock } from '../src/common/clock';
import { C } from '../src/db/collections';
import { DB } from '../src/db/mongo';
import { startIssuer, userClaims, type FakeIssuer } from './util/issuer';
import { quietLog, testEnv } from './util/mongo';

let app: NestExpressApplication;
let issuer: FakeIssuer;
const clock = new FakeClock();
const me = (token?: string) => {
  const r = request(app.getHttpServer()).get('/api/v1/me');
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};

beforeAll(async () => {
  issuer = await startIssuer();
  clock.set(new Date(), { running: true });
  app = await createApp({ env: testEnv({ OIDC_ISSUER: issuer.url }), clock, log: quietLog });
  await app.init();
});
afterAll(async () => {
  await app.close();
  await issuer.close();
});

test('Không có token, token sai chữ ký, sai issuer, thiếu aud vchome-api: 401 câu LOI-PHIEN', async () => {
  const no = await me().expect(401);
  expect(no.body).toEqual({ code: 'unauthorized', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  await me(await issuer.token(userClaims('a'), { key: 'other' })).expect(401);
  await me(await issuer.token({ ...userClaims('a'), iss: 'http://khac/realms/vc' })).expect(401);
  await me(await issuer.token({ ...userClaims('a'), aud: 'account' })).expect(401);
  await me('khong.phai.jwt').expect(401);
});

test('id_token (typ ID) không dùng thay access token được', async () => {
  await me(await issuer.token({ ...userClaims('a'), typ: 'ID' })).expect(401);
});

test('Hết hạn: lệch đồng hồ ≤ 60 giây vẫn nhận, quá thì 401', async () => {
  const now = Math.floor(clock.now().getTime() / 1000);
  await me(await issuer.token(userClaims('a'), { iat: now - 400, exp: now - 30 })).expect(200);
  await me(await issuer.token(userClaims('a'), { iat: now - 400, exp: now - 90 })).expect(401);
});

test('Token máy (azp không phải vchome) vào API nội bộ: 403', async () => {
  await me(await issuer.token({ sub: 'service-account-vclinks-service', azp: 'vclinks-service' })).expect(403);
});

test('GET /api/v1/me: vai trò từ resource_access.vchome.roles, quyền tính theo 02 mục 3, ngày Việt Nam', async () => {
  const res = await me(await issuer.token(userClaims('qt1', ['qtht', 'vai_tro_la']))).expect(200);
  expect(res.body).toMatchObject({ sub: 'qt1', account_linked: false, home_roles: ['qtht'], hcns_scope: null, roles: ['qtht'], role_conflicts: [] });
  expect(res.body.permissions).toEqual(expect.arrayContaining(['tai_khoan.khoa', 'nhap.xac_nhan', 'nhan_su.xem']));
  expect(res.body.permissions).not.toContain('nhan_su.sua');
  expect(res.body.today_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('HC-NS theo phạm vi: hcns@VCPARTS là phạm vi pháp nhân; hcns là toàn tập đoàn', async () => {
  const scoped = await me(await issuer.token(userClaims('hc1', ['hcns@VCPARTS', 'hcns@VCP']))).expect(200);
  expect(scoped.body.hcns_scope).toEqual(['VCPARTS', 'VCP']);
  const all = await me(await issuer.token(userClaims('hc2', ['hcns', 'hcns@VCPARTS']))).expect(200);
  expect(all.body.hcns_scope).toBe('all');
});

test('Tách nhiệm: token có cả hcns và qtht thì bỏ cả hai, báo xung đột (mục 3.4 điểm 6)', async () => {
  const res = await me(await issuer.token(userClaims('x1', ['hcns@VCPARTS', 'qtht', 'bgd']))).expect(200);
  expect(res.body.home_roles).toEqual(['bgd']);
  expect(res.body.role_conflicts).toEqual(['hcns+qtht']);
  expect(res.body.permissions).toEqual([]);
});

test('Tài khoản đã gắn hồ sơ có vai trò nhân viên (cache 60 giây theo sub)', async () => {
  await app.get<Db>(DB).collection(C.accounts).insertOne({ _id: 'nv1' as never, person_id: 'p-0001', employee_code: 'VCP0001' });
  const res = await me(await issuer.token(userClaims('nv1'))).expect(200);
  expect(res.body).toMatchObject({ person_id: 'p-0001', employee_code: 'VCP0001', account_linked: true, roles: ['nhan_vien'] });
  expect(res.body.permissions).toEqual(expect.arrayContaining(['ho_so.xem_cua_minh', 'danh_ba.xem', 'nhat_ky.xem']));
});

test('Không kết nối được VC ID để lấy khoá: 503 câu dễ hiểu', async () => {
  const other = await createApp({ env: testEnv({ OIDC_ISSUER: 'http://127.0.0.1:9/realms/vc' }), clock, log: quietLog });
  await other.init();
  try {
    const res = await request(other.getHttpServer()).get('/api/v1/me').set('Authorization', `Bearer ${await issuer.token(userClaims('a'))}`).expect(503);
    expect(res.body.code).toBe('idp_unreachable');
  } finally {
    await other.close();
  }
});

test('/api/health không cần token', async () => {
  await request(app.getHttpServer()).get('/api/health').expect(200);
});
