import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Collapse, Form, Input, Modal, Popconfirm, Radio, Select, Space, Table, Tag, message } from 'antd';
import { useState } from 'react';
import { CHANNEL_ACCESS_LEVEL_LABELS, type ChannelAssignRow } from '@vclinks/shared';
import { usePermissions } from '../../state/permissions';
import { fullTime } from '../../utils/time';
import { adminApi } from './adminApi';
import { tokensApi } from './tokensApi';

const OFFICIAL = new Set(['zalo_oa', 'fb_page']);

/** MH-PQ-06 "Gán kênh": nick holders, who works the official channels, and nicks awaiting confirmation. */
export default function ChannelAccessTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const list = useQuery({ queryKey: ['admin', 'channels', search], queryFn: () => tokensApi.channels({ search }) });
  const [selected, setSelected] = useState<string>();
  const items = list.data?.items ?? [];
  const current = items.find((i) => i.uid === selected) ?? items[0];
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] });
  const [adding, setAdding] = useState(false);
  const perms = usePermissions();
  const confirmSafe = useMutation({
    mutationFn: (uid: string) => adminApi.safetyConfirm(uid),
    onSuccess: (r) => { message.success(r.message); refresh(); },
    onError: (e: Error) => message.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (v: { uid: string; id: string }) => tokensApi.removeAccess(v.uid, v.id),
    onSuccess: () => { message.success('Đã gỡ khỏi kênh.'); refresh(); },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <PendingNicks />
      <Input.Search allowClear placeholder="Tìm: tên kênh, người giữ" style={{ width: 320 }} onSearch={setSearch} />
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Table
          rowKey="uid"
          size="small"
          style={{ flex: '1 1 380px', minWidth: 320 }}
          loading={list.isLoading}
          dataSource={items}
          pagination={false}
          locale={{ emptyText: list.isError ? 'Không tải được danh sách kênh.' : 'Division này chưa kết nối kênh nào.' }}
          onRow={(r) => ({ onClick: () => setSelected(r.uid), style: { cursor: 'pointer', background: r.uid === current?.uid ? 'var(--ant-color-primary-bg, #e6f4ff)' : undefined } })}
          columns={[
            { title: 'Kênh', render: (_, r) => <><b>{r.label}</b> <Tag>{r.channel}</Tag></> },
            { title: 'Người giữ', render: (_, r) => (OFFICIAL.has(r.channel) ? `${r.access.length} dòng` : r.holderName ?? <Tag color="orange">⚠ chưa gán</Tag>) },
            { title: '', render: (_, r) => r.unsafe && <Tag color="red">Chưa an toàn</Tag> },
            {
              title: '',
              render: (_, r) =>
                r.unsafe && perms.has('channel.safety_confirm') ? (
                  <Popconfirm title={`Xác nhận nick ${r.label} đã đăng xuất khỏi thiết bị cũ và đã đổi mật khẩu?`} okText="Xác nhận" cancelText="Hủy" onConfirm={() => confirmSafe.mutate(r.uid)}>
                    <Button size="small" onClick={(e) => e.stopPropagation()}>Xác nhận đã đăng xuất</Button>
                  </Popconfirm>
                ) : null,
            },
          ]}
        />
        <div style={{ flex: '2 1 480px', minWidth: 320 }}>
          {current ? (
            <>
              <Space style={{ marginBottom: 8 }}>
                <b>{current.label}</b>
                <Button size="small" type="primary" onClick={() => setAdding(true)}>
                  {OFFICIAL.has(current.channel) ? '+ Thêm người / nhóm' : current.holderUserId ? 'Đổi người giữ nick' : 'Gán người giữ nick'}
                </Button>
              </Space>
              {!current.access.length && <Alert type="warning" showIcon message="Chưa ai được gán kênh này. Tin nhắn vẫn được lưu nhưng không ai xem được ngoài giám đốc bán hàng." style={{ marginBottom: 8 }} />}
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={current.access}
                columns={[
                  { title: 'Người / nhóm', render: (_, r) => <>{r.principalName} <Tag>{r.principalType === 'user' ? 'Người' : 'Đơn vị'}</Tag></> },
                  { title: 'Mức', render: (_, r) => CHANNEL_ACCESS_LEVEL_LABELS[r.level] },
                  { title: 'Từ', render: (_, r) => (r.from ? fullTime(r.from) : '–') },
                  { title: 'Đến', render: (_, r) => (r.to ? fullTime(r.to) : '–') },
                  {
                    title: '',
                    render: (_, r) =>
                      r.level === 'giu_nick' ? (
                        <span title="Chọn người giữ nick mới thay vì gỡ.">–</span>
                      ) : (
                        <Popconfirm title={`Gỡ ${r.principalName} khỏi ${current.label}?`} okText="Gỡ" cancelText="Hủy" onConfirm={() => remove.mutate({ uid: current.uid, id: r.id })}>
                          <Button size="small" danger>Gỡ</Button>
                        </Popconfirm>
                      ),
                  },
                ]}
              />
              <AddModal row={adding ? current : null} onClose={() => setAdding(false)} onDone={() => { setAdding(false); refresh(); }} />
            </>
          ) : (
            <Alert type="info" message="Chọn một kênh ở bên trái." />
          )}
        </div>
      </div>
    </Space>
  );
}

