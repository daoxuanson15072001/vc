import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ErpCreateForm, ErpSyncKind, ErpSyncStatus, ErpTaskCreateInput, ErpTaskListResponse, ErpTaskView, ErpFormField, ErpCloseReason } from '@vclinks/shared';
import { api, getToken } from '../../api';

/** Việc VCsales (02 MH-DK-12): one tab of the queue, with the 4a mismatch list when asked. */
export function useErpTasks(q: { tab: 'create' | 'update'; mine?: boolean; mismatch?: boolean; finished?: boolean }) {
  return useQuery({
    queryKey: ['erp-tasks', q],
    queryFn: () =>
      api<ErpTaskListResponse>('/customers/erp-tasks', {
        query: { tab: q.tab, mine: q.mine ? 1 : undefined, mismatch: q.mismatch ? 'owner' : undefined, finished: q.finished ? 1 : undefined },
      }),
    enabled: !!getToken(),
    refetchInterval: 60_000,
    retry: false,
  });
}

function refresh(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['erp-tasks'] });
  void qc.invalidateQueries({ queryKey: ['customer-panel'] });
  void qc.invalidateQueries({ queryKey: ['customer360'] });
  void qc.invalidateQueries({ queryKey: ['erp-matching'] });
}

export function useCreateErpTask() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: ErpTaskCreateInput) => api<ErpTaskView>('/customers/erp-tasks', { method: 'POST', body }), onSuccess: () => refresh(qc) });
}

type Action =
  | { id: string; kind: 'claim' | 'check' | 'done' }
  | { id: string; kind: 'link'; code: string }
  | { id: string; kind: 'return'; missing: ErpFormField[]; note?: string | null }
  | { id: string; kind: 'close'; reason: ErpCloseReason; note?: string | null }
  | { id: string; kind: 'form'; form: ErpCreateForm };

type Done = { task: ErpTaskView; message: string };

/** Every processing step of a task; the answer is the task again, with a message for link / return / done / close. */
export function useErpTaskAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: Action): Promise<{ task: ErpTaskView; message?: string }> => {
      const path = `/customers/erp-tasks/${encodeURIComponent(a.id)}`;
      switch (a.kind) {
        case 'claim':
        case 'check':
          return api<ErpTaskView>(`${path}/${a.kind}`, { method: 'POST' }).then((task) => ({ task }));
        case 'form':
          return api<ErpTaskView>(`${path}/form`, { method: 'PUT', body: { form: a.form } }).then((task) => ({ task }));
        case 'link':
          return api<Done>(`${path}/link`, { method: 'POST', body: { code: a.code } });
        case 'return':
          return api<Done>(`${path}/return`, { method: 'POST', body: { missing: a.missing, note: a.note ?? null } });
        case 'close':
          return api<Done>(`${path}/close`, { method: 'POST', body: { reason: a.reason, note: a.note ?? null } });
        case 'done':
          return api<Done>(`${path}/done`, { method: 'POST' });
      }
    },
    onSuccess: () => refresh(qc),
  });
}

/** Danh mục VCsales (plan C11): polled every 2 s while a run goes on. */
export function useErpSync() {
  return useQuery({
    queryKey: ['erp-sync'],
    queryFn: () => api<ErpSyncStatus>('/customers/erp-sync'),
    enabled: !!getToken(),
    refetchInterval: (q) => (q.state.data?.running ? 2000 : 30_000),
    retry: false,
  });
}

export function useStartErpSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: ErpSyncKind) => api<ErpSyncStatus>('/customers/erp-sync', { method: 'POST', body: { kind } }),
    onSuccess: (d) => {
      qc.setQueryData(['erp-sync'], d);
      void qc.invalidateQueries({ queryKey: ['erp-tasks'] });
    },
  });
}

/** "3 giờ", "2 ngày": how long a task has waited (MH-DK-12 "Tuổi"). */
export function ageText(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ`;
  return `${Math.floor(h / 24)} ngày`;
}
