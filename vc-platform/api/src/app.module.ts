import { Module, type DynamicModule } from '@nestjs/common';
import { CoreModule, type CoreOptions } from './core.module';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';

@Module({})
export class AppModule {
  static forRoot(o: CoreOptions): DynamicModule {
    return { module: AppModule, imports: [CoreModule.forRoot(o), JobsModule], controllers: [HealthController] };
  }
}
