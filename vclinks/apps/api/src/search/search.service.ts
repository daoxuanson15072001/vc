import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import {
  highlightRanges,
  maskContactsInText,
  parseSearchQuery,
  PREFIX_MIN,
  searchKeysOf,
  SEARCH_FULL_PHONE_DIGITS,
  textMatches,
  type ParsedSearch,
  type SearchHit,
  type SearchMessagesQuery,
  type SearchMessagesResponse,
  type SearchTerm,
} from '@vclinks/shared';
import type { Document } from 'mongodb';
import type { Subject } from '../authz/engine';
import { AuthzService } from '../authz/authz.service';
import { C, DbService } from '../db/db.service';
import { runAsTenant } from '../db/tenant-context';
import { MessageVault } from '../security/message-vault';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Candidates read from the index per request; a hit list never needs more than a few pages. */
const MAX_CANDIDATES = 3_000;
const MAX_TIME_MS = 4_000;
const SNIPPET_BEFORE = 50;
const SNIPPET_LEN = 180;
const VOICE_PREFIX = '[Ghi âm] ';
const SWEEP_BATCH = 500;

/** A whole phone number as a compact code: may be matched on the live text even for a masked viewer (exact key only). */
const FULL_PHONE_CODE = /^\d{9,12}$/;

/**
 * Personal data inside message CONTENT for a viewer who may not see it: the same masking as the conversation
 * view (`maskContactsInText`, M1b-17 L-02), so a snippet never shows more than the chat itself.
 */
export function maskContentForViewer(text: string, phone: 'full' | 'reveal' | 'masked'): string {
  if (phone === 'full') return text;
  return maskContactsInText(text).text;
}

type Vis = 'full' | 'reveal' | 'masked';

/**
 * Whether a message is a hit for a viewer. A viewer who may not see phones in full is matched on the MASKED
 * text, so a part of a number or e-mail (prefix, quoted phrase, mixed with words) never confirms a hit and
 * cannot be used to probe digits. A whole phone number (9-12 digits) is still found, by exact key only.
 */
export function matchesForViewer(text: string, parsed: ParsedSearch, vis: Vis): boolean {
  if (vis === 'full') return textMatches(text, parsed);
  const whole = parsed.terms.filter((t) => t.kind === 'code' && FULL_PHONE_CODE.test(t.text));
  const rest = parsed.terms.filter((t) => !whole.includes(t));
  if (whole.length) {
    const keys = new Set(searchKeysOf(text));
    if (!whole.every((t) => [t.text, ...(t.alt ?? [])].some((c) => keys.has(c)))) return false;
  }
  return !rest.length || textMatches(maskContentForViewer(text, vis), { ...parsed, terms: rest });
}

type MsgRow = {
  _id: string;
  uid: string;
  threadId: string;
  msgId: string;
  senderName?: string;
  fromUid?: string;
  text?: string;
  sentAt: Date;
};

/**
 * Full-text search over `messages.text` (M1c-05, I2, I4, KD-15). Reads go through the scoped collection, so
 * a user only ever finds messages of the channels / conversations of the data scope (M1b-04); the scope is
 * applied by the database layer, not by this class. Voice transcripts live in `messages.text` too
 * ("[Ghi âm] ...", M1c-04), so they are found like any text.
 *
 * Index: `messages.searchKeys` (accent-free words and compacted codes, see shared/search.ts) with a
 * multikey index. Every hit is confirmed against the live text, so a stale key (edited, erased) never
 * leaks content. Keys are NOT stored when per-customer encryption is on (sealed text must not be searchable
 * from keys; see MessageVault).
 */
