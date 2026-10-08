import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { Badge, ErrorBox, Loading } from '../../../components/ui'
import { Tree } from '../../../components/Tree'
import { buildTree } from '../../../components/pickers'
import { Drawer, useUrlOverlay } from '../../../components/Overlay'
import { toast } from '../../../components/toast'

const rowDefault = { category: null, difficulty: null, kind: 'single', count: 1 }

function courseNodes(cats, counts) {
  const tree = buildTree(cats || [])
  const walk = (row) => {
    const children = row.children.map(walk)
    const direct = counts.get(row.slug) || { lesson_count: 0, has_exam: false }
    const below = children.reduce((n, child) => n + child.total, 0)
    return { id: row.slug, label: row.name, count: direct.lesson_count, total: direct.lesson_count + below,
      title: below ? `Gồm ${below} bài ở khoá con` : undefined, children }
  }
  return tree.map(walk)
}

export function CoursesPanel({ category, onCategory, canAuthor }) {
  const { data: catalog, error: catalogError, reload: reloadCatalog } = useFetch(() => api.courses(), [])
  const { data: cats, error: catsError, reload: reloadCats } = useFetch(() => api.categories(), [])
  const unassigned = category === 'unassigned'
  const { data, error, reload } = useFetch(
    () => !category ? Promise.resolve(null) : (unassigned
      ? api.lessons({ course: 'unassigned', page_size: 100 })
      : api.course(category)), [category, unassigned])
  const counts = useMemo(() => new Map((catalog?.items || []).map((x) => [x.category, x])), [catalog])
  const nodes = useMemo(() => courseNodes(Array.isArray(cats) ? cats : cats?.items || [], counts), [cats, counts])
  const exam = useUrlOverlay('exam')
  return (
    <div className="course-library" data-testid="course-library">
      <aside className="course-library-nav" aria-label="Chọn khoá học">
        <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" aria-current={!category ? 'true' : undefined}
          onClick={() => onCategory('')}>Tất cả khoá học</button>
        <Tree label="Môn học kiểu cũ" nodes={nodes} selected={unassigned ? undefined : category || undefined}
          onSelect={(slug) => onCategory(category === slug ? '' : slug)} testId="course-tree"
          renderLabel={(n) => <span title={n.title}>{n.label}</span>} />
        {canAuthor && catalog?.unassigned > 0 && (
          <button type="button" className={`ui-btn ui-btn-sm ui-btn-ghost${unassigned ? ' is-on' : ''}`}
            data-testid="course-unassigned" aria-current={unassigned ? 'true' : undefined}
            onClick={() => onCategory(unassigned ? '' : 'unassigned')}>
            Chưa xếp khoá <span className="ui-tree-count">{catalog.unassigned}</span>
          </button>
        )}
        <ErrorBox onRetry={() => { reloadCatalog(); reloadCats() }}>{catalogError || catsError}</ErrorBox>
      </aside>
      <section className="course-library-content" aria-live="polite">
        {!category && <>
          <h2>Môn học kiểu cũ</h2>
          <p className="muted">Chọn một nhánh cây để xem bài học được xếp trong khoá đó.</p>
          {!!catalog?.items?.length && <ul className="list">{catalog.items.map((x) => {
            const c = (Array.isArray(cats) ? cats : cats?.items || []).find((v) => v.slug === x.category)
            return <li key={x.category}><button type="button" className="link" onClick={() => onCategory(x.category)}>
              {c?.name || x.category} · {x.lesson_count} bài{x.has_exam ? ' · có thi khoá' : ''}
            </button></li>
          })}</ul>}
        </>}
        {category && !data && !error && <Loading>Đang tải khoá học…</Loading>}
        {error && <ErrorBox onRetry={reload}>{error}</ErrorBox>}
        {data && (unassigned ? (
          <>
            <h2>Chưa xếp khoá</h2>
            <LessonList lessons={data.items || []} />
          </>
        ) : (
          <>
            <div className="row row-wrap course-heading">
              <div className="grow"><h2>{data.label || data.name}</h2>{data.description && <p>{data.description}</p>}</div>
              {canAuthor && <Link className="ui-btn ui-btn-primary" to={`/learn/lessons/new?course=${encodeURIComponent(category)}`}
                data-testid="course-new-lesson">+ Bài học trong khoá này</Link>}
            </div>
            <LessonList lessons={data.lessons || []} canArrange={data.can_arrange}
              onMove={async (from, to) => {
                const ids = data.lessons.map((x) => x.id)
                ;[ids[from], ids[to]] = [ids[to], ids[from]]
                try { await api.orderCourse(category, ids); await reload() } catch (e) { toast(e.message, { tone: 'bad' }) }
              }} />
            <section className="panel course-exam" data-testid="course-exam">
              <div className="row row-wrap"><div className="grow"><h3>Thi sau khoá</h3>
                {data.exam ? <p>{data.exam.blueprint.reduce((n, r) => n + r.count, 0)} câu · {data.exam.duration_min} phút · đạt {data.exam.pass_score}% · {data.exam.attempts} lượt</p>
                  : <p className="muted">Khoá chưa có bài thi.</p>}
              </div>
              {data.can_arrange && <button type="button" className="ui-btn" data-testid="course-exam-edit"
                onClick={() => exam.open('1')}>{data.exam ? 'Sửa cài đặt thi' : 'Đặt bài thi'}</button>}</div>
            </section>
            {data.can_arrange && exam.value && <CourseExamDrawer slug={category} course={data} onClose={exam.close} onSaved={reload} />}
          </>
        ))}
      </section>
    </div>
  )
}

