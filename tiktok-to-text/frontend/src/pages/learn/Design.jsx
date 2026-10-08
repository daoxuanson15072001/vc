// Thiết kế lộ trình bằng AI (docs/BA.md 17.5 — LRN-04; DESIGN Phần V SCR-16, TPL-C, CMP-16). Luồng H.
// Stepper ?step= — 1 Mục tiêu và người học (form 6 ô → prompt) → 2 Bản nháp AI (chỉ đọc: engine, thiếu tri thức, dàn ý,
// mã thẻ + phiên bản) → 3 Sửa (tên, bài, thẻ, đề thi, kho lưu) → 4 Phát hành. Chân trang cố định Quay lại · Lưu nháp · Tiếp.
// Bản nháp cũ mở bằng ?id= (không có ?step= thì vào bước 3). AI dựng nháp chỉ từ thẻ đã duyệt; Lưu nháp dựng bài học nháp +
// modules của lộ trình. Sinh câu hỏi AI nằm ở Ngân hàng câu hỏi của Thư viện (không còn khối riêng ở đây).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { useUrlState } from '../../urlState'
import { dateTime } from '../../format'
import { ErrorBox, Loading } from '../../components/ui'
import { PageHeader } from '../../components/PageHeader'
import { SelectField } from '../../components/FilterBar'
import { Stepper } from '../../components/Stepper'
import { confirmDialog } from '../../components/dialog'
import { toast } from '../../components/toast'
import './learn.css'
import { DesignForm, useDesignForm } from './paths/DesignForm'
import { useDraftPlan } from './paths/useDraftPlan'
import DraftReview from './paths/DraftReview'
import DraftEditor from './paths/DraftEditor'
import DraftPublish from './paths/DraftPublish'

const STEPS = [
  { id: '1', label: 'Mục tiêu và người học' },
  { id: '2', label: 'Bản nháp AI' },
  { id: '3', label: 'Sửa' },
  { id: '4', label: 'Phát hành' },
]
const NEXT_LABEL = { 1: 'Tiếp: Bản nháp AI', 2: 'Tiếp: Sửa', 3: 'Tiếp: Phát hành', 4: 'Phát hành lộ trình' }

