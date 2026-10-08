import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { ChangeHandlers } from '../common/changes';
import { CatalogService } from './catalogs/catalog.service';
import { CatalogsController } from './catalogs/catalogs.controller';
import { CatalogHooks } from './catalogs/hooks';
import { legalEntityRename } from './catalogs/legal-entity-rename';

/** Org structure (kế hoạch GĐ B mục 3.1 `org/`): catalogs (B-04); org units and heads come with B-05. */
@Global()
@Module({
  controllers: [CatalogsController],
  providers: [CatalogService, CatalogHooks],
  exports: [CatalogService, CatalogHooks],
})
export class OrgModule implements OnModuleInit {
  constructor(
    private readonly handlers: ChangeHandlers,
    private readonly hooks: CatalogHooks,
  ) {}

  onModuleInit(): void {
    this.handlers.register(legalEntityRename(this.hooks));
  }
}
