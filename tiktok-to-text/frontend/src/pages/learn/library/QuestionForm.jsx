// Ngăn kéo soạn câu hỏi (SCR-16, LRN-02): Drawer mở theo ?q=<id> (sửa) hoặc ?q=new (tạo) — dán link là mở đúng câu.
// Chân ngăn kéo: một nút chính "Lưu và duyệt" + nút phụ "Lưu, tạo câu tiếp" (chỉ câu mới: lưu, duyệt, dọn form giữ
// thẻ căn cứ / loại câu / độ khó / kho) + "Lưu nháp". Phản hồi bằng toast; lỗi form hiện tại chỗ [q-error].
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { ErrorBox, Loading, TextArea } from '../../../components/ui'
import { Drawer } from '../../../components/Overlay'
import { Notice } from '../../../components/Notice'
import { Icon } from '../../../components/icons'
import { SpaceSelect } from '../../../components/pickers'
import { toast } from '../../../components/toast'
import { BLOOM, CardPicker, QUESTION_KIND } from '../common'
import { currentSpace, editableSpace, loadPrefs, onlyOwner, preferredSpace, savePrefs, short } from './shared'

const EMPTY_OPTS = () => [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }, { text: '', correct: false }]
const EMPTY_RUBRIC = () => [{ criterion: '', max: 5, descriptor: '' }]

// id: 'new' hoặc id câu hỏi; known: câu đã có sẵn trong danh sách (khỏi gọi API)
export function QuestionDrawer({ id, known, onClose, onSaved }) {
  const isNew = id === 'new'
  const { data, error, loading } = useFetch(
    () => (isNew || known ? Promise.resolve(null) : api.questions({ ids: id, page_size: 1 }).then((r) => r.items[0] || null)),
    [id, isNew, !!known])
  const question = isNew ? {} : known || data
  const missing = !isNew && !known && !loading && !data && !error
  const title = isNew ? 'Câu hỏi mới' : 'Sửa câu hỏi'
  const formId = useId()
  const [busy, setBusy] = useState(false)
  const actions = useRef(null)   // QuestionForm gắn hàm lưu vào đây để nút ở chân ngăn kéo gọi

  return (
    <Drawer open title={title} sub={question?.stem ? short(question.stem, 80) : 'Ngân hàng câu hỏi'} onClose={onClose}
      testId="q-form" fullKey="learn.questionFull"
      footer={question && (
        <>
          <button type="button" className="ui-btn ui-btn-ghost" data-testid="q-cancel" onClick={onClose}>Huỷ</button>
          <button type="submit" form={formId} className="ui-btn" disabled={busy} data-testid="q-save-draft">Lưu nháp</button>
          {isNew && (
            <button type="button" className="ui-btn" disabled={busy} data-testid="q-save-approve-next" onClick={() => actions.current?.(true, true)}
              title="Lưu và duyệt câu này, rồi dọn form để soạn câu tiếp — giữ thẻ căn cứ, loại câu, độ khó, kho">
              Lưu, tạo câu tiếp
            </button>
          )}
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy} data-testid="q-save-approve" onClick={() => actions.current?.(true)}>
            Lưu và duyệt
          </button>
        </>
      )}>
      <ErrorBox testId="q-load-error">{error}</ErrorBox>
      {missing && <Notice tone="warn" testId="q-missing">Không tìm thấy câu hỏi này, hoặc bạn không có quyền xem.</Notice>}
      {!question && !error && !missing && <Loading>Đang tải câu hỏi…</Loading>}
      {question && (
        <QuestionForm key={question.id || 'new'} question={question} formId={formId} actions={actions} setBusy={setBusy} busy={busy}
          onSaved={(q, next) => { onSaved(q); if (!next) onClose() }} />
      )}
    </Drawer>
  )
}

