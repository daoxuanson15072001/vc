import type { ColumnsType } from 'antd/es/table';
import { App, Button, Card, Descriptions, Table, Tag, Typography } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CHANNEL_INFO, channelOfUid, type AccountStatus, type StreamStatus, type SyncRequestView } from '@vclinks/shared';
import { api } from '../api';
import { fmtTime } from '../time';
import { STREAM_LABEL, STREAM_ORDER } from '../labels';
import { nickName } from '../utils/nick';
import { HealthDot, healthText, useAccountHealth } from './AccountHealth';

function DiffTag({ s }: { s: StreamStatus }) {
  if (s.sourceCount === null) return <Tag>Chưa có số liệu</Tag>;
  const diff = s.sourceCount - s.dbCount;
  if (diff === 0) return <Tag color="green">Khớp</Tag>;
  // Positive = records still missing in MongoDB; negative = MongoDB has more than IndexedDB.
  return <Tag color="orange">Lệch {diff.toLocaleString('vi-VN')}</Tag>;
}

const num = (n: number | null) => (n === null ? '—' : n.toLocaleString('vi-VN'));

export default function AccountSyncCard({ account, compact = false }: { account: AccountStatus; compact?: boolean }) {
  const health = useAccountHealth(account.uid);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const rename = useMutation({
    mutationFn: (label: string) => api<{ ok: true }>(`/accounts/${encodeURIComponent(account.uid)}`, { method: 'PATCH', body: { label } }),
    onSuccess: () => {
      message.success('Đã đổi tên tài khoản');
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e) => message.error(`Không đổi được tên: ${(e as Error).message}`),
  });

  // "Đồng bộ ngay" (M1a-06): only extension channels have an IndexedDB sync to trigger.
  const canSyncNow = CHANNEL_INFO[channelOfUid(account.uid)].sendMode === 'extension';
  const syncReq = useQuery({
    queryKey: ['sync-request', account.uid],
    queryFn: () => api<{ request: SyncRequestView | null }>(`/sync/requests/${encodeURIComponent(account.uid)}`),
    enabled: canSyncNow,
    // Poll while the extension has not picked the request up yet.
    refetchInterval: (q) => (q.state.data?.request?.status === 'pending' ? 5_000 : false),
  });
  const syncNow = useMutation({
    mutationFn: () => api<SyncRequestView>('/sync/requests', { method: 'POST', body: { uid: account.uid } }),
    onSuccess: () => {
      message.success('Đã gửi lệnh đồng bộ tới tiện ích VClinks của nick này; tiện ích nhận lệnh trong khoảng 20 giây');
      qc.invalidateQueries({ queryKey: ['sync-request', account.uid] });
    },
    onError: (e) => message.error(`Không gửi được lệnh đồng bộ: ${(e as Error).message}`),
  });
  const req = syncReq.data?.request;
  const reqText = !req
    ? null
    : req.status === 'pending'
      ? `Đang chờ tiện ích nhận lệnh (gửi lúc ${fmtTime(req.requestedAt, 'HH:mm:ss')})`
      : `Tiện ích đã nhận lệnh lúc ${fmtTime(req.claimedAt ?? null, 'HH:mm:ss')}`;

  // Sale view (MH-SZ-12b): only stream, difference and last receive time.
  const SALE_COLUMNS = ['stream', 'diff', 'lastIngestAt'];
  const allColumns: ColumnsType<StreamStatus> = [
          
{ title: 'Luồng', dataIndex: 'stream', render: (s: StreamStatus['stream']) => STREAM_LABEL[s] ?? s },
          {
            title: 'IndexedDB',
            dataIndex: 'sourceCount',
            align: 'right',
            render: (v: number | null, s) => <span title={s.sourceCountAt ? `Báo lúc ${fmtTime(s.sourceCountAt)}` : undefined}>{num(v)}</span>,
          },
          { title: 'MongoDB', dataIndex: 'dbCount', align: 'right', render: num },
          { title: 'Chênh lệch', key: 'diff', render: (_, s) => <DiffTag s={s} /> },
          { title: 'Mốc đồng bộ', dataIndex: 'cursor', render: (v: number | null) => fmtTime(v, 'DD/MM/YYYY HH:mm:ss') },
          { title: 'Nhận dữ liệu lần cuối', dataIndex: 'lastIngestAt', render: (v: string | null) => fmtTime(v) }
  ];
  const columns = allColumns.filter((c) => !compact || SALE_COLUMNS.includes(String(c.key ?? (c as { dataIndex?: string }).dataIndex)));

  const streams = [...account.streams].sort((a, b) => STREAM_ORDER.indexOf(a.stream) - STREAM_ORDER.indexOf(b.stream));

  return (
    <Card
      size="small"
      title={
        <Typography.Text
          strong
          editable={compact ? false : {
            tooltip: 'Đổi tên',
            onChange: (v) => {
              const label = v.trim();
              if (label && label !== account.label) rename.mutate(label);
            },
          }}
        >
          {nickName(account.label, account.ownerName)}
        </Typography.Text>
      }
      extra={
        <>
          {health && (
            <Tag icon={<HealthDot level={health.level} />} style={{ marginRight: 8 }}>
              {' '}
              {healthText(health)}
            </Tag>
          )}
          {!compact && account.openDrifts > 0 ? <Tag color="red">{account.openDrifts} drift đang mở</Tag> : null}
          {canSyncNow && (
            <Button
              size="small"
              icon={<SyncOutlined spin={req?.status === 'pending'} />}
              loading={syncNow.isPending}
              onClick={() => syncNow.mutate()}
              title="Yêu cầu tiện ích VClinks trên Zalo Web của nick này đọc lại dữ liệu ngay, không chờ lượt tự động"
            >
              Đồng bộ ngay
            </Button>
          )}
        </>
      }
    >
      <Descriptions size="small" column={{ xs: 1, md: 3 }} style={{ marginBottom: 8 }}>
        {!compact && (
          <Descriptions.Item label="UID">
            <Typography.Text copyable>{account.uid}</Typography.Text>
          </Descriptions.Item>
        )}
        {!compact && account.ownerName && <Descriptions.Item label="Chủ tài khoản">{account.ownerName}</Descriptions.Item>}
        <Descriptions.Item label="Đồng bộ gần nhất">{fmtTime(account.lastSyncAt)}</Descriptions.Item>
        {reqText && <Descriptions.Item label="Lệnh Đồng bộ ngay">{reqText}</Descriptions.Item>}
      </Descriptions>
      <Table<StreamStatus>
        size="small"
        rowKey="stream"
        pagination={false}
        dataSource={streams}
        scroll={{ x: 'max-content' }}
        columns={columns}      />
    </Card>
  );
}
