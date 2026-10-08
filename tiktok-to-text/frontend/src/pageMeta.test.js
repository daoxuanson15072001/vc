// CMP-15 usePageMeta / SEO-04: tiêu đề tab, canonical, gộp lớp meta
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalUrl, composeTitle, mergeLayers } from './pageMeta.js'

test('composeTitle: "<đối tượng> · <màn> · VC Content Engine"', () => {
  assert.equal(composeTitle({ title: 'VCWIKI' }), 'VCWIKI · VC Content Engine')
  assert.equal(composeTitle({ title: 'Dự án marketing', object: 'Ra mắt lọc gió Q4' }), 'Ra mắt lọc gió Q4 · Dự án marketing · VC Content Engine')
  assert.equal(composeTitle({ raw: 'Mã lỗi DTC · VCWIKI', title: 'VCWIKI' }), 'Mã lỗi DTC · VCWIKI · VC Content Engine')
  assert.equal(composeTitle({}), 'VC Content Engine')
})

test('canonicalUrl: chỉ giữ tham số mở đối tượng', () => {
  assert.equal(canonicalUrl('http://x', '/wiki', '?q=a&card=7&page=2', ['card']), 'http://x/wiki?card=7')
  assert.equal(canonicalUrl('http://x', '/kb', '?q=a', ['source']), 'http://x/kb')
})

test('mergeLayers: lớp sau đè trường nó có, bỏ qua giá trị rỗng', () => {
  const m = mergeLayers([{ meta: { title: 'VCWIKI', description: 'd' } }, { meta: { object: 'Thẻ A', description: '' } }])
  assert.deepEqual(m, { title: 'VCWIKI', description: 'd', object: 'Thẻ A' })
})
