// Tính thuần cho hàng chờ TPL-A2 (DESIGN V.6, SCR-09) — tách khỏi React để có test đơn vị (queue.test.js).

// Mục mở tiếp sau khi `doneId` rời danh sách: mục đứng sau nó; nó là mục cuối thì mục đứng trước; không thấy nó
// trong danh sách (mở bằng link) thì mục đầu; danh sách hết thì null.
export function nextAfter(list, doneId) {
  const ids = (list || []).map((x) => (typeof x === 'object' ? x.id : x))
  const i = ids.indexOf(doneId)
  const rest = ids.filter((id) => id !== doneId)
  if (!rest.length) return null
  if (i < 0) return rest[0]
  return rest[i] ?? rest[i - 1] ?? null
}

// Mục trước / sau của `id` trong danh sách đang hiện (nút "Đề xuất trước / sau"); vị trí đếm từ 1 (0 = không có)
export function neighbours(list, id) {
  const ids = (list || []).map((x) => x.id)
  const i = ids.indexOf(id)
  return { prev: i > 0 ? ids[i - 1] : null, next: i >= 0 && i < ids.length - 1 ? ids[i + 1] : null, pos: i + 1, total: ids.length }
}

// Tên hiện của một đề xuất (thẻ bị xoá vẫn có chữ)
export const changeTitle = (ch) => ch?.card?.title || '(thẻ đã xoá)'

// Chữ bước duyệt: đề xuất đã đóng → nhãn trạng thái; đang mở → "Chờ 1 người duyệt" / "Bước n/2"
export function stepText(ch, statusLabel) {
  if (ch.status !== 'open') return statusLabel
  return ch.min_approvers === 1 ? 'Chờ 1 người duyệt' : `Bước ${ch.step}/2`
}
