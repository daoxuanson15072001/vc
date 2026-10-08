import { test, expect, nav } from './fixtures'

// Bấm lần lượt từng mục menu: trang phải mở đúng tiêu đề, không lỗi JS, không lỗi 5xx
const PAGES = [
  ['Việc của tôi', 'Việc của tôi', '/'],
  ['Kho tư liệu', 'Kho tư liệu', '/kb'],
  ['VCWIKI', 'VCWIKI', '/wiki'],
  ['Kho & chia sẻ', 'Kho & chia sẻ', '/spaces'],
  ['Người dùng & lĩnh vực', 'Người dùng & lĩnh vực', '/admin'],
]

test('mọi mục menu đều mở được', async ({ page }) => {
  await page.goto('/')
  for (const [link, heading, path] of PAGES) {
    await nav(page, link).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
    await expect(nav(page, link)).toHaveClass(/active/)
  }
})

// SYS-32 / SEO-02 (UI-1): đường dẫn lạ không còn tự về Tổng quan — hiện trang "Không tìm thấy trang" (seo-shell.spec.js)
test('đường dẫn không tồn tại hiện trang Không tìm thấy', async ({ page }) => {
  await page.goto('/khong-co-trang-nay')
  await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' })).toBeVisible()
})

test('tab Kênh thống kê theo kênh và dẫn sang tab Video', async ({ page }) => {
  await page.goto('/kb')
  await page.getByRole('navigation', { name: 'Khu Kho tư liệu' }).getByRole('link', { name: 'Kênh' }).click()
  await expect(page).toHaveURL(/\/kb\/channels$/)
  const row = page.locator('tr', { hasText: '@kenh_b' })
  await expect(row).toBeVisible()
  await row.getByRole('link', { name: 'KENH_B', exact: true }).click()
  await expect(page).toHaveURL(/\/kb\/videos\?channel=kenh_b/)
  await expect(page.getByText('2 video khớp bộ lọc')).toBeVisible()
  await expect(nav(page, 'Kho tư liệu')).toHaveClass(/active/)
})

test('đường dẫn cũ (Lượt quét, Kho video, Kênh) chuyển sang Kho tư liệu, giữ bộ lọc', async ({ page }) => {
  await page.goto('/jobs')
  await expect(page).toHaveURL(/\/kb$/)
  await page.goto('/videos?channel=kenh_a')
  await expect(page).toHaveURL(/\/kb\/videos\?channel=kenh_a$/)
  await expect(page.getByText('khớp bộ lọc')).toBeVisible()
  await page.goto('/channels')
  await expect(page).toHaveURL(/\/kb\/channels$/)
})
