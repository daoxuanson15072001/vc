import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, App, Badge, Button, Empty, Popconfirm, Spin, Tooltip } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { ArrowLeftOutlined, HourglassOutlined, InfoCircleOutlined, LockOutlined, TeamOutlined } from '@ant-design/icons';
import HandlerControl from './HandlerControl';
import LabelsControl from './LabelsControl';
import { InternalNoteBox, NoteBlock } from './InternalNotes';
import { useNoteActions, useNotes, usePeople } from './conversationWorkApi';
import { placeNotes, staffMentioned } from '../../utils/notes';
import type { ChatConversation, ChatMessage } from '../../types';
import { findQuoted, isOwnMessage, layoutMessages, messageSummary, visibleOutbox } from '../../utils/chat';
import { daySeparatorLabel } from '../../utils/time';
import ChatAvatar from './ChatAvatar';
import ChannelBadge from '../ChannelBadge';
import DoneControl, { DoneChip, useDone } from './DoneControl';
import { CrossChannelBanner, CustomerChannelStrip } from './CustomerChannels';
import { usePanel360 } from '../customers/customerApi';
import { HealthChip, useAccountHealth } from '../AccountHealth';
import { CHANNEL_INFO, TEST_PHASE_MESSAGE, channelOfUid } from '@vclinks/shared';
import Composer from './Composer';
import { unquotedText } from '../../utils/send-errors';
import ComposerTools from './ComposerTools';
import { useAiDraft } from './AiDraftCard';
import { useOutboxCommand } from './commands';
import { useJumpToMessage } from './jump';
import MessageBubble from './MessageBubble';
import OutboxBubble from './OutboxBubble';
import OutboxDrawer from '../outbox/OutboxDrawer';
import { COPIED_TOAST, CANCELLED_TOAST, RETRIED_TOAST, copyText, useMe, useOutboxActions, useOutboxCounts } from '../outbox/queue';
import { usePermissions } from '../../state/permissions';
import SenderModal from './SenderModal';
import ConversationInfoPanel from './ConversationInfoPanel';
import MessageMenu from './MessageMenu';
import { Checkbox } from 'antd';
import { WORKITEM_MAX_MESSAGES, type WorkitemKind } from '@vclinks/shared';
import CreateWorkitemModal from '../workitems/CreateWorkitemModal';
import SelectionBar from '../workitems/SelectionBar';
import WorkitemChips from '../workitems/WorkitemChips';
import WorkitemDrawer from '../workitems/WorkitemDrawer';
import { draftKeyFor } from '../../utils/drafts';
import NoAccess, { isNoAccessError } from '../access/NoAccess';
import { usePageTitle } from '../layout/PageTitle';
import { TYPING_EVENT, TYPING_SHOW_MS, typingText, type TypingDetail } from './typingBus';
import { isNotFound, splitConversationId, type FetchState, useContentFetch, useConversation, useConversationAccess, useOutbox, useThreadMessages } from './hooks';

const NEAR_BOTTOM_PX = 120;
const UNSUPPORTED = 'Máy chủ chưa hỗ trợ gửi tin';
/** Channels whose sender can press the channel's own "Trả lời" (API: REPLY_CHANNELS). */
const REPLY_CHANNELS = new Set(['zalo']);
const FLASH_MS = 1600;

/** Reason shown instead of the compose box when the nick cannot send (03 SZ-10); null = can send. */
function sendLock(h: ReturnType<typeof useAccountHealth>, threadId: string): string | null {
  if (h?.onlyThreadIds && !h.onlyThreadIds.includes(threadId)) return TEST_PHASE_MESSAGE;
  if (!h || h.canSend) return null;
  return h.level === 'unsafe'
    ? 'Nick này đang ở trạng thái "Chưa an toàn" nên chưa gửi được. Hãy báo Admin.'
    : `Nick đang mất kết nối nên chưa gửi được. ${h.reason ?? ''} Tin bạn soạn xong sẽ gửi được khi nick xanh lại.`;
}

interface Props {
  conversationId: string;
  /** List item for the header; may be missing when opened by direct link. */
  conversation?: ChatConversation;
  accountLabel: string;
  onBack?: () => void;
  /** Extra header button(s) from the page, e.g. "Khách" when the customer panel is closed. */
  headerExtra?: ReactNode;
}

