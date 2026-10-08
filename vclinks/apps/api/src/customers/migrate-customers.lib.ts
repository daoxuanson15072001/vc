import type { AnyBulkWriteOperation, Db, Document } from 'mongodb';
import { CUST_C } from './customers.types';
import { buildIdentityProfile, type IdentitySource } from './profile-builder';

/*
 * Customer migration (M1b-12): every existing `contacts` record (channel identity) gets its own
 * customer account + contact + identity link (F5.1), plus a contact point for a readable profile phone.
 * Nothing existing is modified: `contacts`, `conversations`, `messages` keep their ids and content
 * (counted before / after). Ids derive from the identity id, so re-running creates nothing twice.
 * Every created record carries `migrationRunId`; `undoCustomersMigration` deletes exactly those.
 */

export interface MigrationReport {
  runId: string;
  tenant: string;
  dryRun: boolean;
  identities: number;
  created: { accounts: number; contacts: number; points: number; links: number };
  skippedExisting: number;
  /** Counts of the source collections before / after (must be equal). */
  source: Record<string, { before: number; after: number }>;
  ok: boolean;
}

const SOURCES = ['contacts', 'conversations', 'messages'] as const;
const BATCH = 500;

export async function migrateCustomers(db: Db, opts: { tenant: string; runId: string; dryRun?: boolean; now?: Date }): Promise<MigrationReport> {
  const { tenant, runId } = opts;
  const now = opts.now ?? new Date();
  const t = { tenant_id: tenant };
  const source: MigrationReport['source'] = {};
  for (const s of SOURCES) source[s] = { before: await db.collection(s).countDocuments(t), after: 0 };
  const report: MigrationReport = {
    runId,
    tenant,
    dryRun: !!opts.dryRun,
    identities: 0,
    created: { accounts: 0, contacts: 0, points: 0, links: 0 },
    skippedExisting: 0,
    source,
    ok: false,
  };
  const upserts = (docs: { _id: string }[]) =>
    docs.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $setOnInsert: { ...d, ...t } }, upsert: true } })) as unknown as AnyBulkWriteOperation<Document>[];

  let batch: IdentitySource[] = [];
  const flush = async () => {
    if (!batch.length) return;
    const ids = batch.map((c) => c._id);
    const have = new Set(
      (await db.collection(CUST_C.identityLinks).find({ _id: { $in: ids } as never, ...t }, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id)),
    );
    const todo = batch.filter((c) => !have.has(c._id));
    report.skippedExisting += batch.length - todo.length;
    batch = [];
    if (!todo.length) return;
    const built = todo.map((c) => buildIdentityProfile(c, now, { migrationRunId: runId }));
    if (opts.dryRun) {
      report.created.accounts += built.length;
      report.created.contacts += built.length;
      report.created.links += built.length;
      report.created.points += built.reduce((n, b) => n + b.points.length, 0);
      return;
    }
    // Children first, link last: an interrupted run is completed by the next one (same ids).
    report.created.accounts += (await db.collection(CUST_C.accounts).bulkWrite(upserts(built.map((b) => b.account)), { ordered: false })).upsertedCount;
    report.created.contacts += (await db.collection(CUST_C.contacts).bulkWrite(upserts(built.map((b) => b.contact)), { ordered: false })).upsertedCount;
    const pts = built.flatMap((b) => b.points);
    if (pts.length) report.created.points += (await db.collection(CUST_C.points).bulkWrite(upserts(pts), { ordered: false })).upsertedCount;
    report.created.links += (await db.collection(CUST_C.identityLinks).bulkWrite(upserts(built.map((b) => b.link)), { ordered: false })).upsertedCount;
  };

  const cursor = db.collection('contacts').find(
    { ...t, uid: { $type: 'string' }, userId: { $exists: true, $nin: ['0', null] } },
    { projection: { uid: 1, userId: 1, domName: 1, displayName: 1, zaloName: 1, phone: 1, encrypted: 1, gender: 1, role: 1, orgEmail: 1, ingestedAt: 1, lastActionTime: 1 } },
  );
  for await (const c of cursor) {
    report.identities++;
    batch.push({ ...(c as unknown as IdentitySource), _id: String(c._id), userId: String(c.userId) });
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  for (const s of SOURCES) source[s].after = await db.collection(s).countDocuments(t);
  const links = await db.collection(CUST_C.identityLinks).countDocuments(t);
  report.ok = SOURCES.every((s) => source[s].before === source[s].after) && (opts.dryRun || links >= report.identities);
  if (!opts.dryRun) {
    const at = new Date();
    const detail = { runId, identities: report.identities, ...report.created, skippedExisting: report.skippedExisting, ok: report.ok };
    await db.collection('audit_log').insertOne({ actor: 'system', action: 'db.migrate_customers', target: db.databaseName, at, detail, ...t });
    await db.collection('events').insertOne({ type: 'db.migrate_customers', subject: { kind: 'db', id: db.databaseName }, actor: 'system', at, data: detail, ...t });
  }
  return report;
}

