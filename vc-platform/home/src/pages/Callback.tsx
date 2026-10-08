/** `/callback`: exchange the code (PKCE), check the account is a company account, go back to the page asked for. */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from 'oidc-client-ts';
import { Loading } from '../components/Shell';
import { inCompany, useAuth } from '../lib/auth';
import { authErrorCode, safeNext } from '../lib/messages';

// StrictMode runs effects twice in dev; a code can be exchanged only once.
let pending: Promise<User> | undefined;

export function Callback() {
  const { userManager, settle, config } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    pending ??= userManager.signinRedirectCallback();
    pending
      .then(async (user) => {
        if (!inCompany(user, config.companyDomains)) {
          await userManager.removeUser();
          settle(null);
          navigate('/loi?ma=outside_domain', { replace: true });
          return;
        }
        settle(user);
        navigate(safeNext((user.state as { next?: string } | undefined)?.next), { replace: true });
      })
      .catch((e) => {
        settle(null);
        navigate(`/loi?ma=${authErrorCode(e)}`, { replace: true });
      })
      .finally(() => {
        pending = undefined;
      });
  }, [userManager, settle, config, navigate]);
  return <Loading label="Đang đăng nhập…" />;
}
