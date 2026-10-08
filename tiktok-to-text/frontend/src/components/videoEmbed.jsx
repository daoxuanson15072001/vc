// Nhúng xem video YouTube / TikTok trong app + đồng bộ chữ theo câu (chi tiết nguồn ở Kho tư liệu).
// - "Mặt tiền": ảnh bìa + nút ▶, bấm mới nạp iframe (không tải script / cookie bên thứ ba khi chỉ mở drawer).
// - YouTube: youtube-nocookie + IFrame Player API (tải script một lần, khi cần) -> tua, lấy giây đang phát.
// - TikTok: player v1 (https://www.tiktok.com/player/v1/<id>) điều khiển bằng postMessage theo tài liệu
//   developers.tiktok.com/doc/embed-player: gửi {type:'seekTo'|'play', value, 'x-tiktok-player': true},
//   nhận onPlayerReady / onCurrentTime {currentTime, duration} / onPlayerError.
// - Chữ đồng bộ qua một "sync hub" (createSync) nối player với TranscriptSync — không cần chung cây component.
import { useEffect, useRef, useState } from 'react'
import { clock } from '../format'
import { canEmbed, embedSrc, segmentAt, thumbnailOf, watchUrl } from '../videoEmbed'

const PLATFORM_NAME = { youtube: 'YouTube', tiktok: 'TikTok' }
const YT_BLOCKED = new Set([2, 5, 100, 101, 150, 153])   // mã lỗi IFrame API: id sai / không cho nhúng / đã gỡ
const POLL_MS = 500
// Player không báo sẵn sàng sau chừng này -> hiện thêm link mở ngoài dưới khung (không che player): phòng khi
// iframe tự hiện lỗi mà API không bắn onError (vd lỗi cấu hình 153), mạng chặn tên miền video, TikTok im lặng…
const SLOW_MS = 8000

// Cầu nối player <-> chữ: player gắn vào (attach), chữ nghe giây đang phát (on) và bấm câu để tua (seek).
// Tua khi player chưa nạp -> giữ lại giây đó và xin player nạp (onRequest).
export function createSync() {
  let player = null
  let pending = null
  let request = null
  const subs = new Set()
  return {
    attach(p) { player = p },
    detach(p) { if (player === p) player = null },
    seek(t) {
      if (player) player.seek(t)
      else {
        pending = t
        request?.()
      }
    },
    takePending() {
      const t = pending
      pending = null
      return t
    },
    onRequest(fn) {
      request = fn
      return () => { if (request === fn) request = null }
    },
    emit(t) { subs.forEach((f) => f(t)) },
    on(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

let ytApi = null
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  ytApi ||= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      ytApi = null
      s.remove()
      reject(new Error('Không tải được YouTube IFrame API'))
    }
    document.head.appendChild(s)
  })
  return ytApi
}

