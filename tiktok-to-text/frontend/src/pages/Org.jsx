// Cơ cấu tổ chức (DESIGN V.7 SCR-18 · TPL-F; BA ORG-01…08, 14)
// Tab ?tab= Sơ đồ · Của tôi · Chức năng · Cấp bậc · Vai trò chức năng · Nhập dữ liệu (4 tab cuối chỉ quản trị viên;
// người không phải quản trị viên mở mặc định ở Của tôi). Sơ đồ: cây đơn vị ?unit=, bảng người, hồ sơ ?person=.
// Mỗi tab một file trong pages/org/*; phản hồi sau hành động qua toast().
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { ErrorBox } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { Tabs } from '../components/Tabs'
import { Notice } from '../components/Notice'
import { useUrlState } from '../urlState'
import { useSession } from '../session'
import OrgTree from './org/OrgTree'
import PersonDrawer from './org/PersonDrawer'
import Mine from './org/Mine'
import Functions from './org/Functions'
import Levels from './org/Levels'
import Roles from './org/Roles'
import Import from './org/Import'

const ADMIN_TABS = ['tree', 'mine', 'functions', 'levels', 'grants', 'import']
const USER_TABS = ['tree', 'mine']

export default function Org() {
  const { user } = useSession()
  const admin = user.role === 'admin'
  const [st, set] = useUrlState({ tab: { default: admin ? 'tree' : 'mine', values: admin ? ADMIN_TABS : USER_TABS } })
  const [version, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)
  const [offboard, setOffboard] = useState(null)   // kết quả nghỉ việc vừa xử lý — hiện trong hồ sơ người đó
  const people = useFetch(() => api.orgPeople(), [version])
  const units = useFetch(() => api.orgUnits({ include_inactive: admin }), [version])
  const functions = useFetch(() => api.orgFunctions({ include_inactive: admin }), [version])
  const ctx = {
    admin, version, bump, offboard, setOffboard,
    people: people.data || [],
    units: units.data || [],
    functions: functions.data || [],
  }
  const goTab = (tab) => set({ tab }, { push: true })

  const items = [
    { id: 'tree', label: 'Sơ đồ', testId: 'org-tab-tree', content: <OrgTree ctx={ctx} /> },
    { id: 'mine', label: 'Của tôi', testId: 'org-tab-mine', content: <Mine ctx={ctx} /> },
  ]
  if (admin) {
    items.push(
      { id: 'functions', label: 'Chức năng', count: functions.data?.length, testId: 'org-tab-functions', content: <Functions ctx={ctx} /> },
      { id: 'levels', label: 'Cấp bậc', testId: 'org-tab-levels', content: <Levels /> },
      { id: 'grants', label: 'Vai trò chức năng', testId: 'org-tab-grants', content: <Roles ctx={ctx} /> },
      { id: 'import', label: 'Nhập dữ liệu', testId: 'org-tab-import', content: <Import ctx={ctx} /> },
    )
  }

  return (
    <div className="org-page">
      <PageHeader title="Cơ cấu tổ chức"
        description="Cây đơn vị, ai quản lý ai và vai trò chức năng — căn cứ quyền xem tri thức, giao bài, xem điểm." />
      <ErrorBox>{people.error || units.error || functions.error}</ErrorBox>
      {admin && units.data?.length === 0 && (
        <Notice tone="warn" title="Cây tổ chức đang trống — chưa ai soạn được bài học." testId="org-empty-guide">
          Quyền soạn bài có ở người có cấp dưới trực tiếp, hoặc được cấp vai trò <b>Quản lý đào tạo</b> / <b>Biên tập viên</b>.
          <ol className="org-steps">
            <li>Tab <b>Sơ đồ</b>: bấm <b>Thêm tập đoàn</b> để tạo đơn vị gốc (hoặc nhập cả cây ở tab <b>Nhập dữ liệu</b>).</li>
            <li>Tab <button type="button" className="link" onClick={() => goTab('grants')}>Vai trò chức năng</button>: cấp vai trò <b>Quản lý đào tạo</b> (hoặc Biên tập viên) cho người soạn bài — kể cả chính bạn. Đứng tên trưởng đơn vị thôi chưa đủ.</li>
            <li>Quay lại <Link to="/learn/library">Thư viện bài học</Link> — nút <b>Bài học mới</b> sẽ hiện.</li>
          </ol>
        </Notice>
      )}
      <Tabs kind="panel" label="Khu cơ cấu tổ chức" testId="org-tabs" items={items} value={st.tab} onChange={goTab} />
      <PersonDrawer ctx={ctx} />
    </div>
  )
}
