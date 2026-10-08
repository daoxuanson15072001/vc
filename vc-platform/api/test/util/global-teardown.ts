import type { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalTeardown(): Promise<void> {
  await (globalThis as { __RS__?: MongoMemoryReplSet }).__RS__?.stop();
}
