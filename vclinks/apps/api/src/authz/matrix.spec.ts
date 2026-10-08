import { PERMISSION_KEYS, type ChannelAccessLevel, ROLE_MATRIX, ROLE_UNIT_TYPE, type PermCell, type PermissionKey, type RoleKey, type ScopeCode } from '@vclinks/shared';
import { decide, type Subject, type SubjectRole, type Target } from './engine';

/*
 * Matrix test (M1b-04 "Xác nhận xong" #1): reads the spec matrix (docs/02-yeu-cau/dac-ta/01-phan-quyen.md §3)
 * at test time and generates one case per cell (key × role):
 *   - the generated ROLE_MATRIX equals the spec (narrow readings of free-text cells: tools/authz/matrix-source.js);
 *   - for every scope of the cell, a target inside that scope is allowed;
 *   - a target outside every scope is refused (unless the cell is TĐ / ✅);
 *   - ✖ cells refuse a target that sits inside every scope;
 *   - conditional / view-only / "trừ chính mình" cells refuse until the condition is met.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const source = require('../../../../tools/authz/matrix-source.js') as {
  COLUMNS: RoleKey[];
  parseMatrix(): { keys: { key: string }[]; cells: Record<string, Record<string, { raw: string; cell: PermCell }>> };
};
const spec = source.parseMatrix();

const ME = 'me';
/** Unit each role sits in, in a fixed fixture tree: GOC › DV1 › (TO1 › TO1A, TO2, one group per type) and GOC › DV2 › TO3. */
const UNIT_OF: Record<string, string> = {
  goc: 'GOC',
  division: 'DV1',
  to_ban_hang: 'TO1',
  nhom_cskh: 'G_CS',
  nhom_marketing: 'G_MK',
  nhom_sale_admin: 'G_SA',
  nhom_ke_toan: 'G_KT',
  nhom_thi_truong: 'G_TT',
};
const SUBTREE: Record<string, string[]> = {
  GOC: ['GOC', 'DV1', 'TO1', 'TO1A', 'TO2', 'G_CS', 'G_MK', 'G_SA', 'G_KT', 'G_TT', 'DV2', 'TO3'],
  DV1: ['DV1', 'TO1', 'TO1A', 'TO2', 'G_CS', 'G_MK', 'G_SA', 'G_KT', 'G_TT'],
  TO1: ['TO1', 'TO1A'],
};

function subject(role: RoleKey, manager: boolean): Subject {
  const unitId = UNIT_OF[ROLE_UNIT_TYPE[role]];
  const r: SubjectRole = {
    roleKey: role,
    unitId,
    divisionId: unitId === 'GOC' ? null : 'DV1',
    subtree: new Set(SUBTREE[unitId] ?? [unitId]),
    isManager: manager,
  };
  return {
    userId: ME,
    active: true,
    roles: [r],
    nicks: new Set(['nick1']),
    channelLevels: new Map<string, Set<ChannelAccessLevel>>([
      ['oa1', new Set<ChannelAccessLevel>(['gui'])],
      ['oa2', new Set<ChannelAccessLevel>(['lead'])],
    ]),
    grants: [{ type: 'xem_ngoai_pham_vi', target: 'conversation:c1', rights: ['xem', 'ghi_chu', 'tra_loi'] }],
  };
}

/** A target inside scope `s` (and nothing else) for the fixture subject. */
function inside(s: ScopeCode, role: RoleKey): Target {
  const unit = UNIT_OF[ROLE_UNIT_TYPE[role]];
  switch (s) {
    case 'ALL':
    case 'TD':
      return OUTSIDE;
    case 'DV':
      return { divisionId: 'DV1', unitIds: ['TO2'] };
    case 'TO':
      return { divisionId: 'DV1', unitIds: ['TO1A'] };
    case 'NH':
      return { divisionId: 'DV1', unitIds: [unit] };
    case 'CT':
      return { responsibleIds: [ME] };
    case 'SELF':
      return { selfIds: [ME] };
    case 'NICK':
      return { channelId: 'nick1', channelKind: 'personal' };
    case 'KENH':
      return { channelId: 'oa1', channelKind: 'official' };
    case 'TK':
      return { ticketAssigneeIds: [ME] };
    case 'LEAD':
      return { channelId: 'oa2', channelKind: 'official', isLead: true };
    case 'TUYEN':
      return { routeOwnerIds: [ME] };
    case 'YC':
      return { grantTargets: ['conversation:c1'] };
  }
}

