// Phân loại v2 của thẻ (WK-27 — docs/BA.md mục 4.4): cấp độ người đọc, division, bước quy trình,
// ngày hiệu lực + chu kỳ rà soát. Dùng trong Wiki.jsx: bộ lọc, nhãn trên thẻ, xem và sửa trong ngăn thẻ.
import { useState } from 'react'
import { CARD_LEVEL, DIVISION, PROCESS_CHAIN, date, processStepLabel } from '../format'
import { Badge } from './ui'

export const CLASS_FILTER_KEYS = ['level', 'division', 'process_step']
export const CLASS_EMPTY = { level: '', division: [], process_steps: [], effective_at: '', review_cycle_months: '' }

const STEPS = Object.keys(PROCESS_CHAIN).flatMap((c) => ['a', 'b', 'c', 'd'].map((s) => `qt.${c}.${s}`))

// Nhãn tiếng Việt cho giá trị trục phân loại (so sánh phiên bản); trường khác -> undefined
export function classValueLabel(field, v) {
  if (field === 'level') return CARD_LEVEL[v] || v
  if (field === 'division') return Array.isArray(v) ? v.map((d) => DIVISION[d] || d).join(', ') : DIVISION[v] || v
  if (field === 'process_steps') return Array.isArray(v) ? v.map(processStepLabel).join(', ') : processStepLabel(v)
  if (field === 'effective_at') return date(v)
  if (field === 'review_cycle_months') return `${v} tháng`
  return undefined
}

// URL có giá trị ngoài danh sách (vd nhiều giá trị "a,b" từ link AI / chia sẻ) -> thêm một option để ô chọn
// hiện đúng bộ lọc đang áp, không hiện "Mọi …" trong khi danh sách đã lọc
function ExtraOption({ value, known, label }) {
  if (!value || known.includes(value)) return null
  const parts = value.split(',').map((x) => x.trim()).filter(Boolean)
  return <option value={value}>{parts.length > 1 ? `Nhiều giá trị: ${parts.map(label).join(', ')}` : label(parts[0] || value)}</option>
}

export function ClassFilters({ f, update }) {
  return (
    <>
      <select value={f.level} onChange={(e) => update({ level: e.target.value })} aria-label="Cấp độ">
        <option value="">Mọi cấp độ</option>
        <ExtraOption value={f.level} known={Object.keys(CARD_LEVEL)} label={(x) => CARD_LEVEL[x] || x} />
        {Object.entries(CARD_LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={f.division} onChange={(e) => update({ division: e.target.value })} aria-label="Division">
        <option value="">Mọi division</option>
        <ExtraOption value={f.division} known={Object.keys(DIVISION)} label={(x) => DIVISION[x] || x} />
        {Object.entries(DIVISION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={f.process_step} onChange={(e) => update({ process_step: e.target.value })} aria-label="Bước quy trình">
        <option value="">Mọi bước quy trình</option>
        <ExtraOption value={f.process_step} known={STEPS} label={processStepLabel} />
        {STEPS.map((s) => <option key={s} value={s}>{processStepLabel(s)}</option>)}
      </select>
    </>
  )
}

export function ClassBadges({ card, full = false }) {
  const divs = (card.division || []).filter((d) => full || d !== 'tap-doan')
  const overdue = card.next_review_at && new Date(card.next_review_at) < new Date()
  return (
    <div className="class-badges">
      {card.level && <Badge tone="info">{CARD_LEVEL[card.level] || card.level}</Badge>}
      {divs.map((d) => <Badge key={d} tone="muted">{DIVISION[d] || d}</Badge>)}
      {(card.process_steps || []).map((s) => <span key={s} className="small muted">⟶ {processStepLabel(s)}</span>)}
      {full && card.effective_at && <span className="small muted">Hiệu lực {date(card.effective_at)}</span>}
      {overdue && <Badge tone="warn">Cần rà soát</Badge>}
      {full && card.next_review_at && !overdue && <span className="small muted">Rà soát {date(card.next_review_at)}</span>}
      {full && !card.next_review_at && card.review_cycle_months && (
        <span className="small muted">Rà soát mỗi {card.review_cycle_months} tháng (chưa có ngày hiệu lực)</span>
      )}
    </div>
  )
}

// draft -> body gửi API (chuỗi rỗng / 0 = gỡ giá trị)
export const classBody = (d) => ({
  level: d.level || '',
  division: d.division || [],
  process_steps: d.process_steps || [],
  effective_at: d.effective_at ? String(d.effective_at).slice(0, 10) : '',
  review_cycle_months: Number(d.review_cycle_months) || 0,
})

export function ClassEditor({ draft, setDraft }) {
  const [stepWarn, setStepWarn] = useState(false)
  const set = (k, v) => setDraft({ ...draft, [k]: v })
  // bước thuộc chuỗi ngoài danh sách (đặt qua API / MCP, BA cho phép) vẫn hiện để không mất khi lưu
  const steps = [...new Set([...(draft.process_steps || []), ...STEPS])]
  const pickSteps = (vals) => {
    setStepWarn(vals.length > 2)
    if (vals.length <= 2) set('process_steps', vals)
  }
  const toggle = (k, v, max) => {
    const cur = draft[k] || []
    set(k, cur.includes(v) ? cur.filter((x) => x !== v) : max && cur.length >= max ? cur : [...cur, v])
  }
  return (
    <>
      <div className="row">
        <label className="field field-sm">
          <span>Cấp độ người đọc</span>
          <select value={draft.level || ''} onChange={(e) => set('level', e.target.value)}>
            <option value="">— chưa xác định —</option>
            {Object.entries(CARD_LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field field-sm">
          <span>Ngày hiệu lực</span>
          <input type="date" value={draft.effective_at ? String(draft.effective_at).slice(0, 10) : ''} onChange={(e) => set('effective_at', e.target.value)} />
        </label>
        <label className="field field-sm">
          <span>Rà soát <em>(tháng)</em></span>
          <input type="number" min={0} max={60} value={draft.review_cycle_months || ''} onChange={(e) => set('review_cycle_months', e.target.value)} />
        </label>
      </div>
      <div className="field" role="group" aria-label="Division (không chọn = Tập đoàn)">
        <span>Division <em>(không chọn = Tập đoàn)</em></span>
        <div className="class-chips">
          {Object.entries(DIVISION).map(([k, v]) => (
            <label key={k} className="check"><input type="checkbox" checked={(draft.division || []).includes(k)} onChange={() => toggle('division', k)} /> {v}</label>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Bước quy trình <em>(tối đa 2)</em></span>
        <select multiple size={4} value={draft.process_steps || []}
          onChange={(e) => pickSteps([...e.target.selectedOptions].map((o) => o.value))}>
          {steps.map((s) => <option key={s} value={s}>{processStepLabel(s)}{STEPS.includes(s) ? '' : ' (chuỗi ngoài danh sách)'}</option>)}
        </select>
        {(draft.process_steps || []).length > 0 && (
          <small>Đã chọn: {draft.process_steps.map(processStepLabel).join(' · ')}</small>
        )}
        {stepWarn && <small className="tone-bad" role="alert">Chỉ chọn tối đa 2 bước — bỏ bớt một bước trước khi chọn bước khác</small>}
      </label>
    </>
  )
}
