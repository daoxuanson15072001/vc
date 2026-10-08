import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { useUrlState } from '../../../urlState'
import { Tabs } from '../../../components/Tabs'
import { Tree } from '../../../components/Tree'
import { Drawer, useUrlOverlay } from '../../../components/Overlay'
import { ErrorBox, Loading, Empty } from '../../../components/ui'
import { SpaceSelect } from '../../../components/pickers'
import { confirmDialog } from '../../../components/dialog'
import { toast } from '../../../components/toast'
import { PeoplePicker, UnitPicker } from './TrainingPeople'
import { PracticalPanel } from './PracticalPanel'

const KINDS = { faculty: 'Khoa', department: 'Bộ môn', subject: 'Môn học', curriculum: 'Giáo trình', plan: 'Giáo án', program: 'Chương trình học', class: 'Lớp học', route: 'Lộ trình cá nhân' }
const STATUS = { draft: 'Nháp', approved: 'Đã duyệt', published: 'Đã phát hành' }
const docFields = ['kind', 'title', 'subject_id', 'curriculum_id', 'plan_id', 'program_id', 'audience', 'current_level', 'entry', 'outcome', 'goal', 'lesson_ids', 'task_ids', 'exam', 'curriculum_ids', 'sessions', 'teacher_ids', 'learner_ids', 'adjustments', 'revision']
const treeOf = (items, parent = null) => items.filter(x => (x.parent_id || null) === parent).map(x => ({ id: x.id, label: x.title, children: treeOf(items, x.id) }))

