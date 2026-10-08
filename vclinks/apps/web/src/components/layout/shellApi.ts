import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeProfile, NotificationList, PresenceInput, QuickSearchResponse } from '@vclinks/shared';
import { api, getToken } from '../../api';

/** Own profile + presence status (MH-UI-05). Refreshed every minute so a hand-set status that expired shows online. */
export function useMeProfile() {
  return useQuery({
    queryKey: ['me', 'profile'],
    queryFn: () => api<MeProfile>('/me/profile'),
    enabled: !!getToken(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PresenceInput) => api<{ status: string; until: string | null }>('/me/status', { method: 'PUT', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'profile'] }),
  });
}

/** Notice list; RealtimeBridge (M1c-07) invalidates it when a notice is pushed. */
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationList>('/notifications'),
    enabled: !!getToken(),
    staleTime: 30_000,
    retry: false,
  });
}

export function quickSearch(q: string) {
  return api<QuickSearchResponse>('/search/quick', { query: { q, limit: 20 } });
}
