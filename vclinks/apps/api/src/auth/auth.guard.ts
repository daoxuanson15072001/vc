import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { setRequestTenant } from '../db/tenant-context';
import { Principal, Scope, TokenService } from './token.service';

export const PUBLIC_KEY = 'vclinks:public';
export const SCOPES_KEY = 'vclinks:scopes';

/** Route needs no token. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Route accepts any of these scopes. Routes without @Scopes require `dashboard`. */
export const Scopes = (...scopes: Scope[]) => SetMetadata(SCOPES_KEY, scopes);
/** Any authenticated principal, whatever its scopes. */
export const AnyScope = () => SetMetadata(SCOPES_KEY, []);

export type AuthedRequest = Request & { principal: Principal };

export const CurrentPrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().principal,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Thiếu token');

    const principal = await this.tokens.verify(token, req.ip);
    if (!principal) throw new UnauthorizedException('Token không hợp lệ');

    const required = this.reflector.getAllAndOverride<Scope[] | undefined>(SCOPES_KEY, targets) ?? [
      'dashboard',
    ];
    if (required.length && !required.some((s) => principal.scopes.includes(s))) {
      throw new ForbiddenException(`Cần quyền: ${required.join(' | ')}`);
    }
    req.principal = principal;
    // Every query of this request now runs on the token's tenant (db/tenant-context).
    setRequestTenant(principal.tenantId);
    return true;
  }
}
