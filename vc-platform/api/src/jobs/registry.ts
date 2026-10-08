import { Injectable } from '@nestjs/common';
import type { Db } from 'mongodb';
import type { Clock } from '../common/clock';
import type { JsonLogger } from '../common/logger';
import { checkSchedule, type Schedule } from './schedule';

export interface JobContext {
  name: string;
  now: Date;
  /** Occurrence being run (scheduled runs only): a daily 00:10 job that runs late still knows which day it is for. */
  scheduledAt?: Date;
  manual: boolean;
  db: Db;
  clock: Clock;
  log: JsonLogger;
}

export interface JobDef {
  /** `module.viec`, e.g. `scheduled-changes.apply` (kế hoạch GĐ B mục 6.1). */
  name: string;
  description: string;
  schedule: Schedule;
  /** Lease length; must be longer than one run. */
  leaseMs: number;
  /** No log line for a successful run (heartbeat-like jobs that run every minute). */
  quiet?: boolean;
  run(ctx: JobContext): Promise<unknown>;
}

/** Modules register their jobs here in onModuleInit. */
@Injectable()
export class JobRegistry {
  private readonly jobs = new Map<string, JobDef>();

  register(def: JobDef): void {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(def.name)) throw new Error(`Tên job không hợp lệ: ${def.name}`);
    if (this.jobs.has(def.name)) throw new Error(`Job trùng tên: ${def.name}`);
    checkSchedule(def.schedule);
    this.jobs.set(def.name, def);
  }

  get(name: string): JobDef | undefined {
    return this.jobs.get(name);
  }

  list(): JobDef[] {
    return [...this.jobs.values()];
  }
}
