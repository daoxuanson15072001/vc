import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { channelAccountUid, channelOfUid, sourceIdOfUid } from '@vclinks/shared';
import { randomBytes } from 'node:crypto';
import { AccountsService } from '../../accounts/accounts.service';
import { DEFAULT_TENANT, currentTenant, runAsTenant } from '../../db/tenant-context';
import { DbService } from '../../db/db.service';
import { CredentialsService } from '../credentials.service';
import { GraphError, fbConfig, graph, graphVersion } from './graph';

/** Non-secret state of each connected Page (tokens live only in CredentialsService). */
export const FB_PAGES = 'fb_pages';
/** OAuth `state` values of in-flight connects (TTL). */
export const FB_OAUTH_STATES = 'fb_oauth_states';

const STATE_TTL_MS = 10 * 60_000;

/** Permissions requested at Facebook Login (docs/04-ky-thuat/kenh/facebook-page.md). */
export const FB_SCOPES = ['pages_show_list', 'pages_messaging', 'pages_manage_metadata', 'pages_read_engagement'];
/** Webhook fields the app subscribes each Page to. */
export const FB_SUBSCRIBED_FIELDS = ['messages', 'message_echoes', 'messaging_postbacks'];

export interface FbPageDoc {
  _id: string; // account uid fbp_<pageId>
  pageId: string;
  name: string;
  status: 'connected' | 'disconnected';
  subscribed: boolean;
  connectedAt: Date;
  connectedBy: string;
  disconnectedAt?: Date;
  lastWebhookAt?: Date;
  /** Set when Graph rejects the page token (code 190): the Page must be reconnected. */
  tokenInvalidAt?: Date;
  /** Short, fixed reason of the last failure (no token, no message text). */
  lastError?: string;
}

interface StateDoc {
  _id: string;
  actor: string;
  /** Tenant that started the connect (states are global; the public callback switches to it). */
  tenant_id?: string;
  createdAt: Date;
  expiresAt: Date;
}

interface PageCredentials {
  pageAccessToken: string;
}

/** Row of GET /channels/facebook-page. No secrets. */
export interface FbPageStatus {
  uid: string;
  pageId: string;
  name: string;
  status: FbPageDoc['status'];
  subscribed: boolean;
  hasCredentials: boolean;
  connectedAt: string;
  connectedBy: string;
  lastWebhookAt: string | null;
  tokenInvalidAt: string | null;
  lastError: string | null;
}

export interface FbChannelStatus {
  graphVersion: string;
  configured: { appId: boolean; appSecret: boolean; verifyToken: boolean; publicBaseUrl: boolean; credentialsKey: boolean };
  webhookUrl: string | null;
  callbackUrl: string | null;
  subscribedFields: string[];
  scopes: string[];
  pages: FbPageStatus[];
}

const iso = (d?: Date) => (d ? d.toISOString() : null);

/** Result code carried on the redirect back to the Dashboard (`/channels?fb_page=...`). */
export type ConnectOutcome = { ok: true; connected: number; failed: number } | { ok: false; reason: string };

/**
 * Facebook Page connection: Facebook Login → page tokens → subscribe webhooks.
 *
 * Page selection happens in Meta's own Login dialog ("choose the Pages you
 * want to allow"), so every Page returned by /me/accounts was explicitly
 * picked by the user and is connected. The long-lived user token is used once
 * and never stored; only the (non-expiring) page tokens are kept, encrypted.
 */
@Injectable()
export class FacebookPageService implements OnModuleInit {
  private readonly logger = new Logger(FacebookPageService.name);

  constructor(
    private readonly db: DbService,
    private readonly accounts: AccountsService,
    private readonly credentials: CredentialsService,
  ) {}

  async onModuleInit() {
    await Promise.all([
      this.states.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.pages.createIndex({ pageId: 1 }),
    ]);
  }

  get pages() {
    return this.db.col<FbPageDoc>(FB_PAGES);
  }

  private get states() {
    return this.db.col<StateDoc>(FB_OAUTH_STATES);
  }

  private missingConfig(): string[] {
    const c = fbConfig();
    const missing: string[] = [];
    if (!c.appId) missing.push('FB_APP_ID');
    if (!c.appSecret) missing.push('FB_APP_SECRET');
    if (!c.publicBaseUrl) missing.push('PUBLIC_BASE_URL');
    if (!this.credentials.available) missing.push('CREDENTIALS_KEY');
    return missing;
  }

