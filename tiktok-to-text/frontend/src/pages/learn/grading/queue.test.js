import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unitOptions, filterRows, pageSlice, pathOptions } from './queue.js'

const NOW = Date.parse('2026-09-30T08:00:00Z')
const ago = (d) => new Date(NOW - d * 86400000).toISOString()
const L = [
  { id: '1', path_title: 'B', submitted_at: ago(1), finalized_at: null },
  { id: '2', path_title: 'A', submitted_at: ago(10), finalized_at: ago(9) },
  { id: '3', path_title: 'A', submitted_at: ago(40), finalized_at: null },
]

test('filterRows: theo lộ trình, ngày nộp, trạng thái', () => {
  assert.equal(filterRows(L, {}, NOW).length, 3)
  assert.deepEqual(filterRows(L, { path: 'A' }, NOW).map((r) => r.id), ['2', '3'])
  assert.deepEqual(filterRows(L, { days: 7 }, NOW).map((r) => r.id), ['1'])
  assert.deepEqual(filterRows(L, { days: 30 }, NOW).map((r) => r.id), ['1', '2'])
  assert.deepEqual(filterRows(L, { status: 'finalized' }, NOW).map((r) => r.id), ['2'])
  assert.deepEqual(filterRows(L, { status: 'pending' }, NOW).map((r) => r.id), ['1', '3'])
})

test('pathOptions: tên lộ trình không trùng, có thứ tự', () => {
  assert.deepEqual(pathOptions(L), ['A', 'B'])
})

test('pageSlice: kẹp số trang vào khoảng có dữ liệu', () => {
  const r = pageSlice(L, 9, 2)
  assert.equal(r.page, 2)
  assert.deepEqual(r.rows.map((x) => x.id), ['3'])
  assert.equal(pageSlice([], 1, 12).pages, 1)
})

test('lọc theo đơn vị người học và hạn bài giao', () => {
  const now = Date.parse('2026-10-01T00:00:00Z')
  const rows = [
    { id: 'a', learner_unit_id: 'u1', due_at: '2026-09-30T00:00:00Z' },
    { id: 'b', learner_unit_id: 'u2', due_at: '2026-10-03T00:00:00Z' },
    { id: 'c', learner_unit_id: 'u1', due_at: null },
  ]
  const ids = (f) => filterRows(rows, f, now).map((r) => r.id)
  assert.deepEqual(ids({ unit: 'u1' }), ['a', 'c'])
  assert.deepEqual(ids({ due: 'overdue' }), ['a'])
  assert.deepEqual(ids({ due: 'soon' }), ['b'])
  assert.deepEqual(ids({ due: 'none' }), ['c'])
  assert.deepEqual(unitOptions([{ learner_unit_id: 'u2', learner_unit: 'Kỹ thuật' }, { learner_unit_id: 'u1', learner_unit: 'Kinh doanh' }]).map((u) => u.value), ['u1', 'u2'])
})
