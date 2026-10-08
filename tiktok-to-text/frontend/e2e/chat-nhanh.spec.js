// Chat nhanh: cửa sổ trò chuyện với Claude ở góc dưới bên phải (components/QuickChat.jsx) — mở / thu nhỏ, giữ nguyên
// khi chuyển trang, nhớ sau khi tải lại, mở rộng thành trang /chat, danh sách cuộc trò chuyện, ẩn trên /chat.
// Không gửi câu hỏi thật (cần Claude CLI) — chỉ kiểm giao diện.
import { test, expect, nav, E2E_OUT } from './fixtures'

test('chat nhanh: mở góc phải, giữ khi chuyển trang, danh sách, mở rộng, thu nhỏ, 375 px', async ({ page }) => {
  await page.goto('/wiki')
  await expect(page).toHaveURL(/\/wiki$/)
  const fab = page.getByRole('button', { name: 'Hỏi Claude', exact: true })
  await expect(fab).toBeVisible()
  await expect(page.getByTestId('qchat')).toHaveCount(0)

  // mở: không đổi trang, cửa sổ nổi có màn chào + ô nhập được đặt con trỏ
  await fab.click()
  const box = page.getByTestId('qchat')
  await expect(box).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Chat nhanh' })).toBeVisible()
  await expect(page).toHaveURL(/\/wiki$/)
  await expect(box.getByText('Chat nhanh', { exact: true })).toBeVisible()
  await expect(box.getByRole('button', { name: 'Trang này dùng thế nào?' })).toBeVisible()
  await expect(box.getByLabel('Hỏi Claude')).toBeFocused()
  await expect(box.getByRole('link', { name: 'Mở rộng' })).toHaveAttribute('href', '/chat')
  // cửa sổ nằm góc dưới bên phải
  const [vp, bb] = [page.viewportSize(), await box.boundingBox()]
  expect(vp.width - (bb.x + bb.width)).toBeLessThan(40)
  expect(vp.height - (bb.y + bb.height)).toBeLessThan(40)
  await page.screenshot({ path: `${E2E_OUT}/chat-nhanh-mo.png` })

  // chuyển trang: vẫn mở; danh sách cuộc trò chuyện
  await nav(page, 'Kho tư liệu').click()
  await expect(page).toHaveURL(/\/kb$/)
  await expect(box).toBeVisible()
  await box.getByRole('button', { name: 'Các cuộc trò chuyện' }).click()
  await expect(box.getByText('Chưa có cuộc trò chuyện nào')).toBeVisible()

  // tạo cuộc trò chuyện qua API (như trang /chat) -> hiện trong danh sách, chọn thì mở luồng trong cửa sổ
  const t = await (await page.request.post('/api/chat/threads', { data: { title: 'Luồng chat nhanh e2e' } })).json()
  await box.getByLabel('Tìm cuộc trò chuyện').fill('luong chat nhanh')
  await box.getByRole('link', { name: /Luồng chat nhanh e2e/ }).click()
  await expect(box.getByRole('heading', { name: 'Luồng chat nhanh e2e' })).toBeVisible()
  await expect(box.getByText('Hỏi hoặc giao việc cho Claude ở ô bên dưới.')).toBeVisible()
  await expect(box.getByRole('link', { name: 'Mở rộng' })).toHaveAttribute('href', `/chat/${t.id}`)

  // tải lại trang: vẫn mở, vẫn luồng đó
  await page.reload()
  await expect(page.getByTestId('qchat').getByRole('heading', { name: 'Luồng chat nhanh e2e' })).toBeVisible()

  // mở rộng -> trang /chat/<id>, cửa sổ và nút nổi ẩn; quay lại trang khác thì cửa sổ hiện lại
  await page.getByTestId('qchat').getByRole('link', { name: 'Mở rộng' }).click()
  await expect(page).toHaveURL(new RegExp(`/chat/${t.id}$`))
  await expect(page.getByTestId('qchat')).toHaveCount(0)
  await expect(fab).toHaveCount(0)
  await nav(page, 'Việc của tôi').click()
  await expect(page.getByTestId('qchat')).toBeVisible()

  // + mới -> màn chào; thu nhỏ -> chỉ còn nút nổi; mở lại -> vẫn màn chào
  await page.getByTestId('qchat').getByRole('button', { name: 'Cuộc trò chuyện mới' }).click()
  await expect(page.getByTestId('qchat').getByRole('button', { name: 'Trang này dùng thế nào?' })).toBeVisible()
  await page.getByTestId('qchat').getByRole('button', { name: 'Thu nhỏ' }).click()
  await expect(page.getByTestId('qchat')).toHaveCount(0)
  await expect(fab).toBeVisible()
  await fab.click()
  await expect(page.getByTestId('qchat').getByRole('button', { name: 'Trang này dùng thế nào?' })).toBeVisible()

  // điện thoại: cửa sổ chiếm cả màn hình
  await page.setViewportSize({ width: 375, height: 700 })
  const m = await page.getByTestId('qchat').boundingBox()
  expect(m.width).toBe(375)
  expect(m.height).toBeGreaterThanOrEqual(650)
  await page.screenshot({ path: `${E2E_OUT}/chat-nhanh-375.png` })
})
