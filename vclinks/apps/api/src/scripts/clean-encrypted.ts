/**
 * Reduces already-stored encrypted records to metadata only, matching the new
 * ingest behaviour: drop ciphertext content fields, strip ciphertext out of
 * `raw`, and mark messages `content_pending`. Nothing is deleted; a later
 * re-sync would produce the same result. Idempotent.
 *
 *   pnpm encrypted:clean
 */
import 'reflect-metadata';
import { ENCRYPTION_VERSION_FIELD, stripEncryptedValues } from '@vclinks/shared';
import type { Document } from 'mongodb';
import { C, DbService } from '../db/db.service';

const CONTENT_FIELDS: Record<string, string[]> = {
  [C.contacts]: ['displayName', 'zaloName', 'phone', 'avatar'],
  [C.groups]: ['name', 'avatar'],
  [C.messages]: ['text', 'senderName', 'content', 'quoteRef'],
};

const BATCH = 500;

async function main() {
  const db = new DbService();
  await db.onModuleInit();
  try {
    const encrypted = { encrypted: true };
    for (const [coll, fields] of Object.entries(CONTENT_FIELDS)) {
      const col = db.col<Document & { _id: string }>(coll);
      const cursor = col.find(encrypted, { projection: { raw: 1 } });
      let ops: Document[] = [];
      let cleaned = 0;
      const flush = async () => {
        if (!ops.length) return;
        await col.bulkWrite(ops as never, { ordered: false });
        cleaned += ops.length;
        ops = [];
      };
      for await (const doc of cursor) {
        const unset: Record<string, ''> = Object.fromEntries(fields.map((f) => [f, '']));
        const set: Document = {};
        if (doc.raw && typeof doc.raw === 'object') set.raw = stripEncryptedValues(doc.raw);
        if (coll === C.messages) set.contentStatus = 'pending';
        ops.push({ updateOne: { filter: { _id: doc._id }, update: { $unset: unset, $set: set } } });
        if (ops.length >= BATCH) await flush();
      }
      await flush();
      console.log(`${coll}: dọn ${cleaned} bản ghi mã hóa về dạng metadata.`);
    }
    // Safety: no lingering ev marker in any raw.
    for (const coll of Object.keys(CONTENT_FIELDS)) {
      const left = await db.col(coll).countDocuments({ [`raw.${ENCRYPTION_VERSION_FIELD}`]: { $exists: true } });
      if (left) console.warn(`${coll}: còn ${left} bản ghi vẫn có raw.${ENCRYPTION_VERSION_FIELD}`);
    }
    await db.audit('script:clean-encrypted', 'data.clean_encrypted', 'all');
  } finally {
    await db.onModuleDestroy();
  }
}

void main();
