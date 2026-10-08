// Trạng thái khung chấm một bài thi (LRN-08): điểm từng câu tự luận (khởi đầu = điểm AI sơ bộ), lý do khi lệch điểm AI
// ≥ 20% thang điểm câu, nhận xét bắt buộc, Chốt điểm có xác nhận. Dùng ở khung phải của /learn/grading (?attempt=) và
// ở /learn/attempts/:id khi người chấm mở thẳng link.
import { useState } from 'react'
import { api } from '../../../api'
import { confirmDialog } from '../../../components/dialog'
import { toast } from '../../../components/toast'
import { scoreText } from '../common'

export function useGrade(a, onFinalized) {
  const g = a.grading || {}
  const ai = Object.fromEntries((g.ai_grading || []).map((x) => [x.question_id, x]))
  const essays = a.paper.filter((p) => p.kind === 'essay')
  const [scores, setScores] = useState(() => Object.fromEntries(essays.map((p) => [p.question_id, ai[p.question_id]?.score ?? ''])))
  const [reasons, setReasons] = useState({})
  const [feedback, setFeedback] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const deviates = (p) => {
    const x = ai[p.question_id]?.score
    const s = scores[p.question_id]
    return x != null && s !== '' && p.max > 0 && Math.abs(Number(s) - x) >= 0.2 * p.max - 1e-9
  }
  const total = (a.auto_score || 0) + essays.reduce((t, p) => t + (Number(scores[p.question_id]) || 0), 0)
  const ready = !!feedback.trim() && !essays.some((p) => scores[p.question_id] === '')

  const finalize = async () => {
    if (!(await confirmDialog({
      title: 'Chốt điểm? Sau khi chốt không sửa được, người học thấy điểm và nhận xét.',
      body: a.learner_name ? `Người học: ${a.learner_name}` : '', okLabel: 'Chốt điểm',
    }))) return
    setErr(null)
    setBusy(true)
    try {
      const res = await api.finalizeAttempt(a.id, {
        feedback,
        scores: essays.map((p) => ({ question_id: p.question_id, score: Number(scores[p.question_id]), reason: reasons[p.question_id] || '' })),
      })
      toast(`Đã chốt điểm${a.learner_name ? `: ${a.learner_name}` : ''} — ${scoreText(res.final_score, res.max_score)}`)
      onFinalized?.(res)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return { a, g, ai, essays, scores, setScores, reasons, setReasons, feedback, setFeedback, err, busy, deviates, total, ready, finalize }
}
