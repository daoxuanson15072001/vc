import { Controller, Get, Param, Query } from '@nestjs/common';
import { productSearchQuerySchema, type ProductSearchResponse } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { CatalogService } from './catalog.service';

const id = z.string().trim().min(1).max(160);

/** Tra hàng VCsales in the chat panel (M1c-01). Permissions: apps/api/src/authz/route-permissions.ts, group "Catalog". */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('by-identity/:uid/:userId/search')
  search(@Param('uid') uid: string, @Param('userId') userId: string, @Query() query: unknown, @CurrentSubject() u?: Subject): Promise<ProductSearchResponse> {
    return this.catalog.search(parseOr400(id, uid), parseOr400(id, userId), parseOr400(productSearchQuerySchema, query).q, u);
  }
}
