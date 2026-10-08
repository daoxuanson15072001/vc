import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { ErpSyncCounts, ErpSyncKind, ErpSyncRunView, ErpSyncStartInput, ErpSyncStatus } from '@vclinks/shared';
import type { VcsaleClient } from '@vclinks/vcsale-client';
import { randomUUID } from 'node:crypto';
import type { Subject } from '../authz/engine';
import { DbService } from '../db/db.service';
import { runsBackgroundJobs } from '../db/role';
import { currentTenant, runAsTenant } from '../db/tenant-context';
import { CustomersService, VCSALE_CLIENT } from './customers.service';
import { CUST_C, type ErpSyncDoc } from './customers.types';
import { ErpTasksService } from './erp-tasks.service';

const MIN = 60_000;
/** Automatic incremental sync (VCSALE_SYNC_MS, default 1 hour; 0 = off). Only tenants that did a first full import. */
const everyMs = () => Number(process.env.VCSALE_SYNC_MS ?? 60 * MIN);
/** Changes are read from a little before the last one seen, so one saved late is not missed (re-reading is harmless). */
const OVERLAP_MS = 2 * MIN;
/** A run older than this is taken as dead (the process stopped in the middle). */
const STALE_RUN_MS = 30 * MIN;
const KEEP_RUNS = 10;
/** Roles that load the catalogue (matrix `cust.import` DV: sale admin, sales director). */
const IMPORT_ROLES = new Set(['sale_admin', 'giam_doc_bh']);