@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchService.name);
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
    @Optional() private readonly vault?: MessageVault,
  ) {}

  onModuleInit() {
    // Backfill / catch-up of messages without keys. 0 disables (tests call sweep() directly).
    const ms = Number(process.env.SEARCH_SWEEP_MS ?? 60_000);
    if (ms > 0) {
      setTimeout(() => void this.sweepAllTenants(), 5_000).unref();
      this.timer = setInterval(() => void this.sweepAllTenants(), ms);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------------------------------------------------------------- indexing

  /** Hook for every writer of `messages.text` (IngestService, the ASR worker of M1c-04): (re)writes the keys. */
  async reindex(uid: string, filter: Document): Promise<number> {
    const col = this.db.col<MsgRow>(C.messages);
    const docs = await col.find({ ...filter, uid } as never, { projection: { text: 1 } }).toArray();
    return this.writeKeys(docs);
  }

  private async writeKeys(docs: { _id: string; text?: string }[]): Promise<number> {
    if (!docs.length) return 0;
    const sealed = !!this.vault?.enabled;
    const ops = docs.map((d) => ({
      updateOne: {
        filter: { _id: d._id },
        update: sealed ? { $unset: { searchKeys: '' } } : { $set: { searchKeys: typeof d.text === 'string' ? searchKeysOf(d.text) : [] } },
      },
    }));
    const r = await this.db.col<Document>(C.messages).bulkWrite(ops as never, { ordered: false });
    return r.modifiedCount;
  }

  /** Writes keys for every message that has none yet (first start after the upgrade, or a writer that skipped the hook). */
  async sweep(): Promise<number> {
    if (this.vault?.enabled) {
      // Sealed content must not stay searchable through keys written before encryption was switched on.
      const r = await this.db.col<Document>(C.messages).updateMany({ searchKeys: { $exists: true } }, { $unset: { searchKeys: '' } });
      return r.modifiedCount;
    }
    let total = 0;
    for (;;) {
      const docs = await this.db.col<MsgRow>(C.messages).find({ searchKeys: null } as never, { projection: { text: 1 } }).limit(SWEEP_BATCH).toArray();
      if (!docs.length) return total;
      total += await this.writeKeys(docs);
      if (docs.length < SWEEP_BATCH) return total;
    }
  }

  private async sweepAllTenants() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const t of await this.db.tenants()) await runAsTenant(t, () => this.sweep());
    } catch (e) {
      this.logger.warn(`search sweep: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.sweeping = false;
    }
  }

  // ------------------------------------------------------------------ query

  private termFilter(t: SearchTerm, last: boolean): Document {
    const prefix = (s: string) => new RegExp(`^${escapeRe(s)}`);
    if (t.kind === 'code') return { searchKeys: { $in: [t.text, ...(t.alt ?? [])].map((c) => (c.length >= 4 ? prefix(c) : c)) } };
    if (t.kind === 'phrase') {
      // Words of the phrase must all be keys; contiguity is confirmed on the live text.
      return { $and: t.text.split(/[^0-9a-z]+/).filter(Boolean).map((w, i, a) => this.termFilter({ kind: 'word', text: w }, i === a.length - 1)) };
    }
    return { searchKeys: { $in: [t.text.length < PREFIX_MIN || !last ? t.text : prefix(t.text)] } };
  }

  /** Words are prefix-matched from PREFIX_MIN characters (typing "phan" finds "phanh"). */
  private wordFilter(t: SearchTerm): Document {
    return t.text.length >= PREFIX_MIN ? { searchKeys: { $in: [new RegExp(`^${escapeRe(t.text)}`)] } } : { searchKeys: t.text };
  }

  private async phoneScope(u: Subject | undefined, parsed: ParsedSearch): Promise<{ uids: string[] | null; limited: boolean }> {
    // A phone-only query shorter than a whole number would let a viewer without the phone right find the
    // digits of a number by trying prefixes. Such queries only run on nicks whose phones the viewer sees in full.
    if (!u || !parsed.phoneOnly || parsed.digits.length >= SEARCH_FULL_PHONE_DIGITS) return { uids: null, limited: false };
    const accounts = await this.db.col<{ _id: string }>(C.accounts).find({}, { projection: { _id: 1 } }).toArray();
    const full: string[] = [];
    for (const a of accounts) if ((await this.authz.phoneOn(u, a._id)) === 'full') full.push(a._id);
    return { uids: full, limited: full.length < accounts.length };
  }

  async search(q: SearchMessagesQuery, u?: Subject): Promise<SearchMessagesResponse> {
    const t0 = Date.now();
    const parsed = parseSearchQuery(q.q);
    if (!parsed) throw new BadRequestException('Nhập ít nhất 2 ký tự để tìm.');

    const and: Document[] = parsed.terms.map((t) => (t.kind === 'word' ? this.wordFilter(t) : this.termFilter(t, true)));
    const filter: Document = { $and: and };
    const phone = await this.phoneScope(u, parsed);
    const uids = q.uid ? q.uid.split(',').map((x) => x.trim()).filter(Boolean) : null;
    const allowed = uids && phone.uids ? uids.filter((x) => phone.uids!.includes(x)) : (uids ?? phone.uids);
    if (allowed) filter.uid = { $in: allowed };
    if (q.threadId) filter.threadId = q.threadId;
    if (q.from || q.to) filter.sentAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };

    const skip = (q.page - 1) * q.limit;
    const cursor = this.db
      .col<MsgRow>(C.messages)
      .find(filter as never, { projection: { uid: 1, threadId: 1, msgId: 1, senderName: 1, fromUid: 1, text: 1, sentAt: 1 }, maxTimeMS: MAX_TIME_MS, allowDiskUse: true })
      .sort({ sentAt: -1 })
      .limit(MAX_CANDIDATES);
    const hits: MsgRow[] = [];
    const vis = new Map<string, Vis>();
    const visOf = async (uid: string): Promise<Vis> => {
      if (!vis.has(uid)) vis.set(uid, u ? await this.authz.phoneOn(u, uid) : 'full');
      return vis.get(uid)!;
    };
    let seen = 0;
    for await (const d of cursor) {
      if (typeof d.text !== 'string' || !matchesForViewer(d.text, parsed, await visOf(d.uid))) continue;
      if (seen++ < skip) continue;
      hits.push(d);
      if (hits.length > q.limit) break;
    }
    void cursor.close();
    const hasMore = hits.length > q.limit;
    const page = hits.slice(0, q.limit);

    const items = await this.toHits(page, parsed, vis);
    if (parsed.codeKind || parsed.phoneOnly) {
      // Code lookups (phone, OE, plate) are traced; the query itself never goes in the log (§12.3, NĐ 13).
      await this.db.audit(u?.userId ?? 'system', 'search.code', 'messages', { kind: parsed.codeKind ?? 'phone', returned: items.length }).catch(() => undefined);
    }
    return {
      items,
      page: q.page,
      hasMore,
      tookMs: Date.now() - t0,
      codeKind: parsed.codeKind ?? (parsed.phoneOnly ? 'phone' : null),
      ...(phone.limited ? { note: 'Số điện thoại chưa đủ để tìm trên các nick bạn không được xem SĐT đầy đủ. Hãy nhập đủ số.' } : {}),
    };
  }

  private async toHits(rows: MsgRow[], parsed: ParsedSearch, vis: Map<string, Vis>): Promise<SearchHit[]> {
    const accounts = await this.db.col<{ _id: string; label?: string; ownerName?: string }>(C.accounts).find({ _id: { $in: [...vis.keys()] } as never }).toArray();
    const acc = new Map(accounts.map((a) => [a._id, a]));
    const ids = rows.map((r) => `${r.uid}:${r.threadId}`);
    const [contacts, groups] = await Promise.all([
      this.db.col<Document>(C.contacts).find({ _id: { $in: ids } as never }, { projection: { displayName: 1, domName: 1, zaloName: 1 } }).toArray(),
      this.db.col<Document>(C.groups).find({ _id: { $in: ids } as never }, { projection: { name: 1 } }).toArray(),
    ]);
    const title = new Map<string, string>();
    for (const c of contacts) title.set(String(c._id), String(c.domName ?? c.displayName ?? c.zaloName ?? ''));
    for (const g of groups) if (g.name) title.set(String(g._id), String(g.name));

    return rows.map((r) => {
      const masked = maskContentForViewer(r.text ?? '', vis.get(r.uid) ?? 'masked');
      const first = highlightRanges(masked, parsed)[0];
      const start = first ? Math.max(0, first[0] - SNIPPET_BEFORE) : 0;
      const end = Math.min(masked.length, start + SNIPPET_LEN);
      const snippet = `${start > 0 ? '…' : ''}${masked.slice(start, end)}${end < masked.length ? '…' : ''}`;
      const shift = start > 0 ? 1 - start : -start;
      const marks = highlightRanges(masked, parsed)
        .filter(([s, e]) => e > start && s < end)
        .map(([s, e]) => [Math.max(s, start) + shift, Math.min(e, end) + shift] as [number, number]);
      const a = acc.get(r.uid);
      return {
        id: String(r._id),
        uid: r.uid,
        threadId: r.threadId,
        conversationId: `${r.uid}:${r.threadId}`,
        msgId: r.msgId,
        senderName: r.senderName ?? null,
        fromSelf: r.fromUid === '0' || r.fromUid === r.uid,
        sentAt: r.sentAt.toISOString(),
        snippet,
        marks,
        voice: (r.text ?? '').startsWith(VOICE_PREFIX),
        title: title.get(`${r.uid}:${r.threadId}`) || r.threadId,
        accountLabel: a?.label ?? null,
        accountOwner: a?.ownerName ?? null,
      };
    });
  }
}
