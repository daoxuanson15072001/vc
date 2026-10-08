import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Checkbox, Descriptions, Input, Radio, Select, Space, Steps, Table, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HANDOVER_MODE_LABELS, HANDOVER_MODES, type HandoverMode, type HandoverPlanPreview } from '@vclinks/shared';
import NoAccess from '../../components/access/NoAccess';
import { usePermissions } from '../../state/permissions';
import { adminApi } from './adminApi';

interface NickState {
  toUserId?: string;
  phoneLogoutConfirmed: boolean;
  qrRescanned: boolean;
  note: string;
}

/**
 * MH-PQ-04 "Nghỉ việc & bàn giao" (route /admin/users/:id/offboard): ① lock, ② customers, ③ nicks,
 * ④ summary. VClinks never asks for a password: step ③ only records who confirmed that Zalo was logged out
 * of the old phone and when.
 */
export default function OffboardPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const perms = usePermissions();
  const user = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminApi.user(id) });
  const pre = useQuery({ queryKey: ['admin', 'offboard', id, user.data?.status], queryFn: () => adminApi.offboardPreview(id), enabled: !!user.data });
  const receivers = useQuery({ queryKey: ['admin', 'receivers', id], queryFn: () => adminApi.handoverReceivers(id), enabled: user.data?.status === 'nghi_viec' });
  const locked = user.data?.status === 'nghi_viec';
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (locked && step === 0) setStep(1);
  }, [locked, step]);

  // Step 1
  const [reason, setReason] = useState('');
  const [keep, setKeep] = useState<string[]>([]);
  const isAdmin = !!perms.me?.roles.some((r) => r.roleKey === 'admin');
  const lock = useMutation({
    mutationFn: () => adminApi.offboard(id, reason.trim(), keep),
    onSuccess: (r) => {
      message.success(r.message, 8);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      setStep(1);
    },
    onError: (e: Error) => message.error(e.message),
  });

  // Step 2
  const [mode, setMode] = useState<HandoverMode>('one');
  const [to, setTo] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const customers = useQuery({ queryKey: ['admin', 'handover-customers', id], queryFn: () => adminApi.handoverCustomers(id), enabled: locked && mode === 'pick' });
  const [plan, setPlan] = useState<HandoverPlanPreview>();
  const planMut = useMutation({
    mutationFn: () => adminApi.handoverPlan(id, { mode, toUserIds: to, picks }),
    onSuccess: setPlan,
    onError: (e: Error) => { setPlan(undefined); message.error(e.message); },
  });

  // Step 3
  const [nicks, setNicks] = useState<Record<string, NickState>>({});
  const nickOf = (uid: string): NickState => nicks[uid] ?? { phoneLogoutConfirmed: false, qrRescanned: false, note: '' };
  const patchNick = (uid: string, p: Partial<NickState>) => setNicks((s) => ({ ...s, [uid]: { ...nickOf(uid), ...p } }));
  const canConfirm = perms.has('channel.safety_confirm');

  // Step 4
  const done = useMutation({
    mutationFn: () =>
      adminApi.handover(id, {
        mode,
        toUserIds: to,
        picks,
        notifyReceivers: true,
        channels: (pre.data?.nicks ?? []).map((n) => ({ uid: n.uid, toUserId: nickOf(n.uid).toUserId!, phoneLogoutConfirmed: nickOf(n.uid).phoneLogoutConfirmed, qrRescanned: nickOf(n.uid).qrRescanned, note: nickOf(n.uid).note || undefined })),
      }),
    onSuccess: (r) => {
      message.success(r.message, 10);
      void qc.invalidateQueries({ queryKey: ['admin'] });
      nav('/admin/users');
    },
    onError: (e: Error) => message.error(e.message),
  });

  if (perms.me && !perms.has('user.handover')) return <NoAccess kind="object" code={id} />;
  if (user.isError) return <Alert type="error" showIcon message="Không tìm thấy người dùng hoặc bạn không có quyền xem." />;
  const p = pre.data;
  const name = user.data?.fullName ?? '…';
  const nicksReady = (p?.nicks ?? []).every((n) => !!nickOf(n.uid).toUserId);
  const unsafeCount = (p?.nicks ?? []).filter((n) => !nickOf(n.uid).phoneLogoutConfirmed).length;
  const nameOf = (uid?: string) => receivers.data?.find((r) => r.id === uid)?.name ?? uid ?? '–';

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Typography.Title level={4} style={{ margin: 0 }}>Nghỉ việc và bàn giao: {name}</Typography.Title>
      <Steps current={step} onChange={(s) => (s === 0 || locked) && setStep(s)} items={[{ title: 'Khóa tài khoản' }, { title: 'Bàn giao khách' }, { title: 'Bàn giao nick' }, { title: 'Xác nhận' }]} />

      {step === 0 && (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input.TextArea rows={2} placeholder="Lý do nghỉ việc (5-200 ký tự)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Checkbox checked disabled>Đăng xuất mọi phiên, thu hồi token MCP và quyền tạm thời ngay</Checkbox>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              locale={{ emptyText: 'Không có thiết bị gắn nick của người này.' }}
              dataSource={p?.deviceTokens ?? []}
              columns={[
                { title: 'Thiết bị gắn nick', render: (_, d) => d.deviceName ?? d.name },
                {
                  title: 'Xử lý',
                  render: (_, d) => (
                    <Radio.Group value={keep.includes(d.id) ? 'keep' : 'revoke'} onChange={(e) => setKeep((k) => (e.target.value === 'keep' ? [...k, d.id] : k.filter((x) => x !== d.id)))}>
                      <Radio value="revoke">Thu hồi ngay</Radio>
                      <Radio value="keep" disabled={!isAdmin}>Giữ (máy công ty dùng chung, chỉ Admin)</Radio>
                    </Radio.Group>
                  ),
                },
              ]}
            />
            <Checkbox checked disabled>{p?.pendingCommands ?? 0} lệnh gửi đã duyệt chưa chạy chuyển sang "Cần duyệt lại"; chặn mọi lệnh mới của người này</Checkbox>
            {!!p?.managedUnits.length && <Alert type="warning" showIcon message={`Đang làm quản lý: ${p.managedUnits.map((u) => u.name).join(', ')}. Đơn vị sẽ để trống và chuyển yêu cầu duyệt lên cấp trên.`} />}
            <Button type="primary" danger loading={lock.isPending} disabled={reason.trim().length < 5} onClick={() => lock.mutate()}>Khóa ngay</Button>
          </Space>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="Khách">{p?.customers ?? 0}</Descriptions.Item>
              <Descriptions.Item label="Hội thoại đang mở">{p?.openConversations ?? 0}</Descriptions.Item>
              <Descriptions.Item label="Hạn bàn giao">{p?.deadlineAt ? new Date(p.deadlineAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '–'}</Descriptions.Item>
            </Descriptions>
            <Radio.Group value={mode} onChange={(e) => { setMode(e.target.value); setPlan(undefined); }}>
              {HANDOVER_MODES.map((m) => <Radio.Button key={m} value={m}>{HANDOVER_MODE_LABELS[m]}</Radio.Button>)}
            </Radio.Group>
            {mode !== 'pick' && (
              <Select
                mode={mode === 'one' ? undefined : 'multiple'}
                style={{ minWidth: 320 }}
                placeholder="Người nhận"
                value={mode === 'one' ? to[0] : to}
                onChange={(v) => { setTo(Array.isArray(v) ? v : v ? [v] : []); setPlan(undefined); }}
                options={(receivers.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
              />
            )}
            {mode === 'pick' && (
              <Table
                size="small"
                rowKey="id"
                loading={customers.isLoading}
                dataSource={customers.data ?? []}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Khách', dataIndex: 'name' },
                  { title: 'Khu vực / tag', render: (_, c) => [c.region, ...c.tags].filter(Boolean).join(', ') || '–' },
                  { title: 'Người nhận', render: (_, c) => <Select allowClear style={{ width: 200 }} value={picks[c.id]} onChange={(v) => { setPicks((s) => { const n = { ...s }; if (v) n[c.id] = v; else delete n[c.id]; return n; }); setPlan(undefined); }} options={(receivers.data ?? []).map((r) => ({ value: r.id, label: r.name }))} /> },
                ]}
              />
            )}
            <Button onClick={() => planMut.mutate()} loading={planMut.isPending}>Xem trước</Button>
            {plan && (
              <>
                <Table size="small" rowKey="userId" pagination={false} dataSource={plan.rows}
                  columns={[{ title: 'Người nhận', dataIndex: 'name' }, { title: 'Số khách', dataIndex: 'customers' }, { title: 'Doanh số 12 tháng', render: (_, r) => (r.revenue12m === null ? 'Chưa có (chờ VCsales)' : r.revenue12m) }, { title: 'Khách hạng A', dataIndex: 'gradeA' }]} />
                {plan.excluded.map((x) => <Tag key={x.userId} color="orange">{x.name}: {x.reason}, không nhận khách</Tag>)}
              </>
            )}
            <Space>
              <Button type="primary" disabled={!plan} onClick={() => setStep(2)}>Tiếp tục</Button>
              <Typography.Text type="secondary">Người nhận đã chọn: {plan ? plan.rows.length : 0}. Chia xong sửa tay bằng chế độ "Chọn từng khách".</Typography.Text>
            </Space>
          </Space>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            {!p?.nicks.length && <Typography.Text>Người này không giữ nick nào.</Typography.Text>}
            {p?.nicks.map((n) => {
              const load = p.nickLoad.find((l) => l.uid === n.uid);
              const st = nickOf(n.uid);
              return (
                <Card key={n.uid} size="small" title={n.label}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Select style={{ minWidth: 280 }} placeholder="Người giữ nick mới" value={st.toUserId} onChange={(v) => patchNick(n.uid, { toUserId: v })} options={(receivers.data ?? []).map((r) => ({ value: r.id, label: r.name }))} />
                    <Checkbox checked={st.phoneLogoutConfirmed} disabled={!canConfirm} onChange={(e) => patchNick(n.uid, { phoneLogoutConfirmed: e.target.checked })}>
                      Đã đăng xuất Zalo trên điện thoại / thiết bị của {name} và đổi mật khẩu (việc công ty làm ngoài VClinks; VClinks chỉ ghi người xác nhận và thời điểm, không nhập mật khẩu)
                    </Checkbox>
                    <Input maxLength={200} placeholder="Ghi chú (vd: thu máy tại buổi bàn giao)" value={st.note} onChange={(e) => patchNick(n.uid, { note: e.target.value })} />
                    <Checkbox checked={st.qrRescanned} onChange={(e) => patchNick(n.uid, { qrRescanned: e.target.checked })}>Đã quét lại mã QR trên máy của người giữ mới / Chrome driver</Checkbox>
                    {load && <Typography.Text type="secondary">Còn trên nick: {load.needsReapproval} lệnh Cần duyệt lại · {load.pendingFriendRequests} lời mời kết bạn chờ · {load.unansweredConversations} hội thoại chưa trả lời</Typography.Text>}
                  </Space>
                </Card>
              );
            })}
            <Button type="primary" disabled={!nicksReady} onClick={() => setStep(3)}>Tiếp tục</Button>
          </Space>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Khách">{plan?.total ?? 0} khách → {plan?.rows.map((r) => `${r.name} (${r.customers})`).join(', ')}</Descriptions.Item>
              <Descriptions.Item label="Nick">{p?.nicks.length ? p.nicks.map((n) => `${n.label} → ${nameOf(nickOf(n.uid).toUserId)}`).join('; ') : 'Không có'}</Descriptions.Item>
              <Descriptions.Item label="Lệnh gửi">{p?.pendingCommands ?? 0} lệnh Cần duyệt lại (người giữ nick duyệt lại hoặc bỏ)</Descriptions.Item>
              {unsafeCount > 0 && <Descriptions.Item label="Nick chưa an toàn"><Tag color="red">{unsafeCount}</Tag> Chưa gửi được qua nick này tới khi xác nhận đã đăng xuất; hệ thống nhắc hằng ngày 08:30.</Descriptions.Item>}
            </Descriptions>
            <Space>
              <Button onClick={() => setStep(2)}>Quay lại</Button>
              <Button type="primary" loading={done.isPending} onClick={() => done.mutate()}>Hoàn tất bàn giao</Button>
            </Space>
          </Space>
        </Card>
      )}
    </Space>
  );
}
