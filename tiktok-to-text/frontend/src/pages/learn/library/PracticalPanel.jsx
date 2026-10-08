import { useState } from 'react'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { useSession } from '../../../session'
import { Drawer, useUrlOverlay } from '../../../components/Overlay'
import { ErrorBox, Empty, Loading } from '../../../components/ui'
import { SpaceSelect } from '../../../components/pickers'
import { PeoplePicker } from './TrainingPeople'
import { confirmDialog } from '../../../components/dialog'
import { toast } from '../../../components/toast'

export function PracticalPanel({ subjectId, lessonId, canAuthor = false }) {
  const { data, error, reload } = useFetch(() => api.learningTasks({ subject_id: subjectId, lesson_id: lessonId }), [subjectId, lessonId])
  const overlay = useUrlOverlay('task')
  return <section className="stack"><h3>Thực hành và dự án</h3>
    {canAuthor && <button type="button" className="ui-btn" onClick={() => overlay.open('new')}>+ Nhiệm vụ thực hành</button>}
    <ErrorBox onRetry={reload}>{error}</ErrorBox>
    {!data && !error && <Loading>Đang tải nhiệm vụ…</Loading>}
    {data && !data.items.length && <Empty>Chưa có nhiệm vụ thực hành.</Empty>}
    {data?.items.map(t => <section className="panel stack" key={t.id}><h4>{t.title}</h4><p>{t.mission}</p><p>Đầu vào: {t.inputs}</p><p>Sản phẩm: {t.deliverable}</p><p>{t.guidance}</p><ul>{t.rubric.map((r, i) => <li key={i}>{r.title} · {r.weight}% · {r.descriptor}</li>)}</ul><p>Đạt từ {t.pass_score}% · {t.required ? 'Bắt buộc' : 'Tham khảo'} · {t.mode === 'group' ? 'Nhóm, cần minh chứng từng người' : 'Cá nhân'}</p>
      {canAuthor && <div className="actions">{t.status !== 'published' && <button type="button" className="ui-btn" onClick={async () => { try { await api.learningTaskAction(t.id, t.status === 'draft' ? 'approve' : 'publish', t.revision); reload(); toast('Đã cập nhật trạng thái nhiệm vụ') } catch(e) { toast(e.message, { tone: 'bad' }) } }}>{t.status === 'draft' ? 'Duyệt nhiệm vụ' : 'Phát hành nhiệm vụ'}</button>}<button type="button" className="ui-btn" onClick={async () => { try { await api.learningTaskAction(t.id, 'copy'); reload() } catch(e) { toast(e.message, { tone: 'bad' }) } }}>Tạo bản sao</button></div>}
      {t.can_edit && <button type="button" className="ui-btn" onClick={async () => { if (!await confirmDialog({ title: 'Xoá nhiệm vụ chưa dùng?', body: t.title, okLabel: 'Xoá nhiệm vụ' })) return; try { await api.deleteLearningTask(t.id); reload(); toast('Đã xoá nhiệm vụ') } catch(e) { toast(e.message, { tone: 'bad' }) } }}>Xoá nhiệm vụ</button>}
      {t.can_edit && <button type="button" className="ui-btn" onClick={() => overlay.open('edit:' + t.id)}>Sửa nhiệm vụ</button>}
      {canAuthor && t.status === 'published' && <button type="button" className="ui-btn" onClick={() => overlay.open(t.id)}>Giao nhiệm vụ</button>}
    </section>)}
    {overlay.value && <TaskDrawer key={overlay.value} editing={overlay.value.startsWith('edit:')} task={data?.items.find(t => t.id === overlay.value.replace('edit:', ''))} subjectId={subjectId} lessonId={lessonId} onClose={overlay.close} onSaved={reload} />}
  </section>
}

