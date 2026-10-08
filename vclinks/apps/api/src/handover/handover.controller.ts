import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post } from '@nestjs/common';
import { handoverInputSchema, handoverPreviewSchema } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { HandoverService, type HandoverActor } from './handover.service';

const confirmSchema = z.object({ note: z.string().trim().max(200).optional() }).strict();
const actorOf = (p: Principal): HandoverActor => ({ userId: p.userId ?? null, name: p.userId ?? `token:${p.name}` });

/**
 * MH-PQ-04 steps 2-4 and the "Chưa an toàn" confirmation. Step 1 is `POST /admin/users/:id/offboard`.
 * Permissions are in `authz/route-permissions.ts` (user.handover on the person, channel.safety_confirm on the nick).
 */
@Controller('admin')
export class HandoverController {
  constructor(private readonly svc: HandoverService) {}

  @Get('users/:id/offboard-preview')
  preview(@Param('id') id: string) {
    return this.svc.preview(id);
  }

  @Get('users/:id/handover/customers')
  customers(@Param('id') id: string) {
    return this.svc.customerList(id);
  }

  @Get('users/:id/handover/receivers')
  receivers(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() s?: Subject) {
    return this.svc.receivers(id, actorOf(p), s ?? null);
  }

  @Get('users/:id/handovers')
  records(@Param('id') id: string) {
    return this.svc.recordsOf(id);
  }

  @Post('users/:id/handover/preview')
  @HttpCode(200)
  previewPlan(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() s?: Subject) {
    return this.svc.previewPlan(id, parseOr400(handoverPreviewSchema, body), actorOf(p), s ?? null);
  }

  @Post('users/:id/handover')
  @HttpCode(200)
  complete(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() s?: Subject) {
    return this.svc.complete(id, parseOr400(handoverInputSchema, body), actorOf(p), s ?? null);
  }

  @Post('channel-access/:uid/safety-confirm')
  @HttpCode(200)
  confirm(@Param('uid') uid: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    if (!p.userId && process.env.AUTHZ_LEGACY_TOKENS !== '1') throw new ForbiddenException('Cần đăng nhập bằng tài khoản người dùng.');
    return this.svc.confirmSafe(uid, parseOr400(confirmSchema, body ?? {}).note, actorOf(p));
  }
}
