// Mảnh dùng chung của Kho tư liệu (SCR-03) và Tiến độ tinh chế (SCR-04): tiến độ trích xuất, dự kiến thời gian,
// số lần lỗi / lịch sử lỗi của video, biểu tượng loại nguồn. Chỉ dùng trong pages/kb/*, Refine.jsx, RefineLive.jsx.
import { useState } from 'react'
import { dateTime, SOURCE_KIND, totalTime } from '../../format'
import { Icon } from '../../components/icons'
import { StatusBadge } from '../../components/StatusBadge'

export const ACTIVE = ['uploading', 'queued', 'extracting', 'building']
// Sự kiện trên window: vừa nạp nguồn mới (ngăn kéo Nạp nguồn) -> danh sách tab Nguồn tải lại
export const KB_CHANGED = 'kb:sources-changed'

// Loại nguồn → biểu tượng SVG (TOK-ICON, thay emoji ở SOURCE_KIND); nhãn chữ luôn đi kèm ở chỗ gọi
const KIND_ICON = { video: 'play', web: 'link', pdf: 'file', google: 'file', office: 'file', image: 'eye', audio: 'headphones', video_file: 'play' }
export const kindLabel = (k) => SOURCE_KIND[k]?.label || k || 'Không rõ'
export function KindIcon({ kind }) {
  return <Icon name={KIND_ICON[kind] || 'file'} size={16} className="kb-kind-icon" />
}

export const sourceName = (s) => s?.title || s?.file?.name || s?.url || 'Nguồn không tên'

// Dự kiến thời gian: server trả số giây tính từ lúc hỏi, cộng vào giờ máy để khỏi lệch múi giờ
export const leftText = (sec) => (sec < 60 ? 'dưới 1 phút' : totalTime(sec))
export const atClock = (sec) => new Date(Date.now() + sec * 1000).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
const BASIS_HINT = { live: 'theo tốc độ thực tế của chính việc này', history: 'theo tốc độ các lần xử lý trước', default: 'ước lượng mặc định, chưa có lịch sử' }

export function EtaText({ e }) {
  if (!e) return null
  const hint = `Dự kiến ${BASIS_HINT[e.basis] || ''}`
  if (e.running) {
    return e.overdue
      ? <span className="tone-warn" title={hint}>Lâu hơn dự kiến — sắp xong</span>
      : <span title={hint}>Còn ~{leftText(e.finish_in)} · xong lúc {atClock(e.finish_in)}</span>
  }
  return (
    <span title={hint}>
      Thứ {e.position} trong hàng chờ · bắt đầu sau ~{leftText(e.start_in)} · xong lúc {atClock(e.finish_in)}
    </span>
  )
}

export function QueueInfo({ s }) {
  if (!s.eta && !(s.priority > 0 && ACTIVE.includes(s.overall))) return null
  return (
    <div className="small muted">
      {s.priority > 0 && <span className="tone-warn">Ưu tiên</span>}
      {s.priority > 0 && s.eta ? ' · ' : ''}
      <EtaText e={s.eta} />
    </div>
  )
}

export function SourceProgress({ s }) {
  const p = s.progress
  if (s.status !== 'extracting' || !p || p.total < 2) return null
  return (
    <div className="small muted">
      <div className="progress" role="progressbar" aria-label="Tiến độ trích xuất" aria-valuemin={0} aria-valuemax={p.total}
        aria-valuenow={p.processed} aria-valuetext={`${p.processed}/${p.total}`}>
        <div className="progress-bar progress-live" style={{ width: `${Math.round((p.processed / p.total) * 100)}%` }} />
      </div>
      {p.processed}/{p.total}{p.failed ? ` · ${p.failed} lỗi` : ''}{p.skipped ? ` · ${p.skipped} đã có` : ''}
    </div>
  )
}

export function SourceStatusBadge({ s }) {
  return <StatusBadge kind="source" status={s} />
}

// Video lấy chữ lỗi: số lần lỗi (từ MAX_AUTO_RETRY lần, hoặc lỗi vĩnh viễn như video hội viên / đã gỡ, máy thôi tự thử)
export function FailTimes({ v, max }) {
  const n = v.fail_count || 0
  if (v.permanent) {
    return (
      <span className="ui-badge" data-tone="bad" title="Lỗi này thử lại cũng không được nên máy không tự thử — vẫn lấy lại thủ công được">
        {n ? `Lỗi ${n} lần — ` : ''}không tự thử lại
      </span>
    )
  }
  if (!n) return null
  return (
    <span className="ui-badge" data-tone={n >= max ? 'bad' : 'warn'}
      title={n >= max ? 'Máy đã dừng tự lấy lại — vẫn lấy lại thủ công được' : 'Máy còn tự thử lại khi bấm Chạy tiếp tất cả nguồn đang lọc'}>
      Lỗi {n}/{max}{n >= max ? ' — đã dừng tự thử' : ''}
    </span>
  )
}

const VIA = { scan: 'quét kênh', redo: 'lấy lại thủ công', auto: 'tự lấy lại' }

export function FailLog({ log }) {
  const [open, setOpen] = useState(false)
  if (!log?.length) return null
  return (
    <>
      <button type="button" className="link small" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Ẩn lịch sử lỗi' : `Lịch sử lỗi (${log.length})`}
      </button>
      {open && (
        <ol className="fail-log small">
          {log.map((e, i) => (
            <li key={i}><span className="muted nowrap">{dateTime(e.at)} · {VIA[e.via] || e.via} · {e.label}</span><div className="clamp-2">{e.error}</div></li>
          ))}
        </ol>
      )}
    </>
  )
}
