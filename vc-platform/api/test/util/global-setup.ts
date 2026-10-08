import { MongoMemoryReplSet } from 'mongodb-memory-server';

// One replica set for every test file; each test uses its own database (transactions need a replica set).
export default async function globalSetup(): Promise<void> {
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  (globalThis as { __RS__?: MongoMemoryReplSet }).__RS__ = rs;
  process.env.TEST_MONGO_URI = rs.getUri();
}
