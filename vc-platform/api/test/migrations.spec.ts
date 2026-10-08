import type { MongoClient } from 'mongodb';
import { FakeClock } from '../src/common/clock';
import { C } from '../src/db/collections';
import { runMigrations, type Migration } from '../src/db/migrations';
import { connect, dbName, quietLog } from './util/mongo';

let a: MongoClient;
let b: MongoClient;
beforeAll(async () => {
  [a, b] = await Promise.all([connect(), connect()]);
});
afterAll(async () => {
  await Promise.all([a.close(), b.close()]);
});

test('Migration chạy hai lần không lỗi, mỗi migration ghi một lần (B-01 xong khi)', async () => {
  const name = dbName();
  const clock = new FakeClock(new Date('2026-11-02T01:00:00Z'));
  expect(await runMigrations(a.db(name), clock, quietLog, 'p1')).toEqual(['B0001_indexes', 'B0002_audit_role', 'B0003_settings']);
  expect(await runMigrations(a.db(name), clock, quietLog, 'p1')).toEqual([]);
  const done = await a.db(name).collection(C.migrations).find().toArray();
  expect(done.map((d) => d._id)).toEqual(['B0001_indexes', 'B0002_audit_role', 'B0003_settings']);
  const idx = await a.db(name).collection(C.jobLocks).indexes();
  expect(idx.map((i) => i.name)).toContain('lease_until');
});

test('Hai tiến trình khởi động cùng lúc: migration chỉ chạy một lần', async () => {
  const name = dbName();
  let runs = 0;
  const slow: Migration = {
    id: 'T0001_cham',
    description: 'thử',
    async up() {
      runs++;
      await new Promise((r) => setTimeout(r, 300));
    },
  };
  const clock = new FakeClock(new Date('2026-11-02T01:00:00Z'));
  const [r1, r2] = await Promise.all([
    runMigrations(a.db(name), clock, quietLog, 'p1', [slow]),
    runMigrations(b.db(name), clock, quietLog, 'p2', [slow]),
  ]);
  expect(runs).toBe(1);
  expect([...r1, ...r2]).toEqual(['T0001_cham']);
});
