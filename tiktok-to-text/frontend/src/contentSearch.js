// Tìm theo nội dung ở Kho tư liệu (WK-35): hàm thuần cho components/ContentSearch.jsx và drawer nguồn.
// Không phụ thuộc React — chạy được bằng `node --test` (contentSearch.test.js).

// Giây -> "mm:ss" / "h:mm:ss" (cùng định dạng mốc trong chữ video, backend kb/media.fmt_ts)
export function markTime(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0))
  const h = Math.floor(n / 3600)
  const m = Math.floor((n % 3600) / 60)
  const s = n % 60
  const pad = (x) => String(x).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export const MATCH_LABEL = {
  dense: { label: 'Theo nghĩa', tone: 'info', title: 'Đoạn gần nghĩa với câu tìm, dù khác chữ' },
  sparse: { label: 'Từ khoá', tone: 'muted', title: 'Đoạn chứa từ khoá của câu tìm' },
  both: { label: 'Nghĩa + từ khoá', tone: 'good', title: 'Khớp cả theo nghĩa lẫn từ khoá' },
}

// Bỏ dấu tiếng Việt + chữ thường, giữ nguyên độ dài từng ký tự (để ánh xạ vị trí về văn bản gốc)
function fold(ch) {
  const f = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace('đ', 'd')
  return f.length === 1 ? f : ch.toLowerCase().slice(0, 1) || ch
}

const WORD = /[\p{L}\p{N}]/u
const STOP = new Set(['va', 'la', 'cua', 'co', 'cho', 'thi', 'the', 'nao', 'gi', 'khi', 'de', 'o', 'voi', 'mot', 'nhung', 'cac', 'duoc', 'trong'])

// Từ khoá của câu tìm (đã bỏ dấu), bỏ từ quá ngắn / hư từ; dài trước để ưu tiên khớp cụm dài
export function queryTerms(q) {
  const words = String(q || '').split(/[^\p{L}\p{N}]+/u).map((w) => [...w].map(fold).join('')).filter(Boolean)
  return [...new Set(words.filter((w) => w.length >= 2 && !STOP.has(w)))].sort((a, b) => b.length - a.length)
}

// Văn bản -> [{text, hit}] đánh dấu chỗ khớp từ khoá (không phân biệt hoa thường / dấu, khớp đầu từ).
// Trả mảng để render bằng <mark> — không bao giờ ghép HTML từ dữ liệu thô.
export function highlightParts(text, q) {
  const src = String(text || '')
  const terms = queryTerms(q)
  if (!src || !terms.length) return src ? [{ text: src, hit: false }] : []
  const chars = [...src]
  const folded = chars.map(fold)
  const hay = folded.join('')
  const marks = new Array(chars.length).fill(false)
  for (const t of terms) {
    let i = hay.indexOf(t)
    while (i !== -1) {
      const before = i === 0 ? '' : folded[i - 1]
      if (!before || !WORD.test(before)) for (let k = i; k < i + t.length; k++) marks[k] = true
      i = hay.indexOf(t, i + 1)
    }
  }
  const parts = []
  chars.forEach((c, i) => {
    const last = parts[parts.length - 1]
    if (last && last.hit === marks[i]) last.text += c
    else parts.push({ text: c, hit: marks[i] })
  })
  return parts
}

// Giây bắt đầu từ query ?t= (số nguyên ≥ 0), không hợp lệ -> null
export function startParam(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

// Trạng thái tìm trong URL: ?mode=content&q=... (chia sẻ link / quay lại được)
export function readSearch(params) {
  const content = params.get('mode') === 'content'
  return { content, q: content ? (params.get('q') || '').trim() : '' }
}

export function withSearch(params, { content, q }) {
  const next = new URLSearchParams(params)
  if (content) {
    next.set('mode', 'content')
    q ? next.set('q', q) : next.delete('q')
  } else {
    next.delete('mode')
    next.delete('q')
  }
  return next
}

// Mở drawer nguồn: ?source=<id>&doc=<docId>&t=<giây>; đóng (source null) thì bỏ cả doc / t
export function withOpen(params, source, doc = null, t = null) {
  const next = new URLSearchParams(params)
  for (const k of ['source', 'doc', 't']) next.delete(k)
  if (source) {
    next.set('source', source)
    if (doc) next.set('doc', doc)
    if (doc && t != null) next.set('t', String(Math.max(0, Math.floor(t))))
  }
  return next
}
