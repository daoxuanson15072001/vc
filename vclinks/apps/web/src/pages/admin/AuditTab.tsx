import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, DatePicker, Descriptions, Drawer, Input, Select, Space, Statistic, Table, Tabs, Typography, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  AUDIT_ACTOR_LABELS,
  AUDIT_DEFAULT_GROUPS,
  AUDIT_GROUPS,
  AUDIT_GROUP_KEYS,
  type AuditActorType,
  type AuditGroup,
  type AuditQuery,
  type AuditRow,
} from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';
import { fullTime } from '../../utils/time';
import { auditApi, downloadAuditXlsx } from './auditApi';

/** MH-PQ-10 "Nhật ký truy cập": who saw a phone, exported, deleted, changed rights, what AI read. Read only. */
const MAX_DAYS = 92;

function LogTab() {
  const perms = usePermissions();
  const canExport = !!perms.me?.permissions['report.export'] || !!perms.me?.legacy;
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]);
  const [groups, setGroups] = useState<AuditGroup[]>(AUDIT_DEFAULT_GROUPS);
  const [actorType, setActorType] = useState<AuditActorType | undefined>();
  const [actor, setActor] = useState('');
  const [target, setTarget] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditRow | null>(null);
  const q: Partial<AuditQuery> = {
    from: range[0].toISOString(),
    to: range[1].toISOString(),
    groups: groups.join(','),
    actorType,
    actor: actor.trim() || undefined,
    target: target.trim() || undefined,
    page,
    pageSize: 50,
  };
  const data = useQuery({ queryKey: ['audit', q], queryFn: () => auditApi.list(q) });
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <DatePicker.RangePicker
          allowClear={false}
          value={range}
          format="DD/MM/YYYY"
          disabledDate={(d) => d.isAfter(dayjs())}
          onChange={(v) => {
            if (!v?.[0] || !v[1]) return;
            if (v[1].diff(v[0], 'day') > MAX_DAYS) return void message.warning(`Tối đa ${MAX_DAYS} ngày mỗi lần tra.`);
            reset(setRange)([v[0].startOf('day'), v[1].endOf('day')]);
          }}
        />
        <Select
          mode="multiple"
          style={{ minWidth: 260 }}
          placeholder="Hành động"
          value={groups}
          onChange={reset(setGroups)}
          options={AUDIT_GROUP_KEYS.map((g) => ({ value: g, label: AUDIT_GROUPS[g].label }))}
          maxTagCount="responsive"
        />
        <Select
          allowClear
          placeholder="Chủ thể"
          style={{ width: 130 }}
          value={actorType}
          onChange={reset(setActorType)}
          options={(Object.keys(AUDIT_ACTOR_LABELS) as AuditActorType[]).map((k) => ({ value: k, label: AUDIT_ACTOR_LABELS[k] }))}
        />
        <Input.Search allowClear placeholder="Mã người dùng" style={{ width: 170 }} onSearch={reset(setActor)} />
        <Input.Search allowClear placeholder="Đối tượng: mã khách / hội thoại" style={{ width: 240 }} onSearch={reset(setTarget)} />
        {canExport && (
          <Button
            onClick={() =>
              downloadAuditXlsx({ ...q, page: undefined, pageSize: undefined })
                .then((r) => message.success(`Đã xuất ${r.rows} dòng nhật ký.`))
                .catch((e: Error) => message.error(e.message))
            }
          >
            Xuất Excel
          </Button>
        )}
      </Space>
      {actor.trim() && <Alert type="info" showIcon message="Tra nhật ký của một người sẽ được ghi lại, và người đó thấy việc này trong Hoạt động của tôi." />}
      <Table
        rowKey="id"
        size="small"
        loading={data.isLoading}
        dataSource={data.data?.items ?? []}
        locale={{ emptyText: data.isError ? 'Không tải được nhật ký.' : 'Không có hoạt động nào trong khoảng thời gian và bộ lọc đã chọn.' }}
        onRow={(r) => ({ onClick: () => setOpen(r), style: { cursor: 'pointer' } })}
        pagination={{ current: page, pageSize: 50, total: data.data?.total ?? 0, showSizeChanger: false, onChange: setPage }}
        columns={[
          { title: 'Thời điểm', dataIndex: 'at', width: 150, render: (v: string) => fullTime(v) },
          { title: 'Người', dataIndex: 'actorName' },
          { title: 'Chủ thể', dataIndex: 'actorType', width: 90, render: (v: AuditActorType) => AUDIT_ACTOR_LABELS[v] },
          { title: 'Hành động', dataIndex: 'actionLabel' },
          { title: 'Đối tượng', dataIndex: 'targetLabel', ellipsis: true },
        ]}
      />
      {data.isError && <Button onClick={() => data.refetch()}>Thử lại</Button>}
      <Drawer open={!!open} onClose={() => setOpen(null)} title="Chi tiết" width={420}>
        {open && (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Thời điểm">{fullTime(open.at)}</Descriptions.Item>
              <Descriptions.Item label="Người">{open.actorName}</Descriptions.Item>
              <Descriptions.Item label="Hành động">{open.actionLabel}</Descriptions.Item>
              <Descriptions.Item label="Đối tượng">{open.targetLabel}</Descriptions.Item>
              {open.ip && <Descriptions.Item label="Địa chỉ IP">{open.ip}</Descriptions.Item>}
            </Descriptions>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
              Nhật ký chỉ ghi mã, số đếm và lý do. Không có nội dung tin nhắn, không có SĐT đầy đủ.
            </Typography.Paragraph>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(open.detail ?? {}, null, 2)}</pre>
          </>
        )}
      </Drawer>
    </Space>
  );
}

