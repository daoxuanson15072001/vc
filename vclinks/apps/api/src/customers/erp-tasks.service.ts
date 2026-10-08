import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ERP_FORM_FIELD_LABELS,
  ERP_TASK_CLAIM_MINUTES,
  erpFormMissing,
  erpTaskTab,
  maskEmail,
  maskPhone,
  verifyRank,
  type ErpCloseReason,
  type ErpCreateForm,
  type ErpFormField,
  type ErpOwnerMismatchRow,
  type ErpTaskCandidate,
  type ErpTaskCreateInput,
  type ErpTaskListQuery,
  type ErpTaskListResponse,
  type ErpTaskView,
  type PermissionKey,
} from '@vclinks/shared';
import { VcsaleUnavailableError, type VcsaleClient } from '@vclinks/vcsale-client';
import { randomUUID } from 'node:crypto';
import type { Filter } from 'mongodb';
import { AuthzService } from '../authz/authz.service';
import { rowOf, type Subject } from '../authz/engine';
import { C, DbService } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { UserDoc } from '../users/users.service';
import { CustomersService, VCSALE_CLIENT } from './customers.service';
import { CUST_C, type ContactPointDoc, type CustomerAccountDoc, type ErpCustomerDoc, type ErpTaskDoc } from './customers.types';

const DAY = 86_400_000;
const OPEN = ['open', 'waiting_sale'] as const;
const NOT_FOUND = 'Không tìm thấy việc VCsales này.';
const SA_ONLY = 'Chỉ sale admin xử lý việc VCsales.';
const SYNC_ACTOR = 'system:vcsales-sync';

const fmtDay = (d: Date) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
const fmtTime = (d: Date) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(d);
const userOfActor = (actor: string) => (actor.startsWith('user:') ? actor.slice(5) : null);
const linkedCode = (a: Pick<CustomerAccountDoc, 'erpLinks'>) => a.erpLinks.find((l) => l.erp === 'vcsales' && l.status === 'confirmed')?.customerId ?? null;
const hasKey = (u: Subject, key: PermissionKey) => u.roles.some((r) => (rowOf(r)[key]?.s?.length ?? 0) > 0);
const lower = (e: string | null | undefined) => (e ?? '').trim().toLowerCase();
/** VCsales salespersons still working, by name (the main one only when VCsales gives no list). */
const salespersonNames = (s: Pick<ErpCustomerDoc, 'raw'> | undefined | null): string[] => {
  const list = (s?.raw?.salespersons ?? []).filter((p) => p.active).map((p) => p.name);
  return list.length ? list : s?.raw?.salespersonName ? [s.raw.salespersonName] : [];
};

/**
 * Việc VCsales (02 MH-DK-12, DK-58, SA-04; plan C12). VClinks never writes to VCsales (BR12): a salesperson or a sale
 * admin queues what VCsales needs, the sale admin does it there by hand, and the catalogue sync closes the task (the
 * change is on VCsales), reopens a task marked done that is still different, or suggests the new code of a create task.
 *
 * Rights: the sale admin processes (claim, check, link, return, done, close) within the customers he sees; the owner
 * creates tasks for his customers and fills the create form; supervisors and directors only read (D8-02).
 */
@Injectable()
export class ErpTasksService {
  constructor(
    private readonly db: DbService,
    private readonly customers: CustomersService,
    private readonly authz: AuthzService,
    private readonly notices: NotificationsService,
    @Inject(VCSALE_CLIENT) private readonly vcsale: VcsaleClient,
  ) {}

  private get col() {
    return this.db.col<ErpTaskDoc>(CUST_C.erpTasks);
  }
  private get accounts() {
    return this.db.col<CustomerAccountDoc>(CUST_C.accounts);
  }
  private get points() {
    return this.db.col<ContactPointDoc>(CUST_C.points);
  }
  private get snapshots() {
    return this.db.col<ErpCustomerDoc>(CUST_C.erpCustomers);
  }

  private isSaleAdmin(u: Subject | undefined) {
    return this.customers.canConfirmErp(u);
  }

  // ------------------------------------------------------------------------------------------------ reading

  async list(q: ErpTaskListQuery, u: Subject | undefined): Promise<ErpTaskListResponse> {
    const recent = new Date(Date.now() - 30 * DAY);
    const filter = q.finished ? { $or: [{ status: { $in: [...OPEN] } }, { updatedAt: { $gte: recent } }] } : { status: { $in: [...OPEN] } };
    const all = await this.col.find(filter as Filter<ErpTaskDoc>).sort({ createdAt: 1 }).limit(2000).toArray();
    const visible = await this.visible(all, u);
    const open = visible.filter((t) => (OPEN as readonly string[]).includes(t.status));
    const me = u?.userId ?? null;
    let rows = visible.filter((t) => erpTaskTab(t.kind) === q.tab);
    if (q.mine && me) {
      const accs = await this.accountsOf(rows);
      rows = rows.filter((t) => t.createdBy === `user:${me}` || t.claim?.by === me || accs.get(t.accountId)?.owners.some((o) => o.userId === me));
    }
    const mismatch = q.tab === 'update' || q.mismatch === 'owner' ? await this.ownerMismatch(u) : null;
    const sync = await this.db.col<{ _id: string; lastSyncAt: Date | null }>(CUST_C.erpSync).findOne({ erp: 'vcsales' } as never, { projection: { lastSyncAt: 1 } });
    return {
      items: await this.views(rows, u),
      counts: {
        create: open.filter((t) => t.kind === 'create_customer').length,
        update: open.filter((t) => t.kind !== 'create_customer').length,
        mismatch: mismatch?.length ?? 0,
      },
      mismatch: q.mismatch === 'owner' ? mismatch : null,
      canProcess: this.isSaleAdmin(u),
      lastSyncAt: sync?.lastSyncAt ? sync.lastSyncAt.toISOString() : null,
      createUrl: this.createUrl(),
    };
  }

