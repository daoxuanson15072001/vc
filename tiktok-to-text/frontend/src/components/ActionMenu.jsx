// Menu "Thêm ▾" và hàng hành động (DESIGN V.5 CMP-07, AIX-04) — mẫu Menu Button của WAI-ARIA APG:
//   nút aria-haspopup="menu" aria-expanded aria-controls; Enter / Space / ↓ mở và vào mục đầu, ↑ mở và vào mục cuối;
//   trong menu: ↑ ↓ xoay vòng, Home / End, gõ chữ cái nhảy tới mục bắt đầu bằng chữ đó, Enter / Space chọn,
//   Esc đóng và trả tiêu điểm về nút, Tab đóng menu (tiêu điểm đi tiếp như thường); bấm ra ngoài thì đóng.
// Mục nguy hiểm (danger) luôn nằm cuối, sau một đường ngăn, chữ đỏ, và luôn hỏi lại bằng confirmDialog.
//
// Dùng:
//   <ActionMenu name="Bảng giá Toyota.pdf" items={[
//     { label: 'Mở chi tiết', icon: 'eye', onSelect: open },
//     { label: 'Xoá nguồn…', icon: 'trash', danger: true, confirm: { title: 'Xoá nguồn này?', okLabel: 'Xoá nguồn' }, onSelect: del },
//   ]} />
//   <RowActions name={row.title} actions={[{ label: 'Tinh chế', onSelect: … }, …]} />   // ≤ 2 nút hiện + Thêm ▾
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { confirmDialog } from './dialog'
import { Icon } from './icons'

// Mục nguy hiểm xuống cuối (giữ thứ tự trong từng nhóm)
export function orderItems(items) {
  const list = (items || []).filter(Boolean)
  return [...list.filter((i) => !i.danger), ...list.filter((i) => i.danger)]
}

// Chỉ số mục kế tiếp bắt đầu bằng chữ `ch` (không phân biệt hoa thường / dấu), tính vòng từ sau `from`
export function typeaheadIndex(labels, from, ch) {
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
  const c = norm(ch)
  for (let k = 1; k <= labels.length; k++) {
    const i = (from + k) % labels.length
    if (norm(labels[i]).startsWith(c)) return i
  }
  return -1
}

