/** Catalog tabs of VH-MH-13 (kế hoạch GĐ B mục 5.2 "Cơ cấu, danh mục"; 04 VH-ORG-02, 03, 07). */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { isCatalogType, type CatalogType } from '@vc/contracts';
import type { Response } from 'express';
import { Can } from '../../auth/decorators';
import { ApiError } from '../../common/api-error';
import { Req } from '../../common/request-context';
import type { Requester } from '../../people/changes/change.service';
import { CatalogService } from './catalog.service';
import { catalogXlsx } from './export';

/** Query values are strings; a repeated parameter (an array) is ignored. */
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

function catalogType(raw: string): CatalogType {
  if (!isCatalogType(raw)) throw new ApiError('not_found');
  return raw;
}

@Controller('v1/admin/catalogs')
@Can('co_cau.sua')
export class CatalogsController {
  constructor(private readonly catalogs: CatalogService) {}

  /** `GET …/job-titles?status=&q=&function=` lists; `GET …/job-titles.xlsx` exports the whole tab. */
  @Get(':type')
  async list(@Param('type') raw: string, @Query() q: Record<string, unknown>, @Req() req: Requester, @Res({ passthrough: true }) res: Response) {
    if (raw.endsWith('.xlsx')) {
      const type = catalogType(raw.slice(0, -5));
      const { items } = await this.catalogs.list(type, {}, req.viewer);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="danh-muc-${type}.xlsx"`);
      return new StreamableFile(await catalogXlsx(type, items));
    }
    return this.catalogs.list(catalogType(raw), { status: str(q.status), q: str(q.q), function: str(q.function) }, req.viewer);
  }

  @Get(':type/:code')
  get(@Param('type') raw: string, @Param('code') code: string, @Req() req: Requester) {
    return this.catalogs.get(catalogType(raw), code, req.viewer);
  }

  @Post(':type')
  create(@Param('type') raw: string, @Body() body: unknown, @Req() req: Requester) {
    return this.catalogs.create(catalogType(raw), body, req);
  }

  @Patch(':type/:code')
  update(@Param('type') raw: string, @Param('code') code: string, @Body() body: unknown, @Req() req: Requester) {
    return this.catalogs.update(catalogType(raw), code, body, req);
  }

  @Post(':type/:code/deactivate')
  @HttpCode(200)
  deactivate(@Param('type') raw: string, @Param('code') code: string, @Body() body: unknown, @Req() req: Requester) {
    return this.catalogs.deactivate(catalogType(raw), code, body, req);
  }

  @Post(':type/:code/activate')
  @HttpCode(200)
  activate(@Param('type') raw: string, @Param('code') code: string, @Body() body: unknown, @Req() req: Requester) {
    return this.catalogs.activate(catalogType(raw), code, body, req);
  }

  /** `DELETE …/{code}?rev=`: only entries never used. */
  @Delete(':type/:code')
  remove(@Param('type') raw: string, @Param('code') code: string, @Query('rev') rev: string | undefined, @Req() req: Requester) {
    return this.catalogs.remove(catalogType(raw), code, rev, req);
  }
}
