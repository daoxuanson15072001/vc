import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Collection, Db, Document, MongoClient } from 'mongodb';
import { type EventDoc, type EventInput, subjectKindOf } from '../events/event.types';
import { sanitizeDetail } from '../audit/sanitize';
import { TENANT_FIELD, tenantScoped } from './tenant-collection';
import { currentIp, currentScope, DEFAULT_TENANT, currentTenant } from './tenant-context';

/** One audit line as handed to listeners. */
export interface AuditEntry {
  actor: string;
  action: string;
  target: string;
  at: Date;
  detail?: Record<string, unknown>;
  /** Client address (L-03); personal data of the staff member, only for Admin / kiểm toán and rule R6. */
  ip?: string;
}

/** Collection names of the `vclinks` database (CLAUDE.md §5). */
export const C = {
  accounts: 'accounts',
  contacts: 'contacts',
  groups: 'groups',
  conversations: 'conversations',
  messages: 'messages',
  reactions: 'reactions',
  labels: 'labels',
  readStates: 'read_states',
  checkpoints: 'checkpoints',
  fieldMappings: 'field_mappings',
  mappingDrifts: 'mapping_drifts',
  apiTokens: 'api_tokens',
  auditLog: 'audit_log',
  alerts: 'alerts',
  alertRules: 'alert_rules',
  suggestions: 'suggestions',
  friendRequests: 'friend_requests',
  fetchRequests: 'fetch_requests',
  extensionPresence: 'extension_presence',
  quickReplies: 'quick_replies',
  devRequests: 'dev_requests',
  events: 'events',
  users: 'users',
  sessions: 'sessions',
  authStates: 'auth_states',
  syncRequests: 'sync_requests',
  sendPaceSlots: 'send_pace_slots',
  // M1c-04: files in the company store, voice-to-text jobs and transcripts.
  attachments: 'attachments',
  transcripts: 'transcripts',
  asrJobs: 'asr_jobs',
  quoteSends: 'quote_sends',
} as const;

/**
 * Collections shared by all tenants, read without a `tenant_id` filter:
 * tokens (looked up by hash; the tenant is a field of the token), the Zalo Web
 * field mapping (describes Zalo, not a tenant), dev requests (project process),
 * one-shot OAuth states (the public callback learns the tenant from the state)
 * and GridFS media (content-addressed; reached only through scoped messages).
 * Every other collection is tenant-scoped (BA §2.2 #10).
 */
export const GLOBAL_COLLECTIONS: ReadonlySet<string> = new Set([
  C.apiTokens,
  // Login sessions and one-shot Google states are found by hash/state before the tenant is known.
  C.sessions,
  C.authStates,
  C.fieldMappings,
  C.devRequests,
  'zalo_oa_oauth_states',
  'fb_oauth_states',
  'media.files',
  'media.chunks',
]);

/**
 * Collections holding channel data, with the field naming the channel (account uid). Requests of a
 * signed-in user only reach the channels / conversations of his data scope (M1b-04, AuthzGuard).
 */
export const CHANNEL_SCOPED: Readonly<Record<string, 'uid' | '_id'>> = {
  [C.accounts]: '_id',
  [C.contacts]: 'uid',
  [C.groups]: 'uid',
  [C.conversations]: 'uid',
  [C.messages]: 'uid',
  [C.reactions]: 'uid',
  [C.labels]: 'uid',
  [C.readStates]: 'uid',
  [C.checkpoints]: 'uid',
  [C.suggestions]: 'uid',
  // M1c-04: files and transcripts follow the nick / conversation scope of the message they belong to.
  [C.attachments]: 'uid',
  [C.transcripts]: 'uid',
  [C.quoteSends]: 'uid',
  [C.fetchRequests]: 'uid',
  // M1b-15: per-nick KPI days follow the nick scope.
  kpi_daily: 'uid',
  // Internal notes and event lines of a conversation (conversation-work.service): same scope as its messages.
  conversation_notes: 'uid',
};

/** Records keyed `${uid}:${id}` whose `_id` equals a conversation id (contacts / groups of a 1-1 or group thread). */
const SAME_ID_AS_CONVERSATION = new Set<string>(['uid']);

