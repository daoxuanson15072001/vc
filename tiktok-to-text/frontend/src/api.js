// Gọi BE qua /api (Vite proxy khi dev, cùng origin khi BE phục vụ bản build)
// Nguồn phiên duy nhất ở FE là state `session` trong App.jsx: App đăng ký hàm này để quay về màn hình đăng nhập
// khi phiên hết hạn / bị đăng xuất ở thiết bị khác. Mọi chỗ gọi API gặp 401 (ngoài /auth/*) đều đi qua đây.
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }
export const notifyUnauthorized = () => onUnauthorized()

// Lỗi kiểm tra dữ liệu của FastAPI (422, tiếng Anh) -> câu tiếng Việt nêu ô sai
const FIELD_VI = {
  name: 'Tên', title: 'Tiêu đề', description: 'Mô tả', code: 'Mã', slug: 'Slug', scope_note: 'Scope note',
  summary: 'Tóm tắt', body: 'Nội dung', type: 'Loại thẻ', status: 'Trạng thái', level: 'Cấp độ',
  division: 'Division', process_steps: 'Bước quy trình', effective_at: 'Ngày hiệu lực',
  review_cycle_months: 'Rà soát (tháng)', reason: 'Lý do', email: 'Email', password: 'Mật khẩu',
  links: 'Liên kết tra cứu', label: 'Tên', url: 'Địa chỉ (URL)', note: 'Ghi chú',
}
export function validationMsg(e) {
  if (e.type === 'value_error') return String(e.msg || '').replace(/^Value error, /, '')   // câu BE tự viết
  const field = [...(e.loc || [])].reverse().find((x) => typeof x === 'string' && x !== 'body')
  const label = FIELD_VI[field] || field || 'Dữ liệu'
  const c = e.ctx || {}
  const vi = {
    string_too_short: c.min_length === 1 ? 'không được để trống' : `cần ít nhất ${c.min_length} ký tự`,
    string_too_long: `tối đa ${c.max_length} ký tự`,
    too_long: `tối đa ${c.max_length} mục`,
    missing: 'bắt buộc nhập',
    int_type: 'phải là số nguyên', int_parsing: 'phải là số nguyên', int_from_float: 'phải là số nguyên',
    bool_type: 'phải là có / không', list_type: 'phải là danh sách', literal_error: 'giá trị không hợp lệ',
    enum: 'giá trị không hợp lệ', less_than_equal: `tối đa ${c.le}`, greater_than_equal: `tối thiểu ${c.ge}`,
  }[e.type]
  return `${label}: ${vi || String(e.msg || '').replace(/^Value error, /, '')}`
}
const errorText = (d) => (Array.isArray(d) ? d.map(validationMsg).join('; ') : d)

// Lỗi gọi API: message cho người đọc; kèm status (0 = không kết nối được), endpoint ("GET /api/…"), retryable
// (5xx / mất kết nối — thường do máy chủ đang khởi động lại sau khi nạp code mới; bấm Thử lại là xong).
export class ApiError extends Error {
  constructor(message, { status = 0, endpoint = '', detail = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.endpoint = endpoint
    this.detail = detail
    this.retryable = status === 0 || status >= 500
  }
}
const SERVER_HINT = {
  502: 'máy chủ chưa sẵn sàng (đang khởi động lại?) — bấm Thử lại sau vài giây',
  503: 'máy chủ bận hoặc đang khởi động lại — bấm Thử lại sau vài giây',
  504: 'máy chủ trả lời quá lâu — bấm Thử lại',
}

async function request(method, path, body) {
  const isForm = body instanceof FormData
  const endpoint = `${method} /api${path.split('?')[0]}`
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    })
  } catch (e) {
    // fetch ném TypeError "Failed to fetch" khi máy chủ không nhận kết nối (đang khởi động lại, tắt, mất mạng)
    throw new ApiError(`Không kết nối được máy chủ (${endpoint}) — máy chủ đang khởi động lại hoặc đã tắt; bấm Thử lại sau vài giây`,
      { status: 0, endpoint })
  }
  // Phiên hết hạn / bị đăng xuất ở thiết bị khác -> quay về màn đăng nhập
  if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized()
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = errorText(data?.detail)
    // 4xx: câu BE tự viết (đã tiếng Việt, nêu ô sai); 5xx: mã + endpoint + gợi ý để biết là lỗi máy chủ, thử lại được
    const message = res.status >= 500
      ? `${res.status} ${endpoint} — ${detail || SERVER_HINT[res.status] || 'lỗi máy chủ, bấm Thử lại'}`
      : detail || `Lỗi ${res.status} (${endpoint})`
    throw new ApiError(message, { status: res.status, endpoint, detail })
  }
  return data
}

