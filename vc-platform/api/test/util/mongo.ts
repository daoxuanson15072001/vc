import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { JsonLogger } from '../../src/common/logger';
import { loadEnv, type Env } from '../../src/config/env';

/** Tests trigger errors on purpose; keep their log lines out of the test output. */
class SilentLogger extends JsonLogger {
  override write(): void {}
}
export const quietLog: JsonLogger = new SilentLogger();

export function uri(): string {
  const u = process.env.TEST_MONGO_URI;
  if (!u) throw new Error('Thiếu TEST_MONGO_URI (globalSetup chưa chạy)');
  return u;
}

export function dbName(): string {
  return `t_${randomBytes(5).toString('hex')}`;
}

export function testEnv(over: Record<string, string> = {}): Env {
  return loadEnv({ APP_ENV: 'test', MONGO_URL: uri(), MONGO_DB: dbName(), JOBS: 'off', LOG_LEVEL: 'error', ...over });
}

export async function connect(): Promise<MongoClient> {
  return new MongoClient(uri()).connect();
}