  private webUrl(): string | null {
    const web = process.env.VCSALE_WEB_URL?.trim().replace(/\/+$/, '');
    return this.vcsale.mode === 'http' && web ? web : null;
  }

  /** "Mở VCsales tạo mã": the create page of the VCsales web (VCsales does not take the customer from the link yet). */
  private createUrl(): string | null {
    const web = this.webUrl();
    return web ? `${web}/customer/create` : null;
  }

  async get(id: string, u: Subject | undefined): Promise<ErpTaskView> {
    const t = await this.col.findOne({ _id: id });
    if (!t || !(await this.visible([t], u)).length) throw new NotFoundException(NOT_FOUND);
    return (await this.views([t], u))[0]!;
  }

  private async accountsOf(tasks: Pick<ErpTaskDoc, 'accountId'>[]) {
    const ids = [...new Set(tasks.map((t) => t.accountId))];
    const rows = ids.length ? await this.accounts.find({ _id: { $in: ids } }, { projection: { name: 1, owners: 1, erpLinks: 1, status: 1, mergedInto: 1 } }).toArray() : [];
    return new Map(rows.map((a) => [a._id, a]));
  }

  /**
   * Tasks the caller may see: those he created; his own customers' (salespersons, MH-DK-12 "KD chỉ thấy phiếu khách
   * mình"); for sale admins, supervisors and directors the customers of their scope, and the tasks of their division.
   */
  private async visible(tasks: ErpTaskDoc[], u: Subject | undefined): Promise<ErpTaskDoc[]> {
    if (!u || !tasks.length) return tasks;
    const scope = await this.authz.customerScope(u, 'cust.view');
    if (!scope) return tasks;
    const accs = await this.accountsOf(tasks);
    const wide = hasKey(u, 'cust.erp_link') || hasKey(u, 'cust.transfer_approve');
    let inScope = new Set<string>();
    if (wide) {
      const vis = await this.customers.visibility(u, 'cust.view');
      const ids = [...accs.keys()];
      inScope = new Set((await this.accounts.find({ $and: [{ _id: { $in: ids } }, vis] } as Filter<CustomerAccountDoc>, { projection: { _id: 1 } }).toArray()).map((a) => a._id));
    }
    return tasks.filter((t) => {
      if (t.createdBy === `user:${u.userId}`) return true;
      if (accs.get(t.accountId)?.owners.some((o) => o.userId === u.userId)) return true;
      if (!wide) return false;
      return inScope.has(t.accountId) || (!!t.division && scope.divisions.includes(t.division));
    });
  }

