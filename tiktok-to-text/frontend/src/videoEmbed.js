// Nhận diện link YouTube / TikTok để nhúng xem trong app (components/videoEmbed.jsx).
// Không phụ thuộc React — chạy được bằng `node --test` (videoEmbed.test.js).

const YT_ID = /^[\w-]{11}$/
const TT_ID = /^\d{8,25}$/

// "1h2m3s" / "90s" / "90" -> giây (tham số t= / start= của YouTube)
export function parseTime(v) {
  if (v == null || v === '') return 0
  const s = String(v).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return Math.floor(Number(s))
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i)
  if (!m || !(m[1] || m[2] || m[3])) return 0
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0)
}

function toUrl(raw) {
  if (!raw || typeof raw !== 'string') return null
  const s = raw.trim()
  try {
    return new URL(/^[a-z][\w+.-]*:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
}

function parseYouTube(u) {
  const host = u.hostname.replace(/^(www|m|music)\./, '')
  const q = u.searchParams
  const parts = u.pathname.split('/').filter(Boolean)
  let id = null
  let short = false
  if (host === 'youtu.be') id = parts[0]
  else if (['youtube.com', 'youtube-nocookie.com'].includes(host)) {
    if (parts[0] === 'watch') id = q.get('v')
    else if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) {
      id = parts[1]
      short = parts[0] === 'shorts'
    }
    if (id === 'videoseries') id = null
  } else return null
  const list = q.get('list') || null
  const valid = id && YT_ID.test(id)
  if (!valid && !list) return null
  return {
    platform: 'youtube', id: valid ? id : null, list: list && /^[\w-]+$/.test(list) ? list : null,
    start: parseTime(q.get('t') || q.get('start') || (u.hash.match(/t=([^&]+)/) || [])[1]), vertical: short,
  }
}

function parseTikTok(u) {
  const host = u.hostname.replace(/^(www|m)\./, '')
  if (!/(^|\.)tiktok\.com$/.test(host)) return null
  const p = u.pathname
  const m = p.match(/\/video\/(\d+)/) || p.match(/^\/v\/(\d+)(\.html)?/) || p.match(/^\/embed(?:\/v2)?\/(\d+)/)
    || p.match(/^\/player\/v1\/(\d+)/)
  // link rút gọn vt. / vm.tiktok.com/<mã> không chứa id -> nhận nền tảng, id lấy từ key tài liệu (nếu có)
  return { platform: 'tiktok', id: m && TT_ID.test(m[1]) ? m[1] : null, list: null, start: 0, vertical: true }
}

// url + (tuỳ chọn) key / meta của tài liệu video (key = id yt-dlp: YouTube 11 ký tự, TikTok dãy số)
// -> { platform: 'youtube'|'tiktok', id, list, start, vertical } | null. id null = chỉ hiện link, không nhúng được.
export function parseVideoUrl(url, { key, meta } = {}) {
  const u = toUrl(url)
  if (!u) return null
  const r = parseYouTube(u) || parseTikTok(u)
  if (!r) return null
  if (!r.id) {
    const guess = [key, meta?.video_id].find((x) => x && (r.platform === 'youtube' ? YT_ID : TT_ID).test(String(x)))
    if (guess) r.id = String(guess)
  }
  return r
}

export const canEmbed = (v) => !!(v && (v.id || v.list))

export function thumbnailOf(v, meta) {
  if (!v) return null
  if (v.platform === 'youtube' && v.id) return `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
  return meta?.thumbnail || null
}

// Link mở video YouTube trên trang gốc, tại giây `at` (deep link thời điểm)
export function watchUrl(v, at = 0) {
  if (!v) return null
  const t = Math.max(0, Math.floor(at || 0))
  if (v.platform === 'youtube') {
    if (!v.id) return `https://www.youtube.com/playlist?list=${v.list}`
    return `https://www.youtube.com/watch?v=${v.id}${v.list ? `&list=${v.list}` : ''}${t ? `&t=${t}s` : ''}`
  }
  return null   // TikTok: không dựng link từ id (cần @handle) — dùng link gốc của tài liệu
}

// iframe dự phòng khi không tải được IFrame Player API (không đồng bộ chữ được)
export function embedSrc(v, at = 0, autoplay = true) {
  if (!canEmbed(v)) return null
  const t = Math.max(0, Math.floor(at || 0))
  if (v.platform === 'youtube') {
    const base = v.id ? `https://www.youtube-nocookie.com/embed/${v.id}?` : `https://www.youtube-nocookie.com/embed/videoseries?list=${v.list}&`
    return `${base}${v.id && v.list ? `list=${v.list}&` : ''}rel=0&playsinline=1${autoplay ? '&autoplay=1' : ''}${t ? `&start=${t}` : ''}`
  }
  return `https://www.tiktok.com/player/v1/${v.id}?${autoplay ? 'autoplay=1&' : ''}description=0&music_info=0`
}

// Câu đang phát: segment cuối có start <= t (segments sắp theo start) -> chỉ số, -1 nếu chưa tới câu đầu
export function segmentAt(segments, t) {
  let lo = 0
  let hi = segments.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segments[mid].start <= t + 0.05) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

// Nguồn một video (link YouTube / TikTok của đúng một video) -> { video, doc } để nhúng ở đầu chi tiết nguồn;
// kênh / danh sách phát / link không nhận ra -> null (mỗi tài liệu có nút "Xem video" riêng).
// Link rút gọn vt. / vm.tiktok.com không có id: lấy id từ key của tài liệu duy nhất (id yt-dlp của video).
export function sourceVideo(url, docs = []) {
  const v = parseVideoUrl(url)
  if (!v) return null
  const shortLink = v.platform === 'tiktok' && /^(vt|vm)\./i.test(toUrl(url)?.hostname || '')
  if (!v.id && shortLink && docs.length === 1) {
    const g = parseVideoUrl(url, { key: docs[0].key, meta: docs[0].meta })
    if (g?.id) return { video: g, doc: docs[0] }
  }
  if (!v.id) return null
  return { video: v, doc: docs.find((d) => d.key === v.id) || (docs.length === 1 ? docs[0] : null) }
}
