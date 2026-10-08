import { useEffect, useState } from 'react';
import { App, Form, Input, Modal, Radio, Select, Tooltip, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { GRANT_DURATION_HOURS, type GrantApproverView, type GrantRight } from '@vclinks/shared';
import { api } from '../../api';

const RIGHT_LABEL: Record<GrantRight, string> = { xem: 'Xem', ghi_chu: 'Xem + Ghi chú', tra_loi: 'Xem + Trả lời' };
const DURATION_LABEL: Record<number, string> = { 4: '4 giờ', 24: '1 ngày', 72: '3 ngày', 168: '7 ngày' };

interface FormValues {
  right: GrantRight;
  durationHours: number;
  reason: string;
}

/** "Xin quyền truy cập" of MH-PQ-11: asks for temporary access to one conversation; approver per PQ-30. */
export default function AccessRequestModal({ open, targetId, onClose }: { open: boolean; targetId: string; onClose: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [serverError, setServerError] = useState<string | null>(null);
  const approver = useQuery({
    queryKey: ['access-grants', 'approver', targetId],
    queryFn: () => api<GrantApproverView>('/access-grants/approver', { query: { targetId } }),
    enabled: open,
    retry: false,
  });
  const send = useMutation({
    mutationFn: (v: FormValues) => api<{ approverName: string }>('/access-grants', { method: 'POST', body: { targetId, ...v } }),
  });
  useEffect(() => {
    if (open) setServerError(null);
  }, [open]);

  const noApprover = approver.isSuccess && !approver.data.approverId;
  const submit = async () => {
    const v = await form.validateFields();
    setServerError(null);
    try {
      const r = await send.mutateAsync(v);
      message.success(`Đã gửi yêu cầu tới ${r.approverName}. Bạn sẽ nhận thông báo khi có kết quả.`);
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  return (
    <Modal
      open={open}
      title="Xin quyền truy cập"
      onCancel={onClose}
      okText="Gửi yêu cầu"
      cancelText="Hủy"
      onOk={submit}
      confirmLoading={send.isPending}
      okButtonProps={{ disabled: noApprover }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ right: 'xem', durationHours: 24 }}>
        <Form.Item label="Đối tượng">
          <Typography.Text>{`Hội thoại ${targetId}`}</Typography.Text>
        </Form.Item>
        <Form.Item name="right" label="Loại quyền">
          <Radio.Group>
            <Radio value="xem">{RIGHT_LABEL.xem}</Radio>
            <Radio value="ghi_chu">{RIGHT_LABEL.ghi_chu}</Radio>
            <Tooltip title={approver.data?.replyLocked ? 'Trả lời qua nick cá nhân của người khác chỉ qua Trực thay.' : undefined}>
              <Radio value="tra_loi" disabled={!!approver.data?.replyLocked}>
                {RIGHT_LABEL.tra_loi}
              </Radio>
            </Tooltip>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="durationHours" label="Thời hạn">
          <Select options={GRANT_DURATION_HOURS.map((h) => ({ value: h, label: DURATION_LABEL[h] }))} />
        </Form.Item>
        <Form.Item
          name="reason"
          label="Lý do"
          rules={[
            { required: true, whitespace: true, message: 'Nhập lý do' },
            { min: 10, max: 300, message: 'Lý do cần 10–300 ký tự' },
          ]}
        >
          <Input.TextArea rows={3} maxLength={300} showCount />
        </Form.Item>
        <Form.Item label="Người duyệt">
          {noApprover ? (
            <Typography.Text type="danger">Chưa có người duyệt cho phạm vi này. Liên hệ quản trị viên.</Typography.Text>
          ) : (
            <Typography.Text>{approver.data?.approverName ?? (approver.isError ? '–' : 'Đang tính…')}</Typography.Text>
          )}
        </Form.Item>
        {serverError && <Typography.Text type="danger">{serverError}</Typography.Text>}
      </Form>
    </Modal>
  );
}
