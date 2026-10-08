import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FRIEND_ACTIONS, type FriendRequestDirection, type FriendRequestListResponse } from '@vclinks/shared';
import { api } from '../../api';
import { usePrefs } from '../../state/prefs';
import { useAccounts } from '../AccountSelect';
import { useEffect, useState } from 'react';

/** Poll period of the request lists: the extension reads Zalo every couple of minutes, this just picks it up. */
export const REQUESTS_POLL_MS = 10_000;

/** Requests of one nick and direction (MH-SZ-10), with the badge count and the SZ-09 quota. */
export function useFriendRequests(uid: string | undefined, direction: FriendRequestDirection = 'received') {
  return useQuery({
    queryKey: ['friend-requests', uid, direction],
    enabled: !!uid,
    queryFn: () => api<FriendRequestListResponse>('/friend-requests', { query: { uid: uid!, direction } }),
    refetchInterval: REQUESTS_POLL_MS,
    retry: false,
  });
}

/** True for an outbox command of the friend family (it has no conversation to open). */
export const isFriendCommand = (action?: string | null): boolean => !!action && (FRIEND_ACTIONS as readonly string[]).includes(action);

/**
 * The personal Zalo nick shown on the Danh bạ pages: the one picked in the nav
 * rail, else the first one. Shared by the friend list, the group list and the
 * request page so the choice follows the person between tabs.
 */
export function useContactNick() {
  const { accountUid } = usePrefs();
  const accounts = useAccounts();
  const nicks = useMemo(() => (accounts.data ?? []).filter((a) => a.channel === 'zalo'), [accounts.data]);
  const [uid, setUid] = useState<string | undefined>();
  useEffect(() => {
    if (uid && nicks.some((n) => n.uid === uid)) return;
    setUid(nicks.find((n) => n.uid === accountUid)?.uid ?? nicks[0]?.uid);
  }, [nicks, accountUid, uid]);
  return { uid, setUid, nicks, accounts };
}

/** Vietnamese label of the command waiting on a request ("Đang chờ gửi"…), or null when none. */
export function commandLabel(status: string | null | undefined): string | null {
  switch (status) {
    case 'approved':
      return 'Đang chờ thực hiện trên Zalo';
    case 'sending':
      return 'Đang thực hiện trên Zalo';
    case 'needs_reapproval':
      return 'Cần duyệt lại ở Lệnh gửi';
    case 'awaiting_confirm':
      return 'Chờ xác nhận ở Lệnh gửi';
    case 'failed':
      return 'Lệnh lỗi, xem Lệnh gửi';
    case 'expired':
      return 'Lệnh quá hạn, xem Lệnh gửi';
    default:
      return null;
  }
}
