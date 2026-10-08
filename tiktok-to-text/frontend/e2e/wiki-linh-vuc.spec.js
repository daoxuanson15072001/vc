import { test, expect, uid, createUser, pageAs } from './fixtures'

// Cây lĩnh vực sửa ngay trên /wiki — thành viên thường (không phải quản trị viên) thêm / sửa / xoá được
// Sửa cây lĩnh vực nằm ở menu Thêm ▾ của đầu trang (SCR-06)
const openCatEditor = async (pg) => {
  await pg.getByTestId('wiki-more').click()
  await pg.getByTestId('wiki-cats-edit').click()
}

test('thành viên sửa cây lĩnh vực trên /wiki: thêm, nhánh con, đổi tên, xoá nhánh rỗng', async ({ page, browser }) => {
  const u = { email: `lv-${uid()}@e2e.test`, name: 'Thành viên LV', password: 'mat-khau-e2e-1' }
  await page.goto('/wiki')
  await createUser(page, u)
  const p = await pageAs(browser, u)
  const name = `LV E2E ${uid()}`

  await p.goto('/wiki')
  await openCatEditor(p)
  const drawer = p.getByRole('dialog', { name: 'Sửa cây lĩnh vực' })
  await expect(drawer.getByRole('heading', { name: 'Cây lĩnh vực', exact: true })).toBeVisible()
  await expect(drawer.getByLabel('Chủ nhánh')).toHaveCount(0)            // gán chủ nhánh: chỉ quản trị viên

  await drawer.getByRole('button', { name: '+ Lĩnh vực cấp 1' }).click()
  await drawer.getByPlaceholder('Tên lĩnh vực').fill(name)
  await drawer.getByRole('button', { name: 'Thêm', exact: true }).click()
  const row = drawer.locator('.cat-row', { hasText: name }).first()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: '+ Nhánh con' }).click()
  await drawer.getByPlaceholder('Tên lĩnh vực').fill(`${name} con`)
  await drawer.getByRole('button', { name: 'Thêm', exact: true }).click()
  const child = drawer.locator('.cat-row', { hasText: `${name} con` })
  await expect(child).toBeVisible()

  await child.getByRole('button', { name: 'Sửa' }).click()
  const editRow = drawer.locator('.cat-row').filter({ has: p.getByRole('button', { name: 'Lưu' }) })
  await editRow.getByLabel('Tên lĩnh vực').fill(`${name} đổi tên`)
  await editRow.getByRole('button', { name: 'Lưu' }).click()
  const renamed = drawer.locator('.cat-row', { hasText: `${name} đổi tên` })
  await expect(renamed).toBeVisible()

  // cây lọc bên trái cập nhật ngay
  await expect(p.locator('.wiki-side .ui-tree-label', { hasText: `${name} đổi tên` })).toBeVisible()

  // slug (đường dẫn) đổi theo tên mới; link slug cũ tự chuyển sang slug mới
  const cats = await (await p.request.get('/api/categories')).json()
  const moved = cats.find((c) => c.name === `${name} đổi tên`)
  expect(moved.slug).toMatch(/-doi-ten$/)
  await expect(renamed).toContainText(moved.slug)
  await drawer.getByRole('button', { name: 'Đóng' }).click()
  await p.goto(`/wiki?category=${moved.old_slugs[0]}`)
  await expect(p).toHaveURL(new RegExp(`category=${moved.slug.replace(/\./g, '\\.')}`))
  await expect(p.locator('.wiki-side .ui-tree-row.is-on', { hasText: `${name} đổi tên` })).toBeVisible()

  // thu hết / mở hết cây lọc (nhánh đang chọn luôn được mở nên bỏ chọn trước)
  await p.getByRole('button', { name: 'Tất cả lĩnh vực' }).click()
  await p.getByRole('button', { name: '⊟ Thu hết' }).click()
  await expect(p.locator('.wiki-side .ui-tree-label', { hasText: `${name} đổi tên` })).toHaveCount(0)
  await p.getByRole('button', { name: '⊞ Mở hết' }).click()
  await expect(p.locator('.wiki-side .ui-tree-label', { hasText: `${name} đổi tên` })).toBeVisible()
  await openCatEditor(p)

  // khung sửa cây cũng thu / mở được: từng nhánh (▸ / ▾) và cả cây
  await row.getByRole('button', { name: `Thu gọn ${name}` }).click()
  await expect(renamed).toHaveCount(0)
  await row.getByRole('button', { name: `Mở ${name}` }).click()
  await expect(renamed).toBeVisible()
  await drawer.getByRole('button', { name: '⊟ Thu hết' }).click()
  await expect(renamed).toHaveCount(0)
  await drawer.getByRole('button', { name: '⊞ Mở hết' }).click()
  await expect(renamed).toBeVisible()

  await renamed.getByRole('button', { name: 'Xoá' }).click()             // hộp xác nhận trong app tự đồng ý (fixtures)
  await expect(renamed).toHaveCount(0)
  await row.getByRole('button', { name: 'Xoá' }).click()
  await expect(drawer.locator('.cat-row', { hasText: name })).toHaveCount(0)

  await drawer.getByRole('button', { name: 'Đóng' }).click()
  await expect(p.locator('.wiki-side .ui-tree-label', { hasText: name })).toHaveCount(0)
  await p.context().close()
})

test('xoá nhóm cấp 1 còn thẻ: chọn nhánh nhận, thẻ chuyển sang, cả nhóm và nhánh con bị xoá', async ({ page }) => {
  const s = uid()
  await page.goto('/wiki')
  const mk = async (data) => (await page.request.post('/api/categories', { data })).json()
  const root = await mk({ name: `Nhóm xoá ${s}` })
  const child = await mk({ name: `Con xoá ${s}`, parent_id: root.id })
  const dest = await mk({ name: `Nhóm nhận ${s}` })
  const spaces = await (await page.request.get('/api/spaces')).json()
  const personal = (spaces.items || spaces).find((x) => x.type === 'personal')
  const card = await (await page.request.post('/api/wiki/cards', {
    data: { space_id: personal.id, type: 'concept', title: `Thẻ chuyển ${s}`, summary: 't', categories: [child.slug] },
  })).json()

  await page.reload()
  await openCatEditor(page)
  const drawer = page.getByRole('dialog', { name: 'Sửa cây lĩnh vực' })
  const row = drawer.locator('.cat-row', { hasText: `Nhóm xoá ${s}` }).first()
  await row.getByRole('button', { name: /^Xoá nhánh / }).click()
  const box = drawer.locator('.cat-delete')
  await expect(box).toContainText('cùng 1 nhánh con')
  // không chọn nhánh nhận -> server báo còn thẻ
  await box.getByRole('button', { name: 'Xoá cả nhánh' }).click()
  await expect(drawer.locator('.error-box')).toContainText('1 thẻ')
  await box.getByLabel('Nhánh nhận dữ liệu').selectOption(dest.slug)
  await box.getByRole('button', { name: 'Xoá cả nhánh' }).click()
  await expect(drawer.locator('.cat-row', { hasText: `xoá ${s}` })).toHaveCount(0)
  expect((await (await page.request.get(`/api/wiki/cards/${card.id}`)).json()).categories).toEqual([dest.slug])
  await page.request.delete(`/api/wiki/cards/${card.id}`)
  await page.request.delete(`/api/categories/${dest.id}`)
})
