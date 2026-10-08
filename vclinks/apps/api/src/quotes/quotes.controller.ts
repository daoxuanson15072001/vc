import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { quoteSendSchema, type QuoteListResponse, type QuoteSendResult } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { CurrentSubject } from '../authz/authz.guard';
import { AuthzService } from '../authz/authz.service';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { OutboxDispatcher } from '../outbox/outbox.dispatcher';
import { approverOf } from '../outbox/outbox.service';
import { QuotesService } from './quotes.service';

const id = z.string().trim().min(1).max(160);

/** Gửi báo giá (M1c-02). Permissions: apps/api/src/authz/route-permissions.ts, group "Quotes". */
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly authz: AuthzService,
    private readonly dispatcher: OutboxDispatcher,
  ) {}

  /** Quotes of the customer of one chat, read live from VCsales. */
  @Get('by-identity/:uid/:userId')
  list(@Param('uid') uid: string, @Param('userId') userId: string, @CurrentSubject() u?: Subject): Promise<QuoteListResponse> {
    return this.quotes.list(parseOr400(id, uid), parseOr400(id, userId), u);
  }

  /** The click on "Gửi báo giá" is the approval (§12.1): approvedBy / approvedAt are the caller's, now. */
  @Post('send')
  @HttpCode(200)
  async send(@Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject): Promise<QuoteSendResult> {
    const input = parseOr400(quoteSendSchema, body);
    let onBehalf: Parameters<QuotesService['send']>[3];
    if (u) {
      const mode = await this.authz.sendModeOf(u, input.uid);
      if (mode.source) {
        const names = await this.authz.userNames([mode.holderId]);
        onBehalf = { source: mode.source, holderId: mode.holderId, holderName: mode.holderId ? (names.get(mode.holderId) ?? null) : null };
      }
    }
    const { result, item } = await this.quotes.send(input, approverOf(p), u, onBehalf);
    this.dispatcher.kick(item);
    return result;
  }
}