// Tải file có báo tiến độ (fetch không báo được % đã gửi) — dùng cho video / ghi âm dung lượng lớn
function upload(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api${path}`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      if (xhr.status === 401) onUnauthorized()
      let data = null
      try { data = JSON.parse(xhr.responseText) } catch { /* không phải JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data)
      reject(new Error(errorText(data?.detail) || `Lỗi ${xhr.status}`))
    }
    xhr.onerror = () => reject(new ApiError(`Mất kết nối khi tải file lên (POST /api${path})`, { status: 0, endpoint: `POST /api${path}` }))
    xhr.send(form)
  })
}

export const qs = (params) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== '' && v != null && p.set(k, v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  trainingStructure: () => request('GET', '/learn/structure'),
  createTrainingNode: (body) => request('POST', '/learn/structure', body),
  updateTrainingNode: (id, body) => request('PUT', `/learn/structure/${id}`, body),
  deleteTrainingNode: (id) => request('DELETE', `/learn/structure/${id}`),
  trainingDocuments: (params = {}) => request('GET', `/learn/documents${qs(params)}`),
  saveTrainingDocument: (id, body) => request(id ? 'PUT' : 'POST', `/learn/documents${id ? '/' + id : ''}`, body),
  trainingDocumentAction: (id, action, revision) => request('POST', `/learn/documents/${id}/${action}${revision ? '?revision=' + revision : ''}`),
  deleteTrainingDocument: (id) => request('DELETE', `/learn/documents/${id}`),
  startTrainingExam: (id, curriculumId) => request('POST', `/learn/documents/${id}/exams/${curriculumId}/start`),
  recognizeLearningEquivalency: (id, body) => request('POST', `/learn/documents/${id}/equivalencies`, body),
  learningDocumentProgress: (id) => request('GET', `/learn/documents/${id}/progress`),
  acknowledgeLearningMaterial: (id, body) => request('POST', `/learn/documents/${id}/receipt`, body),
  learningTaskAction: (id, action, revision) => request('POST', `/learn/tasks/${id}/${action}${revision ? '?revision=' + revision : ''}`),
  updateLearningTask: (id, body) => request('PUT', `/learn/tasks/${id}`, body),
  learningAssets: () => request('GET', '/learn/assets'),
  uploadLearningAsset: (body) => request('POST', '/learn/assets', body),
  learningTasks: (params = {}) => request('GET', `/learn/tasks${qs(params)}`),
  createLearningTask: (body) => request('POST', '/learn/tasks', body),
  deleteLearningTask: (id) => request('DELETE', `/learn/tasks/${id}`),
  assignLearningTask: (id, body) => request('POST', `/learn/tasks/${id}/assign`, body),
  learningWork: () => request('GET', '/learn/work'),
  submitLearningWork: (id, body) => request('POST', `/learn/work/${id}/submit`, body),
  gradeLearningWork: (id, body) => request('POST', `/learn/work/${id}/grade`, body),
  copyLesson: (id) => request('POST', `/learn/lessons/${id}/copy`),
  deleteLesson: (id) => request('DELETE', `/learn/lessons/${id}`),
  setupStatus: () => request('GET', '/auth/setup'),
  setup: (body) => request('POST', '/auth/setup', body),
  login: (body) => request('POST', '/auth/login', body),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),
  // Số việc chờ của người đăng nhập — Việc của tôi (SCR-01) + huy hiệu menu (SCR-00), DESIGN V.9.2
  inboxCounts: () => request('GET', '/me/inbox/counts'),
  // Chia sẻ kho theo đơn vị (SYS-35, SCR-19.1)
  spaceUnits: (spaceId) => request('GET', `/spaces/${spaceId}/units`),
  addSpaceUnit: (spaceId, body) => request('POST', `/spaces/${spaceId}/units`, body),
  patchSpaceUnit: (spaceId, unitId, body) => request('PATCH', `/spaces/${spaceId}/units/${unitId}`, body),
  removeSpaceUnit: (spaceId, unitId) => request('DELETE', `/spaces/${spaceId}/units/${unitId}`),
  changePassword: (body) => request('POST', '/auth/me/password', body),
  users: (params = {}) => request('GET', `/users${qs(params)}`),
  createUser: (body) => request('POST', '/users', body),
  patchUser: (id, body) => request('PATCH', `/users/${id}`, body),
  stats: () => request('GET', '/stats'),
  videos: (params) => request('GET', `/videos${qs(params)}`),
  video: (id) => request('GET', `/videos/${id}`),
  patchVideo: (id, body) => request('PATCH', `/videos/${id}`, body),
  deleteVideo: (id) => request('DELETE', `/videos/${id}`),
  retranscribe: (id) => request('POST', `/videos/${id}/retranscribe`),
  tags: () => request('GET', '/tags'),
  channels: () => request('GET', '/channels'),
  srtUrl: (id) => `/api/videos/${id}/srt`,

  // Đăng nhập / người dùng
  setupStatus: () => request('GET', '/auth/setup'),
  setup: (body) => request('POST', '/auth/setup', body),
  login: (body) => request('POST', '/auth/login', body),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),
  changePassword: (body) => request('POST', '/auth/me/password', body),
  users: (q) => request('GET', `/users${qs({ q })}`),
  createUser: (body) => request('POST', '/users', body),
  patchUser: (id, body) => request('PATCH', `/users/${id}`, body),

  // Token cho AI kết nối MCP
  tokens: () => request('GET', '/auth/tokens'),
  createToken: (body) => request('POST', '/auth/tokens', body),
  revokeToken: (id) => request('DELETE', `/auth/tokens/${id}`),

  // Kho
  spaces: () => request('GET', '/spaces'),
  createSpace: (body) => request('POST', '/spaces', body),
  patchSpace: (id, body) => request('PATCH', `/spaces/${id}`, body),
  deleteSpace: (id) => request('DELETE', `/spaces/${id}`),
  addMember: (id, body) => request('POST', `/spaces/${id}/members`, body),
  setMemberRole: (id, uid, role) => request('PATCH', `/spaces/${id}/members/${uid}`, { role }),
  removeMember: (id, uid) => request('DELETE', `/spaces/${id}/members/${uid}`),

  // Lĩnh vực
  categories: (params = {}) => request('GET', `/categories${qs(params)}`),
  createCategory: (body) => request('POST', '/categories', body),
  patchCategory: (id, body) => request('PATCH', `/categories/${id}`, body),
  deleteCategory: (id, moveTo) => request('DELETE', `/categories/${id}${qs({ move_to: moveTo })}`),
  categorySuggestions: () => request('GET', '/categories/suggestions'),
  acceptSuggestion: (id) => request('POST', `/categories/suggestions/${id}/accept`),
  rejectSuggestion: (id) => request('POST', `/categories/suggestions/${id}/reject`),

  // Nạp kiến thức
  kbStatus: () => request('GET', '/kb/status'),
  detect: (url) => request('GET', `/kb/detect${qs({ url })}`),
  addLinks: (body) => request('POST', '/kb/sources/links', body),
  addFiles: (form, onProgress) => upload('/kb/sources/files', form, onProgress),
  buildWiki: (id) => request('POST', `/kb/sources/${id}/build-wiki`),
  setSourceNote: (id, note) => request('PUT', `/kb/sources/${id}/note`, { note }),
  // Ghi chép theo nguồn / từng tài liệu (WK-45): màn /kb/notes + chi tiết nguồn
  kbNotes: (params) => request('GET', `/kb/notes${qs(params)}`),
  addKbNote: (body) => request('POST', '/kb/notes', body),
  updateKbNote: (id, body) => request('PATCH', `/kb/notes/${id}`, body),
  deleteKbNote: (id) => request('DELETE', `/kb/notes/${id}`),
  kbQueue: () => request('GET', '/kb/queue'),
  sources: (params) => request('GET', `/kb/sources${qs(params)}`),
  source: (id) => request('GET', `/kb/sources/${id}`),
  retrySource: (id) => request('POST', `/kb/sources/${id}/retry`),
  cancelSource: (id) => request('POST', `/kb/sources/${id}/cancel`),
  stopAllSources: (body) => request('POST', '/kb/sources/stop-all', body),
  resumeAllSources: (body) => request('POST', '/kb/sources/resume-all', body),
  prioritizeSource: (id, top = true) => request('POST', `/kb/sources/${id}/priority`, { top }),
  deleteSource: (id) => request('DELETE', `/kb/sources/${id}`),
  document: (id) => request('GET', `/kb/documents/${id}`),
  semanticDocuments: (params) => request('GET', `/kb/documents/semantic${qs(params)}`),   // tìm theo nội dung tầng thô
  lookupDocuments: (urls) => request('POST', '/kb/documents/lookup', { urls }),
  rebuildDocument: (id) => request('POST', `/kb/documents/${id}/rebuild`),
  failedVideos: (params) => request('GET', `/kb/failed-videos${qs(params)}`),   // video lỗi mọi kênh + nhóm lỗi
  retranscribeVideos: (id, body) => request('POST', `/kb/sources/${id}/retranscribe`, body),
  cancelRetranscribe: (id) => request('POST', `/kb/sources/${id}/retranscribe/cancel`),
  detectLanguage: (url) => request('GET', `/kb/detect-language${qs({ url })}`),
  setDocumentTags: (id, tags) => request('PUT', `/kb/documents/${id}/tags`, { tags }),
  kbTags: (params = {}) => request('GET', `/kb/tags${qs(params)}`),
  documentSegments: (id) => request('GET', `/kb/documents/${id}?segments=1`),   // kèm mốc thời gian từng câu (video)
  // Tổng hợp VCWIKI theo cụm chủ đề
  startSynth: (sourceId, body = {}) => request('POST', `/kb/sources/${sourceId}/synth`, body),
  sourceSynthRuns: (sourceId) => request('GET', `/kb/sources/${sourceId}/synth`),
  synthRun: (id) => request('GET', `/wiki/synth/${id}`),
  saveSynthPlan: (id, clusters) => request('PUT', `/wiki/synth/${id}/plan`, { clusters }),
  runSynth: (id) => request('POST', `/wiki/synth/${id}/start`),
  cancelSynth: (id) => request('POST', `/wiki/synth/${id}/cancel`),
  retrySynthCluster: (id, key) => request('POST', `/wiki/synth/${id}/clusters/${key}/retry`),
  // Trò chuyện với Claude (lịch sử lưu ở BE)
  chatStatus: () => request('GET', '/chat/status'),
  chatThreads: (params = {}) => request('GET', `/chat/threads${qs(params)}`),
  createChatThread: (body) => request('POST', '/chat/threads', body),
  chatThread: (id) => request('GET', `/chat/threads/${id}`),
  patchChatThread: (id, body) => request('PATCH', `/chat/threads/${id}`, body),
  deleteChatThread: (id) => request('DELETE', `/chat/threads/${id}`),
  sendChat: (id, body) => request('POST', `/chat/threads/${id}/messages`, body),
  cancelChat: (mid) => request('POST', `/chat/messages/${mid}/cancel`),
  chatStreamUrl: (mid) => `/api/chat/messages/${mid}/stream`,   // EventSource (SSE)
  // Tiến độ tinh chế tài liệu thô -> VCWIKI
  refineSummary: (params = {}) => request('GET', `/kb/refine/summary${qs(params)}`),
  refineDocuments: (params = {}) => request('GET', `/kb/refine/documents${qs(params)}`),
  refineBulk: (body) => request('POST', '/kb/refine/bulk', body),
  refineStreamUrl: (params = {}) => `/api/kb/refine/stream${qs(params)}`,   // EventSource (SSE)
  // Tìm video theo chủ đề: AI tách từ khoá -> tìm TikTok / YouTube / Google
  discoverKeywords: (body) => request('POST', '/kb/discover/keywords', body),
  discoverSearch: (body) => request('POST', '/kb/discover/search', body),
  // inline=true: trình duyệt hiển thị ngay (xem trong app) thay vì tải về
  rawUrl: (id, path, inline = false) => `/api/kb/sources/${id}/raw/${path.split('/').map(encodeURIComponent).join('/')}${inline ? '?inline=1' : ''}`,
  // Xem trước file office: văn bản / trình chiếu -> PDF, bảng tính -> trang HTML (lỗi: JSON {detail} 415/503/504)
  previewUrl: (id, path) => `/api/kb/sources/${id}/preview/${path.split('/').map(encodeURIComponent).join('/')}`,

  // VCWIKI
  cards: (params) => request('GET', `/wiki/cards${qs(params)}`),
  card: (id) => request('GET', `/wiki/cards/${id}`),
  playlists: (params = {}) => request('GET', `/playlists${qs(params)}`),
  playlist: (id) => request('GET', `/playlists/${id}`),
  createPlaylist: (body) => request('POST', '/playlists', body),
  patchPlaylist: (id, body) => request('PATCH', `/playlists/${id}`, body),
  deletePlaylist: (id) => request('DELETE', `/playlists/${id}`),
  addToPlaylist: (id, cardId) => request('POST', `/playlists/${id}/items`, { card_id: cardId }),
  removeFromPlaylist: (id, cardId) => request('DELETE', `/playlists/${id}/items/${cardId}`),
  cardAudioUrl: (id, params) => `/api/wiki/cards/${id}/audio${qs(params)}`,
  createCard: (body) => request('POST', '/wiki/cards', body),
  patchCard: (id, body) => request('PATCH', `/wiki/cards/${id}`, body),
  deleteCard: (id) => request('DELETE', `/wiki/cards/${id}`),
  copyCard: (id, spaceId) => request('POST', `/wiki/cards/${id}/copy`, { space_id: spaceId }),
  wikiTags: (params = {}) => request('GET', `/wiki/tags${qs(params)}`),
  // Bản đồ tri thức (graph view kiểu Obsidian)
  wikiGraph: (params = {}) => request('GET', `/wiki/graph${qs(params)}`),
  analyzeGraph: (body) => request('POST', '/wiki/graph/analyze', body),
  vaultUrl: (params = {}) => `/api/wiki/graph/vault.zip${qs(params)}`,
  // Thảo luận & bình chọn
  comments: (cardId) => request('GET', `/wiki/cards/${cardId}/comments`),
  addComment: (cardId, body, parentId) => request('POST', `/wiki/cards/${cardId}/comments`, { body, parent_id: parentId || null }),
  editComment: (id, body) => request('PATCH', `/wiki/comments/${id}`, { body }),
  deleteComment: (id) => request('DELETE', `/wiki/comments/${id}`),
  voteCard: (cardId, stars) => request('PUT', `/wiki/cards/${cardId}/vote`, { stars }),
  voteComment: (id, stars) => request('PUT', `/wiki/comments/${id}/vote`, { stars }),
  leaderboard: (month) => request('GET', `/wiki/leaderboard${qs({ month })}`),
  exportUrl: (params) => `/api/export.xlsx${qs(params)}`,

  // Xưởng chiến dịch
  studioStatus: () => request('GET', '/studio/status'),
  studioRefs: (params) => request('GET', `/studio/references${qs(params)}`),
  studioCards: (params) => request('GET', `/studio/wiki-cards${qs(params)}`),
  campaigns: (params = {}) => request('GET', `/studio/campaigns${qs(params)}`),
  campaign: (id) => request('GET', `/studio/campaigns/${id}`),
  createCampaign: (body) => request('POST', '/studio/campaigns', body),
  patchCampaign: (id, body) => request('PATCH', `/studio/campaigns/${id}`, body),
  regenerateCampaign: (id, part) => request('POST', `/studio/campaigns/${id}/regenerate`, { part }),
  deleteCampaign: (id) => request('DELETE', `/studio/campaigns/${id}`),
  queueScripts: (id, body) => request('POST', `/studio/campaigns/${id}/scripts`, body),
  script: (id) => request('GET', `/studio/scripts/${id}`),
  patchScript: (id, body) => request('PATCH', `/studio/scripts/${id}`, body),
  rewriteScript: (id, feedback) => request('POST', `/studio/scripts/${id}/rewrite`, { feedback }),
  deleteScript: (id) => request('DELETE', `/studio/scripts/${id}`),
  writeArticle: (id, feedback) => request('POST', `/studio/scripts/${id}/article`, { feedback }),
  repurposeScript: (id, body) => request('POST', `/studio/scripts/${id}/repurpose`, body),
  campaignExportUrl: (id) => `/api/studio/campaigns/${id}/export.md`,
  quickTypes: () => request('GET', '/studio/quick/types'),
  quickList: (params = {}) => request('GET', `/studio/quick${qs(params)}`),
  quick: (id) => request('GET', `/studio/quick/${id}`),
  createQuick: (body) => request('POST', '/studio/quick', body),
  patchQuick: (id, body) => request('PATCH', `/studio/quick/${id}`, body),
  rewriteQuick: (id, feedback) => request('POST', `/studio/quick/${id}/rewrite`, { feedback }),
  deleteQuick: (id) => request('DELETE', `/studio/quick/${id}`),
  // Dự án marketing (BA 5.13)
  projects: (params = {}) => request('GET', `/studio/projects${qs(params)}`),
  project: (id) => request('GET', `/studio/projects/${id}`),
  createProject: (body) => request('POST', '/studio/projects', body),
  patchProject: (id, body) => request('PATCH', `/studio/projects/${id}`, body),
  deleteProject: (id) => request('DELETE', `/studio/projects/${id}`),
  addProjectMember: (id, body) => request('POST', `/studio/projects/${id}/members`, body),
  setProjectMemberRole: (id, userId, role) => request('PATCH', `/studio/projects/${id}/members/${userId}`, { role }),
  removeProjectMember: (id, userId) => request('DELETE', `/studio/projects/${id}/members/${userId}`),
  addProjectResource: (id, body) => request('POST', `/studio/projects/${id}/resources`, body),
  projectResource: (id, ref) => request('GET', `/studio/projects/${id}/resources/${ref}`),
  removeProjectResource: (id, ref) => request('DELETE', `/studio/projects/${id}/resources/${ref}`),
  pinProjectCard: (id, cardId) => request('POST', `/studio/projects/${id}/cards`, { card_id: cardId }),
  unpinProjectCard: (id, ref) => request('DELETE', `/studio/projects/${id}/cards/${ref}`),
  pinProjectCourse: (id, courseId) => request('POST', `/studio/projects/${id}/courses`, { course_id: courseId }),
  unpinProjectCourse: (id, ref) => request('DELETE', `/studio/projects/${id}/courses/${ref}`),
  projectPickDocuments: (id, params) => request('GET', `/studio/projects/${id}/pick/documents${qs(params)}`),
  projectPickCourses: (id, params) => request('GET', `/studio/projects/${id}/pick/courses${qs(params)}`),
  projectPickVideos: (id, params) => request('GET', `/studio/projects/${id}/pick/videos${qs(params)}`),
  analyses: (pid) => request('GET', `/studio/projects/${pid}/analyses`),
  analysis: (pid, id) => request('GET', `/studio/projects/${pid}/analyses/${id}`),
  createAnalysis: (pid, body) => request('POST', `/studio/projects/${pid}/analyses`, body),
  patchAnalysis: (pid, id, body) => request('PATCH', `/studio/projects/${pid}/analyses/${id}`, body),
  regenerateAnalysis: (pid, id, feedback) => request('POST', `/studio/projects/${pid}/analyses/${id}/regenerate`, { feedback }),
  finalizeAnalysis: (pid, id) => request('POST', `/studio/projects/${pid}/analyses/${id}/finalize`),
  deleteAnalysis: (pid, id) => request('DELETE', `/studio/projects/${pid}/analyses/${id}`),
  authors: (params = {}) => request('GET', `/studio/authors${qs(params)}`),
  createAuthor: (body) => request('POST', '/studio/authors', body),
  patchAuthor: (id, body) => request('PATCH', `/studio/authors/${id}`, body),
  deleteAuthor: (id) => request('DELETE', `/studio/authors/${id}`),
  // Đăng Facebook (BA 5.14): Fanpage qua Graph API; nhóm / trang cá nhân đăng hỗ trợ rồi dán link về
  fbStatus: () => request('GET', '/studio/facebook/status'),
  fbTargets: (params = {}) => request('GET', `/studio/facebook/targets${qs(params)}`),
  fbConnectPages: (body) => request('POST', '/studio/facebook/targets/pages', body),
  createFbTarget: (body) => request('POST', '/studio/facebook/targets', body),
  patchFbTarget: (id, body) => request('PATCH', `/studio/facebook/targets/${id}`, body),
  deleteFbTarget: (id) => request('DELETE', `/studio/facebook/targets/${id}`),
  checkFbTarget: (id) => request('POST', `/studio/facebook/targets/${id}/check`),
  fbDraft: (source, id) => request('GET', `/studio/facebook/draft${qs({ source, id })}`),
  fbPublish: (body) => request('POST', '/studio/facebook/publish', body),
  fbConfirm: (body) => request('POST', '/studio/facebook/publications/confirm', body),
  fbCancel: (body) => request('POST', '/studio/facebook/publications/cancel', body),
  fbRefresh: (source, id) => request('POST', `/studio/facebook/publications/refresh${qs({ source, id })}`),

  // --- ORG --- Cơ cấu tổ chức (docs/BA.md mục 15; hợp đồng mục 8)
  orgMe: () => request('GET', '/org/me'),
  orgTree: (params = {}) => request('GET', `/org/tree${qs(params)}`),
  orgUnits: (params = {}) => request('GET', `/org/units${qs(params)}`),
  createOrgUnit: (body) => request('POST', '/org/units', body),
  patchOrgUnit: (id, body) => request('PATCH', `/org/units/${id}`, body),
  orgFunctions: (params = {}) => request('GET', `/org/functions${qs(params)}`),
  createOrgFunction: (body) => request('POST', '/org/functions', body),
  patchOrgFunction: (id, body) => request('PATCH', `/org/functions/${id}`, body),
  orgPeople: (params = {}) => request('GET', `/users${qs({ limit: 2000, ...params })}`),
  patchOrgUser: (id, body) => request('PATCH', `/org/users/${id}`, body),
  offboardUser: (id, body = {}) => request('POST', `/org/users/${id}/offboard`, body),
  orgImport: (file, dryRun = true) => {
    const form = new FormData()
    form.append('file', file)
    return request('POST', `/org/import${qs({ dry_run: dryRun })}`, form)
  },
  orgGrants: (params = {}) => request('GET', `/org/grants${qs(params)}`),
  createOrgGrant: (body) => request('POST', '/org/grants', body),
  revokeOrgGrant: (id) => request('DELETE', `/org/grants/${id}`),
  delegateOrgGrant: (body) => request('POST', '/org/delegations', body),
  orgLevelMap: () => request('GET', '/org/level-map'),
  putOrgLevelMap: (levels) => request('PUT', '/org/level-map', { levels }),
  // --- /ORG ---
  // --- GOV --- Đề xuất thay đổi, phiên bản thẻ (mục 16)
  cardRevisions: (id) => request('GET', `/wiki/cards/${id}/revisions`),
  cardRevision: (id, rev) => request('GET', `/wiki/cards/${id}/revisions/${rev}`),
  cardDiff: (id, from, to) => request('GET', `/wiki/cards/${id}/diff${qs({ from, to })}`),
  rollbackCard: (id, rev, reason) => request('POST', `/wiki/cards/${id}/rollback`, { rev, reason }),
  changes: (params = {}) => request('GET', `/wiki/changes${qs(params)}`),
  change: (id) => request('GET', `/wiki/changes/${id}`),
  createChange: (body) => request('POST', '/wiki/changes', body),
  decideChange: (id, body) => request('POST', `/wiki/changes/${id}/decide`, body),
  rebaseChange: (id) => request('POST', `/wiki/changes/${id}/rebase`),
  withdrawChange: (id, reason = '') => request('POST', `/wiki/changes/${id}/withdraw`, { reason }),
  resubmitChange: (id, body) => request('POST', `/wiki/changes/${id}/resubmit`, body),   // GOV-13 gửi lại đề xuất bị trả về
  overrideNovelty: (id, body) => request('POST', `/wiki/changes/${id}/novelty`, body),
  reviewSettings: () => request('GET', '/wiki/review-settings'),
  saveReviewSettings: (body) => request('PUT', '/wiki/review-settings', body),
  bulkReviewPreview: (body) => request('POST', '/wiki/bulk-review/preview', body),
  bulkReviewDecide: (body) => request('POST', '/wiki/bulk-review/decide', body),
  // --- /GOV ---
  // --- LRN --- Học tập (mục 17)
  lessons: (params = {}) => request('GET', `/learn/lessons${qs(params)}`),
  courses: () => request('GET', '/learn/courses'),
  course: (slug) => request('GET', `/learn/courses/${encodeURIComponent(slug)}`),
  orderCourse: (slug, lesson_ids) => request('PUT', `/learn/courses/${encodeURIComponent(slug)}/order`, { lesson_ids }),
  saveCourseSettings: (slug, body) => request('PUT', `/learn/courses/${encodeURIComponent(slug)}/settings`, body),
  startCourseExam: (slug, assignment_id) => request('POST', `/learn/courses/${encodeURIComponent(slug)}/exam/start?${qs({ assignment_id }).slice(1)}`),
  lesson: (id) => request('GET', `/learn/lessons/${id}`),
  createLesson: (body) => request('POST', '/learn/lessons', body),
  patchLesson: (id, body) => request('PATCH', `/learn/lessons/${id}`, body),
  questions: (params = {}) => request('GET', `/learn/questions${qs(params)}`),
  createQuestion: (body) => request('POST', '/learn/questions', body),
  patchQuestion: (id, body) => request('PATCH', `/learn/questions/${id}`, body),
  startPractice: (lessonId) => request('POST', `/learn/lessons/${lessonId}/practice`),
  saveAnswers: (attemptId, answers) => request('PUT', `/learn/attempts/${attemptId}/answers`, { answers }),
  // auto: trình duyệt tự nộp khi hết giờ (server gắn nhãn *tự nộp*)
  submitAttempt: (attemptId, answers, auto = false) => request('POST', `/learn/attempts/${attemptId}/submit`, answers || auto ? { answers: answers || {}, auto } : undefined),
  // LRN · H — AI thiết kế lộ trình, sinh câu hỏi (BA 17.5, 17.6)
  designOptions: () => request('GET', '/learn/paths/design/options'),
  designDrafts: () => request('GET', '/learn/paths/design/drafts'),
  designPath: (body) => request('POST', '/learn/paths/design', body),
  designDraft: (id) => request('GET', `/learn/paths/${id}/design`),
  saveDesignDraft: (id, body) => request('PUT', `/learn/paths/${id}/design`, body),
  generateQuestions: (cardId, n = 2) => request('POST', '/learn/generate/questions', { card_id: cardId, n }),
  // LRN · I — lộ trình, giao bài, thi, chấm
  paths: (params = {}) => request('GET', `/learn/paths${qs(params)}`),
  path: (id) => request('GET', `/learn/paths/${id}`),
  createPath: (body) => request('POST', '/learn/paths', body),
  copyPath: (id) => request('POST', `/learn/paths/${id}/copy`),
  patchPath: (id, body) => request('PATCH', `/learn/paths/${id}`, body),
  publishPath: (id) => request('POST', `/learn/paths/${id}/publish`),
  assignPath: (id, body) => request('POST', `/learn/paths/${id}/assign`, body),
  myLearning: () => request('GET', '/learn/me'),
  learnCatalog: () => request('GET', '/learn/catalog'),
  enrollPath: (id) => request('POST', `/learn/paths/${id}/enroll`),
  startExam: (assignmentId) => request('POST', `/learn/assignments/${assignmentId}/attempts`, { kind: 'exam' }),
  attempt: (id) => request('GET', `/learn/attempts/${id}`),
  gradingQueue: (inbox = true) => request('GET', `/learn/grading?inbox=${inbox ? 1 : 0}`),
  finalizeAttempt: (id, body) => request('POST', `/learn/attempts/${id}/finalize`, body),
  appealAttempt: (id, body) => request('POST', `/learn/attempts/${id}/appeal`, body),
  // --- /LRN ---
}
