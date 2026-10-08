import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  ALERT_STATUSES,
  DEFAULT_ALERT_RULES,
  parseActor,
  type AlertRuleDef,
  type AlertRulePatch,
  type AlertRuleView,
  type AlertStatus,
  type AlertView,
} from '@vclinks/shared';
import { AuthzService } from '../authz/authz.service';
import { hasKey, type Subject } from '../authz/engine';
import { C, DbService, type AuditEntry } from '../db/db.service';
import { currentTenant, runUnscoped } from '../db/tenant-context';
import type { UserDoc } from '../users/users.service';
import { isOffHours, vnParts } from './vn-time';

export interface AlertDoc {
  _id: string;
  ruleCode: string;
  /** User id, or the token name for an AI / device. */
  personId: string;
  personName: string;
  at: Date;
  /** Counts, times and reasons only (no text, no phone). */
  detail: Record<string, unknown>;
  recipientIds: string[];
  status: AlertStatus;
  handledBy?: string;
  handledAt?: Date;
  note?: string;
}

interface RuleDoc extends Partial<AlertRulePatch> {
  _id: string;
  updatedAt: Date;
  updatedBy: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LEAD_ROLES = ['giam_sat_bh', 'giam_doc_bh'];
/** What a person is warned with when his own action raised an alert (UAT-PQ-28). */
export const SELF_WARNING = 'Bạn đã hiện SĐT nhiều lần trong 1 giờ. Quản lý của bạn đã được thông báo.';
const OFF_HOURS_ACTIONS = new Set(['login', 'conversation.view', 'mcp.call']);
/** Actions some rule reads (plus `export.*`); any other audit line is skipped at once. */
const RULE_ACTIONS = new Set(['phone.reveal', 'customer.view', 'mcp.call', 'grant.request', ...OFF_HOURS_ACTIONS]);

/**
 * Abnormal-access alerts (MH-PQ-14, PQ-46). Every audit line passes through `evaluate`; a rule that is over its
 * threshold raises one alert (de-duplicated per rule and person for the rule's window) addressed to the people the
 * rule names whose `audit.view` scope covers the person. The person is never a recipient.
 * Delivery is in the app (alerts list); e-mail and Zalo OA (Q-PQ-23) are not connected yet.
 */
@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly rulesCache = new Map<string, { at: number; rules: AlertRuleView[] }>();

  constructor(
    private readonly db: DbService,
    private readonly authz: AuthzService,
  ) {}

  onModuleInit() {
    this.db.onAudit((e) => this.evaluate(e));
  }

  // ------------------------------------------------------------------ rules

  async rules(): Promise<AlertRuleView[]> {
    const key = currentTenant();
    const hit = this.rulesCache.get(key);
    if (hit && Date.now() - hit.at < 10_000) return hit.rules;
    const stored = new Map((await this.db.col<RuleDoc>(C.alertRules).find({}).toArray()).map((d) => [String(d._id), d]));
    const rules = DEFAULT_ALERT_RULES.map((def): AlertRuleView => {
      const o = stored.get(def.code);
      const { _id, updatedAt, updatedBy, ...patch } = o ?? ({} as RuleDoc);
      void _id;
      void updatedBy;
      return { ...def, ...patch, enabled: def.ready && (patch.enabled ?? true), ...(updatedAt ? { updatedAt: updatedAt.toISOString() } : {}) };
    });
    this.rulesCache.set(key, { at: Date.now(), rules });
    return rules;
  }

  async saveRule(code: string, patch: AlertRulePatch, by: string): Promise<AlertRuleView> {
    const def = DEFAULT_ALERT_RULES.find((r) => r.code === code);
    if (!def) throw new NotFoundException('Không có quy tắc này.');
    if (!def.ready && patch.enabled) throw new BadRequestException(`Quy tắc ${code} chưa áp dụng được: ${def.waitingFor}.`);
    if (code === 'R7' && patch.threshold !== undefined && (patch.threshold < 0.1 || patch.threshold > 1)) {
      throw new BadRequestException('Hệ số của R7 từ 0,1 đến 1.');
    }
    await this.db.col<RuleDoc>(C.alertRules).updateOne({ _id: code }, { $set: { ...patch, updatedAt: new Date(), updatedBy: by } }, { upsert: true });
    this.rulesCache.delete(currentTenant());
    // The audit line notifies the observers (QS) of the change (MH-PQ-14: "QS nhận thông báo thay đổi").
    await this.db.audit(`user:${by}`, 'alert.config', code, { fields: Object.keys(patch), notifyQuanSat: true });
    return (await this.rules()).find((r) => r.code === code)!;
  }

