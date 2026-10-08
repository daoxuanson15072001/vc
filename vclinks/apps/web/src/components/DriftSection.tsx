import { App, Button, Card, Space, Table, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DriftRecord } from '@vclinks/shared';
import { api } from '../api';
import { fmtTime } from '../time';
import { DRIFT_KIND, STREAM_LABEL } from '../labels';

const tags = (xs: string[], color?: string) =>
  xs.length ? (
    <Space size={[0, 4]} wrap>
      {xs.map((x) => (
        <Tag key={x} color={color}>
          {x}
        </Tag>
      ))}
    </Space>
  ) : (
    '—'
  );

export default function DriftSection({ refetchInterval }: { refetchInterval: number }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const drifts = useQuery({
    queryKey: ['drifts', 'open'],
    queryFn: () => api<DriftRecord[]>('/mapping/drifts', { query: { status: 'open' } }),
    refetchInterval,
  });
  const resolve = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/mapping/drifts/${encodeURIComponent(id)}/resolve`, { method: 'POST' }),
    onSuccess: () => {
      message.success('Đã đánh dấu xử lý');
      qc.invalidateQueries({ queryKey: ['drifts'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e) => message.error((e as Error).message),
  });

  return (
    <Card size="small" title="Cảnh báo cấu trúc (drift)">
      <Table<DriftRecord>
        size="small"
        rowKey="id"
        loading={drifts.isLoading}
        dataSource={drifts.data ?? []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: drifts.isError ? `Lỗi: ${(drifts.error as Error).message}` : 'Không có cảnh báo nào' }}
        columns={[
          { title: 'Tài khoản', dataIndex: 'uid' },
          { title: 'Luồng', dataIndex: 'stream', render: (s: DriftRecord['stream']) => STREAM_LABEL[s] ?? s },
          { title: 'Loại', dataIndex: 'kind', render: (k: string) => <Tag color="red">{DRIFT_KIND[k] ?? k}</Tag> },
          { title: 'Bảng ánh xạ', dataIndex: 'mappingVersion', render: (v: number) => `v${v}` },
          { title: 'Thiếu', dataIndex: 'missing', render: (xs: string[]) => tags(xs, 'orange') },
          {
            title: 'Khóa quan sát được',
            dataIndex: 'observedKeys',
            width: 360,
            render: (xs: string[], d) => (
              <>
                {tags(xs)}
                {d.observedStores.length > 0 && <div style={{ marginTop: 4 }}>Store: {tags(d.observedStores, 'blue')}</div>}
              </>
            ),
          },
          { title: 'Mẫu lỗi', key: 'sample', render: (_, d) => `${d.failedCount}/${d.sampleSize}` },
          { title: 'Thời điểm', dataIndex: 'at', render: (v: string) => fmtTime(v) },
          {
            title: '',
            key: 'act',
            render: (_, d) => (
              <Button size="small" loading={resolve.isPending && resolve.variables === d.id} onClick={() => resolve.mutate(d.id)}>
                Đã xử lý
              </Button>
            ),
          },
        ]}
      />
    </Card>
  );
}
