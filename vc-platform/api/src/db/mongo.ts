import { MongoClient, type Db } from 'mongodb';

export const MONGO_CLIENT = Symbol('MONGO_CLIENT');
export const DB = Symbol('DB');

export async function connectMongo(url: string): Promise<MongoClient> {
  const client = new MongoClient(url, { appName: 'vchome-api', serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  return client;
}

export interface MongoStatus {
  ok: boolean;
  replica_set: string | null;
  writable_primary: boolean;
  latency_ms: number | null;
}

export async function mongoStatus(db: Db): Promise<MongoStatus> {
  const started = Date.now();
  try {
    const hello = await db.command({ hello: 1 }, { timeoutMS: 2000 });
    return { ok: true, replica_set: hello.setName ?? null, writable_primary: !!hello.isWritablePrimary, latency_ms: Date.now() - started };
  } catch {
    return { ok: false, replica_set: null, writable_primary: false, latency_ms: null };
  }
}