  /** Facebook Login dialog URL for the Dashboard to open. */
  async connectUrl(actor: string): Promise<{ url: string }> {
    const missing = this.missingConfig();
    if (missing.length) throw new ServiceUnavailableException(`Chưa cấu hình ${missing.join(', ')} trên máy chủ`);
    const c = fbConfig();
    const state = randomBytes(24).toString('base64url');
    const now = new Date();
    await this.states.insertOne({ _id: state, actor, tenant_id: currentTenant(), createdAt: now, expiresAt: new Date(now.getTime() + STATE_TTL_MS) });
    const url = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
    url.searchParams.set('client_id', c.appId);
    url.searchParams.set('redirect_uri', c.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', FB_SCOPES.join(','));
    return { url: url.toString() };
  }

  /** Dashboard URL the OAuth callback redirects to. */
  dashboardRedirect(outcome: ConnectOutcome): string {
    const q = outcome.ok
      ? `fb_page=ok&connected=${outcome.connected}&failed=${outcome.failed}`
      : `fb_page=error&reason=${encodeURIComponent(outcome.reason)}`;
    return `${fbConfig().publicBaseUrl}/channels?${q}`;
  }

  /** OAuth callback: validates state, exchanges the code and connects every granted Page. */
  async handleCallback(q: { code?: string; state?: string; error?: string }): Promise<ConnectOutcome> {
    // State is single-use: consumed even when the user cancelled.
    const st = q.state ? await this.states.findOneAndDelete({ _id: q.state }) : null;
    if (!st || st.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'state' };
    return runAsTenant(st.tenant_id ?? DEFAULT_TENANT, () => this.completeCallback(q, st));
  }

  private async completeCallback(q: { code?: string; error?: string }, st: StateDoc): Promise<ConnectOutcome> {
    if (q.error || !q.code) return { ok: false, reason: 'denied' };
    if (this.missingConfig().length) return { ok: false, reason: 'config' };
    const c = fbConfig();

    let pages: { id: string; name?: string; access_token?: string }[];
    try {
      const short = await graph<{ access_token: string }>('oauth/access_token', {
        query: { client_id: c.appId, client_secret: c.appSecret, redirect_uri: c.redirectUri, code: q.code },
      });
      const long = await graph<{ access_token: string }>('oauth/access_token', {
        query: {
          grant_type: 'fb_exchange_token',
          client_id: c.appId,
          client_secret: c.appSecret,
          fb_exchange_token: short.access_token,
        },
      });
      pages = await this.listPages(long.access_token);
    } catch (e) {
      this.logger.warn(`Facebook Login exchange failed: ${e instanceof GraphError ? e.message : 'unexpected error'}`);
      await this.db.audit(st.actor, 'fb_page.connect_failed', 'facebook', { step: 'exchange' });
      return { ok: false, reason: 'exchange' };
    }
    if (!pages.length) return { ok: false, reason: 'no_pages' };

    let connected = 0;
    let failed = 0;
    for (const p of pages) {
      if (!p.id || !p.access_token) {
        failed++;
        continue;
      }
      (await this.connectPage(p.id, p.name ?? p.id, p.access_token, st.actor)) ? connected++ : failed++;
    }
    return { ok: true, connected, failed };
  }

  /** Pages granted to the app (/me/accounts, all result pages). */
  private async listPages(userToken: string) {
    const out: { id: string; name?: string; access_token?: string }[] = [];
    type Resp = { data?: { id: string; name?: string; access_token?: string }[]; paging?: { next?: string } };
    let next: string | undefined = 'me/accounts';
    for (let i = 0; next && i < 20; i++) {
      const r: Resp = await graph<Resp>(next, {
        token: userToken,
        query: next === 'me/accounts' ? { fields: 'id,name,access_token', limit: '100' } : undefined,
      });
      out.push(...(r.data ?? []));
      next = r.paging?.next;
    }
    return out;
  }

  /** Registers the account, stores the token and subscribes the app. Returns false if subscribing failed. */
  private async connectPage(pageId: string, name: string, pageToken: string, actor: string): Promise<boolean> {
    const uid = channelAccountUid('fb_page', pageId);
    await this.accounts.register({ uid, label: name, channel: 'fb_page' }, actor, true);
    await this.credentials.put<PageCredentials>(uid, { pageAccessToken: pageToken });

    let subscribed = false;
    let lastError: string | undefined;
    try {
      await graph(`${pageId}/subscribed_apps`, {
        method: 'POST',
        token: pageToken,
        query: { subscribed_fields: FB_SUBSCRIBED_FIELDS.join(',') },
      });
      subscribed = true;
    } catch (e) {
      lastError = 'Không đăng ký được webhook cho Fanpage (kiểm tra quyền pages_manage_metadata)';
      this.logger.warn(`[${uid}] subscribed_apps failed: ${e instanceof GraphError ? e.message : 'unexpected error'}`);
    }
    const now = new Date();
    await this.pages.updateOne(
      { _id: uid },
      {
        $set: { pageId, name, status: 'connected', subscribed, connectedAt: now, connectedBy: actor, ...(lastError ? { lastError } : {}) },
        $unset: { disconnectedAt: '', tokenInvalidAt: '', ...(lastError ? {} : { lastError: '' }) },
      },
      { upsert: true },
    );
    await this.db.audit(actor, 'fb_page.connect', uid, { name, subscribed });
    return subscribed;
  }

  async status(): Promise<FbChannelStatus> {
    const c = fbConfig();
    const [docs, creds] = await Promise.all([
      this.pages.find({}).sort({ connectedAt: 1 }).toArray(),
      this.credentials.available ? this.credentials.list('fb_page') : Promise.resolve([]),
    ]);
    const withCreds = new Set(creds.map((x) => x.uid));
    return {
      graphVersion: graphVersion(),
      configured: {
        appId: !!c.appId,
        appSecret: !!c.appSecret,
        verifyToken: !!c.verifyToken,
        publicBaseUrl: !!c.publicBaseUrl,
        credentialsKey: this.credentials.available,
      },
      webhookUrl: c.webhookUrl || null,
      callbackUrl: c.redirectUri || null,
      subscribedFields: FB_SUBSCRIBED_FIELDS,
      scopes: FB_SCOPES,
      pages: docs.map((d) => ({
        uid: d._id,
        pageId: d.pageId,
        name: d.name,
        status: d.status,
        subscribed: d.subscribed,
        hasCredentials: withCreds.has(d._id),
        connectedAt: d.connectedAt.toISOString(),
        connectedBy: d.connectedBy,
        lastWebhookAt: iso(d.lastWebhookAt),
        tokenInvalidAt: iso(d.tokenInvalidAt),
        lastError: d.lastError ?? null,
      })),
    };
  }

  /** Unsubscribes the app from the Page and deletes its token. Account and history are kept. */
  async disconnect(uid: string, actor: string) {
    if (channelOfUid(uid) !== 'fb_page') throw new BadRequestException(`${uid} không phải tài khoản Fanpage`);
    const doc = await this.pages.findOne({ _id: uid });
    if (!doc) throw new NotFoundException(`Không tìm thấy Fanpage ${uid}`);
    const token = await this.pageToken(uid);
    let unsubscribed = false;
    if (token) {
      try {
        await graph(`${sourceIdOfUid(uid)}/subscribed_apps`, { method: 'DELETE', token });
        unsubscribed = true;
      } catch (e) {
        // Best effort: a revoked token cannot unsubscribe, but the Page is already cut off then.
        this.logger.warn(`[${uid}] unsubscribe failed: ${e instanceof GraphError ? e.message : 'unexpected error'}`);
      }
    }
    await this.credentials.delete(uid);
    await this.pages.updateOne({ _id: uid }, { $set: { status: 'disconnected', subscribed: false, disconnectedAt: new Date() } });
    await this.db.audit(actor, 'fb_page.disconnect', uid, { unsubscribed });
    return { ok: true, unsubscribed };
  }

  /** Page access token, or null when not connected. Never leaves the server. */
  async pageToken(uid: string): Promise<string | null> {
    if (!this.credentials.available) return null;
    return (await this.credentials.get<PageCredentials>(uid))?.pageAccessToken ?? null;
  }

  async isConnected(uid: string): Promise<boolean> {
    return (await this.pages.countDocuments({ _id: uid, status: 'connected' }, { limit: 1 })) > 0;
  }

  async markWebhook(uid: string) {
    await this.pages.updateOne({ _id: uid }, { $set: { lastWebhookAt: new Date() } });
  }

  async markTokenInvalid(uid: string) {
    await this.pages.updateOne(
      { _id: uid },
      { $set: { tokenInvalidAt: new Date(), lastError: 'Token Fanpage hết hạn hoặc bị thu hồi, cần kết nối lại' } },
    );
  }
}
