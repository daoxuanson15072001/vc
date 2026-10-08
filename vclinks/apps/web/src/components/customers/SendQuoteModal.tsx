import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Checkbox, Descriptions, Modal, Radio, Select, Skeleton, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import {
  DEFAULT_QUOTE_TEMPLATE,
  ERR_QUOTE_NO_LINK,
  QUOTE_FOLLOW_UP_DAYS,
  QUOTE_MESSAGE_MAX,
  SALES_QUOTE_STATUS_LABELS,
  formatVnd,
  renderQuoteMessage,
  vnDate,
  type QuoteForm,
  type QuoteRow,
} from '@vclinks/shared';
import { ApiError } from '../../api';
import { useQuotes, useSendQuote } from './quoteApi';

interface Props {
  open: boolean;
  onClose: () => void;
  uid: string;
  threadId: string;
  /** Customer name shown in the title and put in the message ({ten_khach}). */
  customerName: string;
  /** Sending nick, shown in the footer line. */
  accountLabel: string;
  vars: { ten_khach?: string | null; ten_nv?: string | null };
  /** Quote to select when the box was opened from the panel. */
  initialNo?: string;
  /** Nick red / unsafe: the send button is locked (03 MH-SZ-05i #9). */
  disabled?: boolean;
}

const pickDefault = (rows: QuoteRow[], wanted?: string) => rows.find((r) => r.no === wanted && !r.block) ?? rows.find((r) => !r.block);

/**
 * "Gửi báo giá" (03 MH-SZ-05i): choose a quote, the form (PDF or image), the words, then send. The list is read
 * live from VCsales every time the box opens; the API reads the quote again when the button is pressed and refuses
 * an expired, unapproved, cancelled or edited-since-viewed quote (BR16, BR17). Pressing "Gửi báo giá" is the approval.
 */
