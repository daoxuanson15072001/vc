// Hộp duyệt VCWIKI (GOV-02, 04…06, 08, 12 — docs/BA.md mục 16.2–16.4; DESIGN V.7 SCR-09, mẫu TPL-A2 Hàng chờ chia đôi).
// Tab *Chờ tôi duyệt (n) · Tôi đề xuất · Gần đây · Duyệt hàng loạt* (?tab=). Màn ≥ 1000px chia hai cột: trái danh
// sách gọn (lọc, trang ở ?status= ?kind= ?filtered= ?page= ?size=), phải khung chi tiết theo ?change= (không có thì mở
// mục đầu); màn hẹp khung chi tiết là Drawer. Duyệt / Trả về (GOV-13) / Từ chối hoãn gửi 8 giây (Hoàn tác được — usePendingDecisions),
// mục rời danh sách ngay và mục kế tự mở, tiêu điểm vào tiêu đề khung. Cấu hình số người duyệt ở /admin tab Duyệt.
// File con: pages/review/* (ReviewList, ChangePane, ChangeBody, ChangeActions, ReviewDiff, queue, usePendingDecisions).
import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { useUrlState, buildSearch } from '../urlState'
import { PageHeader } from '../components/PageHeader'
import { Tabs } from '../components/Tabs'
import { ReviewList, PAGE_SIZES } from './review/ReviewList'
import { ChangePane } from './review/ChangePane'
import { usePendingDecisions } from './review/usePendingDecisions'
import { useWide } from './review/useWide'
import { neighbours, nextAfter } from './review/queue'
import BulkReview, { BULK_KEYS } from './BulkReview'

const TABS = [['inbox', 'Chờ tôi duyệt'], ['mine', 'Tôi đề xuất'], ['all', 'Gần đây'], ['bulk', 'Duyệt hàng loạt']]
const SCHEMA = {
  tab: { default: 'inbox', values: TABS.map(([k]) => k) },
  change: { default: '' },
  page: { type: 'number', default: 1 },
  size: { type: 'number', default: 24 },
  status: { default: '' },
  kind: { default: '' },
  filtered: { type: 'bool' },
}
const EMPTY_FOCUS = '__empty__'

// Khung phải khi chưa mở đề xuất nào (màn rộng); vừa xử lý mục cuối thì nhận tiêu điểm
function EmptyPane({ focusReq, done }) {
  const ref = useRef(null)
  useEffect(() => {
    if (focusReq.current === EMPTY_FOCUS) { focusReq.current = null; ref.current?.focus() }
  })
  return (
    <section ref={ref} tabIndex={-1} className="rv-pane rv-pane-empty" aria-label="Chi tiết đề xuất" data-testid="review-detail-empty">
      <p className="rv-muted">{done ? 'Không còn đề xuất nào ở danh sách này.' : 'Chọn một đề xuất ở danh sách bên trái để xem chi tiết và duyệt.'}</p>
    </section>
  )
}

const DONE = { approve: ['Duyệt', 'Đã duyệt'], reject: ['Từ chối', 'Đã từ chối'], return: ['Trả về', 'Đã trả về người đề xuất'] }