function TaskDrawer({ task, editing = false, subjectId, lessonId, onClose, onSaved }) {
  const { data: spaces } = useFetch(() => api.spaces(), [])
  const [f, sf] = useState({ title: '', kind: 'exercise', subject_id: subjectId, lesson_id: lessonId || null, mission: '', inputs: '', deliverable: '', guidance: '', mode: 'individual', required: true, pass_score: 70, max_attempts: 3, rubric: [{ title: '', weight: 100, descriptor: '' }], ...(editing ? Object.fromEntries(['title', 'kind', 'subject_id', 'lesson_id', 'mission', 'inputs', 'deliverable', 'guidance', 'mode', 'required', 'pass_score', 'max_attempts', 'rubric'].map(k => [k, task[k]])) : {}) })
  const [space, ss] = useState(''); const [err, se] = useState(''); const [busy, sb] = useState(false)
  const { data: documents } = useFetch(() => api.trainingDocuments(), [])
  const [assign, sa] = useState({ learner_ids: [], mentor_id: '', grader_id: '', document_id: '', due_at: '' })
  const update = (key, v) => sf({ ...f, [key]: v })
  const save = async e => { e.preventDefault(); sb(true); se(''); try {
    if (task && !editing) await api.assignLearningTask(task.id, { ...assign, document_id: assign.document_id || null, learner_ids: assign.learner_ids, due_at: new Date(assign.due_at).toISOString() })
    else if (editing) await api.updateLearningTask(task.id, { ...f, revision: task.revision })
    else await api.createLearningTask({ ...f, space_id: space || null })
    onSaved(); onClose(); toast(task && !editing ? 'Đã giao nhiệm vụ' : 'Đã lưu nhiệm vụ')
  } catch(e) { se(e.message) } finally { sb(false) } }
  return <Drawer open title={task ? `${editing ? 'Sửa' : 'Giao'}: ${task.title}` : 'Nhiệm vụ thực hành mới'} onClose={onClose} testId="training-task-form"><form className="stack" onSubmit={save}>
    {task && !editing ? <>
      <PeoplePicker label="Người học" multiple required value={assign.learner_ids} onChange={v => sa({ ...assign, learner_ids: v })} />
      <PeoplePicker label="Người hướng dẫn" required value={assign.mentor_id} onChange={v => sa({ ...assign, mentor_id: v })} />
      <PeoplePicker label="Người chấm" required value={assign.grader_id} onChange={v => sa({ ...assign, grader_id: v })} />
      <label className="field"><span>Lớp / lộ trình (tuỳ chọn)</span><select value={assign.document_id} onChange={e => sa({ ...assign, document_id: e.target.value })}><option value="">Giao thực hành độc lập</option>{documents?.items.filter(x => ['class', 'route'].includes(x.kind) && x.status === 'published').map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
      <label className="field"><span>Hạn nộp</span><input type="datetime-local" required value={assign.due_at} onChange={e => sa({ ...assign, due_at: e.target.value })} /></label>
    </> : <>
      {['title', 'mission', 'inputs', 'deliverable', 'guidance'].map(k => <label className="field" key={k}><span>{{ title: 'Tên nhiệm vụ', mission: 'Nhiệm vụ', inputs: 'Dữ liệu đầu vào', deliverable: 'Sản phẩm phải nộp', guidance: 'Hướng dẫn' }[k]}</span><textarea required={k !== 'guidance'} value={f[k]} onChange={e => update(k, e.target.value)} /></label>)}
      {!editing && <SpaceSelect spaces={spaces} value={space} onChange={ss} editableOnly label="Lưu vào kho" />}
      <label className="field"><span>Loại</span><select value={f.kind} onChange={e => update('kind', e.target.value)}><option value="exercise">Bài tập sau bài</option><option value="project">Dự án cuối môn</option></select></label>
      <label className="field"><span>Hình thức</span><select value={f.mode} onChange={e => update('mode', e.target.value)}><option value="individual">Cá nhân</option><option value="group">Nhóm, minh chứng từng người</option></select></label>
      <label className="field"><span>Điểm đạt (%)</span><input type="number" min={0} max={100} value={f.pass_score} onChange={e => update('pass_score', Number(e.target.value))} /></label>
      <label className="field"><span>Số lượt nộp tối đa</span><input type="number" min={1} max={10} value={f.max_attempts} onChange={e => update('max_attempts', Number(e.target.value))} /></label>
      <label><input type="checkbox" checked={f.required} onChange={e => update('required', e.target.checked)} /> Bắt buộc đạt</label>
      <h4>Tiêu chí đánh giá (tổng trọng số 100%)</h4>
      {f.rubric.map((r, i) => <section className="panel stack" key={i}>{['title', 'weight', 'descriptor'].map(k => <label className="field" key={k}><span>{{ title: 'Tiêu chí', weight: 'Trọng số (%)', descriptor: 'Mô tả mức đạt' }[k]}</span><input required={k !== 'descriptor'} type={k === 'weight' ? 'number' : 'text'} min={1} max={100} value={r[k]} onChange={e => update('rubric', f.rubric.map((x, j) => j === i ? { ...x, [k]: k === 'weight' ? Number(e.target.value) : e.target.value } : x))} /></label>)}<button type="button" className="ui-btn" onClick={() => update('rubric', f.rubric.filter((_, j) => i !== j))}>Bỏ tiêu chí {i + 1}</button></section>)}
      <button type="button" className="ui-btn" onClick={() => update('rubric', [...f.rubric, { title: '', weight: 10, descriptor: '' }])}>+ Tiêu chí</button>
    </>}
    <ErrorBox>{err}</ErrorBox><button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>{task && !editing ? 'Giao nhiệm vụ' : 'Lưu nhiệm vụ'}</button>
  </form></Drawer>
}

const WORK_STATUS = { assigned: 'Chưa nộp', submitted: 'Chờ chấm', passed: 'Đã đạt', retry: 'Cần làm lại' }
export function WorkPanel() {
  const { user } = useSession()
  const { data, error, reload } = useFetch(() => api.learningWork(), [])
  const overlay = useUrlOverlay('work')
  return <section className="stack"><h2>Thực hành được giao</h2><ErrorBox onRetry={reload}>{error}</ErrorBox>
    {!data && !error && <Loading>Đang tải thực hành…</Loading>}
    {data && !data.items.length && <Empty>Chưa có thực hành được giao.</Empty>}
    {data?.items.map(w => <section className="panel" key={w.id} data-status={w.status}><h3>{w.snapshot.title}</h3><p>{WORK_STATUS[w.status]} · hạn {new Date(w.due_at + (w.due_at.endsWith('Z') ? '' : 'Z')).toLocaleString('vi-VN')}{w.score != null && ` · ${w.score}%`}</p><button type="button" className="ui-btn" data-testid="work-open" onClick={() => overlay.open(w.id)}>Xem nhiệm vụ và kết quả</button></section>)}
    {overlay.value && data?.items.find(w => w.id === overlay.value) && <WorkDrawer key={overlay.value} work={data.items.find(w => w.id === overlay.value)} userId={user?.id || user?._id} onClose={overlay.close} onSaved={reload} />}
  </section>
}
function WorkDrawer({ work: w, userId, onClose, onSaved }) {
  const { data: people } = useFetch(() => api.orgPeople(), [])
  const name = id => people?.find(x => x.id === id)?.name || 'Thành viên'
  const task = w.snapshot
  const [f, sf] = useState({ product: '', links: '', contributions: Object.fromEntries(w.learner_ids.map(id => [id, ''])) })
  const [g, sg] = useState({ scores: task.rubric.map(() => 0), feedback: '', individual_feedback: Object.fromEntries(w.learner_ids.map(id => [id, ''])) })
  const [err, se] = useState(''); const [busy, sb] = useState(false)
  const learner = w.learner_ids.includes(userId)
  const grader = w.grader_id === userId
  const save = async (grade) => { sb(true); se(''); try {
    if (grade) await api.gradeLearningWork(w.id, { ...g, revision: w.revision })
    else await api.submitLearningWork(w.id, { ...f, links: f.links.split('\n').map(x => x.trim()).filter(Boolean), revision: w.revision })
    onSaved(); onClose(); toast(grade ? 'Đã chốt điểm' : 'Đã nộp thực hành')
  } catch(e) { se(e.message) } finally { sb(false) } }
  return <Drawer open title={task.title} onClose={onClose} testId="work-form"><div className="stack"><p>{task.mission}</p><p>Đầu vào: {task.inputs}</p><p>Sản phẩm: {task.deliverable}</p><p>{task.guidance}</p><ul>{task.rubric.map((r, i) => <li key={i}>{r.title} · {r.weight}% · {r.descriptor}</li>)}</ul>
    {w.submissions.map((s, i) => <section className="panel" key={i}><h4>Lượt {i + 1}{s.late && ' · Nộp muộn'}</h4><p>{s.product}</p>{s.links.map(url => <p key={url}><a href={url} target="_blank" rel="noreferrer">Xem sản phẩm</a></p>)}{Object.entries(s.contributions).map(([id, text]) => <p key={id}>{name(id)}: {text}</p>)}{s.grading && <><p>{s.grading.score}% · {s.grading.feedback}</p>{Object.entries(s.grading.individual_feedback).map(([id, text]) => <p key={id}>{name(id)}: {text}</p>)}</>}</section>)}
    {learner && ['assigned', 'retry'].includes(w.status) && <>
      <label className="field"><span>Sản phẩm / nội dung nộp</span><textarea value={f.product} onChange={e => sf({ ...f, product: e.target.value })} data-testid="work-product" /></label>
      <label className="field"><span>Liên kết sản phẩm HTTPS (mỗi dòng một liên kết)</span><textarea value={f.links} onChange={e => sf({ ...f, links: e.target.value })} /></label>
      {task.mode === 'group' && w.learner_ids.map(id => <label className="field" key={id}><span>Minh chứng đóng góp: {name(id)}</span><textarea value={f.contributions[id]} onChange={e => sf({ ...f, contributions: { ...f.contributions, [id]: e.target.value } })} /></label>)}
      <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => save(false)}>Nộp thực hành</button>
    </>}
    {grader && w.status === 'submitted' && <>
      {task.rubric.map((r, i) => <label className="field" key={i}><span>Điểm {r.title} (0…100)</span><input type="number" min={0} max={100} value={g.scores[i]} onChange={e => sg({ ...g, scores: g.scores.map((x, j) => i === j ? Number(e.target.value) : x) })} /></label>)}
      <label className="field"><span>Nhận xét bắt buộc</span><textarea value={g.feedback} onChange={e => sg({ ...g, feedback: e.target.value })} /></label>
      {task.mode === 'group' && w.learner_ids.map(id => <label className="field" key={id}><span>Đánh giá đóng góp: {name(id)}</span><textarea value={g.individual_feedback[id]} onChange={e => sg({ ...g, individual_feedback: { ...g.individual_feedback, [id]: e.target.value } })} /></label>)}
      <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => save(true)}>Chốt điểm thực hành</button>
    </>}
    <ErrorBox>{err}</ErrorBox>
  </div></Drawer>
}
