// Tab «Nguồn» của Kho tư liệu (SCR-03, TPL-A): băng AI chỉ khi cần → FilterBar (Theo tên / Theo nội dung, tìm, Kho,
// Loại có đếm, Trạng thái, Lĩnh vực, Của tôi, số kết quả, Xoá lọc) + menu Thao tác ▾ → DataTable (tiêu đề là link
// ?source=<id>, không bấm hàng) → phân trang. Mọi lọc + trang trên URL: ?space_id=&kind=&status=&category=&q=&mode=
// &page=&mine=1 (+ ?failed=1 mở khung Video lỗi). Chi tiết nguồn = ngăn kéo ?source= (SourceDetail).
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useDebounced, useFetch } from '../../hooks'
import { dateTime, num, SOURCE_KIND } from '../../format'
import { Pagination } from '../../components/ui'
import { FilterBar, FilterChip, SearchField, SelectField } from '../../components/FilterBar'
import { DataTable } from '../../components/DataTable'
import { ActionMenu } from '../../components/ActionMenu'
import { Segmented } from '../../components/Segmented'
import { Notice } from '../../components/Notice'
import { confirmDialog } from '../../components/dialog'
import { toast } from '../../components/toast'
import { CategoryChips, spaceLabel } from '../../components/pickers'
import ContentSearch from '../../components/ContentSearch'
import { startParam, withOpen } from '../../contentSearch'
import { useUrlState } from '../../urlState'
import { STATUSES } from '../../statuses'
import { ACTIVE, KB_CHANGED, KindIcon, kindLabel, QueueInfo, SourceProgress, SourceStatusBadge, sourceName } from './shared'
import FailedVideos from './FailedVideos'
import SourceDetail from './SourceDetail'

const PAGE_SIZE = 30
export const SOURCES_SCHEMA = {
  space_id: { default: '' }, kind: { default: '' }, status: { default: '' }, category: { default: '' }, q: { default: '' },
  mode: { default: '', values: ['', 'content'] }, page: { type: 'number', default: 1 }, mine: { type: 'bool' }, failed: { type: 'bool' },
}

// Băng AI (AiJobBanner): chỉ hiện khi AI chưa sẵn sàng hoặc đang chạy dự phòng
function AiBanner({ ai }) {
  if (!ai) return null
  if (!ai.ready) {
    return (
      <Notice tone="warn" title="AI chưa sẵn sàng:" testId="kb-ai-banner">
        {ai.error}. Nguồn vẫn được chuyển thành chữ (ảnh và PDF scan dùng OCR Tesseract thay cho Claude); bước dựng thẻ sẽ tự
        chạy khi máy chủ có <code>ANTHROPIC_API_KEY</code>.
      </Notice>
    )
  }
  if (!ai.claude_paused) return null
  return (
    <Notice tone="info" testId="kb-ai-banner"
      title={ai.cli?.first ? 'Đang chạy bằng Claude Code CLI (tài khoản Claude trên máy):' : `Đang chạy bằng AI local (${ai.local.model}):`}>
      {ai.claude_paused.reason}.
      {ai.cli?.first && ` CLI lỗi thì AI local (${ai.local.model}) làm thay.`}
      {ai.claude_paused.until && ` Thử lại Claude lúc ${new Date(ai.claude_paused.until * 1000).toLocaleTimeString('vi-VN')}.`}
      {' '}Việc cần đọc ảnh / PDF scan dùng OCR Tesseract.
    </Notice>
  )
}

