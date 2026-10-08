import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Db } from 'mongodb';
import request from 'supertest';
import { createApp } from '../src/app.factory';
import { SYSTEM, type Actor } from '../src/audit/audit.service';
import { AlertService } from '../src/common/alerts';
import type { ChangeDoc } from '../src/common/changes';
import { FakeClock } from '../src/common/clock';
import { C } from '../src/db/collections';
import { DB } from '../src/db/mongo';
import { JobRunner } from '../src/jobs/runner';
import { ChangeService, type Requester } from '../src/people/changes/change.service';
import { SettingsService } from '../src/settings/settings.service';
import { startIssuer, userClaims, type FakeIssuer } from './util/issuer';
import { quietLog, testEnv } from './util/mongo';
import { PEOPLE, ThuChangesModule, UNITS } from './util/thu-changes';
import type { SubmitInput } from '../src/people/changes/change.service';

let app: NestExpressApplication;
let issuer: FakeIssuer;
let db: Db;
let changes: ChangeService;
const alerts: { code: string; text: string }[] = [];
const clock = new FakeClock(new Date('2026-11-20T08:10:00Z')); // 15:10 20/11 Vietnam

const hcns = (sub = 'hcns-1'): Requester => ({
  actor: { ...SYSTEM, type: 'nguoi', sub, person_id: `p-${sub}` } as Actor,
  correlationId: `c-${sub}`,
  via: 'man_hinh',
});
const at = (iso: string) => clock.set(new Date(iso));
/** A token valid at the fake clock's time (the API checks exp/iat against the same clock). */
const bearer = async (sub: string, roles: string[]) => {
  const iat = Math.floor(clock.now().getTime() / 1000);
  return `Bearer ${await issuer.token(userClaims(sub, roles), { iat, exp: iat + 300 })}`;
};
const unit = (code: string) => db.collection(UNITS).findOne({ code });
const person = (id: string) => db.collection<{ _id: string; unit_code?: string }>(PEOPLE).findOne({ _id: id });
const group = (id: string) => db.collection<ChangeDoc>(C.scheduledChanges).find({ group_id: { $eq: new (require('mongodb').ObjectId)(id) } }).toArray();

beforeAll(async () => {
  issuer = await startIssuer();
  app = await createApp({ env: testEnv({ OIDC_ISSUER: issuer.url }), clock, log: quietLog, extraModules: [ThuChangesModule] });
  await app.init();
  db = app.get(DB);
  changes = app.get(ChangeService);
  jest.spyOn(app.get(AlertService), 'send').mockImplementation(async (_l, code, text) => void alerts.push({ code, text }));
});
afterAll(async () => {
  await app.close();
  await issuer.close();
});

test('Hẹn 01/12: 23:59 ngày 30/11 chưa áp, 00:01 ngày 01/12 đã áp (B-03 xong khi)', async () => {
  at('2026-11-20T08:10:00Z');
  await db.collection(UNITS).insertOne({ code: 'VCP-TBH2', name: 'Tổ bán hàng HN2' });
  const r = await changes.submit({ items: [{ kind: 'thu_person_move', target: { type: 'person', id: 'VCP0156' }, payload: { unit_code: 'VCP-TBH2' } }], effective_on: '2026-12-01', reason: 'QĐ điều chuyển 112/2026' }, hcns());
  expect(r).toMatchObject({ status: 'cho_ap', message: 'Đã hẹn áp lúc 00:00 ngày 01/12/2026.' });
  at('2026-11-30T16:59:00Z'); // 23:59 30/11
  expect(await changes.applyDue('c1')).toMatchObject({ applied: 0 });
  expect(await person('VCP0156')).toBeNull();
  at('2026-11-30T17:01:00Z'); // 00:01 01/12
  expect(await changes.applyDue('c2')).toMatchObject({ applied: 1, failed: 0 });
  expect((await person('VCP0156'))?.unit_code).toBe('VCP-TBH2');
  const [doc] = await group(r.group_id);
  expect(doc).toMatchObject({ status: 'da_ap', applied_at: new Date('2026-11-30T17:01:00Z') });
  // The audit row of the change: done by the system for the sender, effective date and the group as source.
  const row = await db.collection(C.auditLog).findOne({ action: 'person.move', 'target.id': 'VCP0156' });
  expect(row).toMatchObject({ actor: { type: 'he_thong', on_behalf_of_person_id: 'p-hcns-1' }, effective_on: '2026-12-01', reason: 'QĐ điều chuyển 112/2026', source: { type: 'job', ref: r.group_id } });
});

