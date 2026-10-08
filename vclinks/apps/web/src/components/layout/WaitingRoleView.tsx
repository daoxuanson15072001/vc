import { useEffect } from 'react';
import { Button, Result } from 'antd';
import { HourglassOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../outbox/queue';

/**
 * First login of a company address (docs 01 PQ-10): the person is in, but has no role yet, so every screen would be
 * empty. The page says so and checks again every 30 seconds; it goes away by itself once an Admin assigns a role.
 */
export default function WaitingRoleView({ onLogout }: { onLogout: () => void }) {
  const qc = useQueryClient();
  const me = useMe();
  useEffect(() => {
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: ['me', 'permissions'] }), 30_000);
    return () => clearInterval(t);
  }, [qc]);
  return (
    <Result
      icon={<HourglassOutlined />}
      title={me.data?.name ? `Chào ${me.data.name}, bạn đã vào VClinks` : 'Bạn đã vào VClinks'}
      subTitle="Tài khoản của bạn chưa có vai trò nên chưa xem được hội thoại hay khách hàng. Admin hệ thống đã được báo; khi Admin gán vai trò, trang này tự chuyển sang Hộp thư trong khoảng 1 phút."
      extra={<Button onClick={onLogout}>Đăng xuất</Button>}
    />
  );
}
