// Cột trái của Hộp duyệt (DESIGN SCR-09, TPL-A2): FilterBar (lọc lên URL) + DataTable gọn — tiêu đề thẻ là
// Link tới ?change=<id> (giữ bộ lọc / trang), hàng đang mở aria-current="true" — + Pagination.
import { dateTime } from '../../format'
import { DataTable } from '../../components/DataTable'
import { FilterBar, FilterChip, SelectField } from '../../components/FilterBar'
import { StatusBadge } from '../../components/StatusBadge'
import { Pagination } from '../../components/ui'
import { statusInfo } from '../../statuses'
import { changeTitle, stepText } from './queue'

export const PAGE_SIZES = [12, 24, 48, 96]
const STATUS_OPTIONS = [
  { value: '', label: 'Mọi trạng thái' }, { value: 'open,needs_rebase', label: 'Đang mở' },
  { value: 'returned', label: 'Cần sửa (bị trả về)' }, { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' }, { value: 'withdrawn', label: 'Đã rút' },
]
const KIND_OPTIONS = [
  { value: '', label: 'Mọi loại' }, { value: 'create', label: 'Thẻ mới' }, { value: 'update', label: 'Sửa nội dung' },
  { value: 'obsolete', label: 'Lỗi thời' }, { value: 'rollback', label: 'Quay về bản cũ' }, { value: 'merge', label: 'Gộp thẻ' },
]
const EMPTY = { inbox: 'Không có đề xuất nào chờ bạn duyệt.', mine: 'Bạn chưa gửi đề xuất nào khớp bộ lọc.', all: 'Chưa có đề xuất nào khớp bộ lọc.' }
const CAPTION = { inbox: 'Đề xuất chờ tôi duyệt', mine: 'Đề xuất tôi đã gửi', all: 'Đề xuất gần đây' }

export function ReviewList({ tab, st, set, items, data, error, loading, onRetry, currentId, hrefFor, pendingCount }) {
  const total = Math.max(0, (data?.total ?? 0) - pendingCount)
  const filtering = tab === 'inbox' ? st.filtered : !!(st.status || st.kind)
  const columns = [
    { key: 'title', header: 'Đề xuất', title: true, to: (r) => hrefFor(r.id), render: changeTitle },
    {
      key: 'kind', header: 'Loại', className: 'rv-col-kind',
      render: (r) => (
        <>
          <span className="rv-kind">{r.kind_label}</span>
          {r.novelty && <> · <span className="rv-muted">{statusInfo('novelty', r.novelty.verdict).label}</span></>}
          {r.returned
            ? <span className="rv-sum" data-testid="review-row-returned">Lý do trả về: {r.returned.note}</span>
            : r.summary && <span className="rv-sum">{r.summary}</span>}
        </>
      ),
    },
    {
      key: 'status', header: 'Trạng thái', className: 'rv-col-status',
      render: (r) => (
        <>
          <StatusBadge kind="change" status={r.status} label={stepText(r, statusInfo('change', r.status).label)} />
          {r.returned && <StatusBadge kind="changeFlag" status="returned" />}
          {r.overdue && <span className="ui-badge" data-tone="bad">{r.needs_escalation ? 'Quá hạn — cần chuyển cấp' : 'Quá hạn'}</span>}
        </>
      ),
    },
    {
      key: 'when', header: 'Người gửi · hạn', className: 'rv-col-when',
      render: (r) => (
        <>
          <span>{r.created_by_name || 'AI'}</span>
          <span className="rv-muted">{(r.status === 'open' || r.status === 'needs_rebase') && !r.returned ? `Hạn ${dateTime(r.due_at)}` : dateTime(r.updated_at || r.created_at)}</span>
        </>
      ),
    },
  ]

  return (
    <>
      <FilterBar label="Lọc đề xuất" count={data ? total : undefined} unit="đề xuất" active={filtering} testId="review-filters"
        onClear={() => set({ status: '', kind: '', filtered: false, page: 1, change: '' })}>
        {tab === 'inbox' ? (
          <FilterChip pressed={st.filtered} onClick={() => set({ filtered: !st.filtered, page: 1, change: '' })} testId="review-show-filtered">
            Hiện cả đề xuất cổng so sánh xếp Trùng / Nhiễu{!st.filtered && data?.hidden > 0 ? ` (${data.hidden} đang ẩn)` : ''}
          </FilterChip>
        ) : (
          <>
            <SelectField label="Trạng thái" value={st.status} options={STATUS_OPTIONS} testId="review-filter-status"
              onChange={(v) => set({ status: v, page: 1, change: '' })} />
            <SelectField label="Loại" value={st.kind} options={KIND_OPTIONS} testId="review-filter-kind"
              onChange={(v) => set({ kind: v, page: 1, change: '' })} />
          </>
        )}
      </FilterBar>
      <DataTable caption={CAPTION[tab]} columns={columns} rows={items} getStatus={(r) => r.status} getKind={(r) => r.kind}
        rowName={changeTitle} current={currentId} loading={loading || (!data && !error)} error={error} onRetry={onRetry}
        empty={EMPTY[tab]} testId="review-list" />
      {data && (
        <Pagination page={st.page} pageSize={st.size} total={total} unit="đề xuất" pageSizes={PAGE_SIZES}
          onPage={(p) => set({ page: p, change: '' })} onPageSize={(n) => set({ size: n, page: 1, change: '' })} />
      )}
    </>
  )
}
