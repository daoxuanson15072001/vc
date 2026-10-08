// SCR-00 Vỏ ứng dụng (DESIGN V.7, CMP-21): menu 5 nhóm theo quyền, mục cha sáng ở route con, huy hiệu số việc,
// menu tài khoản bàn phím, thanh dưới + ngăn kéo Thêm trên điện thoại.
import { test, expect, nav, uid, createUser, pageAs } from './fixtures'

const menu = (page) => page.locator('.sidebar nav')
const COUNTS = { review: 3, learn_due: 2, learn_next_due: '2026-10-03T00:00:00Z', grading: 1, content_fix: 1, sources_error: 0,
  updated_at: '2026-09-30T10:00:00Z' }
const stubCounts = (page, body = COUNTS, status = 200) =>
  page.route('**/api/me/inbox/counts', (r) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }))

test('quản trị viên: menu có Việc của tôi + 4 nhóm h2 + Trò chuyện / Hướng dẫn, biểu tượng SVG', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Menu chính' })).toBeVisible()
  const groups = menu(page).getByRole('heading', { level: 2 })
  await expect(groups).toHaveText(['Tri thức', 'Nội dung', 'Học tập', 'Tổ chức'])
  for (const name of ['Việc của tôi', 'Kho tư liệu', 'VCWIKI', 'Hộp duyệt', 'Dự án marketing', 'Viết nhanh', 'Chiến dịch',
    'Cài đặt nội dung', 'Học tập của tôi', 'Thư viện bài học', 'Cơ cấu tổ chức', 'Kho & chia sẻ', 'Kết nối AI',
    'Người dùng & lĩnh vực', 'Trò chuyện Claude', 'Hướng dẫn']) {
    await expect(nav(page, name).first()).toBeVisible()
  }
  // mục đã gộp vào tab không còn trên menu
  for (const name of ['Bản đồ tri thức', 'Danh sách phát', 'Bình chọn tháng', 'Tiến độ tinh chế', 'Tìm video theo chủ đề', 'Kênh Facebook']) {
    await expect(nav(page, name)).toHaveCount(0)
  }
  await expect(menu(page).locator('a svg.ui-icon').first()).toBeVisible()
  await expect(page.locator('.sidebar .brand svg')).toBeVisible()
})

test('thành viên thường: không thấy Người dùng & lĩnh vực, Lộ trình học, Chấm bài', async ({ page, browser }) => {
  const u = { email: `vo-${uid()}@e2e.test`, name: 'Thành viên vỏ', password: 'matkhau-vo-123' }
  await page.goto('/')
  await createUser(page, u)
  const p = await pageAs(browser, u)
  await expect(nav(p, 'Việc của tôi')).toBeVisible()
  await expect(menu(p).getByRole('heading', { level: 2 })).toHaveText(['Tri thức', 'Nội dung', 'Học tập', 'Tổ chức'])
  for (const name of [/Người dùng & lĩnh vực/, /Lộ trình học/, /Chấm bài/]) await expect(nav(p, name)).toHaveCount(0)
  await expect(nav(p, 'Học tập của tôi')).toBeVisible()
  await p.context().close()
})

test('route con làm sáng mục cha trên menu', async ({ page }) => {
  const cases = [
    ['/wiki/graph', 'VCWIKI'], ['/playlists', 'VCWIKI'], ['/leaderboard', 'VCWIKI'],
    ['/refine', 'Kho tư liệu'], ['/discover', 'Kho tư liệu'], ['/kb/videos', 'Kho tư liệu'],
    ['/studio/new', 'Chiến dịch'], ['/studio/facebook', 'Cài đặt nội dung'], ['/wiki/review', 'Hộp duyệt'],
  ]
  for (const [url, label] of cases) {
    await page.goto(url)
    const link = nav(page, label)
    await expect(link, url).toHaveClass(/active/)
    await expect(menu(page).locator('a.active')).toHaveCount(1)
  }
  await page.goto('/wiki')
  await expect(nav(page, 'VCWIKI')).toHaveAttribute('aria-current', 'page')
  await page.goto('/wiki/graph')
  await expect(nav(page, 'VCWIKI')).not.toHaveAttribute('aria-current', 'page')
})

test('huy hiệu số việc: chữ cho máy đọc; API lỗi / chưa có thì không hiện', async ({ page }) => {
  await stubCounts(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Hộp duyệt, 3 việc chờ' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Việc của tôi, 7 việc chờ' }).first()).toBeVisible()
  await expect(menu(page).getByTestId('nav-badge').first()).toBeVisible()
  // không có việc thì không có chữ "0 việc chờ"
  await expect(page.getByRole('link', { name: /Kết nối AI, / })).toHaveCount(0)

  await page.unroute('**/api/me/inbox/counts')
  await stubCounts(page, { detail: 'Not Found' }, 404)
  await page.reload()
  await expect(nav(page, 'Việc của tôi')).toBeVisible()
  await expect(page.getByTestId('nav-badge')).toHaveCount(0)
  // Vỏ không báo lỗi (trang Việc của tôi tự báo lỗi ở khối việc — SCR-01, xem home.spec.js)
  await expect(page.locator('.sidebar .error-box')).toHaveCount(0)
})

