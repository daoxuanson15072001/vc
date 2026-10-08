import { useMemo, useState } from 'react';
import { Alert, App, Breadcrumb, Button, Card, Col, DatePicker, Descriptions, Dropdown, Empty, Input, Popconfirm, Result, Row, Select, Skeleton, Space, Table, Tabs, Tag, Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CHANNEL_INFO, NO_ACCESS_TEXT, ORG_ROLE_LABELS, type Customer360, type IdentityView } from '@vclinks/shared';
import { api } from '../api';
import NoAccess, { isNoAccessError } from '../components/access/NoAccess';
import ChatAvatar from '../components/chat/ChatAvatar';
import ChannelBadge from '../components/ChannelBadge';
import { relativeListTime } from '../utils/time';
import ActivityList from '../components/customers/ActivityList';
import ChannelChip from '../components/customers/ChannelChip';
import CommerceBlock from '../components/customers/CommerceBlock';
import ContactValue, { mainPoint } from '../components/customers/ContactValue';
import Timeline, { LoadMore } from '../components/customers/Timeline';
import { useCustomer360, useCustomerTimeline, useOperations, type TimelineFilters } from '../components/customers/customerApi';
import ErpCodeLine from '../components/customers/ErpCodeLine';
import { fmtTime } from '../time';
import { nickName } from '../utils/nick';
import { usePageTitle } from '../components/layout/PageTitle';

const TABS = ['overview', 'timeline', 'contacts', 'identities', 'commerce', 'invoices', 'tasks', 'log'] as const;
type TabKey = (typeof TABS)[number];
const OP_LABEL: Record<string, string> = { auto_merge: 'Tự gộp', merge: 'Gộp', undo: 'Hoàn tác', erp_link: 'Liên kết mã KH', import: 'Nạp VCsales' };
const IDENTITY_STATE: Record<string, string> = { new: 'Mới', auto: 'Tự gộp', confirmed: 'Đã xác nhận', unconfirmed: 'Chưa xác nhận' };

/**
 * Customer 360 (02 MH-DK-01): one page for one customer. M1 has Zalo personal only, so the channel chips are Zalo
 * nicks; the layout is ready for the other channels. Tabs follow `?tab=`. Phones and emails show by right (DK-44).
 * Not built yet and said so on the page: invoices (06), tasks and tickets, split / manual link, change of owner.
 */
