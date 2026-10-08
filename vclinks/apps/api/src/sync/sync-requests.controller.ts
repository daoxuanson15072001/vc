import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { syncRequestClaimSchema, syncRequestCreateSchema, uidSchema } from '@vclinks/shared';
import { CurrentPrincipal, Scopes } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { SyncRequestsService } from './sync-requests.service';

/** "Đồng bộ ngay" (M1a-06): Dashboard asks, the extension claims with its heartbeat. */
@Controller('sync/requests')
export class SyncRequestsController {
  constructor(private readonly requests: SyncRequestsService) {}

  /** Extension side (scope ingest). Declared before `:uid` routes. */
  @Post('claim')
  @HttpCode(200)
  @Scopes('ingest')
  claim(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.requests.claim(parseOr400(syncRequestClaimSchema, body).uid, p.name);
  }

  @Post()
  @HttpCode(200)
  request(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.requests.request(parseOr400(syncRequestCreateSchema, body), p.name);
  }

  @Get(':uid')
  get(@Param('uid') uid: string) {
    return this.requests.get(parseOr400(uidSchema, uid));
  }
}
