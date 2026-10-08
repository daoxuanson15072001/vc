import { Badge, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useFriendRequests } from './friend-requests';

export type ContactsTab = 'friends' | 'groups' | 'requests';

const PATH: Record<ContactsTab, string> = {
  friends: '/contacts',
  groups: '/contacts?tab=groups',
  requests: '/contacts/requests',
};

/** Tabs of Danh bạ (03 MH-SZ-09 / MH-SZ-10): Bạn bè, Nhóm, Lời mời kết bạn (badge = requests waiting). */
export default function ContactsTabs({ active, uid }: { active: ContactsTab; uid?: string }) {
  const navigate = useNavigate();
  const received = useFriendRequests(uid, 'received');
  const pending = received.data?.pending ?? 0;
  return (
    <Tabs
      activeKey={active}
      onChange={(k) => navigate(PATH[k as ContactsTab])}
      items={[
        { key: 'friends', label: 'Bạn bè' },
        { key: 'groups', label: 'Nhóm' },
        {
          key: 'requests',
          label: (
            <span>
              Lời mời kết bạn
              {pending > 0 && <Badge count={pending} size="small" overflowCount={99} offset={[6, -2]} />}
            </span>
          ),
        },
      ]}
    />
  );
}
