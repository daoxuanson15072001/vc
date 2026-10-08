import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, message } from 'antd';
import { ALERT_STATUS_LABELS, ROLE_LABELS, type AlertRuleView, type AlertStatus, type AlertView, type RoleKey } from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';
import { fullTime } from '../../utils/time';
import { auditApi } from './auditApi';

/** MH-PQ-14 "Cảnh báo": the alerts addressed to me, and the rules (Admin saves, QS proposes). */
const COLORS: Record<AlertStatus, string> = { moi: 'red', da_xem: 'blue', da_xu_ly: 'default' };

function AlertList() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | undefined>('moi');
  const [handling, setHandling] = useState<AlertView | null>(null);
  const [note, setNote] = useState('');
  const q = useQuery({ queryKey: ['alerts', status], queryFn: () => auditApi.alerts({ status }) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['alerts'] });
  const seen = useMutation({ mutationFn: auditApi.seen, onSuccess: refresh, onError: (e: Error) => message.error(e.message) });
  const done = useMutation({
    mutationFn: (v: { id: string; note: string }) => auditApi.handle(v.id, v.note),
    onSuccess: () => {
      message.success('Đã ghi nhận xử lý cảnh báo.');
      setHandling(null);
      setNote('');
      refresh();
    },
    onError: (e: Error) => message.error(e.message),
  });
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Select
        allowClear
        placeholder="Trạng thái"
        value={status}
        onChange={setStatus}
        style={{ width: 160 }}
        options={(Object.keys(ALERT_STATUS_LABELS) as AlertStatus[]).map((s) => ({ value: s, label: ALERT_STATUS_LABELS[s] }))}
      />
      {q.isError && <Alert type="error" showIcon message="Không tải được cảnh báo." action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />}
      <Table
        rowKey="id"
        size="small"
        loading={q.isLoading}
        dataSource={q.data?.items ?? []}
        locale={{ emptyText: 'Không có cảnh báo nào.' }}
        pagination={false}
        columns={[
          { title: 'Lúc', dataIndex: 'at', width: 150, render: (v: string) => fullTime(v) },
          { title: 'Quy tắc', render: (_, r) => `${r.rule} ${r.ruleName}` },
          { title: 'Chi tiết', dataIndex: 'summary' },
          { title: 'Trạng thái', dataIndex: 'status', width: 100, render: (s: AlertStatus) => <Tag color={COLORS[s]}>{ALERT_STATUS_LABELS[s]}</Tag> },
          {
            title: '',
            width: 190,
            render: (_, r) => (
              <Space>
                {r.status === 'moi' && <Button size="small" onClick={() => seen.mutate(r.id)}>Xem</Button>}
                {r.status !== 'da_xu_ly' && <Button size="small" type="primary" onClick={() => setHandling(r)}>Đã xử lý</Button>}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={!!handling}
        title="Đã xử lý cảnh báo"
        okText="Ghi nhận"
        cancelText="Hủy"
        okButtonProps={{ disabled: note.trim().length < 10, loading: done.isPending }}
        onCancel={() => setHandling(null)}
        onOk={() => handling && done.mutate({ id: handling.id, note: note.trim() })}
      >
        <p>{handling?.summary}</p>
        <Input.TextArea rows={3} maxLength={500} showCount value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú xử lý (10–500 ký tự)" />
      </Modal>
    </Space>
  );
}

const RECIPIENTS = ['giam_sat_bh', 'giam_doc_bh', 'quan_sat', 'admin'] as const;

function RuleTable() {
  const perms = usePermissions();
  const full = perms.me?.permissions['alert.config']?.mode === 'full' || !!perms.me?.legacy;
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ['alert-rules'], queryFn: auditApi.rules });
  const [edit, setEdit] = useState<AlertRuleView | null>(null);
  const [form] = Form.useForm<{ threshold: number; dayThreshold?: number; recipients: string[]; reason?: string }>();
  const save = useMutation({
    mutationFn: async (v: { rule: AlertRuleView; values: { threshold: number; dayThreshold?: number; recipients: string[]; reason?: string } }) => {
      const patch = { threshold: v.values.threshold, ...(v.values.dayThreshold ? { dayThreshold: v.values.dayThreshold } : {}), recipients: v.values.recipients };
      if (full) return auditApi.saveRule(v.rule.code, patch);
      return auditApi.propose(v.rule.code, v.values.reason ?? '', patch);
    },
    onSuccess: (_r, v) => {
      message.success(full ? `Đã lưu quy tắc ${v.rule.code}.` : 'Đã gửi đề xuất tới quản trị viên.');
      setEdit(null);
      void qc.invalidateQueries({ queryKey: ['alert-rules'] });
    },
    onError: (e: Error) => message.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { code: string; enabled: boolean }) => auditApi.saveRule(v.code, { enabled: v.enabled }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['alert-rules'] }),
    onError: (e: Error) => message.error(e.message),
  });
  return (
    <>
      <Table
        rowKey="code"
        size="small"
        loading={rules.isLoading}
        dataSource={rules.data ?? []}
        pagination={false}
        columns={[
          { title: 'Mã', dataIndex: 'code', width: 56 },
          { title: 'Quy tắc', render: (_, r) => (r.ready ? r.name : <span>{r.name} <Tag>Chưa áp dụng: {r.waitingFor}</Tag></span>) },
          { title: 'Ngưỡng', render: (_, r) => `${r.threshold}${r.dayThreshold ? ` / ${r.dayThreshold} mỗi ngày` : ''}` },
          { title: 'Người nhận', render: (_, r) => r.recipients.map((x) => ROLE_LABELS[x as RoleKey] ?? x).join(', ') },
          { title: 'Bật', width: 70, render: (_, r) => <Switch size="small" checked={r.enabled} disabled={!full || !r.ready} onChange={(enabled) => toggle.mutate({ code: r.code, enabled })} /> },
          {
            title: '',
            width: 120,
            render: (_, r) =>
              r.ready && (
                <Button
                  size="small"
                  onClick={() => {
                    setEdit(r);
                    form.setFieldsValue({ threshold: r.threshold, dayThreshold: r.dayThreshold, recipients: r.recipients, reason: undefined });
                  }}
                >
                  {full ? 'Sửa' : 'Đề xuất sửa'}
                </Button>
              ),
          },
        ]}
      />
      <Modal
        open={!!edit}
        title={`${edit?.code ?? ''} ${edit?.name ?? ''}`}
        okText={full ? 'Lưu quy tắc' : 'Gửi đề xuất'}
        cancelText="Hủy"
        confirmLoading={save.isPending}
        onCancel={() => setEdit(null)}
        onOk={() => form.validateFields().then((values) => edit && save.mutate({ rule: edit, values }))}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="threshold" label="Ngưỡng" rules={[{ required: true, type: 'number', min: 0.01, message: 'Ngưỡng phải lớn hơn 0' }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          {edit?.dayThreshold !== undefined && (
            <Form.Item name="dayThreshold" label="Ngưỡng mỗi ngày">
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
          )}
          <Form.Item name="recipients" label="Người nhận" rules={[{ required: true, type: 'array', min: 1, message: 'Cần ít nhất 1 người nhận' }]}>
            <Select mode="multiple" options={RECIPIENTS.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
          </Form.Item>
          {!full && (
            <Form.Item name="reason" label="Lý do đề xuất" rules={[{ required: true, min: 10, max: 500, message: 'Lý do 10–500 ký tự' }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

export default function AlertsTab() {
  return (
    <Tabs
      size="small"
      items={[
        { key: 'alerts', label: 'Cảnh báo', children: <AlertList /> },
        { key: 'rules', label: 'Quy tắc', children: <RuleTable /> },
      ]}
    />
  );
}
