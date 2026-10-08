// SCR-01 Việc của tôi (DESIGN V.7): dòng việc từ /api/me/inbox/counts (stub), số liệu kho từ video mẫu.
import { test, expect } from './fixtures.js'

const COUNTS = { review: 3, learn_due: 2, learn_next_due: new Date(Date.now() + 3 * 86_400_000).toISOString(), grading: 1, content_fix: 0, sources_error: 1, returned_to_me: 2, updated_at: new Date().toISOString() }
const stub = (page, body, status = 200) => page.route('**/api/me/inbox/counts', (r) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }))
const task = (page, kind) => page.locator(`[data-testid="home-task"][data-kind="${kind}"]`)

test('trang chủ là Việc của tôi, có nút Nạp nguồn', async ({ page }) => {
  await stub(page, COUNTS)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Việc của tôi' })).toBeVisible()
  await expect(page.getByTestId('dashboard-source-add')).toHaveAttribute('href', '/kb?add=1')
  await expect(page.getByTestId('home-updated')).toContainText('Cập nhật lúc')
})

test('dòng việc: số bằng chữ, link đến màn đã lọc, dòng 0 việc vẫn hiện', async ({ page }) => {
  await stub(page, COUNTS)
  await page.goto('/')
  await expect(page.getByTestId('home-greeting')).toContainText('Hôm nay có')
  await expect(task(page, 'review')).toHaveAttribute('data-count', '3')
  await expect(task(page, 'review').getByRole('link')).toHaveAttribute('href', '/wiki/review')
  await expect(task(page, 'learn').getByRole('link')).toHaveAttribute('href', '/learn')
  await expect(task(page, 'learn')).toContainText('hạn gần nhất: còn 3 ngày')
  await expect(task(page, 'sources_error').getByRole('link')).toHaveAttribute('href', '/kb?status=error&mine=1')
  // GOV-13: đề xuất của tôi bị trả về → tab Tôi đề xuất lọc Cần sửa
  await expect(task(page, 'returned')).toHaveAttribute('data-count', '2')
  await expect(task(page, 'returned')).toContainText('Đề xuất cần sửa')
  await expect(task(page, 'returned').getByRole('link')).toHaveAttribute('href', '/wiki/review?tab=mine&status=returned')
  // 0 việc: hiện mờ, không ẩn
  await expect(task(page, 'content_fix')).toBeVisible()
  await expect(task(page, 'content_fix')).toHaveAttribute('data-count', '0')
  await expect(task(page, 'content_fix')).toHaveClass(/is-zero/)
  await task(page, 'review').getByRole('link').click()
  await expect(page).toHaveURL(/\/wiki\/review/)
})

test('Bài chờ chấm chỉ hiện khi có quyền chấm', async ({ page }) => {
  await stub(page, COUNTS)
  await page.route('**/api/auth/me', async (r) => {
    const res = await r.fetch()
    const u = await res.json()
    await r.fulfill({ response: res, json: { ...u, can_grade: false } })
  })
  await page.goto('/')
  await expect(task(page, 'review')).toBeVisible()
  await expect(task(page, 'grading')).toHaveCount(0)
})

test('API việc lỗi: hiện ErrorBox có Thử lại, số liệu kho vẫn hiện', async ({ page }) => {
  await stub(page, { detail: 'chưa có' }, 404)
  await page.goto('/')
  await expect(page.getByTestId('error-box')).toContainText('Không tải được việc của bạn')
  await expect(page.getByTestId('dashboard-stats')).toBeVisible()
  await page.unroute('**/api/me/inbox/counts')
  await stub(page, COUNTS)
  await page.getByTestId('error-box-retry').click()
  await expect(page.getByTestId('home-tasks')).toBeVisible()
})

test('Số liệu kho từ video mẫu, thu gọn được, ô là liên kết', async ({ page }) => {
  await stub(page, COUNTS)
  await page.goto('/')
  const stat = (label) => page.locator('.stat', { hasText: label }).locator('.stat-value')
  await expect(stat('Video trong kho')).toHaveText('4')
  await expect(stat('Kênh')).toHaveText('2')
  await expect(stat('Video lỗi')).toHaveText('1')
  await expect(page.getByRole('link', { name: /Video lỗi/ })).toHaveAttribute('href', '/kb/videos?status=error')
  const toggle = page.getByTestId('home-kb-toggle')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('dashboard-stats')).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Thẻ mới duyệt' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nguồn nạp gần đây' })).toBeVisible()
})

test('Viết nhanh: ?status= trên URL chọn đúng bộ lọc', async ({ page }) => {
  await page.goto('/studio/quick?status=approved')
  await expect(page.getByTestId('quick-status-filter')).toHaveValue('approved')
})
