import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CoreModule, type CoreOptions } from './core.module';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';

@Module({})
export class AppModule {
  /** `extra`: modules added by tests (sample routes). */
  static forRoot(o: CoreOptions, extra: Type[] = []): DynamicModule {
    return { module: AppModule, imports: [CoreModule.forRoot(o), JobsModule, AuthModule, AuditModule, ...extra], controllers: [HealthController] };
  }
}
