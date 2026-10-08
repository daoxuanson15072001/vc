/** Collections and non-secret documents of the Zalo OA channel. Tokens live only in CredentialsService. */

/** One doc per connected OA, `_id` = account uid `zoa_<oaId>`. */
export const ZOA_ACCOUNTS = 'zalo_oa_accounts';
/** OAuth `state` + PKCE code_verifier of in-flight connects (TTL, single use). */
export const ZOA_OAUTH_STATES = 'zalo_oa_oauth_states';
/** Last follower-profile fetch per `${uid}:${userId}` (at most once a day). */
export const ZOA_PROFILE_FETCHES = 'zalo_oa_profile_fetches';

export interface ZaloOaAccountDoc {
  _id: string;
  oaId: string;
  name: string;
  avatar?: string;
  status: 'connected' | 'disconnected';
  connectedAt: Date;
  connectedBy: string;
  disconnectedAt?: Date;
  /** Access-token expiry (mirrors channel_credentials.expiresAt). */
  accessExpiresAt?: Date;
  /** Refresh tokens live 3 months from issuance; each refresh issues a new one. */
  refreshExpiresAt?: Date;
  lastRefreshAt?: Date;
  /** Set when the refresh token is rejected: an admin must reconnect the OA. */
  needsReconnect?: boolean;
  /** Short, fixed reason (never a token or message text). */
  lastError?: string;
  lastWebhookAt?: Date;
  /** Cross-process refresh lease (a refresh token must never be used twice). */
  refreshLockUntil?: Date;
  refreshLockId?: string;
}

export interface OAuthStateDoc {
  _id: string;
  codeVerifier: string;
  codeChallenge: string;
  actor: string;
  /** Tenant that started the connect (states are global; the public callback switches to it). */
  tenant_id?: string;
  createdAt: Date;
  expiresAt: Date;
}

/** Secret stored encrypted per OA uid. */
export interface ZaloOaSecret {
  accessToken: string;
  refreshToken: string;
}

/** Row of GET /channels/zalo-oa. No secrets. */
export interface ZaloOaStatus {
  uid: string;
  oaId: string;
  name: string;
  avatar: string | null;
  status: ZaloOaAccountDoc['status'];
  hasCredentials: boolean;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  lastRefreshAt: string | null;
  needsReconnect: boolean;
  lastError: string | null;
  lastWebhookAt: string | null;
  connectedAt: string;
  connectedBy: string;
}

export interface ZaloOaChannelStatus {
  configured: { appId: boolean; secretKey: boolean; publicBaseUrl: boolean; credentialsKey: boolean; webhookSecret: boolean };
  callbackUrl: string | null;
  webhookUrl: string | null;
  events: string[];
  accounts: ZaloOaStatus[];
}

export const iso = (d?: Date | null) => (d ? d.toISOString() : null);
