import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import { AppModule } from './app.module';
import { tenantMiddleware } from './db/tenant-context';

/** Shared by main.ts and e2e tests so both run the exact same HTTP setup. */
export async function createApp(opts: { logger?: false; module?: unknown } = {}): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(opts.module ?? AppModule, {
    bodyParser: false,
    ...(opts.logger === false ? { logger: false } : {}),
  });
  app.disable('x-powered-by');
  // 500 messages with raw payloads can reach a few MB. Webhooks keep the raw
  // bytes (`req.rawBody`) for platform signature checks (X-Hub-Signature-256, Zalo OA mac).
  app.use(
    json({
      limit: '15mb',
      verify: (req, _res, buf) => {
        if (req.url?.startsWith('/api/webhooks/')) (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  // After the body parser: one tenant scope per request, filled by the AuthGuard.
  app.use(tenantMiddleware);
  app.setGlobalPrefix('api', { exclude: ['mcp', 'mcp/dev'] });
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.length) app.enableCors({ origin: origins, allowedHeaders: ['Authorization', 'Content-Type'] });
  app.enableShutdownHooks();
  return app;
}
