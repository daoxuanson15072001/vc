import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Customer360,
  CustomerDetail,
  CustomerListResponse,
  CustomerRevealResult,
  ErpMatchingResponse,
  MergeOperationView,
  TimelineResponse,
} from '@vclinks/shared';
import { api, getToken } from '../../api';

/** Customer 360 page (MH-DK-01). `refresh` forces the VCsales block to be fetched again (↻). */
export function useCustomer360(accountId: string | undefined) {
  return useQuery({
    queryKey: ['customer360', accountId],
    queryFn: () => api<Customer360>(`/customers/${encodeURIComponent(accountId!)}/360`),
    enabled: !!accountId && !!getToken(),
    staleTime: 15_000,
    retry: false,
  });
}

/** Side panel of the chat: the customer of one channel identity (MH-DK-02 / MH-UI-09). The chat shares the cache. */
export function usePanel360(uid: string, userId: string, enabled = true) {
  const qc = useQueryClient();
  const key = ['customer-panel', uid, userId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api<Customer360>(`/customers/by-identity/${encodeURIComponent(uid)}/${encodeURIComponent(userId)}/360`),
    enabled: enabled && !!getToken(),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const refreshCommerce = useMutation({
    mutationFn: () => api<Customer360>(`/customers/by-identity/${encodeURIComponent(uid)}/${encodeURIComponent(userId)}/360`, { query: { refresh: 1 } }),
    onSuccess: (d) => qc.setQueryData(key, d),
  });
  return { ...q, refreshCommerce };
}

export interface TimelineFilters {
  contact?: string;
  uid?: string;
  type?: 'message' | 'profile' | 'quote';
  from?: string;
  to?: string;
  q?: string;
}

/** Timeline pages of 50 events, newest first; the cursor is the time of the last event (MH-DK-03 #14). */
export function useCustomerTimeline(accountId: string, f: TimelineFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['customer-timeline', accountId, f],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<TimelineResponse>(`/customers/${encodeURIComponent(accountId)}/timeline`, { query: { ...f, before: pageParam, limit: 50 } }),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: enabled && !!getToken(),
    retry: false,
  });
}

export function useCustomerList(q: string, erp: 'linked' | 'none' | undefined, page: number) {
  return useQuery({
    queryKey: ['customers', q, erp, page],
    queryFn: () => api<CustomerListResponse>('/customers', { query: { q: q || undefined, erp, page, pageSize: 50 } }),
    placeholderData: (prev) => prev,
    retry: false,
  });
}

export function useOperations(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-operations', accountId],
    queryFn: () => api<MergeOperationView[]>(`/customers/${encodeURIComponent(accountId)}/operations`),
    enabled,
    retry: false,
  });
}

export function useErpMatching() {
  return useQuery({ queryKey: ['erp-matching'], queryFn: () => api<ErpMatchingResponse>('/customers/erp-matching'), retry: false });
}

export function useConfirmErp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { accountId: string; customerId: string }) =>
      api<CustomerDetail>(`/customers/${encodeURIComponent(v.accountId)}/erp-links`, { method: 'POST', body: { erp: 'vcsales', customerId: v.customerId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['erp-matching'] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function revealPoint(accountId: string, pointId: string, action: 'view' | 'copy') {
  return api<CustomerRevealResult>(`/customers/${encodeURIComponent(accountId)}/reveal`, { method: 'POST', body: { pointId, action } });
}
