// Trạng thái URL của trang VCWIKI (SCR-06): bộ lọc, trang, chế độ xem, thẻ đang mở.
// Tham số giữ nguyên như trước UI-2: space_id, category, type, status, tag, q, source_id, level, division,
// process_step, page, view, card (id thẻ hoặc "new"); thêm ctab (tab trong popup thẻ).
import { api } from '../../api'
import { CLASS_FILTER_KEYS } from '../../components/CardClassFields'

export const KEYS = ['space_id', 'category', 'type', 'status', 'tag', 'q', 'source_id', ...CLASS_FILTER_KEYS]
export const EXTRA_KEYS = ['tag', ...CLASS_FILTER_KEYS]   // nằm trong "Lọc thêm"

// Chế độ xem Lộ trình / Lưới: ?view= trên URL > lựa chọn đã nhớ (chỉ khi lọc lĩnh vực) > mặc định
// (lọc lĩnh vực -> Lộ trình, không lọc -> Lưới)
const VIEW_KEY = 'wiki.view'
export const VIEWS = ['timeline', 'grid']
export const storedView = () => { try { return localStorage.getItem(VIEW_KEY) } catch { return null } }
export const storeView = (v) => { try { localStorage.setItem(VIEW_KEY, v) } catch { /* trình duyệt chặn lưu */ } }

export const PAGE_SIZE = 30
export const TIMELINE_PAGE = 100    // page_size tối đa của /wiki/cards
export const TIMELINE_MAX = 1000    // chặn trên: lộ trình và "Lưu kết quả lọc thành danh sách phát" không kéo cả kho

// Tải lần lượt từng trang 100 thẻ (API chưa có lệnh lấy trọn kết quả lọc) tới tối đa TIMELINE_MAX thẻ
export async function fetchAllCards(filters) {
  const items = []
  let total = 0
  for (let page = 1; ; page++) {
    const res = await api.cards({ ...filters, page, page_size: TIMELINE_PAGE })
    items.push(...res.items)
    total = res.total
    if (res.items.length < TIMELINE_PAGE || items.length >= total || items.length >= TIMELINE_MAX) break
  }
  return { items, total }
}
