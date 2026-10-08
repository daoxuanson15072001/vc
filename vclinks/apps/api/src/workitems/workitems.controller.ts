import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  workitemApproveSchema,
  workitemAssignSchema,
  workitemCloseSchema,
  workitemCreateSchema,
  workitemDraftSchema,
  workitemListQuerySchema,
  workitemQueueConfigSchema,
  workitemReturnSchema,
  workitemSelfReplySchema,
  workitemWaitVendorSchema,
  type WorkitemCounts,
  type WorkitemDetail,
  type WorkitemQueueConfig,
  type WorkitemSummary,
} from '@vclinks/shared';
import { ForbiddenException } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { approverOf } from '../outbox/outbox.service';
import { WorkitemsService } from './workitems.service';

/** Signed-in people only: every action is decided on the person (route keys in route-permissions.ts). */
function who(u: Subject | undefined): Subject {
  if (!u) throw new ForbiddenException('Phiếu CSKH chỉ dùng được khi đăng nhập bằng tài khoản người dùng.');
  return u;
}

/**
 * Phiếu báo giá / hậu mãi (M1c-03). The only route that sends is `POST :id/approve` ("Duyệt & gửi"),
 * keyed on `workitem.approve` (nick holder / "Trực nick"); CSKH has no key that reaches it.
 */
@Controller('workitems')
export class WorkitemsController {
  constructor(private readonly items: WorkitemsService) {}

  @Get()
  list(@Query() q: unknown, @CurrentSubject() u?: Subject): Promise<WorkitemSummary[]> {
    return this.items.list(parseOr400(workitemListQuerySchema, q), who(u));
  }

  @Get('counts')
  counts(@CurrentSubject() u?: Subject): Promise<WorkitemCounts> {
    return this.items.counts(who(u));
  }

  @Get('queues')
  queues(@CurrentSubject() u?: Subject): Promise<WorkitemQueueConfig[]> {
    return this.items.queueConfig(who(u));
  }

  @Put('queues')
  setQueue(@Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<WorkitemQueueConfig> {
    const b = parseOr400(workitemQueueConfigSchema, body);
    return this.items.setQueue(b.divisionId, b.queue, b.members, who(u), approverOf(p));
  }

  @Post()
  create(@Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<WorkitemDetail> {
    return this.items.create(parseOr400(workitemCreateSchema, body), who(u), approverOf(p));
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentSubject() u?: Subject): Promise<WorkitemDetail> {
    return this.items.get(id, who(u));
  }

  @Get(':id/quotes')
  quotes(@Param('id') id: string, @CurrentSubject() u?: Subject) {
    return this.items.quoteOptions(id, who(u));
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<WorkitemDetail> {
    return this.items.editDraft(id, parseOr400(workitemDraftSchema, body), who(u), approverOf(p));
  }

  @Post(':id/start')
  @HttpCode(200)
  start(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.items.start(id, who(u), approverOf(p));
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.items.submit(id, who(u), approverOf(p));
  }

  @Post(':id/return')
  @HttpCode(200)
  ret(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    const b = parseOr400(workitemReturnSchema, body);
    return this.items.return(id, b.reason, b.note, who(u), approverOf(p));
  }

  @Post(':id/self-reply')
  @HttpCode(200)
  selfReply(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.items.selfReply(id, parseOr400(workitemSelfReplySchema, body ?? {}).note, who(u), approverOf(p));
  }

  /** "Duyệt & gửi": this press is the approval of the send (approvedBy / approvedAt = caller, now). */
  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    const b = parseOr400(workitemApproveSchema, body);
    return this.items.approve(id, b.message, b.quoteVersion, who(u), approverOf(p));
  }

  @Post(':id/wait-vendor')
  @HttpCode(200)
  waitVendor(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.items.waitVendor(id, parseOr400(workitemWaitVendorSchema, body).vendorDueAt, who(u), approverOf(p));
  }

  @Post(':id/vendor-back')
  @HttpCode(200)
  vendorBack(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.items.vendorBack(id, who(u), approverOf(p));
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    const b = parseOr400(workitemCloseSchema, body);
    return this.items.close(id, b.result, b.note, who(u), approverOf(p));
  }

  @Post(':id/assign')
  @HttpCode(200)
  assign(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.items.assign(id, parseOr400(workitemAssignSchema, body).assigneeId, who(u), approverOf(p));
  }
}
