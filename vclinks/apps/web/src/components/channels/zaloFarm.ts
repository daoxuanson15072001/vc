import { useQuery } from '@tanstack/react-query';
import type { ZaloFarmStatus, ZaloSlotView } from '@vclinks/shared';
import { api } from '../../api';

/** Máy Zalo status (installed? full? may I connect nicks?) and the slots the caller may see (Admin: all; holder: his). */
export function useZaloFarm() {
  const farm = useQuery({ queryKey: ['zalo-farm'], queryFn: () => api<ZaloFarmStatus>('/zalo/farm'), retry: false, staleTime: 30_000 });
  const slots = useQuery({
    queryKey: ['zalo-slots'],
    queryFn: () => api<ZaloSlotView[]>('/zalo/slots'),
    enabled: !!farm.data?.installed,
    refetchInterval: 30_000,
    retry: false,
  });
  return { farm, slots };
}
