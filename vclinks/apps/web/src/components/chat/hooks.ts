import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api';
import type { ContactProfile, ConversationAccess, FetchRequest, FetchStatusView } from '@vclinks/shared';
import type { ChatConversation, ChatMessage, MessagesPage, OutboxItem } from '../../types';
import { mergeMessages } from '../../utils/chat';

export const POLL_MS = 5_000;
/** Poll period while one of our messages is on its way (approved / sending). */
export const POLL_ACTIVE_MS = 1_500;
const PAGE_LIMIT = 50;

/** Conversation id is `${uid}:${threadId}`; uid never contains ':'. */
export function splitConversationId(id: string): { uid: string; threadId: string } {
  const i = id.indexOf(':');
  return i > 0 ? { uid: id.slice(0, i), threadId: id.slice(i + 1) } : { uid: id, threadId: '' };
}

function fetchPage(conversationId: string, before?: string, around?: string) {
  return api<MessagesPage>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
    query: { before, around, limit: PAGE_LIMIT },
  });
}

/**
 * Messages of one thread: the newest page is polled every 5s; older pages are
 * loaded on demand (scroll up) and kept locally, so polling cost stays constant.
 */
export function useThreadMessages(conversationId: string, around?: string) {
  // `?msg=` of a search hit (M1c-05): the chat opens on a window holding that message instead of the newest page.
  const [anchor, setAnchor] = useState(around);
  useEffect(() => setAnchor(around), [conversationId, around]);
  const windowQ = useQuery({
    queryKey: ['messages', conversationId, 'around', anchor],
    queryFn: () => fetchPage(conversationId, undefined, anchor),
    enabled: !!anchor,
    staleTime: Infinity,
    retry: false,
  });
  // While newer messages exist beyond the window, the polled newest page is not merged (it would leave a gap).
  const detached = !!anchor && !!windowQ.data?.hasNewer;
  const latest = useQuery({
    queryKey: ['messages', conversationId, 'latest'],
    queryFn: () => fetchPage(conversationId),
    refetchInterval: POLL_MS,
    staleTime: 0,
  });

  // Everything loaded so far (older pages + earlier polls), merged with the newest page below.
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Messages that scroll out of the polled newest page are kept here so they don't vanish.
  useEffect(() => {
    const items = latest.data?.items;
    if (items?.length && !(anchor && !windowQ.data) && !detached) setOlder((prev) => mergeMessages(prev, items));
  }, [latest.data, anchor, windowQ.data, detached]);
  // The window replaces what was loaded.
  useEffect(() => {
    if (!anchor || !windowQ.data) return;
    setOlder(windowQ.data.items);
    setOlderHasMore(windowQ.data.hasMore);
  }, [anchor, windowQ.data]);

  const messages = useMemo(
    () => (anchor && !windowQ.data ? [] : detached ? older : mergeMessages(older, latest.data?.items ?? [])),
    [older, latest.data, anchor, windowQ.data, detached],
  );
  // Until an older page is loaded, "more" is what the first latest page reported.
  const hasMore = olderHasMore ?? latest.data?.hasMore ?? false;

  /** Back to the newest messages after jumping to an old one. */
  const goLatest = useCallback(() => {
    setAnchor(undefined);
    setOlder([]);
    setOlderHasMore(null);
  }, []);

  const loadOlder = useCallback(async () => {
    if (inFlight.current || !hasMore || !messages.length) return false;
    inFlight.current = true;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await fetchPage(conversationId, messages[0].sentAt);
      setOlder((prev) => mergeMessages(page.items, prev));
      setOlderHasMore(page.hasMore && page.items.length > 0);
      return true;
    } catch (e) {
      setOlderError((e as Error).message);
      return false;
    } finally {
      inFlight.current = false;
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, messages]);

  /** Drops locally kept pages and reloads the newest one (content filled in server-side). */
  const { refetch } = latest;
  const reload = useCallback(() => {
    setOlder([]);
    setOlderHasMore(null);
    void refetch();
  }, [refetch]);

  return {
    messages,
    reload,
    /** Re-reads the newest page now (e.g. right after an outbox item was sent). */
    refetch: useCallback(() => void refetch(), [refetch]),
    isLoading: anchor ? windowQ.isLoading : latest.isLoading,
    error: (anchor ? windowQ.isError : latest.isError) ? ((anchor ? windowQ.error : latest.error) as Error) : null,
    /** Jumped to a message and newer ones exist beyond the window. */
    detached,
    goLatest,
    /** Message id of the open window (`?msg=`), until "Về tin mới nhất". */
    anchor,
    hasMore,
    loadingOlder,
    olderError,
    loadOlder,
  };
}

