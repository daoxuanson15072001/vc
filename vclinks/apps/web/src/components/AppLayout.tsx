import { Fragment, type ReactNode } from 'react';
import { Badge, Dropdown, Tooltip, type MenuProps } from 'antd';
import { ApiOutlined, CheckOutlined, LogoutOutlined, MessageOutlined, MoonOutlined, SunOutlined, SyncOutlined, TeamOutlined } from '@ant-design/icons';
import { CloudSyncOutlined, ContactsOutlined, LinkOutlined, ScheduleOutlined, UserAddOutlined } from '@ant-design/icons';
import { AuditOutlined, HourglassOutlined, LineChartOutlined, SettingOutlined, SolutionOutlined } from '@ant-design/icons';
import { useWorkitemCounts } from './workitems/workitemApi';
import OutboxAlerts from './outbox/OutboxAlerts';
import RealtimeBridge from './layout/RealtimeBridge';
import RouteTitle from './layout/PageTitle';
import { useOutboxCounts } from './outbox/queue';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { logout as signOut } from '../api';
import { usePrefs } from '../state/prefs';
import { useAccounts } from './AccountSelect';
import ChannelBadge from './ChannelBadge';
import ChatAvatar from './chat/ChatAvatar';
import { HealthDot, HealthNavButton, useAccountHealth } from './AccountHealth';
import { nickName } from '../utils/nick';
import { usePermissions } from '../state/permissions';
import { waitingForRole } from '../utils/permissions';
import WaitingRoleView from './layout/WaitingRoleView';
import { NAV_GROUPS, navIdOf, visibleNavItems, type NavId } from '../utils/nav';
import AppHeader from './layout/AppHeader';
import { OfflineBanner, PageErrorBoundary } from './layout/ErrorViews';

const ALL = '__all__';

const NAV_ICONS: Record<NavId, ReactNode> = {
  conversations: <MessageOutlined />,
  outbox: <HourglassOutlined />,
  approvals: <AuditOutlined />,
  workitems: <SolutionOutlined />,
  reports: <LineChartOutlined />,
  customers: <ContactsOutlined />,
  erpMatching: <LinkOutlined />,
  erpTasks: <ScheduleOutlined />,
  erpCatalog: <CloudSyncOutlined />,
  contacts: <UserAddOutlined />,
  channels: <ApiOutlined />,
  sync: <SyncOutlined />,
  admin: <SettingOutlined />,
};