  private async views(tasks: ErpTaskDoc[], u: Subject | undefined): Promise<ErpTaskView[]> {
    if (!tasks.length) return [];
    const accs = await this.accountsOf(tasks);
    const pointIds = [...new Set(tasks.flatMap((t) => [t.pointId, t.form?.phonePointId]).filter((x): x is string => !!x))];
    const points = new Map((pointIds.length ? await this.points.find({ _id: { $in: pointIds } }).toArray() : []).map((p) => [p._id, p]));
    const codes = [...new Set(tasks.flatMap((t) => [t.code, t.suggestion?.code, t.mainCode, ...t.otherCodes, ...(t.duplicates?.candidates.map((c) => c.code) ?? [])]).filter((x): x is string => !!x))];
    const snaps = new Map((codes.length ? await this.snapshots.find({ _id: { $in: codes.map((c) => `vcsales:${c}`) } }).toArray() : []).map((s) => [s.code, s]));
    const linked = await this.linkedAccounts(codes);
    const userIds = [
      ...new Set(
        tasks.flatMap((t) => [userOfActor(t.createdBy), t.claim?.by, t.toUserId, ...(accs.get(t.accountId)?.owners.map((o) => o.userId) ?? [])]).filter((x): x is string => !!x),
      ),
    ];
    const names = await this.customers.userNames(userIds);
    const sa = this.isSaleAdmin(u);
    const me = u?.userId ?? null;
    const now = Date.now();
    const web = this.webUrl();
    const candidate = (c: Omit<ErpTaskCandidate, 'linkedTo'>, accountId: string): ErpTaskCandidate => {
      const l = linked.get(c.code);
      return { ...c, linkedTo: l && l.accountId !== accountId ? l : null };
    };
    return tasks.map((t): ErpTaskView => {
      const acc = accs.get(t.accountId);
      const owners = (acc?.owners ?? []).map((o) => ({ userId: o.userId, userName: names.get(o.userId) ?? null }));
      const isOwner = !!me && owners.some((o) => o.userId === me);
      const creator = userOfActor(t.createdBy);
      const point = t.pointId ? points.get(t.pointId) : undefined;
      const phonePoint = t.form?.phonePointId ? points.get(t.form.phonePointId) : undefined;
      const snap = t.code ? snaps.get(t.code) : undefined;
      const mask = (kind: 'phone' | 'email', v: string) => (kind === 'phone' ? maskPhone(v) : maskEmail(v));
      let summary = 'Tạo mã KH mới';
      let owner: ErpTaskView['owner'] = null;
      if (t.kind === 'update_phone' || t.kind === 'update_email') {
        const kind = t.kind === 'update_phone' ? 'phone' : 'email';
        const old = ((kind === 'phone' ? snap?.phones : snap?.emails) ?? []).map((v) => mask(kind, v)).join(', ') || '—';
        summary = `${t.kind === 'update_phone' ? 'Đổi SĐT' : 'Đổi email'} ${old} → ${point ? mask(kind, point.value) : '—'}`;
      } else if (t.kind === 'change_owner') {
        const from = salespersonNames(snap);
        const to = t.toUserId ? (names.get(t.toUserId) ?? null) : null;
        const since = acc?.owners.find((o) => o.userId === t.toUserId)?.since ?? null;
        owner = { from, to, since: since ? since.toISOString() : null };
        summary = `Đổi NV phụ trách ${from.join(', ') || '—'} → ${to ?? '—'}${since ? ` từ ${fmtDay(since)}` : ''}`;
      } else if (t.kind === 'merge_codes') {
        summary = `Gộp mã ${t.otherCodes.join(', ')} vào ${t.mainCode}`;
      }
      const sugSnap = t.suggestion ? snaps.get(t.suggestion.code) : undefined;
      const claimLive = t.claim && t.claim.until.getTime() > now ? t.claim : null;
      const open = (OPEN as readonly string[]).includes(t.status);
      return {
        id: t._id,
        kind: t.kind,
        status: t.status,
        accountId: t.accountId,
        accountName: acc?.name ?? '(hồ sơ đã gộp hoặc đã xóa)',
        code: t.code,
        owners,
        summary,
        origin: t.origin,
        form: t.form ? { ...t.form, phoneMasked: phonePoint ? maskPhone(phonePoint.value) : null } : null,
        missing: t.kind === 'create_customer' ? erpFormMissing(t.form) : [],
        newValue: point ? { pointId: point._id, masked: mask(point.kind === 'email' ? 'email' : 'phone', point.value) } : null,
        merge: t.kind === 'merge_codes' && t.mainCode ? { mainCode: t.mainCode, otherCodes: t.otherCodes } : null,
        owner,
        claim: claimLive ? { by: claimLive.by, byName: names.get(claimLive.by) ?? null, until: claimLive.until.toISOString() } : null,
        duplicates: t.duplicates ? { at: t.duplicates.at.toISOString(), candidates: t.duplicates.candidates.map((c) => candidate(c, t.accountId)) } : null,
        suggestion:
          t.suggestion && sugSnap
            ? {
                ...candidate(
                  {
                    code: sugSnap.code,
                    name: sugSnap.name,
                    taxCode: sugSnap.taxCode,
                    address: sugSnap.address,
                    phones: sugSnap.phones.map((p) => maskPhone(p)),
                    salesperson: sugSnap.raw.salespersonName ?? null,
                    reasons: t.suggestion.reasons,
                  },
                  t.accountId,
                ),
                at: t.suggestion.at.toISOString(),
              }
            : null,
        reopenedNote: t.reopenedNote,
        vcsalesUrl: web && snap?.raw?.id ? `${web}/customer/${encodeURIComponent(snap.raw.id)}/edit` : null,
        returned: t.returned ? { missing: t.returned.missing, note: t.returned.note, by: t.returned.by, at: t.returned.at.toISOString() } : null,
        closeReason: t.closeReason,
        createdBy: t.createdBy,
        createdByName: creator ? (names.get(creator) ?? null) : t.createdBy === SYNC_ACTOR ? 'Đồng bộ VCsales' : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        doneBy: t.doneBy,
        doneAt: t.doneAt ? t.doneAt.toISOString() : null,
        can: {
          process: sa && open && (!claimLive || claimLive.by === me),
          editForm: t.kind === 'create_customer' && open && (sa || isOwner || creator === me),
        },
      };
    });
  }

