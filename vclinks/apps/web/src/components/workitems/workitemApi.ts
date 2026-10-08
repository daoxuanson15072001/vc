import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkitemCounts, WorkitemCreateInput, WorkitemDetail, WorkitemQueue, WorkitemQueueConfig, WorkitemSummary } from '@vclinks/shared';
import { api, getToken } from '../../api';

type ListView = 'approvals' | 'queue' | 'conversation' | 'mine';

/** Phiếu CSKH soạn – NVKD duyệt (M1c-03). Every action is re-checked by the API. */
export function useWorkitems(view: ListView, opts: { queue?: WorkitemQueue; uid?: string; threadId?: string; open?: boolean; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['workitems', 'list', view, opts.queue ?? '', opts.uid ?? '', opts.threadId ?? '', opts.open === false ? 0 : 1],
    queryFn: () =>
      api<WorkitemSummary[]>('/workitems', {
        query: { view, ...(opts.queue ? { queue: opts.queue } : {}), ...(opts.uid ? { uid: opts.uid } : {}), ...(opts.threadId ? { threadId: opts.threadId } : {}), open: opts.open === false ? '0' : '1' },
      }),
    enabled: (opts.enabled ?? true) && !!getToken(),
    refetchInterval: 60_000,
  });
}

export function useWorkitemCounts(enabled = true) {
  return useQuery({
    queryKey: ['workitems', 'counts'],
    queryFn: () => api<WorkitemCounts>('/workitems/counts'),
    enabled: enabled && !!getToken(),
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useWorkitem(id: string | null) {
  return useQuery({
    queryKey: ['workitems', 'one', id],
    queryFn: () => api<WorkitemDetail>(`/workitems/${encodeURIComponent(id!)}`),
    enabled: !!id && !!getToken(),
    // The attached quote is read live from VCsales (BR16): no stale copy.
    staleTime: 0,
  });
}

export function useWorkitemQueues(enabled = true) {
  return useQuery({ queryKey: ['workitems', 'queues'], queryFn: () => api<WorkitemQueueConfig[]>('/workitems/queues'), enabled: enabled && !!getToken(), retry: false });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['workitems'] });
    void qc.invalidateQueries({ queryKey: ['outbox'] });
  };
}

export function useCreateWorkitem() {
  const done = useInvalidate();
  return useMutation({ mutationFn: (b: Partial<WorkitemCreateInput>) => api<WorkitemDetail>('/workitems', { method: 'POST', body: b }), onSuccess: done });
}

export type WorkitemAction = 'start' | 'submit' | 'return' | 'self-reply' | 'approve' | 'wait-vendor' | 'vendor-back' | 'close' | 'assign';

export function useWorkitemAction(id: string) {
  const done = useInvalidate();
  return useMutation({
    mutationFn: ({ action, body }: { action: WorkitemAction; body?: Record<string, unknown> }) =>
      api<WorkitemDetail>(`/workitems/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: body ?? {} }),
    onSuccess: done,
  });
}

export function useEditWorkitem(id: string) {
  const done = useInvalidate();
  return useMutation({ mutationFn: (b: Record<string, unknown>) => api<WorkitemDetail>(`/workitems/${encodeURIComponent(id)}`, { method: 'PATCH', body: b }), onSuccess: done });
}

export function useSetQueue() {
  const done = useInvalidate();
  return useMutation({ mutationFn: (b: { divisionId: string; queue: WorkitemQueue; members: string[] }) => api<WorkitemQueueConfig>('/workitems/queues', { method: 'PUT', body: b }), onSuccess: done });
}

export interface WorkitemQuoteOptions {
  customerCode: string | null;
  createUrl: string | null;
  items: { no: string; total: number; validUntil: string | null; version: string }[];
  error: string | null;
}

/** Quotes CSKH may attach (approved, valid, this customer), read live through the item. */
export function useWorkitemQuotes(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['workitems', 'quotes', id],
    queryFn: () => api<WorkitemQuoteOptions>(`/workitems/${encodeURIComponent(id)}/quotes`),
    enabled: enabled && !!getToken(),
    staleTime: 0,
    retry: false,
  });
}