function LessonList({ lessons, canArrange = false, onMove }) {
  if (!lessons.length) return <p className="muted">Khoá này chưa có bài học.</p>
  return <ol className="course-lesson-list">
    {lessons.map((l, i) => <li key={l.id} data-testid={`course-lesson-${i + 1}`}>
      <span className="course-lesson-no">{l.no || i + 1}.</span>
      <Link className="link grow" to={`/learn/lessons/${l.id}`}>{l.title}</Link>
      <span className="muted small">{l.item_count} thẻ</span>
      <Badge tone={l.status === 'published' ? 'good' : 'warn'}>{l.status === 'published' ? 'Đã phát hành' : 'Nháp'}</Badge>
      {l.has_quiz && <Badge tone="info">Có kiểm tra</Badge>}
      {l.my_result && <span className="muted small">{l.my_result.passed ? 'Đã đạt' : 'Chưa đạt'} · tốt nhất {l.my_result.best_pct ?? '—'}%</span>}
      {canArrange && <span className="course-move-actions">
        <button type="button" className="ui-btn ui-btn-sm" disabled={i === 0} aria-label={`Xếp lên: ${l.title}`}
          data-testid={`course-move-up-${i + 1}`} onClick={() => onMove(i, i - 1)}>↑</button>
        <button type="button" className="ui-btn ui-btn-sm" disabled={i === lessons.length - 1} aria-label={`Xếp xuống: ${l.title}`}
          data-testid={`course-move-down-${i + 1}`} onClick={() => onMove(i, i + 1)}>↓</button>
      </span>}
    </li>)}
  </ol>
}

function CourseExamDrawer({ slug, course, onClose, onSaved }) {
  const initial = course.exam || { blueprint: [rowDefault], duration_min: 30, pass_score: 70, attempts: 1 }
  const [form, setForm] = useState({ ...initial, lesson_pass_score: course.lesson_pass_score })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const updateRow = (i, patch) => setForm((f) => ({ ...f, blueprint: f.blueprint.map((r, j) => j === i ? { ...r, ...patch } : r) }))
  const save = async () => {
    setBusy(true); setError('')
    try {
      await api.saveCourseSettings(slug, { exam: { blueprint: form.blueprint, duration_min: Number(form.duration_min),
        pass_score: Number(form.pass_score), attempts: Number(form.attempts) }, lesson_pass_score: Number(form.lesson_pass_score) })
      toast('Đã lưu cài đặt thi khoá'); onSaved(); onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <Drawer open title="Thi sau khoá" sub={course.label || course.name} onClose={onClose} testId="course-exam-drawer"
    footer={<><button type="button" className="ui-btn" onClick={onClose}>Huỷ</button>
      <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={save}>Lưu cài đặt</button></>}>
    <ErrorBox>{error}</ErrorBox>
    <div className="row row-wrap">
      <label className="field"><span>Thời gian (phút)</span><input type="number" min="1" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} /></label>
      <label className="field"><span>Điểm đạt thi (%)</span><input type="number" min="0" max="100" value={form.pass_score} onChange={(e) => setForm({ ...form, pass_score: e.target.value })} /></label>
      <label className="field"><span>Số lượt thi</span><input type="number" min="1" max="5" value={form.attempts} onChange={(e) => setForm({ ...form, attempts: e.target.value })} /></label>
      <label className="field"><span>Điểm đạt bài (%)</span><input type="number" min="0" max="100" value={form.lesson_pass_score} onChange={(e) => setForm({ ...form, lesson_pass_score: e.target.value })} /></label>
    </div>
    <h4>Ma trận đề</h4>
    {form.blueprint.map((r, i) => <div className="row row-wrap" key={i}>
      <label className="field"><span>Loại câu</span><select value={r.kind || 'single'} onChange={(e) => updateRow(i, { kind: e.target.value })}>
        <option value="single">Một đáp án</option><option value="multi">Nhiều đáp án</option><option value="essay">Tự luận</option>
      </select></label>
      <label className="field"><span>Số câu</span><input type="number" min="1" value={r.count} onChange={(e) => updateRow(i, { count: e.target.value })} /></label>
      <button type="button" className="ui-btn ui-btn-sm" aria-label={`Bỏ dòng ${i + 1}`} disabled={form.blueprint.length < 2}
        onClick={() => setForm({ ...form, blueprint: form.blueprint.filter((_, j) => i !== j) })}>Bỏ dòng</button>
    </div>)}
    <button type="button" className="ui-btn" onClick={() => setForm({ ...form, blueprint: [...form.blueprint, rowDefault] })}>+ Thêm dòng</button>
  </Drawer>
}
