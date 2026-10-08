import { useEffect, useMemo, useState } from 'react';
import { Alert, Empty, Segmented, Select, Skeleton, Space, Tag } from 'antd';
import type { OutboxStatus } from '../../types';
import { nickName } from '../../utils/nick';
import { useAccounts } from '../AccountSelect';
import OutboxCard from './OutboxCard';
import { useMe, useOutboxCounts, useOutboxList } from './queue';

type Filter = 'approved' | 'sending' | 'failed' | 'expired' | 'awaiting_confirm' | 'needs_reapproval' | 'sent' | 'on_behalf';

interface Props {
  /** Pre-filter on one conversation (drawer opened from the chat header, MH-SZ-13 #2). */
  thread?: { uid: string; threadId: string; name?: string };
  onClearThread?: () => void;
}

/**
 * MH-SZ-13 body: scope, conversation tag, status chips with counts, command
 * cards. Scope is "Của tôi" only until roles exist (M1b-04 adds "Tổ của tôi").
 */
export default function OutboxList({ thread, onClearThread }: Props) {
  const me = useMe();
  const accounts = useAccounts();
  const counts = useOutboxCounts(thread ? { uid: thread.uid, threadId: thread.threadId } : {});
  const c = counts.data;
  const [filter, setFilter] = useState<Filter | null>(null);

  // Default chip: Lỗi when there are failures, otherwise Đang chờ (MH-SZ-13 #3).
  useEffect(() => {
    if (filter || !c) return;
    setFilter(c.needs_reapproval ? 'needs_reapproval' : c.failed ? 'failed' : c.awaiting_confirm ? 'awaiting_confirm' : c.expired ? 'expired' : 'approved');
  }, [c, filter]);

  const active: Filter = filter ?? 'approved';
  const statuses: OutboxStatus[] = active === 'on_behalf' ? ['approved', 'sending', 'sent', 'failed', 'expired', 'awaiting_confirm', 'needs_reapproval'] : [active];
  const list = useOutboxList({ statuses, uid: thread?.uid, threadId: thread?.threadId, onBehalf: active === 'on_behalf' }, !!filter);
  // "Đã gửi hôm nay": the list endpoint has no date filter; keep today's items only.
  const items = useMemo(() => {
    const all = list.data ?? [];
    if (active !== 'sent') return all;
    const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    return all.filter((x) => x.sentAt && new Date(x.sentAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) === today);
  }, [list.data, active]);

  const label = (uid: string) => {
    const a = accounts.data?.find((x) => x.uid === uid);
    return a ? nickName(a.label, a.ownerName) : undefined;
  };

  const options = [
    { value: 'approved', label: `Đang chờ ${c?.approved ?? 0}` },
    { value: 'sending', label: `Đang gửi ${c?.sending ?? 0}` },
    { value: 'failed', label: `Lỗi ${c?.failed ?? 0}` },
    { value: 'expired', label: `Quá hạn ${c?.expired ?? 0}` },
    // Shown only when there is something in it (MH-SZ-13 #3a).
    ...(c?.awaiting_confirm || active === 'awaiting_confirm' ? [{ value: 'awaiting_confirm', label: `Chờ xác nhận gửi ${c?.awaiting_confirm ?? 0}` }] : []),
    ...(c?.needs_reapproval || active === 'needs_reapproval' ? [{ value: 'needs_reapproval', label: `Cần duyệt lại ${c?.needs_reapproval ?? 0}` }] : []),
    { value: 'sent', label: `Đã gửi hôm nay ${c?.sentToday ?? 0}` },
    // QT-SZ-10 #5: what others sent on my nicks (trả lời thay + trực thay), 30 days.
    { value: 'on_behalf', label: 'Người khác gửi trên nick tôi' },
  ];

  return (
    <div className="outbox-list">
      <Space wrap style={{ marginBottom: 8 }}>
        <Select value="mine" options={[{ value: 'mine', label: 'Của tôi' }]} style={{ width: 120 }} />
        {thread && (
          <Tag closable={!!onClearThread} onClose={onClearThread}>
            Hội thoại: {thread.name || thread.threadId}
          </Tag>
        )}
      </Space>
      <Segmented block={false} value={active} onChange={(v) => setFilter(v as Filter)} options={options} style={{ marginBottom: 12, flexWrap: 'wrap' }} />
      {list.isError && <Alert type="error" showIcon message={`Không tải được hàng đợi gửi: ${(list.error as Error).message}`} />}
      {list.isLoading || !filter ? (
        <Skeleton active />
      ) : items.length === 0 ? (
        <Empty description="Không có lệnh nào." />
      ) : (
        items.map((it) => <OutboxCard key={it.id} item={it} me={me.data?.userId ?? me.data?.name} nickLabel={label(it.uid)} inThread={!!thread} />)
      )}
    </div>
  );
}
