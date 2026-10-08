import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { REVOKE_REASONS, TOKEN_TEXT, createOwnTokenSchema, createSystemTokenSchema, revokeTokenSchema, tokenSettingsSchema } from '@vclinks/shared';
import { z } from 'zod';
import { CurrentPrincipal } from '../auth/auth.guard';
import type { Principal } from '../auth/token.service';
import { CurrentSubject } from '../authz/authz.guard';
import type { Subject } from '../authz/engine';
import { parseOr400 } from '../common/zod';
import { TokensService } from './tokens.service';

const listQuery = z.object({ kind: z.string().max(20).optional(), status: z.enum(['active', 'revoked']).optional(), search: z.string().max(100).optional() });
const revokeAllSchema = z.object({ reason: z.enum(REVOKE_REASONS) }).strict();

/** Admin: MH-PQ-08 (token.manage). The token string is returned once, by the create call only. */
@Controller('admin')
export class TokensAdminController {
  constructor(private readonly tokens: TokensService) {}

  @Get('tokens')
  list(@Query() q: unknown) {
    return this.tokens.listAll(parseOr400(listQuery, q));
  }

  @Post('tokens')
  create(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    // PQ-43 / UAT-PQ-66: no personal MCP token for somebody else, whatever the body asks for.
    const b = (body ?? {}) as Record<string, unknown>;
    if (b.kind === 'mcp' || b.kind === 'mcp_user' || 'userId' in b) throw new ForbiddenException(TOKEN_TEXT.noAdminMcp);
    return this.tokens.createSystem(parseOr400(createSystemTokenSchema, body), p);
  }

  @Get('tokens/:id/impact')
  impact(@Param('id') id: string) {
    return this.tokens.impact(id);
  }

  @Post('tokens/:id/revoke')
  @HttpCode(200)
  revoke(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.tokens.revoke(id, parseOr400(revokeTokenSchema, body).reason, p, false);
  }

  @Post('users/:id/revoke-tokens')
  @HttpCode(200)
  revokeAll(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.tokens.revokeAllOf(id, parseOr400(revokeAllSchema, body).reason, p);
  }

  @Get('token-settings')
  settings() {
    return this.tokens.settings();
  }

  @Put('token-settings')
  saveSettings(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    return this.tokens.saveSettings(parseOr400(tokenSettingsSchema, body), p.name);
  }
}

const needUser = (p: Principal, u: Subject | undefined): Subject => {
  if (!p.userId || !u) throw new ForbiddenException('Đăng nhập bằng tài khoản Google công ty để quản lý token của bạn.');
  return u;
};

/** "Token MCP của tôi": MH-PQ-09 (token.own). Always the caller's own tokens. */
@Controller('settings/tokens')
export class OwnTokensController {
  constructor(private readonly tokens: TokensService) {}

  @Get()
  list(@CurrentPrincipal() p: Principal, @CurrentSubject() u: Subject) {
    return this.tokens.listOwn(p.userId!, needUser(p, u));
  }

  @Post()
  create(@Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u: Subject) {
    // The request has no user field at all: a token is made for the signed-in person only.
    return this.tokens.createOwn(parseOr400(createOwnTokenSchema, body), p, needUser(p, u));
  }

  @Post(':id/revoke')
  @HttpCode(200)
  revoke(@Param('id') id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @CurrentSubject() u: Subject) {
    needUser(p, u);
    return this.tokens.revoke(id, parseOr400(revokeTokenSchema, body).reason, p, true);
  }
}
