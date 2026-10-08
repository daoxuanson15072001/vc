import { Segmented, Skeleton, Tabs } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PermissionKey, ScopeCode } from '@vclinks/shared';
import NoAccess from '../../components/access/NoAccess';
import { usePermissions } from '../../state/permissions';
import { rolesWithKey } from '../../utils/permissions';
import AccessRequestsTab from './AccessRequestsTab';
import AlertsTab from './AlertsTab';
import AuditTab from './AuditTab';
import ChannelAccessTab from './ChannelAccessTab';
import OrgTreeTab from './OrgTreeTab';
import RequestsTab from './RequestsTab';
import RolesTab from './RolesTab';
import TokensTab from './TokensTab';
import UsersTab from './UsersTab';
import AdminTodoTab, { useAdminTodo } from './AdminTodoTab';
import SlaSettingsTab from './SlaSettingsTab';
import VcsalesTab from './VcsalesTab';
import { usePageTitle } from '../../components/layout/PageTitle';

interface AdminPageDef {
  key: string;
  label: string;
  /** Any of these keys opens the page (docs 01 §8 menu table). */
  perms: PermissionKey[];
  /** Only scopes wider than "mine" count (the access log of an NVKD is "của tôi", not this page). */
  scopes?: ScopeCode[];
  node: JSX.Element;
}

export const ADMIN_PAGES: AdminPageDef[] = [
  { key: 'org', label: 'Cây tổ chức', perms: ['org.view'], node: <OrgTreeTab /> },
  { key: 'users', label: 'Người dùng', perms: ['user.view'], node: <UsersTab /> },
  { key: 'roles', label: 'Vai trò & quyền', perms: ['role.view'], node: <RolesTab /> },
  // MH-PQ-07 (M1b-10). People with only grant.request / leave_request reach it from "Yêu cầu quyền của tôi" (01 §5 menu, v1.3).
  { key: 'access-requests', label: 'Quyền tạm thời', perms: ['grant.approve', 'grant.cover', 'grant.revoke', 'grant.request', 'grant.leave_request'], node: <AccessRequestsTab /> },
  { key: 'channel-access', label: 'Gán kênh', perms: ['channel.access'], node: <ChannelAccessTab /> },
  { key: 'tokens', label: 'Token & thiết bị', perms: ['token.manage'], node: <TokensTab /> },
  { key: 'requests', label: 'Thay đổi vai trò chờ duyệt', perms: ['role.approve', 'user.edit'], node: <RequestsTab /> },
  {
    key: 'audit',
    label: 'Nhật ký truy cập',
    perms: ['audit.view'],
    scopes: ['TD', 'DV', 'TO', 'ALL'],
    node: <AuditTab />,
  },
  {
    key: 'alerts',
    label: 'Cảnh báo',
    perms: ['alert.handle', 'alert.config'],
    node: <AlertsTab />,
  },
  { key: 'sla', label: 'SLA và giờ làm việc', perms: ['config.sla'], node: <SlaSettingsTab /> },
  // Plan C5, C6: connection to VCsales and salesperson matching (same rule as GET /api/admin/vcsales).
  { key: 'vcsales', label: 'Kết nối VCsales', perms: ['user.view', 'cust.import'], scopes: ['DV', 'TD', 'ALL'], node: <VcsalesTab /> },
];

/**
 * Tabs grouped by job (design "Việc quản trị"): the group is the first level, its pages a second level.
 * Page URLs stay /admin/<page> so existing links (e.g. /admin/access-requests?tab=cover) keep working.
 */
const GROUPS: { key: string; label: string; pages: string[] }[] = [
  { key: 'todo', label: 'Việc cần làm', pages: ['todo'] },
  { key: 'people', label: 'Tổ chức và người dùng', pages: ['org', 'users', 'requests'] },
  { key: 'rights', label: 'Vai trò và quyền', pages: ['roles', 'access-requests'] },
  { key: 'channels', label: 'Kênh và thiết bị', pages: ['channel-access', 'tokens'] },
  { key: 'logs', label: 'Nhật ký và cảnh báo', pages: ['audit', 'alerts'] },
  { key: 'settings', label: 'Cài đặt', pages: ['sla', 'vcsales'] },
];
const SHORT_LABELS: Record<string, string> = { requests: 'Vai trò chờ duyệt' };

/** Quản trị: /admin/todo, /admin/org, /admin/users, /admin/roles, /admin/requests, /admin/audit, /admin/alerts… */
export default function AdminPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const perms = usePermissions();
  const allowed = (p: AdminPageDef) =>
    perms.failed || perms.me?.legacy || p.perms.some((k) => perms.me?.permissions[k]?.scopes.some((s) => !p.scopes || p.scopes.includes(s)));
  const canOpen = (key: string) => {
    const p = ADMIN_PAGES.find((x) => x.key === key);
    return !!p && !!allowed(p);
  };
  const todo = useAdminTodo(canOpen);
  const open = ADMIN_PAGES.filter(allowed);
  // "Việc cần làm" exists for whoever may open at least one admin page.
  const todoPage: AdminPageDef = { key: 'todo', label: 'Việc cần làm', perms: [...new Set(ADMIN_PAGES.flatMap((p) => p.perms))], node: <AdminTodoTab todo={todo} /> };
  const pages = open.length ? [todoPage, ...ADMIN_PAGES] : ADMIN_PAGES;
  const requested = pages.find((p) => pathname.startsWith(`/admin/${p.key}`));
  const active = requested ?? (open.length ? todoPage : ADMIN_PAGES[0]);
  const isAllowed = (p: AdminPageDef) => p.key === 'todo' || allowed(p);
  const groups = GROUPS.map((g) => ({ ...g, open: pages.filter((p) => g.pages.includes(p.key) && isAllowed(p)) })).filter((g) => g.open.length);
  const group = groups.find((g) => g.pages.includes(active.key));
  usePageTitle(`${active.label} · Quản trị`);

  let body: JSX.Element;
  if (perms.loading) body = <Skeleton active />;
  else if (!isAllowed(active)) {
    // MH-PQ-11 form A: the route stays, the menu and header stay, the content explains.
    body = (
      <NoAccess
        kind="page"
        pageName={active.label}
        roles={[...new Set(active.perms.flatMap((k) => rolesWithKey(k, active.scopes)))]}
      />
    );
  } else {
    body = (
      <>
        {group && group.open.length > 1 && (
          <Segmented
            className="admin-subnav"
            value={active.key}
            onChange={(k) => navigate(`/admin/${k}`)}
            options={group.open.map((p) => ({ value: p.key, label: SHORT_LABELS[p.key] ?? p.label }))}
          />
        )}
        <div key={active.key}>{active.node}</div>
      </>
    );
  }
  return (
    <div className="admin-page">
      <h1 className="page-title">Quản trị</h1>
      <Tabs
        className="admin-tabs"
        activeKey={group?.key ?? ''}
        onChange={(k) => {
          const g = groups.find((x) => x.key === k);
          if (g) navigate(`/admin/${g.open[0].key}`);
        }}
        items={groups.map((g) => ({
          key: g.key,
          label:
            g.key === 'todo' && todo.total > 0 ? (
              <span>
                {g.label} <span className="tab-count">{todo.total}</span>
              </span>
            ) : (
              g.label
            ),
        }))}
      />
      {body}
    </div>
  );
}