/** What the extension is doing for this conversation, from its last heartbeat. */
function fetchWaitText(s: FetchState | undefined, account: string): string {
  if (s?.status === 'running') return `Extension đang mở hội thoại trên Zalo Web (tài khoản ${account}) và lấy nội dung…`;
  const ext = s?.extension;
  if (s?.otherLoggedIn && !(ext?.online && ext.loggedIn)) {
    return `Tab Zalo Web đang đăng nhập tài khoản ${s.otherLoggedIn.label}, không phải ${account}. Hãy mở chat.zalo.me bằng tài khoản ${account}.`;
  }
  if (!ext?.online) {
    return `Chưa thấy extension VClinks nào trực tuyến cho tài khoản ${account}: hãy mở tab chat.zalo.me của tài khoản này (và kiểm tra extension đã bật).`;
  }
  if (ext.loggedIn === false) return `Tab Zalo Web đang mở không phải tài khoản ${account}.`;
  const where = ext.loggedIn ? `Đã thấy tab Zalo Web của đúng tài khoản ${account}` : 'Extension đang chạy (chưa nhận ra tài khoản đang đăng nhập)';
  if (ext.waiting === 'user_active') return `${where}. Đang chờ anh ngừng thao tác trên tab Zalo khoảng 15 giây…`;
  if (ext.waiting === 'tab_hidden') {
    return `${where}, nhưng tab Zalo đang ẩn nên Zalo Web không tải danh sách hội thoại. Hãy mở chat.zalo.me ở một cửa sổ Chrome riêng, để cửa sổ đó hiện trên màn hình (không bị che kín) trong lúc lấy nội dung…`;
  }
  if (ext.waiting === 'busy') return `${where}. Extension đang bận việc khác (gửi tin / lấy lịch sử), sẽ làm ngay sau đó…`;
  return `${where}, sắp mở hội thoại…`;
}

/** See the onReact prop below: nicks through the extension (Zalo Web) cannot react yet; direct nicks can. */
const REACTIONS_FROM_DASHBOARD = false;

/** How a message leaves for a nick on the máy Zalo (tooltip of the send button). */
const FARM_ROUTE = {
  direct: 'qua máy Zalo của công ty (kết nối trực tiếp, không cần Zalo Web)',
  browser: 'qua máy Zalo của công ty (Zalo Web trên máy chủ)',
} as const;

