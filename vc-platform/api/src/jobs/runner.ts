/**
 * Runs jobs inside the API process (khung chung mục 3: no Redis). Every process ticks; the lease in `_job_locks`
 * decides which one runs a slot, so two API processes never run the same slot twice.
 */
import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import type { Db } from 'mongodb';
import type { Clock } from '../common/clock';
import type { JsonLogger } from '../common/logger';
import { JobLocks } from './job-locks';
import type { JobDef, JobRegistry } from './registry';
import { lastOccurrence } from './schedule';

/** A failed scheduled run is tried again after this delay (not on every tick). */
export const RETRY_AFTER_MS = 5 * 60_000;

export type RunResult = 'ok' | 'loi' | 'dang_chay';

export class JobRunner {
  readonly owner = `${hostname()}:${process.pid}:${randomBytes(3).toString('hex')}`;
  private readonly locks: JobLocks;
  private readonly running = new Map<string, Promise<RunResult>>();
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly registry: JobRegistry,
    private readonly log: JsonLogger,
  ) {
    this.locks = new JobLocks(db, clock);
  }

  start(tickMs: number): void {
    this.timer = setInterval(() => void this.tick().catch((e) => this.log.write('error', 'job_tick_failed', { error: String(e) })), tickMs);
    void this.tick().catch(() => undefined);
  }

  /** Stops ticking and waits up to `waitMs` for running jobs (their lease expires if they are cut off). */
  async stop(waitMs = 10_000): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    let giveUp: NodeJS.Timeout | undefined;
    await Promise.race([Promise.allSettled([...this.running.values()]), new Promise((r) => (giveUp = setTimeout(r, waitMs)))]);
    clearTimeout(giveUp);
  }

  /** One pass over scheduled jobs. Resolves when the jobs it started have finished; returns their names. */
  async tick(): Promise<string[]> {
    if (this.ticking) return [];
    this.ticking = true;
    try {
      const now = this.clock.now();
      const started: Promise<RunResult>[] = [];
      const names: string[] = [];
      for (const def of this.registry.list()) {
        if (this.running.has(def.name)) continue;
        const occ = lastOccurrence(def.schedule, now);
        if (!occ) continue;
        const got = await this.locks.acquireSlot(def.name, occ.toISOString(), this.owner, def.leaseMs);
        if (!got) continue;
        names.push(def.name);
        started.push(this.execute(def, { manual: false, scheduledAt: occ, previousSlot: got.previousSlot }));
      }
      await Promise.all(started);
      return names;
    } finally {
      this.ticking = false;
    }
  }

  /** `pnpm job:run <tên>`: runs now whatever the schedule, unless another process holds the lease. */
  async runNow(name: string): Promise<RunResult> {
    const def = this.registry.get(name);
    if (!def) throw new Error(`Không có job ${name}. Các job: ${this.registry.list().map((j) => j.name).join(', ')}`);
    if (!(await this.locks.acquire(name, this.owner, def.leaseMs))) return 'dang_chay';
    return this.execute(def, { manual: true });
  }

  private execute(def: JobDef, o: { manual: boolean; scheduledAt?: Date; previousSlot?: string | null }): Promise<RunResult> {
    const p = (async (): Promise<RunResult> => {
      const t0 = Date.now();
      try {
        await def.run({ name: def.name, now: this.clock.now(), scheduledAt: o.scheduledAt, manual: o.manual, db: this.db, clock: this.clock, log: this.log });
        const ms = Date.now() - t0;
        if (ms > def.leaseMs) this.log.write('warn', 'job_longer_than_lease', { job: def.name, ms, lease_ms: def.leaseMs });
        await this.locks.release(def.name, this.owner, { status: 'ok', durationMs: ms });
        if (!def.quiet || o.manual) this.log.info('job_done', { job: def.name, ms, manual: o.manual });
        return 'ok';
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        this.log.write('error', 'job_failed', { job: def.name, error, manual: o.manual });
        await this.locks.release(def.name, this.owner, {
          status: 'loi',
          error: error.slice(0, 500),
          durationMs: Date.now() - t0,
          ...(o.manual ? {} : { restoreSlot: o.previousSlot ?? null, retryAfterMs: RETRY_AFTER_MS }),
        });
        return 'loi';
      } finally {
        this.running.delete(def.name);
      }
    })();
    this.running.set(def.name, p);
    return p;
  }
}
