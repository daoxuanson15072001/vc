import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { driftReportSchema } from '@vclinks/shared';
import { z } from 'zod';
import { AnyScope, CurrentPrincipal, Scopes } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { MappingService } from './mapping.service';

@Controller('mapping')
export class MappingController {
  constructor(private readonly mapping: MappingService) {}

  @Get('active')
  @AnyScope()
  active() {
    return this.mapping.active();
  }

  @Get()
  list() {
    return this.mapping.list();
  }

  @Post('drift')
  @HttpCode(200)
  @Scopes('ingest')
  drift(@Body() body: unknown) {
    return this.mapping.reportDrift(parseOr400(driftReportSchema, body));
  }

  @Get('drifts')
  drifts(@Query('status') status?: string) {
    return this.mapping.listDrifts(parseOr400(z.enum(['open', 'resolved']).optional(), status));
  }

  @Post('drifts/:id/resolve')
  @HttpCode(200)
  async resolve(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    await this.mapping.resolveDrift(id, p.name);
    return { ok: true };
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.mapping.approve(id, p.name);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.mapping.reject(id, p.name);
  }
}
