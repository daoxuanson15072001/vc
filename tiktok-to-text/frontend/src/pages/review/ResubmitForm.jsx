// Form *Sửa và gửi lại* đề xuất bị trả về (GOV-13, DESIGN TK-04d, SCR-09 tab *Tôi đề xuất*) — nằm đầu thân khung
// chi tiết. Đề xuất sửa nội dung (`update`): sửa Tiêu đề / Tóm tắt / Nội dung / Ý chính của bản đề xuất (giá trị đầu là
// "bản đề xuất" `ch.after`), chỉ gửi trường đã đổi — BE ghi đè từng trường lên đề xuất cũ. Thẻ nháp (`create`): sửa
// thẳng thẻ trong VCWIKI rồi quay lại bấm Gửi lại. Loại khác: sửa tóm tắt / lý do. Gửi qua onAct (toast + tải lại).
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'

const CONTENT_KINDS = ['update']
const FIELDS = [['title', 'Tiêu đề', 1], ['summary', 'Tóm tắt thẻ', 2], ['body', 'Nội dung', 8], ['key_points', 'Ý chính (mỗi dòng một ý)', 4]]

const asText = (k, v) => (k === 'key_points' ? (v || []).join('\n') : (v ?? ''))
const fromText = (k, t) => (k === 'key_points' ? t.split('\n').map((x) => x.trim()).filter(Boolean) : t)

export function ResubmitForm({ ch, busy, onAct, onCancel }) {
  const id = useId()
  const first = useRef(null)
  const editContent = CONTENT_KINDS.includes(ch.kind)
  const initial = Object.fromEntries(FIELDS.map(([k]) => [k, asText(k, ch.after?.[k])]))
  const [vals, setVals] = useState(initial)
  const [summary, setSummary] = useState(ch.summary || '')
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => { first.current?.focus() }, [])

  const submit = (e) => {
    e.preventDefault()
    if (editContent && !vals.title.trim()) return setError('Tiêu đề không được trống.')
    setError(null)
    const changed = FIELDS.filter(([k]) => vals[k] !== initial[k])
    const body = {
      note: note.trim(),
      ...(summary.trim() && summary.trim() !== ch.summary ? { summary: summary.trim() } : {}),
      ...(editContent && changed.length ? { proposal: Object.fromEntries(changed.map(([k]) => [k, fromText(k, vals[k])])) } : {}),
    }
    return onAct(() => api.resubmitChange(ch.id, body), 'Đã gửi lại đề xuất', onCancel)
  }

  const errId = `${id}-err`
  return (
    <form className="rv-resubmit" onSubmit={submit} aria-labelledby={`${id}-h`} data-testid="review-resubmit-form">
      <h3 id={`${id}-h`} className="rv-h3">Sửa và gửi lại</h3>
      {ch.kind === 'create' && (
        <p className="rv-muted">
          Thẻ nháp sửa thẳng trong VCWIKI:{' '}
          <Link className="link" to={`/wiki?card=${ch.card?.id}`}>mở thẻ «{ch.card?.title}» để sửa</Link>, rồi quay lại đây bấm Gửi lại.
        </p>
      )}
      {editContent && FIELDS.map(([k, label, rows], i) => (
        <div className="rv-field" key={k}>
          <label htmlFor={`${id}-${k}`}>{label}</label>
          {rows === 1
            ? <input id={`${id}-${k}`} ref={i === 0 ? first : undefined} value={vals[k]} data-testid={`review-resubmit-${k}`}
                aria-invalid={k === 'title' && error ? true : undefined} aria-describedby={k === 'title' && error ? errId : undefined}
                onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
            : <textarea id={`${id}-${k}`} rows={rows} value={vals[k]} data-testid={`review-resubmit-${k}`}
                onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />}
        </div>
      ))}
      <div className="rv-field">
        <label htmlFor={`${id}-sum`}>Tóm tắt thay đổi</label>
        <input id={`${id}-sum`} ref={editContent ? undefined : first} value={summary} maxLength={1000}
          data-testid="review-resubmit-summary" onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div className="rv-field">
        <label htmlFor={`${id}-note`}>Lời nhắn cho người duyệt <span className="rv-muted">(không bắt buộc)</span></label>
        <textarea id={`${id}-note`} rows={2} value={note} maxLength={4000} data-testid="review-resubmit-note"
          onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p id={errId} className="rv-field-error" role="alert">{error}</p>}
      <div className="rv-foot-buttons">
        <button type="button" className="ui-btn" onClick={onCancel} disabled={busy}>Huỷ sửa</button>
        <button type="submit" className="ui-btn ui-btn-primary" disabled={busy} data-testid="review-resubmit-send">Gửi lại</button>
      </div>
    </form>
  )
}
