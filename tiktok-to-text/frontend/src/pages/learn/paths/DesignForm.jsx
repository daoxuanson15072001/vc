// Bước 1 *Mục tiêu và người học* của Thiết kế lộ trình (LRN-04): form 6 ô ghép thành prompt (sửa tự do trước khi gửi).
// useDesignForm giữ form + prompt ở Design.jsx để quay lại bước 1 không mất chữ; nút gửi nằm ở chân trang chung
// (button type=submit form="design-form").
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../api'
import { ErrorBox } from '../../../components/ui'
import { Notice } from '../../../components/Notice'

const EMPTY_FORM = {
  level: '', area: '', division: '', content_levels: [], include_unleveled: false, learners: [],
  goal: '', period: 'month', year: new Date().getFullYear(), month: new Date().getMonth() + 1,
  hours_per_week: 4, branches: '', assessment: '', pass_score: 70,
}

function composePrompt(f, opts) {
  const lines = []
  const who = []
  if (f.level) who.push(`cấp ${f.level} ${opts?.levels?.[f.level] || ''}`.trim())
  if (f.area) who.push(`mảng ${opts?.areas?.find((a) => a.slug === f.area)?.name || f.area}`)
  if (f.division) who.push(`division ${opts?.divisions?.[f.division] || f.division}`)
  const names = (opts?.learners || []).filter((l) => f.learners.includes(l.id)).map((l) => l.name)
  if (names.length) who.push(`người học: ${names.join(', ')}`)
  if (who.length) lines.push(`Đối tượng: ${who.join('; ')}`)
  if (f.goal) lines.push(`Mục tiêu sau kỳ: ${f.goal}`)
  lines.push(`Thời lượng: ${f.period === 'year' ? `năm ${f.year} (12 chủ đề tháng)` : `tháng ${f.month}/${f.year} (4 tuần)`}`)
  if (f.hours_per_week) lines.push(`Số giờ học mỗi tuần: ${f.hours_per_week}`)
  if (f.branches.trim()) lines.push(`Nhánh bắt buộc: ${f.branches}`)
  if (f.assessment || f.pass_score !== '') lines.push(`Đánh giá: ${f.assessment || 'thi cuối kỳ'}${f.pass_score !== '' ? `, điểm đạt ${f.pass_score}` : ''}`)
  return lines.join('\n')
}

