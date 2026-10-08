import { Alert, Button, Descriptions, Empty, List, Modal, Skeleton, Tag, Typography } from 'antd';
import { MaskedPhone, type PhoneFields } from '../contacts/MaskedContact';
import { MessageOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { CHANNEL_INFO } from '@vclinks/shared';
import { isNotFound, useContactProfile } from './hooks';
import ChatAvatar from './ChatAvatar';
import { fullTime } from '../../utils/time';

/** Contact roles (CLAUDE.md §5) as shown to the user. */
const ROLE_LABEL: Record<string, string> = {
  khach_hang: 'Khách hàng',
  dai_ly_gara: 'Đại lý / Gara',
  nha_cung_cap: 'Nhà cung cấp',
  nhan_vien: 'Nhân viên',
  quan_ly: 'Quản lý',
  doi_tac: 'Đối tác',
  ngan_hang: 'Ngân hàng',
  co_quan_nha_nuoc: 'Cơ quan nhà nước',
  gia_dinh_ban_be: 'Gia đình / Bạn bè',
  oa_doanh_nghiep: 'OA doanh nghiệp',
  khac: 'Khác',
};

const ROLE_SOURCE: Record<string, string> = {
  rule: 'theo quy tắc',
  llm: 'AI phân loại',
  manual: 'sửa tay',
};

interface Props {
  uid: string;
  /** The sender's id on the channel (Zalo userId); null closes the modal. */
  userId: string | null;
  /** Thread the modal was opened from, for the in-thread message count. */
  threadId: string;
  /** Name shown in the chat, used while loading and when the profile has none. */
  fallbackName?: string | null;
  onClose: () => void;
}

/** Details of a message sender: identity, organisation match, activity and common groups. */
export default function SenderModal({ uid, userId, threadId, fallbackName, onClose }: Props) {
  const navigate = useNavigate();
  const q = useContactProfile(uid, userId, threadId);
  const p = q.data;
  const name = p?.displayName || fallbackName || userId || '';

  const open = (conversationId: string) => {
    onClose();
    navigate(`/conversations/${encodeURIComponent(conversationId)}`);
  };

  let body;
  if (q.isLoading) {
    body = <Skeleton active avatar paragraph={{ rows: 4 }} />;
  } else if (q.error) {
    body = isNotFound(q.error) ? (
      <Empty description="VClinks chưa có dữ liệu về người này" />
    ) : (
      <Alert type="error" showIcon message="Không tải được thông tin" description={(q.error as Error).message} />
    );
  } else if (p) {
    const dash = <Typography.Text type="secondary">Chưa có</Typography.Text>;
    body = (
      <>
        <div className="sender-card">
          <ChatAvatar name={name} src={p.avatar} colorKey={p.userId} size={64} />
          <div className="sender-card__info">
            <div className="sender-card__name">{name}</div>
            {p.zaloName && p.zaloName !== name && <div className="sender-card__sub">Tên Zalo: {p.zaloName}</div>}
            <div className="sender-card__tags">
              <Tag>{CHANNEL_INFO[p.channel].label}</Tag>
              {p.isFriend === true && <Tag color="blue">Bạn bè</Tag>}
              {p.isFriend === false && <Tag>Chưa kết bạn</Tag>}
              {p.isOA && <Tag color="purple">Official Account</Tag>}
              {p.role && <Tag color="green">{ROLE_LABEL[p.role] ?? p.role}</Tag>}
              {p.division && <Tag color="gold">{p.division}</Tag>}
              {p.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </div>
        </div>

        {p.encrypted && (
          <Alert
            type="info"
            showIcon
            style={{ margin: '12px 0' }}
            message="Zalo Web mã hóa hồ sơ danh bạ trên máy, nên tên và số điện thoại chỉ có khi đã hiện trên giao diện Zalo."
          />
        )}

        <Descriptions column={1} size="small" style={{ marginTop: 12 }} labelStyle={{ width: 150 }}>
          <Descriptions.Item label="Mã người dùng">
            <Typography.Text copyable>{p.userId}</Typography.Text>
          </Descriptions.Item>
          {p.username && <Descriptions.Item label="Username">{p.username}</Descriptions.Item>}
          <Descriptions.Item label="Số điện thoại">
            <MaskedPhone contact={p as typeof p & PhoneFields} uid={p.uid} userId={p.userId} where="SenderModal" />
          </Descriptions.Item>
          <Descriptions.Item label="Vai trò">
            {p.role ? (
              <>
                {ROLE_LABEL[p.role] ?? p.role}
                {p.roleSource && (
                  <Typography.Text type="secondary"> ({ROLE_SOURCE[p.roleSource] ?? p.roleSource})</Typography.Text>
                )}
              </>
            ) : (
              dash
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Email tổ chức">
            {p.orgEmail ? <Typography.Text copyable>{p.orgEmail}</Typography.Text> : dash}
            {p.orgDepartment && <Typography.Text type="secondary"> · {p.orgDepartment}</Typography.Text>}
          </Descriptions.Item>
          {p.notes && <Descriptions.Item label="Ghi chú">{p.notes}</Descriptions.Item>}
          <Descriptions.Item label="Tin đã gửi">
            {p.stats.messages.toLocaleString('vi-VN')} tin
            {p.stats.inThread !== null && ` (${p.stats.inThread.toLocaleString('vi-VN')} trong hội thoại này)`}
          </Descriptions.Item>
          {p.stats.lastAt && <Descriptions.Item label="Tin gần nhất">{fullTime(p.stats.lastAt)}</Descriptions.Item>}
          {p.stats.firstAt && <Descriptions.Item label="Tin đầu tiên đã lưu">{fullTime(p.stats.firstAt)}</Descriptions.Item>}
          {p.lastActionTime && <Descriptions.Item label="Hoạt động gần nhất">{fullTime(p.lastActionTime)}</Descriptions.Item>}
        </Descriptions>

        {p.commonGroups.length > 0 && (
          <>
            <div className="sender-card__section">
              <TeamOutlined /> Nhóm chung ({p.commonGroups.length})
            </div>
            <List
              size="small"
              dataSource={p.commonGroups}
              renderItem={(g) => (
                <List.Item
                  className={g.id === `${uid}:${threadId}` ? 'sender-card__group current' : 'sender-card__group'}
                  onClick={() => g.id !== `${uid}:${threadId}` && open(g.id)}
                >
                  {g.name || g.id.slice(g.id.indexOf(':') + 1)}
                  {g.id === `${uid}:${threadId}` && <Typography.Text type="secondary"> · đang xem</Typography.Text>}
                </List.Item>
              )}
              style={{ maxHeight: 200, overflow: 'auto' }}
            />
          </>
        )}
      </>
    );
  }

  const direct = p?.directConversationId;
  return (
    <Modal
      open={!!userId}
      onCancel={onClose}
      title="Thông tin người gửi"
      width={480}
      destroyOnClose
      footer={
        direct && direct !== `${uid}:${threadId}` ? (
          <Button type="primary" icon={<MessageOutlined />} onClick={() => open(direct)}>
            Nhắn riêng
          </Button>
        ) : null
      }
    >
      {body}
    </Modal>
  );
}
