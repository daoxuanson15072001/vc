import type { JobDef } from './registry';

export const HEARTBEAT_JOB = 'he-thong.nhip';

/** Runs every minute and does nothing: its `last_finished_at` in `_job_locks` shows the scheduler is alive (/api/health). */
export const heartbeatJob: JobDef = {
  name: HEARTBEAT_JOB,
  description: 'Nhịp của bộ chạy job',
  schedule: { everyMinutes: 1 },
  leaseMs: 60_000,
  quiet: true,
  async run() {},
};
