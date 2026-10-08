// CMP-00 routes.js: nguồn route duy nhất — khớp đường dẫn, quyền, routes.json cho BE (SEO-02)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NAV_GROUPS, PAGE_ROUTES, ROUTES, badgeCount, matchRoute, navActivePath, navMenu, pathPattern, routeAllowed, routesManifest } from './routes.js'

test('mọi route trang có id, path, title, description ≤ 20 từ, scr', () => {
  for (const r of PAGE_ROUTES) {
    assert.ok(r.id && r.path.startsWith('/') && r.title && r.scr, r.path)
    assert.ok(r.description && r.description.split(/\s+/).length <= 20, `${r.path}: mô tả ≤ 20 từ`)
  }
})

test('không trùng đường dẫn', () => {
  const paths = ROUTES.map((r) => r.path)
  assert.equal(new Set(paths).size, paths.length)
})

test('pathPattern: tham số một đoạn, dấu / cuối, *', () => {
  assert.ok(pathPattern('/').test('/'))
  assert.ok(!pathPattern('/').test('/kb'))
  assert.ok(pathPattern('/studio/:id').test('/studio/abc123'))
  assert.ok(pathPattern('/studio/:id').test('/studio/abc123/'))
  assert.ok(!pathPattern('/studio/:id').test('/studio/a/b'))
  assert.ok(pathPattern('/jobs/*').test('/jobs/x/y'))
})

test('matchRoute: route tĩnh thắng route tham số', () => {
  assert.equal(matchRoute('/studio/new').props?.creating, true)
  assert.equal(matchRoute('/studio/quick').id, 'quick')
  assert.equal(matchRoute('/studio/projects').id, 'projects')
  assert.equal(matchRoute('/studio/66f0c1').id, 'campaign')
  assert.equal(matchRoute('/studio/quick/66f0c1').id, 'quickPiece')
  assert.equal(matchRoute('/kb/videos').props.tab, 'videos')
  assert.equal(matchRoute('/khong-co'), null)
})

test('SCR-16: soạn / sửa bài học là route riêng, mục menu Thư viện bài học sáng', () => {
  assert.equal(matchRoute('/learn/lessons/new').id, 'lessonEdit')
  assert.equal(matchRoute('/learn/lessons/new').props?.creating, true)
  assert.equal(matchRoute('/learn/lessons/66f0c1/edit').id, 'lessonEdit')
  assert.equal(matchRoute('/learn/lessons/66f0c1/edit').props, undefined)
  assert.equal(matchRoute('/learn/lessons/66f0c1').id, 'lesson')
  for (const p of ['/learn/lessons/new', '/learn/lessons/66f0c1/edit']) assert.equal(navActivePath(p), '/learn/library')
})

test('SCR-16.1: lộ trình chuyển vào tab Thư viện, link cũ không còn trên menu', () => {
  assert.equal(ROUTES.find((r) => r.path === '/learn/paths').redirect, '/learn/library?tab=paths')
  assert.equal(PAGE_ROUTES.some((r) => r.path === '/learn/paths'), false)
  assert.equal(navActivePath('/learn/paths/66f0c1'), '/learn/library')
  assert.equal(navActivePath('/learn/design'), '/learn/library')
})

test('routeAllowed: admin, cờ quyền', () => {
  const admin = PAGE_ROUTES.find((r) => r.path === '/admin')
  const grading = PAGE_ROUTES.find((r) => r.path === '/learn/grading')
  assert.equal(routeAllowed(admin, { role: 'member' }), false)
  assert.equal(routeAllowed(admin, { role: 'admin' }), true)
  assert.equal(routeAllowed(grading, { role: 'member' }), false)
  assert.equal(routeAllowed(grading, { role: 'member', can_grade: true }), true)
})

