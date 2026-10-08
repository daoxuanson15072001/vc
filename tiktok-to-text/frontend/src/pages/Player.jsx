// Trình phát danh sách thẻ VCWIKI, kiểu playlist YouTube: bên trái đọc thẻ đang phát, bên phải hàng đợi.
// Hết thẻ tự chuyển thẻ kế; có trộn bài, lặp lại, đổi thứ tự (chủ danh sách). Tải trước giọng đọc thẻ kế để chuyển bài không phải chờ.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { CARD_TYPE, dateTime } from '../format'
import { Badge, Empty, ErrorBox, Loading } from '../components/ui'
import { confirmDialog } from '../components/dialog'
import { toast } from '../components/toast'
import { audioUrl, browserSpeak, FALLBACK_MSG, NO_VOICE_MSG, usePref, VoiceSelects } from '../components/listen'
import { CardContent } from '../components/playlist'

const REPEAT = { off: { icon: '↻', label: 'Không lặp' }, all: { icon: '🔁', label: 'Lặp cả danh sách' }, one: { icon: '🔂', label: 'Lặp thẻ này' } }
const NEXT_REPEAT = { off: 'all', all: 'one', one: 'off' }

function shuffled(ids, first) {
  const rest = ids.filter((i) => i !== first)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return first ? [first, ...rest] : rest
}

