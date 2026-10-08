/** Unit tree of VH-MH-12 (kế hoạch GĐ B mục 5.2 "Cơ cấu, danh mục"; 04 VH-ORG-01, 04). */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Can } from '../../auth/decorators';
import { Req } from '../../common/request-context';
import type { Requester } from '../../people/changes/change.service';
import { UnitService } from './unit.service';

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

@Controller('v1/admin/org-units')
@Can('co_cau.sua')
export class UnitsController {
  constructor(private readonly units: UnitService) {}

  /** `?q=` keeps matches and their ancestors; `?status=hoat_dong|ngung`. */
  @Get()
  list(@Query() q: Record<string, unknown>, @Req() req: Requester) {
    return this.units.list({ q: str(q.q), status: str(q.status) }, req.viewer);
  }

  @Get(':code')
  get(@Param('code') code: string, @Req() req: Requester) {
    return this.units.get(code, req.viewer);
  }

  @Get(':code/history')
  history(@Param('code') code: string) {
    return this.units.history(code);
  }

  @Get(':code/head/preview')
  headPreview(@Param('code') code: string) {
    return this.units.headPreview(code);
  }

  @Post()
  create(@Body() body: unknown, @Req() req: Requester) {
    return this.units.create(body, req);
  }

  @Patch(':code')
  update(@Param('code') code: string, @Body() body: unknown, @Req() req: Requester) {
    return this.units.update(code, body, req);
  }

  @Post(':code/move')
  @HttpCode(200)
  move(@Param('code') code: string, @Body() body: unknown, @Req() req: Requester) {
    return this.units.move(code, body, req);
  }

  @Post(':code/deactivate')
  @HttpCode(200)
  deactivate(@Param('code') code: string, @Body() body: unknown, @Req() req: Requester) {
    return this.units.deactivate(code, body, req);
  }

  @Delete(':code')
  remove(@Param('code') code: string, @Query('rev') rev: string | undefined, @Req() req: Requester) {
    return this.units.remove(code, rev, req);
  }

  @Post(':code/head')
  @HttpCode(200)
  setHead(@Param('code') code: string, @Body() body: unknown, @Req() req: Requester) {
    return this.units.setHead(code, body, req);
  }
}
