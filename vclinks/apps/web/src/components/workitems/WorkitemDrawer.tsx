import { useEffect, useState } from 'react';
import { Alert, App, Button, DatePicker, Descriptions, Drawer, Empty, Input, Modal, Popconfirm, Radio, Select, Space, Spin, Tag, Timeline, Tooltip, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  AFTERSALES_TYPE_LABELS,
  RESULTS_BY_KIND,
  RETURN_REASON_LABELS,
  RETURN_REASONS,
  WORKITEM_KIND_LABELS,
  WORKITEM_MESSAGE_MAX,
  WORKITEM_RESULT_LABELS,
  WORKITEM_STATUS_LABELS,
  QUOTE_MESSAGE_MAX,
  formatVnd,
  vnDate,
  type AfterSendState,
  type ReturnReason,
  type WorkitemDetail,
  type WorkitemResult,
} from '@vclinks/shared';
import { fmtTime as formatTime } from '../../time';
import { useEditWorkitem, useWorkitem, useWorkitemAction, useWorkitemQuotes, type WorkitemAction } from './workitemApi';

const { Text } = Typography;

export const STATUS_COLOR: Record<string, string> = {
  moi: 'blue',
  cskh_xu_ly: 'processing',
  cho_nvkd_duyet: 'orange',
  tra_lai: 'red',
  da_gui_khach: 'cyan',
  cho_khach: 'purple',
  cho_hang: 'gold',
  xong: 'default',
};

const EVENT_LABELS: Record<string, string> = {
  create: 'tạo phiếu',
  start: 'nhận xử lý',
  draft: 'sửa nháp',
  submit: 'chuyển NVKD duyệt',
  return: 'trả lại CSKH',
  approve: 'duyệt & gửi',
  sent: 'đã gửi khách',
  send_failed: 'lệnh gửi bị bỏ, chờ duyệt lại',
  self_reply: 'tự trả lời khách',
  wait_vendor: 'chờ hãng',
  vendor_back: 'hãng trả kết quả',
  close: 'đóng phiếu',
  assign: 'giao lại người xử lý',
  remind: 'nhắc người duyệt',
  escalate: 'báo giám sát',
};

/**
 * Panel phiếu (03 MH-SZ-15 #4, 04 MH-OA-20). One drawer for both sides: CSKH prepares (words, approved quote,
 * after-sales step), the nick holder approves ("Duyệt & gửi" = approval of the send), returns or answers himself.
 * Layout follows the spec text and the current screens: the MH-SZ-15 design (E6) is not delivered yet.
 */
