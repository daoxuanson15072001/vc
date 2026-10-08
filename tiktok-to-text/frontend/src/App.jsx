import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { api, setUnauthorizedHandler } from './api'
import { SessionContext } from './session'
import { canonicalUrl, usePageMeta } from './pageMeta'
import { PAGE_ROUTES, ROUTES, matchRoute, routeAllowed } from './routes'
import { Loading, PageBoundary } from './components/ui'
import AppShell from './components/AppShell'
import NotFound from './pages/NotFound'
import { DialogHost } from './components/dialog'
import { ToastHost } from './components/toast'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Knowledge from './pages/Knowledge'
import Refine from './pages/Refine'
import Chat from './pages/Chat'
import RefineLive from './pages/RefineLive'
import Discover from './pages/Discover'
import Wiki from './pages/Wiki'
import WikiGraph from './pages/WikiGraph'
import Playlists from './pages/Playlists'
import Player from './pages/Player'
import Synth from './pages/Synth'
import Leaderboard from './pages/Leaderboard'
import Spaces from './pages/Spaces'
import Admin from './pages/Admin'
import Connect from './pages/Connect'
import Studio from './pages/Studio'
import Campaign from './pages/Campaign'
import QuickWrite, { QuickPiece } from './pages/QuickWrite'
import Authors from './pages/Authors'
import FacebookTargets from './pages/FacebookTargets'
import Projects from './pages/Projects'
import Project from './pages/Project'
// --- ORG ---
import Org from './pages/Org'
// --- /ORG ---
// --- GOV ---
import Review from './pages/Review'
// --- /GOV ---
// --- LRN ---
import LearnLibrary from './pages/learn/Library'
import Guide from './pages/Guide'
import LearnLesson from './pages/learn/Lesson'
import LearnLessonEdit from './pages/learn/library/LessonEdit'
// LRN · H
import LearnDesign from './pages/learn/Design'
// LRN · I — lộ trình, giao bài, thi, chấm
import LearnMy from './pages/learn/MyLearning'
import LearnPaths from './pages/learn/Paths'
import LearnPath from './pages/learn/PathEdit'
import LearnAttempt from './pages/learn/Attempt'
import LearnGrading from './pages/learn/Grading'
// --- /LRN ---

// Trang theo `id` trong routes.js (CMP-00) — routes.js là dữ liệu thuần nên không tự import trang
const PAGES = {
  home: Dashboard, chat: Chat, guide: Guide,
  kb: Knowledge, discover: Discover, refine: Refine, refineLive: RefineLive, wiki: Wiki, wikiGraph: WikiGraph, synth: Synth,
  review: Review, playlists: Playlists, player: Player, leaderboard: Leaderboard,
  projects: Projects, project: Project, quick: QuickWrite, quickPiece: QuickPiece, studio: Studio, authors: Authors,
  facebook: FacebookTargets, campaign: Campaign,
  learnMy: LearnMy, library: LearnLibrary, lesson: LearnLesson, lessonEdit: LearnLessonEdit, design: LearnDesign, paths: LearnPaths, path: LearnPath,
  attempt: LearnAttempt, grading: LearnGrading,
  org: Org, spaces: Spaces, connect: Connect, admin: Admin,
}

// Trang Thư viện component (DESIGN V.9.1) — chỉ khi chạy dev (vite dev, e2e); bản build bỏ hẳn nhánh này
const UiKit = import.meta.env.DEV ? lazy(() => import('./pages/dev/UiKit')) : null

// Phiên đăng nhập: state `session` dưới đây là nguồn duy nhất ở FE (không còn AuthProvider riêng).
// Trang con đọc `user` qua SessionContext (useSession); 401 từ API quay về đây qua setUnauthorizedHandler.
export default function App() {
  const [session, setSession] = useState({ loading: true, user: null, needsSetup: false })
  const checked = useRef(false)

  const check = useCallback(async () => {
    try {
      setSession({ loading: false, user: await api.me(), needsSetup: false })
    } catch {
      const s = await api.setupStatus().catch(() => ({ needs_setup: false }))
      setSession({ loading: false, user: null, needsSetup: s.needs_setup })
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setSession((s) => (s.user ? { ...s, user: null } : s)))
    // Gọi /api/auth/me đúng một lần mỗi lần tải trang (StrictMode chạy effect hai lần khi dev — ref giữ qua lần đó)
    if (checked.current) return
    checked.current = true
    check()
  }, [check])

  // Đang kiểm tra phiên: có chữ thay vì trang trắng để AI agent không tưởng lỗi
  if (session.loading) return <div className="loading login-wrap" role="status" aria-busy="true">Đang kiểm tra phiên đăng nhập…</div>
  if (!session.user) {
    document.title = 'Đăng nhập · VC Content Engine'
    return (
      <>
        <Login needsSetup={session.needsSetup} onDone={(user) => setSession({ loading: false, user, needsSetup: false })} />
        <DialogHost />
        <ToastHost />
      </>
    )
  }
  const user = session.user
  const logout = async () => {
    await api.logout().catch(() => {})
    setSession({ loading: false, user: null, needsSetup: false })
  }

  return (
    <SessionContext.Provider value={{ user }}>
      <AppShell user={user} onLogout={logout}>
        <RouteMeta user={user} />
        <PageBoundary>
          <Routes>
            {PAGE_ROUTES.filter((r) => routeAllowed(r, user)).map((r) => {
              const Page = PAGES[r.id]
              return <Route key={r.path} path={r.path} element={<Page {...r.props} />} />
            })}
            {/* Link cũ: BE trả 301 (SEO-03); đây là dự phòng khi chạy vite dev (không có BE đứng trước FE) */}
            {ROUTES.filter((r) => r.redirect).map((r) => <Route key={r.path} path={r.path} element={<Moved to={r.redirect} />} />)}
            {UiKit && <Route path="/dev/ui" element={<Suspense fallback={<Loading />}><UiKit /></Suspense>} />}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageBoundary>
      </AppShell>
      <DialogHost />
      <ToastHost />
    </SessionContext.Provider>
  )
}

// Meta theo route (SEO-04): tiêu đề tab = tên màn trong routes.js, mô tả trang, canonical (đường dẫn + tham số mở
// đối tượng). Trang đặt thêm tên đối tượng bằng usePageMeta({ object }) hoặc PageHeader có breadcrumb.
function RouteMeta({ user }) {
  const { pathname, search } = useLocation()
  const r = matchRoute(pathname, PAGE_ROUTES.filter((x) => routeAllowed(x, user)))
  const canonical = r ? canonicalUrl(window.location.origin, pathname, search, r.objectKeys) : undefined
  usePageMeta(r ? { title: r.title, description: r.description, canonical } : { title: 'Không tìm thấy trang' })
  return null
}

// Giữ nguyên bộ lọc (?channel=…&v=…) khi chuyển từ đường dẫn cũ
function Moved({ to }) {
  const { search } = useLocation()
  const [path, query = ''] = to.split('?')
  const params = new URLSearchParams(query)
  new URLSearchParams(search).forEach((value, key) => { if (!params.has(key)) params.set(key, value) })
  const suffix = params.toString()
  return <Navigate to={`${path}${suffix ? `?${suffix}` : ''}`} replace />
}
