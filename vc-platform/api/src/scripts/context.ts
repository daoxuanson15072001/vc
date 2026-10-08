import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { makeClock } from '../app.factory';
import { AppModule } from '../app.module';
import { JsonLogger } from '../common/logger';
import { loadEnv } from '../config/env';

/** App without HTTP and without the job ticker, for command-line tools. */
export async function toolContext() {
  const env = loadEnv({ ...process.env, JOBS: 'off' });
  const log = new JsonLogger(env.LOG_LEVEL === 'debug' ? 'debug' : 'warn');
  const app = await NestFactory.createApplicationContext(AppModule.forRoot({ env, clock: makeClock(env), log }), { logger: log, abortOnError: false });
  await app.init();
  return app;
}
