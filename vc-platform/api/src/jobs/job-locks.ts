/**
 * Leases in `_job_locks` (khung chung mục 3). One document per job: who holds the lease and until when, the last
 * schedule slot taken (so a slot runs once across every process), and the last result.
 */
import type { Db, Filter } from 'mongodb';
import type { Clock } from '../common/clock';
import { C } from '../db/collections';

export interface JobLockDoc {
  _id: string;
  owner: string | null;
  lease_until: Date | null;
  last_slot: string | null;
  retry_not_before: Date | null;
  started_at?: Date;
  last_finished_at?: Date;
  last_status?: 'ok' | 'loi';
  last_error?: string | null;
  last_duration_ms?: number;
  runs?: number;
}

export interface ReleaseResult {
  status: 'ok' | 'loi';
  error?: string;
  durationMs?: number;
  /** After a failed scheduled run: give the slot back so it is tried again after `retryAfterMs`. */
  restoreSlot?: string | null;
  retryAfterMs?: number;
}

export class JobLocks {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  private get col() {
    return this.db.collection<JobLockDoc>(C.jobLocks);
  }

  private async ensure(name: string): Promise<void> {
    try {
      await this.col.updateOne(
        { _id: name },
        { $setOnInsert: { owner: null, lease_until: null, last_slot: null, retry_not_before: null } },
        { upsert: true },
      );
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e; // another process inserted it first
    }
  }

  private free(now: Date): Filter<JobLockDoc> {
    return { $or: [{ lease_until: null }, { lease_until: { $lte: now } }] };
  }

  /** Takes the lease for `slot` if that slot has not been taken yet. Returns the previous slot, or undefined. */
  async acquireSlot(name: string, slot: string, owner: string, leaseMs: number): Promise<{ previousSlot: string | null } | undefined> {
    await this.ensure(name);
    const now = this.clock.now();
    const before = await this.col.findOneAndUpdate(
      {
        _id: name,
        last_slot: { $ne: slot },
        $and: [this.free(now), { $or: [{ retry_not_before: null }, { retry_not_before: { $lte: now } }] }],
      },
      { $set: { owner, lease_until: new Date(now.getTime() + leaseMs), last_slot: slot, started_at: now } },
      { returnDocument: 'before' },
    );
    return before ? { previousSlot: before.last_slot } : undefined;
  }

  /** Takes the lease regardless of the schedule (manual runs, migrations). */
  async acquire(name: string, owner: string, leaseMs: number): Promise<boolean> {
    await this.ensure(name);
    const now = this.clock.now();
    const res = await this.col.findOneAndUpdate(
      { _id: name, ...this.free(now) },
      { $set: { owner, lease_until: new Date(now.getTime() + leaseMs), started_at: now } },
    );
    return !!res;
  }

  async release(name: string, owner: string, r: ReleaseResult): Promise<void> {
    const now = this.clock.now();
    const set: Partial<JobLockDoc> = {
      owner: null,
      lease_until: null,
      last_finished_at: now,
      last_status: r.status,
      last_error: r.error ?? null,
      last_duration_ms: r.durationMs ?? 0,
    };
    if (r.restoreSlot !== undefined) {
      set.last_slot = r.restoreSlot;
      set.retry_not_before = new Date(now.getTime() + (r.retryAfterMs ?? 0));
    } else if (r.status === 'ok') set.retry_not_before = null;
    await this.col.updateOne({ _id: name, owner }, { $set: set, $inc: { runs: 1 } });
  }

  get(name: string): Promise<JobLockDoc | null> {
    return this.col.findOne({ _id: name });
  }
}
