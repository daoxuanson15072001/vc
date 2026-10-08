import { foldName } from '@vc/contracts';
import type { Db } from 'mongodb';
import { todayOn, type Clock } from '../../common/clock';
import { units } from './tree';

/** Migration B0005_root_unit: the one unit of type Tập đoàn (04 VH-ORG-01 "Có sẵn một đơn vị gốc"). */
export async function seedRootUnit(db: Db, root: { code: string; name: string }, clock: Clock): Promise<void> {
  if (await units(db).findOne({ type: 'tap_doan' })) return;
  const now = clock.now();
  await units(db).insertOne({
    _id: root.code,
    name: root.name,
    name_folded: foldName(root.name),
    short_name: null,
    type: 'tap_doan',
    parent_code: null,
    ancestors: [],
    division_code: null,
    legal_entity_code: null,
    function_code: null,
    head_person_id: null,
    head_history: [],
    status: 'hoat_dong',
    effective_from_on: todayOn(clock),
    effective_to_on: null,
    merged_into_code: null,
    order: 0,
    group_email: null,
    description: '',
    deleted_at: null,
    event_seq: 0,
    created_at: now,
    updated_at: now,
    rev: 1,
  });
}