export function TrainingPanel({ mode, canAuthor }) {
  const navigate = useNavigate()
  const [st, set] = useUrlState({ subject: { default: '' }, section: { default: 'lessons', values: ['lessons', 'curriculum', 'plan', 'practical'] } })
  const { data: structure, error: se, reload: rs } = useFetch(() => api.trainingStructure(), [])
  const { data: lessons, error: le, reload: rl } = useFetch(() => api.lessons({ subject_id: st.subject || undefined, page_size: 100 }), [st.subject])
  const { data: docs, error: de, reload: rd } = useFetch(() => api.trainingDocuments(), [])
  const nodeOverlay = useUrlOverlay('trainingNode')
  const docOverlay = useUrlOverlay('trainingDoc')
  const [newKind, setNewKind] = useState('subject')
  const nodes = structure?.items || []
  const subjects = nodes.filter(x => x.kind === 'subject')
  const selected = subjects.find(x => x.id === st.subject)
  const lessonNodes = treeOf(nodes)
  const appendLessons = rows => rows.map(x => ({ ...x, children: x.id === st.subject ? (lessons?.items || []).map(l => ({ id: 'lesson:' + l.id, label: l.title, children: [] })) : appendLessons(x.children) }))
  const refresh = () => { rs(); rl(); rd() }
  const newNode = kind => { setNewKind(kind); nodeOverlay.open('new') }
  const newDoc = kind => { setNewKind(kind); docOverlay.open(`new-${kind}`) }
  const remove = async (row, node) => {
    if (!await confirmDialog({ title: `Xoá ${KINDS[row.kind] || 'bài học'}?`, body: row.title, okLabel: 'Xoá bản nháp chưa dùng' })) return
    try { if (node) await api.deleteTrainingNode(row.id); else if (row.kind) await api.deleteTrainingDocument(row.id); else await api.deleteLesson(row.id); refresh(); toast('Đã xoá') }
    catch (e) { toast(e.message, { tone: 'bad' }) }
  }
  const docList = kind => <section className="stack" data-testid={`training-${kind}`}>
    {canAuthor && <button type="button" className="ui-btn" onClick={() => newDoc(kind)} data-testid={`training-${kind}-new`}>+ {KINDS[kind]} mới</button>}
    <DocumentList rows={(docs?.items || []).filter(x => x.kind === kind && (!st.subject || mode === 'programs' || x.subject_id === st.subject))}
      onOpen={row => docOverlay.open(row.id)} onDelete={row => remove(row, false)} />
  </section>
  const lessonList = <section className="stack">
    {canAuthor && mode !== 'lessons' && <Link className="ui-btn ui-btn-primary" to={`/learn/lessons/new${st.subject ? '?subject=' + st.subject : ''}`}>+ Bài học mới</Link>}
    {!lessons ? <Loading>Đang tải bài học…</Loading> : !lessons.items.length ? <Empty>Chưa có bài học. Người soạn có thể tạo bài và chọn môn.</Empty> : <ul className="list">{lessons.items.map(l => <li key={l.id} className="row row-wrap" data-id={l.id} data-status={l.status}>
      <Link className="link grow" to={`/learn/lessons/${l.id}`}>{l.title}</Link><span>{STATUS[l.status] || l.status}{!l.subject_id && ' · Kiểu cũ'}</span>
      {l.can_edit && <><Link className="ui-btn ui-btn-sm" to={`/learn/lessons/${l.id}/edit`}>Sửa bài</Link><button type="button" className="ui-btn ui-btn-sm" aria-label={`Xoá bài: ${l.title}`} onClick={() => remove(l, false)}>Xoá</button></>}
    </li>)}</ul>}
  </section>
  return <div className="stack" data-testid="training-library">
    <ErrorBox onRetry={refresh}>{se || le || de}</ErrorBox>
    {!structure && !se && <Loading>Đang tải cấu trúc đào tạo…</Loading>}
    {mode === 'programs' ? <>{docList('program')}{docList('class')}{docList('route')}</> : mode === 'lessons' ? lessonList : <div className="course-library">
      <aside className="course-library-nav" aria-label="Khoa và bộ môn">
        {canAuthor && <div className="actions">{['faculty', 'department', 'subject'].map(k => <button type="button" key={k} className="ui-btn ui-btn-sm" onClick={() => newNode(k)}>+ {KINDS[k]}</button>)}</div>}
        {!nodes.length && <Empty>Chưa có khoa / bộ môn. Tạo cấu trúc đào tạo riêng để bắt đầu.</Empty>}
        <Tree label="Khoa / Bộ môn / Môn học" key={`${st.subject}:${lessons?.total || 0}`} nodes={appendLessons(lessonNodes)} defaultExpanded={[st.subject]} selected={st.subject} testId="training-tree"
          onSelect={id => { if (id.startsWith('lesson:')) { navigate('/learn/lessons/' + id.slice(7)); return } const node = nodes.find(x => x.id === id); if (node?.kind === 'subject') set({ subject: id }, { push: true }); else nodeOverlay.open(id) }} />
        {nodes.filter(x => x.can_edit).map(x => <button type="button" className="link small" key={x.id} onClick={() => nodeOverlay.open(x.id)} aria-label={`Sửa ${KINDS[x.kind]}: ${x.title}`}>Sửa {x.title}</button>)}
      </aside>
      <section className="course-library-content">
        {!selected ? <><h2>Môn học</h2><p>Chọn môn trong cây để mở danh sách bài, giáo trình và giáo án.</p>{subjects.map(x => <p key={x.id}><button type="button" className="link" onClick={() => set({ subject: x.id }, { push: true })}>{x.title}</button></p>)}</> : <>
          <h2>{selected.title}</h2><p>{selected.description}</p>
          <Tabs kind="panel" label="Nội dung môn" value={st.section} onChange={section => set({ section }, { push: true })} items={[
            { id: 'lessons', label: 'Bài học', content: lessonList }, { id: 'curriculum', label: 'Giáo trình', content: docList('curriculum') },
            { id: 'plan', label: 'Giáo án', content: docList('plan') }, { id: 'practical', label: 'Thực hành', content: <PracticalPanel subjectId={selected.id} canAuthor={canAuthor} /> },
          ]} />
        </>}
      </section>
    </div>}
    {nodeOverlay.value && <NodeForm row={nodes.find(x => x.id === nodeOverlay.value)} kind={newKind} nodes={nodes} onClose={nodeOverlay.close} onSaved={refresh} onDelete={row => remove(row, true)} />}
    {docOverlay.value && <DocumentForm key={docOverlay.value} row={(docs?.items || []).find(x => x.id === docOverlay.value)}
      kind={docOverlay.value.startsWith('new-') ? docOverlay.value.slice(4) : newKind} subjectId={st.subject} nodes={nodes} docs={docs?.items || []}
      onClose={docOverlay.close} onSaved={refresh} />}
  </div>
}

