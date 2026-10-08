#!/usr/bin/env node
'use strict';
/**
 * `pnpm uat:m1b` (M1b-16): builds a throwaway UAT environment for the project owner to click through
 * docs/05-kiem-thu/uat/2026-10-04/m1b.md. It NEVER touches the real `vclinks` database: the default is
 * `vclinks_uat_m1b` and a MONGO_URI naming `vclinks`, `vczalo`, `vcconnect` (or no database) is refused.
 *
 * What it writes: org tree + 12 TD users with roles (docs/05-kiem-thu/du-lieu-kiem-thu.md §2), 4 Zalo nicks
 * and one OA (fake uids, no Zalo is contacted), conversations and messages, nick holders, the mock VCsales
 * customer catalogue, and one dashboard session per TD user. It prints one login link per user.
 *
 * Run the app on it (no :3000):
 *   MONGO_URI=mongodb://localhost:27017/vclinks_uat_m1b AUTHZ_DEFAULT_DIVISION=TD-DV-VCP VCSALE_MODE=mock \
 *   OUTBOX_DISPATCHER=off PORT=3116 node apps/api/dist/main.js
 *   VCLINKS_API=http://localhost:3116 pnpm --filter @vclinks/web dev --port 5176
 * Sessions end after 12 h idle; run this script again for fresh links (data is idempotent).
 * `--reset` first drops the whole UAT database (never `vclinks`): use it before a new round so the "minutes since the
 * customer wrote" (SLA chips) start fresh and earlier clicks (handover, grants) are gone.
 */
const path = require('node:path');

