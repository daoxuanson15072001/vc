import type { VcsaleStaffMember } from '@vclinks/vcsale-client';
import { emailKey, matchStaff, type MatchUser } from './staff-match';

const staff = (id: string, fullName: string, email: string | null, more: Partial<VcsaleStaffMember> = {}): VcsaleStaffMember => ({
  id,
  fullName,
  email,
  active: true,
  positionCode: 'NVKD',
  positionName: 'Nhân viên kinh doanh',
  departmentName: 'Kinh doanh',
  employeeId: null,
  emailMissing: !email,
  emailDuplicated: false,
  ...more,
});

describe('matchStaff (plan C5, D8-06)', () => {
  const users = new Map<string, MatchUser>([
    ['minh@vcprosperous.com', { id: 'U1', fullName: 'Nguyễn Văn Minh', status: 'hoat_dong' }],
    ['chung@vcprosperous.com', { id: 'U2', fullName: 'Lê Chung', status: 'hoat_dong' }],
  ]);

  it('matches by e-mail whatever the case and spaces; tells why the others are not matched', () => {
    const { rows, counts } = matchStaff(
      [
        staff('s1', 'Nguyễn Văn Minh', ' Minh@VCprosperous.com '),
        staff('s2', 'Trần Thu', null),
        staff('s3', 'Phạm Hải', 'hai@vcprosperous.com'),
        staff('s4', 'Lê Chung', 'chung@vcprosperous.com'),
        staff('s5', 'Lê Chung (tài khoản 2)', 'CHUNG@vcprosperous.com'),
      ],
      users,
    );
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.s1).toMatchObject({ state: 'matched', user: { id: 'U1' } });
    expect(by.s2).toMatchObject({ state: 'no_email', user: null });
    expect(by.s3).toMatchObject({ state: 'no_user', user: null });
    // Two VCsales staff on one e-mail: nobody is matched, so no customer goes to the wrong person.
    expect(by.s4).toMatchObject({ state: 'duplicated_email', user: null });
    expect(by.s5).toMatchObject({ state: 'duplicated_email', user: null });
    expect(counts).toEqual({ total: 5, matched: 1, no_user: 1, no_email: 1, duplicated_email: 2 });
    // The ones to fix first: missing e-mail, then no VClinks account, then shared e-mails, then matched.
    expect(rows.map((r) => r.state)).toEqual(['no_email', 'no_user', 'duplicated_email', 'duplicated_email', 'matched']);
  });

  it('lists staff who left last and does not count them; trusts the duplicate flag of VCsales', () => {
    const { rows, counts } = matchStaff(
      [staff('s1', 'An', 'an@vcprosperous.com', { active: false }), staff('s2', 'Bình', 'minh@vcprosperous.com', { emailDuplicated: true })],
      users,
    );
    expect(rows.map((r) => r.id)).toEqual(['s2', 's1']);
    expect(rows[0]).toMatchObject({ state: 'duplicated_email', user: null });
    expect(counts).toEqual({ total: 1, matched: 0, no_user: 0, no_email: 0, duplicated_email: 1 });
  });

  it('emailKey: lower case, trimmed, null when empty', () => {
    expect(emailKey('  A@B.vn ')).toBe('a@b.vn');
    expect(emailKey('  ')).toBeNull();
    expect(emailKey(null)).toBeNull();
  });
});
