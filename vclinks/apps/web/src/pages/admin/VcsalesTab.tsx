import { useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Segmented, Skeleton, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  COMPANY_DOMAINS_TEXT,
  isCompanyEmail,
  USER_STATUS_LABELS,
  VCSALES_STAFF_STATE_LABELS,
  type VcsalesHealthView,
  type VcsalesStaffMatching,
  type VcsalesStaffRow,
  type VcsalesStaffState,
  type VcsalesStatusResponse,
} from '@vclinks/shared';
import { api } from '../../api';
import { fullTime } from '../../utils/time';

const KEY = ['admin', 'vcsales'];

const STATE_COLOR: Record<VcsalesStaffState, string> = { matched: 'success', no_user: 'warning', no_email: 'error', duplicated_email: 'error' };

const STATE_HELP: Record<VcsalesStaffState, string> = {
  matched: 'Khách có người này phụ trách trên VCsales sẽ về đúng người khi nạp danh mục.',
  no_user: 'Người này đăng nhập VClinks bằng mail công ty một lần (tài khoản tự tạo), hoặc Admin thêm ở tab Người dùng.',
  no_email: 'Quản trị VCsales điền email công ty cho nhân viên này trên VCsales.',
  duplicated_email: 'Nhiều nhân viên VCsales dùng chung email này: sửa trên VCsales để mỗi người một email. Chưa sửa thì không ghép, để khách không về nhầm người.',
};

const isCompanyMail = isCompanyEmail;

function HealthCard({ h, onPing, pinging }: { h: VcsalesHealthView; onPing: () => void; pinging: boolean }) {
  const state =
    h.mode === 'mock' ? (
      <Tag color="blue">Dữ liệu thử (chưa nối VCsales thật)</Tag>
    ) : h.ok === null ? (
      <Tag>Chưa kiểm tra</Tag>
    ) : h.ok ? (
      <Tag color="success">Kết nối tốt</Tag>
    ) : (
      <Tag color="error">Mất kết nối{h.downSince ? ` từ ${fullTime(h.downSince)}` : ''}</Tag>
    );
  return (
    <Card
      title="Kết nối"
      extra={
        <Button onClick={onPing} loading={pinging}>
          Kiểm tra ngay
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {h.ok === false && (
          <Alert
            type="error"
            showIcon
            message={
              <span>
                <b>ERR-ERP</b> · Không lấy được dữ liệu từ VCsales. {h.error}
              </span>
            }
            description="Trong lúc mất kết nối: khối Thương mại hiện số lưu gần nhất (in nghiêng), cờ Nợ quá hạn giữ kết quả lần trước, ngăn Báo giá không gửi được. VClinks tự kiểm lại 30 giây một lần."
          />
        )}
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Tình trạng">{state}</Descriptions.Item>
          <Descriptions.Item label="Lần kiểm gần nhất">
            {h.checkedAt ? `${fullTime(h.checkedAt)}${h.latencyMs !== null ? ` · trả lời trong ${h.latencyMs} ms` : ''}` : '–'}
          </Descriptions.Item>
          <Descriptions.Item label="Lần kết nối tốt gần nhất">{h.lastOkAt ? fullTime(h.lastOkAt) : '–'}</Descriptions.Item>
          <Descriptions.Item label="Phiên bản phía VCsales">{h.version ?? '–'}</Descriptions.Item>
          <Descriptions.Item label="Nhịp kiểm">
            {h.everyMinutes > 0 ? `${h.everyMinutes} phút một lần; khi mất kết nối, 30 giây một lần` : 'Chỉ khi mở trang này hoặc bấm "Kiểm tra ngay"'}
          </Descriptions.Item>
        </Descriptions>
      </Space>
    </Card>
  );
}

function StaffCard({ staff, onReload, reloading }: { staff: VcsalesStaffMatching; onReload: () => void; reloading: boolean }) {
  const [view, setView] = useState<'todo' | 'all'>('todo');
  const todo = staff.rows.filter((r) => r.active && r.state !== 'matched');
  const rows = view === 'todo' ? todo : staff.rows;
  const left = staff.rows.filter((r) => !r.active).length;
  const c = staff.counts;
  return (
    <Card
      title="Ghép nhân viên kinh doanh VCsales với người dùng VClinks"
      extra={
        <Space>
          {staff.fetchedAt && <Typography.Text type="secondary">VCsales lấy lúc {fullTime(staff.fetchedAt)}</Typography.Text>}
          <Button onClick={onReload} loading={reloading}>
            Tải lại từ VCsales
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          VClinks ghép theo email công ty. Khi nạp danh mục khách VCsales, người phụ trách đầu tiên của khách lấy từ người được ghép ở đây; nhân viên
          chưa ghép thì khách chưa có người phụ trách, chờ Giám đốc bán hàng chia.
        </Typography.Paragraph>
        {staff.error && (
          <Alert
            type="warning"
            showIcon
            message={
              <span>
                <b>ERR-ERP</b> · Không lấy được dữ liệu từ VCsales ({staff.error}){' '}
                {staff.fetchedAt ? `Đang hiện bản lưu lúc ${fullTime(staff.fetchedAt)}.` : 'Vui lòng thử lại sau.'}
              </span>
            }
          />
        )}
        <Space wrap>
          <Tag color="success">
            Ghép được {c.matched}/{c.total}
          </Tag>
          <Tag color={c.no_user ? 'warning' : undefined}>Chưa có tài khoản VClinks: {c.no_user}</Tag>
          <Tag color={c.no_email ? 'error' : undefined}>Thiếu email trên VCsales: {c.no_email}</Tag>
          <Tag color={c.duplicated_email ? 'error' : undefined}>Email trùng: {c.duplicated_email}</Tag>
          {left > 0 && <Typography.Text type="secondary">Không tính {left} người đã nghỉ.</Typography.Text>}
        </Space>
        <Segmented
          value={view}
          onChange={(v) => setView(v as 'todo' | 'all')}
          options={[
            { value: 'todo', label: `Cần xử lý (${todo.length})` },
            { value: 'all', label: `Tất cả (${staff.rows.length})` },
          ]}
        />
        <Table<VcsalesStaffRow>
          rowKey="id"
          size="small"
          dataSource={rows}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: view === 'todo' ? 'Mọi nhân viên kinh doanh đang làm đã được ghép.' : 'VCsales chưa trả danh sách nhân viên.' }}
          columns={[
            {
              title: 'Nhân viên VCsales',
              render: (_, r) => (
                <Space direction="vertical" size={0}>
                  <span>
                    {r.fullName} {!r.active && <Tag>Đã nghỉ</Tag>}
                  </span>
                  <Typography.Text type="secondary">{[r.positionName, r.departmentName].filter(Boolean).join(' · ') || '–'}</Typography.Text>
                </Space>
              ),
            },
            {
              title: 'Email trên VCsales',
              render: (_, r) =>
                r.email ? (
                  <Space size={4}>
                    <span>{r.email}</span>
                    {!isCompanyMail(r.email) && (
                      <Tooltip title={`Không phải mail công ty ${COMPANY_DOMAINS_TEXT}: người dùng VClinks đăng nhập bằng mail công ty nên không ghép được. Sửa trên VCsales.`}>
                        <Tag color="warning">Không phải mail công ty</Tag>
                      </Tooltip>
                    )}
                  </Space>
                ) : (
                  '–'
                ),
            },
            {
              title: 'Người dùng VClinks',
              render: (_, r) =>
                r.user ? (
                  <Space size={4}>
                    <span>{r.user.fullName}</span>
                    {r.user.status !== 'hoat_dong' && <Tag>{USER_STATUS_LABELS[r.user.status as keyof typeof USER_STATUS_LABELS] ?? r.user.status}</Tag>}
                  </Space>
                ) : (
                  '–'
                ),
            },
            {
              title: 'Tình trạng',
              render: (_, r) => (
                <Tooltip title={STATE_HELP[r.state]}>
                  <Tag color={STATE_COLOR[r.state]}>{VCSALES_STAFF_STATE_LABELS[r.state]}</Tag>
                </Tooltip>
              ),
            },
          ]}
        />
      </Space>
    </Card>
  );
}

