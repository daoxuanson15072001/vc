import { Component, forwardRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SOURCE_STATUS, VIDEO_STATUS } from '../format'

export function Badge({ tone = 'muted', title, children }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>
}

export function SourceStatus({ status }) {
  const s = SOURCE_STATUS[status] || { label: status, tone: 'muted' }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function VideoStatus({ status }) {
  const s = VIDEO_STATUS[status] || { label: status, tone: 'muted' }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function Progress({ progress, status }) {
  const { total = 0, processed = 0 } = progress || {}
  const pct = total ? Math.round((processed / total) * 100) : 0
  return (
    <div className="progress" title={`${processed}/${total}`} role="progressbar" aria-valuemin={0} aria-valuemax={total || 100}
      aria-valuenow={total ? processed : 0} aria-valuetext={`${processed}/${total}`}>
      <div className={`progress-bar ${status === 'running' ? 'progress-live' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stat({ label, value, hint }) {
  return (
    <dl className="stat">
      <dt className="stat-label">{label}</dt>
      <dd className="stat-value">{value}</dd>
      {hint && <dd className="stat-hint">{hint}</dd>}
    </dl>
  )
}

export function Empty({ children, testId }) {
  return <div className="empty" role="note" data-testid={testId}>{children}</div>
}

// Đang tải: có chữ + aria-busy để AI agent / trình đọc màn hình phân biệt "chưa tải xong" với "không có dữ liệu".
// Dùng: {loading && <Loading />} hoặc <Loading>Đang tải thẻ…</Loading>
export function Loading({ children = 'Đang tải…', testId = 'loading' }) {
  return <div className="loading" role="status" aria-busy="true" aria-live="polite" data-testid={testId}>{children}</div>
}

// Chữ chỉ cho máy đọc (caption bảng, nhãn ẩn): <caption><SrOnly>Danh sách nguồn</SrOnly></caption>
export function SrOnly({ as: Tag = 'span', children }) {
  return <Tag className="sr-only">{children}</Tag>
}

// Hộp lỗi đỏ. `onRetry`: hiện nút "Thử lại" (lỗi máy chủ 5xx / mất kết nối thường qua ngay sau khi BE khởi động
// lại xong). Chữ lỗi do api.js dựng: 4xx là câu BE viết; 5xx ghi mã + endpoint + gợi ý.
export function ErrorBox({ children, onRetry, testId = 'error-box' }) {
  if (!children) return null
  return (
    <div className="error-box" role="alert" aria-live="assertive" data-testid={testId}>
      <span>{children}</span>
      {onRetry && <button type="button" className="btn btn-ghost error-retry" onClick={onRetry} data-testid={`${testId}-retry`}>Thử lại</button>}
    </div>
  )
}

// Ô nhập nhiều dòng an toàn với bộ gõ tiếng Việt (Telex / VNI, IME): trong lúc đang ghép dấu (compositionstart →
// compositionend) không đẩy giá trị lên state cha — React render lại giữa chừng là lý do dấu bị tách ("HỎ I").
// Không chặn phím nào: Ctrl/⌘+A, Delete, Backspace hoạt động như textarea thường.
export const TextArea = forwardRef(function TextArea({ value, onChange, ...rest }, ref) {
  const [draft, setDraft] = useState(null)   // null = không ghép dấu, dùng value cha
  return (
    <textarea
      ref={ref}
      {...rest}
      value={draft ?? value ?? ''}
      onCompositionStart={(e) => setDraft(e.target.value)}
      onCompositionEnd={(e) => { setDraft(null); onChange?.(e) }}
      onChange={(e) => (draft === null ? onChange?.(e) : setDraft(e.target.value))}
    />
  )
})

// Dãy số trang gọn: 1 … 4 5 [6] 7 8 … 20 (null = dấu …)
export function pageWindow(page, pages, around = 2) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const set = new Set([1, pages])
  for (let i = page - around; i <= page + around; i++) if (i >= 1 && i <= pages) set.add(i)
  const sorted = [...set].sort((a, b) => a - b)
  const out = []
  sorted.forEach((n, i) => { if (i && n - sorted[i - 1] > 1) out.push(null); out.push(n) })
  return out
}

// Phân trang: Trước / số trang / Sau; `total` là tổng mục; có `onPageSize` thì hiện chọn số mục mỗi trang
export function Pagination({ page, pageSize, total, onPage, onPageSize, pageSizes = [12, 24, 48, 96], unit = 'mục' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1 && !onPageSize) return null
  return (
    <nav className="pagination" aria-label="Phân trang">
      <span className="small muted pagination-total">{total} {unit}</span>
      {pages > 1 && (
        <div className="pagination-pages" role="group">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">‹ Trước</button>
          {pageWindow(page, pages).map((n, i) => (n === null
            ? <span key={`gap-${i}`} className="pagination-gap">…</span>
            : <button key={n} className={`btn btn-ghost pagination-num${n === page ? ' active' : ''}`} aria-current={n === page ? 'page' : undefined}
                onClick={() => n !== page && onPage(n)}>{n}</button>))}
          <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Trang sau">Sau ›</button>
        </div>
      )}
      {onPageSize && (
        <label className="small pagination-size">Mỗi trang{' '}
          <select aria-label="Số mục mỗi trang" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </nav>
  )
}

// Lỗi giao diện của một trang (vd BE chưa khởi động lại sau khi cập nhật, trả dữ liệu dạng cũ): hiện thông báo
// thay vì trắng cả ứng dụng. Chuyển trang khác thì tự thử lại.
class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="error-box">
        <b>Trang gặp lỗi khi hiển thị.</b> Nếu vừa cập nhật phần mềm, hãy khởi động lại máy chủ (<code>bash start_web.sh</code>)
        rồi tải lại trang. <button className="link" onClick={() => window.location.reload()}>Tải lại</button>
        <div className="small muted">{String(this.state.error?.message || this.state.error)}</div>
      </div>
    )
  }
}

export function PageBoundary({ children }) {
  const { pathname } = useLocation()
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
}
