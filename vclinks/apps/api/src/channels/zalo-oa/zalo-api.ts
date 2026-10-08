/**
 * Thin client for the Zalo OA Open API (plain fetch, no SDK).
 *
 * Endpoints verified against developers.zalo.me (28/09/2026):
 * - OAuth v4 for OA: POST https://oauth.zaloapp.com/v4/oa/access_token
 *   (header `secret_key`, form body; access token 25h, refresh token single-use, 3 months)
 * - Customer-service message: POST https://openapi.zalo.me/v3.0/oa/message/cs
 * - User detail: GET https://openapi.zalo.me/v3.0/oa/user/detail?data={"user_id":...}
 * - OA info: GET https://openapi.zalo.me/v2.0/oa/getoa
 * Tokens are passed in headers only, never in URLs, and never logged.
 */

export const ZALO_OAUTH_BASE = 'https://oauth.zaloapp.com/v4/oa';
export const ZALO_OPENAPI_BASE = 'https://openapi.zalo.me';

const TIMEOUT_MS = 15_000;

export interface ZaloOaConfig {
  appId: string;
  /** App secret key (developers.zalo.me > app > Settings): OAuth header `secret_key`. */
  secretKey: string;
  /** Key of the webhook `X-ZEvent-Signature` mac ("OA Secret Key" of the app's webhook settings). */
  webhookSecret: string;
  publicBaseUrl: string;
}

/** Read on every call so tests (and a restart-free env change) see current values. */
export function zaloOaConfig(): ZaloOaConfig {
  const secretKey = process.env.ZALO_OA_SECRET_KEY ?? '';
  return {
    appId: process.env.ZALO_OA_APP_ID ?? '',
    secretKey,
    // Zalo labels the mac key "OAsecretKey"; for most apps it is the app secret key.
    // ZALO_OA_WEBHOOK_SECRET overrides it when the console shows a separate key.
    webhookSecret: process.env.ZALO_OA_WEBHOOK_SECRET || secretKey,
    publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, ''),
  };
}

/** A Zalo API answer with a non-zero `error` (or an HTTP failure). Never carries tokens. */
export class ZaloApiError extends Error {
  constructor(
    /** Zalo error code (negative), or 0 when the failure is transport-level. */
    readonly code: number,
    message: string,
    /** True for network errors, timeouts and HTTP 5xx: worth retrying later. */
    readonly transient = false,
  ) {
    super(message);
  }
}

/** Error codes meaning the access token itself is bad (refresh and retry once). */
export const TOKEN_ERROR_CODES = new Set([-216, -220]);

export interface OaTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds, as returned by Zalo (`expires_in`, a numeric string). */
  expiresIn: number;
}

async function call(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const reason = e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network error';
    throw new ZaloApiError(0, `Zalo API ${reason}`, true);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON answer (gateway error page).
  }
  if (!res.ok && (res.status >= 500 || res.status === 429)) {
    throw new ZaloApiError(0, `Zalo API HTTP ${res.status}`, true);
  }
  if (!body || typeof body !== 'object') throw new ZaloApiError(0, `Zalo API HTTP ${res.status}: invalid body`, !res.ok);
  return body as Record<string, unknown>;
}

/** Throws ZaloApiError when a v2/v3 OA API answer has `error != 0`. */
function checkOpenApi(body: Record<string, unknown>): Record<string, unknown> {
  const code = Number(body.error ?? 0);
  if (code !== 0) {
    const msg = typeof body.message === 'string' ? body.message.slice(0, 200) : 'Zalo API error';
    throw new ZaloApiError(code, msg);
  }
  return body;
}

/** OAuth answers carry `access_token` on success, or `error`/`error_name`/`error_description`. */
function parseTokens(body: Record<string, unknown>): OaTokens {
  const accessToken = body.access_token;
  const refreshToken = body.refresh_token;
  if (typeof accessToken !== 'string' || !accessToken || typeof refreshToken !== 'string' || !refreshToken) {
    const code = Number(body.error ?? -1) || -1;
    const desc = [body.error_name, body.error_description, body.error_reason, body.message]
      .find((v) => typeof v === 'string' && v) as string | undefined;
    throw new ZaloApiError(code, (desc ?? 'OAuth error').slice(0, 200));
  }
  const expiresIn = Number(body.expires_in ?? body.expire_in ?? 90_000);
  return { accessToken, refreshToken, expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 90_000 };
}

