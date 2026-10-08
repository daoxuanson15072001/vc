// Tab Duyệt của thẻ (GOV-02, 05): thẻ nháp chờ duyệt, đề xuất sửa đang mở, đề xuất mới tạo, cờ lỗi thời.
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui'

export function ReviewTab({ card, pending, proposals, notice }) {
  const link = (ch, text) => <Link className="link" to={`/wiki/review?change=${ch.id}`}>{text}</Link>
  const stepText = (ch) => (ch.status === 'needs_rebase' ? 'cần cập nhật lên bản mới'
    : ch.min_approvers === 1 ? 'chờ 1 người duyệt' : `bước ${ch.step}/2${ch.step === 2 ? ` — ${ch.step2_label}` : ''}`)
  const empty = !notice && !pending && !proposals.length && !card.obsolete
  return (
    <section className="review-state card" aria-label="Trạng thái duyệt">
      {empty && <p className="small muted">Thẻ không có đề xuất nào đang chờ duyệt.{card.reviewed_by_name && ` Duyệt lần cuối bởi ${card.reviewed_by_name}.`}</p>}
      {card.obsolete && <div><Badge tone="muted">Lỗi thời</Badge> <span className="small">{card.obsolete.reason}</span></div>}
      {notice && <div className="strong small review-notice">{notice.text}{notice.change?.id && <> · {link(notice.change, 'Xem đề xuất')}</>}</div>}
      {pending && <div className="small">Đang chờ duyệt: {stepText(pending)} · {link(pending, 'Mở hộp duyệt')}</div>}
      {proposals.map((p) => (
        <div key={p.id} className="small">Đề xuất «{p.summary}» ({p.kind_label}): {stepText(p)} · {link(p, 'Xem')}</div>
      ))}
    </section>
  )
}
