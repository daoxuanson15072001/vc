// Lộ trình học (docs/BA.md mục 17.2–17.4 — LRN-03; DESIGN Phần V SCR-16, TPL-A): danh sách lộ trình năm (khung) /
// tháng của mình và khung đã phát hành của cấp trên. Lọc năm / tháng / trạng thái / Của tôi nằm trên URL
// (?year=&month=&status=&mine=1). Nút chính *+ Lộ trình mới* là menu: Thiết kế lộ trình (AI) → /learn/design,
// Lộ trình trống → hộp tạo tay. Bản nháp AI dựng cũng hiện ở đây để mở / sửa / phát hành.
import { useMemo, useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { useUrlState } from '../../urlState'
import { dateTime } from '../../format'
import { Badge } from '../../components/ui'
import { PageHeader } from '../../components/PageHeader'
import { FilterBar, FilterChip, SelectField } from '../../components/FilterBar'
import { DataTable } from '../../components/DataTable'
import { ActionMenu } from '../../components/ActionMenu'
import './learn.css'
import { PATH_STATUS, periodLabel, StatusBadge } from './common'
import NewPath from './paths/NewPath'
import CoursePathBuilder from './paths/CoursePathBuilder'

const SCHEMA = { year: { default: '' }, month: { default: '' }, status: { default: '' }, mine: { type: 'bool' },
  builder: { type: 'bool' }, step: { default: '1', values: ['1', '2', '3'] } }

export default function Paths() {
  const { data, error, reload } = useFetch(() => api.paths(), [])
  const [st, set] = useUrlState(SCHEMA)
  const [creating, setCreating] = useState(false)
  const startBuilder = () => set({ builder: true, step: '1' }, { push: true })
  const closeBuilder = () => set({ builder: false, step: '1' }, { push: true })
  // «Của tôi»: lộ trình do mình tạo — lọc ở máy chủ (?mine=true), chỉ lấy mã để lọc danh sách đầy đủ
  const { data: mineData } = useFetch(() => (st.mine ? api.paths({ mine: 'true' }) : Promise.resolve(null)), [st.mine])
  const mineIds = useMemo(() => new Set((mineData?.items || []).map((p) => p.id)), [mineData])
  const items = useMemo(() => data?.items || [], [data])
  const frames = items.filter((p) => p.period === 'year' && p.status === 'published')
  const years = useMemo(() => [...new Set(items.map((p) => p.year))].sort((a, b) => b - a), [items])
  const rows = items.filter((p) => (!st.year || String(p.year) === st.year)
    && (!st.month || (p.period === 'month' && String(p.month) === st.month))
    && (!st.status || p.status === st.status)
    && (!st.mine || mineIds.has(p.id)))
  const active = !!(st.year || st.month || st.status || st.mine)

  return (
    <>
      <PageHeader
        title="Lộ trình học"
        description="Xếp khoá học theo thứ tự, phát hành nội dung rồi giao cho người trong cây dưới quyền. Lộ trình tuần cũ vẫn xem và chạy bình thường."
        actions={data?.can_author && (
          <ActionMenu label="+ Lộ trình mới" icon="chevron-down" size="md" align="end" testId="path-new" buttonClassName="ui-btn-primary"
            items={[
              { label: 'Thiết kế lộ trình (AI)', icon: 'sparkles', to: '/learn/design', testId: 'path-new-design' },
              { label: 'Lộ trình chuỗi khoá', icon: 'plus', onSelect: startBuilder, testId: 'path-new-chain' },
              { label: 'Lộ trình tuần (kiểu cũ)', icon: 'calendar', onSelect: () => setCreating(true), testId: 'path-new-blank' },
            ]} />
        )}
      />
      <FilterBar label="Lọc lộ trình" count={rows.length} unit="lộ trình" active={active} testId="paths-filters"
        onClear={() => set({ year: '', month: '', status: '', mine: false })}>
        <SelectField label="Năm" value={st.year} onChange={(year) => set({ year })} testId="paths-year"
          options={[{ value: '', label: 'Tất cả' }, ...years.map((y) => ({ value: String(y), label: String(y) }))]} />
        <SelectField label="Tháng" value={st.month} onChange={(month) => set({ month })} testId="paths-month"
          options={[{ value: '', label: 'Tất cả' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))]} />
        <SelectField label="Trạng thái" value={st.status} onChange={(status) => set({ status })} testId="paths-status"
          options={[{ value: '', label: 'Tất cả' }, ...Object.entries(PATH_STATUS).map(([value, s]) => ({ value, label: s.label }))]} />
        <FilterChip pressed={st.mine} onClick={() => set({ mine: !st.mine })} testId="paths-mine">Của tôi</FilterChip>
      </FilterBar>
      <DataTable
        caption="Danh sách lộ trình học"
        testId="paths-table"
        rows={rows}
        loading={!data && !error}
        error={error}
        onRetry={reload}
        getStatus={(p) => p.status}
        rowTestId="path-row"
        empty={active ? 'Không có lộ trình nào khớp bộ lọc.' : 'Chưa có lộ trình nào.'}
        columns={[
          { key: 'title', header: 'Tên lộ trình', title: true, to: (p) => `/learn/paths/${p.id}` },
          { key: 'status', header: 'Trạng thái', render: (p) => <StatusBadge map={PATH_STATUS} status={p.status} /> },
          { key: 'kind', header: 'Kiểu', render: (p) => p.kind === 'courses' ? `${p.courses?.length || 0} khoá` : <>{periodLabel(p)} <Badge tone="muted">Kiểu cũ</Badge></> },
          { key: 'lessons', header: 'Nội dung', render: (p) => p.kind === 'courses' ? `${p.course_count ?? p.lesson_count} bài` : <>{p.lesson_count}{p.has_exam && <span className="muted small"> · có bài thi</span>}</> },
          { key: 'owner', header: 'Người tạo', render: (p) => <>{p.owner_name}{p.from_ai && <> <Badge tone="info">AI dựng</Badge></>}</> },
          { key: 'assigned', header: 'Đã giao', render: (p) => (p.assigned_count > 0 ? `${p.assigned_count} người` : '—') },
          { key: 'updated', header: 'Cập nhật', render: (p) => dateTime(p.updated_at) },
        ]}
      />
      <NewPath open={creating} frames={frames} onClose={() => setCreating(false)} />
      <CoursePathBuilder open={st.builder} step={st.step} onStep={(step) => set({ step }, { push: true })} onClose={closeBuilder} />
    </>
  )
}
