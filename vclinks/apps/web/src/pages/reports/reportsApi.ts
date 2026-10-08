import type { ReportOverview, ReportTurnList } from '@vclinks/shared';
import { api, getToken } from '../../api';

export interface ReportFilters {
  from: string;
  to: string;
  team?: string;
  compare: boolean;
}

const base = (f: ReportFilters) => ({ from: f.from, to: f.to, team: f.team, compare: f.compare ? '1' : '0' });

export const reportsApi = {
  overview: (f: ReportFilters) => api<ReportOverview>('/reports/performance', { query: base(f) }),
  turns: (f: ReportFilters, extra: { row?: string; breachedOnly?: boolean }) =>
    api<ReportTurnList>('/reports/performance/turns', { query: { ...base(f), compare: '0', row: extra.row, breachedOnly: extra.breachedOnly ? '1' : '0' } }),
};

/** Downloads the Excel file through fetch so the Bearer token is sent; the file name comes from the server. */
export async function downloadReport(f: ReportFilters, detail: boolean): Promise<void> {
  const qs = new URLSearchParams({ from: f.from, to: f.to, detail: detail ? '1' : '0', compare: '0' });
  if (f.team) qs.set('team', f.team);
  const res = await fetch(`/api/reports/performance/export?${qs.toString()}`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  if (!res.ok) {
    let msg = `Không xuất được file (HTTP ${res.status})`;
    try {
      const j = (await res.json()) as { message?: string };
      if (typeof j.message === 'string') msg = j.message;
    } catch {
      // keep the generic text
    }
    throw new Error(msg);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'vclinks_bao-cao-hieu-suat.xlsx';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