export default function CustomerPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as TabKey) : 'overview';
  const q = useCustomer360(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  usePageTitle(q.data?.customer.name);

  if (q.isLoading) return <Skeleton active avatar paragraph={{ rows: 8 }} />;
  if (q.isError) {
    if (isNoAccessError(q.error)) return <NoAccess kind="object" code={id} />;
    return <Result status="error" title="Không tải được hồ sơ khách. Thử lại sau ít phút." extra={<Button onClick={() => q.refetch()}>Thử lại</Button>} />;
  }
  const d = q.data!;
  const c = d.customer;
  const phone = mainPoint([...c.contacts.flatMap((x) => x.points), ...c.points], 'phone');
  const email = mainPoint([...c.contacts.flatMap((x) => x.points), ...c.points], 'email');
  const allIdentities = c.contacts.flatMap((x) => x.identities.map((i) => ({ ...i, contactName: x.name })));
  const uniqueNicks = [...new Map(allIdentities.map((i) => [i.uid, i])).values()];
  const nickInfo = new Map(d.channels.map((a) => [a.uid, a]));
  const owners = c.owners.length ? c.owners.map((o) => `${o.division} · ${o.userName ?? '–'}`).join('   ') : null;
  const goTab = (k: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', k); return n; }, { replace: true });
  const reachable = d.activity.filter((a) => !a.locked);
  const recommended = d.recommendedConversationId;
  const openConv = (cid: string) => navigate(`/conversations/${encodeURIComponent(cid)}`);
  // Latest message of any channel (the "Tương tác gần nhất" fact).
  const last = d.activity.reduce<(typeof d.activity)[number] | null>((m, a) => (a.lastMsgAt && (!m?.lastMsgAt || a.lastMsgAt > m.lastMsgAt) ? a : m), null);

  return (
    <div className="page page--wide">
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: <Link to="/customers">Khách hàng</Link> }, { title: c.name }]} />
      <section className="surface cust-hero">
        <ChatAvatar size={56} name={c.name} colorKey={c.id} />
        <div className="cust-hero__main">
          <h1 className="cust-hero__name">{c.name}</h1>
          <div className="cust-hero__sub">
            {[c.type, c.region].filter(Boolean).length > 0 && <span>{[c.type, c.region].filter(Boolean).join(' · ')}</span>}
            {uniqueNicks.map((n) => (
              <ChannelBadge key={n.uid} channel={n.channel as never} compact />
            ))}
            {c.status === 'merged' && <span className="soft-chip">Đã gộp</span>}
            {d.unconfirmed && <span className="soft-chip soft-chip--warn">Chưa xác nhận</span>}
          </div>
        </div>
        <Space wrap className="cust-hero__actions">
          <Dropdown
            disabled={!reachable.length}
            menu={{
              items: [...reachable].sort((a, b) => (a.conversationId === recommended ? -1 : b.conversationId === recommended ? 1 : 0)).map((a) => ({
                key: a.conversationId,
                label: `${CHANNEL_INFO[a.channel].shortLabel} · ${nickName(a.nickLabel, a.nickOwnerName)}${a.conversationId === recommended ? ' (nên trả lời ở đây)' : ''}`,
              })),
              onClick: ({ key }) => openConv(key),
            }}
          >
            <Button type="primary" icon={<MessageOutlined />}>
              Nhắn tin
            </Button>
          </Dropdown>
        </Space>
      </section>
      <section className="surface facts" aria-label="Tóm tắt">
        <div className="fact">
          <span className="fact__k">Người phụ trách</span>
          {owners ? <span className="fact__v" style={d.viewer.isOwner ? undefined : { color: 'var(--warn-ink)' }}>{owners}</span> : <span className="fact__v" style={{ color: 'var(--warn-ink)' }}>Chưa có người phụ trách</span>}
        </div>
        <div className="fact">
          <span className="fact__k">Mã KH</span>
          {/* MH-DK-10 / MH-DK-12: the code, or "Liên kết mã KH…" / "Đưa vào hàng chờ tạo mã"; with a code, data VCsales lacks. */}
          <span className="fact__v"><ErpCodeLine data={d} bare /></span>
        </div>
        <div className="fact">
          <span className="fact__k">SĐT chính</span>
          <span className="fact__v"><ContactValue accountId={c.id} point={phone} allowCopy /></span>
        </div>
        <div className="fact">
          <span className="fact__k">Email</span>
          <span className="fact__v"><ContactValue accountId={c.id} point={email} /></span>
        </div>
        <div className="fact">
          <span className="fact__k">Tương tác gần nhất</span>
          {last?.lastMsgAt ? (
            <span className="fact__v">
              {relativeListTime(last.lastMsgAt)}
              <span className="fact__hint">
                qua {CHANNEL_INFO[last.channel].shortLabel} · {nickName(last.nickLabel, last.nickOwnerName)}
              </span>
            </span>
          ) : (
            <span className="fact__v fact__v--muted">Chưa có</span>
          )}
        </div>
        <div className="fact">
          <span className="fact__k">Kênh</span>
          <span className="fact__v fact__chips">
            {uniqueNicks.length ? uniqueNicks.map((n) => <ChannelChip key={n.uid} channel={n.channel as never} nickLabel={nickInfo.get(n.uid)?.nickLabel} ownerName={nickInfo.get(n.uid)?.nickOwnerName} />) : <span className="fact__v--muted">chưa có</span>}
          </span>
        </div>
      </section>
      {c.mergedInto && <Alert type="info" showIcon style={{ marginBottom: 8 }} message="Hồ sơ này đã được gộp vào hồ sơ khác." />}
      {d.unconfirmed && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message="Danh tính chưa xác nhận. Không nói công nợ, đơn hàng, giá riêng cho tới khi xác nhận." />}
      <Tabs
        activeKey={tab}
        onChange={goTab}
        items={[
          { key: 'overview', label: 'Tổng quan', children: <Overview d={d} onMoreTimeline={() => goTab('timeline')} onRefresh={() => qc.invalidateQueries({ queryKey: ['customer360', id] })} onLink={() => navigate('/customers/erp-matching')} /> },
          { key: 'timeline', label: 'Dòng thời gian', children: <TimelineTab d={d} /> },
          { key: 'contacts', label: `Người liên hệ (${c.contacts.length})`, children: <ContactsTab d={d} /> },
          { key: 'identities', label: `Danh tính & kênh (${allIdentities.length})`, children: <IdentitiesTab rows={allIdentities} nicks={nickInfo} /> },
          { key: 'commerce', label: 'Thương mại', children: <CommerceTab d={d} onRefresh={() => qc.invalidateQueries({ queryKey: ['customer360', id] })} /> },
          { key: 'invoices', label: 'Hóa đơn & thanh toán', children: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu hóa đơn. Phần này nối với VCinvoice ở giai đoạn sau." /> },
          { key: 'tasks', label: 'Việc cần làm', children: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có việc cần làm. Nhắc việc và ticket chưa có ở bản này." /> },
          { key: 'log', label: 'Nhật ký hồ sơ', children: <LogTab accountId={c.id} active={tab === 'log'} /> },
        ]}
      />
    </div>
  );
}

