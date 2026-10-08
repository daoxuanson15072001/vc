import { useState } from 'react';
import { Alert, Empty, Input, Radio, Space, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { CustomerSummary } from '@vclinks/shared';
import { isNoAccessError } from '../components/access/NoAccess';
import ChatAvatar from '../components/chat/ChatAvatar';
import { useCustomerList } from '../components/customers/customerApi';
import { fmtTime } from '../time';

/**
 * Khách hàng (02 MH-DK-08, trimmed): the customers the user may see, search by name, open Customer 360. Phone and
 * email never appear in the list (they show in the 360 by right). Bộ lọc nâng cao and merge-mode of MH-DK-08 come later.
 */
export default function CustomersPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [erp, setErp] = useState<'all' | 'linked' | 'none'>('all');
  const [page, setPage] = useState(1);
  const list = useCustomerList(q, erp === 'all' ? undefined : erp, page);
  const denied = list.isError && isNoAccessError(list.error);

  return (
    <div style={{ maxWidth: 1100 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Khách hàng
      </Typography.Title>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search
          allowClear
          placeholder="Tìm theo tên khách"
          style={{ width: 280 }}
          onSearch={(v) => {
            setQ(v.trim());
            setPage(1);
          }}
        />
        <Radio.Group
          optionType="button"
          value={erp}
          onChange={(e) => {
            setErp(e.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'linked', label: 'Đã có mã KH' },
            { value: 'none', label: 'Chưa có mã KH' },
          ]}
        />
      </Space>
      {list.isError && <Alert type={denied ? 'warning' : 'error'} showIcon message={denied ? 'Bạn không có quyền xem danh sách khách.' : 'Không tải được danh sách khách. Thử lại sau ít phút.'} />}
      <Table<CustomerSummary>
        rowKey="id"
        size="middle"
        scroll={{ x: 900 }}
        loading={list.isLoading}
        dataSource={list.data?.items ?? []}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có khách nào trong phạm vi của bạn." /> }}
        pagination={{ current: page, pageSize: 50, total: list.data?.total ?? 0, showSizeChanger: false, onChange: setPage }}
        onRow={(r) => ({ onClick: () => navigate(`/customers/${encodeURIComponent(r.id)}`), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Khách',
            dataIndex: 'name',
            render: (name: string, r) => (
              <Space>
                <ChatAvatar size={32} name={name} colorKey={r.id} />
                <span>{name}</span>
              </Space>
            ),
          },
          { title: 'Loại', dataIndex: 'type', width: 110, render: (v: string | null) => v ?? '–' },
          { title: 'Khu vực', dataIndex: 'region', width: 120, render: (v: string | null) => v ?? '–' },
          {
            title: 'Phụ trách',
            width: 200,
            render: (_: unknown, r) => (r.owners.length ? r.owners.map((o) => o.userName ?? '–').join(', ') : <Typography.Text style={{ color: 'var(--warn-ink)' }}>Chưa có người phụ trách</Typography.Text>),
          },
          {
            title: 'Mã KH',
            width: 150,
            render: (_: unknown, r) => {
              const l = r.erpLinks.find((x) => x.erp === 'vcsales' && x.status === 'confirmed');
              return l ? <Tag color="green">{l.customerId}</Tag> : <Typography.Text type="secondary">Chưa liên kết</Typography.Text>;
            },
          },
          { title: 'Cập nhật', dataIndex: 'updatedAt', width: 140, render: (v: string) => fmtTime(v) },
        ]}
      />
    </div>
  );
}
