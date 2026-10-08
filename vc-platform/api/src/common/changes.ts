/**
 * One path for every change of people, positions and org units (05 mục 5; kế hoạch GĐ B mục 3.3 điểm 1).
 * Each kind (`position_open`, `unit_move`…) registers a handler here; `org` and `people` register their own kinds
 * without depending on each other (token CHANGE_HANDLERS of kế hoạch GĐ B mục 3.1).
 */
import { Injectable } from '@nestjs/common';
import type { Permission } from '@vc/contracts';
import type { ClientSession, Db, ObjectId } from 'mongodb';
import type { z } from 'zod';
import type { Actor, SourceType } from '../audit/audit.service';
import type { Clock } from './clock';

/** Org changes apply before people changes at the same instant: a unit must exist before a position opens in it. */
export type ChangeCategory = 'co_cau' | 'nguoi';
export const CATEGORY_RANK: Record<ChangeCategory, number> = { co_cau: 0, nguoi: 1 };

export type ChangeStatus = 'cho_xac_nhan' | 'cho_ap' | 'da_ap' | 'da_huy' | 'loi';

export interface ChangeItem<P = Record<string, unknown>> {
  kind: string;
  target: { type: 'person' | 'position' | 'org_unit' | 'catalog'; id: string };
  payload: P;
}

export interface ChangeDoc<P = Record<string, unknown>> extends ChangeItem<P> {
  _id: ObjectId;
  group_id: ObjectId;
  /** Order inside the group. */
  seq: number;
  category: ChangeCategory;
  effective_on: string;
  effective_at: Date;
  status: ChangeStatus;
  reason: string | null;
  source: { type: 'tay' | 'lo_nhap'; import_batch_id: ObjectId | null };
  conflict_keys: string[];
  applied_at: Date | null;
  error: { code: string; message: string } | null;
  /** Bulk changes (VH-BR-25): people counted when sent, and when a second admin confirmed. */
  confirm: { preview_count: number; confirmed_by: Actor | null; confirmed_at: Date | null; confirmed_count: number | null } | null;
  alerted_at: Date | null;
  cancelled_at: Date | null;
  cancelled_by: Actor | null;
  cancel_reason: string | null;
  created_at: Date;
  created_by: Actor;
  updated_at: Date;
  rev: number;
}

export interface ChangeContext {
  db: Db;
  session: ClientSession;
  clock: Clock;
  /** `submit`: checks before queueing; `apply`: checks again when the change takes effect. */
  phase: 'submit' | 'apply';
  effectiveOn: string;
  /** Pending changes (waiting or queued) effective on or before a date: lets a check simulate the state at that date. */
  pendingUntil(effectiveOn: string, filter?: Record<string, unknown>): Promise<ChangeDoc[]>;
}

export interface ApplyContext extends ChangeContext {
  actor: Actor;
  correlationId: string;
  /** Writes one audit row for this change, with its effective date, source and reason. */
  audit(entry: { action: string; target: { type: string; id: string; label: string }; before?: Record<string, unknown>; after?: Record<string, unknown> }): Promise<void>;
  sourceType: SourceType;
}

export interface ChangeHandler<P extends Record<string, unknown> = Record<string, unknown>> {
  kind: string;
  category: ChangeCategory;
  /** Needed to send or cancel this kind (02 mục 3). */
  permission: Permission;
  schema: z.ZodType<P>;
  /** `<type>:<id>:<field>` keys this change sets; two pending changes sharing a key conflict (06 mục 1.5). */
  conflictKeys(item: ChangeItem<P>): string[];
  /** Short Vietnamese description for messages, e.g. "chuyển VCP0156 sang VCP-TBH2". */
  describe(item: ChangeItem<P>): string;
  /** Throws ApiError('rule_violation', …) with the rule's sentence. */
  validate(ctx: ChangeContext, item: ChangeItem<P>): Promise<void>;
  /** People whose attributes used by access rules change (kế hoạch GĐ B mục 3.3 điểm 10). */
  affectedPeople(ctx: ChangeContext, item: ChangeItem<P>): Promise<string[]>;
  apply(ctx: ApplyContext, change: ChangeDoc<P>): Promise<void>;
  /** No second-admin confirmation even when many people are affected (catalog merge, 04 VH-ORG-09). */
  noBulkConfirm?: boolean;
}

@Injectable()
export class ChangeHandlers {
  private readonly handlers = new Map<string, ChangeHandler>();

  register<P extends Record<string, unknown>>(h: ChangeHandler<P>): void {
    if (this.handlers.has(h.kind)) throw new Error(`Loại thay đổi trùng: ${h.kind}`);
    this.handlers.set(h.kind, h as unknown as ChangeHandler);
  }

  get(kind: string): ChangeHandler | undefined {
    return this.handlers.get(kind);
  }
}

export type ChangeHook = (ctx: ApplyContext, change: ChangeDoc) => Promise<void>;

/** Runs after each change is applied, in the same transaction (GĐ B: mark VC ID push; GĐ C: outbox, rights). */
@Injectable()
export class ChangeHooks {
  private readonly hooks: ChangeHook[] = [];

  register(h: ChangeHook): void {
    this.hooks.push(h);
  }

  async afterApply(ctx: ApplyContext, change: ChangeDoc): Promise<void> {
    for (const h of this.hooks) await h(ctx, change);
  }
}
