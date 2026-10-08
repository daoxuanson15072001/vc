import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, notifyUnauthorized } from '../api'
import { bytes } from '../format'

// Xem file thô ngay trong app (không phải tải về): PDF / ảnh / chữ / audio / video trình duyệt tự hiển thị,
// file office nhờ BE chuyển sang PDF (văn bản, trình chiếu) hoặc trang HTML (bảng tính) qua /preview.
const EXT = {
  pdf: /\.pdf$/i,
  image: /\.(png|jpe?g|gif|webp|svg)$/i,
  text: /\.(txt|md|json|srt|vtt|log|xml|html?)$/i,
  audio: /\.(mp3|m4a|wav|ogg|oga|opus|aac|flac)$/i,
  video: /\.(mp4|mov|m4v|webm)$/i,
  office: /\.(docx?|odt|rtf|pptx?|odp|xlsx?|xlsm|ods|csv)$/i,
}
export const previewKind = (path) => Object.keys(EXT).find((k) => EXT[k].test(path || '')) || null
// Loại xem được mà chưa có trình phát media trong drawer lo — dùng cho nút "Xem file gốc"
export const canPreviewDoc = (path) => ['pdf', 'office', 'image', 'text'].includes(previewKind(path))

const TEXT_LIMIT = 1.5 * 1048576    // chỉ hiển thị 1,5 MB đầu
const TEXT_MAX = 50 * 1048576       // lớn hơn thì không tải về trình duyệt
const OFFICE_ERR = {
  415: 'Chưa hỗ trợ xem trước loại file này.',
  503: 'Máy chủ chưa cài LibreOffice nên chưa chuyển đổi được file này để xem.',
  504: 'Chuyển đổi quá lâu nên đã dừng — file có thể quá lớn.',
}

async function fetchOk(url, signal) {
  const res = await fetch(url, { signal })
  if (res.status === 401) notifyUnauthorized()
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const detail = typeof data?.detail === 'string' ? data.detail : null
    const err = new Error(OFFICE_ERR[res.status] || detail || `Lỗi ${res.status}`)
    err.detail = OFFICE_ERR[res.status] && detail ? detail : null
    throw err
  }
  return res
}

// Tải nội dung cần xử lý trước khi hiển thị (chữ, office); pdf / ảnh / media thì trình duyệt tự tải qua src
function useLoaded(sourceId, path, kind) {
  const [state, setState] = useState({ loading: kind === 'text' || kind === 'office' })
  useEffect(() => {
    if (kind !== 'text' && kind !== 'office') return undefined
    const ctl = new AbortController()
    let alive = true
    setState({ loading: true })
    const run = async () => {
      if (kind === 'text') {
        const res = await fetchOk(api.rawUrl(sourceId, path, true), ctl.signal)
        const size = Number(res.headers.get('content-length')) || null
        if (size > TEXT_MAX) {
          ctl.abort()
          return { tooBig: size }
        }
        const blob = await res.blob()
        const truncated = blob.size > TEXT_LIMIT
        let text = await blob.slice(0, TEXT_LIMIT).text()
        if (!truncated && /\.json$/i.test(path)) {
          try { text = JSON.stringify(JSON.parse(text), null, 2) } catch { /* JSON hỏng: giữ nguyên chữ */ }
        }
        return { text, truncated, size: blob.size }
      }
      // Lượt GET này chờ BE chuyển đổi xong (và báo lỗi kèm lý do nếu hỏng). Bản PDF thì bỏ phần thân rồi cho
      // iframe nạp thẳng URL preview (BE trả từ bộ đệm, không chuyển lại) — để trình xem PDF của trình duyệt
      // lấy tên file thật từ Content-Disposition khi tải về / in, thay vì tên UUID của blob: URL.
      const url = api.previewUrl(sourceId, path)
      const res = await fetchOk(url, ctl.signal)
      const type = res.headers.get('content-type') || ''
      if (type.includes('text/html')) return { html: await res.text() }
      res.body?.cancel().catch(() => {})
      return { url }
    }
    run().then((r) => alive && setState(r), (e) => alive && e.name !== 'AbortError' && setState({ error: e.message, detail: e.detail }))
    return () => {
      alive = false
      ctl.abort()
    }
  }, [sourceId, path, kind])
  return state
}

export default function FilePreview({ sourceId, path, onClose }) {
  const kind = previewKind(path)
  const inlineUrl = api.rawUrl(sourceId, path, true)
  const downloadUrl = api.rawUrl(sourceId, path)
  const st = useLoaded(sourceId, path, kind)
  const name = path.split('/').pop()

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const download = <a className="btn" href={downloadUrl} download={name}>Tải về</a>
  const fallback = (msg, detail) => (
    <div className="fp-msg">
      <p>{msg}</p>
      {detail && <p className="muted small">{detail}</p>}
      {download}
    </div>
  )

  let body
  if (st.loading) body = <div className="fp-msg muted">{kind === 'office' ? 'Đang chuyển đổi để xem… (lần đầu có thể mất vài giây)' : 'Đang tải…'}</div>
  else if (st.error) body = fallback(`Không xem trước được: ${st.error}`, st.detail)
  else if (kind === 'pdf') body = <iframe className="fp-frame" src={inlineUrl} title={name} />
  else if (kind === 'image') body = <div className="fp-image"><img src={inlineUrl} alt={name} /></div>
  else if (kind === 'audio') body = <div className="fp-msg"><audio className="fp-audio" controls autoPlay src={inlineUrl} /></div>
  else if (kind === 'video') body = <video className="fp-video" controls autoPlay src={inlineUrl} />
  else if (kind === 'text') {
    body = st.tooBig ? fallback(`File chữ quá lớn (${bytes(st.tooBig)}) để xem trong app — hãy tải về.`) : (
      <>
        {st.truncated && <div className="notice fp-notice">File dài {bytes(st.size)} — chỉ hiển thị {bytes(TEXT_LIMIT)} đầu. Tải về để xem đủ.</div>}
        <pre className="fp-text">{st.text}</pre>
      </>
    )
  } else if (kind === 'office') {
    body = st.html != null
      // bảng tính: trang HTML do BE dựng — cô lập (sandbox, không cùng origin) để nội dung file không chạm vào app
      ? <iframe className="fp-frame" sandbox="allow-scripts" srcDoc={st.html} title={name} />
      : <iframe className="fp-frame" src={st.url} title={name} />
  } else body = fallback('Chưa xem trước được loại file này.')

  // "Mở tab mới": office mở bản đã chuyển (PDF / HTML), còn lại mở file gốc dạng inline
  const tabUrl = kind === 'office' ? api.previewUrl(sourceId, path) : inlineUrl
  return createPortal(
    <>
      <div className="overlay fp-overlay" onClick={onClose} aria-hidden="true" />
      <div className="file-preview" role="dialog" aria-modal="true" aria-label={`Xem ${name}`} data-testid="file-preview" data-kind={kind || 'unknown'}>
        <div className="fp-head">
          <div className="grow fp-title" title={path}>{name}</div>
          <div className="fp-actions">
            {kind && !st.error && <a className="btn" href={tabUrl} target="_blank" rel="noreferrer" aria-label={`Mở ${name} trong tab mới`}>Mở tab mới ↗</a>}
            {download}
            <button className="icon-btn" onClick={onClose} aria-label={`Đóng: ${name}`} title="Đóng">✕</button>
          </div>
        </div>
        <div className="fp-body">{body}</div>
      </div>
    </>,
    document.body,
  )
}
