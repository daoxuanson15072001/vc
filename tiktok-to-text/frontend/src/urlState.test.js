// CMP-15 useUrlState: phần tính thuần — đọc / ghi tham số, bỏ giá trị mặc định khỏi URL, giữ tham số lạ
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSearch, parseUrlState } from './urlState.js'

const schema = {
  q: { default: '' },
  page: { type: 'number', default: 1 },
  mine: { type: 'bool' },
  tags: { type: 'list' },
  tab: { default: 'sources', values: ['sources', 'videos'] },
}

test('parseUrlState: kiểu, mặc định, giá trị lạ', () => {
  assert.deepEqual(parseUrlState('', schema), { q: '', page: 1, mine: false, tags: [], tab: 'sources' })
  assert.deepEqual(parseUrlState('q=lọc+gió&page=3&mine=1&tags=a,b&tab=videos', schema),
    { q: 'lọc gió', page: 3, mine: true, tags: ['a', 'b'], tab: 'videos' })
  assert.equal(parseUrlState('page=abc', schema).page, 1)
  assert.equal(parseUrlState('tab=hack', schema).tab, 'sources')
})

test('buildSearch: bỏ mặc định, giữ tham số ngoài schema', () => {
  assert.equal(buildSearch('card=42', { q: 'phanh', page: 1 }, schema), 'card=42&q=phanh')
  assert.equal(buildSearch('q=phanh&page=2', { q: '' }, schema), 'page=2')
  assert.equal(buildSearch('', { mine: true, tags: ['x', 'y'] }, schema), 'mine=1&tags=x%2Cy')
  assert.equal(buildSearch('mine=1&tags=x', { mine: false, tags: [] }, schema), '')
  assert.equal(buildSearch('', { tab: 'sources' }, schema), '')
  assert.equal(buildSearch('', { tab: 'videos' }, schema), 'tab=videos')
})
