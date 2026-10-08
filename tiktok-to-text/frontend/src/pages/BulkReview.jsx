// Duyệt hàng loạt thẻ nháp — tab *Duyệt hàng loạt* của Hộp duyệt (GOV-12, yêu cầu …d817e mục B — backend/app/kb/bulk_review.py;
// DESIGN SCR-09). Bộ lọc nằm trên URL và tự tải khi đổi (?cat= ?level= ?division= ?type= ?q= ?low= ?unsorted= ?noise=
// ?pending=, link lọc sẵn ?ids=); nhãn tiếng Việt thay slug / mã lý do (statuses.js khối SCR-09); tiêu đề thẻ là link
// mở ?change= (mở tab mới được); chọn nhiều → thanh "Đã chọn N" → **Duyệt N thẻ** / Từ chối N thẻ (một nhận xét chung).
// Mỗi thẻ đi đúng đường duyệt đơn lẻ (bốn mắt, số người duyệt tối thiểu, ghi phiên bản); server tự kiểm lại từng thẻ.
import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useDebounced, useFetch } from '../hooks'
import { useUrlState } from '../urlState'
import { CARD_LEVEL, CARD_TYPE, DIVISION } from '../format'
import { confirmDialog } from '../components/dialog'
import { toast } from '../components/toast'
import { Notice } from '../components/Notice'
import { DataTable } from '../components/DataTable'
import { FilterBar, FilterChip, SearchField, SelectField } from '../components/FilterBar'
import { STATUSES, statusInfo } from '../statuses'

const AI_TYPES = ['skill', 'memory', 'context']
const SCHEMA = {
  ids: { default: '' }, cat: { default: '' }, level: { default: '' }, division: { default: '' }, type: { default: '' },
  q: { default: '' }, low: { type: 'bool' }, unsorted: { type: 'bool' }, noise: { type: 'bool' }, pending: { type: 'bool' },
}
// Tham số URL của tab này — Hộp duyệt xoá khi đổi sang tab khác
export const BULK_KEYS = Object.keys(SCHEMA)

const tagLabel = (t) => STATUSES.bulkTag[t]?.label || 'tag hệ thống'
const skipLabel = (r) => STATUSES.bulkSkip[r]?.label || r   // lý do BE ngoài bảng đã là câu tiếng Việt
const changeHref = (i) => (i.change_id ? `/wiki/review?tab=all&change=${i.change_id}` : `/wiki?card=${i.id}`)
const countBy = (list) => Object.entries(list.reduce((m, s) => ({ ...m, [s.reason]: (m[s.reason] || 0) + 1 }), {}))

