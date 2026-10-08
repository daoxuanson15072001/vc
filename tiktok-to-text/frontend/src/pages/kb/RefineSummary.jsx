// Tiến độ tinh chế › Tổng hợp (SCR-04, TPL-D): Stat 6 ô + dải trạng thái (màu từ token) → hàng chờ chuyển chữ theo làn
// (chuyển từ tab Nguồn) → 14 ngày gần đây → Tabs panel theo trạng thái (?status=) → FilterBar (?q=) + một menu
// Thao tác ▾ cho hàng đã chọn / cả tab / mọi tài liệu → DataTable tài liệu (tiêu đề là link /kb?source=…&doc=…) →
// phân trang (?page=). Phản hồi bằng toast().
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useDebounced, useFetch } from '../../hooks'
import { dateTime, DOC_STATUS, num, totalTime } from '../../format'
import { ErrorBox, Pagination, Stat } from '../../components/ui'
import { Tabs } from '../../components/Tabs'
import { FilterBar, SearchField } from '../../components/FilterBar'
import { DataTable } from '../../components/DataTable'
import { ActionMenu } from '../../components/ActionMenu'
import { StatusBadge } from '../../components/StatusBadge'
import { Notice } from '../../components/Notice'
import { confirmDialog } from '../../components/dialog'
import { toast } from '../../components/toast'
import { useUrlState } from '../../urlState'
import LaneQueue from './LaneQueue'
import { KindIcon, kindLabel } from './shared'

const TABS = [
  { id: 'pending,processing', label: 'Hàng chờ AI', count: (c) => c.pending + c.processing },
  { id: 'paused', label: 'Đã dừng', count: (c) => c.paused },
  { id: 'error', label: 'Lỗi', count: (c) => c.error },
  { id: 'grouping', label: 'Đang tổng hợp', count: (c) => c.grouping },
  { id: 'skipped', label: 'Chỉ chuyển chữ', count: (c) => c.skipped },
  { id: 'done', label: 'Đã vào VCWIKI', count: (c) => c.done },
  { id: 'all', label: 'Tất cả', count: (c) => Object.values(c).reduce((a, b) => a + b, 0) },
]
// thứ tự các đoạn trên dải tiến độ tổng — màu ở CSS theo data-k (token)
const SEGMENTS = ['done', 'grouping', 'processing', 'pending', 'paused', 'error', 'skipped']
const SYNTH_ACTIVE = ['queued', 'triaging', 'clustering', 'planned', 'synthesizing']
// thao tác hàng loạt được phép theo tab
const ACTIONS = {
  'pending,processing': ['pause', 'top', 'untop', 'skip'],
  paused: ['resume', 'skip'],
  error: ['queue', 'skip'],
  skipped: ['queue', 'top'],
  done: ['queue'],
  grouping: [],
  all: [],
}
const ACTION_LABEL = {
  queue: 'Đưa vào hàng chờ AI',
  skip: 'Bỏ qua (không dựng thẻ)',
  top: 'Ưu tiên',
  untop: 'Bỏ ưu tiên',
  pause: 'Ngừng tinh chế',
  resume: 'Chạy tiếp',
}
const SCHEMA = {
  status: { default: 'pending,processing', values: TABS.map((t) => t.id) },
  q: { default: '' }, page: { type: 'number', default: 1 },
}

