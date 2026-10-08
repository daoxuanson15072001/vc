import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { runsBackgroundJobs } from '../../db/role';
import { runAsTenant } from '../../db/tenant-context';
import { DbService } from '../../db/db.service';
import { CredentialsService } from '../credentials.service';
import { ZaloApiError, refreshTokens, zaloOaConfig, type OaTokens } from './zalo-api';
import { ZOA_ACCOUNTS, type ZaloOaAccountDoc, type ZaloOaSecret } from './zalo-oa.store';

/** Proactive sweep period and horizon: refresh tokens expiring within 2h, every 30 min. */
const SWEEP_MS = 30 * 60_000;
const REFRESH_AHEAD_MS = 2 * 3600_000;
/** An access token this close to expiry is refreshed before use. */
const USE_MARGIN_MS = 5 * 60_000;
/** Refresh tokens are valid 3 months from issuance. */
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 3600_000;
/** Cross-process refresh lease; a refresh call takes well under this. */
const LOCK_MS = 60_000;
const LOCK_WAIT_MS = 20_000;

/** The OA must be reconnected by an admin (refresh token rejected, or no credentials). */
export class ZaloOaReconnectError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Zalo OA access-token lifecycle.
 *
 * Refresh tokens are single-use: using one twice fails and loses the OA
 * connection. Every refresh therefore runs (1) behind an in-process promise per
 * OA, so concurrent callers share one refresh, and (2) under a Mongo lease on
 * the OA doc, so a second API process never refreshes at the same time. Inside
 * the lease the credentials are re-read: if another caller already rotated
 * them, their token is returned without calling Zalo. The new pair is written
 * in a single `CredentialsService.put` (one document update).
 */
