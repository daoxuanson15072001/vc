import { test } from 'node:test'
import assert from 'node:assert/strict'
import { highlightParts, markTime, queryTerms, readSearch, startParam, withOpen, withSearch } from './contentSearch.js'

test('markTime: mm:ss và h:mm:ss như mốc trong chữ video', () => {
  assert.equal(markTime(0), '00:00')
  assert.equal(markTime(70), '01:10')
  assert.equal(markTime(599.9), '09:59')
  assert.equal(markTime(3723), '1:02:03')
  assert.equal(markTime(null), '00:00')
  assert.equal(markTime(-5), '00:00')
})

test('queryTerms: bỏ dấu, bỏ hư từ / từ 1 ký tự, dài trước', () => {
  assert.deepEqual(queryTerms('Bao lâu thì thay DẦU nhớt?'), ['thay', 'nhot', 'bao', 'lau', 'dau'])
  assert.deepEqual(queryTerms('  '), [])
  assert.deepEqual(queryTerms('đĩa phanh'), ['phanh', 'dia'])
})

const marked = (parts) => parts.filter((p) => p.hit).map((p) => p.text)

test('highlightParts: không phân biệt dấu / hoa thường, chỉ khớp đầu từ, giữ nguyên chữ gốc', () => {
  const parts = highlightParts('Thay Dầu nhớt định kỳ; dâu tây thì không. Bảo dưỡng.', 'dau nhot bao')
  assert.equal(parts.map((p) => p.text).join(''), 'Thay Dầu nhớt định kỳ; dâu tây thì không. Bảo dưỡng.')
  assert.deepEqual(marked(parts), ['Dầu', 'nhớt', 'dâu', 'Bảo'])
  assert.deepEqual(marked(highlightParts('Phanh đĩa', 'đĩa')), ['đĩa'])
  assert.deepEqual(marked(highlightParts('xedau', 'dau')), [])                 // giữa từ: không tô
  assert.deepEqual(highlightParts('abc', ''), [{ text: 'abc', hit: false }])
  assert.deepEqual(highlightParts('', 'abc'), [])
})

test('highlightParts: dữ liệu có ký tự HTML vẫn là chữ thường (render bằng React, không innerHTML)', () => {
  const parts = highlightParts('<script>alert(1)</script> dầu', 'dầu')
  assert.equal(parts[0].text, '<script>alert(1)</script> ')
  assert.deepEqual(marked(parts), ['dầu'])
})

test('startParam: chỉ nhận số ≥ 0', () => {
  assert.equal(startParam('70'), 70)
  assert.equal(startParam('12.7'), 12)
  assert.equal(startParam('0'), 0)
  assert.equal(startParam(null), null)
  assert.equal(startParam(''), null)
  assert.equal(startParam('-3'), null)
  assert.equal(startParam('abc'), null)
})

test('readSearch / withSearch: chế độ nội dung và câu tìm nằm trong URL', () => {
  const p = new URLSearchParams('source=s1')
  const on = withSearch(p, { content: true, q: 'thay dầu' })
  assert.equal(on.get('mode'), 'content')
  assert.equal(on.get('source'), 's1')
  assert.deepEqual(readSearch(on), { content: true, q: 'thay dầu' })
  const off = withSearch(on, { content: false })
  assert.equal(off.get('mode'), null)
  assert.equal(off.get('q'), null)
  assert.deepEqual(readSearch(new URLSearchParams('q=abc')), { content: false, q: '' })
})

test('withOpen: ?source=&doc=&t=, đóng thì bỏ cả doc / t; link cũ chỉ có source vẫn được', () => {
  const base = new URLSearchParams('mode=content&q=x')
  const a = withOpen(base, 's1', 'd1', 75.6)
  assert.equal(a.toString(), 'mode=content&q=x&source=s1&doc=d1&t=75')
  assert.equal(withOpen(a, 's2').toString(), 'mode=content&q=x&source=s2')
  assert.equal(withOpen(a, null).toString(), 'mode=content&q=x')
  assert.equal(withOpen(base, 's1', 'd1', null).get('t'), null)
})
