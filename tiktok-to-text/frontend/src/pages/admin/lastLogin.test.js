import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isStale, relativeLogin, sortByLogin } from './lastLogin.js'

const NOW = Date.parse('2026-09-30T12:00:00Z')
const ago = (ms) => new Date(NOW - ms).toISOString()

test('thời gian tương đối', () => {
  assert.equal(relativeLogin(null, NOW), 'Chưa đăng nhập')
  assert.equal(relativeLogin(ago(10_000), NOW), 'Vừa xong')
  assert.equal(relativeLogin(ago(5 * 60_000), NOW), '5 phút trước')
  assert.equal(relativeLogin(ago(3 * 3_600_000), NOW), '3 giờ trước')
  assert.equal(relativeLogin(ago(2 * 86_400_000), NOW), '2 ngày trước')
  assert.equal(relativeLogin(ago(45 * 86_400_000), NOW), '1 tháng trước')
})

test('lọc không đăng nhập ≥ 30 ngày gồm cả chưa từng đăng nhập', () => {
  assert.equal(isStale(null, NOW), true)
  assert.equal(isStale(ago(29 * 86_400_000), NOW), false)
  assert.equal(isStale(ago(30 * 86_400_000), NOW), true)
})

test('sắp xếp: chưa đăng nhập luôn cuối', () => {
  const rows = [{ id: 'a', last_login_at: null }, { id: 'b', last_login_at: ago(9e6) }, { id: 'c', last_login_at: ago(1e6) }]
  assert.deepEqual(sortByLogin(rows, 'desc').map((r) => r.id), ['c', 'b', 'a'])
  assert.deepEqual(sortByLogin(rows, 'asc').map((r) => r.id), ['b', 'c', 'a'])
})
