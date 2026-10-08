// Hộp «Lộ trình trống» (LRN-03): tạo bản nháp bằng tay — tên, kỳ, năm / tháng, kế thừa khung năm đã phát hành.
// Tạo xong chuyển sang /learn/paths/<id> (trang sửa). Mở từ menu *+ Lộ trình mới* ở trang danh sách.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../api'
import { ErrorBox } from '../../../components/ui'
import { Modal } from '../../../components/Overlay'

function defaultForm() {
  const now = new Date()
  // mặc định tháng sau; đang tháng 12 thì tháng 1 NĂM SAU (QA vòng 2, L9)
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { title: '', period: 'month', year: next.getFullYear(), month: next.getMonth() + 1, parent: '' }
}

export default function NewPath({ open, frames, onClose }) {
  const navigate = useNavigate()
  const [f, setF] = useState(defaultForm)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const close = () => { setErr(null); onClose() }
  const save = async (e) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const p = await api.createPath({
        title: f.title, period: f.period, year: Number(f.year), month: f.period === 'month' ? Number(f.month) : null,
        parent_path_id: f.parent || null,
      })
      navigate(`/learn/paths/${p.id}`)
    } catch (e2) { setErr(e2.message); setBusy(false) }
  }
  return (
    <Modal open={open} title="Lộ trình trống" onClose={close} testId="path-new-modal"
      footer={(
        <>
          <button type="button" className="ui-btn ui-btn-ghost" data-testid="path-create-cancel" onClick={close}>Huỷ</button>
          <button type="submit" form="path-new-form" className="ui-btn ui-btn-primary" data-testid="path-create" disabled={busy}>Tạo bản nháp</button>
        </>
      )}>
      <form id="path-new-form" onSubmit={save} className="lrn-form">
        <label className="field"><span>Tên lộ trình *</span><input value={f.title} onChange={set('title')} required maxLength={200} aria-label="Tên lộ trình" data-testid="path-title" /></label>
        <div className="row row-wrap">
          <label className="field field-sm"><span>Kỳ</span>
            <select value={f.period} onChange={set('period')} aria-label="Kỳ" data-testid="path-period"><option value="month">Tháng</option><option value="year">Năm (khung)</option></select></label>
          <label className="field field-sm"><span>Năm</span><input type="number" value={f.year} onChange={set('year')} min={2020} max={2100} aria-label="Năm" data-testid="path-year" /></label>
          {f.period === 'month' && (
            <label className="field field-sm"><span>Tháng</span>
              <select value={f.month} onChange={set('month')} aria-label="Tháng" data-testid="path-month">{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
          )}
        </div>
        {f.period === 'month' && frames.length > 0 && (
          <label className="field"><span>Kế thừa khung năm</span>
            <select value={f.parent} onChange={set('parent')} aria-label="Kế thừa khung năm" data-testid="path-parent">
              <option value="">— không —</option>
              {frames.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.owner_name})</option>)}
            </select></label>
        )}
        <ErrorBox>{err}</ErrorBox>
      </form>
    </Modal>
  )
}