  /** Account each code is linked to (confirmed), for "Mã [mã] đang gắn với [account]". */
  private async linkedAccounts(codes: string[]): Promise<Map<string, { accountId: string; name: string }>> {
    if (!codes.length) return new Map();
    const rows = await this.accounts
      .find({ status: 'active', erpLinks: { $elemMatch: { erp: 'vcsales', status: 'confirmed', customerId: { $in: codes } } } } as Filter<CustomerAccountDoc>, { projection: { name: 1, erpLinks: 1 } })
      .toArray();
    const out = new Map<string, { accountId: string; name: string }>();
    for (const a of rows) {
      const c = linkedCode(a);
      if (c) out.set(c, { accountId: a._id, name: a.name });
    }
    return out;
  }

  /**
   * 4a "Owner VClinks ≠ NV phụ trách VCsales": linked accounts with an owner whose VCsales salespersons are VClinks
   * users (by e-mail) and none of them is an owner. Salespersons without a VClinks account are not counted: nobody
   * can tell whether they are the owner (Quản trị → Kết nối VCsales lists them).
   */
  async ownerMismatch(u: Subject | undefined): Promise<ErpOwnerMismatchRow[]> {
    const vis = await this.customers.visibility(u, 'cust.view');
    const accs = await this.accounts
      .find(
        { $and: [{ status: 'active', 'owners.0': { $exists: true }, erpLinks: { $elemMatch: { erp: 'vcsales', status: 'confirmed' } } }, vis] } as Filter<CustomerAccountDoc>,
        { projection: { name: 1, owners: 1, erpLinks: 1 } },
      )
      .limit(10_000)
      .toArray();
    if (!accs.length) return [];
    const codeOf = new Map(accs.map((a) => [a._id, linkedCode(a)!]));
    const snaps = new Map(
      (
        await this.snapshots
          .find({ _id: { $in: [...codeOf.values()].map((c) => `vcsales:${c}`) } }, { projection: { code: 1, salespersonEmail: 1, 'raw.salespersons': 1, 'raw.salespersonName': 1, status: 1 } })
          .toArray()
      ).map((s) => [s.code, s]),
    );
    const emailsOf = (s: ErpCustomerDoc) => [...new Set([lower(s.salespersonEmail), ...(s.raw?.salespersons ?? []).filter((p) => p.active).map((p) => lower(p.email))].filter(Boolean))];
    const allEmails = [...new Set([...snaps.values()].flatMap(emailsOf))];
    const users = allEmails.length
      ? await this.db.col<UserDoc>(C.users).find({ email: { $in: allEmails } }, { projection: { _id: 1, email: 1 } }).toArray()
      : [];
    const userByEmail = new Map(users.map((x) => [lower(x.email), x._id]));
    const openTasks = new Map(
      (await this.col.find({ kind: 'change_owner', status: { $in: [...OPEN] }, accountId: { $in: accs.map((a) => a._id) } } as Filter<ErpTaskDoc>).toArray()).map((t) => [t.accountId, t._id]),
    );
    const rows: (ErpOwnerMismatchRow & { ownerIds: string[] })[] = [];
    for (const a of accs) {
      const s = snaps.get(codeOf.get(a._id)!);
      if (!s || s.status === 'deleted') continue;
      const spUsers = emailsOf(s)
        .map((e) => userByEmail.get(e))
        .filter((x): x is string => !!x);
      if (!spUsers.length || a.owners.some((o) => spUsers.includes(o.userId))) continue;
      rows.push({
        accountId: a._id,
        accountName: a.name,
        code: s.code,
        ownerIds: a.owners.map((o) => o.userId),
        owners: a.owners.map((o) => ({ userId: o.userId, userName: null, since: o.since.toISOString() })),
        salespersons: salespersonNames(s),
        taskId: openTasks.get(a._id) ?? null,
      });
    }
    const names = await this.customers.userNames([...new Set(rows.flatMap((r) => r.ownerIds))]);
    return rows.map(({ ownerIds: _ids, ...r }) => ({ ...r, owners: r.owners.map((o) => ({ ...o, userName: names.get(o.userId) ?? null })) }));
  }

  // ------------------------------------------------------------------------------------------------ creating

