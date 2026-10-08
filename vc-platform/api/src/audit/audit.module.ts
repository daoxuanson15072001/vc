import { randomBytes } from 'node:crypto';
import { Global, Inject, Module, type OnModuleInit } from '@nestjs/common';
import { addDays, ymdInVn } from '@vc/contracts';
import type { Db, MongoClient } from 'mongodb';
import { AlertService } from '../common/alerts';
import { DB, MONGO_CLIENT } from '../db/mongo';
import { JobRegistry } from '../jobs/registry';
import { JobsModule } from '../jobs/jobs.module';
import { AuditService } from './audit.service';
import { sealDays, verifyChain } from './seal';

@Global()
@Module({
  imports: [JobsModule],
  providers: [AuditService, AlertService],
  exports: [AuditService, AlertService],
})
export class AuditModule implements OnModuleInit {
  constructor(
    private readonly registry: JobRegistry,
    private readonly audit: AuditService,
    private readonly alerts: AlertService,
    @Inject(DB) private readonly db: Db,
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      name: 'audit.daily-seal',
      description: 'Niêm phong nhật ký ngày hôm trước',
      schedule: { dailyAt: '00:10' },
      leaseMs: 10 * 60_000,
      run: async (ctx) => {
        // The day before the run's occurrence (or before now for a manual run).
        const day = addDays(ymdInVn(ctx.scheduledAt ?? ctx.now), -1);
        return sealDays(this.db, this.client, this.audit, day, `job-${randomBytes(6).toString('hex')}`);
      },
    });
    this.registry.register({
      name: 'audit.verify-chain',
      description: 'Kiểm chuỗi băm của nhật ký',
      schedule: { dailyAt: '00:20' },
      leaseMs: 30 * 60_000,
      run: async (ctx) => {
        const problems = await verifyChain(this.db, ymdInVn(ctx.now));
        if (problems.length) {
          // Cảnh báo #8 (Khẩn): somebody changed the log outside the API.
          await this.alerts.send('khan', 'nhat_ky_lech', `Nhật ký bị sửa ngoài hệ thống: ${problems.length} chỗ lệch, ngày đầu ${problems[0].day_on}.`, { problems: problems.slice(0, 20) });
          throw new Error(`Chuỗi nhật ký lệch: ${problems.length} chỗ`);
        }
      },
    });
  }
}
