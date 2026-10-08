// Dùng chung cho các trang Học tập (docs/BA.md mục 17): nhãn trạng thái / loại câu, chọn thẻ đã duyệt.
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { useDebounced, useFetch } from '../../hooks'
import { Drawer, useUrlOverlay } from '../../components/Overlay'
import { Markdown } from '../../components/markdown'
import { Badge } from '../../components/ui'

export const QUESTION_KIND = { single: 'Một đáp án', multi: 'Nhiều đáp án', essay: 'Tự luận' }
export const BLOOM = { remember: 'Nhớ', understand: 'Hiểu', apply: 'Vận dụng', analyze: 'Phân tích' }
export const LESSON_STATUS = {
  draft: { label: 'Nháp', tone: 'warn' },
  published: { label: 'Đã phát hành', tone: 'good' },
  stale: { label: 'Cần cập nhật', tone: 'bad' },
}
export const QUESTION_STATUS = {
  draft: { label: 'Nháp', tone: 'warn' },
  approved: { label: 'Đã duyệt', tone: 'good' },
  stale: { label: 'Lỗi thời', tone: 'bad' },
}
// Mức mật (BA 15.5)
export const CLASSIFICATION = { C0: 'C0 · Nội bộ chung', C1: 'C1 · Nội bộ đơn vị', C2: 'C2 · Hạn chế', C3: 'C3 · Mật' }