function oauthPost(cfg: ZaloOaConfig, form: Record<string, string>) {
  return call(`${ZALO_OAUTH_BASE}/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', secret_key: cfg.secretKey },
    body: new URLSearchParams({ app_id: cfg.appId, ...form }).toString(),
  });
}

/** OA permission page the OA admin opens to grant the app access (OAuth v4 + PKCE). */
export function permissionUrl(cfg: ZaloOaConfig, redirectUri: string, codeChallenge: string, state: string): string {
  const q = new URLSearchParams({
    app_id: cfg.appId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    state,
  });
  return `${ZALO_OAUTH_BASE}/permission?${q.toString()}`;
}

export async function exchangeCode(cfg: ZaloOaConfig, code: string, codeVerifier: string): Promise<OaTokens> {
  return parseTokens(await oauthPost(cfg, { code, grant_type: 'authorization_code', code_verifier: codeVerifier }));
}

export async function refreshTokens(cfg: ZaloOaConfig, refreshToken: string): Promise<OaTokens> {
  return parseTokens(await oauthPost(cfg, { refresh_token: refreshToken, grant_type: 'refresh_token' }));
}

const authed = (accessToken: string, extra: Record<string, string> = {}) => ({ access_token: accessToken, ...extra });

export interface OaInfo {
  oaId: string;
  name: string;
  avatar?: string;
}

export async function getOaInfo(accessToken: string): Promise<OaInfo> {
  const body = checkOpenApi(await call(`${ZALO_OPENAPI_BASE}/v2.0/oa/getoa`, { headers: authed(accessToken) }));
  const d = (body.data ?? {}) as Record<string, unknown>;
  // The reference table names it `oa_id`, the example response `oaid`.
  const rawId = d.oa_id ?? d.oaid;
  const oaId = rawId != null ? String(rawId) : '';
  if (!oaId) throw new ZaloApiError(-1, 'getoa: missing oa_id');
  return { oaId, name: typeof d.name === 'string' && d.name ? d.name : `OA ${oaId}`, avatar: typeof d.avatar === 'string' ? d.avatar : undefined };
}

export interface ZaloUserProfile {
  userId: string;
  displayName?: string;
  avatar?: string;
  isFollower?: boolean;
}

export async function getUserDetail(accessToken: string, userId: string): Promise<ZaloUserProfile> {
  const q = new URLSearchParams({ data: JSON.stringify({ user_id: userId }) });
  const body = checkOpenApi(
    await call(`${ZALO_OPENAPI_BASE}/v3.0/oa/user/detail?${q.toString()}`, { headers: authed(accessToken) }),
  );
  const d = (body.data ?? {}) as Record<string, unknown>;
  const avatars = (d.avatars ?? {}) as Record<string, unknown>;
  const avatar = [avatars['240'], d.avatar, avatars['120']].find((v) => typeof v === 'string' && v) as string | undefined;
  return {
    userId: d.user_id != null ? String(d.user_id) : userId,
    displayName: typeof d.display_name === 'string' ? d.display_name : undefined,
    avatar,
    isFollower: typeof d.user_is_follower === 'boolean' ? d.user_is_follower : undefined,
  };
}

/** Sends a customer-service ("tư vấn") text message. Returns Zalo's message_id. */
export async function sendCsText(accessToken: string, userId: string, text: string): Promise<{ messageId: string; sentTime?: number }> {
  const body = checkOpenApi(
    await call(`${ZALO_OPENAPI_BASE}/v3.0/oa/message/cs`, {
      method: 'POST',
      headers: authed(accessToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ recipient: { user_id: userId }, message: { text } }),
    }),
  );
  const d = (body.data ?? {}) as Record<string, unknown>;
  const messageId = d.message_id != null ? String(d.message_id) : '';
  if (!messageId) throw new ZaloApiError(-200, 'missing message_id');
  const sentTime = Number(d.sent_time);
  return { messageId, sentTime: Number.isFinite(sentTime) && sentTime > 0 ? sentTime : undefined };
}