export default function Review() {
  const [raw, set] = useUrlState(SCHEMA)
  const { search } = useLocation()
  const wide = useWide()
  const st = { ...raw, page: Math.max(1, raw.page || 1), size: PAGE_SIZES.includes(raw.size) ? raw.size : 24 }
  const { tab } = st
  const openId = st.change || null
  const focusReq = useRef(null)

  const query = {
    ...(tab === 'inbox' ? { inbox: 1, hide_filtered: st.filtered ? 0 : 1 } : tab === 'mine' ? { mine: 1 } : {}),
    ...(tab !== 'inbox' && st.status ? { status: st.status } : {}),
    ...(tab !== 'inbox' && st.kind ? { kind: st.kind } : {}),
    page: st.page, page_size: st.size,
  }
  const list = useFetch(() => (tab === 'bulk' ? Promise.resolve(null) : api.changes(query)),
    [tab, st.page, st.size, st.status, st.kind, st.filtered])
  const inbox = useFetch(() => api.changes({ inbox: 1, hide_filtered: 1, page_size: 1 }), [])
  const reloadList = list.reload
  const reloadInbox = inbox.reload
  const reloadAll = useCallback(() => Promise.all([reloadList(), reloadInbox()]), [reloadList, reloadInbox])

  const pending = usePendingDecisions({
    onSettled: reloadAll,
    onUndo: (job) => { focusReq.current = job.id; set({ change: job.id }) },   // mục quay lại và mở lại
  })
  const all = list.data?.items || []
  const items = all.filter((c) => !pending.pendingIds.has(c.id))
  const hidden = all.length - items.length
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / st.size))
  const hrefFor = useCallback((id) => `?${buildSearch(search, { change: id }, SCHEMA)}`, [search])

  // trang vượt quá (vd vừa duyệt hết trang cuối) → lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (list.data && st.page > pages) set({ page: pages })
  }, [list.data, st.page, pages, set])
  // màn rộng, chưa chọn mục nào → mở mục đầu (ghi ?change= để dán link là thấy đúng mục)
  const firstId = items[0]?.id
  useEffect(() => {
    if (wide && tab !== 'bulk' && !openId && firstId) set({ change: firstId })
  }, [wide, tab, openId, firstId, set])

  const changeTab = (next) => {
    pending.flush()   // đổi tab: gửi ngay các quyết định còn hoãn
    const clear = Object.fromEntries(BULK_KEYS.map((k) => [k, '']))
    set({ ...clear, tab: next, change: '', page: 1, status: '', kind: '', filtered: false }, { push: true })
  }

  // Duyệt / Trả về / Từ chối: hoãn gửi, mục rời danh sách, mở mục kế, tiêu điểm vào tiêu đề khung chi tiết
  const onDecide = ({ id, title, decision, body }) => {
    const next = nextAfter(items, id)
    const [verb, done] = DONE[decision]
    pending.defer({ id, title, body, verb, done })
    focusReq.current = next || EMPTY_FOCUS   // hết mục: tiêu điểm vào khung trống (không rơi về body)
    set({ change: next || '' })
  }

  const nb = openId ? neighbours(items, openId) : null
  const nav = nb && { pos: nb.pos, total: nb.total, prevHref: nb.prev && hrefFor(nb.prev), nextHref: nb.next && hrefFor(nb.next) }
  const pane = openId && (
    <ChangePane id={openId} wide={wide} nav={nav} focusReq={focusReq} onDecide={onDecide} onChanged={reloadAll}
      onClose={() => set({ change: '' })} />
  )
  const queue = (
    <div className={`rv-split${wide ? ' is-wide' : ''}`}>
      <section aria-label="Danh sách đề xuất" className="rv-list">
        <ReviewList tab={tab} st={st} set={set} items={items} data={list.data} error={list.error} loading={list.loading}
          onRetry={list.reload} currentId={openId} hrefFor={hrefFor} pendingCount={hidden} />
      </section>
      {wide && (pane || <EmptyPane focusReq={focusReq} done={!!list.data && !items.length} />)}
    </div>
  )

  const inboxCount = inbox.data ? Math.max(0, inbox.data.total - (tab === 'inbox' ? hidden : 0)) : undefined
  return (
    <>
      <PageHeader title="Hộp duyệt" description="Mọi thay đổi thẻ đã duyệt là một đề xuất; duyệt theo bậc thẻ rồi thành phiên bản mới." />
      <Tabs kind="panel" label="Nhóm đề xuất" value={tab} onChange={changeTab} testId="review-tabs"
        items={TABS.map(([id, label]) => ({
          id, label, testId: `review-tab-${id}`, count: id === 'inbox' ? inboxCount : undefined,
          content: id === 'bulk' ? <BulkReview /> : queue,
        }))} />
      {!wide && pane}
    </>
  )
}
