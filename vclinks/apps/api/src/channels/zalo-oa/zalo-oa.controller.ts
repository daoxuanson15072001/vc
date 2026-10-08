import { Body, Controller, Delete, Get, HttpCode, Logger, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentPrincipal, Public } from '../../auth/auth.guard';
import type { Principal } from '../../auth/token.service';
import { zaloOaConfig } from './zalo-api';
import { verifyZaloSignature, type ZaloOaEvent } from './zalo-webhook.mapper';
import { ZaloOaService } from './zalo-oa.service';
import { ZaloOaWebhookService } from './zalo-oa.webhook.service';

const qs = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 2000) : undefined);

/** Dashboard endpoints of the Zalo OA channel (dashboard scope) and the public OAuth callback. */
@Controller('channels/zalo-oa')
export class ZaloOaController {
  constructor(private readonly service: ZaloOaService) {}

  @Get()
  status() {
    return this.service.status();
  }

  /** OA permission URL (OAuth v4 + PKCE); the Dashboard navigates to it. */
  @Get('connect')
  connect(@CurrentPrincipal() p: Principal) {
    return this.service.connectUrl(p.name);
  }

  @Get('callback')
  @Public()
  async callback(@Query() q: Record<string, unknown>, @Res() res: Response) {
    const outcome = await this.service.handleCallback({
      code: qs(q.code),
      state: qs(q.state),
      codeChallenge: qs(q.code_challenge),
      oaId: qs(q.oa_id),
    });
    res.redirect(302, this.service.dashboardRedirect(outcome));
  }

  @Delete(':uid')
  disconnect(@Param('uid') uid: string, @CurrentPrincipal() p: Principal) {
    return this.service.disconnect(uid, p.name);
  }
}

/** Zalo OA webhook: signature check on the raw body, then idempotent ingest. Answers fast (Zalo expects 200 within 2s). */
@Controller('webhooks/zalo-oa')
export class ZaloOaWebhookController {
  private readonly logger = new Logger(ZaloOaWebhookController.name);

  constructor(private readonly webhook: ZaloOaWebhookService) {}

  @Post()
  @Public()
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }, @Body() body: ZaloOaEvent) {
    const cfg = zaloOaConfig();
    const ok =
      !!body &&
      typeof body === 'object' &&
      String(body.app_id ?? '') === cfg.appId &&
      verifyZaloSignature({
        appId: cfg.appId,
        secret: cfg.webhookSecret,
        rawBody: req.rawBody,
        timestamp: body.timestamp,
        header: req.header('x-zevent-signature'),
      });
    // Unsigned or wrongly signed: drop it but still answer 200. Zalo's console "Kiểm tra" button only saves
    // the URL on a 200, and a non-200 makes Zalo retry; nothing is ingested either way.
    if (!ok) {
      this.logger.warn('Webhook event dropped: missing or invalid signature');
      return { ok: false };
    }
    try {
      await this.webhook.handle(body);
    } catch (e) {
      // Still 200: the event is authentic and a Zalo retry would hit the same error.
      this.logger.warn(`Webhook event ${String(body.event_name ?? '?')} failed: ${e instanceof Error ? e.constructor.name : 'error'}`);
    }
    return { ok: true };
  }
}
