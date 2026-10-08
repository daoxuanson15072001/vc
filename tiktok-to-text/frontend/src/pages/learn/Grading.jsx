// Chấm bài (docs/BA.md mục 17.7 — LRN-08; DESIGN V.7 SCR-17, mẫu TPL-A2 Hàng chờ chia đôi).
// Tab ?tab= Chờ chấm (n) · Tất cả bài đã nộp (cho người xem được kết quả: cấp trên trong cây, người giao, L&D trong
// phạm vi). Màn ≥ 1000px chia hai cột: trái danh sách gọn (lọc lộ trình / nộp trong / trạng thái, trang ở ?path= ?days=
// ?status= ?page= ?size=), phải khung chấm theo ?attempt= (không có thì mở bài đầu); màn hẹp khung chấm là Drawer.
// Chốt điểm có xác nhận, xong bài rời hàng chờ, bài kế tự mở, tiêu điểm vào tiêu đề khung. File con: grading/*.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, usePageTitle } from '../../hooks'
import { buildSearch, useUrlState } from '../../urlState'
import { PageHeader } from '../../components/PageHeader'
import { Tabs } from '../../components/Tabs'
import { useWide } from '../review/useWide'
import { nextAfter } from '../review/queue'
import './learn.css'
import './scr15-17.css'
import { GradingList, PAGE_SIZES } from './grading/GradingList'
import { GradePane } from './grading/GradePane'
import { filterRows, pageSlice, pathOptions, unitOptions } from './grading/queue'

const SCHEMA = {
  tab: { default: 'pending', values: ['pending', 'all'] },
  attempt: { default: '' },
  path: { default: '' },
  unit: { default: '' },
  due: { default: '', values: ['', 'overdue', 'soon', 'none'] },
  days: { type: 'number' },
  status: { default: '', values: ['', 'pending', 'finalized'] },
  page: { type: 'number', default: 1 },
  size: { type: 'number', default: 12 },
}
const EMPTY_FOCUS = '__empty__'

// Khung phải khi chưa mở bài nào (màn rộng); vừa chốt bài cuối thì nhận tiêu điểm
function EmptyPane({ focusReq, done }) {
  const ref = useRef(null)
  useEffect(() => {
    if (focusReq.current === EMPTY_FOCUS) { focusReq.current = null; ref.current?.focus() }
  })
  return (
    <section ref={ref} tabIndex={-1} className="rv-pane rv-pane-empty" aria-label="Chấm bài" data-testid="grading-detail-empty">
      <p className="rv-muted">{done ? 'Không còn bài nào chờ chấm ở danh sách này.' : 'Chọn một bài ở danh sách bên trái để chấm.'}</p>
    </section>
  )
}

export default function Grading() {
  usePageTitle('Chấm bài')
  const [raw, set] = useUrlState(SCHEMA)
  const { search } = useLocation()
  const wide = useWide()
  const st = { ...raw, size: PAGE_SIZES.includes(raw.size) ? raw.size : 12, page: Math.max(1, raw.page || 1), days: raw.days || 0 }
  const { tab } = st
  const focusReq = useRef(null)
  const [gone, setGone] = useState(() => new Set())   // bài vừa chốt: rời hàng chờ ngay, không đợi tải lại

  const pending = useFetch(() => api.gradingQueue(true), [])
  const everything = useFetch(() => (tab === 'all' ? api.gradingQueue(false) : Promise.resolve(null)), [tab])
  const source = tab === 'all' ? everything : pending
  const reloadPending = pending.reload
  const reloadAll = everything.reload
  const reload = useCallback(() => Promise.all([reloadPending(), tab === 'all' ? reloadAll() : null]), [reloadPending, reloadAll, tab])

  const items = source.data?.items && (tab === 'all' ? source.data.items : source.data.items.filter((r) => !gone.has(r.id)))
  const filtered = filterRows(items, { path: st.path, unit: st.unit, days: st.days, due: st.due, status: tab === 'all' ? st.status : '' })
  const paged = pageSlice(filtered, st.page, st.size)
  const rows = paged.rows
  const openId = st.attempt || null
  const hrefFor = useCallback((id) => `?${buildSearch(search, { attempt: id }, SCHEMA)}`, [search])

  // trang vượt quá (vừa chốt hết trang cuối) → lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (items && st.page > paged.pages) set({ page: paged.pages })
  }, [items, st.page, paged.pages, set])
  // màn rộng, chưa chọn bài nào → mở bài đầu (ghi ?attempt= để dán link là thấy đúng bài)
  const firstId = rows[0]?.id
  useEffect(() => {
    if (wide && !openId && firstId) set({ attempt: firstId })
  }, [wide, openId, firstId, set])

  const changeTab = (next) => set({ tab: next, attempt: '', page: 1, path: '', unit: '', days: null, due: '', status: '' }, { push: true })

  // Chốt xong: mở bài chờ chấm kế tiếp (không phải bài đã chốt), tiêu điểm vào tiêu đề khung; hết bài thì khung trống
  const onFinalized = async (res) => {
    const waiting = rows.filter((r) => !r.finalized_at || r.id === res.id)
    const next = nextAfter(waiting, res.id)
    focusReq.current = next || EMPTY_FOCUS
    setGone((g) => new Set(g).add(res.id))
    set({ attempt: next || '' })
    await reload()
  }

  const pane = openId && <GradePane id={openId} wide={wide} focusReq={focusReq} onFinalized={onFinalized} onClose={() => set({ attempt: '' })} />
  const paths = pathOptions(items)
  const list = (
    <div className={`rv-split gr-split${wide ? ' is-wide' : ''}`}>
      <section aria-label="Danh sách bài thi" className="rv-list gr-list">
        <GradingList loaded={!!items} st={st} set={set} rows={rows} total={filtered.length} paths={paths} units={unitOptions(items)}
          loading={!items && !source.error} error={source.error} onRetry={source.reload} currentId={openId} hrefFor={hrefFor} />
      </section>
      {wide && (pane || <EmptyPane focusReq={focusReq} done={!!items && !rows.length} />)}
    </div>
  )

  return (
    <>
      <PageHeader title="Chấm bài"
        description="Trắc nghiệm đã chấm tự động; tự luận có điểm AI sơ bộ theo rubric. Bạn đọc bài, cho điểm, viết nhận xét rồi chốt — người học chỉ thấy điểm sau khi chốt." />
      <Tabs kind="panel" label="Lọc bài" value={tab} onChange={changeTab} testId="grading-tabs"
        items={[
          { id: 'pending', label: 'Chờ chấm', testId: 'grading-tab-pending', count: pending.data?.items.length, content: list },
          { id: 'all', label: 'Tất cả bài đã nộp', testId: 'grading-tab-all', content: list },
        ]} />
      {!wide && pane}
    </>
  )
}
