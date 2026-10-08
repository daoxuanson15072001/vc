// Modal / Drawer dùng chung (DESIGN V.5 CMP-08, AIX-05) — mẫu Dialog (Modal) của WAI-ARIA APG:
//   role="dialog" aria-modal aria-labelledby (tiêu đề h2 trong khung); mở thì tiêu điểm vào khung (Drawer) hoặc ô
//   đầu tiên (Modal); Tab / Shift+Tab xoay vòng trong khung (bẫy tiêu điểm); Esc đóng lớp trên cùng; đóng thì trả tiêu
//   điểm về nút đã mở (mở bằng URL thì về vùng nội dung chính); khoá cuộn trang phía sau.
// Hai dáng: Modal (giữa màn, ≤ 640px, tạo / sửa nhỏ) và Drawer (ngăn kéo phải, đối tượng mở từ danh sách, có nút
// Toàn màn hình). Mở / đóng theo URL: useUrlOverlay('card') → ?card=<id> (dán link là mở đúng popup).
//
// Dùng:
//   const card = useUrlOverlay('card')
//   <Drawer open={!!card.value} title={c?.title} onClose={card.close} footer={<button …>Duyệt thẻ</button>}>…</Drawer>
//   <Modal open={creating} title="Tạo lĩnh vực" onClose={() => setCreating(false)} footer={…}>…</Modal>
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { Icon } from './icons'
import { useModalFull } from './modalFull'

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])',
  'textarea:not([disabled])', 'iframe', 'audio[controls]', 'video[controls]', '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function focusables(root) {
  if (!root) return []
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden], [inert]') && el.getClientRects().length > 0)
}

// Các lớp đang mở, lớp cuối là lớp trên cùng — chỉ lớp trên cùng kéo tiêu điểm về
const stack = []
let scrollLocks = 0

