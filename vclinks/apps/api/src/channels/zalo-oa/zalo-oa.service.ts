import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, ServiceUnavailableException } from '@nestjs/common';
import { channelAccountUid, channelOfUid } from '@vclinks/shared';
import { createHash, randomBytes } from 'node:crypto';
import { AccountsService } from '../../accounts/accounts.service';
import { DEFAULT_TENANT, currentTenant, runAsTenant } from '../../db/tenant-context';
import { DbService } from '../../db/db.service';
import { CredentialsService } from '../credentials.service';
import { ZaloApiError, exchangeCode, getOaInfo, permissionUrl, zaloOaConfig } from './zalo-api';
import { WEBHOOK_EVENTS, mediaUrl } from './zalo-webhook.mapper';
import {
  ZOA_ACCOUNTS,
  ZOA_OAUTH_STATES,
  ZOA_PROFILE_FETCHES,
  iso,
  type OAuthStateDoc,
  type ZaloOaAccountDoc,
  type ZaloOaChannelStatus,
} from './zalo-oa.store';
import { ZaloOaTokenService } from './zalo-oa.tokens';

/** Authorization codes live 10 minutes at Zalo; the state is kept for as long. */
const STATE_TTL_MS = 10 * 60_000;

export const CALLBACK_PATH = '/api/channels/zalo-oa/callback';
export const WEBHOOK_PATH = '/api/webhooks/zalo-oa';

/** Result carried on the redirect back to the Dashboard (`/channels?zalo_oa=...`). */
export type ConnectOutcome = { ok: true; uid: string } | { ok: false; reason: string };

/** PKCE (RFC 7636, S256): 43-char alphanumeric verifier, base64url(sha256) challenge, as in the official Zalo SDK. */
export function pkcePair(): { verifier: string; challenge: string } {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(43);
  let verifier = '';
  for (const b of bytes) verifier += alphabet[b % alphabet.length];
  const challenge = createHash('sha256').update(verifier, 'ascii').digest('base64url');
  return { verifier, challenge };
}

/**
 * Zalo OA connection: OAuth v4 (PKCE) → tokens in CredentialsService → account
 * `zoa_<oaId>`. Status and disconnect for the Dashboard. No endpoint ever
 * returns a token.
 */