test('Ngày hiệu lực hôm nay hoặc đã qua: áp ngay khi lưu; quá 30 ngày thì cảnh báo, không chặn', async () => {
  at('2026-11-20T08:10:00Z');
  const now = await changes.submit({ items: [{ kind: 'thu_unit_create', target: { type: 'org_unit', id: 'VCP-KD2' }, payload: { code: 'VCP-KD2', name: 'Phòng KD 2' } }], effective_on: '2026-11-20' }, hcns());
  expect(now).toMatchObject({ status: 'da_ap', message: 'Đã lưu, có hiệu lực từ 20/11/2026.', warnings: [] });
  expect(await unit('VCP-KD2')).toBeTruthy();
  const old = await changes.submit({ items: [{ kind: 'thu_person_move', target: { type: 'person', id: 'VCP0300' }, payload: { unit_code: 'VCP-KD2' } }], effective_on: '2026-10-01' }, hcns());
  expect(old.status).toBe('da_ap');
  expect(old.warnings).toEqual(['Ngày hiệu lực đã qua 50 ngày. Lịch sử ghi đúng ngày bạn nhập; quyền và sự kiện tính từ lúc lưu.']);
});

test('Hai thay đổi mâu thuẫn: 409 với câu 06 mục 1.5; đồng ý thay thì huỷ thay đổi cũ trong cùng giao dịch', async () => {
  at('2026-11-20T08:10:00Z');
  const first = await changes.submit({ items: [{ kind: 'thu_person_move', target: { type: 'person', id: 'VCP0200' }, payload: { unit_code: 'VCP-TBH2' } }], effective_on: '2026-12-01' }, hcns());
  const second: SubmitInput = { items: [{ kind: 'thu_person_move', target: { type: 'person', id: 'VCP0200' }, payload: { unit_code: 'VCP-KD2' } }], effective_on: '2026-12-05' };
  const err = await changes.submit(second, hcns()).catch((e) => e);
  expect(err).toMatchObject({ code: 'hen_xung_dot', status: 409 });
  expect(err.message).toBe('Đã có thay đổi hẹn ngày 01/12/2026: chuyển VCP0200 sang VCP-TBH2. Thay đổi mới mâu thuẫn với thay đổi này. Huỷ thay đổi cũ và lưu thay đổi mới?');
  const conflictId = err.details.conflicts[0].id;
  const replaced = await changes.submit({ ...second, replace_ids: [conflictId] }, hcns());
  expect(replaced.status).toBe('cho_ap');
  expect((await group(first.group_id))[0]).toMatchObject({ status: 'da_huy', cancel_reason: 'Thay bằng thay đổi mới' });
});

test('Mở vị trí ở đơn vị sẽ có cùng ngày: lúc gửi kiểm theo trạng thái tại ngày hiệu lực; lúc áp cơ cấu trước, người sau', async () => {
  at('2026-11-20T08:10:00Z');
  // Sent in the "wrong" order: the person first, then the unit (both effective 02/12).
  await expect(changes.submit({ items: [{ kind: 'thu_person_move', target: { type: 'person', id: 'VCP0400' }, payload: { unit_code: 'VCP-MOI' } }], effective_on: '2026-12-02' }, hcns())).rejects.toMatchObject({ code: 'rule_violation' });
  await changes.submit({ items: [{ kind: 'thu_unit_create', target: { type: 'org_unit', id: 'VCP-MOI' }, payload: { code: 'VCP-MOI', name: 'Tổ mới' } }], effective_on: '2026-12-02' }, hcns('hcns-2'));
  await changes.submit({ items: [{ kind: 'thu_person_move', target: { type: 'person', id: 'VCP0400' }, payload: { unit_code: 'VCP-MOI' } }], effective_on: '2026-12-02' }, hcns());
  at('2026-12-01T17:00:30Z');
  expect(await changes.applyDue('c3')).toMatchObject({ applied: 2, failed: 0 });
  expect((await person('VCP0400'))?.unit_code).toBe('VCP-MOI');
});

test('Job chạy song song hai lần chỉ áp một lần (B-03 xong khi)', async () => {
  at('2026-11-20T08:10:00Z');
  await changes.submit({ items: [{ kind: 'thu_unit_create', target: { type: 'org_unit', id: 'VCP-SS' }, payload: { code: 'VCP-SS', name: 'Song song' } }], effective_on: '2026-12-03' }, hcns());
  at('2026-12-02T17:00:10Z');
  const [a, b] = await Promise.all([changes.applyDue('p1'), changes.applyDue('p2')]);
  expect(a.applied + b.applied).toBe(1);
  expect(await db.collection(UNITS).countDocuments({ code: 'VCP-SS' })).toBe(1);
  expect(await db.collection(C.auditLog).countDocuments({ action: 'org_unit.create', 'target.id': 'VCP-SS' })).toBe(1);
});

