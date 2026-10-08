import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { COMPANY_DOMAINS } from '@vclinks/shared';
import { C, DbService } from '../db/db.service';
import { DEFAULT_TENANT, runAsTenant } from '../db/tenant-context';
import { NotificationsService } from '../notifications/notifications.service';
import { ORG_C, type RoleAssignmentDoc } from '../org/org.types';
import { UsersService, type UserDoc } from '../users/users.service';
import { GoogleClient, GoogleUnreachableError } from './google.client';
import { SessionService } from './session.service';

/** Google Workspace domains allowed to sign in (01 PQ-10). */
export const ALLOWED_DOMAINS: readonly string[] = COMPANY_DOMAINS;
/** Google's `hd` login parameter takes one domain, or `*` for any Workspace account (the server still checks). */
const GOOGLE_HD = ALLOWED_DOMAINS.length === 1 ? ALLOWED_DOMAINS[0] : '*';

/**
 * Every verified company address may sign in (dev002 06/10/2026, docs 01 PQ-10): the first login creates the user
 * without a role. AUTH_SELF_SIGNUP=0 brings back the fixed list (only users an Admin added).
 */
export const selfSignupEnabled = () => !['0', 'false'].includes((process.env.AUTH_SELF_SIGNUP ?? '').trim().toLowerCase());
const STATE_TTL_MS = 10 * 60 * 1000;

/** Codes of a failed login; the login page maps each to the exact text of docs 00 MH-UI-02. */
export type LoginError =
  | 'outside_domain'
  | 'not_granted'
  | 'locked'
  | 'cancelled'
  | 'google_unreachable'
  | 'state_invalid';

export type CallbackResult =
  | { ok: true; token: string; next: string }
  | { ok: false; error: LoginError; email?: string };

interface StateDoc {
  _id: string;
  next: string;
  createdAt: Date;
}

/** Only same-site paths: `next` must never become an open redirect. */
export const safeNext = (next: unknown): string =>
  typeof next === 'string' && /^\/(?![/\\])/.test(next) && next.length <= 500 ? next : '/conversations';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly google: GoogleClient,
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Google URL to send the browser to; the one-shot `state` is kept in the DB for 10 minutes. */
  async startLogin(redirectUri: string, next: unknown, loginHint?: string): Promise<string> {
    const state = randomBytes(24).toString('base64url');
    await this.db.col<StateDoc>(C.authStates).insertOne({ _id: state, next: safeNext(next), createdAt: new Date() });
    return this.google.authUrl({ state, redirectUri, domain: GOOGLE_HD, loginHint });
  }

  async handleCallback(
    q: { code?: string; state?: string; error?: string },
    redirectUri: string,
    device: string | null = null,
  ): Promise<CallbackResult> {
    // Consume the state first: it is single-use even when the login fails.
    const st = q.state
      ? await this.db.col<StateDoc>(C.authStates).findOneAndDelete({ _id: q.state })
      : null;
    if (!st || Date.now() - st.createdAt.getTime() > STATE_TTL_MS) return { ok: false, error: 'state_invalid' };
    if (q.error || !q.code) return { ok: false, error: q.error === 'access_denied' ? 'cancelled' : 'google_unreachable' };

    let claims;
    try {
      claims = await this.google.exchange(q.code, redirectUri);
    } catch (e) {
      if (e instanceof GoogleUnreachableError) return { ok: false, error: 'google_unreachable' };
      throw e;
    }
    const email = (claims.email ?? '').trim().toLowerCase();
    if (!email || claims.email_verified === false) return { ok: false, error: 'google_unreachable' };
    // The server decides, never the browser's `hd` parameter: both the address and the token's hosted domain must be
    // company domains (a vcpart.vn address may sit in either Workspace, so hd need not equal the address's domain).
    const hd = (claims.hd ?? '').toLowerCase();
    if (!ALLOWED_DOMAINS.includes(email.slice(email.lastIndexOf('@') + 1)) || (hd && !ALLOWED_DOMAINS.includes(hd))) {
      return { ok: false, error: 'outside_domain', email };
    }

    // Public route: users are looked up in the default tenant (multi-tenant login comes later).
    return runAsTenant(DEFAULT_TENANT, async () => {
      let user = await this.users.findByEmail(email);
      // Only an account of the company's Google Workspace (hosted domain in the token) is created by itself: a
      // personal Google account opened with a company address, or one the company has closed, never is.
      const workspace = ALLOWED_DOMAINS.includes(hd);
      if (!user && workspace && selfSignupEnabled()) user = await this.signUp(email, claims.name);
      if (!user) {
        await this.db.audit('system', 'login_denied', email, { reason: 'not_granted' });
        return { ok: false, error: 'not_granted', email } as const;
      }
      if (user.status === 'tam_khoa' || user.status === 'nghi_viec') {
        await this.db.audit('system', 'login_denied', email, { reason: 'locked', status: user.status });
        return { ok: false, error: 'locked', email } as const;
      }
      await this.users.markLogin(user);
      const token = await this.sessions.create(user, DEFAULT_TENANT, device);
      await this.db.audit(user._id, 'login', user._id);
      return { ok: true, token, next: st.next } as const;
    });
  }

  /** First login of a company address: a user without roles, an audit line, a notice to every Admin. */
  private async signUp(email: string, name: string | undefined): Promise<UserDoc> {
    const { user, created } = await this.users.createFromSso(email, name);
    if (created) {
      await this.db.audit(user._id, 'user.self_signup', user._id, { via: 'google' });
      const admins = (await this.db.col<RoleAssignmentDoc>(ORG_C.roleAssignments).distinct('userId', { roleKey: 'admin' })) as string[];
      // A notice that cannot be written never blocks the login.
      await this.notifications
        .notify(admins, 'user.self_signup', `${user.fullName} (${user.email}) vừa đăng nhập VClinks lần đầu, đang chờ gán vai trò.`, '/admin/users?role=none')
        .catch(() => undefined);
    }
    return user;
  }
}
