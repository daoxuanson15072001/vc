import type { ActivityRow, AlertRuleView, AlertView, AuditPage, AuditQuery } from '@vclinks/shared';
import { api, getToken } from '../../api';

export interface AuditOverview {
  period: string;
  groups: Record<string, number>;
  previous: Record<string, number>;
  top: Record<string, { actorId: string; actorName: string; count: number }[]>;
  openAlerts: number;
}

export const auditApi = {
  list: (q: Partial<AuditQuery>) => api<AuditPage>('/admin/audit', { query: q as Record<string, string | number> }),
  overview: (period: 'week' | 'month' | 'quarter') => api<AuditOverview>('/admin/audit/overview', { query: { period } }),
  activity: () => api<ActivityRow[]>('/me/activity'),
  alerts: (q: { status?: string; rule?: string }) => api<{ items: AlertView[]; total: number; newCount: number }>('/admin/alerts', { query: q }),
  seen: (id: string) => api<AlertView>(`/admin/alerts/${encodeURIComponent(id)}/seen`, { method: 'POST', body: {} }),
  handle: (id: string, note: string) => api<AlertView>(`/admin/alerts/${encodeURIComponent(id)}/handle`, { method: 'POST', body: { note } }),
  rules: () => api<AlertRuleView[]>('/admin/alert-rules'),
  saveRule: (code: string, body: Record<string, unknown>) => api<AlertRuleView>(`/admin/alert-rules/${code}`, { method: 'PUT', body }),
  propose: (code: string, reason: string, proposal: Record<string, unknown>) =>
    api<{ message: string }>(`/admin/alert-rules/${code}/propose`, { method: 'POST', body: { reason, proposal } }),
};

/** Downloads the filtered log as xlsx (the Bearer token cannot ride on a plain link). */
export async function downloadAuditXlsx(q: Partial<AuditQuery>): Promise<{ rows: number }> {
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  const res = await fetch(`/api/admin/audit/export?${qs}`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(typeof j.message === 'string' ? j.message : 'Không xuất được nhật ký.');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'nhat-ky.xlsx';
  a.click();
  URL.revokeObjectURL(url);
  return { rows: Number(res.headers.get('X-Exported-Rows') ?? 0) };
}
