// Vỏ ứng dụng (DESIGN V.5 CMP-21, SCR-00): thanh bên theo routes.js (nhóm menu là h2 thật, biểu tượng SVG, huy hiệu số
// việc chờ), menu tài khoản (mẫu Menu Button của APG), thanh dưới + ngăn kéo menu trên điện thoại (≤ 640px, 3.4), Chat nhanh.
//
// Menu lấy từ routes.js (`navMenu`, `navActivePath`): mục cha sáng khi đang ở route con. Huy hiệu lấy từ một API gom
// GET /api/me/inbox/counts khi tải + mỗi 60 giây; API lỗi / chưa có thì không hiện huy hiệu và không báo lỗi ra màn.
// Huy hiệu có chữ cho máy đọc: aria-label của liên kết "Hộp duyệt, 3 việc chờ" (số trên hình aria-hidden).
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { badgeCount, navActivePath, navMenu } from '../routes'
import { THEMES, applyTheme, readTheme } from '../theme'
import { Icon } from './icons'
import { Drawer } from './Overlay'
import { Segmented } from './Segmented'
import QuickChat from './QuickChat'
import ChangePassword from './ChangePassword'

const POLL_MS = 60000
const BADGE_MAX = 99

// Logo chữ VC — cùng hình với public/favicon.svg (SEO-05)
export function Logo({ size = 32 }) {
  return (
    <svg className="shell-logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" fill="#c81e4a" />
      <text x="32" y="42" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"
        fontSize="28" fontWeight="800" fill="#fff" letterSpacing="-1">VC</text>
    </svg>
  )
}

// Số việc chờ: khi tải + mỗi 60 giây. Lỗi / 404 -> null (không huy hiệu)
function useInboxCounts() {
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    let alive = true
    const load = () => api.inboxCounts().then((c) => alive && setCounts(c)).catch(() => alive && setCounts(null))
    load()
    const t = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return counts
}

function Badge({ n }) {
  if (n <= 0) return null
  return <span className="shell-badge" aria-hidden="true" data-testid="nav-badge">{n > BADGE_MAX ? `${BADGE_MAX}+` : n}</span>
}

function NavItem({ item, active, exact, counts, onNavigate }) {
  const n = badgeCount(counts, item.badge)
  return (
    <Link to={item.path} className={`nav-link${active ? ' active' : ''}`} aria-current={exact ? 'page' : active ? 'true' : undefined}
      aria-label={n > 0 ? `${item.label}, ${n} việc chờ` : undefined} onClick={onNavigate}>
      <Icon name={item.icon} size={18} />
      <span className="nav-label">{item.label}</span>
      <Badge n={n} />
    </Link>
  )
}

// Danh sách menu đầy đủ (dùng ở thanh bên và ngăn kéo Thêm của điện thoại)
function MenuList({ menu, activePath, pathname, counts, onNavigate }) {
  const item = (it) => (
    <NavItem key={it.path} item={it} active={it.path === activePath} exact={it.path === pathname} counts={counts} onNavigate={onNavigate} />
  )
  return (
    <>
      {menu.top.map(item)}
      {menu.groups.map((g) => (
        <section key={g.name} className="nav-section">
          <h2 className="nav-group">{g.name}</h2>
          {g.items.map(item)}
        </section>
      ))}
      <div className="nav-fixed-bottom">{menu.bottom.map(item)}</div>
    </>
  )
}

// Menu tài khoản — mẫu Menu Button của APG: nút aria-haspopup="menu" aria-expanded; mở thì tiêu điểm vào mục đầu;
// ↑ ↓ Home End chuyển mục, Esc đóng và trả tiêu điểm về nút, Tab / bấm ra ngoài đóng. Công tắc Giao diện đứng trong
// khung (không phải mục menu: là nhóm radio) nên nằm ngoài phần role="menu".
function UserBox({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()
  const items = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])]

  const close = useCallback((back) => {
    setOpen(false)
    if (back) btnRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return undefined
    items()[0]?.focus()
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const onBtnKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true) }
  }
  const onPanelKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(true); return }
    const list = items()
    const i = list.indexOf(document.activeElement)
    if (i < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const next = { ArrowDown: (i + 1) % list.length, ArrowUp: (i - 1 + list.length) % list.length, Home: 0, End: list.length - 1 }[e.key]
    list[next].focus()
  }
  const onBlur = (e) => {
    if (e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget)) setOpen(false)
  }
  const openPassword = () => {
    close(true)          // tiêu điểm về nút để Modal nhớ đúng chỗ trả về
    setPwOpen(true)
  }

  return (
    <div className="userbox" ref={wrapRef}>
      <button type="button" ref={btnRef} className="user-btn" onClick={() => setOpen((o) => !o)} onKeyDown={onBtnKey}
        aria-expanded={open} aria-haspopup="menu" aria-controls={open ? menuId : undefined}
        aria-label={`Tài khoản: ${user.name}`} data-testid="user-menu">
        <span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="shell-user-text">
          <span className="strong ellipsis">{user.name}</span>
          <span className="muted small ellipsis">{user.role === 'admin' ? 'Quản trị viên' : user.email}</span>
        </span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- khung chỉ bắt phím Esc / mũi tên của menu (APG)
        <div className="user-menu" onKeyDown={onPanelKey} onBlur={onBlur}>
          <div className="theme-row">
            <span className="theme-row-label" aria-hidden="true">Giao diện</span>
            <Segmented label="Giao diện" options={THEMES} value={theme} onChange={(t) => setTheme(applyTheme(t))} testId="theme-switch" size="block" />
          </div>
          <div role="menu" id={menuId} aria-label="Tài khoản" ref={menuRef} className="shell-menu">
            <button type="button" role="menuitem" className="shell-menuitem" onClick={openPassword}>
              <Icon name="lock" size={16} /> Đổi mật khẩu
            </button>
            <button type="button" role="menuitem" className="shell-menuitem" onClick={onLogout} data-testid="logout">
              <Icon name="external" size={16} /> Đăng xuất
            </button>
          </div>
        </div>
      )}
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}