export default function BulkReview() {
  const [st, set] = useUrlState(SCHEMA)
  const { data: cats } = useFetch(api.categories, [])
  const q = useDebounced(st.q)
  const fromIds = !!st.ids
  // link lọc sẵn: danh sách do người gửi chọn → bật sẵn duyệt thẻ chưa qua cổng so sánh + gộp thẻ độ tin cậy thấp /
  // chưa xếp cây (không để thẻ trong link bị ẩn mất)
  const body = useMemo(() => Object.fromEntries(Object.entries({
    ids: st.ids, category: st.cat, level: st.level, division: st.division, type: st.type, q,
    include_low_confidence: st.low || fromIds, include_unsorted: st.unsorted || fromIds,
    include_noise_duplicate: st.noise, include_pending_novelty: st.pending || fromIds,
  }).filter(([, v]) => v !== '' && v !== false)), [st.ids, st.cat, st.level, st.division, st.type, q, st.low, st.unsorted, st.noise, st.pending, fromIds])
  const bodyKey = JSON.stringify(body)
  const preview = useFetch(() => api.bulkReviewPreview(body), [bodyKey])
  const data = preview.data
  const eligible = useMemo(() => (data?.items || []).filter((i) => !i.skip), [data])
  const skippedItems = (data?.items || []).filter((i) => i.skip)
  const [picked, setPicked] = useState(new Set())
  useEffect(() => { setPicked(new Set(eligible.map((i) => i.id))) }, [eligible])
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)       // null | 'approve' | 'reject'
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState(null)
  const errId = useId()

  const catName = useMemo(() => Object.fromEntries((cats || []).map((c) => [c.slug, c.name])), [cats])
  const catOptions = useMemo(() => [{ value: '', label: 'Tất cả' }, ...[...(cats || [])].sort((a, b) => a.slug.localeCompare(b.slug))
    .map((c) => ({ value: c.slug, label: `${'· '.repeat(c.slug.split('.').length - 1)}${c.name}` }))], [cats])
  const filtering = !!(st.cat || st.level || st.division || st.type || st.q || st.low || st.unsorted || st.noise || st.pending || st.ids)

  const run = async (decision) => {
    const ids = [...picked]
    if (!ids.length || !data) return
    if (decision === 'reject' && !comment.trim()) { setError('Từ chối cần ghi lý do — một nhận xét chung cho cả lượt.'); return }
    setError(null)
    const verb = decision === 'approve' ? 'Duyệt' : 'Từ chối'
    if (!(await confirmDialog({ title: `${verb} ${ids.length} thẻ?`, okLabel: `${verb} ${ids.length} thẻ`, danger: decision === 'reject' }))) return
    setBusy(decision); setResult(null)
    const done = [], skipped = []
    try {
      for (let i = 0; i < ids.length; i += data.max_per_call) {
        setProgress(`${i} / ${ids.length}`)
        const r = await api.bulkReviewDecide({ ...body, card_ids: ids.slice(i, i + data.max_per_call), decision, comment })
        done.push(...r.done); skipped.push(...r.skipped)
      }
    } catch (e) { toast(`Không ${verb.toLowerCase()} hết được: ${e.message}`, { tone: 'error' }) }
    setProgress(''); setBusy(null)
    const half = decision === 'approve' ? done.filter((d) => d.status === 'open').length : 0
    toast(`${decision === 'approve' ? 'Đã duyệt' : 'Đã từ chối'} ${done.length} thẻ${half ? ` (${half} thẻ mới xong bước 1, chờ bước 2)` : ''}${skipped.length ? ` · bỏ qua ${skipped.length}` : ''}`)
    setResult({ decision, done, skipped })
    if (done.length) setComment('')
    preview.reload()
  }

  const columns = [
    { key: 'title', header: 'Thẻ', title: true, to: changeHref },
    { key: 'type', header: 'Loại', render: (i) => CARD_TYPE[i.type] || i.type },
    { key: 'level', header: 'Bậc', render: (i) => (i.level ? CARD_LEVEL[i.level] || i.level : '—') },
    { key: 'cats', header: 'Lĩnh vực', render: (i) => i.categories.map((s) => catName[s] || s).join(' · ') || '—' },
    { key: 'verdict', header: 'Cổng so sánh', render: (i) => (i.verdict ? statusInfo('novelty', i.verdict).label : 'Chưa có') },
  ]
  const n = picked.size
  const bulkBar = (
    <>
      <span className="bulk-comment">
        <label htmlFor={`${errId}-c`} className="sr-only">Nhận xét chung (bắt buộc khi từ chối)</label>
        <input id={`${errId}-c`} value={comment} placeholder="Nhận xét chung (bắt buộc khi từ chối)" data-testid="bulk-review-comment"
          onChange={(e) => { setComment(e.target.value); if (error) setError(null) }}
          aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} />
      </span>
      <button type="button" className="ui-btn ui-btn-sm" data-testid="bulk-review-reject" disabled={!n || !!busy} onClick={() => run('reject')}>
        {busy === 'reject' ? `Đang từ chối ${progress}` : `Từ chối ${n} thẻ`}
      </button>
      <button type="button" className="ui-btn ui-btn-sm ui-btn-primary" data-testid="bulk-review-approve" disabled={!n || !!busy} onClick={() => run('approve')}>
        {busy === 'approve' ? `Đang duyệt ${progress}` : `Duyệt ${n} thẻ`}
      </button>
    </>
  )

  return (
    <section aria-label="Duyệt hàng loạt" className="bulk-review">
      <p className="rv-muted">
        Thẻ nháp trong các kho bạn xem được; mỗi thẻ vẫn theo luật duyệt từng thẻ (không duyệt thẻ mình là tác giả
        {data?.min_approvers === 2 ? '; đang cần 2 người duyệt nên lượt này chỉ là bước 1' : ''}). Thẻ chưa gửi duyệt được gửi rồi quyết định luôn.
      </p>
      {fromIds && (
        <Notice tone="info" testId="bulk-review-ids">
          Đang lọc theo danh sách <b>{st.ids.split(',').filter(Boolean).length}</b> thẻ (link gửi sẵn) — đã gộp cả thẻ chưa qua cổng so sánh.
        </Notice>
      )}
      <FilterBar label="Lọc thẻ nháp" count={data?.total} unit="thẻ nháp" active={filtering} testId="bulk-review-filters"
        onClear={() => set(Object.fromEntries(BULK_KEYS.map((k) => [k, SCHEMA[k].type === 'bool' ? false : ''])))}>
        <SelectField label="Nhánh (gồm nhánh con)" value={st.cat} options={catOptions} onChange={(v) => set({ cat: v })} />
        <SelectField label="Bậc" value={st.level} onChange={(v) => set({ level: v })} options={[{ value: '', label: 'Tất cả' },
          { value: 'nhap-mon,thuc-thi', label: 'Nhập môn + Thực thi' }, ...Object.entries(CARD_LEVEL).map(([value, label]) => ({ value, label }))]} />
        <SelectField label="Division" value={st.division} onChange={(v) => set({ division: v })}
          options={[{ value: '', label: 'Tất cả' }, ...Object.entries(DIVISION).map(([value, label]) => ({ value, label }))]} />
        <SelectField label="Loại" value={st.type} onChange={(v) => set({ type: v })} options={[{ value: '', label: 'Tất cả' },
          ...Object.entries(CARD_TYPE).filter(([k]) => !AI_TYPES.includes(k)).map(([value, label]) => ({ value, label }))]} />
        <SearchField label="Tìm thẻ nháp" placeholder="Tiêu đề, nội dung…" value={st.q} onChange={(v) => set({ q: v })} />
        {!fromIds && <>
          <FilterChip pressed={st.low} onClick={() => set({ low: !st.low })}>Gồm thẻ {tagLabel('xem-lai-phan-loai')}</FilterChip>
          <FilterChip pressed={st.unsorted} onClick={() => set({ unsorted: !st.unsorted })}>Gồm thẻ {tagLabel('chua-xep-v2')}</FilterChip>
          <FilterChip pressed={st.pending} onClick={() => set({ pending: !st.pending })}>Duyệt cả thẻ chưa có kết quả cổng so sánh</FilterChip>
        </>}
        <FilterChip pressed={st.noise} onClick={() => set({ noise: !st.noise })}>Gồm thẻ cổng so sánh xếp Nhiễu / Trùng</FilterChip>
      </FilterBar>

      {data && (
        <p className="rv-muted" data-testid="bulk-review-summary">
          {data.total > data.shown ? `Hiện ${data.shown} thẻ cũ nhất; ` : ''}<b>{eligible.length}</b> thẻ duyệt được.
          {Object.entries(data.tag_excluded).filter(([, k]) => k).map(([t, k]) => <span key={t}> · Đã loại {k} thẻ {tagLabel(t)}</span>)}
          {Object.entries(data.skipped).map(([r, k]) => <span key={r}> · {skipLabel(r)}: {k}</span>)}
        </p>
      )}
      {error && <p id={errId} className="rv-field-error" role="alert">{error}</p>}
      {result?.skipped.length > 0 && (
        <Notice tone="warn" testId="bulk-review-result" title={`Bỏ qua ${result.skipped.length} thẻ:`}>
          {countBy(result.skipped).map(([r, k]) => `${skipLabel(r)} (${k})`).join('; ')}.
        </Notice>
      )}
      <DataTable caption="Thẻ nháp duyệt được" columns={columns} rows={eligible} loading={preview.loading} error={preview.error}
        onRetry={preview.reload} empty="Không có thẻ nháp nào duyệt được với bộ lọc này." testId="bulk-review-table"
        selection={{ selected: picked, onChange: setPicked }} bulk={bulkBar} />
      {skippedItems.length > 0 && (
        <details className="bulk-skipped" data-testid="bulk-review-skipped">
          <summary>{skippedItems.length} thẻ khớp lọc nhưng không duyệt được</summary>
          <ul>
            {skippedItems.map((i) => (
              <li key={i.id} data-id={i.id} data-status="skip">
                <Link className="link" to={changeHref(i)}>{i.title}</Link> — <span className="rv-muted">{skipLabel(i.skip)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
