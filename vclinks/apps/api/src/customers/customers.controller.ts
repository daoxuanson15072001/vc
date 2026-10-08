import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  type ErpSearchRow,
  customerImportSchema,
  customerRevealSchema,
  timelineQuerySchema,
  type Customer360,
  type CustomerRevealResult,
  type TimelineResponse,
  customerListQuerySchema,
  erpLinkConfirmSchema,
  type CustomerDetail,
  type CustomerImportResult,
  type CustomerListResponse,
  type CustomerSweepResult,
  type ErpMatchingResponse,
  type MergeOperationView,
  type MergeSuggestionView,
} from '@vclinks/shared';
import { z } from 'zod';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { Customer360Service } from './customer-360.service';
import { CustomersService } from './customers.service';

const id = z.string().trim().min(1).max(160);
const rejectBody = z.object({ reason: z.string().trim().min(1).max(500).default('Hai người khác nhau') }).strict();
const actorOf = (p: Principal) => (p.userId ? `user:${p.userId}` : p.name);

/** Customer model (M1b-12). Permissions: apps/api/src/authz/route-permissions.ts, group "Customers". */
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly c360: Customer360Service,
  ) {}

  @Get()
  list(@Query() query: unknown, @CurrentSubject() u?: Subject): Promise<CustomerListResponse> {
    return this.customers.list(parseOr400(customerListQuerySchema, query), u);
  }

  /** Load the VCsales catalogue (mock until E5): accounts, ERP codes, first owners (D8-06). Re-runnable. */
  @Post('import')
  @HttpCode(200)
  import(@Body() body: unknown, @CurrentPrincipal() p: Principal): Promise<CustomerImportResult> {
    return this.customers.importCatalog(parseOr400(customerImportSchema, body ?? {}), actorOf(p));
  }

  /** Profiles for identities without one + merge rules (also runs in the background). */
  @Post('sweep')
  @HttpCode(200)
  sweep(): Promise<CustomerSweepResult> {
    return this.customers.sweep();
  }

  @Get('erp-matching')
  erpMatching(@CurrentSubject() u?: Subject): Promise<ErpMatchingResponse> {
    return this.customers.erpMatching(u);
  }

  /** "Liên kết mã KH": VCsales customers by code, name, phone or tax code (at least 3 characters). */
  @Get('erp-search')
  erpSearch(@Query('q') q: string | undefined): Promise<ErpSearchRow[]> {
    return this.customers.erpSearch(q ?? '');
  }

  @Get('merge-suggestions')
  suggestions(@CurrentSubject() u?: Subject): Promise<MergeSuggestionView[]> {
    return this.customers.listSuggestions(u);
  }

  @Post('merge-suggestions/:id/merge')
  @HttpCode(200)
  approve(@Param('id') sid: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<{ operationId: string }> {
    return this.customers.approveSuggestion(parseOr400(id, sid), u, actorOf(p));
  }

  @Post('merge-suggestions/:id/reject')
  @HttpCode(204)
  reject(@Param('id') sid: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<void> {
    return this.customers.rejectSuggestion(parseOr400(id, sid), u, actorOf(p), parseOr400(rejectBody, body ?? {}).reason);
  }

  /** One-touch undo of a merge ("Không phải người này", DK-11). */
  @Post('merge-operations/:id/undo')
  @HttpCode(200)
  undo(@Param('id') oid: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<MergeOperationView> {
    return this.customers.undo(parseOr400(id, oid), actorOf(p), u);
  }

  @Get('by-identity/:uid/:userId')
  byIdentity(@Param('uid') uid: string, @Param('userId') userId: string, @CurrentSubject() u?: Subject): Promise<CustomerDetail> {
    return this.customers.byIdentity(parseOr400(id, uid), parseOr400(id, userId), u);
  }

  /** Chat side panel (MH-DK-02 / MH-UI-09): the customer of one channel identity. `refresh=1` is the ↻ of the commerce block. */
  @Get('by-identity/:uid/:userId/360')
  panel(@Param('uid') uid: string, @Param('userId') userId: string, @Query('refresh') refresh: string | undefined, @CurrentSubject() u?: Subject): Promise<Customer360> {
    return this.c360.byIdentity(parseOr400(id, uid), parseOr400(id, userId), u, { refresh: refresh === '1' });
  }

  /** Customer 360 page (MH-DK-01). */
  @Get(':id/360')
  page(@Param('id') aid: string, @Query('refresh') refresh: string | undefined, @CurrentSubject() u?: Subject): Promise<Customer360> {
    return this.c360.byAccount(parseOr400(id, aid), u, { refresh: refresh === '1' });
  }

  /** Merged timeline (MH-DK-03). */
  @Get(':id/timeline')
  timeline(@Param('id') aid: string, @Query() query: unknown, @CurrentSubject() u?: Subject): Promise<TimelineResponse> {
    return this.c360.timelineOf(parseOr400(id, aid), parseOr400(timelineQuerySchema, query), u);
  }

  /** "Hiện" / "Sao chép" a phone or email (DK-44): logged without the value. */
  @Post(':id/reveal')
  @HttpCode(200)
  reveal(@Param('id') aid: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<CustomerRevealResult> {
    return this.c360.reveal(parseOr400(id, aid), parseOr400(customerRevealSchema, body), u, actorOf(p));
  }

  @Get(':id')
  detail(@Param('id') aid: string, @CurrentSubject() u?: Subject): Promise<CustomerDetail> {
    return this.customers.detail(parseOr400(id, aid), u);
  }

  @Get(':id/operations')
  operations(@Param('id') aid: string, @CurrentSubject() u?: Subject): Promise<MergeOperationView[]> {
    return this.customers.operationsOf(parseOr400(id, aid), u);
  }

  /** "Xác nhận" of MH-DK-10 (sale admin). */
  @Post(':id/erp-links')
  @HttpCode(200)
  confirmErp(@Param('id') aid: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<CustomerDetail> {
    return this.customers.confirmErpLink(parseOr400(id, aid), parseOr400(erpLinkConfirmSchema, body), u, actorOf(p));
  }
}
