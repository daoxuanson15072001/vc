import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Descriptions, Drawer, Dropdown, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { useState } from 'react';
import { TOKEN_KIND_LABELS, REVOKE_REASON_LABELS, type TokenKind, type TokenRow } from '@vclinks/shared';
import { fullTime } from '../../utils/time';
import RevokeModal from './RevokeModal';
import ShowTokenModal from './ShowTokenModal';
import { tokensApi } from './tokensApi';

const WEEK = 7 * 24 * 3600_000;

/** MH-PQ-08 "Token & thiết bị": table of every token (never a string), pairing by code, system tokens. */
export default function TokensTab() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<string>();
  const [status, setStatus] = useState<string>('active');
  const [search, setSearch] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [impactOf, setImpactOf] = useState<TokenRow | null>(null);
  const [revoking, setRevoking] = useState<TokenRow | null>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const [createKind, setCreateKind] = useState<'sync' | 'agent' | null>(null);
  const list = useQuery({ queryKey: ['admin', 'tokens', kind, status, search], queryFn: () => tokensApi.tokens({ kind, status, search }) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'tokens'] });
  const revoke = useMutation({
    mutationFn: (v: { id: string; reason: Parameters<typeof tokensApi.revoke>[1] }) => tokensApi.revoke(v.id, v.reason),
    onSuccess: () => {
      message.success(`Đã thu hồi token ${revoking?.name ?? ''}.`);
      setRevoking(null);
      refresh();
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <Select allowClear placeholder="Loại" style={{ width: 200 }} value={kind} onChange={setKind} options={(['device', 'mcp_user', 'sync', 'agent', 'legacy'] as TokenKind[]).map((k) => ({ value: k, label: TOKEN_KIND_LABELS[k] }))} />
        <Select style={{ width: 160 }} value={status} onChange={setStatus} options={[{ value: 'active', label: 'Đang dùng' }, { value: 'revoked', label: 'Đã thu hồi' }]} />
        <Input.Search allowClear placeholder="Tìm: người, tên token, nick" style={{ width: 260 }} onSearch={setSearch} />
        <Button type="primary" onClick={() => setPairOpen(true)}>Ghép thiết bị</Button>
        <Dropdown menu={{ items: [{ key: 'sync', label: 'Token đồng bộ kênh' }, { key: 'agent', label: 'Token tác tử gửi' }], onClick: ({ key }) => setCreateKind(key as 'sync' | 'agent') }}>
          <Button>+ Tạo token</Button>
        </Dropdown>
      </Space>
      <Alert type="info" showIcon message="Token MCP cá nhân chỉ chính chủ tạo được (Hồ sơ → Token MCP của tôi). Quản trị viên chỉ xem và thu hồi, không bao giờ thấy chuỗi token." />
      <Table
        rowKey="id"
        size="small"
        loading={list.isLoading}
        dataSource={list.data ?? []}
        locale={{ emptyText: list.isError ? 'Không tải được danh sách token.' : 'Chưa có token nào.' }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        columns={[
          { title: 'Tên token', render: (_, r) => <Button type="link" style={{ padding: 0 }} onClick={() => setImpactOf(r)}>{r.name}</Button> },
          { title: 'Loại', render: (_, r) => TOKEN_KIND_LABELS[r.kind] },
          { title: 'Người / thiết bị', render: (_, r) => r.ownerName ?? r.deviceName ?? '–' },
          { title: 'Nick', render: (_, r) => (r.uids.length ? r.uids.join(', ') : r.kind === 'legacy' || r.kind === 'device' ? <Tag color="orange">Chưa gắn nick</Tag> : '–') },
          {
            title: 'Hết hạn',
            render: (_, r) => (r.expiresAt ? <>{fullTime(r.expiresAt)} {Date.parse(r.expiresAt) - Date.now() < WEEK && !r.revokedAt && <Tag color="orange">Sắp hết hạn</Tag>}</> : 'Không hạn'),
          },
          { title: 'Dùng lần cuối', render: (_, r) => (r.lastUsedAt ? fullTime(r.lastUsedAt) : 'Chưa dùng') },
          { title: 'IP lần cuối', dataIndex: 'lastIp', render: (v: string | null) => v ?? '–' },
          {
            title: '',
            render: (_, r) =>
              r.revokedAt ? (
                <Tag>Đã thu hồi{r.revokedReason ? ` · ${REVOKE_REASON_LABELS[r.revokedReason]}` : ''}</Tag>
              ) : (
                <Button size="small" danger onClick={() => setRevoking(r)}>Thu hồi</Button>
              ),
          },
        ]}
      />
      <ImpactDrawer token={impactOf} onClose={() => setImpactOf(null)} />
      <RevokeModal name={revoking?.name ?? ''} open={!!revoking} loading={revoke.isPending} onCancel={() => setRevoking(null)} onOk={(reason) => revoking && revoke.mutate({ id: revoking.id, reason })} />
      <ShowTokenModal secret={secret} onClose={() => setSecret(null)} />
      <PairModal open={pairOpen} onClose={() => setPairOpen(false)} onDone={() => { setPairOpen(false); refresh(); }} />
      <CreateSystemModal kind={createKind} onClose={() => setCreateKind(null)} onCreated={(s) => { setCreateKind(null); setSecret(s); refresh(); }} />
    </Space>
  );
}

/** Personal nicks and channels an Admin may bind a token to. */
function useNickOptions() {
  const q = useQuery({ queryKey: ['admin', 'channels', 'options'], queryFn: () => tokensApi.channels({}) });
  return (q.data?.items ?? []).map((c) => ({ value: c.uid, label: `${c.label} (${c.uid})` }));
}

function PairModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm<{ code: string; deviceName?: string; uids: string[]; replaceTokenId?: string }>();
  const nicks = useNickOptions();
  const devices = useQuery({ queryKey: ['admin', 'tokens', 'device-active'], queryFn: () => tokensApi.tokens({ kind: 'device', status: 'active' }), enabled: open });
  const go = useMutation({
    mutationFn: (v: Parameters<typeof tokensApi.approvePairing>[0]) => tokensApi.approvePairing(v),
    onSuccess: () => {
      message.success('Đã ghép thiết bị. Extension sẽ tự nhận token, không ai thấy chuỗi token.');
      form.resetFields();
      onDone();
    },
    onError: (e: Error) => message.error(e.message),
  });
  return (
    <Modal open={open} title="Ghép thiết bị bằng mã" okText="Ghép" cancelText="Hủy" confirmLoading={go.isPending} onCancel={onClose} onOk={() => form.validateFields().then((v) => go.mutate(v))}>
      <Form form={form} layout="vertical" initialValues={{ uids: [] }}>
        <Form.Item name="code" label="Mã ghép (6 số, hiện trên extension)" rules={[{ required: true, pattern: /^\d{6}$/, message: 'Mã ghép gồm 6 chữ số' }]}>
          <Input maxLength={6} inputMode="numeric" />
        </Form.Item>
        <Form.Item name="deviceName" label="Tên thiết bị"><Input maxLength={80} placeholder="Để trống = tên extension gửi lên" /></Form.Item>
        <Form.Item name="uids" label="Nick thiết bị được đẩy" rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một nick' }]}>
          <Select mode="multiple" options={nicks} placeholder="Chọn nick" />
        </Form.Item>
        <Form.Item name="replaceTokenId" label="Thay máy cũ (token cũ bị thu hồi ngay)">
          <Select allowClear options={(devices.data ?? []).map((d) => ({ value: d.id, label: `${d.name} · ${d.uids.join(', ') || 'chưa gắn nick'}` }))} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function CreateSystemModal({ kind, onClose, onCreated }: { kind: 'sync' | 'agent' | null; onClose: () => void; onCreated: (secret: string) => void }) {
  const [form] = Form.useForm<{ name: string; uids: string[]; days: 30 | 60 | 90 }>();
  const nicks = useNickOptions();
  const go = useMutation({
    mutationFn: (v: { name: string; uids: string[]; days: 30 | 60 | 90 }) => tokensApi.createSystem({ ...v, kind: kind! }),
    onSuccess: (r) => {
      message.success(`Đã tạo token ${r.name}.`);
      form.resetFields();
      onCreated(r.secret);
    },
    onError: (e: Error) => message.error(e.message),
  });
  return (
    <Modal open={!!kind} title={kind === 'agent' ? 'Tạo token tác tử gửi' : 'Tạo token đồng bộ kênh'} okText="Tạo" cancelText="Hủy" confirmLoading={go.isPending} onCancel={onClose} onOk={() => form.validateFields().then((v) => go.mutate(v))}>
      <Form form={form} layout="vertical" initialValues={{ days: 90, uids: [] }}>
        <Form.Item name="name" label="Tên token" rules={[{ required: true, min: 3, max: 60, message: '3–60 ký tự' }]}><Input /></Form.Item>
        <Form.Item name="uids" label="Nick / kênh" rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một nick' }]}>
          <Select mode="multiple" options={nicks} />
        </Form.Item>
        <Form.Item name="days" label="Hết hạn"><Select options={[30, 60, 90].map((d) => ({ value: d, label: `${d} ngày` }))} /></Form.Item>
      </Form>
    </Modal>
  );
}

/** "Phạm vi ảnh hưởng" of a token (PQ-47, UAT-PQ-72): calls, conversations read, IPs, 20 latest calls. No token, no content. */
function ImpactDrawer({ token, onClose }: { token: TokenRow | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ['admin', 'tokens', 'impact', token?.id], queryFn: () => tokensApi.impact(token!.id), enabled: !!token });
  const d = q.data;
  return (
    <Drawer open={!!token} onClose={onClose} width={560} title={`Phạm vi ảnh hưởng · ${token?.name ?? ''}`} destroyOnClose>
      {q.isError && <Alert type="error" showIcon message="Không tải được phạm vi ảnh hưởng." />}
      {d && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Chủ token">{d.ownerName ?? '–'}</Descriptions.Item>
            <Descriptions.Item label="Số lần gọi">{d.calls}</Descriptions.Item>
            <Descriptions.Item label="Hội thoại / khách đã trả về">{d.conversationCount}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ IP">{d.ips.length ? d.ips.map((i) => `${i.ip} (${i.calls} lần)`).join(', ') : 'Chưa ghi IP'}</Descriptions.Item>
          </Descriptions>
          {d.conversations.length > 0 && <div><b>Mã hội thoại</b><div style={{ wordBreak: 'break-all' }}>{d.conversations.join(', ')}</div></div>}
          <Table
            rowKey={(r) => `${r.at}${r.tool}`}
            size="small"
            pagination={false}
            dataSource={d.recent}
            locale={{ emptyText: 'Chưa có lần gọi nào.' }}
            columns={[
              { title: 'Lúc', render: (_, r) => fullTime(r.at) },
              { title: 'Công cụ', dataIndex: 'tool' },
              { title: 'Trả về', dataIndex: 'returned' },
              { title: 'IP', render: (_, r) => r.ip ?? '–' },
            ]}
          />
        </Space>
      )}
    </Drawer>
  );
}
