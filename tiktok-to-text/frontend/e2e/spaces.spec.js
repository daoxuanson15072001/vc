import { test, expect, uid, createUser, pageAs } from './fixtures'

// SCR-19 Kho & chia sẻ: CardGrid hai khu, khung quản lý Drawer ?space= (tab Thông tin · Thành viên · Nguy hiểm),
// hộp Chia sẻ kho (Người · Đơn vị — SCR-19.1 / SYS-35)
const cards = (page) => page.getByTestId('spaces-space-card')

test('tạo kho chia sẻ, mời thành viên, thành viên thấy kho, đổi quyền, công khai, xoá kho', async ({ page, browser }) => {
  const space = `Kho E2E ${uid()}`
  const member = { name: 'Thành viên kho', email: `kho-${uid()}@e2e.test`, password: 'thanhvien-123' }
  await page.goto('/spaces')
  await createUser(page, member)
  await expect(page.getByRole('heading', { level: 1, name: 'Kho & chia sẻ' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /Kho của tôi/ })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: /Được chia sẻ với tôi/ })).toBeVisible()

  // Có sẵn kho cá nhân
  await expect(cards(page).filter({ hasText: 'Kho cá nhân' }).first()).toBeVisible()

  await page.getByTestId('spaces-space-new').click()
  const create = page.getByTestId('spaces-create-modal')
  await create.getByLabel('Tên kho').fill(space)
  await create.getByLabel('Mô tả').fill('Kho do test tạo')
  await create.getByRole('button', { name: 'Tạo kho', exact: true }).click()
  await expect(create).toHaveCount(0)
  const card = cards(page).filter({ hasText: space })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Chủ kho')
  await expect(card).toHaveAttribute('data-status', 'private')
  await expect(card.getByRole('link', { name: `Nạp nguồn vào kho ${space}` })).toHaveAttribute('href', /\/kb\?add=1&space_id=/)

  // Quản lý -> khung ?space=, mời thành viên qua hộp Chia sẻ kho
  await card.getByRole('button', { name: `Quản lý kho ${space}` }).click()
  await expect(page).toHaveURL(/space=/)
  const drawer = page.getByTestId('spaces-drawer')
  await expect(drawer.getByRole('heading', { name: space })).toBeVisible()
  await drawer.getByRole('tab', { name: /Thành viên/ }).click()
  await expect(page).toHaveURL(/tab=members/)
  await drawer.getByTestId('spaces-share-open').click()
  const share = page.getByTestId('spaces-share-modal')
  await share.getByTestId('spaces-share-email').fill(member.email)
  await share.getByTestId('spaces-share-role-editor').check()
  await share.getByTestId('spaces-member-invite').click()
  await expect(share).toHaveCount(0)
  const mRow = drawer.getByTestId('spaces-member-row').filter({ hasText: member.email })
  await expect(mRow).toBeVisible()
  await expect(mRow.getByRole('combobox')).toHaveValue('editor')

  // Mời email không tồn tại -> lỗi trong hộp
  await drawer.getByTestId('spaces-share-open').click()
  await share.getByTestId('spaces-share-email').fill(`khongco-${uid()}@e2e.test`)
  await share.getByTestId('spaces-member-invite').click()
  await expect(share.getByTestId('error-box')).toBeVisible()
  await share.getByRole('button', { name: 'Huỷ' }).click()
  await expect(share).toHaveCount(0)

  // Thành viên đăng nhập thấy kho ở khu được chia sẻ, quyền "được sửa"
  const p = await pageAs(browser, member)
  await p.goto('/spaces')
  const shared = p.getByTestId('spaces-space-card').filter({ hasText: space })
  await expect(shared).toBeVisible()
  await expect(shared).toContainText('Được sửa')
  await expect(shared.getByRole('link', { name: /Nạp nguồn/ })).toBeVisible()

  // Hạ xuống chỉ xem -> thành viên mất nút nạp
  await mRow.getByRole('combobox').selectOption('viewer')
  await expect(mRow.getByRole('combobox')).toHaveValue('viewer')
  await p.reload()
  await expect(shared).toBeVisible()
  await expect(shared.getByRole('link', { name: /Nạp nguồn/ })).toHaveCount(0)

  // Thành viên tự rời kho
  await shared.getByRole('button', { name: `Rời kho: ${space}` }).click()
  await expect(shared).toHaveCount(0)
  await p.context().close()

  // Tab Thông tin: đổi tên, đổi sang công khai (hộp xác nhận nêu hệ quả)
  await drawer.getByRole('tab', { name: 'Thông tin' }).click()
  await drawer.getByTestId('spaces-info-name').fill(`${space} mới`)
  await drawer.getByTestId('spaces-info-save').click()
  const renamed = cards(page).filter({ hasText: `${space} mới` })
  await expect(renamed).toBeVisible()
  await drawer.getByTestId('spaces-visibility').click()
  await expect(renamed).toHaveAttribute('data-status', 'org')
  await expect(renamed).toContainText('Công khai trong công ty')

  // Tab Nguy hiểm: phải gõ đúng tên kho
  await drawer.getByRole('tab', { name: 'Nguy hiểm' }).click()
  const del = drawer.getByTestId('spaces-space-delete')
  await expect(del).toBeDisabled()
  await drawer.getByTestId('spaces-delete-confirm').fill('sai tên')
  await expect(del).toBeDisabled()
  await drawer.getByTestId('spaces-delete-confirm').fill(`${space} mới`)
  await del.click()
  await expect(drawer).toHaveCount(0)
  await expect(renamed).toHaveCount(0)
  await expect(page).not.toHaveURL(/space=/)
})

