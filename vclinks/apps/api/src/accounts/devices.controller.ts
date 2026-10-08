import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { approvePairingSchema } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentPrincipal, Public, Scopes } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { parseOr400 } from '../common/zod';
import { DevicesService } from './devices.service';

const requestSchema = z.object({ deviceName: z.string().trim().min(1).max(80) }).strict();
const pollSchema = z.object({ pollKey: z.string().min(10).max(100) });
const commitSchema = z.object({ token: z.string().min(10).max(200) }).strict();

/** Device pairing by 6-digit code and token rotation (01 PQ-52). */
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  /** Extension without a token asks for a code to show. */
  @Post('pairings')
  @Public()
  @HttpCode(201)
  request(@Body() body: unknown) {
    return this.devices.request(parseOr400(requestSchema, body).deviceName);
  }

  /** Extension polls with the secret it got above; the token is handed over once. */
  @Get('pairings/:id')
  @Public()
  poll(@Param('id') id: string, @Query() q: unknown) {
    return this.devices.poll(id, parseOr400(pollSchema, q).pollKey);
  }

  /** Admin types the code shown on the extension. */
  @Post('pairings/approve')
  @HttpCode(200)
  approve(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.devices.approve(parseOr400(approvePairingSchema, body), p);
  }

  @Post('token/rotate')
  @HttpCode(200)
  @Scopes('ingest')
  rotate(@CurrentPrincipal() p: Principal) {
    return this.devices.rotate(p);
  }

  @Post('token/commit')
  @HttpCode(200)
  @Scopes('ingest')
  commit(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.devices.commitRotation(parseOr400(commitSchema, body).token, p);
  }
}
