/**
 * Sign-in for VC Home (thiết kế SSO mục 5.3): public client + PKCE, tokens in memory only, silent sign-in on load,
 * renewal only while the person is active (VH-AUT-05).
 * Losing the VC ID session shows here in two ways: the OIDC session iframe sees a logout done in this browser within
 * seconds (UAT-SSO-07); a lock done by an admin on the server does not touch the browser cookie, so while the person
 * is active the token is refreshed every `sessionCheckSeconds` and a refused refresh ends the session (UAT-SSO-09).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import type { HomeConfig } from './config';
import { LOGIN_REQUIRED, safeNext } from './messages';

export function createUserManager(cfg: HomeConfig): UserManager {
  const origin = window.location.origin;
  return new UserManager({
    authority: cfg.authority,
    client_id: cfg.clientId,
    redirect_uri: `${origin}/callback`,
    silent_redirect_uri: `${origin}/silent`,
    post_logout_redirect_uri: `${origin}/da-dang-xuat`,
    response_type: 'code',
    scope: 'openid profile email',
    extraQueryParams: { kc_idp_hint: 'google' },
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    automaticSilentRenew: false,
    monitorSession: true,
    checkSessionIntervalInSeconds: 3,
    silentRequestTimeoutInSeconds: 10,
  });
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; reason?: 'expired' | 'signed_out' }
  | { status: 'authenticated'; user: User };

interface AuthApi {
  state: AuthState;
  config: HomeConfig;
  userManager: UserManager;
  login(opts?: { next?: string; selectAccount?: boolean }): Promise<void>;
  logout(): Promise<void>;
  /** "Chọn tài khoản khác": VC ID keeps one person per browser, so an open session is closed first. */
  switchAccount(): Promise<void>;
  /** Result of the redirect callback (null when it failed). */
  settle(user: User | null): void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth ngoài AuthProvider');
  return v;
}

/** Profile claims VC ID puts in the id_token (vc.yaml, scope vc-basic). */
export function claims(user: User) {
  const p = user.profile as Record<string, unknown>;
  return {
    sub: user.profile.sub,
    email: (p.email as string | undefined) ?? '',
    name: (p.name as string | undefined) ?? '',
    givenName: (p.given_name as string | undefined) ?? (p.name as string | undefined) ?? '',
    picture: p.picture as string | undefined,
    hd: p.hd as string | undefined,
    groups: Array.isArray(p.groups) ? (p.groups as string[]) : [],
    status: (Array.isArray(p.vc_trang_thai) ? p.vc_trang_thai[0] : p.vc_trang_thai) as string | undefined,
  };
}

/** Company account: email domain and Google `hd` both in the company domains (khớp kiểm ở app, mục 5.2). */
export function inCompany(user: User, domains: string[]): boolean {
  const c = claims(user);
  const domain = c.email.split('@')[1]?.toLowerCase() ?? '';
  return domains.includes(domain) && !!c.hd && domains.includes(c.hd.toLowerCase());
}

export const SWITCH_STATE = 'chon_tai_khoan';

const ACTIVE_WINDOW_MS = 30 * 60_000;
let lastActivity = Date.now();
const recentlyActive = () => document.visibilityState === 'visible' && Date.now() - lastActivity < ACTIVE_WINDOW_MS;

// React StrictMode runs effects twice in dev; the first silent sign-in is shared.
let firstSignin: Promise<User | null> | undefined;

export function AuthProvider({ config, userManager: um, children }: { config: HomeConfig; userManager: UserManager; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const navigate = useNavigate();
  const tokenExpired = useRef(false);
  const signedIn = useRef(false);
  signedIn.current = state.status === 'authenticated';
  const renewing = useRef<Promise<void> | null>(null);

  const renew = useCallback(() => {
    renewing.current ??= um
      .signinSilent()
      .then((u) => {
        tokenExpired.current = false;
        if (u) setState({ status: 'authenticated', user: u });
      })
      .catch(async (e: { error?: string }) => {
        if (LOGIN_REQUIRED.has(e?.error ?? '')) {
          await um.removeUser();
          setState({ status: 'anonymous', reason: 'expired' });
        }
        // Network or VC ID down: keep the page; the next action tries again.
      })
      .finally(() => {
        renewing.current = null;
      });
    return renewing.current;
  }, [um]);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/callback') return;
    if (path === '/da-dang-xuat' || path === '/loi') {
      setState({ status: 'anonymous' });
      return;
    }
    firstSignin ??= um.signinSilent().catch(() => null);
    void firstSignin.then((u) => setState(u ? { status: 'authenticated', user: u } : { status: 'anonymous' }));
  }, [um]);

  useEffect(() => {
    const onExpiring = () => {
      if (recentlyActive()) void renew();
    };
    const onExpired = () => {
      tokenExpired.current = true;
    };
    const onSignedOut = async () => {
      await um.removeUser();
      setState({ status: 'anonymous', reason: 'signed_out' });
      navigate('/da-dang-xuat', { replace: true });
    };
    const onActivity = () => {
      lastActivity = Date.now();
      if (tokenExpired.current) void renew();
    };
    um.events.addAccessTokenExpiring(onExpiring);
    um.events.addAccessTokenExpired(onExpired);
    um.events.addUserSignedOut(onSignedOut);
    const kinds = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const k of kinds) window.addEventListener(k, onActivity, { passive: true });
    const check = window.setInterval(() => {
      if (signedIn.current && recentlyActive()) void renew();
    }, config.sessionCheckSeconds * 1000);
    return () => {
      window.clearInterval(check);
      um.events.removeAccessTokenExpiring(onExpiring);
      um.events.removeAccessTokenExpired(onExpired);
      um.events.removeUserSignedOut(onSignedOut);
      for (const k of kinds) window.removeEventListener(k, onActivity);
    };
  }, [um, renew, navigate, config.sessionCheckSeconds]);

  const login = useCallback(
    async (opts: { next?: string; selectAccount?: boolean } = {}) => {
      await um.signinRedirect({
        state: { next: safeNext(opts.next ?? window.location.pathname + window.location.search) },
        // VC ID supports only none/login/consent. `login` drops the VC ID session and goes back to Google, whose
        // account chooser is always on (vc.yaml, IdP google: prompt=select_account).
        prompt: opts.selectAccount ? 'login' : undefined,
      });
    },
    [um],
  );

  const logout = useCallback(async () => {
    // id_token_hint is sent, so VC ID logs out of every app without the confirmation page (UAT-SSO-08).
    await um.signoutRedirect();
  }, [um]);

  const switchAccount = useCallback(async () => {
    const current = await um.signinSilent().catch(() => null);
    // Back on /da-dang-xuat, Welcome reads this state and goes on to Google (SWITCH_STATE).
    if (current) await um.signoutRedirect({ state: SWITCH_STATE });
    else await login({ next: '/', selectAccount: true });
  }, [um, login]);

  const settle = useCallback((u: User | null) => setState(u ? { status: 'authenticated', user: u } : { status: 'anonymous' }), []);

  const api = useMemo(
    () => ({ state, config, userManager: um, login, logout, switchAccount, settle }),
    [state, config, um, login, logout, switchAccount, settle],
  );
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}
