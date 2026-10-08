import { test, expect } from './fixtures'

const rows = (page) => page.getByTestId('videos-table').locator('tbody tr')
const openVideo = (page, text) => rows(page).filter({ hasText: text }).getByTestId('videos-row-open').click()

test('tìm kiếm gõ không dấu, lọc trạng thái, sắp xếp', async ({ page }) => {
  await page.goto('/kb/videos')
  await expect(page.getByText('4 video')).toBeVisible()
  await expect(rows(page)).toHaveCount(4)

  await page.getByPlaceholder(/Tìm trong lời nói/).fill('chot don')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Mẹo bán hàng online')
  await expect(page).toHaveURL(/q=chot/)

  await page.getByRole('button', { name: 'Xoá lọc' }).click()
  await expect(rows(page)).toHaveCount(4)

  await page.getByTestId('videos-filter-status').selectOption('error')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Lỗi')
  await page.getByRole('button', { name: 'Xoá lọc' }).click()

  // Lọc thêm (tag, ngày) thu gọn sau một nút
  await expect(page.getByTestId('videos-filter-tag')).toHaveCount(0)
  await page.getByTestId('videos-more').click()
  await expect(page.getByTestId('videos-filter-tag')).toBeVisible()

  await page.getByTestId('videos-sort').selectOption('views')
  await expect(rows(page).first()).toContainText('Review phụ tùng xe')
  await page.getByRole('button', { name: /Giảm dần/ }).click()
  await expect(rows(page).first()).toContainText('Video bị lỗi')
})

test('mở chi tiết video: thêm tag, ghi chú, sửa lời nói, lọc theo tag', async ({ page }) => {
  await page.goto('/kb/videos')
  await openVideo(page, 'Review phụ tùng xe')
  const drawer = page.getByRole('dialog', { name: 'Chi tiết video' })
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('.transcript')).toContainText('Phụ tùng chính hãng')
  await expect(drawer.getByRole('link', { name: /^Mở trên / })).toBeVisible()

  // Tab phụ đề và caption (tab trên URL ?vtab=)
  await drawer.getByRole('tab', { name: /Phụ đề \(1\)/ }).click()
  await expect(page).toHaveURL(/vtab=segments/)
  await expect(drawer.locator('.segment')).toHaveCount(1)
  await drawer.getByRole('tab', { name: 'Caption' }).click()
  await expect(drawer.locator('.transcript')).toHaveText('Review phụ tùng xe')
  await drawer.getByRole('tab', { name: 'Lời nói' }).click()

  // Tag
  await drawer.getByPlaceholder(/thêm tag/).fill('phu-tung')
  await drawer.getByPlaceholder(/thêm tag/).press('Enter')
  await expect(drawer.getByRole('button', { name: '#phu-tung' })).toBeVisible()

  // Ghi chú
  await drawer.getByPlaceholder(/hook 3 giây/).fill('Mẫu kịch bản tốt')
  await drawer.getByRole('button', { name: 'Lưu ghi chú' }).click()
  await expect(drawer.getByRole('button', { name: 'Lưu ghi chú' })).toHaveCount(0)

  // Sửa lời nói tay
  await drawer.getByRole('button', { name: 'Sửa', exact: true }).click()
  await drawer.locator('textarea.transcript-edit').fill('Lời nói đã sửa tay bởi E2E')
  await drawer.getByRole('button', { name: 'Lưu lời nói' }).click()
  await expect(drawer.locator('.transcript')).toHaveText('Lời nói đã sửa tay bởi E2E')
  await expect(drawer.locator('.badge', { hasText: 'Đã sửa tay' })).toBeVisible()

  // Đóng bằng Esc rồi mở lại: dữ liệu còn nguyên
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  const row = rows(page).filter({ hasText: 'Review phụ tùng xe' })
  await expect(row).toContainText('#phu-tung')
  await expect(row).toContainText('ghi chú')
  await page.reload()
  await row.getByTestId('videos-row-open').click()
  await expect(drawer.locator('.transcript')).toHaveText('Lời nói đã sửa tay bởi E2E')

  // Bấm tag trong drawer -> lọc danh sách theo tag
  await drawer.getByRole('button', { name: '#phu-tung' }).click()
  await expect(page).toHaveURL(/tag=phu-tung/)
  await expect(rows(page)).toHaveCount(1)

  // Bỏ tag
  await rows(page).first().getByTestId('videos-row-open').click()
  await drawer.getByRole('button', { name: 'Bỏ tag phu-tung' }).click()
  await expect(drawer.getByRole('button', { name: '#phu-tung' })).toHaveCount(0)
})

test('xuất Excel tải được file .xlsx', async ({ page }) => {
  await page.goto('/kb/videos')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Xuất Excel/ }).click()])
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
})

test('tải phụ đề SRT của video', async ({ page }) => {
  await page.goto('/kb/videos?v=7000000000000000001')
  const drawer = page.getByRole('dialog', { name: 'Chi tiết video' })
  const [download] = await Promise.all([page.waitForEvent('download'), drawer.getByRole('link', { name: 'Tải SRT' }).click()])
  expect(download.suggestedFilename()).toMatch(/\.srt$/)
})
