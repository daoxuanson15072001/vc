import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Collection } from 'mongodb';
import { DbService } from '../db/db.service';
import { TENANT_FIELD } from '../db/tenant-collection';
import { currentTenant } from '../db/tenant-context';
import { DEFAULT_SUBJECT_RESOLVER, SUBJECT_RESOLVER, type SubjectResolver } from './subject-resolver';

/*
 * Per-customer encryption keys (BA §2.2 #9, D5-09, VCL-ADM-14/15; M1b-14).
 *
 * Envelope encryption: each subject (channel identity `${uid}:${userId}`, = identity_links._id of M1b-12)
 * has its own random data key (DEK, AES-256-GCM), stored only wrapped by the master key CUSTOMER_KEK
 * (base64, 32 bytes, from the environment, never in the database, never logged).
 * Erasing a customer = deleting its DEKs ("crypto-shredding"): its sealed content can no longer be read.
 *
 * Every erasure is also written to a ledger kept in a separate database (ERASURE_LEDGER_DB, default
 * `<db>_erasures`) that is backed up apart from the main database. After restoring a backup of the main
 * database, `reapplyErasures()` (script `security:reapply-erasures`) deletes the keys again.
 */

export const CUSTOMER_KEYS = 'customer_keys';
export const ERASED_SUBJECTS = 'erased_subjects';
export const LEDGER_COLLECTION = 'erasure_ledger';
/** Customer collections owned by M1b-12; erasure stamps erasedAt / erasedBy on them when they exist. */
export const CUSTOMER_ACCOUNTS = 'customer_accounts';
export const CUSTOMER_CONTACTS = 'customer_contacts';
/** Identity → customer links of M1b-12 (`_id` = identity id). */
export const IDENTITY_LINKS = 'identity_links';

interface Wrapped {
  iv: string;
  tag: string;
  data: string;
}

interface KeyDoc {
  _id: string;
  /** DEK wrapped by CUSTOMER_KEK. */
  wrapped: Wrapped;
  /** Non-secret fingerprint of the KEK that wrapped it (key rotation). */
  kekId: string;
  createdAt: Date;
}

interface ErasedDoc {
  _id: string;
  erasedAt: Date;
  erasedBy: string;
  accountId?: string;
}

interface LedgerDoc {
  _id: string;
  [TENANT_FIELD]: string;
  subjectId: string;
  accountId?: string;
  erasedAt: Date;
  erasedBy: string;
}

/** Ciphertext stored in a record (e.g. `messages.sealed`). `k` = subject id, needed to find the key. */
export interface Sealed {
  v: 1;
  k: string;
  iv: string;
  tag: string;
  data: string;
}

export interface EraseResult {
  subjects: string[];
  keysDestroyed: number;
}

const gcmEncrypt = (key: Buffer, plain: Buffer): Wrapped => {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(plain), c.final()]);
  return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
};

const gcmDecrypt = (key: Buffer, w: Wrapped): Buffer => {
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(w.iv, 'base64'));
  d.setAuthTag(Buffer.from(w.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(w.data, 'base64')), d.final()]);
};

@Injectable()
export class CustomerKeysService implements OnModuleInit {
  private readonly logger = new Logger(CustomerKeysService.name);
  private kek: Buffer | null = null;
  private kekId = '';

  constructor(
    private readonly db: DbService,
    @Optional() @Inject(SUBJECT_RESOLVER) private readonly resolver: SubjectResolver = DEFAULT_SUBJECT_RESOLVER,
  ) {}