function OverviewTab() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('quarter');
  const q = useQuery({ queryKey: ['audit', 'overview', period], queryFn: () => auditApi.overview(period) });
  const o = q.data;
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Select
        value={period}
        onChange={setPeriod}
        style={{ width: 140 }}
        options={[
          { value: 'week', label: 'Tuần này' },
          { value: 'month', label: '30 ngày' },
          { value: 'quarter', label: 'Quý này' },
        ]}
      />
      {q.isError && <Alert type="error" message="Bạn không có quyền xem tổng quan, hoặc chưa tải được." />}
      {o && (
        <>
          <Space wrap>
            {AUDIT_GROUP_KEYS.map((g) => (
              <Card key={g} size="small" style={{ minWidth: 150 }}>
                <Statistic title={AUDIT_GROUPS[g].label} value={o.groups[g] ?? 0} suffix={<small>trước: {o.previous[g] ?? 0}</small>} />
              </Card>
            ))}
            <Card size="small" style={{ minWidth: 150 }}>
              <Statistic title="Cảnh báo chưa xử lý" value={o.openAlerts} />
            </Card>
          </Space>
          <Space wrap align="start">
            {Object.entries({ 'phone.reveal': 'Top hiện SĐT', 'export.create': 'Top xuất file', 'customer.view': 'Top mở hồ sơ', 'mcp.call': 'Top AI đọc' }).map(([k, label]) => (
              <Card key={k} size="small" title={label} style={{ minWidth: 240 }}>
                <Table
                  size="small"
                  rowKey="actorId"
                  pagination={false}
                  dataSource={o.top[k] ?? []}
                  locale={{ emptyText: 'Chưa có' }}
                  columns={[{ title: 'Người', dataIndex: 'actorName' }, { title: 'Số lần', dataIndex: 'count', width: 70 }]}
                />
              </Card>
            ))}
          </Space>
        </>
      )}
    </Space>
  );
}

export default function AuditTab() {
  return (
    <Tabs
      size="small"
      items={[
        { key: 'log', label: 'Nhật ký', children: <LogTab /> },
        { key: 'overview', label: 'Tổng quan kiểm soát', children: <OverviewTab /> },
      ]}
    />
  );
}