export default function Sources() {
  const { data: status } = useFetch(api.kbStatus, [])
  const { data: spaces } = useFetch(api.spaces, [])
  const { data: cats } = useFetch(api.categories, [])
  const [params, setParams] = useSearchParams()
  const [st, set] = useUrlState(SOURCES_SCHEMA)
  const content = st.mode === 'content'
  const openId = params.get('source')
  const openDocId = params.get('doc')
  const openAt = startParam(params.get('t'))

  // Ô tìm: theo tên thì lọc sau khi ngừng gõ (replace); theo nội dung thì bấm Tìm / Enter (push — Quay lại về câu trước)
  const [draft, setDraft] = useState(st.q)
  useEffect(() => setDraft(st.q), [st.q])
  const dq = useDebounced(draft)
  useEffect(() => { if (!content && dq !== st.q) set({ q: dq, page: 1 }) }, [dq]) // eslint-disable-line react-hooks/exhaustive-deps
  const submitContent = (e) => {
    e?.preventDefault()
    const q = draft.trim()
    if (q && q !== st.q) set({ q }, { push: true })
  }
  const setMode = (m) => {
    if ((m === 'content') === content) return
    set({ mode: m, q: draft.trim(), page: 1 })   // mang chữ đang gõ sang chế độ kia cho đỡ gõ lại
  }

  const query = { space_id: st.space_id, kind: st.kind, status: st.status, category: st.category, q: content ? '' : st.q,
    mine: st.mine ? 1 : '', page: st.page, page_size: PAGE_SIZE }
  const [interval, setInterval_] = useState(0)
  const { data, error, loading, reload } = useFetch(() => (content ? Promise.resolve(null) : api.sources(query)),
    [content, JSON.stringify(query)], interval)
  useEffect(() => setInterval_(data?.items.some((s) => ACTIVE.includes(s.overall)) ? 3000 : 0), [data])
  useEffect(() => {
    window.addEventListener(KB_CHANGED, reload)
    return () => window.removeEventListener(KB_CHANGED, reload)
  }, [reload])

  const f = (k) => (v) => set({ [k]: v, page: 1 })
  const filtered = !!(st.space_id || st.kind || st.status || st.category || st.q || st.mine)
  const clear = () => { setDraft(''); set({ space_id: '', kind: '', status: '', category: '', q: '', mine: false, page: 1 }) }
  const closeSource = () => {
    const p = withOpen(params, null)
    p.delete('stab')
    setParams(p)
  }

  // Thao tác hàng loạt theo bộ lọc đang xem: đếm trước (dry_run), xác nhận rồi mới làm
  const [busy, setBusy] = useState(false)
  const bulkFilter = () => ({ space_id: st.space_id, kind: st.kind, q: content ? '' : st.q, category: st.category, status: st.status,
    ...(st.mine ? { mine: 1 } : {}) })
  const runBulk = async (fn) => {
    setBusy(true)
    try { await fn() } catch (e) { toast(e.message, { tone: 'error' }) }
    setBusy(false)
  }
  const resumeAll = () => runBulk(async () => {
    const fl = bulkFilter()
    const n = await api.resumeAllSources({ ...fl, dry_run: true })
    if (!n.cancelled && !n.error && !n.failed_videos) {
      toast('Không có nguồn nào đã dừng hay video lỗi cần lấy lại chữ trong bộ lọc này'
        + (n.failed_exhausted ? ` (${n.failed_exhausted} video đã lỗi ≥${n.max_auto_retry} lần hoặc không thể lấy như chỉ dành cho hội viên / đã gỡ — xem «Xem video lỗi mọi kênh»)` : ''))
      return
    }
    if (!(await confirmDialog({
      title: 'Chạy tiếp theo bộ lọc đang xem?',
      okLabel: 'Chạy tiếp',
      body: `• ${n.cancelled} nguồn Đã dừng`
        + (n.error ? `\n• ${n.error} nguồn Lỗi — chạy lại` : '')
        + `\n• ${n.failed_videos} video lỗi trong các kênh — lấy lại chữ sau khi xong các nguồn mới`
        + (n.failed_exhausted ? `\n  (bỏ qua ${n.failed_exhausted} video đã lỗi ≥${n.max_auto_retry} lần hoặc chỉ dành cho hội viên / đã gỡ — lấy lại thủ công nếu cần)` : '')
        + '\n\nCác nguồn về hàng chờ theo thứ tự nạp; kênh chạy tiếp, video đã có được bỏ qua.',
    }))) return
    await api.resumeAllSources(fl)
    toast('Đã chạy tiếp các nguồn đang lọc')
    reload()
  })
  const stopAll = () => runBulk(async () => {
    const fl = bulkFilter()
    const n = await api.stopAllSources({ ...fl, dry_run: true })
    if (!n.running && !n.queued && !n.redo) {
      toast('Không có nguồn nào đang lấy chữ trong bộ lọc này')
      return
    }
    if (!(await confirmDialog({
      title: 'Ngừng lấy chữ theo bộ lọc đang xem?',
      okLabel: 'Ngừng lấy chữ',
      danger: true,
      body: `• ${n.running} nguồn đang chạy — dừng sau mục hiện tại\n`
        + `• ${n.queued} nguồn đang chờ — chuyển sang Đã dừng\n• ${n.redo} video chờ lấy lại chữ — bỏ khỏi hàng chờ\n\n`
        + 'Muốn chạy lại thì chọn «Chạy tiếp tất cả nguồn đang lọc» hoặc mở từng nguồn, bấm «Chạy tiếp».',
    }))) return
    await api.stopAllSources(fl)
    toast('Đã ngừng lấy chữ các nguồn đang lọc')
    reload()
  })

  const kinds = data?.kinds || {}
  const allCount = Object.values(kinds).reduce((a, b) => a + b, 0)
  const kindOptions = [{ value: '', label: `Tất cả (${num(allCount)})` },
    ...Object.entries(SOURCE_KIND).filter(([k]) => kinds[k] || st.kind === k).map(([k, v]) => ({ value: k, label: `${v.label} (${num(kinds[k] || 0)})` }))]
  const hrefOf = (id, doc = null, t = null) => `?${withOpen(params, id, doc, t)}`

  const columns = [
    { key: 'title', header: 'Nguồn', title: true, render: (s) => (
      <>
        <Link to={hrefOf(s.id)} className="ui-title-link" data-testid="kb-source-open">{sourceName(s)}</Link>
        {s.url && (s.title || s.platform) && (
          <div className="muted small ellipsis">{s.platform ? `${s.platform} · ` : ''}{s.title ? s.url : ''}</div>
        )}
        <div className="meta">
          {s.options?.build_wiki === false && <span className="tag">chỉ chuyển chữ</span>}
          <CategoryChips cats={cats} value={s.categories} />
          {s.tags?.map((t) => <span key={t} className="tag">#{t}</span>)}
        </div>
      </>
    ) },
    { key: 'kind', header: 'Loại', className: 'nowrap small', render: (s) => <span className="kb-kind"><KindIcon kind={s.kind} />{kindLabel(s.kind)}</span> },
    { key: 'space', header: 'Kho', className: 'small', render: (s) => <>{s.space_name}<div className="muted">{s.created_by_name}</div></> },
    { key: 'status', header: 'Trạng thái', render: (s) => (
      <>
        <SourceStatusBadge s={s.overall} />
        <SourceProgress s={s} />
        <QueueInfo s={s} />
        {s.error && <div className="tone-bad small clamp-2">{s.error}</div>}
      </>
    ) },
    { key: 'docs', header: 'Tài liệu', className: 'num', render: (s) => num(s.docs.total) },
    { key: 'cards', header: 'Thẻ', className: 'num strong', render: (s) => num(s.card_count) },
    { key: 'created', header: 'Nạp lúc', className: 'nowrap small', render: (s) => dateTime(s.created_at) },
  ]

  return (
    <div className="kb-stack">
      <AiBanner ai={status?.ai} />
      <div className="kb-filterrow">
        <FilterBar label="Lọc nguồn" count={content ? null : data?.total} unit="nguồn" active={filtered} onClear={clear} testId="kb-sources-filter">
          <Segmented label="Tìm theo" value={content ? 'content' : ''} onChange={setMode} testId="kb-search-mode" options={[
            { value: '', label: 'Theo tên' }, { value: 'content', label: 'Theo nội dung' }]} />
          {content ? (
            <span className="kb-content-search">
              <SearchField label="Tìm theo nội dung" value={draft} onChange={setDraft} testId="kb-content-q"
                placeholder="Hỏi hoặc gõ cụm từ trong nội dung, vd: bao lâu thay dầu hộp số…" />
              <button type="submit" className="ui-btn ui-btn-primary" disabled={!draft.trim()} onClick={submitContent}
                data-testid="kb-content-submit">Tìm</button>
            </span>
          ) : (
            <SearchField label="Lọc nguồn theo tên, link, tag" value={draft} onChange={setDraft} placeholder="Tìm theo tên, link, tag…"
              testId="kb-sources-q" />
          )}
          <SelectField label="Kho" value={st.space_id} onChange={f('space_id')} testId="kb-filter-space"
            options={[{ value: '', label: 'Tất cả kho tôi xem được' }, ...(spaces || []).map((s) => ({ value: s.id, label: spaceLabel(s) }))]} />
          {!content && <>
            <SelectField label="Loại" value={st.kind} onChange={f('kind')} options={kindOptions} testId="kb-filter-kind" />
            <SelectField label="Trạng thái" value={st.status} onChange={f('status')} testId="kb-filter-status"
              options={Object.entries(STATUSES.kbSourceFilter).map(([value, x]) => ({ value, label: x.label }))} />
            <SelectField label="Lĩnh vực" value={st.category} onChange={f('category')} testId="kb-filter-category"
              options={[{ value: '', label: 'Mọi lĩnh vực' }, ...(cats || []).map((c) => ({ value: c.slug, label: `${c.level > 1 ? '　' : ''}${c.name}` }))]} />
            <FilterChip pressed={st.mine} onClick={() => set({ mine: !st.mine, page: 1 })} testId="kb-filter-mine">Của tôi</FilterChip>
          </>}
        </FilterBar>
        {!content && (
          <ActionMenu label="Thao tác" ariaLabel="Thao tác hàng loạt với các nguồn đang lọc" testId="kb-sources-actions" items={[
            { label: 'Ngừng lấy chữ các nguồn đang lọc', icon: 'stop', disabled: busy, onSelect: stopAll, testId: 'kb-sources-stop' },
            { label: 'Chạy tiếp tất cả nguồn đang lọc', icon: 'play', disabled: busy, onSelect: resumeAll, testId: 'kb-sources-resume' },
            { label: st.failed ? 'Ẩn video lỗi mọi kênh' : 'Xem video lỗi mọi kênh', icon: 'alert', testId: 'kb-sources-failed',
              onSelect: () => set({ failed: !st.failed }, { push: true }) },
          ]} />
        )}
      </div>
      {st.failed && !content && <FailedVideos spaceId={st.space_id} q={st.q} category={st.category} />}
      {content ? (
        <ContentSearch q={st.q} spaceId={st.space_id} hrefOf={hrefOf} onByName={() => setMode('')} />
      ) : (
        <>
          <DataTable caption="Danh sách nguồn trong Kho tư liệu — bấm tên nguồn để xem chi tiết" testId="kb-sources-table"
            rows={data?.items} columns={columns} getStatus={(s) => s.overall} getKind={(s) => s.kind} rowName={sourceName}
            current={openId || undefined} loading={loading && !data} error={error} onRetry={reload}
            empty={filtered
              ? <>Không có nguồn nào khớp bộ lọc. <button type="button" className="link" onClick={clear}>Xoá lọc</button></>
              : <>Chưa có nguồn nào trong kho. <Link className="link" to="?add=1" data-testid="kb-empty-add">Nạp nguồn đầu tiên</Link></>} />
          {data && <Pagination page={st.page} pageSize={PAGE_SIZE} total={data.total} unit="nguồn" onPage={(p) => set({ page: p }, { push: true })} />}
        </>
      )}
      {openId && cats && (
        <SourceDetail key={`${openId}|${openDocId}|${openAt}`} id={openId} docId={openDocId} startAt={openAt}
          cats={cats} onClose={closeSource} onChanged={reload} />
      )}
    </div>
  )
}
