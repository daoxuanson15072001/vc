import { Typography } from 'antd';
import OutboxList from '../components/outbox/OutboxList';

/** /outbox: "Lệnh gửi" (03 MH-SZ-13, 00 §2). */
export default function OutboxPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Lệnh gửi
      </Typography.Title>
      <OutboxList />
    </div>
  );
}
