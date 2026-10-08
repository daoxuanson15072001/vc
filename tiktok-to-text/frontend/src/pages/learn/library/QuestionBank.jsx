// Tab Ngân hàng câu hỏi (SCR-16, LRN-02, TPL-A): FilterBar ghi URL (?status=&kind=&difficulty=, ?sample= từ seed khoá
// mẫu); danh sách câu; sửa / tạo câu = Drawer ?q=<id> | ?q=new; Nhập nhiều câu = Modal ?import=1. Phản hồi bằng toast.
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { Badge, Empty, ErrorBox, Loading } from '../../../components/ui'
import { confirmDialog } from '../../../components/dialog'
import { FilterBar, SelectField } from '../../../components/FilterBar'
import { StatusBadge } from '../../../components/StatusBadge'
import { useUrlOverlay } from '../../../components/Overlay'
import { toast } from '../../../components/toast'
import { useUrlState } from '../../../urlState'
import { STATUSES } from '../../../statuses'
import { BLOOM, QUESTION_KIND } from '../common'
import { ImportQuestions } from './ImportQuestions'
import { QuestionDrawer } from './QuestionForm'

const FILTERS = {
  status: { default: '', values: ['', ...Object.keys(STATUSES.question)] },
  kind: { default: '', values: ['', ...Object.keys(QUESTION_KIND)] },
  difficulty: { default: '', values: ['', '1', '2', '3', '4', '5'] },
  category: { default: '' },   // nhánh đang chọn ở cây chủ đề của Thư viện (dùng chung với tab Bài học)
  sample: { default: '' },
}

