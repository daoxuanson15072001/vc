import { test, expect, ADMIN, login, createUser, uid, nav, pageAs } from './fixtures'

test.describe('Đăng nhập', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('sai mật khẩu báo lỗi, đúng thì vào được, đăng xuất quay về màn đăng nhập', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()

    await page.getByLabel('Email').fill(ADMIN.email)
    await page.getByLabel('Mật khẩu').fill('sai-mat-khau')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.locator('.error-box')).toBeVisible()
    await expect(page.locator('.sidebar')).toHaveCount(0)

    await page.getByLabel('Mật khẩu').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.getByRole('heading', { name: /Tổng quan|Việc của tôi/ })).toBeVisible()

    // Tải lại trang vẫn giữ phiên
    await page.reload()
    await expect(page.getByRole('heading', { name: /Tổng quan|Việc của tôi/ })).toBeVisible()

    await page.locator('.user-btn').click()
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click()
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
  })

  test('tải trang chỉ gọi /api/auth/me một lần; phiên bị xoá thì lần gọi API sau quay về màn đăng nhập', async ({ page }) => {
    await login(page, ADMIN)
    const me = []
    page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/auth/me') me.push(r.url()) })
    await page.reload()
    await expect(page.getByRole('heading', { name: /Tổng quan|Việc của tôi/ })).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(me).toHaveLength(1)

    // Phiên mất phía máy chủ (đăng xuất ở thiết bị khác): API trả 401 -> một nguồn phiên duy nhất đưa về màn đăng nhập
    await page.context().clearCookies()
    await page.goto('/wiki')
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
  })

  test('chưa đăng nhập thì API trả 401', async ({ request }) => {
    expect((await request.get('/api/stats')).status()).toBe(401)
  })
})

test('đổi mật khẩu rồi đăng nhập lại bằng mật khẩu mới', async ({ page, browser }) => {
  const u = { email: `doimk-${uid()}@e2e.test`, name: 'Người đổi MK', password: 'matkhau-cu-1' }
  await page.goto('/')
  await createUser(page, u)

  const p = await pageAs(browser, u)
  await p.locator('.user-btn').click()
  await p.getByRole('menuitem', { name: 'Đổi mật khẩu' }).click()
  await p.getByPlaceholder('Mật khẩu hiện tại').fill(u.password)
  await p.getByPlaceholder(/Mật khẩu mới/).fill('matkhau-moi-2')
  await p.getByLabel('Nhập lại mật khẩu mới').fill('matkhau-moi-2')   // UI-3: form ChangePassword có ô nhập lại
  await p.getByRole('button', { name: 'Lưu' }).click()
  await expect(p.getByText('Đã đổi mật khẩu')).toBeVisible()
  await p.locator('.user-btn').click()
  await p.getByRole('menuitem', { name: 'Đăng xuất' }).click()

  await login(p, { email: u.email, password: 'matkhau-moi-2' })
  // Thành viên thường không thấy mục Quản trị
  await expect(nav(p, /Người dùng & lĩnh vực/)).toHaveCount(0)
  // Gõ thẳng /admin: không có trang này với thành viên thường (SEO-02 — trước UI-1 là tự về Tổng quan)
  await p.goto('/admin')
  await expect(p.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' })).toBeVisible()
  await p.context().close()
})