  onModuleInit() {
    const raw = process.env.CUSTOMER_KEK;
    if (!raw) {
      if (process.env.CUSTOMER_ENCRYPTION === '1') this.logger.error('CUSTOMER_ENCRYPTION=1 but CUSTOMER_KEK is not set: content stays unencrypted');
      return;
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('CUSTOMER_KEK must be 32 bytes, base64-encoded');
    this.kek = key;
    this.kekId = createHash('sha256').update(key).digest('hex').slice(0, 12);
  }

  /** The master key is configured (encryption possible). */
  get available(): boolean {
    return this.kek !== null;
  }

  private get keys() {
    return this.db.col<KeyDoc>(CUSTOMER_KEYS);
  }

  private get erased() {
    return this.db.col<ErasedDoc>(ERASED_SUBJECTS);
  }

  /** Name of the ledger database (outside the main backup). */
  ledgerDbName(): string {
    return process.env.ERASURE_LEDGER_DB || `${this.db.db.databaseName}_erasures`;
  }

  private ledger(): Collection<LedgerDoc> {
    return this.db.db.client.db(this.ledgerDbName()).collection<LedgerDoc>(LEDGER_COLLECTION);
  }

  private requireKek(): Buffer {
    if (!this.kek) throw new Error('CUSTOMER_KEK is not configured');
    return this.kek;
  }

  /**
   * Subjects (of the current tenant) whose customer was erased, among `ids`: listed in `erased_subjects`,
   * or linked (M1b-12 identity_links) to a customer account / contact stamped with `erasedAt`.
   */
  async erasedAmong(ids: string[]): Promise<Set<string>> {
    const uniq = [...new Set(ids)];
    if (!uniq.length) return new Set();
    const rows = await this.erased.find({ _id: { $in: uniq } }, { projection: { _id: 1 } }).toArray();
    const out = new Set(rows.map((r) => r._id));
    const rest = uniq.filter((id) => !out.has(id));
    if (!rest.length) return out;
    const links = await this.db
      .col<{ _id: string; accountId?: string; contactId?: string }>(IDENTITY_LINKS)
      .find({ _id: { $in: rest } }, { projection: { accountId: 1, contactId: 1 } })
      .toArray();
    if (!links.length) return out;
    const accIds = [...new Set(links.map((l) => l.accountId).filter((x): x is string => !!x))];
    const conIds = [...new Set(links.map((l) => l.contactId).filter((x): x is string => !!x))];
    const [accs, cons] = await Promise.all([
      accIds.length ? this.db.col(CUSTOMER_ACCOUNTS).distinct('_id', { _id: { $in: accIds as never[] }, erasedAt: { $type: 'date' } }) : [],
      conIds.length ? this.db.col(CUSTOMER_CONTACTS).distinct('_id', { _id: { $in: conIds as never[] }, erasedAt: { $type: 'date' } }) : [],
    ]);
    const erasedAcc = new Set(accs.map(String));
    const erasedCon = new Set(cons.map(String));
    for (const l of links) if ((l.accountId && erasedAcc.has(l.accountId)) || (l.contactId && erasedCon.has(l.contactId))) out.add(l._id);
    return out;
  }

  /** True when the tenant has at least one erased customer (cheap pre-check for the ingest guard). */
  async anyErased(): Promise<boolean> {
    if (await this.erased.countDocuments({}, { limit: 1 })) return true;
    return (await this.db.col(CUSTOMER_ACCOUNTS).countDocuments({ erasedAt: { $type: 'date' } }, { limit: 1 })) > 0 ||
      (await this.db.col(CUSTOMER_CONTACTS).countDocuments({ erasedAt: { $type: 'date' } }, { limit: 1 })) > 0;
  }

  /**
   * Data keys of `ids` (created when missing, unless `create` is false). Erased subjects get no key:
   * they are absent from the returned map.
   */
  async dataKeys(ids: string[], create = true): Promise<Map<string, Buffer>> {
    const kek = this.requireKek();
    const uniq = [...new Set(ids)];
    const out = new Map<string, Buffer>();
    if (!uniq.length) return out;
    const erased = await this.erasedAmong(uniq);
    const docs = await this.keys.find({ _id: { $in: uniq } }).toArray();
    for (const d of docs) if (!erased.has(d._id)) out.set(d._id, gcmDecrypt(kek, d.wrapped));
    if (!create) return out;
    for (const id of uniq) {
      if (out.has(id) || erased.has(id)) continue;
      const wrapped = gcmEncrypt(kek, randomBytes(32));
      // $setOnInsert: two concurrent writers keep the first key.
      await this.keys.updateOne({ _id: id }, { $setOnInsert: { wrapped, kekId: this.kekId, createdAt: new Date() } }, { upsert: true });
      const d = await this.keys.findOne({ _id: id });
      if (d) out.set(id, gcmDecrypt(kek, d.wrapped));
    }
    return out;
  }

  /** Encrypts a JSON value with the key of `subjectId`; null when the subject is erased. */
  async seal(subjectId: string, value: unknown): Promise<Sealed | null> {
    const key = (await this.dataKeys([subjectId])).get(subjectId);
    if (!key) return null;
    return this.sealWith(subjectId, key, value);
  }

  sealWith(subjectId: string, key: Buffer, value: unknown): Sealed {
    return { v: 1, k: subjectId, ...gcmEncrypt(key, Buffer.from(JSON.stringify(value), 'utf8')) };
  }

  /** Decrypts with an already loaded key; null when the key is missing or the data was tampered with. */
  openWith<T = unknown>(key: Buffer | undefined, s: Sealed): T | null {
    if (!key) return null;
    try {
      return JSON.parse(gcmDecrypt(key, s).toString('utf8')) as T;
    } catch {
      return null;
    }
  }

  /** Decrypts one sealed value; null when its key was destroyed. */
  async open<T = unknown>(s: Sealed): Promise<T | null> {
    const key = (await this.dataKeys([s.k], false)).get(s.k);
    return this.openWith<T>(key, s);
  }

  /** Identity ids of a customer account (via M1b-12's resolver; default: none known). */
  identityIdsOfAccount(accountId: string): Promise<string[]> {
    return this.resolver.identityIdsOfAccount(accountId);
  }

  /**
   * Destroys the keys of the given identities (or of every identity of `accountId`), records the
   * erasure in `erased_subjects` and in the ledger, and stamps erasedAt / erasedBy on M1b-12's
   * customer records when they exist. Irreversible by design.
   */
  async erase(opts: { identityIds?: string[]; accountId?: string; actor: string }): Promise<EraseResult> {
    const subjects = new Set(opts.identityIds ?? []);
    let accountId = opts.accountId;
    if (accountId) for (const id of await this.resolver.identityIdsOfAccount(accountId)) subjects.add(id);
    if (!accountId && subjects.size === 1) accountId = (await this.resolver.accountOfIdentity([...subjects][0])) ?? undefined;
    const ids = [...subjects];
    const erasedAt = new Date();
    const tenant = currentTenant();
    // Ledger first: if the process dies midway, the reapply step finishes the job.
    if (ids.length) {
      await this.ledger().bulkWrite(
        ids.map((subjectId) => ({
          updateOne: {
            filter: { _id: `${tenant}:${subjectId}` },
            update: { $setOnInsert: { [TENANT_FIELD]: tenant, subjectId, erasedAt, erasedBy: opts.actor, ...(accountId ? { accountId } : {}) } },
            upsert: true,
          },
        })),
      );
    }
    const keysDestroyed = await this.applyErasure(ids, { erasedAt, erasedBy: opts.actor, accountId });
    return { subjects: ids, keysDestroyed };
  }

  /** Deletes keys and stamps the erasure records (shared by erase and reapply). */
  private async applyErasure(ids: string[], e: { erasedAt: Date; erasedBy: string; accountId?: string }): Promise<number> {
    if (!ids.length) return 0;
    const r = await this.keys.deleteMany({ _id: { $in: ids } });
    await this.erased.bulkWrite(
      ids.map((id) => ({
        updateOne: {
          filter: { _id: id },
          update: { $setOnInsert: { erasedAt: e.erasedAt, erasedBy: e.erasedBy, ...(e.accountId ? { accountId: e.accountId } : {}) } },
          upsert: true,
        },
      })),
    );
    if (e.accountId) {
      const stamp = { $set: { erasedAt: e.erasedAt, erasedBy: e.erasedBy } };
      await this.db.col(CUSTOMER_ACCOUNTS).updateOne({ _id: e.accountId as never, erasedAt: { $exists: false } }, stamp);
      await this.db.col(CUSTOMER_CONTACTS).updateMany({ accountId: e.accountId, erasedAt: { $exists: false } }, stamp);
    }
    return r.deletedCount;
  }

  /**
   * After restoring a backup of the main database: replays every erasure of the ledger for the current
   * tenant (keys deleted again, erased_subjects restored). Idempotent. Returns the replayed subjects.
   */
  async reapplyErasures(): Promise<{ subjects: string[]; keysDestroyed: number }> {
    const rows = await this.ledger().find({ [TENANT_FIELD]: currentTenant() }).toArray();
    let keysDestroyed = 0;
    for (const r of rows) {
      keysDestroyed += await this.applyErasure([r.subjectId], { erasedAt: r.erasedAt, erasedBy: r.erasedBy, accountId: r.accountId });
    }
    return { subjects: rows.map((r) => r.subjectId), keysDestroyed };
  }

  /** Counts for the status endpoint (no key material). */
  async status() {
    const [keys, erased] = await Promise.all([this.keys.countDocuments({}), this.erased.countDocuments({})]);
    return { kekConfigured: this.available, kekId: this.kekId || null, keys, erased, ledgerDb: this.ledgerDbName() };
  }
}
