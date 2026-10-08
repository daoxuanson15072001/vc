// Một lộ trình (docs/BA.md mục 17.3–17.7 — LRN-03, 05, 07; DESIGN Phần V SCR-16, TPL-B): h1 = tên lộ trình, breadcrumb
// Học tập › Lộ trình học; tab trên URL ?tab= — Nội dung · Giao bài · Đã giao (n) · Đề thi. Sửa bản nháp (tuần → bài học,
// mục bắt buộc, ma trận đề thi) → Phát hành (khoá nội dung) → Giao cho người / đơn vị / chức năng trong cây dưới quyền →
// theo dõi tiến độ. Chân trang Lưu nháp / Phát hành chỉ có khi còn sửa được. Kết quả lưu / phát hành / giao báo bằng toast.
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { useUrlState } from '../../urlState'
import { Badge, ErrorBox, Loading } from '../../components/ui'
import { PageHeader } from '../../components/PageHeader'
import { Tabs } from '../../components/Tabs'
import { confirmDialog } from '../../components/dialog'
import { toast } from '../../components/toast'
import './learn.css'
import { PATH_STATUS, periodLabel, StatusBadge } from './common'
import { ContentPanel, ExamPanel, usePathEditor } from './paths/PathEditor'
import { ContentView, ExamView } from './paths/PathReadonly'
import PathAssign from './paths/PathAssign'
import PathAssigned from './paths/PathAssigned'

const TABS = ['content', 'assign', 'assigned', 'exam']

export default function PathEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: p, error, setData, reload } = useFetch(() => api.path(id), [id])
  if (error) return (
    <>
      <PageHeader title="Lộ trình học" />
      <ErrorBox onRetry={reload} testId="path-error">{error}</ErrorBox>
      <Link className="link" to="/learn/library?tab=paths">‹ Về thư viện lộ trình</Link>
    </>
  )
  if (!p) return <Loading />
  const refresh = () => api.path(id).then(setData)
  return (
    <>
      <PageHeader
        title={p.title}
        crumbs={[{ label: 'Học tập' }, { label: 'Thư viện', to: '/learn/library?tab=paths' }]}
        meta={<StatusBadge map={PATH_STATUS} status={p.status} />}
      >
        <div className="meta">
          <span>{periodLabel(p)}</span>
          <span>người tạo: {p.owner_name}</span>
          {p.from_ai && <Badge tone="info">AI dựng</Badge>}
          {p.parent && <span>kế thừa khung: {p.parent.title}</span>}
          {p.can_copy && <button type="button" className="ui-btn ui-btn-sm" data-testid="path-copy" onClick={async () => {
            try { const copy = await api.copyPath(id); toast('Đã sao chép thành bản nháp.'); navigate(`/learn/paths/${copy.id}`) }
            catch (e) { toast(`Không sao chép được: ${e.message}`, { tone: 'error' }) }
          }}>Sao chép</button>}
        </div>
      </PageHeader>
      {p.can_edit ? (p.kind === 'courses' ? <CourseEditableBody key={p.updated_at} p={p} onSaved={setData} refresh={refresh} /> : <EditableBody key={p.updated_at} p={p} onSaved={setData} refresh={refresh} />) : <PathTabs p={p} refresh={refresh} content={<ContentView p={p} />} exam={<ExamView p={p} />} />}
    </>
  )
}

function PathTabs({ p, refresh, content, exam }) {
  const [st, set] = useUrlState({ tab: { default: 'content', values: TABS } })
  const items = [
    { id: 'content', label: 'Nội dung', testId: 'path-tab-content', content },
    (p.can_edit || p.assignable) && { id: 'assign', label: 'Giao bài', testId: 'path-tab-assign', content: <PathAssign p={p} onDone={refresh} /> },
    p.assignments && { id: 'assigned', label: 'Đã giao', count: p.assignments.length, testId: 'path-tab-assigned', content: <PathAssigned p={p} /> },
    p.kind !== 'courses' && { id: 'exam', label: 'Đề thi', testId: 'path-tab-exam', content: exam },
  ].filter(Boolean)
  return <Tabs label="Lộ trình" items={items} value={st.tab} onChange={(tab) => set({ tab }, { push: true })} />
}