test('menu tài khoản: bàn phím, Esc trả tiêu điểm; giữ công tắc giao diện, đổi mật khẩu, đăng xuất', async ({ page }) => {
  await page.goto('/')
  const btn = page.getByTestId('user-menu')
  await expect(btn).toHaveAttribute('aria-haspopup', 'menu')
  await expect(btn).toHaveAttribute('aria-expanded', 'false')
  await btn.focus()
  await page.keyboard.press('Enter')
  await expect(btn).toHaveAttribute('aria-expanded', 'true')
  const account = page.getByRole('menu', { name: 'Tài khoản' })
  await expect(account).toBeVisible()
  await expect(account.getByRole('menuitem')).toHaveText([/Đổi mật khẩu/, /Đăng xuất/])
  await expect(account.getByRole('menuitem', { name: 'Đổi mật khẩu' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('logout')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(account.getByRole('menuitem', { name: 'Đổi mật khẩu' })).toBeFocused()
  await expect(page.getByRole('radiogroup', { name: 'Giao diện' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(account).toHaveCount(0)
  await expect(btn).toBeFocused()
  await expect(btn).toHaveAttribute('aria-expanded', 'false')

  // Đổi mật khẩu là form trong hộp thoại; Esc đóng và trả tiêu điểm về nút tài khoản
  await btn.click()
  await page.getByRole('menuitem', { name: 'Đổi mật khẩu' }).click()
  const dlg = page.getByRole('dialog', { name: 'Đổi mật khẩu' })
  await expect(dlg).toBeVisible()
  await expect(dlg.getByPlaceholder('Mật khẩu hiện tại')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dlg).toHaveCount(0)
  await expect(btn).toBeFocused()

  // bấm ra ngoài thì đóng
  await btn.click()
  await expect(account).toBeVisible()
  await page.locator('main').click({ position: { x: 5, y: 5 } })
  await expect(account).toHaveCount(0)
})

test('điện thoại 390 px: thanh dưới 5 nút, ngăn kéo Thêm chứa menu đầy đủ, Hỏi Claude nổi trên thanh dưới', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await stubCounts(page)
  await page.goto('/')
  await expect(page.locator('.sidebar')).toBeHidden()
  const bar = page.getByRole('navigation', { name: 'Menu nhanh' })
  await expect(bar).toBeVisible()
  await expect(bar.locator('a, button')).toHaveText([/Việc của tôi/, /Tri thức/, /Nội dung/, /Học tập/, /Thêm/])
  for (const el of await bar.locator('a, button').all()) expect((await el.boundingBox()).height).toBeGreaterThanOrEqual(44)
  await expect(bar.getByRole('link', { name: 'Việc của tôi, 7 việc chờ' })).toBeVisible()
  await expect(bar.getByRole('link', { name: /Việc của tôi/ })).toHaveClass(/active/)

  // nút Hỏi Claude nổi trên thanh dưới, không đè lên
  const fab = page.getByRole('button', { name: 'Hỏi Claude', exact: true })
  const [fb, bb] = [await fab.boundingBox(), await bar.boundingBox()]
  expect(fb.y + fb.height).toBeLessThanOrEqual(bb.y)
  expect(fb.height).toBeGreaterThanOrEqual(44)

  // Tri thức -> trang đầu nhóm
  await bar.getByRole('link', { name: 'Tri thức' }).click()
  await expect(page).toHaveURL(/\/kb$/)
  await expect(bar.getByRole('link', { name: /Tri thức/ })).toHaveClass(/active/)

  // Thêm -> ngăn kéo menu đầy đủ
  const more = page.getByTestId('bottombar-more')
  await more.click()
  const drawer = page.getByRole('dialog', { name: 'Menu' })
  await expect(drawer).toBeVisible()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await expect(drawer.getByRole('heading', { level: 2, name: 'Tổ chức' })).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Hộp duyệt, 3 việc chờ' })).toBeVisible()
  await expect(drawer.getByTestId('user-menu')).toBeVisible()
  await drawer.getByRole('link', { name: 'Kho & chia sẻ' }).click()
  await expect(page).toHaveURL(/\/spaces$/)
  await expect(drawer).toHaveCount(0)

  // Esc đóng ngăn kéo, trả tiêu điểm về nút Thêm
  await more.click()
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(more).toBeFocused()
})
