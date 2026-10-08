import { useEffect, useState } from 'react';
import { Badge, Button, Drawer, Input, Tooltip } from 'antd';
import { BellOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { searchHint } from '../../utils/nav';
import { usePermissions } from '../../state/permissions';
import ChatAvatar from '../chat/ChatAvatar';
import GlobalSearch from './GlobalSearch';
import NotificationList from './NotificationList';
import StatusMenu from './StatusMenu';
import { useMeProfile, useNotifications } from './shellApi';

/** Header of the app shell (MH-UI-01 #7-#10): search box (Ctrl+K), bell, my status, avatar → /me. */
export default function AppHeader() {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const profile = useMeProfile();
  const notes = useNotifications();
  const perms = usePermissions();
  const canSearch = perms.has('search.global');
  const hint = searchHint(typeof navigator === 'undefined' ? '' : navigator.platform);

  useEffect(() => {
    if (!canSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSearch]);

  const name = profile.data?.name ?? '';
  return (
    <header className="app-header">
      {canSearch ? (
        <Input
          readOnly
          className="app-header__search"
          prefix={<SearchOutlined />}
          suffix={<span className="app-header__hint">{hint}</span>}
          placeholder="Tìm khách, SĐT, mã KH…"
          aria-label="Tìm kiếm toàn cục"
          onClick={() => setSearching(true)}
          onFocus={() => setSearching(true)}
        />
      ) : (
        <span />
      )}
      <div className="app-header__right">
        <Tooltip title="Thông báo">
          <Badge count={notes.data?.unread ?? 0} size="small" overflowCount={99}>
            <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="Thông báo" onClick={() => setNotifying(true)} />
          </Badge>
        </Tooltip>
        <StatusMenu />
        <Tooltip title="Hồ sơ của tôi">
          <button type="button" className="app-header__avatar" aria-label="Hồ sơ của tôi" onClick={() => navigate('/me')}>
            <ChatAvatar size={28} name={name || '?'} colorKey={profile.data?.userId ?? 'me'} />
          </button>
        </Tooltip>
      </div>
      <GlobalSearch open={searching} onClose={() => setSearching(false)} />
      <Drawer title="Thông báo" open={notifying} onClose={() => setNotifying(false)} width={380}>
        <NotificationList onNavigate={() => setNotifying(false)} />
      </Drawer>
    </header>
  );
}
