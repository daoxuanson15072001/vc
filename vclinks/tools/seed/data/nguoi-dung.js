'use strict';
/**
 * M1b-02 seed: login users TD-U-* (docs 02-yeu-cau/dac-ta/00-giao-dien-chung.md, test data table).
 * All emails are fake `*.uat@vcprosperous.com`. TD-U-OUT (`nguoila.uat@example.vn`) is deliberately
 * absent: an outside-domain account must be refused before any lookup.
 * The real Admin comes from SEED_ADMIN_EMAIL (never written to a file); without it that user is skipped.
 * Roles, org units and channel access arrive in M1b-03/04, so a user here is only identity + status.
 */
const FAKE = [
  ['TD-U-KD1', 'minh.uat@vcprosperous.com', 'Nguyễn Văn Minh', 'hoat_dong'],
  ['TD-U-GS1', 'huong.uat@vcprosperous.com', 'Nguyễn Thị Hương', 'hoat_dong'],
  ['TD-U-GD', 'thang.uat@vcprosperous.com', 'Trịnh Văn Thắng', 'hoat_dong'],
  ['TD-U-AD', 'quan.uat@vcprosperous.com', 'Đặng Văn Quân', 'hoat_dong'],
  ['TD-U-CS1', 'lan.uat@vcprosperous.com', 'Phạm Thị Lan', 'hoat_dong'],
  ['TD-U-QS', 'vinh.uat@vcprosperous.com', 'Phan Quốc Vinh', 'hoat_dong'],
  // Locked account, for the "đã bị khóa" message.
  ['TD-U-LOCK', 'khoa.uat@vcprosperous.com', 'Người Đã Khóa', 'nghi_viec'],
];

module.exports = function build() {
  const users = FAKE.map(([id, email, fullName, status]) => ({ _id: id, email, fullName, status, seed: 'TD' }));
  const admin = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  if (admin) {
    users.push({ _id: 'U-ADMIN', email: admin, fullName: 'Admin hệ thống', status: 'hoat_dong', seed: 'TD' });
  } else {
    console.warn('Cảnh báo: chưa đặt SEED_ADMIN_EMAIL, bỏ qua tài khoản Admin thật.');
  }
  return { accounts: [], perAccount: [], users };
};
