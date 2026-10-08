/** Fake OIDC issuer for tests: discovery + JWKS over HTTP, tokens signed with jose (khung chung mục 9). */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from 'jose';

export interface FakeIssuer {
  url: string;
  token(claims?: Record<string, unknown>, opts?: { key?: 'other'; exp?: number; iat?: number }): Promise<string>;
  close(): Promise<void>;
}

export async function startIssuer(): Promise<FakeIssuer> {
  const main = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(main.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  let url = '';
  const server: Server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/realms/vc/.well-known/openid-configuration') res.end(JSON.stringify({ issuer: url, jwks_uri: `${url}/protocol/openid-connect/certs` }));
    else if (req.url === '/realms/vc/protocol/openid-connect/certs') res.end(JSON.stringify({ keys: [jwk] }));
    else res.writeHead(404).end('{}');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/realms/vc`;

  return {
    url,
    async token(claims = {}, opts = {}) {
      const key: KeyLike = opts.key === 'other' ? other.privateKey : main.privateKey;
      const jwt = new SignJWT({ typ: 'Bearer', azp: 'vchome', sub: 'sub-mac-dinh', ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer((claims.iss as string) ?? url)
        .setAudience((claims.aud as string | string[]) ?? ['vchome-api', 'account']);
      if (opts.iat !== undefined) jwt.setIssuedAt(opts.iat);
      else jwt.setIssuedAt();
      return jwt.setExpirationTime(opts.exp ?? '5m').sign(key);
    },
    close: () => new Promise((r) => server.close(() => r())),
  };
}

/** Claims of an SPA user holding these VC Home client roles. */
export function userClaims(sub: string, roles: string[] = []): Record<string, unknown> {
  return { sub, email: `${sub}@vcprosperous.com`, resource_access: { vchome: { roles } } };
}
