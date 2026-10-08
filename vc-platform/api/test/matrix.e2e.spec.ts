/**
 * Permission matrix (khung chung mục 9): generated from PERMISSIONS (02 mục 3). Each role alone calls one route per
 * permission; the table says 200, every "—" must be 403. Also VH-ADM-03 tiêu chí 1, 5 on sample routes.
 */
import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { accessFor, PERMISSIONS, ROLES, type Permission, type Role } from '@vc/contracts';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { Can } from '../src/auth/decorators';
import { ViewerService } from '../src/auth/viewer';
import { FakeClock } from '../src/common/clock';
import { startIssuer, userClaims, type FakeIssuer } from './util/issuer';
import { quietLog, testEnv } from './util/mongo';

const perms = Object.keys(PERMISSIONS) as Permission[];

// One GET route per permission: /api/v1/_mau/<permission>.
@Controller('v1/_mau')
class SampleController {}
for (const p of perms) {
  const key = p.replace('.', '_');
  Object.defineProperty(SampleController.prototype, key, { value: () => ({ ok: true }), writable: true });
  const d = Object.getOwnPropertyDescriptor(SampleController.prototype, key)!;
  Can(p)(SampleController.prototype, key, d);
  Get(p)(SampleController.prototype, key, d);
}

@Module({ controllers: [SampleController] })
class SampleModule {}

/** Assigned roles go in the token; derived ones (nhan_vien, quan_ly, truong_dv) are set by a test enricher. */
const ASSIGNED: Role[] = ['hcns', 'qtht', 'kiem_soat', 'bgd'];
const DERIVED: Role[] = ['nhan_vien', 'quan_ly', 'truong_dv', 'chu_app'];

let app: NestExpressApplication;
let issuer: FakeIssuer;

beforeAll(async () => {
  issuer = await startIssuer();
  const clock = new FakeClock();
  clock.set(new Date(), { running: true });
  app = await createApp({ env: testEnv({ OIDC_ISSUER: issuer.url }), clock, log: quietLog, extraModules: [SampleModule] });
  app.get(ViewerService).addEnricher(async (v) => {
    const derived = /^derived-(\w+)$/.exec(v.sub)?.[1] as Role | undefined;
    if (derived) v.roles.add(derived);
  });
  await app.init();
});
afterAll(async () => {
  await app.close();
  await issuer.close();
});

const cases = ROLES.flatMap((role) => perms.map((p) => [role, p, accessFor(p, [role]) ? 200 : 403] as const));

test.each(cases)('%s gọi %s → %i', async (role, permission, expected) => {
  const claims = ASSIGNED.includes(role) ? userClaims(`assigned-${role}`, [role]) : DERIVED.includes(role) ? userClaims(`derived-${role}`) : {};
  const res = await request(app.getHttpServer()).get(`/api/v1/_mau/${permission}`).set('Authorization', `Bearer ${await issuer.token(claims)}`);
  expect(res.status).toBe(expected);
  if (expected === 403) expect(res.body).toEqual({ code: 'forbidden', message: 'Bạn không có quyền thực hiện thao tác này.' });
});

test('VH-ADM-03 tiêu chí 1: có hcns trong cấu hình VC ID thì vào màn nhân sự; không có thì 403', async () => {
  const ok = await request(app.getHttpServer()).get('/api/v1/_mau/nhan_su.sua').set('Authorization', `Bearer ${await issuer.token(userClaims('h', ['hcns@VCPARTS']))}`);
  expect(ok.status).toBe(200);
  const no = await request(app.getHttpServer()).get('/api/v1/_mau/nhan_su.sua').set('Authorization', `Bearer ${await issuer.token(userClaims('n'))}`);
  expect(no.status).toBe(403);
});

test('VH-ADM-03 tiêu chí 5: giữ cả hcns và qtht trong token thì không dùng được vai trò nào', async () => {
  const t = await issuer.token(userClaims('xung-dot', ['hcns', 'qtht']));
  for (const p of ['nhan_su.sua', 'tai_khoan.khoa'] as const) {
    expect((await request(app.getHttpServer()).get(`/api/v1/_mau/${p}`).set('Authorization', `Bearer ${t}`)).status).toBe(403);
  }
});
