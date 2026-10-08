import { test, expect, uid, createUser, pageAs } from './fixtures'

test('bình luận, chấm sao thẻ, thả sao bình luận và bảng bình chọn tháng', async ({ page, browser }) => {
  const id = uid()
  const member = { name: `Thành viên ${id}`, email: `m-${id}@e2e.test`, password: 'member-e2e-123' }
  const title = `Thẻ bình chọn ${id}`
  await page.goto('/wiki')
  await createUser(page, member)
  const space = await (await page.request.post('/api/spaces', { data: { name: `Kho chung ${id}`, description: '', visibility: 'private' } })).json()
  expect((await page.request.post(`/api/spaces/${space.id}/members`, { data: { email: member.email, role: 'viewer' } })).ok()).toBeTruthy()
  const card = await (await page.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'lesson', title } })).json()

  // Người viết không tự chấm cho thẻ của mình
  await page.goto(`/wiki?card=${card.id}&ctab=discuss`)
  const drawer = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await expect(drawer.locator('.vote-box').getByText('của bạn')).toBeVisible()
  await expect(drawer.locator('.vote-box').getByRole('radio', { name: '5 sao' })).toBeDisabled()

  // Thành viên (chỉ xem) chấm 4 sao và bình luận
  const other = await pageAs(browser, member)
  await other.goto(`/wiki?card=${card.id}&ctab=discuss`)   // bình luận nằm ở tab Thảo luận
  const od = other.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await od.getByRole('radio', { name: '4 sao' }).click()
  await expect(od.getByText('bạn chấm 4 sao')).toBeVisible()
  await od.getByPlaceholder(/Góp ý/).fill('Áp dụng được cho tổ bán hàng')
  await od.getByRole('button', { name: 'Gửi' }).click()
  await expect(od.locator('.comment', { hasText: 'Áp dụng được cho tổ bán hàng' })).toBeVisible()
  await expect(od.locator('.comment').getByRole('radio', { name: '5 sao' })).toBeDisabled()   // không tự chấm bình luận của mình

  // Người viết thấy bình luận, chấm 3 sao, trả lời nối tiếp
  await page.reload()
  await expect(drawer.getByText('4 sao từ 1 người')).toBeVisible()
  const cmt = drawer.locator('.comment', { hasText: 'Áp dụng được cho tổ bán hàng' })
  await cmt.getByRole('radio', { name: '3 sao' }).click()
  await expect(cmt.getByText('bạn chấm 3 sao')).toBeVisible()
  await cmt.getByRole('button', { name: 'Trả lời' }).click()
  await drawer.getByPlaceholder(/Trả lời Thành viên/).fill('Cảm ơn góp ý')
  await drawer.getByRole('button', { name: 'Trả lời', exact: true }).last().click()
  const reply = drawer.locator('.replies .comment', { hasText: 'Cảm ơn góp ý' })
  await expect(reply).toBeVisible()
  await expect(drawer.getByRole('heading', { name: 'Thảo luận (2)' })).toBeVisible()

  // Thành viên chấm 5 sao cho câu trả lời, rồi trả lời tiếp (cấp 2)
  await other.reload()
  const oreply = od.locator('.replies .comment', { hasText: 'Cảm ơn góp ý' })
  await oreply.getByRole('radio', { name: '5 sao' }).click()
  await expect(oreply.getByText('5 sao từ 1 người')).toBeVisible()
  await oreply.getByRole('button', { name: 'Trả lời' }).click()
  await od.getByPlaceholder(/Trả lời/).fill('Không có gì')
  await od.getByRole('button', { name: 'Trả lời', exact: true }).last().click()
  await expect(od.locator('.replies .replies .comment', { hasText: 'Không có gì' })).toBeVisible()
  await page.reload()
  await expect(drawer.getByRole('heading', { name: 'Thảo luận (3)' })).toBeVisible()
  await drawer.getByRole('button', { name: 'Đóng' }).click()
  await expect(page.getByTestId('wiki-card').filter({ hasText: title })).toContainText('💬 3')

  // (cột hạng là th scope=row nên td bắt đầu từ cột Thành viên)
  // Bảng bình chọn: người viết nhận 4 (thẻ) + 5 (trả lời) = 9 sao; thành viên nhận 3, cho đi 9 sao / 2 lượt, 2 bình luận
  await page.getByTestId('wiki-tab-leaderboard').click()   // tab route của VCWIKI
  await expect(page.getByRole('heading', { name: 'Bình chọn tháng' })).toBeVisible()
  const meRow = page.locator('tbody tr', { hasText: '(bạn)' })
  await expect(meRow.locator('td').nth(1)).toHaveText('★ 9')
  const memberRow = page.locator('tbody tr', { hasText: member.name })
  await expect(memberRow.locator('td').nth(1)).toHaveText('★ 3')
  await expect(memberRow.locator('td').nth(4)).toContainText('9')
  await expect(memberRow.locator('td').nth(5)).toHaveText('2')
  await other.close()
})
