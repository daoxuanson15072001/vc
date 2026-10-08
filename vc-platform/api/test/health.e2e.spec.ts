import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { FakeClock } from '../src/common/clock';
import { JobRunner } from '../src/jobs/runner';
import { quietLog, testEnv } from './util/mongo';

let app: NestExpressApplication;
const clock = new FakeClock(new Date('2026-11-02T01:00:00Z'));
beforeAll(async () => {
  app = await createApp({ env: testEnv({ BODY_LIMIT: '2kb', APP_VERSION: '0.1.0' }), clock, log: quietLog });
  // A route that fails, to check the 500 shape.
  app.getHttpAdapter().get('/api/v1/_thu/loi', () => {
    throw new Error('lỗi nội bộ có chi tiết nhạy cảm');
  });
  await app.init();
});
afterAll(() => app.close());

test('GET /api/health: 200, có trạng thái MongoDB replica set và nhịp job (B-01 xong khi)', async () => {
  await app.get(JobRunner).tick();
  const res = await request(app.getHttpServer()).get('/api/health').expect(200);
  expect(res.body).toMatchObject({
    status: 'ok',
    app_env: 'test',
    version: '0.1.0',
    time: '2026-11-02T01:00:00.000Z',
    mongo: { ok: true, replica_set: 'testset', writable_primary: true },
    jobs: { enabled: false, last_heartbeat_at: '2026-11-02T01:00:00.000Z' },
  });
  expect(res.headers['cache-control']).toBe('no-store');
});

test('X-Correlation-Id: trả lại mã của bên gọi; không có hoặc không an toàn thì tự sinh', async () => {
  const given = await request(app.getHttpServer()).get('/api/health').set('X-Correlation-Id', 'c-20261121-0812-11ab');
  expect(given.headers['x-correlation-id']).toBe('c-20261121-0812-11ab');
  const bad = await request(app.getHttpServer()).get('/api/health').set('X-Correlation-Id', '<script>');
  expect(bad.headers['x-correlation-id']).toMatch(/^[0-9a-f]{16}$/);
});

test('Lỗi API nội bộ: {code, message}; lỗi API cho app: {error: {code, message, correlation_id}}', async () => {
  const internal = await request(app.getHttpServer()).get('/api/v1/me/khong-co').expect(404);
  expect(internal.body).toEqual({ code: 'not_found', message: 'Không tìm thấy dữ liệu. Có thể đã bị xoá hoặc bạn không còn quyền xem.' });
  const forApp = await request(app.getHttpServer()).get('/api/v1/people/VCP9999').set('X-Correlation-Id', 'c-thu-1').expect(404);
  expect(forApp.body).toEqual({ error: { code: 'not_found', message: 'Không tìm thấy dữ liệu. Có thể đã bị xoá hoặc bạn không còn quyền xem.', correlation_id: 'c-thu-1' } });
});

test('Lỗi máy chủ không lộ chi tiết, câu có 6 ký tự đầu mã yêu cầu (LOI-MAY)', async () => {
  const res = await request(app.getHttpServer()).get('/api/v1/_thu/loi').set('X-Correlation-Id', 'abcdef123456').expect(500);
  expect(res.body).toEqual({ code: 'server_error', message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút. Mã lỗi: abcdef.' });
});

test('Thân quá giới hạn là 413; JSON hỏng là 400, cùng dạng lỗi', async () => {
  const big = await request(app.getHttpServer()).post('/api/health').set('content-type', 'application/json').send(JSON.stringify({ x: 'a'.repeat(5000) }));
  expect(big.status).toBe(413);
  expect(big.body).toEqual({ code: 'payload_too_large', message: 'Tệp hoặc dữ liệu gửi lên quá lớn.' });
  const broken = await request(app.getHttpServer()).post('/api/health').set('content-type', 'application/json').send('{"x":');
  expect(broken.status).toBe(400);
  expect(broken.body.code).toBe('bad_request');
  expect(broken.headers['x-correlation-id']).toBeTruthy();
});