function DocumentList({ rows, onOpen, onDelete }) {
  return !rows.length ? <Empty>Chưa có tài liệu.</Empty> : <ul className="list">{rows.map(x => <li key={x.id} className="row row-wrap" data-id={x.id} data-status={x.status}>
    <button type="button" className="link grow" onClick={() => onOpen(x)}>{x.title}</button><span>{STATUS[x.status]} · bản {x.version}</span>
    {x.can_edit && <button type="button" className="ui-btn ui-btn-sm" onClick={() => onDelete(x)} aria-label={`Xoá tài liệu: ${x.title}`}>Xoá</button>}
  </li>)}</ul>
}

export function NodeForm({ row, kind = 'subject', nodes, onClose, onSaved, onDelete, defaultSpace = '' }) {
  const { data: spaces } = useFetch(() => api.spaces(), [])
  const [f, sf] = useState({ kind: row?.kind || kind, title: row?.title || '', description: row?.description || '', parent_id: row?.parent_id || '', space_id: row?.space_id || defaultSpace, owner_unit_id: row?.owner_unit_id || '', teacher_ids: row?.teacher_ids || [], revision: row?.revision || 1 })
  const [err, setErr] = useState(''); const [busy, sb] = useState(false)
  const parents = nodes.filter(x => x.kind === (f.kind === 'subject' ? 'department' : 'faculty'))
  const save = async e => { e.preventDefault(); sb(true); setErr(''); try {
    const body = { ...f, parent_id: f.parent_id || null, space_id: f.space_id || null, owner_unit_id: f.owner_unit_id || null, teacher_ids: f.teacher_ids }
    const result = row ? await api.updateTrainingNode(row.id, body) : await api.createTrainingNode(body)
    onSaved(result); onClose(); toast('Đã lưu cấu trúc đào tạo')
  } catch (e) { setErr(e.message) } finally { sb(false) } }
  return <Drawer open title={`${row ? 'Sửa' : 'Tạo'} ${KINDS[f.kind]}`} onClose={onClose} testId="training-node-form">
    <form className="stack" onSubmit={save}>
      <label className="field"><span>Tên {KINDS[f.kind]}</span><input required value={f.title} onChange={e => sf({ ...f, title: e.target.value })} data-testid="training-node-title" /></label>
      {f.kind !== 'faculty' && <label className="field"><span>{f.kind === 'subject' ? 'Bộ môn' : 'Khoa'} phụ trách</span><select required value={f.parent_id} onChange={e => sf({ ...f, parent_id: e.target.value })}><option value="">Chọn cấp cha</option>{parents.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>}
      <label className="field"><span>Mô tả</span><textarea value={f.description} onChange={e => sf({ ...f, description: e.target.value })} /></label>
      <SpaceSelect spaces={spaces} value={f.space_id} onChange={space_id => sf({ ...f, space_id })} editableOnly label="Lưu vào kho" />
      <UnitPicker value={f.owner_unit_id} onChange={owner_unit_id => sf({ ...f, owner_unit_id })} />
      <PeoplePicker label="Giảng viên" multiple value={f.teacher_ids} onChange={teacher_ids => sf({ ...f, teacher_ids })} />
      <ErrorBox>{err}</ErrorBox><button type="submit" className="ui-btn ui-btn-primary" disabled={busy || (row && !row.can_edit)}>Lưu {KINDS[f.kind]}</button>
      {row?.can_edit && onDelete && <button type="button" className="ui-btn" onClick={() => onDelete(row)}>Xoá nhánh chưa dùng</button>}
    </form>
  </Drawer>
}

function DocumentForm({ row, kind, subjectId, nodes, docs, onClose, onSaved }) {
  kind = row?.kind || kind
  const { data: spaces } = useFetch(() => api.spaces(), [])
  const [f, sf] = useState(Object.fromEntries(docFields.map(k => [k, k === 'exam' ? row?.exam || null : row?.[k] ?? ({ kind, title: '', subject_id: subjectId, lesson_ids: [], task_ids: [], exam: null, curriculum_ids: [], sessions: [], teacher_ids: [], learner_ids: [], revision: 1 }[k] ?? '')])))
  const [spaceId, ss] = useState(row?.space_id || '')
  const { data: lessonData, error: lessonError } = useFetch(() => api.lessons({ subject_id: f.subject_id || undefined, page_size: 100 }), [f.subject_id])
  const { data: tasks } = useFetch(() => f.subject_id ? api.learningTasks({ subject_id: f.subject_id }) : Promise.resolve(null), [f.subject_id])
  const [err, se] = useState(''); const [busy, sb] = useState(false)
  const locked = !!row && !row.can_edit
  const update = (key, value) => sf(cur => ({ ...cur, [key]: value }))
  const action = async (name) => { sb(true); se(''); try { const result = await api.trainingDocumentAction(row.id, name, name === 'copy' ? undefined : row.revision); onSaved(); toast(`Đã ${name === 'copy' ? 'tạo bản sao' : name === 'approve' ? 'duyệt' : 'phát hành'}`); onClose(); return result } catch(e) { se(e.message) } finally { sb(false) } }
  const save = async e => { e.preventDefault(); sb(true); se(''); try {
    const body = { ...f, space_id: spaceId || null }
    for (const key of ['subject_id', 'curriculum_id', 'plan_id', 'program_id']) body[key] ||= null
    await api.saveTrainingDocument(row?.id, body); onSaved(); onClose(); toast('Đã lưu tài liệu nháp')
  } catch(e) { se(e.message) } finally { sb(false) } }
  const text = (key, label, multiline = false) => <label className="field" key={key}><span>{label}</span>{multiline ? <textarea value={f[key]} onChange={e => update(key, e.target.value)} /> : <input value={f[key]} onChange={e => update(key, e.target.value)} />}</label>
  const ref = (key, type, label) => <label className="field"><span>{label}</span><select aria-label={label} required value={f[key]} onChange={e => {
    const doc = docs.find(x => x.id === e.target.value); sf({ ...f, [key]: e.target.value, subject_id: doc?.subject_id || f.subject_id, audience: doc?.audience || f.audience, sessions: key === 'curriculum_id' ? [] : key === 'plan_id' ? structuredClone(doc?.sessions || []) : f.sessions })
  }}><option value="">Chọn {label}</option>{docs.filter(x => x.kind === type).map(x => <option key={x.id} value={x.id}>{x.title} · {STATUS[x.status]}</option>)}</select></label>
  const curriculum = docs.find(x => x.id === f.curriculum_id)
  const available = (lessonData?.items || []).filter(x => kind !== 'plan' || curriculum?.lesson_ids?.includes(x.id))
  return <Drawer open title={`${row ? row.title : KINDS[kind] + ' mới'}`} onClose={onClose} testId="training-document-form">
    <form className="stack" onSubmit={save}>
      <fieldset disabled={locked || busy} className="stack">
        {text('title', 'Tên tài liệu')}
        {!row && <SpaceSelect spaces={spaces} value={spaceId} onChange={ss} editableOnly label="Lưu vào kho" />}
        {kind === 'curriculum' && <label className="field"><span>Môn học</span><select aria-label="Môn học" required value={f.subject_id} onChange={e => sf({ ...f, subject_id: e.target.value, lesson_ids: [] })}><option value="">Chọn môn</option>{nodes.filter(x => x.kind === 'subject').map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>}
        {kind === 'plan' && ref('curriculum_id', 'curriculum', 'Giáo trình')}
        {kind === 'class' && ref('plan_id', 'plan', 'Giáo án mẫu')}
        {kind === 'route' && ref('program_id', 'program', 'Chương trình học')}
        {text('audience', 'Đối tượng học')}{text('current_level', 'Năng lực chuyên môn hiện tại')}{text('entry', 'Điều kiện đầu vào', true)}{text('outcome', 'Đầu ra', true)}{text('goal', 'Mục tiêu', true)}
        {kind === 'curriculum' && <><h3>Bài học theo thứ tự</h3><OrderedPicker rows={available} value={f.lesson_ids} onChange={v => update('lesson_ids', v)} />
          <h3>Thi cuối môn</h3>
          <label><input type="checkbox" checked={!!f.exam} onChange={e => update('exam', e.target.checked ? { blueprint: [{ category: null, difficulty: null, kind: 'single', count: 1 }], duration_min: 30, pass_score: 70, attempts: 1, scope: 'path' } : null)} /> Có thi cuối môn từ các bài của giáo trình</label>
          {f.exam && <section className="panel stack">{['duration_min', 'pass_score', 'attempts'].map(k => <label className="field" key={k}><span>{{ duration_min: 'Thời lượng (phút)', pass_score: 'Điểm đạt (%)', attempts: 'Số lượt thi' }[k]}</span><input type="number" min={k === 'pass_score' ? 0 : 1} max={k === 'pass_score' ? 100 : k === 'attempts' ? 5 : 600} value={f.exam[k]} onChange={e => update('exam', { ...f.exam, [k]: Number(e.target.value) })} /></label>)}
            {f.exam.blueprint.map((r, i) => <div className="row row-wrap" key={i}><label className="field"><span>Loại câu dòng {i + 1}</span><select value={r.kind || 'single'} onChange={e => update('exam', { ...f.exam, blueprint: f.exam.blueprint.map((x, j) => i === j ? { ...x, kind: e.target.value } : x) })}><option value="single">Một đáp án</option><option value="multi">Nhiều đáp án</option><option value="essay">Tự luận</option></select></label><label className="field"><span>Số câu dòng {i + 1}</span><input type="number" min={1} max={100} value={r.count} onChange={e => update('exam', { ...f.exam, blueprint: f.exam.blueprint.map((x, j) => i === j ? { ...x, count: Number(e.target.value) } : x) })} /></label><button type="button" className="ui-btn" disabled={f.exam.blueprint.length === 1} onClick={() => update('exam', { ...f.exam, blueprint: f.exam.blueprint.filter((_, j) => j !== i) })}>Bỏ dòng {i + 1}</button></div>)}
            <button type="button" className="ui-btn" onClick={() => update('exam', { ...f.exam, blueprint: [...f.exam.blueprint, { category: null, difficulty: null, kind: 'single', count: 1 }] })}>+ Dòng ma trận</button>
          </section>}
          <h3>Thực hành / dự án của giáo trình</h3><OrderedPicker rows={tasks?.items || []} value={f.task_ids} onChange={v => update('task_ids', v)} />
          {row && <Link className="ui-btn" to={`/learn/lessons/new?subject=${f.subject_id}&curriculum=${row.id}`}>+ Soạn bài cho giáo trình này</Link>}</>}
        {['program', 'route'].includes(kind) && <><h3>Giáo trình từ các khoa</h3><OrderedPicker rows={docs.filter(x => x.kind === 'curriculum')} value={f.curriculum_ids} onChange={v => update('curriculum_ids', v)} /></>}
        {['plan', 'class'].includes(kind) && <><h3>Các buổi dạy</h3>{f.sessions.map((session, i) => <SessionForm key={i} session={session} index={i} lessons={available} onChange={value => update('sessions', f.sessions.map((x, j) => j === i ? value : x))} onRemove={() => update('sessions', f.sessions.filter((_, j) => i !== j))} />)}
          <button type="button" className="ui-btn" onClick={() => update('sessions', [...f.sessions, { title: '', lesson_ids: [], teacher_ids: [], goal: '', format: 'onsite', preparation: '', activities: [], assessment: '', homework: '', adjustments: '' }])}>+ Thêm buổi</button></>}
        {['class', 'route'].includes(kind) && <>{['teacher_ids', 'learner_ids'].map(key => <PeoplePicker key={key} label={key === 'teacher_ids' ? 'Giảng viên' : 'Người học'} multiple value={f[key]} onChange={v => update(key, v)} />)}{text('adjustments', 'Điều chỉnh riêng cho lớp / cá nhân', true)}</>}
        <ErrorBox>{lessonError}</ErrorBox>
      </fieldset>
      {row?.lesson_ids?.length > 0 && <ol>{row.lesson_ids.map((id, i) => <li key={id}>Bài {i + 1} · <Link to={`/learn/lessons/${id}`}>{lessonData?.items?.find(x => x.id === id)?.title || 'Xem bài học'}</Link></li>)}</ol>}
      <ErrorBox>{err}</ErrorBox>
      {!locked && <button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>Lưu nháp</button>}
      {row && <div className="actions">
        {row.status === 'draft' && <button type="button" className="ui-btn" disabled={busy} onClick={() => action('approve')}>Duyệt tài liệu</button>}
        {row.status === 'approved' && <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => action('publish')}>Phát hành</button>}
        <button type="button" className="ui-btn" disabled={busy} onClick={() => action('copy')}>Tạo bản sao</button>
      </div>}
      {row?.status === 'published' && ['class', 'route'].includes(kind) && <EquivalencyForm document={row} documents={docs} />}
      {row?.snapshot && <details><summary>Nội dung đã chụp khi phát hành / giao</summary>{row.snapshot.map((x, i) => <section key={i}><h3>{x.title}</h3><p>{x.outcome || x.goal}</p><ol>{(x.lesson_ids || []).map((id, j) => <li key={id}>Bài {j + 1} · <Link to={`/learn/lessons/${id}`}>Xem bài</Link></li>)}</ol></section>)}</details>}
    </form>
  </Drawer>
}

export function OrderedPicker({ rows, value, onChange }) {
  const move = (i, d) => { const next = [...value]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next) }
  return <div className="stack"><ol>{value.map((id, i) => <li key={id} className="row row-wrap"><span className="grow">{i + 1}. {rows.find(x => x.id === id)?.title || 'Nội dung không còn trong phạm vi xem'}</span>
    <button type="button" className="ui-btn ui-btn-sm" aria-label={`Xếp lên vị trí ${i + 1}`} disabled={!i} onClick={() => move(i, -1)}>↑</button>
    <button type="button" className="ui-btn ui-btn-sm" aria-label={`Xếp xuống vị trí ${i + 1}`} disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</button>
    <button type="button" className="ui-btn ui-btn-sm" aria-label={`Bỏ nội dung vị trí ${i + 1}`} onClick={() => onChange(value.filter(x => x !== id))}>Bỏ</button>
  </li>)}</ol>{rows.filter(x => !value.includes(x.id)).map(x => <button type="button" className="ui-btn" key={x.id} onClick={() => onChange([...value, x.id])}>+ {x.title}</button>)}</div>
}

