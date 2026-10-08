/** Change kinds used only by tests of the change core (real kinds come with B-04…B-09). */
import { Module, type OnModuleInit } from '@nestjs/common';
import { z } from 'zod';
import { ApiError } from '../../src/common/api-error';
import { ChangeHandlers, type ChangeHandler } from '../../src/common/changes';

export const UNITS = 'thu_units';
export const PEOPLE = 'thu_people';

const unitCreate: ChangeHandler<{ code: string; name: string }> = {
  kind: 'thu_unit_create',
  category: 'co_cau',
  permission: 'co_cau.sua',
  schema: z.object({ code: z.string(), name: z.string() }),
  conflictKeys: (it) => [`org_unit:${it.payload.code}:exists`],
  describe: (it) => `tạo đơn vị ${it.payload.code}`,
  async validate(ctx, it) {
    if (await ctx.db.collection(UNITS).findOne({ code: it.payload.code }, { session: ctx.session })) {
      throw new ApiError('rule_violation', { message: `Mã đơn vị ${it.payload.code} đã có.` });
    }
  },
  affectedPeople: async () => [],
  async apply(ctx, ch) {
    await ctx.db.collection(UNITS).insertOne({ code: ch.payload.code, name: ch.payload.name, from: ch.effective_on }, { session: ctx.session });
    await ctx.audit({ action: 'org_unit.create', target: { type: 'org_unit', id: ch.payload.code, label: ch.payload.code }, after: ch.payload });
  },
};

const personMove: ChangeHandler<{ unit_code: string }> = {
  kind: 'thu_person_move',
  category: 'nguoi',
  permission: 'nhan_su.sua',
  schema: z.object({ unit_code: z.string() }),
  conflictKeys: (it) => [`person:${it.target.id}:unit_code`],
  describe: (it) => `chuyển ${it.target.id} sang ${it.payload.unit_code}`,
  async validate(ctx, it) {
    // The unit exists, or (when sending) a unit creation is queued on or before that date: state at the effective date.
    const exists = await ctx.db.collection(UNITS).findOne({ code: it.payload.unit_code }, { session: ctx.session });
    const queued = ctx.phase === 'submit' && (await ctx.pendingUntil(ctx.effectiveOn, { kind: 'thu_unit_create', 'payload.code': it.payload.unit_code })).length > 0;
    if (!exists && !queued) throw new ApiError('rule_violation', { message: `Đơn vị ${it.payload.unit_code} không có hoặc đã ngừng tại ngày hiệu lực.` });
  },
  affectedPeople: async (_ctx, it) => [it.target.id],
  async apply(ctx, ch) {
    const before = await ctx.db.collection<{ _id: string; unit_code?: string }>(PEOPLE).findOne({ _id: ch.target.id }, { session: ctx.session });
    await ctx.db.collection<{ _id: string }>(PEOPLE).updateOne({ _id: ch.target.id }, { $set: { unit_code: ch.payload.unit_code } }, { upsert: true, session: ctx.session });
    await ctx.audit({ action: 'person.move', target: { type: 'person', id: ch.target.id, label: ch.target.id }, before: { unit_code: before?.unit_code ?? null }, after: ch.payload });
  },
};

/** Many people at once: affected people are listed in the payload. */
const bulk: ChangeHandler<{ people: string[]; unit_code: string }> = {
  kind: 'thu_bulk_move',
  category: 'nguoi',
  permission: 'nhan_su.sua',
  schema: z.object({ people: z.array(z.string()), unit_code: z.string() }),
  conflictKeys: (it) => it.payload.people.map((p) => `person:${p}:unit_code`),
  describe: (it) => `chuyển ${it.payload.people.length} người sang ${it.payload.unit_code}`,
  validate: async () => {},
  affectedPeople: async (ctx, it) => {
    // People flagged "gone" no longer count (lets a test move the count between confirm and apply).
    const gone = new Set((await ctx.db.collection<{ _id: string }>('thu_gone').find({}, { session: ctx.session }).toArray()).map((d) => d._id));
    return it.payload.people.filter((p) => !gone.has(p));
  },
  async apply(ctx, ch) {
    await ctx.db.collection<{ _id: string }>(PEOPLE).updateMany({ _id: { $in: ch.payload.people } }, { $set: { unit_code: ch.payload.unit_code } }, { session: ctx.session });
  },
};

/** Writes, then fails: nothing of the group may stay. */
const failing: ChangeHandler<{ note: string }> = {
  kind: 'thu_fail_on_apply',
  category: 'nguoi',
  permission: 'nhan_su.sua',
  schema: z.object({ note: z.string() }),
  conflictKeys: () => [],
  describe: () => 'thay đổi lỗi',
  async validate(ctx) {
    if (ctx.phase === 'apply') throw new ApiError('rule_violation', { message: 'Quản lý mới đã nghỉ việc trước ngày hiệu lực.' });
  },
  affectedPeople: async () => [],
  apply: async () => {},
};

@Module({})
export class ThuChangesModule implements OnModuleInit {
  constructor(private readonly handlers: ChangeHandlers) {}
  onModuleInit(): void {
    for (const h of [unitCreate, personMove, bulk, failing]) this.handlers.register(h as unknown as ChangeHandler);
  }
}