function Overview({ d, onMoreTimeline, onRefresh, onLink }: { d: Customer360; onMoreTimeline: () => void; onRefresh: () => void; onLink: () => void }) {
  const rec = d.activity.find((a) => a.conversationId === d.recommendedConversationId);
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card size="small" title="Khách đang hoạt động">
          <ActivityList rows={d.activity} />
          {rec && <div style={{ marginTop: 8 }}>Nên trả lời ở: <ChannelChip channel={rec.channel} nickLabel={rec.nickLabel} ownerName={rec.nickOwnerName} /> (tin chưa trả lời)</div>}
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small" title="Thương mại">
          {d.commerceHidden === 'no_right' ? <Typography.Text type="secondary">Bạn không có quyền xem phần thương mại của khách này.</Typography.Text> : <CommerceBlock data={d} onRefresh={onRefresh} onLink={onLink} />}
          {d.commerceHidden === 'unconfirmed' && <Typography.Text type="secondary">Danh tính chưa xác nhận: chưa hiện dữ liệu thương mại.</Typography.Text>}
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small" title="Việc cần làm"><Typography.Text type="secondary">Chưa có việc cần làm.</Typography.Text></Card>
      </Col>
      <Col xs={24}>
        <Card size="small" title="5 sự kiện gần nhất" extra={d.viewer.timeline && <Button type="link" size="small" onClick={onMoreTimeline}>Xem đầy đủ</Button>}>
          {d.viewer.timeline ? <Timeline events={d.recent} nextLabel="Khách chưa có sự kiện nào." /> : <Typography.Text type="secondary">{NO_ACCESS_TEXT.api}</Typography.Text>}
        </Card>
      </Col>
    </Row>
  );
}

function TimelineTab({ d }: { d: Customer360 }) {
  const [params, setParams] = useSearchParams();
  const f: TimelineFilters = {
    contact: params.get('contact') || undefined,
    uid: params.get('uid') || undefined,
    type: (params.get('type') as TimelineFilters['type']) || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    q: params.get('q') || undefined,
  };
  const set = (k: string, v: string | undefined) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const q = useCustomerTimeline(d.customer.id, f, d.viewer.timeline);
  const events = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.events), [q.data]);
  const meta = q.data?.pages[0];
  if (!d.viewer.timeline) return <Result status="403" title={NO_ACCESS_TEXT.objectTitle} subTitle="Bạn không có quyền xem dòng thời gian của khách này." />;
  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select allowClear placeholder="Người: Tất cả" style={{ width: 180 }} value={f.contact} onChange={(v) => set('contact', v)} options={(meta?.contacts ?? d.customer.contacts.map((c) => ({ id: c.id, name: c.name }))).map((c) => ({ value: c.id, label: c.name }))} />
        <Select allowClear placeholder="Kênh: Tất cả" style={{ width: 220 }} value={f.uid} onChange={(v) => set('uid', v)} options={(meta?.channels ?? []).map((c) => ({ value: c.uid, label: `${CHANNEL_INFO[c.channel].shortLabel} · ${nickName(c.nickLabel)}` }))} />
        <Select allowClear placeholder="Loại: Tất cả" style={{ width: 150 }} value={f.type} onChange={(v) => set('type', v)} options={[{ value: 'message', label: 'Tin nhắn' }, { value: 'profile', label: 'Hồ sơ' }, { value: 'quote', label: 'Báo giá' }]} />
        <DatePicker.RangePicker format="DD/MM/YYYY" onChange={(r) => { set('from', r?.[0]?.startOf('day').toISOString()); set('to', r?.[1]?.endOf('day').toISOString()); }} />
        <Input.Search allowClear placeholder="Tìm trong nội dung" style={{ width: 220 }} defaultValue={f.q} onSearch={(v) => set('q', v.trim().length >= 2 ? v.trim() : undefined)} />
      </Space>
      {q.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : q.isError ? <Alert type="error" showIcon message="Không tải được dòng thời gian. Thử lại sau ít phút." /> : <Timeline events={events} />}
      <LoadMore hasMore={!!q.hasNextPage} loading={q.isFetchingNextPage} onMore={() => q.fetchNextPage()} />
    </div>
  );
}

