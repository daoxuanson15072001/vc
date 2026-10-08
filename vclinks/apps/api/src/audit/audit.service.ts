import { BadRequestException, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_DEFAULT_GROUPS,
  AUDIT_EXPORT_MAX_ROWS,
  AUDIT_GROUPS,
  AUDIT_GROUP_KEYS,
  AUDIT_MAX_DAYS,
  AUDIT_ACTOR_LABELS,
  ROLE_LABELS,
  auditGroupOf,
  parseActor,
  type ActivityRow,
  type AuditGroup,
  type AuditPage,
  type AuditQuery,
  type AuditRow,
} from '@vclinks/shared';
import type { Filter } from 'mongodb';
import { AuthzService } from '../authz/authz.service';
import { hasKey, type Subject } from '../authz/engine';
import { C, DbService } from '../db/db.service';
import { runAsTenant, runUnscoped } from '../db/tenant-context';
import type { UserDoc } from '../users/users.service';
import { sanitizeDetail } from './sanitize';
import { vnDate } from './vn-time';

interface AuditDoc {
  _id: unknown;
  actor: string;
  action: string;
  target: string;
  at: Date;
  detail?: Record<string, unknown>;
  ip?: string;
}

/** Who the viewer may read about: every actor, or an explicit set of user ids (DV, TO, SELF). */
export interface AuditVisibility {
  all: boolean;
  userIds: Set<string>;
}

const DAY = 86_400_000;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `^(a|b)([._]|$)` for a group's prefixes (exact action or `prefix.` / `prefix_`). */
const groupRegex = (g: AuditGroup) => new RegExp(`^(${AUDIT_GROUPS[g].prefixes.map(esc).join('|')})([._]|$)`);

/**
 * Reads the access log (MH-PQ-10). The log is the existing `audit_log`: this service only reads it, narrows it
 * to what the viewer's `audit.view` scope covers, and records that someone looked at one person (PQ-40).
 */
