// Ngữ cảnh gửi kèm mỗi câu hỏi ở Chat nhanh (AIX-12, SCR-00): đường dẫn + tham số, tiêu đề tab, `h1` hiện tại,
// bộ lọc đang bật, đối tượng đang mở (tham số mở popup theo routes.js `objectKeys` hoặc `:id` trên đường dẫn).
// BE tách `ngữ cảnh.split(' (')[0]` để tra hướng dẫn theo đường dẫn — nên phần đầu luôn là "<đường dẫn>?<query>".
import { matchRoute } from './routes.js'

const MAX = 500   // BE giới hạn 500 ký tự (chat.py)

export function buildChatContext({ pathname, search = '', title = '', h1 = '' }) {
  const route = matchRoute(pathname)
  const params = new URLSearchParams(search)
  const objectKeys = route?.objectKeys || []
  const opened = []
  const filters = []
  for (const [k, v] of params) {
    if (!v) continue
    ;(objectKeys.includes(k) ? opened : filters).push(`${k}=${v}`)
  }
  const idParam = route?.path.split('/').includes(':id') ? pathname.replace(/\/$/, '').split('/').pop() : null
  if (idParam) opened.unshift(`id=${idParam}`)

  const parts = [`${pathname}${search}${title ? ` (${title})` : ''}`]
  if (h1) parts.push(`h1: ${h1}`)
  if (filters.length) parts.push(`bộ lọc: ${filters.join(', ')}`)
  if (opened.length) parts.push(`đang mở: ${opened.join(', ')}`)
  return parts.join(' · ').slice(0, MAX)
}
