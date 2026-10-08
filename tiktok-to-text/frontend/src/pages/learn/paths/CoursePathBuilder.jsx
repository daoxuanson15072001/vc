import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { ErrorBox, Loading } from '../../../components/ui'
import { Modal } from '../../../components/Overlay'
import { Stepper } from '../../../components/Stepper'
import { buildTree } from '../../../components/pickers'
import { toast } from '../../../components/toast'

const STEPS = [{ id: '1', label: 'Chọn khoá' }, { id: '2', label: 'Xếp thứ tự' }, { id: '3', label: 'Tên và mô tả' }]

export default function CoursePathBuilder({ open, step, onStep, onClose }) {
  const navigate = useNavigate()
  const { data: courses } = useFetch(() => api.courses(), [open])
  const { data: cats, error } = useFetch(() => api.categories(), [open])
  const [selected, setSelected] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const tree = useMemo(() => buildTree(Array.isArray(cats) ? cats : cats?.items || []), [cats])
  const counts = useMemo(() => new Map((courses?.items || []).map((x) => [x.category, x.lesson_count])), [courses])
  const toggle = (slug, checked) => setSelected((old) => {
    if (checked) return [...old, { category: slug, days: 7, required: true, lesson_ids: null }]
    return old.filter((x) => x.category !== slug)
  })
  const changeCourse = (index, patch) => setSelected((old) => old.map((x, i) => i === index ? { ...x, ...patch } : x))
  const move = (from, to) => setSelected((old) => {
    const next = [...old]; [next[from], next[to]] = [next[to], next[from]]; return next
  })
  const save = async () => {
    if (!title.trim()) { setSaveError('Nhập tên lộ trình.'); onStep('3'); return }
    setBusy(true); setSaveError('')
    try {
      const path = await api.createPath({ title: title.trim(), description, kind: 'courses', courses: selected })
      toast('Đã lưu nháp lộ trình chuỗi khoá.')
      onClose()
      navigate(`/learn/paths/${path.id}`)
    } catch (e) { setSaveError(e.message) } finally { setBusy(false) }
  }
  const renderCategories = (items, depth = 0) => items.map((c) => {
    const count = counts.get(c.slug) || 0
    const descendantCount = (nodes) => nodes.reduce((n, node) => n + (counts.get(node.slug) || 0)
      + descendantCount(node.children || []), 0)
    if (!count && !descendantCount(c.children || [])) return null
    const checked = selected.some((x) => x.category === c.slug)
    return <div key={c.id} className="path-builder-category" style={{ '--depth': depth }}>
      <label>{count > 0 && <input type="checkbox" checked={checked} data-testid={`path-builder-course-${c.slug}`}
        onChange={(e) => toggle(c.slug, e.target.checked)} />}
        <span className={!count ? 'strong' : ''}>{c.name}</span>{count > 0 && <span className="muted small">{count} bài</span>}
      </label>
      {c.children?.length > 0 && renderCategories(c.children, depth + 1)}
    </div>
  })
  return <Modal open={open} title="Tạo lộ trình chuỗi khoá" sub="Chọn khoá, xếp thứ tự và lưu bản nháp"
    onClose={onClose} testId="path-builder" size="wide">
    <Stepper label="Các bước xếp lộ trình" steps={STEPS} current={step} onSelect={onStep} testId="path-builder-step" />
    <ErrorBox>{error || saveError}</ErrorBox>
    {!courses || !cats ? <Loading>Đang tải khoá học…</Loading> : step === '1' ? (
      <section aria-label="Chọn khoá học">
        <h2>1. Chọn khoá</h2>
        {renderCategories(tree)}
        <p className="muted">Đã chọn {selected.length}/30 khoá.</p>
      </section>
    ) : step === '2' ? (
      <section aria-label="Xếp thứ tự khoá và bài">
        <h2>2. Xếp thứ tự và chọn bài</h2>
        {!selected.length && <p className="muted">Quay lại bước 1 để chọn ít nhất một khoá.</p>}
        {selected.map((item, i) => <BuilderCourse key={item.category} item={item} index={i} total={selected.length}
          onChange={(patch) => changeCourse(i, patch)} onMove={(to) => move(i, to)} onRemove={() => toggle(item.category, false)} />)}
      </section>
    ) : (
      <section className="path-builder-name">
        <h2>3. Tên và mô tả</h2>
        <label className="field"><span>Tên lộ trình</span><input value={title} onChange={(e) => setTitle(e.target.value)}
          maxLength={200} data-testid="path-builder-title" /></label>
        <label className="field"><span>Mô tả</span><textarea rows="4" maxLength={5000} value={description}
          onChange={(e) => setDescription(e.target.value)} data-testid="path-builder-description" /></label>
      </section>
    )}
    <div className="path-builder-footer">
      <button type="button" className="ui-btn" onClick={() => step === '1' ? onClose() : onStep(String(Number(step) - 1))}>Quay lại</button>
      <span className="grow" />
      {step !== '3' ? <button type="button" className="ui-btn ui-btn-primary" disabled={step === '1' && !selected.length || step === '2' && !selected.length}
        onClick={() => onStep(String(Number(step) + 1))}>Tiếp</button>
        : <button type="button" className="ui-btn ui-btn-primary" disabled={busy} data-testid="path-builder-save"
          onClick={save}>Lưu lộ trình nháp</button>}
    </div>
  </Modal>
}

