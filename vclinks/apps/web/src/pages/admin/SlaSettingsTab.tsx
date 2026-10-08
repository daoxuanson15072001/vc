import { useState } from 'react';
import { Alert, App, Button, Card, Form, Input, InputNumber, Popconfirm, Select, Skeleton, Space, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WEEKDAY_LABELS, type SlaConfig, type SlaSettingsInput, type SlaSettingsList, type SlaSettingsRow, type WorkCalendar } from '@vclinks/shared';
import { api } from '../../api';
import { fullTime } from '../../utils/time';

type DayKey = keyof WorkCalendar['weekdays'];

/** `08:00-12:00, 13:30-17:30` ↔ the windows of a day; an empty text is a day off. */
const daysText = (w: [string, string][] | undefined) => (w ?? []).map(([a, b]) => `${a}-${b}`).join(', ');
const parseDay = (text: string): [string, string][] =>
  text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.split('-').map((y) => y.trim()) as [string, string]);

const calendarSummary = (c: SlaConfig) =>
  WEEKDAY_LABELS.filter(([k]) => c.calendar.weekdays[k]?.length)
    .map(([k, label]) => `${label} ${daysText(c.calendar.weekdays[k])}`)
    .join(' · ');

interface FormValues {
  slaMinutes: number;
  warnPercent: number;
  days: Record<DayKey, string>;
  holidays: string[];
}

