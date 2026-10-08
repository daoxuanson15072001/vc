import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_FUNCTIONS, JobTitleInput, LegalEntityInput, PROVINCES, WorkLocationInput, fillMsg, foldName } from '../src/index.js';

test('foldName: bỏ dấu, chữ thường, một khoảng trắng (04 VH-ORG-02 tiêu chí 1)', () => {
  assert.equal(foldName('nhân viên  kinh doanh'), foldName('Nhân viên kinh doanh'));
  assert.equal(foldName('  Đặng   Thị Ánh '), 'dang thi anh');
  assert.equal(foldName('Kỹ thuật / dịch vụ'), 'ky thuat / dich vu');
});

test('Mã số thuế: 10 số hoặc 10 số-3 số; sai thì đúng câu 04 VH-ORG-07', () => {
  const base = { code: 'VCPARTS', name: 'Công ty TNHH VCparts', short_name: 'VCparts', hq_address: 'Hà Nội' };
  assert.ok(LegalEntityInput.safeParse({ ...base, tax_code: '0101234567' }).success);
  assert.ok(LegalEntityInput.safeParse({ ...base, tax_code: '0101234567-001' }).success);
  const bad = LegalEntityInput.safeParse({ ...base, tax_code: '12345' });
  assert.equal(bad.success, false);
  assert.equal(!bad.success && bad.error.issues[0].message, 'Mã số thuế gồm 10 chữ số, hoặc 10 chữ số, gạch ngang và 3 chữ số.');
});

test('Mã chức danh, tên gọn khoảng trắng, câu lỗi tiếng Việt', () => {
  const ok = JobTitleInput.parse({ code: 'NVKD', name: ' Nhân viên   kinh doanh ', level: 1, default_function_code: 'ban_hang' });
  assert.equal(ok.name, 'Nhân viên kinh doanh');
  const bad = JobTitleInput.safeParse({ code: 'nvkd', name: 'x', level: 9, default_function_code: 'ban_hang' });
  assert.deepEqual(!bad.success && bad.error.issues.map((i) => i.message), ['Mã chức danh gồm 2–30 ký tự chữ hoa, số hoặc gạch dưới.', 'Cấp bậc từ 1 đến 7.']);
});

test('Nơi làm việc: tỉnh trong 34 tỉnh, thành hiện hành; danh mục 10 chức năng ban đầu', () => {
  assert.equal(Object.keys(PROVINCES).length, 34);
  assert.equal(WorkLocationInput.safeParse({ code: 'KHO_TONG', name: 'Kho tổng', kind: 'kho', address: 'x', province: 'ha_tay' }).success, false);
  assert.equal(INITIAL_FUNCTIONS.length, 10);
  assert.equal(fillMsg("{label} '{name}' đã có (mã {code}).", { label: 'Chức danh', name: 'A', code: 'B' }), "Chức danh 'A' đã có (mã B).");
});
