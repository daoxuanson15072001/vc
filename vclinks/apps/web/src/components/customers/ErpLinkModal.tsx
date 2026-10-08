import { useState } from 'react';
import { Alert, App, Button, Checkbox, Empty, Input, List, Modal, Radio, Space, Tag, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ErpSearchRow } from '@vclinks/shared';
import { api } from '../../api';
import { useConfirmErp } from './customerApi';
import { useCreateErpTask } from './erpTaskApi';

/**
 * "Liên kết mã KH" (MH-DK-10 by hand): finds a VCsales customer by code, name, phone or tax code and links it to
 * this customer profile. The API checks the confirming role (sale admin, Admin) and that the code is not taken.
 * Sale admins also tick ≥ 2 codes of the same garage for "Báo trùng trên VCsales" (MH-DK-10 #7): the main code is
 * linked and a "Gộp mã" task goes to Việc VCsales. "Đưa vào hàng chờ tạo mã KH" when VCsales has no such customer.
 */
export default function ErpLinkModal({
  open,
  accountId,
  customerName,
  canReportDuplicates = false,
  onQueue,
  onClose,
}: {
  open: boolean;
  accountId: string;
  customerName: string;
  canReportDuplicates?: boolean;
  onQueue?: () => void;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [q, setQ] = useState(customerName);
  const [term, setTerm] = useState(customerName.trim().length >= 3 ? customerName.trim() : '');
  const [dup, setDup] = useState<string[]>([]);
  const [main, setMain] = useState<string | null>(null);
  const search = useQuery({
    queryKey: ['erp-search', term],
    queryFn: () => api<ErpSearchRow[]>('/customers/erp-search', { query: { q: term } }),
    enabled: open && term.length >= 3,
    retry: false,
  });
  const confirm = useConfirmErp();
  const report = useCreateErpTask();
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['customer-panel'] });
    void qc.invalidateQueries({ queryKey: ['customer'] });
    onClose();
  };
  const link = (row: ErpSearchRow) =>
    confirm.mutate(
      { accountId, customerId: row.code },
      {
        onSuccess: () => {
          message.success(`Đã liên kết ${customerName} với mã ${row.code}.`);
          done();
        },
        onError: (e) => message.error((e as Error).message),
      },
    );
  const reportDuplicates = () => {
    const mainCode = main && dup.includes(main) ? main : dup[0]!;
    report.mutate(
      { kind: 'merge_codes', accountId, mainCode, otherCodes: dup.filter((c) => c !== mainCode) },
      {
        onSuccess: () => {
          message.success(`Đã liên kết ${mainCode} và tạo việc gộp mã trên VCsales.`);
          done();
        },
        onError: (e) => message.error((e as Error).message),
      },
    );
  };
  const toggle = (code: string, on: boolean) => setDup((d) => (on ? [...new Set([...d, code])] : d.filter((c) => c !== code)));
  return (
    <Modal open={open} title={`Liên kết mã KH VCsales cho ${customerName}`} footer={null} onCancel={onClose} width={600} destroyOnClose>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input.Search
          autoFocus
          allowClear
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onSearch={(v) => setTerm(v.trim())}
          placeholder="Mã KH, tên, số điện thoại hoặc mã số thuế (ít nhất 3 ký tự)"
          enterButton="Tìm"
        />
        {search.isError && <Alert type="error" showIcon message={(search.error as Error).message} />}
        {term.length >= 3 ? (
          <List<ErpSearchRow>
            loading={search.isLoading}
            dataSource={search.data ?? []}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={onQueue ? 'VCsales chưa có khách nào khớp. Nếu khách đã chốt đơn, đưa vào hàng "Chờ tạo mã KH".' : 'Không thấy khách nào trên VCsales.'}
                />
              ),
            }}
            renderItem={(r) => (
              <List.Item
                actions={[
                  ...(canReportDuplicates
                    ? [
                        <Checkbox key="dup" checked={dup.includes(r.code)} onChange={(e) => toggle(r.code, e.target.checked)}>
                          Trùng
                        </Checkbox>,
                      ]
                    : []),
                  <Button key="link" type="primary" size="small" loading={confirm.isPending && confirm.variables?.customerId === r.code} onClick={() => link(r)}>
                    Liên kết
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Tag color="blue">{r.code}</Tag>
                      {r.name}
                    </Space>
                  }
                  description={
                    <Typography.Text type="secondary">
                      {[r.type, r.region, r.taxCode ? `MST ${r.taxCode}` : null, r.phones.join(', ') || null, r.salespersonName ? `NV: ${r.salespersonName}` : null].filter(Boolean).join(' · ')}
                    </Typography.Text>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Typography.Text type="secondary">Gõ ít nhất 3 ký tự rồi bấm Tìm.</Typography.Text>
        )}
        {canReportDuplicates && dup.length >= 2 && (
          <Alert
            type="info"
            showIcon
            message="Báo trùng trên VCsales: chọn mã chính để liên kết"
            description={
              <Space direction="vertical">
                <Radio.Group value={main && dup.includes(main) ? main : dup[0]} onChange={(e) => setMain(e.target.value as string)} options={dup.map((c) => ({ value: c, label: c }))} />
                <Typography.Text type="secondary">Mã chính được liên kết ngay; các mã còn lại vào Việc VCsales để sale admin gộp trên VCsales.</Typography.Text>
                <Button type="primary" loading={report.isPending} onClick={reportDuplicates}>
                  Báo trùng trên VCsales
                </Button>
              </Space>
            }
          />
        )}
        {onQueue && (
          <Button type="link" style={{ padding: 0 }} onClick={onQueue}>
            Không thấy khách trên VCsales? Đưa vào hàng chờ tạo mã KH
          </Button>
        )}
      </Space>
    </Modal>
  );
}
