import { Empty, List, Skeleton, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from './shellApi';
import { fullTime } from '../../utils/time';

/**
 * MH-UI-03 notification list, shared by the drawer and the /notifications page. New notices arrive through
 * RealtimeBridge (M1c-07), which refreshes this query.
 */
export default function NotificationList({ onNavigate }: { onNavigate?: () => void }) {
  const q = useNotifications();
  const navigate = useNavigate();
  if (q.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (q.isError) return <Typography.Text type="danger">Không tải được thông báo. Thử lại sau.</Typography.Text>;
  const items = q.data?.items ?? [];
  if (!items.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo nào" />;
  return (
    <List
      dataSource={items}
      renderItem={(n) => (
        <List.Item
          style={{ cursor: n.link ? 'pointer' : 'default', fontWeight: n.read ? 400 : 600 }}
          onClick={() => {
            if (!n.link) return;
            onNavigate?.();
            navigate(n.link);
          }}
        >
          <List.Item.Meta title={n.title} description={fullTime(n.at)} />
        </List.Item>
      )}
    />
  );
}