@Injectable()
export class ZaloOaTokenService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ZaloOaTokenService.name);
  private readonly inflight = new Map<string, Promise<string>>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: DbService,
    private readonly credentials: CredentialsService,
  ) {}

  private get col() {
    return this.db.col<ZaloOaAccountDoc>(ZOA_ACCOUNTS);
  }

  /** ZALO_OA_TOKEN_REFRESH=off disables the proactive timer (tests); on-demand refresh still works. */
  onApplicationBootstrap() {
    if (process.env.ZALO_OA_TOKEN_REFRESH === 'off' || !runsBackgroundJobs()) return;
    this.timer = setInterval(() => void this.refreshAllTenants(), SWEEP_MS);
    this.timer.unref();
    const first = setTimeout(() => void this.refreshAllTenants(), 15_000);
    first.unref();
  }

  /** Credentials are tenant-scoped: refresh each tenant in its own scope. */
  private async refreshAllTenants() {
    if (!this.credentials.available) return;
    try {
      for (const tenant of await this.db.tenants()) await runAsTenant(tenant, () => this.refreshDue());
    } catch (e) {
      this.logger.warn(`Token refresh sweep failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Stores a freshly issued pair (connect or refresh). */
  async store(uid: string, t: OaTokens): Promise<Date> {
    const now = Date.now();
    const accessExpiresAt = new Date(now + t.expiresIn * 1000);
    const secret: ZaloOaSecret = { accessToken: t.accessToken, refreshToken: t.refreshToken };
    // The old refresh token is already spent: retry the write rather than lose the new one.
    let lastErr: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        await this.credentials.put(uid, secret, { expiresAt: accessExpiresAt });
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        await sleep(200 * (i + 1));
      }
    }
    if (lastErr) {
      await this.markReconnect(uid, 'Không lưu được token mới');
      throw lastErr;
    }
    await this.col.updateOne(
      { _id: uid },
      {
        $set: {
          accessExpiresAt,
          refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
          lastRefreshAt: new Date(now),
          needsReconnect: false,
        },
        $unset: { lastError: '' },
      },
    );
    return accessExpiresAt;
  }

  /** A valid access token for the OA, refreshed first when it is (nearly) expired. */
  async getAccessToken(uid: string): Promise<string> {
    const secret = await this.credentials.get<ZaloOaSecret>(uid);
    if (!secret) throw new ZaloOaReconnectError('OA chưa kết nối hoặc đã ngắt kết nối');
    const expiresAt = (await this.col.findOne({ _id: uid }, { projection: { accessExpiresAt: 1 } }))?.accessExpiresAt;
    if (expiresAt && expiresAt.getTime() - Date.now() < USE_MARGIN_MS) {
      return this.refresh(uid, secret.accessToken, { ifExpiringWithinMs: USE_MARGIN_MS });
    }
    return secret.accessToken;
  }

  /**
   * Refreshes the OA's tokens. `staleAccessToken` is the token a caller saw
   * rejected (or about to expire): if the stored token already differs, another
   * caller refreshed meanwhile and the stored one is returned without calling Zalo.
   * With `ifExpiringWithinMs`, the refresh is skipped when (re-read under the
   * lock) the token is no longer that close to expiry.
   */
  refresh(uid: string, staleAccessToken?: string, opts: { ifExpiringWithinMs?: number } = {}): Promise<string> {
    const running = this.inflight.get(uid);
    if (running) return running;
    const p = this.refreshLocked(uid, staleAccessToken, opts).finally(() => this.inflight.delete(uid));
    this.inflight.set(uid, p);
    return p;
  }

  private async refreshLocked(uid: string, staleAccessToken?: string, opts: { ifExpiringWithinMs?: number } = {}): Promise<string> {
    const lockId = randomUUID();
    let state: ZaloOaAccountDoc | null = null;
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
      const now = new Date();
      const got = await this.col.findOneAndUpdate(
        { _id: uid, $or: [{ refreshLockUntil: { $exists: false } }, { refreshLockUntil: { $lt: now } }] },
        { $set: { refreshLockUntil: new Date(now.getTime() + LOCK_MS), refreshLockId: lockId } },
        { returnDocument: 'after' },
      );
      if (got) {
        state = got;
        break;
      }
      if (!(await this.col.countDocuments({ _id: uid }, { limit: 1 }))) {
        throw new ZaloOaReconnectError('OA chưa kết nối');
      }
      if (Date.now() > deadline) throw new ZaloApiError(0, 'Token refresh lock timeout', true);
      await sleep(250);
    }

    try {
      const secret = await this.credentials.get<ZaloOaSecret>(uid);
      if (!secret) throw new ZaloOaReconnectError('OA chưa kết nối hoặc đã ngắt kết nối');
      if (staleAccessToken && secret.accessToken !== staleAccessToken) return secret.accessToken;
      const exp = state?.accessExpiresAt?.getTime();
      if (opts.ifExpiringWithinMs != null && exp && exp - Date.now() > opts.ifExpiringWithinMs) return secret.accessToken;

      let tokens: OaTokens;
      try {
        tokens = await refreshTokens(zaloOaConfig(), secret.refreshToken);
      } catch (e) {
        if (e instanceof ZaloApiError && !e.transient) {
          // Refresh token rejected (expired, revoked, already used): only a reconnect helps.
          await this.markReconnect(uid, `Làm mới token thất bại (mã ${e.code})`);
          await this.db.audit('system', 'zalo_oa.token_refresh', uid, { ok: false, code: e.code });
          throw new ZaloOaReconnectError('OA cần kết nối lại: refresh token bị từ chối');
        }
        await this.col.updateOne({ _id: uid }, { $set: { lastError: 'Không kết nối được Zalo khi làm mới token' } });
        throw e;
      }
      await this.store(uid, tokens);
      await this.db.audit('system', 'zalo_oa.token_refresh', uid, { ok: true });
      return tokens.accessToken;
    } finally {
      await this.col.updateOne({ _id: uid, refreshLockId: lockId }, { $unset: { refreshLockUntil: '', refreshLockId: '' } });
    }
  }

  async markReconnect(uid: string, reason: string) {
    await this.col.updateOne({ _id: uid }, { $set: { needsReconnect: true, lastError: reason } });
    this.logger.warn(`[${uid}] needs reconnect: ${reason}`);
  }

  /** Refreshes every connected OA whose access token expires within the horizon. */
  async refreshDue(horizonMs = REFRESH_AHEAD_MS): Promise<{ refreshed: number; failed: number }> {
    let refreshed = 0;
    let failed = 0;
    if (!this.credentials.available) return { refreshed, failed };
    try {
      const limit = Date.now() + horizonMs;
      const due = (await this.credentials.list('zalo_oa')).filter((c) => !c.expiresAt || c.expiresAt.getTime() < limit);
      if (!due.length) return { refreshed, failed };
      const skip = new Set(
        (await this.col.find({ _id: { $in: due.map((d) => d.uid) }, needsReconnect: true }, { projection: { _id: 1 } }).toArray()).map(
          (d) => d._id,
        ),
      );
      for (const c of due) {
        if (skip.has(c.uid)) continue;
        try {
          await this.refresh(c.uid, undefined, { ifExpiringWithinMs: horizonMs });
          refreshed++;
        } catch (e) {
          failed++;
          this.logger.warn(`[${c.uid}] proactive refresh failed: ${e instanceof Error ? e.message : 'error'}`);
        }
      }
    } catch (e) {
      this.logger.warn(`Refresh sweep failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    return { refreshed, failed };
  }
}