function EditForm({ row, onDone }: { row: SlaSettingsRow; onDone: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const save = useMutation({
    mutationFn: (body: SlaSettingsInput) => api<SlaSettingsList>(`/admin/sla-settings/${encodeURIComponent(row.divisionId)}`, { method: 'PUT', body }),
    onSuccess: (data) => {
      qc.setQueryData(['admin', 'sla-settings'], data);
      message.success(`Đã lưu SLA của ${row.divisionName}. Áp dụng cho tin đến từ bây giờ.`);
      onDone();
    },
    onError: (e) => message.error((e as Error).message),
  });
  const initial: FormValues = {
    slaMinutes: row.config.slaMinutes,
    warnPercent: Math.round(row.config.warnRatio * 100),
    days: Object.fromEntries(WEEKDAY_LABELS.map(([k]) => [k, daysText(row.config.calendar.weekdays[k])])) as Record<DayKey, string>,
    holidays: row.config.calendar.holidays,
  };
  const submit = (v: FormValues) => {
    const weekdays: WorkCalendar['weekdays'] = {};
    for (const [k] of WEEKDAY_LABELS) {
      const w = parseDay(v.days?.[k] ?? '');
      if (w.length) weekdays[k] = w;
    }
    save.mutate({ slaMinutes: v.slaMinutes, warnRatio: v.warnPercent / 100, calendar: { weekdays, holidays: [...new Set(v.holidays ?? [])].sort() } });
  };
  return (
    <Form form={form} layout="vertical" initialValues={initial} onFinish={submit} requiredMark={false} style={{ maxWidth: 620 }}>
      <Space wrap size="large">
        <Form.Item name="slaMinutes" label="Phải trả lời trong (phút làm việc)" rules={[{ required: true }]}>
          <InputNumber min={1} max={480} />
        </Form.Item>
        <Form.Item name="warnPercent" label="Báo 'sắp quá' khi còn (% thời gian)" rules={[{ required: true }]}>
          <InputNumber min={5} max={90} addonAfter="%" />
        </Form.Item>
      </Space>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Giờ làm việc mỗi ngày, dạng <code>08:00-12:00, 13:30-17:30</code> (khoảng nghỉ trưa là chỗ trống giữa hai khung). Để trống là ngày nghỉ.
      </Typography.Text>
      {WEEKDAY_LABELS.map(([k, label]) => (
        <Form.Item
          key={k}
          name={['days', k]}
          label={label}
          rules={[{ pattern: /^\s*(([01]\d|2[0-3]):[0-5]\d\s*-\s*([01]\d|2[0-3]):[0-5]\d\s*(,\s*|$))*$/, message: 'Dạng 08:00-12:00, 13:30-17:30' }]}
          style={{ marginBottom: 8 }}
        >
          <Input placeholder="Nghỉ" />
        </Form.Item>
      ))}
      <Form.Item name="holidays" label="Ngày lễ (không tính giờ làm việc), dạng yyyy-mm-dd">
        <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="2026-01-01" />
      </Form.Item>
      <Space>
        <Button type="primary" htmlType="submit" loading={save.isPending}>
          Lưu
        </Button>
        <Button onClick={onDone}>Hủy</Button>
      </Space>
    </Form>
  );
}

/**
 * Quản trị → "SLA và giờ làm việc" (config.sla): first-response minutes and work calendar per division. Sales
 * directors change their own division; Admin and observers read. Reports and the "Quá …" chips follow these hours.
 */
export default function SlaSettingsTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'sla-settings'], queryFn: () => api<SlaSettingsList>('/admin/sla-settings') });
  const [editing, setEditing] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: (id: string) => api<SlaSettingsList>(`/admin/sla-settings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: (data) => {
      qc.setQueryData(['admin', 'sla-settings'], data);
      message.success('Division đã quay về cài đặt chung.');
    },
    onError: (e) => message.error((e as Error).message),
  });
  if (q.isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (q.isError) return <Alert type="error" showIcon message="Không tải được cài đặt SLA." action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />;
  const data = q.data!;
  const row = data.divisions.find((d) => d.divisionId === editing);
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Alert
        type="info"
        showIcon
        message="SLA là thời gian phải trả lời tin đầu tiên của khách, chỉ tính giờ làm việc. Giám đốc bán hàng sửa division của mình; Admin chỉ xem."
        description={`Cài đặt chung${data.defaultIsBuiltIn ? ' (mặc định của hệ thống)' : ''}: ${data.default.slaMinutes} phút, báo sắp quá khi còn ${Math.round(data.default.warnRatio * 100)}%. ${calendarSummary(data.default)}.`}
      />
      {row ? (
        <Card title={`Sửa SLA · ${row.divisionName}`}>
          <EditForm row={row} onDone={() => setEditing(null)} />
        </Card>
      ) : (
        <Table<SlaSettingsRow>
          rowKey="divisionId"
          dataSource={data.divisions}
          pagination={false}
          locale={{ emptyText: 'Không có division nào trong phạm vi của bạn.' }}
          columns={[
            { title: 'Division', dataIndex: 'divisionName' },
            {
              title: 'SLA',
              render: (_, r) => (
                <Space direction="vertical" size={0}>
                  <span>
                    {r.config.slaMinutes} phút · báo khi còn {Math.round(r.config.warnRatio * 100)}% {r.own ? <Tag color="blue">Riêng</Tag> : <Tag>Theo cài đặt chung</Tag>}
                  </span>
                  <Typography.Text type="secondary">{calendarSummary(r.config)}</Typography.Text>
                  {r.config.calendar.holidays.length > 0 && <Typography.Text type="secondary">Ngày lễ: {r.config.calendar.holidays.join(', ')}</Typography.Text>}
                </Space>
              ),
            },
            { title: 'Cập nhật', render: (_, r) => (r.updatedAt ? fullTime(r.updatedAt) : '–') },
            {
              title: '',
              render: (_, r) =>
                r.canEdit ? (
                  <Space>
                    <Button size="small" onClick={() => setEditing(r.divisionId)}>
                      Sửa
                    </Button>
                    {r.own && (
                      <Popconfirm title={`Đưa ${r.divisionName} về cài đặt chung?`} okText="Đồng ý" cancelText="Hủy" onConfirm={() => reset.mutate(r.divisionId)}>
                        <Button size="small">Về cài đặt chung</Button>
                      </Popconfirm>
                    )}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">Chỉ xem</Typography.Text>
                ),
            },
          ]}
        />
      )}
    </Space>
  );
}
