/** Process-wide providers: environment, clock, logger, MongoDB; runs migrations before the app takes requests. */
import { Global, Inject, Module, type DynamicModule, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type { Db, MongoClient } from 'mongodb';
import { CLOCK, type Clock } from './common/clock';
import { LOGGER, JsonLogger } from './common/logger';
import { ENV, type Env } from './config/env';
import { runMigrations } from './db/migrations';
import { connectMongo, DB, MONGO_CLIENT } from './db/mongo';

export interface CoreOptions {
  env: Env;
  clock: Clock;
  log: JsonLogger;
}

class MongoLifecycle implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(LOGGER) private readonly log: JsonLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    // Production: a separate login creates indexes and roles; the API login cannot (kế hoạch GĐ B mục 3.3 điểm 15).
    if (this.env.MONGO_MIGRATE_URL) {
      const c = await connectMongo(this.env.MONGO_MIGRATE_URL);
      try {
        await runMigrations(c.db(this.env.MONGO_DB), this.clock, this.log, `migrate:${process.pid}`, undefined, this.root);
      } finally {
        await c.close();
      }
    } else await runMigrations(this.db, this.clock, this.log, `migrate:${process.pid}`, undefined, this.root);
  }

  private get root() {
    return { code: this.env.ROOT_UNIT_CODE, name: this.env.ROOT_UNIT_NAME };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}

@Global()
@Module({})
export class CoreModule {
  static forRoot(o: CoreOptions): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: ENV, useValue: o.env },
        { provide: CLOCK, useValue: o.clock },
        { provide: LOGGER, useValue: o.log },
        { provide: MONGO_CLIENT, useFactory: () => connectMongo(o.env.MONGO_URL) },
        { provide: DB, useFactory: (c: MongoClient) => c.db(o.env.MONGO_DB), inject: [MONGO_CLIENT] },
        MongoLifecycle,
      ],
      exports: [ENV, CLOCK, LOGGER, MONGO_CLIENT, DB],
    };
  }
}
