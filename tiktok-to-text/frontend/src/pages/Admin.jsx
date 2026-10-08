// SCR-21 Người dùng & lĩnh vực — /admin (TPL-F): tab Người dùng · Lĩnh vực · Duyệt lên URL (?tab=), h1 = tên mục menu.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { useUrlState } from '../urlState'
import { PageHeader } from '../components/PageHeader'
import { Tabs } from '../components/Tabs'
import { Icon } from '../components/icons'
import { CategoryEditor } from '../components/categoryEditor'
import { ReviewSettings } from './review/ReviewSettings'
import { UsersTab } from './admin/UsersTab'

const TABS = ['users', 'cats', 'review']

export default function Admin() {
  const [st, set] = useUrlState({ tab: { default: 'users', values: TABS } })
  const { data: users, error, loading, reload } = useFetch(() => api.users(), [])
  const [creating, setCreating] = useState(false)

  return (
    <div className="page">
      <PageHeader
        title="Người dùng & lĩnh vực"
        description={<>Tài khoản đăng nhập và cây lĩnh vực chuyên môn dùng chung toàn công ty. Đơn vị, người quản lý, vai trò chức năng, nhập nhân sự từ Excel và nghỉ việc: xem <Link to="/org">Cơ cấu tổ chức</Link>.</>}
        actions={st.tab === 'users' && (
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setCreating(true)} aria-haspopup="dialog" data-testid="admin-create-open">
            <Icon name="plus" size={16} />Tạo tài khoản
          </button>
        )}
      />
      <Tabs kind="panel" label="Khu quản trị" value={st.tab} onChange={(tab) => set({ tab }, { push: true })} testId="admin-tabs" items={[
        { id: 'users', label: 'Người dùng', count: users?.length, testId: 'admin-tab-users',
          content: <UsersTab users={users} error={error} loading={loading} reload={reload} creating={creating} setCreating={setCreating} /> },
        { id: 'cats', label: 'Lĩnh vực', testId: 'admin-tab-cats', content: <CategoryEditor /> },
        { id: 'review', label: 'Duyệt', testId: 'admin-tab-review', content: <ReviewSettings /> },
      ]} />
    </div>
  )
}
