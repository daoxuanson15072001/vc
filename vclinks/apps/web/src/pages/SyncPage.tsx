import { Alert, Button, Empty, Space, Spin, Typography } from 'antd';
import { usePermissions } from '../state/permissions';
import { ReloadOutlined } from '@ant-design/icons';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { usePrefs } from '../state/prefs';
import { useAccounts } from '../components/AccountSelect';
import AccountSyncCard from '../components/AccountSyncCard';
import DriftSection from '../components/DriftSection';
import MappingSection from '../components/MappingSection';

const REFRESH_MS = 15_000;

/**
 * Sale view of /sync (03 MH-SZ-12b). There are no roles before M1b-02/04, so it is
 * switched on by VITE_SYNC_COMPACT=1, by localStorage `vclinks.syncCompact`=1, or by `?compact=1`.
 */
function isCompact(search: string): boolean {
  if (new URLSearchParams(search).get('compact') === '1') return true;
  if (import.meta.env.VITE_SYNC_COMPACT === '1') return true;
  try {
    return localStorage.getItem('vclinks.syncCompact') === '1';
  } catch {
    return false;
  }
}

export default function SyncPage() {
  const qc = useQueryClient();
  const accounts = useAccounts(REFRESH_MS);
  const fetching = useIsFetching();
  // Reduced view for roles without the technical view (UID, drift, mapping hidden; 03 §8 D17).
  const compact = isCompact(useLocation().search) || !usePermissions().technical;
  const { accountUid } = usePrefs();
  const shown = compact && accountUid ? accounts.data?.filter((a) => a.uid === accountUid) : accounts.data;

  const refresh = () => {
    for (const key of ['accounts', 'health', 'drifts', 'mappings']) qc.invalidateQueries({ queryKey: [key] });
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Đối chiếu đồng bộ
        </Typography.Title>
        <Space>
          <Typography.Text type="secondary">Tự làm mới mỗi 15 giây</Typography.Text>
          <Button icon={<ReloadOutlined spin={fetching > 0} />} onClick={refresh}>
            Làm mới
          </Button>
        </Space>
      </Space>

      {accounts.isLoading ? (
        <Spin />
      ) : accounts.isError ? (
        <Alert type="error" showIcon message="Không tải được danh sách tài khoản" description={(accounts.error as Error).message} />
      ) : shown?.length ? (
        shown.map((a) => <AccountSyncCard key={a.uid} account={a} compact={compact} />)
      ) : (
        <Empty description="Chưa có tài khoản Zalo nào được đăng ký" />
      )}

      {!compact && <DriftSection refetchInterval={REFRESH_MS} />}
      {!compact && <MappingSection refetchInterval={REFRESH_MS} />}
    </Space>
  );
}
