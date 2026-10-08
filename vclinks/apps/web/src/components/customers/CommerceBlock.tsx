import { Alert, Button, Descriptions, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { debtLineText, type Customer360 } from '@vclinks/shared';
import { fmtTime } from '../../time';

export const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
const date = (iso: string | null | undefined) => (iso ? fmtTime(iso, 'DD/MM/YYYY') : '–');

/**
 * Commercial block of the customer (02 MH-DK-01 #12, 00 MH-UI-09 #9). Data is a VCsales snapshot with the time it was
 * taken; when VCsales does not answer the last snapshot stays, in italics, with the ERR-ERP notice (UAT-UI-67).
 * Hidden states: no right (nothing shown), unconfirmed identity (DK-15, banner elsewhere), no linked code.
 */
export default function CommerceBlock({ data, onRefresh, refreshing, onLink, compact, onRemind }: { data: Customer360; onRefresh?: () => void; refreshing?: boolean; onLink?: () => void; compact?: boolean; onRemind?: () => void }) {
  const c = data.commerce;
  if (!c) {
    if (data.commerceHidden !== 'no_link') return null;
    return (
      <div>
        <Typography.Text type="secondary">{compact ? 'Khách chưa liên kết mã KH VCsales.' : 'Chưa liên kết mã KH.'}</Typography.Text>{' '}
        {data.viewer.canConfirmErp && onLink && (
          <Button type="link" size="small" onClick={onLink}>
            {compact ? 'Gợi ý liên kết' : 'Liên kết mã KH'}
          </Button>
        )}
      </div>
    );
  }
  const full = data.viewer.commerce === 'full';
  const italic = c.stale ? { fontStyle: 'italic' as const } : undefined;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <Typography.Text strong>Thương mại · VCsales · {fmtTime(c.fetchedAt, 'HH:mm')}</Typography.Text>
        {onRefresh && <Button type="text" size="small" icon={<ReloadOutlined />} loading={refreshing} onClick={onRefresh} aria-label="Lấy lại từ VCsales" />}
      </div>
      {c.error && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message={<span><b>ERR-ERP</b> · {c.error} (lúc {fmtTime(c.fetchedAt, 'HH:mm DD/MM')})</span>} />}
      {full && c.debt && (
        // One wording for the chat panel and the 360 page (03 MH-SZ-07 #3, UAT-SZ-86): red and bold when overdue.
        <div style={{ marginBottom: 6, ...italic, ...(c.debt.overdue ? { color: 'var(--danger)', fontWeight: 600 } : undefined) }} data-testid="debt-line">
          {c.debt.overdue ? '⚠ ' : ''}
          {debtLineText(c.debt, fmtTime(c.fetchedAt, 'HH:mm'))}
          {c.debt.overdue && onRemind && (
            <Button type="link" size="small" onClick={onRemind} style={{ fontWeight: 400 }}>
              Tôi tự nhắc khách
            </Button>
          )}
        </div>
      )}
      <Descriptions column={1} size="small" style={italic}>
        <Descriptions.Item label="Mã KH">{c.code}</Descriptions.Item>
        {full && c.tier && <Descriptions.Item label="Hạng / loại khách">{c.tier}</Descriptions.Item>}
        {full && c.revenue12m !== null && <Descriptions.Item label="Doanh số 12 tháng">{money(c.revenue12m)}</Descriptions.Item>}
        {!full && <Descriptions.Item label="Công nợ quá hạn">{c.hasOverdueDebt ? 'Có' : 'Không'}</Descriptions.Item>}
        {full && c.openQuotes && c.openQuotes.length > 0 && (
          <Descriptions.Item label="Báo giá đang mở">
            {c.openQuotes.map((q) => (
              <div key={q.no}>
                {q.no} {money(q.total)}
                {q.validUntil ? ` (hạn ${date(q.validUntil)})` : ''}
              </div>
            ))}
          </Descriptions.Item>
        )}
        {c.lastOrder && (
          <Descriptions.Item label="Đơn gần nhất">
            {c.lastOrder.no} · {date(c.lastOrder.at)} · {c.lastOrder.status}
          </Descriptions.Item>
        )}
      </Descriptions>
    </div>
  );
}
