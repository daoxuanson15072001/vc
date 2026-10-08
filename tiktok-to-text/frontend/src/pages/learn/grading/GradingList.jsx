// Cột trái của Chấm bài (DESIGN SCR-17, TPL-A2): FilterBar (lọc lên URL) + DataTable gọn — tên người học là Link tới
// ?attempt=<id> (giữ bộ lọc / trang), hàng đang mở aria-current="true", không con trỏ tay trên hàng — + Pagination.
import { dateTime } from '../../../format'
import { DataTable } from '../../../components/DataTable'
import { FilterBar, SelectField } from '../../../components/FilterBar'
import { StatusBadge } from '../../../components/StatusBadge'
import { Pagination } from '../../../components/ui'
import { AI_STATUS, scoreText } from '../common'

export const PAGE_SIZES = [12, 24, 48, 96]
const DAYS = [{ value: '', label: 'Mọi lúc' }, { value: '1', label: '1 ngày qua' }, { value: '7', label: '7 ngày qua' }, { value: '30', label: '30 ngày qua' }]
const DUE = [{ value: '', label: 'Mọi hạn' }, { value: 'overdue', label: 'Quá hạn' }, { value: 'soon', label: 'Còn ≤ 3 ngày' }, { value: 'none', label: 'Không hạn' }]
const STATUS = [{ value: '', label: 'Mọi trạng thái' }, { value: 'pending', label: 'Chờ chốt' }, { value: 'finalized', label: 'Đã chốt' }]

export function GradingList({ loaded, st, set, rows, total, paths, units = [], loading, error, onRetry, currentId, hrefFor }) {
  const filtering = !!(st.path || st.unit || st.days || st.due || st.status)
  const columns = [
    { key: 'learner', header: 'Người học', title: true, to: (r) => hrefFor(r.id), render: (r) => r.learner_name || '(không rõ)' },
    { key: 'unit', header: 'Đơn vị', className: 'gr-col-unit', render: (r) => r.learner_unit || '—' },
    { key: 'path', header: 'Lộ trình', className: 'gr-col-path', render: (r) => r.path_title },
    {
      key: 'when', header: 'Nộp lúc', className: 'gr-col-when',
      render: (r) => <>{dateTime(r.submitted_at)}{r.auto_submitted && <> <span className="ui-badge" data-tone="warn">tự nộp</span></>}</>,
    },
    {
      key: 'status', header: 'Trạng thái', className: 'gr-col-status',
      render: (r) => (
        <>
          <StatusBadge kind="learnGrade" status={r.finalized_at ? 'finalized' : 'pending'} />
          {r.finalized_at && <> <StatusBadge kind="learnPass" status={r.passed ? 'pass' : 'fail'} /></>}
          {r.appeal_open && <> <span className="ui-badge" data-tone="info">có phản hồi</span></>}
          <span className="gr-sub">
            {r.finalized_at ? scoreText(r.final_score, r.max_score)
              : r.essay_count ? `${r.essay_count} câu tự luận · ${AI_STATUS[r.ai_status] || ''}` : 'Chỉ trắc nghiệm'}
          </span>
        </>
      ),
    },
  ]
  return (
    <>
      <FilterBar label="Lọc bài chờ chấm" count={loaded ? total : undefined} unit="bài" active={filtering} testId="grading-filters"
        onClear={() => set({ path: '', unit: '', days: null, due: '', status: '', page: 1, attempt: '' })}>
        <SelectField label="Lộ trình" value={st.path} testId="grading-filter-path"
          options={[{ value: '', label: 'Mọi lộ trình' }, ...paths.map((p) => ({ value: p, label: p }))]}
          onChange={(v) => set({ path: v, page: 1, attempt: '' })} />
        <SelectField label="Đơn vị" value={st.unit} testId="grading-filter-unit"
          options={[{ value: '', label: 'Mọi đơn vị' }, ...units]}
          onChange={(v) => set({ unit: v, page: 1, attempt: '' })} />
        <SelectField label="Hạn" value={st.due} options={DUE} testId="grading-filter-due"
          onChange={(v) => set({ due: v, page: 1, attempt: '' })} />
        <SelectField label="Nộp" value={st.days ? String(st.days) : ''} options={DAYS} testId="grading-filter-days"
          onChange={(v) => set({ days: v ? Number(v) : null, page: 1, attempt: '' })} />
        {st.tab === 'all' && (
          <SelectField label="Trạng thái" value={st.status} options={STATUS} testId="grading-filter-status"
            onChange={(v) => set({ status: v, page: 1, attempt: '' })} />
        )}
      </FilterBar>
      <DataTable caption={st.tab === 'all' ? 'Tất cả bài thi đã nộp' : 'Bài thi chờ chấm'} columns={columns} rows={rows}
        getStatus={(r) => (r.finalized_at ? 'finalized' : 'pending')} rowName={(r) => r.learner_name} rowTestId="grading-row"
        current={currentId} loading={loading} error={error} onRetry={onRetry}
        empty={filtering ? 'Không có bài nào khớp bộ lọc.' : st.tab === 'all' ? 'Chưa có bài thi nào bạn xem được.' : 'Không có bài nào chờ bạn chấm.'}
        testId="grading-list" />
      {loaded && (
        <Pagination page={st.page} pageSize={st.size} total={total} unit="bài" pageSizes={PAGE_SIZES}
          onPage={(p) => set({ page: p, attempt: '' })} onPageSize={(n) => set({ size: n, page: 1, attempt: '' })} />
      )}
    </>
  )
}
