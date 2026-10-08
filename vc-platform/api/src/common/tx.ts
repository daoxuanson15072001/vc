/**
 * Transactions (khung chung mục 3: data, audit and outbox commit together). Retries the whole transaction on
 * TransientTransactionError (e.g. a write conflict) and the commit on UnknownTransactionCommitResult.
 */
import { MongoError, type ClientSession, type MongoClient } from 'mongodb';

const hasLabel = (e: unknown, label: string) => e instanceof MongoError && e.hasErrorLabel(label);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withTx<T>(client: MongoClient, fn: (session: ClientSession) => Promise<T>, opts: { maxAttempts?: number } = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 5;
  for (let attempt = 1; ; attempt++) {
    const session = client.startSession();
    try {
      session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
      const result = await fn(session);
      await commit(session);
      return result;
    } catch (e) {
      if (session.inTransaction()) await session.abortTransaction().catch(() => undefined);
      if (hasLabel(e, 'TransientTransactionError') && attempt < maxAttempts) {
        await sleep(20 * attempt + Math.random() * 30);
        continue;
      }
      throw e;
    } finally {
      await session.endSession();
    }
  }
}

async function commit(session: ClientSession): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await session.commitTransaction();
      return;
    } catch (e) {
      if (hasLabel(e, 'UnknownTransactionCommitResult') && i < 3) continue;
      throw e;
    }
  }
}
