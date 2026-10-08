#!/usr/bin/env node
'use strict';
/**
 * `pnpm seed:thu` — one fake test user per role (ROLE_KEYS, 2 NVKD in two teams) on the REAL system
 * (owner decision 05/10/2026: Q1 real system, Q2 fake people + login links, Q3 one per role).
 *
 * - Writes straight to MongoDB (no second API instance, so no background job such as the outbox dispatcher runs).
 * - Everything it creates is tagged: users `seed: 'THU'`, units `THU-*`. `--remove` deletes exactly that
 *   (users, their role assignments and sessions, the THU-* units). Existing records are never modified.
 * - Emails use a non-routable domain, so these users can only sign in with the printed link, never with Google.
 * - No nick access is granted: what a test user sees comes from its role alone.
 * - Login links are written to tools/seed/out/tai-khoan-thu.md (git-ignored), never to the console.
 *   A link stays valid while used at least once every 12 h; run again for fresh links (idempotent).
 *
 * Env: MONGO_URI (default mongodb://localhost:27017/vclinks), VCLINKS_WEB_URL (default http://localhost:5173),
 * DEFAULT_TENANT_ID (default vcpv).
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const { MongoClient } = require(require.resolve('mongodb', { paths: [path.join(root, 'apps/api')] }));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vclinks';
const WEB = (process.env.VCLINKS_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
const TENANT = process.env.DEFAULT_TENANT_ID || 'vcpv';
const OUT = path.join(__dirname, 'out', 'tai-khoan-thu.md');
const TAG = 'THU';

/** code, name, type, parent */
const UNITS = [
  ['THU-TO-A', 'Tổ bán hàng thử A', 'to_ban_hang', 'DV-VCP'],
  ['THU-TO-B', 'Tổ bán hàng thử B', 'to_ban_hang', 'DV-VCP'],
  ['THU-CSKH', 'Nhóm CSKH thử', 'nhom_cskh', 'DV-VCP'],
  ['THU-MKT', 'Nhóm marketing thử', 'nhom_marketing', 'DV-VCP'],
  ['THU-SA', 'Nhóm Sale admin thử', 'nhom_sale_admin', 'DV-VCP'],
  ['THU-KT', 'Nhóm kế toán thử', 'nhom_ke_toan', 'DV-VCP'],
  ['THU-TT', 'Nhóm thị trường thử', 'nhom_thi_truong', 'DV-VCP'],
];
const MANAGERS = { 'THU-TO-A': 'THU-U-GSBH' };

/** id, position label (owner's order), role, unit */
const USERS = [
  ['THU-U-ADMIN', 'Admin hệ thống', 'admin', 'GOC'],
  ['THU-U-GDBH', 'Giám đốc bán hàng', 'giam_doc_bh', 'DV-VCP'],
  ['THU-U-GSBH', 'Giám sát bán hàng', 'giam_sat_bh', 'THU-TO-A'],
  ['THU-U-NVKD1', 'Nhân viên kinh doanh', 'nvkd', 'THU-TO-A'],
  ['THU-U-NVKD2', 'Nhân viên kinh doanh', 'nvkd', 'THU-TO-B'],
  ['THU-U-CSKH', 'Nhân viên CSKH', 'cskh', 'THU-CSKH'],
  ['THU-U-MKT', 'Nhân viên marketing', 'marketing', 'THU-MKT'],
  ['THU-U-SA', 'Sale admin', 'sale_admin', 'THU-SA'],
  ['THU-U-KT', 'Kế toán', 'ke_toan', 'THU-KT'],
  ['THU-U-NVTT', 'NV thị trường', 'nv_thi_truong', 'THU-TT'],
  ['THU-U-BGD', 'Ban giám đốc / Kiểm soát', 'quan_sat', 'GOC'],
];

const fullName = (u) => `Thử – ${u[1]}${u[0].endsWith('1') ? ' 1' : u[0].endsWith('2') ? ' 2' : ''}`;
const email = (u) => `${u[0].toLowerCase()}@thu.vclinks.local`;

