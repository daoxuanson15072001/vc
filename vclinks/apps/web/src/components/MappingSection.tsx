import { App, Button, Card, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FieldMappingRecord, MappingStatus } from '@vclinks/shared';
import { api } from '../api';
import { fmtTime } from '../time';
import { MAPPING_STATUS } from '../labels';
import MappingDiff from './MappingDiff';

export default function MappingSection({ refetchInterval }: { refetchInterval: number }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const mappings = useQuery({
    queryKey: ['mappings'],
    queryFn: () => api<FieldMappingRecord[]>('/mapping'),
    refetchInterval,
  });
  const active = mappings.data?.find((m) => m.status === 'active');

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api<FieldMappingRecord>(`/mapping/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
    onSuccess: (rec, { action }) => {
      message.success(action === 'approve' ? `Đã duyệt bảng ánh xạ v${rec.version}` : `Đã từ chối bảng ánh xạ v${rec.version}`);
      qc.invalidateQueries({ queryKey: ['mappings'] });
      // Approving resolves open drifts server-side.
      qc.invalidateQueries({ queryKey: ['drifts'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e) => message.error((e as Error).message),
  });

  const busy = (id: string, action: 'approve' | 'reject') =>
    act.isPending && act.variables?.id === id && act.variables.action === action;

  return (
    <Card size="small" title="Bảng ánh xạ trường">
      <Table<FieldMappingRecord>
        size="small"
        rowKey="id"
        loading={mappings.isLoading}
        dataSource={mappings.data ?? []}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: mappings.isError ? `Lỗi: ${(mappings.error as Error).message}` : 'Chưa có bảng ánh xạ' }}
        expandable={{
          expandedRowRender: (m) => <MappingDiff spec={m.spec} base={m.id === active?.id ? undefined : active?.spec} />,
        }}
        columns={[
          { title: 'Phiên bản', dataIndex: 'version', render: (v: number) => <Typography.Text strong>v{v}</Typography.Text> },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (s: MappingStatus) => <Tag color={MAPPING_STATUS[s]?.color}>{MAPPING_STATUS[s]?.label ?? s}</Tag>,
          },
          { title: 'Đề xuất bởi', dataIndex: 'proposedBy' },
          { title: 'Tạo lúc', dataIndex: 'createdAt', render: (v: string) => fmtTime(v) },
          {
            title: 'Duyệt',
            key: 'approved',
            render: (_, m) => (m.approvedAt ? `${m.approvedBy ?? ''} · ${fmtTime(m.approvedAt)}` : '—'),
          },
          {
            title: 'Ghi chú',
            dataIndex: 'note',
            width: 320,
            render: (v?: string) => (v ? <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'thêm' }} style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{v}</Typography.Paragraph> : '—'),
          },
          {
            title: '',
            key: 'act',
            render: (_, m) =>
              m.status === 'proposed' ? (
                <Space>
                  <Popconfirm
                    title={`Duyệt bảng ánh xạ v${m.version}?`}
                    description="Bản đang áp dụng sẽ bị thay thế; extension dùng bản mới ở lần đồng bộ sau."
                    okText="Duyệt"
                    cancelText="Hủy"
                    onConfirm={() => act.mutateAsync({ id: m.id, action: 'approve' })}
                  >
                    <Button type="primary" size="small" loading={busy(m.id, 'approve')}>
                      Duyệt
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title={`Từ chối bảng ánh xạ v${m.version}?`}
                    okText="Từ chối"
                    okButtonProps={{ danger: true }}
                    cancelText="Hủy"
                    onConfirm={() => act.mutateAsync({ id: m.id, action: 'reject' })}
                  >
                    <Button danger size="small" loading={busy(m.id, 'reject')}>
                      Từ chối
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null,
          },
        ]}
      />
    </Card>
  );
}
