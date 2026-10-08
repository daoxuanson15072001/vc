import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { LoginError, OidcClient } from '../src/oidc.js';

// Issuer giả: phục vụ discovery và JWKS, ký token bằng khoá sinh lúc chạy test.
let issuer = '';
let privateKey: CryptoKey;
const server = createServer(async (req, res) => {
  if (req.url?.endsWith('/.well-known/openid-configuration')) {
    res.end(JSON.stringify({ issuer, authorization_endpoint: `${issuer}/auth`, token_endpoint: `${issuer}/token`, end_session_endpoint: `${issuer}/logout`, jwks_uri: `${issuer}/certs` }));
  } else if (req.url?.endsWith('/certs')) {
    res.end(JSON.stringify({ keys: [jwks] }));
  } else res.writeHead(404).end();
});
let jwks: Record<string, unknown>;

before(async () => {
  const kp = await generateKeyPair('RS256');
  privateKey = kp.privateKey as CryptoKey;
  jwks = { ...(await exportJWK(kp.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  await new Promise<void>((r) => server.listen(0, r));
  issuer = `http://127.0.0.1:${(server.address() as { port: number }).port}/realms/vc`;
});
after(() => server.close());

const client = () => new OidcClient({ issuer, clientId: 'app-mau', clientSecret: 's', redirectUri: 'http://x/cb', requiredGroup: 'app-app-mau' });
const sign = (claims: Record<string, unknown>, opts: { aud?: string; exp?: string } = {}) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(issuer)
    .setAudience(opts.aud ?? 'app-mau')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '5m')
    .sign(privateKey);

const ok = { sub: 'u1', email: 'lan@vcprosperous.com', email_verified: true, hd: 'vcprosperous.com', groups: ['app-app-mau'], nonce: 'n1', sid: 's1' };

test('id_token hợp lệ đi qua đủ 6 điểm, domain và nhóm', async () => {
  const c = await client().verifyIdToken(await sign(ok), 'n1');
  assert.equal(c.sub, 'u1');
});

for (const [name, claims, opts, nonce, code] of [
  ['sai nonce', ok, {}, 'khac', 'state_invalid'],
  ['sai aud', ok, { aud: 'vclinks' }, 'n1', 'state_invalid'],
  ['hết hạn', ok, { exp: '-2m' }, 'n1', 'state_invalid'],
  ['email chưa xác minh', { ...ok, email_verified: false }, {}, 'n1', 'outside_domain'],
  ['email ngoài công ty', { ...ok, email: 'an@gmail.com', hd: undefined }, {}, 'n1', 'outside_domain'],
  ['hd lạ', { ...ok, hd: 'khac.vn' }, {}, 'n1', 'outside_domain'],
  ['thiếu nhóm app', { ...ok, groups: [] }, {}, 'n1', 'app_not_granted'],
] as const) {
  test(`id_token bị từ chối: ${name}`, async () => {
    await assert.rejects(client().verifyIdToken(await sign({ ...claims }, opts), nonce), (e: unknown) => e instanceof LoginError && e.code === code);
  });
}

const event = { 'http://schemas.openid.net/event/backchannel-logout': {} };

test('logout_token hợp lệ trả sid', async () => {
  const t = await sign({ sub: 'u1', sid: 's1', jti: 'j1', events: event });
  assert.deepEqual(await client().verifyLogoutToken(t), { sid: 's1', sub: 'u1', jti: 'j1' });
});

for (const [name, claims] of [
  ['thiếu events', { sub: 'u1', sid: 's1', jti: 'j1' }],
  ['có nonce', { sub: 'u1', sid: 's1', jti: 'j1', events: event, nonce: 'x' }],
  ['thiếu jti', { sub: 'u1', sid: 's1', events: event }],
  ['thiếu sid và sub', { jti: 'j1', events: event }],
] as const) {
  test(`logout_token bị từ chối: ${name}`, async () => {
    await assert.rejects(client().verifyLogoutToken(await sign({ ...claims })));
  });
}
