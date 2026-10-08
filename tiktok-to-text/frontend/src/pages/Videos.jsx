import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, qs } from '../api'
import { useDebounced, useFetch } from '../hooks'
import { compact, date, duration } from '../format'
import { Pagination } from '../components/ui'
import { FilterBar, SearchField, SelectField } from '../components/FilterBar'
import { DataTable } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/icons'
import VideoDetail from './VideoDetail'

const FILTER_KEYS = ['q', 'channel', 'status', 'tag', 'date_from', 'date_to', 'sort', 'order']
const SORTS = [
  ['posted_at', 'Ngày đăng'],
  ['views', 'Lượt xem'],
  ['likes', 'Lượt thích'],
  ['comments', 'Bình luận'],
  ['shares', 'Chia sẻ'],
  ['duration', 'Thời lượng'],
  ['updated_at', 'Mới cập nhật'],
]

// Tab «Video» của Kho tư liệu (SCR-03, chỉ dùng nhúng): lọc trên URL (?q=&channel=&status=&tag=&date_from=&date_to=
// &sort=&order=&page=&page_size=), 4 ô thường trực + «Lọc thêm» (tag, ngày); tên video là link ?v=<id> mở chi tiết.
export default function Videos() {
  const [params, setParams] = useSearchParams()
  const get = (k, d = '') => params.get(k) ?? d
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, get(k)]))
  filters.sort ||= 'posted_at'
  filters.order ||= 'desc'
  const page = Number(get('page', '1'))
  const pageSize = Number(get('page_size', '20'))
  const openId = get('v')

  const [q, setQ] = useState(filters.q)
  const debouncedQ = useDebounced(q)

  const update = (changes, resetPage = true) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, v)))
    if (resetPage) next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (debouncedQ !== filters.q) update({ q: debouncedQ })
  }, [debouncedQ]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = { ...filters, page, page_size: pageSize }
  const key = JSON.stringify(query)
  const { data, error, reload } = useFetch(() => api.videos(query), [key])
  const { data: channels } = useFetch(api.channels, [])
  const { data: tags, reload: reloadTags } = useFetch(api.tags, [])

  const openHref = (id) => {
    const next = new URLSearchParams(params)
    next.set('v', id)
    return { search: `?${next}` }
  }
  const hasFilter = ['q', 'channel', 'status', 'tag', 'date_from', 'date_to'].some((k) => filters[k])

  const columns = [
    { key: 'posted', header: 'Ngày đăng', className: 'nowrap', render: (v) => date(v.posted_at) },
    { key: 'caption', header: 'Video', title: true, className: 'cell-video', render: (v) => (
      <>
        <Link to={openHref(v.id)} className="ui-title-link clamp-1" data-testid="videos-row-open">
          {v.caption || <span className="muted">(không caption)</span>}
        </Link>
        <div className="muted clamp-2">{v.transcript_preview || v.error}</div>
        <div className="meta">
          <span>@{v.channel_handle}</span>
          {v.tags?.map((t) => <span key={t} className="tag">#{t}</span>)}
          {v.note && <span title={v.note}>✎ ghi chú</span>}
        </div>
      </>
    ) },
    { key: 'views', header: 'Xem', className: 'num strong', render: (v) => compact(v.views) },
    { key: 'likes', header: 'Thích', className: 'num', render: (v) => compact(v.likes) },
    { key: 'comments', header: <abbr title="Bình luận">BL</abbr>, className: 'num', render: (v) => compact(v.comments) },
    { key: 'shares', header: 'Chia sẻ', className: 'num', render: (v) => compact(v.shares) },
    { key: 'duration', header: 'Dài', className: 'num nowrap', render: (v) => duration(v.duration) },
    { key: 'status', header: 'Trạng thái', render: (v) => <StatusBadge kind="video" status={v.status} /> },
  ]
  const more = !!(filters.tag || filters.date_from || filters.date_to)
  const [showMore, setShowMore] = useState(more)
  const clear = () => {
    setQ('')
    update({ q: '', channel: '', status: '', tag: '', date_from: '', date_to: '' })
  }

  return (
    <div className="kb-stack">
      <div className="kb-filterrow">
        <p className="muted kb-flush grow">
          Video đã chuyển chữ — số liệu viral dùng cho Chiến dịch. Nạp thêm kênh / video bằng nút «Nạp nguồn».
        </p>
        <Link className="ui-btn" to={`/studio/new${qs({ q: filters.q, channel: filters.channel, tag: filters.tag })}`}
          title="Dùng video khớp bộ lọc làm tham chiếu để AI lập chiến lược, kế hoạch và kịch bản" data-testid="videos-campaign">
          <Icon name="megaphone" size={16} />Lập chiến dịch{hasFilter ? ' từ bộ lọc' : ''}
        </Link>
        <a className="ui-btn" href={api.exportUrl(filters)} download data-testid="videos-export"
          aria-label={`Xuất Excel (tải file)${hasFilter ? ' theo bộ lọc' : ''}`} title="Tải file Excel về máy — nội dung không hiện trên trang">
          <Icon name="download" size={16} />Xuất Excel{hasFilter ? ' (theo bộ lọc)' : ''}
        </a>
      </div>

      <FilterBar label="Lọc video" count={data?.total} unit={hasFilter ? 'video khớp bộ lọc' : 'video'} active={hasFilter} onClear={clear}
        testId="videos-filter">
        <SearchField label="Tìm trong lời nói, caption, ghi chú" value={q} onChange={setQ}
          placeholder="Tìm trong lời nói, caption, ghi chú — gõ không dấu cũng được" testId="videos-q" />
        <SelectField label="Kênh" value={filters.channel} onChange={(v) => update({ channel: v })} testId="videos-filter-channel"
          options={[{ value: '', label: 'Tất cả kênh' }, ...(channels || []).map((c) => ({ value: c.handle, label: `@${c.handle} (${c.videos})` }))]} />
        <SelectField label="Trạng thái" value={filters.status} onChange={(v) => update({ status: v })} testId="videos-filter-status"
          options={[{ value: '', label: 'Mọi trạng thái' }, { value: 'ok', label: 'OK' }, { value: 'no_speech', label: 'Không lời nói' }, { value: 'error', label: 'Lỗi' }]} />
        <SelectField label="Sắp theo" value={filters.sort} onChange={(v) => update({ sort: v })} testId="videos-sort"
          options={SORTS.map(([value, label]) => ({ value, label }))} />
        <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" title="Đảo chiều sắp xếp"
          onClick={() => update({ order: filters.order === 'desc' ? 'asc' : 'desc' })}>
          {filters.order === 'desc' ? '↓ Giảm dần' : '↑ Tăng dần'}
        </button>
        <button type="button" className="ui-btn ui-btn-sm" aria-expanded={showMore} aria-controls="videos-more" onClick={() => setShowMore(!showMore)}
          data-testid="videos-more">
          Lọc thêm{more ? ' (đang lọc)' : ''}<Icon name="chevron-down" size={16} />
        </button>
        {showMore && (
          <span id="videos-more" className="kb-chips">
            <SelectField label="Tag" value={filters.tag} onChange={(v) => update({ tag: v })} testId="videos-filter-tag"
              options={[{ value: '', label: 'Mọi tag' }, ...(tags || []).map((t) => ({ value: t, label: `#${t}` }))]} />
            <label className="ui-select">Từ <input type="date" value={filters.date_from} onChange={(e) => update({ date_from: e.target.value })} /></label>
            <label className="ui-select">đến <input type="date" value={filters.date_to} onChange={(e) => update({ date_to: e.target.value })} /></label>
          </span>
        )}
      </FilterBar>

      <DataTable caption="Danh sách video trong kho — bấm tên video để xem chi tiết" testId="videos-table" rows={data?.items}
        columns={columns} getStatus={(v) => v.status} rowName={(v) => v.caption || v.id} current={openId || undefined}
        loading={!data && !error} error={error} onRetry={reload}
        empty={hasFilter ? 'Không có video khớp bộ lọc.' : 'Chưa có video — dán link kênh / video ở «Nạp nguồn» để bắt đầu.'} />
      {data && data.items.length > 0 && (
        <div className="table-foot">
          <select value={pageSize} onChange={(e) => update({ page_size: e.target.value })} aria-label="Số video mỗi trang">
            {[20, 50, 100].map((n) => <option key={n} value={n}>{n} / trang</option>)}
          </select>
          <Pagination page={page} pageSize={pageSize} total={data.total} onPage={(p) => update({ page: p }, false)} />
        </div>
      )}

      {openId && (
        <VideoDetail
          id={openId}
          onClose={() => update({ v: '', vtab: '' }, false)}
          onChanged={() => {
            reload()
            reloadTags()
          }}
          onFilterTag={(t) => update({ tag: t, v: '', vtab: '' })}
        />
      )}
    </div>
  )
}
