// Thẻ VCWIKI mở dạng Drawer (SCR-06, ngăn kéo phải): Esc / bấm nền mờ để đóng, khoá cuộn trang phía sau;
// nút Toàn màn hình (nhớ lựa chọn); ≤ 640 px phủ kín màn hình.
import { test, expect, uid } from './fixtures'
import { E2E_OUT } from './fixtures'

test('thẻ tri thức mở dạng Drawer sát mép phải, Esc để đóng, 375 px phủ kín', async ({ page }) => {
  const s = uid()
  await page.goto('/')
  const spaces = await (await page.request.get('/api/spaces')).json()
  const personal = (spaces.items || spaces).find((x) => x.type === 'personal')
  const card = await (await page.request.post('/api/wiki/cards', {
    data: { space_id: personal.id, type: 'concept', title: `Popup ${s}`, summary: 'Tóm tắt', body: 'Nội dung **thẻ**' },
  })).json()

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/wiki?card=${card.id}`)
  const dlg = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await expect(dlg).toBeVisible()
  await expect(dlg.getByRole('heading', { name: `Popup ${s}` })).toBeVisible()
  await page.waitForTimeout(250)                                  // hết hiệu ứng mở
  const box = await dlg.boundingBox()
  expect(Math.abs(box.x + box.width - 1280)).toBeLessThan(4)       // Drawer (SCR-06): sát mép phải, cao kín màn hình
  expect(box.x).toBeGreaterThan(0)
  expect(box.y).toBe(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  await page.screenshot({ path: `${E2E_OUT}/card-modal-desktop.png` })
  await page.keyboard.press('Escape')
  await expect(dlg).toHaveCount(0)
  await expect(page).not.toHaveURL(/card=/)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')

  // bấm nền mờ cũng đóng
  await page.goto(`/wiki?card=${card.id}`)
  await expect(dlg).toBeVisible()
  await page.mouse.click(10, 10)
  await expect(dlg).toHaveCount(0)

  // nút Toàn màn hình: phủ kín cửa sổ, mở thẻ lần sau vẫn nhớ; Thu nhỏ để về popup
  await page.goto(`/wiki?card=${card.id}`)
  await dlg.getByRole('button', { name: 'Toàn màn hình' }).click()
  let f = await dlg.boundingBox()
  expect([f.x, f.y, Math.round(f.width), Math.round(f.height)]).toEqual([0, 0, 1280, 800])
  await page.reload()
  await expect(dlg.getByRole('button', { name: 'Thu nhỏ' })).toBeVisible()
  f = await dlg.boundingBox()
  expect(Math.round(f.width)).toBe(1280)
  await dlg.getByRole('button', { name: 'Thu nhỏ' }).click()
  await page.waitForTimeout(250)
  f = await dlg.boundingBox()
  expect(f.x).toBeGreaterThan(0)
  await page.keyboard.press('Escape')

  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(`/wiki?card=${card.id}`)
  await expect(dlg).toBeVisible()
  await page.waitForTimeout(250)                                  // hết hiệu ứng trượt vào
  const m = await dlg.boundingBox()
  expect(m.x).toBe(0)
  expect(Math.round(m.width)).toBe(375)
  await page.screenshot({ path: `${E2E_OUT}/card-modal-375.png` })
  await page.request.delete(`/api/wiki/cards/${card.id}`)
})

test('chi tiết nguồn Kho tư liệu mở dạng ngăn kéo phải (SCR-03 Drawer), nút toàn màn hình, Esc để đóng', async ({ page }) => {
  const url = `https://example.com/e2e-popup-${uid()}`
  await page.goto('/')
  const { created } = await (await page.request.post('/api/kb/sources/links', { data: { urls: [url] } })).json()

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/kb?source=${created[0]}`)
  const dlg = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  await expect(dlg).toBeVisible()
  await page.waitForTimeout(250)
  let box = await dlg.boundingBox()
  expect(Math.round(box.x + box.width)).toBe(1280)   // sát mép phải, danh sách nguồn vẫn ở phía sau
  expect(box.x).toBeGreaterThan(0)
  await dlg.getByRole('button', { name: 'Toàn màn hình' }).click()
  box = await dlg.boundingBox()
  expect([box.x, box.y, Math.round(box.width), Math.round(box.height)]).toEqual([0, 0, 1280, 800])
  await page.screenshot({ path: `${E2E_OUT}/source-modal-full.png` })
  await dlg.getByRole('button', { name: 'Thu nhỏ' }).click()
  await page.keyboard.press('Escape')
  await expect(dlg).toHaveCount(0)
  await expect(page).not.toHaveURL(/source=/)
  await page.request.delete(`/api/kb/sources/${created[0]}`)
})
