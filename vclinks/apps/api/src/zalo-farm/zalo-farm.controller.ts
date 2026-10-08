import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { createZaloSlotSchema, zaloSlotOptionsSchema } from '@vclinks/shared';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { ZaloFarmService } from './zalo-farm.service';

/**
 * Máy Zalo: connect a company Zalo nick by scanning the QR shown on the Dashboard (Kênh › Zalo cá nhân).
 * Permissions: route-permissions.ts ("zalo"); the holder / Admin check of one slot is in the service.
 */
@Controller('zalo')
export class ZaloFarmController {
  constructor(private readonly svc: ZaloFarmService) {}

  /** Is there a máy Zalo on this server, how full, and may the caller connect nicks. */
  @Get('farm')
  status(@CurrentSubject() u?: Subject) {
    return this.svc.status(u);
  }

  @Get('slots')
  list(@CurrentSubject() u?: Subject) {
    return this.svc.list(u);
  }

  @Post('slots')
  create(@Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.svc.create(parseOr400(createZaloSlotSchema, body), u, p);
  }

  /** `?qr=1`: relay the login QR (PNG, never stored). The dialog polls this every 2 seconds. */
  @Get('slots/:id')
  view(@Param('id') id: string, @Query('qr') qr: string | undefined, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.svc.view(id, u, qr === '1', p.name);
  }

  /** Admin: per-nick options (open unread conversations to read their content). */
  @Patch('slots/:id')
  options(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.svc.setOptions(id, parseOr400(zaloSlotOptionsSchema, body), u, p);
  }

  /** Admin: Zalo Web → direct now (plan P4). */
  @Post('slots/:id/handover')
  @HttpCode(200)
  handover(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.svc.handover(id, u, p);
  }

  /** Admin: direct → Zalo Web again (while its profile is kept). */
  @Post('slots/:id/rollback')
  @HttpCode(200)
  rollback(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.svc.rollback(id, u, p);
  }

  @Post('slots/:id/sync-history')
  @HttpCode(200)
  syncHistory(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.svc.syncHistory(id, u, p.name);
  }

  @Delete('slots/:id')
  disconnect(@Param('id') id: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.svc.disconnect(id, u, p);
  }

  /** Zalo's sticker search for a direct nick; `direct: false` = the nick sends through Zalo Web (default set). */
  @Get('stickers')
  stickers(@Query('uid') uid: string | undefined, @Query('q') q: string | undefined) {
    return this.svc.stickers(String(uid ?? ''), String(q ?? ''));
  }

  /** "Quét lại QR" from the nick's red dot: the slot running this nick, with its QR. */
  @Post('rescan/:uid')
  @HttpCode(200)
  rescan(@Param('uid') uid: string, @CurrentPrincipal() p: Principal, @CurrentSubject() u?: Subject) {
    return this.svc.rescan(uid, u, p.name);
  }
}