test('Lỗi giữa nhóm: không áp nửa vời, cả nhóm ở "loi", có cảnh báo #9 (B-03 xong khi)', async () => {
  at('2026-11-20T08:10:00Z');
  const r = await changes.submit(
    {
      items: [
        { kind: 'thu_unit_create', target: { type: 'org_unit', id: 'VCP-NV' }, payload: { code: 'VCP-NV', name: 'Nửa vời' } },
        { kind: 'thu_fail_on_apply', target: { type: 'person', id: 'VCP0500' }, payload: { note: 'x' } },
      ],
      effective_on: '2026-12-04',
    },
    hcns(),
  );
  at('2026-12-03T17:00:10Z');
  expect(await changes.applyDue('c4')).toMatchObject({ applied: 0, failed: 1 });
  expect(await unit('VCP-NV')).toBeNull();
  const docs = await group(r.group_id);
  expect(docs.map((d) => d.status)).toEqual(['loi', 'loi']);
  expect(docs[0].error).toEqual({ code: 'rule_violation', message: 'Quản lý mới đã nghỉ việc trước ngày hiệu lực.' });
  expect(alerts).toContainEqual({ code: 'thay_doi_hen_loi', text: 'Thay đổi hẹn ngày 04/12/2026 không áp được: Quản lý mới đã nghỉ việc trước ngày hiệu lực.' });
});

describe('Thay đổi hàng loạt cần quản trị thứ hai xác nhận (VH-BR-25)', () => {
  const people = Array.from({ length: 25 }, (_, i) => `VCP${1000 + i}`);
  const http = () => request(app.getHttpServer());

  test('≥ 21 người: chờ xác nhận; người gửi không tự xác nhận được; người khác xác nhận thì áp', async () => {
    at('2026-11-20T08:10:00Z');
    const r = await changes.submit({ items: [{ kind: 'thu_bulk_move', target: { type: 'org_unit', id: 'VCP-KD2' }, payload: { people, unit_code: 'VCP-KD2' } }], effective_on: '2026-11-20' }, { ...hcns(), actor: { ...SYSTEM, type: 'nguoi', sub: 'qt-a', person_id: 'p-qt-a' } });
    expect(r).toMatchObject({ status: 'cho_xac_nhan', affected_people: 25 });
    expect(r.message).toBe('Thay đổi ảnh hưởng 25 người nên chờ một quản trị hệ thống khác xác nhận (VH-BR-25).');
    const list = await http().get('/api/v1/admin/scheduled-changes/waiting-confirmation').set('Authorization', await bearer('qt-b', ['qtht'])).expect(200);
    expect(list.body.map((g: { group_id: string }) => g.group_id)).toContain(r.group_id);
    // HC-NS cannot confirm at all; the sender (also QTHT here) cannot confirm their own change.
    await http().post(`/api/v1/admin/scheduled-changes/${r.group_id}/confirm`).set('Authorization', await bearer('hc', ['hcns'])).expect(403);
    const own = await http().post(`/api/v1/admin/scheduled-changes/${r.group_id}/confirm`).set('Authorization', await bearer('qt-a', ['qtht'])).expect(403);
    expect(own.body.message).toBe('Không xác nhận được thay đổi do chính bạn gửi. Nhờ một quản trị hệ thống khác.');
    const ok = await http().post(`/api/v1/admin/scheduled-changes/${r.group_id}/confirm`).set('Authorization', await bearer('qt-b', ['qtht'])).expect(200);
    expect(ok.body.status).toBe('da_ap');
    expect((await person('VCP1000'))?.unit_code ?? null).toBeNull(); // updateMany only touches existing people
  });

  test('Số người lệch > 20% từ lúc gửi: không xác nhận được, phải xem lại; lệch sau khi xác nhận thì job đưa về chờ xác nhận', async () => {
    at('2026-11-20T08:10:00Z');
    const r = await changes.submit({ items: [{ kind: 'thu_bulk_move', target: { type: 'org_unit', id: 'VCP-KD3' }, payload: { people: people.map((p) => `${p}x`), unit_code: 'VCP-KD2' } }], effective_on: '2026-12-10' }, hcns('qt-c'));
    expect(r.status).toBe('cho_xac_nhan');
    await db.collection<{ _id: string }>('thu_gone').insertMany(people.slice(0, 8).map((p) => ({ _id: `${p}x` })));
    const res = await http().post(`/api/v1/admin/scheduled-changes/${r.group_id}/confirm`).set('Authorization', await bearer('qt-d', ['qtht'])).expect(422);
    expect(res.body.message).toBe('Số người bị ảnh hưởng đã đổi từ 25 thành 17 kể từ lúc gửi. Xem lại trước khi xác nhận.');
    // A second look at the new count: confirmed, queued for 10/12.
    const ok = await http().post(`/api/v1/admin/scheduled-changes/${r.group_id}/confirm`).set('Authorization', await bearer('qt-d', ['qtht'])).expect(200);
    expect(ok.body.status).toBe('cho_ap');
    // Before 10/12 the count moves again by more than 20 %.
    await db.collection<{ _id: string }>('thu_gone').insertMany(people.slice(8, 14).map((p) => ({ _id: `${p}x` })));
    at('2026-12-09T17:00:10Z');
    expect(await changes.applyDue('c5')).toMatchObject({ requeued: 1 }); // other tests' groups due by then may apply
    expect((await group(r.group_id))[0]).toMatchObject({ status: 'cho_xac_nhan', confirm: { preview_count: 11, confirmed_count: null } });
  });

  test('Ngưỡng lấy từ cài đặt: hạ xuống 5 thì 5 người cũng cần xác nhận', async () => {
    at('2026-11-20T08:10:00Z');
    await app.get(SettingsService).set('bulk.confirm_min_people', 5, 'Thử ngưỡng thấp trong UAT', SYSTEM, { correlationId: 'c-set', source: 'script' });
    const r = await changes.submit({ items: [{ kind: 'thu_bulk_move', target: { type: 'org_unit', id: 'VCP-KD4' }, payload: { people: ['a', 'b', 'c', 'd', 'e'], unit_code: 'VCP-KD2' } }], effective_on: '2026-12-20' }, hcns());
    expect(r.status).toBe('cho_xac_nhan');
    await app.get(SettingsService).set('bulk.confirm_min_people', 21, 'Trả lại ngưỡng mặc định', SYSTEM, { correlationId: 'c-set2', source: 'script' });
  });
});