// onDone(bản nháp) chạy sau khi AI dựng xong
export function useDesignForm(opts, onDone) {
  const [f, setF] = useState(EMPTY_FORM)
  const [prompt, setPrompt] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const composed = useMemo(() => composePrompt(f, opts), [f, opts])
  useEffect(() => { if (!touched) setPrompt(composed) }, [composed, touched])
  const submit = async (e) => {
    e?.preventDefault()
    setErr(null)
    setBusy(true)
    const num = (v) => (v === '' || v === null ? null : Number(v))
    const form = {
      level: num(f.level), area: f.area || null, division: f.division || null, content_levels: f.content_levels,
      include_unleveled: f.include_unleveled, goal: f.goal, period: f.period, year: num(f.year),
      month: f.period === 'month' ? num(f.month) : null, hours_per_week: num(f.hours_per_week),
      branches: f.branches.split(',').map((s) => s.trim()).filter(Boolean), assessment: f.assessment, pass_score: num(f.pass_score),
    }
    try {
      onDone(await api.designPath({ prompt, form, learners: f.learners, form_in_prompt: true }))
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }
  return { f, setF, prompt, setPrompt, touched, setTouched, composed, busy, err, submit }
}

export function DesignForm({ opts, form, hasDraft }) {
  const { f, setF, prompt, setPrompt, touched, setTouched, composed, err, submit } = form
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const toggle = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] })
  const levelHint = f.level && opts.level_map[f.level]
    ? `Bảng ánh xạ cấp ${f.level}: mảng của mình → ${opts.level_map[f.level].own.map((l) => opts.content_levels[l]).join(', ')}; mảng khác → ${opts.level_map[f.level].other.map((l) => opts.content_levels[l]).join(', ')}`
    : 'Chưa chọn cấp bậc: dùng cấp bậc trên hồ sơ người học (nếu có), không thì không lọc theo bậc.'

  return (
    <section className="card lrn-step-card">
      <h2 className="lrn-sec">Yêu cầu thiết kế</h2>
      {hasDraft && <Notice tone="info">Đang mở một bản nháp. Bấm <b>AI dựng bản nháp mới</b> ở cuối form nếu muốn dựng lại từ yêu cầu này; hoặc <b>Tiếp</b> để quay lại bản nháp.</Notice>}
      <form id="design-form" onSubmit={submit} className="lrn-form">
        <fieldset className="panel">
          <legend className="strong">1. Đối tượng</legend>
          <div className="row row-wrap">
            <label className="field"><span>Cấp bậc</span>
              <select value={f.level} onChange={set('level')}>
                <option value="">— Theo hồ sơ người học —</option>
                {Object.entries(opts.levels).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
              </select>
            </label>
            <label className="field"><span>Mảng (của người học)</span>
              <select value={f.area} onChange={set('area')}>
                <option value="">— Không chọn —</option>
                {opts.areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Division</span>
              <select value={f.division} onChange={set('division')}>
                <option value="">— Mọi division —</option>
                {Object.entries(opts.divisions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <p className="muted small">{levelHint}</p>
          <div className="field">
            <span>Bậc nội dung chọn tay (ghi đè bảng ánh xạ)</span>
            <div className="row row-wrap">
              {Object.entries(opts.content_levels).map(([k, v]) => (
                <label key={k} className="row lrn-choice"><input type="checkbox" checked={f.content_levels.includes(k)} onChange={() => toggle('content_levels', k)} /> {v}</label>
              ))}
              <label className="row lrn-choice"><input type="checkbox" checked={f.include_unleveled} onChange={set('include_unleveled')} /> Dùng cả thẻ chưa gắn bậc</label>
            </div>
          </div>
          {opts.learners.length > 0 && (
            <div className="field">
              <span>Người học (trong cây dưới quyền) — chỉ dùng thẻ mọi người được chọn đều xem được</span>
              <div className="row row-wrap">
                {opts.learners.map((l) => (
                  <label key={l.id} className="row lrn-choice"><input type="checkbox" checked={f.learners.includes(l.id)} onChange={() => toggle('learners', l.id)} /> {l.name}</label>
                ))}
              </div>
            </div>
          )}
        </fieldset>
        <label className="field"><span>2. Mục tiêu sau kỳ (một câu, đo được)</span><input value={f.goal} onChange={set('goal')} maxLength={1000} /></label>
        <div className="row row-wrap">
          <label className="field"><span>3. Thời lượng</span>
            <select value={f.period} onChange={set('period')}>
              <option value="month">Lộ trình tháng</option>
              <option value="year">Lộ trình năm</option>
            </select>
          </label>
          {f.period === 'month' && <label className="field"><span>Tháng</span><input type="number" min={1} max={12} value={f.month} onChange={set('month')} /></label>}
          <label className="field"><span>Năm</span><input type="number" min={2000} max={2100} value={f.year} onChange={set('year')} /></label>
          <label className="field"><span>4. Giờ học mỗi tuần</span><input type="number" min={0} max={60} step="0.5" value={f.hours_per_week} onChange={set('hours_per_week')} /></label>
        </div>
        <label className="field">
          <span>5. Nhánh bắt buộc (1–3, cách nhau dấu phẩy: slug lĩnh vực hoặc chuỗi quy trình qt.…)</span>
          <input value={f.branches} onChange={set('branches')} list="design-branches" placeholder="vd bh, qt.ban-hang-b2b" />
          <datalist id="design-branches">
            {opts.areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
            {Object.entries(opts.process_chains).map(([k, v]) => <option key={k} value={`qt.${k}`}>{v}</option>)}
          </datalist>
        </label>
        <div className="row row-wrap">
          <label className="field grow2"><span>6. Cách đánh giá</span><input value={f.assessment} onChange={set('assessment')} placeholder="vd kiểm tra sau mỗi bài + thi cuối tháng 20 câu" /></label>
          <label className="field"><span>Điểm đạt (%)</span><input type="number" min={0} max={100} value={f.pass_score} onChange={set('pass_score')} /></label>
        </div>
        <label className="field">
          <span className="row-between">
            <span>Prompt gửi AI (ghép từ form — sửa tự do)</span>
            {touched && <button type="button" className="link small" onClick={() => { setTouched(false); setPrompt(composed) }}>Ghép lại từ form</button>}
          </span>
          <textarea rows={6} value={prompt} aria-label="Prompt gửi AI" onChange={(e) => { setTouched(true); setPrompt(e.target.value) }} />
        </label>
        <ErrorBox>{err}</ErrorBox>
        {hasDraft && <div><button type="submit" className="ui-btn" data-testid="design-regenerate">AI dựng bản nháp mới</button></div>}
        <p className="muted small">AI chỉ được dùng thẻ hệ thống lọc sẵn; không có AI thì hệ thống tự chia thẻ theo tuần.</p>
      </form>
    </section>
  )
}