function ContactsTab({ d }: { d: Customer360 }) {
  const c = d.customer;
  return (
    <Table
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={c.contacts}
      columns={[
        { title: 'Tên', dataIndex: 'name' },
        { title: 'Vai trò', dataIndex: 'orgRole', render: (v: keyof typeof ORG_ROLE_LABELS | null) => (v ? ORG_ROLE_LABELS[v] : <Typography.Text type="secondary">Chưa ghi</Typography.Text>) },
        { title: 'Kênh', render: (_: unknown, r) => <Space wrap>{[...new Set(r.identities.map((i) => i.uid))].map((u) => { const i = r.identities.find((x) => x.uid === u)!; return <ChannelChip key={u} channel={i.channel as never} plain />; })}</Space> },
        { title: 'SĐT', render: (_: unknown, r) => <ContactValue accountId={c.id} point={mainPoint(r.points, 'phone')} /> },
        { title: 'Email', render: (_: unknown, r) => <ContactValue accountId={c.id} point={mainPoint(r.points, 'email')} /> },
      ]}
    />
  );
}

function IdentitiesTab({ rows, nicks }: { rows: (IdentityView & { contactName: string })[]; nicks: Map<string, Customer360['channels'][number]> }) {
  return (
    <Table
      rowKey="identityId"
      size="small"
      pagination={false}
      dataSource={rows}
      columns={[
        { title: 'Kênh', render: (_: unknown, r) => <ChannelChip channel={r.channel as never} nickLabel={nicks.get(r.uid)?.nickLabel} ownerName={nicks.get(r.uid)?.nickOwnerName} /> },
        { title: 'Tên hiển thị', render: (_: unknown, r) => r.name ?? '–' },
        { title: 'Người liên hệ', dataIndex: 'contactName' },
        { title: 'Liên kết bởi', render: (_: unknown, r) => (r.linkedBy === 'system' ? 'Tự động' : r.linkedBy.replace(/^user:/, '')) },
        { title: 'Lúc', dataIndex: 'linkedAt', render: (v: string) => fmtTime(v) },
        { title: 'Trạng thái', dataIndex: 'state', render: (v: string) => <Tag color={v === 'unconfirmed' ? 'gold' : v === 'confirmed' ? 'green' : 'default'}>{IDENTITY_STATE[v] ?? v}</Tag> },
      ]}
    />
  );
}

function CommerceTab({ d, onRefresh }: { d: Customer360; onRefresh: () => void }) {
  const navigate = useNavigate();
  if (d.commerceHidden === 'no_right') return <Result status="403" title={NO_ACCESS_TEXT.objectTitle} subTitle="Bạn không có quyền xem phần thương mại của khách này." />;
  if (d.commerceHidden === 'unconfirmed') return <Alert type="warning" showIcon message="Danh tính chưa xác nhận. Không hiện công nợ, đơn hàng, giá riêng cho tới khi xác nhận." />;
  return <CommerceBlock data={d} onRefresh={onRefresh} onLink={() => navigate('/customers/erp-matching')} />;
}

function LogTab({ accountId, active }: { accountId: string; active: boolean }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const ops = useOperations(accountId, active);
  const undo = async (id: string) => {
    try {
      await api(`/customers/merge-operations/${encodeURIComponent(id)}/undo`, { method: 'POST' });
      message.success('Đã hoàn tác gộp hồ sơ.');
      await qc.invalidateQueries({ queryKey: ['customer-operations', accountId] });
      await qc.invalidateQueries({ queryKey: ['customer360', accountId] });
    } catch (e) {
      message.error((e as Error).message);
    }
  };
  return (
    <Table
      rowKey="id"
      size="small"
      pagination={false}
      loading={ops.isLoading}
      dataSource={ops.data ?? []}
      locale={{ emptyText: 'Chưa có thay đổi nào trên hồ sơ này.' }}
      columns={[
        { title: 'Lúc', dataIndex: 'at', render: (v: string) => fmtTime(v) },
        { title: 'Thay đổi', dataIndex: 'op', render: (v: string, r) => <span>{OP_LABEL[v] ?? v}{r.undoneAt ? <Tag style={{ marginLeft: 8 }}>Đã hoàn tác</Tag> : null}</span> },
        { title: 'Người làm', dataIndex: 'actor', render: (v: string) => (v === 'system' ? 'Hệ thống' : v.replace(/^user:/, '')) },
        {
          title: '',
          render: (_: unknown, r) =>
            (r.op === 'auto_merge' || r.op === 'merge') && !r.undoneAt && r.undoUntil && Date.parse(r.undoUntil) > Date.now() ? (
              <Popconfirm title="Hoàn tác lần gộp này? Các danh tính sẽ về lại hồ sơ cũ." okText="Hoàn tác" cancelText="Hủy" onConfirm={() => undo(r.id)}>
                <Button size="small">Hoàn tác</Button>
              </Popconfirm>
            ) : null,
        },
      ]}
    />
  );
}
