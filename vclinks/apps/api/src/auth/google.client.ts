import { Injectable } from '@nestjs/common';

export interface GoogleClaims {
  email?: string;
  email_verified?: boolean;
  /** Hosted domain of a Workspace account. */
  hd?: string;
  name?: string;
  aud?: string;
}

/** Thrown when Google cannot be reached or answers with garbage (not when the user cancels). */
export class GoogleUnreachableError extends Error {}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export const googleConfig = (): GoogleConfig | null => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

/** Thin wrapper over Google's OAuth endpoints; tests replace its methods. */
@Injectable()
export class GoogleClient {
  authUrl(p: { state: string; redirectUri: string; domain: string; loginHint?: string }): string {
    const cfg = googleConfig();
    if (!cfg) throw new Error('Google SSO chưa cấu hình');
    const q = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: p.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: p.state,
      hd: p.domain,
      // Always show the account chooser, so a personal Gmail is not picked by accident.
      prompt: 'select_account',
    });
    if (p.loginHint) q.set('login_hint', p.loginHint);
    return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
  }

  /**
   * Exchanges the code for an id_token. The token comes straight from Google over
   * TLS, so its claims are trusted without checking the signature (Google's docs);
   * `aud` is still compared with our client id.
   */
  async exchange(code: string, redirectUri: string): Promise<GoogleClaims> {
    const cfg = googleConfig();
    if (!cfg) throw new Error('Google SSO chưa cấu hình');
    let body: { id_token?: string };
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(10_000),
      });
      body = (await res.json()) as { id_token?: string };
      if (!res.ok || !body.id_token) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      throw new GoogleUnreachableError((e as Error).message);
    }
    try {
      const claims = JSON.parse(Buffer.from(body.id_token.split('.')[1], 'base64url').toString('utf8')) as GoogleClaims;
      if (claims.aud !== cfg.clientId) throw new Error('aud');
      return claims;
    } catch {
      throw new GoogleUnreachableError('id_token không đọc được');
    }
  }
}
