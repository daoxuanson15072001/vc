import { useMemo, useState } from 'react';
import { App, Badge, Button, Empty, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  WORKITEM_KIND_LABELS,
  WORKITEM_QUEUE_LABELS,
  WORKITEM_QUEUES,
  WORKITEM_STATUS_LABELS,
  formatVnd,
  type WorkitemQueue,
  type WorkitemSummary,
} from '@vclinks/shared';
import { usePermissions } from '../state/permissions';
import WorkitemDrawer, { STATUS_COLOR } from '../components/workitems/WorkitemDrawer';
import { useSetQueue, useWorkitemCounts, useWorkitemQueues, useWorkitems } from '../components/workitems/workitemApi';

/**
 * Khay "Chờ tôi duyệt" (03 MH-SZ-15, route /approvals) and hàng việc Bán hàng / Hậu mãi (04 MH-OA-20, /workitems).
 * Built from the spec text and the existing screens; the MH-SZ-15 design (E6, lô TK2) is not delivered yet.
 */
export default function WorkitemsPage() {
  const perms = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openId = params.get('id');
  const canApprove = perms.has(['workitem.approve', 'workitem.return']);
  const canQueue = perms.has(['workitem.submit', 'ticket.view']);
  const canConfig = perms.has('workitem.queue_config');
  const defaultTab = location.pathname.startsWith('/approvals') || !canQueue ? 'approvals' : 'ban_hang';
  const [tab, setTab] = useState<string>(defaultTab);
  const counts = useWorkitemCounts();
  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('id', id);
    else p.delete('id');
    setParams(p, { replace: true });
  };
  const items = [
    ...(canApprove
      ? [{ key: 'approvals', label: <Badge count={counts.data?.approvals ?? 0} size="small" color={counts.data?.approvalsOverdue ? 'red' : 'blue'} offset={[8, -2]}>Chờ tôi duyệt</Badge>, children: <List view="approvals" onOpen={setOpen} empty="Không có phiếu nào chờ bạn duyệt." /> }]
      : []),
    ...(canQueue
      ? WORKITEM_QUEUES.map((q) => ({ key: q, label: `${WORKITEM_QUEUE_LABELS[q]} (${counts.data?.queue[q] ?? 0})`, children: <List view="queue" queue={q} onOpen={setOpen} empty="Hàng việc trống." /> }))
      : []),
    ...(canConfig ? [{ key: 'config', label: 'Cấu hình hàng việc', children: <QueueConfig /> }] : []),
  ];
  return (
    <div className="page">
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Phiếu CSKH
      </Typography.Title>
      <Tabs
        activeKey={items.some((i) => i.key === tab) ? tab : items[0]?.key}
        onChange={(k) => {
          setTab(k);
          if (k === 'approvals' && !location.pathname.startsWith('/approvals')) navigate('/approvals');
        }}
        items={items}
      />
      <WorkitemDrawer id={openId} onClose={() => setOpen(null)} />
    </div>
  );
}

function List({ view, queue, onOpen, empty }: { view: 'approvals' | 'queue'; queue?: WorkitemQueue; onOpen: (id: string) => void; empty: string }) {
  const list = useWorkitems(view, { queue });
  return (
    <Table<WorkitemSummary>
      rowKey="id"
      size="small"
      loading={list.isLoading}
      dataSource={list.data ?? []}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={list.error ? (list.error as Error).message : empty} /> }}
      onRow={(r) => ({ onClick: () => onOpen(r.id), style: { cursor: 'pointer' } })}
      pagination={{ pageSize: 30, hideOnSinglePage: true }}
      columns={[
        { title: 'Khách', dataIndex: 'conversationName', render: (v: string | null) => v ?? '—' },
        { title: 'Phiếu', render: (_, r) => `${WORKITEM_KIND_LABELS[r.kind]} ${r.code}${r.quoteNo ? ` · ${r.quoteNo}` : ''}` },
        { title: 'Tổng tiền', dataIndex: 'quoteTotal', render: (v: number | null) => (v != null ? formatVnd(v) : '') },
        { title: 'Trạng thái', dataIndex: 'status', render: (s: WorkitemSummary['status']) => <Tag color={STATUS_COLOR[s]}>{WORKITEM_STATUS_LABELS[s]}</Tag> },
        { title: view === 'approvals' ? 'CSKH soạn' : 'CSKH', dataIndex: 'assigneeName', render: (v: string | null) => v ?? 'Chưa giao' },
        {
          title: 'Chờ',
          render: (_, r) =>
            r.waitingMinutes != null ? (
              <span style={{ color: r.escalated ? 'var(--danger, #cf1322)' : undefined }}>
                {`${r.waitingMinutes}′`}
                {r.escalated ? ' ⚠' : ''}
              </span>
            ) : (
              '–'
            ),
        },
        { title: 'Trả lại', render: (_, r) => (r.returnCount ? `${r.returnCount}/${r.maxReturns}` : '') },
      ]}
    />
  );
}

/** workitem.queue_config (GĐ duyệt / soạn): who is in "Bán hàng" / "Hậu mãi" of the division (D9-01). */
function QueueConfig() {
  const { message } = App.useApp();
  const q = useWorkitemQueues();
  const save = useSetQueue();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const rows = useMemo(() => q.data ?? [], [q.data]);
  if (!rows.length) return <Empty description={q.error ? (q.error as Error).message : 'Không có division nào để cấu hình.'} />;
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {rows.map((r) => {
        const key = `${r.divisionId}:${r.queue}`;
        return (
          <div key={key}>
            <Typography.Text strong>{`${r.divisionId} · ${WORKITEM_QUEUE_LABELS[r.queue]}`}</Typography.Text>
            <div style={{ color: 'var(--muted)' }}>{r.members.length ? r.members.map((m) => m.name ?? m.userId).join(', ') : 'Chưa có ai'}</div>
            <Space style={{ marginTop: 4 }}>
              <Select
                mode="tags"
                style={{ minWidth: 360 }}
                placeholder="Mã người dùng CSKH"
                value={draft[key] !== undefined ? draft[key].split(',').filter(Boolean) : r.members.map((m) => m.userId)}
                onChange={(v: string[]) => setDraft((d) => ({ ...d, [key]: v.join(',') }))}
              />
              <Button
                onClick={async () => {
                  try {
                    await save.mutateAsync({ divisionId: r.divisionId, queue: r.queue, members: (draft[key] ?? r.members.map((m) => m.userId).join(',')).split(',').filter(Boolean) });
                    message.success('Đã lưu hàng việc');
                  } catch (e) {
                    message.error((e as Error).message);
                  }
                }}
              >
                Lưu
              </Button>
            </Space>
          </div>
        );
      })}
    </Space>
  );
}
