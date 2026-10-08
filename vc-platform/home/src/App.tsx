import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import type { UserManager } from 'oidc-client-ts';
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { OfflineBanner } from './components/OfflineBanner';
import { Loading, Shell } from './components/Shell';
import { AuthProvider, useAuth } from './lib/auth';
import { CatalogProvider } from './lib/catalog-context';
import type { HomeConfig } from './lib/config';
import { Callback } from './pages/Callback';
import { ErrorPage } from './pages/ErrorPage';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { Profile } from './pages/Profile';
import { Welcome } from './pages/Welcome';

/** Colours of the design approved with the boss (artifact "VC Home"), same family as VClinks. */
const theme = {
  token: {
    colorPrimary: '#0A57D0',
    colorLink: '#0A57D0',
    colorText: '#0B1B33',
    colorTextSecondary: '#5B687A',
    colorBorder: '#E3E7EE',
    colorBgLayout: '#F4F6F9',
    borderRadius: 10,
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    fontSize: 14,
  },
};

function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'anonymous') return <Welcome variant={state.reason === 'expired' ? 'expired' : 'welcome'} />;
  return (
    <CatalogProvider>
      <Shell>{children}</Shell>
    </CatalogProvider>
  );
}

export function App({ config, userManager }: { config: HomeConfig; userManager: UserManager }) {
  return (
    <ConfigProvider locale={viVN} theme={theme}>
      <AntApp>
        <AuthProvider config={config} userManager={userManager}>
          <OfflineBanner />
          <Routes>
            <Route path="/callback" element={<Callback />} />
            <Route path="/da-dang-xuat" element={<Welcome variant="signed_out" />} />
            <Route path="/loi" element={<ErrorPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Home />
                </RequireAuth>
              }
            />
            <Route
              path="/ho-so"
              element={
                <RequireAuth>
                  <Profile />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}