test('SCR-19.1: chia sẻ kho cho đơn vị (gồm đơn vị con) — người thuộc đơn vị con thấy kho, gỡ đơn vị thì mất', async ({ page, browser }) => {
  const s = uid().toUpperCase()
  const ok = async (r) => { expect(r.ok(), await r.text()).toBeTruthy(); return r.json() }
  await page.goto('/spaces')
  const root = await ok(await page.request.post('/api/org/units', { data: { code: `KHO${s}`, name: `Tập đoàn Kho ${s}`, kind: 'group' } }))
  const dept = await ok(await page.request.post('/api/org/units', { data: { code: `KHO${s}-KD`, name: `Phòng KD Kho ${s}`, kind: 'department', parent_id: root.id } }))
  const member = { name: `Nhân viên ${s}`, email: `nv.kho.${s.toLowerCase()}@e2e.test`, password: 'mat-khau-e2e' }
  const u = await createUser(page, member)
  await ok(await page.request.patch(`/api/org/users/${u.id}`, { data: { unit_ids: [dept.id] } }))
  const space = `Kho đơn vị ${s}`
  const sp = await ok(await page.request.post('/api/spaces', { data: { name: space } }))

  // Người ngoài kho chưa thấy
  const p = await pageAs(browser, member)
  await p.goto('/spaces')
  await expect(p.getByRole('heading', { level: 1, name: 'Kho & chia sẻ' })).toBeVisible()
  await expect(p.getByTestId('spaces-space-card').filter({ hasText: space })).toHaveCount(0)

  // Mở thẳng khung bằng URL, tab Thành viên
  await page.goto(`/spaces?space=${sp.id}&tab=members`)
  const drawer = page.getByTestId('spaces-drawer')
  await expect(drawer.getByTestId('spaces-units-empty')).toBeVisible()
  await drawer.getByTestId('spaces-share-open').click()
  const share = page.getByTestId('spaces-share-modal')
  await share.getByRole('radio', { name: 'Đơn vị' }).click()
  await share.getByTestId('spaces-unit-share').click()
  await expect(share.getByTestId('error-box')).toContainText('Hãy chọn một đơn vị')
  await share.getByTestId('spaces-unit-tree').getByText(root.name, { exact: true }).click()
  await share.getByTestId('spaces-share-children').check()
  await expect(share.getByTestId('spaces-share-picked')).toContainText(root.name)
  await share.getByTestId('spaces-share-role-editor').check()
  await share.getByTestId('spaces-unit-share').click()
  await expect(share).toHaveCount(0)
  const row = drawer.getByTestId('spaces-unit-row').filter({ hasText: root.name })
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute('data-status', 'editor')
  await expect(row.getByTestId('spaces-unit-count')).toHaveText('1 người hiện có · gồm đơn vị con')

  // Người thuộc đơn vị con thấy kho, quyền Sửa
  await p.reload()
  const seen = p.getByTestId('spaces-space-card').filter({ hasText: space })
  await expect(seen).toBeVisible()
  await expect(seen).toContainText('Được sửa')
  await expect(seen.getByRole('link', { name: /Nạp nguồn/ })).toBeVisible()

  // Bỏ "gồm đơn vị con" -> người ở phòng con mất quyền
  await row.getByTestId('spaces-unit-children').click()   // ô điều khiển theo dữ liệu BE: đổi sau khi lưu xong
  await expect(row.getByTestId('spaces-unit-count')).toHaveText('0 người hiện có · không gồm đơn vị con')
  await p.reload()
  await expect(p.getByRole('heading', { level: 1, name: 'Kho & chia sẻ' })).toBeVisible()
  await expect(seen).toHaveCount(0)

  // Bật lại rồi gỡ đơn vị -> mất ngay
  await row.getByTestId('spaces-unit-children').click()
  await expect(row.getByTestId('spaces-unit-count')).toHaveText('1 người hiện có · gồm đơn vị con')
  await p.reload()
  await expect(seen).toBeVisible()
  await row.getByRole('button', { name: `Gỡ đơn vị ${root.name} khỏi kho ${space}` }).click()
  await expect(row).toHaveCount(0)
  await expect(drawer.getByTestId('spaces-units-empty')).toBeVisible()
  await p.reload()
  await expect(p.getByRole('heading', { level: 1, name: 'Kho & chia sẻ' })).toBeVisible()
  await expect(seen).toHaveCount(0)
  await p.context().close()
})
