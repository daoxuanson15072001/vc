/**
 * Replays the erasure ledger after restoring a backup of the main database (BA §2.2 #9, VCL-ADM-15):
 * keys of erased customers are deleted again and their plaintext content scrubbed.
 *
 *   pnpm --filter @vclinks/api security:reapply-erasures [--tenant vcpv]
 *
 * Env: MONGO_URI (restored database), ERASURE_LEDGER_DB (default `<db>_erasures`, kept outside the
 * main backup), CUSTOMER_KEK not needed. Idempotent; prints counts only.
 */
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { runAsTenant } from '../db/tenant-context';
import { CustomerKeysService } from '../security/customer-keys.service';
import { MessageVault } from '../security/message-vault';

@Module({ providers: [DbService, CustomerKeysService, MessageVault] })
class ReapplyModule {}

/** Shared with the e2e test. */
export async function reapplyErasures(keys: CustomerKeysService, vault: MessageVault) {
  const r = await keys.reapplyErasures();
  const scrubbed = await vault.scrubSubjects(r.subjects);
  return { subjects: r.subjects.length, keysDestroyed: r.keysDestroyed, scrubbed };
}

async function main() {
  const { values } = parseArgs({ options: { tenant: { type: 'string', default: process.env.DEFAULT_TENANT_ID || 'vcpv' } } });
  const app = await NestFactory.createApplicationContext(ReapplyModule, { logger: ['error', 'warn'] });
  try {
    const r = await runAsTenant(values.tenant!, () => reapplyErasures(app.get(CustomerKeysService), app.get(MessageVault)));
    console.log(`Đã áp lại ${r.subjects} lần xóa: hủy ${r.keysDestroyed} khóa, xóa nội dung ${r.scrubbed} tin còn dạng rõ.`);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
