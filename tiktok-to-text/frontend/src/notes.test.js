import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupBySource, noteHref, noteTime, readNoteFilters, relativeTime, withNoteFilter } from './notes.js'

test('readNoteFilters: đọc bộ lọc từ URL, bỏ giá trị lạ, tài liệu cần nguồn', () => {
  const f = readNoteFilters(new URLSearchParams('q=hook&mine=1&kind=bogus&page=3&doc_id=d1'))
  assert.equal(f.q, 'hook')
  assert.equal(f.mine, '1')
  assert.equal(f.kind, '')
  assert.equal(f.page, 3)
  assert.equal(f.doc_id, '')   // chưa chọn nguồn
  assert.equal(readNoteFilters(new URLSearchParams('source_id=s1&doc_id=d1&page=0')).doc_id, 'd1')
  assert.equal(readNoteFilters(new URLSearchParams('page=0')).page, 1)
})

test('withNoteFilter: đổi lọc về trang 1, đổi kho / nguồn bỏ lọc con', () => {
  const p = new URLSearchParams('space_id=k1&source_id=s1&doc_id=d1&page=4&q=x')
  assert.equal(withNoteFilter(p, 'q', 'y').toString(), 'space_id=k1&source_id=s1&doc_id=d1&q=y')
  assert.equal(withNoteFilter(p, 'source_id', 's2').toString(), 'space_id=k1&source_id=s2&q=x')
  assert.equal(withNoteFilter(p, 'space_id', '').toString(), 'q=x')
  assert.equal(withNoteFilter(p, 'page', 5).get('page'), '5')
  assert.equal(withNoteFilter(new URLSearchParams(), 'mine', false).toString(), '')
})

test('noteHref + noteTime: link mở tài liệu đúng giây', () => {
  assert.equal(noteHref({ source_id: 's', doc_id: 'd', t: 83.7 }), '/kb?source=s&doc=d&t=83')
  assert.equal(noteHref({ source_id: 's', doc_id: null, t: 5 }), '/kb?source=s')
  assert.equal(noteTime(83), '▶ 01:23')
  assert.equal(noteTime(null), '')
})

test('groupBySource giữ thứ tự mới nhất trước', () => {
  const g = groupBySource([
    { id: 1, source_id: 'a', source_title: 'A' }, { id: 2, source_id: 'b', source_title: 'B' }, { id: 3, source_id: 'a' },
  ])
  assert.deepEqual(g.map((x) => [x.source_id, x.items.map((i) => i.id)]), [['a', [1, 3]], ['b', [2]]])
  assert.equal(g[0].title, 'A')
})

test('relativeTime', () => {
  const now = Date.parse('2026-09-30T12:00:00Z')
  assert.equal(relativeTime('2026-09-30T11:59:30Z', now), 'vừa xong')
  assert.equal(relativeTime('2026-09-30T11:55:00Z', now), '5 phút trước')
  assert.equal(relativeTime('2026-09-30T09:00:00Z', now), '3 giờ trước')
  assert.equal(relativeTime('2026-09-28T12:00:00Z', now), '2 ngày trước')
  assert.equal(relativeTime('', now), '')
})