function dataScopeFilter(field: 'uid' | '_id'): Document | undefined {
  const scope = currentScope();
  if (!scope) return undefined;
  const byChannel = { [field]: { $in: scope.channels } };
  if (!scope.conversations.length || field === '_id' || !SAME_ID_AS_CONVERSATION.has(field)) return byChannel;
  // A conversation opened by a temporary grant: its own record, and its messages (uid + threadId).
  const threads = scope.conversations.map((id) => {
    const i = id.indexOf(':');
    return { uid: id.slice(0, i), threadId: id.slice(i + 1) };
  });
  return { $or: [byChannel, { _id: { $in: scope.conversations } }, ...threads] };
}

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private client!: MongoClient;
  db!: Db;

  async onModuleInit() {
    const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/vclinks';
    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db();
    await this.migrateLegacyDatabase();
    await this.ensureIndexes();
    await this.warnUnstampedData();
    this.logger.log(`Connected to MongoDB database "${this.db.databaseName}"`);
  }

  async onModuleDestroy() {
    await this.client?.close();
  }

  /**
   * Collection of the current tenant (see tenant-context): reads are filtered
   * by `tenant_id`, writes stamp it. Global collections are returned as is.
   */
  col<T extends Document = Document>(name: string): Collection<T> {
    const raw = this.db.collection<T>(name);
    if (GLOBAL_COLLECTIONS.has(name)) return raw;
    const field = CHANNEL_SCOPED[name];
    return tenantScoped(raw, currentTenant, field ? () => dataScopeFilter(field) : undefined);
  }

  /** Raw collection across all tenants. Only for cross-tenant lookups that then switch tenant (runAsTenant). */
  unscoped<T extends Document = Document>(name: string): Collection<T> {
    return this.db.collection<T>(name);
  }

  /** Tenant owning account `uid` (platform webhooks resolve their tenant from it); DEFAULT_TENANT if unknown. */
  async tenantOfAccount(uid: string): Promise<string> {
    const acc = await this.db
      .collection<{ _id: string; tenant_id?: string }>(C.accounts)
      .findOne({ _id: uid }, { projection: { [TENANT_FIELD]: 1 } });
    return acc?.tenant_id ?? DEFAULT_TENANT;
  }

  /** Tenants that own at least one account, plus the default tenant (background sweeps). */
  async tenants(): Promise<string[]> {
    const ids = (await this.db.collection(C.accounts).distinct(TENANT_FIELD)).filter(
      (t): t is string => typeof t === 'string' && !!t,
    );
    return [...new Set([DEFAULT_TENANT, ...ids])];
  }

  /**
   * Records written before tenant_id existed are invisible to the scoped API.
   * They are never stamped here: the migrate-tenant script does it, on a copy
   * first (owner decision 04/10/2026).
   */
  private async warnUnstampedData() {
    const n = await this.db.collection(C.accounts).countDocuments({ [TENANT_FIELD]: { $exists: false } });
    if (n) {
      this.logger.error(
        `${n} account(s) in "${this.db.databaseName}" have no tenant_id and are hidden: run the migrate-tenant script`,
      );
    }
  }

  /**
   * The project was renamed VCZALO → VCconnect → VClinks (28/09/2026), and the
   * database `vczalo` → `vcconnect` → `vclinks`. On first start against an empty
   * database, moves every collection (api_tokens included, so existing tokens
   * keep working) from the newest legacy database that holds data, using
   * `renameCollection` (same server, no copy). LEGACY_DB_NAMES overrides the
   * comma-separated list, newest first; set it to "" to disable.
   */
  private async migrateLegacyDatabase() {
    const names = (process.env.LEGACY_DB_NAMES ?? 'vcconnect,vczalo')
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n && n !== this.db.databaseName);
    if (!names.length) return;
    if (await this.db.collection(C.accounts).countDocuments({}, { limit: 1 })) return;
    for (const legacyName of names) {
      const legacy = this.client.db(legacyName);
      if (!(await legacy.collection(C.accounts).countDocuments({}, { limit: 1 }))) continue;
      const cols = (await legacy.listCollections({}, { nameOnly: true }).toArray()).filter(
        (c) => !c.name.startsWith('system.'),
      );
      const admin = this.client.db('admin');
      for (const { name } of cols) {
        // Collections created empty by an earlier start (indexes) are replaced.
        if (await this.db.collection(name).countDocuments({}, { limit: 1 })) {
          this.logger.warn(`Legacy migration: "${name}" already has data in "${this.db.databaseName}", skipped`);
          continue;
        }
        await admin.command({
          renameCollection: `${legacyName}.${name}`,
          to: `${this.db.databaseName}.${name}`,
          dropTarget: true,
        });
      }
      this.logger.log(`Migrated ${cols.length} collection(s) from legacy database "${legacyName}"`);
      await this.audit('system', 'db.migrate_legacy', legacyName, { collections: cols.length });
      return;
    }
  }

  private async ensureIndexes() {
    const d = this.db;
    await Promise.all([
      d.collection(C.messages).createIndexes([
        { key: { uid: 1, threadId: 1, sentAt: -1 } },
        { key: { uid: 1, sentAt: -1 } },
        // Join key for DOM-captured content (/ingest/message-content).
        { key: { uid: 1, cliMsgId: 1 } },
        // M1c-05: accent-free words and compact codes for the message search (searchKeys: null finds the not yet indexed).
        { key: { searchKeys: 1, sentAt: -1 } },
        // Vietnamese has no Mongo stemmer: tokenise only. Avoid treating a `language` field as override.
        { key: { text: 'text' }, default_language: 'none', language_override: '_textLang' },
      ]),
      d.collection(C.contacts).createIndexes([{ key: { uid: 1, userId: 1 } }, { key: { uid: 1, role: 1 } }]),
      d.collection(C.groups).createIndexes([{ key: { uid: 1 } }]),
      d.collection(C.conversations).createIndexes([
        { key: { uid: 1, lastMsgAt: -1 } },
        // M1c-07: the SLA watch reads waits past their deadline every minute.
        { key: { slaDueAt: 1 } },
      ]),
      // M1b-15: kpi_daily by day (the job reads messages through the existing (uid, sentAt) index).
      d.collection('kpi_daily').createIndexes([{ key: { tenant_id: 1, day: 1, uid: 1 } }]),
      d.collection(C.checkpoints).createIndexes([{ key: { uid: 1 } }]),
      d.collection(C.attachments).createIndexes([
        { key: { messageId: 1 } },
        { key: { status: 1, attempts: 1 } },
        { key: { subject: 1 } },
      ]),
      d.collection(C.asrJobs).createIndexes([{ key: { status: 1, leaseUntil: 1 } }]),
      d.collection(C.fieldMappings).createIndexes([
        { key: { version: 1 }, unique: true },
        { key: { status: 1 } },
      ]),
      d.collection(C.mappingDrifts).createIndexes([{ key: { status: 1, at: -1 } }]),
      d.collection(C.apiTokens).createIndexes([{ key: { hash: 1 }, unique: true }]),
      d.collection(C.auditLog).createIndexes([{ key: { at: -1 } }]),
      d.collection(C.users).createIndexes([{ key: { [TENANT_FIELD]: 1, email: 1 }, unique: true }]),
      d.collection(C.sessions).createIndexes([{ key: { hash: 1 }, unique: true }]),
      d.collection(C.authStates).createIndexes([{ key: { createdAt: 1 }, expireAfterSeconds: 600 }]),
      d.collection(C.fetchRequests).createIndexes([{ key: { uid: 1, status: 1, requestedAt: 1 } }]),
      d.collection(C.accounts).createIndexes([{ key: { [TENANT_FIELD]: 1 } }]),
      d.collection(C.events).createIndexes([
        { key: { [TENANT_FIELD]: 1, 'subject.kind': 1, 'subject.id': 1, at: -1 } },
        { key: { [TENANT_FIELD]: 1, at: -1 } },
      ]),
    ]);
  }

  /**
   * Appends an audit entry, mirrored into the event log with the action prefix
   * as subject kind (`outbox.claim` on `<id>` → subject outbox/<id>).
   * `detail` must never contain message content.
   */
  async audit(actor: string, action: string, target: string, rawDetail?: Record<string, unknown>) {
    const at = new Date();
    // Second lock of the log rule (§12.3): content keys dropped, phone numbers hidden (M1b-07).
    const detail = sanitizeDetail(rawDetail);
    const ip = currentIp();
    await this.col(C.auditLog).insertOne({ actor, action, target, at, detail, ...(ip ? { ip } : {}) });
    await this.appendEvent({ type: action, subject: { kind: subjectKindOf(action), id: target }, actor, data: detail }, at);
    // Alert rules (M1b-07) read every line; a failing rule never fails the action that was logged.
    for (const l of this.auditListeners) {
      try {
        await l({ actor, action, target, at, detail, ...(ip ? { ip } : {}) });
      } catch (err) {
        // Alerts are best effort, but a failure is reported (action code only, never the detail: §12.3).
        this.logger.warn(`Audit listener failed on "${action}": ${(err as Error)?.name ?? 'Error'}`);
      }
    }
  }

  private readonly auditListeners: Array<(e: AuditEntry) => Promise<void>> = [];

  /** Registers a reader of new audit lines (AlertsService). */
  onAudit(fn: (e: AuditEntry) => Promise<void>) {
    this.auditListeners.push(fn);
  }

  /** Low-level append to `events` (EventsService.append is the public entry point). */
  async appendEvent(e: EventInput, at = new Date()) {
    const doc: Omit<EventDoc, 'tenant_id'> = {
      type: e.type,
      subject: { kind: e.subject.kind, id: e.subject.id },
      actor: e.actor,
      at,
      ...(e.data ? { data: e.data } : {}),
    };
    await this.col(C.events).insertOne(doc);
  }
}
