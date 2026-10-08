import { Global, Inject, Module, type OnModuleInit } from '@nestjs/common';
import { ChangeHandlers } from '../common/changes';
import { ENV, type Env } from '../config/env';
import { CatalogService } from './catalogs/catalog.service';
import { CatalogsController } from './catalogs/catalogs.controller';
import { CatalogHooks } from './catalogs/hooks';
import { legalEntityRename } from './catalogs/legal-entity-rename';
import { unitCreate, unitHead, unitMove } from './units/handlers';
import { HeadReports } from './units/head-reports';
import { UnitService } from './units/unit.service';
import { UnitsController } from './units/units.controller';

/** Org structure (kế hoạch GĐ B mục 3.1 `org/`): catalogs (B-04), unit tree and heads (B-05). */
@Global()
@Module({
  controllers: [CatalogsController, UnitsController],
  providers: [CatalogService, CatalogHooks, UnitService, HeadReports],
  exports: [CatalogService, CatalogHooks, UnitService, HeadReports],
})
export class OrgModule implements OnModuleInit {
  constructor(
    private readonly handlers: ChangeHandlers,
    private readonly hooks: CatalogHooks,
    private readonly catalogs: CatalogService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.handlers.register(legalEntityRename(this.hooks));
    this.handlers.register(unitCreate(this.catalogs, this.env.ROOT_UNIT_CODE));
    this.handlers.register(unitMove(this.catalogs, this.env.ROOT_UNIT_CODE));
    this.handlers.register(unitHead(this.env.ROOT_UNIT_CODE));
  }
}