function lockScroll() {
  if (scrollLocks++ === 0) {
    document.body.dataset.prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

function unlockScroll() {
  if (--scrollLocks === 0) {
    document.body.style.overflow = document.body.dataset.prevOverflow || ''
    delete document.body.dataset.prevOverflow
  }
}

// Tiêu điểm được phép nằm ngoài khung: hộp thoại xác nhận (confirmDialog), popup kiểu cũ mở chồng lên (xem file…),
// vùng thông báo
function focusAllowedOutside(el) {
  return !!el?.closest?.('[role="alertdialog"], [aria-modal="true"]:not(.ui-ov-panel), .dialog-box, .toasts, [data-overlay-free]')
}

function Overlay({
  variant, open = true, title, sub, onClose, footer, headExtra, size, fullKey, closeLabel, initialFocus,
  testId, className = '', children,
}) {
  const id = useId()
  const panelRef = useRef(null)
  const openerRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [full, toggleFull] = useModalFull(fullKey || `ui-overlay-full:${variant}`)
  const plain = typeof title === 'string' ? title : ''
  const [depth, setDepth] = useState(0)   // lớp thứ mấy đang mở — lớp mở sau nằm trên (z-index)

  useEffect(() => {
    if (!open) return undefined
    openerRef.current = document.activeElement
    stack.push(id)
    setDepth(stack.length - 1)
    lockScroll()
    const panel = panelRef.current
    // Tiêu điểm đầu: initialFocus (selector) → Modal: ô / nút đầu tiên trong thân khung → khung (đọc tiêu đề trước)
    const first = (initialFocus && panel?.querySelector(initialFocus))
      || (variant === 'modal' && focusables(panel?.querySelector('.ui-ov-body'))[0])
      || panel
    first?.focus({ preventScroll: true })

    const onFocusIn = (e) => {
      if (stack[stack.length - 1] !== id || !panel || panel.contains(e.target) || focusAllowedOutside(e.target)) return
      ;(focusables(panel)[0] || panel).focus({ preventScroll: true })
    }
    // Esc khi tiêu điểm rơi ra ngoài mọi khung (nút vừa bị khoá, phần tử vừa bị gỡ → body): lớp trên cùng vẫn đóng
    const onDocKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || stack[stack.length - 1] !== id) return
      const a = document.activeElement
      if (a && a !== document.body && a !== document.documentElement) return
      e.preventDefault()
      onCloseRef.current?.()
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onDocKey)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onDocKey)
      const i = stack.lastIndexOf(id)
      if (i >= 0) stack.splice(i, 1)
      unlockScroll()
      const opener = openerRef.current
      // Trả tiêu điểm cho nút đã mở; mở bằng URL (không có nút) thì về vùng nội dung chính
      if (opener && opener !== document.body && document.contains(opener)) opener.focus({ preventScroll: true })
      else document.getElementById('main')?.focus({ preventScroll: true })
    }
  }, [open, id, variant, initialFocus])

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      // Esc thuộc về lớp trên cùng; lớp dưới (cha trong cây React) không nhận
      e.stopPropagation()
      if (!e.defaultPrevented) { e.preventDefault(); onCloseRef.current?.() }
      return
    }
    if (e.key !== 'Tab') return
    e.stopPropagation()
    const panel = panelRef.current
    const list = focusables(panel)
    if (!list.length) { e.preventDefault(); panel.focus(); return }
    const firstEl = list[0]
    const lastEl = list[list.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === firstEl || active === panel || !panel.contains(active))) { e.preventDefault(); lastEl.focus() }
    else if (!e.shiftKey && (active === lastEl || !panel.contains(active))) { e.preventDefault(); firstEl.focus() }
  }, [])

  if (!open) return null
  const fullBtnLabel = full ? 'Thu nhỏ' : 'Toàn màn hình'
  return createPortal(
    <div className={`ui-ov ui-ov-${variant}${full ? ' is-full' : ''}`} data-overlay={variant}
      style={depth ? { zIndex: `calc(var(--z-overlay) + ${depth * 2})` } : undefined}>
      <div className="ui-ov-scrim" aria-hidden="true" onClick={() => onCloseRef.current?.()} />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc / bẫy Tab của hộp thoại (APG Dialog) */}
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        tabIndex={-1}
        className={`ui-ov-panel${size ? ` ui-ov-${size}` : ''} ${className}`}
        onKeyDown={onKeyDown}
        data-testid={testId}
      >
        <div className="ui-ov-head">
          <div className="ui-ov-titles">
            {sub && <div className="ui-ov-sub">{sub}</div>}
            <h2 id={`${id}-t`} className="ui-ov-title">{title}</h2>
          </div>
          {headExtra}
          {variant === 'drawer' && (
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm" onClick={toggleFull} aria-pressed={full}
              aria-label={plain ? `${fullBtnLabel}: ${plain}` : fullBtnLabel} title={fullBtnLabel}>
              <Icon name={full ? 'minimize' : 'maximize'} size={16} />
            </button>
          )}
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm" onClick={() => onCloseRef.current?.()}
            aria-label={closeLabel || (plain ? `Đóng: ${plain}` : 'Đóng')} title="Đóng" data-testid={testId ? `${testId}-close` : undefined}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="ui-ov-body">{children}</div>
        {footer && <div className="ui-ov-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Modal(props) {
  return <Overlay variant="modal" {...props} />
}

export function Drawer(props) {
  return <Overlay variant="drawer" {...props} />
}

// Popup theo tham số URL (AIX-05, SYS-28): value = giá trị ?<key>=; open(v) / close() ghi lịch sử (push) để nút
// Quay lại của trình duyệt đóng / mở lại đúng popup
export function useUrlOverlay(key) {
  const [params, setParams] = useSearchParams()
  const value = params.get(key)
  const open = useCallback((v) => setParams((p) => {
    const n = new URLSearchParams(p)
    n.set(key, String(v))
    return n
  }), [key, setParams])
  const close = useCallback(() => setParams((p) => {
    const n = new URLSearchParams(p)
    n.delete(key)
    return n
  }), [key, setParams])
  return { value, open, close }
}
