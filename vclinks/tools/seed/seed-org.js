#!/usr/bin/env node
'use strict';
/**
 * `pnpm seed:org` — loads the TD org tree and people (M1b-03) through the same import code the Admin uses
 * (docs/05-kiem-thu/du-lieu-mau/cay-to-chuc-td.csv, nguoi-dung-td.csv). It is the trial of "nhập file
 * nhân sự VCparts (E4)": when the real file arrives, import it on the Admin screen the same way.
 *
 * Roles that need a second person (admin, quan_sat, giam_doc_bh) would normally wait for approval; here
 * they are applied directly (approvedBy = "seed") so a fresh dev database is usable at once.
 * The real Admin comes from SEED_ADMIN_EMAIL (never written to a file): it gets `admin` at the root and
 * `giam_doc_bh` at VCparts (owner decision 04/10/2026). M1b-04 adds the nick holders (`channel_access`) and
 * nick divisions; the real driver nick TD-NK01 needs SEED_NK01_UID.
 * Idempotent. Env: MONGO_URI (default mongodb://localhost:27017/vclinks_td). Needs the API build (the pnpm script does it).
 */
const fs = require('node:fs');
const path = require('node:path');

process.env.MONGO_URI ||= 'mongodb://localhost:27017/vclinks_td';
process.env.LEGACY_DB_NAMES = '';
const dist = path.resolve(__dirname, '../../apps/api/dist');
const dir = path.resolve(__dirname, '../../docs/05-kiem-thu/du-lieu-mau');
const b64 = (f) => ({ fileName: f, contentBase64: fs.readFileSync(path.join(dir, f)).toString('base64') });

async function main() {
  require(require.resolve('reflect-metadata', { paths: [dist] }));
  const { createApp } = require(path.join(dist, 'app.factory.js'));
  const { OrgImportService } = require(path.join(dist, 'org/org-import.service.js'));
  const { UserImportService } = require(path.join(dist, 'org/user-import.service.js'));
  const { OrgService } = require(path.join(dist, 'org/org.service.js'));
  const { DbService, C } = require(path.join(dist, 'db/db.service.js'));
  const { DEFAULT_TENANT, runAsTenant } = require(path.join(dist, 'db/tenant-context.js'));
  const app = await createApp({ logger: false });
  await app.init();
  try {
    await runAsTenant(DEFAULT_TENANT, async () => {
      const actor = { id: 'seed', userId: null };
      const db = app.get(DbService);
      await app.get(OrgService).ensureRoot();
      const org = await app.get(OrgImportService).commit('cay-to-chuc-td.csv', b64('cay-to-chuc-td.csv').contentBase64, 'seed');
      const usr = await app.get(UserImportService).commit('nguoi-dung-td.csv', b64('nguoi-dung-td.csv').contentBase64, actor);
      if (org.loi || usr.loi) throw new Error(`File TD có lỗi: đơn vị ${org.loi}, người ${usr.loi}`);
      // Apply the sensitive roles directly (see header).
      const reqs = db.col('role_change_requests');
      for (const r of await reqs.find({ status: 'cho_duyet', requestedBy: 'seed' }).toArray()) {
        const c = r.change;
        await db.col('role_assignments').updateOne(
          { _id: `${r.targetUserId}:${c.roleKey}:${c.orgUnitId}` },
          { $setOnInsert: { userId: r.targetUserId, roleKey: c.roleKey, orgUnitId: c.orgUnitId, createdBy: 'seed', createdAt: new Date() } },
          { upsert: true },
        );
        if (c.lead) await db.col('org_units').updateOne({ _id: c.orgUnitId }, { $set: { managerUserId: r.targetUserId } });
        await reqs.updateOne({ _id: r._id }, { $set: { status: 'da_duyet', approvedBy: 'seed', approvedAt: new Date() } });
      }
      const admin = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
      if (admin) {
        const u = await db.col(C.users).findOne({ email: admin });
        if (u) {
          // Owner decision 04/10/2026: the real Admin is also Giám đốc bán hàng VCparts (sees and answers VCparts).
          for (const [roleKey, orgUnitId] of [['admin', 'GOC'], ['giam_doc_bh', 'TD-DV-VCP']]) {
            await db.col('role_assignments').updateOne(
              { _id: `${u._id}:${roleKey}:${orgUnitId}` },
              { $setOnInsert: { userId: u._id, roleKey, orgUnitId, createdBy: 'seed', createdAt: new Date() } },
              { upsert: true },
            );
          }
        } else console.warn('Cảnh báo: SEED_ADMIN_EMAIL chưa có trong users (chạy pnpm seed:td trước).');
      }
      // M1b-04: nick holders (channel_access giu_nick, TD §3.1) and the division of each TD nick.
      // TD-NK01 is the real driver nick: its uid comes from SEED_NK01_UID (never written to a file).
      const nick = (n) => `90000000000${n}`;
      const holders = [
        [process.env.SEED_NK01_UID, 'minh.uat@vcprosperous.com', 'TD-DV-VCP'],
        [nick('02'), 'linh.uat@vcprosperous.com', 'TD-DV-VCP'],
        [nick('03'), 'tu.uat@vcprosperous.com', 'TD-DV-VCP'],
        [nick('04'), 'hai.uat@vcprosperous.com', 'TD-DV-VCP'],
        [nick('05'), 'toan.uat@vcprosperous.com', 'TD-DV-VCP'],
        [nick('06'), null, 'TD-DV-VCP'],
        [nick('07'), 'phuong.uat@vcprosperous.com', 'TD-DV-VCP'],
        [nick('08'), 'trang.uat@vcprosperous.com', 'TD-DV-VCE'],
      ];
      if (!process.env.SEED_NK01_UID) console.warn('Cảnh báo: chưa đặt SEED_NK01_UID, bỏ qua người giữ TD-NK01 (nick thật của driver).');
      for (const [uid, email, divisionId] of holders) {
        if (!uid) continue;
        await db.col(C.accounts).updateOne({ _id: uid }, { $set: { divisionId } });
        const holder = email ? await db.col(C.users).findOne({ email }) : null;
        if (!holder) continue;
        await db.col('channel_access').updateOne(
          { _id: `${uid}:giu_nick` },
          { $set: { channelId: uid, principalType: 'user', principalId: holder._id, level: 'giu_nick', createdBy: 'seed' } },
          { upsert: true },
        );
      }
      const counts = {
        org_units: await db.col('org_units').countDocuments(),
        role_assignments: await db.col('role_assignments').countDocuments(),
        users: await db.col(C.users).countDocuments(),
      };
      console.log(`Đã nạp vào "${db.db.databaseName}": ${JSON.stringify(counts)}. ${usr.summary}`);
    });
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('seed:org lỗi:', e.message);
  process.exit(1);
});
