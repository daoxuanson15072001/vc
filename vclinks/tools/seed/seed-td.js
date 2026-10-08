#!/usr/bin/env node
'use strict';
/**
 * `pnpm seed:td` — loads the shared test data set (TD, docs/05-kiem-thu/du-lieu-kiem-thu.md) into MongoDB.
 *
 * Goes through the real API (`/api/ingest/*`, same zod schemas as production), never writes Mongo
 * directly. Idempotent: ids are `${uid}:${id}`, so a second run changes nothing.
 * Boots the API in-process on a random port, so it never touches the API on :3000.
 *
 * `--clean` removes what the parts seeded (accounts by uid; contacts/conversations/messages only if
 * flagged `raw.seed = "TD"`; checkpoints by uid). It never touches other uids, e.g. the real driver nick TD-NK01.
 *
 * Env: MONGO_URI (default mongodb://localhost:27017/vclinks_td), SEED_T (ISO time of "T", default
 * 2026-10-06T10:00+07:00). Needs `pnpm --filter @vclinks/api build` first (the pnpm script does it).
 * Seeds no tokens, cookies or keys (CLAUDE.md §12.2); a throwaway ingest token is created and revoked.
 */
const path = require('node:path');

process.env.MONGO_URI ||= 'mongodb://localhost:27017/vclinks_td';
// Never rename legacy databases into the seed database.
process.env.LEGACY_DB_NAMES = '';

const dist = path.resolve(__dirname, '../../apps/api/dist');
// Every file in ./data is one part (alphabetical order). A session adds its own file; no shared line to edit.
const fs = require('node:fs');
const PARTS = fs
  .readdirSync(path.join(__dirname, 'data'))
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => require(path.join(__dirname, 'data', f)));
const CLEAN = process.argv.includes('--clean');

async function main() {
  const T = Date.parse(process.env.SEED_T || '2026-10-06T10:00:00+07:00');
  if (Number.isNaN(T)) throw new Error('SEED_T không hợp lệ');
  require(require.resolve('reflect-metadata', { paths: [dist] }));
  const { createApp } = require(path.join(dist, 'app.factory.js'));
  const { TokenService } = require(path.join(dist, 'auth/token.service.js'));
  const app = await createApp({ logger: false });
  await app.listen(0);
  const base = await app.getUrl();
  const tokens = app.get(TokenService);
  const name = `seed-td-${process.pid}`;
  const token = await tokens.create(name, ['ingest']);
  const post = async (url, body) => {
    const res = await fetch(base.replace('[::1]', 'localhost') + url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || (json.rejected && json.rejected.length)) {
      throw new Error(`${url} → ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
    }
    return json;
  };
  try {
    if (CLEAN) {
      const { DbService, C } = require(path.join(dist, 'db/db.service.js'));
      const db = app.get(DbService);
      const uids = PARTS.flatMap((part) => part(T).accounts.map((a) => a.uid));
      const flagged = { uid: { $in: uids }, 'raw.seed': 'TD' };
      const removed = {};
      for (const col of [C.contacts, C.conversations, C.messages]) {
        removed[col] = (await db.col(col).deleteMany(flagged)).deletedCount;
      }
      removed[C.checkpoints] = (await db.col(C.checkpoints).deleteMany({ uid: { $in: uids } })).deletedCount;
      removed[C.accounts] = (await db.col(C.accounts).deleteMany({ _id: { $in: uids } })).deletedCount;
      const userIds = PARTS.flatMap((part) => (part(T).users ?? []).map((u) => u._id));
      if (userIds.length) removed[C.users] = (await db.col(C.users).deleteMany({ _id: { $in: userIds }, seed: 'TD' })).deletedCount;
      console.log(`Đã xóa dữ liệu seed TD khỏi "${db.db.databaseName}": ${JSON.stringify(removed)}`);
      return;
    }
    const total = { accounts: 0, contacts: 0, conversations: 0, messages: 0 };
    for (const part of PARTS) {
      const { accounts, perAccount } = part(T);
      for (const a of accounts) {
        await post('/api/accounts', a);
        total.accounts++;
      }
      for (const p of perAccount) {
        for (const stream of ['contacts', 'conversations', 'messages']) {
          if (!p[stream]?.length) continue;
          await post(`/api/ingest/${stream}`, { uid: p.uid, items: p[stream] });
          total[stream] += p[stream].length;
        }
      }
    }
    const { DbService, C } = require(path.join(dist, 'db/db.service.js'));
    // Login users (M1b-02): written straight to `users`, like the app does; email is the natural key.
    for (const part of PARTS) {
      for (const { _id, ...u } of part(T).users ?? []) {
        await app.get(DbService).col(C.users).updateOne({ email: u.email }, { $set: u, $setOnInsert: { _id } }, { upsert: true });
        total.users = (total.users ?? 0) + 1;
      }
    }
    const db = app.get(DbService).db;
    console.log(`Đã nạp vào "${db.databaseName}": ${JSON.stringify(total)} (chạy lại không sinh trùng).`);
  } finally {
    await tokens.revoke(name).catch(() => undefined);
    await app.close();
  }
}

main().catch((e) => {
  console.error('seed:td lỗi:', e.message);
  process.exit(1);
});
