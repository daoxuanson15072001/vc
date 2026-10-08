// Form soạn bài học (SCR-16, LRN-01): thẻ VCWIKI đã duyệt (ghim phiên bản khi lưu) + diễn giải + câu luyện tập.
// Nằm trong trang riêng /learn/lessons/new và /learn/lessons/:id/edit (LessonEdit.jsx). Phát hành qua confirmDialog.
// data-testid lesson-* giữ nguyên cho AI / e2e (hướng dẫn /guide#soan-khoa liệt kê từng cái).
import { useEffect, useId, useState } from 'react'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { ErrorBox, TextArea } from '../../../components/ui'
import { confirmDialog } from '../../../components/dialog'
import { Markdown } from '../../../components/markdown'
import { Notice } from '../../../components/Notice'
import { StatusBadge } from '../../../components/StatusBadge'
import { SpaceSelect } from '../../../components/pickers'
import { CardPicker, QUESTION_KIND } from '../common'
import { NodeForm } from './TrainingPanel'
import { QuestionDrawer } from './QuestionForm'
import { MaterialsForm } from './MaterialsForm'
import { useUrlOverlay } from '../../../components/Overlay'
import { currentSpace, onlyOwner, preferredSpace } from './shared'

export function LessonForm({ lesson, defaultCategory = '', defaultSubject = '', curriculumId = '', defaultAudience = '', onSaved, onCancel }) {
  const isNew = !lesson.id
  const { data: spaces } = useFetch(() => api.spaces(), [])
  const { data: bank, reload: reloadBank } = useFetch(() => api.questions({ page_size: 200 }), [])
  const { data: structure, reload: reloadStructure } = useFetch(() => api.trainingStructure(), [])
  const nodeOverlay = useUrlOverlay('createSubject')
  const questionOverlay = useUrlOverlay('createQuestion')
  const [f, setF] = useState({
    title: lesson.title || '',
    objectives: (lesson.objectives || []).join('\n'),
    narrative: lesson.narrative || '',
    items: (lesson.items || []).filter((i) => !i.unavailable).map((i) => ({ card_id: i.card_id, title: i.title, rev: lesson.id ? i.rev : null })),
    practice: lesson.practice_question_ids || [],
    category: lesson.category || defaultCategory || '',
    subject_id: lesson.subject_id || defaultSubject || '',
    audience: lesson.audience || defaultAudience || '',
    current_level: lesson.current_level || '', entry: lesson.entry || '', outcome: lesson.outcome || '',
    materials: [...(lesson.materials || []).filter(m => !m.unavailable).map(({ sha256, subtitle_url, ...m }) => ({ ...m, url: m.source === 'link' ? m.url : null })), ...(lesson.items || []).filter(c => !c.unavailable && !(lesson.materials || []).some(m => m.card_id === c.card_id)).map(c => ({ kind: 'card', source: 'repository', title: c.title, card_id: c.card_id, rev: lesson.id ? c.rev : null, required: true }))],
  })
  const [spaceId, setSpaceId] = useState(lesson.id ? lesson.space_id : '')
  const [spaceTouched, setSpaceTouched] = useState(false)
  const [dropped, setDropped] = useState(0)             // bản sao: số câu luyện tập không xem được đã bỏ
  const [preview, setPreview] = useState(false)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [savedDraft, setSavedDraft] = useState(lesson.id ? lesson : null)
  const uid = useId()

  // Bài mới: mặc định kho chia sẻ mình sửa được (nếu có) thay vì kho cá nhân — bài trong kho cá nhân nhân viên không thấy
  useEffect(() => {
    if (!isNew || spaceTouched || spaceId || !spaces) return
    const s = preferredSpace(spaces)
    if (s) setSpaceId(s.id)
  }, [spaces, isNew, spaceTouched, spaceId])

  // Bản sao bài của người khác: bỏ các câu luyện tập mình không xem được (không bỏ thì lưu luôn lỗi), báo số câu bị bỏ
  const copyKey = lesson.copy_of ? (lesson.practice_question_ids || []).join(',') : ''
  useEffect(() => {
    if (!copyKey) return
    const copyIds = copyKey.split(',')
    api.questions({ ids: copyKey, page_size: 200 }).then((r) => {
      const ok = new Set(r.items.map((q) => q.id))
      setF((cur) => ({ ...cur, practice: cur.practice.filter((id) => ok.has(id) || !copyIds.includes(id)) }))
      setDropped(copyIds.filter((id) => !ok.has(id)).length)
    }).catch((e) => setErr(e.message))
  }, [copyKey])

  const privateSpace = isNew ? onlyOwner(currentSpace(spaces, spaceId)) : !!lesson.space_only_owner
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const togglePractice = (id) => setF({ ...f, practice: f.practice.includes(id) ? f.practice.filter((x) => x !== id) : [...f.practice, id] })

  const save = async (publish) => {
    if (!f.subject_id) { setErr('Chọn môn học trước khi lưu.'); return }
    setErr(null)
    setBusy(true)
    const body = {
      title: f.title, narrative: f.narrative,
      objectives: f.objectives.split('\n').map((s) => s.trim()).filter(Boolean),
      items: f.items.map((i) => ({ card_id: i.card_id })),
      practice_question_ids: f.practice,
      subject_id: f.subject_id, audience: f.audience, current_level: f.current_level, entry: f.entry, outcome: f.outcome, materials: f.materials,
      ...(defaultCategory ? { category: f.category || null } : {}),
    }
    try {
      let l = !savedDraft ? await api.createLesson({ ...body, curriculum_id: curriculumId || null, space_id: spaceId || null }) : await api.patchLesson(savedDraft.id, { ...body, revision: savedDraft.revision })
      setSavedDraft(l)
      if (publish) l = await api.patchLesson(l.id, { status: 'published', revision: l.revision })
      onSaved(l, publish)
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
  }

  const publish = async () => {
    if (!f.title.trim()) { setErr('Chưa có tên bài học.'); return }
    const ok = await confirmDialog({
      title: 'Phát hành bài học?',
      body: (
        <>
          <p>Sau khi phát hành nội dung bị khoá — muốn sửa phải tạo bản sao.</p>
          {privateSpace && (
            <p className="tone-bad" data-testid="publish-private-warning">
              <b>Bài trong kho cá nhân — chỉ bạn xem được; chuyển sang kho chia sẻ để giao cho nhân viên.</b>
              {isNew ? ' Chọn lại ô “Lưu vào kho” trong form nếu muốn.' : ' Bản nháp này không đổi kho được — hãy soạn bài mới trong kho chia sẻ.'}
            </p>
          )}
        </>
      ),
      okLabel: privateSpace ? 'Vẫn phát hành (chỉ mình tôi xem)' : 'Xác nhận phát hành',
      cancelLabel: 'Quay lại',
      testId: 'lesson-publish-dialog',
    })
    if (ok) save(true)
  }

  // Câu hỏi gợi ý: câu gắn với thẻ trong bài trước, rồi tới câu khác
  const inLesson = new Set(f.items.map((i) => i.card_id))
  const qs = [...(bank?.items || [])].sort((a, b) =>
    Number(b.card_refs.some((r) => inLesson.has(r.card_id))) - Number(a.card_refs.some((r) => inLesson.has(r.card_id))))

  return (
    <section className="card" data-testid="lesson-form" aria-label={isNew ? 'Soạn bài học' : 'Sửa bài học'}>
      <form onSubmit={(e) => { e.preventDefault(); save(false) }}>
        <div className="row row-wrap">
          <label className="field grow2"><span>Tên bài học (bắt buộc)</span>
            <input value={f.title} onChange={set('title')} required maxLength={200} aria-label="Tên bài học" data-testid="lesson-title" /></label>
          <label className="field"><span>Môn học (bắt buộc)</span>
            <select required value={f.subject_id} disabled={!!curriculumId} onChange={set('subject_id')} aria-label="Môn học" data-testid="lesson-subject">
              <option value="">Chọn môn học</option>
              {(structure?.items || []).filter(x => x.kind === 'subject').map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {!curriculumId && <button type="button" className="ui-btn ui-btn-sm" onClick={() => nodeOverlay.open('new')} data-testid="lesson-create-subject">+ Tạo môn còn thiếu</button>}
          </label>
          {isNew && <div className="field"><span>Lưu vào kho</span>
            <SpaceSelect spaces={spaces} value={spaceId} onChange={(v) => { setSpaceId(v); setSpaceTouched(true) }} editableOnly label="Lưu vào kho" testId="lesson-space" /></div>}
        </div>
        {privateSpace && (
          <Notice tone="warn" testId="lesson-private-hint">
            Kho cá nhân — chỉ bạn xem được bài học này. Muốn giao cho nhân viên, lưu vào kho chia sẻ (kho có nhân viên là thành viên hoặc mở cho cả công ty).
          </Notice>
        )}
        {['audience', 'current_level', 'entry', 'outcome'].map(k => <label className="field" key={k}><span>{{ audience: 'Đối tượng', current_level: 'Năng lực chuyên môn hiện tại', entry: 'Điều kiện đầu vào', outcome: 'Đầu ra' }[k]}</span><textarea value={f[k]} onChange={set(k)} /></label>)}
        <MaterialsForm value={f.materials} onChange={materials => setF(cur => ({ ...cur, materials, items: cur.items.filter(c => materials.some(m => m.card_id === c.card_id)) }))} spaceId={spaceId} />
        <label className="field" htmlFor={`${uid}-obj`}><span>Mục tiêu (mỗi dòng một mục tiêu)</span>
          <TextArea id={`${uid}-obj`} rows={2} value={f.objectives} onChange={set('objectives')} aria-label="Mục tiêu (mỗi dòng một mục tiêu)" data-testid="lesson-objectives" /></label>
        <div className="field">
          <span>Thẻ trong bài (theo thứ tự học) — chỉ thẻ đã duyệt mà bạn xem được; phiên bản thẻ được ghim khi lưu</span>
          <CardPicker value={f.items} onChange={items => setF(cur => ({ ...cur, items, materials: [...cur.materials.filter(m => m.kind !== 'card' || items.some(c => c.card_id === m.card_id)), ...items.filter(c => !cur.materials.some(m => m.card_id === c.card_id)).map(c => ({ kind: 'card', source: 'repository', title: c.title, card_id: c.card_id, required: true }))] }))} testId="lesson-card" />
        </div>
        <div className="field">
          <span className="row-between">
            <span>Diễn giải (Markdown) — nối các thẻ thành mạch bài học</span>
            <button type="button" className="link small" aria-pressed={preview} data-testid="lesson-preview" onClick={() => setPreview(!preview)}>{preview ? 'Sửa' : 'Xem trước'}</button>
          </span>
          {preview ? <div className="panel"><Markdown text={f.narrative} /></div>
            : <TextArea rows={8} value={f.narrative} onChange={set('narrative')} aria-label="Diễn giải" data-testid="lesson-body" placeholder="## Vì sao cần học&#10;…" />}
        </div>
        <div className="field">
          <span>Câu luyện tập ({f.practice.length} đã chọn) — người học chỉ gặp câu <b>đã duyệt</b></span>
          <button type="button" className="ui-btn" data-testid="lesson-create-question" onClick={() => questionOverlay.open('new')}>+ Tạo câu hỏi ngay</button>
          {dropped > 0 && <Notice tone="warn" testId="copy-dropped">{dropped} câu luyện tập bạn không xem được đã bị bỏ khỏi bản sao.</Notice>}
          {bank?.items?.length === 0 && <span className="muted small">Chưa có câu hỏi nào — tạo ở tab “Ngân hàng câu hỏi”.</span>}
          <ul className="list lrn-qpick" data-testid="lesson-practice">
            {qs.map((q) => (
              <li key={q.id} data-question-id={q.id}>
                <label className="row">
                  <input type="checkbox" checked={f.practice.includes(q.id)} onChange={() => togglePractice(q.id)} data-testid={`lesson-practice-${q.id}`} />
                  <span className="grow">{q.stem} <span className="muted small">· {QUESTION_KIND[q.kind]}</span></span>
                  <StatusBadge kind="question" status={q.status} />
                </label>
              </li>
            ))}
          </ul>
        </div>
        <ErrorBox testId="lesson-error">{err}</ErrorBox>
        <div className="form-foot">
          <button type="button" className="ui-btn ui-btn-ghost" data-testid="lesson-cancel" onClick={onCancel}>Huỷ</button>
          <div className="actions lrn-foot-actions">
            <button type="submit" className="ui-btn" disabled={busy} data-testid="lesson-save-draft">Lưu nháp</button>
            <button type="button" className="ui-btn ui-btn-primary" disabled={busy || (!f.items.length && !f.materials.length)} data-testid="lesson-publish" onClick={publish}>
              Phát hành
            </button>
          </div>
        </div>
      </form>
      {nodeOverlay.value && <NodeForm kind="subject" nodes={structure?.items || []} defaultSpace={spaceId} onClose={nodeOverlay.close} onSaved={node => { reloadStructure(); setF(cur => ({ ...cur, subject_id: node.id })) }} />}
      {questionOverlay.value && <QuestionDrawer id="new" onClose={questionOverlay.close} onSaved={q => { reloadBank(); setF(cur => ({ ...cur, practice: [...new Set([...cur.practice, q.id])] })) }} />}
    </section>
  )
}
