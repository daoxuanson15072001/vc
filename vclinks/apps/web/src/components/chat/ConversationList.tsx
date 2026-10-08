import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, App, Button, Dropdown, Input, Popover, Select, Spin, Switch } from 'antd';
import { CheckOutlined, FilterOutlined, MailOutlined, PushpinFilled, PushpinOutlined, SearchOutlined, TagFilled, TeamOutlined } from '@ant-design/icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CHANNELS, CHANNEL_INFO, CONVERSATION_OUTCOME_LABELS, INBOX_SCOPE_LABELS, type Channel, type InboxScope, type InboxSummary, type Paged } from '@vclinks/shared';
import { api } from '../../api';
import type { ChatConversation } from '../../types';
import { relativeListTime } from '../../utils/time';
import ChannelBadge from '../ChannelBadge';
import ChatAvatar from './ChatAvatar';
import SlaChip, { slaShortText } from './SlaChip';
import { usePermissions } from '../../state/permissions';
import { useAccounts } from '../AccountSelect';
import { nickName } from '../../utils/nick';
import { LabelChips } from './LabelsControl';
import { useLabelCatalog } from './conversationWorkApi';

const PAGE_SIZE = 30;
const ALL_NICKS = '__all__';
// Draggable list width, remembered per browser (losing it is harmless).
const WIDTH_KEY = 'vclinks.convListWidth';
// Last list view ("Cần trả lời" / "Tất cả"), remembered per browser.
const VIEW_KEY = 'vclinks.convListView';
// "Gom hội thoại cùng một khách" on / off, remembered per browser (default on).
const GROUP_KEY = 'vclinks.convGroupByCustomer';

function readGroup(): boolean {
  try {
    return localStorage.getItem(GROUP_KEY) !== '0';
  } catch {
    return true;
  }
}
const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 360;

function readWidth(): number {
  try {
    const w = Number(localStorage.getItem(WIDTH_KEY));
    return w >= MIN_WIDTH && w <= MAX_WIDTH ? w : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

/** Work-state tabs (plan B2): "Cần trả lời" · "Chờ khách" · "Đã xong" · "Tất cả" (the Zalo-like list). */
type ListView = 'todo' | 'waiting' | 'done' | 'all';
const VIEWS: { key: ListView; label: string }[] = [
  { key: 'todo', label: 'Cần trả lời' },
  { key: 'waiting', label: 'Chờ khách' },
  { key: 'done', label: 'Đã xong' },
  { key: 'all', label: 'Tất cả' },
];

const EMPTY_TEXT: Record<ListView, string> = {
  todo: 'Không còn hội thoại chờ trả lời',
  waiting: 'Không có hội thoại đang chờ khách',
  done: 'Chưa có hội thoại nào đã xong',
  all: 'Chưa có hội thoại',
};

function readView(): ListView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return VIEWS.some((x) => x.key === v) ? (v as ListView) : 'all';
  } catch {
    return 'all';
  }
}
// Polled only while the tab is visible (react-query default refetchIntervalInBackground=false).
const REFRESH_MS = 5_000;

interface Props {
  accountUid?: string;
  selectedId?: string;
  onSelect: (c: ChatConversation) => void;
  /** Label per account uid; shown as a tag when several accounts are listed together. */
  accountLabel?: (uid: string) => string;
  showAccountTag?: boolean;
  /** Reports loaded items so the chat header can reuse name/avatar without another request. */
  onItems?: (items: ChatConversation[]) => void;
  /** Switches the nick being viewed (same setting as the account menu on the nav rail). */
  onAccountChange?: (uid?: string) => void;
  /** Desktop only: the right edge can be dragged to change the list width. */
  resizable?: boolean;
}

export function conversationPreview(c: ChatConversation): string {
  const text = c.preview ?? c.lastMessage?.text;
  if (text) {
    const who = c.type === 'group' && c.lastMessage?.senderName ? `${c.lastMessage.senderName}: ` : '';
    return who + text.replace(/\s+/g, ' ');
  }
  if (c.encrypted) return 'Đang chờ nội dung';
  return c.messageCount ? `${c.messageCount.toLocaleString('vi-VN')} tin nhắn` : 'Chưa có tin nhắn';
}

