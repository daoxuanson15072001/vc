import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuoteForm, QuoteListResponse, QuoteSendResult } from '@vclinks/shared';
import { api, getToken } from '../../api';

/** Quotes of the customer of this chat, read live from VCsales on every call (BR16: no cache). */
export function useQuotes(uid: string, threadId: string, enabled = true) {
  return useQuery({
    queryKey: ['quotes', uid, threadId],
    queryFn: () => api<QuoteListResponse>(`/quotes/by-identity/${encodeURIComponent(uid)}/${encodeURIComponent(threadId)}`),
    enabled: enabled && !!getToken(),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export interface SendQuoteBody {
  no: string;
  form: QuoteForm;
  message: string;
  version: string;
  followUpDays: number | null;
}

/** "Gửi báo giá": the click is the approval; the API re-reads the quote from VCsales and queues the command. */
export function useSendQuote(uid: string, threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: SendQuoteBody) => api<QuoteSendResult>('/quotes/send', { method: 'POST', body: { uid, threadId, ...b } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['outbox', uid, threadId] });
      void qc.invalidateQueries({ queryKey: ['quotes', uid, threadId] });
    },
  });
}
