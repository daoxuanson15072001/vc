/**
 * Builds the HTTP app (kế hoạch GĐ B B-01): body size limit, X-Correlation-Id, the two error shapes, prefix /api.
 * Tests call it with their own env and clock.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express, { type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';
import { FakeClock, SystemClock, type Clock } from './common/clock';
import { ErrorFilter } from './common/error.filter';
import { correlation, sendError } from './common/http';
import { JsonLogger } from './common/logger';
import { loadEnv, type Env } from './config/env';

export function makeClock(env: Env): Clock {
  return env.CLOCK_MODE === 'fake' ? new FakeClock() : new SystemClock();
}

export async function createApp(opts: { env?: Env; clock?: Clock; log?: JsonLogger; extraModules?: Type[] } = {}): Promise<NestExpressApplication> {
  const env = opts.env ?? loadEnv();
  const log = opts.log ?? new JsonLogger(env.LOG_LEVEL);
  const clock = opts.clock ?? makeClock(env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot({ env, clock, log }, opts.extraModules), {
    bodyParser: false,
    logger: log,
    abortOnError: false,
  });
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback, uniquelocal');
  app.use(correlation(log));
  app.use(express.json({ limit: env.BODY_LIMIT }));
  // Errors of the body parser happen before Nest's router; give them the same shapes.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => sendError(req, res, err, log));
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ErrorFilter(log));
  app.enableShutdownHooks();
  return app;
}
