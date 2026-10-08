// Trạng thái trang trên URL (DESIGN V.5 CMP-15, SYS-28): tab, bộ lọc, trang số, đối tượng đang mở.
// useUrlState(schema) đọc / ghi nhiều tham số một lúc; giá trị mặc định không ghi lên URL; tham số ngoài schema giữ
// nguyên. Gõ chữ dùng `replace` (không đầy lịch sử), đổi tab / mở đối tượng dùng `push` (nút Quay lại chạy đúng).
//
// schema: { q: { default: '' }, page: { type: 'number', default: 1 }, mine: { type: 'bool' }, tags: { type: 'list' } }
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

const DEFAULTS = { string: '', number: null, bool: false, list: [] }

function defOf(spec) {
  const type = spec.type || 'string'
  return spec.default !== undefined ? spec.default : DEFAULTS[type]
}

function decode(raw, spec) {
  const type = spec.type || 'string'
  if (raw === null) return defOf(spec)
  if (type === 'number') {
    const n = Number(raw)
    return raw !== '' && Number.isFinite(n) ? n : defOf(spec)
  }
  if (type === 'bool') return raw === '1' || raw === 'true'
  if (type === 'list') return raw ? raw.split(',').filter(Boolean) : []
  if (spec.values && !spec.values.includes(raw)) return defOf(spec)   // giá trị lạ trên URL → mặc định
  return raw
}

function encode(value, spec) {
  const type = spec.type || 'string'
  if (type === 'bool') return value ? '1' : null
  if (type === 'list') return Array.isArray(value) && value.length ? value.join(',') : null
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function isDefault(value, spec) {
  const d = defOf(spec)
  if (Array.isArray(d)) return !value?.length && !d.length
  return value === d || (value === '' && d === null) || (value === null && d === '')
}

export function parseUrlState(search, schema) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search)
  const out = {}
  for (const [key, spec] of Object.entries(schema)) out[key] = decode(params.get(key), spec)
  return out
}

// Chuỗi query mới sau khi áp `patch`; khoá có trong `patch` mà bằng mặc định thì bị gỡ khỏi URL
export function buildSearch(search, patch, schema) {
  const params = new URLSearchParams(search instanceof URLSearchParams ? search.toString() : search)
  for (const [key, value] of Object.entries(patch)) {
    const spec = schema[key] || {}
    const enc = isDefault(value, spec) ? null : encode(value, spec)
    if (enc === null) params.delete(key)
    else params.set(key, enc)
  }
  return params.toString()
}

// Trả [state, set]; set(patch, { push }) — `patch` có thể là hàm (state cũ → patch)
export function useUrlState(schema) {
  const [params, setParams] = useSearchParams()
  const key = params.toString()
  const schemaKey = JSON.stringify(schema)
  const state = useMemo(() => parseUrlState(key, JSON.parse(schemaKey)), [key, schemaKey])
  const set = useCallback((patch, { push = false } = {}) => {
    setParams((prev) => {
      const sch = JSON.parse(schemaKey)
      const cur = parseUrlState(prev, sch)
      const p = typeof patch === 'function' ? patch(cur) : patch
      return new URLSearchParams(buildSearch(prev, p, sch))
    }, { replace: !push })
  }, [setParams, schemaKey])
  return [state, set]
}