  async create(input: ErpTaskCreateInput, u: Subject | undefined, actor: string): Promise<ErpTaskView> {
    const acc = await this.accounts.findOne({ _id: input.accountId, status: 'active' });
    if (!acc) throw new NotFoundException('Không tìm thấy hồ sơ khách.');
    await this.customers.assertVisible(acc._id, u);
    const me = u?.userId ?? null;
    const isOwner = !!me && acc.owners.some((o) => o.userId === me);
    const sa = this.isSaleAdmin(u);
    const code = linkedCode(acc);
    const now = new Date();
    const base: ErpTaskDoc = {
      _id: `et_${randomUUID()}`,
      erp: 'vcsales',
      kind: input.kind,
      accountId: acc._id,
      division: acc.owners[0]?.division ?? u?.roles.find((r) => r.divisionId)?.divisionId ?? (process.env.AUTHZ_DEFAULT_DIVISION?.trim() || null),
      status: 'open',
      origin: '',
      code,
      form: null,
      pointId: null,
      mainCode: null,
      otherCodes: [],
      toUserId: null,
      sourceMessageIds: [],
      claim: null,
      duplicates: null,
      suggestion: null,
      returned: null,
      closeReason: null,
      closeNote: null,
      verifyAfter: null,
      reopenedNote: null,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
      doneBy: null,
      doneAt: null,
    };
    const who = me ? ((await this.customers.userNames([me])).get(me) ?? 'Người dùng') : 'Quản trị';
    const openOf = (filter: Record<string, unknown>) => this.col.findOne({ accountId: acc._id, status: { $in: [...OPEN] }, ...filter } as Filter<ErpTaskDoc>);
    let doc: ErpTaskDoc;
    switch (input.kind) {
      case 'create_customer': {
        if (!sa && !isOwner) throw new ForbiddenException('Chỉ người phụ trách khách hoặc sale admin đưa khách vào hàng chờ tạo mã.');
        if (code) throw new ConflictException(`Khách đã có mã KH ${code}.`);
        if (await openOf({ kind: 'create_customer' })) throw new ConflictException(`${acc.name} đã ở hàng Chờ tạo mã KH.`);
        await this.checkFormPhone(acc._id, input.form);
        doc = { ...base, code: null, form: input.form, origin: `${who} bấm "Đưa vào hàng chờ"` };
        break;
      }
      case 'update_phone':
      case 'update_email': {
        if (!sa && !isOwner) throw new ForbiddenException('Chỉ người phụ trách khách hoặc sale admin tạo đề xuất cập nhật VCsales.');
        if (!code) throw new BadRequestException('Khách chưa liên kết mã KH VCsales.');
        const kind = input.kind === 'update_phone' ? 'phone' : 'email';
        const p = await this.points.findOne({ _id: input.pointId, accountId: acc._id, kind, state: 'active' });
        if (!p) throw new BadRequestException(kind === 'phone' ? 'SĐT này không thuộc khách hoặc đã ngừng dùng.' : 'Email này không thuộc khách hoặc đã ngừng dùng.');
        if (verifyRank(p.level) < 2) throw new BadRequestException('Chỉ đề xuất SĐT / email đã xác thực (mức V2 trở lên).');
        const snap = await this.customers.erpSnapshot('vcsales', code);
        if (snap && (kind === 'phone' ? snap.phones : snap.emails).includes(p.value)) throw new BadRequestException('VCsales đã có thông tin này.');
        if (await openOf({ kind: input.kind, pointId: p._id })) throw new ConflictException('Đã có đề xuất cập nhật này trong hàng chờ.');
        doc = { ...base, pointId: p._id, origin: `${who} đề xuất (SĐT / email khách đang dùng khác VCsales)` };
        break;
      }
      case 'change_owner': {
        if (!sa && !isOwner && !(u && hasKey(u, 'cust.transfer_approve'))) throw new ForbiddenException('Chỉ người phụ trách, giám sát hoặc sale admin tạo việc đổi NV phụ trách.');
        if (!code) throw new BadRequestException('Khách chưa liên kết mã KH VCsales.');
        const toUserId = acc.owners[0]?.userId ?? null;
        if (!toUserId) throw new BadRequestException('Khách chưa có người phụ trách trong VClinks.');
        if (await openOf({ kind: 'change_owner' })) throw new ConflictException('Đã có việc đổi NV phụ trách của khách này.');
        doc = { ...base, toUserId, origin: 'Owner VClinks ≠ NV phụ trách VCsales' };
        break;
      }
      case 'merge_codes': {
        if (!sa) throw new ForbiddenException('Chỉ sale admin báo trùng mã trên VCsales.');
        const others = [...new Set(input.otherCodes)].filter((c) => c !== input.mainCode);
        if (!others.length) throw new BadRequestException('Chọn ít nhất một mã khác mã chính.');
        if (code && code !== input.mainCode) throw new BadRequestException(`Mã chính phải là mã khách đang liên kết: ${code}.`);
        for (const c of [input.mainCode, ...others]) {
          if (!(await this.customers.erpSnapshot('vcsales', c))) throw new NotFoundException(`Không tìm thấy mã ${c} trên VCsales.`);
        }
        const taken = await this.linkedAccounts(others);
        for (const c of others) {
          const l = taken.get(c);
          if (l && l.accountId !== acc._id) throw new ConflictException(`Mã ${c} đang gắn với ${l.name}. Gộp hai hồ sơ trước.`);
        }
        // BR11: one code per customer; the main one is linked now (MH-DK-10 #7).
        if (!code) await this.customers.confirmErpLink(acc._id, { erp: 'vcsales', customerId: input.mainCode }, u, actor);
        doc = { ...base, code: input.mainCode, mainCode: input.mainCode, otherCodes: others, origin: `${who} báo trùng trên VCsales` };
        break;
      }
    }
    await this.col.insertOne(doc);
    await this.db.audit(actor, `erp_task.${doc.kind}`, acc._id, { taskId: doc._id, code: doc.code, mainCode: doc.mainCode, otherCodes: doc.otherCodes.length ? doc.otherCodes : undefined });
    return (await this.views([doc], u))[0]!;
  }

