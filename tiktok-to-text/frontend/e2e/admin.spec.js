import { test, expect, uid, login, pageAs, manualConfirm, confirmDialog } from './fixtures'

const toast = (page, text) => page.getByTestId('toast').filter({ hasText: text })

async function taoTaiKhoan(page, u) {
  await page.getByTestId('admin-create-open').click()
  const form = page.getByRole('dialog', { name: 'Tạo tài khoản' })
  await form.getByLabel('Họ tên').fill(u.name)
  await form.getByLabel('Email').fill(u.email)
  await form.getByLabel('Mật khẩu ban đầu').fill(u.password)
  await form.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  return form
}

test('tạo tài khoản, khoá thì không đăng nhập được, mở khoá thì được', async ({ page, browser }) => {
  const u = { name: `Thành viên ${uid()}`, email: `tv-${uid()}@e2e.test`, password: 'thanhvien-123' }
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1, name: 'Người dùng & lĩnh vực' })).toBeVisible()

  // Ô mật khẩu ban đầu: che, nút Hiện (aria-pressed) mới lộ chữ
  await page.getByTestId('admin-create-open').click()
  const pw = page.getByRole('dialog', { name: 'Tạo tài khoản' }).getByLabel('Mật khẩu ban đầu')
  await expect(pw).toHaveAttribute('type', 'password')
  await page.getByRole('dialog', { name: 'Tạo tài khoản' }).getByRole('button', { name: 'Hiện' }).click()
  await expect(pw).toHaveAttribute('type', 'text')
  await expect(page.getByRole('dialog', { name: 'Tạo tài khoản' }).getByRole('button', { name: 'Hiện' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')

  await taoTaiKhoan(page, u)
  await expect(toast(page, `Đã tạo ${u.email}`)).toBeVisible()
  const row = page.getByTestId('admin-user-row').filter({ hasText: u.email })
  await expect(row).toBeVisible()
  await expect(row.getByTestId('admin-user-login')).toHaveText('Chưa đăng nhập')   // SYS-36

  // Email trùng -> báo lỗi trong hộp, hộp không đóng
  const form = await taoTaiKhoan(page, { ...u, name: 'Trùng' })
  await expect(form.getByTestId('error-box')).toBeVisible()
  await page.keyboard.press('Escape')

  await row.getByRole('button', { name: 'Khoá' }).click()   // hộp xác nhận tự đồng ý (fixtures)
  await expect(row.getByText('Đã khoá')).toBeVisible()

  const p = await pageAs(browser)
  await p.goto('/')
  await p.getByLabel('Email').fill(u.email)
  await p.getByLabel('Mật khẩu').fill(u.password)
  await p.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(p.locator('.error-box')).toBeVisible()

  await row.getByRole('button', { name: 'Mở khoá' }).click()
  await expect(row.getByText('Đã khoá')).toHaveCount(0)
  await login(p, u)

  // SYS-36: đăng nhập web xong thì cột hiện thời gian tương đối, title là ngày giờ đầy đủ
  await page.reload()
  const login1 = row.getByTestId('admin-user-login')
  await expect(login1).toHaveText('Vừa xong')
  await expect(login1).toHaveAttribute('title', /\d{2}\/\d{2}\/\d{4}/)

  // Đặt lại mật khẩu qua hộp nhập trong app (ô mật khẩu, tối thiểu 8 ký tự)
  await row.getByRole('button', { name: `Đặt lại mật khẩu: ${u.name}` }).click()
  await expect(page.getByTestId('confirm-input')).toHaveAttribute('type', 'password')
  await page.getByTestId('confirm-input').fill('ngan')
  await expect(page.getByTestId('confirm-ok')).toHaveAttribute('aria-disabled', 'true')   // < 8 ký tự: chưa bấm được
  await page.getByTestId('confirm-input').fill('matkhau-dat-lai')
  await page.getByTestId('confirm-ok').click()
  await expect(toast(page, 'Đã đặt lại mật khẩu')).toBeVisible()
  await p.context().close()
})

test('đổi vai trò hỏi xác nhận: Huỷ thì giữ nguyên, Đồng ý thì đổi', async ({ page }) => {
  const u = { name: `Đổi vai trò ${uid()}`, email: `vt-${uid()}@e2e.test`, password: 'thanhvien-123' }
  await page.goto('/admin')
  await taoTaiKhoan(page, u)
  const row = page.getByTestId('admin-user-row').filter({ hasText: u.email })
  await expect(row).toBeVisible()
  await manualConfirm(page)
  await row.getByLabel(`Vai trò của ${u.name}`).selectOption('admin')
  await expect(confirmDialog(page)).toContainText('Quản trị viên')
  await page.getByTestId('confirm-cancel').click()
  await expect(row.getByLabel(`Vai trò của ${u.name}`)).toHaveValue('member')
  await row.getByLabel(`Vai trò của ${u.name}`).selectOption('admin')
  await page.getByTestId('confirm-ok').click()
  await expect(toast(page, 'Đã đổi vai trò')).toBeVisible()
  await expect(row.getByLabel(`Vai trò của ${u.name}`)).toHaveValue('admin')
})

test('lọc người dùng lên URL: tìm tên / email, vai trò, không đăng nhập ≥ 30 ngày; sắp xếp theo đăng nhập gần nhất', async ({ page }) => {
  const u = { name: `Chưa vào ${uid()}`, email: `cv-${uid()}@e2e.test`, password: 'thanhvien-123' }
  await page.goto('/admin')
  await taoTaiKhoan(page, u)
  await expect(page.getByTestId('admin-user-row').filter({ hasText: u.email })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Tìm theo tên hoặc email' }).fill(u.email)
  await expect(page).toHaveURL(/q=/)
  await expect(page.getByTestId('admin-user-row')).toHaveCount(1)

  await page.getByRole('searchbox', { name: 'Tìm theo tên hoặc email' }).fill('')
  await page.getByRole('button', { name: 'Không đăng nhập ≥ 30 ngày' }).click()
  await expect(page).toHaveURL(/stale=1/)
  await expect(page.getByTestId('admin-user-row').filter({ hasText: u.email })).toBeVisible()   // chưa từng đăng nhập cũng tính
  await expect(page.getByTestId('admin-user-row').filter({ hasText: 'admin@e2e.test' })).toHaveCount(0)   // admin vừa đăng nhập

  await page.getByRole('button', { name: 'Xoá lọc' }).click()
  await page.getByLabel('Vai trò:').selectOption('admin')
  await expect(page).toHaveURL(/role=admin/)
  await expect(page.getByTestId('admin-user-row').filter({ hasText: u.email })).toHaveCount(0)

  await page.goto('/admin?sort=login_desc')                       // dán link là thấy đúng bộ sắp xếp
  await expect(page.getByTestId('admin-sort-login')).toHaveAccessibleName(/mới nhất trước/)
  await expect(page.getByTestId('admin-user-row').first().getByTestId('admin-user-login')).not.toHaveText('Chưa đăng nhập')   // người đã đăng nhập lên đầu, chưa từng đăng nhập xuống cuối
})

test('quản trị viên nhận last_login_at trong /api/users, thành viên thường thì không (SYS-36)', async ({ page, browser }) => {
  const u = { name: `Xem trường ${uid()}`, email: `xt-${uid()}@e2e.test`, password: 'thanhvien-123' }
  await page.request.post('/api/users', { data: u })
  const rows = await (await page.request.get('/api/users')).json()
  expect(rows.every((r) => 'last_login_at' in r)).toBe(true)
  const p = await pageAs(browser)
  await login(p, u)
  const other = await (await p.request.get('/api/users')).json()
  expect(other.length).toBeGreaterThan(1)
  expect(other.every((r) => !('last_login_at' in r))).toBe(true)
  await p.context().close()
})

test('cây lĩnh vực: thêm cấp 1, nhánh con, sửa, ẩn/hiện', async ({ page }) => {
  const name = `Lĩnh vực E2E ${uid()}`
  await page.goto('/admin')
  await page.getByRole('tab', { name: 'Lĩnh vực' }).click()
  await expect(page).toHaveURL(/tab=cats/)
  await expect(page.getByRole('heading', { name: 'Cây lĩnh vực' })).toBeVisible()

  await page.getByRole('button', { name: '+ Lĩnh vực cấp 1' }).click()
  await page.getByPlaceholder('Tên lĩnh vực').fill(name)
  await page.getByPlaceholder('Mô tả ngắn').fill('Tạo bởi test tự động')
  await page.getByRole('button', { name: 'Thêm', exact: true }).click()
  const row = page.locator('.cat-row', { hasText: name })
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: '+ Nhánh con' }).click()
  await page.getByPlaceholder('Tên lĩnh vực').fill(`${name} › con`)
  await page.getByRole('button', { name: 'Thêm', exact: true }).click()
  await expect(page.locator('.cat-row', { hasText: `${name} › con` })).toBeVisible()

  await row.first().getByRole('button', { name: 'Sửa' }).click()
  // Đang sửa: dòng có nút Lưu (chỉ một dòng được sửa mỗi lúc)
  const editRow = page.locator('.cat-row').filter({ has: page.getByRole('button', { name: 'Lưu' }) })
  await editRow.locator('input').first().fill(`${name} (đã sửa)`)
  await editRow.getByRole('button', { name: 'Lưu' }).click()
  const edited = page.locator('.cat-row', { hasText: `${name} (đã sửa)` })
  await expect(edited).toBeVisible()

  await edited.getByRole('button', { name: 'Ẩn' }).click()
  await expect(edited.getByText('Đã ẩn')).toBeVisible()
  await edited.getByRole('button', { name: 'Hiện' }).click()
  await expect(edited.getByText('Đã ẩn')).toHaveCount(0)
})

test('tab Duyệt: quản trị viên đặt số người duyệt tối thiểu (dùng thử = 1) — chuyển từ đầu Hộp duyệt (SCR-09)', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('tab', { name: 'Duyệt' }).click()
  const box = page.getByTestId('admin-review-settings')
  const select = box.getByLabel('Số người duyệt tối thiểu')
  await expect(select).toHaveValue('2')
  try {
    await select.selectOption('1')
    await expect(page.getByTestId('toast').filter({ hasText: 'Đã đổi số người duyệt tối thiểu thành 1' })).toBeVisible()
    await expect(select).toHaveValue('1')
    await page.goto('/admin?tab=review')                          // link mở thẳng tab Duyệt
    await expect(page.getByLabel('Số người duyệt tối thiểu')).toHaveValue('1')
    await page.getByLabel('Số người duyệt tối thiểu').selectOption('2')
    await expect(page.getByLabel('Số người duyệt tối thiểu')).toHaveValue('2')
  } finally {
    await page.request.put('/api/wiki/review-settings', { data: { min_approvers: 2 } })
  }
})
