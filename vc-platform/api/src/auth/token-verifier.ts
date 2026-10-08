/**
 * Checks VC ID access tokens (khung chung mục 7): signature by JWKS, `iss`, `aud` contains `vchome-api`, `exp`/`nbf`
 * with 60 seconds of skew, `typ: Bearer` (an id_token is not accepted). Time comes from the Clock.
 */
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { ApiError } from '../common/api-error';
import type { Clock } from '../common/clock';

export interface AccessClaims extends JWTPayload {
  sub: string;
  azp?: string;
  typ?: string;
  email?: string;
  sid?: string;
  resource_access?: Record<string, { roles?: string[] }>;
}

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export class TokenVerifier {
  private jwks?: { get: JWTVerifyGetKey; at: number };

  constructor(
    private readonly issuer: string,
    private readonly audience: string,
    private readonly clock: Clock,
  ) {}

  private async keys(): Promise<JWTVerifyGetKey> {
    if (this.jwks && Date.now() - this.jwks.at < 3_600_000) return this.jwks.get;
    let jwksUri: string;
    try {
      const res = await fetch(`${this.issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`discovery ${res.status}`);
      jwksUri = ((await res.json()) as { jwks_uri: string }).jwks_uri;
    } catch {
      throw new ApiError('idp_unreachable');
    }
    this.jwks = { get: createRemoteJWKSet(new URL(jwksUri), { cooldownDuration: 30_000, timeoutDuration: 5000 }), at: Date.now() };
    return this.jwks.get;
  }

  async verify(token: string): Promise<AccessClaims> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, await this.keys(), {
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: 60,
        currentDate: this.clock.now(),
        algorithms: ['RS256', 'PS256', 'ES256'],
      }));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e instanceof errors.JWKSTimeout || (e instanceof TypeError && /fetch/i.test(e.message))) throw new ApiError('idp_unreachable');
      throw new ApiError('unauthorized');
    }
    if (typeof payload.sub !== 'string' || (payload.typ !== undefined && payload.typ !== 'Bearer')) throw new ApiError('unauthorized');
    return payload as AccessClaims;
  }
}
