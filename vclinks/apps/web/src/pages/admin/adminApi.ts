import type {
  AdminUser,
  AssignmentInput,
  CustomRoleInput,
  CustomRoleOption,
  PermissionKey,
  RoleColumn,
  ScopeCode,
  HandoverInput,
  HandoverPlanPreview,
  HandoverPreviewInput,
  HandoverResult,
  OffboardPreview,
  ImportCommitResult,
  ImportPreview,
  OrgUnit,
  PendingRoleChange,
  UnitMember,
} from '@vclinks/shared';
import { api } from '../../api';

export interface AdminMeta {
  unitTypes: { value: string; label: string; parentTypes: string[] }[];
  roles: { value: string; label: string; unitType: string; sensitive: boolean }[];
  /** Custom roles (MH-PQ-05): placed where their base role sits, sensitive when it is (PQ-42). */
  customRoles: (CustomRoleOption & { unitType: string; sensitive: boolean })[];
}

/** `GET /api/admin/roles` (MH-PQ-05). */
export interface RolesResponse {
  scopes: Record<ScopeCode, string>;
  keys: { key: PermissionKey; label: string; section: string }[];
  roles: RoleColumn[];
}

export const adminApi = {
  meta: () => api<AdminMeta>('/admin/meta'),
  roles: () => api<RolesResponse>('/admin/roles'),
  createCustomRole: (b: CustomRoleInput) => api<{ role: RoleColumn; message: string }>('/admin/custom-roles', { method: 'POST', body: b }),
  updateCustomRole: (id: string, b: CustomRoleInput) =>
    api<{ role: RoleColumn; message: string }>(`/admin/custom-roles/${encodeURIComponent(id)}`, { method: 'PUT', body: b }),
  deleteCustomRole: (id: string) => api<{ message: string }>(`/admin/custom-roles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  units: () => api<OrgUnit[]>('/admin/org-units'),
  members: (id: string) => api<UnitMember[]>(`/admin/org-units/${encodeURIComponent(id)}/members`),
  createUnit: (b: { name: string; type: string; parentId: string; code?: string }) =>
    api<OrgUnit>('/admin/org-units', { method: 'POST', body: b }),
  updateUnit: (id: string, b: { name?: string; managerUserId?: string | null }) =>
    api<OrgUnit>(`/admin/org-units/${encodeURIComponent(id)}`, { method: 'PATCH', body: b }),
  moveUnit: (id: string, parentId: string) =>
    api<{ unit: OrgUnit; affected: number }>(`/admin/org-units/${encodeURIComponent(id)}/move`, { method: 'POST', body: { parentId } }),
  deactivate: (id: string) => api<OrgUnit>(`/admin/org-units/${encodeURIComponent(id)}/deactivate`, { method: 'POST', body: {} }),
  reactivate: (id: string) => api<OrgUnit>(`/admin/org-units/${encodeURIComponent(id)}/reactivate`, { method: 'POST', body: {} }),
  users: (q: Record<string, string | number | undefined>) => api<{ items: AdminUser[]; total: number }>('/admin/users', { query: q }),
  user: (id: string) => api<AdminUser>(`/admin/users/${encodeURIComponent(id)}`),
  createUser: (b: { email: string; fullName: string; phone?: string; assignments: AssignmentInput[] }) =>
    api<{ user: AdminUser; messages: string[] }>('/admin/users', { method: 'POST', body: b }),
  updateUser: (id: string, b: Record<string, unknown>) => api<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: b }),
  addAssignment: (id: string, b: AssignmentInput, replaceManager = false) =>
    api<{ applied: boolean; message?: string }>(`/admin/users/${encodeURIComponent(id)}/assignments`, {
      method: 'POST',
      body: b,
      query: replaceManager ? { replaceManager: '1' } : undefined,
    }),
  removeAssignment: (id: string, aid: string) =>
    api<{ ok: true }>(`/admin/users/${encodeURIComponent(id)}/assignments/${encodeURIComponent(aid)}`, { method: 'DELETE' }),
  lock: (id: string, reason: string) => api<AdminUser>(`/admin/users/${encodeURIComponent(id)}/lock`, { method: 'POST', body: { reason } }),
  setPreLeave: (id: string, expectedDate: string, reason: string) => api<AdminUser>(`/admin/users/${encodeURIComponent(id)}/pre-leave`, { method: 'POST', body: { expectedDate, reason } }),
  clearPreLeave: (id: string) => api<AdminUser>(`/admin/users/${encodeURIComponent(id)}/pre-leave`, { method: 'DELETE' }),
  unlock: (id: string) => api<AdminUser>(`/admin/users/${encodeURIComponent(id)}/unlock`, { method: 'POST', body: {} }),
  offboard: (id: string, reason: string, keepDeviceTokenIds: string[] = []) =>
    api<{ user: AdminUser; message: string }>(`/admin/users/${encodeURIComponent(id)}/offboard`, { method: 'POST', body: { reason, keepDeviceTokenIds } }),
  // MH-PQ-04 steps 2-4 (M1b-11)
  offboardPreview: (id: string) => api<OffboardPreview>(`/admin/users/${encodeURIComponent(id)}/offboard-preview`),
  handoverReceivers: (id: string) => api<{ id: string; name: string }[]>(`/admin/users/${encodeURIComponent(id)}/handover/receivers`),
  handoverCustomers: (id: string) => api<{ id: string; name: string; region: string | null; tags: string[] }[]>(`/admin/users/${encodeURIComponent(id)}/handover/customers`),
  handoverPlan: (id: string, b: HandoverPreviewInput) =>
    api<HandoverPlanPreview>(`/admin/users/${encodeURIComponent(id)}/handover/preview`, { method: 'POST', body: b }),
  handover: (id: string, b: HandoverInput) => api<HandoverResult>(`/admin/users/${encodeURIComponent(id)}/handover`, { method: 'POST', body: b }),
  safetyConfirm: (uid: string, note?: string) =>
    api<{ message: string }>(`/admin/channel-access/${encodeURIComponent(uid)}/safety-confirm`, { method: 'POST', body: note ? { note } : {} }),
  requests: () => api<PendingRoleChange[]>('/admin/role-requests'),
  decide: (id: string, op: 'approve' | 'reject' | 'cancel') =>
    api<unknown>(`/admin/role-requests/${encodeURIComponent(id)}/${op}`, { method: 'POST', body: {} }),
  importPreview: (kind: 'users' | 'org', f: { fileName: string; contentBase64: string }) =>
    api<ImportPreview>(kind === 'users' ? '/admin/users/import/preview' : '/admin/org-units/import/preview', { method: 'POST', body: f }),
  importCommit: (kind: 'users' | 'org', f: { fileName: string; contentBase64: string }) =>
    api<ImportCommitResult>(kind === 'users' ? '/admin/users/import' : '/admin/org-units/import', { method: 'POST', body: f }),
};

/** Downloads a template or export through fetch so the Bearer token is sent. */
export async function downloadFile(path: string, fileName: string): Promise<void> {
  const { getToken } = await import('../../api');
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  if (!res.ok) throw new Error(`Không tải được file (HTTP ${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Không đọc được file'));
    r.readAsDataURL(file);
  });
}
