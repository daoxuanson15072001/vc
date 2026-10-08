/**
 * App mẫu: a minimal web app that follows the VC ID integration contract (thiết kế SSO mục 5.2).
 * Used by the e2e tests of vc-platform and as a reference for app teams. Everything is in memory.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { LoginError, OidcClient, randomToken, type IdTokenClaims } from './oidc.js';

const PORT = Number(process.env.PORT ?? 4400);
const BASE = process.env.APP_BASE_URL ?? `http://localhost:${PORT}`;
const HOME = process.env.VC_HOME_URL ?? 'http://localhost:5173';
const IDLE_MS = 12 * 3600_000; // VH-AUT-05
const MAX_MS = 7 * 24 * 3600_000;

const oidc = new OidcClient({
  issuer: process.env.OIDC_ISSUER ?? 'http://localhost:8180/realms/vc',
  clientId: process.env.OIDC_CLIENT_ID ?? 'app-mau',
  clientSecret: process.env.OIDC_CLIENT_SECRET ?? 'dev-app-mau-secret',
  redirectUri: `${BASE}/api/auth/oidc/callback`,
  idpHint: process.env.OIDC_IDP_HINT ?? 'google',
  requiredGroup: process.env.OIDC_REQUIRE_APP_GROUP === '0' ? undefined : (process.env.OIDC_APP_GROUP ?? 'app-app-mau'),
});

interface Session {
  hash: string;
  sid?: string;
  sub: string;
  email?: string;
  name?: string;
  groups: string[];
  claims: IdTokenClaims;
  createdAt: number;
  lastUsedAt: number;
}
const authStates = new Map<string, { nonce: string; verifier: string; next: string; at: number }>();
const sessions = new Map<string, Session>(); // key: sha256(token), like VClinks `sessions`
const seenJti = new Map<string, number>();
const events: { at: number; type: string; detail: Record<string, unknown> }[] = [];

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const now = () => Date.now();

function cookie(req: IncomingMessage, name: string): string | undefined {
  const m = (req.headers.cookie ?? '').split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m?.slice(name.length + 1);
}

function currentSession(req: IncomingMessage): Session | undefined {
  const tok = cookie(req, 'app_mau_session');
  if (!tok) return;
  const s = sessions.get(sha(tok));
  if (!s) return;
  if (now() - s.lastUsedAt > IDLE_MS || now() - s.createdAt > MAX_MS) {
    sessions.delete(s.hash);
    return;
  }
  s.lastUsedAt = now();
  return s;
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const isText = typeof body === 'string';
  res.writeHead(status, { 'content-type': isText ? 'text/html; charset=utf-8' : 'application/json', 'cache-control': 'no-store', ...headers });
  res.end(isText ? body : JSON.stringify(body));
}
const redirect = (res: ServerResponse, to: string, headers: Record<string, string> = {}) => send(res, 302, '', { location: to, ...headers });

async function readBody(req: IncomingMessage, limit = 16_384): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new Error('body too large');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** `next` must stay inside this app (open-redirect guard). */
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/');

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', BASE);
  const path = url.pathname;

  if (req.method === 'GET' && path === '/api/auth/oidc') {
    const state = randomToken();
    const entry = { nonce: randomToken(), verifier: randomToken(48), next: safeNext(url.searchParams.get('next')), at: now() };
    authStates.set(state, entry);
    return redirect(res, await oidc.authUrl({ state, nonce: entry.nonce, verifier: entry.verifier }));
  }

  if (req.method === 'GET' && path === '/api/auth/oidc/callback') {
    const state = url.searchParams.get('state') ?? '';
    const st = authStates.get(state);
    authStates.delete(state); // one-time
    try {
      if (url.searchParams.get('error')) throw new LoginError('cancelled', url.searchParams.get('error') ?? undefined);
      if (!st || now() - st.at > 600_000) throw new LoginError('state_invalid');
      const claims = await oidc.exchange(url.searchParams.get('code') ?? '', st.verifier, st.nonce);
      const token = randomToken();
      const s: Session = {
        hash: sha(token),
        sid: claims.sid,
        sub: claims.sub,
        email: claims.email,
        name: claims.name,
        groups: claims.groups ?? [],
        claims,
        createdAt: now(),
        lastUsedAt: now(),
      };
      sessions.set(s.hash, s);
      events.push({ at: now(), type: 'login', detail: { sub: s.sub, sid: s.sid } });
      return redirect(res, st.next, { 'set-cookie': `app_mau_session=${token}; Path=/; HttpOnly; SameSite=Lax` });
    } catch (e) {
      const code = e instanceof LoginError ? e.code : 'state_invalid';
      events.push({ at: now(), type: 'login_denied', detail: { code, message: (e as Error).message } });
      return send(res, 403, `<!doctype html><title>Không đăng nhập được</title><p id="ma-loi">${code}</p>`);
    }
  }

  if (req.method === 'POST' && path === '/api/auth/backchannel-logout') {
    try {
      const form = new URLSearchParams(await readBody(req));
      const lt = form.get('logout_token');
      if (!lt) throw new Error('no logout_token');
      const { sid, sub, jti } = await oidc.verifyLogoutToken(lt);
      for (const [k, t] of seenJti) if (now() - t > 600_000) seenJti.delete(k);
      if (seenJti.has(jti)) throw new Error('jti replay');
      seenJti.set(jti, now());
      let n = 0;
      for (const s of [...sessions.values()]) {
        if ((sid && s.sid === sid) || (!sid && s.sub === sub)) {
          sessions.delete(s.hash);
          n++;
        }
      }
      events.push({ at: now(), type: 'backchannel_logout', detail: { sid, sub, revoked: n } });
      return send(res, 200, '', { 'cache-control': 'no-store' });
    } catch (e) {
      events.push({ at: now(), type: 'backchannel_rejected', detail: { message: (e as Error).message } });
      return send(res, 400, { error: 'invalid_request' });
    }
  }

  if (req.method === 'POST' && path === '/api/auth/logout') {
    const s = currentSession(req);
    if (s) sessions.delete(s.hash);
    return send(res, 200, { redirect: await oidc.logoutUrl(`${HOME}/da-dang-xuat`) }, { 'set-cookie': 'app_mau_session=; Path=/; Max-Age=0' });
  }

  if (req.method === 'GET' && path === '/api/me') {
    const s = currentSession(req);
    if (!s) return send(res, 401, { error: 'unauthenticated' });
    return send(res, 200, { sub: s.sub, sid: s.sid, email: s.email, name: s.name, groups: s.groups, claims: s.claims });
  }

  // Test hooks (never in a real app).
  if (req.method === 'GET' && path === '/_test/state') {
    return send(res, 200, { sessions: [...sessions.values()].map(({ claims: _c, ...s }) => s), events });
  }

  if (req.method === 'GET' && path === '/') {
    const s = currentSession(req);
    if (!s) return redirect(res, `/api/auth/oidc?next=${encodeURIComponent('/')}`);
    return send(res, 200, `<!doctype html><title>App mẫu</title><p id="xin-chao">Xin chào ${s.name ?? s.email}</p>`);
  }

  return send(res, 404, { error: 'not_found' });
}

createServer((req, res) => {
  handle(req, res).catch((e) => send(res, 500, { error: 'server_error', message: (e as Error).message }));
}).listen(PORT, () => console.log(`App mẫu chạy ở ${BASE}`));
