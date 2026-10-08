// Chân khung chi tiết đề xuất (DESIGN SCR-09, TPL-A2): ô *Nhận xét / lý do* (bắt buộc khi Trả về / Từ chối — lỗi bằng
// chữ, aria-invalid), *Mức thay đổi*, rồi hàng nút: Thêm ▾ (Nhận xét, Rút đề xuất) · Trả về · Từ chối · **Duyệt**
// (chính, cuối). Duyệt / Trả về / Từ chối không gửi ngay: onDecide(decision, body) để trang hoãn gửi 8 giây (Hoàn tác
// được). Đề xuất của tôi đang bị trả về (GOV-13, TK-04d): nút chính *Sửa và gửi lại* mở form trong khung (onResubmit).
import { useId, useState } from 'react'
import { ActionMenu } from '../../components/ActionMenu'
import { api } from '../../api'
import { changeTitle } from './queue'

const CHANGE_KIND = { minor: 'Nhỏ — không phải học lại', major: 'Lớn — người đã học phải học lại' }

const REASON_MISSING = {
  reject: 'Từ chối cần ghi lý do — nhập lý do vào ô trên rồi bấm Từ chối lại.',
  return: 'Trả về cần ghi lý do (người đề xuất sẽ sửa theo) — nhập lý do vào ô trên rồi bấm Trả về lại.',
}

export function ChangeActions({ ch, busy, comment, setComment, onDecide, onAct, onResubmit, editing }) {
  const [kind, setKind] = useState('')
  const [error, setError] = useState(null)
  const fieldId = useId()
  const errId = useId()
  const name = changeTitle(ch)
  const open = ch.status === 'open' || ch.status === 'needs_rebase'
  if (!open) return null

  const text = comment.trim()
  const decide = (decision) => {
    if (REASON_MISSING[decision] && !text) return setError(REASON_MISSING[decision])
    if (decision === 'comment' && !text) return setError('Nhận xét đang trống — nhập nội dung vào ô trên.')
    setError(null)
    const body = { decision, comment: text, ...(kind ? { change_kind: kind } : {}) }
    if (decision === 'comment') return onAct(() => api.decideChange(ch.id, body), 'Đã ghi nhận xét', () => setComment(''))
    return onDecide(decision, body)
  }

  const more = [
    { label: 'Nhận xét', icon: 'message', onSelect: () => decide('comment'), testId: 'review-change-comment' },
    ch.can_withdraw && {
      label: 'Rút đề xuất…', danger: true, testId: 'review-change-withdraw',
      confirm: { title: `Rút đề xuất «${name}»?`, okLabel: 'Rút đề xuất' },
      onSelect: () => onAct(() => api.withdrawChange(ch.id, text), 'Đã rút đề xuất', () => setComment('')),
    },
  ]

  return (
    <div className="rv-foot">
      <div className="rv-foot-fields">
        <div className="rv-field">
          <label htmlFor={fieldId}>Nhận xét / lý do <span className="rv-muted">(bắt buộc khi Trả về / Từ chối)</span></label>
          <textarea id={fieldId} rows={2} value={comment} data-testid="review-comment"
            onChange={(e) => { setComment(e.target.value); if (error) setError(null) }}
            aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} />
          {error && <p id={errId} className="rv-field-error" data-testid="review-comment-error">{error}</p>}
        </div>
        {ch.can_decide && ch.change_kind && (
          <div className="rv-field rv-field-sm">
            <label htmlFor={`${fieldId}-k`}>Mức thay đổi</label>
            <select id={`${fieldId}-k`} value={kind || ch.change_kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(CHANGE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}
      </div>
      {!ch.can_decide && ch.status === 'open' && !ch.returned && (
        <p className="rv-muted">Bạn không phải người duyệt của bước này{ch.is_mine ? ' (không tự duyệt đề xuất của mình)' : ''}.</p>
      )}
      {ch.returned && !ch.can_resubmit && (
        <p className="rv-muted" data-testid="review-returned-wait">Đề xuất đã trả về người đề xuất sửa — duyệt tiếp khi người đề xuất gửi lại.</p>
      )}
      <div className="rv-foot-buttons">
        <ActionMenu items={more} name={`đề xuất ${name}`} testId="review-change-more" />
        {ch.can_resubmit && !editing && (
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy} data-testid="review-change-resubmit"
            aria-label={`Sửa và gửi lại: ${name}`} onClick={onResubmit}>Sửa và gửi lại</button>
        )}
        {ch.can_return && (
          <button type="button" className="ui-btn" disabled={busy} data-testid="review-change-return"
            aria-label={`Trả về người đề xuất sửa: ${name}`} onClick={() => decide('return')}>Trả về</button>
        )}
        {ch.can_decide && (
          <button type="button" className="ui-btn" disabled={busy} data-testid="review-change-reject"
            aria-label={`Từ chối: ${name}`} onClick={() => decide('reject')}>Từ chối</button>
        )}
        {ch.can_decide && (
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy} data-testid="review-change-approve"
            aria-label={`Duyệt: ${name}`} onClick={() => decide('approve')}>Duyệt</button>
        )}
      </div>
    </div>
  )
}
