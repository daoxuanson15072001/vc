import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { HealthT } from '@vc/contracts';
import type { Response } from 'express';
import type { Db } from 'mongodb';
import { Public } from '../auth/decorators';
import { CLOCK, type Clock } from '../common/clock';
import { ENV, type Env } from '../config/env';
import { C } from '../db/collections';
import { DB, mongoStatus } from '../db/mongo';
import { HEARTBEAT_JOB } from '../jobs/heartbeat';
import type { JobLockDoc } from '../jobs/job-locks';

/** GET /api/health: 200 when MongoDB answers as a writable primary, otherwise 503 (giám sát, thiết kế SSO mục 11). */
@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  async get(@Res({ passthrough: true }) res: Response): Promise<HealthT> {
    const mongo = await mongoStatus(this.db);
    const beat = mongo.ok ? await this.db.collection<JobLockDoc>(C.jobLocks).findOne({ _id: HEARTBEAT_JOB }).catch(() => null) : null;
    const body: HealthT = {
      status: mongo.ok && mongo.writable_primary ? 'ok' : 'loi',
      app_env: this.env.APP_ENV,
      version: this.env.APP_VERSION,
      time: this.clock.now().toISOString(),
      mongo,
      jobs: { enabled: this.env.JOBS === 'on', last_heartbeat_at: beat?.last_finished_at?.toISOString() ?? null },
    };
    res.setHeader('Cache-Control', 'no-store');
    if (body.status !== 'ok') res.status(503);
    return body;
  }
}
