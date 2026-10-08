// Nguồn route duy nhất (DESIGN V.3.2 CMP-00): App.jsx dựng <Routes> từ đây, vỏ lấy tiêu đề tab + mô tả trang
// (usePageMeta), build ghi dist/routes.json cho BE (404 thật SEO-02, /llms.txt AIX-21).
// Dữ liệu thuần, KHÔNG import trang — Node (plugin Vite, npm test) phải đọc được file này. Trang gắn qua bảng PAGES
// trong App.jsx theo `id`.
//
// Trường:
//   id          khoá trang trong PAGES (App.jsx); nhiều route có thể dùng chung một trang (props khác nhau)
//   path        đường dẫn react-router (`:id` là tham số)
//   title       tên màn = h1 = tiêu đề tab (màn mục menu); trang đối tượng: tên mục menu cha (tên đối tượng do trang đặt)
//   description một câu ≤ 20 từ (meta description, /llms.txt)
//   group       nhóm menu theo DESIGN V.3.1 (NAV_GROUPS), null = mục cố định
//   kind        'menu' màn mục menu · 'tab' tab con của một màn · 'object' trang đối tượng /…/:id · 'flow' luồng tạo
//   parent      id route cha (tab con, trang đối tượng) — breadcrumb, mục menu sáng
//   need        cờ quyền trong /auth/me (can_design, can_grade) — chỉ ẩn menu / route, API vẫn tự kiểm quyền
//   admin       chỉ quản trị viên
//   objectKeys  tham số query mở đối tượng trong Drawer/Modal (giữ lại trong canonical)
//   props       props truyền cho trang (một trang dùng cho nhiều route)
//   nav         mục menu chính (chỉ route kind 'menu'): { order, icon, label?, badge?, slot? } —
//               order thứ tự trong nhóm; icon tên trong components/icons.jsx; label chữ trên menu nếu khác title;
//               badge 'total' | 'review' | 'grading' = số việc từ /api/me/inbox/counts; slot 'bottom' = mục cố định dưới cùng.
//               Route không có nav (tab, trang đối tượng, mục đã gộp vào tab) làm sáng mục menu của route cha (`parent`).
//   scr         mã màn DESIGN Phần V mục 7
//   redirect    link cũ: BE trả 301 (SEO-03); FE chuyển hướng dự phòng khi chạy vite dev

export const APP_NAME = 'VC Content Engine'

