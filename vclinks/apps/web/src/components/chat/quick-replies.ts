import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuickReply, QuickReplyInput, QuickReplyPatch } from '@vclinks/shared';
import { api } from '../../api';

const KEY = ['quick-replies'];

/** Company-wide quick replies (mẫu câu), cached for a minute. */
export function useQuickReplies(enabled = true) {
  return useQuery({ queryKey: KEY, queryFn: () => api<QuickReply[]>('/quick-replies'), enabled, staleTime: 60_000 });
}

export function useQuickReplyMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: KEY });
  const create = useMutation({ mutationFn: (body: QuickReplyInput) => api<QuickReply>('/quick-replies', { method: 'POST', body }), onSuccess: done });
  const update = useMutation({
    mutationFn: ({ id, ...body }: QuickReplyPatch & { id: string }) => api<QuickReply>(`/quick-replies/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: (id: string) => api<{ ok: true }>(`/quick-replies/${encodeURIComponent(id)}`, { method: 'DELETE' }), onSuccess: done });
  return { create, update, remove };
}
