// Chi tiết video (SCR-03, tab Video của Kho tư liệu): ngăn kéo mở bằng ?v=<id>, tab nội dung trên URL ?vtab=
// (transcript · translation · segments · caption), nút «Mở trên <nền tảng> ↗» theo link thật của video.
import { useEffect, useId, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { clock, date, dateTime, duration, num } from '../format'
import { Badge, ErrorBox, Loading, SrOnly, VideoStatus } from '../components/ui'
import { confirmDialog } from '../components/dialog'
import { toast } from '../components/toast'

// Tên nền tảng theo link thật (V.8: không ghi cứng "TikTok")
export function platformOf(url = '') {
  if (/youtu\.?be/i.test(url)) return 'YouTube'
  if (/tiktok\.com/i.test(url)) return 'TikTok'
  if (/facebook\.com|fb\.watch/i.test(url)) return 'Facebook'
  if (/instagram\.com/i.test(url)) return 'Instagram'
  return 'trang gốc'
}

export default function VideoDetail({ id, onClose, onChanged, onFilterTag }) {
  const navigate = useNavigate()
  const { data: v, error, setData } = useFetch(() => api.video(id), [id])
  const [params, setParams] = useSearchParams()
  const tab = ['translation', 'segments', 'caption'].includes(params.get('vtab')) ? params.get('vtab') : 'transcript'
  const setTab = (t) => {
    const p = new URLSearchParams(params)
    if (t === 'transcript') p.delete('vtab')
    else p.set('vtab', t)
    setParams(p, { replace: true })
  }
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [actionError, setActionError] = useState(null)
  const headId = useId()

  useEffect(() => {
    setNote(v?.note || '')
    setEditing(false)
  }, [v?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !editing && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, onClose])

  const flash = (text) => toast(text)

  const save = async (body, okText = 'Đã lưu') => {
    setActionError(null)
    try {
      setData(await api.patchVideo(id, body))
      onChanged()
      flash(okText)
      return true
    } catch (e) {
      setActionError(e.message)
      return false
    }
  }

  const addTag = (e) => {
    e.preventDefault()
    const t = tagInput.trim()
    if (!t) return
    save({ tags: [...(v.tags || []), t] }, 'Đã thêm tag')
    setTagInput('')
  }

  const copy = async () => {
    await navigator.clipboard.writeText(v.transcript || '')
    flash('Đã sao chép lời nói')
  }

  const retranscribe = async () => {
    if (!(await confirmDialog({ title: 'Chuyển chữ lại video này?', body: 'Lời nói đã sửa tay sẽ bị ghi đè.', okLabel: 'Chuyển chữ lại', danger: true }))) return
    try {
      const r = await api.retranscribe(id)
      navigate(`/kb?source=${r.source_id}`)
    } catch (e) {
      setActionError(e.message)
    }
  }

  const remove = async () => {
    if (!(await confirmDialog({ title: 'Xoá video này khỏi kho?', okLabel: 'Xoá video', danger: true }))) return
    try {
      await api.deleteVideo(id)
      onChanged()
      onClose()
    } catch (e) {
      setActionError(e.message)
    }
  }

  const cps = v?.chars_per_sec
  const cpsTone = cps == null ? 'muted' : cps < 12 ? 'warn' : 'good'

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={`${headId}-kind ${headId}-title`}
        data-testid="video-detail" data-id={id} data-status={v?.status}>
        <div className="drawer-head">
          <div className="grow">
            <SrOnly><span id={`${headId}-kind`}>Chi tiết video:</span></SrOnly>
            <div className="muted small">@{v?.channel_handle} · {v?.channel_name}</div>
            <h2 className="clamp-2" id={`${headId}-title`}>{v?.caption || id}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng: chi tiết video" title="Đóng">✕</button>
        </div>
        <ErrorBox>{error}</ErrorBox>
        {!v && !error && <Loading />}
        {v && (
          <div className="drawer-body">
            <div className="kpis">
              <div><b>{num(v.views)}</b><span>lượt xem</span></div>
              <div><b>{num(v.likes)}</b><span>thích</span></div>
              <div><b>{num(v.comments)}</b><span>bình luận</span></div>
              <div><b>{num(v.shares)}</b><span>chia sẻ</span></div>
            </div>
            <div className="meta-line">
              <VideoStatus status={v.status} />
              <span>Đăng {date(v.posted_at)}</span>
              <span>{duration(v.duration)}</span>
              {cps != null && (
                <span title="Bình thường ~22–26 ký tự/giây; thấp bất thường là dấu hiệu nhận dạng kém">
                  <Badge tone={cpsTone}>{cps} ký tự/giây</Badge>
                </span>
              )}
              {v.edited && <Badge tone="info">Đã sửa tay</Badge>}
              <a href={v.url} target="_blank" rel="noreferrer" className="link">Mở trên {platformOf(v.url)} ↗</a>
            </div>
            {v.status === 'error' && <ErrorBox>{v.error}</ErrorBox>}

            <div className="tabs" role="tablist" aria-label="Nội dung video">
              {[
                ['transcript', v.translation ? 'Lời nói (nguyên bản)' : 'Lời nói'],
                v.translation && ['translation', 'Bản dịch tiếng Việt'],
                ['segments', `Phụ đề (${v.segments?.length || 0})`],
                ['caption', 'Caption'],
              ].filter(Boolean).map(([k, l]) => (
                <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}
                  role="tab" aria-selected={tab === k} aria-controls={`${headId}-panel`} id={`${headId}-tab-${k}`}>{l}</button>
              ))}
            </div>

            {tab === 'transcript' && (
              <div className="tab-body" role="tabpanel" id={`${headId}-panel`} aria-labelledby={`${headId}-tab-transcript`}>
                {editing ? (
                  <>
                    <textarea className="transcript-edit" aria-label="Sửa lời nói" value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} />
                    <div className="actions">
                      <button className="btn btn-primary" onClick={async () => (await save({ transcript: draft })) && setEditing(false)}>
                        Lưu lời nói
                      </button>
                      <button className="btn btn-ghost" onClick={() => setEditing(false)}>Huỷ</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="transcript">{v.transcript || <span className="muted">(Không có lời nói)</span>}</p>
                    <div className="actions">
                      <button className="btn" onClick={copy} disabled={!v.transcript}>Sao chép</button>
                      <button className="btn btn-ghost" onClick={() => { setDraft(v.transcript || ''); setEditing(true) }}>
                        Sửa
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {tab === 'segments' && (
              <div className="tab-body segments" role="tabpanel" id={`${headId}-panel`} aria-labelledby={`${headId}-tab-segments`}>
                {(v.segments || []).map((s, i) => (
                  <div key={i} className="segment">
                    <span className="seg-time">{clock(s.start)}</span>
                    <span>{s.text}</span>
                  </div>
                ))}
                {!v.segments?.length && <p className="muted">Không có phụ đề.</p>}
              </div>
            )}
            {tab === 'translation' && v.translation && (
              <div className="tab-body segments" role="tabpanel" id={`${headId}-panel`} aria-labelledby={`${headId}-tab-translation`}>
                {v.translation.caption && <p className="transcript"><b>Caption:</b> {v.translation.caption}</p>}
                {(v.translation.segments || []).map((s, i) => (
                  <div key={i} className="segment">
                    <span className="seg-time">{clock(s.start)}</span>
                    <span>{s.text}</span>
                  </div>
                ))}
                <p className="muted">Dịch máy từ {v.language} ({v.translation.engine}) — bản gốc ở tab Lời nói.</p>
              </div>
            )}
            {tab === 'caption' && (
              <div className="tab-body" role="tabpanel" id={`${headId}-panel`} aria-labelledby={`${headId}-tab-caption`}>
                <p className="transcript">{v.caption || <span className="muted">(Không có caption)</span>}</p>
              </div>
            )}

            <h3>Tag</h3>
            <div className="tags">
              {(v.tags || []).map((t) => (
                <span key={t} className="tag tag-edit">
                  <button className="tag-link" onClick={() => onFilterTag(t)} title="Lọc theo tag này">#{t}</button>
                  <button className="tag-x" aria-label={`Bỏ tag ${t}`} onClick={() => save({ tags: v.tags.filter((x) => x !== t) }, 'Đã bỏ tag')}>
                    ×
                  </button>
                </span>
              ))}
              <form onSubmit={addTag}>
                <input className="tag-input" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="+ thêm tag, Enter" aria-label="Thêm tag" />
              </form>
            </div>

            <h3>Ghi chú</h3>
            <textarea
              rows={3}
              aria-label="Ghi chú"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vd: hook 3 giây đầu hay, dùng làm mẫu kịch bản…"
            />
            {note !== (v.note || '') && (
              <div className="actions">
                <button className="btn btn-primary" onClick={() => save({ note })}>Lưu ghi chú</button>
              </div>
            )}

            <div className="drawer-foot">
              <a className="btn" href={api.srtUrl(id)} download>Tải SRT</a>
              <button className="btn" onClick={retranscribe} data-testid="video-retranscribe">Chuyển chữ lại</button>
              <button className="btn btn-ghost btn-danger-text" onClick={remove} data-testid="video-delete">Xoá khỏi kho</button>
            </div>
            <ErrorBox>{actionError}</ErrorBox>
            <p className="muted small">
              Engine: {v.engine || '—'}{v.model ? ` / ${v.model}` : ''} · chuyển chữ {dateTime(v.transcribed_at)}
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
