import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { useSession } from '../../../session'
import { Drawer, useUrlOverlay } from '../../../components/Overlay'
import { ErrorBox, Loading } from '../../../components/ui'
import { LessonMaterials } from './MaterialsForm'
import { Markdown } from '../../../components/markdown'
import { WorkPanel } from './PracticalPanel'

export function LearningRoutes() {
  const { user } = useSession()
  const { data, error, reload } = useFetch(() => api.trainingDocuments(), [])
  const overlay = useUrlOverlay('learningRoute')
  const rows = (data?.items || []).filter(x => ['class', 'route'].includes(x.kind) && x.status === 'published' && x.learner_ids.includes(user?.id))
  return <section className="stack" data-testid="training-my-learning"><h2>Lớp và lộ trình cá nhân</h2><ErrorBox onRetry={reload}>{error}</ErrorBox>
    {!data && !error && <Loading>Đang tải lớp học…</Loading>}
    {rows.length === 0 && data && <p className="muted">Chưa có lớp / lộ trình cá nhân mới được giao.</p>}
    {rows.map(x => <section className="panel" key={x.id}><h3>{x.title}</h3><p>{x.goal || x.outcome}</p><button type="button" className="ui-btn" onClick={() => overlay.open(x.id)}>Tiếp tục học</button></section>)}
    {overlay.value && rows.find(x => x.id === overlay.value) && <RouteDrawer document={rows.find(x => x.id === overlay.value)} onClose={overlay.close} />}
    <WorkPanel />
  </section>
}
function RouteDrawer({ document: doc, onClose }) {
  const navigate = useNavigate()
  const { data: progress, error, reload } = useFetch(() => api.learningDocumentProgress(doc.id), [doc.id])
  const [lessonId, sl] = useState('')
  const { data: lesson, error: lessonError } = useFetch(() => lessonId ? api.lesson(lessonId) : Promise.resolve(null), [lessonId])
  const [saveError, se] = useState(''); const [busy, sb] = useState(false)
  const receipt = async i => { sb(true); se(''); try { await api.acknowledgeLearningMaterial(doc.id, { lesson_id: lessonId, material_index: i }); reload() } catch(e) { se(e.message) } finally { sb(false) } }
  return <Drawer open title={doc.title} onClose={onClose} testId="training-route-learning"><div className="stack">
    <ErrorBox onRetry={reload}>{error || lessonError || saveError}</ErrorBox>
    {!progress && !error && <Loading>Đang tải tiến độ…</Loading>}
    {progress && <><p role="status">{progress.completed ? 'Đã hoàn thành' : 'Đang học'} · Dự án {progress.projects_passed ? 'đã đạt' : 'chưa đạt'}</p><ol>{progress.items.map((x, i) => <li key={x.lesson_id}><button type="button" className="link" onClick={() => sl(x.lesson_id)}>Bài {i + 1} · {x.title}</button><p>{x.equivalency ? 'Đã được công nhận học liệu / kiểm tra · ' : ''}{x.completed ? 'Đã hoàn thành' : `${x.materials_done}/${x.materials_required} học liệu bắt buộc · kiểm tra ${x.quiz_passed ? 'đạt' : 'chưa đạt'} · thực hành ${x.practical_passed ? 'đạt' : 'chưa đạt'}`}</p></li>)}</ol></>}
    {progress?.exams?.map(e => <section className="panel" key={e.curriculum_id}><h3>Thi cuối môn · {e.title}</h3><p>{e.passed ? 'Đã đạt' : 'Chưa đạt'}</p><button type="button" className="ui-btn" disabled={busy} onClick={async () => { sb(true); se(''); try { const a = await api.startTrainingExam(doc.id, e.curriculum_id); navigate('/learn/attempts/' + a.id) } catch(error) { se(error.message) } finally { sb(false) } }}>{e.attempt_id ? 'Tiếp tục / làm lại bài thi' : 'Bắt đầu thi'}</button>{e.attempt_id && <Link className="ui-btn" to={'/learn/attempts/' + e.attempt_id}>Xem lượt thi</Link>}</section>)}
    {lesson && <><h3>{lesson.title}</h3><Markdown text={lesson.narrative || ''} /><LessonMaterials materials={lesson.materials || []} renderCard={id => { const card = lesson.items.find(c => c.card_id === id); return card && !card.unavailable ? <Markdown text={card.body || card.summary || ''} /> : <p>Không có quyền xem thẻ.</p> }} />
      {(lesson.materials || []).map((m, i) => !m.unavailable && <button type="button" className="ui-btn" key={i} disabled={busy} onClick={() => receipt(i)} aria-label={`Xác nhận đã học: ${m.title}`}>Đã {m.kind === 'card' || m.kind === 'slides' ? 'đọc' : ['podcast', 'talk_audio'].includes(m.kind) ? 'nghe' : 'xem'} {m.title}</button>)}
      {lesson.practice_count > 0 && <Link className="ui-btn" to={`/learn/lessons/${lesson.id}?practice=1`}>Làm kiểm tra sau bài</Link>}
      <p>Thực hành / dự án bắt buộc phải nộp và được chấm đạt; mở học liệu chưa đủ hoàn thành.</p>
    </>}
  </div></Drawer>
}
