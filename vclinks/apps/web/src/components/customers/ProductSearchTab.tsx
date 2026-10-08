import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Skeleton, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { productInsertText, type ProductPriceHidden, type ProductRow } from '@vclinks/shared';
import { ApiError } from '../../api';
import { insertIntoComposer } from '../chat/composerBus';
import { useProductSearch } from './catalogApi';

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
const HIDDEN_TEXT: Record<ProductPriceHidden, string> = {
  no_right: 'Chỉ hiện giá niêm yết: bạn chưa có quyền xem giá riêng của khách này.',
  unconfirmed: 'Chỉ hiện giá niêm yết: danh tính khách chưa xác nhận, chưa nói giá riêng.',
  no_link: 'Chỉ hiện giá niêm yết: khách chưa liên kết mã VCsales.',
};

function Row({ p }: { p: ProductRow }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Typography.Text strong>{p.name}</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {[p.oeCodes.join(', '), p.brand, p.fitments.join('; ')].filter(Boolean).join(' · ')}
      </Typography.Text>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span>
          {p.customerPrice !== null ? (
            <>
              <Typography.Text strong>{vnd(p.customerPrice)}</Typography.Text>/{p.unit}
              <Typography.Text type="secondary" delete style={{ marginLeft: 6 }}>{vnd(p.listPrice)}</Typography.Text>
            </>
          ) : (
            <>
              <Typography.Text strong>{vnd(p.listPrice)}</Typography.Text>/{p.unit}
            </>
          )}
        </span>
        {p.stock > 0 ? <Tag color="green">Còn {p.stock}</Tag> : <Tag color="red">Hết hàng</Tag>}
      </div>
      {p.policy && p.customerPrice !== null && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{p.policy}</Typography.Text>}
      <Button size="small" onClick={() => insertIntoComposer(productInsertText(p))}>Chèn vào tin</Button>
    </div>
  );
}

/** Tab "Tra hàng" of the chat panel (M1c-01, F9.1). Read only; "Chèn vào tin" only fills the compose box. */
export default function ProductSearchTab({ uid, userId }: { uid: string; userId: string }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text), 350);
    return () => clearTimeout(t);
  }, [text]);
  const r = useProductSearch(uid, userId, q);
  const denied = r.error instanceof ApiError && (r.error.status === 403 || r.error.status === 404);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Input allowClear prefix={<SearchOutlined />} placeholder="Tên hàng, mã OE, dòng xe…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Tra hàng" />
      {q.trim().length < 2 ? (
        <Typography.Text type="secondary">Gõ ít nhất 2 ký tự, ví dụ "má phanh Vios 2019".</Typography.Text>
      ) : r.isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : denied ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bạn không có quyền tra hàng cho khách này." />
      ) : r.isError ? (
        <Alert type="error" showIcon message="Không tra được hàng." action={<Button size="small" onClick={() => r.refetch()}>Thử lại</Button>} />
      ) : (
        <>
          {r.data!.error && <Alert type="warning" showIcon message={r.data!.error} />}
          {r.data!.priceHidden && <Alert type="info" showIcon message={HIDDEN_TEXT[r.data!.priceHidden]} />}
          {!r.data!.error && r.data!.items.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không thấy hàng khớp." />}
          {r.data!.items.map((p) => <Row key={p.sku} p={p} />)}
        </>
      )}
    </div>
  );
}
