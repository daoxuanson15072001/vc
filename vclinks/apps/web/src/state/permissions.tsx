import { useQuery } from '@tanstack/react-query';
import type { MePermissions, PermissionKey } from '@vclinks/shared';
import { api, getToken } from '../api';
import { buttonState, canSeeTechnical, hasAnyPermission, hasPermission, type ButtonState } from '../utils/permissions';

/**
 * Permissions of the signed-in user (`GET /api/me/permissions`, docs 01 §2.4). Cached for a minute: the
 * API itself applies role changes within 60 seconds. A failed call leaves `me` undefined and `failed` true;
 * the API still enforces everything, so the UI then shows actions instead of hiding the whole app.
 */
export function usePermissions() {
  const q = useQuery({
    queryKey: ['me', 'permissions'],
    queryFn: () => api<MePermissions>('/me/permissions'),
    enabled: !!getToken(),
    staleTime: 60_000,
    retry: false,
  });
  const me = q.data;
  const failed = q.isError;
  return {
    me,
    loading: q.isLoading,
    failed,
    /** Route / menu level: has the key (or any of the keys). While loading: false; on failure: true. */
    has: (key: PermissionKey | PermissionKey[]) => (failed ? true : Array.isArray(key) ? hasAnyPermission(me, key) : hasPermission(me, key)),
    /** D8-02: hide / lock / show a button. */
    button: (key: PermissionKey, opts?: { lockReason?: string | null; needFull?: boolean }): ButtonState =>
      failed ? { state: 'show' } : buttonState(me, key, opts),
    technical: failed ? false : canSeeTechnical(me),
  };
}
