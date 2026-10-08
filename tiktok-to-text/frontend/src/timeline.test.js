import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTimeline, compareInStage } from './timeline.js'

const card = (id, extra = {}) => ({ id, type: 'concept', created_at: '2026-09-01T00:00:00Z', ...extra })

test('chia chặng theo bậc thấp -> cao, bỏ bậc trống, chữ cái liên tục, không bậc xếp cuối', () => {
  const stages = buildTimeline([
    card('d1', { level: 'dieu-hanh' }),
    card('x1'),
    card('n1', { level: 'nhap-mon' }),
    card('t1', { level: 'thiet-ke' }),
    card('z1', { level: 'la' }),
  ])
  assert.deepEqual(stages.map((s) => [s.letter, s.level]), [['A', 'nhap-mon'], ['B', 'thiet-ke'], ['C', 'dieu-hanh'], ['D', '']])
  assert.deepEqual(stages[3].cards.map((c) => c.id), ['x1', 'z1'])
})

test('đánh số liên tục qua các chặng', () => {
  const stages = buildTimeline([card('a', { level: 'dieu-hanh' }), card('b', { level: 'nhap-mon' }), card('c', { level: 'dieu-hanh' })])
  assert.deepEqual(stages.flatMap((s) => s.cards.map((c) => [c.id, c.n])), [['b', 1], ['a', 2], ['c', 3]])
})

test('trong chặng: bước quy trình trước, theo thứ tự bước', () => {
  const list = [
    card('none', { type: 'concept' }),
    card('c', { type: 'hook', process_steps: ['qt.ban-hang-b2b.c'] }),
    card('a', { type: 'lesson', process_steps: ['qt.ban-hang-b2b.d', 'qt.ban-hang-b2b.a'] }),
  ].sort(compareInStage)
  assert.deepEqual(list.map((c) => c.id), ['a', 'c', 'none'])
})

test('trong chặng: loại theo mạch học, loại khác xếp sau', () => {
  const types = ['kpi', 'hook', 'lesson', 'case_study', 'insight', 'regulation', 'framework', 'concept']
  const list = types.map((t) => card(t, { type: t })).sort(compareInStage)
  assert.deepEqual(list.map((c) => c.type), ['concept', 'framework', 'regulation', 'insight', 'case_study', 'lesson', 'hook', 'kpi'])
})

test('trùng hết thì thẻ cũ trước, thiếu created_at lấy thời điểm từ ObjectId', () => {
  const list = [
    card('new', { created_at: '2026-09-20T00:00:00Z' }),
    card('old', { created_at: '2026-01-01T00:00:00Z' }),
    { id: '5f000000aaaaaaaaaaaaaaaa', type: 'concept' },   // 2020
  ].sort(compareInStage)
  assert.deepEqual(list.map((c) => c.id), ['5f000000aaaaaaaaaaaaaaaa', 'old', 'new'])
})

test('rỗng / null', () => {
  assert.deepEqual(buildTimeline([]), [])
  assert.deepEqual(buildTimeline(null), [])
})
