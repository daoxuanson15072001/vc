import { useMemo, useState } from 'react';
import { Alert, Button, Empty, Input, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CONTACT_ROLES, CONTACT_ROLE_LABELS, type ContactGroupItem, type ContactGroupsResponse, type ContactListItem, type ContactListResponse, type ContactRole, type ContactSort } from '@vclinks/shared';
import { api } from '../api';
import ChatAvatar from '../components/chat/ChatAvatar';
import { MaskedPhone, type PhoneFields } from '../components/contacts/MaskedContact';
import ContactsTabs from '../components/contacts/ContactsTabs';
import { useContactNick } from '../components/contacts/friend-requests';
import { fmtTime } from '../time';
import { nickName } from '../utils/nick';

const PAGE_SIZE = 50;

/** "dd/mm/yyyy HH:mm" in Vietnam time, "–" when unknown. */
const fmt = (iso: string | null) => (iso ? fmtTime(iso) : '–');

/**
 * Danh bạ Zalo (03 MH-SZ-09). Tab "Bạn bè": friends of one personal Zalo nick
 * as read from the Zalo Web friend list by the extension's ContactReader. Tab
 * "Nhóm": its groups and communities. Tab "Lời mời kết bạn" is its own page
 * (FriendRequestsPage). Vai trò filter (#4) and column: M1b-12. "Gắn hồ sơ"
 * comes with M1b-13 and is not shown until it works.
 */