// video: kết quả parseVideoUrl; url: link gốc (mở ngoài); meta: meta tài liệu (thumbnail nếu có)
// autoStart: nạp player ngay (khi người dùng vừa bấm "Xem video")
export function VideoEmbed({ video, url, meta, title, sync, autoStart = false }) {
  const [phase, setPhase] = useState(autoStart ? 'player' : 'facade')   // facade | player | iframe | blocked
  const [startAt, setStartAt] = useState(() => (autoStart ? sync?.takePending() : null) ?? video.start ?? 0)
  const [slow, setSlow] = useState(false)
  const name = PLATFORM_NAME[video.platform]
  const thumb = thumbnailOf(video, meta)
  const openUrl = watchUrl(video) || url

  useEffect(() => {
    if (!sync || phase !== 'facade') return undefined
    return sync.onRequest(() => {
      setStartAt(sync.takePending() ?? video.start ?? 0)
      setPhase('player')
    })
  }, [sync, phase, video.start])

  const cls = `vembed${video.vertical ? ' vembed-v' : ''}`
  if (!canEmbed(video)) return null
  if (phase === 'blocked') {
    return (
      <div className={cls}>
        {thumb && <img className="vembed-thumb vembed-dim" src={thumb} alt="" loading="lazy" />}
        <div className="vembed-msg">
          <span>Không xem được video này trong app — chủ kênh tắt nhúng, video riêng tư hoặc đã bị gỡ.</span>
          <a className="btn" href={openUrl} target="_blank" rel="noreferrer">Mở trên {name} ↗</a>
        </div>
      </div>
    )
  }
  if (phase === 'facade') {
    return (
      <button type="button" className={`${cls} vembed-facade`} aria-label={`Phát video${title ? `: ${title}` : ''}`}
        onClick={() => { setStartAt(sync?.takePending() ?? video.start ?? 0); setPhase('player') }}>
        {thumb ? <img className="vembed-thumb" src={thumb} alt="" loading="lazy" />
          : <span className={`vembed-logo vembed-logo-${video.platform}`}>{name}</span>}
        <span className="vembed-play" aria-hidden="true">▶</span>
      </button>
    )
  }
  if (phase === 'iframe') {   // không tải được Player API: iframe thường, không đồng bộ chữ
    return (
      <div className={cls}>
        <iframe src={embedSrc(video, startAt)} title={title || `Video ${name}`} allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" />
      </div>
    )
  }
  const player = video.platform === 'youtube'
    ? <YouTubePlayer className={cls} video={video} startAt={startAt} sync={sync} title={title}
      onBlocked={() => setPhase('blocked')} onNoApi={() => setPhase('iframe')} onSlow={setSlow} />
    : <TikTokPlayer className={cls} video={video} startAt={startAt} sync={sync} title={title}
      onBlocked={() => setPhase('blocked')} onSlow={setSlow} />
  return (
    <>
      {player}
      {slow && openUrl && (
        <div className="vembed-note">
          Video chưa phát được? <a className="link" href={openUrl} target="_blank" rel="noreferrer">Mở trên {name} ↗</a>
        </div>
      )}
    </>
  )
}

// Hẹn giờ "player chưa sẵn sàng": gọi onSlow(true) nếu quá SLOW_MS chưa ready(); ready() thì gỡ báo
function slowWatch(cb) {
  let done = false
  const timer = setTimeout(() => { if (!done) cb.current.onSlow?.(true) }, SLOW_MS)
  return {
    ready() {
      if (done) return
      done = true
      clearTimeout(timer)
      cb.current.onSlow?.(false)
    },
    stop() {
      done = true
      clearTimeout(timer)
    },
  }
}

function YouTubePlayer({ className, video, startAt, sync, onBlocked, onNoApi, onSlow }) {
  const box = useRef(null)
  const cb = useRef({ onBlocked, onNoApi, onSlow })
  cb.current = { onBlocked, onNoApi, onSlow }

  useEffect(() => {
    const watch = slowWatch(cb)
    let player = null
    let timer = null
    let gone = false
    const stop = () => { clearInterval(timer); timer = null }
    const tick = () => { try { sync?.emit(player.getCurrentTime()) } catch { /* player đã huỷ */ } }
    const handle = {
      seek(t) {
        player?.seekTo(t, true)
        player?.playVideo()
        sync?.emit(t)
      },
    }
    loadYouTubeApi().then((YT) => {
      if (gone || !box.current) return
      const holder = document.createElement('div')   // YT thay phần tử này bằng iframe — để ngoài tầm React
      box.current.appendChild(holder)
      const list = video.list ? { listType: 'playlist', list: video.list } : {}
      player = new YT.Player(holder, {
        host: 'https://www.youtube-nocookie.com',
        width: '100%', height: '100%',
        ...(video.id ? { videoId: video.id } : {}),
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, start: Math.floor(startAt || 0), ...list },
        events: {
          onReady: () => {
            watch.ready()
            sync?.attach(handle)
          },
          onStateChange: (e) => {
            if (e.data === 1) {   // đang phát
              if (!timer) timer = setInterval(tick, POLL_MS)
              tick()
            } else {
              stop()
              if (e.data === 0 || e.data === 2) tick()
            }
          },
          onError: (e) => {
            if (YT_BLOCKED.has(e.data)) cb.current.onBlocked()
          },
        },
      })
    }).catch(() => { if (!gone) cb.current.onNoApi() })
    return () => {
      gone = true
      watch.stop()
      stop()
      sync?.detach(handle)
      try { player?.destroy() } catch { /* bỏ qua */ }
      if (box.current) box.current.innerHTML = ''
    }
  }, [video.id, video.list]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div className={className} ref={box} />
}