process.env.MONGO_URI ||= 'mongodb://localhost:27017/vclinks_uat_m1b';
// Real databases (current name and the legacy ones DbService migrates from) are never a UAT target.
const REAL_DBS = ['vclinks', 'vczalo', 'vcconnect'];
const uatDbName = (() => {
  try {
    return decodeURIComponent(new URL(process.env.MONGO_URI).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
})();
if (!uatDbName || REAL_DBS.includes(uatDbName.toLowerCase())) {
  console.error(`Từ chối: MONGO_URI phải trỏ vào một database thử có tên riêng (không phải ${REAL_DBS.join(', ')}).`);
  process.exit(1);
}
process.env.LEGACY_DB_NAMES = '';
process.env.AUTHZ_DEFAULT_DIVISION ||= 'TD-DV-VCP';
process.env.VCSALE_MODE ||= 'mock';
process.env.OUTBOX_DISPATCHER = 'off';
const WEB = process.env.UAT_WEB_URL || 'http://localhost:5176';

const dist = path.resolve(__dirname, '../../apps/api/dist');
const NK = (n) => `90000000000${n}`;
const OA1 = 'zoa_9000000000101';
const UNITS = [
  ['GOC', 'Tập đoàn VC Phồn Vinh', 'goc', null],
  ['TD-DV-VCP', 'Division VCparts', 'division', 'GOC'],
  ['TD-DV-HN1', 'Tổ HN1', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-HN2', 'Tổ HN2', 'to_ban_hang', 'TD-DV-VCP'],
  ['TD-DV-CS', 'Nhóm CSKH VCparts', 'nhom_cskh', 'TD-DV-VCP'],
  ['TD-DV-SA', 'Nhóm Sale admin VCparts', 'nhom_sale_admin', 'TD-DV-VCP'],
  ['TD-DV-VCE', 'Division VCedu', 'division', 'GOC'],
  ['TD-DV-TVTS', 'Tổ Tư vấn tuyển sinh', 'to_ban_hang', 'TD-DV-VCE'],
];
const MANAGERS = { 'TD-DV-VCP': 'TD-U-GD', 'TD-DV-HN1': 'TD-U-GS1', 'TD-DV-HN2': 'TD-U-GS2', 'TD-DV-VCE': 'TD-U-GDE' };
const USERS = [
  ['TD-U-AD', 'quan', 'Đặng Văn Quân', 'admin', 'GOC'],
  ['TD-U-QS', 'vinh', 'Phan Quốc Vinh', 'quan_sat', 'GOC'],
  ['TD-U-GD', 'thang', 'Trịnh Văn Thắng', 'giam_doc_bh', 'TD-DV-VCP'],
  ['TD-U-GS1', 'huong', 'Nguyễn Thị Hương', 'giam_sat_bh', 'TD-DV-HN1'],
  ['TD-U-GS2', 'duc', 'Hồ Văn Đức', 'giam_sat_bh', 'TD-DV-HN2'],
  ['TD-U-KD1', 'minh', 'Nguyễn Văn Minh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD2', 'linh', 'Trần Thùy Linh', 'nvkd', 'TD-DV-HN1'],
  ['TD-U-KD4', 'hai', 'Phạm Văn Hải', 'nvkd', 'TD-DV-HN2'],
  ['TD-U-CS2', 'thu', 'Hoàng Thị Thu', 'cskh', 'TD-DV-CS'],
  ['TD-U-SA', 'ngoc', 'Ngô Bích Ngọc', 'sale_admin', 'TD-DV-SA'],
  ['TD-U-GDE', 'loc', 'Phùng Văn Lộc', 'giam_doc_bh', 'TD-DV-VCE'],
  ['TD-U-KDE', 'trang', 'Lưu Thu Trang', 'nvkd', 'TD-DV-TVTS'],
];
/** nick, holder, label, division override */
const NICKS = [
  [NK('01'), 'TD-U-KD1', 'Minh VCparts', null],
  [NK('02'), 'TD-U-KD2', 'Linh VCparts', null],
  [NK('04'), 'TD-U-KD4', 'Hải VCparts', null],
  [NK('08'), 'TD-U-KDE', 'Trang VCedu', 'TD-DV-VCE'],
];
/** nick, customer userId, name, phone, minutes since last customer message (null = no message) */
const CUSTOMERS = [
  [NK('01'), '9101101', 'Anh Tuấn Minh Phát', '0900 000 101', 12],
  [NK('01'), '9100950', 'Kiên', '0900 000 950', 20],
  [NK('01'), '9100005', 'Chị Hạnh', '0900 000 005', 5],
  [NK('02'), '9102001', 'Anh Quân Gara', '0900 000 201', 30],
  [NK('04'), '9100960', 'Anh Hòa', '0900 000 960', 25],
  [NK('04'), '9100381', 'Gara Khoa Minh', '0900 000 381', 40],
  [NK('08'), '9108001', 'Phụ huynh Lan', '0900 000 801', 15],
];

async function main() {
  require(require.resolve('reflect-metadata', { paths: [dist] }));
  const { createApp } = require(path.join(dist, 'app.factory.js'));
  const { TokenService } = require(path.join(dist, 'auth/token.service.js'));
  const { SessionService } = require(path.join(dist, 'auth/session.service.js'));
  const { DbService, C } = require(path.join(dist, 'db/db.service.js'));
  const { AuthzService } = require(path.join(dist, 'authz/authz.service.js'));
  if (process.argv.includes('--reset')) {
    const { MongoClient } = require(require.resolve('mongodb', { paths: [dist] }));
    const url = new URL(process.env.MONGO_URI);
    const name = uatDbName;
    if (!name || REAL_DBS.includes(name.toLowerCase())) throw new Error('Từ chối --reset: không có tên database riêng.');
    const client = new MongoClient(`${url.protocol}//${url.host}`);
    await client.connect();
    await client.db(name).dropDatabase();
    await client.close();
    console.log(`Đã xóa database thử "${name}".`);
  }
  const app = await createApp({ logger: false });
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', 'localhost');
  const db = app.get(DbService);
  const tokens = app.get(TokenService);
  const ingestName = `uat-m1b-${process.pid}`;
  const ingest = await tokens.create(ingestName, ['ingest']);
  const post = async (url, body, token = ingest) => {
    const res = await fetch(base + url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${url} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json().catch(() => ({}));
  };
  try {
    const now = new Date();
    const upsert = (col, doc) => db.col(col).updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
    for (const [id, name, type, parentId] of UNITS) {
      await upsert('org_units', { _id: id, code: id, name, type, parentId, divisionId: type === 'division' ? id : type === 'goc' ? null : UNITS.find((u) => u[0] === parentId)[0], managerUserId: MANAGERS[id] ?? null, active: true, createdAt: now, updatedAt: now });
    }
    for (const [id, mail, fullName, role, unit] of USERS) {
      await upsert(C.users, { _id: id, email: `${mail}.uat@vcprosperous.com`, fullName, status: 'hoat_dong', seed: 'TD' });
      await upsert('role_assignments', { _id: `${id}:${role}:${unit}`, userId: id, roleKey: role, orgUnitId: unit, createdBy: 'seed', createdAt: now });
    }
    for (const [uid, holder, label, division] of NICKS) {
      await post('/api/accounts', { uid, label });
      await upsert('channel_access', { _id: `${uid}:user:${holder}:giu_nick`, channelId: uid, principalType: 'user', principalId: holder, level: 'giu_nick', createdBy: 'seed' });
      if (division) await db.col(C.accounts).updateOne({ _id: uid }, { $set: { divisionId: division } });
    }
    for (const [uid, userId, displayName, phone, ago] of CUSTOMERS) {
      await post('/api/ingest/contacts', { uid, items: [{ userId, displayName, phone }] });
      await post('/api/ingest/conversations', { uid, items: [{ threadId: userId, type: 'user', lastMsgAt: Date.now() - ago * 60000, unread: 1 }] });
      await post('/api/ingest/messages', { uid, items: [{ msgId: `uat-${userId}`, threadId: userId, fromUid: userId, toUid: uid, senderName: displayName, msgType: 'webchat', text: `Tin thử của ${displayName}: còn má phanh Vios 2019 không em`, sentAt: Date.now() - ago * 60000 }] });
    }
    await db.col(C.contacts).updateMany({}, { $set: { inFriendList: true } });
    await upsert(C.accounts, { _id: OA1, label: 'VCparts OA', channel: 'zalo_oa' });
    await upsert(C.conversations, { _id: `${OA1}:777`, uid: OA1, threadId: '777', type: 'user', lastMsgAt: now, unread: 0 });
    await upsert('channel_access', { _id: `${OA1}:org_unit:TD-DV-CS:gui`, channelId: OA1, principalType: 'org_unit', principalId: 'TD-DV-CS', level: 'gui', createdBy: 'seed' });
    app.get(AuthzService).invalidate();

    const sessions = app.get(SessionService);
    const tok = {};
    for (const [id, , name] of USERS) tok[id] = await sessions.create({ _id: id, fullName: name });
    // Customer model: one profile per channel identity, then the mock VCsales catalogue (first owners).
    await post('/api/customers/sweep', {}, tok['TD-U-SA']);
    const imp = await post('/api/customers/import', {}, tok['TD-U-SA']);
    console.log(`Đã nạp vào "${db.db.databaseName}". Khách VCsales mock: ${JSON.stringify({ created: imp.created, ownersSet: imp.ownersSet, ownerUnmatched: imp.ownerUnmatched })}\n`);
    console.log('Liên kết đăng nhập (mỗi người một dòng; dán vào trình duyệt, mở cửa sổ ẩn danh cho từng người):');
    for (const [id, , name, role] of USERS) console.log(`  ${id.padEnd(9)} ${name.padEnd(18)} ${role.padEnd(12)} ${WEB}/login#session=${tok[id]}`);
  } finally {
    await tokens.revoke(ingestName).catch(() => undefined);
    await app.close();
  }
}

main().catch((e) => {
  console.error('uat:m1b lỗi:', e.message);
  process.exit(1);
});
