import { ROLE_MATRIX, allowedScopes, customRoleRow, normalisePicks, type ChannelAccessLevel, type RoleKey } from '@vclinks/shared';
import { decide, effectivePermissions, hasKey, phoneVisibility, type RoleRow, type Subject } from './engine';

/*
 * Custom roles (docs 01 PQ-06, MH-PQ-05): a copy of a system role may only keep, narrow or drop scopes,
 * and the engine reads the custom row instead of the system row for that assignment.
 */

function subject(roleKey: RoleKey, unitId: string, row?: RoleRow): Subject {
  return {
    userId: 'me',
    active: true,
    roles: [
      {
        roleKey,
        unitId,
        divisionId: 'DV1',
        subtree: new Set([unitId]),
        isManager: false,
        ...(row ? { custom: { id: 'tc_x', name: 'X', row } } : {}),
      },
    ],
    nicks: new Set(['nick1']),
    channelLevels: new Map<string, Set<ChannelAccessLevel>>(),
    grants: [],
  };
}

describe('custom role picks (MH-PQ-05 #7)', () => {
  it('offers the base scope and the narrower nested ones only', () => {
    expect(allowedScopes(ROLE_MATRIX.giam_doc_bh['conv.view'], 'conv.view')).toEqual(['DV', 'TO', 'CT']);
    expect(allowedScopes(ROLE_MATRIX.nvkd['conv.view'], 'conv.view')).toEqual(['CT', 'NICK']);
    expect(allowedScopes(undefined, 'conv.view')).toEqual([]);
    // cust.phone_full: only the "Hiện" scopes are narrowed (the always-shown part follows the customer, PQ-45).
    expect(allowedScopes(ROLE_MATRIX.giam_sat_bh['cust.phone_full'], 'cust.phone_full')).toEqual(['TO', 'CT']);
  });

  it('refuses a scope wider than the base role (UAT-PQ-10: NVKD "Xem hội thoại" = DV)', () => {
    const r = normalisePicks('nvkd', { 'conv.view': ['DV'] });
    expect(r.error).toMatch(/^Vượt quyền của vai trò gốc NVKD\./);
    expect(normalisePicks('nvkd', { 'msg.delete': ['ALL'] }).error).toMatch(/Vượt quyền/);
  });

  it('keeps only the picks that differ from the base', () => {
    const r = normalisePicks('nvkd', { 'quote.send': [], 'conv.view': ['NICK', 'CT'], 'cust.view': ['CT'] });
    expect(r.error).toBeUndefined();
    expect(r.picks).toEqual({ 'quote.send': [], 'cust.view': ['CT'] });
  });

  it('builds the row from the current system matrix and drops ✖ cells', () => {
    const row = customRoleRow('nvkd', { 'quote.send': [], 'cust.view': ['CT'] });
    expect(row['quote.send']).toBeUndefined();
    expect(row['cust.view']).toEqual({ ...ROLE_MATRIX.nvkd['cust.view'], s: ['CT'] });
    expect(row['conv.view']).toEqual(ROLE_MATRIX.nvkd['conv.view']);
    // A stored pick wider than the base (e.g. the matrix narrowed later) is clamped.
    expect(customRoleRow('nvkd', { 'conv.view': ['TD', 'CT'] })['conv.view']!.s).toEqual(['CT']);
  });
});

describe('engine with a custom role', () => {
  const nvkd = subject('nvkd', 'TO1');
  const intern = subject('nvkd', 'TO1', customRoleRow('nvkd', { 'quote.send': [] }));
  const mine = { responsibleIds: ['me'], unitIds: ['TO1'], divisionId: 'DV1', channelId: 'nick1', channelKind: 'personal' as const };

  it('UAT-PQ-10: "NVKD thực tập" without "Gửi báo giá" keeps the rest of NVKD', () => {
    expect(decide(nvkd, 'quote.send', mine).allowed).toBe(true);
    expect(decide(intern, 'quote.send', mine).allowed).toBe(false);
    expect(hasKey(intern, 'quote.send')).toBe(false);
    expect(effectivePermissions(intern)['quote.send']).toBeUndefined();
    expect(decide(intern, 'conv.view', mine).allowed).toBe(true);
    expect(effectivePermissions(intern)['conv.view']).toEqual(effectivePermissions(nvkd)['conv.view']);
  });

  it('a narrowed scope stops at the narrower boundary', () => {
    const gd = subject('giam_doc_bh', 'DV1');
    const gdTeam = subject('giam_doc_bh', 'DV1', customRoleRow('giam_doc_bh', { 'conv.view': ['CT'] }));
    const otherInDivision = { responsibleIds: ['someone'], unitIds: ['TO2'], divisionId: 'DV1' };
    expect(decide(gd, 'conv.view', otherInDivision).allowed).toBe(true);
    expect(decide(gdTeam, 'conv.view', otherInDivision).allowed).toBe(false);
    expect(decide(gdTeam, 'conv.view', { ...otherInDivision, responsibleIds: ['me'] }).allowed).toBe(true);
  });

  it('a custom role without row (deleted) grants nothing, and the phone stays masked', () => {
    const gone = subject('giam_sat_bh', 'TO1', {});
    expect(effectivePermissions(gone)).toEqual({});
    expect(phoneVisibility(gone, { unitIds: ['TO1'], responsibleIds: ['x'] })).toBe('masked');
    // The nick holder still sees and answers on his nick (PQ-44), whatever the role.
    expect(decide(gone, 'conv.view', { channelId: 'nick1', channelKind: 'personal' }).allowed).toBe(true);
  });

  it('"Hiện" can be removed from a GS copy', () => {
    const gs = subject('giam_sat_bh', 'TO1');
    const noReveal = subject('giam_sat_bh', 'TO1', customRoleRow('giam_sat_bh', { 'cust.phone_full': [] }));
    const teamCustomer = { unitIds: ['TO1'], responsibleIds: ['x'] };
    expect(phoneVisibility(gs, teamCustomer)).toBe('reveal');
    expect(phoneVisibility(noReveal, teamCustomer)).toBe('masked');
    expect(phoneVisibility(noReveal, { unitIds: ['TO1'], responsibleIds: ['me'] })).toBe('full');
  });
});
