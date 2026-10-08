// Thông báo nhanh (toast) dùng chung cho mọi trang — thay các `setTimeout(setMsg(null), 2500)` tự viết ở từng trang.
//
// Vì sao: toast 2,5 giây quá nhanh với AI agent và người đọc chậm; vùng không có aria-live nên trình đọc màn hình
// không đọc. Ở đây: hiện 8 giây (đổi được), dừng đếm khi trỏ chuột / tiêu điểm vào, có nút đóng, vùng role=status
// aria-live=polite, và giữ 5 thông báo gần nhất trong nút "Thông báo" để đọc lại được sau khi toast đã ẩn.
//
// Dùng:
//   import { toast } from '../components/toast'
//   toast('Đã lưu')                              // tone mặc định 'ok'
//   toast('Không gửi được', { tone: 'error' })   // lỗi: 12 giây, aria-live=assertive
//   toast('Đang xử lý…', { tone: 'info', duration: 0 })   // 0 = không tự ẩn
//   toast('Đã duyệt thẻ X', { action: { label: 'Hoàn tác', onClick: undo } })   // nút hành động (TPL-A2, UI-2)
//     — bấm nút thì chạy onClick rồi đóng; hết giờ / bấm ✕ thì gọi onExpire (nếu có) — dùng cho kiểu "làm trễ để hoàn tác"
// Máy đọc: vùng data-testid="toasts"; mỗi thông báo data-testid="toast" data-tone=…; lịch sử data-testid="toast-history".
import { useEffect, useRef, useState } from 'react'

export const TOAST_DURATION = 8000
const HISTORY = 5
let push = null
let pending = []
let seq = 0

export function toast(text, { tone = 'ok', duration, action, onExpire } = {}) {
  if (!text) return
  const item = {
    id: ++seq, text: String(text), tone, action, onExpire,
    duration: duration ?? (tone === 'error' ? TOAST_DURATION * 1.5 : TOAST_DURATION),
    at: new Date(),
  }
  if (push) push(item)
  else pending.push(item)
  return item.id
}

// Hết giờ / bấm ✕ / bị toast mới đẩy ra mà chưa bấm nút hành động: báo người gọi (ví dụ gửi thật việc đã hoãn
// để hoàn tác). Gọi ngoài lượt vẽ để không chạy hai lần.
function expire(it) {
  if (it.done) return
  it.done = true
  if (it.onExpire) setTimeout(it.onExpire, 0)
}

// Gắn một lần ở App.jsx
export function ToastHost() {
  const [items, setItems] = useState([])
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    push = (item) => {
      setItems((xs) => { xs.slice(0, -2).forEach(expire); return [...xs.slice(-2), item] })   // tối đa 3 cùng lúc
      setHistory((h) => [item, ...h].slice(0, HISTORY))
    }
    if (pending.length) { pending.forEach(push); pending = [] }
    return () => { push = null }
  }, [])

  const close = (id) => setItems((xs) => { xs.filter((x) => x.id === id).forEach(expire); return xs.filter((x) => x.id !== id) })
  const hasError = items.some((x) => x.tone === 'error')

  return (
    <div className="toasts" data-testid="toasts">
      <div role="status" aria-live={hasError ? 'assertive' : 'polite'} aria-atomic="false" className="toast-stack">
        {items.map((it) => <ToastItem key={it.id} item={it} onClose={() => close(it.id)} />)}
      </div>
      {history.length > 0 && (
        <div className="toast-history-wrap">
          <button type="button" className="btn btn-ghost btn-sm toast-history-btn" onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory} aria-controls="toast-history" title="Thông báo gần đây">
            🔔 Thông báo ({history.length})
          </button>
          {showHistory && (
            <ul id="toast-history" className="toast-history" data-testid="toast-history" aria-label="Thông báo gần đây">
              {history.map((h) => (
                <li key={h.id} data-tone={h.tone}>
                  <span className="muted small">{h.at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span> {h.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function ToastItem({ item, onClose }) {
  const [paused, setPaused] = useState(false)
  const left = useRef(item.duration)
  const started = useRef(0)
  const timer = useRef(null)

  useEffect(() => {
    if (!item.duration || paused) return undefined
    started.current = Date.now()
    timer.current = setTimeout(onClose, left.current)
    return () => {
      clearTimeout(timer.current)
      left.current = Math.max(0, left.current - (Date.now() - started.current))
    }
  }, [paused, item.duration, onClose])

  return (
    <div className={`toast-item toast-${item.tone}`} data-testid="toast" data-tone={item.tone}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <span className="toast-text">{item.text}</span>
      {item.action && (
        <button type="button" className="toast-action" data-testid="toast-action"
          onClick={() => { item.done = true; item.action.onClick?.(); onClose() }}>{item.action.label}</button>
      )}
      <button type="button" className="toast-close" onClick={onClose} aria-label="Đóng thông báo">✕</button>
    </div>
  )
}
