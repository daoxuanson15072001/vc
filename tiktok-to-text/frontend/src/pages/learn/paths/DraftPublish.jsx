// Bước 4 *Phát hành* (LRN-04 → LRN-03): tóm tắt bản nháp, cảnh báo còn thay đổi chưa lưu / thiếu tri thức, rồi nút
// *Phát hành lộ trình* ở chân trang. Phát hành khoá nội dung; giao bài ở trang Lộ trình, tab Giao bài.
import { Link } from 'react-router-dom'
import { Notice } from '../../../components/Notice'

export default function DraftPublish({ draft, plan, dirty }) {
  const unit = draft.period === 'year' ? 'tháng' : 'tuần'
  const lessons = plan.weeks.flatMap((w) => w.lessons.filter((l) => l.cards.length))
  const cards = new Set(lessons.flatMap((l) => l.cards.map((c) => c.card_id)))
  const locked = draft.status !== 'draft'
  return (
    <section className="card lrn-step-card lrn-form">
      <h2 className="lrn-sec">Phát hành lộ trình</h2>
      {locked && <Notice tone="good" testId="design-published">Lộ trình đã phát hành. <Link className="link" to={`/learn/paths/${draft.id}?tab=assign`}>Giao bài ở trang Lộ trình →</Link></Notice>}
      <dl className="lrn-summary">
        <dt>Tên</dt><dd>{plan.title || draft.title}</dd>
        <dt>Nội dung</dt><dd>{plan.weeks.length} {unit} · {lessons.length} bài học · {cards.size} thẻ VCWIKI</dd>
        <dt>Bài thi</dt><dd>{plan.exam?.blueprint ? `${plan.exam.blueprint} · ${plan.exam.duration_min ?? 45} phút · đạt từ ${plan.exam.pass_score ?? 70}%` : 'chưa mô tả ma trận đề'}</dd>
        <dt>Thiếu tri thức</dt><dd>{draft.gaps?.length ? `${draft.gaps.length} chỗ (xem bước 2)` : 'không'}</dd>
      </dl>
      {!locked && dirty && <Notice tone="warn" testId="design-dirty">Còn thay đổi chưa lưu — bấm <b>Phát hành lộ trình</b> sẽ lưu nháp trước rồi phát hành.</Notice>}
      {!locked && <p className="muted small">Phát hành khoá nội dung; bài học nháp của bạn trong lộ trình được phát hành cùng. Muốn chỉnh chủ đề / hạn từng {unit}, mục bắt buộc, ma trận đề chi tiết thì mở
        {' '}<Link className="link" to={`/learn/paths/${draft.id}`}>trang Lộ trình</Link> trước.</p>}
    </section>
  )
}