function QuestionForm({ question, formId, actions, busy, setBusy, onSaved }) {
  const isNew = !question.id
  const prefs = useMemo(() => (isNew ? loadPrefs() : {}), [isNew])
  const { data: spaces } = useFetch(() => api.spaces(), [])
  const [f, setF] = useState({
    kind: question.kind || prefs.kind || 'single', stem: question.stem || '',
    options: question.options?.length ? question.options.map((o) => ({ text: o.text, correct: !!o.correct })) : EMPTY_OPTS(),
    rubric: question.rubric?.length ? question.rubric : EMPTY_RUBRIC(),
    model_answer: question.model_answer || '', explanation: question.explanation || '',
    difficulty: question.difficulty || prefs.difficulty || 3, bloom: question.bloom || prefs.bloom || '',
    cards: (question.card_refs || []).map((r) => ({ card_id: r.card_id, title: r.title, rev: r.rev })),
  })
  const [spaceId, setSpaceId] = useState('')
  const [spaceTouched, setSpaceTouched] = useState(false)
  const [err, setErr] = useState(null)
  const stemRef = useRef(null)
  const uid = useId()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setOpt = (i, patch) => setF({
    ...f,
    options: f.options.map((o, j) => (j === i ? { ...o, ...patch } : (f.kind === 'single' && patch.correct ? { ...o, correct: false } : o))),
  })
  const setRub = (i, patch) => setF({ ...f, rubric: f.rubric.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const essay = f.kind === 'essay'

  // Câu mới: kho = kho của câu trước (nếu còn sửa được), không thì kho chia sẻ mình sửa được — tránh kho cá nhân
  useEffect(() => {
    if (!isNew || spaceTouched || spaceId || !spaces) return
    const s = editableSpace(spaces, prefs.space_id) || preferredSpace(spaces)
    if (s) setSpaceId(s.id)
  }, [spaces, isNew, spaceTouched, spaceId, prefs.space_id])
  const privateSpace = isNew && onlyOwner(currentSpace(spaces, spaceId))

  const save = async (approve, next = false) => {
    if (busy) return
    setErr(null)
    if (!f.stem.trim()) { setErr('Chưa có đề bài.'); stemRef.current?.focus(); return }
    setBusy(true)
    const body = {
      kind: f.kind, stem: f.stem, explanation: f.explanation, model_answer: f.model_answer,
      difficulty: Number(f.difficulty), bloom: f.bloom || null,
      options: essay ? [] : f.options.filter((o) => o.text.trim()),
      rubric: essay ? f.rubric.filter((r) => r.criterion.trim()).map((r) => ({ ...r, max: Number(r.max) })) : [],
      card_ids: f.cards.map((c) => c.card_id),
    }
    try {
      let q = isNew ? await api.createQuestion({ ...body, space_id: spaceId || null }) : await api.patchQuestion(question.id, body)
      if (approve) q = await api.patchQuestion(q.id, { status: 'approved' })
      if (isNew) savePrefs({ kind: f.kind, difficulty: Number(f.difficulty), bloom: f.bloom || '', space_id: spaceId || '' })
      const cards = q.card_refs?.map((r) => r.title).filter(Boolean).join(', ')
      toast(`Đã ${approve ? 'lưu và duyệt' : 'lưu nháp'} câu “${short(q.stem)}”${cards ? ` (căn cứ: ${cards})` : ''}`)
      if (next) {
        // giữ Loại câu / Độ khó / Mức nhận thức / Kho / Thẻ căn cứ; dọn đề bài, phương án, giải thích
        setF((cur) => ({ ...cur, stem: '', explanation: '', model_answer: '', options: EMPTY_OPTS(), rubric: EMPTY_RUBRIC() }))
        stemRef.current?.focus()
      }
      onSaved(q, next)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => { actions.current = save })

  return (
    <form id={formId} className="lrn-qform" onSubmit={(e) => { e.preventDefault(); save(false) }}>
      {question.status === 'approved' && <p className="muted small">Câu đã duyệt: sửa nội dung sẽ đưa câu về nháp, cần duyệt lại.</p>}
      <div className="row row-wrap">
        <label className="field"><span>Loại câu</span>
          <select value={f.kind} onChange={set('kind')} aria-label="Loại câu" data-testid="q-kind">
            {Object.entries(QUESTION_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field"><span>Độ khó (1–5)</span>
          <select value={f.difficulty} onChange={set('difficulty')} aria-label="Độ khó (1–5)" data-testid="q-difficulty">{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}</select>
        </label>
        <label className="field"><span>Mức nhận thức</span>
          <select value={f.bloom} onChange={set('bloom')} aria-label="Mức nhận thức" data-testid="q-bloom">
            <option value="">—</option>
            {Object.entries(BLOOM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {isNew && <div className="field"><span>Lưu vào kho</span>
          <SpaceSelect spaces={spaces} value={spaceId} onChange={(v) => { setSpaceId(v); setSpaceTouched(true) }} editableOnly label="Lưu vào kho" testId="q-space" /></div>}
      </div>
      {privateSpace && (
        <Notice tone="warn" testId="q-private-hint">
          Kho cá nhân — chỉ bạn xem được. Câu trong kho cá nhân không vào được bài học / đề thi giao cho nhân viên: chọn kho chia sẻ ở ô “Lưu vào kho”.
        </Notice>
      )}
      <label className="field" htmlFor={`${uid}-stem`}><span>Đề bài (bắt buộc){essay ? ' — ưu tiên tình huống thực tế' : ''}</span>
        <TextArea id={`${uid}-stem`} ref={stemRef} rows={3} value={f.stem} onChange={set('stem')} required aria-label="Đề bài" data-testid="q-stem" /></label>

      {!essay && (
        <div className="field" data-testid="q-options">
          <span>Phương án (2–6) — đánh dấu {f.kind === 'single' ? 'đúng 1 phương án đúng' : 'mọi phương án đúng'}</span>
          {f.options.map((o, i) => (
            <div key={i} className="row lrn-opt">
              <input type={f.kind === 'single' ? 'radio' : 'checkbox'} name="correct" aria-label={`Phương án ${i + 1} đúng`} data-testid={`q-correct-${i + 1}`}
                checked={o.correct} onChange={(e) => setOpt(i, { correct: e.target.checked })} />
              <input className="grow" aria-label={`Phương án ${i + 1}`} data-testid={`q-option-${i + 1}`} value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} placeholder={`Phương án ${i + 1}`} />
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" aria-label={`Bỏ phương án ${i + 1}`} title="Bỏ phương án" disabled={f.options.length <= 2} onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i) })}><Icon name="close" size={16} /></button>
            </div>
          ))}
          {f.options.length < 6 && <button type="button" className="link small" data-testid="q-option-add" onClick={() => setF({ ...f, options: [...f.options, { text: '', correct: false }] })}>+ Phương án</button>}
        </div>
      )}
      {essay && (
        <div className="field" data-testid="q-rubric">
          <span>Rubric chấm — tiêu chí, điểm tối đa, mô tả mức đạt</span>
          {f.rubric.map((r, i) => (
            <div key={i} className="row lrn-opt">
              <input className="grow" aria-label={`Tiêu chí ${i + 1}`} data-testid={`q-rubric-${i + 1}-criterion`} value={r.criterion} onChange={(e) => setRub(i, { criterion: e.target.value })} placeholder="Tiêu chí" />
              <input type="number" min={0} max={100} step="0.5" className="lrn-num" aria-label={`Điểm tối đa ${i + 1}`} data-testid={`q-rubric-${i + 1}-max`} value={r.max} onChange={(e) => setRub(i, { max: e.target.value })} />
              <input className="grow" aria-label={`Mô tả mức đạt ${i + 1}`} data-testid={`q-rubric-${i + 1}-descriptor`} value={r.descriptor} onChange={(e) => setRub(i, { descriptor: e.target.value })} placeholder="Mô tả mức đạt" />
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" aria-label={`Bỏ tiêu chí ${i + 1}`} title="Bỏ tiêu chí" disabled={f.rubric.length <= 1} onClick={() => setF({ ...f, rubric: f.rubric.filter((_, j) => j !== i) })}><Icon name="close" size={16} /></button>
            </div>
          ))}
          <button type="button" className="link small" data-testid="q-rubric-add" onClick={() => setF({ ...f, rubric: [...f.rubric, { criterion: '', max: 1, descriptor: '' }] })}>+ Tiêu chí</button>
          <label className="field" htmlFor={`${uid}-model`}><span>Đáp án mẫu</span><TextArea id={`${uid}-model`} rows={3} value={f.model_answer} onChange={set('model_answer')} aria-label="Đáp án mẫu" data-testid="q-model-answer" /></label>
        </div>
      )}
      <label className="field" htmlFor={`${uid}-expl`}><span>Giải thích (trích thẻ) — hiện cho người học sau khi nộp</span>
        <TextArea id={`${uid}-expl`} rows={2} value={f.explanation} onChange={set('explanation')} aria-label="Giải thích (trích thẻ)" data-testid="q-explanation" /></label>
      <div className="field">
        <span>Thẻ căn cứ (bắt buộc, ít nhất 1)</span>
        <CardPicker value={f.cards} onChange={(cards) => setF({ ...f, cards })} max={10} label="Gắn thẻ căn cứ" testId="q-card" />
      </div>
      <ErrorBox testId="q-error">{err}</ErrorBox>
    </form>
  )
}
