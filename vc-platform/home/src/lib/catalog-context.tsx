import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadCatalog, type CatalogApp } from './catalog';

interface CatalogState {
  apps: CatalogApp[];
  loading: boolean;
  stale: boolean;
  failed: boolean;
  retry(): void;
}

const Ctx = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState({ apps: [] as CatalogApp[], loading: true, stale: false, failed: false });
  const load = useCallback(() => {
    setS((x) => ({ ...x, loading: true }));
    loadCatalog()
      .then((r) => setS({ apps: r.apps, loading: false, stale: r.stale, failed: false }))
      .catch(() => setS({ apps: [], loading: false, stale: false, failed: true }));
  }, []);
  useEffect(load, [load]);
  return <Ctx.Provider value={{ ...s, retry: load }}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCatalog ngoài CatalogProvider');
  return v;
}
