import { test, expect, uid } from './fixtures'

// Dự án marketing (BA 5.13, đợt 1): tạo dự án, thêm tài nguyên (video Kho video + bài mẫu), ghim, lập chiến dịch
// trong dự án, gán / bỏ gán, lưu trữ. Môi trường E2E không có AI: chiến dịch dừng ở "Chờ cấu hình AI".
test('dự án marketing: tạo, tài nguyên, chiến dịch trong dự án, lưu trữ', async ({ page }) => {
  const name = `Dự án E2E ${uid()}`
  await page.goto('/studio/projects')
  await expect(page.getByRole('heading', { name: 'Dự án marketing' })).toBeVisible()
  await page.getByRole('button', { name: '+ Dự án mới' }).click()
  const form = page.getByRole('dialog', { name: 'Dự án' })
  await form.getByLabel(/Tên dự án/).fill(name)
  await form.getByLabel('Mục tiêu').fill('Tăng khách sửa xe mới trong quý 4')
  await form.getByRole('button', { name: 'Tạo dự án' }).click()

  await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f]{24}/)
  const id = page.url().split('/studio/projects/')[1].split('?')[0]
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.locator('.page-head')).toContainText('Chủ dự án')
  await expect(page.getByText('Tăng khách sửa xe mới trong quý 4')).toBeVisible()

  // Tài nguyên: video đầu tiên trong Kho video mẫu (đã chuyển chữ) -> R1; bài mẫu dán -> P1
  await page.getByRole('button', { name: /^Tài nguyên/ }).click()
  await page.getByRole('button', { name: '+ Thêm tài nguyên' }).click()
  const drawer = page.getByRole('dialog', { name: 'Thêm tài nguyên' })
  await drawer.getByRole('button', { name: '+ Thêm' }).first().click()
  await expect(drawer.getByRole('button', { name: 'Đã có' })).toHaveCount(1)
  await drawer.getByRole('button', { name: 'Bài mẫu MXH' }).click()
  await drawer.getByLabel(/Nội dung bài mẫu/).fill('Bài mẫu E2E: bảo dưỡng xe định kỳ giúp tiết kiệm chi phí sửa chữa')
  await drawer.getByRole('button', { name: 'Thêm', exact: true }).click()
  await expect(drawer).toBeHidden()
  await expect(page.locator('.chip', { hasText: /^R1$/ })).toBeVisible()
  await expect(page.locator('.chip', { hasText: /^P1$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tài nguyên \(2\)/ })).toBeVisible()

  // Xem nội dung đã chụp của P1
  await page.locator('tr', { hasText: 'P1' }).getByRole('button', { name: 'Xem' }).click()
  const view = page.getByTestId('project-resource-drawer')
  await expect(view).toContainText('Bài mẫu E2E: bảo dưỡng xe')
  await view.getByRole('button', { name: /^Đóng: P1/ }).click()
  await expect(view).toBeHidden()

  // Chiến dịch trong dự án: form hiện dự án, kho khoá theo dự án; để trống tham chiếu -> lấy R1 của dự án
  await page.getByRole('button', { name: /^Chiến dịch/ }).click()
  await page.getByRole('link', { name: '+ Chiến dịch trong dự án' }).click()
  await expect(page).toHaveURL(new RegExp(`/studio/new\\?project=${id}`))
  await expect(page.getByText('Chiến dịch thuộc dự án')).toBeVisible()
  const cname = `Chiến dịch ${name}`
  await page.getByLabel(/Tên chiến dịch/).fill(cname)
  await page.getByLabel('Số tuần').fill('1')
  await page.getByLabel('Video / tuần').fill('1')
  await page.getByRole('button', { name: 'Lập chiến dịch' }).click()
  await expect(page).toHaveURL(/\/studio\/[0-9a-f]{24}/)
  await expect(page.getByRole('heading', { name: cname })).toBeVisible()
  await expect(page.locator('.page-head')).toContainText(`Dự án: ${name}`)
  await page.getByRole('button', { name: 'Tham chiếu' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)   // đúng 1 video R1 của dự án, không phải cả Kho video

  // Trang dự án: tab Chiến dịch có 1; có chiến dịch -> không có nút Xoá, chỉ Lưu trữ
  await page.locator('.page-head').getByRole('link', { name }).click()
  await expect(page).toHaveURL(new RegExp(`/studio/projects/${id}`))
  await page.getByRole('button', { name: /^Chiến dịch \(1\)/ }).click()
  await expect(page.getByRole('link', { name: cname })).toBeVisible()
  await expect(page.locator('.page-head').getByRole('button', { name: 'Xoá' })).toHaveCount(0)

  // Bỏ gán chiến dịch khỏi dự án ở trang chiến dịch -> dự án xoá được
  await page.getByRole('link', { name: cname }).click()
  await page.getByLabel(/Thuộc dự án/).selectOption('')
  await expect(page.locator('.page-head')).not.toContainText('Dự án:')
  await page.goto(`/studio/projects/${id}`)
  await page.getByRole('button', { name: 'Lưu trữ' }).click()
  await expect(page.locator('.page-head')).toContainText('Đã lưu trữ')
  await page.locator('.page-head').getByRole('button', { name: 'Xoá' }).click()
  await expect(page).toHaveURL(/\/studio\/projects$/)
  await expect(page.getByRole('link', { name })).toHaveCount(0)
})
