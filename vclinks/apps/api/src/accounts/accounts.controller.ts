import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { registerAccountSchema, sendPaceSchema, sessionReportSchema, uidSchema } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentPrincipal, Scopes } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { AccountsService } from './accounts.service';

const patchSchema = z
  .object({
    label: z.string().min(1).max(200).optional(),
    ownerName: z.string().max(200).optional(),
    /** Per-nick send pace (M1a-06, SZ-04); bounds in SEND_PACE_BOUNDS. */
    sendPace: sendPaceSchema.optional(),
  })
  .strict();

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  @Scopes('ingest', 'mcp')
  register(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const input = parseOr400(registerAccountSchema, body);
    // A bound device registering a nick it was not paired with: kept aside until an Admin confirms (PQ-52 d).
    if (p.tokenKind === 'device' && p.uids?.length && !p.uids.includes(input.uid)) return this.accounts.registerPending(input, p);
    return this.accounts.register(input, p.name, false);
  }

  @Get()
  list() {
    return this.accounts.status();
  }

  /** Health of every account for the nav dots and popover (03 MH-SZ-12a). */
  @Get('health')
  healthAll() {
    return this.accounts.health();
  }

  @Get(':uid/health')
  async health(@Param('uid') uid: string) {
    return (await this.accounts.health(parseOr400(uidSchema, uid)))[0];
  }

  /** "Báo Admin": one notice per 30 minutes per nick. */
  @Post(':uid/notify-admin')
  @HttpCode(200)
  async notifyAdmin(@Param('uid') uid: string, @CurrentPrincipal() p: Principal) {
    return { sent: await this.accounts.notifyAdmin(parseOr400(uidSchema, uid), p.name) };
  }

  /** Driver watchdog: session health of one account (heartbeat + lost/restored). */
  @Post(':uid/session')
  @HttpCode(200)
  @Scopes('ingest')
  reportSession(@Param('uid') uid: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.accounts.reportSession(parseOr400(uidSchema, uid), parseOr400(sessionReportSchema, body), p.name);
  }

  @Patch(':uid')
  async update(@Param('uid') uid: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    await this.accounts.update(uid, parseOr400(patchSchema, body), p.name);
    return { ok: true };
  }
}