function SessionForm({ session, index, lessons, onChange, onRemove }) {
  const update = (k, v) => onChange({ ...session, [k]: v })
  return <section className="panel stack"><h4>Buổi {index + 1}</h4>
    {['title', 'goal', 'preparation', 'assessment', 'homework', 'adjustments'].map(k => <label className="field" key={k}><span>{{ title: 'Tên buổi', goal: 'Mục tiêu', preparation: 'Chuẩn bị', assessment: 'Minh chứng đánh giá', homework: 'Bài tập sau buổi', adjustments: 'Điều chỉnh' }[k]}</span><textarea value={session[k]} onChange={e => update(k, e.target.value)} /></label>)}
    <PeoplePicker label="Giảng viên buổi học" multiple value={session.teacher_ids} onChange={v => update('teacher_ids', v)} />
    <label className="field"><span>Hình thức</span><select value={session.format} onChange={e => update('format', e.target.value)}><option value="onsite">Trực tiếp</option><option value="online">Trực tuyến</option><option value="hybrid">Kết hợp</option></select></label>
    <OrderedPicker rows={lessons} value={session.lesson_ids} onChange={v => update('lesson_ids', v)} />
    {session.activities.map((a, i) => <div key={i} className="panel stack">{['title', 'minutes', 'teacher', 'learner'].map(k => <label className="field" key={k}><span>{{ title: 'Hoạt động', minutes: 'Thời lượng (phút)', teacher: 'Giảng viên làm gì', learner: 'Người học làm gì' }[k]}</span><input type={k === 'minutes' ? 'number' : 'text'} min={1} value={a[k]} onChange={e => update('activities', session.activities.map((x, j) => j === i ? { ...x, [k]: k === 'minutes' ? Number(e.target.value) : e.target.value } : x))} /></label>)}<button type="button" className="ui-btn" onClick={() => update('activities', session.activities.filter((_, j) => j !== i))}>Bỏ hoạt động {i + 1}</button></div>)}
    <button type="button" className="ui-btn" onClick={() => update('activities', [...session.activities, { title: '', minutes: 15, teacher: '', learner: '' }])}>+ Hoạt động</button>
    <button type="button" className="ui-btn" onClick={onRemove}>Bỏ buổi {index + 1}</button>
  </section>
}