  async proposeRule(code: string, by: string, proposal: AlertRulePatch): Promise<void> {
    if (!DEFAULT_ALERT_RULES.some((r) => r.code === code)) throw new NotFoundException('Không có quy tắc này.');
    await this.db.audit(`user:${by}`, 'alert.propose', code, { fields: Object.keys(proposal) });
  }

  // ------------------------------------------------------------- evaluation

  private async countOf(actors: string[], actionRe: RegExp, since: Date, distinct = false, extra: Record<string, unknown> = {}): Promise<number> {
    const f = { actor: { $in: actors }, action: actionRe, at: { $gte: since }, ...extra };
    const col = this.db.col<{ target: string }>(C.auditLog);
    return distinct ? (await col.distinct('target', f as never)).length : col.countDocuments(f as never);
  }

  /** Reads one audit line and raises alerts for the rules it pushes over their thresholds. */
  async evaluate(e: AuditEntry): Promise<void> {
    if (e.actor === 'system' || e.action.startsWith('alert.') || e.action.startsWith('audit.')) return;
    // Most lines (ingest, outbox, ...) feed no rule: leave before any query so audit writes stay cheap.
    if (!RULE_ACTIONS.has(e.action) && !e.action.startsWith('export.')) return;
    const who = parseActor(e.actor, e.action);
    const forms = who.type === 'user' ? [who.id, `user:${who.id}`] : [e.actor];
    const rules = new Map((await this.rules()).filter((r) => r.enabled).map((r) => [r.code, r]));
    if (!rules.size) return;
    let roles: string[] = [];
    if (who.type === 'user') roles = (await this.authz.subject(who.id)).roles.map((r) => r.roleKey);
    const lead = roles.some((r) => LEAD_ROLES.includes(r));
    const now = e.at;

    const r1 = rules.get('R1');
    if (r1 && e.action === 'phone.reveal') {
      const hour = await this.countOf(forms, /^phone\.reveal$/, new Date(now.getTime() - r1.windowMin * 60_000));
      const day = await this.countOf(forms, /^phone\.reveal$/, new Date(now.getTime() - DAY));
      const hl = lead ? (r1.leadThreshold ?? r1.threshold) : r1.threshold;
      const dl = lead ? (r1.leadDayThreshold ?? r1.dayThreshold ?? 0) : (r1.dayThreshold ?? 0);
      if (hour > hl) await this.raise(r1, who, { count: hour, windowMin: r1.windowMin, limit: hl }, r1.windowMin);
      else if (dl && day > dl) await this.raise(r1, who, { count: day, windowMin: 1440, limit: dl }, 1440);
    }

    const r2 = rules.get('R2');
    if (r2 && e.action === 'customer.view') {
      const since = new Date(now.getTime() - DAY);
      const mine = await this.db.col<{ target: string; at: Date }>(C.auditLog).find({ actor: { $in: forms }, action: 'customer.view', at: { $gte: since } }, { projection: { target: 1, at: 1 } }).toArray();
      const distinct = new Set(mine.map((m) => m.target)).size;
      const prior = await this.db
        .col<{ target: string; at: Date }>(C.auditLog)
        .find({ actor: { $in: forms }, action: 'customer.view', at: { $gte: new Date(since.getTime() - 30 * DAY), $lt: since } }, { projection: { target: 1, at: 1 } })
        .toArray();
      // Average profiles per day over the previous 30 days (distinct per day, summed, divided by 30).
      const perDay = new Map<string, Set<string>>();
      for (const p of prior) (perDay.get(vnParts(p.at).day) ?? perDay.set(vnParts(p.at).day, new Set()).get(vnParts(p.at).day)!).add(p.target);
      const avg = Math.max([...perDay.values()].reduce((s, x) => s + x.size, 0) / 30, 1);
      if (distinct >= (r2.minDistinct ?? 40) && distinct > (r2.factor ?? r2.threshold) * avg) {
        const times = mine.map((m) => m.at.getTime());
        const spanMin = Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 60_000));
        await this.raise(r2, who, { count: distinct, spanMin, average: Math.round(avg) }, 1440);
      }
    }

    const r3 = rules.get('R3');
    if (r3 && e.action.startsWith('export.')) {
      const reasons: string[] = [];
      if (e.detail?.withPhone) reasons.push('kèm SĐT');
      const rows = Number(e.detail?.rows ?? 0);
      if (rows > r3.threshold) reasons.push(`${rows} dòng`);
      if ((await this.countOf(forms, /^export\./, new Date(now.getTime() - DAY))) > 1) reasons.push('xuất nhiều hơn 1 lần trong ngày');
      if (isOffHours(now)) reasons.push('ngoài giờ làm');
      if (reasons.length) await this.raise(r3, who, { reasons, rows }, 60);
    }

    const r4 = rules.get('R4');
    if (r4 && e.action === 'mcp.call') {
      const calls = await this.countOf(forms, /^mcp\.call$/, new Date(now.getTime() - HOUR));
      const customers = await this.countOf(forms, /^mcp\.call$/, new Date(now.getTime() - DAY), true);
      if (calls > r4.threshold || customers > (r4.dayThreshold ?? Infinity)) await this.raise(r4, who, { calls, customers }, 60);
    }

    const r5 = rules.get('R5');
    if (r5 && OFF_HOURS_ACTIONS.has(e.action) && isOffHours(now)) {
      const p = vnParts(now);
      await this.raise(r5, who, { action: e.action, hour: p.hour, sunday: p.weekday === 0 }, 1440);
    }

    // R6: a login or MCP call from an address this person has not used in the last 30 days (the person must have
    // a history with another address, otherwise the first lines after the log began recording IPs would all alert).
    // The address itself is never put in the alert: supervisors may read alerts but not addresses (L-03).
    const r6 = rules.get('R6');
    if (r6 && e.ip && (e.action === 'login' || e.action === 'mcp.call')) {
      const since = new Date(now.getTime() - r6.windowMin * 60_000);
      const col = this.db.col<{ ip?: string }>(C.auditLog);
      const known = await col.countDocuments({ actor: { $in: forms }, ip: e.ip, at: { $gte: since, $lt: now } } as never, { limit: 1 });
      if (!known && (await col.countDocuments({ actor: { $in: forms }, ip: { $exists: true }, at: { $gte: since, $lt: now } } as never, { limit: 1 }))) {
        await this.raise(r6, who, { action: e.action }, 1440);
      }
    }

    // R7: a person flagged "Sắp nghỉ" runs at a quarter of the limits (PQ-45, PQ-82); every export and every
    // temporary-grant request of this person is reported at once.
    const r7 = rules.get('R7');
    if (r7 && who.type === 'user') {
      const flagged = await runUnscoped(() => this.db.col<UserDoc>(C.users).findOne({ _id: who.id as never, preLeave: { $exists: true } } as never, { projection: { _id: 1 } }));
      if (flagged) {
        if (e.action === 'customer.view') {
          const n = (await this.db.col<{ target: string }>(C.auditLog).distinct('target', { actor: { $in: forms }, action: 'customer.view', at: { $gte: new Date(now.getTime() - DAY) } } as never)).length;
          const limit = Math.ceil((rules.get('R2')?.minDistinct ?? 40) * r7.threshold);
          if (n >= limit) await this.raise(r7, who, { kind: 'customer.view', count: n }, 1440);
        } else if (e.action === 'phone.reveal') {
          const n = await this.countOf(forms, /^phone\.reveal$/, new Date(now.getTime() - HOUR));
          if (n > (rules.get('R1')?.threshold ?? 20) * r7.threshold) await this.raise(r7, who, { kind: 'phone.reveal', count: n }, 60);
        } else if (e.action.startsWith('export.') || e.action === 'grant.request') {
          await this.raise(r7, who, { kind: e.action.startsWith('export.') ? 'export' : 'grant.request' }, 1440);
        }
      }
    }

    const r8 = rules.get('R8');
    if (r8 && e.action === 'grant.request') {
      const n = await this.countOf(forms, /^grant\.request$/, new Date(now.getTime() - r8.windowMin * 60_000));
      if (n > r8.threshold) await this.raise(r8, who, { count: n, windowMin: r8.windowMin }, r8.windowMin);
    }

    const r9 = rules.get('R9');
    if (r9 && e.action === 'conversation.view' && (e.detail?.via === 'YC' || roles.includes('quan_sat'))) {
      const n = await this.countOf(forms, /^conversation\.view$/, new Date(now.getTime() - DAY), true);
      if (n > r9.threshold) await this.raise(r9, who, { count: n }, 1440);
    }
  }

  /** Recipients of a rule for one person: the role holders whose audit scope covers him, never himself. */
  private async recipientsOf(rule: AlertRuleDef, personId: string, isUser: boolean): Promise<string[]> {
    const assigned = await runUnscoped(() =>
      this.db.col<{ userId: string; roleKey: string }>('role_assignments').find({ roleKey: { $in: rule.recipients } as never }).toArray(),
    );
    const out = new Set<string>();
    for (const a of assigned) {
      if (a.userId === personId || out.has(a.userId)) continue;
      const s = await this.authz.subject(a.userId);
      if (!s.active) continue;
      const ok = isUser ? await this.authz.canOnUser(s, 'audit.view', personId) : hasKey(s, 'audit.view', { scopes: ['TD', 'ALL'] });
      if (ok) out.add(a.userId);
    }
    return [...out];
  }

  private async raise(rule: AlertRuleView, who: { type: string; id: string }, detail: Record<string, unknown>, dedupeMin: number) {
    const names = who.type === 'user' ? new Map([[who.id, (await runUnscoped(() => this.db.col<UserDoc>(C.users).findOne({ _id: who.id })))?.fullName ?? who.id]]) : new Map<string, string>();
    const personName = names.get(who.id) ?? who.id;
    const col = this.db.col<AlertDoc>(C.alerts);
    const since = new Date(Date.now() - Math.max(dedupeMin, 60) * 60_000);
    const open = await col.findOne({ ruleCode: rule.code, personId: who.id, status: { $ne: 'da_xu_ly' }, at: { $gte: since } });
    if (open) {
      await col.updateOne({ _id: open._id }, { $set: { detail } });
      return;
    }
    const recipientIds = await this.recipientsOf(rule, who.id, who.type === 'user');
    await col.insertOne({
      _id: `al_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      ruleCode: rule.code,
      personId: who.id,
      personName,
      at: new Date(),
      detail,
      recipientIds,
      status: 'moi',
    });
  }

  /** The warning shown to the person whose own action raised an alert (never the alert itself). */
  async warningFor(userId: string, ruleCode: string): Promise<string | null> {
    const hit = await this.db.col<AlertDoc>(C.alerts).findOne({ ruleCode, personId: userId, status: { $ne: 'da_xu_ly' }, at: { $gte: new Date(Date.now() - HOUR) } });
    return hit ? SELF_WARNING : null;
  }

  // ------------------------------------------------------------------- views

  private summary(a: AlertDoc, rule?: AlertRuleView): string {
    const d = a.detail as Record<string, number | string | boolean | string[]>;
    const p = a.personName;
    switch (a.ruleCode) {
      case 'R1':
        return `${p} đã hiện SĐT ${d.count} lần trong ${Number(d.windowMin) >= 1440 ? '24 giờ' : '1 giờ'} qua.`;
      case 'R2':
        return `${p} đã mở ${d.count} hồ sơ khác nhau trong ${Number(d.spanMin) <= 120 ? `${d.spanMin} phút` : '24 giờ'} (mức thường ${d.average}/ngày).`;
      case 'R3':
        return `${p} xuất file (${(d.reasons as string[]).join(', ')}).`;
      case 'R4':
        return `${p}: AI gọi ${d.calls} lần trong 1 giờ, đã trả ${d.customers} đối tượng khác nhau trong 24 giờ.`;
      case 'R5':
        return `${p} truy cập ngoài giờ (${d.sunday ? 'Chủ nhật' : `${String(d.hour).padStart(2, '0')}h`}).`;
      case 'R6':
        return `${p} ${d.action === 'mcp.call' ? 'cho AI đọc dữ liệu' : 'đăng nhập'} từ địa chỉ chưa gặp trong 30 ngày.`;
      case 'R7':
        return `${p} (Sắp nghỉ) ${d.kind === 'customer.view' ? `đã mở ${d.count} hồ sơ khác nhau trong 24 giờ` : d.kind === 'phone.reveal' ? `đã hiện SĐT ${d.count} lần trong 1 giờ` : d.kind === 'export' ? 'xuất file' : 'xin quyền tạm thời'}.`;
      case 'R8':
        return `${p} xin quyền tạm thời ${d.count} lần trong 7 ngày.`;
      case 'R9':
        return `${p} xem ${d.count} hội thoại ngoài phạm vi thường trong 24 giờ.`;
      default:
        return `${p}: ${rule?.name ?? a.ruleCode}`;
    }
  }

  private async viewOf(a: AlertDoc): Promise<AlertView> {
    const rule = (await this.rules()).find((r) => r.code === a.ruleCode);
    return {
      id: a._id,
      at: a.at.toISOString(),
      rule: a.ruleCode,
      ruleName: rule?.name ?? a.ruleCode,
      personId: a.personId,
      personName: a.personName,
      detail: a.detail,
      summary: this.summary(a, rule),
      status: a.status,
      ...(a.handledBy ? { handledBy: a.handledBy } : {}),
      ...(a.note ? { note: a.note } : {}),
    };
  }

  private isObserver(u: Subject): boolean {
    return u.roles.some((r) => r.roleKey === 'quan_sat');
  }

  /** Alerts the viewer is a recipient of (QS: all), never about himself. */
  async list(u: Subject, q: { status?: string; rule?: string; page?: number; pageSize?: number }) {
    const base = { personId: { $ne: u.userId }, ...(this.isObserver(u) ? {} : { recipientIds: u.userId }) };
    const filter = {
      ...base,
      ...(q.status && ALERT_STATUSES.includes(q.status as AlertStatus) ? { status: q.status as AlertStatus } : {}),
      ...(q.rule ? { ruleCode: q.rule } : {}),
    };
    const size = Math.min(Math.max(q.pageSize ?? 50, 1), 200);
    const col = this.db.col<AlertDoc>(C.alerts);
    const [docs, total, newCount] = await Promise.all([
      col.find(filter).sort({ at: -1 }).skip(((q.page ?? 1) - 1) * size).limit(size).toArray(),
      col.countDocuments(filter),
      col.countDocuments({ ...base, status: 'moi' }),
    ]);
    return { items: await Promise.all(docs.map((d) => this.viewOf(d))), total, newCount };
  }

  private async mine(u: Subject, id: string): Promise<AlertDoc> {
    const a = await this.db.col<AlertDoc>(C.alerts).findOne({ _id: id });
    // Not a recipient (or the person himself): the same answer as a missing alert.
    if (!a || a.personId === u.userId || (!a.recipientIds.includes(u.userId) && !this.isObserver(u))) throw new NotFoundException('Không tìm thấy cảnh báo.');
    return a;
  }

  async markSeen(u: Subject, id: string): Promise<AlertView> {
    const a = await this.mine(u, id);
    if (a.status === 'moi') await this.db.col<AlertDoc>(C.alerts).updateOne({ _id: id }, { $set: { status: 'da_xem' } });
    return this.viewOf({ ...a, status: a.status === 'moi' ? 'da_xem' : a.status });
  }

  async handle(u: Subject, id: string, note: string): Promise<AlertView> {
    const a = await this.mine(u, id);
    if (a.status === 'da_xu_ly') throw new BadRequestException('Cảnh báo này đã được xử lý.');
    const done = { status: 'da_xu_ly' as const, handledBy: u.userId, handledAt: new Date(), note };
    await this.db.col<AlertDoc>(C.alerts).updateOne({ _id: id }, { $set: done });
    // The note stays on the alert; the audit line carries ids only.
    await this.db.audit(`user:${u.userId}`, 'alert.handle', id, { rule: a.ruleCode, personId: a.personId });
    return this.viewOf({ ...a, ...done });
  }
}
