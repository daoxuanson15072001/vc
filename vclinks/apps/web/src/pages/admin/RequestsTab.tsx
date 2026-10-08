import { ROLE_LABELS } from '@vclinks/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Space, Table, Tag, message } from 'antd';
import { adminApi } from './adminApi';

/** Role changes that wait for a second person (PQ-42). Who may decide is checked by the server. */
export default function RequestsTab() {
  const qc = useQueryClient();
  const reqs = useQuery({ queryKey: ['admin', 'requests'], queryFn: adminApi.requests });
  const units = useQuery({ queryKey: ['admin', 'units'], queryFn: adminApi.units });
  const act = useMutation({
    mutationFn: (v: { id: string; op: 'approve' | 'reject' | 'cancel' }) => adminApi.decide(v.id, v.op),
    onSuccess: () => {
      message.success('Đã xử lý yêu cầu.');
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e: Error) => message.error(e.message),
  });
  return (
    <Table
      rowKey="id"
      loading={reqs.isLoading}
      dataSource={reqs.data ?? []}
      locale={{ emptyText: 'Không có thay đổi vai trò nào đang chờ duyệt.' }}
      pagination={false}
      columns={[
        { title: 'Người được cấp', dataIndex: 'targetName' },
        { title: 'Vai trò', render: (_, r) => r.change.customRoleName ?? ROLE_LABELS[r.change.roleKey] },
        { title: 'Đơn vị', render: (_, r) => units.data?.find((u) => u.id === r.change.orgUnitId)?.name ?? r.change.orgUnitId },
        { title: 'Người yêu cầu', dataIndex: 'requestedByName' },
        { title: 'Người duyệt', render: (_, r) => <Tag>{r.approverRule === 'quan_sat' ? 'Ban giám đốc / Kiểm soát' : 'Người duyệt cấp tập đoàn'}</Tag> },
        {
          title: '',
          render: (_, r) => (
            <Space>
              <Button size="small" type="primary" onClick={() => act.mutate({ id: r.id, op: 'approve' })}>Duyệt</Button>
              <Button size="small" onClick={() => act.mutate({ id: r.id, op: 'reject' })}>Từ chối</Button>
              <Button size="small" onClick={() => act.mutate({ id: r.id, op: 'cancel' })}>Hủy yêu cầu</Button>
            </Space>
          ),
        },
      ]}
    />
  );
}
