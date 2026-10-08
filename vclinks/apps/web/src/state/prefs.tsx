import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import viVN from 'antd/locale/vi_VN';

/** Per-viewer UI preferences (theme, selected account). Stored locally; losing them is harmless. */

const THEME_KEY = 'vclinks.theme';
const ACCOUNT_KEY = 'vclinks.account';

export type ThemeMode = 'light' | 'dark';

/**
 * Design tokens of the Zalo-like "blue and white" look: Zalo blue accent, white panels on a light grey-blue
 * ground, red / orange kept for overdue and expiring items. The same values live as CSS variables in
 * styles.css (keep both in sync).
 */
const BASE_TOKENS = {
  fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontSize: 14,
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 6,
  controlHeight: 36,
  wireframe: false,
};

const LIGHT_TOKENS = {
  colorPrimary: '#0068ff',
  colorInfo: '#0068ff',
  colorLink: '#0068ff',
  colorSuccess: '#1c8a54',
  colorWarning: '#c2410c',
  colorError: '#b42318',
  colorText: '#081c36',
  colorTextSecondary: '#3c4f66',
  colorTextTertiary: '#627590',
  colorTextQuaternary: '#97a6b8',
  colorBorder: '#c9d0d9',
  colorBorderSecondary: '#e1e4ea',
  colorBgLayout: '#f3f5f6',
  colorBgContainer: '#ffffff',
  colorFillTertiary: '#eef0f2',
  colorFillQuaternary: '#f3f5f6',
  // Soft status surfaces (alerts, selected rows): the same light blue as Zalo's selection.
  colorPrimaryBg: '#e5efff',
  colorPrimaryBgHover: '#d6e6ff',
  controlItemBgActive: '#e5efff',
  colorInfoBg: '#e5efff',
  colorInfoBorder: '#b8d3ff',
  colorSuccessBg: '#e4f2ea',
  colorSuccessBorder: '#bfe0cc',
  colorWarningBg: '#fdefe0',
  colorWarningBorder: '#f5cfa6',
  colorErrorBg: '#fcebe8',
  colorErrorBorder: '#f3c4bd',
};

const DARK_TOKENS = {
  colorPrimary: '#3d8bff',
  colorInfo: '#3d8bff',
  colorLink: '#6aa6ff',
  colorSuccess: '#3fb37a',
  colorWarning: '#f08c3c',
  colorError: '#f07167',
  colorBgLayout: '#0e141b',
  colorBgContainer: '#151d26',
  colorBorder: '#34465c',
  colorBorderSecondary: '#243142',
  colorPrimaryBg: '#12305e',
  colorPrimaryBgHover: '#173a70',
  controlItemBgActive: '#12305e',
  colorInfoBg: '#12305e',
  colorInfoBorder: '#1d4280',
  colorSuccessBg: '#17301f',
  colorSuccessBorder: '#24503a',
  colorWarningBg: '#3a2a1b',
  colorWarningBorder: '#5c4126',
  colorErrorBg: '#3a1d1b',
  colorErrorBorder: '#5e2b27',
};

function componentTokens(mode: ThemeMode) {
  const dark = mode === 'dark';
  return {
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 500 },
    Card: { borderRadiusLG: 14 },
    Table: { headerBg: dark ? '#1b2531' : '#f5f7f9', headerColor: dark ? '#8fa3b9' : '#627590', headerSplitColor: 'transparent' },
    Tabs: { titleFontSize: 14 },
    // Selection in trees / menus / segmented controls uses the soft accent, never antd grey or blue.
    Tree: {
      nodeSelectedBg: dark ? '#12305e' : '#e5efff',
      nodeHoverBg: dark ? '#1b2531' : '#f3f5f6',
      directoryNodeSelectedBg: dark ? '#12305e' : '#e5efff',
      directoryNodeSelectedColor: dark ? '#9cc2ff' : '#0050c8',
    },
    Menu: { itemSelectedBg: dark ? '#12305e' : '#e5efff', itemSelectedColor: dark ? '#9cc2ff' : '#0050c8' },
    Segmented: { itemSelectedColor: dark ? '#e6edf5' : '#081c36', trackBg: dark ? '#1b2531' : '#eef0f2' },
  };
}

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: preference just won't persist.
  }
}

interface Prefs {
  mode: ThemeMode;
  toggleMode: () => void;
  /** Selected Zalo account uid; undefined = all accounts. */
  accountUid?: string;
  setAccountUid: (uid?: string) => void;
}

const PrefsContext = createContext<Prefs | null>(null);

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside <PrefsProvider>');
  return ctx;
}

function initialMode(): ThemeMode {
  const saved = readPref(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [accountUid, setAccount] = useState<string | undefined>(() => readPref(ACCOUNT_KEY) ?? undefined);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      writePref(THEME_KEY, next);
      return next;
    });
  }, []);

  const setAccountUid = useCallback((uid?: string) => {
    setAccount(uid);
    writePref(ACCOUNT_KEY, uid ?? null);
  }, []);

  const value = useMemo(() => ({ mode, toggleMode, accountUid, setAccountUid }), [mode, toggleMode, accountUid, setAccountUid]);

  return (
    <PrefsContext.Provider value={value}>
      <ConfigProvider
        locale={viVN}
        theme={{
          algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: { ...BASE_TOKENS, ...(mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS) },
          components: componentTokens(mode),
        }}
      >
        {children}
      </ConfigProvider>
    </PrefsContext.Provider>
  );
}
