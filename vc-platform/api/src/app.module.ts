import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CoreModule, type CoreOptions } from './core.module';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';
import { OrgModule } from './org/org.module';
import { ChangesModule } from './people/changes/changes.module';
import { SettingsModule } from './settings/settings.module';

@Module({})
export class AppModule {
  /** `extra`: modules added by tests (sample routes). */
  static forRoot(o: CoreOptions, extra: Type[] = []): DynamicModule {
    return { module: AppModule, imports: [CoreModule.forRoot(o), JobsModule, AuthModule, AuditModule, SettingsModule, ChangesModule, OrgModule, ...extra], controllers: [HealthController] };
  }
}
