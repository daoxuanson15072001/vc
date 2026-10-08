import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentPrincipal, Public } from '../../auth/auth.guard';
import type { Principal } from '../../auth/token.service';
import { FacebookPageService } from './facebook-page.service';
import { FacebookWebhookService, safeEqual, verifySignature } from './facebook-webhook.service';
import { fbConfig } from './graph';
import type { FbWebhookBody } from './webhook-mapper';

/** Dashboard endpoints of the Fanpage channel (dashboard scope) and the public OAuth callback. */
@Controller('channels/facebook-page')
export class FacebookPageController {
  constructor(private readonly service: FacebookPageService) {}

  @Get()
  status() {
    return this.service.status();
  }

  /** Facebook Login dialog URL; the Dashboard navigates to it. */
  @Get('connect')
  connect(@CurrentPrincipal() p: Principal) {
    return this.service.connectUrl(p.name);
  }

  @Get('callback')
  @Public()
  async callback(
    @Query() q: { code?: string; state?: string; error?: string },
    @Res() res: Response,
  ) {
    const outcome = await this.service.handleCallback({
      code: typeof q.code === 'string' ? q.code : undefined,
      state: typeof q.state === 'string' ? q.state : undefined,
      error: typeof q.error === 'string' ? q.error : undefined,
    });
    res.redirect(302, this.service.dashboardRedirect(outcome));
  }

  @Delete(':uid')
  disconnect(@Param('uid') uid: string, @CurrentPrincipal() p: Principal) {
    return this.service.disconnect(uid, p.name);
  }
}

/** Messenger Platform webhook (verification + event delivery). */
@Controller('webhooks/facebook')
export class FacebookWebhookController {
  private readonly logger = new Logger(FacebookWebhookController.name);

  constructor(private readonly webhook: FacebookWebhookService) {}

  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verify(@Query() q: Record<string, unknown>) {
    const expected = fbConfig().verifyToken;
    const token = q['hub.verify_token'];
    const challenge = q['hub.challenge'];
    if (
      q['hub.mode'] !== 'subscribe' ||
      !expected ||
      typeof token !== 'string' ||
      typeof challenge !== 'string' ||
      !safeEqual(token, expected)
    ) {
      throw new ForbiddenException('Verify token không khớp');
    }
    return challenge;
  }

  @Post()
  @Public()
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }, @Body() body: FbWebhookBody) {
    if (!verifySignature(req.rawBody, req.header('x-hub-signature-256'), fbConfig().appSecret)) {
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    }
    const r = await this.webhook.handle(body);
    if (r.skipped) this.logger.warn(`Webhook: ${r.skipped} event(s) for unconnected pages skipped`);
    return { ok: true };
  }
}
