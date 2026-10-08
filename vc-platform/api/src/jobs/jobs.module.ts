import { Inject, Module, type OnApplicationBootstrap, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type { Db } from 'mongodb';
import { CLOCK, type Clock } from '../common/clock';
import { LOGGER, type JsonLogger } from '../common/logger';
import { ENV, type Env } from '../config/env';
import { DB } from '../db/mongo';
import { heartbeatJob } from './heartbeat';
import { JobRegistry } from './registry';
import { JobRunner } from './runner';

@Module({
  providers: [
    JobRegistry,
    {
      provide: JobRunner,
      useFactory: (db: Db, clock: Clock, registry: JobRegistry, log: JsonLogger) => new JobRunner(db, clock, registry, log),
      inject: [DB, CLOCK, JobRegistry, LOGGER],
    },
  ],
  exports: [JobRegistry, JobRunner],
})
export class JobsModule implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    private readonly registry: JobRegistry,
    private readonly runner: JobRunner,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.registry.register(heartbeatJob);
  }

  // After every module registered its jobs and migrations are done.
  onApplicationBootstrap(): void {
    if (this.env.JOBS === 'on') this.runner.start(this.env.JOBS_TICK_SECONDS * 1000);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.runner.stop();
  }
}
