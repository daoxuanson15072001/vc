// Thư viện bài học chia cây lĩnh vực như VCWIKI (lĩnh vực của bài = lĩnh vực các thẻ trong bài).
import { test, expect, E2E_OUT } from './fixtures'

test('thư viện bài học có cây lĩnh vực, chọn nhánh thì lọc theo ?category=', async ({ page }) => {
  await page.goto('/learn/library')
  const tree = page.getByRole('complementary', { name: 'Cây lĩnh vực' })
  await expect(tree.getByRole('button', { name: 'Tất cả lĩnh vực' })).toBeVisible()
  await tree.locator('.ui-tree-label').nth(0).click()   // nhánh đầu tiên (Tree CMP-17; "Tất cả lĩnh vực" là nút riêng)
  await expect(page).toHaveURL(/category=/)
  await expect(page.getByText(/Nhánh này chưa có bài học nào|Bài/).first()).toBeVisible()
  await page.screenshot({ path: `${E2E_OUT}/library-tree.png` })
  await tree.getByRole('button', { name: 'Tất cả lĩnh vực' }).click()
  await expect(page).not.toHaveURL(/category=/)
})
