// Lỗi QA đợt 2 — Tổ chức: B4 cho đi làm lại, B7 vai trò sắp hiệu lực, U2 hiện lại cả nhánh, U5 cột lỗi nhập Excel.
// Giao diện UI-3 (DESIGN V.7 SCR-18): cây role=tree, thao tác đơn vị trong menu Thêm ▾, bảng người / vai trò DataTable.
import AxeBuilder from '@axe-core/playwright'
import { test, expect, uid } from './fixtures'

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const unitItem = (page, name) => page.getByTestId('org-tree').getByRole('treeitem', { name: new RegExp(`^${esc(name)}\\b`) })
const unitRow = (page, name) => unitItem(page, name).locator(':scope > .ui-tree-row')
const tab = (page, name) => page.getByRole('tab', { name, exact: true })

test('QA ORG: người đã nghỉ được cho đi làm lại; vai trò sắp hiệu lực hiện kèm nhãn; hiện lại cha hỏi hiện cả nhánh', async ({ page }) => {
  test.setTimeout(60_000)
  const s = uid().toUpperCase()
  const root = await ok(await page.request.post('/api/org/units', { data: { code: `QA${s}`, name: `Tập đoàn QA ${s}`, kind: 'group' } }))
  const dept = await ok(await page.request.post('/api/org/units', { data: { code: `QA${s}-KD`, name: `Phòng KD QA ${s}`, kind: 'department', parent_id: root.id } }))
  const person = await ok(await page.request.post('/api/users', { data: { name: `Người nghỉ ${s}`, email: `nghi.${s.toLowerCase()}@e2e.test`, password: 'mat-khau-e2e' } }))
  await ok(await page.request.patch(`/api/org/users/${person.id}`, { data: { unit_ids: [dept.id] } }))
  await ok(await page.request.post(`/api/org/users/${person.id}/offboard`, { data: {} }))

  // B4: người đã nghỉ -> nút "Cho đi làm lại" -> hết nhãn "Đã nghỉ", có lại "Sửa hồ sơ"
  await page.goto('/org')
  await unitRow(page, `Phòng KD QA ${s}`).click()
  await expect(page).toHaveURL(new RegExp(`[?&]unit=${dept.id}`))
  const row = page.getByTestId('org-person-row').filter({ hasText: person.email })
  await expect(row).toHaveAttribute('data-status', 'left')
  await expect(row).toContainText('Đã nghỉ')
  await expect(row.getByRole('button', { name: /^Sửa hồ sơ/ })).toHaveCount(0)
  await row.getByRole('button', { name: /^Cho đi làm lại/ }).click()
  await expect(page.getByTestId('toast').filter({ hasText: `Người nghỉ ${s} đã đi làm lại` })).toBeVisible()
  await expect(row).not.toContainText('Đã nghỉ')
  await expect(row.getByRole('button', { name: /^Sửa hồ sơ/ })).toBeVisible()
  const [back] = await ok(await page.request.get(`/api/users?q=${encodeURIComponent(person.email)}`))
  expect(back.active).toBe(true)
  expect(back.org.status).toBe('active')

  // B7: vai trò bắt đầu ở tương lai hiện trong danh sách mặc định, có nhãn
  const from = new Date(Date.now() + 3 * 86400_000).toISOString()
  await ok(await page.request.post('/api/org/grants', { data: { user_id: person.id, role: 'editor', valid_from: from } }))
  await tab(page, 'Vai trò chức năng').click()
  const g = page.getByTestId('org-grant-row').filter({ hasText: `Người nghỉ ${s}` })
  await expect(g).toHaveAttribute('data-status', 'upcoming')
  await expect(g).toContainText('Biên tập viên')
  await expect(g).toContainText('Sắp hiệu lực từ')
  await g.getByTestId('org-grant-more').click()
  await expect(page.getByRole('menuitem', { name: 'Thu hồi vai trò…' })).toBeVisible()
  await page.keyboard.press('Escape')

  // U2: ẩn một nhánh không có người, hiện lại cha (menu Thêm ▾) -> hỏi (tự đồng ý) -> đơn vị con cũng hiện
  const root2 = await ok(await page.request.post('/api/org/units', { data: { code: `QB${s}`, name: `Tập đoàn QB ${s}`, kind: 'group' } }))
  await ok(await page.request.post('/api/org/units', { data: { code: `QB${s}-X`, name: `Phòng X ${s}`, kind: 'department', parent_id: root2.id } }))
  await ok(await page.request.patch(`/api/org/units/${root2.id}`, { data: { active: false } }))
  await tab(page, 'Sơ đồ').click()
  const child = unitRow(page, `Phòng X ${s}`)
  await expect(child).toContainText('Đã ẩn')
  await unitRow(page, `Tập đoàn QB ${s}`).click()
  await page.getByTestId('org-unit-more').click()
  await page.getByTestId('org-unit-show').click()
  await expect(child).not.toContainText('Đã ẩn')
  await expect(unitRow(page, `Tập đoàn QB ${s}`)).not.toContainText('Đã ẩn')
})

