import { test, expect, mongo, uid } from './fixtures'

// Viết nhanh (Content Engine). Môi trường E2E không có ANTHROPIC_API_KEY: nội dung nằm ở "Chờ cấu hình AI";
// kết quả AI được ghi thẳng vào DB để kiểm tra phần hiển thị.
const POST = {
  channel: 'fanpage', author: '', title: 'Má phanh', body: 'Thân bài giải thích.\n\nNhắn tin để đặt lịch.',
  hooks: ['Phanh kêu ken két là đã muộn.', 'Ba dấu hiệu má phanh sắp hết.', 'Anh thợ nói thật về phanh.'],
  cta: 'Nhắn tin', hashtags: ['#VCGarage'], visual: { type: 'ảnh đơn', description: 'Má phanh mòn cạnh má mới', slides: [] },
  first_comment: 'Đặt lịch kiểm tra miễn phí', link_placement: 'không có link', best_time: '20:00', link: null,
  sources: { refs: [], cards: [], notes: '' }, facts_to_verify: ['Giá thay má phanh'],
}
const GOOGLE = {
  headlines: ['Kiểm tra phanh miễn phí', 'Tiêu đề này dài quá ba mươi ký tự rồi'], descriptions: ['Mô tả ngắn.'],
  paths: ['phanh'], sitelinks: [], callouts: ['Miễn phí'], keywords: ['thay má phanh'], negative_keywords: [], notes: '',
  facts_to_verify: [],
}
const setDone = (id, content, extra = {}) => mongo(`db.studio_quick.updateOne({_id: ObjectId("${id}")}, {$set: ${JSON.stringify({
  status: 'done', content, checks: [{ key: 'hooks', label: 'Đủ 3 phương án mở đầu', ok: true, detail: '3 phương án' }],
  title: content.title || 'Bộ quảng cáo', ...extra,
})}})`)

test('chọn loại, viết bài Facebook, xem kết quả, duyệt, chuyển thể, xoá', async ({ page }) => {
  const topic = `Dấu hiệu má phanh mòn ${uid()}`
  await page.goto('/studio/quick')
  await expect(page.getByRole('heading', { name: 'Viết nhanh' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Chọn loại nội dung muốn viết' })).toBeVisible()
  await page.locator('.quick-tile', { hasText: 'Bài Facebook' }).click()
  await expect(page).toHaveURL(/type=fb_post/)

  // Trang cá nhân -> hiện ô người đứng tên; Fanpage thì không
  await expect(page.getByLabel('Người đứng tên')).toHaveCount(0)
  await page.getByLabel('Chủ đề / nội dung chính *').fill(topic)
  await page.getByLabel('Đăng ở đâu *').selectOption('fb_personal')
  await expect(page.getByLabel('Người đứng tên')).toBeVisible()
  await page.getByRole('button', { name: /Viết ngay/ }).click()
  await expect(page.getByText('Đăng trang cá nhân cần chọn người đứng tên')).toBeVisible()
  await page.getByLabel('Đăng ở đâu *').selectOption('fanpage')

  await page.getByText('Tư liệu thêm cho AI').click()
  await page.getByLabel('Tư liệu / ghi chú thêm').fill('Thay má phanh trước 350.000đ/cặp (giá tháng 9).')
  await page.getByRole('button', { name: /Viết ngay/ }).click()
  await expect(page).toHaveURL(/\/studio\/quick\/[0-9a-f]{24}$/)
  const id = page.url().split('/').pop()
  await expect(page.getByRole('heading', { name: topic })).toBeVisible()
  await expect(page.getByText('Chờ cấu hình AI').first()).toBeVisible()

  setDone(id, POST, { score: 86, review: { scores: { hook: 22, value: 17, voice: 13, engagement: 12, readability: 10, cta: 8, safety: 4 },
    strengths: ['Mở đầu gọn'], fixes: ['Thêm giá'], similarity_risk: 'thấp', verdict: 'Đăng được', total: 86 } })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Má phanh' })).toBeVisible()
  await expect(page.getByText('86/100').first()).toBeVisible()
  await page.getByText('Ba dấu hiệu má phanh sắp hết.').click()
  await expect(page.locator('.post-preview .strong')).toHaveText('Ba dấu hiệu má phanh sắp hết.')
  await expect(page.getByText('Cần kiểm chứng trước khi đăng')).toBeVisible()
  await expect(page.getByText('Giám khảo AI')).toBeVisible()
  await expect(page.getByText('Đăng ở đâu')).toBeVisible()   // khối đầu vào

  await page.getByRole('button', { name: '✓ Duyệt' }).click()
  await expect(page.locator('.meta-line').getByText('Đã duyệt')).toBeVisible()

  // Chuyển thể sang email: form điền sẵn chủ đề, kèm nội dung gốc
  await page.getByLabel('Chuyển thể sang loại').selectOption('email')
  await page.getByRole('button', { name: 'Mở form' }).click()
  await expect(page).toHaveURL(new RegExp(`type=email&from=${id}`))
  await expect(page.getByText(/Chuyển thể từ/)).toBeVisible()
  await expect(page.getByLabel('Chủ đề / nội dung chính *')).toHaveValue(topic)
  await page.getByRole('button', { name: /Viết ngay/ }).click()
  await expect(page).toHaveURL(/\/studio\/quick\/[0-9a-f]{24}$/)
  const child = page.url().split('/').pop()
  expect(mongo(`db.studio_quick.findOne({_id: ObjectId("${child}")}).parent_id.toString()`).trim()).toBe(id)

  // Danh sách: lọc theo loại
  await page.goto('/studio/quick')
  const history = page.locator('.quick-history')
  await history.getByLabel('Lọc loại').selectOption('fb_post')
  await expect(history.locator('tbody tr')).toHaveCount(1)
  await history.getByRole('link', { name: 'Má phanh', exact: true }).click()
  await page.getByRole('button', { name: 'Xoá nội dung' }).click()
  await expect(page).toHaveURL(/\/studio\/quick$/)
  await page.goto(`/studio/quick/${child}`)
  await page.getByRole('button', { name: 'Xoá nội dung' }).click()
  await expect(page).toHaveURL(/\/studio\/quick$/)
})

test('quảng cáo Google: đánh dấu dòng vượt giới hạn ký tự', async ({ page }) => {
  await page.goto('/studio/quick?type=google_ads')
  await page.getByLabel('Từ khoá / nhóm từ khoá *').fill('thay má phanh')
  await page.getByLabel('Dịch vụ / ưu đãi quảng cáo *').fill('Thay má phanh chính hãng')
  await page.getByRole('button', { name: /Viết ngay/ }).click()
  await expect(page).toHaveURL(/\/studio\/quick\/[0-9a-f]{24}$/)
  const id = page.url().split('/').pop()
  setDone(id, GOOGLE)
  await page.reload()
  const over = page.locator('.quick-list li.over')
  await expect(over).toHaveCount(1)
  await expect(over).toContainText('Tiêu đề này dài quá ba mươi ký tự rồi')
  await expect(over).toContainText('/30')
  await page.getByRole('button', { name: 'Xoá nội dung' }).click()
  await expect(page).toHaveURL(/\/studio\/quick$/)
})
