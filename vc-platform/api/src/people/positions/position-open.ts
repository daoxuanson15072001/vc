/**
 * `position_open` (04 VH-NSU-02): opens a main or concurrent position from the effective date. B-06 uses it for the
 * first main position of a new profile; B-07 adds transfers, manager changes and concurrent positions around it.
 */
import { PEOPLE_MSG, addDays, toEffectiveAt } from '@vc/contracts';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { ApiError } from '../../common/api-error';
import type { ChangeHandler } from '../../common/changes';
import { todayOn } from '../../common/clock';
import type { CatalogService } from '../../org/catalogs/catalog.service';
import type { PositionDoc } from '../types';
import { checkManager, checkPrimaryOverlap, checkTitleAndFunction, people, positions, refreshIsManager, unitOn } from './rules';

export const POSITION_OPEN = 'position_open';

const hex = z.string().regex(/^[0-9a-f]{24}$/);
export const OpenPayload = z.object({
  kind: z.enum(['chinh', 'kiem_nhiem']),
  unit_code: z.string(),
  job_title_code: z.string(),
  job_function_code: z.string(),
  manager_person_id: hex.nullable(),
  end_on: z.string().nullable(),
  basis: z.string(),
  note: z.string(),
});
export type OpenPayload = z.infer<typeof OpenPayload>;

const rule = (message: string, details?: unknown) => new ApiError('rule_violation', { message, details });

export function positionOpen(catalogs: CatalogService): ChangeHandler<OpenPayload> {
  return {
    kind: POSITION_OPEN,
    category: 'nguoi',
    permission: 'nhan_su.sua',
    schema: OpenPayload,
    conflictKeys: (it) => (it.payload.kind === 'chinh' ? [`person:${it.target.id}:primary`] : [`person:${it.target.id}:position:${it.payload.unit_code}:${it.payload.job_title_code}`]),
    describe: (it) => (it.payload.kind === 'chinh' ? `mở vị trí chính tại ${it.payload.unit_code}` : `thêm kiêm nhiệm tại ${it.payload.unit_code}`),
    async validate(ctx, it) {
      const s = ctx.session;
      const id = new ObjectId(it.target.id);
      const person = await people(ctx.db).findOne({ _id: id }, { session: s });
      if (!person) throw rule(PEOPLE_MSG.notFound);
      if (person.status === 'da_nghi') throw rule('Hồ sơ đã nghỉ, không mở vị trí được.');
      const start = ctx.effectiveOn;
      if (start < person.joined_on) throw rule(PEOPLE_MSG.startBeforeJoined);
      if (it.payload.end_on && it.payload.end_on < start) throw rule(PEOPLE_MSG.endBeforeStart, { field: 'end_on' });
      const unit = await unitOn(ctx, it.payload.unit_code, start);
      await checkTitleAndFunction(catalogs, s, it.payload.job_title_code, it.payload.job_function_code);
      await checkManager(ctx.db, s, id, it.payload.manager_person_id ? new ObjectId(it.payload.manager_person_id) : null, unit);
      if (it.payload.kind === 'chinh') await checkPrimaryOverlap(ctx.db, s, id, start, it.payload.end_on);
    },
    affectedPeople: async (_ctx, it) => [it.target.id],
    async apply(ctx, ch) {
      const p = ch.payload;
      const today = todayOn(ctx.clock);
      const now = ctx.clock.now();
      const doc: PositionDoc = {
        _id: new ObjectId(),
        person_id: new ObjectId(ch.target.id),
        kind: p.kind,
        unit_code: p.unit_code,
        job_title_code: p.job_title_code,
        job_function_code: p.job_function_code,
        manager_person_id: p.manager_person_id ? new ObjectId(p.manager_person_id) : null,
        start_on: ch.effective_on,
        end_on: p.end_on,
        start_at: toEffectiveAt(ch.effective_on),
        end_at: p.end_on ? toEffectiveAt(addDays(p.end_on, 1)) : null,
        active: ch.effective_on <= today && (!p.end_on || p.end_on >= today),
        end_reason: null,
        replaced_by_position_id: null,
        scheduled_change_id: ch._id,
        manager_missing: false,
        source: ch.source.type === 'lo_nhap' ? 'lo_nhap' : 'tay',
        basis: p.basis,
        note: p.note,
        created_at: now,
        updated_at: now,
        rev: 1,
      };
      await positions(ctx.db).insertOne(doc, { session: ctx.session });
      if (doc.kind === 'chinh' && doc.active) {
        await people(ctx.db).updateOne(
          { _id: doc.person_id },
          {
            $set: {
              primary: { position_id: doc._id, unit_code: doc.unit_code, job_title_code: doc.job_title_code, job_function_code: doc.job_function_code, manager_person_id: doc.manager_person_id },
              updated_at: now,
            },
            $inc: { rev: 1, event_seq: 1 },
          },
          { session: ctx.session },
        );
      }
      await refreshIsManager(ctx.db, ctx.session, doc.manager_person_id);
      const person = await people(ctx.db).findOne({ _id: doc.person_id }, { session: ctx.session, projection: { employee_code: 1 } });
      const { _id, person_id: _p, created_at: _c, updated_at: _u, rev: _r, ...after } = doc;
      await ctx.audit({
        action: 'position.open',
        target: { type: 'person', id: ch.target.id, label: person?.employee_code ?? ch.target.id },
        after: { position_id: String(_id), ...after, manager_person_id: p.manager_person_id, scheduled_change_id: String(ch._id) },
      });
    },
  };
}
