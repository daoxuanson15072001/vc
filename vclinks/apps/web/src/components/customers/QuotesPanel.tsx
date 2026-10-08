import { Alert, Button, Empty, Skeleton, Tag, Tooltip, Typography } from 'antd';
import { SALES_QUOTE_STATUS_LABELS, formatVnd, vnDate, type QuoteRow } from '@vclinks/shared';
import { ApiError } from '../../api';
import { openSendQuote } from '../chat/composerBus';
import { useQuotes } from './quoteApi';

function Row({ q }: { q: QuoteRow }) {
  const expired = q.block?.code === 'expired' && q.status === 'approved';
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, opacity: q.block ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Typography.Text strong>{q.no}</Typography.Text>
        <Tooltip title={q.block?.message}>
          <Tag color={q.block ? 'default' : 'green'} style={{ marginInlineEnd: 0 }} title={q.erpStatusLabel ? `Trên VCsales: ${q.erpStatusLabel}` : undefined}>{expired ? 'Hết hạn' : SALES_QUOTE_STATUS_LABELS[q.status]}</Tag>
        </Tooltip>
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {vnDate(q.date)} · {formatVnd(q.total)} · hiệu lực {q.validUntil ? vnDate(q.validUntil) : '–'}
      </Typography.Text>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Đã gửi {q.sendCount} lần</Typography.Text>
        <Button size="small" disabled={!!q.block} onClick={() => openSendQuote(q.no)}>Gửi</Button>
      </div>
    </div>
  );
}

/**
 * Panel "Báo giá" (03 MH-SZ-07 #9): the quotes of the customer of this chat, read live from VCsales, with
 * "Gửi" opening the send box on that quote and "Tạo báo giá" opening VCsales on the right customer. This panel
 * only reads; sending happens in the box. M1c-08's information drawer mounts the same component (see docs).
 */
export default function QuotesPanel({ uid, threadId }: { uid: string; threadId: string }) {
  const q = useQuotes(uid, threadId);
  if (q.isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (q.isError) {
    const denied = q.error instanceof ApiError && (q.error.status === 403 || q.error.status === 404);
    return denied ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bạn không có quyền xem báo giá của khách này." /> : <Alert type="error" showIcon message="Không tải được báo giá." action={<Button size="small" onClick={() => q.refetch()}>Thử lại</Button>} />;
  }
  const d = q.data!;
  if (d.hidden === 'no_link') return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Khách chưa liên kết mã KH VCsales nên chưa có báo giá." />;
  if (d.hidden) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={d.hidden === 'unconfirmed' ? 'Danh tính khách chưa xác nhận.' : 'Bạn không có quyền xem báo giá của khách này.'} />;
  if (d.error) return <Alert type="error" showIcon message={d.error} action={<Button size="small" onClick={() => q.refetch()}>Thử lại</Button>} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text strong>Báo giá ({d.items.length})</Typography.Text>
        <span>
          <Button size="small" onClick={() => q.refetch()} loading={q.isFetching} style={{ marginRight: 6 }}>Làm mới</Button>
          {d.createUrl && <Button size="small" href={d.createUrl} target="_blank" rel="noopener noreferrer">Tạo báo giá ↗</Button>}
        </span>
      </div>
      {d.items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có báo giá nào của khách trên VCsales." /> : d.items.map((x) => <Row key={x.no} q={x} />)}
    </div>
  );
}
