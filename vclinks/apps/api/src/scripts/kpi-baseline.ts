/**
 * Computes the baseline KPI days from `messages` (M1b-15). Needs no backfill of the inbox state: turns are derived
 * from message times, and one document per account and day is upserted, so re-running never duplicates.
 *
 *   pnpm --filter @vclinks/api kpi:baseline --from 2026-09-01 --to 2026-10-03 [--tenant vcpv]
 *
 * Env: MONGO_URI. Run it on a copy or test database first. Prints counts only.
 */
import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { runAsTenant } from '../db/tenant-context';
import { EventsService } from '../events/events.service';
import { MetricsService, vnDay } from '../metrics/metrics.service';

@Module({ providers: [DbService, EventsService, MetricsService] })
class KpiModule {}

async function main() {
  const { values } = parseArgs({
    options: { from: { type: 'string' }, to: { type: 'string' }, tenant: { type: 'string', default: process.env.DEFAULT_TENANT_ID || 'vcpv' } },
  });
  const to = values.to ?? vnDay(Date.now() - 24 * 3600_000);
  const from = values.from ?? vnDay(Date.parse(to) - 29 * 24 * 3600_000);
  const app = await NestFactory.createApplicationContext(KpiModule, { logger: ['error', 'warn'] });
  try {
    const r = await runAsTenant(values.tenant!, () => app.get(MetricsService).run(from, to));
    console.log(`kpi:baseline ${from}..${to}: ${r.days} ngày, ${r.accounts} tài khoản, ${r.turns} lượt chờ`);
  } finally {
    await app.close();
  }
}
void main();
