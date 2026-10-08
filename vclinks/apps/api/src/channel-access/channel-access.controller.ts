import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { channelAccessInputSchema } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { ChannelAccessService } from './channel-access.service';

const listQuery = z.object({ division: z.string().max(100).optional(), channel: z.string().max(30).optional(), search: z.string().max(100).optional() });
const patchSchema = z
  .object({ from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).nullable().optional(), note: z.string().trim().max(500).optional() })
  .strict();
const confirmSchema = z.object({ divisionId: z.string().min(1).max(100), holderUserId: z.string().max(100).optional() }).strict();
const rejectSchema = z.object({ reason: z.string().trim().min(10).max(500) }).strict();

/** MH-PQ-06 "Gán kênh" and "Nick chờ xác nhận" (channel.access, channel.confirm). */
@Controller('admin')
export class ChannelAccessController {
  constructor(private readonly svc: ChannelAccessService) {}

  @Get('channel-access')
  list(@Query() q: unknown) {
    return this.svc.list(parseOr400(listQuery, q));
  }

  @Get('channel-access/pending')
  pending() {
    return this.svc.pending();
  }

  @Post('channel-access/:uid/confirm')
  @HttpCode(200)
  confirm(@Param('uid') uid: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.svc.confirm(uid, parseOr400(confirmSchema, body), p);
  }

  @Post('channel-access/:uid/reject')
  @HttpCode(200)
  reject(@Param('uid') uid: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.svc.reject(uid, parseOr400(rejectSchema, body).reason, p);
  }

  @Post('channel-access/:uid')
  add(@Param('uid') uid: string, @Body() body: unknown, @Query('replace') replace: string | undefined, @CurrentPrincipal() p: Principal) {
    return this.svc.add(uid, parseOr400(channelAccessInputSchema, body), replace === '1', p);
  }

  @Patch('channel-access/:uid/:id')
  update(@Param('uid') uid: string, @Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.svc.update(uid, id, parseOr400(patchSchema, body), p);
  }

  @Delete('channel-access/:uid/:id')
  remove(@Param('uid') uid: string, @Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.svc.remove(uid, id, p);
  }
}
