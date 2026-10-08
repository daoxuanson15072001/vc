import { test, expect, uid } from './fixtures'

test('tạo thẻ tay, duyệt, sửa, tìm, lọc theo lĩnh vực, sao chép sang kho khác, xoá', async ({ page }) => {
  const title = `Thẻ E2E ${uid()}`
  // Kho đích để sao chép
  const target = `Kho nhận thẻ ${uid()}`
  await page.goto('/wiki')
  expect((await page.request.post('/api/spaces', { data: { name: target, description: '', visibility: 'private' } })).ok()).toBeTruthy()
  await page.reload()

  await page.getByRole('button', { name: '+ Thẻ mới' }).click()
  const drawer = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await expect(drawer.getByRole('heading', { name: 'Tạo thẻ tri thức' })).toBeVisible()
  const create = drawer.getByRole('button', { name: 'Tạo thẻ' })
  await expect(create).toBeDisabled()

  await drawer.getByLabel('Tiêu đề').fill(title)
  await drawer.getByLabel('Tóm tắt').fill('Chốt đơn nhanh bằng câu hỏi đóng')
  await drawer.getByLabel(/Ý chính/).fill('Hỏi câu đóng\nĐưa 2 lựa chọn')
  await drawer.getByLabel(/^Tag/).fill('ban-hang, e2e')
  // Chọn lĩnh vực đầu tiên trong cây
  await drawer.getByRole('button', { name: /Chọn lĩnh vực/ }).click()
  const picker = page.getByRole('dialog', { name: 'Chọn lĩnh vực' })
  const firstCat = picker.locator('.pick-row').first()
  const catName = (await firstCat.innerText()).trim()
  await firstCat.locator('input').check()
  await picker.getByRole('button', { name: 'Xong' }).click()
  await create.click()

  await expect(drawer.getByRole('heading', { name: title })).toBeVisible()
  await expect(drawer.getByText('Viết tay')).toBeVisible()
  await expect(drawer.locator('li', { hasText: 'Đưa 2 lựa chọn' })).toBeVisible()
  await expect(drawer.locator('.tag', { hasText: '#ban-hang' })).toBeVisible()

  // Gửi duyệt / loại (bắt buộc lý do khi đang chờ duyệt) / về nháp — duyệt 2 người: xem review.spec.js
  await drawer.getByRole('button', { name: 'Gửi duyệt' }).click()
  await expect(drawer.getByLabel('Trạng thái duyệt')).toContainText('Đang chờ duyệt')
  await expect(drawer.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0)   // tác giả không tự duyệt
  await drawer.getByTestId('wiki-card-more').click()
  await drawer.getByTestId('wiki-card-reject').click()
  await page.getByTestId('confirm-input').fill('Viết lại sau')   // hộp nhập lý do trong app (không phải window.prompt)
  await page.getByTestId('confirm-ok').click()
  await expect(drawer.getByTestId('card-status')).toHaveText('Từ chối')   // DESIGN V.8: "Từ chối", không còn "Loại"
  await drawer.getByTestId('wiki-card-more').click()
  await drawer.getByTestId('wiki-card-to-draft').click()
  await expect(drawer.getByTestId('card-status')).toHaveText('Nháp')

  // Sửa
  await drawer.getByRole('button', { name: 'Sửa', exact: true }).click()
  await drawer.getByLabel('Tiêu đề').fill(`${title} (sửa)`)
  await drawer.getByRole('button', { name: 'Lưu' }).click()
  await expect(drawer.getByRole('heading', { name: `${title} (sửa)` })).toBeVisible()

  // Sao chép sang kho khác
  await drawer.getByTestId('wiki-card-more').click()
  await drawer.getByTestId('wiki-card-copy').click()
  const copyDlg = page.getByRole('dialog', { name: 'Sao chép sang kho' })
  await copyDlg.getByLabel('Kho nhận bản sao').selectOption({ label: target })
  await copyDlg.getByRole('button', { name: 'Sao chép', exact: true }).click()
  await expect(page.getByTestId('toast').filter({ hasText: 'Đã sao chép' })).toBeVisible()

  await drawer.getByRole('button', { name: 'Đóng' }).click()
  await expect(drawer).toHaveCount(0)

  // Tìm không dấu: ra 2 thẻ (gốc + bản sao)
  await page.getByPlaceholder(/Tìm trong thẻ/).fill(title.replace('Thẻ', 'the'))
  await expect(page.getByTestId('wiki-card')).toHaveCount(2)

  // Lọc theo kho đích: chỉ bản sao, ở trạng thái nháp
  await page.getByLabel('Kho:', { exact: true }).selectOption({ label: `${target} (chia sẻ)` })   // ô chọn kho ghi rõ loại kho (28/09)
  await expect(page.getByTestId('wiki-card')).toHaveCount(1)
  await expect(page.getByTestId('wiki-card')).toContainText('Nháp')
  // Lọc theo lĩnh vực ở cây bên trái (mặc định dạng Lộ trình). Bỏ ô tìm, giữ kho đích (chỉ chứa bản sao) để đếm chính xác:
  // bản sao giữ nguyên lĩnh vực -> 1 thẻ; lĩnh vực gốc khác -> 0 (tìm có chữ chạy nhánh tìm theo nghĩa, không dùng ở đây)
  await page.getByPlaceholder(/Tìm trong thẻ/).fill('')
  await expect(page.getByTestId('wiki-card')).toHaveCount(1)
  await page.locator('.wiki-side .ui-tree-label').getByText(catName, { exact: true }).click()
  await expect(page).toHaveURL(/category=/)
  await expect(page.getByTestId('wiki-timeline-item')).toHaveCount(1)
  const otherCat = page.locator('.wiki-side li[aria-level="1"] > .ui-tree-row .ui-tree-label').nth(1)   // lĩnh vực gốc thứ hai (không phải nhánh con của catName)
  await otherCat.click()
  await expect(page.getByTestId('wiki-timeline-item')).toHaveCount(0)
  await page.locator('.wiki-side').getByRole('button', { name: 'Tất cả lĩnh vực' }).click()
  await page.getByLabel('Kho:', { exact: true }).selectOption('')
  await page.getByPlaceholder(/Tìm trong thẻ/).fill(title.replace('Thẻ', 'the'))
  await expect(page.getByTestId('wiki-card')).toHaveCount(2)


  // Xoá cả hai
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('wiki-card').first().getByRole('link').click()
    await drawer.getByTestId('wiki-card-more').click()
    await drawer.getByTestId('wiki-card-delete').click()
    await expect(drawer).toHaveCount(0)
    await expect(page.getByTestId('wiki-card')).toHaveCount(1 - i)   // đợi lưới tải lại, không bấm nhầm thẻ vừa xoá
  }
  await expect(page.getByTestId('wiki-card')).toHaveCount(0)
})
