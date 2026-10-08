// SYS-36 / SCR-21.1: hiển thị và lọc "đăng nhập gần nhất" — hàm thuần, có test (lastLogin.test.js).
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const STALE_DAYS = 30

// Thời gian tương đối bằng chữ; null / rỗng = chưa từng đăng nhập
export function relativeLogin(iso, now = Date.now()) {
  if (!iso) return 'Chưa đăng nhập'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'Chưa đăng nhập'
  const d = Math.max(0, now - t)
  if (d < MIN) return 'Vừa xong'
  if (d < HOUR) return `${Math.floor(d / MIN)} phút trước`
  if (d < DAY) return `${Math.floor(d / HOUR)} giờ trước`
  if (d < 30 * DAY) return `${Math.floor(d / DAY)} ngày trước`
  if (d < 365 * DAY) return `${Math.floor(d / (30 * DAY))} tháng trước`
  return `${Math.floor(d / (365 * DAY))} năm trước`
}

// "Không đăng nhập ≥ 30 ngày": gồm cả người chưa từng đăng nhập
export function isStale(iso, now = Date.now(), days = STALE_DAYS) {
  if (!iso) return true
  const t = new Date(iso).getTime()
  return Number.isNaN(t) || now - t >= days * DAY
}

// Sắp xếp theo đăng nhập gần nhất; "Chưa đăng nhập" luôn xuống cuối (dù tăng hay giảm)
export function sortByLogin(rows, dir = 'desc') {
  const val = (u) => (u.last_login_at ? new Date(u.last_login_at).getTime() : null)
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = val(a)
    const y = val(b)
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    return (x - y) * sign
  })
}

// Ngày giờ đầy đủ (có năm) cho `title` của ô thời gian tương đối
export const fullLogin = (iso) => new Date(iso).toLocaleString('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
