/**
 * OIDC client side of the VC ID integration contract (thiết kế SSO mục 5.2). Kept framework-free so app teams
 * can copy it: VClinks ports it to NestJS (`oidc.client.ts`), VCwiki to Python (`oidc.py`).
 */
import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export const COMPANY_DOMAINS = ['vcprosperous.com', 'vcpart.vn'];
const BACKCHANNEL_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

/** Error codes shared by every app (thiết kế SSO mục 5.2); each app maps them to its own Vietnamese sentence. */
export type LoginErrorCode =
  | 'outside_domain'
  | 'app_not_granted'
  | 'not_granted'
  | 'locked'
  | 'identity_conflict'
  | 'state_invalid'
  | 'idp_unreachable'
  | 'cancelled';

export class LoginError extends Error {
  constructor(
    readonly code: LoginErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  idpHint?: string;
  /** Group the user must have in the `groups` claim, e.g. `app-vclinks`. Empty = do not check. */
  requiredGroup?: string;
  domains?: string[];
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint: string;
  jwks_uri: string;
}

export interface IdTokenClaims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  hd?: string;
  groups?: string[];
  sid?: string;
  nonce?: string;
  vc_trang_thai?: string;
}

export const b64url = (b: Buffer) => b.toString('base64url');
export const randomToken = (n = 32) => b64url(randomBytes(n));
export const pkceChallenge = (verifier: string) => b64url(createHash('sha256').update(verifier).digest());

export class OidcClient {
  private disc?: { value: Discovery; at: number };
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(readonly cfg: OidcConfig) {}

  /** Discovery cached 1 hour (point 1). */
  async discover(): Promise<Discovery> {
    if (this.disc && Date.now() - this.disc.at < 3_600_000) return this.disc.value;
    let res: Response;
    try {
      res = await fetch(`${this.cfg.issuer}/.well-known/openid-configuration`);
    } catch (e) {
      throw new LoginError('idp_unreachable', (e as Error).message);
    }
    if (!res.ok) throw new LoginError('idp_unreachable', `discovery ${res.status}`);
    const value = (await res.json()) as Discovery;
    this.disc = { value, at: Date.now() };
    // JWKS: cached by jose, reloaded on an unknown `kid`.
    this.jwks = createRemoteJWKSet(new URL(value.jwks_uri), { cooldownDuration: 30_000 });
    return value;
  }

  async authUrl(p: { state: string; nonce: string; verifier: string; loginHint?: string }): Promise<string> {
    const d = await this.discover();
    const q = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state: p.state,
      nonce: p.nonce,
      code_challenge: pkceChallenge(p.verifier),
      code_challenge_method: 'S256',
    });
    if (this.cfg.idpHint) q.set('kc_idp_hint', this.cfg.idpHint);
    if (p.loginHint) q.set('login_hint', p.loginHint);
    return `${d.authorization_endpoint}?${q}`;
  }

  /** Exchanges the code on the server (confidential client + PKCE) and checks the id_token (points 1–5). */
  async exchange(code: string, verifier: string, nonce: string): Promise<IdTokenClaims> {
    const d = await this.discover();
    let res: Response;
    try {
      res = await fetch(d.token_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.cfg.redirectUri,
          code_verifier: verifier,
          client_id: this.cfg.clientId,
          client_secret: this.cfg.clientSecret,
        }),
      });
    } catch (e) {
      throw new LoginError('idp_unreachable', (e as Error).message);
    }
    if (!res.ok) throw new LoginError('state_invalid', `token ${res.status}`);
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new LoginError('state_invalid', 'no id_token');
    // Access and refresh tokens are dropped on purpose: the app keeps only its own session (thiết kế SSO 5.7).
    return this.verifyIdToken(body.id_token, nonce);
  }

  /** The 6 checks of point 2, then domain (point 3) and app group (point 5). */
  async verifyIdToken(token: string, nonce: string): Promise<IdTokenClaims> {
    const d = await this.discover();
    const { payload } = await jwtVerify(token, this.jwks!, {
      issuer: d.issuer,
      audience: this.cfg.clientId,
      clockTolerance: 60,
    }).catch((e: Error) => {
      throw new LoginError('state_invalid', `id_token: ${e.message}`);
    });
    const c = payload as IdTokenClaims;
    if (c.nonce !== nonce) throw new LoginError('state_invalid', 'nonce');
    if (c.email_verified !== true) throw new LoginError('outside_domain', 'email not verified');
    const domains = this.cfg.domains ?? COMPANY_DOMAINS;
    const emailDomain = c.email?.split('@')[1]?.toLowerCase();
    if (!emailDomain || !domains.includes(emailDomain)) throw new LoginError('outside_domain', c.email);
    if (c.hd && !domains.includes(c.hd)) throw new LoginError('outside_domain', `hd=${c.hd}`);
    if (this.cfg.requiredGroup && !(c.groups ?? []).includes(this.cfg.requiredGroup)) {
      throw new LoginError('app_not_granted', this.cfg.requiredGroup);
    }
    return c;
  }

  /** Point 7: validates a back-channel `logout_token`. */
  async verifyLogoutToken(token: string): Promise<{ sid?: string; sub?: string; jti: string }> {
    const d = await this.discover();
    const { payload } = await jwtVerify(token, this.jwks!, { issuer: d.issuer, audience: this.cfg.clientId, clockTolerance: 60 });
    const events = payload.events as Record<string, unknown> | undefined;
    if (!events || !(BACKCHANNEL_EVENT in events)) throw new Error('events');
    if ('nonce' in payload) throw new Error('nonce');
    if (!payload.jti || (!payload.sid && !payload.sub)) throw new Error('claims');
    if (!payload.iat || Date.now() / 1000 - payload.iat > 300) throw new Error('iat');
    return { sid: payload.sid as string | undefined, sub: payload.sub, jti: payload.jti };
  }

  /** Point 8: where to send the browser after the app has revoked its own session. */
  async logoutUrl(postLogoutRedirect: string): Promise<string> {
    const d = await this.discover();
    const q = new URLSearchParams({ client_id: this.cfg.clientId, post_logout_redirect_uri: postLogoutRedirect });
    return `${d.end_session_endpoint}?${q}`;
  }
}
