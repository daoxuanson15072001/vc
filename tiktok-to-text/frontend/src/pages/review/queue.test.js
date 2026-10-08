import { test } from 'node:test'
import assert from 'node:assert/strict'
import { neighbours, nextAfter, stepText } from './queue.js'

const L = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

test('nextAfter: mục sau, mục cuối thì mục trước, không có trong danh sách thì mục đầu', () => {
  assert.equal(nextAfter(L, 'a'), 'b')
  assert.equal(nextAfter(L, 'b'), 'c')
  assert.equal(nextAfter(L, 'c'), 'b')
  assert.equal(nextAfter(L, 'x'), 'a')
  assert.equal(nextAfter([{ id: 'a' }], 'a'), null)
  assert.equal(nextAfter([], 'a'), null)
  assert.equal(nextAfter(['a', 'b'], 'a'), 'b')
})

test('neighbours: trước / sau / vị trí', () => {
  assert.deepEqual(neighbours(L, 'b'), { prev: 'a', next: 'c', pos: 2, total: 3 })
  assert.deepEqual(neighbours(L, 'a'), { prev: null, next: 'b', pos: 1, total: 3 })
  assert.deepEqual(neighbours(L, 'z'), { prev: null, next: null, pos: 0, total: 3 })
})

test('stepText', () => {
  assert.equal(stepText({ status: 'open', min_approvers: 1, step: 1 }, 'Đang mở'), 'Chờ 1 người duyệt')
  assert.equal(stepText({ status: 'open', min_approvers: 2, step: 2 }, 'Đang mở'), 'Bước 2/2')
  assert.equal(stepText({ status: 'approved' }, 'Đã duyệt'), 'Đã duyệt')
})
