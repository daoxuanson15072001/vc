import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { SessionService } from '../../src/auth/session.service';
import { C } from '../../src/db/db.service';
import { startE2EApp, type E2EApp } from './helpers';

// "Nhập file nhân sự VCparts (E4)" tried with the TD files (no real HR list yet: waiting for E4).
// The sample files live in docs/05-kiem-thu/du-lieu-mau/.
const DIR = resolve(__dirname, '../../../../docs/05-kiem-thu/du-lieu-mau');
const file = (name: string, filter?: (line: string, i: number) => boolean) => {
  const lines = readFileSync(resolve(DIR, name), 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const kept = filter ? lines.filter((l, i) => i === 0 || filter(l, i)) : lines;
  return { fileName: name, contentBase64: Buffer.from(kept.join('\n'), 'utf8').toString('base64') };
};

describe('TD sample files: org tree + people import (e2e)', () => {
  let t: E2EApp;
  let ad: { Authorization: string };
  const http = () => request(t.app.getHttpServer());
  const post = (url: string, body: unknown) => http().post(url).set(ad).send(body as object);

  beforeAll(async () => {
    t = await startE2EApp();
    await t.db.col(C.users).insertOne({ _id: 'TD-U-AD', email: 'quan.uat@vcprosperous.com', fullName: 'Đặng Văn Quân', status: 'hoat_dong' } as never);
    // Admin role seeded straight in the DB (M1b-04: admin routes need org.edit / user.import).
    await t.db.col('role_assignments').insertOne({ _id: 'TD-U-AD:admin:GOC', userId: 'TD-U-AD', roleKey: 'admin', orgUnitId: 'GOC', createdBy: 'seed', createdAt: new Date() } as never);
    ad = { Authorization: `Bearer ${await t.app.get(SessionService).create({ _id: 'TD-U-AD', fullName: 'Đặng Văn Quân' })}` };
  });
  afterAll(async () => {
    await t?.close();
  });

  it('builds the TD tree from cay-to-chuc-td.csv: 12 units, right parents, all rows valid', async () => {
    const c = await post('/api/admin/org-units/import', file('cay-to-chuc-td.csv')).expect(200);
    expect(c.body).toMatchObject({ loi: 0, them: 12, summary: 'Đã nhập 12 đơn vị.' });
    const units = (await http().get('/api/admin/org-units').set(ad)).body as Array<{ id: string; parentId: string; divisionId: string; type: string }>;
    expect(units.find((u) => u.id === 'TD-DV-HN1')).toMatchObject({ parentId: 'TD-DV-VCP', divisionId: 'TD-DV-VCP', type: 'to_ban_hang' });
    expect(units.find((u) => u.id === 'TD-DV-TVTS')).toMatchObject({ parentId: 'TD-DV-VCE', divisionId: 'TD-DV-VCE' });
  });

  it('imports the TD people: managers set, sensitive roles wait for approval, second run changes nothing', async () => {
    const f = file('nguoi-dung-td.csv');
    const p = await post('/api/admin/users/import/preview', f).expect(200);
    // Admin Quân is the importer, so his own row is refused (PQ-41); the other three sensitive rows wait (Vinh, Thắng, Lộc).
    expect(p.body).toMatchObject({ loi: 1, choDuyet: 3 });
    const noSelf = file('nguoi-dung-td.csv', (l) => !l.startsWith('quan.uat'));
    const c = await post('/api/admin/users/import', noSelf).expect(200);
    expect(c.body.summary).toBe('Đã nhập 24 người: 24 thêm mới, 0 cập nhật, 3 chờ duyệt vai trò nhạy cảm.');
    const units = (await http().get('/api/admin/org-units').set(ad)).body as Array<{ id: string; managerName: string | null; memberCount: number }>;
    expect(units.find((u) => u.id === 'TD-DV-HN1')).toMatchObject({ managerName: 'Nguyễn Thị Hương', memberCount: 3 + 1 });
    expect(units.find((u) => u.id === 'TD-DV-HN2')?.managerName).toBe('Hồ Văn Đức');
    expect(units.find((u) => u.id === 'TD-DV-HCM1')?.managerName).toBe('Hồ Văn Đức');
    expect(units.find((u) => u.id === 'TD-DV-CS')?.managerName).toBe('Đinh Thị Yến');
    const again = await post('/api/admin/users/import/preview', noSelf).expect(200);
    expect(again.body).toMatchObject({ them: 0, doi: 0, loi: 0 });
  });

  it('UAT-PQ-63 file: 60 lines, 4 wrong (3 faults + the importer himself); fixed file imports 56 people', async () => {
    const p = await post('/api/admin/users/import/preview', file('nguoi-dung-vcparts-60-dong-loi.csv')).expect(200);
    expect(p.body).toMatchObject({ total: 60, loi: 4 });
    const fixed = file('nguoi-dung-vcparts-60-dong-loi.csv', (l) => !/sai-loai|ngoai-domain|Khác Họ Tên|^quan\.uat/.test(l));
    const c = await post('/api/admin/users/import', fixed).expect(200);
    expect(c.body.summary).toBe('Đã nhập 56 người: 56 thêm mới, 0 cập nhật, 0 chờ duyệt vai trò nhạy cảm.');
  });
});
