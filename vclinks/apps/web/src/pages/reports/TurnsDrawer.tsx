import { useQuery } from '@tanstack/react-query';
import type { ReportTurn } from '@vclinks/shared';
import { Alert, Button, Drawer, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { fullTime } from '../../utils/time';
import { fmtMin } from '../../utils/report';
import { reportsApi, type ReportFilters } from './reportsApi';

/**
 * Drawer "Lượt chờ" (MH-BC-06 #10): the reply turns behind a number. Time, customer display name, waiting minutes
 * and verdict only: no message text (BC-18). "Mở hội thoại" opens it inside the viewer's own permissions.
 */
export default function TurnsDrawer(p: { open: boolean; title: string; filters: ReportFilters; row?: string; breachedOnly?: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['reports', 'turns', p.filters.from, p.filters.to, p.filters.team ?? '', p.row ?? '', !!p.breachedOnly],
    queryFn: () => reportsApi.turns(p.filters, { row: p.row, breachedOnly: p.breachedOnly }),
    enabled: p.open,
  });
  return (
    <Drawer open={p.open} onClose={p.onClose} title={p.title} width={880}>
      {q.isError ? <Alert type="error" showIcon message="Không tải được danh sách lượt chờ." action={<Button onClick={() => q.refetch()}>Thử lại</Button>} /> : null}
      {q.data?.truncated ? <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Chỉ hiện 500 lượt mới nhất. Thu hẹp kỳ hoặc chọn một dòng để xem đủ." /> : null}
      <Table<ReportTurn>
        size="small"
        rowKey={(r) => `${r.uid}:${r.threadId}:${r.startAt}`}
        loading={q.isLoading}
        dataSource={q.data?.rows ?? []}
        locale={{ emptyText: 'Chưa có dữ liệu trong kỳ này.' }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        columns={[
          { title: 'Bắt đầu', dataIndex: 'startAt', render: (v: string) => fullTime(v), width: 150 },
          { title: 'Khách', dataIndex: 'customerName' },
          { title: 'Tài khoản kênh', dataIndex: 'accountLabel' },
          { title: 'Người giữ nick', dataIndex: 'holderName', render: (v: string | null) => v ?? '–' },
          { title: 'Chờ / hạn', render: (_: unknown, r) => `${fmtMin(r.waitMin)} / ${fmtMin(r.slaMin)}`, width: 100 },
          {
            title: 'Kết quả',
            render: (_: unknown, r) =>
              r.result === 'open' ? <Tag color={r.breached ? 'red' : 'blue'}>{r.breached ? 'Quá hạn, chưa trả lời' : 'Đang chờ'}</Tag> : <Tag color={r.breached ? 'red' : 'green'}>{r.breached ? 'Quá hạn' : 'Trong hạn'}</Tag>,
          },
          { title: 'Nguồn trả lời', render: (_: unknown, r) => (r.source === 'vclinks' ? 'Qua VClinks' : r.source === 'phone' ? 'Gửi từ điện thoại' : '–') },
          { title: '', render: (_: unknown, r) => <Button type="link" size="small" onClick={() => navigate(`/conversations/${encodeURIComponent(`${r.uid}:${r.threadId}`)}`)}>Mở hội thoại</Button> },
        ]}
      />
    </Drawer>
  );
}