function AddModal({ row, onClose, onDone }: { row: ChannelAssignRow | null; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm<{ principalType: 'user' | 'org_unit'; principalId: string; level: 'giu_nick' | 'gui' | 'xem' | 'lead'; note?: string }>();
  const official = !!row && OFFICIAL.has(row.channel);
  const users = useQuery({ queryKey: ['admin', 'users', 'all'], queryFn: () => adminApi.users({ pageSize: 200 }), enabled: !!row });
  const units = useQuery({ queryKey: ['admin', 'units'], queryFn: adminApi.units, enabled: !!row });
  const type = Form.useWatch('principalType', form) ?? 'user';
  const go = useMutation({
    mutationFn: (v: Parameters<typeof tokensApi.addAccess>[1]) => tokensApi.addAccess(row!.uid, v, !official && !!row?.holderUserId),
    onSuccess: (r) => { message.success(r.message); form.resetFields(); onDone(); },
    onError: (e: Error) => message.error(e.message),
  });
  const needReason = !official && !!row?.holderUserId;
  return (
    <Modal open={!!row} title={row ? `Gán ${row.label}` : ''} okText="Lưu" cancelText="Hủy" confirmLoading={go.isPending} onCancel={onClose} onOk={() => form.validateFields().then((v) => go.mutate({ ...v, principalType: official ? v.principalType ?? 'user' : 'user' }))}>
      {needReason && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`Chuyển nick từ ${row?.holderName} sang người mới? ${row?.holderName} sẽ không còn thấy hội thoại trên nick này.`} />}
      <Form form={form} layout="vertical" initialValues={{ principalType: 'user', level: official ? 'xem' : 'giu_nick' }}>
        {official && (
          <Form.Item name="principalType" label="Gán cho">
            <Radio.Group options={[{ value: 'user', label: 'Người' }, { value: 'org_unit', label: 'Đơn vị / nhóm' }]} />
          </Form.Item>
        )}
        <Form.Item name="principalId" label={type === 'user' ? 'Người' : 'Đơn vị'} rules={[{ required: true, message: 'Chọn người hoặc đơn vị' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={type === 'user' ? (users.data?.items ?? []).map((u) => ({ value: u.id, label: u.fullName })) : (units.data ?? []).filter((u) => u.active).map((u) => ({ value: u.id, label: u.name }))}
          />
        </Form.Item>
        <Form.Item name="level" label="Mức" rules={[{ required: true }]}>
          <Radio.Group
            options={(official ? (['gui', 'xem', 'lead'] as const) : (['giu_nick'] as const)).map((l) => ({ value: l, label: CHANNEL_ACCESS_LEVEL_LABELS[l] }))}
          />
        </Form.Item>
        <Form.Item name="note" label="Lý do / ghi chú" rules={needReason ? [{ required: true, min: 10, message: 'Ít nhất 10 ký tự' }] : []}><Input.TextArea rows={2} maxLength={500} /></Form.Item>
      </Form>
    </Modal>
  );
}

/** "Nick chờ xác nhận" (PQ-52 d): counts only, never content. Only an Admin may act. */
function PendingNicks() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'pending-nicks'], queryFn: tokensApi.pending, retry: false });
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [form] = Form.useForm<{ divisionId: string; holderUserId?: string }>();
  const [reason, setReason] = useState('');
  const units = useQuery({ queryKey: ['admin', 'units'], queryFn: adminApi.units, enabled: !!confirmFor });
  const users = useQuery({ queryKey: ['admin', 'users', 'all'], queryFn: () => adminApi.users({ pageSize: 200 }), enabled: !!confirmFor });
  const done = (m: string) => { message.success(m); setConfirmFor(null); setRejectFor(null); setReason(''); void qc.invalidateQueries({ queryKey: ['admin'] }); };
  const confirm = useMutation({ mutationFn: (v: { divisionId: string; holderUserId?: string }) => tokensApi.confirmNick(confirmFor!, v), onSuccess: (r) => done(r.message), onError: (e: Error) => message.error(e.message) });
  const reject = useMutation({ mutationFn: () => tokensApi.rejectNick(rejectFor!, reason), onSuccess: (r) => done(r.message), onError: (e: Error) => message.error(e.message) });
  if (q.isError || !q.data?.length) return null;
  return (
    <>
      <Collapse
        items={[{
          key: 'p',
          label: <>Nick chờ xác nhận <Badge count={q.data.length} color="gold" /></>,
          children: (
            <Table
              rowKey="uid"
              size="small"
              pagination={false}
              dataSource={q.data}
              columns={[
                { title: 'Nick', dataIndex: 'label' },
                { title: 'Thiết bị', render: (_, r) => r.deviceName ?? '–' },
                { title: 'Đăng ký lúc', render: (_, r) => fullTime(r.registeredAt) },
                { title: 'Số tin đã nhận', dataIndex: 'records' },
                { title: '', render: (_, r) => <Space><Button size="small" type="primary" onClick={() => setConfirmFor(r.uid)}>Xác nhận vào division</Button><Button size="small" danger onClick={() => setRejectFor(r.uid)}>Từ chối và xóa</Button></Space> },
              ]}
            />
          ),
        }]}
      />
      <Modal open={!!confirmFor} title="Xác nhận nick vào division" okText="Xác nhận" cancelText="Hủy" confirmLoading={confirm.isPending} onCancel={() => setConfirmFor(null)} onOk={() => form.validateFields().then((v) => confirm.mutate(v))}>
        <Form form={form} layout="vertical">
          <Form.Item name="divisionId" label="Division" rules={[{ required: true }]}><Select options={(units.data ?? []).filter((u) => u.type === 'division').map((u) => ({ value: u.id, label: u.name }))} /></Form.Item>
          <Form.Item name="holderUserId" label="Người giữ nick (tùy chọn)"><Select allowClear showSearch optionFilterProp="label" options={(users.data?.items ?? []).map((u) => ({ value: u.id, label: u.fullName }))} /></Form.Item>
        </Form>
      </Modal>
      <Modal open={!!rejectFor} title="Từ chối nick và xóa dữ liệu đã nhận" okText="Từ chối và xóa" cancelText="Hủy" okButtonProps={{ danger: true, disabled: reason.trim().length < 10, loading: reject.isPending }} onCancel={() => setRejectFor(null)} onOk={() => reject.mutate()}>
        <Input.TextArea rows={3} placeholder="Lý do (ít nhất 10 ký tự)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
