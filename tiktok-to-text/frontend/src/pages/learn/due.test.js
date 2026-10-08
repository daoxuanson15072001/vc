import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dueInfo, nextAction, nextLessonNo } from './due.js'

const NOW = Date.parse('2026-09-30T08:00:00Z')
const day = (n) => new Date(NOW + n * 86400000).toISOString()

test('dueInfo: còn ≤ 3 ngày là warn, xa hơn muted, quá hạn bad, không hạn null', () => {
  assert.deepEqual(dueInfo(day(3), NOW), { text: 'còn 3 ngày', tone: 'warn' })
  assert.deepEqual(dueInfo(day(10), NOW), { text: 'còn 10 ngày', tone: 'muted' })
  assert.deepEqual(dueInfo(day(-2), NOW), { text: 'quá hạn 2 ngày', tone: 'bad' })
  assert.equal(dueInfo(null, NOW), null)
  assert.equal(dueInfo(new Date(NOW + 3600000).toISOString(), NOW).text, 'còn 1 ngày')
})

const mods = [{ lessons: [{ id: 'a' }, { id: 'b' }] }, { lessons: [{ id: 'c' }] }]

test('nextLessonNo: thứ tự bài kế tiếp xuyên các tuần', () => {
  assert.equal(nextLessonNo(mods, 'c'), 3)
  assert.equal(nextLessonNo(mods, 'x'), 0)
})

test('nextAction: một nút chính — bài kế, hoặc Vào thi khi đã học xong', () => {
  const ex = { attempts_used: 0, attempts_allowed: 2, attempt: null }
  let r = nextAction({ modules: mods, next_lesson_id: 'b', started: true, exam: ex, status: 'in_progress' })
  assert.equal(r.primary.kind, 'lesson')
  assert.equal(r.primary.no, 2)
  assert.deepEqual(r.extra.map((x) => x.kind), ['exam'])
  r = nextAction({ modules: mods, next_lesson_id: null, exam: ex, status: 'in_progress' })
  assert.equal(r.primary.kind, 'exam')
  assert.equal(r.extra.length, 0)
})

test('nextAction: đang làm dở thì Tiếp tục thi; đã nộp thì chỉ còn Xem kết quả phụ', () => {
  const base = { modules: mods, next_lesson_id: null, status: 'in_progress' }
  let r = nextAction({ ...base, exam: { attempts_used: 1, attempts_allowed: 1, attempt: { id: 'x', submitted_at: null } } })
  assert.equal(r.primary.kind, 'resume-exam')
  r = nextAction({ ...base, exam: { attempts_used: 1, attempts_allowed: 1, attempt: { id: 'x', submitted_at: 't', finalized_at: null } } })
  assert.equal(r.primary, null)
  assert.deepEqual(r.extra.map((x) => x.kind), ['result'])
})

test('nextAction: thi trượt còn lượt thì Vào thi lại; hết lượt / đạt thì chỉ xem kết quả', () => {
  const at = { id: 'x', submitted_at: 't', finalized_at: 't', passed: false }
  let r = nextAction({ modules: mods, next_lesson_id: null, status: 'in_progress', exam: { attempts_used: 1, attempts_allowed: 2, attempt: at } })
  assert.equal(r.primary.kind, 'exam')
  assert.equal(r.extra[0].kind, 'result')
  r = nextAction({ modules: mods, next_lesson_id: null, status: 'completed', exam: { attempts_used: 2, attempts_allowed: 2, attempt: at } })
  assert.equal(r.primary, null)
  assert.equal(r.extra[0].kind, 'result')
})
