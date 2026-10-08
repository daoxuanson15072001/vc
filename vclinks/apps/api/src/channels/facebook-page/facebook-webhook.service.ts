import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MAX_BATCH_SIZE, channelAccountUid, docId } from '@vclinks/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { runAsTenant } from '../../db/tenant-context';
import { DbService } from '../../db/db.service';
import { IngestService } from '../../ingest/ingest.service';
import { FacebookPageService } from './facebook-page.service';
import { GraphError, graph } from './graph';
import { mapMessagingEvent, type FbWebhookBody } from './webhook-mapper';

/** Last profile fetch per (page, PSID), to refresh at most once a day. */
export const FB_PROFILE_FETCHES = 'fb_profile_fetches';
const PROFILE_REFRESH_MS = 24 * 3600_000;

interface ProfileFetchDoc {
  _id: string;
  at: Date;
}

interface FbProfile {
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
}

/** Timing-safe check of `X-Hub-Signature-256: sha256=<hex>` over the raw body. */
export function verifySignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string): boolean {
  if (!rawBody || !header || !appSecret || !header.startsWith('sha256=')) return false;
  const given = Buffer.from(header.slice(7), 'hex');
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Timing-safe string comparison (webhook verify token). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Turns Messenger webhook deliveries into ingested messages and contacts.
 * Messages are ingested before the 200 is returned (local Mongo, fast; a
 * failure makes Meta retry, and re-delivery is idempotent by mid). Profile
 * lookups hit Graph and run in the background.
 */
@Injectable()
export class FacebookWebhookService implements OnModuleInit {
  private readonly logger = new Logger(FacebookWebhookService.name);
  private readonly background = new Set<Promise<void>>();

  constructor(
    private readonly db: DbService,
    private readonly ingestService: IngestService,
    private readonly pages: FacebookPageService,
  ) {}

  async onModuleInit() {
    // Old entries are only needed for the once-a-day rule.
    await this.fetches.createIndex({ at: 1 }, { expireAfterSeconds: 2 * 24 * 3600 });
  }

  private get fetches() {
    return this.db.col<ProfileFetchDoc>(FB_PROFILE_FETCHES);
  }

  /** Resolves when background profile refreshes are done (tests, shutdown). */
  async drain() {
    while (this.background.size) await Promise.allSettled([...this.background]);
  }

  async handle(body: FbWebhookBody): Promise<{ ingested: number; skipped: number }> {
    if (body?.object !== 'page' || !Array.isArray(body.entry)) return { ingested: 0, skipped: 0 };

    const byPage = new Map<string, { items: Record<string, unknown>[]; customers: Set<string> }>();
    let skipped = 0;
    for (const entry of body.entry) {
      const pageId = entry?.id;
      if (!pageId || !Array.isArray(entry.messaging)) continue;
      for (const ev of entry.messaging) {
        const m = mapMessagingEvent(String(pageId), ev);
        if (!m) continue;
        const bucket = byPage.get(String(pageId)) ?? { items: [], customers: new Set<string>() };
        bucket.items.push(m.item);
        bucket.customers.add(m.customerId);
        byPage.set(String(pageId), bucket);
      }
    }

    let ingested = 0;
    for (const [pageId, { items, customers }] of byPage) {
      const uid = channelAccountUid('fb_page', pageId);
      // Public route: the Page's account decides the tenant of everything below.
      await runAsTenant(await this.db.tenantOfAccount(uid), async () => {
        if (!(await this.pages.isConnected(uid))) {
          // Delivery for a Page we do not (or no longer) serve.
          skipped += items.length;
          return;
        }
        for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
          const r = await this.ingestService.ingest('messages', uid, items.slice(i, i + MAX_BATCH_SIZE));
          ingested += r.accepted + r.updated + r.unchanged;
          if (r.rejected.length) this.logger.warn(`[${uid}] webhook: ${r.rejected.length} message(s) rejected`);
        }
        await this.pages.markWebhook(uid);
        this.track(this.refreshProfiles(uid, [...customers]));
      });
    }
    return { ingested, skipped };
  }

  private track(p: Promise<void>) {
    const t = p
      .catch((e) => this.logger.warn(`Profile refresh failed: ${e instanceof Error ? e.message : 'unexpected error'}`))
      .finally(() => this.background.delete(t));
    this.background.add(t);
  }

  /** Atomically claims the daily refresh slot of a PSID. False if refreshed less than a day ago. */
  private async claimRefresh(uid: string, psid: string): Promise<boolean> {
    const now = new Date();
    try {
      await this.fetches.updateOne(
        { _id: docId(uid, psid), at: { $lt: new Date(now.getTime() - PROFILE_REFRESH_MS) } },
        { $set: { at: now } },
        { upsert: true },
      );
      return true;
    } catch (e) {
      // Duplicate key: the doc exists and is recent.
      if ((e as { code?: number }).code === 11000) return false;
      throw e;
    }
  }

  private async refreshProfiles(uid: string, psids: string[]) {
    const claimed: string[] = [];
    for (const psid of psids) if (await this.claimRefresh(uid, psid)) claimed.push(psid);
    if (!claimed.length) return;
    const token = await this.pages.pageToken(uid);
    if (!token) return;

    const contacts: Record<string, unknown>[] = [];
    for (const psid of claimed) {
      try {
        const p = await graph<FbProfile>(psid, { token, query: { fields: 'name,first_name,last_name,profile_pic' } });
        const name = p.name ?? ([p.first_name, p.last_name].filter(Boolean).join(' ') || undefined);
        contacts.push({ userId: psid, displayName: name, avatar: p.profile_pic, isFriend: false, isOA: false });
      } catch (e) {
        if (e instanceof GraphError && e.code === 190) {
          await this.pages.markTokenInvalid(uid);
          return;
        }
        // e.g. 2018218 "No profile available": keep a bare contact so the thread still has one.
        contacts.push({ userId: psid, isFriend: false, isOA: false });
      }
    }
    // Drop undefined so an empty lookup never clears a known name.
    const clean = contacts.map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)));
    await this.ingestService.ingest('contacts', uid, clean);
  }
}
