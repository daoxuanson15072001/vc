import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { APP_CODE, ERRORS, errorMessage } from '../src/errors.js';

test('Câu lỗi chuẩn của 06 mục 1.4; mã lỗi máy chủ là 6 ký tự đầu mã yêu cầu', () => {
  assert.equal(ERRORS.forbidden.message, 'Bạn không có quyền thực hiện thao tác này.');
  assert.equal(ERRORS.conflict_rev.status, 409);
  assert.equal(errorMessage('server_error', '3f9c11ab20c4'), 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút. Mã lỗi: 3f9c11.');
  assert.equal(APP_CODE.unauthorized, 'invalid_token');
  for (const code of Object.keys(ERRORS)) assert.ok(APP_CODE[code as keyof typeof ERRORS], code);
});

test('JSON Schema gửi đội app khớp schema zod (chạy json-schema khi đổi)', () => {
  execFileSync('npx', ['tsx', 'scripts/gen-json-schema.ts', '--check'], { cwd: process.cwd(), stdio: 'pipe' });
});