const ZERO: ErpSyncCounts = {
  fetched: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  deleted: 0,
  held: 0,
  ownersSet: 0,
  ownerUnmatched: 0,
  ownerMismatch: 0,
  autoMerged: 0,
  suggestions: 0,
  tasksDone: 0,
  tasksReopened: 0,
  codeSuggestions: 0,
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * VCsales catalogue (plan C11, D3-09): "Xem trước" counts without writing, "Nạp toàn bộ" loads every customer once,
 * then an incremental sync reads only what changed (hourly, or "Đồng bộ ngay"). One run at a time per tenant (a lock
 * in `erp_sync`); runs go in the background and the screen polls the state. After each real run the Việc VCsales
 * queue is compared with VCsales (MH-DK-12: new codes suggested, updates done on VCsales leave the queue).
 */
@Injectable()
export class ErpSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('ErpSync');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DbService,
    private readonly customers: CustomersService,
    private readonly tasks: ErpTasksService,
    @Inject(VCSALE_CLIENT) private readonly vcsale: VcsaleClient,
  ) {}

  private get col() {
    return this.db.col<ErpSyncDoc>(CUST_C.erpSync);
  }
  private docId() {
    return `vcsales:${currentTenant()}`;
  }

  onApplicationBootstrap() {
    const ms = everyMs();
    if (ms > 0 && runsBackgroundJobs()) {
      this.timer = setInterval(() => void this.tick(), ms);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Automatic sync: every tenant that did its first full import. */
  async tick() {
    for (const t of await this.db.tenants()) {
      await runAsTenant(t, async () => {
        const doc = await this.col.findOne({ _id: this.docId() });
        if (!doc?.firstImportAt) return;
        try {
          const id = await this.lock('incremental', 'system:vcsales-sync');
          await this.execute(id, 'incremental', 'system:vcsales-sync', doc.division);
        } catch (e) {
          if (!(e instanceof ConflictException)) this.logger.warn(`vcsales sync: ${e instanceof Error ? e.message : String(e)}`);
        }
      });
    }
  }

  canRun(u: Subject | undefined): boolean {
    return !u || u.roles.some((r) => IMPORT_ROLES.has(r.roleKey));
  }

  /** The one division of the sale admin / sales director who runs the first load; null when none or several. */
  private divisionOf(u: Subject | undefined): string | null {
    const divs = new Set((u?.roles ?? []).filter((r) => IMPORT_ROLES.has(r.roleKey) && r.divisionId).map((r) => r.divisionId!));
    return divs.size === 1 ? [...divs][0]! : null;
  }

  async status(u: Subject | undefined): Promise<ErpSyncStatus> {
    const doc = await this.col.findOne({ _id: this.docId() });
    const running = doc?.running && Date.now() - doc.running.startedAt.getTime() < STALE_RUN_MS ? doc.running : null;
    const people = [...new Set((doc?.runs ?? []).map((r) => r.by).filter((b) => b.startsWith('user:')).map((b) => b.slice(5)))];
    const names = await this.customers.userNames(people);
    return {
      mode: this.vcsale.mode,
      division: doc?.division ?? null,
      firstImportAt: iso(doc?.firstImportAt),
      lastSyncAt: iso(doc?.lastSyncAt),
      since: iso(doc?.since),
      everyMinutes: Math.round(everyMs() / MIN),
      snapshotCount: await this.db.col(CUST_C.erpCustomers).countDocuments({ erp: 'vcsales' }),
      running: running ? { id: running.id, kind: running.kind, by: running.by, startedAt: running.startedAt.toISOString(), fetched: running.fetched } : null,
      runs: [...(doc?.runs ?? [])].reverse().map(
        (r): ErpSyncRunView => ({
          id: r.id,
          kind: r.kind,
          by: r.by,
          byName: r.by.startsWith('user:') ? (names.get(r.by.slice(5)) ?? null) : null,
          startedAt: r.startedAt.toISOString(),
          finishedAt: iso(r.finishedAt),
          since: iso(r.since),
          counts: r.counts,
          error: r.error,
        }),
      ),
      canRun: this.canRun(u),
    };
  }

  /** "Xem trước" / "Nạp toàn bộ" / "Đồng bộ ngay": takes the lock, answers at once, runs in the background. */
  async start(input: ErpSyncStartInput, u: Subject | undefined, actor: string): Promise<ErpSyncStatus> {
    if (!this.canRun(u)) throw new ForbiddenException('Chỉ sale admin hoặc giám đốc bán hàng nạp danh mục VCsales.');
    const doc = await this.col.findOne({ _id: this.docId() });
    if (input.kind === 'incremental' && !doc?.firstImportAt) throw new BadRequestException('Chưa nạp danh mục lần đầu. Bấm "Nạp toàn bộ" trước.');
    if (doc?.division && input.division && input.division !== doc.division) {
      throw new BadRequestException(`Danh mục đã nạp cho division ${doc.division}. Người phụ trách lần đầu chỉ nạp cho một division.`);
    }
    const division = doc?.division ?? input.division ?? (process.env.AUTHZ_DEFAULT_DIVISION?.trim() || null) ?? this.divisionOf(u);
    if (!division) throw new BadRequestException('Chưa biết division nhận người phụ trách lần đầu: người bấm thuộc nhiều division. Đặt AUTHZ_DEFAULT_DIVISION hoặc gửi division.');
    const id = await this.lock(input.kind, actor);
    const tenant = currentTenant();
    // Outside the request scope: the run sees the whole tenant, as the background sweep does.
    void runAsTenant(tenant, () => this.execute(id, input.kind, actor, division));
    return this.status(u);
  }

  /** Waits for the current run to finish (tests, scripts). */
  async waitIdle(timeoutMs = 60_000): Promise<void> {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const doc = await this.col.findOne({ _id: this.docId() }, { projection: { running: 1 } });
      if (!doc?.running) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('vcsales sync still running');
  }

  private async lock(kind: ErpSyncKind, by: string): Promise<string> {
    const id = `sync_${randomUUID()}`;
    const now = new Date();
    await this.col.updateOne(
      { _id: this.docId() },
      { $setOnInsert: { erp: 'vcsales', division: null, firstImportAt: null, lastSyncAt: null, since: null, running: null, runs: [] } },
      { upsert: true },
    );
    const got = await this.col.findOneAndUpdate(
      { _id: this.docId(), $or: [{ running: null }, { 'running.startedAt': { $lt: new Date(now.getTime() - STALE_RUN_MS) } }] },
      { $set: { running: { id, kind, by, startedAt: now, fetched: 0 } } },
    );
    if (!got) throw new ConflictException('Đang có một lần nạp hoặc đồng bộ chạy. Đợi xong rồi thử lại.');
    return id;
  }

  private async execute(id: string, kind: ErpSyncKind, by: string, division: string | null) {
    const startedAt = new Date();
    const doc = await this.col.findOne({ _id: this.docId() });
    const since = kind === 'incremental' && doc?.since ? new Date(doc.since.getTime() - OVERLAP_MS) : null;
    const counts: ErpSyncCounts = { ...ZERO };
    let error: string | null = null;
    const set: Partial<ErpSyncDoc> = {};
    try {
      const r = await this.customers.importCatalog({ erp: 'vcsales', division: division ?? undefined }, by, {
        updatedSince: since,
        dryRun: kind === 'preview',
        kind: kind === 'preview' ? undefined : kind,
        onProgress: async (n) => {
          await this.col.updateOne({ _id: this.docId(), 'running.id': id }, { $set: { 'running.fetched': n } });
        },
      });
      for (const k of Object.keys(ZERO) as (keyof ErpSyncCounts)[]) if (typeof (r as unknown as Record<string, unknown>)[k] === 'number') counts[k] = (r as unknown as Record<string, number>)[k]!;
      if (kind !== 'preview') {
        const t = await this.tasks.afterSync(startedAt);
        counts.tasksDone = t.done;
        counts.tasksReopened = t.reopened;
        counts.codeSuggestions = t.suggested;
        set.lastSyncAt = new Date();
        const seen = r.maxUpdatedAt ? Date.parse(r.maxUpdatedAt) : 0;
        const prev = doc?.since?.getTime() ?? 0;
        if (seen > prev) set.since = new Date(seen);
        if (kind === 'full') {
          set.firstImportAt = doc?.firstImportAt ?? new Date();
          set.division = doc?.division ?? division;
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      this.logger.warn(`vcsales ${kind}: ${error}`);
    }
    const run = { id, kind, by, startedAt, finishedAt: new Date(), since, counts, error };
    await this.col.updateOne({ _id: this.docId(), 'running.id': id }, { $set: { ...set, running: null }, $push: { runs: { $each: [run], $slice: -KEEP_RUNS } } });
    await this.db.audit(by, `vcsales.${kind}`, 'customers', { counts: { fetched: counts.fetched, created: counts.created, updated: counts.updated, deleted: counts.deleted }, error: error ? 'failed' : null });
  }
}
