import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { uidSchema, type AutoSyncPlanItem } from '@vclinks/shared';
import { z } from 'zod';
import { Scopes } from '../auth/auth.guard';
import { parseOr400 } from '../common/zod';
import { AutoSyncService } from './autosync.service';

const planQuery = z.object({ uid: uidSchema, limit: z.coerce.number().int().min(1).max(200).optional() });

/** Extension side of the automatic content sync (scope ingest). */
@Controller('autosync')
export class AutoSyncController {
  constructor(private readonly autosync: AutoSyncService) {}

  @Get('plan')
  @Scopes('ingest')
  plan(@Query() q: unknown): Promise<AutoSyncPlanItem[]> {
    const { uid, limit } = parseOr400(planQuery, q);
    return this.autosync.plan(uid, limit);
  }

  @Post('result')
  @HttpCode(200)
  @Scopes('ingest')
  result(@Body() body: unknown) {
    return this.autosync.result(body);
  }
}