/** Toggle chip of the filter bar (pressed state is announced, never shown by color alone). */
function FilterChip({ on, onClick, count, tone, title, children }: { on: boolean; onClick: () => void; count?: number; tone?: 'danger'; title?: string; children: ReactNode }) {
  return (
    <button type="button" className={`filter-chip${on ? ' is-on' : ''}${tone ? ` filter-chip--${tone}` : ''}`} aria-pressed={on} onClick={onClick} title={title}>
      {children}
      {count !== undefined && count > 0 && <span className="filter-chip__count">{count}</span>}
    </button>
  );
}

/** Urgency section of the "Cần trả lời" queue (plan §3 rule 3: over SLA → about to be over → waiting). */
type Section = 'over' | 'warn' | 'wait';
const SECTION_LABELS: Record<Section, string> = { over: 'Quá SLA', warn: 'Sắp quá hạn', wait: 'Đang chờ trả lời' };

export default function ConversationList({ accountUid, selectedId, onSelect, accountLabel, showAccountTag, onItems, onAccountChange, resizable }: Props) {
  const accounts = useAccounts();
  const [width, setWidth] = useState(readWidth);
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    let last = startW;
    const move = (ev: PointerEvent) => {
      last = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + ev.clientX - startX));
      setWidth(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('is-resizing');
      try {
        localStorage.setItem(WIDTH_KEY, String(last));
      } catch {
        // Storage unavailable: width just won't persist.
      }
    };
    document.body.classList.add('is-resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  // Channel filter, only meaningful when all accounts are listed together.
  const [channel, setChannel] = useState<Channel | undefined>();
  const channelFilter = accountUid ? undefined : channel;
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Inbox (M1b-09): scope "Của tôi / Chưa phân công / Tất cả" and the filters of MH-SZ-01.
  const [scope, setScope] = useState<InboxScope>('mine');
  const scopeTouched = useRef(false);
  // "Cần trả lời" is the work queue (the old "Chưa trả lời" filter), "Tất cả" the Zalo-like list.
  const [view, setViewState] = useState<ListView>(readView);
  const setView = (v: ListView) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore
    }
  };
  const unanswered = view === 'todo';
  const [overSla, setOverSla] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  // M1c-02: "Nợ quá hạn" (03 MH-SZ-01 #8a, #9o): flags only, for people with cust.debt.
  const [overdueOnly, setOverdueOnly] = useState(false);
  const debt = useQuery({ queryKey: ['overdue-debt'], queryFn: () => api<{ ids: string[] }>('/conversations/overdue-debt'), refetchInterval: 60_000, retry: false });
  const overdueIds = useMemo(() => new Set(debt.data?.ids ?? []), [debt.data]);
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [labelId, setLabelId] = useState<string | undefined>();
  // VClinks labels (conversation-work), not Zalo's "Thẻ phân loại".
  const [vcLabelId, setVcLabelId] = useState<string | undefined>();
  const vcCatalog = useLabelCatalog();
  const summary = useQuery({ queryKey: ['inbox-summary'], queryFn: () => api<InboxSummary>('/conversations/inbox'), refetchInterval: REFRESH_MS, retry: false });
  const scopes = summary.data?.scopes ?? ['mine', 'unassigned', 'all'];
  const supervisor = scopes.includes('all');

  // Opening on an empty "Của tôi" while others have work reads as "nothing synced": start on the wider
  // scope once, until the user picks a scope themselves.
  useEffect(() => {
    const s = summary.data;
    if (!s || scopeTouched.current) return;
    scopeTouched.current = true;
    if (s.counts.mine > 0) return;
    if (s.scopes.includes('all') && s.counts.all > 0) setScope('all');
    else if (s.scopes.includes('unassigned') && s.counts.unassigned > 0) setScope('unassigned');
  }, [summary.data]);

  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const perms = usePermissions();
  /** SZ-23: marking read on a nick the user does not hold (nor cover) asks first. */
  const markRead = (c: ChatConversation) => {
    const run = () => runCommand(c, { action: 'mark_read' }, 'Đã gửi lệnh đánh dấu đã đọc');
    if (perms.me?.legacy || perms.me?.heldChannels.includes(c.uid)) return void run();
    modal.confirm({
      title: 'Đánh dấu đã đọc?',
      content: 'Khách sẽ thấy "Đã xem" và người giữ nick sẽ mất badge chưa đọc. Vẫn đánh dấu?',
      okText: 'Vẫn đánh dấu',
      cancelText: 'Hủy',
      onOk: run,
    });
  };

  /** Zalo's conversation menu, as commands the extension performs (personal Zalo only). */
  const runCommand = async (c: ChatConversation, body: { action: string; pin?: boolean }, done: string) => {
    try {
      await api('/outbox', { method: 'POST', body: { uid: c.uid, threadId: c.threadId, ...body } });
      message.success(done);
      // The extension performs the command within a few seconds; the API mirrors the new state on success.
      for (const ms of [0, 3000, 7000, 12000]) setTimeout(() => void qc.invalidateQueries({ queryKey: ['conversations'] }), ms);
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  const menuFor = (c: ChatConversation) =>
    c.channel === 'zalo'
      ? [
          c.pinned
            ? { key: 'unpin', icon: <PushpinOutlined />, label: 'Bỏ ghim hội thoại', onClick: () => runCommand(c, { action: 'pin_conversation', pin: false }, 'Đã gửi lệnh bỏ ghim') }
            : { key: 'pin', icon: <PushpinFilled />, label: 'Ghim hội thoại', onClick: () => runCommand(c, { action: 'pin_conversation', pin: true }, 'Đã gửi lệnh ghim') },
          (c.unread ?? 0) > 0
            ? { key: 'read', icon: <CheckOutlined />, label: 'Đánh dấu đã đọc', onClick: () => markRead(c) }
            : { key: 'unread', icon: <MailOutlined />, label: 'Đánh dấu chưa đọc', onClick: () => runCommand(c, { action: 'mark_unread' }, 'Đã gửi lệnh đánh dấu chưa đọc') },
        ]
      : [];
  const sentinel = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  // Re-render every minute so relative times ("5 phút") stay fresh.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const list = useInfiniteQuery({
    queryKey: ['conversations', accountUid, channelFilter, q, unreadOnly, scope, view, overSla, pinnedOnly, ownerId, labelId, vcLabelId, overdueOnly],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Paged<ChatConversation>>('/conversations', {
        query: {
          uid: accountUid,
          channel: channelFilter,
          q: q || undefined,
          unread: unreadOnly ? 1 : undefined,
          scope,
          unanswered: unanswered ? 1 : undefined,
          state: view === 'waiting' || view === 'done' ? view : undefined,
          overSla: overSla ? 1 : undefined,
          pinned: pinnedOnly ? 1 : undefined,
          overdueDebt: overdueOnly ? 1 : undefined,
          ownerId,
          labelId,
          vcLabelId,
          page: pageParam,
          pageSize: PAGE_SIZE,
        },
      }),
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length + 1 : undefined),
    refetchInterval: REFRESH_MS,
  });

  const items = useMemo(() => {
    // Pages can overlap after a refresh reorders the list; keep the first occurrence.
    const seen = new Set<string>();
    return (list.data?.pages ?? []).flatMap((p) => p.items).filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  }, [list.data]);

  // Labels (thẻ) seen so far, for the label filter.
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    setLabels((prev) => {
      const next = new Map(prev);
      for (const c of items) if (c.label?.id) next.set(c.label.id, c.label.name);
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  // "Cần trả lời": the API returns longest-waiting first; split the loaded rows by urgency (over → warn → wait).
  const rows = useMemo(() => {
    if (!unanswered) return items.map((c) => ({ c, section: null as Section | null }));
    const at = Date.now();
    const sectionOf = (c: ChatConversation): Section => slaShortText(c.sla, at)?.level ?? 'wait';
    return (['over', 'warn', 'wait'] as Section[]).flatMap((s) => items.filter((c) => sectionOf(c) === s).map((c) => ({ c, section: s as Section | null })));
  }, [items, unanswered]);

  // One row per customer (plan B2): the first (most urgent / newest) conversation stands for the customer, the
  // others of the same profile ride along. A display only (BR-M3): each conversation keeps its nick and history.
  const [groupByCustomer, setGroupState] = useState(readGroup);
  const setGroupByCustomer = (on: boolean) => {
    setGroupState(on);
    try {
      localStorage.setItem(GROUP_KEY, on ? '1' : '0');
    } catch {
      // ignore
    }
  };
  const listRows = useMemo(() => {
    const out: { c: ChatConversation; section: Section | null; others: ChatConversation[] }[] = [];
    const byCustomer = new Map<string, (typeof out)[number]>();
    for (const r of rows) {
      const id = groupByCustomer ? r.c.customerId : null;
      const g = id ? byCustomer.get(id) : undefined;
      if (g) {
        g.others.push(r.c);
        continue;
      }
      const row = { ...r, others: [] as ChatConversation[] };
      if (id) byCustomer.set(id, row);
      out.push(row);
    }
    return out;
  }, [rows, groupByCustomer]);

  // The page gets every loaded conversation in display order (header reuse, J / K navigation).
  useEffect(() => {
    onItems?.(listRows.flatMap((r) => [r.c, ...r.others]));
  }, [listRows, onItems]);

  // Load the next page when the bottom sentinel scrolls into view.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scopeValue = scopes.includes(scope) ? scope : 'mine';
  const scopeLabel = (s: InboxScope) => `${INBOX_SCOPE_LABELS[s]}${summary.data ? ` · ${summary.data.counts[s]}` : ''}`;
  // Channel chips only for channels that have a connected account.
  const presentChannels = CHANNELS.filter((c) => accounts.data?.some((a) => a.channel === c));
  const extraOn = [overSla, unreadOnly, pinnedOnly, overdueOnly, !!labelId, !!vcLabelId, !!ownerId].filter(Boolean).length;
  const clearExtra = () => {
    setOverSla(false);
    setUnreadOnly(false);
    setPinnedOnly(false);
    setOverdueOnly(false);
    setLabelId(undefined);
    setVcLabelId(undefined);
    setOwnerId(undefined);
  };
  // "Nhận" on a row of "Chưa phân công" (00 MH-UI-10 #10): the first click wins.
  const claim = useMutation({
    mutationFn: (c: ChatConversation) => api(`/conversations/${encodeURIComponent(c.id)}/claim`, { method: 'POST', body: {} }),
    onSuccess: (_, c) => {
      message.success(`Đã nhận hội thoại ${c.name ?? ''}.`);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      void qc.invalidateQueries({ queryKey: ['inbox-summary'] });
    },
    onError: (e) => {
      message.error((e as Error).message);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const canClaim = perms.has('conv.claim');

  const now = Date.now();
  const sectionCount = (s: Section) => listRows.filter((r) => r.section === s).length;
  const showSections = unanswered && new Set(listRows.map((r) => r.section)).size > 1;

  const moreFilters = (
    <div className="filter-pop">
      <div className="filter-pop__chips">
        {supervisor && (
          <FilterChip tone="danger" on={overSla} onClick={() => setOverSla((v) => !v)} count={summary.data?.overSla}>
            Quá SLA
          </FilterChip>
        )}
        <FilterChip on={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>
          Chưa đọc
        </FilterChip>
        <FilterChip on={pinnedOnly} onClick={() => setPinnedOnly((v) => !v)}>
          <PushpinFilled /> Đã ghim
        </FilterChip>
        {(overdueIds.size > 0 || overdueOnly) && (
          <FilterChip tone="danger" on={overdueOnly} onClick={() => setOverdueOnly((v) => !v)}>
            Nợ quá hạn
          </FilterChip>
        )}
      </div>
      {labels.size > 0 && (
        <Select
          allowClear
          placeholder="Thẻ phân loại"
          value={labelId}
          onChange={setLabelId}
          options={[...labels].map(([value, label]) => ({ value, label }))}
          style={{ width: '100%' }}
          aria-label="Lọc theo thẻ"
        />
      )}
      {(vcCatalog.data?.length ?? 0) > 0 && (
        <Select
          allowClear
          placeholder="Nhãn VClinks"
          value={vcLabelId}
          onChange={setVcLabelId}
          options={(vcCatalog.data ?? []).map((l) => ({ value: l.id, label: l.name }))}
          style={{ width: '100%' }}
          aria-label="Lọc theo nhãn VClinks"
        />
      )}
      {supervisor && !!summary.data?.byOwner.length && (
        <Select
          allowClear
          placeholder="Người phụ trách"
          value={ownerId}
          onChange={setOwnerId}
          options={summary.data.byOwner.filter((o) => o.userId).map((o) => ({ value: o.userId!, label: `${o.name ?? o.userId} (${o.count})` }))}
          style={{ width: '100%' }}
          aria-label="Lọc theo người phụ trách"
        />
      )}
      <label className="filter-pop__switch">
        <Switch size="small" checked={groupByCustomer} onChange={setGroupByCustomer} />
        Gom hội thoại cùng một khách
      </label>
      {extraOn > 0 && (
        <Button type="link" size="small" style={{ padding: 0, alignSelf: 'flex-start' }} onClick={clearExtra}>
          Bỏ lọc
        </Button>
      )}
    </div>
  );

  return (
    <div className="conv-list" style={resizable ? { width } : undefined}>
      {resizable && (
        <div
          className="conv-list__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để đổi độ rộng danh sách"
          title="Kéo để đổi độ rộng (bấm đúp: về mặc định)"
          onPointerDown={startResize}
          onDoubleClick={() => {
            setWidth(DEFAULT_WIDTH);
            try {
              localStorage.removeItem(WIDTH_KEY);
            } catch {
              // ignore
            }
          }}
        />
      )}
      <div className="conv-list__head">
        <h1 className="conv-list__title">Hộp thư</h1>
        {scopes.length > 1 ? (
          <Select<InboxScope>
            className="conv-list__scope-select"
            variant="borderless"
            value={scopeValue}
            onChange={(v) => {
              scopeTouched.current = true;
              setScope(v);
            }}
            popupMatchSelectWidth={false}
            aria-label="Phạm vi hộp thư"
            options={scopes.map((s) => ({ value: s, label: scopeLabel(s) }))}
          />
        ) : (
          <span className="conv-list__scope">{scopeLabel(scopeValue)}</span>
        )}
      </div>
      <div className="conv-list__search">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
          placeholder="Tìm tên, số điện thoại"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Tìm hội thoại"
        />
        {onAccountChange && ((accounts.data?.length ?? 0) > 1 || accountUid) && (
          <Select
            className="conv-list__nick"
            value={accountUid ?? ALL_NICKS}
            onChange={(v) => onAccountChange(v === ALL_NICKS ? undefined : v)}
            aria-label="Lọc theo nick"
            popupMatchSelectWidth={false}
            options={[
              { value: ALL_NICKS, label: 'Mọi nick' },
              ...(accounts.data ?? []).map((a) => ({
                value: a.uid,
                label: (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <ChannelBadge channel={a.channel} compact />
                    {nickName(a.label, a.ownerName)}
                  </span>
                ),
              })),
            ]}
          />
        )}
        <Popover content={moreFilters} trigger="click" placement="bottomRight" title="Lọc thêm" arrow={false}>
          <Button icon={<FilterOutlined />} className={`conv-list__more${extraOn ? ' is-on' : ''}`} aria-label={extraOn ? `Lọc thêm, đang bật ${extraOn}` : 'Lọc thêm'} title="Lọc thêm">
            {extraOn ? extraOn : null}
          </Button>
        </Popover>
      </div>
      <div className="conv-tabs" role="tablist" aria-label="Hàng việc">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" role="tab" aria-selected={view === v.key} className="conv-tabs__tab" onClick={() => setView(v.key)}>
            {v.label}
            {v.key === 'todo' && !!summary.data?.unanswered && <span className="conv-tabs__count">{summary.data.unanswered}</span>}
          </button>
        ))}
      </div>
      {!accountUid && presentChannels.length > 1 && (
        <div className="conv-list__filters">
          <div className="channel-filter" role="group" aria-label="Lọc theo kênh">
            {presentChannels.map((c) => {
              const pressed = !channel || channel === c;
              return (
                <button
                  key={c}
                  type="button"
                  className={`channel-filter__btn${pressed ? '' : ' is-off'}`}
                  aria-pressed={channel === c}
                  title={channel === c ? `Bỏ lọc ${CHANNEL_INFO[c].label}` : `Chỉ xem ${CHANNEL_INFO[c].label}`}
                  onClick={() => setChannel(channel === c ? undefined : c)}
                >
                  <ChannelBadge channel={c} compact />
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="conv-list__scroll" role="list">
        {list.isError && (
          <Alert style={{ margin: 12 }} type="error" showIcon message="Không tải được hội thoại" description={(list.error as Error).message} />
        )}
        {list.isLoading && <Spin style={{ display: 'block', margin: '32px auto' }} />}
        {listRows.map(({ c, section, others }, i) => {
          const name = c.name || c.threadId;
          const all = [c, ...others];
          const unread = all.reduce((n, x) => n + (x.unread ?? 0), 0);
          const active = all.some((x) => x.id === selectedId);
          // One badge per channel the customer uses here (two Zalo nicks show one "Za" and "2 hội thoại").
          const channels = [...new Set(all.map((x) => x.channel).filter((x): x is NonNullable<typeof x> => !!x))].slice(0, 2);
          const header = showSections && section && section !== listRows[i - 1]?.section ? section : null;
          const owner = scope !== 'mine' && c.ownerName ? `${c.ownerName} xử lý` : null;
          const closed = c.done ? `Xong${c.done.outcome ? ` · ${CONVERSATION_OUTCOME_LABELS[c.done.outcome]}` : ''}` : null;
          const nick = showAccountTag && accountLabel ? accountLabel(c.uid) : null;
          const many = others.length ? `${all.length} hội thoại` : null;
          const sla = slaShortText(c.sla, now);
          return (
            <div key={c.id} role="none">
              {header && (
                <div className={`conv-section conv-section--${header}`} role="presentation">
                  {SECTION_LABELS[header]} · {sectionCount(header)}
                </div>
              )}
              <Dropdown menu={{ items: menuFor(c) }} trigger={['contextMenu']} disabled={c.channel !== 'zalo'}>
                <div
                  role="listitem"
                  tabIndex={0}
                  aria-current={active ? 'true' : undefined}
                  className={`conv-item${active ? ' active' : ''}${unread > 0 ? ' unread' : ''}`}
                  title={others.length ? `Khách này có ${all.length} hội thoại (nhiều nick / kênh). Mở để chuyển giữa các kênh.` : undefined}
                  onClick={() => !active && onSelect(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(c);
                    }
                  }}
                >
                  <div className="conv-item__avatar">
                    <ChatAvatar name={c.name} src={c.avatar} colorKey={c.threadId} group={c.type === 'group'} size={42} />
                    {channels.length > 0 && (
                      <span className="conv-item__channel">
                        {channels.map((ch) => (
                          <ChannelBadge key={ch} channel={ch} compact />
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="conv-item__body">
                    <div className="conv-item__top">
                      <div className="conv-item__name" title={name}>
                        {c.type === 'group' && <TeamOutlined className="conv-item__group-icon" aria-label="Nhóm" />}
                        <span>{name}</span>
                      </div>
                      {sla ? (
                        <SlaChip chip={c.sla} />
                      ) : (
                        <span className="conv-item__time">
                          {c.pinned && <PushpinFilled className="conv-item__pin" aria-label="Đã ghim" />}
                          {relativeListTime(c.lastMsgAt)}
                        </span>
                      )}
                    </div>
                    <div className="conv-item__bottom">
                      <div className="conv-item__preview">{conversationPreview(c)}</div>
                      {unread > 0 && (
                        <span className="unread-badge" aria-label={`${unread} tin chưa đọc`}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                    {(owner || nick || closed || many || c.label || overdueIds.has(c.id) || (sla && c.pinned) || c.vcLabels?.length || (c.assignable && !c.ownerId)) && (
                      <div className="conv-item__meta">
                        {c.assignable && !c.ownerId && <span className="soft-chip soft-chip--warn">Chưa phân công</span>}
                        {c.assignable && !c.ownerId && canClaim && (
                          <Button
                            size="small"
                            type="primary"
                            className="conv-item__claim"
                            loading={claim.isPending && claim.variables?.id === c.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              claim.mutate(c);
                            }}
                          >
                            Nhận
                          </Button>
                        )}
                        <LabelChips labels={c.vcLabels} />
                        {overdueIds.has(c.id) && (
                          <span className="soft-chip soft-chip--danger" title="Khách có công nợ quá hạn trên VCsales">
                            Nợ quá hạn
                          </span>
                        )}
                        {c.label && (
                          <span className="conv-item__label" title={`Thẻ phân loại: ${c.label.name}`} style={c.label.color ? { color: c.label.color } : undefined}>
                            <TagFilled />
                            <span className="conv-item__label-name">{c.label.name}</span>
                          </span>
                        )}
                        {closed && <span className="soft-chip soft-chip--ok">{closed}</span>}
                        {sla && c.pinned && <PushpinFilled className="conv-item__pin" aria-label="Đã ghim" />}
                        <span className="conv-item__meta-text">{[many, owner, nick, sla ? relativeListTime(c.lastMsgAt) : null].filter(Boolean).join(' · ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Dropdown>
            </div>
          );
        })}
        {!list.isLoading && !list.isError && !items.length && (
          <div className="conv-list__empty">
            {q ? 'Không tìm thấy hội thoại' : extraOn ? 'Không có hội thoại khớp bộ lọc' : EMPTY_TEXT[view]}
            {(extraOn > 0 || view !== 'all') && (
              <Button type="link" size="small" onClick={() => (extraOn ? clearExtra() : setView('all'))}>
                {extraOn ? 'Bỏ lọc' : 'Xem tất cả hội thoại'}
              </Button>
            )}
          </div>
        )}
        <div ref={sentinel} className="conv-list__footer">
          {isFetchingNextPage ? <Spin size="small" /> : null}
        </div>
      </div>
    </div>
  );
}