test('routesManifest: chỉ path / title / description / public, không có link cũ', () => {
  const m = routesManifest()
  assert.equal(m.length, PAGE_ROUTES.length)
  for (const r of m) assert.deepEqual(Object.keys(r).sort(), ['description', 'path', 'public', 'title'])
  assert.ok(!m.some((r) => r.path === '/videos'))
  assert.equal(m.find((r) => r.path === '/kb/videos').title, 'Video · Kho tư liệu')
})

// ---- Menu chính (DESIGN V.3.1, SCR-00) ----
const labels = (m) => [m.top.map((i) => i.label), ...m.groups.map((g) => [g.name, ...g.items.map((i) => i.label)]), m.bottom.map((i) => i.label)]

test('tiêu đề đổi: / = Việc của tôi, /studio* = Chiến dịch', () => {
  assert.equal(matchRoute('/').title, 'Việc của tôi')
  for (const p of ['/studio', '/studio/new', '/studio/66f0c1']) assert.equal(matchRoute(p).title, 'Chiến dịch')
})

test('navMenu: thành viên thường — 4 nhóm, không Lộ trình / Chấm bài / Người dùng & lĩnh vực', () => {
  assert.deepEqual(labels(navMenu({ role: 'member' })), [
    ['Việc của tôi'],
    ['Tri thức', 'Kho tư liệu', 'VCWIKI', 'Hộp duyệt'],
    ['Nội dung', 'Dự án marketing', 'Viết nhanh', 'Chiến dịch', 'Cài đặt nội dung'],
    ['Học tập', 'Học tập của tôi', 'Thư viện bài học'],
    ['Tổ chức', 'Cơ cấu tổ chức', 'Kho & chia sẻ', 'Kết nối AI'],
    ['Trò chuyện Claude', 'Hướng dẫn'],
  ])
})

test('navMenu: cờ can_design / can_grade / admin mở thêm mục', () => {
  const m = navMenu({ role: 'admin', can_design: true, can_grade: true })
  assert.deepEqual(m.groups.find((g) => g.name === 'Học tập').items.map((i) => i.label),
    ['Học tập của tôi', 'Thư viện bài học', 'Chấm bài'])
  assert.equal(m.groups.find((g) => g.name === 'Tổ chức').items.at(-1).label, 'Người dùng & lĩnh vực')
  assert.deepEqual(m.groups.map((g) => g.name), NAV_GROUPS.map((g) => g.name))
})

test('mọi mục menu có icon, trang có nav là route kind menu', () => {
  for (const r of PAGE_ROUTES.filter((x) => x.nav)) assert.ok(r.nav.icon && r.kind === 'menu', r.path)
})

test('navActivePath: route con làm sáng mục cha', () => {
  const cases = { '/': '/', '/wiki/graph': '/wiki', '/playlists': '/wiki', '/playlists/abc': '/wiki', '/leaderboard': '/wiki',
    '/wiki/synth/x': '/wiki', '/wiki/review': '/wiki/review', '/refine': '/kb', '/refine/live': '/kb', '/discover': '/kb',
    '/kb/videos': '/kb', '/learn/design': '/learn/library', '/learn/paths/x': '/learn/library', '/learn/lessons/x': '/learn/library',
    '/learn/attempts/x': '/learn', '/studio/new': '/studio', '/studio/66f0c1': '/studio', '/studio/facebook': '/studio/authors',
    '/studio/quick/66f0c1': '/studio/quick', '/chat/abc': '/chat', '/khong-co': null }
  for (const [path, want] of Object.entries(cases)) assert.equal(navActivePath(path), want, path)
})

test('badgeCount: tổng, từng khoá, thiếu số liệu = 0', () => {
  const c = { review: 3, learn_due: 2, learn_next_due: '2026-10-03T00:00:00Z', grading: 1, content_fix: 1, sources_error: 0 }
  assert.equal(badgeCount(c, 'total'), 7)
  assert.equal(badgeCount(c, 'review'), 3)
  assert.equal(badgeCount(c, 'grading'), 1)
  assert.equal(badgeCount(null, 'total'), 0)
  assert.equal(badgeCount({}, 'review'), 0)
  assert.equal(badgeCount(c, null), 0)
})
