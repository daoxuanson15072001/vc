import { Module, type OnModuleInit } from '@nestjs/common';
import { ChangeHandlers } from '../common/changes';
import { CatalogService } from '../org/catalogs/catalog.service';
import { personStatus, personUpdate } from './handlers';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { positionOpen } from './positions/position-open';

/** Profiles (B-06); positions grow in B-07, statuses in B-09. */
@Module({
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule implements OnModuleInit {
  constructor(
    private readonly handlers: ChangeHandlers,
    private readonly catalogs: CatalogService,
  ) {}

  onModuleInit(): void {
    this.handlers.register(positionOpen(this.catalogs));
    this.handlers.register(personStatus());
    this.handlers.register(personUpdate(this.catalogs));
  }
}