export function ActionMenu({
  items, name, label = 'Thêm', ariaLabel, icon = 'chevron-down', iconOnly = false, size = 'sm', align = 'end', testId,
  buttonClassName = '',
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const focusOnOpen = useRef('first')
  const list = orderItems(items)
  const enabled = list.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0)
  const fullLabel = ariaLabel || (name ? `${label} hành động cho ${name}` : label)

  const menuItems = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') || [])]

  useEffect(() => {
    if (!open) return undefined
    const els = menuItems()
    ;(focusOnOpen.current === 'last' ? els[els.length - 1] : els[0])?.focus()
    // Menu tràn đáy màn hình thì mở lên trên
    const r = menuRef.current?.getBoundingClientRect()
    if (r && r.bottom > window.innerHeight - 8 && r.top - r.height > 8) setUp(true)
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('mousedown', onDown); setUp(false) }
  }, [open])

  const openMenu = (where) => { focusOnOpen.current = where; setOpen(true) }
  const close = (refocus = true) => { setOpen(false); if (refocus) btnRef.current?.focus() }

  const onButtonKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); openMenu('first') }
    else if (e.key === 'ArrowUp') { e.preventDefault(); openMenu('last') }
  }

  const onMenuKey = (e) => {
    const els = menuItems()
    const i = els.indexOf(document.activeElement)
    const move = (j) => { e.preventDefault(); els[(j + els.length) % els.length]?.focus() }
    if (e.key === 'ArrowDown') move(i + 1)
    else if (e.key === 'ArrowUp') move(i - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(els.length - 1)
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close(false)
    else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const j = typeaheadIndex(els.map((el) => el.textContent), Math.max(i, 0), e.key)
      if (j >= 0) move(j)
    }
  }

  const choose = async (it) => {
    close()
    if (it.confirm || it.danger) {
      const c = typeof it.confirm === 'object' ? it.confirm : {}
      const ok = await confirmDialog({ title: c.title || `${it.label.replace(/…$/, '')}?`, body: c.body, okLabel: c.okLabel || it.label.replace(/…$/, ''),
        danger: it.danger ?? c.danger })
      if (!ok) return
    }
    it.onSelect?.()
  }

  if (!enabled.length) return null
  const firstDanger = list.findIndex((it) => it.danger)
  return (
    <div className={`ui-menu-wrap ui-align-${align}`}>
      <button
        ref={btnRef}
        type="button"
        id={`${id}-b`}
        className={`ui-btn ui-btn-${size}${iconOnly ? ' ui-btn-icon ui-btn-ghost' : ''} ${buttonClassName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-m` : undefined}
        aria-label={fullLabel}
        title={iconOnly ? label : undefined}
        onClick={() => (open ? close() : openMenu('first'))}
        onKeyDown={onButtonKey}
        data-testid={testId}
      >
        {iconOnly ? <Icon name="more" size={16} /> : <>{label}<Icon name={icon} size={16} /></>}
      </button>
      {open && (
        <div ref={menuRef} id={`${id}-m`} role="menu" tabIndex={-1} aria-labelledby={`${id}-b`} className={`ui-menu${up ? ' ui-menu-up' : ''}`}
          onKeyDown={onMenuKey} data-testid={testId ? `${testId}-menu` : undefined}>
          {list.map((it, i) => {
            const cls = `ui-menu-item${it.danger ? ' ui-danger' : ''}`
            const content = <>{it.icon && <Icon name={it.icon} size={16} />}<span>{it.label}</span></>
            return [
              i === firstDanger && i > 0 && <div key={`sep-${i}`} role="separator" className="ui-menu-sep" />,
              it.href || it.to ? (
                it.to
                  ? <Link key={i} role="menuitem" tabIndex={-1} className={cls} to={it.to} onClick={() => close(false)} data-testid={it.testId}>{content}</Link>
                  : <a key={i} role="menuitem" tabIndex={-1} className={cls} href={it.href} onClick={() => close(false)} data-testid={it.testId}>{content}</a>
              ) : (
                <button key={i} type="button" role="menuitem" tabIndex={-1} className={cls} aria-disabled={it.disabled || undefined}
                  onClick={() => !it.disabled && choose(it)} data-testid={it.testId}>{content}</button>
              ),
            ]
          })}
        </div>
      )}
    </div>
  )
}

// Hàng hành động của một dòng / thẻ: tối đa `visible` hành động thường hiện thành nút, phần còn lại (và mọi hành động
// nguy hiểm) vào menu Thêm ▾. aria-label mỗi nút kèm tên đối tượng (AIX-04: "Tinh chế: Bảng giá Toyota.pdf").
export function RowActions({ actions, name, visible = 2, testId }) {
  const list = (actions || []).filter(Boolean)
  const shown = list.filter((a) => !a.danger).slice(0, visible)
  const rest = list.filter((a) => !shown.includes(a))
  return (
    <div className="ui-row-actions">
      {shown.map((a, i) => (
        <button key={i} type="button" className={`ui-btn ui-btn-sm${a.primary ? ' ui-btn-primary' : ' ui-btn-ghost'}`}
          onClick={a.onSelect} disabled={a.disabled} aria-label={name ? `${a.label}: ${name}` : undefined} data-testid={a.testId}>
          {a.icon && <Icon name={a.icon} size={16} />}{a.label}
        </button>
      ))}
      {rest.length > 0 && <ActionMenu items={rest} name={name} testId={testId ? `${testId}-more` : undefined} />}
    </div>
  )
}
