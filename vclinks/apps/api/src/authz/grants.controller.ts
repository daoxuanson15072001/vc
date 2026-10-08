import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  NO_ACCESS_TEXT,
  coverCreateSchema,
  grantApproveSchema,
  grantByIdentitySchema,
  grantListQuerySchema,
  grantRejectSchema,
  leaveRequestSchema,
  type AccessGrantList,
  type CoverOptions,
  type GrantActionResult,
} from '@vclinks/shared';
import { parseOr400 } from '../common/zod';
import { CurrentSubject } from './authz.guard';
import type { Subject } from './engine';
import { GrantsService } from './grants.service';

const need = (u: Subject | undefined): Subject => {
  if (!u) throw new ForbiddenException(NO_ACCESS_TEXT.api);
  return u;
};

/** MH-PQ-07 "Quyền tạm thời" (M1b-10). Route permissions: authz/route-permissions.ts; object checks in GrantsService. */
@Controller()
export class GrantsController {
  constructor(private readonly grants: GrantsService) {}

  @Get('access-grants')
  list(@Query() q: unknown, @CurrentSubject() u?: Subject): Promise<AccessGrantList> {
    return this.grants.list(need(u), parseOr400(grantListQuerySchema, q).tab);
  }

  @Post('access-grants/by-identity')
  @HttpCode(200)
  byIdentity(@Body() body: unknown, @CurrentSubject() u?: Subject): Promise<GrantActionResult> {
    return this.grants.requestByIdentity(need(u), parseOr400(grantByIdentitySchema, body));
  }

  @Get('access-grants/cover-options')
  coverOptions(@Query('absentUserId') absentUserId: string | undefined, @CurrentSubject() u?: Subject): Promise<CoverOptions> {
    return this.grants.coverOptions(need(u), absentUserId || undefined);
  }

  @Post('access-grants/covers')
  @HttpCode(200)
  createCover(@Body() body: unknown, @CurrentSubject() u?: Subject): Promise<GrantActionResult> {
    return this.grants.createCover(need(u), parseOr400(coverCreateSchema, body));
  }

  @Post('access-grants/:id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string, @Body() body: unknown, @CurrentSubject() u?: Subject): Promise<GrantActionResult> {
    return this.grants.approve(need(u), id, parseOr400(grantApproveSchema, body ?? {}).durationHours);
  }

  @Post('access-grants/:id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @Body() body: unknown, @CurrentSubject() u?: Subject): Promise<GrantActionResult> {
    return this.grants.reject(need(u), id, parseOr400(grantRejectSchema, body).reason);
  }

  @Post('access-grants/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @CurrentSubject() u?: Subject): Promise<GrantActionResult> {
    return this.grants.cancel(need(u), id);
  }

  @Post('access-grants/:id/revoke')
  @HttpCode(200)
  revoke(@Param('id') id: string, @CurrentSubject() u?: Subject): Promise<GrantActionResult> {
    return this.grants.revoke(need(u), id);
  }

  @Post('access-grants/:id/end')
  @HttpCode(200)
  end(@Param('id') id: string, @CurrentSubject() u?: Subject): Promise<GrantActionResult> {
    return this.grants.endCover(need(u), id);
  }

  @Post('access-grants/:id/review-request')
  @HttpCode(200)
  reviewRequest(@Param('id') id: string, @CurrentSubject() u?: Subject): Promise<GrantActionResult> {
    return this.grants.reviewRequest(need(u), id);
  }

  @Get('access-grants/leave-candidates')
  leaveCandidates(@CurrentSubject() u?: Subject) {
    return this.grants.leaveCandidates(need(u));
  }

  @Post('leave-requests')
  @HttpCode(200)
  requestLeave(@Body() body: unknown, @CurrentSubject() u?: Subject): Promise<GrantActionResult> {
    return this.grants.requestLeave(need(u), parseOr400(leaveRequestSchema, body));
  }
}
