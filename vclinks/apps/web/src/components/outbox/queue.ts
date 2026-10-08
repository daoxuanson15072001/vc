import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OutboxCounts, WhoAmI } from '@vclinks/shared';
import { api } from '../../api';
import type { OutboxItem, OutboxStatus } from '../../types';

/** Badge / notices poll period. */
export const QUEUE_POLL_MS = 10_000;

/** Statuses that need the approver's attention (red badge, SZ-24). Mirrors OUTBOX_ATTENTION. */
export const ATTENTION: OutboxStatus[] = ['failed', 'expired', 'awaiting_confirm', 'needs_reapproval'];

/** The signed-in principal; `approvedBy` holds its user id (`name` for tokens without a user). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api<WhoAmI>('/me'), staleTime: 5 * 60_000 });
}

/** Counts for the "Lệnh gửi" badge and MH-SZ-13's filter chips (mine only before M1b-04). */
export function useOutboxCounts(filter: { threadId?: string; uid?: string } = {}) {
  return useQuery({
    queryKey: ['outbox', 'counts', filter.uid ?? '', filter.threadId ?? ''],
    queryFn: () => api<OutboxCounts>('/outbox/counts', { query: { mine: '1', uid: filter.uid, threadId: filter.threadId } }),
    refetchInterval: QUEUE_POLL_MS,
    retry: false,
  });
}

export function useOutboxList(filter: { statuses: OutboxStatus[]; threadId?: string; uid?: string; limit?: number; onBehalf?: boolean }, enabled = true) {
  return useQuery({
    queryKey: ['outbox', 'list', filter.statuses.join(','), filter.uid ?? '', filter.threadId ?? '', filter.limit ?? 50, filter.onBehalf ? 'ob' : ''],
    queryFn: () =>
      api<OutboxItem[]>('/outbox', {
        query: { ...(filter.onBehalf ? { onBehalf: '1' } : { mine: '1' }), status: filter.statuses.join(','), uid: filter.uid, threadId: filter.threadId, limit: filter.limit ?? 50 },
      }),
    refetchInterval: QUEUE_POLL_MS,
    enabled,
    retry: false,
  });
}

/** Retry / cancel / "Gửi ngay" from anywhere; refreshes every outbox query. */
export function useOutboxActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['outbox'] });
  return {
    retry: useMutation({ mutationFn: (id: string) => api<OutboxItem>(`/outbox/${encodeURIComponent(id)}/retry`, { method: 'POST' }), onSuccess: done }),
    confirm: useMutation({ mutationFn: (id: string) => api<OutboxItem>(`/outbox/${encodeURIComponent(id)}/confirm`, { method: 'POST' }), onSuccess: done }),
    /** "Duyệt lại" a `Cần duyệt lại` item (nick holder / cover only, PQ-51). */
    reapprove: useMutation({ mutationFn: (id: string) => api<OutboxItem>(`/outbox/${encodeURIComponent(id)}/reapprove`, { method: 'POST' }), onSuccess: done }),
    cancel: useMutation({
      mutationFn: ({ id, copied }: { id: string; copied?: boolean }) =>
        api<OutboxItem>(`/outbox/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: { reason: copied ? 'copied' : 'user' } }),
      onSuccess: done,
    }),
  };
}

/** Minutes since the last status change ("Treo {n} phút"). */
export function hangingMinutes(item: Pick<OutboxItem, 'statusAt' | 'createdAt'>, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(item.statusAt ?? item.createdAt)) / 60_000));
}

/** Copies the item's text for "Sao chép và bỏ lệnh" (SZ-28 a). Returns false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API blocked (no focus / http): fall back to a hidden textarea.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const COPIED_TOAST = 'Đã sao chép và bỏ lệnh. Dán vào Zalo trên điện thoại để gửi.';
export const RETRIED_TOAST = 'Đã duyệt lại, lệnh sẽ được gửi.';
export const CANCELLED_TOAST = 'Đã bỏ lệnh';
export const BUSY_TOOLTIP = 'Lệnh đang được thực hiện trên Zalo, không bỏ được';