/** Outbox of one thread. A 404 means the API has no outbox yet: polling stops and sending is disabled. */
export function useOutbox(uid: string, threadId: string) {
  const qc = useQueryClient();
  const key = useMemo(() => ['outbox', uid, threadId], [uid, threadId]);

  const q = useQuery({
    queryKey: key,
    queryFn: () => api<OutboxItem[]>('/outbox', { query: { uid, threadId, limit: 20 } }),
    // Faster while something is in flight so "đã gửi" shows without the 5 s wait.
    refetchInterval: (query) => {
      if (isNotFound(query.state.error)) return false;
      const items = Array.isArray(query.state.data) ? query.state.data : [];
      return items.some((o) => o.status === 'approved' || o.status === 'sending') ? POLL_ACTIVE_MS : POLL_MS;
    },
    staleTime: 0,
    retry: false,
  });

  const [sendUnsupported, setSendUnsupported] = useState(false);
  const unsupported = sendUnsupported || isNotFound(q.error);

  const send = useMutation({
    mutationFn: ({ text, replyToCliMsgId }: { text: string; replyToCliMsgId?: string }) =>
      api<OutboxItem>('/outbox', { method: 'POST', body: { uid, threadId, text, ...(replyToCliMsgId ? { replyToCliMsgId } : {}) } }),
    onSuccess: (item) => {
      qc.setQueryData<OutboxItem[]>(key, (prev) => [...(prev ?? []).filter((x) => x.id !== item.id), item]);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => {
      if (isNotFound(e)) setSendUnsupported(true);
    },
  });

  const retry = useMutation({
    mutationFn: (id: string) => api<OutboxItem>(`/outbox/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
    onSuccess: (item) => {
      if (item && typeof item === 'object' && 'id' in item) {
        qc.setQueryData<OutboxItem[]>(key, (prev) => (prev ?? []).map((x) => (x.id === item.id ? item : x)));
      }
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const after = (item: OutboxItem) => {
    if (item && typeof item === 'object' && 'id' in item) {
      qc.setQueryData<OutboxItem[]>(key, (prev) => (prev ?? []).map((x) => (x.id === item.id ? item : x)));
    }
    // Badge, MH-SZ-13 list and counts.
    qc.invalidateQueries({ queryKey: ['outbox'] });
  };
  const cancel = useMutation({
    mutationFn: ({ id, copied }: { id: string; copied?: boolean }) =>
      api<OutboxItem>(`/outbox/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: { reason: copied ? 'copied' : 'user' } }),
    onSuccess: after,
  });
  const confirm = useMutation({
    mutationFn: (id: string) => api<OutboxItem>(`/outbox/${encodeURIComponent(id)}/confirm`, { method: 'POST' }),
    onSuccess: after,
  });

  // Reset the "unsupported" flag when switching thread so a redeployed API is picked up.
  useEffect(() => setSendUnsupported(false), [uid, threadId]);

  return {
    items: Array.isArray(q.data) ? q.data : [],
    unsupported,
    error: q.isError && !isNotFound(q.error) ? (q.error as Error) : null,
    send,
    retry,
    cancel,
    confirm,
  };
}