@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
  ) {}

  /**
   * Retention of client addresses on audit lines (L-03, NĐ 13): `ip` is removed from lines older than
   * AUDIT_IP_RETENTION_DAYS (default 90, at least 31 so rule R6 keeps its 30-day window); the line stays.
   * Runs every AUDIT_IP_SWEEP_MS (default daily, 0 disables).
   */
  onModuleInit() {
    const ms = Number(process.env.AUDIT_IP_SWEEP_MS ?? 86_400_000);
    if (ms > 0) {
      this.timer = setInterval(() => void this.dropOldIps().catch((e) => this.logger.warn(`ip retention: ${e instanceof Error ? e.message : String(e)}`)), ms);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Removes `ip` from audit lines older than the retention, in every tenant. Returns the number of lines changed. */
  async dropOldIps(now = new Date()): Promise<number> {
    const days = Math.max(31, Number(process.env.AUDIT_IP_RETENTION_DAYS ?? 90) || 90);
    const before = new Date(now.getTime() - days * 86_400_000);
    let n = 0;
    for (const t of await this.db.tenants()) {
      n += await runAsTenant(t, async () => (await this.db.col(C.auditLog).updateMany({ ip: { $exists: true }, at: { $lt: before } } as never, { $unset: { ip: '' } })).modifiedCount);
    }
    return n;
  }

  /** id → full name of the tenant's users. */
  async userNames(): Promise<Map<string, string>> {
    const users = await runUnscoped(() => this.db.col<UserDoc>(C.users).find({}, { projection: { fullName: 1 } }).toArray());
    return new Map(users.map((u) => [String(u._id), u.fullName]));
  }

  /** TD and Tập đoàn scope read everything; DV, TO and SELF read the users their scope covers. */
  async visibility(u: Subject): Promise<AuditVisibility> {
    if (hasKey(u, 'audit.view', { scopes: ['TD', 'ALL'] })) return { all: true, userIds: new Set() };
    const names = await this.userNames();
    const ids = new Set<string>();
    for (const id of names.keys()) if (id === u.userId || (await this.authz.canOnUser(u, 'audit.view', id))) ids.add(id);
    ids.add(u.userId);
    return { all: false, userIds: ids };
  }

  private actorForms(ids: Iterable<string>): string[] {
    const out: string[] = [];
    for (const id of ids) out.push(id, `user:${id}`);
    return out;
  }

  /** `from`/`to` as dates; date-only `to` includes that whole day. Default: the last 7 days. */
  private range(q: Pick<AuditQuery, 'from' | 'to'>): { from: Date; to: Date } {
    const now = new Date();
    let to = now;
    if (q.to) {
      to = new Date(q.to);
      if (Number.isNaN(to.getTime())) throw new BadRequestException('Thời gian không hợp lệ.');
      if (/^\d{4}-\d{2}-\d{2}$/.test(q.to)) to = new Date(to.getTime() + DAY - 1);
    }
    let from = new Date(to.getTime() - 7 * DAY);
    if (q.from) {
      from = new Date(q.from);
      if (Number.isNaN(from.getTime())) throw new BadRequestException('Thời gian không hợp lệ.');
    }
    if (from > to) throw new BadRequestException('Thời gian không hợp lệ.');
    if (to.getTime() - from.getTime() > AUDIT_MAX_DAYS * DAY) throw new BadRequestException(`Tối đa ${AUDIT_MAX_DAYS} ngày mỗi lần tra.`);
    return { from, to };
  }

  private async filterOf(q: AuditQuery, vis: AuditVisibility): Promise<Filter<AuditDoc>> {
    const { from, to } = this.range(q);
    const and: Filter<AuditDoc>[] = [{ at: { $gte: from, $lte: to } }];
    if (!vis.all) and.push({ actor: { $in: this.actorForms(vis.userIds) } });
    if (q.actor) and.push({ actor: { $in: [q.actor, `user:${q.actor}`, `token:${q.actor}`] } });
    if (q.actorType === 'system') and.push({ actor: 'system' });
    if (q.actorType === 'ai') and.push({ actor: /^token:/, action: /^mcp\./ });
    if (q.actorType === 'device') and.push({ actor: /^token:/, action: { $not: /^mcp\./ } });
    if (q.actorType === 'user') and.push({ actor: { $nin: ['system'] } }, { actor: { $not: /^token:/ } });
    // No `groups` = the default set (view phone, export, delete); an empty one = every group.
    if (q.groups !== '') {
      const picked = q.groups === undefined ? AUDIT_DEFAULT_GROUPS : q.groups.split(',').filter((g): g is AuditGroup => AUDIT_GROUP_KEYS.includes(g as AuditGroup));
      if (picked.length) and.push({ $or: picked.map((g) => ({ action: groupRegex(g) })) });
    }
    if (q.action) and.push({ action: q.action });
    if (q.target) {
      // A customer code also matches the `targets[]` of an AI read or an export (PQ-47).
      and.push({ $or: [{ target: new RegExp(esc(q.target), 'i') }, { 'detail.targets': q.target }] });
    }
    return { $and: and };
  }

  private rowOf(d: AuditDoc, names: Map<string, string>, withIp: boolean): AuditRow {
    const a = parseActor(d.actor, d.action, (id) => names.has(id));
    return {
      id: String(d._id),
      at: d.at.toISOString(),
      actorType: a.type,
      actorId: a.id,
      actorName: a.type === 'user' ? (names.get(a.id) ?? a.id) : a.type === 'system' ? AUDIT_ACTOR_LABELS.system : a.id,
      action: d.action,
      actionLabel: AUDIT_ACTION_LABELS[d.action] ?? d.action,
      group: auditGroupOf(d.action),
      target: d.target,
      targetLabel: names.get(d.target) ?? d.target,
      ...(d.detail ? { detail: sanitizeDetail(d.detail) } : {}),
      ...(withIp && d.ip ? { ip: d.ip } : {}),
    };
  }

  /**
   * One page of the log. Filtering by one person other than yourself is itself logged as `audit.view_person`
   * with your role and name, so that person sees it in "Hoạt động của tôi" (PQ-40, UAT-PQ-86).
   */
  async list(u: Subject, q: AuditQuery): Promise<AuditPage> {
    const vis = await this.visibility(u);
    const filter = await this.filterOf(q, vis);
    const names = await this.userNames();
    if (q.actor && q.actor !== u.userId && names.has(q.actor)) await this.recordViewPerson(u, q.actor, names);
    const size = q.pageSize ?? 50;
    const col = this.db.col<AuditDoc>(C.auditLog);
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ at: -1, _id: -1 }).skip(((q.page ?? 1) - 1) * size).limit(size).toArray(),
      col.countDocuments(filter),
    ]);
    // The address is personal data of the staff member: only Admin / kiểm toán (whole-tenant audit scope) read it.
    return { items: docs.map((d) => this.rowOf(d, names, vis.all)), total };
  }

  private async recordViewPerson(u: Subject, personId: string, names: Map<string, string>) {
    const role = u.roles[0];
    await this.db.audit(`user:${u.userId}`, 'audit.view_person', personId, {
      viewerName: names.get(u.userId) ?? u.userId,
      viewerRole: role ? (role.custom?.name ?? ROLE_LABELS[role.roleKey]) : 'Quản trị',
    });
  }

  /** The filtered log as rows for the xlsx export (the export itself is logged). */
  async exportRows(u: Subject, q: AuditQuery): Promise<{ header: string[]; rows: string[][]; count: number }> {
    const vis = await this.visibility(u);
    const filter = await this.filterOf(q, vis);
    const names = await this.userNames();
    const col = this.db.col<AuditDoc>(C.auditLog);
    const total = await col.countDocuments(filter);
    if (total > AUDIT_EXPORT_MAX_ROWS) throw new BadRequestException(`Quá ${AUDIT_EXPORT_MAX_ROWS.toLocaleString('vi-VN')} dòng. Thu hẹp khoảng thời gian.`);
    const docs = await col.find(filter).sort({ at: -1 }).limit(AUDIT_EXPORT_MAX_ROWS).toArray();
    const rows = docs.map((d) => {
      const r = this.rowOf(d, names, false);
      return [r.at, r.actorName, AUDIT_ACTOR_LABELS[r.actorType], r.actionLabel, r.targetLabel, r.detail ? JSON.stringify(r.detail) : ''];
    });
    await this.db.audit(`user:${u.userId}`, 'audit.export', 'audit_log', { rows: rows.length });
    return { header: ['Thời điểm', 'Người', 'Chủ thể', 'Hành động', 'Đối tượng', 'Chi tiết'], rows, count: rows.length };
  }

  /** "Hoạt động của tôi": own lines, who looked at my log, and what AI read for me (PQ-47). */
  async activity(userId: string, days = 30): Promise<ActivityRow[]> {
    const names = await this.userNames();
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), AUDIT_MAX_DAYS) * DAY);
    const docs = await this.db
      .col<AuditDoc>(C.auditLog)
      .find({ at: { $gte: since }, $or: [{ actor: { $in: [userId, `user:${userId}`] } }, { action: 'audit.view_person', target: userId }] })
      .sort({ at: -1 })
      .limit(300)
      .toArray();
    const rows: ActivityRow[] = docs.map((d) => {
      if (d.action === 'audit.view_person' && d.target === userId) {
        const who = `${String(d.detail?.viewerRole ?? 'Quản trị')} ${String(d.detail?.viewerName ?? '')}`.trim();
        return { at: d.at.toISOString(), action: d.action, text: `${who} đã xem nhật ký của bạn (${vnDate(d.at)})` };
      }
      const label = AUDIT_ACTION_LABELS[d.action] ?? d.action;
      const t = names.get(d.target) ?? d.target;
      return { at: d.at.toISOString(), action: d.action, text: `${label}: ${t}` };
    });
    // AI reads on my behalf, one line per day (PQ-47).
    const ai = await this.db
      .col<AuditDoc>(C.auditLog)
      .find({ at: { $gte: since }, action: 'mcp.call', 'detail.userId': userId })
      .toArray();
    const perDay = new Map<string, { customers: Set<string>; conversations: Set<string>; at: Date }>();
    for (const d of ai) {
      const key = vnDate(d.at);
      const e = perDay.get(key) ?? perDay.set(key, { customers: new Set(), conversations: new Set(), at: d.at }).get(key)!;
      for (const t of (d.detail?.targets as string[] | undefined) ?? []) (t.includes(':') ? e.conversations : e.customers).add(t);
    }
    for (const [day, e] of perDay) {
      rows.push({ at: e.at.toISOString(), action: 'mcp.call', text: `AI đã đọc ${e.customers.size} khách, ${e.conversations.size} hội thoại (${day})` });
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }

  /** Tổng quan kiểm soát (MH-PQ-10 #6d): counts per group and the top 10 people per sensitive action. */
  async overview(u: Subject, period: 'week' | 'month' | 'quarter') {
    const vis = await this.visibility(u);
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY);
    const prevFrom = new Date(from.getTime() - days * DAY);
    const names = await this.userNames();
    const scope: Filter<AuditDoc> = vis.all ? {} : { actor: { $in: this.actorForms(vis.userIds) } };
    const col = this.db.col<AuditDoc>(C.auditLog);
    const countGroups = async (a: Date, b: Date) => {
      const out: Record<string, number> = {};
      for (const g of AUDIT_GROUP_KEYS) out[g] = await col.countDocuments({ ...scope, at: { $gte: a, $lt: b }, action: groupRegex(g) });
      return out;
    };
    const top = async (action: string) => {
      const rows = await col
        .aggregate<{ _id: string; n: number }>([
          { $match: { ...scope, action, at: { $gte: from, $lt: to } } },
          { $group: { _id: '$actor', n: { $sum: 1 } } },
          { $sort: { n: -1 } },
          { $limit: 10 },
        ])
        .toArray();
      return rows.map((r) => {
        const a = parseActor(r._id, action, (id) => names.has(id));
        return { actorId: a.id, actorName: names.get(a.id) ?? a.id, count: r.n };
      });
    };
    return {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      groups: await countGroups(from, to),
      previous: await countGroups(prevFrom, from),
      top: { 'phone.reveal': await top('phone.reveal'), 'export.create': await top('export.create'), 'customer.view': await top('customer.view'), 'mcp.call': await top('mcp.call') },
      openAlerts: await this.db.col(C.alerts).countDocuments({ status: { $ne: 'da_xu_ly' } }),
    };
  }
}