const OUTSIDE: Target = {
  divisionId: 'DV2',
  unitIds: ['TO3'],
  responsibleIds: ['other'],
  selfIds: ['other'],
  channelId: 'nickX',
  channelKind: 'personal',
  ticketAssigneeIds: ['other'],
  routeOwnerIds: ['other'],
  grantTargets: ['conversation:zz'],
};

/** §2.9 steps 4 and 6: nick holder and temporary grants open conversations whatever the role column says. */
const ROLE_FREE: Partial<Record<PermissionKey, ScopeCode[]>> = {
  'conv.view': ['NICK', 'YC'],
  'conv.reply': ['NICK', 'YC'],
  'conv.note': ['YC'],
  'cust.view': ['YC'],
};

const ALL_SCOPES: ScopeCode[] = ['DV', 'TO', 'NH', 'CT', 'SELF', 'NICK', 'KENH', 'TK', 'LEAD', 'TUYEN', 'YC'];

describe('ROLE_MATRIX equals the spec matrix (01 §3)', () => {
  it('has every key of the spec, in order', () => {
    expect([...PERMISSION_KEYS]).toEqual(spec.keys.map((k) => k.key));
  });
});

describe.each(spec.keys.map((k) => k.key as PermissionKey))('%s', (key) => {
  it.each(source.COLUMNS)('%s', (role) => {
    const { raw, cell } = spec.cells[key][role];
    const generated = ROLE_MATRIX[role][key];
    const has = (cell.s?.length ?? 0) > 0 || (cell.reveal?.length ?? 0) > 0;
    // 1. Generated matrix = spec.
    if (has) expect(generated).toEqual(cell);
    else expect(generated).toBeUndefined();

    if (key === 'cust.phone_full') return; // phone visibility: see phone.spec.ts
    const manager = cell.s?.includes('NH') ?? false;
    const u = subject(role, manager);
    const opts = { need: cell.mode ?? 'full', conditions: cell.cond ? [cell.cond] : [] } as const;

    if (!cell.s?.length) {
      // ✖: refused even when the target sits inside every scope.
      const free = ROLE_FREE[key] ?? [];
      for (const s of ALL_SCOPES.filter((x) => !free.includes(x))) {
        expect({ raw, s, d: decide(u, key, inside(s, role), { conditions: ['*'] }).allowed }).toEqual({ raw, s, d: false });
      }
      return;
    }
    // 2. Every scope of the cell allows a target inside it.
    for (const s of cell.s) {
      const t = { ...inside(s, role), userId: 'someone-else' };
      expect({ raw, s, d: decide(u, key, t, opts).allowed }).toEqual({ raw, s, d: true });
    }
    // 3. Outside every scope: refused unless TĐ / ✅.
    if (!cell.s.some((s) => s === 'TD' || s === 'ALL')) {
      expect({ raw, outside: decide(u, key, OUTSIDE, opts).allowed }).toEqual({ raw, outside: false });
    }
    const t0 = { ...inside(cell.s[0], role), userId: 'someone-else' };
    // 4. Conditional cells refuse until the condition is asserted.
    if (cell.cond) expect(decide(u, key, t0, { need: opts.need }).allowed).toBe(false);
    // 5. View / propose / request cells refuse a full action.
    if (cell.mode) expect(decide(u, key, t0, { ...opts, need: 'full' }).allowed).toBe(false);
    // 6. "trừ chính mình".
    if (cell.notSelf) expect(decide(u, key, { ...t0, userId: ME }, opts).allowed).toBe(false);
  });
});
