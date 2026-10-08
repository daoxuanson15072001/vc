import { createHmac } from 'node:crypto';

/**
 * Minimal Graph API client (plain fetch). Tokens are only ever placed in the
 * request (query string, as documented by Meta) and are never part of an
 * error message, a log line or a return value.
 */

/** Current Graph API version (v26.0 released 29/07/2026). Override with FB_GRAPH_VERSION. */
export const DEFAULT_GRAPH_VERSION = 'v26.0';
export const graphVersion = () => process.env.FB_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
export const GRAPH_HOST = 'https://graph.facebook.com';
const TIMEOUT_MS = 10_000;

/** Env configuration of the Facebook App, read at call time (tests set env after import). */
export function fbConfig() {
  const base = (process.env.PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '');
  return {
    appId: (process.env.FB_APP_ID ?? '').trim(),
    appSecret: (process.env.FB_APP_SECRET ?? '').trim(),
    verifyToken: (process.env.FB_VERIFY_TOKEN ?? '').trim(),
    publicBaseUrl: base,
    redirectUri: base ? `${base}/api/channels/facebook-page/callback` : '',
    webhookUrl: base ? `${base}/api/webhooks/facebook` : '',
  };
}

/** Graph API failure. Carries codes only: never the token, never the response body. */
export class GraphError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: number,
    public readonly subcode?: number,
  ) {
    super(`Graph API error (HTTP ${status}${code != null ? `, code ${code}` : ''}${subcode != null ? `/${subcode}` : ''})`);
  }
}

interface GraphRequest {
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Record<string, string | undefined>;
  body?: unknown;
  /** Access token (user or page). appsecret_proof is added automatically. */
  token?: string;
}

/** HMAC-SHA256 of the access token with the app secret (Graph `appsecret_proof`). */
export function appSecretProof(token: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(token).digest('hex');
}

export async function graph<T>(path: string, req: GraphRequest = {}): Promise<T> {
  const url = path.startsWith('https://') ? new URL(path) : new URL(`${GRAPH_HOST}/${graphVersion()}/${path.replace(/^\//, '')}`);
  // Absolute URLs are only Graph paging links; never send a token anywhere else.
  if (url.origin !== GRAPH_HOST) throw new GraphError(0);
  for (const [k, v] of Object.entries(req.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);
  if (req.token) {
    url.searchParams.set('access_token', req.token);
    const secret = fbConfig().appSecret;
    if (secret) url.searchParams.set('appsecret_proof', appSecretProof(req.token, secret));
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method ?? 'GET',
      headers: req.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Network errors may embed the URL (with the token): never propagate them.
    throw new GraphError(0);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  const err = (data as { error?: { code?: number; error_subcode?: number } } | null)?.error;
  if (!res.ok || err) throw new GraphError(res.status, err?.code, err?.error_subcode);
  return data as T;
}