@Injectable()
export class ZaloOaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ZaloOaService.name);

  constructor(
    private readonly db: DbService,
    private readonly accounts: AccountsService,
    private readonly credentials: CredentialsService,
    private readonly tokens: ZaloOaTokenService,
  ) {}

  private get col() {
    return this.db.col<ZaloOaAccountDoc>(ZOA_ACCOUNTS);
  }

  async onApplicationBootstrap() {
    try {
      await Promise.all([
        this.db.col(ZOA_OAUTH_STATES).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        this.db.col(ZOA_PROFILE_FETCHES).createIndex({ at: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }),
      ]);
    } catch (e) {
      this.logger.warn(`Index creation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private urls() {
    const base = zaloOaConfig().publicBaseUrl;
    return { callbackUrl: base ? base + CALLBACK_PATH : null, webhookUrl: base ? base + WEBHOOK_PATH : null };
  }

  async status(): Promise<ZaloOaChannelStatus> {
    const cfg = zaloOaConfig();
    const docs = await this.col.find({}).sort({ connectedAt: 1 }).toArray();
    const creds = this.credentials.available ? await this.credentials.list('zalo_oa') : [];
    const byUid = new Map(creds.map((c) => [c.uid, c]));
    return {
      configured: {
        appId: !!cfg.appId,
        secretKey: !!cfg.secretKey,
        publicBaseUrl: !!cfg.publicBaseUrl,
        credentialsKey: this.credentials.available,
        webhookSecret: !!cfg.webhookSecret,
      },
      ...this.urls(),
      events: WEBHOOK_EVENTS,
      accounts: docs.map((d) => ({
        uid: d._id,
        oaId: d.oaId,
        name: d.name,
        avatar: d.avatar ?? null,
        status: d.status,
        hasCredentials: byUid.has(d._id),
        accessExpiresAt: iso(byUid.get(d._id)?.expiresAt ?? d.accessExpiresAt),
        refreshExpiresAt: iso(d.refreshExpiresAt),
        lastRefreshAt: iso(d.lastRefreshAt),
        needsReconnect: !!d.needsReconnect,
        lastError: d.lastError ?? null,
        lastWebhookAt: iso(d.lastWebhookAt),
        connectedAt: d.connectedAt.toISOString(),
        connectedBy: d.connectedBy,
      })),
    };
  }

  /** OA permission URL for the Dashboard to navigate to. */
  async connectUrl(actor: string): Promise<{ url: string }> {
    const cfg = zaloOaConfig();
    const missing = [
      !cfg.appId && 'ZALO_OA_APP_ID',
      !cfg.secretKey && 'ZALO_OA_SECRET_KEY',
      !cfg.publicBaseUrl && 'PUBLIC_BASE_URL',
      !this.credentials.available && 'CREDENTIALS_KEY',
    ].filter(Boolean);
    if (missing.length) throw new ServiceUnavailableException(`Chưa cấu hình: ${missing.join(', ')}`);

    const state = randomBytes(24).toString('base64url');
    const { verifier, challenge } = pkcePair();
    const now = new Date();
    await this.db.col<OAuthStateDoc>(ZOA_OAUTH_STATES).insertOne({
      _id: state,
      codeVerifier: verifier,
      codeChallenge: challenge,
      actor,
      tenant_id: currentTenant(),
      createdAt: now,
      expiresAt: new Date(now.getTime() + STATE_TTL_MS),
    });
    return { url: permissionUrl(cfg, cfg.publicBaseUrl + CALLBACK_PATH, challenge, state) };
  }

  /** Handles the OAuth redirect. Never throws: the outcome goes back to the Dashboard. */
  async handleCallback(q: { code?: string; state?: string; codeChallenge?: string; oaId?: string }): Promise<ConnectOutcome> {
    // The OA docs only promise `code` and `oa_id` on the redirect; `state` (and
    // `code_challenge`) are echoed as in the user OAuth flow. Either identifies
    // the pending connect; both are unguessable.
    const key = q.state ? { _id: q.state } : q.codeChallenge ? { codeChallenge: q.codeChallenge } : null;
    if (!key) return { ok: false, reason: 'missing_state' };
    // Single use: the state is deleted as it is read.
    const st = await this.db
      .col<OAuthStateDoc>(ZOA_OAUTH_STATES)
      .findOneAndDelete({ ...key, expiresAt: { $gt: new Date() } });
    if (!st) return { ok: false, reason: 'invalid_state' };
    return runAsTenant(st.tenant_id ?? DEFAULT_TENANT, () => this.completeCallback(q, st));
  }

  private async completeCallback(q: { code?: string; oaId?: string }, st: OAuthStateDoc): Promise<ConnectOutcome> {
    if (!q.code) return { ok: false, reason: 'denied' };

    const cfg = zaloOaConfig();
    try {
      const tokens = await exchangeCode(cfg, q.code, st.codeVerifier);
      let info: { oaId: string; name: string; avatar?: string } | null = null;
      try {
        info = await getOaInfo(tokens.accessToken);
      } catch (e) {
        this.logger.warn(`getoa failed after connect: ${e instanceof ZaloApiError ? e.code : 'error'}`);
      }
      const oaId = info?.oaId ?? (q.oaId && /^\d{1,64}$/.test(q.oaId) ? q.oaId : '');
      if (!oaId) return { ok: false, reason: 'no_oa_id' };
      const uid = channelAccountUid('zalo_oa', oaId);
      const name = info?.name ?? `OA ${oaId}`;

      await this.accounts.register({ uid, label: name, channel: 'zalo_oa' }, st.actor, true);
      const now = new Date();
      await this.col.updateOne(
        { _id: uid },
        {
          $set: {
            oaId,
            name,
            ...(info?.avatar && mediaUrl(info.avatar) ? { avatar: mediaUrl(info.avatar) } : {}),
            status: 'connected',
            connectedAt: now,
            connectedBy: st.actor,
            needsReconnect: false,
          },
          $unset: { disconnectedAt: '', lastError: '' },
        },
        { upsert: true },
      );
      await this.tokens.store(uid, tokens);
      await this.db.audit(st.actor, 'zalo_oa.connect', uid, { oaId });
      return { ok: true, uid };
    } catch (e) {
      const code = e instanceof ZaloApiError ? e.code : 0;
      this.logger.warn(`OA connect failed (code ${code})`);
      await this.db.audit(st.actor, 'zalo_oa.connect_failed', 'zalo_oa', { code });
      return { ok: false, reason: e instanceof ZaloApiError && !e.transient ? 'token_exchange' : 'network' };
    }
  }

  dashboardRedirect(outcome: ConnectOutcome): string {
    const base = zaloOaConfig().publicBaseUrl;
    const q = outcome.ok ? `zalo_oa=connected&uid=${encodeURIComponent(outcome.uid)}` : `zalo_oa=error&reason=${outcome.reason}`;
    return `${base}/channels?${q}`;
  }

  /** Deletes the OA's tokens; account, contacts and messages are kept. */
  async disconnect(uid: string, actor: string) {
    if (channelOfUid(uid) !== 'zalo_oa') throw new NotFoundException(`Không phải tài khoản Zalo OA: ${uid}`);
    const r = await this.col.updateOne(
      { _id: uid },
      { $set: { status: 'disconnected', disconnectedAt: new Date(), needsReconnect: false }, $unset: { accessExpiresAt: '', lastError: '' } },
    );
    if (!r.matchedCount) throw new NotFoundException(`Không tìm thấy OA ${uid}`);
    await this.credentials.delete(uid);
    await this.db.audit(actor, 'zalo_oa.disconnect', uid);
    return { ok: true };
  }
}
