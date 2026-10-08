import { useState } from 'react';
import { Alert, Button, Empty, Segmented, Skeleton, Space, Tag, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { ORG_ROLE_LABELS, renderDebtReminder } from '@vclinks/shared';
import { ApiError } from '../../api';
import ChatAvatar from '../chat/ChatAvatar';
import { insertIntoComposer } from '../chat/composerBus';
import ActivityList from './ActivityList';
import ChannelChip from './ChannelChip';
import CommerceBlock from './CommerceBlock';
import ContactValue, { mainPoint } from './ContactValue';
import { usePanel360 } from './customerApi';
import ProductSearchTab from './ProductSearchTab';
import ErpCodeLine from './ErpCodeLine';
import QuotesPanel from './QuotesPanel';

/**
 * Right panel of the chat (00 MH-UI-09, 02 MH-DK-02): who the customer is, who is in charge, phone by right, other
 * channels the customer is active on, and the VCsales block. The customer comes from the identity of the open
 * conversation (`/customers/by-identity/:uid/:userId/360`). Tabs Báo giá (M1c-02) and Tra hàng (M1c-01) sit beside it. Not shown here yet (later phases): tab
 * Việc, tags editing, complaints, "Cam kết đã nêu", AI summary, "Soạn ở kênh này".
 */
export default function CustomerPanel({ uid, userId, conversationId, onClose }: { uid: string; userId: string; conversationId: string; onClose?: () => void }) {
  const navigate = useNavigate();
  const q = usePanel360(uid, userId);
  const [tab, setTab] = useState<'khach' | 'bao-gia' | 'tra-hang'>('khach');
  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
      <Typography.Text strong>Khách hàng</Typography.Text>
      {onClose && <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} aria-label="Ẩn panel" />}
    </div>
  );
  let body;
  if (q.isLoading) body = <Skeleton active avatar paragraph={{ rows: 6 }} />;
  else if (q.isError) {
    const e = q.error;
    const noProfile = e instanceof ApiError && e.status === 404 && /chưa có hồ sơ/.test(e.message);
    const denied = e instanceof ApiError && (e.status === 403 || e.status === 404);
    body = noProfile ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Hội thoại này chưa gắn với hồ sơ khách." />
    ) : denied ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bạn không có quyền xem hồ sơ khách này." />
    ) : (
      <Alert type="error" showIcon message="Không tải được thông tin khách." action={<Button size="small" onClick={() => q.refetch()}>Thử lại</Button>} />
    );
  } else {
    const d = q.data!;
    const c = d.customer;
    const contact = c.contacts.find((x) => x.id === d.identity?.contactId) ?? c.contacts[0];
    const phone = mainPoint([...(contact?.points ?? []), ...c.points], 'phone');
    const email = mainPoint([...(contact?.points ?? []), ...c.points], 'email');
    const others = c.contacts.length - 1;
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ChatAvatar size={44} name={c.name} colorKey={c.id} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong style={{ display: 'block' }}>{c.name}</Typography.Text>
            <Typography.Text type="secondary">{[c.type, c.region].filter(Boolean).join(' · ')}</Typography.Text>
          </div>
          <Button size="small" onClick={() => navigate(`/customers/${encodeURIComponent(c.id)}`)}>Mở 360 ↗</Button>
        </div>
        {d.unconfirmed && (
          <Alert type="warning" showIcon message={<span><Tag color="gold">Chưa xác nhận</Tag>Danh tính chưa xác nhận. Không nói công nợ, đơn hàng, giá riêng cho tới khi xác nhận.</span>} />
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          Kênh: {d.channels.map((n) => <ChannelChip key={n.uid} channel={n.channel} nickLabel={n.nickLabel} ownerName={n.nickOwnerName} />)}
        </div>
        {contact && (
          <div>
            Người liên hệ: {contact.name}
            {contact.orgRole ? ` (${ORG_ROLE_LABELS[contact.orgRole]})` : ''}
            {others > 0 && <Typography.Text type="secondary"> +{others} người khác</Typography.Text>}
          </div>
        )}
        <div>SĐT: <ContactValue accountId={c.id} point={phone} allowCopy /></div>
        {email && <div>Email: <ContactValue accountId={c.id} point={email} /></div>}
        <div>
          Phụ trách:{' '}
          {c.owners.length ? <span style={d.viewer.isOwner ? undefined : { color: 'var(--warn-ink)' }}>{c.owners.map((o) => o.userName ?? '–').join(', ')}</span> : <span style={{ color: 'var(--warn-ink)' }}>Chưa có người phụ trách</span>}
        </div>
        <ErpCodeLine data={d} />
        {/* "Khách cũng nhắn ở nick khác" (UAT-DK-73) is the banner of the chat itself (CrossChannelBanner), always visible. */}
        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Liên lạc gần đây</Typography.Text>
          <ActivityList rows={d.activity} currentId={conversationId} limit={3} />
        </div>
        {d.commerceHidden === 'unconfirmed' ? (
          <div style={{ border: '1px solid var(--danger)', borderRadius: 6, padding: 8 }}>
            <Typography.Text type="secondary">Không chia sẻ với người trong hội thoại này.</Typography.Text>
          </div>
        ) : d.commerceHidden === 'no_right' ? null : (
          <CommerceBlock data={d} compact onRemind={() => d.commerce?.debt && insertIntoComposer(renderDebtReminder({ ten_khach: contact?.name ?? c.name, amount: d.commerce.debt.amount, dueAt: d.commerce.debt.dueAt }))} onRefresh={() => q.refreshCommerce.mutate()} refreshing={q.refreshCommerce.isPending} onLink={() => navigate('/customers/erp-matching')} />
        )}
        {d.viewer.timeline && (
          <Space>
            <Link to={`/customers/${encodeURIComponent(c.id)}?tab=timeline`}>Xem dòng thời gian</Link>
          </Space>
        )}
      </div>
    );
  }
  return (
    <aside className="customer-panel" aria-label="Thông tin khách">
      {header}
      <div style={{ padding: '8px 12px 0' }}>
        <Segmented block size="small" value={tab} onChange={(v) => setTab(v as 'khach' | 'bao-gia' | 'tra-hang')} options={[{ label: 'Khách', value: 'khach' }, { label: 'Báo giá', value: 'bao-gia' }, { label: 'Tra hàng', value: 'tra-hang' }]} />
      </div>
      <div style={{ padding: 12, overflowY: 'auto', flex: 1, minHeight: 0 }}>{tab === 'tra-hang' ? <ProductSearchTab uid={uid} userId={userId} /> : tab === 'bao-gia' ? <QuotesPanel uid={uid} threadId={userId} /> : body}</div>
    </aside>
  );
}
