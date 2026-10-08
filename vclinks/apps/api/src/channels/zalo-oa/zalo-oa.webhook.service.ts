import { Injectable, Logger } from '@nestjs/common';
import { channelAccountUid, docId } from '@vclinks/shared';
import { runAsTenant } from '../../db/tenant-context';
import { DbService } from '../../db/db.service';
import { IngestService } from '../../ingest/ingest.service';
import { ZaloApiError, getUserDetail } from './zalo-api';
import { mapEvent, mediaUrl, type ZaloOaEvent } from './zalo-webhook.mapper';
import { ZOA_ACCOUNTS, ZOA_PROFILE_FETCHES, type ZaloOaAccountDoc } from './zalo-oa.store';
import { ZaloOaTokenService } from './zalo-oa.tokens';

const PROFILE_EVERY_MS = 24 * 3600_000;
/** After a failed profile fetch, retry in about an hour rather than a day. */
const PROFILE_RETRY_MS = 3600_000;

export interface WebhookOutcome {
  ingested: number;
  ignored: boolean;
}

/**
 * Handles verified Zalo OA webhook events: message events are ingested
 * idempotently (`_id = zoa_<oaId>:<msg_id>`, so Zalo's retries change nothing);
 * the follower's profile is fetched in the background at most once a day.
 * Events of OAs not connected here are ignored.
 */
@Injectable()
export class ZaloOaWebhookService {
  private readonly logger = new Logger(ZaloOaWebhookService.name);
  private readonly background = new Set<Promise<void>>();

  constructor(
    private readonly db: DbService,
    private readonly ingest: IngestService,
    private readonly tokens: ZaloOaTokenService,
  ) {}

  async handle(ev: ZaloOaEvent): Promise<WebhookOutcome> {
    const mapped = mapEvent(ev);
    if (!mapped) return { ingested: 0, ignored: true };
    const uid = channelAccountUid('zalo_oa', mapped.oaId);
    // Public route: the OA's account decides the tenant of everything below.
    return runAsTenant(await this.db.tenantOfAccount(uid), () => this.handleFor(uid, mapped));
  }

  private async handleFor(uid: string, mapped: NonNullable<ReturnType<typeof mapEvent>>): Promise<WebhookOutcome> {
    const acc = await this.db
      .col<ZaloOaAccountDoc>(ZOA_ACCOUNTS)
      .findOneAndUpdate({ _id: uid }, { $set: { lastWebhookAt: new Date() } }, { projection: { status: 1 } });
    if (!acc) {
      this.logger.warn(`Webhook for unconnected OA ${uid} ignored`);
      return { ingested: 0, ignored: true };
    }
    const r = await this.ingest.ingest('messages', uid, [mapped.item]);
    if (r.rejected.length) this.logger.warn(`[${uid}] webhook message rejected: ${r.rejected[0].reason}`);
    if (acc.status === 'connected') this.track(this.maybeFetchProfile(uid, mapped.userId));
    return { ingested: r.accepted + r.updated + r.unchanged, ignored: false };
  }

  /** Resolves when background profile fetches started so far are done (tests, shutdown). */
  async idle(): Promise<void> {
    while (this.background.size) await Promise.allSettled([...this.background]);
  }

  private track(p: Promise<void>) {
    this.background.add(p);
    void p.finally(() => this.background.delete(p));
  }

  /** Fetches display name + avatar of a follower into contacts, at most once per day per user. */
  async maybeFetchProfile(uid: string, userId: string): Promise<void> {
    const col = this.db.col<{ _id: string; at: Date }>(ZOA_PROFILE_FETCHES);
    const _id = docId(uid, userId);
    const now = new Date();
    // Atomic claim: only one caller per day wins (a lost upsert race raises E11000).
    try {
      const r = await col.updateOne(
        { _id, $or: [{ at: { $exists: false } }, { at: { $lt: new Date(now.getTime() - PROFILE_EVERY_MS) } }] },
        { $set: { at: now } },
        { upsert: true },
      );
      if (!r.upsertedCount && !r.modifiedCount) return;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return;
      throw e;
    }
    try {
      const token = await this.tokens.getAccessToken(uid);
      let profile;
      try {
        profile = await getUserDetail(token, userId);
      } catch (e) {
        if (!(e instanceof ZaloApiError) || e.code === 0) throw e;
        if (e.code !== -216 && e.code !== -220) throw e;
        profile = await getUserDetail(await this.tokens.refresh(uid, token), userId);
      }
      const item: Record<string, unknown> = { userId };
      if (profile.displayName) item.displayName = profile.displayName;
      const avatar = mediaUrl(profile.avatar);
      if (avatar) item.avatar = avatar;
      await this.ingest.ingest('contacts', uid, [item]);
    } catch (e) {
      // Allow a retry in about an hour.
      await col.updateOne({ _id }, { $set: { at: new Date(now.getTime() - PROFILE_EVERY_MS + PROFILE_RETRY_MS) } });
      const code = e instanceof ZaloApiError ? `code ${e.code}` : e instanceof Error ? e.constructor.name : 'error';
      this.logger.warn(`[${uid}] follower profile fetch failed (${code})`);
    }
  }
}
