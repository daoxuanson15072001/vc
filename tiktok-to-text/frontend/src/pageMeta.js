// Meta trang (DESIGN V.5 CMP-15, SEO-04, AIX-23): tiêu đề tab, meta description, canonical, link Markdown thay thế.
// Nhiều nơi cùng góp meta theo lớp: vỏ app đặt lớp route (tên màn + mô tả từ routes.js), trang đặt lớp đối tượng
// (`object` = tên thẻ / dự án đang mở). Lớp gắn sau đè trường nó có; gỡ lớp (rời trang, đóng popup) thì trả lại.
import { useEffect, useRef } from 'react'
import { APP_NAME } from './routes.js'

// Tiêu đề tab: "<đối tượng> · <màn> · VC Content Engine" (DESIGN V.2 nguyên tắc 3)
export function composeTitle({ title, object, raw } = {}) {
  if (raw) return `${raw} · ${APP_NAME}`
  const parts = [object, title].filter(Boolean)
  return parts.length ? `${parts.join(' · ')} · ${APP_NAME}` : APP_NAME
}

// canonical = đường dẫn + chỉ các tham số mở đối tượng (card, source…) — bỏ bộ lọc, trang số, tab
export function canonicalUrl(origin, pathname, search = '', keepKeys = []) {
  const src = new URLSearchParams(search)
  const out = new URLSearchParams()
  for (const k of keepKeys) if (src.get(k)) out.set(k, src.get(k))
  const q = out.toString()
  return `${origin}${pathname}${q ? `?${q}` : ''}`
}

export function mergeLayers(layers) {
  const m = {}
  for (const l of layers) for (const [k, v] of Object.entries(l.meta)) if (v !== undefined && v !== null && v !== '') m[k] = v
  return m
}

const layers = []
let seq = 0

function upsertHead(selector, create) {
  let el = document.head.querySelector(selector)
  if (!el) { el = create(); document.head.appendChild(el) }
  return el
}

function render() {
  if (typeof document === 'undefined') return
  const m = mergeLayers(layers)
  document.title = composeTitle(m)
  if (m.description) {
    upsertHead('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }))
      .setAttribute('content', m.description)
  }
  const canon = document.head.querySelector('link[rel="canonical"]')
  if (m.canonical) {
    upsertHead('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' })).setAttribute('href', m.canonical)
  } else canon?.remove()
  // Bản Markdown của đối tượng đang mở (AIX-22/23) — khác link /guide.md chung trong index.html
  const alt = document.head.querySelector('link[data-page-alternate]')
  if (m.alternateMd) {
    const el = alt || Object.assign(document.createElement('link'), { rel: 'alternate', type: 'text/markdown' })
    el.setAttribute('data-page-alternate', '')
    el.setAttribute('href', m.alternateMd)
    if (!alt) document.head.appendChild(el)
  } else alt?.remove()
}

// usePageMeta({ title, object, description, canonical, alternateMd }) — gọi ở trang; trường rỗng không đè lớp dưới
export function usePageMeta(meta) {
  const idRef = useRef(null)
  if (idRef.current === null) idRef.current = ++seq
  const key = JSON.stringify(meta || {})
  useEffect(() => {
    const id = idRef.current
    const layer = { id, meta: JSON.parse(key) }
    const i = layers.findIndex((l) => l.id === id)
    if (i >= 0) layers[i] = layer
    else layers.push(layer)
    render()
    return () => {
      const j = layers.findIndex((l) => l.id === id)
      if (j >= 0) layers.splice(j, 1)
      render()
    }
  }, [key])
}

// Lớp cũ: usePageTitle('Tên') đặt nguyên tiêu đề "<Tên> · VC Content Engine" — giữ cho các trang chưa chuyển sang
// usePageMeta (UI-2…4)
export function usePageTitle(title) {
  usePageMeta(title ? { raw: title } : {})
}