function TikTokPlayer({ className, video, startAt, sync, title, onBlocked, onSlow }) {
  const frame = useRef(null)
  const cb = useRef({ onBlocked, onSlow })
  cb.current = { onBlocked, onSlow }

  useEffect(() => {
    const watch = slowWatch(cb)
    const post = (type, value) => frame.current?.contentWindow?.postMessage({ type, value, 'x-tiktok-player': true }, '*')
    // Player TikTok tự dừng khi tab bị ẩn / cửa sổ mất focus -> đang phát mà bị dừng lúc trang không ở trước mặt
    // thì xin phát lại ngay. Người dùng tự bấm dừng thì trang vẫn hiện + có focus (focus trong iframe vẫn tính) nên không đụng.
    let playing = false
    let pausedAt = 0   // lúc bị dừng khi trang còn hiện — phòng tin "dừng" tới trước sự kiện ẩn tab / mất focus
    const away = () => document.hidden || !document.hasFocus()
    const onAway = () => { if (away() && Date.now() - pausedAt < 800) post('play') }
    const handle = {
      seek(t) {
        post('seekTo', t)
        post('play')
        sync?.emit(t)
      },
    }
    const onMessage = (e) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return
      let m = e.data
      if (typeof m === 'string') {
        try { m = JSON.parse(m) } catch { return }
      }
      if (!m || typeof m.type !== 'string') return   // đã lọc theo e.source; không bắt buộc cờ x-tiktok-player ở chiều về
      if (m.type === 'onPlayerReady') {
        watch.ready()
        sync?.attach(handle)
        if (startAt > 0) handle.seek(startAt)   // player v1 không có tham số giờ bắt đầu -> tua khi sẵn sàng
      } else if (m.type === 'onCurrentTime') {
        const t = Number(m.value?.currentTime)
        if (Number.isFinite(t)) sync?.emit(t)
      } else if (m.type === 'onStateChange') {   // -1 chưa phát, 0 hết, 1 đang phát, 2 dừng, 3 đang tải
        const st = Number(m.value)
        if (st === 2 && playing && away()) post('play')
        else if (st !== 3) {
          pausedAt = st === 2 && playing ? Date.now() : 0
          playing = st === 1
        }
      } else if (m.type === 'onPlayerError') cb.current.onBlocked()
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('blur', onAway)
    document.addEventListener('visibilitychange', onAway)
    return () => {
      watch.stop()
      window.removeEventListener('message', onMessage)
      window.removeEventListener('blur', onAway)
      document.removeEventListener('visibilitychange', onAway)
      sync?.detach(handle)
    }
  }, [video.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className}>
      <iframe ref={frame} src={embedSrc(video)} title={title || 'Video TikTok'} allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" />
    </div>
  )
}

// Chữ theo câu có mốc [mm:ss]: bấm câu -> tua video; đang phát -> tô câu hiện tại và cuộn vào tầm nhìn
export function TranscriptSync({ segments, sync }) {
  const [cur, setCur] = useState(-1)
  const box = useRef(null)
  useEffect(() => sync?.on((t) => setCur(segmentAt(segments, t))), [sync, segments])
  useEffect(() => {
    const el = box.current?.children[cur]
    const b = box.current
    if (!el || !b) return
    if (el.offsetTop < b.scrollTop || el.offsetTop + el.offsetHeight > b.scrollTop + b.clientHeight) {
      b.scrollTo({ top: Math.max(0, el.offsetTop - b.clientHeight / 3), behavior: 'smooth' })
    }
  }, [cur])
  return (
    <div className="doc-text tsync" ref={box} role="list" aria-label="Lời nói theo mốc thời gian">
      {segments.map((s, i) => (
        <button key={i} type="button" role="listitem" className={`tsync-line${i === cur ? ' active' : ''}`}
          aria-current={i === cur || undefined} title="Tua video tới câu này" onClick={() => sync?.seek(s.start)}>
          <span className="seg-time">[{clock(s.start)}]</span>
          <span>{s.text}</span>
        </button>
      ))}
    </div>
  )
}