export default function WorkitemDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { message } = App.useApp();
  const q = useWorkitem(id);
  const d = q.data;
  const act = useWorkitemAction(id ?? '');
  const edit = useEditWorkitem(id ?? '');
  const [text, setText] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);

  useEffect(() => {
    if (d) setText(d.message);
  }, [d?.id, d?.message]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action: WorkitemAction, body?: Record<string, unknown>, ok?: string) => {
    try {
      await act.mutateAsync({ action, body });
      if (ok) message.success(ok);
      return true;
    } catch (e) {
      message.error((e as Error).message);
      return false;
    }
  };
  const save = async (b: Record<string, unknown>, ok = 'Đã lưu') => {
    try {
      await edit.mutateAsync(b);
      message.success(ok);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const title = d ? `${d.code} · ${WORKITEM_KIND_LABELS[d.kind]}${d.aftersalesType ? ` (${AFTERSALES_TYPE_LABELS[d.aftersalesType]})` : ''}` : 'Phiếu';
  const max = d?.quoteNo ? QUOTE_MESSAGE_MAX : WORKITEM_MESSAGE_MAX;
  const canEditWords = !!d && (d.can.edit || d.can.approve);

  return (
    <Drawer open={!!id} onClose={onClose} width={560} title={title} destroyOnClose extra={d && <Tag color={STATUS_COLOR[d.status]}>{WORKITEM_STATUS_LABELS[d.status]}</Tag>}>
      {q.isLoading && <Spin />}
      {q.error && <Alert type="error" showIcon message={(q.error as Error).message} />}
      {d && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Khách">{d.conversationName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="NVKD tạo">{d.createdByName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="CSKH xử lý">{d.assigneeName ?? 'Chưa giao'}</Descriptions.Item>
            <Descriptions.Item label="Người duyệt">{d.approverName ?? '—'}</Descriptions.Item>
            {d.dueAt && <Descriptions.Item label="Hạn gửi khách">{formatTime(d.dueAt)}</Descriptions.Item>}
            {d.vendorDueAt && <Descriptions.Item label="Hẹn hãng">{vnDate(d.vendorDueAt)}</Descriptions.Item>}
            <Descriptions.Item label="Số lần trả lại">{`${d.returnCount}/${d.maxReturns}`}</Descriptions.Item>
            {d.note && <Descriptions.Item label={d.kind === 'bao_gia' ? 'Ghi chú của NVKD' : 'Mô tả'}>{d.note}</Descriptions.Item>}
            {d.result && <Descriptions.Item label="Kết quả">{WORKITEM_RESULT_LABELS[d.result]}</Descriptions.Item>}
          </Descriptions>

          {d.status === 'tra_lai' && d.history.filter((h) => h.event === 'return').slice(-1).map((h) => (
            <Alert key={h.at} type="warning" showIcon message={`${h.byName ?? 'NVKD'} trả lại lúc ${formatTime(h.at)}: ${h.reason ? RETURN_REASON_LABELS[h.reason] : ''}${h.note ? ` — ${h.note}` : ''} (trả lại ${d.returnCount}/${d.maxReturns})`} />
          ))}
          {d.status === 'da_gui_khach' && <Alert type="info" showIcon message="Đang gửi qua nick. Nếu lệnh lỗi, xử lý ở Lệnh gửi (Thử lại hoặc Bỏ lệnh); bỏ lệnh thì phiếu quay lại Chờ duyệt." />}

          <div>
            <Text strong>Tin nguồn ({d.messages.length})</Text>
            {d.messages.length ? (
              <div className="wi-sources">
                {d.messages.map((m) => (
                  <div key={m.id} className="wi-source">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {m.senderName ?? 'Khách'} · {formatTime(m.sentAt)}
                    </Text>
                    <div>{m.text ?? (m.attachments?.length ? '' : '[Tin chưa có nội dung]')}</div>
                    {m.attachments?.map((a) => (
                      <Tag key={a.id}>{a.kind === 'audio' ? 'Ghi âm' : a.kind === 'image' ? 'Ảnh' : (a.fileName ?? 'Tệp')}</Tag>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không đọc được tin nguồn" />
            )}
          </div>

          {d.kind === 'bao_gia' && <QuoteBlock d={d} onAttach={(no) => save({ quoteNo: no }, 'Đã gắn báo giá')} />}

          {d.kind === 'hau_mai' && d.can.edit && (
            <div>
              <Text strong>Sau khi gửi khách</Text>
              <div>
                <Radio.Group value={d.afterSend ?? 'cskh_xu_ly'} onChange={(e) => save({ afterSend: e.target.value as AfterSendState })}>
                  <Radio value="cskh_xu_ly">CSKH tiếp tục xử lý</Radio>
                  <Radio value="cho_hang">Chờ hãng</Radio>
                  <Radio value="xong">Xong</Radio>
                </Radio.Group>
              </div>
              {d.afterSend === 'cho_hang' && (
                <DatePicker
                  format="DD/MM/YYYY"
                  placeholder="Hẹn hãng"
                  value={d.vendorDueAt ? dayjs(d.vendorDueAt) : null}
                  onChange={(v: Dayjs | null) => save({ vendorDueAt: v ? v.hour(9).toISOString() : null })}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          )}

          <div>
            <Text strong>Lời nhắn gửi khách</Text>
            <Input.TextArea rows={4} maxLength={max} showCount value={text} disabled={!canEditWords} onChange={(e) => setText(e.target.value)} />
            {d.can.edit && (
              <Button size="small" style={{ marginTop: 6 }} disabled={text === d.message} onClick={() => save({ message: text })}>
                Lưu lời nhắn
              </Button>
            )}
          </div>

          <Space wrap>
            {d.can.start && <Button onClick={() => run('start', undefined, 'Đã nhận phiếu')}>Nhận xử lý</Button>}
            {d.can.aiExtract ? <Button disabled>AI trích nhu cầu</Button> : d.can.edit && (
              <Tooltip title="Chưa bật: chờ chủ dự án bật Gợi ý AI (M1c-06, E8).">
                <Button disabled>AI trích nhu cầu</Button>
              </Tooltip>
            )}
            {d.can.waitVendor && <Button onClick={() => setVendorOpen(true)}>Chờ hãng</Button>}
            {d.can.vendorBack && <Button onClick={() => run('vendor-back', undefined, 'Đã chuyển về CSKH đang xử lý')}>Hãng đã trả kết quả</Button>}
            {d.can.close && <Button onClick={() => setCloseOpen(true)}>Xong</Button>}
            {d.can.submit && (
              <Button
                type="primary"
                onClick={async () => {
                  if (text !== d.message) await save({ message: text });
                  await run('submit', undefined, `Đã chuyển phiếu ${d.code} cho ${d.approverName ?? 'NVKD'} duyệt.`);
                }}
              >
                Chuyển NVKD duyệt
              </Button>
            )}
          </Space>

          {(d.can.return || d.can.selfReply || d.status === 'cho_nvkd_duyet') && !d.can.edit && (
            <Space wrap style={{ justifyContent: 'flex-end', width: '100%' }}>
              {d.can.selfReply && (
                <Popconfirm title="Đóng phiếu và tự trả lời khách?" okText="Đóng phiếu" cancelText="Hủy" onConfirm={() => run('self-reply', {}, `Đã đóng phiếu ${d.code}.`)}>
                  <Button type="link">Tôi tự trả lời</Button>
                </Popconfirm>
              )}
              {d.can.return && <Button onClick={() => setReturnOpen(true)}>Trả lại</Button>}
              {d.status === 'cho_nvkd_duyet' && (
                <Tooltip title={d.can.approve ? '' : (d.can.approveBlock ?? '')}>
                  <Popconfirm
                    disabled={!d.can.approve}
                    title={`Gửi cho ${d.conversationName ?? 'khách'} qua nick?`}
                    description={<div style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{d.quoteNo ? `Báo giá ${d.quoteNo} (PDF) + lời nhắn:\n` : ''}{text}</div>}
                    okText="Duyệt & gửi"
                    cancelText="Hủy"
                    onConfirm={() => run('approve', { message: text, ...(d.quote?.version ? { quoteVersion: d.quote.version } : {}) }, d.quoteNo ? `Đã gửi báo giá ${d.quoteNo} cho ${d.conversationName ?? 'khách'}.` : 'Đã duyệt và gửi.')}
                  >
                    <Button type="primary" disabled={!d.can.approve || !text.trim()}>
                      Duyệt & gửi
                    </Button>
                  </Popconfirm>
                </Tooltip>
              )}
            </Space>
          )}

          <div>
            <Text strong>Lịch sử</Text>
            <Timeline
              style={{ marginTop: 8 }}
              items={d.history.map((h) => ({
                children: `${formatTime(h.at)} · ${h.byName ?? 'Hệ thống'} ${EVENT_LABELS[h.event] ?? h.event}${h.reason ? `: ${RETURN_REASON_LABELS[h.reason]}` : ''}${h.result ? `: ${WORKITEM_RESULT_LABELS[h.result]}` : ''}`,
              }))}
            />
          </div>
        </Space>
      )}
      {d && returnOpen && <ReturnModal code={d.code} onClose={() => setReturnOpen(false)} onOk={(reason, note) => run('return', { reason, note }, `Đã trả lại phiếu ${d.code} cho ${d.assigneeName ?? 'CSKH'}.`)} />}
      {d && closeOpen && <CloseModal d={d} onClose={() => setCloseOpen(false)} onOk={(result, note) => run('close', { result, note }, `Đã đóng phiếu ${d.code}.`)} />}
      {d && vendorOpen && <VendorModal onClose={() => setVendorOpen(false)} onOk={(at) => run('wait-vendor', { vendorDueAt: at }, 'Đã chuyển Chờ hãng.')} />}
    </Drawer>
  );
}

/** Approved VCsales quote of the item (BR16, BR21); the AI proposal is never a quote. */
function QuoteBlock({ d, onAttach }: { d: WorkitemDetail; onAttach: (no: string | null) => void }) {
  const quotes = useWorkitemQuotes(d.id, d.can.edit && !d.quoteNo);
  const options = (quotes.data?.items ?? []).map((x) => ({ value: x.no, label: `${x.no} · ${formatVnd(x.total)}${x.validUntil ? ` · hiệu lực ${vnDate(x.validUntil)}` : ''}` }));
  return (
    <div>
      <Text strong>Báo giá VCsales</Text>
      {d.quote ? (
        <div>
          {d.quote.no} · {d.quote.total != null ? formatVnd(d.quote.total) : '—'}
          {d.quote.validUntil ? ` · hiệu lực ${vnDate(d.quote.validUntil)}` : ''}
          {d.quote.block && <Alert style={{ marginTop: 6 }} type="error" showIcon message={d.quote.block} />}
          {d.can.edit && (
            <Button type="link" size="small" onClick={() => onAttach(null)}>
              Bỏ gắn
            </Button>
          )}
        </div>
      ) : d.can.edit ? (
        <div>
          <Select
            style={{ width: '100%' }}
            placeholder="Gắn báo giá đã duyệt"
            loading={quotes.isLoading}
            options={options}
            notFoundContent={quotes.data?.error ?? (quotes.error as Error | null)?.message ?? 'Chưa có báo giá đã duyệt, còn hiệu lực.'}
            onChange={(v: string) => onAttach(v)}
          />
          {quotes.data?.createUrl && (
            <Button type="link" href={quotes.data.createUrl} target="_blank" rel="noreferrer">
              Tạo trên VCsales ↗
            </Button>
          )}
        </div>
      ) : (
        <div>
          <Text type="secondary">Chưa gắn báo giá đã duyệt.</Text>
        </div>
      )}
    </div>
  );
}

function ReturnModal({ code, onClose, onOk }: { code: string; onClose: () => void; onOk: (r: ReturnReason, note: string) => Promise<boolean> }) {
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [note, setNote] = useState('');
  return (
    <Modal
      open
      title={`Trả lại phiếu ${code}`}
      okText="Xác nhận"
      cancelText="Hủy"
      okButtonProps={{ disabled: !reason }}
      onCancel={onClose}
      onOk={async () => {
        if (reason && (await onOk(reason, note))) onClose();
      }}
    >
      <Radio.Group value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {RETURN_REASONS.map((r) => (
          <Radio key={r} value={r}>
            {RETURN_REASON_LABELS[r]}
          </Radio>
        ))}
      </Radio.Group>
      {!reason && <div style={{ color: 'var(--muted)', marginTop: 8 }}>Chọn lý do trả lại.</div>}
      <Input.TextArea rows={2} maxLength={500} placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 8 }} />
    </Modal>
  );
}

function CloseModal({ d, onClose, onOk }: { d: WorkitemDetail; onClose: () => void; onOk: (r: WorkitemResult, note: string) => Promise<boolean> }) {
  const [result, setResult] = useState<WorkitemResult | null>(null);
  const [note, setNote] = useState('');
  return (
    <Modal
      open
      title={`Đóng phiếu ${d.code}`}
      okText="Đóng phiếu"
      cancelText="Hủy"
      okButtonProps={{ disabled: !result }}
      onCancel={onClose}
      onOk={async () => {
        if (result && (await onOk(result, note))) onClose();
      }}
    >
      <Select style={{ width: '100%' }} placeholder="Chọn kết quả" value={result ?? undefined} onChange={setResult} options={RESULTS_BY_KIND[d.kind].map((r) => ({ value: r, label: WORKITEM_RESULT_LABELS[r] }))} />
      <Input.TextArea rows={2} maxLength={500} placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 8 }} />
    </Modal>
  );
}

function VendorModal({ onClose, onOk }: { onClose: () => void; onOk: (at: string) => Promise<boolean> }) {
  const [at, setAt] = useState<Dayjs | null>(null);
  return (
    <Modal
      open
      title="Chờ hãng"
      okText="Lưu"
      cancelText="Hủy"
      okButtonProps={{ disabled: !at }}
      onCancel={onClose}
      onOk={async () => {
        if (at && (await onOk(at.hour(9).toISOString()))) onClose();
      }}
    >
      <DatePicker format="DD/MM/YYYY" value={at} onChange={setAt} placeholder="Hạn hẹn" style={{ width: '100%' }} />
      {!at && <div style={{ color: 'var(--muted)', marginTop: 8 }}>Nhập hạn hẹn.</div>}
    </Modal>
  );
}