export default function RefineSummary({ spaceId }) {
  const [st, set] = useUrlState(SCHEMA)
  const tab = st.status
  const [draft, setDraft] = useState(st.q)
  useEffect(() => setDraft(st.q), [st.q])
  const dq = useDebounced(draft)
  useEffect(() => { if (dq !== st.q) set({ q: dq, page: 1 }) }, [dq]) // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState(new Set())
  const [updatedAt, setUpdatedAt] = useState(null)

  const apiStatus = tab === 'all' ? '' : tab
  const { data: s, error, reload: reloadSummary } = useFetch(() => api.refineSummary({ space_id: spaceId }), [spaceId], 5000)
  const { data: list, error: listError, loading, reload: reloadList } = useFetch(
    () => api.refineDocuments({ status: apiStatus, space_id: spaceId, q: st.q, page: st.page, page_size: 30 }), [apiStatus, spaceId, st.q, st.page], 5000)
  useEffect(() => { if (s) setUpdatedAt(new Date()) }, [s])
  useEffect(() => setPicked(new Set()), [tab, spaceId, st.q])

  const reload = () => { reloadList(); reloadSummary() }
  const items = list?.items || []
  const editableIds = new Set(items.filter((d) => d.can_edit).map((d) => d.id))
  const chosen = [...picked].filter((id) => editableIds.has(id))

  const bulk = async (action) => {
    const all = !chosen.length
    const scope = all ? `mọi tài liệu trong tab (${num(list?.total || 0)})` : `${chosen.length} tài liệu đã chọn`
    const warn = action === 'queue' && tab === 'done' ? 'Thẻ nháp AI cũ sẽ được thay bằng thẻ dựng lại; thẻ đã duyệt giữ nguyên.' : ''
    if (!(await confirmDialog({
      title: `${ACTION_LABEL[action]} — ${scope}?`,
      body: warn,
      okLabel: ACTION_LABEL[action],
      danger: action === 'skip' || (action === 'queue' && tab === 'done'),
    }))) return
    try {
      const body = all ? { action, status: apiStatus, space_id: spaceId || null, q: st.q } : { action, ids: chosen, space_id: spaceId || null }
      const r = await api.refineBulk(body)
      toast(`Đã cập nhật ${num(r.changed)} tài liệu`)
      setPicked(new Set())
      reload()
    } catch (e) {
      toast(e.message, { tone: 'error' })
    }
  }

  // Ngừng / chạy tiếp tinh chế mọi tài liệu khớp kho + ô tìm (không theo tab): đếm trước, xác nhận rồi mới làm.
  // Tài liệu "Đã dừng" ra khỏi hàng Chờ AI nên cả máy chủ lẫn AI bên ngoài (Claude qua MCP) đều không nhận.
  const pauseAll = async (action) => {
    try {
      const body = { action, status: '', space_id: spaceId || null, q: st.q }
      const n = await api.refineBulk({ ...body, dry_run: true })
      if (!n.count) {
        toast(action === 'pause' ? 'Không có tài liệu nào đang chờ AI' : 'Không có tài liệu nào đã dừng')
        return
      }
      const ask = action === 'pause'
        ? {
          title: `Ngừng tinh chế ${num(n.count)} tài liệu đang chờ AI?`,
          body: 'Máy chủ và AI bên ngoài (Claude qua MCP) sẽ không nhận các tài liệu này nữa.'
            + (n.processing ? `\n${num(n.processing)} tài liệu AI đang đọc dở sẽ làm nốt.` : '')
            + '\nTài liệu mới chuyển chữ sau này vẫn vào hàng chờ như thường.',
          okLabel: 'Ngừng tinh chế',
          danger: true,
        }
        : {
          title: `Chạy tiếp tinh chế ${num(n.count)} tài liệu đã dừng?`,
          body: 'Tài liệu về hàng Chờ AI. Phiên Claude bên ngoài (ai_refine.sh) đã tự thoát khi hết hàng chờ thì cần chạy lại.',
          okLabel: 'Chạy tiếp',
        }
      if (!(await confirmDialog(ask))) return
      const r = await api.refineBulk(body)
      toast(`${action === 'pause' ? 'Đã ngừng tinh chế' : 'Đã chạy tiếp tinh chế'} ${num(r.changed)} tài liệu`)
      reload()
    } catch (e) {
      toast(e.message, { tone: 'error' })
    }
  }

  const tabActions = s?.can_edit && list?.total ? (ACTIONS[tab] || []) : []
  const menu = [
    ...tabActions.map((a) => ({ label: `${ACTION_LABEL[a]} — ${chosen.length ? `${chosen.length} tài liệu đã chọn` : 'cả tab'}`, onSelect: () => bulk(a),
      testId: `refine-bulk-${a}` })),
    s?.can_edit && { label: 'Chạy tiếp mọi tài liệu đã dừng', icon: 'play', disabled: !s.counts.paused, onSelect: () => pauseAll('resume'), testId: 'refine-all-resume' },
    s?.can_edit && { label: 'Ngừng tinh chế mọi tài liệu chờ AI', icon: 'stop', disabled: !s.counts.pending, onSelect: () => pauseAll('pause'), testId: 'refine-all-pause' },
  ].filter(Boolean)

  const tabLabel = TABS.find((t) => t.id === tab)?.label
  const columns = [
    { key: 'title', header: 'Tài liệu', title: true, render: (d) => (
      <div className="kb-refine-doc">
        <Link className="ui-title-link" to={`/kb?source=${d.source.id}&doc=${d.id}`} data-testid="refine-doc-open">
          {d.priority > 0 && ['pending', 'processing'].includes(d.wiki_status) && <span className="ui-badge" data-tone="warn">Ưu tiên</span>} {d.title}
        </Link>
        <Link to={`/kb?source=${d.source.id}`} className="muted small ellipsis refine-src" aria-label={`Mở nguồn: ${d.source.title}`}>
          <KindIcon kind={d.source.kind} /> <span className="sr-only">{kindLabel(d.source.kind)}: </span>{d.source.title}
        </Link>
        {d.wiki_error && <div className="tone-bad small clamp-2">{d.wiki_error}</div>}
      </div>
    ) },
    { key: 'space', header: 'Kho', className: 'small', render: (d) => d.space_name },
    { key: 'status', header: 'Trạng thái', render: (d) => <StatusBadge kind="doc" status={d.wiki_status} /> },
    { key: 'chars', header: 'Độ dài', className: 'num small', render: (d) => num(d.chars) },
    { key: 'cards', header: 'Thẻ', className: 'num', render: (d) => (d.wiki_status === 'done' ? num(d.card_count ?? 0) : '—') },
    { key: 'rel', header: 'Hữu ích', className: 'num', render: (d) => (d.relevance != null ? `${d.relevance}/10` : '—') },
    { key: 'ai', header: 'AI tinh chế', className: 'small', render: (d) => (d.refined_by
      ? <><div className="nowrap">{d.refined_by.label}</div>{d.refined_by.model && <div className="muted nowrap">{d.refined_by.model}</div>}</> : '—') },
    { key: 'at', header: tab === 'done' ? 'Xong lúc' : 'Nạp lúc', className: 'small nowrap', render: (d) => dateTime(tab === 'done' ? d.wiki_at : d.created_at) },
  ]

  const panel = (
    <>
      <div className="kb-filterrow">
        <FilterBar label="Lọc tài liệu" count={list?.total} unit="tài liệu" active={!!st.q} onClear={() => { setDraft(''); set({ q: '', page: 1 }) }}
          testId="refine-filter">
          <SearchField label="Tìm theo tên tài liệu" value={draft} onChange={setDraft} placeholder="Tìm theo tên tài liệu…" testId="refine-q" />
        </FilterBar>
        {menu.length > 0 && (
          <ActionMenu label="Thao tác" ariaLabel={`Thao tác hàng loạt — tab ${tabLabel}`} items={menu} testId="refine-actions" />
        )}
      </div>
      <DataTable caption={`Tài liệu ở tab ${tabLabel}`} testId="refine-docs-table" rows={items} columns={columns}
        getStatus={(d) => d.wiki_status} getKind={(d) => d.source.kind} loading={loading && !list} error={listError} onRetry={reloadList}
        selection={tabActions.length ? { selected: picked, onChange: setPicked } : undefined}
        empty={st.q ? 'Không có tài liệu khớp.' : 'Không có tài liệu nào ở trạng thái này.'} />
      {list && <Pagination page={st.page} pageSize={30} total={list.total} unit="tài liệu" onPage={(p) => set({ page: p }, { push: true })} />}
    </>
  )

  return (
    <div className="kb-stack">
      <ErrorBox onRetry={reloadSummary}>{error && `Không tải được tiến độ: ${error}`}</ErrorBox>
      {s && !s.ai.ready && (
        <Notice tone="warn" title="AI chưa sẵn sàng:" testId="refine-ai-banner">
          {s.ai.error}. Dựng thẻ và tổng hợp theo cụm đều tạm dừng — tài liệu nằm ở “Chờ AI”, lượt tổng hợp nằm ở “Chờ chạy” cho tới khi cấu hình xong.
        </Notice>
      )}
      {updatedAt && <p className="muted small kb-updated" aria-live="off">Cập nhật lúc {updatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · tự làm mới mỗi 5 giây</p>}
      {s && <Overview s={s} />}
      <LaneQueue />
      {s && <PerDay days={s.per_day} />}
      <Tabs kind="panel" label="Lọc tài liệu theo trạng thái tinh chế" value={tab} onChange={(v) => set({ status: v, page: 1 }, { push: true })}
        testId="refine-tabs" items={TABS.map((t) => ({ id: t.id, label: t.label, count: s ? num(t.count(s.counts)) : undefined,
          testId: `refine-tab-${t.id === 'pending,processing' ? 'queue' : t.id}`, content: t.id === tab ? panel : null }))} />
    </div>
  )
}

function Overview({ s }) {
  const c = s.counts
  const target = s.total - c.skipped          // tài liệu đã bật dựng thẻ
  const pct = target ? Math.round((c.done / target) * 100) : 0
  const queue = c.pending + c.processing
  return (
    <>
      <section className="stats stats-6" aria-label="Tổng quan tinh chế" data-testid="refine-stats">
        <Stat label="Đã vào VCWIKI" value={`${pct}%`} hint={`${num(c.done)}/${num(target)} tài liệu cần tinh chế`} />
        <Stat label="Hàng chờ AI" value={num(queue)} hint={c.processing ? `${num(c.processing)} đang đọc` : 'chưa có tài liệu nào đang đọc'} />
        <Stat label="Đang tổng hợp theo cụm" value={num(c.grouping)} hint={`${s.synth_runs.filter((r) => SYNTH_ACTIVE.includes(r.status)).length} lượt tổng hợp đang chạy`} />
        <Stat label="Lỗi AI" value={num(c.error)} hint={c.error ? 'mở tab Lỗi để dựng lại' : 'không có'} />
        <Stat label="Tốc độ" value={s.rate_per_hour ? `${num(s.rate_per_hour)}/giờ` : '—'}
          hint={s.eta_seconds ? `xong hàng chờ sau ~${totalTime(s.eta_seconds)}` : s.rate_per_hour ? 'hàng chờ trống' : 'AI không chạy trong 30 phút qua'} />
        <Stat label="Thẻ nháp chờ duyệt" value={<Link to="/wiki?status=draft" className="link">{num(s.draft_cards)}</Link>} hint="thẻ AI tạo, cần người duyệt" />
      </section>
      <section className="card refine-bar-card" aria-label="Dải trạng thái tinh chế">
        <div className="refine-bar" role="img" aria-label={`${pct}% tài liệu đã vào VCWIKI`}>
          {SEGMENTS.map((k) => c[k] > 0 && (
            <div key={k} className="kb-seg" data-k={k} style={{ flexGrow: c[k] }} title={`${DOC_STATUS[k].label}: ${num(c[k])}`} />
          ))}
        </div>
        <ul className="refine-legend">
          {SEGMENTS.map((k) => (
            <li key={k}><i className="kb-seg" data-k={k} aria-hidden="true" />{DOC_STATUS[k].label} <b>{num(c[k])}</b></li>
          ))}
        </ul>
      </section>
    </>
  )
}

// số tài liệu vào VCWIKI mỗi ngày, 14 ngày gần nhất (kể cả ngày không có)
function PerDay({ days }) {
  const byDay = Object.fromEntries(days.map((d) => [d.day, d]))
  const fmt = (dt) => dt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
  const rows = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(Date.now() - (13 - i) * 86400000)
    return byDay[fmt(dt)] || { day: fmt(dt), docs: 0, cards: 0, input_tokens: 0, output_tokens: 0 }
  })
  const max = Math.max(1, ...rows.map((r) => r.docs))
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0)
  const tokens = sum('input_tokens') + sum('output_tokens')
  return (
    <section className="card" aria-labelledby="refine-days-title">
      <div className="card-head">
        <h2 id="refine-days-title">14 ngày gần đây</h2>
        <span className="muted small">{num(sum('docs'))} tài liệu · {num(sum('cards'))} thẻ{tokens ? ` · ${num(tokens)} token` : ''}</span>
      </div>
      <div className="refine-days" role="img" aria-label={`14 ngày gần đây: ${num(sum('docs'))} tài liệu vào VCWIKI`}>
        {rows.map((r) => (
          <div key={r.day} className="refine-day" title={`${r.day}: ${num(r.docs)} tài liệu, ${num(r.cards)} thẻ`}>
            <div className="refine-day-val">{r.docs ? num(r.docs) : ''}</div>
            <div className="refine-day-bar"><div style={{ height: `${(r.docs / max) * 100}%` }} /></div>
            <div className="refine-day-label">{r.day.slice(8)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
