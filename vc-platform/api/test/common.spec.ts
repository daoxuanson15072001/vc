import { NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { ApiError } from '../src/common/api-error';
import { decodeCursor, encodeCursor, parseLimit } from '../src/common/cursor';
import { isAppRoute, normalizeError } from '../src/common/http';
import { assertRev } from '../src/common/rev';

test('Con trỏ phân trang: mã hoá rồi giải được; con trỏ hỏng là 400', () => {
  const c = encodeCursor(['Nguyễn Thị Lan', '6702a1b2c3d4e5f6a7b8c9d0']);
  expect(decodeCursor(c)).toEqual(['Nguyễn Thị Lan', '6702a1b2c3d4e5f6a7b8c9d0']);
  expect(decodeCursor(undefined)).toBeUndefined();
  expect(() => decodeCursor('khong-phai-json')).toThrow(ApiError);
  expect(() => decodeCursor(encodeCursor({ a: 1 } as unknown as unknown[]))).toThrow('Con trỏ');
});

test('Số dòng mỗi trang: mặc định 50, tối đa 200', () => {
  expect(parseLimit(undefined)).toBe(50);
  expect(parseLimit('200')).toBe(200);
  expect(() => parseLimit('201')).toThrow('từ 1 đến 200');
  expect(() => parseLimit('abc')).toThrow(ApiError);
});

test('rev lệch là 409 LOI-409; thiếu rev là 400; không có bản ghi là 404', () => {
  expect(() => assertRev({ rev: 3 }, 3)).not.toThrow();
  const e = (() => {
    try {
      assertRev({ rev: 4 }, 3);
    } catch (x) {
      return x as ApiError;
    }
  })();
  expect(e?.status).toBe(409);
  expect(e?.message).toBe('Dữ liệu vừa được người khác thay đổi. Tải lại để xem bản mới nhất.');
  expect(() => assertRev({ rev: 1 }, undefined)).toThrow('rev');
  expect(() => assertRev(null, 1)).toThrow(expect.objectContaining({ code: 'not_found' }));
});

test('Lỗi đổi thành mã chung; lỗi lạ không lộ chi tiết, có 6 ký tự mã yêu cầu', () => {
  expect(normalizeError(new NotFoundException(), 'abc')).toMatchObject({ code: 'not_found', status: 404 });
  const zod = normalizeError(z.object({ ten: z.string() }).safeParse({}).error, 'abc');
  expect(zod).toMatchObject({ code: 'bad_request', status: 400, details: [{ path: 'ten' }] });
  expect(normalizeError(new Error('mật khẩu db sai'), '3f9c11ab20c4')).toEqual({
    code: 'server_error',
    status: 500,
    message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút. Mã lỗi: 3f9c11.',
  });
});

test('Đường dẫn của API cho app (07 mục 5.1)', () => {
  expect(isAppRoute('/api/v1/people')).toBe(true);
  expect(isAppRoute('/api/v1/people/VCP0123')).toBe(true);
  expect(isAppRoute('/api/v1/org-units/VCP-KD')).toBe(true);
  expect(isAppRoute('/api/v1/apps/vclinks/grants')).toBe(true);
  expect(isAppRoute('/api/v1/me')).toBe(false);
  expect(isAppRoute('/api/v1/peoplex')).toBe(false);
  expect(isAppRoute('/api/v1/admin/apps/vclinks')).toBe(false);
});
