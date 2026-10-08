// Khung chấm một bài thi (DESIGN SCR-17 — LRN-08): câu trắc nghiệm đã chấm tự động; câu tự luận có bài làm, đáp án mẫu,
// rubric, điểm AI sơ bộ, ô điểm, lý do lệch điểm AI; nhận xét bắt buộc; nút chính Chốt điểm (có xác nhận).
// GradeBody = phần cuộn, GradeFoot = chân khung (nút chính) — cả hai nhận trạng thái từ useGrade().
import { Badge, ErrorBox } from '../../../components/ui'
import { Markdown } from '../../../components/markdown'
import { AI_STATUS, QUESTION_KIND, scoreText } from '../common'
import { answerText } from './answerText'
import { useGrade } from './useGrade'

export function GradeBody({ st }) {
  const { a, g, ai, essays, scores, setScores, reasons, setReasons, feedback, setFeedback, deviates, total } = st
  const sol = Object.fromEntries((g.solution || []).map((s) => [s.question_id, s]))
  const auto = Object.fromEntries((g.auto_items || []).map((i) => [i.question_id, i]))
  return (
    <div className="gr-body">
      <div className="gr-total">
        <div>
          <div>Trắc nghiệm (chấm tự động): <b>{scoreText(a.auto_score, a.auto_max)}</b></div>
          {essays.length > 0 && <div className="muted small">{AI_STATUS[g.ai_status] || ''}{g.ai_error ? ` (${g.ai_error})` : ''}</div>}
        </div>
        <div>Tổng dự kiến: <b data-testid="grade-total">{scoreText(total, a.max_score)}</b></div>
      </div>
      {a.paper.map((p, i) => {
        const s = sol[p.question_id]
        const x = ai[p.question_id]
        return (
          <div key={p.question_id} className="gr-q lrn-q" data-testid={`grade-q-${i + 1}`}>
            <div className="gr-q-head">
              <div className="gr-q-stem">Câu {i + 1}. {p.stem}</div>
              <span className="muted small">{QUESTION_KIND[p.kind]} · {p.max}đ</span>
            </div>
            {p.kind !== 'essay' ? (
              <div className="small">
                Trả lời: {answerText(p, a.answers?.[p.question_id])} · đáp án: {(s?.correct || []).map((k) => k.toUpperCase()).join(', ')}{' '}
                {auto[p.question_id]?.is_correct ? <Badge tone="good">Đúng</Badge> : <Badge tone="bad">Sai</Badge>}
              </div>
            ) : (
              <>
                <div><div className="muted small">Bài làm</div><div className="gr-essay">{a.answers?.[p.question_id] || '(bỏ trống)'}</div></div>
                {s?.model_answer && <div className="small"><b>Đáp án mẫu:</b> <Markdown text={s.model_answer} /></div>}
                <table className="gr-rubric">
                  <caption className="sr-only">Rubric câu {i + 1}</caption>
                  <thead><tr><th scope="col">Tiêu chí</th><th scope="col">Mức đạt</th><th scope="col">Tối đa</th><th scope="col">AI</th></tr></thead>
                  <tbody>
                    {(s?.rubric || []).map((r, j) => (
                      <tr key={j}>
                        <td>{r.criterion}</td><td>{r.descriptor}</td><td>{r.max}</td>
                        <td>{x?.per_criterion?.[j] ? <>{x.per_criterion[j].score} — {x.per_criterion[j].comment}</> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {x?.note && <div className="small muted">{x.note}</div>}
                {x && x.score != null && <div className="small">Điểm AI sơ bộ: <b data-testid="ai-score">{scoreText(x.score, p.max)}</b>{x.feedback ? ` · ${x.feedback}` : ''}</div>}
                {a.can_grade && (
                  <div className="gr-score-row">
                    <label><span>Điểm câu {i + 1}</span>
                      <input type="number" min={0} max={p.max} step={0.5} value={scores[p.question_id]}
                        onChange={(e) => setScores({ ...scores, [p.question_id]: e.target.value })} /></label>
                    {deviates(p) && (
                      <label className="gr-reason"><span>Lý do lệch điểm AI (bắt buộc — lệch từ 20% thang điểm)</span>
                        <input value={reasons[p.question_id] || ''} onChange={(e) => setReasons({ ...reasons, [p.question_id]: e.target.value })} /></label>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
      {a.can_grade && (
        <div className="gr-feedback">
          <div className="gr-q-head">
            <label htmlFor="gr-feedback-input" className="strong">Nhận xét cho người học (bắt buộc)</label>
            {g.ai_feedback && (
              <button type="button" className="link small" onClick={() => setFeedback(feedback ? `${feedback}\n${g.ai_feedback}` : g.ai_feedback)}>
                Chèn nhận xét nháp của AI
              </button>
            )}
          </div>
          <textarea id="gr-feedback-input" rows={4} data-testid="grade-feedback" value={feedback}
            onChange={(e) => setFeedback(e.target.value)} />
        </div>
      )}
    </div>
  )
}

export function GradeFoot({ st }) {
  const { a, err, busy, ready, finalize } = st
  if (!a.can_grade) {
    return <p className="muted small">Bạn xem được bài làm nhưng không chốt điểm (chỉ người giao lộ trình hoặc quản lý trực tiếp của người học).</p>
  }
  return (
    <div className="gr-foot">
      <ErrorBox>{err}</ErrorBox>
      <div className="gr-foot-row">
        <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !ready} onClick={finalize}
          aria-label={a.learner_name ? `Chốt điểm: ${a.learner_name}` : undefined} data-testid="grade-finalize">Chốt điểm</button>
      </div>
    </div>
  )
}

// /learn/attempts/:id khi người chấm mở thẳng link (không qua hàng chờ): thân + chân xếp dọc trong trang
export function GradeStandalone({ a, onDone }) {
  const st = useGrade(a, onDone)
  return (
    <section className="stack" aria-label="Chấm bài">
      <GradeBody st={st} />
      <GradeFoot st={st} />
    </section>
  )
}
