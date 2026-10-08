/**
 * Effective-dated changes (VH-BR-07, VH-BR-22, VH-BR-25; 05 mục 5; kế hoạch GĐ B mục 3.3 điểm 1, 10).
 * - Today or earlier: applied at once in the same transaction (`da_ap`).
 * - Later: queued (`cho_ap`); the job applies it at 00:00 Vietnam time of that day.
 * - Many people affected: waits for a second admin (`cho_xac_nhan`), who cannot be the sender.
 * Every check runs again when a change is applied; a failing group is applied in full or not at all (`loi`).
 */
import { Inject, Injectable } from '@nestjs/common';
import { accessFor, addDays, formatVnDate, isYmd, toEffectiveAt } from '@vc/contracts';
import { ObjectId, type ClientSession, type Db, type Filter, type MongoClient } from 'mongodb';
import { AuditService, SYSTEM, type Actor, type SourceType } from '../../audit/audit.service';
import type { Viewer } from '../../auth/viewer';
import { AlertService } from '../../common/alerts';
import { ApiError } from '../../common/api-error';
import {
  CATEGORY_RANK,
  ChangeHandlers,
  ChangeHooks,
  type ApplyContext,
  type ChangeContext,
  type ChangeDoc,
  type ChangeHandler,
  type ChangeItem,
  type ChangeStatus,
} from '../../common/changes';
import { CLOCK, todayOn, type Clock } from '../../common/clock';
import { withTx } from '../../common/tx';
import { C } from '../../db/collections';
import { DB, MONGO_CLIENT } from '../../db/mongo';
import { SettingsService } from '../../settings/settings.service';

export interface SubmitInput {
  items: ChangeItem[];
  effective_on: string;
  reason?: string;
  /** Pending changes the sender agreed to replace (answer "Huỷ thay đổi cũ và lưu thay đổi mới?"). */
  replace_ids?: string[];
  source?: { type: 'tay' | 'lo_nhap'; import_batch_id?: string };
}

/** Who asks, and from where (audit fields). */
export interface Requester {
  actor: Actor;
  viewer?: Viewer;
  correlationId: string;
  ipPrefix?: string | null;
  via: SourceType;
}

export interface GroupSummary {
  group_id: string;
  status: ChangeStatus;
  effective_on: string;
  kinds: string[];
  descriptions: string[];
  reason: string | null;
  affected_people: number | null;
  created_by: Actor;
  created_at: string;
  error: { code: string; message: string } | null;
}

export interface SubmitResult extends GroupSummary {
  message: string;
  warnings: string[];
}

const PENDING: ChangeStatus[] = ['cho_ap', 'cho_xac_nhan'];

/** Group already handled by someone else (another job run, a cancel): leave it alone. */
class AlreadyHandled extends Error {}