  /** The phone of a create form is one of the customer's active phones, verified (V2+, MH-DK-12 #3). */
  private async checkFormPhone(accountId: string, form: ErpCreateForm) {
    if (!form.phonePointId) return;
    const p = await this.points.findOne({ _id: form.phonePointId, accountId, kind: 'phone', state: 'active' });
    if (!p) throw new BadRequestException('SĐT này không thuộc khách hoặc đã ngừng dùng.');
    if (verifyRank(p.level) < 2) throw new BadRequestException('Chọn SĐT đã xác thực (mức V2 trở lên).');
  }

  // ------------------------------------------------------------------------------------------------ processing

  private async load(id: string, u: Subject | undefined, opts: { process?: boolean; kinds?: 'create' | 'update' } = {}): Promise<ErpTaskDoc> {
    const t = await this.col.findOne({ _id: id });
    if (!t || !(await this.visible([t], u)).length) throw new NotFoundException(NOT_FOUND);
    if (opts.process) {
      if (!this.isSaleAdmin(u)) throw new ForbiddenException(SA_ONLY);
      if (!(OPEN as readonly string[]).includes(t.status)) throw new ConflictException('Việc này đã xong hoặc đã đóng.');
      const me = u?.userId ?? null;
      if (t.claim && t.claim.until.getTime() > Date.now() && t.claim.by !== me) {
        const name = (await this.customers.userNames([t.claim.by])).get(t.claim.by) ?? 'Người khác';
        throw new ConflictException(`${name} đang xử lý việc này.`);
      }
    }
    if (opts.kinds && erpTaskTab(t.kind) !== opts.kinds) throw new BadRequestException(opts.kinds === 'create' ? 'Chỉ áp dụng cho việc tạo mã KH.' : 'Chỉ áp dụng cho việc cập nhật VCsales.');
    return t;
  }

  /** "Nhận xử lý" (MH-DK-12 #8): the row is held 15 minutes for the caller; others see who holds it. */
  async claim(id: string, u: Subject | undefined, actor: string): Promise<ErpTaskView> {
    const t = await this.load(id, u, { process: true });
    const by = u?.userId ?? actor;
    const until = new Date(Date.now() + ERP_TASK_CLAIM_MINUTES * 60_000);
    await this.col.updateOne({ _id: t._id }, { $set: { claim: { by, until }, updatedAt: new Date() } });
    return this.get(t._id, u);
  }

  /** "Kiểm tra trùng trên VCsales" (#5): VCsales customers with the form's phone, tax code or a similar name. */
  async checkDuplicates(id: string, u: Subject | undefined, actor: string): Promise<ErpTaskView> {
    const t = await this.load(id, u, { process: true, kinds: 'create' });
    const acc = await this.accounts.findOne({ _id: t.accountId }, { projection: { name: 1 } });
    const phone = t.form?.phonePointId ? await this.points.findOne({ _id: t.form.phonePointId }) : null;
    const terms: [string, string][] = [];
    if (phone) terms.push([phone.value, 'SĐT']);
    if (t.form?.taxCode) terms.push([t.form.taxCode, 'MST']);
    for (const n of [t.form?.legalName, acc?.name]) if (n && n.trim().length >= 3 && !terms.some(([v]) => v === n.trim())) terms.push([n.trim(), 'tên giống']);
    const found = new Map<string, Omit<ErpTaskCandidate, 'linkedTo'>>();
    try {
      for (const [term, reason] of terms) {
        for (const x of await this.vcsale.searchCustomers(term, 10)) {
          if (x.status === 'deleted' || x.status === 'merged') continue;
          const c = found.get(x.code) ?? {
            code: x.code,
            name: x.name,
            taxCode: x.taxCode,
            address: x.address,
            phones: x.phones.map((p) => maskPhone(p)),
            salesperson: x.salespersonName,
            reasons: [],
          };
          if (!c.reasons.includes(reason)) c.reasons.push(reason);
          found.set(x.code, c);
        }
      }
    } catch (e) {
      if (e instanceof VcsaleUnavailableError) throw new ConflictException('Không kết nối được VCsales. Kiểm tra trùng và gợi ý gắn tạm dừng.');
      throw e;
    }
    const candidates = [...found.values()].slice(0, 10);
    await this.col.updateOne({ _id: t._id }, { $set: { duplicates: { at: new Date(), candidates }, updatedAt: new Date() } });
    await this.db.audit(actor, 'erp_task.check', t.accountId, { taskId: t._id, found: candidates.length });
    return this.get(t._id, u);
  }

