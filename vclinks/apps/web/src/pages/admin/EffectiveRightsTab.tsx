import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { GRANT_DURATION_HOURS, type EffectiveRightsResponse, type EffectiveTargetResult, type GrantRight } from '@vclinks/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Modal, Radio, Select, Space, Typography, message } from 'antd';
import { useState } from 'react';
import { api } from '../../api';

/**
 * Tab "Quyền hiệu lực" of MH-PQ-03 (L-01): the Admin types a conversation id, a customer name or a phone and
 * sees, for this person, ✔/✖ per action with the reason. No message content and no phone are shown; each
 * lookup is logged as `permission.explain`.
 */
export default function EffectiveRightsTab({ userId }: { userId: string }) {
  const [text, setText] = useState('');
  const [asking, setAsking] = useState<EffectiveTargetResult | null>(null);
  const check = useMutation({
    mutationFn: (target: string) => api<EffectiveRightsResponse>(`/admin/users/${encodeURIComponent(userId)}/effective?target=${encodeURIComponent(target)}`),
  });
  const run = () => check.mutate(text.trim());
  const r = check.data;
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Typography.Text type="secondary">Nhập mã hội thoại (dạng uid:mã), tên khách hoặc SĐT để xem vì sao người này thấy hoặc không thấy. Không hiện nội dung tin và SĐT; mỗi lần tra được ghi nhật ký.</Typography.Text>
      <Space.Compact style={{ width: '100%' }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} onPressEnter={run} placeholder="Mã hội thoại, tên hoặc SĐT khách" maxLength={200} />
        <Button type="primary" loading={check.isPending} disabled={text.trim().length < 3} onClick={run}>Kiểm tra</Button>
      </Space.Compact>
      {check.isError && <Alert type="error" showIcon message={(check.error as Error).message} />}
      {r?.note && <Alert type="info" showIcon message={r.note} />}
      {r?.results.map((x) => (
        <Card key={x.conversationId} size="small" title={`${x.label} · ${x.conversationId}`} extra={x.channelLabel}>
          {x.checks.map((c) => (
            <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              {c.allowed ? <CheckCircleFilled style={{ color: 'var(--ok)' }} /> : <CloseCircleFilled style={{ color: 'var(--danger)' }} />}
              <span><b>{c.label}</b>: {c.allowed ? 'được' : 'không được'}, vì {c.reason}.</span>
            </div>
          ))}
          {x.howToSee && <Alert style={{ marginTop: 8 }} type="warning" showIcon message={x.howToSee} />}
          {x.canRequestGrant && <Button style={{ marginTop: 8 }} onClick={() => setAsking(x)}>Tạo yêu cầu quyền hộ</Button>}
        </Card>
      ))}
      <GrantOnBehalfModal userId={userId} fullName={r?.fullName ?? ''} target={asking} onClose={() => setAsking(null)} />
    </Space>
  );
}

const RIGHT_LABEL: Record<GrantRight, string> = { xem: 'Xem', ghi_chu: 'Xem + Ghi chú', tra_loi: 'Xem + Trả lời' };
const DURATION_LABEL: Record<number, string> = { 4: '4 giờ', 24: '1 ngày', 72: '3 ngày', 168: '7 ngày' };

/**
 * "Tạo yêu cầu quyền hộ" (PQ-70): files a pending request in the name of the checked person. It grants nothing:
 * the approver of PQ-30 decides, and the checked person is notified.
 */
function GrantOnBehalfModal({ userId, fullName, target, onClose }: { userId: string; fullName: string; target: EffectiveTargetResult | null; onClose: () => void }) {
  const [form] = Form.useForm<{ right: GrantRight; durationHours: number; reason: string }>();
  const [err, setErr] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (v: { right: GrantRight; durationHours: number; reason: string }) =>
      api<{ approverName: string }>(`/admin/users/${encodeURIComponent(userId)}/grant-request`, { method: 'POST', body: { targetId: target!.conversationId, ...v } }),
  });
  const submit = async () => {
    const v = await form.validateFields();
    setErr(null);
    try {
      const r = await send.mutateAsync(v);
      message.success(`Đã tạo yêu cầu thay ${fullName}, chờ ${r.approverName} duyệt.`);
      form.resetFields();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Modal open={!!target} title={`Tạo yêu cầu quyền hộ ${fullName}`} okText="Gửi yêu cầu" cancelText="Hủy" onCancel={onClose} onOk={submit} confirmLoading={send.isPending} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{ right: 'xem', durationHours: 24 }}>
        <Typography.Paragraph type="secondary">Chỉ tạo yêu cầu chờ duyệt, không tự cấp quyền. Người duyệt: {target?.approverName ?? '–'}. {fullName} sẽ nhận thông báo.</Typography.Paragraph>
        <Form.Item label="Đối tượng"><Typography.Text>{target ? `${target.label} · ${target.conversationId}` : ''}</Typography.Text></Form.Item>
        <Form.Item name="right" label="Loại quyền">
          <Radio.Group>
            <Radio value="xem">{RIGHT_LABEL.xem}</Radio>
            <Radio value="ghi_chu">{RIGHT_LABEL.ghi_chu}</Radio>
            <Radio value="tra_loi">{RIGHT_LABEL.tra_loi}</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="durationHours" label="Thời hạn"><Select options={GRANT_DURATION_HOURS.map((h) => ({ value: h, label: DURATION_LABEL[h] }))} /></Form.Item>
        <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: 'Nhập lý do' }, { min: 10, max: 300, message: 'Lý do cần 10–300 ký tự' }]}>
          <Input.TextArea rows={3} maxLength={300} showCount />
        </Form.Item>
        {err && <Typography.Text type="danger">{err}</Typography.Text>}
      </Form>
    </Modal>
  );
}