/**
 * Quản trị → "Kết nối VCsales" (plan docs/01-quan-ly-du-an/ke-hoach-ket-noi-vcsales.md C5, C6): whether VCsales
 * answers and since when it does not, and which VCsales salespersons are matched with VClinks users by e-mail.
 */
export default function VcsalesTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => api<VcsalesStatusResponse>('/admin/vcsales') });
  const reload = useMutation({
    mutationFn: () => api<VcsalesStatusResponse>('/admin/vcsales?refresh=1'),
    onSuccess: (d) => qc.setQueryData(KEY, d),
    onError: (e) => message.error((e as Error).message),
  });
  const ping = useMutation({
    mutationFn: () => api<VcsalesHealthView>('/admin/vcsales/ping', { method: 'POST' }),
    onSuccess: (h) => {
      qc.setQueryData<VcsalesStatusResponse>(KEY, (d) => (d ? { ...d, health: h } : d));
      if (h.ok) message.success('VCsales trả lời bình thường.');
      else message.warning('VCsales chưa trả lời. Xem lý do ở khung Kết nối.');
    },
    onError: (e) => message.error((e as Error).message),
  });
  if (q.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (q.isError) return <Alert type="error" showIcon message="Không tải được trạng thái kết nối VCsales." action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />;
  const data = q.data!;
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <HealthCard h={data.health} onPing={() => ping.mutate()} pinging={ping.isPending} />
      <StaffCard staff={data.staff} onReload={() => reload.mutate()} reloading={reload.isPending} />
    </Space>
  );
}
