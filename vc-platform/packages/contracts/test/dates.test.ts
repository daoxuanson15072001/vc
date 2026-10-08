import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, formatVnDate, isYmd, toEffectiveAt, vnParts, ymdInVn } from '../src/dates.js';

test('Ngày ở Việt Nam đổi lúc 17:00:00Z, không phải 00:00Z (khung chung mục 6)', () => {
  assert.equal(ymdInVn(new Date('2026-11-30T16:59:59Z')), '2026-11-30');
  assert.equal(ymdInVn(new Date('2026-11-30T17:00:00Z')), '2026-12-01');
  assert.equal(ymdInVn(new Date('2026-12-31T17:00:00Z')), '2027-01-01');
});

test('Ngày hiệu lực bắt đầu lúc 00:00 giờ Việt Nam = 17:00Z hôm trước', () => {
  assert.equal(toEffectiveAt('2026-12-01').toISOString(), '2026-11-30T17:00:00.000Z');
  assert.equal(toEffectiveAt('2027-01-01').toISOString(), '2026-12-31T17:00:00.000Z');
  assert.equal(ymdInVn(toEffectiveAt('2026-12-01')), '2026-12-01');
  assert.throws(() => toEffectiveAt('2026-02-30'), /không hợp lệ/);
});

test('Kiểm ngày, cộng ngày, giờ theo đồng hồ Việt Nam, định dạng dd/mm/yyyy', () => {
  assert.ok(isYmd('2028-02-29'));
  assert.ok(!isYmd('2026-02-29'));
  assert.ok(!isYmd('2026-1-01'));
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(vnParts(new Date('2026-10-07T17:10:00Z')), { ymd: '2026-10-08', hour: 0, minute: 10 });
  assert.equal(formatVnDate('2026-12-01'), '01/12/2026');
});
