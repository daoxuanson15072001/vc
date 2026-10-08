// Tính thuần cho SCR-15 Học tập của tôi (DESIGN V.7): chữ hạn ("còn 3 ngày"), việc kế tiếp của thẻ bài giao.
// Tách khỏi React để có test đơn vị (due.test.js).
const DAY = 86400000

// Chữ hạn + tông màu: còn ≤ 3 ngày → warn (chữ + màu), quá hạn → bad, còn lại muted; không có hạn → null
export function dueInfo(dueAt, now = Date.now()) {
  if (!dueAt) return null
  const ms = new Date(dueAt).getTime() - now
  if (Number.isNaN(ms)) return null
  if (ms < 0) return { text: `quá hạn ${Math.max(1, Math.ceil(-ms / DAY))} ngày`, tone: 'bad' }
  const days = Math.ceil(ms / DAY)
  if (days === 0) return { text: 'hết hạn hôm nay', tone: 'warn' }
  return { text: `còn ${days} ngày`, tone: days <= 3 ? 'warn' : 'muted' }
}

// Số thứ tự (từ 1) của bài học kế tiếp theo thứ tự các tuần / tháng; không thấy → 0
export function nextLessonNo(modules, nextId) {
  const ids = (modules || []).flatMap((m) => (m.lessons || []).map((l) => l.id))
  return ids.indexOf(nextId) + 1
}

// Việc kế tiếp của một thẻ bài giao — đúng MỘT nút chính; phần còn lại là liên kết phụ.
//   kind: 'resume-exam' (đang làm dở) · 'exam' (vào thi) · 'lesson' (bài kế) · 'result' (xem kết quả) · null
// primary: việc chính; extra: việc phụ còn được phép (vd đã có lượt thi nhưng chưa học xong vẫn được Vào thi)
export function nextAction(a) {
  const ex = a.exam
  const cur = ex?.attempt
  const canRetake = !!ex && (!cur || (!!cur.finalized_at && !cur.passed)) && ex.attempts_used < ex.attempts_allowed
  const lessonsLeft = !!a.next_lesson_id
  const acts = []
  if (cur && !cur.submitted_at) acts.push({ kind: 'resume-exam' })
  else if (canRetake && !lessonsLeft) acts.push({ kind: 'exam' })
  if (lessonsLeft) acts.push({ kind: 'lesson', no: nextLessonNo(a.modules, a.next_lesson_id), started: !!a.started })
  if (canRetake && lessonsLeft) acts.push({ kind: 'exam' })
  if (cur?.submitted_at) acts.push({ kind: 'result', done: !!cur.finalized_at })
  const chosen = acts.filter((x) => !(a.status === 'completed' && x.kind !== 'result'))
  const list = chosen.length ? chosen : acts
  // đã chấm xong / chờ chấm: xem kết quả là phụ, không phải nút chính
  const primary = list.find((x) => x.kind !== 'result') || null
  return { primary, extra: list.filter((x) => x !== primary) }
}
