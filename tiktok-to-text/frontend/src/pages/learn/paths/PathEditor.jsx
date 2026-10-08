// Trạng thái + hai khung sửa của một lộ trình nháp (TPL-B): tab *Nội dung* (tên, kỳ, mô tả, các tuần / tháng → bài học,
// mục bắt buộc) và tab *Đề thi* (ma trận đề). State giữ ở PathEdit qua usePathEditor nên chuyển tab không mất chữ đã gõ;
// Lưu nháp / Phát hành ở chân trang chung (PathEdit).
import { useState } from 'react'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { Badge, TextArea } from '../../../components/ui'
import { QUESTION_KIND } from '../common'

// lộ trình năm chia theo tháng, lộ trình tháng chia theo tuần (QA vòng 2, L10)
export const unitOf = (period) => (period === 'year' ? 'Tháng' : 'Tuần')
const toDay = (s) => (s ? new Date(s).toLocaleDateString('sv-SE') : '')
export const endOfDay = (d) => (d ? new Date(`${d}T23:59:00`).toISOString() : null)
const defaultRow = { category: '', difficulty: null, kind: 'single', count: 5 }

export function usePathEditor(p, onSaved) {
  const [f, setF] = useState({ title: p.title, description: p.description || '', period: p.period, year: p.year, month: p.month || 1 })
  const [mods, setMods] = useState(p.modules.map((m) => ({ week: m.week, title: m.title, due: toDay(m.due_at), lessons: m.lessons })))
  const [required, setRequired] = useState(new Set(p.required_items))
  const [examOn, setExamOn] = useState(!!p.exam)
  // bản nháp AI (luồng H) có thể chỉ có mô tả chữ cho ma trận đề (blueprint_note) — điền ma trận trước khi phát hành
  const [exam, setExam] = useState(p.exam ? { ...p.exam, blueprint: p.exam.blueprint.length ? p.exam.blueprint : [defaultRow] }
    : { blueprint: [defaultRow], duration_min: 30, pass_score: 70, attempts: 1, scope: 'path' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const used = new Set(mods.flatMap((m) => m.lessons.map((l) => l.id)))

  const body = () => ({
    title: f.title, description: f.description, period: f.period, year: Number(f.year), month: f.period === 'month' ? Number(f.month) : null,
    modules: mods.map((m) => ({ week: Number(m.week), title: m.title, lesson_ids: m.lessons.map((l) => l.id), due_at: endOfDay(m.due) })),
    required_items: [...required].filter((x) => used.has(x)),
    exam: examOn ? {
      duration_min: Number(exam.duration_min), pass_score: Number(exam.pass_score), attempts: Number(exam.attempts), scope: exam.scope || 'path',
      blueprint: exam.blueprint.map((r) => ({ category: r.category || null, difficulty: r.difficulty ? Number(r.difficulty) : null, kind: r.kind || null, count: Number(r.count) })),
    } : null,
  })
  // publish=true: lưu rồi phát hành (khoá nội dung); trả về lộ trình mới hoặc null khi lỗi
  const save = async (publish) => {
    setErr(null)
    setBusy(true)
    try {
      let out = await api.patchPath(p.id, body())
      if (publish) out = await api.publishPath(p.id)
      onSaved(out)
      return out
    } catch (e) { setErr(e.message); return null } finally { setBusy(false) }
  }
  return { f, setF, mods, setMods, required, setRequired, examOn, setExamOn, exam, setExam, err, busy, save, used }
}

export function ContentPanel({ p, ed }) {
  const { data: lessonList } = useFetch(() => api.lessons({ page_size: 100 }), [])
  const { f, setF, mods, setMods, required, setRequired, used } = ed
  const frameRequired = new Set((p.parent?.required_items || []).map((l) => l.id))
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setMod = (i, patch) => setMods(mods.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const unit = unitOf(f.period)
  return (
    <div data-testid="path-editor" className="lrn-form">
      {p.ai?.prompt && <div className="panel small lrn-prompt"><b>Prompt thiết kế:</b>{'\n'}{p.ai.prompt}</div>}
      <div className="row row-wrap">
        <label className="field grow2"><span>Tên lộ trình *</span><input value={f.title} onChange={set('title')} maxLength={200} aria-label="Tên lộ trình" data-testid="path-title" /></label>
        <label className="field field-sm"><span>Kỳ</span>
          <select value={f.period} onChange={set('period')} disabled={!!p.parent} aria-label="Kỳ" data-testid="path-period"><option value="month">Tháng</option><option value="year">Năm (khung)</option></select></label>
        <label className="field field-sm"><span>Năm</span><input type="number" value={f.year} onChange={set('year')} aria-label="Năm" data-testid="path-year" /></label>
        {f.period === 'month' && <label className="field field-sm"><span>Tháng</span>
          <select value={f.month} onChange={set('month')} aria-label="Tháng" data-testid="path-month">{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>}
      </div>
      <div className="field"><span>Mô tả / mục tiêu sau kỳ</span><TextArea rows={2} value={f.description} onChange={set('description')} aria-label="Mô tả / mục tiêu sau kỳ" data-testid="path-description" /></div>

      <h2 className="lrn-sec">Các {unit.toLowerCase()} và bài học</h2>
      {mods.map((m, i) => (
        <div key={i} className="panel lrn-week" data-testid={`path-week-${m.week}`}>
          <div className="row row-wrap">
            <label className="field field-sm"><span>{unit}</span><input type="number" min={1} max={f.period === 'year' ? 12 : 53} value={m.week} onChange={(e) => setMod(i, { week: e.target.value })} aria-label={unit} data-testid={`path-week-${i + 1}-number`} /></label>
            <label className="field grow2"><span>Chủ đề {unit.toLowerCase()}</span><input value={m.title} onChange={(e) => setMod(i, { title: e.target.value })} aria-label={`Chủ đề ${unit.toLowerCase()} ${m.week}`} data-testid={`path-week-${i + 1}-title`} /></label>
            <label className="field field-sm"><span>Hạn {unit.toLowerCase()}</span><input type="date" value={m.due} onChange={(e) => setMod(i, { due: e.target.value })} aria-label={`Hạn ${unit.toLowerCase()} ${m.week}`} data-testid={`path-week-${i + 1}-due`} /></label>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-danger" data-testid={`path-week-${i + 1}-remove`} onClick={() => setMods(mods.filter((_, j) => j !== i))}>Bỏ {unit.toLowerCase()}</button>
          </div>
          <ul className="list">
            {m.lessons.map((l) => (
              <li key={l.id} className="row" data-lesson-id={l.id}>
                <span className="grow">{l.title}{l.status === 'draft' && <span className="muted small"> · nháp (phát hành cùng lộ trình)</span>}</span>
                {frameRequired.has(l.id) ? <Badge tone="info">bắt buộc của khung</Badge> : (
                  <label className="row small"><input type="checkbox" aria-label={`Bắt buộc: ${l.title}`} data-testid={`path-required-${l.id}`} checked={required.has(l.id)}
                    onChange={(e) => { const s = new Set(required); e.target.checked ? s.add(l.id) : s.delete(l.id); setRequired(s) }} />bắt buộc</label>
                )}
                <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost ui-btn-danger" title="Bỏ bài" aria-label={`Bỏ bài: ${l.title}`} onClick={() => setMod(i, { lessons: m.lessons.filter((x) => x.id !== l.id) })}>✕</button>
              </li>
            ))}
          </ul>
          <select aria-label={`Thêm bài học vào ${unit.toLowerCase()} ${m.week}`} data-testid={`path-week-${i + 1}-lesson`} value="" onChange={(e) => {
            const l = lessonList?.items.find((x) => x.id === e.target.value)
            if (l) setMod(i, { lessons: [...m.lessons, { id: l.id, title: l.title, status: l.status }] })
          }}>
            <option value="">+ Thêm bài học…</option>
            {(lessonList?.items || []).filter((l) => !used.has(l.id)).map((l) => <option key={l.id} value={l.id}>{l.title}{l.status === 'draft' ? ' (nháp)' : ''}</option>)}
          </select>
        </div>
      ))}
      <div><button type="button" className="ui-btn" data-testid="path-add-week" onClick={() => setMods([...mods, { week: (mods.at(-1)?.week || 0) * 1 + 1, title: '', due: '', lessons: [] }])}>+ Thêm {unit.toLowerCase()}</button></div>
    </div>
  )
}

export function ExamPanel({ p, ed }) {
  const { data: cats } = useFetch(() => api.categories(), [])
  const catList = Array.isArray(cats) ? cats : cats?.items || []
  const { examOn, setExamOn, exam, setExam } = ed
  const setRow = (i, patch) => setExam({ ...exam, blueprint: exam.blueprint.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  return (
    <div className="lrn-form">
      <h2 className="lrn-sec">Bài thi cuối kỳ</h2>
      <label className="row"><input type="checkbox" checked={examOn} onChange={(e) => setExamOn(e.target.checked)} aria-label="Có bài thi" data-testid="path-exam-on" /> Có bài thi (đề rút ngẫu nhiên theo ma trận từ câu hỏi <b>đã duyệt</b>)</label>
      {examOn && (
        <div className="panel">
          {p.exam?.blueprint_note && <p className="small"><b>Mô tả đề của AI:</b> {p.exam.blueprint_note} — chuyển thành các dòng ma trận bên dưới.</p>}
          <div className="row row-wrap">
            <label className="field field-sm"><span>Thời gian (phút)</span><input type="number" min={1} value={exam.duration_min} onChange={(e) => setExam({ ...exam, duration_min: e.target.value })} aria-label="Thời gian (phút)" data-testid="path-exam-duration" /></label>
            <label className="field field-sm"><span>Điểm đạt (%)</span><input type="number" min={0} max={100} value={exam.pass_score} onChange={(e) => setExam({ ...exam, pass_score: e.target.value })} aria-label="Điểm đạt (%)" data-testid="path-exam-pass" /></label>
            <label className="field field-sm"><span>Số lượt thi</span><input type="number" min={1} max={5} value={exam.attempts} onChange={(e) => setExam({ ...exam, attempts: e.target.value })} aria-label="Số lượt thi" data-testid="path-exam-attempts" /></label>
            <label className="field"><span>Nguồn câu hỏi</span>
              <select value={exam.scope} onChange={(e) => setExam({ ...exam, scope: e.target.value })} aria-label="Nguồn câu hỏi" data-testid="path-exam-scope">
                <option value="path">Câu gắn với bài học trong lộ trình</option>
                <option value="bank">Cả ngân hàng câu hỏi tôi xem được</option>
              </select></label>
          </div>
          <table className="table lrn-blueprint">
            <caption className="sr-only">Ma trận đề thi</caption>
            <thead><tr><th scope="col">Lĩnh vực</th><th scope="col">Độ khó</th><th scope="col">Loại câu</th><th scope="col">Số câu</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
            <tbody>
              {exam.blueprint.map((r, i) => (
                <tr key={i} data-testid={`path-bp-${i + 1}`}>
                  <td><select aria-label={`Lĩnh vực dòng ${i + 1}`} data-testid={`path-bp-${i + 1}-category`} value={r.category || ''} onChange={(e) => setRow(i, { category: e.target.value })}>
                    <option value="">Mọi lĩnh vực</option>
                    {catList.map((c) => <option key={c.slug} value={c.slug}>{c.slug} — {c.name}</option>)}
                  </select></td>
                  <td><select aria-label={`Độ khó dòng ${i + 1}`} data-testid={`path-bp-${i + 1}-difficulty`} value={r.difficulty || ''} onChange={(e) => setRow(i, { difficulty: e.target.value || null })}>
                    <option value="">Mọi độ khó</option>{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select></td>
                  <td><select aria-label={`Loại câu dòng ${i + 1}`} data-testid={`path-bp-${i + 1}-kind`} value={r.kind || ''} onChange={(e) => setRow(i, { kind: e.target.value || null })}>
                    <option value="">Mọi loại</option>{Object.entries(QUESTION_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></td>
                  <td><input className="lrn-bp-count" aria-label={`Số câu dòng ${i + 1}`} data-testid={`path-bp-${i + 1}-count`} type="number" min={1} max={100} value={r.count} onChange={(e) => setRow(i, { count: e.target.value })} /></td>
                  <td><button type="button" className="ui-btn ui-btn-sm ui-btn-ghost ui-btn-danger" disabled={exam.blueprint.length === 1}
                    aria-label={`Bỏ dòng ma trận ${i + 1}`} title="Bỏ dòng" onClick={() => setExam({ ...exam, blueprint: exam.blueprint.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="ui-btn ui-btn-ghost" data-testid="path-bp-add" onClick={() => setExam({ ...exam, blueprint: [...exam.blueprint, { category: '', difficulty: null, kind: 'single', count: 1 }] })}>+ Dòng ma trận</button>
        </div>
      )}
    </div>
  )
}
