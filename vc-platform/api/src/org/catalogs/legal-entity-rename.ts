/**
 * Change kind `legal_entity_rename` (04 VH-ORG-07 bước 4): a legal entity takes a new registered name from a date; the
 * old names stay in `name_history`. Goes through the change core so it can be scheduled, conflicts are asked, and the
 * job applies it at 00:00.
 */
import { CATALOG_MSG, fillMsg, foldName, formatVnDate, tidyName } from '@vc/contracts';
import { z } from 'zod';
import { ApiError } from '../../common/api-error';
import type { ChangeHandler } from '../../common/changes';
import { C } from '../../db/collections';
import { LEGAL_RENAME } from './catalog.service';
import type { CatalogHooks } from './hooks';
import type { LegalEntityDoc } from './types';

type Payload = { name: string };

export function legalEntityRename(hooks: CatalogHooks): ChangeHandler<Payload> {
  return {
    kind: LEGAL_RENAME,
    category: 'co_cau',
    permission: 'co_cau.sua',
    schema: z.object({ name: z.string().transform(tidyName).pipe(z.string().min(1, 'Nhập tên đầy đủ.').max(200, 'Tên đầy đủ tối đa 200 ký tự.')) }),
    authorize(viewer) {
      if (viewer.hcnsScope !== 'all') throw new ApiError('forbidden', { message: CATALOG_MSG.legalAllOnly });
    },
    conflictKeys: (it) => [`legal_entity:${it.target.id}:name`],
    describe: (it) => `đổi tên pháp nhân ${it.target.id} thành "${it.payload.name}"`,
    async validate(ctx, it) {
      const col = ctx.db.collection<LegalEntityDoc>(C.legalEntities);
      const cur = await col.findOne({ _id: it.target.id }, { session: ctx.session });
      if (!cur) throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.notFoundRef, { label: 'Pháp nhân', code: it.target.id }) });
      const last = cur.name_history.at(-1);
      if (last && ctx.effectiveOn < last.from_on) throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.renameAfter, { ngay: formatVnDate(last.from_on) }) });
      const dup = await col.findOne({ name_folded: foldName(it.payload.name), status: { $in: ['dang_dung', 'ngung'] }, _id: { $ne: cur._id } }, { session: ctx.session });
      if (dup) throw new ApiError('rule_violation', { message: fillMsg(CATALOG_MSG.duplicate, { label: 'Pháp nhân', name: dup.name, code: dup._id }) });
    },
    affectedPeople: async () => [],
    noBulkConfirm: true,
    async apply(ctx, ch) {
      const col = ctx.db.collection<LegalEntityDoc>(C.legalEntities);
      const cur = (await col.findOne({ _id: ch.target.id }, { session: ctx.session })) as LegalEntityDoc;
      // Same day as the current name: a correction of that name, not a second one.
      const history = cur.name_history.filter((h) => h.from_on !== ch.effective_on);
      history.push({ name: ch.payload.name, from_on: ch.effective_on });
      const after = { ...cur, name: ch.payload.name, name_folded: foldName(ch.payload.name), name_history: history, updated_at: ctx.clock.now(), rev: cur.rev + 1 };
      await col.updateOne(
        { _id: cur._id },
        { $set: { name: after.name, name_folded: after.name_folded, name_history: history, updated_at: after.updated_at }, $inc: { rev: 1 } },
        { session: ctx.session },
      );
      await ctx.audit({ action: 'legal_entity.rename', target: { type: 'legal_entity', id: cur._id, label: after.name }, before: { name: cur.name }, after: { name: after.name } });
      await hooks.run(ctx.session, { type: 'legal-entities', code: cur._id, action: 'rename', before: cur, after });
    },
  };
}
