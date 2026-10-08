import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, List, Skeleton } from 'antd';
import { fullTime } from '../utils/time';
import { auditApi } from './admin/auditApi';

/** "Hoạt động của tôi" (MH-PQ-10 locked to myself): what I did, who looked at my log, what AI read for me. */
export default function ActivityPage() {
  const q = useQuery({ queryKey: ['me', 'activity'], queryFn: auditApi.activity });
  if (q.isLoading) return <Skeleton active />;
  if (q.isError) return <Alert type="error" showIcon message="Không tải được nhật ký." action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />;
  return (
    <Card title="Hoạt động của tôi (30 ngày gần nhất)" style={{ maxWidth: 760 }}>
      <List
        dataSource={q.data ?? []}
        locale={{ emptyText: 'Không có hoạt động nào trong khoảng thời gian này.' }}
        renderItem={(r) => <List.Item extra={fullTime(r.at)}>{r.text}</List.Item>}
      />
    </Card>
  );
}
