// UI-1 (DESIGN V.9.1): vỏ ứng dụng — tiêu đề tab + meta theo routes.js (SEO-04), trang 404 trong app (SEO-02),
// link cũ (SEO-03, dự phòng phía FE khi chạy vite dev), vỏ index.html (SEO-01, 05), công tắc giao diện (TOK-COLOR).
import { test, expect } from './fixtures'

test('tiêu đề tab, mô tả, canonical theo route', async ({ page }) => {
  await page.goto('/wiki/graph')
  await expect(page).toHaveTitle('Bản đồ tri thức · VC Content Engine')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Đồ thị liên kết giữa các thẻ VCWIKI theo chủ đề')
  await page.goto('/kb?q=phanh&source=abc')
  await expect(page).toHaveTitle('Kho tư liệu · VC Content Engine')
  // canonical giữ tham số mở đối tượng, bỏ bộ lọc
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/kb\?source=abc$/)
})

test('đường dẫn không tồn tại: trang "Không tìm thấy trang", không tự về trang đầu', async ({ page }) => {
  await page.goto('/khong-co-trang-nay')
  await expect(page).toHaveURL(/\/khong-co-trang-nay$/)
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' })).toBeVisible()
  await expect(page).toHaveTitle('Không tìm thấy trang · VC Content Engine')
  await page.getByRole('link', { name: 'Về Việc của tôi' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Tổng quan|Việc của tôi/ })).toBeVisible()
})

test('link cũ chuyển sang đường dẫn mới, giữ bộ lọc', async ({ page }) => {
  await page.goto('/videos?channel=abc')
  await expect(page).toHaveURL(/\/kb\/videos\?channel=abc$/)
  await page.goto('/jobs/xyz')
  await expect(page).toHaveURL(/\/kb$/)
})

test('vỏ index.html: noindex, theme-color, favicon, ảnh xem trước; robots.txt từ BE', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', '/og.png')
  expect((await request.get('/favicon.svg')).status()).toBe(200)
  expect((await request.get('/og.png')).status()).toBe(200)
  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toContain('Disallow: /api/')
})

test('công tắc giao diện Theo máy / Sáng / Tối: ghi data-theme, nhớ sau khi tải lại', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.getByTestId('user-menu').click()
  const sw = page.getByRole('radiogroup', { name: 'Giao diện' })
  await expect(sw.getByRole('radio', { name: 'Theo máy' })).toHaveAttribute('aria-checked', 'true')
  await sw.getByRole('radio', { name: 'Tối' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(await bg()).toBe('rgb(15, 17, 21)')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByTestId('user-menu').click()
  await page.getByRole('radiogroup', { name: 'Giao diện' }).getByRole('radio', { name: 'Theo máy' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./)
  expect(await bg()).toBe('rgb(246, 247, 249)')
})
