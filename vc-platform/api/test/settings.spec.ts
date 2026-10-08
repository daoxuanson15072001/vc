import { SETTINGS } from '@vc/contracts';
import type { Db, MongoClient } from 'mongodb';
import { AuditService, SYSTEM } from '../src/audit/audit.service';
import { FakeClock } from '../src/common/clock';
import { C } from '../src/db/collections';
import { runMigrations } from '../src/db/migrations';
import { SettingsService, type SettingDoc } from '../src/settings/settings.service';
import { connect, dbName, quietLog } from './util/mongo';

let client: MongoClient;
let db: Db;
let settings: SettingsService;
const clock = new FakeClock(new Date('2026-11-20T08:10:00Z'));
const ctx = { correlationId: 'c-settings', source: 'script' as const };
const admin = { ...SYSTEM, type: 'nguoi' as const, sub: 'qt-1', person_id: 'p-qt-1' };

beforeAll(async () => {
  client = await connect();
  db = client.db(dbName());
  await runMigrations(db, clock, quietLog, 'test');
  settings = new SettingsService(db, client, clock, new AuditService(db, clock));
});
afterAll(() => client.close());

test('Migration B0003 gieo mọi cài đặt với giá trị mặc định; chạy lại không ghi đè giá trị đã sửa', async () => {
  const docs = await db.collection<SettingDoc>(C.settings).find().toArray();
  expect(docs.map((d) => d._id).sort()).toEqual(Object.keys(SETTINGS).sort());
  expect(docs.find((d) => d._id === 'bulk.confirm_min_people')).toMatchObject({ value: 21, default_value: 21 });
  await db.collection<SettingDoc>(C.settings).updateOne({ _id: 'alerts.dedupe_minutes' }, { $set: { value: 30 } });
  await runMigrations(db, clock, quietLog, 'test-2');
  expect((await db.collection<SettingDoc>(C.settings).findOne({ _id: 'alerts.dedupe_minutes' }))?.value).toBe(30);
});

test('Đọc: lấy giá trị đã lưu; thiếu hoặc sai kiểu thì dùng mặc định', async () => {
  expect(await settings.get('bulk.confirm_min_people')).toBe(21);
  await db.collection<SettingDoc>(C.settings).updateOne({ _id: 'changes.overdue_alert_minutes' }, { $set: { value: 'mười lăm' } });
  expect(await settings.get('changes.overdue_alert_minutes')).toBe(SETTINGS['changes.overdue_alert_minutes'].default);
});

test('Sửa: ghi giá trị, người sửa, lý do và một dòng nhật ký setting.update trong cùng giao dịch', async () => {
  await settings.set('bulk.confirm_min_people', 10, 'Giảm ngưỡng theo đề nghị KS', admin, ctx);
  expect(await settings.get('bulk.confirm_min_people')).toBe(10);
  expect(await db.collection<SettingDoc>(C.settings).findOne({ _id: 'bulk.confirm_min_people' })).toMatchObject({ value: 10, default_value: 21, updated_by: 'p-qt-1', reason: 'Giảm ngưỡng theo đề nghị KS' });
  const row = await db.collection(C.auditLog).findOne({ action: 'setting.update', 'target.id': 'bulk.confirm_min_people' });
  expect(row).toMatchObject({ before: { value: 21 }, after: { value: 10 }, reason: 'Giảm ngưỡng theo đề nghị KS', source: { type: 'script' }, correlation_id: 'c-settings' });
});

test('Từ chối: khoá lạ, cài đặt chỉ đọc, lý do ngắn, giá trị ngoài giới hạn — không ghi gì', async () => {
  const rows = () => db.collection(C.auditLog).countDocuments({ action: 'setting.update' });
  const n = await rows();
  await expect(settings.set('khong.co', 1, 'Lý do đủ dài ở đây', admin, ctx)).rejects.toMatchObject({ code: 'not_found' });
  await expect(settings.set('bulk.confirm_drift_percent', 30, 'Lý do đủ dài ở đây', admin, ctx)).rejects.toMatchObject({ code: 'rule_violation', message: expect.stringContaining('chỉ đọc') });
  await expect(settings.set('changes.past_warning_days', 60, 'Lý do đủ dài ở đây', admin, ctx)).rejects.toMatchObject({ code: 'rule_violation' });
  await expect(settings.set('bulk.confirm_min_people', 5, 'ngắn', admin, ctx)).rejects.toMatchObject({ message: 'Nhập lý do (ít nhất 10 ký tự).' });
  // VH-BR-25: the threshold may go down to 2 but never above 21.
  await expect(settings.set('bulk.confirm_min_people', 22, 'Lý do đủ dài ở đây', admin, ctx)).rejects.toMatchObject({
    code: 'rule_violation',
    message: 'Giá trị không hợp lệ cho "Số người bị ảnh hưởng cần quản trị xác nhận lần hai": cần số nguyên từ 2 đến 21.',
  });
  await expect(settings.set('bulk.confirm_min_people', 1, 'Lý do đủ dài ở đây', admin, ctx)).rejects.toMatchObject({ code: 'rule_violation' });
  await expect(settings.set('bulk.confirm_min_people', 2.5, 'Lý do đủ dài ở đây', admin, ctx)).rejects.toMatchObject({ code: 'rule_violation' });
  expect(await rows()).toBe(n);
  expect(await settings.get('bulk.confirm_min_people')).toBe(10);
});