/** App shell: labelled nav rail on the left (icon + short name), page content on the right. */
export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { mode, toggleMode, accountUid, setAccountUid } = usePrefs();
  const accounts = useAccounts();
  const perms = usePermissions();
  const navItems = visibleNavItems(perms.me, perms.failed);
  const activeId = navIdOf(location.pathname);
  // Pages without a menu item (/me, /notifications, 404) are padded like the other non-chat pages.
  // First login without a role (PQ-10): a waiting page instead of empty screens; personal pages stay open.
  const waiting = waitingForRole(perms.me) && !/^\/(me|settings|notifications)(\/|$)/.test(location.pathname);
  const onChat = !waiting && (activeId === 'conversations' || location.pathname === '/');
  const outboxCounts = useOutboxCounts();
  const attention = outboxCounts.data?.attention ?? 0;
  const wiCounts = useWorkitemCounts(navItems.some((i) => i.id === 'approvals' || i.id === 'workitems'));

  const current = accounts.data?.find((a) => a.uid === accountUid);
  const currentLabel = current ? nickName(current.label, current.ownerName) : 'Tất cả tài khoản';
  const currentHealth = useAccountHealth(accountUid);

  const accountMenu: MenuProps['items'] = [
    { key: ALL, label: 'Tất cả tài khoản', icon: <TeamOutlined />, extra: !accountUid ? <CheckOutlined /> : null },
    { type: 'divider' },
    ...(accounts.data ?? []).map((a) => ({
      key: a.uid,
      label: (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {nickName(a.label, a.ownerName)}
          <ChannelBadge channel={a.channel} />
        </span>
      ),
      icon: <ChatAvatar size={20} name={nickName(a.label, a.ownerName)} colorKey={a.uid} />,
      extra: a.uid === accountUid ? <CheckOutlined /> : null,
    })),
  ];

  const logout = () => {
    void signOut().finally(() => {
      qc.clear();
      navigate('/login', { replace: true });
    });
  };

  return (
    <div className="app-shell">
      <nav className="nav-rail" aria-label="Điều hướng chính">
        <Dropdown
          trigger={['click']}
          placement="bottomLeft"
          menu={{
            items: accountMenu,
            selectable: false,
            onClick: ({ key }) => {
              setAccountUid(key === ALL ? undefined : key);
              if (location.pathname.startsWith('/conversations/')) navigate('/conversations');
            },
          }}
        >
          <Tooltip title={`Tài khoản: ${currentLabel}`} placement="right">
            <button type="button" className="nav-rail__item nav-rail__account" aria-label="Chọn tài khoản">
              {currentHealth && <span className="nav-rail__dot"><HealthDot level={currentHealth.level} size={12} /></span>}
              <ChatAvatar size={40} name={current ? nickName(current.label, current.ownerName) : 'Tất cả'} colorKey={current?.uid ?? ALL} group={!current} />
            </button>
          </Tooltip>
        </Dropdown>

        <HealthNavButton accounts={accounts.data} />

        {NAV_GROUPS.map((g) => {
          const items = navItems.filter((i) => i.group === g.id);
          if (!items.length) return null;
          return (
            <Fragment key={g.id}>
              {g.id !== 'work' && <div className="nav-rail__sep" role="separator" aria-label={g.label} />}
              {items.map((item) => {
                const active = activeId === item.id;
                const outbox = item.id === 'outbox';
                const badge = outbox ? attention : item.id === 'approvals' ? (wiCounts.data?.approvals ?? 0) : item.id === 'workitems' ? (wiCounts.data ? wiCounts.data.queue.ban_hang + wiCounts.data.queue.hau_mai : 0) : 0;
                const title = outbox && attention ? `${item.label} · ${attention} lệnh cần xử lý` : badge ? `${item.label} · ${badge}` : item.label;
                return (
                  <Tooltip key={item.id} title={title} placement="right" mouseEnterDelay={0.6}>
                    <button
                      type="button"
                      className={`nav-rail__item${active ? ' active' : ''}`}
                      onClick={() => navigate(item.path)}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                    >
                      {/* Red badge on "Lệnh gửi" = my failed + expired + awaiting-confirm commands (03 MH-SZ-13, SZ-24 (4)). */}
                      <span className="nav-rail__icon">
                        {outbox || badge ? (
                          <Badge
                            count={badge}
                            size="small"
                            overflowCount={99}
                            offset={[6, -2]}
                            // Red (antd default) when urgent; a white pill otherwise, readable on the blue rail.
                            className={outbox || (item.id === 'approvals' && wiCounts.data?.approvalsOverdue) ? undefined : 'rail-badge--soft'}
                          >
                            <span style={{ color: 'inherit', fontSize: 20 }}>{NAV_ICONS[item.id]}</span>
                          </Badge>
                        ) : (
                          NAV_ICONS[item.id]
                        )}
                      </span>
                      <span className="nav-rail__label">{item.short}</span>
                    </button>
                  </Tooltip>
                );
              })}
            </Fragment>
          );
        })}

        <div className="nav-rail__spacer" />

        <button type="button" className="nav-rail__item nav-rail__item--small" onClick={toggleMode} aria-label="Đổi giao diện sáng/tối">
          <span className="nav-rail__icon">{mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}</span>
          <span className="nav-rail__label">{mode === 'dark' ? 'Sáng' : 'Tối'}</span>
        </button>
        <button type="button" className="nav-rail__item nav-rail__item--small" onClick={logout} aria-label="Đăng xuất">
          <span className="nav-rail__icon"><LogoutOutlined /></span>
          <span className="nav-rail__label">Thoát</span>
        </button>
      </nav>

      <OutboxAlerts />
      <RealtimeBridge />
      <RouteTitle />
      <div className="app-main">
        <OfflineBanner />
        <AppHeader />
        <main className={`app-content${onChat ? '' : ' app-content--padded'}`}>
          <PageErrorBoundary resetKey={location.pathname}>{waiting ? <WaitingRoleView onLogout={logout} /> : <Outlet />}</PageErrorBoundary>
        </main>
      </div>
    </div>
  );
}
