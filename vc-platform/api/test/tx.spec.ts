import { MongoServerError, type MongoClient } from 'mongodb';
import { ApiError } from '../src/common/api-error';
import { updateByRev } from '../src/common/rev';
import { withTx } from '../src/common/tx';
import { connect, dbName } from './util/mongo';

let client: MongoClient;
const db = () => client.db(name);
const name = dbName();
beforeAll(async () => {
  client = await connect();
  await db().createCollection('dem');
});
afterAll(() => client.close());

test('Lỗi tạm (TransientTransactionError) thì chạy lại cả transaction', async () => {
  let attempts = 0;
  const r = await withTx(client, async (session) => {
    attempts++;
    await db().collection('dem').insertOne({ lan: attempts }, { session });
    if (attempts === 1) {
      const e = new MongoServerError({ message: 'giả lập xung đột', errmsg: 'giả lập xung đột' });
      e.addErrorLabel('TransientTransactionError');
      throw e;
    }
    return 'xong';
  });
  expect(r).toBe('xong');
  expect(attempts).toBe(2);
  // Lần 1 bị huỷ: chỉ còn bản ghi của lần 2.
  expect(await db().collection('dem').find().toArray()).toEqual([expect.objectContaining({ lan: 2 })]);
});

test('Lỗi khác không chạy lại và không để lại dữ liệu nửa vời', async () => {
  await expect(
    withTx(client, async (session) => {
      await db().collection('dem').insertOne({ nua_voi: true }, { session });
      throw new ApiError('bad_request');
    }),
  ).rejects.toBeInstanceOf(ApiError);
  expect(await db().collection('dem').countDocuments({ nua_voi: true })).toBe(0);
});

test('Hai transaction cùng sửa một bản ghi: xung đột ghi được chạy lại, không mất lượt nào', async () => {
  await db().collection('dem').insertOne({ _id: 'x' as never, n: 0 });
  await Promise.all(
    Array.from({ length: 8 }, () =>
      withTx(client, async (session) => {
        const cur = await db().collection('dem').findOne({ _id: 'x' as never }, { session });
        await db().collection('dem').updateOne({ _id: 'x' as never }, { $set: { n: (cur?.n ?? 0) + 1 } }, { session });
      }, { maxAttempts: 20 }),
    ),
  );
  expect((await db().collection('dem').findOne({ _id: 'x' as never }))?.n).toBe(8);
});

test('updateByRev: đúng rev thì sửa và tăng rev; rev cũ là 409', async () => {
  const col = db().collection<{ _id: string; ten: string; rev: number }>('ho_so');
  await col.insertOne({ _id: 'p1', ten: 'Lan', rev: 1 });
  const after = await updateByRev(col, { _id: 'p1' }, 1, { $set: { ten: 'Lan Nguyễn' } });
  expect(after).toMatchObject({ ten: 'Lan Nguyễn', rev: 2 });
  await expect(updateByRev(col, { _id: 'p1' }, 1, { $set: { ten: 'X' } })).rejects.toMatchObject({ code: 'conflict_rev', status: 409 });
  await expect(updateByRev(col, { _id: 'khong-co' }, 1, { $set: { ten: 'X' } })).rejects.toMatchObject({ code: 'not_found' });
});