export function StatusBadge({ map, status }) {
  const s = map[status] || { label: status, tone: 'muted' }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

// --- Luồng I: lộ trình, giao bài, thi, chấm ---
export const PATH_STATUS = {
  draft: { label: 'Nháp', tone: 'warn' },
  published: { label: 'Đã phát hành', tone: 'good' },
  closed: { label: 'Đã đóng', tone: 'muted' },
}
export const ASSIGNMENT_STATUS = {
  assigned: { label: 'Chưa bắt đầu', tone: 'muted' },
  in_progress: { label: 'Đang học', tone: 'info' },
  completed: { label: 'Hoàn thành', tone: 'good' },
  overdue: { label: 'Quá hạn', tone: 'bad' },
}
// Nhắc hạn (LRN-05): còn ≤ 3 ngày = sắp hạn
export const DUE_STATE = {
  soon: { label: 'Sắp hạn', tone: 'warn' },
  overdue: { label: 'Quá hạn', tone: 'bad' },
}
export function DueBadge({ state }) {
  const s = DUE_STATE[state]
  return s ? <Badge tone={s.tone}>{s.label}</Badge> : null
}
export const periodLabel = (p) => (p.period === 'year' ? `Năm ${p.year}` : `Tháng ${p.month}/${p.year}`)
export const AI_STATUS = {
  pending: 'AI đang chấm sơ bộ…',
  done: 'AI đã chấm sơ bộ',
  unavailable: 'AI chưa sẵn sàng — người chấm tự chấm',
  error: 'AI chấm lỗi — người chấm tự chấm',
}

export const scoreText =(score, max) => `${Number(score ?? 0).toLocaleString('vi-VN')}/${Number(max ?? 0).toLocaleString('vi-VN')}`

// Chọn thẻ VCWIKI đã duyệt mà mình xem được (BE kiểm tra lại khi lưu). value: [{card_id, title}] theo thứ tự.
// Thân thiện với AI điều khiển trình duyệt: ô nhập có aria-label = `label` và data-testid = `${testId}-search`;
// gõ là xoá gợi ý cũ và hiện "Đang tìm…"; tìm theo tiêu đề trước (match=title, < 1 giây với ~2.300 thẻ) rồi mới
// tìm theo nghĩa (chậm hơn, nối vào dưới); chip ghi đủ tiêu đề + nhãn "Đã duyệt", mang data-card-id; dán thẳng
// id thẻ (24 ký tự hex) thì gắn đúng thẻ đó.
const HEX24 = /^[0-9a-f]{24}$/i

export function CardPicker({ value, onChange, max = 50, label = 'Thêm thẻ đã duyệt', testId = 'card' }) {
  const preview = useUrlOverlay(`${testId}-preview`)
  const { data: previewCard, error: previewError } = useFetch(() => preview.value ? api.card(preview.value) : Promise.resolve(null), [preview.value])
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const [state, setState] = useState({ items: [], phase: 'idle', q: '' })   // phase: idle | title | semantic | done | error
  const seq = useRef(0)
  const chosen = new Set(value.map((v) => v.card_id))
  const add = (c) => { onChange([...value, { card_id: c.id, title: c.title }]); setQ('') }

  useEffect(() => {
    const text = dq.trim()
    const my = ++seq.current
    if (!text) { setState({ items: [], phase: 'idle', q: '' }); return }
    if (HEX24.test(text)) {
      setState({ items: [], phase: 'title', q: text })
      api.card(text).then((c) => {
        if (my !== seq.current) return
        setState({ items: c.status === 'approved' ? [c] : [], phase: 'done', q: text, notApproved: c.status !== 'approved' })
      }).catch((e) => my === seq.current && setState({ items: [], phase: 'error', q: text, error: e.message }))
      return
    }
    setState({ items: [], phase: 'title', q: text })
    api.cards({ status: 'approved', q: text, page_size: 12, match: 'title' }).then((r) => {
      if (my !== seq.current) return
      const titles = r.items
      setState({ items: titles, phase: 'semantic', q: text })
      return api.cards({ status: 'approved', q: text, page_size: 12 }).then((r2) => {
        if (my !== seq.current) return
        const have = new Set(titles.map((c) => c.id))
        setState({ items: [...titles, ...r2.items.filter((c) => !have.has(c.id))], phase: 'done', q: text })
      })
    }).catch((e) => my === seq.current && setState({ items: [], phase: 'error', q: text, error: e.message }))
  }, [dq])

  const typing = q.trim() !== state.q      // đang gõ, chưa tới lượt tìm: không hiện gợi ý cũ
  const items = typing ? [] : state.items.filter((c) => !chosen.has(c.id))
  const searching = q.trim() && (typing || state.phase === 'title')
  const move = (i, d) => {
    const next = [...value]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <div className="lrn-picker" data-testid={`${testId}-picker`}>
      {preview.value && <Drawer open title={previewCard?.title || 'Xem trước thẻ'} onClose={preview.close} testId="lesson-card-preview">
        {previewError ? <p role="alert">{previewError}</p> : !previewCard ? <p role="status">Đang tải thẻ…</p> : <><p>{previewCard.summary}</p><Markdown text={previewCard.body || ''} /></>}
      </Drawer>}
      {value.length > 0 && (
        <ol className="lrn-picked" data-testid={`${testId}-picked`}>
          {value.map((v, i) => (
            <li key={v.card_id} className="row-between" data-card-id={v.card_id}>
              <span className="grow">{v.title || v.card_id}{v.rev ? <span className="muted small"> · bản {v.rev}</span> : null}</span>
              <span className="lrn-picked-actions">
                <button type="button" className="btn btn-ghost" title="Lên" aria-label={`Chuyển lên: ${v.title}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="btn btn-ghost" title="Xuống" aria-label={`Chuyển xuống: ${v.title}`} disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="btn btn-ghost btn-danger-text" title="Bỏ" aria-label={`Bỏ thẻ: ${v.title}`} onClick={() => onChange(value.filter((x) => x.card_id !== v.card_id))}>✕</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {value.length < max && (
        <>
          <input placeholder={`${label} — gõ 10 ký tự đầu tiêu đề, hoặc dán id thẻ`} aria-label={label} data-testid={`${testId}-search`}
            value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          <div className="lrn-picker-state" data-testid={`${testId}-search-state`} aria-live="polite">
            {searching ? 'Đang tìm…'
              : state.phase === 'semantic' ? `${items.length} thẻ khớp tiêu đề · đang tìm thêm theo nghĩa…`
                : state.phase === 'error' ? `Lỗi tìm thẻ: ${state.error}`
                  : state.phase === 'done' ? (state.notApproved ? 'Thẻ này chưa được duyệt — chỉ gắn được thẻ Đã duyệt.' : `${items.length} thẻ đã duyệt khớp`)
                    : ''}
          </div>
          <div className="lrn-options" data-testid={`${testId}-options`}>
            {items.map((c) => (
              <div key={c.id} className="row row-wrap"><button type="button" className="chip chip-btn" data-card-id={c.id} data-match={c.match || ''}
                title={`${c.title} · id ${c.id}`} onClick={() => add(c)}>
                + {c.title}<span className="chip-ok">Đã duyệt</span>
              </button><button type="button" className="link small" aria-label={`Xem trước thẻ: ${c.title}`} onClick={() => preview.open(c.id)}>Xem trước</button></div>
            ))}
            {!searching && state.phase === 'done' && items.length === 0 && !state.notApproved && (
              <span className="muted small">Không có thẻ đã duyệt nào khớp “{state.q}”. Thử 10 ký tự đầu của tiêu đề, hoặc dán id thẻ.</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
