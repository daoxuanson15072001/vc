/**
 * Stamps `tenant_id` on every record that has none (BA §2.2 #10, M1b-01).
 *
 *   pnpm --filter @vclinks/api migrate:tenant --db vclinks_copy_20261004
 *   pnpm --filter @vclinks/api migrate:tenant --db vclinks_copy_20261004 --dry-run
 *
 * Only runs on a copy (`vclinks_copy_*`) unless `--allow-real` is given. The
 * real database is migrated only on the owner's decision (CLAUDE.md §15.3).
 * Idempotent: records that already have a tenant_id are left as they are.
 * Counts every collection before and after; any difference fails the run.
 * GridFS chunks (`*.chunks`) are counted but not stamped (binary parts, read
 * only through their `*.files` entry).
 *
 * Env: MONGO_URI (only the host is used; default mongodb://localhost:27017).
 */
import { parseArgs } from 'node:util';
import { MongoClient } from 'mongodb';

const COPY_PREFIX = 'vclinks_copy_';

async function main() {
  const { values } = parseArgs({
    options: {
      db: { type: 'string' },
      tenant: { type: 'string', default: process.env.DEFAULT_TENANT_ID || 'vcpv' },
      'allow-real': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const dbName = values.db ?? '';
  const tenant = values.tenant ?? '';
  if (!dbName || !/^[a-z0-9_-]{1,64}$/i.test(tenant)) {
    console.error('Cách dùng: --db <vclinks_copy_...> [--tenant vcpv] [--dry-run] [--allow-real]');
    process.exitCode = 1;
    return;
  }
  if (!dbName.startsWith(COPY_PREFIX) && !values['allow-real']) {
    console.error(`Từ chối: "${dbName}" không phải bản sao (${COPY_PREFIX}*). Chạy trên database thật cần --allow-real và quyết định của chủ dự án.`);
    process.exitCode = 1;
    return;
  }

  const host = new URL(process.env.MONGO_URI ?? 'mongodb://localhost:27017');
  host.pathname = '/';
  const client = new MongoClient(host.toString());
  await client.connect();
  try {
    const db = client.db(dbName);
    const names = (await db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'))
      .sort();
    if (!names.length) {
      console.error(`Database "${dbName}" trống hoặc không tồn tại.`);
      process.exitCode = 1;
      return;
    }

    const rows: { name: string; before: number; stamped: number; after: number; missing: number }[] = [];
    for (const name of names) {
      const col = db.collection(name);
      const before = await col.countDocuments();
      const skip = name.endsWith('.chunks');
      let stamped = 0;
      if (!skip && !values['dry-run']) {
        const r = await col.updateMany({ tenant_id: { $exists: false } }, { $set: { tenant_id: tenant } });
        stamped = r.modifiedCount;
      } else if (!skip) {
        stamped = await col.countDocuments({ tenant_id: { $exists: false } });
      }
      const after = await col.countDocuments();
      const missing = skip ? 0 : await col.countDocuments({ tenant_id: { $exists: false } });
      rows.push({ name, before, stamped, after, missing });
    }

    console.log(`Database: ${dbName} · tenant: ${tenant}${values['dry-run'] ? ' · CHẠY THỬ (không ghi)' : ''}`);
    console.log('| Collection | Trước | Gắn tenant_id | Sau | Còn thiếu |');
    console.log('|---|---:|---:|---:|---:|');
    for (const r of rows) console.log(`| ${r.name} | ${r.before} | ${r.stamped} | ${r.after} | ${r.missing} |`);
    const total = (k: 'before' | 'after' | 'stamped') => rows.reduce((n, r) => n + r[k], 0);
    console.log(`| **Tổng** | ${total('before')} | ${total('stamped')} | ${total('after')} | |`);

    const countDiff = rows.filter((r) => r.before !== r.after);
    const unstamped = values['dry-run'] ? [] : rows.filter((r) => r.missing > 0);
    if (countDiff.length || unstamped.length) {
      console.error(
        `LỖI: số bản ghi lệch ở [${countDiff.map((r) => r.name).join(', ')}], còn thiếu tenant_id ở [${unstamped.map((r) => r.name).join(', ')}]`,
      );
      process.exitCode = 2;
      return;
    }
    if (!values['dry-run']) {
      const at = new Date();
      const detail = { tenant, collections: rows.length, stamped: total('stamped'), records: total('after') };
      await db.collection('audit_log').insertOne({ actor: 'system', action: 'db.migrate_tenant', target: dbName, at, detail, tenant_id: tenant });
      await db.collection('events').insertOne({
        type: 'db.migrate_tenant',
        subject: { kind: 'db', id: dbName },
        actor: 'system',
        at,
        data: detail,
        tenant_id: tenant,
      });
    }
    console.log('OK: số bản ghi trước = sau ở mọi collection.');
  } finally {
    await client.close();
  }
}

void main();
