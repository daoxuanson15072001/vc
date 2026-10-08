import type { Db, MongoClient } from 'mongodb';
import { SYSTEM, AuditService, expiresAt, ipPrefix, type AuditRow } from '../src/audit/audit.service';
import { rowHash } from '../src/audit/canonical';
import { SEAL_ACTION, sealDays, verifyChain } from '../src/audit/seal';
import { FakeClock } from '../src/common/clock';
import { withTx } from '../src/common/tx';
import { C } from '../src/db/collections';
import { runMigrations } from '../src/db/migrations';
import { connect, dbName, quietLog } from './util/mongo';

let client: MongoClient;
let db: Db;
const clock = new FakeClock(new Date('2026-11-30T17:00:02Z'));
let audit: AuditService;
beforeAll(async () => {
  client = await connect();
  db = client.db(dbName());
  await runMigrations(db, clock, quietLog, 'test');
  audit = new AuditService(db, clock);
});
afterAll(() => client.close());

const base = {
  actor: SYSTEM,
  target: { type: 'position', id: '6705a1f0c2a4b10012ac0298', label: 'VCP0156' },
  correlation_id: 'c-20261201-0000-a91e',
  source: { type: 'job' as const, ref: 'scheduled-changes.apply' },
};

test('Dòng nhật ký đủ trường 05 mục 3.18 + effective_on, source; hash khớp khi đọc lại; hết hạn sau 24 tháng', async () => {
  await withTx(client, (s) =>
    audit.record(s, { ...base, action: 'position.close', before: { end_on: null, active: true }, after: { end_on: '2026-11-30', active: false }, reason: 'QĐ điều chuyển 112/2026', effective_on: '2026-12-01', ip_prefix: null, after_extra: undefined } as never),
  );
  const row = (await db.collection<AuditRow>(C.auditLog).findOne({ action: 'position.close' }))!;
  expect(row).toMatchObject({ at: new Date('2026-11-30T17:00:02Z'), expires_at: new Date('2028-11-30T17:00:02Z'), effective_on: '2026-12-01', source: base.source });
  expect(row.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(rowHash(row as unknown as Record<string, unknown>)).toBe(row.hash);
  expect(Object.keys(row)).not.toContain('after_extra');
});

test('Ghi nhật ký lỗi thì thay đổi không được lưu (VH-ADM-01 bước 5)', async () => {
  await expect(
    withTx(client, async (s) => {
      await db.collection('ho_so_thu').insertOne({ _id: 'p1' as never, ten: 'Lan' }, { session: s });
      await audit.record(s, { ...base, action: 'person.update', reason: 'x'.repeat(301) });
    }),
  ).rejects.toThrow('Lý do tối đa 300 ký tự');
  expect(await db.collection('ho_so_thu').countDocuments()).toBe(0);
});

test('IP rút gọn: IPv4 bỏ nhóm cuối, IPv6 về /48', () => {
  expect(ipPrefix('113.161.20.57')).toBe('113.161.20.0/24');
  expect(ipPrefix('::ffff:10.0.3.9')).toBe('10.0.3.0/24');
  expect(ipPrefix('2001:db8:abcd:12::1')).toBe('2001:db8:abcd::/48');
  expect(ipPrefix(undefined)).toBeNull();
  expect(expiresAt(new Date('2026-02-28T00:00:00Z')).toISOString()).toBe('2028-02-28T00:00:00.000Z');
});

test('Niêm phong ngày nối chuỗi; sửa tay một dòng thì job kiểm báo lệch (VH-ADM-01 tiêu chí 2)', async () => {
  // Rows on 01/12 and 02/12 (Vietnam).
  for (const at of ['2026-12-01T01:00:00Z', '2026-12-01T09:00:00Z', '2026-12-02T03:00:00Z']) {
    clock.set(new Date(at));
    await withTx(client, (s) => audit.record(s, { ...base, action: 'person.update', after: { ten_goi: 'Lan' } }));
  }
  clock.set(new Date('2026-12-02T17:10:00Z')); // 00:10 on 03/12
  const sealed = await sealDays(db, client, audit, '2026-12-02', 'c-seal');
  // The first test's row (17:00:02Z on 30/11) is already 01/12 in Vietnam.
  expect(sealed).toEqual(['2026-12-01', '2026-12-02']);
  // Running again seals nothing new.
  expect(await sealDays(db, client, audit, '2026-12-02', 'c-seal')).toEqual([]);
  const seals = await db.collection<AuditRow>(C.auditLog).find({ action: SEAL_ACTION }).sort({ 'seal.day_on': 1 }).toArray();
  expect(seals.map((s) => [s.seal!.day_on, s.seal!.row_count, s.seal!.prev_chain_hash])).toEqual([
    ['2026-12-01', 3, null],
    ['2026-12-02', 1, seals[0].seal!.chain_hash],
  ]);
  expect(await verifyChain(db, '2026-12-03')).toEqual([]);

  // Somebody edits a row directly in the database.
  await db.collection(C.auditLog).updateOne({ at: new Date('2026-12-01T09:00:00Z') }, { $set: { 'after.ten_goi': 'Lan sửa tay' } });
  const problems = await verifyChain(db, '2026-12-03');
  expect(problems).toEqual(expect.arrayContaining([expect.objectContaining({ day_on: '2026-12-01', problem: 'hash_dong' })]));

  // Or deletes one.
  await db.collection(C.auditLog).deleteOne({ at: new Date('2026-12-02T03:00:00Z') });
  expect(await verifyChain(db, '2026-12-03')).toEqual(expect.arrayContaining([expect.objectContaining({ day_on: '2026-12-02', problem: 'chuoi' })]));
});

test('Chỉ mục: TTL theo expires_at, mỗi ngày chỉ một dòng niêm phong', async () => {
  const idx = await db.collection(C.auditLog).indexes();
  expect(idx.find((i) => i.name === 'expires_at_ttl')?.expireAfterSeconds).toBe(0);
  expect(idx.find((i) => i.name === 'seal_day')?.unique).toBe(true);
});
