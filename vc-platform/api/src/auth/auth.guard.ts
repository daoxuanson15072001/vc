/** Global guard: token → Viewer → @Can. Deny by default: a route without @Public needs a valid user token of the SPA. */
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { accessFor, type Permission } from '@vc/contracts';
import type { Request } from 'express';
import { ApiError } from '../common/api-error';
import { isAppRoute } from '../common/http';
import { ENV, type Env } from '../config/env';
import { CAN_KEY, PUBLIC_KEY } from './decorators';
import { TOKEN_VERIFIER, type TokenVerifier } from './token-verifier';
import { ViewerService, type Viewer } from './viewer';

declare global {
  namespace Express {
    interface Request {
      viewer?: Viewer;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly viewers: ViewerService,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier | null,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    // API for apps takes machine tokens only; it comes with B-20 behind FEATURE_PUBLIC_API.
    if (isAppRoute(req.path)) throw new ApiError('feature_off');

    const m = /^Bearer\s+(\S+)$/i.exec(req.header('authorization') ?? '');
    if (!m || !this.verifier) throw new ApiError('unauthorized');
    const claims = await this.verifier.verify(m[1]);
    // Internal API: only user tokens the SPA received (kế hoạch GĐ B mục 5.1); machine tokens get 403.
    if (claims.azp !== this.env.OIDC_SPA_CLIENT_ID) throw new ApiError('forbidden');
    req.viewer = await this.viewers.fromClaims(claims);

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(CAN_KEY, targets);
    if (permission && !accessFor(permission, req.viewer.roles)) throw new ApiError('forbidden');
    return true;
  }
}
