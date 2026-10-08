/**
 * Profile change kinds (05 mục 4.1, 04 VH-NSU-01 bước 6): `person_status` (here only "vào làm" at 00:00 of the start day;
 * B-09 adds leave, suspension, leaving) and `person_update` (legal entity, employee type, work location on a date).
 */
import { PEOPLE_MSG, toEffectiveAt } from '@vc/contracts';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { ApiError } from '../common/api-error';
import type { ChangeHandler } from '../common/changes';
import type { CatalogService } from '../org/catalogs/catalog.service';
import { people } from './positions/rules';

export const PERSON_STATUS = 'person_status';
export const PERSON_UPDATE = 'person_update';

const rule = (message: string) => new ApiError('rule_violation', { message });

const StatusPayload = z.object({ action: z.enum(['vao_lam']) });

export function personStatus(): ChangeHandler<z.infer<typeof StatusPayload>> {
  return {
    kind: PERSON_STATUS,
    category: 'nguoi',
    permission: 'nhan_su.sua',
    schema: StatusPayload,
    conflictKeys: (it) => [`person:${it.target.id}:status`],
    describe: () => 'vào làm',
    async validate(ctx, it) {
      const p = await people(ctx.db).findOne({ _id: new ObjectId(it.target.id) }, { session: ctx.session });
      if (!p) throw rule(PEOPLE_MSG.notFound);
      if (p.status !== 'chua_vao_lam') throw rule(`Hồ sơ ${p.employee_code} không ở trạng thái "Chưa vào làm".`);
    },
    affectedPeople: async (_ctx, it) => [it.target.id],
    async apply(ctx, ch) {
      const id = new ObjectId(ch.target.id);
      const p = await people(ctx.db).findOne({ _id: id }, { session: ctx.session });
      await people(ctx.db).updateOne(
        { _id: id },
        { $set: { status: 'dang_lam', status_since_at: toEffectiveAt(ch.effective_on), updated_at: ctx.clock.now() }, $inc: { rev: 1, event_seq: 1 } },
        { session: ctx.session },
      );
      await ctx.audit({ action: 'person.status', target: { type: 'person', id: ch.target.id, label: p?.employee_code ?? '' }, before: { status: p?.status }, after: { status: 'dang_lam' } });
    },
  };
}

const UpdatePayload = z
  .object({ legal_entity_code: z.string(), employee_type: z.enum(['chinh_thuc', 'thu_viec', 'cong_tac_vien', 'thuc_tap']), work_location_code: z.string().nullable() })
  .partial();
type UpdatePayload = z.infer<typeof UpdatePayload>;

export function personUpdate(catalogs: CatalogService): ChangeHandler<UpdatePayload> {
  return {
    kind: PERSON_UPDATE,
    category: 'nguoi',
    permission: 'nhan_su.sua',
    schema: UpdatePayload,
    conflictKeys: (it) => Object.keys(it.payload).map((f) => `person:${it.target.id}:${f}`),
    describe: (it) => `đổi ${Object.keys(it.payload).join(', ')}`,
    async validate(ctx, it) {
      const p = await people(ctx.db).findOne({ _id: new ObjectId(it.target.id) }, { session: ctx.session });
      if (!p) throw rule(PEOPLE_MSG.notFound);
      if (p.status === 'da_nghi') throw rule('Hồ sơ đã nghỉ, không sửa được.');
      if (it.payload.legal_entity_code) await catalogs.requireSelectable('legal-entities', it.payload.legal_entity_code, ctx.session);
      if (it.payload.work_location_code) await catalogs.requireSelectable('work-locations', it.payload.work_location_code, ctx.session);
    },
    affectedPeople: async (_ctx, it) => [it.target.id],
    async apply(ctx, ch) {
      const id = new ObjectId(ch.target.id);
      const p = await people(ctx.db).findOne({ _id: id }, { session: ctx.session });
      await people(ctx.db).updateOne({ _id: id }, { $set: { ...ch.payload, updated_at: ctx.clock.now() }, $inc: { rev: 1, event_seq: 1 } }, { session: ctx.session });
      const before = Object.fromEntries(Object.keys(ch.payload).map((k) => [k, (p as unknown as Record<string, unknown>)?.[k] ?? null]));
      await ctx.audit({ action: 'person.update', target: { type: 'person', id: ch.target.id, label: p?.employee_code ?? '' }, before, after: ch.payload });
    },
  };
}
