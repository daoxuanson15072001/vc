// Popup giữa màn hình (thẻ VCWIKI, chi tiết nguồn): nút ⤢ phóng toàn màn hình, nhớ theo trình duyệt (mỗi loại popup
// một khoá); Esc để đóng — trừ khi đang có khung nổi phía trên (xem file, hộp thoại nhỏ, popup nguồn trên thẻ)
// tự bắt Esc; khoá cuộn trang phía sau trong lúc mở.
import { useEffect, useId, useState } from 'react'

const stored = (key) => { try { return localStorage.getItem(key) === '1' } catch { return false } }
const store = (key, v) => { try { localStorage.setItem(key, v ? '1' : '0') } catch { /* trình duyệt chặn lưu */ } }

export function useModalFull(key) {
  const [full, setFull] = useState(() => stored(key))
  const toggle = () => { store(key, !full); setFull(!full) }
  return [full, toggle]
}

export function FullToggle({ full, onToggle }) {
  const label = full ? 'Thu nhỏ' : 'Toàn màn hình'
  return (
    <button className="icon-btn modal-full-btn" onClick={onToggle} aria-pressed={full} aria-label={label} title={label}>
      {full ? '⤡' : '⤢'}
    </button>
  )
}

// above: selector các khung nằm trên popup này — đang mở thì Esc thuộc về chúng
export function useModalEsc(onClose, above) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector(above)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose, above])
}

// Vỏ popup dùng chung có tên cho máy đọc: overlay + khung role=dialog aria-modal aria-labelledby (tiêu đề h2 trong khung).
// `title` là chữ tiêu đề (hiện trong h2); `sub` là dòng nhỏ phía trên tiêu đề; `headExtra` là nút thêm ở đầu khung
// (ví dụ FullToggle); `above` là selector các khung nằm trên popup này để Esc thuộc về chúng (xem useModalEsc).
// Nút đóng có tên "Đóng: <title>" để agent bấm đúng popup khi có nhiều lớp.
export function Modal({ title, sub, headExtra, onClose, above = '.overlay-top, .overlay-dialog', className = '', full, testId, children }) {
  const id = useId()
  useModalEsc(onClose, above)
  useEffect(() => {
    // đưa tiêu điểm vào khung khi mở, trả về phần tử mở khi đóng
    const opener = document.activeElement
    const el = document.getElementById(id)
    el?.focus?.()
    return () => opener?.focus?.()
  }, [id])
  const plain = typeof title === 'string' ? title : ''
  return (
    <>
      <div className="overlay card-modal-overlay" aria-hidden="true" onClick={onClose} />
      <aside id={id} tabIndex={-1} className={`drawer card-modal ${full ? 'full' : ''} ${className}`} role="dialog" aria-modal="true"
        aria-labelledby={`${id}-title`} data-testid={testId}>
        <div className="drawer-head">
          <div className="grow">
            {sub && <div className="muted small">{sub}</div>}
            <h2 id={`${id}-title`} className="clamp-2">{title}</h2>
          </div>
          {headExtra}
          <button type="button" className="icon-btn" onClick={onClose} aria-label={plain ? `Đóng: ${plain}` : 'Đóng'} title="Đóng">✕</button>
        </div>
        {children}
      </aside>
    </>
  )
}