export default function AppShell({ user, onLogout, children }) {
  const { pathname } = useLocation()
  const counts = useInboxCounts()
  const [more, setMore] = useState(false)
  const menu = navMenu(user)
  const activePath = navActivePath(pathname)

  // Chuyển trang thì đóng ngăn kéo Thêm
  useEffect(() => { setMore(false) }, [pathname])

  // Thanh dưới điện thoại: Việc của tôi · Tri thức · Nội dung · Học tập · Thêm. Nhóm dẫn tới trang đầu nhóm.
  const bottom = [
    ...menu.top.map((it) => ({ key: it.path, label: it.label, icon: it.icon, to: it.path, badge: badgeCount(counts, it.badge),
      on: it.path === activePath })),
    ...menu.groups.filter((g) => g.name !== 'Tổ chức').map((g) => ({ key: g.name, label: g.name, icon: g.icon, to: g.items[0].path,
      badge: g.items.reduce((n, it) => n + (it.badge && it.badge !== 'total' ? badgeCount(counts, it.badge) : 0), 0),
      on: g.items.some((it) => it.path === activePath) })),
  ]
  const moreOn = !bottom.some((b) => b.on) && !!activePath

  const list = { menu, activePath, pathname, counts }
  return (
    <>
      <a href="#main" className="skip-link">Bỏ qua tới nội dung</a>
      <div className="layout">
        <aside className="sidebar" aria-label="Thanh bên">
          <Link to="/" className="brand" aria-label="VC Content Engine, trang chủ">
            <Logo />
            <span>
              <span className="brand-name">VC Content Engine</span>
              <span className="brand-sub">Marketing · VCWIKI</span>
            </span>
          </Link>
          <nav aria-label="Menu chính" className="shell-nav">
            <MenuList {...list} />
          </nav>
          <UserBox user={user} onLogout={onLogout} />
          <p className="sidebar-note">Chỉ dùng nghiên cứu nội bộ. Không đăng lại nội dung của kênh khác.</p>
        </aside>
        <main className="main" id="main" tabIndex={-1}>{children}</main>
      </div>

      <nav className="bottombar" aria-label="Menu nhanh" data-testid="bottombar">
        {bottom.map((b) => (
          <Link key={b.key} to={b.to} className={`bottombar-item${b.on ? ' active' : ''}`} aria-current={b.on ? 'true' : undefined}
            aria-label={b.badge > 0 ? `${b.label}, ${b.badge} việc chờ` : undefined}>
            <span className="bottombar-icon"><Icon name={b.icon} size={22} /><Badge n={b.badge} /></span>
            <span>{b.label}</span>
          </Link>
        ))}
        <button type="button" className={`bottombar-item${moreOn ? ' active' : ''}`} aria-haspopup="dialog" aria-expanded={more}
          onClick={() => setMore(true)} data-testid="bottombar-more">
          <span className="bottombar-icon"><Icon name="more" size={22} /></span>
          <span>Thêm</span>
        </button>
      </nav>

      <Drawer open={more} title="Menu" onClose={() => setMore(false)} testId="menu-drawer" className="shell-drawer">
        <nav aria-label="Menu chính" className="shell-nav shell-nav-drawer">
          <MenuList {...list} onNavigate={() => setMore(false)} />
        </nav>
        <UserBox user={user} onLogout={onLogout} />
      </Drawer>

      <QuickChat />
    </>
  )
}
