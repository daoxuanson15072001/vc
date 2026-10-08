import request from 'supertest';
import { GoogleClient, GoogleUnreachableError, type GoogleClaims } from '../../src/auth/google.client';
import { SESSION_IDLE_MS } from '../../src/auth/session.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

// M1b-02: Google Workspace login, sessions, and device/MCP tokens staying as they were.
describe('login with Google (e2e)', () => {
  let t: E2EApp;
  let google: GoogleClient;
  let claims: GoogleClaims | Error;
  const http = () => request(t.app.getHttpServer());

  /** Runs the whole redirect dance with the stubbed Google answer; returns the final redirect target. */
  async function login(answer: GoogleClaims | Error, cb: { error?: string } = {}) {
    claims = answer;
    const start = await http().get('/api/auth/google').query({ next: '/contacts' }).expect(302);
    const state = new URL(start.headers.location).searchParams.get('state')!;
    const res = await http().get('/api/auth/google/callback').query({ code: 'c', state, ...cb }).expect(302);
    return { location: new URL(res.headers.location), state };
  }
  const ok = (email: string): GoogleClaims => ({ email, email_verified: true, hd: 'vcprosperous.com', aud: 'test-client' });

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.AUTH_BASE_URL = 'http://localhost:3202';
    t = await startE2EApp();
    google = t.app.get(GoogleClient);
    google.exchange = async () => {
      if (claims instanceof Error) throw claims;
      return claims;
    };
    const users = t.db.col(C.users);
    await users.insertMany([
      { _id: 'U1', email: 'minh.uat@vcprosperous.com', fullName: 'Nguyễn Văn Minh', status: 'hoat_dong' },
      { _id: 'U2', email: 'khoa.uat@vcprosperous.com', fullName: 'Người Khóa', status: 'nghi_viec' },
      { _id: 'U3', email: 'moi.uat2@vcprosperous.com', fullName: 'Chờ kích hoạt', status: 'cho_kich_hoat' },
    ] as never);
  });
  afterAll(async () => {
    await t?.close();
  });

  it('offers SSO and token login on the config route; AUTH_TOKEN_LOGIN=0 hides the token form', async () => {
    expect((await http().get('/api/auth/config').expect(200)).body).toEqual({ ssoEnabled: true, tokenLogin: true });
    process.env.AUTH_TOKEN_LOGIN = '0';
    expect((await http().get('/api/auth/config').expect(200)).body.tokenLogin).toBe(false);
    delete process.env.AUTH_TOKEN_LOGIN;
  });

  it('sends the browser to Google restricted to Workspace accounts (two company domains), with a one-shot state', async () => {
    const res = await http().get('/api/auth/google').expect(302);
    const u = new URL(res.headers.location);
    expect(u.origin).toBe('https://accounts.google.com');
    expect(u.searchParams.get('hd')).toBe('*');
    expect(u.searchParams.get('prompt')).toBe('select_account');
    expect(u.searchParams.get('redirect_uri')).toBe('http://localhost:3202/api/auth/google/callback');
    expect(u.searchParams.get('state')).toBeTruthy();
  });

  it('refuses an account outside the domain even when the browser claims hd', async () => {
    const { location } = await login({ ...ok('nguoila.uat@example.vn'), hd: undefined });
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('outside_domain');
    expect(location.searchParams.get('email')).toBe('nguoila.uat@example.vn');
    expect(location.hash).toBe('');
  });

  it('refuses a vcprosperous.com address whose token says another hosted domain', async () => {
    const { location } = await login({ ...ok('minh.uat@vcprosperous.com'), hd: 'example.vn' });
    expect(location.searchParams.get('error')).toBe('outside_domain');
  });

  it('lets any company address in: the first login creates a user without roles and tells every Admin once', async () => {
    await t.db.col('role_assignments').insertOne({ _id: 'U1:admin:root', userId: 'U1', roleKey: 'admin', orgUnitId: 'root', createdBy: 'seed', createdAt: new Date() } as never);
    const { location } = await login({ ...ok('Moi.UAT@vcprosperous.com'), name: 'Người Mới' });
    const session = new URLSearchParams(location.hash.slice(1)).get('session')!;
    expect(session).toMatch(/^vcs_/);
    const user = (await t.db.col(C.users).findOne({ email: 'moi.uat@vcprosperous.com' } as never)) as { _id: string } | null;
    expect(user).toMatchObject({ fullName: 'Người Mới', status: 'hoat_dong', createdBy: 'sso', lastLoginAt: expect.any(Date) });
    expect(await t.db.col(C.auditLog).findOne({ action: 'user.self_signup', target: user!._id })).toBeTruthy();
    expect(await t.db.col(C.auditLog).findOne({ action: 'login', target: user!._id })).toBeTruthy();
    // Signed in, but no role yet: nothing of the customers' data.
    const me = await http().get('/api/me/permissions').set('Authorization', `Bearer ${session}`).expect(200);
    expect(me.body).toMatchObject({ userId: user!._id, roles: [] });
    await http().get('/api/conversations').set('Authorization', `Bearer ${session}`).expect(403);
    const notes = await t.db.col('notifications').find({ kind: 'user.self_signup' } as never).toArray();
    expect(notes.map((n) => (n as { userId?: string }).userId)).toEqual(['U1']);
    expect(notes[0]).toMatchObject({ link: '/admin/users?role=none' });
    // The Admin finds the person with the "Chưa có vai trò" filter.
    const waiting = await http().get('/api/admin/users').query({ role: 'none' }).set(t.auth.dashboard).expect(200);
    expect(waiting.body.items.map((u: { email: string }) => u.email)).toContain('moi.uat@vcprosperous.com');
    expect(waiting.body.items.map((u: { email: string }) => u.email)).not.toContain('minh.uat@vcprosperous.com');
    // The next login reuses the record and does not notify again.
    await login(ok('moi.uat@vcprosperous.com'));
    expect(await t.db.col(C.users).countDocuments({ email: 'moi.uat@vcprosperous.com' } as never)).toBe(1);
    expect(await t.db.col('notifications').countDocuments({ kind: 'user.self_signup' } as never)).toBe(1);
  });

  it('lets a vcpart.vn address in too, whichever company Workspace hosts it; another hosted domain is refused', async () => {
    const own = await login({ ...ok('Cskh.UAT@vcpart.vn'), hd: 'vcpart.vn', name: 'CSKH VCparts' });
    expect(new URLSearchParams(own.location.hash.slice(1)).get('session')).toMatch(/^vcs_/);
    expect(await t.db.col(C.users).findOne({ email: 'cskh.uat@vcpart.vn' } as never)).toMatchObject({ createdBy: 'sso', status: 'hoat_dong' });
    const alias = await login({ ...ok('kho.uat@vcpart.vn'), hd: 'vcprosperous.com' });
    expect(new URLSearchParams(alias.location.hash.slice(1)).get('session')).toMatch(/^vcs_/);
    const other = await login({ ...ok('kho.uat@vcpart.vn'), hd: 'example.vn' });
    expect(other.location.searchParams.get('error')).toBe('outside_domain');
  });

  it('creates nobody from a Google account outside the company Workspace (no hosted domain in the token)', async () => {
    const { location } = await login({ ...ok('canhan.uat@vcprosperous.com'), hd: undefined });
    expect(location.searchParams.get('error')).toBe('not_granted');
    expect(await t.db.col(C.users).findOne({ email: 'canhan.uat@vcprosperous.com' } as never)).toBeNull();
  });

  it('AUTH_SELF_SIGNUP=0 keeps the fixed list: an address never added is refused and logged', async () => {
    process.env.AUTH_SELF_SIGNUP = '0';
    try {
      const { location } = await login(ok('ngoaids.uat@vcprosperous.com'));
      expect(location.searchParams.get('error')).toBe('not_granted');
      expect(location.searchParams.get('email')).toBe('ngoaids.uat@vcprosperous.com');
      expect(await t.db.col(C.auditLog).findOne({ action: 'login_denied', target: 'ngoaids.uat@vcprosperous.com' })).toBeTruthy();
      expect(await t.db.col(C.users).findOne({ email: 'ngoaids.uat@vcprosperous.com' } as never)).toBeNull();
    } finally {
      delete process.env.AUTH_SELF_SIGNUP;
    }
  });

  it('refuses a locked user', async () => {
    const { location } = await login(ok('khoa.uat@vcprosperous.com'));
    expect(location.searchParams.get('error')).toBe('locked');
  });

  it('reports a cancelled Google screen and an unreachable Google', async () => {
    expect((await login(ok('x@vcprosperous.com'), { error: 'access_denied' })).location.searchParams.get('error')).toBe('cancelled');
    expect((await login(new GoogleUnreachableError('down'))).location.searchParams.get('error')).toBe('google_unreachable');
  });

  it('rejects an unknown or reused state', async () => {
    const { state } = await login(ok('minh.uat@vcprosperous.com'));
    const again = await http().get('/api/auth/google/callback').query({ code: 'c', state }).expect(302);
    expect(new URL(again.headers.location).searchParams.get('error')).toBe('state_invalid');
    const none = await http().get('/api/auth/google/callback').query({ code: 'c', state: 'nope' }).expect(302);
    expect(new URL(none.headers.location).searchParams.get('error')).toBe('state_invalid');
  });

  it('logs in a granted user: session in the URL fragment, /me works, logout ends it', async () => {
    const { location } = await login(ok('Minh.UAT@vcprosperous.com'));
    const frag = new URLSearchParams(location.hash.slice(1));
    const session = frag.get('session')!;
    expect(session).toMatch(/^vcs_/);
    expect(frag.get('next')).toBe('/contacts');

    const me = await http().get('/api/me').set('Authorization', `Bearer ${session}`).expect(200);
    expect(me.body).toEqual({ name: 'Nguyễn Văn Minh', scopes: ['dashboard'], userId: 'U1' });
    // The session is a dashboard session: it cannot ingest.
    await http().post('/api/ingest/contacts').set('Authorization', `Bearer ${session}`).send({ uid: '1', items: [] }).expect(403);
    expect(await t.db.col(C.users).findOne({ _id: 'U1' } as never)).toMatchObject({ lastLoginAt: expect.any(Date) });
    expect(await t.db.col(C.auditLog).findOne({ action: 'login', target: 'U1' })).toBeTruthy();
    // Only the hash is stored.
    expect(JSON.stringify(await t.db.col(C.sessions).find().toArray())).not.toContain(session);

    await http().post('/api/auth/logout').set('Authorization', `Bearer ${session}`).expect(200);
    await http().get('/api/me').set('Authorization', `Bearer ${session}`).expect(401);
  });

  it('ends a session after 12 hours without activity', async () => {
    const { location } = await login(ok('minh.uat@vcprosperous.com'));
    const session = new URLSearchParams(location.hash.slice(1)).get('session')!;
    const old = new Date(Date.now() - SESSION_IDLE_MS - 60_000);
    await t.db.col(C.sessions).updateMany({ userId: 'U1', revokedAt: { $exists: false } }, { $set: { lastUsedAt: old } });
    await http().get('/api/me').set('Authorization', `Bearer ${session}`).expect(401);
  });

  it('activates a user waiting for activation on the first login', async () => {
    const { location } = await login(ok('moi.uat2@vcprosperous.com'));
    expect(new URLSearchParams(location.hash.slice(1)).get('session')).toBeTruthy();
    expect(await t.db.col(C.users).findOne({ _id: 'U3' } as never)).toMatchObject({ status: 'hoat_dong' });
  });

  it('keeps device (ingest) and MCP tokens working as before', async () => {
    await http().get('/api/me').set(t.auth.ingest).expect(200);
    await http().get('/api/me').set(t.auth.mcp).expect(200);
    await http().get('/api/me').set(t.auth.dashboard).expect(200);
    await http().post('/api/accounts').set(t.auth.ingest).send({ uid: '9000000000999', label: 'Nick thiết bị' }).expect(201);
    await http().get('/api/me').set({ Authorization: 'Bearer vcs_unknown' }).expect(401);
  });
});
