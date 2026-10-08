import { useQuery } from '@tanstack/react-query';
import type { ProductSearchResponse } from '@vclinks/shared';
import { api, getToken } from '../../api';

/** Tra hàng VCsales (M1c-01): products by name, OE code or vehicle line, priced for the customer of this chat. */
export function useProductSearch(uid: string, userId: string, q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['catalog-search', uid, userId, term],
    queryFn: () => api<ProductSearchResponse>(`/catalog/by-identity/${encodeURIComponent(uid)}/${encodeURIComponent(userId)}/search`, { query: { q: term } }),
    enabled: term.length >= 2 && !!getToken(),
    staleTime: 30_000,
    retry: false,
  });
}
