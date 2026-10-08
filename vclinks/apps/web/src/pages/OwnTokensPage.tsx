import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { MCP_GROUP_LABELS, REVOKE_REASON_LABELS, type McpGroup, type TokenRow } from '@vclinks/shared';
import { fullTime } from '../utils/time';
import RevokeModal from './admin/RevokeModal';
import ShowTokenModal from './admin/ShowTokenModal';
import { tokensApi } from './admin/tokensApi';

/** MH-PQ-09 "Token MCP của tôi": only my own tokens; the string is shown once at creation. */
export default function OwnTokensPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings', 'tokens'], queryFn: tokensApi.own });
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<TokenRow | null>(null);
  const [form] = Form.useForm<{ name: string; groups: McpGroup[]; days: 30 | 60 | 90 }>();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['settings', 'tokens'] });
  const create = useMutation({
    mutationFn: tokensApi.createOwn,
    onSuccess: (r) => {
      message.success(`Đã tạo token ${r.name}.`);
      setOpen(false);
      form.resetFields();
      setSecret(r.secret);
      refresh();
    },
    onError: (e: Error) => message.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: (v: { id: string; reason: Parameters<typeof tokensApi.revokeOwn>[1] }) => tokensApi.revokeOwn(v.id, v.reason),
    onSuccess: () => {
      message.success(`Đã thu hồi token ${revoking?.name ?? ''}.`);
      setRevoking(null);
      refresh();
    },
    onError: (e: Error) => message.error(e.message),
  });
  const mcpUrl = `${window.location.origin}/mcp`;
  return (
    <Card title="Token MCP của tôi" style={{ maxWidth: 960 }} extra={<Button type="primary" disabled={!q.data?.canCreate} title={q.data?.reason ?? undefined} onClick={() => setOpen(true)}>+ Tạo token</Button>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Alert type="info" showIcon message="AI dùng token này có đúng quyền của bạn: chỉ thấy khách và hội thoại bạn thấy, chỉ tạo nháp, không bao giờ tự gửi tin cho khách. Mọi lần gọi đều được ghi nhật ký." />
        {q.data?.reason && <Alert type="warning" showIcon message={q.data.reason} />}
        <Table
          rowKey="id"
          size="small"
          loading={q.isLoading}
          dataSource={q.data?.items ?? []}
          pagination={false}
          locale={{ emptyText: q.isError ? 'Không tải được token.' : 'Bạn chưa có token MCP. Tạo token để dùng Claude với dữ liệu VClinks của bạn.' }}
          columns={[
            { title: 'Tên token', dataIndex: 'name' },
            { title: 'Nhóm tool', render: (_, r) => r.groups.map((g) => MCP_GROUP_LABELS[g]).join(', ') },
            { title: 'Hết hạn', render: (_, r) => (r.expiresAt ? fullTime(r.expiresAt) : '–') },
            { title: 'Dùng lần cuối', render: (_, r) => (r.lastUsedAt ? fullTime(r.lastUsedAt) : 'Chưa dùng') },
            { title: 'IP lần cuối', render: (_, r) => r.lastIp ?? '–' },
            { title: 'Số lần gọi 7 ngày', render: (_, r) => r.calls7d ?? 0 },
            {
              title: '',
              render: (_, r) =>
                r.revokedAt ? <Tag>Đã thu hồi{r.revokedReason ? ` · ${REVOKE_REASON_LABELS[r.revokedReason]}` : ''}{r.revokedBy ? ` · ${r.revokedBy}` : ''}</Tag> : <Button size="small" danger onClick={() => setRevoking(r)}>Thu hồi</Button>,
            },
          ]}
        />
        <div>Địa chỉ MCP: <Typography.Text code copyable>{mcpUrl}</Typography.Text></div>
      </Space>
      <Modal open={open} title="Tạo token MCP" okText="Tạo" cancelText="Hủy" confirmLoading={create.isPending} onCancel={() => setOpen(false)} onOk={() => form.validateFields().then((v) => create.mutate(v))}>
        <Form form={form} layout="vertical" initialValues={{ name: 'Claude Desktop', groups: ['doc'], days: 30 }}>
          <Form.Item name="name" label="Tên token" rules={[{ required: true, min: 3, max: 60, message: '3–60 ký tự' }]}><Input /></Form.Item>
          {q.data?.proposeReason && <Alert style={{ marginBottom: 12 }} type="warning" showIcon message={q.data.proposeReason} />}
          <Form.Item name="groups" label="Nhóm tool">
            <Checkbox.Group options={[{ value: 'doc', label: 'Đọc', disabled: true }, { value: 'de_xuat', label: 'Đề xuất', disabled: !q.data?.canPropose }]} />
          </Form.Item>
          <Form.Item name="days" label="Hết hạn"><Select options={[30, 60, 90].map((d) => ({ value: d, label: `${d} ngày` }))} /></Form.Item>
        </Form>
      </Modal>
      <RevokeModal name={revoking?.name ?? ''} open={!!revoking} loading={revoke.isPending} onCancel={() => setRevoking(null)} onOk={(reason) => revoking && revoke.mutate({ id: revoking.id, reason })} />
      <ShowTokenModal secret={secret} onClose={() => setSecret(null)} />
    </Card>
  );
}