test('Huỷ hẹn: cần quyền theo loại thay đổi; đã áp thì không huỷ được', async () => {
  at('2026-11-20T08:10:00Z');
  const r = await changes.submit({ items: [{ kind: 'thu_unit_create', target: { type: 'org_unit', id: 'VCP-HUY' }, payload: { code: 'VCP-HUY', name: 'Sẽ huỷ' } }], effective_on: '2026-12-15' }, hcns());
  const http = request(app.getHttpServer());
  // QTHT has no co_cau.sua.
  await http.post(`/api/v1/admin/scheduled-changes/${r.group_id}/cancel`).set('Authorization', await bearer('qt', ['qtht'])).send({ reason: 'Nhầm ngày' }).expect(403);
  const ok = await request(app.getHttpServer()).post(`/api/v1/admin/scheduled-changes/${r.group_id}/cancel`).set('Authorization', await bearer('hc', ['hcns'])).send({ reason: 'Nhầm ngày' }).expect(200);
  expect(ok.body.status).toBe('da_huy');
  const again = await request(app.getHttpServer()).post(`/api/v1/admin/scheduled-changes/${r.group_id}/cancel`).set('Authorization', await bearer('hc', ['hcns'])).send({ reason: 'Nhầm ngày' }).expect(422);
  expect(again.body.message).toBe('Thay đổi này đã áp hoặc đã huỷ, không làm thao tác này được nữa.');
});

test('Job dừng quá 15 phút sau giờ hẹn: lần chạy lại vẫn áp bù và gửi cảnh báo #9 một lần', async () => {
  at('2026-11-20T08:10:00Z');
  await changes.submit({ items: [{ kind: 'thu_unit_create', target: { type: 'org_unit', id: 'VCP-TRE' }, payload: { code: 'VCP-TRE', name: 'Áp trễ' } }], effective_on: '2026-12-22' }, hcns());
  at('2026-12-21T17:20:00Z'); // 00:20 22/12
  alerts.length = 0;
  expect(await changes.applyDue('c6')).toMatchObject({ applied: 1, failed: 0 });
  expect(await unit('VCP-TRE')).toBeTruthy();
  expect(alerts).toEqual([{ code: 'thay_doi_hen_tre', text: '1 thay đổi hẹn đã quá giờ áp hơn 15 phút mà chưa áp (job dừng hoặc chạy chậm). Job đang áp bù; kiểm lại kết quả.' }]);
  await changes.applyDue('c7');
  expect(alerts).toHaveLength(1);
});

test('Job scheduled-changes.apply chạy theo lịch mỗi phút qua bộ chạy job', async () => {
  at('2026-11-20T08:10:00Z');
  await changes.submit({ items: [{ kind: 'thu_unit_create', target: { type: 'org_unit', id: 'VCP-JOB' }, payload: { code: 'VCP-JOB', name: 'Qua job' } }], effective_on: '2026-12-23' }, hcns());
  at('2026-12-22T17:00:05Z');
  expect(await app.get(JobRunner).tick()).toContain('scheduled-changes.apply');
  expect(await unit('VCP-JOB')).toBeTruthy();
});