function BuilderCourse({ item, index, total, onChange, onMove, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const { data } = useFetch(() => expanded ? api.course(item.category) : Promise.resolve(null), [item.category, expanded])
  const lessons = data?.lessons || []
  const ids = item.lesson_ids === null ? lessons.map((x) => x.id) : item.lesson_ids || []
  const ordered = ids.map((id) => lessons.find((x) => x.id === id)).filter(Boolean)
  const updateIds = (next) => onChange({ lesson_ids: next })
  const moveLesson = (from, to) => { const next = [...ids]; [next[from], next[to]] = [next[to], next[from]]; updateIds(next) }
  const name = data?.name || item.category
  return <article className="panel path-builder-course" data-testid={`path-builder-selected-${item.category}`}>
    <div className="row row-wrap">
      <strong className="grow">{index + 1}. {name}</strong>
      <button type="button" className="ui-btn ui-btn-sm" disabled={index === 0} aria-label={`Xếp khoá ${name} lên`} onClick={() => onMove(index - 1)}>↑</button>
      <button type="button" className="ui-btn ui-btn-sm" disabled={index === total - 1} aria-label={`Xếp khoá ${name} xuống`} onClick={() => onMove(index + 1)}>↓</button>
      <button type="button" className="ui-btn ui-btn-sm" onClick={() => setExpanded(!expanded)}>{expanded ? 'Thu bài' : 'Xem / chọn bài'}</button>
      <button type="button" className="ui-btn ui-btn-sm ui-btn-danger" onClick={onRemove}>Bỏ khoá</button>
    </div>
    <div className="row row-wrap">
      <label className="field field-sm"><span>Số ngày cho khoá</span><input type="number" min="1" max="365" value={item.days}
        onChange={(e) => onChange({ days: Number(e.target.value) })} /></label>
      <label className="row small"><input type="checkbox" checked={item.required} onChange={(e) => onChange({ required: e.target.checked })} />Khoá bắt buộc</label>
    </div>
    {expanded && (!data ? <Loading /> : <ol className="path-builder-lessons">{ordered.map((lesson, i) => <li key={lesson.id}
      data-testid={`path-builder-lesson-${item.category}-${i + 1}`}>
      <span className="grow">{lesson.title}</span>
      <button type="button" className="ui-btn ui-btn-sm" disabled={i === 0} aria-label={`Xếp bài ${lesson.title} lên`}
        onClick={() => moveLesson(i, i - 1)}>↑</button>
      <button type="button" className="ui-btn ui-btn-sm" disabled={i === ordered.length - 1} aria-label={`Xếp bài ${lesson.title} xuống`}
        onClick={() => moveLesson(i, i + 1)}>↓</button>
      <button type="button" className="ui-btn ui-btn-sm ui-btn-danger" aria-label={`Bỏ bài ${lesson.title}`}
        onClick={() => updateIds(ids.filter((id) => id !== lesson.id))}>Bỏ bài</button>
    </li>)}</ol>)}
  </article>
}
