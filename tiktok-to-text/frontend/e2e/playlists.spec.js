import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { test, expect, uid, createUser, pageAs, nav } from './fixtures'

// Giọng đọc thật gọi dịch vụ ngoài (chậm, cần mạng) -> thay bằng mp3 im lặng 1 giây
const SILENT = '../output/e2e/silent.mp3'
function silentMp3() {
  if (!existsSync(SILENT)) {
    mkdirSync('../output/e2e', { recursive: true })
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '1', '-q:a', '9', SILENT])
  }
  return SILENT
}

async function makeCards(page, prefix, n) {
  const spaces = await (await page.request.get('/api/spaces')).json()
  const personal = spaces.find((s) => s.type === 'personal' && s.my_role === 'owner')
  const cards = []
  for (let i = 1; i <= n; i++) {
    const res = await page.request.post('/api/wiki/cards', {
      data: { space_id: personal.id, type: 'framework', title: `${prefix} thẻ ${i}`, summary: `Tóm tắt ${i}`, body: `Nội dung ${i}` },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    cards.push(await res.json())
  }
  return cards
}

test('danh sách phát: thêm thẻ, phát tự chuyển thẻ, đổi thứ tự, bỏ thẻ, chia sẻ, xoá', async ({ page, browser }) => {
  const prefix = `PL ${uid()}`
  const [c1, c2, c3] = await makeCards(page, prefix, 3)
  const listName = `Nghe ${uid()}`
  await page.route('**/api/wiki/cards/*/audio*', (r) => r.fulfill({ path: silentMp3(), contentType: 'audio/mpeg' }))

  // Thêm thẻ 1 vào danh sách mới ngay trong khung thẻ
  await page.goto(`/wiki?card=${c1.id}`)
  const drawer = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  const plDlg = page.getByRole('dialog', { name: 'Thêm vào danh sách phát' })   // Modal mở từ hàng tương tác của thẻ
  await drawer.getByRole('button', { name: 'Danh sách phát: thêm / bỏ thẻ này' }).click()
  await plDlg.getByPlaceholder('Tên danh sách mới').fill(listName)
  await plDlg.getByRole('button', { name: 'Tạo', exact: true }).click()
  const row = plDlg.locator('.pl-add-row', { hasText: listName })
  await expect(row.locator('input')).toBeChecked()

  // Thẻ 2: tick vào danh sách vừa tạo
  await page.goto(`/wiki?card=${c2.id}`)
  await drawer.getByRole('button', { name: 'Danh sách phát: thêm / bỏ thẻ này' }).click()
  await plDlg.locator('.pl-add-row', { hasText: listName }).locator('input').check()
  await expect(plDlg.locator('.pl-add-row', { hasText: listName })).toContainText('2')

  // Trang danh sách -> trình phát
  await expect(page.getByTestId('wiki-tab-playlists')).toHaveAttribute('href', '/playlists')   // tab route của VCWIKI
  await page.goto('/playlists')
  await expect(nav(page, 'VCWIKI')).toHaveClass(/active/)
  await page.locator('.pl-tile', { hasText: listName }).click()
  const queue = page.locator('.queue li')
  await expect(queue).toHaveCount(2)
  await expect(page.locator('.player-card h1')).toHaveText(c1.title)

  // Phát: hết thẻ 1 tự sang thẻ 2, hết thẻ 2 thì dừng (không lặp)
  await page.locator('.player-play').click()
  await expect(page.locator('.player-card h1')).toHaveText(c2.title, { timeout: 10_000 })
  await expect(queue.nth(1)).toHaveClass(/current/)
  await expect(page.locator('.player-play')).toHaveText('▶', { timeout: 10_000 })

  // Bấm thẻ trong hàng đợi để chuyển; ⏮ / ⏭
  await queue.nth(0).locator('.queue-item').click()
  await expect(page.locator('.player-card h1')).toHaveText(c1.title)
  await page.locator('.player-play').click()   // dừng
  await page.getByTitle('Thẻ kế (Shift+N)').click()
  await expect(page.locator('.player-card h1')).toHaveText(c2.title)

  // Đổi thứ tự (lưu lại sau khi tải lại trang)
  await queue.nth(0).hover()
  await queue.nth(0).getByTitle('Xuống').click()
  await expect(queue.nth(0)).toContainText(c2.title)
  await page.reload()
  await expect(page.locator('.queue li').nth(0)).toContainText(c2.title)

  // Bỏ một thẻ
  await page.locator('.queue li').nth(1).hover()
  await page.locator('.queue li').nth(1).getByTitle('Bỏ khỏi danh sách').click()
  await expect(page.locator('.queue li')).toHaveCount(1)

  // Chia sẻ công khai
  await page.locator('.player-queue').getByRole('button', { name: 'Sửa' }).click()
  await page.locator('.player-queue').getByLabel('Ai xem được').selectOption('public')
  await page.locator('.player-queue').getByRole('button', { name: 'Lưu' }).click()
  await expect(page.locator('.player-queue')).toContainText('🌐 Công khai')
  const url = page.url()

  // Người khác: thấy trong mục công khai, không sửa được; thẻ trong kho riêng của chủ bị ẩn
  const other = { name: 'Người nghe', email: `nghe-${uid()}@e2e.test`, password: 'nghe-e2e-123' }
  await createUser(page, other)
  const p2 = await pageAs(browser, other)
  await p2.goto('/playlists')
  await expect(p2.locator('.pl-tile', { hasText: listName })).toBeVisible()
  await p2.goto(url)
  await expect(p2.locator('.player-queue')).toContainText('1 thẻ bị ẩn')
  await expect(p2.locator('.player-queue').getByRole('button', { name: 'Xoá danh sách' })).toHaveCount(0)
  await p2.context().close()

  // Lưu kết quả lọc của VCWIKI thành danh sách
  const filtered = `Lọc ${uid()}`
  await page.goto('/wiki')
  await page.getByPlaceholder(/Tìm trong thẻ/).fill(prefix)
  await expect(page.getByTestId('wiki-card')).toHaveCount(3)
  const shown = await page.getByTestId('wiki-card').getByRole('heading').allInnerTexts()   // giữ đúng thứ tự đang hiện
  await page.getByTestId('wiki-more').click()
  await page.getByTestId('wiki-playlist-save').click()
  await page.getByTestId('confirm-input').fill(filtered)   // hộp nhập tên trong app (không phải window.prompt)
  await page.getByTestId('confirm-ok').click()
  await expect(page.locator('.player-queue h2')).toHaveText(filtered)
  await expect(page.locator('.queue .queue-item .strong')).toHaveText(shown)
  expect([...shown].sort()).toEqual([c1.title, c2.title, c3.title])

  // Xoá danh sách -> về trang danh sách
  await page.locator('.player-queue').getByRole('button', { name: 'Xoá danh sách' }).click()
  await expect(page).toHaveURL(/\/playlists$/)
  await expect(page.locator('.pl-tile', { hasText: filtered })).toHaveCount(0)
  await expect(page.locator('.pl-tile', { hasText: listName })).toBeVisible()
})
