// Ghi chép theo nguồn / từng tài liệu (WK-45): hàm thuần cho components/kbNotes.jsx và màn /kb/notes.
// Không phụ thuộc React — chạy được bằng `node --test` (notes.test.js).
import { markTime } from './contentSearch.js'

export const NOTE_TEXT_MAX = 2000   // khớp kb/notes.TEXT_MAX

// Bộ lọc màn /kb/notes nằm trên URL: ?q=&space_id=&source_id=&doc_id=&mine=1&kind=&page=
export const NOTE_FILTER_KEYS = ['q', 'space_id', 'source_id', 'doc_id', 'mine', 'kind', 'page']

export function readNoteFilters(params) {
  const f = Object.fromEntries(NOTE_FILTER_KEYS.map((k) => [k, params.get(k) || '']))
  const page = Number(f.page)
  f.page = Number.isInteger(page) && page > 1 ? page : 1
  f.mine = f.mine === '1' ? '1' : ''
  f.kind = ['note', 'intake'].includes(f.kind) ? f.kind : ''
  if (!f.source_id) f.doc_id = ''   // tài liệu chỉ lọc được khi đã chọn nguồn
  return f
}

// Đổi một bộ lọc -> URLSearchParams mới; đổi lọc thì về trang 1, đổi kho / nguồn thì bỏ lọc con
export function withNoteFilter(params, key, value) {
  const next = new URLSearchParams(params)
  const set = (k, v) => (v === '' || v == null || v === false ? next.delete(k) : next.set(k, String(v)))
  set(key, value)
  if (key !== 'page') next.delete('page')
  if (key === 'space_id') { next.delete('source_id'); next.delete('doc_id') }
  if (key === 'source_id') next.delete('doc_id')
  return next
}

// Link mở tài liệu (và giây) trong chi tiết nguồn ở Kho tư liệu
export function noteHref(n) {
  const p = new URLSearchParams({ source: n.source_id })
  if (n.doc_id) {
    p.set('doc', n.doc_id)
    if (n.t != null) p.set('t', String(Math.max(0, Math.floor(n.t))))
  }
  return `/kb?${p}`
}

export const noteTime = (t) => (t == null ? '' : `▶ ${markTime(t)}`)

// Gom kết quả (đã sắp mới nhất trước) theo nguồn, giữ thứ tự xuất hiện đầu tiên của từng nguồn
export function groupBySource(items) {
  const groups = new Map()
  for (const n of items || []) {
    if (!groups.has(n.source_id)) {
      groups.set(n.source_id, { source_id: n.source_id, title: n.source_title, url: n.source_url,
        platform: n.source_platform, kind: n.source_kind, space_name: n.space_name, items: [] })
    }
    groups.get(n.source_id).items.push(n)
  }
  return [...groups.values()]
}

// "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", quá 30 ngày -> ngày tháng
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'vừa xong'
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} ngày trước`
  return new Date(t).toLocaleDateString('vi-VN')
}
