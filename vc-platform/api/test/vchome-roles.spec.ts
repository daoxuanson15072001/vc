import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkRolesFile } from '../src/auth/vchome-roles';

const repoFile = (name: string) => readFileSync(join(__dirname, '../../keycloak', name), 'utf8');

test('CI: tệp vai trò trong repo hợp lệ, không có cặp tách nhiệm cấm (kế hoạch GĐ B mục 8.1)', () => {
  for (const f of ['vchome-roles.yaml', 'vchome-roles.dev.yaml']) expect(checkRolesFile(repoFile(f)).errors).toEqual([]);
});

test('Tệp có người giữ hcns và qtht, hoặc kiem_soat và qtht thì đỏ, câu theo VH-ADM-03', () => {
  const r = checkRolesFile(`nguoi:
  - email: a@vcprosperous.com
    vai_tro: [hcns@VCPARTS, qtht]
  - email: b@vcpart.vn
    vai_tro: [kiem_soat, qtht]
`);
  expect(r.errors).toEqual([
    'Không cấp được qtht cho a@vcprosperous.com: đang giữ hcns. Hai vai trò này không được giữ cùng lúc (VH-BR-17).',
    'Không cấp được qtht cho b@vcpart.vn: đang giữ kiem_soat. Hai vai trò này không được giữ cùng lúc (VH-BR-17).',
  ]);
});

test('Email ngoài công ty, vai trò lạ, khai trùng là lỗi; dưới 2 qtht là cảnh báo', () => {
  const r = checkRolesFile(`nguoi:
  - email: a@gmail.com
    vai_tro: [admin]
  - email: Q@vcprosperous.com
    vai_tro: [qtht]
  - email: q@vcprosperous.com
    vai_tro: [bgd]
`);
  expect(r.errors).toEqual([
    'Dòng 1: email không phải tài khoản công ty: a@gmail.com',
    'Dòng 1: vai trò không hợp lệ: admin',
    'Dòng 3: q@vcprosperous.com khai hai lần',
  ]);
  expect(r.warnings).toEqual(['Chỉ có 1 người giữ qtht; cần ít nhất 2 (Q-07)']);
});
