/** Minimal fetch wrapper for the VClinks REST API. */
import { clearAllDrafts } from './utils/drafts';

export const TOKEN_KEY = 'vclinks.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  // A new sign-in may be another person on this browser: drop drafts left by the previous one.
  clearAllDrafts();
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode): the session just won't persist.
  }
}

/** Signs out: ends the dashboard session on the server, then forgets it here (even when the server is unreachable). */
export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(buildUrl('/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Offline: the session still ends by itself after 12 hours without use.
    }
  }
  clearToken();
}

export function clearToken(): void {
  clearAllDrafts();
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined | null>;

interface RequestOptions {
  method?: string;
  query?: Query;
  body?: unknown;
  /** Token override (login check before the token is stored). */
  token?: string;
  /** Do not redirect to login on 401 (used by the login page itself). */
  noRedirect?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ''}`;
}

function errorMessage(status: number, data: unknown): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message;
    if (Array.isArray(m)) return m.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('; ');
    if (typeof m === 'string') return m;
  }
  return `Lỗi máy chủ (HTTP ${status})`;
}

/**
 * Object URL of an uploaded message photo. `<img>` cannot send the Bearer
 * token, so the bytes are fetched here; results are cached for the session
 * (media ids are sha256 of the bytes, so they never change).
 */
const mediaUrls = new Map<string, Promise<string | null>>();
export function mediaObjectUrl(id: string): Promise<string | null> {
  let p = mediaUrls.get(id);
  if (!p) {
    const token = getToken();
    p = fetch(buildUrl(`/media/${encodeURIComponent(id)}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : null))
      .catch(() => null);
    // A failed load may succeed later (API restarted, token renewed): do not cache it.
    p.then((u) => {
      if (!u) mediaUrls.delete(id);
    });
    mediaUrls.set(id, p);
  }
  return p;
}

/** Object URL of a stored attachment (bytes through the scoped API route with the Bearer token). */
const attachmentUrls = new Map<string, Promise<string | null>>();
export function attachmentObjectUrl(id: string): Promise<string | null> {
  let p = attachmentUrls.get(id);
  if (!p) {
    const token = getToken();
    p = fetch(buildUrl(`/attachments/${encodeURIComponent(id)}/file`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : null))
      .catch(() => null);
    p.then((u) => {
      if (!u) attachmentUrls.delete(id);
    });
    attachmentUrls.set(id, p);
  }
  return p;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.token ?? getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ');
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (res.status === 401 && !opts.noRedirect) {
    const hadToken = getToken() !== null;
    clearToken();
    // A stored token that stopped working is an expired session (MH-UI-02).
    if (!window.location.pathname.startsWith('/login')) window.location.assign(hadToken ? '/login?reason=expired' : '/login');
  }
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, data));
  return data as T;
}
