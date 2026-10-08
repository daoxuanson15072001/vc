const nf = new Intl.NumberFormat('vi-VN')

export const num = (n) => (n == null ? '—' : nf.format(n))

export const compact = (n) => {
  if (n == null) return '—'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.0', '')}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace('.0', '')}K`
  return String(n)
}

export const date = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')

export const dateTime = (s) =>
  s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'

export const time = (s) => (s ? new Date(s).toLocaleTimeString('vi-VN') : '')

export const duration = (sec) => {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  if (h) return `${h} giờ ${m} phút`
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

export const totalTime = (sec) => {
  if (!sec) return '0 phút'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h} giờ ${m} phút` : `${m} phút`
}

export const clock = (sec) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const VIDEO_STATUS = {
  ok: { label: 'OK', tone: 'good' },
  no_speech: { label: 'Không lời nói', tone: 'warn' },
  error: { label: 'Lỗi', tone: 'bad' },
}


export const SOURCE_KIND = {
  video: { label: 'Video MXH', icon: '▶' },
  web: { label: 'Bài viết / link', icon: '🌐' },
  pdf: { label: 'PDF', icon: '📄' },
  google: { label: 'Google', icon: 'G' },
  office: { label: 'Word / PPT / Excel', icon: '📑' },
  image: { label: 'Ảnh chụp', icon: '🖼' },
  audio: { label: 'Ghi âm', icon: '🎙' },
  video_file: { label: 'Video tải lên', icon: '🎞' },
}

export const SOURCE_STATUS = {
  uploading: { label: 'Đang tải lên', tone: 'muted' },
  queued: { label: 'Chờ xử lý', tone: 'muted' },
  extracting: { label: 'Đang chuyển thành chữ', tone: 'info' },
  extracted: { label: 'Đã chuyển chữ', tone: 'good' },
  building: { label: 'Đang dựng VCWIKI', tone: 'info' },
  synth: { label: 'Đang tổng hợp VCWIKI', tone: 'info' },
  transcribed: { label: 'Đã chuyển chữ', tone: 'good' },
  waiting_ai: { label: 'Chờ cấu hình AI', tone: 'warn' },
  done: { label: 'Hoàn tất', tone: 'good' },
  error: { label: 'Lỗi', tone: 'bad' },
  cancelled: { label: 'Đã dừng', tone: 'muted' },
  refine_paused: { label: 'Đã dừng tinh chế', tone: 'warn' },
}

export const DOC_STATUS = {
  skipped: { label: 'Chỉ chuyển chữ', tone: 'muted' },
  pending: { label: 'Chờ AI', tone: 'muted' },
  processing: { label: 'AI đang đọc', tone: 'info' },
  grouping: { label: 'Đang tổng hợp', tone: 'info' },
  done: { label: 'Đã vào VCWIKI', tone: 'good' },
  error: { label: 'Lỗi AI', tone: 'bad' },
  paused: { label: 'Đã dừng tinh chế', tone: 'warn' },
}

export const SYNTH_STATUS = {
  queued: { label: 'Chờ chạy', tone: 'muted' },
  triaging: { label: 'AI đang sàng lọc', tone: 'info' },
  clustering: { label: 'AI đang gom cụm', tone: 'info' },
  planned: { label: 'Chờ duyệt kế hoạch', tone: 'warn' },
  synthesizing: { label: 'AI đang viết thẻ', tone: 'info' },
  done: { label: 'Hoàn tất', tone: 'good' },
  error: { label: 'Lỗi', tone: 'bad' },
  cancelled: { label: 'Đã huỷ', tone: 'muted' },
}

export const CLUSTER_STATUS = {
  pending: { label: 'Chờ viết', tone: 'muted' },
  running: { label: 'Đang viết', tone: 'info' },
  done: { label: 'Xong', tone: 'good' },
  error: { label: 'Lỗi', tone: 'bad' },
}

export const CARD_STATUS = {
  draft: { label: 'Nháp', tone: 'warn' },
  approved: { label: 'Đã duyệt', tone: 'good' },
  rejected: { label: 'Loại', tone: 'muted' },
}

export const CARD_TYPE = {
  framework: 'Framework',
  concept: 'Khái niệm',
  case_study: 'Case study',
  regulation: 'Quy định',
  insight: 'Insight',
  hook: 'Hook',
  lesson: 'Bài học',
  sop: 'SOP',
  checklist: 'Checklist',
  template: 'Mẫu biểu',
  kpi: 'KPI',
  skill: 'Skill AI',
  memory: 'Ghi nhớ AI',
  context: 'Bối cảnh AI',
}

// Phân loại v2 (backend/app/kb/classify.py)
export const CARD_LEVEL = {
  'dieu-hanh': 'Điều hành',
  'thiet-ke': 'Thiết kế',
  'van-hanh': 'Vận hành',
  'thuc-thi': 'Thực thi',
  'nhap-mon': 'Nhập môn',
}

export const DIVISION = {
  vcpart: 'VCpart', vcsoft: 'VCsoft', vcobd: 'VCOBD', vcservice: 'VCservice', vce: 'VCE', vcmedia: 'VCmedia',
  'tap-doan': 'Tập đoàn',
}

export const PROCESS_CHAIN = {
  'ban-hang-b2b': 'Bán hàng B2B', 'san-tmdt': 'Bán trên sàn', 'mua-hang': 'Mua hàng – nhập khẩu',
  'nhan-su': 'Tuyển – dùng – giữ', 'dieu-hanh-thang': 'Nhịp điều hành tháng', 'tuyen-sinh-vce': 'Tuyển sinh VCE',
  'dich-vu-xuong': 'Dịch vụ xưởng', 'trien-khai-vcgarage': 'Triển khai VCgarage',
}

export const processStepLabel = (s) => {
  const m = /^qt\.([a-z0-9-]+)\.([a-d])$/.exec(s || '')
  return m ? `${PROCESS_CHAIN[m[1]] || m[1]} · bước ${m[2].toUpperCase()}` : s
}

export const SPACE_ROLE = { owner: 'Chủ kho', editor: 'Được sửa', viewer: 'Chỉ xem' }
// Dự án marketing (BA 5.13, CE-32): vai trò trong dự án, thấp -> cao
export const PROJECT_ROLE = { viewer: 'Chỉ xem', reviewer: 'Người duyệt', editor: 'Biên tập', owner: 'Chủ dự án' }
export const RESOURCE_KIND = {
  video: { label: 'Video Kho video', prefix: 'R' }, url: { label: 'Trang web', prefix: 'S' },
  social_post: { label: 'Bài mẫu MXH', prefix: 'P' }, document: { label: 'Tài liệu Kho tư liệu', prefix: 'D' },
}

export const bytes = (n) => (n == null ? '—' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

export const CAMPAIGN_STATUS = {
  queued: { label: 'Chờ AI', tone: 'muted' },
  waiting_ai: { label: 'Chờ cấu hình AI', tone: 'warn' },
  generating: { label: 'AI đang lập', tone: 'info' },
  ready: { label: 'Sẵn sàng', tone: 'good' },
  done: { label: 'Đã viết', tone: 'good' },
  error: { label: 'Lỗi', tone: 'bad' },
}

export const CAMPAIGN_STAGE = {
  serp: 'Tải trang đối thủ & sitemap',
  strategy: 'Phân tích tham chiếu, lập chiến lược & chiến dịch',
  plan: 'Lập kế hoạch nội dung',
  plan_video: 'Lập kế hoạch video ngắn',
  plan_seo: 'Lập kế hoạch bài SEO',
  plan_social: 'Lập kế hoạch bài mạng xã hội',
}

// 3 luồng của Content Engine (BA mục 5.7)
export const FLOW = {
  video: { label: 'Video ngắn', unit: 'tập', piece: 'kịch bản' },
  seo: { label: 'Bài SEO', unit: 'bài', piece: 'bài SEO' },
  social: { label: 'Bài MXH', unit: 'bài', piece: 'bài đăng' },
}
export const CHANNEL = {
  fb_personal: 'Facebook cá nhân',
  fanpage: 'Fanpage',
  linkedin: 'LinkedIn cá nhân',
  linkedin_page: 'Trang LinkedIn',
  other: 'Kênh ngoài khác',
}
export const PERSONAL_CHANNELS = ['fb_personal', 'linkedin']

export const pct = (x, digits = 1) => (x == null ? '—' : `${parseFloat((x * 100).toFixed(digits))}%`)

// Công cụ đã chuyển nguồn thành chữ (tầng chữ) — tên dễ đọc cho người dùng
export const engineLabel = (e) => (e || '')
  .split(' + ')
  .map((x) => {
    if (x.startsWith('whisper:')) return `Whisper (${x.split(':').pop().split('/').pop()})`
    if (x.startsWith('claude:')) return `Claude (${x.slice(7)})`
    if (x.startsWith('google-export:')) return `Google xuất ${x.slice(14)}`
    return { subtitles: 'phụ đề có sẵn', tesseract: 'OCR Tesseract', trafilatura: 'trafilatura', pypdf: 'pypdf' }[x] || x
  })
  .filter(Boolean)
  .join(' + ')