export default function Design() {
  const [st, set] = useUrlState({ id: { default: '' }, step: { default: '', values: ['1', '2', '3', '4'] } })
  const id = st.id
  const { data: opts, error: optsErr } = useFetch(() => api.designOptions(), [])
  const { data: drafts, reload: reloadDrafts } = useFetch(() => api.designDrafts(), [])
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState(null)
  const form = useDesignForm(opts, (d) => { setDraft(d); set({ id: d.id, step: '2' }, { push: true }); reloadDrafts() })

  useEffect(() => {
    if (!id) { setDraft(null); return }
    if (draft?.id === id) return
    api.designDraft(id).then(setDraft, (e) => setErr(e.message))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const step = draft ? (st.step || '3') : '1'
  const setStep = (s) => set({ step: s }, { push: true })
  const onSaved = (d) => { setDraft(d); reloadDrafts() }

  return (
    <>
      <PageHeader
        title="Thiết kế lộ trình"
        description="Điền yêu cầu → AI dựng lộ trình nháp chỉ từ thẻ VCWIKI đã duyệt mà bạn và mọi người học đều xem được, ghi mã thẻ + phiên bản, báo chỗ thiếu tri thức → bạn sửa, lưu nháp, rồi phát hành."
        actions={(
          <>
            {draft && <button type="button" className="ui-btn ui-btn-ghost" data-testid="design-new" onClick={() => set({ id: '', step: '' }, { push: true })}>+ Lộ trình mới</button>}
            {drafts?.items?.length > 0 && (
              <SelectField label="Mở bản nháp đã có" value={id} testId="design-open" onChange={(v) => set({ id: v, step: '' }, { push: true })}
                options={[{ value: '', label: '— Lộ trình mới —' }, ...drafts.items.map((d) => ({ value: d.id, label: `${d.title} · ${dateTime(d.updated_at)}` }))]} />
            )}
          </>
        )}
      />
      <ErrorBox>{optsErr || err}</ErrorBox>
      {!opts && !optsErr && <Loading />}
      {opts && id && !draft && !err && <Loading>Đang mở bản nháp…</Loading>}
      {opts && !draft && !id && (
        <Shell step="1" onStep={setStep}
          body={<DesignForm opts={opts} form={form} />}
          foot={<Foot n={1} onBack={() => {}} save={{ disabled: true }} next={{ label: form.busy ? 'Đang dựng…' : 'Tiếp: AI dựng lộ trình nháp', submitForm: 'design-form', disabled: form.busy }} />} />
      )}
      {opts && draft && <DraftFlow key={draft.id} draft={draft} opts={opts} form={form} step={step} onStep={setStep} onSaved={onSaved} />}
    </>
  )
}

function Shell({ step, onStep, body, foot }) {
  return (
    <>
      <Stepper label="Các bước thiết kế lộ trình" steps={STEPS} current={step} onSelect={onStep} testId="design-steps" />
      {body}
      {foot}
    </>
  )
}

// Chân trang cố định: Quay lại · Lưu nháp · Tiếp
function Foot({ n, onBack, save, next }) {
  return (
    <div className="lrn-design-foot" data-testid="design-foot">
      <button type="button" className="ui-btn" disabled={n === 1} onClick={onBack} data-testid="design-back">Quay lại</button>
      <span className="grow" />
      <button type="button" className="ui-btn ui-btn-ghost" disabled={save.disabled} onClick={save.onClick} data-testid="design-save">{save.label || 'Lưu nháp'}</button>
      <button type={next.submitForm ? 'submit' : 'button'} form={next.submitForm} className="ui-btn ui-btn-primary" disabled={next.disabled} onClick={next.onClick} data-testid="design-next">{next.label}</button>
    </div>
  )
}

function DraftFlow({ draft, opts, form, step, onStep, onSaved }) {
  const navigate = useNavigate()
  const dp = useDraftPlan(draft, onSaved)
  const [pubBusy, setPubBusy] = useState(false)
  const [pubErr, setPubErr] = useState(null)
  const n = Number(step)

  const publish = async () => {
    const ok = await confirmDialog({
      title: 'Phát hành lộ trình? Sau khi phát hành nội dung bị khoá.',
      body: 'Bài học nháp của bạn trong lộ trình được phát hành cùng.', okLabel: 'Phát hành lộ trình',
    })
    if (!ok) return
    setPubBusy(true)
    setPubErr(null)
    try {
      if (dp.dirty || !draft.lesson_ids?.length) { if (!await dp.save({ quiet: true })) return }
      await api.publishPath(draft.id)
      toast('Đã phát hành lộ trình — giao bài ở tab Giao bài.')
      navigate(`/learn/paths/${draft.id}?tab=assign`)
    } catch (e) { setPubErr(e.message) } finally { setPubBusy(false) }
  }

  const body = n === 1 ? <DesignForm opts={opts} form={form} hasDraft />
    : n === 2 ? <DraftReview draft={draft} plan={dp.plan} />
      : n === 3 ? <DraftEditor draft={draft} dp={dp} />
        : <DraftPublish draft={draft} plan={dp.plan} dirty={dp.dirty} />
  const next = n === 4
    ? { label: NEXT_LABEL[4], onClick: publish, disabled: dp.locked || pubBusy || dp.busy }
    : { label: NEXT_LABEL[n], onClick: () => onStep(String(n + 1)), disabled: n === 1 && form.busy }
  return (
    <Shell step={step} onStep={onStep}
      body={<><ErrorBox>{dp.err || pubErr}</ErrorBox>{body}</>}
      foot={<Foot n={n} onBack={() => onStep(String(n - 1))} next={next}
        save={{ disabled: dp.locked || dp.busy || n < 2, onClick: () => dp.save(), label: dp.overwrite ? 'Lưu nháp (ghi đè)' : 'Lưu nháp' }} />} />
  )
}
