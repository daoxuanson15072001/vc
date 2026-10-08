import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { createApp } from '../../src/app.factory';
import { TokenService } from '../../src/auth/token.service';
import { DbService } from '../../src/db/db.service';

/** Base server for e2e runs; only the host is used, the database name is generated per run. */
const MONGO_BASE = process.env.E2E_MONGO_URL ?? 'mongodb://localhost:27017';

export interface E2EApp {
  app: INestApplication;
  db: DbService;
  dbName: string;
  /** Bearer headers per scope. */
  auth: Record<'dashboard' | 'ingest' | 'mcp', { Authorization: string }>;
  /** Bearer headers per scope for another tenant (default tenant is the `auth` one). */
  authFor(tenantId: string): Promise<E2EApp['auth']>;
  close(): Promise<void>;
}

/**
 * Boots the real API on a random port against a real MongoDB, in a throwaway
 * database `vclinks_test_<random>` that is dropped on close. Never touches `vclinks`.
 */
export async function startE2EApp(opts: { module?: unknown } = {}): Promise<E2EApp> {
  const dbName = `vclinks_test_${randomBytes(4).toString('hex')}`;
  process.env.MONGO_URI = `${MONGO_BASE.replace(/\/+$/, '')}/${dbName}`;
  // A real server may hold legacy databases (vcconnect, vczalo); never migrate them into a test db.
  process.env.LEGACY_DB_NAMES = '';
  const app = await createApp({ logger: false, module: opts.module });
  await app.listen(0);
  const tokens = app.get(TokenService);
  const authFor = async (tenantId?: string) => {
    const auth = {} as E2EApp['auth'];
    for (const s of ['dashboard', 'ingest', 'mcp'] as const) {
      const name = tenantId ? `e2e-${tenantId}-${s}` : `e2e-${s}`;
      auth[s] = { Authorization: `Bearer ${await tokens.create(name, [s], tenantId)}` };
    }
    return auth;
  };
  return {
    app,
    db: app.get(DbService),
    dbName,
    auth: await authFor(),
    authFor,
    async close() {
      await app.close();
      const client = new MongoClient(MONGO_BASE);
      try {
        await client.connect();
        await client.db(dbName).dropDatabase();
      } finally {
        await client.close();
      }
    },
  };
}
