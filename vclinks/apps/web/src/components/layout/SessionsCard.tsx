import { App, Button, Card, Popconfirm, Table, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MySession } from '@vclinks/shared';
import { api } from '../../api';
import { fullTime } from '../../utils/time';

/** "Phiên đăng nhập" of Hồ sơ của tôi: where I am signed in, and signing out one or all the others. */
export default function SessionsCard() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me', 'sessions'], queryFn: () => api<MySession[]>('/auth/sessions') });
  const done = () => void qc.invalidateQueries({ queryKey: ['me', 'sessions'] });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: {} }),
    onSuccess: () => {
      message.success('Đã đăng xuất phiên đó.');
      done();
    },
    onError: (e) => message.error((e as Error).message),
  });
  const others = useMutation({
    mutationFn: () => api<{ revoked: number }>('/auth/sessions/revoke-others', { method: 'POST', body: {} }),
    onSuccess: (r) => {
      message.success(r.revoked ? `Đã đăng xuất ${r.revoked} phiên khác.` : 'Không có phiên nào khác.');
      done();
    },
    onError: (e) => message.error((e as Error).message),
  });
  const rows = q.data ?? [];
  return (
    <Card
      title="Phiên đăng nhập"
      extra={
        rows.some((r) => !r.current) && (
          <Popconfirm title="Đăng xuất mọi nơi khác?" description="Các trình duyệt khác phải đăng nhập lại." okText="Đăng xuất" cancelText="Hủy" onConfirm={() => others.mutate()}>
            <Button size="small" loading={others.isPending}>
              Đăng xuất các nơi khác
            </Button>
          </Popconfirm>
        )
      }
    >
      <Table<MySession>
        rowKey="id"
        size="small"
        loading={q.isLoading}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: q.isError ? 'Không tải được danh sách phiên.' : 'Không có phiên nào.' }}
        columns={[
          { title: 'Trình duyệt', render: (_, r) => <>{r.device ?? 'Không rõ'} {r.current && <Tag color="blue">Phiên này</Tag>}</> },
          { title: 'Đăng nhập lúc', render: (_, r) => fullTime(r.createdAt) },
          { title: 'Dùng gần nhất', render: (_, r) => fullTime(r.lastUsedAt) },
          {
            title: '',
            render: (_, r) =>
              r.current ? null : (
                <Button size="small" loading={revoke.isPending && revoke.variables === r.id} onClick={() => revoke.mutate(r.id)}>
                  Đăng xuất
                </Button>
              ),
          },
        ]}
      />
    </Card>
  );
}
