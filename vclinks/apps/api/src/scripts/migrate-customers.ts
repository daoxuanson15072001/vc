/**
 * Customer profiles for every existing channel identity (M1b-12, docs/04-ky-thuat/api/mo-hinh-khach.md).
 *
 *   pnpm --filter @vclinks/api migrate:customers --db vclinks_copy_20261005 --dry-run
 *   pnpm --filter @vclinks/api migrate:customers --db vclinks_copy_20261005
 *   pnpm --filter @vclinks/api migrate:customers --db vclinks_copy_20261005 --undo <runId>
 *
 * Runs only on a copy (`vclinks_copy_*`) or a session / test database (`vclinks_m1*`, `vclinks_test_*`)
 * unless `--allow-real` is given: the real database is migrated only on the owner's decision (§15.3).
 * Idempotent (ids derive from the identity id); `contacts` / `conversations` / `messages` are counted
 * before and after and never modified. `--undo <runId>` deletes exactly the records of that run.
 *
 * Env: MONGO_URI (only the host is used; default mongodb://localhost:27017).
 */
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { MongoClient } from 'mongodb';
import { migrateCustomers, undoCustomersMigration } from '../customers/migrate-customers.lib';

const SAFE_PREFIXES = ['vclinks_copy_', 'vclinks_m1', 'vclinks_test_'];

async function main() {
  const { values } = parseArgs({
    options: {
      db: { type: 'string' },
      tenant: { type: 'string', default: process.env.DEFAULT_TENANT_ID || 'vcpv' },
      'allow-real': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      undo: { type: 'string' },
      force: { type: 'boolean', default: false },
    },
  });
  const dbName = values.db ?? '';
  const tenant = values.tenant ?? '';
  if (!dbName || !/^[a-z0-9_-]{1,64}$/i.test(tenant)) {
    console.error('Cách dùng: --db <vclinks_copy_...> [--tenant vcpv] [--dry-run] [--undo <runId> [--force]] [--allow-real]');
    process.exitCode = 1;
    return;
  }
  if (!SAFE_PREFIXES.some((p) => dbName.startsWith(p)) && !values['allow-real']) {
    console.error(`Từ chối: "${dbName}" không phải bản sao (${SAFE_PREFIXES.join(', ')}). Database thật cần --allow-real và quyết định của chủ dự án.`);
    process.exitCode = 1;
    return;
  }
  const host = new URL(process.env.MONGO_URI ?? 'mongodb://localhost:27017');
  host.pathname = '/';
  const client = new MongoClient(host.toString());
  await client.connect();
  try {
    const db = client.db(dbName);
    if (values.undo) {
      const r = await undoCustomersMigration(db, { tenant, runId: values.undo, force: values.force });
      if (r.refused) {
        console.error(r.refused);
        process.exitCode = 2;
        return;
      }
      console.log(`Đã lùi lượt ${r.runId}: xóa ${r.deleted.accounts} account, ${r.deleted.contacts} người liên hệ, ${r.deleted.points} SĐT/email, ${r.deleted.links} liên kết danh tính.`);
      return;
    }
    const runId = `mc_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${randomBytes(3).toString('hex')}`;
    const r = await migrateCustomers(db, { tenant, runId, dryRun: values['dry-run'] });
    console.log(`Database: ${dbName} · tenant: ${tenant} · lượt: ${runId}${r.dryRun ? ' · CHẠY THỬ (không ghi)' : ''}`);
    console.log(`Danh tính: ${r.identities} · đã có hồ sơ: ${r.skippedExisting}`);
    console.log(`Tạo mới: ${r.created.accounts} account · ${r.created.contacts} người liên hệ · ${r.created.points} SĐT · ${r.created.links} liên kết`);
    console.log('| Collection nguồn | Trước | Sau |');
    console.log('|---|---:|---:|');
    for (const [k, v] of Object.entries(r.source)) console.log(`| ${k} | ${v.before} | ${v.after} |`);
    if (!r.ok) {
      console.error('LỖI: số bản ghi nguồn lệch hoặc thiếu liên kết danh tính.');
      process.exitCode = 2;
      return;
    }
    console.log(r.dryRun ? 'OK (chạy thử).' : `OK. Lùi lại bằng: --undo ${runId}`);
  } finally {
    await client.close();
  }
}

void main();