function CourseEditableBody({ p, onSaved, refresh }) {
  const [, setTab] = useUrlState({ tab: { default: 'content', values: TABS } })
  const [title, setTitle] = useState(p.title)
  const [description, setDescription] = useState(p.description || '')
  const [courses, setCourses] = useState((p.courses || []).map((c) => ({ ...c })))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async (publish = false) => {
    setBusy(true); setErr('')
    try {
      let out = await api.patchPath(p.id, { title, description, kind: 'courses', courses })
      if (publish) out = await api.publishPath(p.id)
      onSaved(out); toast(publish ? 'Đã phát hành lộ trình.' : 'Đã lưu nháp lộ trình.')
      return true
    } catch (e) { setErr(e.message); return false } finally { setBusy(false) }
  }
  const publish = async () => {
    if (!(await confirmDialog({ title: 'Phát hành lộ trình?', body: 'Sau khi phát hành, nội dung sẽ bị khoá.', okLabel: 'Phát hành' }))) return
    if (await save(true)) setTab({ tab: 'assign' }, { push: true })
  }
  return <>
    <PathTabs p={p} refresh={refresh} content={<div className="lrn-form" data-testid="course-path-editor">
      <label className="field"><span>Tên lộ trình</span><input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="path-title" /></label>
      <label className="field"><span>Mô tả</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} data-testid="path-description" /></label>
      {(courses || []).map((c, i) => <CoursePathCourse key={c.category} course={c} index={i} total={courses.length}
        onChange={(patch) => setCourses(cs => cs.map((x,j) => j === i ? {...x, ...patch} : x))}
        onMove={(to) => setCourses(cs => { const n=[...cs]; [n[i],n[to]]=[n[to],n[i]]; return n })}
        onRemove={() => setCourses(cs => cs.filter((_,j) => j !== i))} />)}
    </div>} exam={null} />
    <ErrorBox>{err}</ErrorBox>
    <div className="lrn-foot"><button className="ui-btn" disabled={busy} onClick={() => save()}>Lưu nháp</button><button className="ui-btn ui-btn-primary" disabled={busy} onClick={publish}>Phát hành</button></div>
  </>
}

function CoursePathCourse({ course, index, total, onChange, onMove, onRemove }) {
  const { data } = useFetch(() => api.course(course.category), [course.category])
  const lessons = data?.lessons || []
  const ids = course.lesson_ids == null ? lessons.map((x) => x.id) : course.lesson_ids
  const ordered = ids.map((id) => lessons.find((x) => x.id === id)).filter(Boolean)
  const moveLesson = (from, to) => { const next=[...ids]; [next[from], next[to]]=[next[to], next[from]]; onChange({ lesson_ids: next }) }
  return <div className="panel" data-testid={`path-edit-course-${course.category}`}>
    <div className="row row-wrap"><b className="grow">{index + 1}. {data?.name || course.category}</b>
      <label className="field field-sm"><span>Ngày</span><input type="number" min="1" value={course.days} onChange={(e) => onChange({ days:Number(e.target.value) })} /></label>
      <label className="row"><input type="checkbox" checked={course.required} onChange={(e) => onChange({ required:e.target.checked })} />Bắt buộc</label>
      <button type="button" className="ui-btn" disabled={!index} aria-label="Xếp khoá lên" onClick={() => onMove(index-1)}>↑</button>
      <button type="button" className="ui-btn" disabled={index === total-1} aria-label="Xếp khoá xuống" onClick={() => onMove(index+1)}>↓</button>
      <button type="button" className="ui-btn ui-btn-danger" disabled={total === 1} onClick={onRemove}>Bỏ khoá</button>
    </div>
    <ol>{ordered.map((lesson, i) => <li key={lesson.id} className="row"><span className="grow">{lesson.title}</span>
      <button type="button" className="ui-btn ui-btn-sm" disabled={!i} aria-label={`Xếp bài ${lesson.title} lên`} onClick={() => moveLesson(i,i-1)}>↑</button>
      <button type="button" className="ui-btn ui-btn-sm" disabled={i === ordered.length-1} aria-label={`Xếp bài ${lesson.title} xuống`} onClick={() => moveLesson(i,i+1)}>↓</button>
    </li>)}</ol>
  </div>
}

function EditableBody({ p, onSaved, refresh }) {
  const ed = usePathEditor(p, onSaved)
  const [, set] = useUrlState({ tab: { default: 'content', values: TABS } })
  const publish = async () => {
    const ok = await confirmDialog({
      title: 'Phát hành lộ trình? Sau khi phát hành nội dung bị khoá.',
      body: 'Bài học nháp của bạn trong lộ trình được phát hành cùng.', okLabel: 'Phát hành lộ trình',
    })
    if (!ok) return
    if (await ed.save(true)) {
      toast('Đã phát hành lộ trình — nội dung đã khoá, giao bài cho người học ở tab Giao bài.')
      set({ tab: 'assign' }, { push: true })
    }
  }
  return (
    <>
      <PathTabs p={p} refresh={refresh} content={<ContentPanel p={p} ed={ed} />} exam={<ExamPanel p={p} ed={ed} />} />
      <ErrorBox testId="path-error">{ed.err}</ErrorBox>
      <div className="lrn-foot" data-testid="path-foot">
        <span className="muted small grow">Phát hành: khoá nội dung; bài học nháp của bạn trong lộ trình được phát hành cùng.</span>
        <button type="button" className="ui-btn" disabled={ed.busy} data-testid="path-save"
          onClick={async () => { if (await ed.save(false)) toast('Đã lưu nháp lộ trình.') }}>Lưu nháp</button>
        <button type="button" className="ui-btn ui-btn-primary" disabled={ed.busy} data-testid="path-publish" onClick={publish}>Phát hành</button>
      </div>
    </>
  )
}