export default function SendQuoteModal({ open, onClose, uid, threadId, customerName, accountLabel, vars, initialNo, disabled }: Props) {
  const { message } = App.useApp();
  const list = useQuotes(uid, threadId, open);
  const send = useSendQuote(uid, threadId);
  const [no, setNo] = useState<string | undefined>();
  const [form, setForm] = useState<QuoteForm>('pdf');
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [follow, setFollow] = useState(true);
  const [days, setDays] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);

  const rows = list.data?.items ?? [];
  const selected = rows.find((r) => r.no === no && !r.block);

  // Every time the box opens: read VCsales again and start from the freshest valid quote.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setDirty(false);
    setForm('pdf');
    setNo(undefined);
    void list.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !list.data) return;
    setNo((cur) => (rows.find((r) => r.no === cur && !r.block) ? cur : pickDefault(rows, initialNo)?.no));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, list.data]);

  useEffect(() => {
    if (!selected || dirty) return;
    setText(renderQuoteMessage(DEFAULT_QUOTE_TEMPLATE, { ten_khach: vars.ten_khach ?? customerName, ten_nv: vars.ten_nv, so_bao_gia: selected.no, tong_tien: selected.total, hieu_luc: selected.validUntil }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.no, selected?.total, selected?.validUntil, dirty]);

  const submit = async () => {
    if (!selected || disabled) return;
    setError(null);
    try {
      const r = await send.mutateAsync({ no: selected.no, form, message: text.trim(), version: selected.version, followUpDays: follow ? days : null });
      message.info({ content: `Đang gửi báo giá ${r.no}…`, duration: 2 });
      onClose();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Không gửi được báo giá';
      setError(msg);
      // The quote changed, expired or was cancelled meanwhile: show what VCsales says now.
      if (e instanceof ApiError && [404, 409, 422].includes(e.status)) void list.refetch();
    }
  };

  const columns = useMemo(
    () => [
      { title: 'Số', dataIndex: 'no', key: 'no' },
      { title: 'Ngày', key: 'date', render: (_: unknown, r: QuoteRow) => vnDate(r.date).slice(0, 5) },
      { title: 'Tổng tiền', key: 'total', align: 'right' as const, render: (_: unknown, r: QuoteRow) => formatVnd(r.total) },
      { title: 'Hiệu lực', key: 'valid', render: (_: unknown, r: QuoteRow) => (r.validUntil ? vnDate(r.validUntil) : '–') },
      {
        title: 'Trạng thái',
        key: 'status',
        render: (_: unknown, r: QuoteRow) => {
          const expired = r.block?.code === 'expired' && r.status === 'approved';
          return (
            <Tooltip title={r.block?.message}>
              <Tag color={r.block ? 'default' : 'green'} title={r.erpStatusLabel ? `Trên VCsales: ${r.erpStatusLabel}` : undefined}>{expired ? 'Hết hạn' : SALES_QUOTE_STATUS_LABELS[r.status]}</Tag>
              {r.block && <span aria-hidden>🚫</span>}
            </Tooltip>
          );
        },
      },
    ],
    [],
  );

  let body;
  const d = list.data;
  if (list.isLoading || (list.isFetching && !d)) body = <Skeleton active paragraph={{ rows: 5 }} />;
  else if (list.isError) {
    const denied = list.error instanceof ApiError && (list.error.status === 403 || list.error.status === 404);
    body = denied ? <Alert type="warning" showIcon message="Bạn không có quyền xem báo giá của khách này." /> : <Alert type="error" showIcon message="Không tải được báo giá." action={<Button size="small" onClick={() => list.refetch()}>Thử lại</Button>} />;
  } else if (d?.hidden === 'no_link') body = <Alert type="warning" showIcon message={`${ERR_QUOTE_NO_LINK} Liên kết mã KH ở màn Đối chiếu VCsales rồi mở lại hộp này.`} />;
  else if (d?.hidden === 'unconfirmed') body = <Alert type="warning" showIcon message="Danh tính khách chưa xác nhận, chưa gửi báo giá được." />;
  else if (d?.hidden === 'no_right') body = <Alert type="warning" showIcon message="Bạn không có quyền xem báo giá của khách này." />;
  else if (d?.error) body = <Alert type="error" showIcon message={d.error} action={<Button size="small" onClick={() => list.refetch()}>Thử lại</Button>} />;
  else {
    body = (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {d?.debt && (
          <Alert
            type="warning"
            showIcon
            message={
              <span style={d.debt.overdueDays >= 30 ? { color: 'var(--danger)' } : undefined}>
                Khách đang quá hạn {d.debt.overdueDays} ngày · {formatVnd(d.debt.amount)} (VCsales {new Date(d.fetchedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}). Bán tiếp theo hạn mức trên VCsales.
              </span>
            }
          />
        )}
        {error && <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />}
        <div>
          <Space style={{ marginBottom: 6, width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text strong>① Chọn báo giá</Typography.Text>
            <Space>
              <Button size="small" icon={<ReloadOutlined />} loading={list.isFetching} onClick={() => list.refetch()}>Làm mới</Button>
              {d?.createUrl && (
                <Button size="small" href={d.createUrl} target="_blank" rel="noopener noreferrer">Tạo báo giá ↗</Button>
              )}
            </Space>
          </Space>
          {rows.length === 0 ? (
            <Alert type="info" showIcon message="Chưa có báo giá nào của khách trên VCsales." action={d?.createUrl ? <Button size="small" href={d.createUrl} target="_blank" rel="noopener noreferrer">Tạo báo giá trên VCsales</Button> : undefined} />
          ) : (
            <Table<QuoteRow>
              size="small"
              rowKey="no"
              pagination={false}
              columns={columns}
              dataSource={rows}
              rowSelection={{ type: 'radio', selectedRowKeys: no ? [no] : [], getCheckboxProps: (r) => ({ disabled: !!r.block }), onChange: (k) => setNo(String(k[0])) }}
              onRow={(r) => ({ style: r.block ? { opacity: 0.5 } : undefined, onClick: () => !r.block && setNo(r.no) })}
            />
          )}
        </div>
        {selected && (
          <>
            <Descriptions size="small" column={3} title="② Xem trước">
              <Descriptions.Item label="Số dòng hàng">{selected.lineCount}</Descriptions.Item>
              <Descriptions.Item label="Người lập">{selected.createdByName ?? '–'}</Descriptions.Item>
              <Descriptions.Item label="Đã gửi">{selected.sendCount} lần</Descriptions.Item>
            </Descriptions>
            <div>
              <Typography.Text strong>③ Dạng gửi </Typography.Text>
              <Radio.Group value={form} onChange={(e) => setForm(e.target.value as QuoteForm)}>
                <Radio value="pdf">File PDF</Radio>
                {(list.data?.forms ?? ['pdf', 'image']).includes('image') && <Radio value="image">Ảnh</Radio>}
              </Radio.Group>
            </div>
            <div>
              <Typography.Text strong>④ Lời nhắn</Typography.Text>
              <textarea
                aria-label="Lời nhắn"
                value={text}
                maxLength={QUOTE_MESSAGE_MAX}
                onChange={(e) => {
                  setText(e.target.value);
                  setDirty(true);
                }}
                rows={3}
                style={{ width: '100%', display: 'block', marginTop: 4, padding: 6, border: '1px solid var(--border, #d9d9d9)', borderRadius: 6, font: 'inherit' }}
              />
              <Typography.Text type="secondary" style={{ float: 'right', fontSize: 12 }}>{text.length}/{QUOTE_MESSAGE_MAX}</Typography.Text>
            </div>
            <Space>
              <Checkbox checked={follow} onChange={(e) => setFollow(e.target.checked)}>Nhắc tôi theo dõi sau</Checkbox>
              <Select size="small" value={days} onChange={setDays} disabled={!follow} options={QUOTE_FOLLOW_UP_DAYS.map((n) => ({ value: n, label: `${n} ngày` }))} style={{ width: 90 }} />
            </Space>
          </>
        )}
        <Typography.Text type="secondary">Gửi từ nick {accountLabel}. Bấm "Gửi báo giá" nghĩa là bạn đã duyệt.</Typography.Text>
      </Space>
    );
  }

  return (
    <Modal
      open={open}
      width={760}
      title={`Gửi báo giá cho ${customerName}${d?.customerCode ? ` (${d.customerCode})` : ''}`}
      onCancel={onClose}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Tooltip key="send" title={disabled ? 'Nick đang không an toàn hoặc mất kết nối, chưa gửi được' : undefined}>
          <Button type="primary" disabled={!selected || disabled} loading={send.isPending} onClick={() => void submit()} autoFocus>
            Gửi báo giá
          </Button>
        </Tooltip>,
      ]}
    >
      {body}
    </Modal>
  );
}