export const ROUTES = [
  // --- Cố định ---
  { id: 'home', path: '/', title: 'Việc của tôi', group: null, kind: 'menu', scr: 'SCR-01', nav: { order: 0, icon: 'inbox', badge: 'total' },
    description: 'Việc chờ bạn hôm nay và số liệu kho: nguồn, thẻ VCWIKI, video' },
  { id: 'chat', path: '/chat', title: 'Trò chuyện Claude', group: null, kind: 'menu', scr: 'SCR-22', nav: { order: 1, icon: 'sparkles', slot: 'bottom' },
    description: 'Hỏi Claude về tri thức trong kho, lưu lại cuộc trò chuyện' },
  { id: 'chat', path: '/chat/:id', title: 'Trò chuyện Claude', group: null, kind: 'object', parent: '/chat', scr: 'SCR-22',
    description: 'Một cuộc trò chuyện với Claude' },
  { id: 'guide', path: '/guide', title: 'Hướng dẫn sử dụng', group: null, kind: 'menu', scr: 'SCR-23', nav: { order: 2, icon: 'help', label: 'Hướng dẫn', slot: 'bottom' },
    description: 'Cách dùng VC Content Engine từng bước, có bản Markdown cho AI' },

  // --- Tri thức ---
  { id: 'kb', path: '/kb', title: 'Kho tư liệu', group: 'Tri thức', kind: 'menu', scr: 'SCR-03', nav: { order: 0, icon: 'inbox' }, props: { tab: 'sources' },
    objectKeys: ['source'], description: 'Nạp link, file, ghi âm; theo dõi chuyển chữ và dựng thẻ' },
  { id: 'kb', path: '/kb/videos', title: 'Kho tư liệu', tab: 'Video', group: 'Tri thức', kind: 'tab', parent: '/kb', scr: 'SCR-03',
    props: { tab: 'videos' }, objectKeys: ['v'], description: 'Video mạng xã hội đã nạp: lượt xem, chữ, trạng thái' },
  { id: 'kb', path: '/kb/channels', title: 'Kho tư liệu', tab: 'Kênh', group: 'Tri thức', kind: 'tab', parent: '/kb', scr: 'SCR-03',
    props: { tab: 'channels' }, description: 'Kênh mạng xã hội đang theo dõi' },
  { id: 'kb', path: '/kb/notes', title: 'Kho tư liệu', tab: 'Ghi chép', group: 'Tri thức', kind: 'tab', parent: '/kb', scr: 'SCR-03',
    props: { tab: 'notes' }, description: 'Ghi chép của người dùng theo nguồn và từng tài liệu' },
  { id: 'discover', path: '/discover', title: 'Tìm video theo chủ đề', group: 'Tri thức', kind: 'menu', parent: '/kb', scr: 'SCR-05',
    description: 'Tìm video mạng xã hội theo chủ đề rồi nạp vào kho' },
  { id: 'refine', path: '/refine', title: 'Kho tư liệu', tab: 'Tiến độ tinh chế', group: 'Tri thức', kind: 'tab', parent: '/kb', scr: 'SCR-04',
    description: 'Tài liệu chờ tinh chế thành thẻ VCWIKI và tiến độ theo kho' },
  { id: 'refineLive', path: '/refine/live', title: 'Kho tư liệu', tab: 'Tiến độ tinh chế', group: 'Tri thức', kind: 'tab', parent: '/refine', scr: 'SCR-04',
    description: 'Theo dõi AI tinh chế tài liệu theo thời gian thực' },
  { id: 'wiki', path: '/wiki', title: 'VCWIKI', group: 'Tri thức', kind: 'menu', scr: 'SCR-06', nav: { order: 1, icon: 'book' }, objectKeys: ['card'],
    description: 'Thẻ tri thức đã chắt lọc từ Kho tư liệu, có dẫn nguồn' },
  { id: 'wikiGraph', path: '/wiki/graph', title: 'Bản đồ tri thức', group: 'Tri thức', kind: 'tab', parent: '/wiki', scr: 'SCR-07',
    description: 'Đồ thị liên kết giữa các thẻ VCWIKI theo chủ đề' },
  { id: 'synth', path: '/wiki/synth/:id', title: 'Tổng hợp VCWIKI', group: 'Tri thức', kind: 'object', parent: '/wiki', scr: 'SCR-08',
    description: 'Một lượt tổng hợp nhiều tài liệu thành thẻ' },
  { id: 'review', path: '/wiki/review', title: 'Hộp duyệt', group: 'Tri thức', kind: 'menu', scr: 'SCR-09', nav: { order: 2, icon: 'check-square', badge: 'review' }, objectKeys: ['change'],
    description: 'Đề xuất sửa thẻ VCWIKI chờ bạn duyệt' },
  { id: 'playlists', path: '/playlists', title: 'Danh sách phát', group: 'Tri thức', kind: 'tab', parent: '/wiki', scr: 'SCR-10',
    description: 'Danh sách video và thẻ để xem hoặc nghe liền mạch' },
  { id: 'player', path: '/playlists/:id', title: 'Danh sách phát', group: 'Tri thức', kind: 'object', parent: '/playlists', scr: 'SCR-10',
    description: 'Phát một danh sách phát' },
  { id: 'leaderboard', path: '/leaderboard', title: 'Bình chọn tháng', group: 'Tri thức', kind: 'tab', parent: '/wiki', scr: 'SCR-06',
    description: 'Thẻ và người đóng góp được bình chọn nhiều nhất trong tháng' },

  // --- Nội dung (Content Engine) ---
  { id: 'projects', path: '/studio/projects', title: 'Dự án marketing', group: 'Nội dung', kind: 'menu', scr: 'SCR-11', nav: { order: 0, icon: 'folder' },
    description: 'Dự án marketing bốn cấp: mục tiêu, kế hoạch, chiến dịch, bài' },
  { id: 'project', path: '/studio/projects/:id', title: 'Dự án marketing', group: 'Nội dung', kind: 'object', parent: '/studio/projects',
    scr: 'SCR-11', description: 'Một dự án marketing' },
  { id: 'quick', path: '/studio/quick', title: 'Viết nhanh', group: 'Nội dung', kind: 'menu', scr: 'SCR-13', nav: { order: 1, icon: 'zap' },
    description: 'Viết nhanh một bài từ tri thức VCWIKI, có chấm điểm' },
  { id: 'quickPiece', path: '/studio/quick/:id', title: 'Viết nhanh', group: 'Nội dung', kind: 'object', parent: '/studio/quick',
    scr: 'SCR-13', description: 'Một bài viết nhanh' },
  { id: 'studio', path: '/studio', title: 'Chiến dịch', group: 'Nội dung', kind: 'menu', scr: 'SCR-12', nav: { order: 2, icon: 'megaphone' },
    description: 'Chiến dịch nội dung nhiều kênh: kịch bản, bài, duyệt, xuất' },
  { id: 'studio', path: '/studio/new', title: 'Chiến dịch', group: 'Nội dung', kind: 'flow', parent: '/studio', scr: 'SCR-12',
    props: { creating: true }, description: 'Tạo chiến dịch mới theo từng bước' },
  { id: 'authors', path: '/studio/authors', title: 'Người đứng tên', group: 'Nội dung', kind: 'menu', scr: 'SCR-14', nav: { order: 3, icon: 'users', label: 'Cài đặt nội dung' },
    description: 'Người đứng tên bài viết: giọng văn, chức danh, ảnh' },
  { id: 'facebook', path: '/studio/facebook', title: 'Kênh Facebook', group: 'Nội dung', kind: 'tab', parent: '/studio/authors', scr: 'SCR-14',
    description: 'Fanpage và nhóm Facebook dùng để đăng bài' },
  // Đặt sau các route /studio/<chữ> ở trên — react-router tự xếp route tĩnh trước route tham số
  { id: 'campaign', path: '/studio/:id', title: 'Chiến dịch', group: 'Nội dung', kind: 'object', parent: '/studio', scr: 'SCR-12',
    description: 'Một chiến dịch nội dung' },

  // --- Học tập ---
  { id: 'learnMy', path: '/learn', title: 'Học tập của tôi', group: 'Học tập', kind: 'menu', scr: 'SCR-15', nav: { order: 0, icon: 'graduation' },
    description: 'Bài học và lộ trình được giao cho bạn, hạn và tiến độ' },
  { id: 'library', path: '/learn/library', title: 'Thư viện bài học', group: 'Học tập', kind: 'menu', scr: 'SCR-16', nav: { order: 1, icon: 'book' },
    objectKeys: ['q'],
    description: 'Bài học dựng từ VCWIKI, xếp theo cây chủ đề' },
  { id: 'lesson', path: '/learn/lessons/:id', title: 'Thư viện bài học', group: 'Học tập', kind: 'object', parent: '/learn/library',
    scr: 'SCR-16', description: 'Một bài học' },
  // Soạn / sửa bài học là trang riêng (không thay danh sách tại chỗ); /new tĩnh nên thắng /:id
  { id: 'lessonEdit', path: '/learn/lessons/new', title: 'Thư viện bài học', group: 'Học tập', kind: 'flow', parent: '/learn/library',
    scr: 'SCR-16', props: { creating: true }, description: 'Soạn bài học mới từ thẻ VCWIKI đã duyệt' },
  { id: 'lessonEdit', path: '/learn/lessons/:id/edit', title: 'Thư viện bài học', group: 'Học tập', kind: 'object', parent: '/learn/library',
    scr: 'SCR-16', description: 'Sửa bản nháp một bài học' },
  { id: 'design', path: '/learn/design', title: 'Thiết kế lộ trình', group: 'Học tập', kind: 'flow', parent: '/learn/library',
    need: 'can_design', scr: 'SCR-16', description: 'Dựng lộ trình học từ thẻ VCWIKI theo từng bước' },
  { id: 'paths', path: '/learn/paths', title: 'Lộ trình học', kind: 'redirect', redirect: '/learn/library?tab=paths' },
  { id: 'path', path: '/learn/paths/:id', title: 'Lộ trình học', group: 'Học tập', kind: 'object', parent: '/learn/library',
    scr: 'SCR-16', description: 'Một lộ trình học' },
  { id: 'attempt', path: '/learn/attempts/:id', title: 'Làm bài', group: 'Học tập', kind: 'object', parent: '/learn', scr: 'SCR-17',
    description: 'Một lượt làm bài thi' },
  { id: 'grading', path: '/learn/grading', title: 'Chấm bài', group: 'Học tập', kind: 'menu', need: 'can_grade', scr: 'SCR-17', nav: { order: 3, icon: 'check-circle', badge: 'grading' },
    objectKeys: ['attempt'], description: 'Bài thi tự luận chờ bạn chấm điểm' },

  // --- Tổ chức ---
  { id: 'org', path: '/org', title: 'Cơ cấu tổ chức', group: 'Tổ chức', kind: 'menu', scr: 'SCR-18', nav: { order: 0, icon: 'building' },
    description: 'Đơn vị, chức danh, nhân sự và nhật ký truy cập' },
  { id: 'spaces', path: '/spaces', title: 'Kho & chia sẻ', group: 'Tổ chức', kind: 'menu', scr: 'SCR-19', nav: { order: 1, icon: 'lock' },
    description: 'Kho dữ liệu, thành viên và quyền chia sẻ' },
  { id: 'connect', path: '/connect', title: 'Kết nối AI', group: 'Tổ chức', kind: 'menu', scr: 'SCR-20', nav: { order: 2, icon: 'link' },
    description: 'Token để Claude Desktop, Claude Code dùng dữ liệu qua MCP' },
  { id: 'admin', path: '/admin', title: 'Người dùng & lĩnh vực', group: 'Tổ chức', kind: 'menu', admin: true, scr: 'SCR-21', nav: { order: 3, icon: 'key' },
    description: 'Tài khoản người dùng, vai trò và cây lĩnh vực' },

  // --- Link cũ (SEO-03): BE trả 301, giữ query ---
  { path: '/videos', redirect: '/kb/videos' },
  { path: '/channels', redirect: '/kb/channels' },
  { path: '/jobs', redirect: '/kb' },
  { path: '/jobs/*', redirect: '/kb' },
]

