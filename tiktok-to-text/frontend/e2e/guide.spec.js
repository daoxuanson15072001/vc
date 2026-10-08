// Trang Hướng dẫn sử dụng VCWIKI (/guide — frontend/src/pages/Guide.jsx, nội dung pages/guide/content.js).
import { test, expect, nav, E2E_OUT } from './fixtures'

test('hướng dẫn sử dụng: menu, tìm không dấu, lọc vai trò, mục lục, link neo, 375 px', async ({ page }) => {
  await page.goto('/')
  await nav(page, 'Hướng dẫn').click()
  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.getByRole('heading', { name: 'Hướng dẫn sử dụng VCWIKI' })).toBeVisible()
  const sections = page.getByTestId('guide-section')
  const total = await sections.count()
  expect(total).toBeGreaterThan(10)
  await page.screenshot({ path: `${E2E_OUT}/guide-desktop.png` })

  // tìm không dấu
  await page.getByLabel('Tìm trong hướng dẫn').fill('bon mat')
  await expect(sections.first()).toBeVisible()
  expect(await sections.count()).toBeLessThan(total)
  await expect(page.locator('.guide-body').getByRole('heading', { name: 'Duyệt tri thức', exact: true })).toBeVisible()
  await page.getByLabel('Tìm trong hướng dẫn').fill('khong co muc nao nhu vay xyz')
  await expect(page.getByText(/Không có mục nào khớp/)).toBeVisible()
  await page.getByLabel('Tìm trong hướng dẫn').fill('')

  // lọc vai trò
  const chips = page.getByRole('group', { name: 'Lọc theo vai trò' })
  await chips.getByRole('button', { name: 'Người duyệt' }).click()
  await expect(page.locator('.guide-body').getByRole('heading', { name: 'Duyệt tri thức', exact: true })).toBeVisible()
  await expect(page.locator('.guide-body').getByRole('heading', { name: 'Nạp tư liệu vào Kho' })).toHaveCount(0)
  await chips.getByRole('button', { name: 'Tất cả' }).click()
  expect(await sections.count()).toBe(total)

  // mục lục nhảy tới mục + ghi neo; nút mở trang chuyển trong app
  await page.getByRole('navigation', { name: 'Mục lục' }).getByRole('link', { name: 'Kho & chia sẻ' }).click()
  await expect(page).toHaveURL(/#kho-chia-se$/)
  await expect(page.locator('#kho-chia-se')).toBeInViewport()
  await page.locator('#kho-chia-se').getByRole('link', { name: 'Mở Kho & chia sẻ →' }).click()
  await expect(page).toHaveURL(/\/spaces$/)

  // mục Tạo khoá học từng bước: có lời nhắn sao chép cho Claude, nút Sao chép ghi vào clipboard
  await page.goto('/guide#tao-khoa-hoc')
  const course = page.locator('#tao-khoa-hoc')
  await expect(course.getByRole('heading', { name: /Tạo một khoá học từ A đến Z/ })).toBeVisible()
  const snippets = course.getByTestId('guide-snippet')
  await expect(snippets).toHaveCount(3)
  await expect(snippets.first().locator('pre')).toContainText('design_path')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await snippets.nth(1).getByRole('button', { name: /Sao chép/ }).click()
  await expect(page.getByTestId('toast').filter({ hasText: 'Đã sao chép' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Bước A — Câu hỏi')

  // mục Soạn khoá học (checklist cho AI): một lời nhắn rút gọn có data-testid; bản .md đọc bằng HTTP thuần
  await page.goto('/guide#soan-khoa')
  const soan = page.locator('#soan-khoa')
  await expect(soan.getByRole('heading', { name: /Soạn khoá học: checklist/ })).toBeVisible()
  await expect(soan.getByTestId('guide-snippet')).toHaveCount(1)
  await expect(soan.getByTestId('guide-snippet').locator('pre')).toContainText('[q-save-approve-next]')
  await expect(soan.getByRole('link', { name: /Bản Markdown của mục Soạn khoá học/ })).toHaveAttribute('href', '/guide/soan-khoa.md')
  const md = await page.request.get('/guide/soan-khoa.md')
  expect(md.status()).toBe(200)
  expect(await md.text()).toContain('### Bước 0')
  expect((await (await page.request.get('/guide.md')).text())).toContain('/guide/soan-khoa.md')

  // link neo gửi cho đồng nghiệp mở đúng mục; 375 px không cuộn ngang
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/guide#hoi-dap')
  await expect(page.locator('#hoi-dap')).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy()
  await page.screenshot({ path: `${E2E_OUT}/guide-375.png` })
})
