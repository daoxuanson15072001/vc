import { describe, expect, it } from 'vitest';
import { ROLE_KEYS, ROLE_MATRIX, PERMISSION_KEYS, type MePermissions, type PermissionKey, type RoleKey } from '@vclinks/shared';
import { navIdOf, searchHint, visibleNavItems, type NavId } from './nav';

/** Me of a user holding exactly one system role (what GET /me/permissions returns for him). */
function meOf(role: RoleKey, lead = false): MePermissions {
  const permissions: MePermissions['permissions'] = {};
  for (const k of PERMISSION_KEYS as readonly PermissionKey[]) {
    const c = ROLE_MATRIX[role]?.[k];
    if (c) permissions[k] = { scopes: c.s ?? [], mode: c.mode ?? 'full' };
  }
  return { userId: 'u', legacy: false, roles: [{ roleKey: role, orgUnitId: 'x', orgUnitName: 'x', lead }], permissions, heldChannels: [] };
}
const ids = (me: MePermissions | undefined) => visibleNavItems(me).map((i) => i.id);

// 00 §2.2, columns AD GD GS KD CS SA TT KT MK XEM, rows of the items this shell lists.
const EXPECT: Record<string, NavId[]> = {
  admin: ['channels', 'sync', 'admin'],
  giam_doc_bh: ['conversations', 'outbox', 'approvals', 'workitems', 'reports', 'customers', 'erpMatching', 'erpTasks', 'erpCatalog', 'contacts', 'channels', 'sync', 'admin'],
  giam_sat_bh: ['conversations', 'outbox', 'approvals', 'reports', 'customers', 'erpTasks', 'contacts', 'channels', 'admin'],
  nvkd: ['conversations', 'outbox', 'approvals', 'reports', 'customers', 'erpTasks', 'contacts'],
  cskh: ['conversations', 'workitems', 'customers'],
  sale_admin: ['customers', 'erpMatching', 'erpTasks', 'erpCatalog', 'admin'],
  ke_toan: ['customers'],
  marketing: ['conversations', 'customers'],
  nv_thi_truong: ['conversations', 'outbox', 'approvals', 'customers', 'contacts'],
  quan_sat: ['conversations', 'reports', 'customers', 'channels', 'sync', 'admin'],
};

describe('app shell menu per role (00 §2.2, UAT-PQ-06)', () => {
  it('knows every system role', () => {
    expect(Object.keys(EXPECT).sort()).toEqual([...ROLE_KEYS].sort());
  });
  for (const [role, want] of Object.entries(EXPECT)) {
    it(`${role}`, () => {
      expect(ids(meOf(role as RoleKey)).sort()).toEqual([...want].sort());
    });
  }
  it('CSKH team lead also sees "Kênh kết nối" (D8-06), a plain CSKH does not', () => {
    expect(ids(meOf('cskh', true))).toContain('channels');
    expect(ids(meOf('cskh', false))).not.toContain('channels');
  });
  it('a nick holder or the holder of an open máy Zalo slot sees "Kênh kết nối" (00 ⁽¹³⁾)', () => {
    expect(ids({ ...meOf('nvkd'), heldChannels: ['900001'] })).toContain('channels');
    expect(ids({ ...meOf('cskh'), zaloSlotHolder: true })).toContain('channels');
    expect(ids({ ...meOf('nvkd'), zaloSlotHolder: false })).not.toContain('channels');
  });
  it('legacy token and failed permission load show everything; not loaded shows nothing', () => {
    expect(ids({ ...meOf('nvkd'), legacy: true })).toHaveLength(13);
    expect(visibleNavItems(undefined, true)).toHaveLength(13);
    expect(visibleNavItems(undefined)).toHaveLength(0);
  });
  it('maps paths to menu items', () => {
    expect(navIdOf('/conversations/zalo:1')).toBe('conversations');
    expect(navIdOf('/admin/users')).toBe('admin');
    expect(navIdOf('/outbox')).toBe('outbox');
    expect(navIdOf('/customers')).toBe('customers');
    expect(navIdOf('/customers/ca_1')).toBe('customers');
    expect(navIdOf('/customers/erp-matching')).toBe('erpMatching');
    expect(navIdOf('/customers/erp-tasks')).toBe('erpTasks');
    expect(navIdOf('/reports/hieu-suat')).toBe('reports');
    expect(navIdOf('/me')).toBeNull();
  });
  it('shows the right shortcut hint', () => {
    expect(searchHint('MacIntel')).toBe('⌘ K');
    expect(searchHint('Win32')).toBe('Ctrl K');
  });
});
