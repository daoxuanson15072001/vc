import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accessFor, HOME_ROLE, permissionsOf, roleConflicts } from '../src/permissions.js';

test('Quyền theo vai trò (02 mục 3, kế hoạch GĐ B mục 5.4)', () => {
  assert.equal(accessFor('nhan_su.sua', ['hcns']), 'p');
  assert.equal(accessFor('nhan_su.sua', ['qtht']), undefined);
  assert.equal(accessFor('nhan_su.xem', ['qtht']), 'd');
  assert.equal(accessFor('ho_so.xem_c1', ['nhan_vien']), undefined);
  assert.equal(accessFor('nhat_ky.xem', ['nhan_vien', 'qtht']), 'all');
  assert.deepEqual(permissionsOf(['bgd']), []);
  assert.ok(permissionsOf(['nhan_vien']).includes('danh_ba.xem'));
});

test('Vai trò gán: hcns, hcns@<mã>, qtht, kiem_soat, bgd', () => {
  for (const ok of ['hcns', 'hcns@VCPARTS', 'hcns@VCP', 'qtht', 'kiem_soat', 'bgd']) assert.ok(HOME_ROLE.test(ok), ok);
  for (const bad of ['admin', 'hcns@', 'hcns@vcparts', 'qtht@X', 'HCNS']) assert.ok(!HOME_ROLE.test(bad), bad);
});

test('Tách nhiệm: hcns (kể cả hcns@X) với qtht; kiem_soat với qtht (VH-BR-17)', () => {
  assert.deepEqual(roleConflicts(['hcns@VCPARTS', 'qtht']), [['hcns', 'qtht']]);
  assert.deepEqual(roleConflicts(['kiem_soat', 'qtht', 'bgd']), [['kiem_soat', 'qtht']]);
  assert.deepEqual(roleConflicts(['hcns', 'kiem_soat', 'bgd']), []);
});