export function QuestionBank() {
  const [st, set] = useUrlState(FILTERS)
  const { search } = useLocation()
  const qOverlay = useUrlOverlay('q')
  const importOverlay = useUrlOverlay('import')
  const { data, error, reload } = useFetch(() => api.questions({ status: st.status, kind: st.kind, difficulty: st.difficulty, sample: st.sample, category: st.category, page_size: 200 }),
    [st.status, st.kind, st.difficulty, st.sample, st.category])
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(null)
  const setFilter = (patch) => { setPicked([]); set(patch) }
  const active = !!(st.status || st.kind || st.difficulty || st.sample)

  const approve = async (q) => {
    try {
      await api.patchQuestion(q.id, { status: 'approved' })
      toast(`Đã duyệt câu “${q.stem.slice(0, 60)}”`)
      reload()
    } catch (e) { toast(`Không duyệt được câu: ${e.message}`, { tone: 'error' }) }
  }
  // Duyệt nhiều câu: người bấm, từng câu qua đúng PATCH (quyền learn.author + sửa được kho, ghi người duyệt từng câu)
  const approvable = (data?.items || []).filter((q) => q.can_edit && q.status !== 'approved')
  const togglePick = (id) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])
  const approvePicked = async () => {
    if (!(await confirmDialog({ title: `Duyệt ${picked.length} câu hỏi đã chọn?`, body: 'Bạn xác nhận đã đọc nội dung, đáp án và rubric từng câu.', okLabel: `Duyệt ${picked.length} câu` }))) return
    const fails = []
    for (let i = 0; i < picked.length; i++) {
      setBusy(`${i + 1}/${picked.length}`)
      try { await api.patchQuestion(picked[i], { status: 'approved' }) } catch (e) { fails.push(e.message) }
    }
    const n = picked.length
    setBusy(null)
    setPicked([])
    if (fails.length) toast(`${fails.length}/${n} câu không duyệt được: ${fails[0]}`, { tone: 'error' })
    else toast(`Đã duyệt ${n} câu hỏi`)
    reload()
  }
  const known = qOverlay.value && qOverlay.value !== 'new' ? (data?.items || []).find((q) => q.id === qOverlay.value) : null

  return (
    <div className="stack">
      <div className="row-between row-wrap lrn-qbar">
        <FilterBar label="Lọc câu hỏi" count={data?.total ?? data?.items?.length} unit="câu" active={active} testId="q-filter"
          onClear={() => setFilter({ status: '', kind: '', difficulty: '', sample: '' })}>
          <SelectField label="Trạng thái" value={st.status} onChange={(v) => setFilter({ status: v })} testId="q-filter-status"
            options={[{ value: '', label: 'Mọi trạng thái' }, ...Object.entries(STATUSES.question).map(([k, v]) => ({ value: k, label: v.label }))]} />
          <SelectField label="Loại câu" value={st.kind} onChange={(v) => setFilter({ kind: v })} testId="q-filter-kind"
            options={[{ value: '', label: 'Mọi loại' }, ...Object.entries(QUESTION_KIND).map(([k, v]) => ({ value: k, label: v }))]} />
          <SelectField label="Độ khó" value={st.difficulty} onChange={(v) => setFilter({ difficulty: v })} testId="q-filter-difficulty"
            options={[{ value: '', label: 'Mọi độ khó' }, ...[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `Độ khó ${d}` }))]} />
          {st.sample && <Badge tone="info">Khoá mẫu: {st.sample}</Badge>}
        </FilterBar>
        <div className="row">
          <button type="button" className="ui-btn" data-testid="q-import" onClick={() => importOverlay.open('1')}>Nhập nhiều câu (JSON/CSV)</button>
          <button type="button" className="ui-btn ui-btn-primary" data-testid="q-new" onClick={() => qOverlay.open('new')}>+ Câu hỏi mới</button>
        </div>
      </div>
      {approvable.length > 0 && (
        <div className="row row-wrap lrn-bulkq" data-testid="question-bulk">
          <label className="row lrn-choice">
            <input type="checkbox" aria-label="Chọn mọi câu chưa duyệt" data-testid="q-pick-all"
              checked={picked.length === approvable.length}
              onChange={() => setPicked(picked.length === approvable.length ? [] : approvable.map((q) => q.id))} />
            Chọn cả {approvable.length} câu chưa duyệt
          </label>
          <button type="button" className="ui-btn" data-testid="q-approve-picked" disabled={!picked.length || !!busy} onClick={approvePicked}>
            {busy ? `Đang duyệt ${busy}…` : `Duyệt đã chọn (${picked.length})`}
          </button>
          {picked.length > 0 && <span className="muted small" role="status">Đã chọn {picked.length}</span>}
        </div>
      )}
      <ErrorBox onRetry={reload} testId="questions-error">{error}</ErrorBox>
      {!data && !error && <Loading>Đang tải câu hỏi…</Loading>}
      {data?.items?.length === 0 && <Empty>{st.sample ? 'Không còn câu nào khớp bộ lọc của khoá mẫu.' : active ? 'Không có câu nào khớp bộ lọc.' : 'Chưa có câu hỏi nào. Mỗi câu gắn với ít nhất một thẻ VCWIKI đã duyệt làm căn cứ.'}</Empty>}
      <ul className="list" data-testid="q-list" aria-label="Câu hỏi">
        {data?.items?.map((q) => (
          <li key={q.id} className="card lrn-qrow" data-question-id={q.id} data-status={q.status}>
            <div className="row-between">
              {q.can_edit && q.status !== 'approved' && (
                <input type="checkbox" className="lrn-qcheck" aria-label={`Chọn câu: ${q.stem.slice(0, 60)}`}
                  checked={picked.includes(q.id)} onChange={() => togglePick(q.id)} />
              )}
              <div className="grow">
                <div className="strong">{q.stem}</div>
                {q.kind !== 'essay' && q.options?.length > 0 && (
                  <ul className="lrn-optlist small">
                    {q.options.map((o, i) => <li key={i} className={o.correct ? 'tone-good' : ''}>{o.correct ? '✓' : '○'} {o.text}{o.correct ? <span className="sr-only"> (đáp án đúng)</span> : null}</li>)}
                  </ul>
                )}
                {q.kind === 'essay' && q.rubric?.length > 0 && (
                  <ul className="lrn-optlist small">
                    {q.rubric.map((r, i) => <li key={i}>• {r.criterion} ({r.max} đ){r.descriptor ? ` — ${r.descriptor}` : ''}</li>)}
                  </ul>
                )}
                <div className="meta">
                  <span>{QUESTION_KIND[q.kind]}</span>
                  <span>Độ khó {q.difficulty}</span>
                  {q.bloom && <span>{BLOOM[q.bloom]}</span>}
                  <span>{q.max} điểm</span>
                  <span>Căn cứ: {q.card_refs.map((r) => `${r.title || r.card_id} (bản ${r.rev})`).join(', ')}</span>
                  <span>{q.created_by_name}</span>
                  {q.approved_by_name && <span>duyệt: {q.approved_by_name}</span>}
                </div>
              </div>
              <StatusBadge kind="question" status={q.status} />
            </div>
            {q.can_edit && (
              <div className="actions">
                <Link className="ui-btn ui-btn-sm ui-btn-ghost" to={`?${withParam(search, 'q', q.id)}`} aria-label={`Sửa câu: ${q.stem.slice(0, 60)}`}
                  data-testid="q-edit">Sửa</Link>
                {q.status !== 'approved' && <button type="button" className="ui-btn ui-btn-sm" aria-label={`Duyệt câu: ${q.stem.slice(0, 60)}`} data-testid="q-approve" onClick={() => approve(q)}>Duyệt</button>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {qOverlay.value && <QuestionDrawer id={qOverlay.value} known={known} onClose={qOverlay.close} onSaved={reload} />}
      {importOverlay.value && <ImportQuestions onClose={importOverlay.close} onDone={reload} />}
    </div>
  )
}

// Địa chỉ mở một câu (giữ bộ lọc đang có) — liên kết thật để mở tab mới / dán cho đồng nghiệp
function withParam(search, key, value) {
  const p = new URLSearchParams(search)
  p.set(key, value)
  return p.toString()
}
