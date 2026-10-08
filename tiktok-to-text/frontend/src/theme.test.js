// TOK-COLOR: công tắc giao diện Theo máy / Sáng / Tối
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyTheme, normalizeTheme } from './theme.js'

test('normalizeTheme: giá trị lạ → theo máy', () => {
  assert.equal(normalizeTheme('dark'), 'dark')
  assert.equal(normalizeTheme('light'), 'light')
  assert.equal(normalizeTheme('hồng'), 'system')
  assert.equal(normalizeTheme(null), 'system')
})

test('applyTheme: ghi / gỡ data-theme', () => {
  const attrs = {}
  const root = { setAttribute: (k, v) => { attrs[k] = v }, removeAttribute: (k) => { delete attrs[k] } }
  applyTheme('dark', root)
  assert.equal(attrs['data-theme'], 'dark')
  applyTheme('system', root)
  assert.equal(attrs['data-theme'], undefined)
})
