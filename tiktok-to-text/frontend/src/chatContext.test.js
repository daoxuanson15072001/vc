// AIX-12: ngữ cảnh Chat nhanh có h1, bộ lọc, đối tượng đang mở
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildChatContext } from './chatContext.js'

test('trang thường: đường dẫn + tiêu đề + h1', () => {
  assert.equal(buildChatContext({ pathname: '/wiki', title: 'VCWIKI', h1: 'VCWIKI' }), '/wiki (VCWIKI) · h1: VCWIKI')
})

test('tham số query: bộ lọc tách khỏi đối tượng đang mở (objectKeys)', () => {
  const c = buildChatContext({ pathname: '/kb', search: '?status=error&source=abc', title: 'Kho tư liệu', h1: 'Kho tư liệu' })
  assert.match(c, /^\/kb\?status=error&source=abc \(Kho tư liệu\)/)
  assert.match(c, /bộ lọc: status=error/)
  assert.match(c, /đang mở: source=abc/)
})

test('trang đối tượng: id lấy từ đường dẫn', () => {
  assert.match(buildChatContext({ pathname: '/studio/66f0c1', h1: 'Chiến dịch A' }), /đang mở: id=66f0c1/)
  assert.doesNotMatch(buildChatContext({ pathname: '/studio' }), /đang mở/)
})

test('không quá 500 ký tự', () => {
  assert.ok(buildChatContext({ pathname: '/kb', search: `?q=${'x'.repeat(900)}` }).length <= 500)
})