/** Conversation header data, for a chat opened by direct link (not in the loaded list). */
export function useConversation(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => api<ChatConversation>(`/conversations/${encodeURIComponent(conversationId)}`),
    enabled,
    // The name may be captured from Zalo Web a bit later.
    refetchInterval: (q) => (q.state.data?.name ? false : 15_000),
    retry: false,
  });
}

/** What the signed-in user may do here (compose box or read-only, D8-02). */
export function useConversationAccess(conversationId: string) {
  return useQuery({
    queryKey: ['conversation', conversationId, 'access'],
    queryFn: () => api<ConversationAccess>(`/conversations/${encodeURIComponent(conversationId)}/access`),
    staleTime: 30_000,
    retry: false,
  });
}

export type FetchState = FetchStatusView;

/** A finished fetch younger than this is not re-run automatically on open. */
const REFETCH_AFTER_MS = 10 * 60_000;

const FETCH_ACTIVE = (s?: FetchState) => s?.status === 'pending' || s?.status === 'running';
/** Scrolling to the top asks again at most this often. */
const SCROLL_REFETCH_MS = 60_000;

/**
 * Loads a conversation's missing content from Zalo Web: when the chat has
 * messages without content, asks the extension (once per open) to open the
 * thread on Zalo Web and backfill it, then follows the request's status.
 */
export function useContentFetch(conversationId: string, missingContent: boolean, supported: boolean) {
  const qc = useQueryClient();
  const key = useMemo(() => ['fetch', conversationId], [conversationId]);
  const status = useQuery({
    queryKey: key,
    queryFn: () => api<FetchState>(`/conversations/${encodeURIComponent(conversationId)}/fetch`),
    enabled: supported,
    refetchInterval: (q) => (FETCH_ACTIVE(q.state.data) ? 3_000 : false),
    retry: false,
  });
  const request = useMutation({
    mutationFn: () => api<FetchRequest>(`/conversations/${encodeURIComponent(conversationId)}/fetch`, { method: 'POST' }),
    // Keep the presence info until the next status poll.
    onSuccess: (r) => qc.setQueryData<FetchState>(key, (prev) => ({ extension: null, otherLoggedIn: null, ...prev, ...r })),
  });

  // Auto-request once per open, unless a fetch is running or just finished.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !supported || !missingContent || !status.isSuccess) return;
    const s = status.data;
    if (FETCH_ACTIVE(s)) return void (asked.current = true);
    const finishedAt = s && 'finishedAt' in s && s.finishedAt ? Date.parse(s.finishedAt) : 0;
    if (s?.status === 'done' && Date.now() - finishedAt < REFETCH_AFTER_MS) return void (asked.current = true);
    asked.current = true;
    request.mutate();
  }, [supported, missingContent, status.isSuccess, status.data, request]);

  // The user scrolled to the top of the chat while content is still missing:
  // ask the extension again (it stops once the missing messages were seen).
  const lastAsk = useRef(0);
  const { mutate } = request;
  const requestOnScroll = useCallback(() => {
    if (!supported || FETCH_ACTIVE(status.data) || Date.now() - lastAsk.current < SCROLL_REFETCH_MS) return;
    lastAsk.current = Date.now();
    mutate();
  }, [supported, status.data, mutate]);
  useEffect(() => {
    if (request.isPending) lastAsk.current = Date.now();
  }, [request.isPending]);

  return {
    state: status.data,
    active: FETCH_ACTIVE(status.data),
    requestOnScroll,
    requestError: request.isError ? (request.error as Error) : null,
    retry: () => request.mutate(),
    retrying: request.isPending,
  };
}

export function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}

/** Sender profile for the chat's sender modal; idle while `userId` is null. */
export function useContactProfile(uid: string, userId: string | null, threadId: string) {
  return useQuery({
    queryKey: ['contact', uid, userId, threadId],
    queryFn: () =>
      api<ContactProfile>(`/contacts/${encodeURIComponent(uid)}/${encodeURIComponent(userId ?? '')}`, { query: { threadId } }),
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
  });
}
