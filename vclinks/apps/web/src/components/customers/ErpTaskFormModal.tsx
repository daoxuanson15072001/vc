import { useMemo } from 'react';
import { Alert, App, Form, Input, Modal, Select, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { ERP_CUSTOMER_TYPES, verifyRank, type ContactPointView, type CustomerDetail, type ErpCreateForm, type ErpTaskView } from '@vclinks/shared';
import { api } from '../../api';
import { useCreateErpTask, useErpTaskAction } from './erpTaskApi';

type Values = {
  legalName?: string;
  type?: ErpCreateForm['type'];
  taxCode?: string;
  phonePointId?: string;
  deliveryAddress?: string;
  invoiceAddress?: string;
  note?: string;
};

/**
 * "Phiếu thông tin tạo mã" (02 MH-DK-12 #3): what the sale admin needs to make the customer code on VCsales. Opened by
 * "Đưa vào hàng chờ tạo mã KH" (new task) or "Sửa phiếu" (`task`). Empty fields are allowed: the queue says "Thiếu …".
 */
export default function ErpTaskFormModal({ accountId, accountName, task, onClose }: { accountId: string; accountName: string; task?: ErpTaskView; onClose: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const detail = useQuery({ queryKey: ['customer', accountId], queryFn: () => api<CustomerDetail>(`/customers/${encodeURIComponent(accountId)}`), retry: false });
  const create = useCreateErpTask();
  const action = useErpTaskAction();
  const phones = useMemo(() => {
    const d = detail.data;
    if (!d) return [] as ContactPointView[];
    return [...d.contacts.flatMap((c) => c.points), ...d.points].filter((p) => p.kind === 'phone' && p.state === 'active' && verifyRank(p.level) >= 2);
  }, [detail.data]);
  const initial: Values = task?.form
    ? {
        legalName: task.form.legalName ?? undefined,
        type: task.form.type ?? undefined,
        taxCode: task.form.taxCode ?? undefined,
        phonePointId: task.form.phonePointId ?? undefined,
        deliveryAddress: task.form.deliveryAddress ?? undefined,
        invoiceAddress: task.form.invoiceAddress ?? undefined,
        note: task.form.note ?? undefined,
      }
    : { legalName: accountName };
  const submit = (v: Values) => {
    const f = {
      legalName: v.legalName ?? '',
      type: v.type ?? null,
      taxCode: v.taxCode ?? '',
      phonePointId: v.phonePointId ?? null,
      deliveryAddress: v.deliveryAddress ?? '',
      invoiceAddress: v.invoiceAddress ?? '',
      note: v.note ?? '',
    } as unknown as ErpCreateForm;
    if (task) {
      action.mutate(
        { id: task.id, kind: 'form', form: f },
        {
          onSuccess: () => {
            message.success('Đã lưu phiếu.');
            onClose();
          },
          onError: (e) => message.error((e as Error).message),
        },
      );
    } else {
      create.mutate(
        { kind: 'create_customer', accountId, form: f },
        {
          onSuccess: () => {
            message.success(`Đã đưa ${accountName} vào hàng Chờ tạo mã KH.`);
            onClose();
          },
          onError: (e) => message.error((e as Error).message),
        },
      );
    }
  };
  return (
    <Modal
      open
      title={task ? `Phiếu tạo mã KH · ${accountName}` : `Đưa ${accountName} vào hàng Chờ tạo mã KH`}
      okText={task ? 'Lưu phiếu' : 'Đưa vào hàng chờ'}
      cancelText="Hủy"
      onOk={() => form.submit()}
      confirmLoading={create.isPending || action.isPending}
      onCancel={onClose}
      width={600}
      destroyOnClose
      maskClosable={false}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Sale admin tạo mã trên VCsales theo phiếu này. Trường nào để trống thì hàng chờ ghi “Thiếu …” và sale admin có thể trả lại để bổ sung."
      />
      {detail.isLoading ? (
        <Spin />
      ) : (
        <Form form={form} layout="vertical" initialValues={initial} onFinish={submit} requiredMark={false}>
          <Form.Item name="legalName" label="Tên pháp lý" rules={[{ max: 200, message: 'Tối đa 200 ký tự.' }]}>
            <Input placeholder="Tên trên giấy phép kinh doanh / hóa đơn" />
          </Form.Item>
          <Form.Item name="type" label="Loại khách">
            <Select allowClear options={ERP_CUSTOMER_TYPES.map((t) => ({ value: t, label: t }))} placeholder="Garage / Đại lý / Khách lẻ" />
          </Form.Item>
          <Form.Item
            name="taxCode"
            label="MST"
            extra="10 hoặc 13 số; khách lẻ có thể để trống."
            rules={[{ pattern: /^[\d\s.-]*$/, message: 'MST chỉ gồm số.' }]}
          >
            <Input inputMode="numeric" />
          </Form.Item>
          <Form.Item name="phonePointId" label="SĐT (đã xác thực, mức V2 trở lên)" extra={phones.length ? undefined : 'Khách chưa có SĐT đã xác thực. Xác nhận SĐT ở hồ sơ khách trước, hoặc để trống.'}>
            <Select allowClear options={phones.map((p) => ({ value: p.id, label: `${p.phone ?? ''} · ${p.level}` }))} placeholder="Chọn SĐT" />
          </Form.Item>
          <Form.Item name="deliveryAddress" label="Địa chỉ giao hàng" rules={[{ max: 300, message: 'Tối đa 300 ký tự.' }]}>
            <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
          </Form.Item>
          <Form.Item
            name="invoiceAddress"
            label="Địa chỉ xuất hóa đơn"
            extra="Không tự lấy từ tên / địa chỉ khách chia sẻ trên OA: nhập theo giấy tờ khách gửi."
            rules={[{ max: 300, message: 'Tối đa 300 ký tự.' }]}
          >
            <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú cho sale admin" rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]}>
            <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