function EquivalencyForm({ document: doc, documents }) {
  const [f, sf] = useState({ learner_id: '', lesson_id: '', source_document_id: '', evidence: '' })
  const [err, se] = useState(''); const [busy, sb] = useState(false)
  const lessonRows = []
  const walk = row => { if (row.practice_question_ids && row._id) lessonRows.push({ id: row._id, title: row.title }); (row.snapshot || []).forEach(walk) }
  walk(doc)
  const unique = [...new Map(lessonRows.map(x => [x.id, x])).values()]
  return <section className="panel stack"><h3>Công nhận học liệu / kiểm tra tương đương</h3><p>Chỉ dùng kết quả cùng bài đã phát hành ở lớp / lộ trình khác. Thực hành và dự án của lớp này vẫn phải chấm đạt.</p>
    <PeoplePicker label="Người học cần công nhận" value={f.learner_id} onChange={v => sf({ ...f, learner_id: v })} />
    <label className="field"><span>Bài học</span><select value={f.lesson_id} onChange={e => sf({ ...f, lesson_id: e.target.value })}><option value="">Chọn bài</option>{unique.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
    <label className="field"><span>Lớp / lộ trình có kết quả gốc</span><select value={f.source_document_id} onChange={e => sf({ ...f, source_document_id: e.target.value })}><option value="">Chọn kết quả gốc</option>{documents.filter(x => x.id !== doc.id && ['class', 'route'].includes(x.kind) && x.status === 'published' && x.learner_ids.includes(f.learner_id)).map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
    <label className="field"><span>Minh chứng và lý do công nhận</span><textarea value={f.evidence} onChange={e => sf({ ...f, evidence: e.target.value })} /></label>
    <button type="button" className="ui-btn" disabled={busy} onClick={async () => { sb(true); se(''); try { await api.recognizeLearningEquivalency(doc.id, f); toast('Đã ghi quyết định công nhận') } catch(e) { se(e.message) } finally { sb(false) } }}>Ghi quyết định công nhận</button><ErrorBox>{err}</ErrorBox>
  </section>
}