  /**
   * "Kiểm tra và gắn" (#9, the code the sale admin just made) and "Gắn mã này" (#6, the code the sync found): links
   * the code like MH-DK-10 "Xác nhận" (sale admin, code on VCsales, not taken); the task leaves the queue at once.
   */
  async link(id: string, code: string, u: Subject | undefined, actor: string): Promise<{ task: ErpTaskView; message: string }> {
    const t = await this.load(id, u, { process: true, kinds: 'create' });
    const taken = (await this.linkedAccounts([code])).get(code);
    if (taken && taken.accountId !== t.accountId) throw new ConflictException(`Mã ${code} đang gắn với ${taken.name}.`);
    try {
      await this.customers.confirmErpLink(t.accountId, { erp: 'vcsales', customerId: code }, u, actor);
    } catch (e) {
      if (e instanceof NotFoundException && /trên VCsales/.test(e.message)) throw new NotFoundException(`Không tìm thấy mã ${code} trên VCsales.`);
      throw e;
    }
    const now = new Date();
    await this.col.updateOne({ _id: t._id }, { $set: { status: 'done', code, doneBy: actor, doneAt: now, updatedAt: now, claim: null } });
    await this.db.audit(actor, 'erp_task.done', t.accountId, { taskId: t._id, code });
    const acc = await this.accounts.findOne({ _id: t.accountId }, { projection: { name: 1 } });
    return { task: await this.get(t._id, u), message: `Đã liên kết ${code} với ${acc?.name ?? 'khách'}. Việc đã xong.` };
  }

  /** "Thiếu thông tin → trả sale": the owner (and whoever made the form) is told what to add. */
  async returnToSale(id: string, missing: ErpFormField[], note: string | null | undefined, u: Subject | undefined, actor: string): Promise<{ task: ErpTaskView; message: string }> {
    const t = await this.load(id, u, { process: true, kinds: 'create' });
    const now = new Date();
    await this.col.updateOne(
      { _id: t._id },
      { $set: { status: 'waiting_sale', returned: { missing, note: note ?? null, by: actor, at: now }, claim: null, updatedAt: now } },
    );
    const acc = await this.accounts.findOne({ _id: t.accountId }, { projection: { name: 1, owners: 1 } });
    const fields = missing.map((f) => ERP_FORM_FIELD_LABELS[f]).join(', ');
    const to = [...new Set([...(acc?.owners.map((o) => o.userId) ?? []), userOfActor(t.createdBy)].filter((x): x is string => !!x))];
    await this.notices.notify(to, 'erp_task.returned', `Phiếu tạo mã KH của ${acc?.name ?? 'khách'} cần bổ sung: ${fields}.`, '/customers/erp-tasks?tab=create');
    await this.db.audit(actor, 'erp_task.return', t.accountId, { taskId: t._id, missing });
    const names = await this.customers.userNames(to.slice(0, 1));
    return { task: await this.get(t._id, u), message: `Đã trả phiếu cho ${names.get(to[0] ?? '') ?? 'người phụ trách'} bổ sung ${fields}.` };
  }

  /** The salesperson (or the sale admin) completes the create form; a returned form goes back to the queue. */
  async updateForm(id: string, form: ErpCreateForm, u: Subject | undefined, actor: string): Promise<ErpTaskView> {
    const t = await this.load(id, u, { kinds: 'create' });
    const view = (await this.views([t], u))[0]!;
    if (!view.can.editForm) throw new ForbiddenException('Chỉ người phụ trách khách, người tạo phiếu hoặc sale admin sửa phiếu.');
    await this.checkFormPhone(t.accountId, form);
    await this.col.updateOne({ _id: t._id }, { $set: { form, status: 'open', updatedAt: new Date() } });
    await this.db.audit(actor, 'erp_task.form', t.accountId, { taskId: t._id, missing: erpFormMissing(form) });
    return this.get(t._id, u);
  }

  /** "Đã cập nhật trên VCsales" (update tab): done now; the next sync compares and opens it again if still different. */
  async markDone(id: string, u: Subject | undefined, actor: string): Promise<{ task: ErpTaskView; message: string }> {
    const t = await this.load(id, u, { process: true, kinds: 'update' });
    const now = new Date();
    await this.col.updateOne({ _id: t._id }, { $set: { status: 'done', doneBy: actor, doneAt: now, verifyAfter: now, reopenedNote: null, claim: null, updatedAt: now } });
    await this.db.audit(actor, 'erp_task.done', t.accountId, { taskId: t._id, kind: t.kind });
    return { task: await this.get(t._id, u), message: 'Đã ghi nhận cập nhật trên VCsales.' };
  }

  /** "Không tạo mã" (create tab): closed with a reason. */
  async close(id: string, reason: ErpCloseReason, note: string | null | undefined, u: Subject | undefined, actor: string): Promise<{ task: ErpTaskView; message: string }> {
    const t = await this.load(id, u, { process: true, kinds: 'create' });
    const now = new Date();
    await this.col.updateOne({ _id: t._id }, { $set: { status: 'closed', closeReason: reason, closeNote: note ?? null, doneBy: actor, doneAt: now, claim: null, updatedAt: now } });
    await this.db.audit(actor, 'erp_task.close', t.accountId, { taskId: t._id, reason });
    const acc = await this.accounts.findOne({ _id: t.accountId }, { projection: { name: 1 } });
    return { task: await this.get(t._id, u), message: `Đã đóng việc tạo mã cho ${acc?.name ?? 'khách'}.` };
  }

