import { useState } from 'react';
import { App, Badge, Button, DatePicker, Dropdown, Modal, Space, Tag, type MenuProps } from 'antd';
import { PRESENCE_LABELS, type PresenceStatus } from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';
import { dayjs } from '../../utils/time';
import { useMeProfile, useSetStatus } from './shellApi';

const COLOR: Record<PresenceStatus, 'success' | 'processing' | 'warning' | 'default'> = { online: 'success', field: 'processing', away: 'warning', offline: 'default' };
/** Statuses that carry an end time when set by hand (MH-UI-01 #9). */
const TIMED: PresenceStatus[] = ['field', 'away'];

/** "Trạng thái của tôi" in the header (MH-UI-01 #9, MH-UI-05). "Đi thị trường" only for sales / market / supervisor roles. */
export default function StatusMenu() {
  const { message } = App.useApp();
  const profile = useMeProfile();
  const set = useSetStatus();
  const perms = usePermissions();
  const [asking, setAsking] = useState<PresenceStatus | null>(null);
  const [until, setUntil] = useState<dayjs.Dayjs | null>(null);
  const status = profile.data?.status ?? 'online';
  const canField = perms.me?.legacy || (perms.me?.roles ?? []).some((r) => ['nvkd', 'nv_thi_truong', 'giam_sat_bh'].includes(r.roleKey));

  const apply = (s: PresenceStatus, u?: string) =>
    set.mutate({ status: s, ...(u ? { until: u } : {}) }, { onError: (e) => message.error(e instanceof Error ? e.message : 'Không đổi được trạng thái') });

  const items: MenuProps['items'] = (['online', 'field', 'away', 'offline'] as PresenceStatus[])
    .filter((s) => s !== 'field' || canField)
    .map((s) => ({ key: s, label: <Badge status={COLOR[s]} text={PRESENCE_LABELS[s]} /> }));

  return (
    <>
      <Dropdown
        trigger={['click']}
        menu={{
          items,
          selectedKeys: [status],
          onClick: ({ key }) => {
            const s = key as PresenceStatus;
            if (TIMED.includes(s)) {
              setUntil(dayjs().add(2, 'hour'));
              setAsking(s);
            } else apply(s);
          },
        }}
      >
        <Button type="text" aria-label="Trạng thái của tôi" disabled={!profile.data}>
          <Badge status={COLOR[status]} text={PRESENCE_LABELS[status]} />
        </Button>
      </Dropdown>
      <Modal
        open={!!asking}
        title={asking ? `${PRESENCE_LABELS[asking]} đến khi nào?` : ''}
        okText="Đặt trạng thái"
        cancelText="Hủy"
        onCancel={() => setAsking(null)}
        onOk={() => {
          if (asking && until && until.isAfter(dayjs())) {
            apply(asking, until.toISOString());
            setAsking(null);
          } else message.warning('Thời hạn phải ở tương lai');
        }}
      >
        <Space direction="vertical">
          <DatePicker showTime value={until} onChange={setUntil} format="DD/MM/YYYY HH:mm" allowClear={false} />
          <Tag>Hết giờ, hệ thống tự về "Trực tuyến".</Tag>
        </Space>
      </Modal>
    </>
  );
}
