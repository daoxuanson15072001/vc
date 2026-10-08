import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { dateTime } from '../format'
import { Badge, ErrorBox, Loading } from './ui'
import { toast } from './toast'

// Đăng Facebook cho một nội dung đã duyệt (BA 5.14). source: 'quick' (Viết nhanh) | 'script' (bài MXH chiến dịch).
// Fanpage: đăng thẳng / hẹn giờ qua Graph API. Nhóm, trang cá nhân: Facebook không cho app đăng thay -> chép bài,
// mở Facebook đăng tay, dán link bài đã đăng về để ghi nhận.

const PUB_STATUS = {
  published: { label: 'Đã đăng', tone: 'good' }, scheduled: { label: 'Hẹn giờ', tone: 'info' },
  manual: { label: 'Chờ dán link', tone: 'warn' }, error: { label: 'Lỗi', tone: 'bad' }, cancelled: { label: 'Đã huỷ', tone: 'muted' },
}
const KIND_OF_CHANNEL = { fanpage: 'page', fb_group: 'group', fb_personal: 'profile' }

export function FacebookPublish({ source, piece, channel, onChanged }) {
  const [pubs, setPubs] = useState(piece.publications || [])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => setPubs(piece.publications || []), [piece.publications])
  const approved = piece.review_status === 'approved'

  const act = async (fn, msg) => {
    setError(null)
    try {
      const res = await fn()
      setPubs(res.publications)
      if (msg) toast(msg)
      onChanged?.()
      return res
    } catch (e) {
      setError(e.message)
      return null
    }
  }
  const ref = { source, id: piece.id }

  return (
    <section className="card fb-publish" data-testid="fb-publish" aria-labelledby={`fb-${piece.id}`}>
      <div className="row-between">
        <h3 id={`fb-${piece.id}`}>Đăng Facebook</h3>
        {piece.can_edit && approved && !open && <button className="btn btn-primary btn-sm" data-testid="fb-publish-open" onClick={() => setOpen(true)}>Đăng…</button>}
      </div>
      {!approved && <p className="muted small">Duyệt nội dung rồi mới đăng được.</p>}
      {open && <PublishForm source={source} piece={piece} channel={channel} onClose={() => setOpen(false)} onDone={(list) => { setPubs(list); setOpen(false); onChanged?.() }} />}
      <ErrorBox>{error}</ErrorBox>
      {pubs.length > 0 && (
        <>
          {pubs.some((x) => x.status === 'scheduled') && (
            <button className="btn btn-ghost btn-sm" onClick={() => act(() => api.fbRefresh(source, piece.id))}>Kiểm tra bài hẹn giờ đã lên chưa</button>
          )}
          <ul className="fb-pubs">
            {[...pubs].reverse().map((x) => (
              <Publication key={x.id} x={x} canEdit={piece.can_edit}
                onConfirm={(url) => act(() => api.fbConfirm({ ...ref, publication_id: x.id, url }), 'Đã ghi nhận bài đã đăng')}
                onCancel={() => act(() => api.fbCancel({ ...ref, publication_id: x.id }), x.status === 'scheduled' ? 'Đã huỷ bài hẹn giờ' : 'Đã bỏ')} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Publication({ x, canEdit, onConfirm, onCancel }) {
  const [url, setUrl] = useState('')
  const st = PUB_STATUS[x.status] || { label: x.status, tone: 'muted' }
  return (
    <li className="fb-pub" data-status={x.status} data-testid="fb-publication">
      <div className="meta-line">
        <Badge tone={st.tone}>{st.label}</Badge>
        <span className="small"><b>{x.target_name}</b> · {x.status === 'scheduled' ? `lên lúc ${dateTime(x.scheduled_at)}` : dateTime(x.confirmed_at || x.at)}</span>
        {x.url && x.status !== 'cancelled' && <a className="link small" href={x.url} target="_blank" rel="noreferrer">Xem bài ↗</a>}
      </div>
      {x.error && <p className="small tone-bad">{x.error}</p>}
      {x.warning && <p className="notice small">{x.warning}</p>}
      {canEdit && x.status === 'manual' && (
        <form className="copy-row" onSubmit={(e) => { e.preventDefault(); if (url.trim()) onConfirm(url.trim()) }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Dán link bài đã đăng trên Facebook" aria-label="Link bài đã đăng" />
          <button className="btn btn-sm" disabled={!url.trim()}>Xác nhận đã đăng</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Bỏ</button>
        </form>
      )}
      {canEdit && x.status === 'scheduled' && <button className="btn btn-ghost btn-sm btn-danger-text" onClick={onCancel}>Huỷ hẹn giờ</button>}
    </li>
  )
}

const localInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

function PublishForm({ source, piece, channel, onClose, onDone }) {
  const [targets, setTargets] = useState(null)
  const [f, setF] = useState(null)
  const [targetId, setTargetId] = useState('')
  const [schedule, setSchedule] = useState(false)
  const [when, setWhen] = useState(localInput(new Date(Date.now() + 3600_000)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [manual, setManual] = useState(null)   // kết quả đăng hỗ trợ: {publication, open_url, share_url}
  const [url, setUrl] = useState('')

  useEffect(() => {
    Promise.all([api.fbTargets(), api.fbDraft(source, piece.id)]).then(([ts, d]) => {
      const list = ts.filter((t) => t.can_edit)
      setTargets(list)
      setF({ message: d.message, link: d.link, first_comment: d.first_comment })
      const want = KIND_OF_CHANNEL[channel]
      setTargetId((list.find((t) => t.kind === want) || list[0])?.id || '')
    }, (e) => setError(e.message))
  }, [source, piece.id, channel])

  if (error && !f) return <ErrorBox>{error}</ErrorBox>
  if (!targets || !f) return <Loading />
  if (!targets.length) {
    return (
      <div className="notice small">
        Chưa có kênh Facebook nào. <Link className="link" to="/studio/facebook">Kết nối Fanpage / thêm nhóm, trang cá nhân</Link> trước.
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Đóng</button>
      </div>
    )
  }
  const t = targets.find((x) => x.id === targetId)
  const isPage = t?.kind === 'page'
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const copy = (text) => navigator.clipboard.writeText(text).then(() => toast('Đã chép bài — dán vào Facebook'),
    () => toast('Không tự chép được — bôi đen ô nội dung và chép tay', { tone: 'error' }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (!isPage) {   // chép + mở tab ngay trong lượt bấm (để sau await thì trình duyệt chặn)
      copy(f.message)
      window.open(t.url || 'https://www.facebook.com/', '_blank', 'noopener')
    }
    try {
      const res = await api.fbPublish({
        source, id: piece.id, target_id: targetId, message: f.message, link: f.link,
        first_comment: isPage ? f.first_comment : '', scheduled_at: isPage && schedule ? new Date(when).toISOString() : null,
      })
      if (isPage) {
        toast(res.publication.status === 'scheduled' ? `Đã hẹn giờ đăng lên ${t.name}` : `Đã đăng lên ${t.name}`)
        if (res.publication.warning) toast(res.publication.warning, { tone: 'error' })
        onDone(res.publications)
      } else {
        setManual(res)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (manual) {
    const confirm = async (e) => {
      e.preventDefault()
      setError(null)
      try {
        const res = await api.fbConfirm({ source, id: piece.id, publication_id: manual.publication.id, url: url.trim() })
        toast('Đã ghi nhận bài đã đăng')
        onDone(res.publications)
      } catch (err) {
        setError(err.message)
      }
    }
    return (
      <div className="fb-manual" data-testid="fb-manual-steps">
        <ol className="small">
          <li>Bài đã được chép và Facebook đã mở ở tab mới. <button type="button" className="link" onClick={() => copy(f.message)}>Chép lại</button></li>
          <li>
            <a className="btn btn-sm" href={manual.open_url} target="_blank" rel="noreferrer">Mở {t.kind === 'group' ? 'nhóm' : 'Facebook'} ↗</a>
            {manual.share_url && <> hoặc <a className="link" href={manual.share_url} target="_blank" rel="noreferrer">mở hộp chia sẻ kèm link</a></>}
            {' '}— dán bài, thêm ảnh nếu có, bấm Đăng.
          </li>
          <li>Mở bài vừa đăng, chép link bài và dán vào đây:</li>
        </ol>
        <form className="copy-row" onSubmit={confirm}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.facebook.com/…" aria-label="Link bài đã đăng" />
          <button className="btn btn-primary btn-sm" disabled={!url.trim()}>Xác nhận đã đăng</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDone(manual.publications)}>Để sau</button>
        </form>
        <ErrorBox>{error}</ErrorBox>
      </div>
    )
  }

  return (
    <form className="form fb-form" onSubmit={submit} data-testid="fb-publish-form">
      <label className="field"><span>Đăng lên</span>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)} data-testid="fb-target">
          {targets.map((x) => <option key={x.id} value={x.id}>{x.kind_label}: {x.name}{x.status === 'error' ? ' (lỗi token)' : ''}</option>)}
        </select>
      </label>
      {t && !isPage && <p className="muted small">Facebook không cho ứng dụng đăng thay vào {t.kind === 'group' ? 'nhóm' : 'trang cá nhân'}: hệ thống chép bài, mở Facebook để bạn dán và đăng, rồi dán link bài về đây.</p>}
      {t?.status === 'error' && <p className="small tone-bad">{t.error} — <Link className="link" to="/studio/facebook">kết nối lại</Link></p>}
      <label className="field"><span>Nội dung <em>({f.message.length} ký tự)</em></span>
        <textarea rows={10} value={f.message} onChange={set('message')} required maxLength={63206} data-testid="fb-message" />
      </label>
      <label className="field"><span>Link đính kèm (hiện thẻ xem trước)</span>
        <input value={f.link} onChange={set('link')} placeholder="https://…" />
      </label>
      {isPage && (
        <>
          <label className="field"><span>Bình luận đầu <em>(đăng ngay sau bài; không áp dụng khi hẹn giờ)</em></span>
            <textarea rows={2} value={f.first_comment} onChange={set('first_comment')} disabled={schedule} />
          </label>
          <div className="checks">
            <label><input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} /> Hẹn giờ đăng (10 phút – 30 ngày; Facebook tự đăng, không cần mở máy)</label>
          </div>
          {schedule && <label className="field"><span>Giờ đăng</span><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required /></label>}
        </>
      )}
      <ErrorBox>{error}</ErrorBox>
      <div className="actions">
        <button className="btn btn-primary" disabled={busy || !targetId} data-testid="fb-publish-submit">
          {busy ? 'Đang gửi…' : isPage ? (schedule ? 'Hẹn giờ đăng' : 'Đăng ngay') : 'Chép bài & mở Facebook'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button>
      </div>
    </form>
  )
}