test('QA ORG: cây đơn vị đi bằng bàn phím, đơn vị chọn lên URL, dán link mở đúng đơn vị + hồ sơ', async ({ page }) => {
  const s = uid().toUpperCase()
  const root = await ok(await page.request.post('/api/org/units', { data: { code: `KB${s}`, name: `Tập đoàn KB ${s}`, kind: 'group' } }))
  const dept = await ok(await page.request.post('/api/org/units', { data: { code: `KB${s}-A`, name: `Phòng A ${s}`, kind: 'department', parent_id: root.id } }))
  const person = await ok(await page.request.post('/api/users', { data: { name: `Người KB ${s}`, email: `kb.${s.toLowerCase()}@e2e.test`, password: 'mat-khau-e2e' } }))
  await ok(await page.request.patch(`/api/org/users/${person.id}`, { data: { unit_ids: [dept.id], position: 'Kỹ thuật viên' } }))

  await page.goto(`/org?unit=${root.id}`)
  const rootItem = unitItem(page, `Tập đoàn KB ${s}`)
  await expect(rootItem).toHaveAttribute('aria-selected', 'true')
  await rootItem.focus()
  await page.keyboard.press('ArrowDown')                                                 // xuống đơn vị con
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`[?&]unit=${dept.id}`))
  await expect(page.getByTestId('org-unit-panel').getByRole('heading', { name: `Phòng A ${s}` })).toBeVisible()

  // Tên người là link ?person= → Drawer hồ sơ; Quay lại đóng Drawer
  await page.getByTestId('org-person-row').filter({ hasText: person.email }).getByRole('link', { name: new RegExp(`Người KB ${s}`) }).click()
  const drawer = page.getByRole('dialog', { name: `Người KB ${s}` })
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('Kỹ thuật viên')
  await expect(page).toHaveTitle(new RegExp(`Người KB ${s}`))
  await page.goBack()
  await expect(drawer).toHaveCount(0)

  // Dán link có sẵn ?unit=&person= → mở đúng
  await page.goto(`/org?unit=${dept.id}&person=${person.id}`)
  await expect(page.getByRole('dialog', { name: `Người KB ${s}` })).toBeVisible()
})

test('QA ORG: bảng xem trước nhập Excel đưa cột Kết quả (lỗi) lên đầu', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto('/org?tab=import')
  await page.getByLabel('File Excel / CSV').setInputFiles({
    name: 'x.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Email,Họ tên,Mã đơn vị\nkhong-hop-le,Ai đó,KHONG-CO\n'),
  })
  await page.getByRole('button', { name: 'Xem trước' }).click()
  const preview = page.locator('.import-preview')
  await expect(preview.locator('th').nth(1)).toHaveText('Kết quả')
  const err = preview.getByText('Email không hợp lệ')
  await expect(err).toBeVisible()
  const box = await err.boundingBox()
  expect(box.x + box.width).toBeLessThanOrEqual(400)          // thấy lỗi mà không phải cuộn ngang
})

test('QA ORG: dán bảng CSV thay cho chọn file (AIX-09)', async ({ page }) => {
  await page.goto('/org?tab=import')
  await page.getByTestId('org-import-paste').fill('Email,Họ tên,Mã đơn vị\nkhong-hop-le,Ai đó,KHONG-CO')
  await page.getByTestId('org-import-preview').click()
  await expect(page.getByTestId('org-import-row')).toHaveCount(1)
  await expect(page.getByTestId('org-import-row').first()).toHaveAttribute('data-status', 'error')
})

// Trợ năng (SCR-18, DESIGN V.9.4): mọi tab + cây có dữ liệu + Drawer hồ sơ (xem, sửa) + Modal đơn vị: 0 critical / serious
test('QA ORG: axe 0 lỗi critical / serious ở các tab, hồ sơ người và hộp sửa đơn vị', async ({ page }) => {
  test.setTimeout(90_000)
  const s = uid().toUpperCase()
  const root = await ok(await page.request.post('/api/org/units', { data: { code: `AX${s}`, name: `Tập đoàn AX ${s}`, kind: 'group' } }))
  const person = await ok(await page.request.post('/api/users', { data: { name: `Người AX ${s}`, email: `ax.${s.toLowerCase()}@e2e.test`, password: 'mat-khau-e2e' } }))
  await ok(await page.request.patch(`/api/org/users/${person.id}`, { data: { unit_ids: [root.id] } }))
  const bad = async (what) => {
    await page.waitForLoadState('networkidle').catch(() => {})
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    const v = r.violations.filter((x) => ['critical', 'serious'].includes(x.impact)).map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    expect(v, what).toEqual([])
  }
  for (const t of ['tree', 'mine', 'functions', 'levels', 'grants', 'import']) {
    await page.goto(`/org?tab=${t}&unit=${root.id}`)
    await expect(page.getByRole('tab', { selected: true })).toBeVisible()
    await bad(`tab ${t}`)
  }
  await page.goto(`/org?unit=${root.id}&person=${person.id}`)
  await expect(page.getByTestId('org-person-drawer')).toBeVisible()
  await bad('hồ sơ người')
  await page.goto(`/org?unit=${root.id}&person=${person.id}&edit=1`)
  await expect(page.getByTestId('org-profile-form')).toBeVisible()
  await bad('sửa hồ sơ người')
  await page.goto(`/org?unit=${root.id}`)
  await page.getByTestId('org-unit-more').click()
  await page.getByTestId('org-unit-edit').click()
  await expect(page.getByTestId('org-unit-modal')).toBeVisible()
  await bad('sửa đơn vị')
})
