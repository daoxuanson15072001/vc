import { test, expect, uid } from './fixtures'

// Phân tích 7P của dự án (BA 5.13, CE-27). Không có AI trong E2E: tạo bản trống, điền tay, chốt, xem hiện hành.
test('phân tích 7P: bản trống, sửa, chốt phiên bản, hiện hành ở tổng quan', async ({ page }) => {
  const name = `Dự án 7P ${uid()}`
  await page.goto('/studio/projects')
  await page.getByRole('button', { name: '+ Dự án mới' }).click()
  const form = page.getByRole('dialog', { name: 'Dự án' })
  await form.getByLabel(/Tên dự án/).fill(name)
  await form.getByLabel('Mục tiêu').fill('Định vị xưởng gần nhà')
  await form.getByRole('button', { name: 'Tạo dự án' }).click()
  await expect(page).toHaveURL(/\/studio\/projects\/[0-9a-f]{24}/)

  // Bài mẫu P1 làm căn cứ
  await page.getByRole('button', { name: /^Tài nguyên/ }).click()
  await page.getByRole('button', { name: '+ Thêm tài nguyên' }).click()
  const drawer = page.getByRole('dialog', { name: 'Thêm tài nguyên' })
  await drawer.getByRole('button', { name: 'Bài mẫu MXH' }).click()
  await drawer.getByLabel(/Nội dung bài mẫu/).fill('Bảng giá bảo dưỡng niêm yết công khai, không phát sinh chi phí')
  await drawer.getByRole('button', { name: 'Thêm', exact: true }).click()
  await expect(drawer).toBeHidden()

  await page.getByRole('button', { name: /^Phân tích/ }).click()
  await expect(page.getByText('Chưa có phân tích nào')).toBeVisible()
  await page.getByRole('button', { name: 'Bản trống' }).click()
  await expect(page.getByRole('heading', { name: /7P phiên bản 1/ })).toBeVisible()
  await expect(page.getByText('Nháp', { exact: true })).toBeVisible()

  // Chốt bản trống bị từ chối (400) -> báo lỗi; điền rồi lưu, chốt được
  await page.getByRole('button', { name: '✓ Chốt phiên bản' }).click()
  await expect(page.getByText('Phân tích còn trống')).toBeVisible()
  await page.getByLabel('Tóm tắt').fill('Xưởng gần nhà, giá rõ ràng.')
  await page.getByLabel('Giá (Price)').fill('Giá niêm yết công khai, khách yên tâm.')
  await page.getByRole('button', { name: 'Lưu sửa' }).click()
  await expect(page.getByText('Giá niêm yết công khai, khách yên tâm.')).toBeVisible()
  await page.getByRole('button', { name: '✓ Chốt phiên bản' }).click()
  await expect(page.getByText('Đã chốt · hiện hành').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Phân tích \(v1\)/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lưu sửa' })).toHaveCount(0)

  // Tổng quan nêu phân tích hiện hành; phiên bản 2 là nháp, bản 1 vẫn hiện hành
  await page.getByRole('button', { name: /^Tổng quan/ }).click()
  await expect(page.getByText('7P phiên bản 1')).toBeVisible()
  await page.getByRole('button', { name: /^Phân tích/ }).click()
  await page.getByRole('button', { name: 'Bản trống' }).click()
  await expect(page.getByRole('heading', { name: /7P phiên bản 2/ })).toBeVisible()
  await expect(page.locator('.tabs button', { hasText: 'v1 · đã chốt (hiện hành)' })).toBeVisible()
  await page.getByRole('button', { name: 'Xoá nháp' }).click()
  await expect(page.getByRole('heading', { name: /7P phiên bản 1/ })).toBeVisible()
})
