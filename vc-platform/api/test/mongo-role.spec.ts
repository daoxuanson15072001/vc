/**
 * VH-ADM-01 tiêu chí 3: the API's MongoDB login cannot update or remove audit rows. Uses a replica set with access
 * control on, separate from the shared test one.
 */
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { FakeClock } from '../src/common/clock';
import { C } from '../src/db/collections';
import { runMigrations } from '../src/db/migrations';
import { API_ROLE, ensureAccessRoles } from '../src/db/roles';
import { quietLog } from './util/mongo';

let rs: MongoMemoryReplSet;
const DB = 'vchome';
const url = (user: string, pwd: string) => rs.getUri().replace('mongodb://', `mongodb://${user}:${pwd}@`).replace('/?', `/?authSource=${user === 'root' ? 'admin' : DB}&`);

beforeAll(async () => {
  rs = await MongoMemoryReplSet.create({ replSet: { count: 1, auth: { enable: true, customRootName: 'root', customRootPwd: 'root-pw' } } });
  const root = await new MongoClient(url('root', 'root-pw')).connect();
  await root.db(DB).command({
    createUser: 'vchome_migrate',
    pwd: 'migrate-pw',
    roles: [
      { role: 'dbAdmin', db: DB },
      { role: 'userAdmin', db: DB },
      { role: 'readWrite', db: DB },
    ],
  });
  await root.close();
  // The migration login creates collections, indexes and the API role.
  const migrate = await new MongoClient(url('vchome_migrate', 'migrate-pw')).connect();
  await runMigrations(migrate.db(DB), new FakeClock(new Date()), quietLog, 'test');
  await migrate.db(DB).command({ createUser: 'vchome_api', pwd: 'api-pw', roles: [{ role: API_ROLE, db: DB }] });
  await migrate.close();
}, 60_000);
afterAll(() => rs.stop());

test('Tài khoản vchome_api: thêm và đọc nhật ký được; sửa, xoá nhật ký bị từ chối; collection khác ghi bình thường', async () => {
  const api = await new MongoClient(url('vchome_api', 'api-pw')).connect();
  try {
    const log = api.db(DB).collection(C.auditLog);
    await log.insertOne({ action: 'thu.ghi', at: new Date() });
    expect(await log.countDocuments({ action: 'thu.ghi' })).toBe(1);
    await expect(log.updateOne({ action: 'thu.ghi' }, { $set: { action: 'thu.sua' } })).rejects.toMatchObject({ codeName: 'Unauthorized' });
    await expect(log.deleteOne({ action: 'thu.ghi' })).rejects.toMatchObject({ codeName: 'Unauthorized' });
    await expect(log.drop()).rejects.toMatchObject({ codeName: 'Unauthorized' });
    const locks = api.db(DB).collection(C.jobLocks);
    await locks.updateOne({ _id: 'thu' as never }, { $set: { owner: 'x' } }, { upsert: true });
    await locks.deleteOne({ _id: 'thu' as never });
    // Indexes are the migration login's job.
    await expect(locks.createIndex({ owner: 1 })).rejects.toMatchObject({ codeName: 'Unauthorized' });
  } finally {
    await api.close();
  }
});

test('Ai đó lỡ cấp quyền sửa nhật ký cho vai trò: lần khởi động sau thu lại', async () => {
  const migrate = await new MongoClient(url('vchome_migrate', 'migrate-pw')).connect();
  const api = await new MongoClient(url('vchome_api', 'api-pw')).connect();
  try {
    await migrate.db(DB).command({ grantPrivilegesToRole: API_ROLE, privileges: [{ resource: { db: DB, collection: C.auditLog }, actions: ['update', 'remove'] }] });
    await ensureAccessRoles(migrate.db(DB));
    const log = api.db(DB).collection(C.auditLog);
    await log.insertOne({ action: 'thu.ghi2', at: new Date() });
    await expect(log.updateOne({ action: 'thu.ghi2' }, { $set: { action: 'x' } })).rejects.toMatchObject({ codeName: 'Unauthorized' });
  } finally {
    await migrate.close();
    await api.close();
  }
});