export default function Player() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: pl, error, setData: setPl } = useFetch(() => api.playlist(id), [id])
  const items = pl?.items || []
  const ids = useMemo(() => items.map((c) => c.id), [items])
  const curId = ids.includes(params.get('card')) ? params.get('card') : ids[0]
  const { data: card, error: cardError } = useFetch(() => (curId ? api.card(curId) : Promise.resolve(null)), [curId])

  const [pref, setPref] = usePref()
  const [status, setStatus] = useState('idle')   // idle | loading | playing | paused | browser
  const [want, setWant] = useState(false)        // người dùng đang muốn phát (tự phát thẻ kế)
  const [shuffle, setShuffle] = useState(null)   // thứ tự trộn, null = theo danh sách
  const [repeat, setRepeat] = useState('off')
  const [autoNext, setAutoNext] = useState(true)
  const [msg, setMsg] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [editing, setEditing] = useState(false)
  const audio = useRef(null)
  const prefetched = useRef(new Set())

  const order = shuffle ? shuffle.filter((i) => ids.includes(i)) : ids
  const pos = order.indexOf(curId)
  const nextId = pos >= 0 && pos < order.length - 1 ? order[pos + 1] : repeat === 'all' ? order[0] : null
  const prevId = pos > 0 ? order[pos - 1] : repeat === 'all' ? order[order.length - 1] : null

  const go = (cid, play = want) => {
    setWant(play)
    if (cid === curId) {   // đúng thẻ đang chọn: phát lại từ đầu, không cần đổi URL
      if (play) start()
      return
    }
    halt()                 // dừng giọng thẻ cũ ngay, không chờ thẻ mới tải xong
    setStatus(play ? 'loading' : 'idle')
    const next = new URLSearchParams(params)
    next.set('card', cid)
    setParams(next, { replace: true })
  }

  const halt = () => {
    const el = audio.current
    if (el) { el.pause(); el.removeAttribute('src'); el.load() }
    window.speechSynthesis?.cancel()
  }

  const finished = () => {
    if (repeat === 'one') { start(); return }
    if (autoNext && nextId) go(nextId, true)
    else { setWant(false); setStatus('idle') }
  }

  const start = () => {
    if (!card) return
    halt()
    setMsg(null)
    setStatus('loading')
    const el = audio.current
    el.src = audioUrl(card, pref)
    el.play().catch(() => {})   // lỗi thật báo qua onError
  }

  // thẻ mới đã tải xong -> phát nếu đang ở chế độ phát
  useEffect(() => {
    if (card && card.id === curId && want) start()
    else { halt(); setStatus('idle') }
  }, [card?.id, pref.voice, pref.rate]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => halt, [])

  // tải trước giọng đọc thẻ kế: máy chủ tạo xong và lưu đệm, tới lượt phát là có ngay
  useEffect(() => {
    if (status !== 'playing' || !nextId) return
    const next = items.find((c) => c.id === nextId)
    const url = next && audioUrl(next, pref)
    if (!url || prefetched.current.has(url)) return
    prefetched.current.add(url)
    fetch(url).then((r) => r.arrayBuffer()).catch(() => prefetched.current.delete(url))
  }, [status, nextId, pref.voice, pref.rate]) // eslint-disable-line react-hooks/exhaustive-deps

  const onError = () => {
    if (status === 'idle' || !audio.current?.getAttribute('src')) return
    if (card && browserSpeak(card, pref.rate, () => finished())) {
      setStatus('browser')
      setMsg(FALLBACK_MSG)
    } else {
      setStatus('idle')
      setWant(false)
      setMsg(NO_VOICE_MSG)
    }
  }

  const togglePlay = () => {
    const el = audio.current
    if (status === 'playing') { el.pause(); setWant(false); return }
    if (status === 'paused') { el.play(); setWant(true); return }
    if (status === 'loading' || status === 'browser') { halt(); setStatus('idle'); setWant(false); return }
    setWant(true)
    start()
  }

  // phím tắt như YouTube: Space / K phát-dừng, Shift+N thẻ kế, Shift+P thẻ trước
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, button, audio')) return
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay() }
      else if (e.shiftKey && e.key === 'N' && nextId) go(nextId)
      else if (e.shiftKey && e.key === 'P' && prevId) go(prevId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // điều khiển từ màn hình khoá / tai nghe (Media Session)
  useEffect(() => {
    const ms = navigator.mediaSession
    if (!ms || !card) return
    ms.metadata = new window.MediaMetadata({ title: card.title, artist: pl?.name || 'VCWIKI', album: 'VCWIKI' })
    ms.setActionHandler('nexttrack', nextId ? () => go(nextId, true) : null)
    ms.setActionHandler('previoustrack', prevId ? () => go(prevId, true) : null)
  })

  const toggleShuffle = () => setShuffle(shuffle ? null : shuffled(ids, curId))

  const save = async (body, okText) => {
    setActionError(null)
    try {
      const p = await api.patchPlaylist(id, body)
      setPl(p)
      if (okText) toast(okText)
      return p
    } catch (e) { setActionError(e.message); return null }
  }
  const move = (cid, delta) => {
    const list = [...ids]
    const i = list.indexOf(cid)
    const j = i + delta
    if (j < 0 || j >= list.length) return
    [list[i], list[j]] = [list[j], list[i]]
    save({ card_ids: list })
  }
  const remove = (cid) => save({ card_ids: ids.filter((x) => x !== cid) })
  const destroy = async () => {
    if (!(await confirmDialog({ title: `Xoá danh sách "${pl.name}"?`, body: 'Các thẻ vẫn còn trong VCWIKI.', okLabel: 'Xoá danh sách', danger: true }))) return
    try { await api.deletePlaylist(id); navigate('/playlists') } catch (e) { setActionError(e.message) }
  }

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!pl) return <Loading />

  const playIcon = status === 'playing' ? '⏸' : status === 'loading' ? '⏳' : status === 'browser' ? '■' : '▶'

  return (
    <div className="player">
      <section className="player-main">
        <div className="player-bar card">
          <div className="player-controls">
            <button className="icon-btn" onClick={() => prevId && go(prevId)} disabled={!prevId} title="Thẻ trước (Shift+P)" aria-label="Thẻ trước">⏮</button>
            <button className="btn btn-primary player-play" onClick={togglePlay} disabled={!card} data-testid="player-play"
              aria-pressed={['playing', 'loading', 'browser'].includes(status)}
              aria-label={card ? `Phát: ${card.title}` : 'Phát'}
              title={status === 'playing' ? 'Tạm dừng (Space)' : 'Phát (Space)'}>{playIcon}</button>
            <button className="icon-btn" onClick={() => nextId && go(nextId)} disabled={!nextId} title="Thẻ kế (Shift+N)" aria-label="Thẻ kế">⏭</button>
            <button className={`icon-btn ${shuffle ? 'on' : ''}`} onClick={toggleShuffle} title={shuffle ? 'Tắt trộn bài' : 'Trộn bài'}
              aria-label="Trộn bài" aria-pressed={!!shuffle}>🔀</button>
            <button className={`icon-btn ${repeat !== 'off' ? 'on' : ''}`} onClick={() => setRepeat(NEXT_REPEAT[repeat])}
              title={REPEAT[repeat].label} aria-label={`Chế độ lặp: ${REPEAT[repeat].label} (bấm để đổi)`}>{REPEAT[repeat].icon}</button>
            <label className="small muted player-auto">
              <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} /> Tự chuyển thẻ
            </label>
            <span className="grow" />
            <VoiceSelects pref={pref} onChange={setPref} />
          </div>
          <audio ref={audio} controls={status === 'playing' || status === 'paused'}
            onPlaying={() => setStatus('playing')} onPause={() => audio.current?.getAttribute('src') && !audio.current.ended && setStatus('paused')}
            onEnded={finished} onError={onError} />
          {status === 'loading' && <div className="small muted" role="status">Đang tạo giọng đọc… thẻ dài có thể mất khoảng 10 giây ở lần nghe đầu.</div>}
          {msg && <div className="small muted" role="status">{msg}</div>}
        </div>

        <ErrorBox>{cardError}</ErrorBox>
        {!ids.length && <Empty>Danh sách chưa có thẻ nào. Mở một thẻ trong <Link className="link" to="/wiki">VCWIKI</Link> và bấm <b>≡+ Danh sách phát</b>.</Empty>}
        {card && card.id === curId && (
          <article className="card player-card">
            <div className="muted small">
              {CARD_TYPE[card.type] || card.type} · {card.space_name} · {card.created_by_name} · {dateTime(card.created_at)}
            </div>
            <h1>{card.title}</h1>
            <div className="meta">
              <span>Thẻ {pos + 1}/{order.length}</span>
              <Link className="link" to={`/wiki?card=${card.id}`}>Mở trong VCWIKI ↗</Link>
            </div>
            <CardContent card={card} />
          </article>
        )}
      </section>

      <aside className="player-queue card">
        <div className="player-queue-head">
          {editing ? (
            <PlaylistForm initial={pl} onCancel={() => setEditing(false)}
              onSave={async (body) => (await save(body, 'Đã lưu')) && setEditing(false)} />
          ) : (
            <>
              <h2>{pl.name}</h2>
              <div className="muted small">
                {pl.visibility === 'public' ? '🌐 Công khai' : '🔒 Riêng tư'} · {pl.owner_name} · {pl.count} thẻ
                {shuffle && ' · đang trộn bài'}
              </div>
              {pl.description && <p className="small">{pl.description}</p>}
              {pl.can_edit && (
                <div className="actions">
                  <button className="btn btn-ghost" data-testid="player-playlist-edit" onClick={() => setEditing(true)}>Sửa</button>
                  <button className="btn btn-ghost btn-danger-text" data-testid="player-playlist-delete" onClick={destroy}>Xoá danh sách</button>
                </div>
              )}
            </>
          )}
          <ErrorBox>{actionError}</ErrorBox>
        </div>
        <ol className="queue" aria-label={`Các thẻ trong danh sách ${pl.name}`}>
          {order.map((cid, i) => {
            const c = items.find((x) => x.id === cid)
            const cur = cid === curId
            return (
              <li key={cid} className={cur ? 'current' : ''} data-id={cid} data-status={c.status}>
                <button className="queue-item" onClick={() => go(cid, true)} aria-current={cur ? 'true' : undefined}>
                  <span className="queue-no">{cur && want ? '▶' : i + 1}</span>
                  <span className="grow">
                    <span className="clamp-2 strong">{c.title}</span>
                    <span className="muted small">{CARD_TYPE[c.type] || c.type} · {c.space_name}
                      {c.status !== 'approved' && <> · <Badge>{c.status === 'draft' ? 'nháp' : 'đã loại'}</Badge></>}</span>
                  </span>
                </button>
                {pl.can_edit && !shuffle && (
                  <span className="queue-tools">
                    <button className="icon-btn" onClick={() => move(cid, -1)} disabled={i === 0} title="Lên" aria-label={`Đưa lên: ${c.title}`}>↑</button>
                    <button className="icon-btn" onClick={() => move(cid, 1)} disabled={i === order.length - 1} title="Xuống" aria-label={`Đưa xuống: ${c.title}`}>↓</button>
                    <button className="icon-btn" onClick={() => remove(cid)} title="Bỏ khỏi danh sách" aria-label={`Bỏ khỏi danh sách: ${c.title}`}>✕</button>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        {pl.hidden > 0 && <div className="small muted">{pl.hidden} thẻ bị ẩn (đã xoá hoặc bạn không có quyền xem kho chứa thẻ).</div>}
      </aside>
    </div>
  )
}

export function PlaylistForm({ initial = {}, onSave, onCancel, submitLabel = 'Lưu' }) {
  const [name, setName] = useState(initial.name || '')
  const [description, setDescription] = useState(initial.description || '')
  const [visibility, setVisibility] = useState(initial.visibility || 'private')
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); onSave({ name: name.trim(), description, visibility }) }}>
      <label className="field"><span>Tên danh sách</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus /></label>
      <label className="field"><span>Mô tả</span><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></label>
      <label className="field">
        <span>Ai xem được</span>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="private">🔒 Riêng tư — chỉ mình tôi</option>
          <option value="public">🌐 Công khai — mọi người trong hệ thống</option>
        </select>
      </label>
      <div className="actions">
        <button className="btn btn-primary" disabled={!name.trim()}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Huỷ</button>}
      </div>
    </form>
  )
}