export interface UndoReport {
  runId: string;
  deleted: { accounts: number; contacts: number; points: number; links: number };
  refused: string | null;
}

/**
 * Removes exactly the records of one migration run. Refused (nothing deleted) when the profiles were
 * used since: merged, linked to an ERP code, given an owner, or carrying points / identities added later.
 */
export async function undoCustomersMigration(db: Db, opts: { tenant: string; runId: string; force?: boolean }): Promise<UndoReport> {
  const t = { tenant_id: opts.tenant, migrationRunId: opts.runId };
  const out: UndoReport = { runId: opts.runId, deleted: { accounts: 0, contacts: 0, points: 0, links: 0 }, refused: null };
  if (!opts.force) {
    const contactIds = (await db.collection(CUST_C.contacts).find(t, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    const accountIds = (await db.collection(CUST_C.accounts).find(t, { projection: { _id: 1 } }).toArray()).map((d) => d._id);
    const reasons: string[] = [];
    if (await db.collection(CUST_C.identityLinks).countDocuments({ ...t, $or: [{ state: { $ne: 'new' } }, { mergeOpId: { $nin: [null] } }] }))
      reasons.push('có danh tính đã gộp');
    if (await db.collection(CUST_C.accounts).countDocuments({ ...t, $or: [{ status: { $ne: 'active' } }, { 'owners.0': { $exists: true } }, { 'erpLinks.0': { $exists: true } }] }))
      reasons.push('có hồ sơ đã gộp / có owner / có mã KH');
    const foreign = { tenant_id: opts.tenant, migrationRunId: { $ne: opts.runId } };
    if (await db.collection(CUST_C.points).countDocuments({ ...foreign, $or: [{ contactId: { $in: contactIds } }, { accountId: { $in: accountIds } }] }))
      reasons.push('có SĐT / email thêm sau vào hồ sơ của lượt này');
    if (await db.collection(CUST_C.identityLinks).countDocuments({ ...foreign, accountId: { $in: accountIds } })) reasons.push('có danh tính khác gắn vào');
    if (reasons.length) {
      out.refused = `Không lùi được lượt ${opts.runId}: ${reasons.join('; ')}. Chạy lại với --force nếu chắc chắn.`;
      return out;
    }
  }
  out.deleted.links = (await db.collection(CUST_C.identityLinks).deleteMany(t)).deletedCount;
  out.deleted.points = (await db.collection(CUST_C.points).deleteMany(t)).deletedCount;
  out.deleted.contacts = (await db.collection(CUST_C.contacts).deleteMany(t)).deletedCount;
  out.deleted.accounts = (await db.collection(CUST_C.accounts).deleteMany(t)).deletedCount;
  const at = new Date();
  await db.collection('audit_log').insertOne({ actor: 'system', action: 'db.migrate_customers_undo', target: db.databaseName, at, detail: out, tenant_id: opts.tenant });
  return out;
}
