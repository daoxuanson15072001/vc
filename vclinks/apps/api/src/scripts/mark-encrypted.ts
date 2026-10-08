/**
 * Flags records ingested as Zalo Web ciphertext (`raw.ev` non-zero) with
 * `encrypted: true`, so the Dashboard withholds them. Nothing is deleted:
 * the ciphertext is kept in case it can be decrypted later. Idempotent.
 *
 *   pnpm encrypted:mark
 */
import 'reflect-metadata';
import { ENCRYPTION_VERSION_FIELD } from '@vclinks/shared';
import { C, DbService } from '../db/db.service';

const COLLECTIONS = [C.contacts, C.groups, C.conversations, C.messages] as const;

async function main() {
  const db = new DbService();
  await db.onModuleInit();
  try {
    const path = `raw.${ENCRYPTION_VERSION_FIELD}`;
    const encrypted = { [path]: { $exists: true, $nin: [null, 0, '0', '', false] } };
    const counts: Record<string, number> = {};
    for (const name of COLLECTIONS) {
      const res = await db.col(name).updateMany({ ...encrypted, encrypted: { $ne: true } }, { $set: { encrypted: true } });
      counts[name] = res.modifiedCount;
      console.log(`${name}: đánh dấu ${res.modifiedCount} bản ghi mã hóa.`);
    }
    await db.audit('script:mark-encrypted', 'data.mark_encrypted', 'all', counts);
  } finally {
    await db.onModuleDestroy();
  }
}

void main();
