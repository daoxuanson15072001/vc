// Khung chấm bên phải của Chấm bài theo ?attempt= (DESIGN V.6 TPL-A2, SCR-17):
//   - màn ≥ 1000px: cột phải cố định <section aria-labelledby>, tiêu đề h2 "Chấm bài: <người học>", nút Chốt điểm ở chân khung;
//   - màn hẹp: Drawer (bẫy tiêu điểm, Esc đóng — đóng là bỏ ?attempt=).
// Chốt xong (onFinalized) trang tự mở bài kế; tiêu điểm vào tiêu đề khung khi dữ liệu bài đó về (focusReq).
import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { usePageMeta } from '../../../pageMeta'
import { dateTime } from '../../../format'
import { Drawer } from '../../../components/Overlay'
import { StatusBadge } from '../../../components/StatusBadge'
import { ErrorBox, Loading } from '../../../components/ui'
import { Markdown } from '../../../components/markdown'
import { scoreText } from '../common'
import { GradeBody, GradeFoot } from './GradeForm'
import { useGrade } from './useGrade'

// Bài đã chốt (tab Tất cả): điểm + nhận xét + đường dẫn tới kết quả đầy đủ
function FinalView({ a }) {
  return (
    <div className="gr-body">
      <div className="gr-total">
        <div>Điểm: <b data-testid="final-score">{scoreText(a.final_score, a.max_score)}</b>{' '}
          {a.passed != null && <StatusBadge kind="learnPass" status={a.passed ? 'pass' : 'fail'} />}</div>
        <Link className="link" to={`/learn/attempts/${a.id}`}>Mở kết quả đầy đủ</Link>
      </div>
      {a.feedback && <div><b>Nhận xét của người chấm:</b><div data-testid="feedback"><Markdown text={a.feedback} /></div></div>}
      {a.appeal && (
        <div className="small">
          <b>Phản hồi của người học:</b> {a.appeal.text}
          {a.appeal.answer ? <div><b>Người chấm trả lời:</b> {a.appeal.answer}</div> : <div className="muted">Chờ người chấm trả lời — mở kết quả đầy đủ để trả lời.</div>}
        </div>
      )}
    </div>
  )
}

// Mỗi bài chưa chốt một phiên chấm riêng (key = id bài) để điểm / nhận xét không lẫn sang bài khác
function GradeSession({ a, onFinalized, render }) {
  const st = useGrade(a, onFinalized)
  return render(<GradeBody st={st} />, <GradeFoot st={st} />)
}

export function GradePane({ id, wide, focusReq, onFinalized, onClose }) {
  const { data, error } = useFetch(() => api.attempt(id), [id])
  const a = data?.id === id ? data : null
  const titleRef = useRef(null)
  const titleId = useId()
  const title = a ? `Chấm bài: ${a.learner_name || 'người học'}` : 'Chấm bài'
  usePageMeta(a ? { object: title } : {})
  useEffect(() => {
    if (a && focusReq?.current === id) { focusReq.current = null; titleRef.current?.focus({ preventScroll: false }) }
  }, [a, id, focusReq])

  const meta = a && (
    <div className="gr-pane-meta">
      {a.path_title && <span>{a.path_title}</span>}
      {a.submitted_at && <span>nộp {dateTime(a.submitted_at)}</span>}
      {a.auto_submitted && <span className="ui-badge" data-tone="warn">Hết giờ — tự nộp</span>}
      <StatusBadge kind="learnGrade" status={a.finalized_at ? 'finalized' : 'pending'} />
    </div>
  )

  const frame = (body, foot) => (wide ? (
    <section className="rv-pane" aria-labelledby={titleId} data-testid="grading-detail">
      <div className="rv-pane-head">
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="rv-pane-title">{title}</h2>
        {meta}
      </div>
      <div className="rv-pane-body">{body}</div>
      {foot && <div className="rv-pane-foot">{foot}</div>}
    </section>
  ) : (
    <Drawer open title={<span ref={titleRef} tabIndex={-1} className="rv-title-focus">{title}</span>} sub="Chấm bài" onClose={onClose}
      closeLabel="Đóng bài đang chấm" footer={foot} size="wide" testId="grading-detail" headExtra={meta}>
      {body}
    </Drawer>
  ))

  if (error) return frame(<ErrorBox>{error}</ErrorBox>, null)
  if (!a) return frame(<Loading />, null)
  if (a.finalized_at) return frame(<FinalView a={a} />, null)
  return <GradeSession key={id} a={a} onFinalized={onFinalized} render={frame} />
}
