import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  erpSyncStartSchema,
  erpTaskCloseSchema,
  erpTaskCreateSchema,
  erpTaskFormSchema,
  erpTaskLinkSchema,
  erpTaskListQuerySchema,
  erpTaskReturnSchema,
  type ErpSyncStatus,
  type ErpTaskListResponse,
  type ErpTaskView,
} from '@vclinks/shared';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { ErpSyncService } from './erp-sync.service';
import { ErpTasksService } from './erp-tasks.service';

const actorOf = (p: Principal) => (p.userId ? `user:${p.userId}` : p.name);

/**
 * Việc VCsales (02 MH-DK-12) and the VCsales catalogue sync (plan C11). Registered before CustomersController so that
 * `/customers/erp-tasks` and `/customers/erp-sync` never fall into `/customers/:id`. Rights: route-permissions.ts.
 */
@Controller('customers')
export class ErpTasksController {
  constructor(
    private readonly tasks: ErpTasksService,
    private readonly sync: ErpSyncService,
  ) {}

  @Get('erp-tasks')
  list(@Query() query: unknown, @CurrentSubject() u?: Subject): Promise<ErpTaskListResponse> {
    return this.tasks.list(parseOr400(erpTaskListQuerySchema, query), u);
  }

  @Get('erp-tasks/:id')
  get(@Param('id') id: string, @CurrentSubject() u?: Subject): Promise<ErpTaskView> {
    return this.tasks.get(id, u);
  }

  @Post('erp-tasks')
  create(@Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<ErpTaskView> {
    return this.tasks.create(parseOr400(erpTaskCreateSchema, body), u, actorOf(p));
  }

  @Post('erp-tasks/:id/claim')
  @HttpCode(200)
  claim(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<ErpTaskView> {
    return this.tasks.claim(id, u, actorOf(p));
  }

  @Post('erp-tasks/:id/check')
  @HttpCode(200)
  check(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<ErpTaskView> {
    return this.tasks.checkDuplicates(id, u, actorOf(p));
  }

  @Post('erp-tasks/:id/link')
  @HttpCode(200)
  link(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.tasks.link(id, parseOr400(erpTaskLinkSchema, body).code, u, actorOf(p));
  }

  @Post('erp-tasks/:id/return')
  @HttpCode(200)
  giveBack(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    const b = parseOr400(erpTaskReturnSchema, body);
    return this.tasks.returnToSale(id, b.missing, b.note, u, actorOf(p));
  }

  @Put('erp-tasks/:id/form')
  form(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<ErpTaskView> {
    return this.tasks.updateForm(id, parseOr400(erpTaskFormSchema, body).form, u, actorOf(p));
  }

  @Post('erp-tasks/:id/done')
  @HttpCode(200)
  done(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.tasks.markDone(id, u, actorOf(p));
  }

  @Post('erp-tasks/:id/close')
  @HttpCode(200)
  close(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    const b = parseOr400(erpTaskCloseSchema, body);
    return this.tasks.close(id, b.reason, b.note, u, actorOf(p));
  }

  /** "Danh mục VCsales": first import, last sync, the run going on and the last ten runs. */
  @Get('erp-sync')
  syncStatus(@CurrentSubject() u?: Subject): Promise<ErpSyncStatus> {
    return this.sync.status(u);
  }

  /** "Xem trước" / "Nạp toàn bộ" / "Đồng bộ ngay": answers at once, the run goes on in the background. */
  @Post('erp-sync')
  @HttpCode(202)
  syncStart(@Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<ErpSyncStatus> {
    return this.sync.start(parseOr400(erpSyncStartSchema, body), u, actorOf(p));
  }
}
