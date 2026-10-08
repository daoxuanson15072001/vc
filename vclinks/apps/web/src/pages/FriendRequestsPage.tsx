import { useMemo, useState } from 'react';
import { Alert, App, Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Tabs, Tag, Tooltip, Typography } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { OUTBOX_LIMITS, normalizeVnPhone, type FriendRequestItem } from '@vclinks/shared';
import { api } from '../api';
import ChatAvatar from '../components/chat/ChatAvatar';
import ContactsTabs from '../components/contacts/ContactsTabs';
import { commandLabel, useContactNick, useFriendRequests } from '../components/contacts/friend-requests';
import { fmtTime } from '../time';
import { nickName } from '../utils/nick';

/** What POST /outbox needs for one friend command. */
type FriendBody = { threadId: string; action: 'friend_accept' | 'friend_reject' | 'friend_request'; friend: Record<string, string> };

/**
 * Danh bạ → Lời mời kết bạn (03 MH-SZ-10, QT-SZ-12, SZ-09). The requests are
 * what the extension reads from Zalo Web; pressing Chấp nhận / Từ chối /
 * Gửi lời mời creates an approved outbox command (the press is the approval).
 */
export default function FriendRequestsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const { uid, setUid, nicks, accounts } = useContactNick();
  const received = useFriendRequests(uid, 'received');
  const sent = useFriendRequests(uid, 'sent');
  const [accepting, setAccepting] = useState<FriendRequestItem | null>(null);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const quota = received.data?.quota;
  const locked = !!quota && quota.remaining <= 0;

  const submit = async (body: FriendBody, done: string) => {
    if (!uid) return false;
    try {
      await api('/outbox', { method: 'POST', body: { uid, ...body } });
      message.success(done);
      void qc.invalidateQueries({ queryKey: ['friend-requests'] });
      void qc.invalidateQueries({ queryKey: ['outbox'] });
      return true;
    } catch (e) {
      message.error((e as Error).message);
      return false;
    }
  };

  const reject = async (r: FriendRequestItem) => {
    setBusy(r.userId);
    await submit(
      { threadId: r.userId, action: 'friend_reject', friend: { userId: r.userId, name: r.name } },
      `Đã duyệt từ chối lời mời của ${r.name}. Lệnh sẽ chạy trên Zalo trong ít giây.`,
    );
    setBusy(null);
  };

  const row = (r: FriendRequestItem, canAct: boolean) => {
    const cmd = commandLabel(r.commandStatus);
    return (
      <div key={r.userId} className="friend-request-row" style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(128,128,128,.2)' }}>
        <ChatAvatar size={44} name={r.name} src={r.avatar ?? undefined} colorKey={r.userId} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space size={6} wrap>
            <Typography.Text strong>{r.name}</Typography.Text>
            {r.status !== 'pending' && <Tag>{r.status === 'accepted' ? 'Đã chấp nhận' : r.status === 'rejected' ? 'Đã từ chối' : 'Không còn trên Zalo'}</Tag>}
            {cmd && <Tag color="processing">{cmd}</Tag>}
          </Space>
          <div>
            <Typography.Text type="secondary">{[r.dateText, r.source].filter(Boolean).join(' · ') || (canAct ? '' : 'Bạn đã gửi lời mời')}</Typography.Text>
          </div>
          {r.message && <div style={{ marginTop: 4 }}>“{r.message}”</div>}
        </div>
        {canAct && r.status === 'pending' && (
          <Space size={8} style={{ alignSelf: 'center' }}>
            <Popconfirm
              title={`Từ chối lời mời của ${r.name}?`}
              okText="Từ chối"
              cancelText="Không"
              okButtonProps={{ danger: true }}
              onConfirm={() => void reject(r)}
            >
              <Button disabled={!!r.commandStatus && r.commandStatus !== 'failed' && r.commandStatus !== 'expired'} loading={busy === r.userId}>
                Từ chối
              </Button>
            </Popconfirm>
            <Button type="primary" disabled={!!r.commandStatus && r.commandStatus !== 'failed' && r.commandStatus !== 'expired'} onClick={() => setAccepting(r)}>
              Chấp nhận…
            </Button>
          </Space>
        )}
      </div>
    );
  };

  const list = (q: typeof received, canAct: boolean, empty: string) =>
    q.isError ? (
      <Alert type="error" showIcon message="Không tải được danh sách lời mời" />
    ) : q.data?.items.length ? (
      <div>{q.data.items.map((r) => row(r, canAct))}</div>
    ) : (
      <Empty description={q.isLoading ? 'Đang tải…' : empty} />
    );

  const nickOptions = useMemo(() => nicks.map((n) => ({ value: n.uid, label: nickName(n.label, n.ownerName) })), [nicks]);

  return (
    <div style={{ maxWidth: 900 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Danh bạ
      </Typography.Title>
      <ContactsTabs active="requests" uid={uid} />
      <Space wrap style={{ display: 'flex', margin: '4px 0 12px', justifyContent: 'space-between' }}>
        <Select style={{ width: 220 }} loading={accounts.isLoading} value={uid} placeholder="Chọn nick" onChange={setUid} options={nickOptions} aria-label="Nick" />
        <Space>
          {quota && (
            <Typography.Text type="secondary">
              Hôm nay đã mời {quota.usedToday}/{quota.limit}
            </Typography.Text>
          )}
          <Tooltip title={locked ? `Hôm nay nick này đã gửi đủ ${quota?.limit} lời mời kết bạn. Mai gửi tiếp.` : undefined}>
            <Button icon={<UserAddOutlined />} disabled={!uid || locked} onClick={() => setInviting(true)}>
              Gửi lời mời kết bạn…
            </Button>
          </Tooltip>
        </Space>
      </Space>

      {received.data?.readAt && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Đọc từ Zalo Web lúc {fmtTime(received.data.readAt)}
        </Typography.Paragraph>
      )}
      {!nicks.length && !accounts.isLoading ? (
        <Empty description="Chưa có nick Zalo cá nhân nào được kết nối." />
      ) : (
        <Tabs
          items={[
            { key: 'received', label: `Đã nhận (${received.data?.pending ?? '…'})`, children: list(received, true, 'Không có lời mời nào đang chờ.') },
            { key: 'sent', label: `Đã gửi (${sent.data?.pending ?? '…'})`, children: list(sent, false, 'Chưa gửi lời mời nào đang chờ.') },
          ]}
        />
      )}

      <Modal
        open={!!accepting}
        title={accepting ? `Chấp nhận lời mời của ${accepting.name}` : ''}
        cancelText="Hủy"
        destroyOnHidden
        footer={null}
        onCancel={() => setAccepting(null)}
      >
        {accepting && (
          <Form
            layout="vertical"
            onFinish={async (v: { alias?: string; greeting?: string }) => {
              const friend: Record<string, string> = { userId: accepting.userId, name: accepting.name };
              if (v.alias?.trim()) friend.alias = v.alias.trim();
              if (v.greeting?.trim()) friend.greeting = v.greeting.trim();
              if (await submit({ threadId: accepting.userId, action: 'friend_accept', friend }, `Đã duyệt kết bạn với ${accepting.name}. Lệnh sẽ chạy trên Zalo trong ít giây.`)) setAccepting(null);
            }}
          >
            <Form.Item label="Tên gợi nhớ (không bắt buộc)" name="alias" extra="Tên bạn muốn thấy trong danh bạ, ví dụ “Anh Đạt - gara Minh Phát”.">
              <Input maxLength={OUTBOX_LIMITS.friendAlias} placeholder={accepting.name} />
            </Form.Item>
            <Form.Item
              label="Lời chào (không bắt buộc)"
              name="greeting"
              extra="Gửi cho người này ngay sau khi kết bạn. Bấm “Chấp nhận kết bạn” là bạn đã duyệt luôn lời chào này."
            >
              <Input.TextArea rows={3} maxLength={OUTBOX_LIMITS.friendGreeting} showCount placeholder="Xin chào, cảm ơn bạn đã kết bạn." />
            </Form.Item>
            <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setAccepting(null)}>Hủy</Button>
              <Button type="primary" htmlType="submit">
                Chấp nhận kết bạn
              </Button>
            </Space>
          </Form>
        )}
      </Modal>

      <Modal open={inviting} title="Gửi lời mời kết bạn" footer={null} destroyOnHidden onCancel={() => setInviting(false)}>
        <Form
          layout="vertical"
          onFinish={async (v: { phone: string; greeting?: string }) => {
            const phone = normalizeVnPhone(v.phone);
            if (!phone) return message.error('Số điện thoại chưa đúng (ví dụ 0912 345 678)');
            const friend: Record<string, string> = { phone };
            if (v.greeting?.trim()) friend.greeting = v.greeting.trim();
            if (await submit({ threadId: phone, action: 'friend_request', friend }, 'Đã duyệt lời mời. Zalo gửi theo nhịp 30 giây một lời mời.')) setInviting(false);
          }}
        >
          <Form.Item label="Số điện thoại" name="phone" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
            <Input inputMode="tel" maxLength={20} placeholder="0912 345 678" autoFocus />
          </Form.Item>
          <Form.Item label="Lời chào (không bắt buộc)" name="greeting">
            <Input.TextArea rows={3} maxLength={OUTBOX_LIMITS.friendGreeting} showCount placeholder="Xin chào, mình là …" />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            Bấm “Gửi” là bạn đã duyệt lời mời này. Mỗi nick gửi tối đa {OUTBOX_LIMITS.friendPerDay} lời mời mỗi ngày, cách nhau {OUTBOX_LIMITS.friendGapMs / 1000} giây.
          </Typography.Paragraph>
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setInviting(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit">
              Gửi
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
