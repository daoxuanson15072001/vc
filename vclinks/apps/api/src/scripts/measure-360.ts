/**
 * Times the opening of Customer 360 for the customer with the most messages (M1b-13, "mở 360 ≤ 3 giây").
 *
 *   MONGO_URI=mongodb://localhost:27017/<copy of vclinks> pnpm --filter @vclinks/api measure:360 [--tenant vcpv] [--runs 5]
 *
 * Read only on customer data (the VCsales cache `erp_commerce` is written when the customer has a linked code).
 * Run it on a copy of the real database (mongodump | mongorestore --nsFrom/--nsTo), not on `vclinks`. Calls the
 * services directly with full rights, so it measures the queries, not the HTTP layer. Prints times only.
 */
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Customer360Service } from '../customers/customer-360.service';
import { CUST_C } from '../customers/customers.types';
import { C, DbService } from '../db/db.service';
import { runAsTenant } from '../db/tenant-context';

async function main() {
  const { values } = parseArgs({ options: { tenant: { type: 'string', default: process.env.DEFAULT_TENANT_ID || 'vcpv' }, runs: { type: 'string', default: '5' } } });
  // Booting AppModule creates indexes and may write the VCsales cache: never on the real database.
  const dbName = new URL(process.env.MONGO_URI ?? 'mongodb://localhost:27017/vclinks').pathname.replace(/^\//, '') || 'test';
  if (['vclinks', 'vczalo', 'vcconnect'].includes(dbName)) {
    console.error(`Từ chối: "${dbName}" là database thật. Chạy trên bản sao (ví dụ vclinks_copy_...) qua MONGO_URI.`);
    process.exitCode = 1;
    return;
  }
  process.env.CUSTOMERS_SWEEP_MS = '0';
  process.env.KPI_JOB = 'off';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    await runAsTenant(values.tenant!, async () => {
      const db = app.get(DbService);
      // Customer with the most messages over all its identities.
      const top = await db
        .col(CUST_C.identityLinks)
        .aggregate<{ _id: string; n: number; identities: number }>([
          { $lookup: { from: C.messages, let: { u: '$uid', t: '$userId' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$uid', '$$u'] }, { $eq: ['$threadId', '$$t'] }] } } }, { $count: 'n' }], as: 'm' } },
          { $group: { _id: '$accountId', n: { $sum: { $ifNull: [{ $arrayElemAt: ['$m.n', 0] }, 0] } }, identities: { $sum: 1 } } },
          { $sort: { n: -1 } },
          { $limit: 1 },
        ])
        .toArray();
      if (!top[0]) throw new Error('Không có khách nào trong cơ sở dữ liệu này.');
      const svc = app.get(Customer360Service);
      const runs = Number(values.runs);
      const ms: number[] = [];
      for (let i = 0; i < runs; i++) {
        const t0 = Date.now();
        const page = await svc.byAccount(top[0]._id, undefined);
        const t1 = Date.now();
        await svc.timelineOf(top[0]._id, { limit: 50 }, undefined);
        ms.push(t1 - t0 + (Date.now() - t1));
        if (i === 0) console.log(`khách nhiều tin nhất: ${top[0].n} tin, ${top[0].identities} danh tính, ${page.recent.length} sự kiện gần nhất, ${page.activity.length} hội thoại hoạt động`);
      }
      console.log(`mở 360 + dòng thời gian trang 1, ${runs} lần (ms): ${ms.join(', ')}`);
    });
  } finally {
    await app.close();
  }
}
void main();
