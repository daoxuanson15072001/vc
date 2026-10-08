/** `catalog.json` (VH-API-08) and the app grid rules of VH-HOM-01. */
export interface CatalogApp {
  key: string;
  name: string;
  description: string;
  url: string | null;
  icon: string;
  group: string;
  status: 'live' | 'beta' | 'coming_soon' | 'paused' | 'retired' | string;
  order: number;
  eta?: string;
}

const CACHE_KEY = 'vchome.catalog';
const PIN_KEY = 'vchome.pinned';

/** Fresh catalog, or the last good copy (stale = true), or an error when there is none. */
export async function loadCatalog(): Promise<{ apps: CatalogApp[]; stale: boolean }> {
  try {
    const res = await fetch('/catalog.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`catalog.json ${res.status}`);
    const body = (await res.json()) as { apps?: CatalogApp[] };
    const apps = (body.apps ?? []).filter((a) => a && typeof a.key === 'string' && typeof a.group === 'string');
    store(CACHE_KEY, apps);
    return { apps, stale: false };
  } catch (e) {
    const cached = read<CatalogApp[]>(CACHE_KEY);
    if (cached) return { apps: cached, stale: true };
    throw e;
  }
}

const OPENABLE = new Set(['live', 'beta']);

/** Tiles of "Ứng dụng của bạn": live or beta, group in the token, pinned first (in pin order), then admin order. */
export function myApps(apps: CatalogApp[], groups: string[], pinned: string[] = []): CatalogApp[] {
  const mine = apps.filter((a) => OPENABLE.has(a.status) && a.url && a.key !== 'vchome' && groups.includes(a.group));
  const pinIndex = (a: CatalogApp) => {
    const i = pinned.indexOf(a.key);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...mine].sort((a, b) => pinIndex(a) - pinIndex(b) || a.order - b.order);
}

export function comingSoon(apps: CatalogApp[]): CatalogApp[] {
  return apps.filter((a) => a.status === 'coming_soon').sort((a, b) => a.order - b.order);
}

export function readPinned(sub: string): string[] {
  return read<Record<string, string[]>>(PIN_KEY)?.[sub] ?? [];
}

export function togglePin(sub: string, key: string): string[] {
  const all = read<Record<string, string[]>>(PIN_KEY) ?? {};
  const cur = all[sub] ?? [];
  all[sub] = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
  store(PIN_KEY, all);
  return all[sub];
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}
function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the page still works without the cache.
  }
}
