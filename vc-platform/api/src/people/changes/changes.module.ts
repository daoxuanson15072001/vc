import { randomBytes } from 'node:crypto';
import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { ChangeHandlers, ChangeHooks } from '../../common/changes';
import { JobRegistry } from '../../jobs/registry';
import { JobsModule } from '../../jobs/jobs.module';
import { ChangeService } from './change.service';
import { ChangesController } from './changes.controller';

@Global()
@Module({
  imports: [JobsModule],
  controllers: [ChangesController],
  providers: [ChangeHandlers, ChangeHooks, ChangeService],
  exports: [ChangeHandlers, ChangeHooks, ChangeService],
})
export class ChangesModule implements OnModuleInit {
  constructor(
    private readonly registry: JobRegistry,
    private readonly changes: ChangeService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      name: 'scheduled-changes.apply',
      description: 'Áp các thay đổi hẹn ngày đã tới giờ (cơ cấu trước, người sau)',
      schedule: { everyMinutes: 1 },
      leaseMs: 5 * 60_000,
      quiet: true,
      run: () => this.changes.applyDue(`job-${randomBytes(6).toString('hex')}`),
    });
  }
}
