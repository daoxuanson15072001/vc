/**
 * Migrations run automatically when the API starts (kế hoạch GĐ B mục 4.3, 11.3): they only create collections,
 * indexes and seed data, never delete data. One process at a time (lease in `_job_locks`); each runs once.
 */
import type { Db } from 'mongodb';
import type { Clock } from '../../common/clock';
import type { JsonLogger } from '../../common/logger';
import { JobLocks } from '../../jobs/job-locks';
import { C } from '../collections';
import { ensureIndexes } from '../indexes';
import { ensureAccessRoles } from '../roles';
import { seedSettings } from '../../settings/settings.service';
import { seedFunctions } from '../../org/catalogs/seed';
import { seedRootUnit } from '../../org/units/seed';

export interface MigrationContext {
  clock: Clock;
  /** ROOT_UNIT_CODE, ROOT_UNIT_NAME. */
  root: { code: string; name: string };
}

export const DEFAULT_ROOT = { code: 'VCPV', name: 'Tập đoàn VC Phồn Vinh' };

export interface Migration {
  id: string;
  description: string;
  up(db: Db, ctx: MigrationContext): Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 'B0001_indexes',
    description: 'Tạo collection kỹ thuật và chỉ mục',
    async up(db) {
      for (const name of [C.migrations, C.jobLocks]) {
        await db.createCollection(name).catch((e: { code?: number }) => {
          if (e.code !== 48) throw e; // NamespaceExists
        });
      }
      await ensureIndexes(db);
    },
  },
  {
    id: 'B0002_audit_role',
    description: 'Vai trò MongoDB của API: chỉ thêm và đọc audit_log',
    up: ensureAccessRoles,
  },
  {
    id: 'B0003_settings',
    description: 'Cài đặt hệ thống với giá trị mặc định (04 VH-ADM-05)',
    up: seedSettings,
  },
  {
    id: 'B0004_functions',
    description: '10 chức năng ban đầu (Q-02, 04 VH-ORG-03)',
    up: seedFunctions,
  },
  {
    id: 'B0005_root_unit',
    description: 'Đơn vị gốc loại Tập đoàn (04 VH-ORG-01 điều kiện trước)',
    up: (db, ctx) => seedRootUnit(db, ctx.root, ctx.clock),
  },
];

const LOCK = 'he-thong.migration';

export async function runMigrations(
  db: Db,
  clock: Clock,
  log: JsonLogger,
  owner: string,
  list: Migration[] = MIGRATIONS,
  root: MigrationContext['root'] = DEFAULT_ROOT,
): Promise<string[]> {
  const locks = new JobLocks(db, clock);
  const deadline = Date.now() + 120_000;
  while (!(await locks.acquire(LOCK, owner, 10 * 60_000))) {
    if (Date.now() > deadline) throw new Error('Tiến trình khác đang chạy migration quá 2 phút');
    await new Promise((r) => setTimeout(r, 500));
  }
  const applied: string[] = [];
  try {
    const done = db.collection<{ _id: string }>(C.migrations);
    for (const m of list) {
      if (await done.findOne({ _id: m.id })) continue;
      const started = Date.now();
      await m.up(db, { clock, root });
      await done.insertOne({ _id: m.id, description: m.description, applied_at: clock.now(), duration_ms: Date.now() - started } as { _id: string });
      applied.push(m.id);
      log.info('migration_applied', { id: m.id });
    }
    await ensureIndexes(db);
    await ensureAccessRoles(db);
  } finally {
    await locks.release(LOCK, owner, { status: 'ok' });
  }
  return applied;
}