export default function ChatPane({ conversationId, conversation: fromList, accountLabel, onBack, headerExtra }: Props) {
  const { message, modal } = App.useApp();
  const { uid, threadId } = splitConversationId(conversationId);
  // Opened by direct link (or not in the loaded page of the list): load the header itself.
  const direct = useConversation(conversationId, !fromList);
  const conversation = fromList ?? direct.data;
  const isGroup = conversation?.type === 'group';
  const title = conversation?.name || threadId;
  usePageTitle(title);

  // `?msg=` of a search hit (M1c-05): the chat opens on that message.
  const [sp, setSp] = useSearchParams();
  const thread = useThreadMessages(conversationId, sp.get('msg') ?? undefined);
  const outbox = useOutbox(uid, threadId);
  const health = useAccountHealth(uid);
  const access = useConversationAccess(conversationId);
  const me = useMe();
  const draftOwner = me.data ? (me.data.userId ?? me.data.name) : undefined;
  const perms = usePermissions();
  const actions = useOutboxActions();
  const threadCounts = useOutboxCounts({ uid, threadId });
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // M1c-03: message selection for "Chuyển CSKH…" (QT-SZ-13/14, ≤ 10 messages), the item panel and its create box.
  const [selecting, setSelecting] = useState<{ kind: WorkitemKind; ids: string[] } | null>(null);
  const [creating, setCreating] = useState(false);
  const [wiOpen, setWiOpen] = useState<string | null>(null);
  const nickDown = health?.level === 'red' || health?.level === 'unsafe';
  // "Đang soạn tin…" (direct nicks): shown a few seconds after each typing event, gone when a message arrives.
  const [typing, setTyping] = useState<{ who?: string; until: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onTyping = (e: Event) => {
      const d = (e as CustomEvent<TypingDetail>).detail;
      if (!d || d.uid !== uid || d.threadId !== threadId) return;
      clearTimeout(timer);
      if (d.stop) {
        setTyping(null);
        return;
      }
      setTyping({ who: d.who, until: Date.now() + TYPING_SHOW_MS });
      timer = setTimeout(() => setTyping(null), TYPING_SHOW_MS);
    };
    window.addEventListener(TYPING_EVENT, onTyping);
    return () => {
      window.removeEventListener(TYPING_EVENT, onTyping);
      clearTimeout(timer);
    };
  }, [uid, threadId]);

  // Personal Zalo: content lives only in Zalo Web's DOM; ask the extension to load what is missing.
  const missingContent = useMemo(
    // Content that can no longer come (the nick left Zalo Web) does not ask the extension.
    () => thread.messages.some((m) => !m.contentGone && (m.encrypted || m.contentStatus === 'pending' || m.contentStatus === 'partial')),
    [thread.messages],
  );
  // SZ-23: only the nick holder / cover makes Zalo Web open the thread (customer sees "Đã xem").
  const autoFetch = access.data?.autoFetch === true;
  const fetcher = useContentFetch(conversationId, missingContent, channelOfUid(uid) === 'zalo' && autoFetch);
  const fetchOnBehalf = useMutation({
    mutationFn: () => api(`/conversations/${encodeURIComponent(conversationId)}/fetch`, { method: 'POST', body: { onBehalf: true } }),
    onSuccess: () => message.success('Đã gửi lệnh lấy nội dung'),
    onError: (e: Error) => message.error(e.message),
  });
  // Once the extension finished, reload so older pages pick up their content too.
  const fetchStatus = fetcher.state?.status;
  const prevFetchStatus = useRef(fetchStatus);
  const { reload } = thread;
  useEffect(() => {
    if (fetchStatus === 'done' && prevFetchStatus.current && prevFetchStatus.current !== 'done') reload();
    prevFetchStatus.current = fetchStatus;
  }, [fetchStatus, reload]);

  // The moment an item is reported sent, pull the newest page so the real
  // bubble replaces the outbox one instead of waiting for the next 5 s poll.
  const sentCount = useMemo(() => outbox.items.filter((o) => o.status === 'sent').length, [outbox.items]);
  const prevSentCount = useRef(sentCount);
  const { refetch: refetchThread } = thread;
  useEffect(() => {
    if (sentCount > prevSentCount.current) refetchThread();
    prevSentCount.current = sentCount;
  }, [sentCount, refetchThread]);

  // Zalo shows a sender's name only above the first bubble of a run: reuse it for the others.
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of thread.messages) if (m.senderName) map.set(m.fromUid, m.senderName);
    return map;
  }, [thread.messages]);
  // Zalo shows the delivery state under the newest own message only.
  const lastOwnId = useMemo(() => {
    for (let i = thread.messages.length - 1; i >= 0; i--) if (isOwnMessage(thread.messages[i].fromUid, uid)) return thread.messages[i].id;
    return null;
  }, [thread.messages, uid]);
  const layout = useMemo(
    () =>
      layoutMessages(
        thread.messages
          // Other photos of an album are shown on the album's first message.
          .filter((m) => !m.albumOf)
          .map((m) => ({
            ...m,
            senderName: m.senderName || names.get(m.fromUid) || null,
            senderKey: isOwnMessage(m.fromUid, uid) ? '__self__' : m.fromUid,
          })),
      ),
    [thread.messages, uid, names],
  );
  const pendingOut = useMemo(() => visibleOutbox(outbox.items, thread.messages, uid), [outbox.items, thread.messages, uid]);

  // ---- Reply ("Trả lời") and sender details.
  const channel = channelOfUid(uid);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  // "Gửi không trích dẫn" (03 §8 D33): the failed reply is cancelled once its replacement is approved.
  const [unquote, setUnquote] = useState<{ fromId: string; text: string; key: number } | null>(null);
  // "Dùng nháp" (M1c-06): the AI draft put in the composer; reported after the user presses "Gửi".
  const [aiUse, setAiUse] = useState<{ draftId: string; text: string; key: number } | null>(null);
  useEffect(() => setAiUse(null), [conversationId]);
  const [sender, setSender] = useState<{ userId: string; name: string } | null>(null);
  const canReply = REPLY_CHANNELS.has(channel);
  // Owner or nick holder on a personal channel (ticket.create CT, NICK); the API decides again.
  const canTransfer = CHANNEL_INFO[channel].sendMode !== 'api' && perms.has('ticket.create');
  const quoteOf = useCallback(
    (m: ChatMessage) => ({
      senderName: isOwnMessage(m.fromUid, uid)
        ? 'Bạn'
        : m.senderName || names.get(m.fromUid) || (isGroup ? m.fromUid : conversation?.name) || m.fromUid,
      text: messageSummary(m),
    }),
    [uid, isGroup, conversation?.name, names],
  );
  const onReply = useCallback((m: ChatMessage) => setReplyTo(m), []);
  const onSenderClick = useCallback((m: ChatMessage, name: string) => setSender({ userId: m.fromUid, name }), []);

  // ---- Scrolling: stick to bottom unless the user scrolled up; keep position when older pages are prepended.
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const ready = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restore.current) {
      el.scrollTop = el.scrollHeight - restore.current.height + restore.current.top;
      restore.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    if (thread.messages.length) ready.current = true;
  }, [layout, pendingOut.length]);

  // Images/media load after render and change the height: keep the bottom pinned.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current && !restore.current) scrollToBottom();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollToBottom, thread.isLoading]);

  // Infinite scroll up: load an older page when the top sentinel becomes visible.
  const { hasMore, loadingOlder, loadOlder } = thread;

  // Internal notes and event lines (00 MH-UI-08), placed between the messages by time.
  const canNote = perms.has('conv.note');
  const notes = useNotes(conversationId);
  const people = usePeople(conversationId, perms.has(['conv.note', 'conv.assign', 'conv.transfer']));
  const noteActions = useNoteActions(conversationId);
  const [noteOpen, setNoteOpen] = useState(false);
  useEffect(() => setNoteOpen(false), [conversationId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (canNote && e.altKey && (e.key === 'g' || e.key === 'G' || e.code === 'KeyG')) {
        e.preventDefault();
        setNoteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canNote]);
  const placed = useMemo(
    () => placeNotes(layout.map((l) => ({ id: l.item.id, sentAt: l.item.sentAt })), notes.data ?? [], !hasMore),
    [layout, notes.data, hasMore],
  );
  // `?note=` of a mention notice: scroll to the note and light it up for a moment.
  const noteParam = sp.get('note');
  const [flashNote, setFlashNote] = useState<string | null>(null);
  useEffect(() => {
    if (!noteParam || !notes.data?.some((n) => n.id === noteParam)) return;
    document.getElementById(`note-${noteParam}`)?.scrollIntoView({ block: 'center' });
    setFlashNote(noteParam);
    const t = setTimeout(() => setFlashNote(null), 1600);
    return () => clearTimeout(t);
  }, [noteParam, notes.data]);
  useEffect(() => {
    const root = scrollRef.current;
    const el = topRef.current;
    if (!root || !el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || !ready.current || loadingOlder) return;
        restore.current = { height: root.scrollHeight, top: root.scrollTop };
        void loadOlder().then((loaded) => {
          if (!loaded) restore.current = null;
        });
      },
      { root, rootMargin: '200px 0px 0px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingOlder, loadOlder]);

  // Reaching the top of the chat with content still missing: load it from Zalo Web.
  const { requestOnScroll } = fetcher;
  useEffect(() => {
    const root = scrollRef.current;
    const el = topRef.current;
    if (!root || !el || !missingContent) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && ready.current) requestOnScroll();
      },
      { root },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [missingContent, requestOnScroll]);

  useJumpToMessage({ scrollRef, stickToBottom, anchor: thread.anchor, loaded: !thread.isLoading && thread.messages.length > 0 });
  const backToLatest = () => {
    thread.goLatest();
    stickToBottom.current = true;
    setSp((p) => { const n = new URLSearchParams(p); n.delete('msg'); return n; }, { replace: true });
  };

  const command = useOutboxCommand(uid, threadId);
  // Reactions are commands the extension performs on Zalo Web; the pill shows at once (mirrored) and is confirmed by the next sync.
  const onReact = useCallback(
    (m: ChatMessage, icon: string) => {
      if (!m.cliMsgId) return;
      command
        .mutateAsync({ action: 'react', reaction: { cliMsgId: m.cliMsgId, icon } })
        .then(() => message.success('Đã gửi lệnh thả cảm xúc'))
        .catch((e: Error) => message.error(e.message));
    },
    [command, message],
  );
  /** A colleague's name written as @Name in a message to the customer: probably meant as a note (00 MH-UI-08). */
  const askMisfire = (name: string) =>
    new Promise<'note' | 'send' | 'cancel'>((resolve) => {
      const inst = modal.confirm({
        title: `Tin này có @${name}. Bạn đang nhắn cho khách.`,
        content: 'Chuyển thành ghi chú nội bộ?',
        okText: 'Chuyển thành ghi chú',
        cancelText: 'Hủy',
        onOk: () => resolve('note'),
        onCancel: () => resolve('cancel'),
        footer: (_, { OkBtn, CancelBtn }) => (
          <>
            <CancelBtn />
            <Button
              onClick={() => {
                inst.destroy();
                resolve('send');
              }}
            >
              Vẫn gửi khách
            </Button>
            <OkBtn />
          </>
        ),
      });
    });
  const onSend = async (text: string, mentions?: { name: string; uid?: string }[]) => {
    const staff = canNote ? staffMentioned(text, (people.data ?? []).map((p) => p.name), (mentions ?? []).map((m) => m.name)) : [];
    if (staff.length) {
      const choice = await askMisfire(staff[0]!);
      if (choice === 'cancel') throw Object.assign(new Error('Đã hủy'), { silent: true });
      if (choice === 'note') {
        const ids = (people.data ?? []).filter((p) => staff.includes(p.name)).map((p) => p.id);
        await noteActions.add.mutateAsync({ text, mentions: ids });
        message.success('Đã lưu thành ghi chú nội bộ, khách không thấy.');
        return;
      }
    }
    try {
      stickToBottom.current = true;
      if (mentions?.length) {
        // @mentions go as a command so the extension picks each name from Zalo's list.
        if (replyTo) throw new Error('Chưa hỗ trợ vừa trả lời trích dẫn vừa @nhắc tên trong một tin');
        await command.mutateAsync({ text, mentions });
      } else {
        const item = await outbox.send.mutateAsync({ text, replyToCliMsgId: replyTo?.cliMsgId ?? undefined });
        if (aiUse) {
          // Records the pair (draft, text actually sent) for the playbook; the send itself is already done.
          const draftId = aiUse.draftId;
          setAiUse(null);
          api(`/conversations/${encodeURIComponent(conversationId)}/ai-draft/${draftId}/sent`, { method: 'POST', body: { outboxId: item.id } }).catch(() => undefined);
        }
      }
      setReplyTo(null);
      if (unquote) {
        const fromId = unquote.fromId;
        setUnquote(null);
        // The new, unquoted message is a new approval; the failed reply must not linger as "Gửi lỗi".
        outbox.cancel.mutate({ id: fromId }, { onError: (e) => message.error(`Không bỏ được lệnh lỗi cũ: ${(e as Error).message}`) });
      }
    } catch (e) {
      throw isNotFound(e) ? new Error(UNSUPPORTED) : e;
    }
  };

  /** Quote shown on a pending reply: the loaded target, or a placeholder. */
  const replyQuote = (cliMsgId: string | null | undefined) => {
    if (!cliMsgId) return null;
    const target = thread.messages.find((x) => x.cliMsgId === cliMsgId);
    return target ? quoteOf(target) : { senderName: 'Tin nhắn', text: '[Tin chưa tải]' };
  };

  /** Scrolls to the quoted message and flashes it; says so when it is not loaded. */
  const onQuoteClick = (m: ChatMessage) => {
    const target = m.quote && findQuoted(m.quote, thread.messages, m.sentAt);
    const row = target && scrollRef.current?.querySelector<HTMLElement>(`[data-msgid="${CSS.escape(target.msgId)}"]`);
    if (!row) {
      message.info('Tin được trả lời nằm ở đoạn cũ hơn, chưa tải. Hãy cuộn lên để tải thêm.');
      return;
    }
    stickToBottom.current = false;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.add('flash');
    window.setTimeout(() => row.classList.remove('flash'), FLASH_MS);
  };

  /** Scrolls to a loaded message chosen in the info panel (search tab). */
  const onJumpTo = (m: ChatMessage) => {
    const row = scrollRef.current?.querySelector<HTMLElement>(`[data-msgid="${CSS.escape(m.msgId)}"]`);
    if (!row) return;
    stickToBottom.current = false;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.add('flash');
    window.setTimeout(() => row.classList.remove('flash'), FLASH_MS);
  };

  // "Xong" state of the conversation (plan B2), shared by the header chip and the action.
  const doneState = useDone(conversationId, conversation?.done);
  // The customer's other conversations (plan B2): 1-1 threads only, same cached query as the customer panel.
  const customer = usePanel360(uid, threadId, !!conversation && !isGroup);

  // AI draft lives inside the composer: hidden for viewers (no compose box) and without the ai.draft right.
  const ai = useAiDraft({
    conversationId,
    enabled: perms.has('ai.draft') && !(access.data && !access.data.canReply),
    disabled: outbox.unsupported || !!sendLock(health, threadId),
    onUse: (text, draftId) => setAiUse({ draftId, text, key: Date.now() }),
  });

  // The nick (and its state) is shown by the health chip; the sub line only adds the group size.
  const subtitle = isGroup ? (conversation?.memberCount ? `Nhóm · ${conversation.memberCount.toLocaleString('vi-VN')} thành viên` : 'Nhóm') : '';

  // MH-PQ-11 form B: outside the user's scope and "does not exist" look the same; no name, content or owner.
  if (isNoAccessError(thread.error) || isNoAccessError(direct.error)) return <NoAccess kind="object" code={conversationId} />;
  // Viewer: no compose box, only the common sentence of 00 MH-UI-08 (D17).
  const readOnly = access.data && !access.data.canReply ? (access.data.replyReason ?? 'Bạn chỉ có quyền xem hội thoại này.') : null;

  return (
    <div className="chat-pane">
      <div className="chat-header">
        {onBack && <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="Quay lại danh sách" />}
        <ChatAvatar name={conversation?.name} src={conversation?.avatar} colorKey={threadId} group={isGroup} size={44} />
        <div className="chat-header__info">
          <div className="chat-header__title" title={title}>
            {title}
          </div>
          {typing && (
            <div className="chat-header__typing" aria-live="polite">
              {typingText(isGroup, typing.who ? thread.messages.find((m) => m.fromUid === typing.who && m.senderName)?.senderName : null)}
            </div>
          )}
          <div className="chat-header__meta">
            <ChannelBadge channel={channel} />
            {doneState.done && <DoneChip done={doneState.done} />}
            {subtitle && (
              <span className="chat-header__sub">
                <TeamOutlined />
                {subtitle}
              </span>
            )}
            {health ? (
              <HealthChip uid={uid} name={accountLabel || 'Nick chưa đặt tên'} />
            ) : (
              accountLabel && <span>Qua nick {accountLabel}</span>
            )}
            <WorkitemChips uid={uid} threadId={threadId} onOpen={setWiOpen} enabled={perms.has(['ticket.view', 'ticket.create', 'workitem.approve', 'workitem.return'])} />
            <LabelsControl conversationId={conversationId} labels={conversation?.vcLabels} />
          </div>
        </div>
        <div className="chat-header__actions">
          <HandlerControl conversationId={conversationId} conversation={conversation} meId={me.data?.userId ?? null} />
          {canNote && (
            <Tooltip title="Ghi chú nội bộ, khách không thấy (Alt+G)">
              <Button icon={<LockOutlined />} onClick={() => setNoteOpen(true)} aria-label="Ghi chú nội bộ">
                <span className="btn-label">Ghi chú</span>
              </Button>
            </Tooltip>
          )}
          <DoneControl state={doneState} enabled={perms.has('conv.status')} />
          {/* ⏳ Lệnh gửi of this conversation (MH-SZ-03 #7): red when something needs attention. */}
          <Tooltip title="Lệnh gửi của hội thoại này">
            <Badge
              count={(threadCounts.data?.attention ?? 0) || (threadCounts.data?.approved ?? 0) + (threadCounts.data?.sending ?? 0)}
              color={threadCounts.data?.attention ? undefined : 'var(--muted)'}
              size="small"
            >
              <Button icon={<HourglassOutlined />} onClick={() => setOutboxOpen(true)} aria-label="Lệnh gửi">
                <span className="btn-label">Lệnh gửi</span>
              </Button>
            </Badge>
          </Tooltip>
          <Tooltip title="Thông tin hội thoại: thành viên, ảnh, file, link, tìm tin">
            <Button type="text" icon={<InfoCircleOutlined />} onClick={() => setInfoOpen(true)} aria-label="Thông tin hội thoại" />
          </Tooltip>
          {headerExtra}
        </div>
      </div>
      {customer.data && <CustomerChannelStrip data={customer.data} currentId={conversationId} />}
      {customer.data && <CrossChannelBanner data={customer.data} />}
      <ConversationInfoPanel
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        conversationId={conversationId}
        title={title}
        avatar={conversation?.avatar}
        isGroup={isGroup}
        messages={thread.messages}
        onJump={onJumpTo}
      />
      <OutboxDrawer open={outboxOpen} onClose={() => setOutboxOpen(false)} thread={{ uid, threadId, name: conversation?.name ?? undefined }} />

      {channelOfUid(uid) === 'zalo' && missingContent && access.data && !autoFetch && (
        <Alert
          type="info"
          banner
          showIcon
          message={`Một số tin chưa có nội dung. Mở hội thoại này không làm khách thấy "Đã xem" và không làm mất badge của ${access.data.holderName ?? 'người giữ nick'}.`}
          action={
            access.data.canFetchOnBehalf ? (
              <Popconfirm
                title={`Khách sẽ thấy "Đã xem" và ${access.data.holderName ?? 'người giữ nick'} sẽ mất badge chưa đọc. Vẫn lấy nội dung?`}
                okText="Lấy nội dung"
                cancelText="Hủy"
                onConfirm={() => fetchOnBehalf.mutate()}
              >
                <Button size="small" loading={fetchOnBehalf.isPending}>
                  Lấy nội dung (khách sẽ thấy "Đã xem")
                </Button>
              </Popconfirm>
            ) : undefined
          }
        />
      )}
      {fetcher.active && (
        <Alert
          type="info"
          banner
          showIcon
          icon={<Spin size="small" />}
          message={fetchWaitText(fetcher.state, accountLabel || 'Nick chưa đặt tên')}
        />
      )}
      {!fetcher.active && (fetcher.state?.status === 'failed' || fetcher.requestError) && (
        <Alert
          type="warning"
          banner
          showIcon
          message={`Không lấy được nội dung từ Zalo Web: ${
            fetcher.requestError?.message ?? (fetcher.state && 'error' in fetcher.state ? fetcher.state.error : '') ?? ''
          }`}
          action={
            <Button size="small" onClick={fetcher.retry} loading={fetcher.retrying}>
              Thử lại
            </Button>
          }
        />
      )}

      {thread.anchor && (
        <Alert
          type="info"
          showIcon
          banner
          message="Bạn đang xem một tin cũ từ kết quả tìm kiếm."
          action={<Button size="small" onClick={backToLatest}>Về tin mới nhất</Button>}
        />
      )}
      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
        <div ref={contentRef}>
          <div ref={topRef} className="chat-scroll__top">
            {loadingOlder ? <Spin size="small" /> : thread.olderError ? `Lỗi tải tin cũ: ${thread.olderError}` : !hasMore && thread.messages.length ? 'Đã hiển thị toàn bộ tin nhắn' : null}
          </div>

          {thread.isLoading && <Spin style={{ display: 'block', margin: '48px auto' }} />}
          {thread.error && (
            <Alert type="error" showIcon message="Không tải được tin nhắn" description={thread.error.message} />
          )}
          {!thread.isLoading && !thread.error && !thread.messages.length && !pendingOut.length && (
            <Empty description="Chưa có tin nhắn" style={{ marginTop: 48 }} />
          )}

          {layout.map(({ item: m, daySeparator, firstInRun, lastInRun }) => (
            <Fragment key={m.id}>
              {(placed.before.get(m.id) ?? []).map((n) => (
                <NoteBlock key={n.id} conversationId={conversationId} note={n} highlighted={flashNote === n.id} />
              ))}
              {daySeparator && (
                <div className="day-sep">
                  <span>{daySeparatorLabel(m.sentAt)}</span>
                </div>
              )}
              {selecting && !m.systemEvent && (
                <Checkbox
                  className="wi-select-check"
                  aria-label="Chọn tin"
                  checked={selecting.ids.includes(m.id)}
                  disabled={!selecting.ids.includes(m.id) && selecting.ids.length >= WORKITEM_MAX_MESSAGES}
                  onChange={(e) => setSelecting((s) => (s ? { ...s, ids: e.target.checked ? [...s.ids, m.id] : s.ids.filter((x) => x !== m.id) } : s))}
                />
              )}
              <MessageMenu
                m={m}
                conversationId={conversationId}
                onOpenInfo={() => setInfoOpen(true)}
                onTransfer={canTransfer ? (kind) => setSelecting({ kind, ids: [m.id] }) : undefined}
              >
              <MessageBubble
                m={m}
                own={m.senderKey === '__self__'}
                isGroup={isGroup}
                firstInRun={firstInRun}
                lastInRun={lastInRun}
                peerAvatar={conversation?.avatar}
                peerName={conversation?.name}
                onReply={canReply && m.cliMsgId ? onReply : undefined}
                onSenderClick={onSenderClick}
                onQuoteClick={onQuoteClick}
                showStatus={m.id === lastOwnId}
                // Reactions: Zalo Web's picker only takes real mouse input (live check 28/09/2026), so nicks through the
                // extension keep it hidden; a direct nick (máy Zalo, zca-js) reacts through the API.
                onReact={(REACTIONS_FROM_DASHBOARD || health?.farmMode === 'direct') && canReply && m.cliMsgId && !m.systemEvent ? onReact : undefined}
              />
              </MessageMenu>
            </Fragment>
          ))}

          {placed.after.map((n) => (
            <NoteBlock key={n.id} conversationId={conversationId} note={n} highlighted={flashNote === n.id} />
          ))}

          {pendingOut.map((o) => (
            <OutboxBubble
              key={o.id}
              item={o}
              quote={replyQuote(o.replyToCliMsgId)}
              onRetry={(id) =>
                outbox.retry.mutate(id, {
                  onSuccess: () => message.success(RETRIED_TOAST),
                  onError: (e) => message.error(isNotFound(e) ? UNSUPPORTED : `Không thử lại được: ${(e as Error).message}`),
                })
              }
              retrying={outbox.retry.isPending && outbox.retry.variables === o.id}
              onReapprove={
                perms.me?.legacy || perms.me?.heldChannels.includes(uid)
                  ? (id) =>
                      actions.reapprove.mutate(id, {
                        onSuccess: () => message.success('Đã duyệt lại, lệnh vào hàng gửi.'),
                        onError: (e) => message.error(`Không duyệt lại được: ${(e as Error).message}`),
                      })
                  : undefined
              }
              onCancel={(id) =>
                outbox.cancel.mutate(
                  { id },
                  { onSuccess: () => message.success(CANCELLED_TOAST), onError: (e) => message.error(`Không bỏ được lệnh: ${(e as Error).message}`) },
                )
              }
              onCopyCancel={
                nickDown
                  ? async (it) => {
                      if (!(await copyText(it.text))) return void message.error('Trình duyệt không cho sao chép; hãy chép tay nội dung rồi Hủy gửi');
                      outbox.cancel.mutate(
                        { id: it.id, copied: true },
                        { onSuccess: () => message.success(COPIED_TOAST), onError: (e) => message.error(`Không bỏ được lệnh: ${(e as Error).message}`) },
                      );
                    }
                  : undefined
              }
              onConfirm={
                (me.data?.userId ?? me.data?.name) && (me.data?.userId ?? me.data?.name) === o.approvedBy
                  ? (id) =>
                      outbox.confirm.mutate(id, {
                        onSuccess: () => message.success(RETRIED_TOAST),
                        onError: (e) => message.error(`Không gửi được: ${(e as Error).message}`),
                      })
                  : undefined
              }
              onSendWithoutQuote={
                canReply
                  ? (it) => {
                      setReplyTo(null);
                      setUnquote({ fromId: it.id, text: unquotedText(it.text, replyQuote(it.replyToCliMsgId)?.text), key: Date.now() });
                    }
                  : undefined
              }
              nickLabel={accountLabel}
              conversationName={conversation?.name ?? undefined}
              awaitingCount={pendingOut.filter((x) => x.status === 'awaiting_confirm').length}
            />
          ))}
        </div>
      </div>

      {outbox.error && (
        <Alert type="warning" banner showIcon message={`Không tải được hàng đợi gửi: ${outbox.error.message}`} />
      )}
      {canNote && <InternalNoteBox key={conversationId} conversationId={conversationId} open={noteOpen} onClose={() => setNoteOpen(false)} people={people.data ?? []} />}
      {selecting ? (
        <SelectionBar count={selecting.ids.length} onNext={() => setCreating(true)} onCancel={() => setSelecting(null)} />
      ) : readOnly ? (
        <div className="chat-readonly" role="note">
          {readOnly}
        </div>
      ) : (
      <Composer
        key={`${conversationId}|${draftOwner ?? ''}`}
        draftKey={draftKeyFor(draftOwner, conversationId)}
        onSend={onSend}
        sending={outbox.send.isPending}
        disabledReason={outbox.unsupported ? UNSUPPORTED : sendLock(health, threadId)}
        accountLabel={accountLabel || 'Nick chưa đặt tên'}
        channel={channel}
        sendRoute={health?.farmMode ? FARM_ROUTE[health.farmMode] : undefined}
        placeholderName={title}
        renderTools={
          channelOfUid(uid) === 'zalo'
            ? (insert) => (
                <ComposerTools
                  uid={uid}
                  threadId={threadId}
                  conversationId={conversationId}
                  isGroup={isGroup}
                  accountLabel={accountLabel || 'Nick chưa đặt tên'}
                  onMention={insert.mention}
                  onInsertText={insert.text}
                  vars={{ ten_khach: title, ten_nv: me.data?.name ?? accountLabel, ten_nguoi_giu_nick: access.data?.holderName ?? me.data?.name ?? accountLabel }}
                  disabled={outbox.unsupported || !!sendLock(health, threadId)}
                  direct={health?.farmMode === 'direct'}
                  onBehalfHolder={access.data?.sendMode === 'tra_loi_thay' ? (access.data.holderName ?? null) : null}
                />
              )
            : undefined
        }
        replyTo={replyTo ? quoteOf(replyTo) : null}
        prefill={aiUse ? { text: aiUse.text, key: aiUse.key } : unquote ? { text: unquote.text, key: unquote.key } : null}
        onCancelReply={() => setReplyTo(null)}
        onBehalf={
          access.data?.sendMode && access.data.holderName
            ? { mode: access.data.sendMode, holderName: access.data.holderName, nickLabel: access.data.nickLabel ?? accountLabel, until: access.data.coverUntil }
            : null
        }
        vars={{ ten_nv: me.data?.name ?? null, ten_nguoi_giu_nick: access.data?.holderName ?? me.data?.name ?? null }}
        aiButton={ai.button}
        aiPanel={ai.panel}
      />
      )}
      {selecting && creating && (
        <CreateWorkitemModal
          kind={selecting.kind}
          uid={uid}
          threadId={threadId}
          messages={thread.messages.filter((m) => selecting.ids.includes(m.id))}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelecting(null);
            setWiOpen(id);
          }}
        />
      )}
      <WorkitemDrawer id={wiOpen} onClose={() => setWiOpen(null)} />
      <SenderModal
        uid={uid}
        userId={sender?.userId ?? null}
        threadId={threadId}
        fallbackName={sender?.name}
        onClose={() => setSender(null)}
      />
    </div>
  );
}
