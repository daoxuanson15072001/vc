import { Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { MySession } from '@vclinks/shared';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentPrincipal, Public } from './auth.guard';
import type { Principal } from './token.service';
import { googleConfig } from './google.client';
import { SESSION_PREFIX, SessionService, deviceOf } from './session.service';

/** Public origin of the API, used for the Google redirect URI (must match the OAuth client). */
const apiBase = () =>
  (process.env.AUTH_BASE_URL || process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT ?? 3000}`).replace(/\/+$/, '');
/** Origin of the web app the browser returns to (same origin as the API in production). */
const webBase = () => (process.env.AUTH_WEB_URL || apiBase()).replace(/\/+$/, '');
const redirectUri = () => `${apiBase()}/api/auth/google/callback`;
const bearer = (req: Request) => {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  /** What the login page may offer. */
  @Get('config')
  @Public()
  config() {
    const t = (process.env.AUTH_TOKEN_LOGIN ?? '').trim().toLowerCase();
    return { ssoEnabled: googleConfig() !== null, tokenLogin: t !== '0' && t !== 'false' };
  }

  @Get('google')
  @Public()
  async google(@Query('next') next: string | undefined, @Query('login_hint') hint: string | undefined, @Res() res: Response) {
    if (!googleConfig()) return res.redirect(302, `${webBase()}/login?error=google_unreachable`);
    return res.redirect(302, await this.auth.startLogin(redirectUri(), next, hint?.slice(0, 200)));
  }

  @Get('google/callback')
  @Public()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const r = await this.auth.handleCallback({ code, state, error }, redirectUri(), deviceOf(req.headers['user-agent']));
    res.setHeader('Cache-Control', 'no-store');
    if (!r.ok) {
      const q = new URLSearchParams({ error: r.error, ...(r.email ? { email: r.email } : {}) });
      return res.redirect(302, `${webBase()}/login?${q.toString()}`);
    }
    // The token travels in the URL fragment: it never reaches server logs or Referer headers.
    const frag = new URLSearchParams({ session: r.token, next: r.next });
    return res.redirect(302, `${webBase()}/login#${frag.toString()}`);
  }

  /** "Phiên đăng nhập" of Hồ sơ của tôi: live dashboard sign-ins of the current user. */
  @Get('sessions')
  async sessions_(@Req() req: Request, @CurrentPrincipal() p: Principal): Promise<MySession[]> {
    return p.userId ? this.sessions.listMine(p.userId, bearer(req)) : [];
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  async revokeOthers(@Req() req: Request, @CurrentPrincipal() p: Principal): Promise<{ revoked: number }> {
    return { revoked: p.userId ? await this.sessions.revokeOthers(p.userId, bearer(req)) : 0 };
  }

  @Post('sessions/:id/revoke')
  @HttpCode(200)
  async revokeOne(@Param('id') id: string, @CurrentPrincipal() p: Principal): Promise<{ ok: true }> {
    if (!p.userId || !(await this.sessions.revokeMine(p.userId, id))) throw new NotFoundException('Không thấy phiên đăng nhập này.');
    return { ok: true };
  }

  /** Ends the current dashboard session. Device and MCP tokens are untouched. */
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request) {
    const h = req.headers.authorization ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (token.startsWith(SESSION_PREFIX)) await this.sessions.revoke(token);
    return { ok: true };
  }
}
