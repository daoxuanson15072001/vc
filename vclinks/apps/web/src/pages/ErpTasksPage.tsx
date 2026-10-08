import { useState } from 'react';
import { Alert, App, Button, Checkbox, Empty, Space, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { ERP_FORM_FIELD_LABELS, ERP_TASK_STATUS_LABELS, type ErpOwnerMismatchRow, type ErpTaskView } from '@vclinks/shared';
import NoAccess, { isNoAccessError } from '../components/access/NoAccess';
import ErpTaskDrawer from '../components/customers/ErpTaskDrawer';
import { ageText, useCreateErpTask, useErpTasks } from '../components/customers/erpTaskApi';
import { usePageTitle } from '../components/layout/PageTitle';
import { usePermissions } from '../state/permissions';
import { fullTime } from '../utils/time';

const ROLES = ['Sale admin (xử lý)', 'NVKD (phiếu khách của mình)', 'Giám sát, Giám đốc bán hàng (chỉ xem)'];

function StatusTags({ t, me }: { t: ErpTaskView; me: string | null }) {
  return (
    <Space size={4} wrap>
      {t.status !== 'open' && <Tag color={t.status === 'waiting_sale' ? 'warning' : t.status === 'done' ? 'success' : 'default'}>{ERP_TASK_STATUS_LABELS[t.status]}</Tag>}
      {t.claim && <Tag color="blue">{t.claim.by === me ? 'Bạn đang xử lý' : `${t.claim.byName ?? 'Người khác'} đang xử lý`}</Tag>}
      {t.suggestion && <Tag color="green">Có mã mới để gắn</Tag>}
      {t.reopenedNote && (
        <Tooltip title={t.reopenedNote}>
          <Tag color="red">Mở lại</Tag>
        </Tooltip>
      )}
    </Space>
  );
}

/**
 * Việc VCsales (02 MH-DK-12, route `/customers/erp-tasks?tab=create|update`): what VCsales needs that VClinks cannot
 * write (BR12). Tab 1 "Chờ tạo mã KH" (forms filled by salespersons), tab 2 "Cần cập nhật VCsales" (phone / e-mail,
 * salesperson, merged codes) with filter 4a "Owner VClinks ≠ NV phụ trách VCsales". The sync closes or reopens rows.
 */
export default function ErpTasksPage() {
  usePageTitle('Việc VCsales');
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'update' ? 'update' : 'create';
  const [mine, setMine] = useState(false);
  const [finished, setFinished] = useState(false);
  const mismatch = params.get('mismatch') === 'owner';
  const q = useErpTasks({ tab, mine, finished, mismatch: tab === 'update' && mismatch });
  const createTask = useCreateErpTask();
  const [openId, setOpenId] = useState<string | null>(null);
  const me = usePermissions().me?.userId ?? null;
  const data = q.data;
  const open = data?.items.find((t) => t.id === openId) ?? null;
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  if (q.isError && isNoAccessError(q.error)) return <NoAccess kind="page" pageName="Việc VCsales" roles={ROLES} />;

  const createColumns = [
    {
      title: 'Khách',
      render: (_: unknown, t: ErpTaskView) => (
        <Space direction="vertical" size={0}>
          <Link to={`/customers/${encodeURIComponent(t.accountId)}`}>{t.accountName}</Link>
          <StatusTags t={t} me={me} />
        </Space>
      ),
    },
    { title: 'Người phụ trách', width: 150, render: (_: unknown, t: ErpTaskView) => t.owners.map((o) => o.userName ?? '–').join(', ') || 'Chưa có' },
    { title: 'Lý do vào hàng', render: (_: unknown, t: ErpTaskView) => t.origin },
    {
      title: 'Phiếu',
      width: 170,
      render: (_: unknown, t: ErpTaskView) =>
        t.missing.length ? <Typography.Text type="warning">Thiếu {t.missing.map((f) => ERP_FORM_FIELD_LABELS[f]).join(', ')}</Typography.Text> : <Typography.Text type="success">Đủ ✓</Typography.Text>,
    },
    { title: 'Tuổi', width: 90, render: (_: unknown, t: ErpTaskView) => ageText(t.createdAt) },
    {
      title: 'Trùng?',
      width: 110,
      render: (_: unknown, t: ErpTaskView) =>
        !t.duplicates ? (
          <Typography.Text type="secondary">Chưa kiểm</Typography.Text>
        ) : t.duplicates.candidates.length ? (
          <Tag color="warning">⚠ {t.duplicates.candidates.length} mã</Tag>
        ) : (
          'Không'
        ),
    },
    {
      title: '',
      width: 90,
      render: (_: unknown, t: ErpTaskView) => (
        <Button size="small" type={t.can.process ? 'primary' : 'default'} onClick={() => setOpenId(t.id)}>
          {t.can.process ? 'Xử lý' : 'Xem'}
        </Button>
      ),
    },
  ];
  const updateColumns = [
    {
      title: 'Khách',
      render: (_: unknown, t: ErpTaskView) => (
        <Space direction="vertical" size={0}>
          <Link to={`/customers/${encodeURIComponent(t.accountId)}`}>{t.accountName}</Link>
          <StatusTags t={t} me={me} />
        </Space>
      ),
    },
    { title: 'Mã KH', width: 130, render: (_: unknown, t: ErpTaskView) => t.code ?? '—' },
    { title: 'Việc', render: (_: unknown, t: ErpTaskView) => t.summary },
    { title: 'Người đề xuất', width: 150, render: (_: unknown, t: ErpTaskView) => t.createdByName ?? '—' },
    { title: 'Tuổi', width: 90, render: (_: unknown, t: ErpTaskView) => ageText(t.createdAt) },
    {
      title: '',
      width: 90,
      render: (_: unknown, t: ErpTaskView) => (
        <Button size="small" type={t.can.process ? 'primary' : 'default'} onClick={() => setOpenId(t.id)}>
          {t.can.process ? 'Xử lý' : 'Xem'}
        </Button>
      ),
    },
  ];
  const mismatchColumns = [
    { title: 'Khách', render: (_: unknown, r: ErpOwnerMismatchRow) => <Link to={`/customers/${encodeURIComponent(r.accountId)}`}>{r.accountName}</Link> },
    { title: 'Mã KH', width: 130, dataIndex: 'code' },
    { title: 'Người phụ trách VClinks', render: (_: unknown, r: ErpOwnerMismatchRow) => r.owners.map((o) => `${o.userName ?? '–'} (từ ${fullTime(o.since).slice(6)})`).join(', ') },
    { title: 'NV phụ trách VCsales', render: (_: unknown, r: ErpOwnerMismatchRow) => r.salespersons.join(', ') || '—' },
    {
      title: '',
      width: 200,
      render: (_: unknown, r: ErpOwnerMismatchRow) =>
        r.taskId ? (
          <Button size="small" onClick={() => setOpenId(r.taskId)}>
            Đã có việc
          </Button>
        ) : (
          <Button
            size="small"
            loading={createTask.isPending && createTask.variables?.accountId === r.accountId}
            onClick={() =>
              createTask.mutate(
                { kind: 'change_owner', accountId: r.accountId },
                { onSuccess: () => message.success('Đã tạo việc đổi NV phụ trách trên VCsales.'), onError: (e) => message.error((e as Error).message) },
              )
            }
          >
            Tạo việc đổi NV phụ trách
          </Button>
        ),
    },
  ];

  return (
    <div style={{ maxWidth: 1240 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Việc VCsales
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        VClinks chỉ đọc VCsales: tạo mã KH, sửa SĐT / email, đổi NV phụ trách, gộp mã trùng do sale admin làm trên VCsales. Lần đồng bộ sau tự đóng
        việc đã làm, mở lại việc còn lệch và gợi ý mã mới. Đồng bộ VCsales lần cuối: {data?.lastSyncAt ? fullTime(data.lastSyncAt) : 'chưa có'}.
      </Typography.Paragraph>
      <Tabs
        activeKey={tab}
        onChange={(k) => set({ tab: k, mismatch: null })}
        items={[
          { key: 'create', label: `Chờ tạo mã KH (${data?.counts.create ?? 0})` },
          { key: 'update', label: `Cần cập nhật VCsales (${data?.counts.update ?? 0})` },
        ]}
      />
      <Space wrap style={{ marginBottom: 12 }}>
        <Checkbox checked={mine} onChange={(e) => setMine(e.target.checked)}>
          Của tôi
        </Checkbox>
        <Checkbox checked={finished} onChange={(e) => setFinished(e.target.checked)}>
          Hiện cả việc đã xong (30 ngày)
        </Checkbox>
        {tab === 'update' && (
          <Checkbox checked={mismatch} onChange={(e) => set({ mismatch: e.target.checked ? 'owner' : null })}>
            Owner VClinks ≠ NV phụ trách VCsales <Tag>{data?.counts.mismatch ?? 0}</Tag>
          </Checkbox>
        )}
      </Space>
      {q.isError && !isNoAccessError(q.error) && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={(q.error as Error).message} action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />}
      {tab === 'update' && mismatch ? (
        <Table<ErpOwnerMismatchRow>
          rowKey="accountId"
          size="middle"
          loading={q.isLoading}
          dataSource={data?.mismatch ?? []}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          columns={mismatchColumns}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có khách nào lệch người phụ trách giữa VClinks và VCsales." /> }}
        />
      ) : (
        <Table<ErpTaskView>
          rowKey="id"
          size="middle"
          loading={q.isLoading}
          dataSource={data?.items ?? []}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          columns={tab === 'create' ? createColumns : updateColumns}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có việc VCsales nào đang chờ." /> }}
        />
      )}
      {data && !data.canProcess && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          Sale admin xử lý các việc này. Bạn xem việc trong phạm vi của mình và sửa phiếu tạo mã của khách mình phụ trách.
        </Typography.Paragraph>
      )}
      {open && <ErpTaskDrawer key={open.id} task={open} createUrl={data?.createUrl ?? null} lastSyncAt={data?.lastSyncAt ?? null} onClose={() => setOpenId(null)} />}
    </div>
  );
}
