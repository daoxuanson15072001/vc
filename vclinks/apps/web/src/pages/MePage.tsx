import { Alert, Button, Card, Descriptions, Skeleton, Space, Tag } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PRESENCE_LABELS, ROLE_LABELS, type RoleKey } from '@vclinks/shared';
import { logout as signOut } from '../api';
import SessionsCard from '../components/layout/SessionsCard';
import StatusMenu from '../components/layout/StatusMenu';
import { errorViewFor } from '../components/layout/ErrorViews';
import { useMeProfile } from '../components/layout/shellApi';
import { fullTime } from '../utils/time';

/** MH-UI-05 "Hồ sơ của tôi": who I am, my roles, my status, sign out. */
export default function MePage() {
  const q = useMeProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const logout = () => {
    void signOut().finally(() => {
      qc.clear();
      navigate('/login', { replace: true });
    });
  };
  if (q.isLoading) return <Skeleton avatar active paragraph={{ rows: 4 }} />;
  if (q.isError) {
    return (
      errorViewFor(q.error, () => q.refetch()) ?? (
        <Alert type="error" showIcon message="Không tải được hồ sơ." action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />
      )
    );
  }
  const p = q.data!;
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%', maxWidth: 640 }}>
    <Card title="Hồ sơ của tôi" extra={<StatusMenu />}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Họ tên">{p.name}</Descriptions.Item>
        {p.email && <Descriptions.Item label="Email">{p.email}</Descriptions.Item>}
        <Descriptions.Item label="Trạng thái">
          {PRESENCE_LABELS[p.status]}
          {p.until ? ` (đến ${fullTime(p.until)})` : ''}
        </Descriptions.Item>
        {p.leave && (
          <Descriptions.Item label={p.leave.active ? 'Nghỉ phép' : 'Nghỉ phép sắp tới'}>
            {fullTime(p.leave.from)} – {fullTime(p.leave.to)} (người trực thay: {p.leave.coverName})
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Vai trò">
          {p.roles.length ? (
            <Space wrap>
              {p.roles.map((r) => (
                <Tag key={`${r.customRoleId ?? r.roleKey}:${r.orgUnitName}`}>
                  {r.customRoleName ?? ROLE_LABELS[r.roleKey as RoleKey] ?? r.roleKey} · {r.orgUnitName}
                </Tag>
              ))}
            </Space>
          ) : (
            'Chưa gán vai trò'
          )}
        </Descriptions.Item>
      </Descriptions>
      <Space style={{ marginTop: 16 }}>
        <Button onClick={() => navigate('/settings/activity')}>Hoạt động của tôi</Button>
        <Button onClick={() => navigate('/settings/tokens')}>Token MCP của tôi</Button>
        <Button onClick={() => navigate('/admin/access-requests?tab=mine')}>Yêu cầu quyền của tôi</Button>
        <Button icon={<LogoutOutlined />} onClick={logout}>
          Đăng xuất
        </Button>
      </Space>
    </Card>
    <SessionsCard />
    </Space>
  );
}