// Chỉ các route là trang thật (không phải link cũ)
export const PAGE_ROUTES = ROUTES.filter((r) => !r.redirect)

// Route có được hiện với người dùng này không (quyền chỉ ẩn giao diện; API tự kiểm quyền)
export function routeAllowed(route, user) {
  if (!user) return !!route.public
  if (route.admin && user.role !== 'admin') return false
  if (route.need && !user[route.need]) return false
  return true
}

// Biên dịch mẫu react-router thành regex: `:id` khớp một đoạn, `*` khớp phần còn lại; bỏ qua `/` cuối
export function pathPattern(path) {
  if (path === '/') return /^\/?$/
  const body = path.replace(/\/$/, '').split('/').map((seg) => {
    if (seg === '*') return '.*'
    if (seg.startsWith(':')) return '[^/]+'
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('/')
  return new RegExp(`^${body}/?$`)
}

// Route khớp đường dẫn: ưu tiên route tĩnh (ít tham số) trước — /studio/new thắng /studio/:id
export function matchRoute(pathname, routes = PAGE_ROUTES) {
  const hits = routes.filter((r) => pathPattern(r.path).test(pathname))
  hits.sort((a, b) => (a.path.split(':').length - b.path.split(':').length) || (b.path.length - a.path.length))
  return hits[0] || null
}

export function routeByPath(path) {
  return PAGE_ROUTES.find((r) => r.path === path) || null
}

// Dòng cho dist/routes.json (BE đọc — không lộ gì ngoài đường dẫn, tên, mô tả)
export function routesManifest() {
  return PAGE_ROUTES.map((r) => ({ path: r.path, title: r.tab ? `${r.tab} · ${r.title}` : r.title,
    description: r.description, public: !!r.public }))
}

// ---------------------------------------------------------------------------------------------------------------
// Menu chính (DESIGN V.3.1, SCR-00 CMP-21) — dựng từ trường `nav`. Dữ liệu thuần để `npm test` chạy được.

// Nhóm menu theo thứ tự; icon dùng cho thanh dưới điện thoại (3.4)
export const NAV_GROUPS = [
  { name: 'Tri thức', icon: 'book' },
  { name: 'Nội dung', icon: 'pencil' },
  { name: 'Học tập', icon: 'graduation' },
  { name: 'Tổ chức', icon: 'building' },
]

const NAV_ROUTES = PAGE_ROUTES.filter((r) => r.nav)
const byOrder = (a, b) => a.nav.order - b.nav.order

const navItem = (r) => ({ path: r.path, id: r.id, label: r.nav.label || r.title, icon: r.nav.icon, badge: r.nav.badge || null })

// Menu cho người dùng này: { top: [mục cố định trên], groups: [{ name, icon, items }], bottom: [mục cố định dưới] }
// Quyền chỉ ẩn mục (API tự kiểm quyền); nhóm rỗng bị bỏ.
export function navMenu(user) {
  const ok = NAV_ROUTES.filter((r) => routeAllowed(r, user))
  const fixed = (slot) => ok.filter((r) => !r.group && (r.nav.slot || 'top') === slot).sort(byOrder).map(navItem)
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: ok.filter((r) => r.group === g.name).sort(byOrder).map(navItem) }))
    .filter((g) => g.items.length)
  return { top: fixed('top'), groups, bottom: fixed('bottom') }
}

// Đường dẫn của mục menu đang sáng khi ở `pathname`: đi ngược chuỗi `parent` từ route khớp cho tới route có `nav`
// (vd /wiki/graph, /playlists/:id → /wiki; /refine/live, /discover → /kb). null nếu không thuộc mục nào.
export function navActivePath(pathname) {
  let r = matchRoute(pathname)
  for (let i = 0; r && i < 6; i++) {
    if (r.nav) return r.path
    r = r.parent ? routeByPath(r.parent) : null
  }
  return null
}

// Số hiện trên huy hiệu: 'total' = tổng mọi loại việc chờ (chỉ cộng khoá số), còn lại = một khoá của /me/inbox/counts.
// Trả 0 khi chưa có số liệu (API lỗi / chưa có) — giao diện không hiện huy hiệu.
export function badgeCount(counts, key) {
  if (!counts || typeof counts !== 'object' || !key) return 0
  if (key === 'total') {
    return ['review', 'learn_due', 'grading', 'content_fix', 'sources_error']
      .reduce((n, k) => n + (Number.isFinite(counts[k]) ? counts[k] : 0), 0)
  }
  return Number.isFinite(counts[key]) ? counts[key] : 0
}
