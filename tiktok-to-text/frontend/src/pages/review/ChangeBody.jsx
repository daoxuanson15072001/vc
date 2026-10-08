// Thân khung chi tiết một đề xuất (DESIGN SCR-09, TPL-A2): huy hiệu, người đề xuất / hạn, kết quả cổng so sánh
// (Notice), so sánh hai cột Bản hiện tại / Bản đề xuất (ins / del), lượt duyệt. Nút quyết định nằm ở chân khung
// (ChangeActions.jsx). Hành động tức thời trong thân (đổi kết quả cổng so sánh, cập nhật lên bản mới) gọi onAct.
import { Link } from 'react-router-dom'
import { CARD_LEVEL, dateTime } from '../../format'
import { Notice } from '../../components/Notice'
import { StatusBadge } from '../../components/StatusBadge'
import { CardContent } from '../../components/playlist'
import { statusInfo } from '../../statuses'
import { api } from '../../api'
import { ReviewDiff } from './ReviewDiff'
import { stepText } from './queue'

const DECISION = { approve: 'Duyệt', reject: 'Từ chối', comment: 'Nhận xét', return: 'Trả về', resubmit: 'Gửi lại' }
const NOTICE_TONE = { new: 'good', supplement: 'info', conflict: 'bad', duplicate: 'warn', noise: 'warn' }
const VERDICTS = ['new', 'duplicate', 'supplement', 'conflict', 'noise']

export function ChangeBadges({ ch }) {
  const st = statusInfo('change', ch.status)
  return (
    <div className="rv-badges">
      <span className="ui-badge" data-tone="info">{ch.kind_label}</span>
      <StatusBadge kind="change" status={ch.status} label={stepText(ch, st.label)} />
      {ch.returned && <StatusBadge kind="changeFlag" status="returned" testId="review-returned-badge" />}
      {ch.change_kind && <span className="ui-badge">{ch.change_kind === 'major' ? 'Thay đổi lớn' : 'Thay đổi nhỏ'}</span>}
      {ch.overdue && <span className="ui-badge" data-tone="bad">{ch.needs_escalation ? 'Quá hạn — cần chuyển cấp' : 'Quá hạn'}</span>}
    </div>
  )
}

function Novelty({ ch, busy, onAct, comment }) {
  const nov = ch.novelty
  const canNovelty = ch.status === 'open' && ch.can_override_novelty   // chỉ người duyệt đổi (QA P-4)
  const v = nov ? statusInfo('novelty', nov.verdict) : null
  return (
    <section aria-label="Cổng so sánh" className="rv-block">
      <h3 className="rv-h3">Cổng so sánh</h3>
      {nov ? (
        <Notice tone={NOTICE_TONE[nov.verdict] || 'info'} title={v.label} testId="review-novelty">
          {nov.reason}
          <span className="rv-muted"> · {nov.engine === 'heuristic' ? 'Luật đơn giản (tạm — chạy lại khi AI sẵn sàng)' : nov.engine}</span>
          {ch.novelty_override && <span className="rv-muted"> · người đã sửa kết quả (AI: {statusInfo('novelty', ch.novelty_ai?.verdict).label})</span>}
        </Notice>
      ) : (
        <Notice tone="info">{ch.novelty_status === 'skipped' ? 'Không chạy cổng so sánh.' : 'Đang so sánh với các thẻ đã có…'}</Notice>
      )}
      {canNovelty && (
        <label className="rv-inline-field">Đổi kết quả cổng so sánh{' '}
          <select value="" disabled={busy}
            onChange={(e) => e.target.value && onAct(() => api.overrideNovelty(ch.id, { verdict: e.target.value, reason: comment.trim() }), 'Đã đổi kết quả cổng so sánh')}>
            <option value="">— chọn —</option>
            {VERDICTS.map((k) => <option key={k} value={k}>{statusInfo('novelty', k).label}</option>)}
          </select>
        </label>
      )}
    </section>
  )
}

function Content({ ch }) {
  const nov = ch.novelty
  if (ch.kind === 'create') {
    const rel = ch.related_cards || []
    return (
      <section aria-label="Nội dung đề xuất" className="rv-block">
        <h3 className="rv-h3">Nội dung thẻ</h3>
        {rel.length > 0 && ['duplicate', 'supplement', 'conflict'].includes(nov?.verdict) ? (
          <div className="rv-diff">
            <div role="group" aria-label="Thẻ đã có" className="rv-diff-side">
              <h4 className="rv-diff-head">Thẻ đã có: <Link className="link" to={`/wiki?card=${rel[0].id}`}>{rel[0].title}</Link></h4>
              <CardContent card={rel[0]} />
            </div>
            <div role="group" aria-label="Thẻ nháp đề xuất" className="rv-diff-side">
              <h4 className="rv-diff-head">Thẻ nháp đề xuất</h4>
              <CardContent card={ch.after} />
            </div>
          </div>
        ) : <CardContent card={ch.after} />}
        {rel.length > 0 && (
          <p className="rv-muted">Thẻ gần:{' '}
            {rel.map((c) => <Link key={c.id} className="link rv-gap" to={`/wiki?card=${c.id}`}>{c.title} ({Number(c.score).toFixed(2)})</Link>)}
          </p>
        )}
      </section>
    )
  }
  if (ch.kind === 'obsolete') {
    return <p>Thẻ sẽ được đánh dấu <b>lỗi thời</b> (vẫn xem được, không dùng cho bài học / Chiến dịch).</p>
  }
  return (
    <section aria-label="So sánh thay đổi" className="rv-block">
      <h3 className="rv-h3">Thay đổi{ch.kind === 'rollback' ? ` — quay về nội dung bản ${ch.target_rev}` : ''}</h3>
      {ch.diff?.length
        ? <ReviewDiff changes={ch.diff} currentRev={ch.base_rev || ch.card?.current_revision} />
        : <p className="rv-muted">Không có khác biệt ở phần nội dung chính.</p>}
      {ch.after && (
        <details className="review-full" open={!ch.can_open_card}>
          <summary>Toàn bộ nội dung thẻ sau khi áp đề xuất</summary>
          <CardContent card={ch.after} />
        </details>
      )}
    </section>
  )
}