  // ------------------------------------------------------------------------------------------------ after a sync

  /**
   * Compares the queue with the snapshots a sync just refreshed (MH-DK-12 #6, "Đã cập nhật trên VCsales"):
   * - create tasks: a code with the form's phone or tax code, linked to nobody, becomes the suggestion "Gắn mã này";
   * - open update tasks already true on VCsales are done (the change was made there);
   * - update tasks marked done before this sync started and still different open again.
   */
  async afterSync(startedAt: Date): Promise<{ done: number; reopened: number; suggested: number }> {
    const out = { done: 0, reopened: 0, suggested: 0 };
    const now = new Date();
    const creates = await this.col.find({ kind: 'create_customer', status: { $in: [...OPEN] } } as Filter<ErpTaskDoc>).toArray();
    for (const t of creates) {
      const phone = t.form?.phonePointId ? await this.points.findOne({ _id: t.form.phonePointId, state: 'active' }) : null;
      const or: Filter<ErpCustomerDoc>[] = [];
      if (phone) or.push({ phones: phone.value });
      if (t.form?.taxCode) or.push({ taxCode: t.form.taxCode });
      if (!or.length) continue;
      const found = await this.snapshots.find({ erp: 'vcsales', status: { $nin: ['deleted', 'merged'] }, $or: or } as Filter<ErpCustomerDoc>).sort({ fetchedAt: -1 }).limit(5).toArray();
      const taken = await this.linkedAccounts(found.map((s) => s.code));
      const pick = found.find((s) => !taken.has(s.code) || taken.get(s.code)!.accountId === t.accountId);
      if (!pick || pick.code === t.suggestion?.code) continue;
      const reasons = [...(phone && pick.phones.includes(phone.value) ? ['SĐT'] : []), ...(t.form?.taxCode && pick.taxCode === t.form.taxCode ? ['MST'] : [])];
      await this.col.updateOne({ _id: t._id }, { $set: { suggestion: { code: pick.code, at: now, reasons }, updatedAt: now } });
      out.suggested++;
    }
    const updates = await this.col
      .find({ kind: { $ne: 'create_customer' }, $or: [{ status: { $in: [...OPEN] } }, { status: 'done', verifyAfter: { $ne: null, $lte: startedAt } }] } as Filter<ErpTaskDoc>)
      .toArray();
    for (const t of updates) {
      const ok = await this.trueOnVcsales(t);
      if (ok === null) continue;
      if (t.status === 'done') {
        if (ok) await this.col.updateOne({ _id: t._id }, { $set: { verifyAfter: null, updatedAt: now } });
        else {
          await this.col.updateOne(
            { _id: t._id },
            { $set: { status: 'open', verifyAfter: null, reopenedNote: `Đồng bộ lúc ${fmtTime(now)} vẫn thấy VCsales chưa đổi.`, doneBy: null, doneAt: null, updatedAt: now } },
          );
          const by = t.doneBy ? userOfActor(t.doneBy) : null;
          if (by) await this.notices.notify([by], 'erp_task.reopened', 'Một việc VCsales đã đánh dấu xong nhưng VCsales vẫn chưa đổi. Việc đã mở lại.', '/customers/erp-tasks?tab=update');
          out.reopened++;
        }
      } else if (ok) {
        await this.col.updateOne({ _id: t._id }, { $set: { status: 'done', doneBy: SYNC_ACTOR, doneAt: now, verifyAfter: null, claim: null, updatedAt: now } });
        out.done++;
      }
    }
    return out;
  }

  /** Whether VCsales already shows what the task asks for; null when it cannot be told (snapshot or point gone). */
  private async trueOnVcsales(t: ErpTaskDoc): Promise<boolean | null> {
    if (t.kind === 'merge_codes') {
      const others = await this.snapshots.find({ _id: { $in: t.otherCodes.map((c) => `vcsales:${c}`) } }).toArray();
      if (others.length < t.otherCodes.length) return null;
      return others.every((s) => s.status === 'deleted' || s.status === 'merged' || s.mergedInto === t.mainCode);
    }
    if (!t.code) return null;
    const snap = await this.snapshots.findOne({ _id: `vcsales:${t.code}` });
    if (!snap) return null;
    if (t.kind === 'update_phone' || t.kind === 'update_email') {
      const p = t.pointId ? await this.points.findOne({ _id: t.pointId }) : null;
      if (!p) return null;
      return (t.kind === 'update_phone' ? snap.phones : snap.emails).includes(p.value);
    }
    if (t.kind === 'change_owner') {
      if (!t.toUserId) return null;
      const user = await this.db.col<UserDoc>(C.users).findOne({ _id: t.toUserId }, { projection: { email: 1 } });
      if (!user?.email) return null;
      const emails = [lower(snap.salespersonEmail), ...(snap.raw?.salespersons ?? []).filter((s) => s.active).map((s) => lower(s.email))];
      return emails.includes(lower(user.email));
    }
    return null;
  }
}
