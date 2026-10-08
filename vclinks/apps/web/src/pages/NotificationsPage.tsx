import { Card } from 'antd';
import NotificationList from '../components/layout/NotificationList';

/** MH-UI-03 as a page (`/notifications`); the header bell opens the same list in a drawer. */
export default function NotificationsPage() {
  return (
    <Card title="Thông báo" style={{ maxWidth: 640 }}>
      <NotificationList />
    </Card>
  );
}