async function remove(db) {
  const ids = (await db.collection('users').find({ seed: TAG, tenant_id: TENANT }, { projection: { _id: 1 } }).toArray()).map((u) => u._id);
  const r = {
    sessions: (await db.collection('sessions').deleteMany({ userId: { $in: ids } })).deletedCount,
    role_assignments: (await db.collection('role_assignments').deleteMany({ userId: { $in: ids } })).deletedCount,
    users: (await db.collection('users').deleteMany({ _id: { $in: ids }, seed: TAG })).deletedCount,
    org_units: (await db.collection('org_units').deleteMany({ _id: { $regex: /^THU-/ }, tenant_id: TENANT })).deletedCount,
  };
  try {
    fs.rmSync(OUT, { force: true });
  } catch {
    // nothing to remove
  }
  console.log('Đã gỡ tài khoản thử:', JSON.stringify(r));
}

async function create(db) {
  const now = new Date();
  for (const need of ['GOC', 'DV-VCP']) {
    if (!(await db.collection('org_units').findOne({ _id: need, tenant_id: TENANT }))) throw new Error(`Thiếu đơn vị ${need} trong cây tổ chức.`);
  }
  const upsert = (col, doc) => db.collection(col).updateOne({ _id: doc._id }, { $setOnInsert: { ...doc, tenant_id: TENANT } }, { upsert: true });
  for (const [code, name, type, parentId] of UNITS) {
    await upsert('org_units', { _id: code, code, name, type, parentId, divisionId: 'DV-VCP', managerUserId: MANAGERS[code] ?? null, active: true, seed: TAG, createdAt: now, updatedAt: now });
  }
  for (const u of USERS) {
    const [id, , role, unit] = u;
    await upsert('users', { _id: id, email: email(u), fullName: fullName(u), status: 'hoat_dong', seed: TAG, createdAt: now });
    await upsert('role_assignments', { _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now });
  }
  // Fresh links each run; older sessions of these test users are revoked.
  await db.collection('sessions').updateMany({ userId: { $in: USERS.map((u) => u[0]) }, revokedAt: { $exists: false } }, { $set: { revokedAt: now } });
  const units = Object.fromEntries((await db.collection('org_units').find({ tenant_id: TENANT }).toArray()).map((x) => [x._id, x.name]));
  const rows = [];
  for (const u of USERS) {
    const token = `vcs_${randomBytes(32).toString('base64url')}`;
    await db.collection('sessions').insertOne({
      _id: randomBytes(8).toString('hex'),
      hash: createHash('sha256').update(token).digest('hex'),
      userId: u[0],
      name: fullName(u),
      tenant_id: TENANT,
      createdAt: now,
      lastUsedAt: now,
    });
    rows.push({ pos: u[1], name: fullName(u), unit: units[u[3]] ?? u[3], link: `${WEB}/login#session=${token}` });
  }

  const stamp = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const md = [
    '# Tài khoản thử theo vị trí (KHÔNG đưa vào git, không gửi ra ngoài)',
    '',
    `Tạo lúc ${stamp} trên ${db.databaseName}. Mỗi link là một phiên đăng nhập: ai có link là vào được với quyền của vị trí đó.`,
    'Mở mỗi link trong một cửa sổ ẩn danh riêng (hoặc một hồ sơ Chrome riêng) để không đè phiên của nhau.',
    'Link hết hiệu lực nếu 12 giờ không dùng; chạy lại `pnpm seed:thu` để lấy link mới. Gỡ hết: `pnpm seed:thu --remove`.',
    '',
    ...rows.flatMap((r, i) => [`## ${i + 1}. ${r.pos}`, '', `- Tên: ${r.name}`, `- Đơn vị: ${r.unit}`, `- Link: ${r.link}`, '']),
  ].join('\n');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md, { mode: 0o600 });

  console.log(`Đã tạo ${USERS.length} tài khoản thử trên "${db.databaseName}":`);
  rows.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${r.pos.padEnd(26)} ${r.name.padEnd(34)} ${r.unit}`));
  console.log(`Link đăng nhập: ${path.relative(root, OUT)}`);
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    const db = client.db();
    if (process.argv.includes('--remove')) await remove(db);
    else await create(db);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error('seed:thu lỗi:', e.message);
  process.exit(1);
});