@Injectable()
export class ChangeService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MONGO_CLIENT) private readonly client: MongoClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly handlers: ChangeHandlers,
    private readonly hooks: ChangeHooks,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly alerts: AlertService,
  ) {}

  private get col() {
    return this.db.collection<ChangeDoc>(C.scheduledChanges);
  }

  private handler(kind: string): ChangeHandler {
    const h = this.handlers.get(kind);
    if (!h) throw new ApiError('bad_request', { message: `Loại thay đổi không hợp lệ: ${kind}` });
    return h;
  }

  private context(session: ClientSession, phase: ChangeContext['phase'], effectiveOn: string, ignoreGroups: ObjectId[] = []): ChangeContext {
    return {
      db: this.db,
      session,
      clock: this.clock,
      phase,
      effectiveOn,
      pendingUntil: (on, filter = {}) =>
        this.col
          .find({ ...filter, status: { $in: PENDING }, effective_on: { $lte: on }, group_id: { $nin: ignoreGroups } } as Filter<ChangeDoc>, { session })
          .sort({ effective_at: 1, seq: 1 })
          .toArray(),
    };
  }

  private checkPermission(req: Requester, h: ChangeHandler, item: ChangeItem): void {
    if (!req.viewer) return;
    if (!accessFor(h.permission, req.viewer.roles)) throw new ApiError('forbidden');
    h.authorize?.(req.viewer, item);
  }

  private async affectedCount(ctx: ChangeContext, items: ChangeItem[]): Promise<number> {
    const people = new Set<string>();
    for (const it of items) for (const p of await this.handler(it.kind).affectedPeople(ctx, it)) people.add(p);
    return people.size;
  }

  private drifted(before: number, now: number, percent: number): boolean {
    return Math.abs(now - before) > (Math.max(before, 1) * percent) / 100;
  }

  // --- Send ---------------------------------------------------------------------------------------------------------

  /** Sends a group of changes. With `session`, runs inside the caller's transaction (an edit that also renames). */
  async submit(input: SubmitInput, req: Requester, outer?: ClientSession): Promise<SubmitResult> {
    if (!isYmd(input.effective_on)) throw new ApiError('bad_request', { message: 'Ngày hiệu lực không hợp lệ.', details: { field: 'effective_on' } });
    if (!input.items?.length) throw new ApiError('bad_request', { message: 'Không có thay đổi nào.' });
    if (input.reason && input.reason.length > 200) throw new ApiError('bad_request', { message: 'Lý do tối đa 200 ký tự.', details: { field: 'reason' } });
    const items = input.items.map((it) => {
      const h = this.handler(it.kind);
      const item = { kind: it.kind, target: it.target, payload: h.schema.parse(it.payload) as Record<string, unknown> };
      this.checkPermission(req, h, item);
      return item;
    });
    const today = todayOn(this.clock);
    const warnings: string[] = [];
    const pastLimit = await this.settings.get('changes.past_warning_days');
    if (input.effective_on < addDays(today, -pastLimit)) {
      const days = Math.round((toEffectiveAt(today).getTime() - toEffectiveAt(input.effective_on).getTime()) / 86_400_000);
      warnings.push(`Ngày hiệu lực đã qua ${days} ngày. Lịch sử ghi đúng ngày bạn nhập; quyền và sự kiện tính từ lúc lưu.`);
    }
    const threshold = await this.settings.get('bulk.confirm_min_people');

    const send = async (session: ClientSession) => {
      const now = this.clock.now();
      const keys = items.flatMap((it) => this.handler(it.kind).conflictKeys(it));
      const replaceGroups = await this.replaceGroups(input.replace_ids ?? [], session);

      // Pending changes on the same object and field (06 mục 1.5, kế hoạch GĐ B mục 3.3 điểm 1).
      const clashing = keys.length
        ? await this.col.find({ conflict_keys: { $in: keys }, status: { $in: PENDING } }, { session }).sort({ effective_at: 1 }).toArray()
        : [];
      const blocking = clashing.filter((c) => !replaceGroups.some((g) => g.equals(c.group_id)));
      if (blocking.length) {
        const first = blocking[0];
        throw new ApiError('hen_xung_dot', {
          message: `Đã có thay đổi hẹn ngày ${formatVnDate(first.effective_on)}: ${this.handler(first.kind).describe(first)}. Thay đổi mới mâu thuẫn với thay đổi này. Huỷ thay đổi cũ và lưu thay đổi mới?`,
          details: { conflicts: blocking.map((c) => ({ id: String(c._id), group_id: String(c.group_id), effective_on: c.effective_on, description: this.handler(c.kind).describe(c) })) },
        });
      }
      for (const g of replaceGroups) await this.cancelGroupInTx(session, g, 'Thay bằng thay đổi mới', req);

      const ctx = this.context(session, 'submit', input.effective_on, replaceGroups);
      for (const it of items) await this.handler(it.kind).validate(ctx, it);
      const affected = await this.affectedCount(ctx, items);
      const needsConfirm = affected >= threshold && !items.every((it) => this.handler(it.kind).noBulkConfirm);

      const groupId = new ObjectId();
      const docs: ChangeDoc[] = items.map((it, seq) => {
        const h = this.handler(it.kind);
        return {
          _id: new ObjectId(),
          group_id: groupId,
          seq,
          category: h.category,
          kind: it.kind,
          target: it.target,
          payload: it.payload,
          effective_on: input.effective_on,
          effective_at: toEffectiveAt(input.effective_on),
          status: needsConfirm ? 'cho_xac_nhan' : 'cho_ap',
          reason: input.reason ?? null,
          source: { type: input.source?.type ?? 'tay', import_batch_id: input.source?.import_batch_id ? new ObjectId(input.source.import_batch_id) : null },
          conflict_keys: h.conflictKeys(it),
          applied_at: null,
          error: null,
          confirm: needsConfirm ? { preview_count: affected, confirmed_by: null, confirmed_at: null, confirmed_count: null } : null,
          alerted_at: null,
          cancelled_at: null,
          cancelled_by: null,
          cancel_reason: null,
          created_at: now,
          created_by: req.actor,
          updated_at: now,
          rev: 1,
        };
      });
      await this.col.insertMany(docs, { session });
      await this.audit.record(session, {
        actor: req.actor,
        action: 'scheduled_change.create',
        target: { type: 'change_group', id: String(groupId), label: [...new Set(items.map((i) => i.kind))].join(',') },
        after: { effective_on: input.effective_on, status: docs[0].status, items: items.length, affected_people: affected },
        reason: input.reason,
        effective_on: input.effective_on,
        correlation_id: req.correlationId,
        ip_prefix: req.ipPrefix ?? null,
        source: { type: req.via },
      });
      // Today or earlier: apply now, inside the same transaction (05 mục 5.1).
      if (!needsConfirm && input.effective_on <= today) await this.applyGroupInTx(session, docs, req.actor, req.correlationId, req.via);
      return this.summarize(await this.col.find({ group_id: groupId }, { session }).sort({ seq: 1 }).toArray(), affected);
    };
    const summary = outer ? await send(outer) : await withTx(this.client, send);

    const message =
      summary.status === 'da_ap'
        ? `Đã lưu, có hiệu lực từ ${formatVnDate(summary.effective_on)}.`
        : summary.status === 'cho_xac_nhan'
          ? `Thay đổi ảnh hưởng ${summary.affected_people} người nên chờ một quản trị hệ thống khác xác nhận (VH-BR-25).`
          : `Đã hẹn áp lúc 00:00 ngày ${formatVnDate(summary.effective_on)}.`;
    return { ...summary, message, warnings };
  }

  private async replaceGroups(ids: string[], session: ClientSession): Promise<ObjectId[]> {
    const valid = ids.filter((i) => ObjectId.isValid(i)).map((i) => new ObjectId(i));
    if (!valid.length) return [];
    const docs = await this.col.find({ _id: { $in: valid }, status: { $in: PENDING } }, { session, projection: { group_id: 1 } }).toArray();
    return [...new Map(docs.map((d) => [String(d.group_id), d.group_id])).values()];
  }

  // --- Apply --------------------------------------------------------------------------------------------------------

  /** Applies all changes of a group in `session`; throws (and the caller aborts) if any check fails. */
  private async applyGroupInTx(session: ClientSession, docs: ChangeDoc[], actor: Actor, correlationId: string, via: SourceType): Promise<void> {
    const ordered = [...docs].sort((a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || a.seq - b.seq);
    const now = this.clock.now();
    for (const doc of ordered) {
      const h = this.handler(doc.kind);
      const base = this.context(session, 'apply', doc.effective_on);
      await h.validate(base, doc);
      const moved = await this.col.updateOne(
        { _id: doc._id, status: 'cho_ap', rev: doc.rev },
        { $set: { status: 'da_ap', applied_at: now, updated_at: now }, $inc: { rev: 1 } },
        { session },
      );
      if (moved.modifiedCount !== 1) throw new AlreadyHandled();
      const ctx: ApplyContext = {
        ...base,
        actor,
        correlationId,
        sourceType: via,
        audit: (e) =>
          this.audit
            .record(session, {
              ...e,
              actor: actor.type === 'he_thong' ? { ...actor, on_behalf_of_person_id: doc.created_by.person_id } : actor,
              reason: doc.reason ?? undefined,
              effective_on: doc.effective_on,
              correlation_id: correlationId,
              source: { type: doc.source.type === 'lo_nhap' ? 'nhap_excel' : via, ref: String(doc.group_id) },
            })
            .then(() => undefined),
      };
      await h.apply(ctx, doc);
      await this.hooks.afterApply(ctx, doc);
    }
  }

  /** Job `scheduled-changes.apply` (kế hoạch GĐ B mục 6.1): due groups, org before people, each group all or nothing. */
  async applyDue(correlationId: string): Promise<{ applied: number; failed: number; requeued: number }> {
    // Before applying: after downtime the late groups are applied right below, and the alert must still go out.
    await this.alertOverdue(correlationId);
    const now = this.clock.now();
    const groups = await this.col
      .aggregate<{ _id: ObjectId; at: Date; rank: number; created: Date }>([
        { $match: { status: 'cho_ap', effective_at: { $lte: now } } },
        { $group: { _id: '$group_id', at: { $min: '$effective_at' }, rank: { $min: { $cond: [{ $eq: ['$category', 'co_cau'] }, 0, 1] } }, created: { $min: '$created_at' } } },
        { $sort: { at: 1, rank: 1, created: 1 } },
      ])
      .toArray();
    const drift = await this.settings.get('bulk.confirm_drift_percent');
    let applied = 0;
    let failed = 0;
    let requeued = 0;
    for (const g of groups) {
      try {
        const outcome = await withTx(this.client, async (session) => {
          const docs = await this.col.find({ group_id: g._id, status: 'cho_ap' }, { session }).sort({ seq: 1 }).toArray();
          if (!docs.length) return 'bo_qua' as const;
          const confirmed = docs[0].confirm;
          if (confirmed?.confirmed_count != null) {
            // VH-BR-25: too different from what the admin confirmed → confirm again.
            const n = await this.affectedCount(this.context(session, 'apply', docs[0].effective_on), docs);
            if (this.drifted(confirmed.confirmed_count, n, drift)) {
              await this.col.updateMany(
                { group_id: g._id, status: 'cho_ap' },
                { $set: { status: 'cho_xac_nhan', confirm: { preview_count: n, confirmed_by: null, confirmed_at: null, confirmed_count: null }, updated_at: this.clock.now() }, $inc: { rev: 1 } },
                { session },
              );
              await this.audit.record(session, {
                actor: SYSTEM,
                action: 'scheduled_change.reconfirm',
                target: { type: 'change_group', id: String(g._id), label: docs.map((d) => d.kind).join(',') },
                before: { affected_people: confirmed.confirmed_count },
                after: { affected_people: n },
                correlation_id: correlationId,
                source: { type: 'job', ref: 'scheduled-changes.apply' },
              });
              return 'chua_ap' as const;
            }
          }
          await this.applyGroupInTx(session, docs, SYSTEM, correlationId, 'job');
          return 'da_ap' as const;
        });
        if (outcome === 'da_ap') applied++;
        if (outcome === 'chua_ap') requeued++;
      } catch (e) {
        if (e instanceof AlreadyHandled) continue;
        failed++;
        await this.markError(g._id, e, correlationId);
      }
    }
    return { applied, failed, requeued };
  }

  private async markError(groupId: ObjectId, e: unknown, correlationId: string): Promise<void> {
    const error = e instanceof ApiError ? { code: e.code, message: e.message } : { code: 'server_error', message: e instanceof Error ? e.message.slice(0, 300) : String(e) };
    const docs = await withTx(this.client, async (session) => {
      const now = this.clock.now();
      const pending = await this.col.find({ group_id: groupId, status: 'cho_ap' }, { session }).toArray();
      if (!pending.length) return pending;
      await this.col.updateMany({ group_id: groupId, status: 'cho_ap' }, { $set: { status: 'loi', error, alerted_at: now, updated_at: now }, $inc: { rev: 1 } }, { session });
      await this.audit.record(session, {
        actor: SYSTEM,
        action: 'scheduled_change.error',
        target: { type: 'change_group', id: String(groupId), label: pending.map((d) => d.kind).join(',') },
        after: { error },
        effective_on: pending[0].effective_on,
        correlation_id: correlationId,
        source: { type: 'job', ref: 'scheduled-changes.apply' },
      });
      return pending;
    });
    if (docs.length) {
      // Cảnh báo #9: HC-NS must look at the group (05 mục 5.2 bước 4).
      await this.alerts.send('cao', 'thay_doi_hen_loi', `Thay đổi hẹn ngày ${formatVnDate(docs[0].effective_on)} không áp được: ${error.message}`, { group_id: String(groupId) });
    }
  }

  /** Cảnh báo #9: changes still waiting long after their time (the job is stuck or keeps failing). */
  private async alertOverdue(correlationId: string): Promise<void> {
    const minutes = await this.settings.get('changes.overdue_alert_minutes');
    const limit = new Date(this.clock.now().getTime() - minutes * 60_000);
    const late = await this.col.find({ status: 'cho_ap', effective_at: { $lt: limit }, alerted_at: null }).limit(50).toArray();
    if (!late.length) return;
    await this.col.updateMany({ _id: { $in: late.map((d) => d._id) } }, { $set: { alerted_at: this.clock.now() } });
    await this.alerts.send('cao', 'thay_doi_hen_tre', `${late.length} thay đổi hẹn đã quá giờ áp hơn ${minutes} phút mà chưa áp (job dừng hoặc chạy chậm). Job đang áp bù; kiểm lại kết quả.`, { correlation_id: correlationId });
  }

  // --- Cancel, confirm, reject --------------------------------------------------------------------------------------

  private async pendingGroup(groupId: string, session: ClientSession, statuses: ChangeStatus[] = PENDING): Promise<ChangeDoc[]> {
    if (!ObjectId.isValid(groupId)) throw new ApiError('not_found');
    const docs = await this.col.find({ group_id: new ObjectId(groupId) }, { session }).sort({ seq: 1 }).toArray();
    if (!docs.length) throw new ApiError('not_found');
    if (!docs.every((d) => statuses.includes(d.status))) {
      throw new ApiError('rule_violation', { message: 'Thay đổi này đã áp hoặc đã huỷ, không làm thao tác này được nữa.' });
    }
    return docs;
  }

  private async cancelGroupInTx(session: ClientSession, groupId: ObjectId, reason: string, req: Requester): Promise<void> {
    const now = this.clock.now();
    const docs = await this.col.find({ group_id: groupId, status: { $in: PENDING } }, { session }).toArray();
    await this.col.updateMany(
      { group_id: groupId, status: { $in: PENDING } },
      { $set: { status: 'da_huy', cancelled_at: now, cancelled_by: req.actor, cancel_reason: reason, updated_at: now }, $inc: { rev: 1 } },
      { session },
    );
    await this.audit.record(session, {
      actor: req.actor,
      action: 'scheduled_change.cancel',
      target: { type: 'change_group', id: String(groupId), label: docs.map((d) => d.kind).join(',') },
      before: { status: docs[0]?.status },
      after: { status: 'da_huy' },
      reason,
      effective_on: docs[0]?.effective_on,
      correlation_id: req.correlationId,
      ip_prefix: req.ipPrefix ?? null,
      source: { type: req.via },
    });
  }

  /** "Huỷ hẹn" (VH-BR-07): before the effective date; needs the permission of every kind in the group. */
  async cancel(groupId: string, reason: string, req: Requester): Promise<GroupSummary> {
    if (!reason || reason.trim().length < 5) throw new ApiError('rule_violation', { message: 'Nhập lý do huỷ hẹn (ít nhất 5 ký tự).' });
    return withTx(this.client, async (session) => {
      const docs = await this.pendingGroup(groupId, session);
      for (const d of docs) this.checkPermission(req, this.handler(d.kind), d);
      await this.cancelGroupInTx(session, docs[0].group_id, reason, req);
      return this.summarize(await this.col.find({ group_id: docs[0].group_id }, { session }).sort({ seq: 1 }).toArray(), docs[0].confirm?.preview_count ?? null);
    });
  }

  /** Second admin confirms a bulk change (VH-BR-25). The sender cannot; a count that moved > 20 % needs a new look. */
  async confirm(groupId: string, req: Requester): Promise<GroupSummary> {
    const drift = await this.settings.get('bulk.confirm_drift_percent');
    const result = await withTx(this.client, async (session) => {
      const docs = await this.pendingGroup(groupId, session, ['cho_xac_nhan']);
      const sender = docs[0].created_by;
      if ((sender.sub && sender.sub === req.actor.sub) || (sender.person_id && sender.person_id === req.actor.person_id)) {
        throw new ApiError('forbidden', { message: 'Không xác nhận được thay đổi do chính bạn gửi. Nhờ một quản trị hệ thống khác.' });
      }
      const ctx = this.context(session, 'apply', docs[0].effective_on);
      const n = await this.affectedCount(ctx, docs);
      const preview = docs[0].confirm!.preview_count;
      const now = this.clock.now();
      if (this.drifted(preview, n, drift)) {
        await this.col.updateMany({ group_id: docs[0].group_id }, { $set: { 'confirm.preview_count': n, updated_at: now }, $inc: { rev: 1 } }, { session });
        return { error: new ApiError('rule_violation', { message: `Số người bị ảnh hưởng đã đổi từ ${preview} thành ${n} kể từ lúc gửi. Xem lại trước khi xác nhận.`, details: { before: preview, now: n } }) };
      }
      await this.col.updateMany(
        { group_id: docs[0].group_id },
        { $set: { status: 'cho_ap', 'confirm.confirmed_by': req.actor, 'confirm.confirmed_at': now, 'confirm.confirmed_count': n, updated_at: now }, $inc: { rev: 1 } },
        { session },
      );
      await this.audit.record(session, {
        actor: req.actor,
        action: 'scheduled_change.confirm',
        target: { type: 'change_group', id: groupId, label: docs.map((d) => d.kind).join(',') },
        after: { affected_people: n },
        effective_on: docs[0].effective_on,
        correlation_id: req.correlationId,
        ip_prefix: req.ipPrefix ?? null,
        source: { type: req.via },
      });
      const fresh = await this.col.find({ group_id: docs[0].group_id }, { session }).sort({ seq: 1 }).toArray();
      if (fresh[0].effective_on <= todayOn(this.clock)) await this.applyGroupInTx(session, fresh, req.actor, req.correlationId, req.via);
      return { summary: this.summarize(await this.col.find({ group_id: docs[0].group_id }, { session }).sort({ seq: 1 }).toArray(), n) };
    });
    // The new count is saved even though the confirmation is refused.
    if ('error' in result && result.error) throw result.error;
    return (result as { summary: GroupSummary }).summary;
  }

  async reject(groupId: string, reason: string, req: Requester): Promise<GroupSummary> {
    if (!reason || reason.trim().length < 5) throw new ApiError('rule_violation', { message: 'Nhập lý do từ chối (ít nhất 5 ký tự).' });
    return withTx(this.client, async (session) => {
      const docs = await this.pendingGroup(groupId, session, ['cho_xac_nhan']);
      await this.cancelGroupInTx(session, docs[0].group_id, `Từ chối xác nhận: ${reason}`, req);
      return this.summarize(await this.col.find({ group_id: docs[0].group_id }, { session }).sort({ seq: 1 }).toArray(), docs[0].confirm?.preview_count ?? null);
    });
  }

  /** Groups waiting for a second admin (queue of QTHT). */
  async waitingConfirmation(): Promise<GroupSummary[]> {
    const docs = await this.col.find({ status: 'cho_xac_nhan' }).sort({ effective_at: 1, seq: 1 }).limit(2000).toArray();
    const byGroup = new Map<string, ChangeDoc[]>();
    for (const d of docs) byGroup.set(String(d.group_id), [...(byGroup.get(String(d.group_id)) ?? []), d]);
    return [...byGroup.values()].map((g) => this.summarize(g, g[0].confirm?.preview_count ?? null));
  }

  private summarize(docs: ChangeDoc[], affected: number | null): GroupSummary {
    const statuses = new Set(docs.map((d) => d.status));
    const first = docs[0];
    return {
      group_id: String(first.group_id),
      status: statuses.size === 1 ? first.status : (docs.find((d) => d.status !== 'da_ap')?.status ?? first.status),
      effective_on: first.effective_on,
      kinds: docs.map((d) => d.kind),
      descriptions: docs.map((d) => this.handler(d.kind).describe(d)),
      reason: first.reason,
      affected_people: affected,
      created_by: first.created_by,
      created_at: first.created_at.toISOString(),
      error: first.error,
    };
  }
}
