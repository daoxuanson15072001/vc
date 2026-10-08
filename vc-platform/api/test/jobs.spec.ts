import type { MongoClient } from 'mongodb';
import { FakeClock } from '../src/common/clock';
import { JobLocks } from '../src/jobs/job-locks';
import { JobRegistry, type JobDef } from '../src/jobs/registry';
import { JobRunner, RETRY_AFTER_MS } from '../src/jobs/runner';
import { connect, dbName, quietLog } from './util/mongo';

let a: MongoClient;
let b: MongoClient;
beforeAll(async () => {
  [a, b] = await Promise.all([connect(), connect()]);
});
afterAll(async () => {
  await Promise.all([a.close(), b.close()]);
});

/** Two runners on two connections stand for two API processes sharing one database. */
function twoProcesses(def: JobDef, clock: FakeClock) {
  const name = dbName();
  const reg = new JobRegistry();
  reg.register(def);
  return { name, p1: new JobRunner(a.db(name), clock, reg, quietLog), p2: new JobRunner(b.db(name), clock, reg, quietLog) };
}

test('Hai tiến trình cùng chạy: job thử chạy đúng một lần mỗi lượt (B-01 xong khi)', async () => {
  const clock = new FakeClock(new Date('2026-11-02T01:00:10Z'));
  let runs = 0;
  const { p1, p2 } = twoProcesses(
    { name: 'thu.dem', description: 'thử', schedule: { everyMinutes: 1 }, leaseMs: 60_000, run: async () => void runs++ },
    clock,
  );
  // Each process ticks several times inside the same minute, at the same moment.
  await Promise.all([p1.tick(), p2.tick(), p1.tick(), p2.tick()]);
  await Promise.all([p1.tick(), p2.tick()]);
  expect(runs).toBe(1);
  clock.advance(60_000);
  await Promise.all([p1.tick(), p2.tick()]);
  expect(runs).toBe(2);
});

test('Job hằng ngày 00:10: chạy một lần trong ngày; máy tắt lúc đó thì chạy bù khi bật, biết lượt của ngày nào', async () => {
  const clock = new FakeClock(new Date('2026-11-02T03:00:00Z')); // 10:00 Vietnam: 00:10 has passed
  const seen: string[] = [];
  const { p1, p2 } = twoProcesses(
    { name: 'thu.hang-ngay', description: 'thử', schedule: { dailyAt: '00:10' }, leaseMs: 60_000, run: async (c) => void seen.push(c.scheduledAt!.toISOString()) },
    clock,
  );
  await Promise.all([p1.tick(), p2.tick()]);
  expect(seen).toEqual(['2026-11-01T17:10:00.000Z']);
  clock.set(new Date('2026-11-02T16:59:00Z')); // 23:59 the same day
  await p1.tick();
  expect(seen).toHaveLength(1);
  clock.set(new Date('2026-11-02T17:10:00Z')); // 00:10 next day
  await p2.tick();
  expect(seen).toEqual(['2026-11-01T17:10:00.000Z', '2026-11-02T17:10:00.000Z']);
});

test('Job lỗi: không chạy lại ở mỗi lượt kiểm, thử lại sau 5 phút; trạng thái lỗi ghi ở _job_locks', async () => {
  const clock = new FakeClock(new Date('2026-11-02T01:00:00Z'));
  let runs = 0;
  let fail = true;
  const { name, p1 } = twoProcesses(
    {
      name: 'thu.loi',
      description: 'thử',
      schedule: { dailyAt: '08:00' },
      leaseMs: 60_000,
      run: async () => {
        runs++;
        if (fail) throw new Error('Google không trả lời');
      },
    },
    clock,
  );
  await p1.tick();
  expect(runs).toBe(1);
  const lock = await new JobLocks(a.db(name), clock).get('thu.loi');
  expect(lock).toMatchObject({ last_status: 'loi', last_error: 'Google không trả lời', owner: null });
  clock.advance(60_000);
  await p1.tick();
  expect(runs).toBe(1);
  fail = false;
  clock.advance(RETRY_AFTER_MS);
  await p1.tick();
  expect(runs).toBe(2);
  clock.advance(60_000);
  await p1.tick();
  expect(runs).toBe(2);
});

test('pnpm job:run: chạy ngay; tiến trình khác đang giữ khoá thì báo "đang chạy", không chạy chồng', async () => {
  const clock = new FakeClock(new Date('2026-11-02T01:00:00Z'));
  let running = 0;
  let max = 0;
  const { p1, p2 } = twoProcesses(
    {
      name: 'thu.tay',
      description: 'thử',
      schedule: 'manual',
      leaseMs: 60_000,
      run: async () => {
        max = Math.max(max, ++running);
        await new Promise((r) => setTimeout(r, 200));
        running--;
      },
    },
    clock,
  );
  const results = await Promise.all([p1.runNow('thu.tay'), p2.runNow('thu.tay')]);
  expect(results.sort()).toEqual(['dang_chay', 'ok']);
  expect(max).toBe(1);
  expect(await p1.tick()).toEqual([]); // manual jobs never run on a tick
  await expect(p1.runNow('khong.co')).rejects.toThrow('Không có job khong.co');
});