export function ChangeBody({ ch, busy, onAct, comment }) {
  return (
    <div className="rv-body" data-id={ch.id} data-status={ch.status}>
      <ChangeBadges ch={ch} />
      <p className="rv-meta">
        <span>Người đề xuất: {ch.created_by_name || 'AI'}{ch.author_ai ? ' (AI viết)' : ''} · {dateTime(ch.created_at)}</span>
        {ch.card?.level && <span>Bậc: {CARD_LEVEL[ch.card.level] || ch.card.level}</span>}
        {ch.card?.current_revision && <span>Bản hiệu lực: {ch.card.current_revision}{ch.base_rev ? ` · dựng trên bản ${ch.base_rev}` : ''}</span>}
        {(ch.status === 'open' || ch.status === 'needs_rebase') && !ch.returned && <span>Hạn bước hiện tại: {dateTime(ch.due_at)}</span>}
      </p>
      {ch.card && (ch.can_open_card
        ? <p><Link className="link" to={`/wiki?card=${ch.card.id}`} data-testid="review-open-card">Mở thẻ trong VCWIKI: {ch.card.title}</Link></p>
        : <p className="rv-muted review-outside">Bạn duyệt thẻ này nhưng không ở trong kho chứa thẻ — nội dung thẻ nằm ngay trong đề xuất bên dưới.</p>)}
      {ch.returned && (
        <Notice tone="warn" title={ch.is_mine ? 'Người duyệt trả về để bạn sửa' : 'Đã trả về người đề xuất sửa'} testId="review-returned">
          <span data-testid="review-returned-note">{ch.returned.note}</span>
          <span className="rv-muted"> · {ch.returned_by_name || 'Người duyệt'}, bước {ch.returned.step}, {dateTime(ch.returned.at)}</span>
        </Notice>
      )}
      {ch.summary && <p><span className="rv-muted">Tóm tắt thay đổi:</span> {ch.summary}</p>}
      <p className="rv-steps">
        {ch.min_approvers === 1
          ? <>Dùng thử: <b>1 người</b> duyệt là xong (bước 2 gộp vào bước 1).</>
          : <>Bước 1: người duyệt trong kho · Bước 2: <b>{ch.step2_label}</b>{ch.step2_names?.length ? ` (${ch.step2_names.join(', ')})` : ''}</>}
        {ch.status === 'open' && <> · Đang ở <b>{stepText(ch)}</b>{ch.returned ? ' (chờ người đề xuất gửi lại)' : ''}</>}
        {ch.suggested_reviewers?.length > 0 && <><br /><span className="rv-muted">Gợi ý người duyệt: {ch.suggested_reviewers.map((u) => u.name).join(', ')}</span></>}
      </p>

      {ch.kind === 'create' && <Novelty ch={ch} busy={busy} onAct={onAct} comment={comment} />}
      <Content ch={ch} />

      {ch.approvals?.length > 0 && (
        <section aria-label="Lượt duyệt" className="rv-block">
          <h3 className="rv-h3">Lượt duyệt và nhận xét</h3>
          <ul className="rv-approvals">
            {ch.approvals.map((a, i) => (
              <li key={i} data-decision={a.decision}>
                <b>{a.user_name || 'Hệ thống'}</b>
                <span>{a.step ? `Bước ${a.step} · ` : ''}{DECISION[a.decision]}</span>
                <span className="rv-grow">{a.comment}</span>
                <span className="rv-muted">{dateTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ch.status === 'needs_rebase' && (
        <Notice tone="warn" action={ch.can_rebase && (
          <button type="button" className="ui-btn ui-btn-sm" disabled={busy}
            onClick={() => onAct(() => api.rebaseChange(ch.id), 'Đã cập nhật đề xuất lên bản mới')}>Cập nhật lên bản mới</button>
        )}>Thẻ đã có phiên bản mới hơn bản đề xuất dựng trên.</Notice>
      )}
      {ch.status === 'approved' && ch.revision && <Notice tone="good">Đã thành <b>bản {ch.revision}</b> của thẻ.</Notice>}
    </div>
  )
}
