import { INITIAL_FUNCTIONS, foldName } from '@vc/contracts';
import type { Db } from 'mongodb';
import { C } from '../../db/collections';
import { todayOn, SystemClock } from '../../common/clock';
import type { JobFunctionDoc } from './types';

/** Migration B0004_functions: the 10 functions of Q-02 (04 VH-ORG-03 tiêu chí 1), only those missing. */
export async function seedFunctions(db: Db): Promise<void> {
  const now = new Date();
  const today = todayOn(new SystemClock());
  for (const [i, f] of INITIAL_FUNCTIONS.entries()) {
    await db.collection<JobFunctionDoc>(C.jobFunctions).updateOne(
      { _id: f.code },
      {
        $setOnInsert: {
          name: f.name,
          name_folded: foldName(f.name),
          description: '',
          order: (i + 1) * 10,
          status: 'dang_dung',
          status_from: today,
          merged_into_code: null,
          created_at: now,
          updated_at: now,
          rev: 1,
        },
      },
      { upsert: true },
    );
  }
}