export default function ContactsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tab = params.get('tab') === 'groups' ? 'groups' : 'friends';
  // Default nick: the one chosen in the nav rail, else the first personal Zalo nick.
  const { uid, setUid, nicks, accounts } = useContactNick();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<ContactSort>('name');
  const [role, setRole] = useState<ContactRole | 'none' | undefined>();
  const [page, setPage] = useState(1);

  const groups = useQuery({
    queryKey: ['contact-groups', uid, q, page],
    enabled: !!uid && tab === 'groups',
    queryFn: () => api<ContactGroupsResponse>('/contacts/groups', { query: { uid: uid!, q: q || undefined, page, pageSize: PAGE_SIZE } }),
    placeholderData: (prev) => prev,
  });

  const list = useQuery({
    queryKey: ['contacts', uid, q, sort, role, page],
    enabled: !!uid && tab === 'friends',
    queryFn: () =>
      api<ContactListResponse>('/contacts', { query: { uid: uid!, q: q || undefined, sort, role, page, pageSize: PAGE_SIZE } }),
    placeholderData: (prev) => prev,
  });

  const stats = list.data?.stats;
  const columns = [
    {
      key: 'avatar',
      width: 56,
      render: (_: unknown, c: ContactListItem) => <ChatAvatar size={36} name={c.name ?? undefined} src={c.avatar ?? undefined} colorKey={c.userId} />,
    },
    {
      title: 'Tên trên Zalo',
      key: 'name',
      render: (_: unknown, c: ContactListItem) => (
        <Space size={4} wrap>
          {c.name ? <span>{c.name}</span> : <Typography.Text type="secondary">Đang chờ tên từ Zalo</Typography.Text>}
          {c.isOA && <Tag color="blue">OA</Tag>}
        </Space>
      ),
    },
    {
      title: 'SĐT',
      key: 'phone',
      width: 150,
      render: (_: unknown, c: ContactListItem) => <MaskedPhone contact={c as ContactListItem & PhoneFields} uid={uid ?? ''} userId={c.userId} where="MH-DK-01" />,
    },
    {
      title: 'Vai trò',
      key: 'role',
      width: 140,
      render: (_: unknown, c: ContactListItem) => (c.role ? CONTACT_ROLE_LABELS[c.role] : <Typography.Text type="secondary">Chưa phân loại</Typography.Text>),
    },
    {
      title: 'Thẻ phân loại',
      key: 'labels',
      width: 180,
      render: (_: unknown, c: ContactListItem) => (c.labels.length ? c.labels.map((l) => <Tag key={l}>{l}</Tag>) : '–'),
    },
    {
      title: 'Nhắn gần nhất',
      key: 'lastMsgAt',
      width: 160,
      render: (_: unknown, c: ContactListItem) => fmt(c.lastMsgAt),
    },
    {
      key: 'actions',
      width: 56,
      render: (_: unknown, c: ContactListItem) =>
        c.conversationId ? (
          <Tooltip title="Nhắn tin">
            <Button
              type="text"
              icon={<MessageOutlined />}
              aria-label={`Nhắn tin với ${c.name ?? 'người này'}`}
              onClick={() => navigate(`/conversations/${encodeURIComponent(c.conversationId!)}`)}
            />
          </Tooltip>
        ) : null,
    },
  ];

  const groupColumns = [
    {
      key: 'avatar',
      width: 56,
      render: (_: unknown, g: ContactGroupItem) => <ChatAvatar size={36} name={g.name ?? undefined} colorKey={g.threadId} />,
    },
    {
      title: 'Tên nhóm',
      key: 'name',
      render: (_: unknown, g: ContactGroupItem) => g.name ?? <Typography.Text type="secondary">Đang chờ tên từ Zalo</Typography.Text>,
    },
    {
      title: 'Thành viên',
      key: 'members',
      width: 120,
      render: (_: unknown, g: ContactGroupItem) => (g.memberCount != null ? g.memberCount : '–'),
    },
    {
      title: 'Nhắn gần nhất',
      key: 'lastMsgAt',
      width: 160,
      render: (_: unknown, g: ContactGroupItem) => fmt(g.lastMsgAt),
    },
    {
      key: 'actions',
      width: 56,
      render: (_: unknown, g: ContactGroupItem) => (
        <Tooltip title="Mở nhóm">
          <Button type="text" icon={<MessageOutlined />} aria-label={`Mở nhóm ${g.name ?? ''}`} onClick={() => navigate(`/conversations/${encodeURIComponent(g.conversationId)}`)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Danh bạ
      </Typography.Title>
      <ContactsTabs active={tab} uid={uid} />
      <Typography.Text strong>
        {tab === 'groups' ? `Nhóm (${groups.data ? groups.data.total : '…'})` : `Bạn bè (${list.data ? list.data.total : '…'})`}
      </Typography.Text>

      <Space wrap style={{ display: 'flex', margin: '12px 0' }}>
        <Select
          style={{ width: 220 }}
          loading={accounts.isLoading}
          value={uid}
          placeholder="Chọn nick"
          onChange={(v) => {
            setUid(v);
            setPage(1);
          }}
          options={nicks.map((n) => ({ value: n.uid, label: nickName(n.label, n.ownerName) }))}
          aria-label="Nick"
        />
        <Input.Search
          allowClear
          style={{ width: 280 }}
          placeholder={tab === 'groups' ? 'Tên nhóm' : 'Tên, tên gợi nhớ, SĐT'}
          onSearch={(v) => {
            setQ(v.trim());
            setPage(1);
          }}
          aria-label="Tìm trong danh bạ"
        />
        {tab === 'friends' && (
        <>
        <Select
          style={{ width: 200 }}
          allowClear
          value={role}
          placeholder="Vai trò: Tất cả"
          onChange={(v) => {
            setRole(v);
            setPage(1);
          }}
          options={[
            ...CONTACT_ROLES.map((r) => ({ value: r, label: CONTACT_ROLE_LABELS[r] })),
            { value: 'none', label: 'Chưa phân loại' },
          ]}
          aria-label="Vai trò"
        />
        <Select
          style={{ width: 180 }}
          value={sort}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
          options={[
            { value: 'name', label: 'Tên (A-Z)' },
            { value: 'recent', label: 'Nhắn gần nhất' },
          ]}
          aria-label="Sắp xếp"
        />
        </>
        )}
      </Space>

      {tab === 'friends' && stats && stats.friendCount != null && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Zalo Web: {stats.friendCount} bạn bè · VClinks: {stats.stored}
          {stats.unmatched > 0 && ` · ${stats.unmatched} người chưa ghép được với tài khoản Zalo`}
          {stats.readAt && ` · đọc lúc ${fmt(stats.readAt)}`}
        </Typography.Paragraph>
      )}

      {(tab === 'groups' ? groups.isError : list.isError) && <Alert type="error" showIcon message="Không tải được danh bạ" style={{ marginBottom: 12 }} />}
      {!nicks.length && !accounts.isLoading ? (
        <Empty description="Chưa có nick Zalo cá nhân nào được kết nối." />
      ) : tab === 'groups' ? (
        <Table<ContactGroupItem>
          rowKey="threadId"
          size="middle"
          loading={groups.isFetching}
          columns={groupColumns}
          dataSource={groups.data?.items ?? []}
          locale={{ emptyText: q ? 'Không tìm thấy nhóm nào khớp.' : 'Nick này chưa có nhóm nào được đồng bộ.' }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: groups.data?.total ?? 0, showSizeChanger: false, onChange: setPage }}
          scroll={{ x: 640 }}
        />
      ) : (
        <Table<ContactListItem>
          rowKey="userId"
          size="middle"
          loading={list.isFetching}
          columns={columns}
          dataSource={list.data?.items ?? []}
          locale={{ emptyText: q ? 'Không tìm thấy ai khớp.' : 'Nick này chưa có bạn bè nào được đồng bộ.' }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: list.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          scroll={{ x: 760 }}
        />
      )}
    </div>
  );
}
