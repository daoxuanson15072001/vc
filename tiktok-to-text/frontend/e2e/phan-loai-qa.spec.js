// Sửa lỗi QA Phân loại v2 (qa1: P1, P9, P10) — thẻ gắn nhánh đã ẩn vẫn sửa được, bộ lọc nhiều giá trị trên URL,
// bước quy trình ngoài danh sách không mất khi sửa trên web.
import { test, expect, uid } from './fixtures'

async function newCard(page, body) {
  const r = await page.request.post('/api/wiki/cards', { data: { type: 'sop', ...body } })
  expect(r.ok(), await r.text()).toBeTruthy()
  return r.json()
}

test('thẻ gắn nhánh đã ẩn vẫn sửa và lưu được (P1)', async ({ page }) => {
  const u = uid()
  await page.goto('/wiki')
  const cat = await page.request.post('/api/categories', { data: { name: `Nhánh ẩn ${u}`, slug: `an${u}` } })
  expect(cat.ok(), await cat.text()).toBeTruthy()
  const card = await newCard(page, { title: `Thẻ nhánh ẩn ${u}`, categories: [`an${u}`] })
  expect((await page.request.patch(`/api/categories/${(await cat.json()).id}`, { data: { active: false } })).ok()).toBeTruthy()

  await page.goto(`/wiki?card=${card.id}`)
  const drawer = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await drawer.getByRole('button', { name: 'Sửa' }).click()
  await drawer.getByLabel('Tóm tắt').fill('Sửa sau khi ẩn nhánh')
  await drawer.getByRole('button', { name: 'Lưu' }).click()
  await expect(drawer.getByRole('button', { name: 'Sửa' })).toBeVisible()
  const saved = await (await page.request.get(`/api/wiki/cards/${card.id}`)).json()
  expect(saved.summary).toBe('Sửa sau khi ẩn nhánh')
  expect(saved.categories).toEqual([`an${u}`])
})

test('URL lọc nhiều giá trị hiện đúng trên ô chọn (P9)', async ({ page }) => {
  const u = uid()
  await newCard(page, { title: `Lọc nhiều ${u} A`, level: 'thuc-thi' })
  await newCard(page, { title: `Lọc nhiều ${u} B`, level: 'van-hanh' })
  await newCard(page, { title: `Lọc nhiều ${u} C`, level: 'dieu-hanh' })
  await page.goto(`/wiki?q=${encodeURIComponent(`Lọc nhiều ${u}`)}&level=thuc-thi,van-hanh`)
  await expect(page.getByTestId('wiki-card')).toHaveCount(2)
  const level = page.getByRole('combobox', { name: 'Cấp độ' })
  await expect(level.locator('option:checked')).toHaveText(/Nhiều giá trị: Thực thi.*Vận hành/)
  await level.selectOption('')
  await expect(page.getByTestId('wiki-card')).toHaveCount(3)
})

test('bước quy trình ngoài danh sách không mất khi sửa trên web (P10)', async ({ page }) => {
  const u = uid()
  const card = await newCard(page, { title: `Bước lạ ${u}`, process_steps: ['qt.khong-mo.a', 'qt.mua-hang.b'] })
  await page.goto(`/wiki?card=${card.id}`)
  const drawer = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await drawer.getByRole('button', { name: 'Sửa' }).click()
  const steps = drawer.getByLabel(/Bước quy trình/)
  await expect(steps.locator('option:checked')).toHaveCount(2)
  await expect(steps.locator('option', { hasText: 'chuỗi ngoài danh sách' })).toHaveCount(1)
  await drawer.getByLabel('Tóm tắt').fill('Giữ bước lạ')
  await drawer.getByRole('button', { name: 'Lưu' }).click()
  await expect(drawer.getByRole('button', { name: 'Sửa' })).toBeVisible()
  const saved = await (await page.request.get(`/api/wiki/cards/${card.id}`)).json()
  expect(saved.process_steps).toEqual(['qt.khong-mo.a', 'qt.mua-hang.b'])
})

test('cây lĩnh vực: lỗi hiện cạnh chỗ thao tác, tiếng Việt; cha ẩn thì con không hiện được; hiện cha thì con hiện lại (P2, P3, P5)', async ({ page }) => {
  const u = uid()
  await page.goto('/admin')
  const cha = await (await page.request.post('/api/categories', { data: { name: `Cha ${u}`, slug: `cha${u}` } })).json()
  await page.request.post('/api/categories', { data: { name: `Con ${u}`, slug: `cha${u}.con`, parent_id: cha.id } })
  await page.getByRole('tab', { name: 'Lĩnh vực' }).click()
  const row = page.locator('.cat-row', { hasText: `Cha ${u}` })
  const child = page.locator('.cat-row', { hasText: `Con ${u}` })

  // slug trùng: lỗi nằm ngay dưới form, trong màn hình
  await row.getByRole('button', { name: '+ Nhánh con' }).click()
  await page.getByPlaceholder('Tên lĩnh vực').fill('Trùng')
  await page.getByPlaceholder(/Slug/).fill(`cha${u}.con`)
  await page.getByRole('button', { name: 'Thêm', exact: true }).click()
  await expect(page.locator('.error-box', { hasText: 'đã có trong cây' })).toBeInViewport()
  await page.getByRole('button', { name: 'Huỷ' }).click()

  // tên rỗng khi sửa -> thông báo tiếng Việt, không phải lỗi Pydantic tiếng Anh
  await child.getByRole('button', { name: 'Sửa' }).click()
  const editRow = page.locator('.cat-row').filter({ has: page.getByRole('button', { name: 'Lưu' }) })
  await editRow.locator('input').first().fill('')
  await editRow.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.locator('.error-box')).toContainText('Tên: không được để trống')
  await editRow.getByRole('button', { name: 'Huỷ' }).click()

  await row.getByRole('button', { name: 'Ẩn' }).click()
  await expect(child.getByText('Đã ẩn')).toBeVisible()
  await expect(child.getByRole('button', { name: 'Hiện' })).toHaveCount(0)
  await expect(child.getByText('Cha đang ẩn')).toBeVisible()
  await row.getByRole('button', { name: 'Hiện' }).click()
  await expect(child.getByText('Đã ẩn')).toHaveCount(0)
})
