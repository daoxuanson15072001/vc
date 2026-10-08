// Giao diện sáng / tối (DESIGN V.4.1, SYS-26): "system" theo máy (prefers-color-scheme), "light" / "dark" do người
// dùng chọn trong menu tài khoản. Ghi `data-theme` trên <html> (tokens.css đọc) + localStorage; index.html có đoạn
// script nhỏ đặt data-theme trước khi vẽ để không chớp màu lúc tải trang.
export const THEME_KEY = 'vc-theme'
export const THEMES = [
  { value: 'system', label: 'Theo máy', icon: 'monitor' },
  { value: 'light', label: 'Sáng', icon: 'sun' },
  { value: 'dark', label: 'Tối', icon: 'moon' },
]

export function normalizeTheme(v) {
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function readTheme() {
  try { return normalizeTheme(localStorage.getItem(THEME_KEY)) } catch { return 'system' }
}

export function applyTheme(theme, root = globalThis.document?.documentElement) {
  const t = normalizeTheme(theme)
  if (root) {
    if (t === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', t)
  }
  try {
    if (t === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, t)
  } catch { /* trình duyệt chặn lưu: vẫn đổi được trong phiên này */ }
  return t
}
