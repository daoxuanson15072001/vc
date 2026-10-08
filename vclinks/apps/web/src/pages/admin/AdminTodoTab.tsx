import { Button, Empty, Skeleton } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { AccessGrantList, InboxSummary } from '@vclinks/shared';
import { api } from '../../api';
import { useHealth } from '../../components/AccountHealth';
import { adminApi } from './adminApi';
import { auditApi } from './auditApi';
import { tokensApi } from './tokensApi';

/*
 * "Việc cần làm" of Quản trị (design "Việc quản trị"): one line per kind of pending work, with its count and
 * the page that resolves it. Each source is read only when the user may open its page; a failed source is
 * left out rather than shown as zero.
 */

export interface AdminTodoItem {
  key: string;
  count: number;
  title: string;
  detail: string;
  to: string;
  action: string;
  tone: 'danger' | 'warn' | 'normal';
}

const STALE_MS = 30_000;

/** Pending admin work; `allowed(pageKey)` says which admin pages the user may open. */
export function useAdminTodo(allowed: (pageKey: string) => boolean) {
  const channels = useQuery({ queryKey: ['admin', 'channels', ''], queryFn: () => tokensApi.channels({}), enabled: allowed('channel-access'), retry: false, staleTime: STALE_MS });
  const roleRequests = useQuery({ queryKey: ['admin', 'role-requests'], queryFn: adminApi.requests, enabled: allowed('requests'), retry: false, staleTime: STALE_MS });
  const grants = useQuery({ queryKey: ['access-grants', ''], queryFn: () => api<AccessGrantList>('/access-grants'), enabled: allowed('access-requests'), retry: false, staleTime: STALE_MS });
  const alerts = useQuery({ queryKey: ['admin', 'alerts', 'moi'], queryFn: () => auditApi.alerts({ status: 'moi' }), enabled: allowed('alerts'), retry: false, staleTime: STALE_MS });
  const noRole = useQuery({ queryKey: ['admin', 'users', 'no-role'], queryFn: () => adminApi.users({ role: 'none', pageSize: 1 }), enabled: allowed('users'), retry: false, staleTime: STALE_MS });
  const inbox = useQuery({ queryKey: ['inbox-summary'], queryFn: () => api<InboxSummary>('/conversations/inbox'), retry: false, staleTime: STALE_MS });
  const health = useHealth();

  const items: AdminTodoItem[] = [];
  const rows = channels.data?.items ?? [];
  const noHolder = rows.filter((r) => !r.holderUserId).length;
  const unsafe = rows.filter((r) => r.unsafe).length;
  const lost = (health.data ?? []).filter((h) => h.level === 'red').length;
  if (noHolder) items.push({ key: 'no-holder', count: noHolder, title: 'Nick chưa có người giữ', detail: 'Nick vẫn nhận tin nhưng chưa ai chịu trách nhiệm trả lời.', to: '/admin/channel-access', action: 'Gán người giữ', tone: 'danger' });
  if (unsafe) items.push({ key: 'unsafe', count: unsafe, title: 'Nick chưa an toàn sau bàn giao', detail: 'Nick bị khóa gửi tới khi xác nhận đã đăng xuất Zalo ở máy cũ.', to: '/admin/channel-access', action: 'Xác nhận', tone: 'danger' });
  if (lost) items.push({ key: 'lost', count: lost, title: 'Nick mất kết nối', detail: 'Tin mới của các nick này chưa về VClinks.', to: '/sync', action: 'Xem đồng bộ', tone: 'danger' });
  if (channels.data?.pendingCount) items.push({ key: 'pending-nicks', count: channels.data.pendingCount, title: 'Nick mới chờ xác nhận', detail: 'Thiết bị đã gửi dữ liệu của nick; cần chọn division và người giữ.', to: '/admin/channel-access', action: 'Xác nhận nick', tone: 'warn' });
  const unassigned = inbox.data?.scopes.includes('unassigned') ? inbox.data.counts.unassigned : 0;
  if (unassigned) items.push({ key: 'unassigned', count: unassigned, title: 'Hội thoại chưa phân công', detail: 'Tin đến chưa có người phụ trách, đang chờ chia việc.', to: '/conversations', action: 'Mở hộp thư', tone: 'warn' });
  if (noRole.data?.total) items.push({ key: 'no-role', count: noRole.data.total, title: 'Người mới chờ gán vai trò', detail: 'Đã đăng nhập bằng mail công ty nhưng chưa có vai trò nên chưa thấy dữ liệu nào.', to: '/admin/users?role=none', action: 'Gán vai trò', tone: 'warn' });
  if (roleRequests.data?.length) items.push({ key: 'role-requests', count: roleRequests.data.length, title: 'Thay đổi vai trò chờ duyệt', detail: 'Vai trò nhạy cảm cần người thứ hai duyệt, không tự cấp cho nhau.', to: '/admin/requests', action: 'Duyệt', tone: 'normal' });
  if (grants.data?.pendingCount) items.push({ key: 'grants', count: grants.data.pendingCount, title: 'Yêu cầu quyền tạm thời chờ duyệt', detail: 'Trực thay, xem ngoài phạm vi và các quyền có thời hạn.', to: '/admin/access-requests', action: 'Xem yêu cầu', tone: 'normal' });
  if (alerts.data?.newCount) items.push({ key: 'alerts', count: alerts.data.newCount, title: 'Cảnh báo chưa xem', detail: 'Truy cập bất thường hoặc vi phạm quy tắc cần người xử lý.', to: '/admin/alerts', action: 'Xem cảnh báo', tone: 'normal' });

  const loading = [channels, roleRequests, grants, alerts, noRole].some((q) => q.isLoading && q.fetchStatus !== 'idle');
  return { items, total: items.reduce((n, i) => n + i.count, 0), loading, health: health.data };
}

export default function AdminTodoTab({ todo }: { todo: ReturnType<typeof useAdminTodo> }) {
  const navigate = useNavigate();
  const nicks = todo.health ?? [];
  const okNicks = nicks.filter((h) => h.level === 'green').length;
  return (
    <div className="admin-todo">
      <section className="surface admin-todo__list" aria-label="Việc cần làm">
        {todo.loading && !todo.items.length ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : todo.items.length ? (
          todo.items.map((i) => (
            <div key={i.key} className="todo-row">
              <span className={`todo-row__num todo-row__num--${i.tone}`}>{i.count}</span>
              <div className="todo-row__body">
                <div className="todo-row__title">{i.title}</div>
                <div className="todo-row__detail">{i.detail}</div>
              </div>
              <Button type={i.tone === 'danger' ? 'primary' : 'default'} onClick={() => navigate(i.to)}>
                {i.action}
              </Button>
            </div>
          ))
        ) : (
          <Empty image={<CheckCircleFilled style={{ fontSize: 40, color: 'var(--ok)' }} />} description="Không còn việc quản trị nào đang chờ." />
        )}
      </section>
      <section className="surface admin-todo__status" aria-labelledby="admin-status">
        <h2 id="admin-status" className="surface__title">
          Tình trạng hệ thống
        </h2>
        <div className="status-row">
          <span className={`status-row__dot status-row__dot--${nicks.length && okNicks === nicks.length ? 'ok' : nicks.length ? 'warn' : 'none'}`} />
          <span>Đồng bộ nick</span>
          <span className="status-row__value">{nicks.length ? `${okNicks} / ${nicks.length} ổn` : 'Chưa có nick'}</span>
        </div>
      </section>
    </div>
  );
}
