// Cơ cấu tổ chức — luồng A (docs/BA.md mục 15: ORG-01…04, 06…08, 14; DESIGN V.7 SCR-18)
// Giao diện UI-3: tab ?tab=, cây đơn vị (role=tree, ?unit=), thao tác đơn vị trong menu Thêm ▾, thêm / sửa đơn vị
// trong Modal, hồ sơ người trong Drawer ?person=, phản hồi qua toast.
import { test, expect, uid, ADMIN, pageAs, nav } from './fixtures'

const csvFile = (text) => ({ name: 'nhan_su.csv', mimeType: 'text/csv', buffer: Buffer.from(text) })
const HEADER = 'Email,Họ tên,Mã đơn vị,Chức năng,Email quản lý,Email quản lý chuyên môn,Chức danh\n'
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Hàng (không gồm nhánh con) của một đơn vị trong cây, tìm theo tên
const unitRow = (page, name) => page.getByTestId('org-tree')
  .getByRole('treeitem', { name: new RegExp(`^${esc(name)}\\b`) }).locator(':scope > .ui-tree-row')
const tab = (page, name) => page.getByRole('tab', { name, exact: true })
const toast = (page, text) => page.getByTestId('toast').filter({ hasText: text })
async function unitMenu(page, testId) {
  await page.getByTestId('org-unit-more').click()
  await page.getByTestId(testId).click()
}

test('QT dựng cây đơn vị → nhập Excel (xem trước, xác nhận) → nhân viên thấy quản lý → cấp vai trò → nghỉ việc', async ({ page, browser }) => {
  test.setTimeout(90_000)            // luồng dài: dựng cây, nhập, đăng nhập người mới, cấp vai trò, nghỉ việc
  const s = uid().toUpperCase()
  const root = `E2E${s}`
  const div = `${root}-KD`
  const tp = { name: `Trưởng phòng ${s}`, email: `tp.${s.toLowerCase()}@e2e.test` }
  const nv = { name: `Nhân viên ${s}`, email: `nv.${s.toLowerCase()}@e2e.test` }

  await page.goto('/')
  await nav(page, 'Cơ cấu tổ chức').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Cơ cấu tổ chức' })).toBeVisible()
  await expect(tab(page, 'Sơ đồ')).toHaveAttribute('aria-selected', 'true')           // QT mở mặc định ở Sơ đồ

  // ORG-01: tạo Tập đoàn (Modal) rồi đơn vị con (menu Thêm ▾ của đơn vị đang chọn)
  await page.getByTestId('org-root-add').click()
  const modal = page.getByTestId('org-unit-modal')
  await modal.getByLabel('Mã đơn vị').fill(root)
  await modal.getByLabel('Tên đơn vị').fill(`Tập đoàn ${s}`)
  await modal.getByTestId('org-unit-save').click()
  await expect(modal).toHaveCount(0)
  await expect(toast(page, `Đã thêm đơn vị Tập đoàn ${s}`)).toBeVisible()
  await expect(page).toHaveURL(/[?&]unit=/)                                            // đơn vị vừa tạo được chọn, lên URL
  await expect(page.getByTestId('org-unit-panel').getByRole('heading', { name: `Tập đoàn ${s}` })).toBeVisible()
  await expect(unitRow(page, `Tập đoàn ${s}`)).toHaveClass(/is-on/)

  await unitMenu(page, 'org-unit-add')
  await modal.getByLabel('Mã đơn vị').fill(div)
  await modal.getByLabel('Tên đơn vị').fill(`Phòng Kinh doanh ${s}`)
  await modal.getByLabel('Loại đơn vị').selectOption('department')
  await modal.getByTestId('org-unit-save').click()
  await expect(unitRow(page, `Phòng Kinh doanh ${s}`)).toBeVisible()
  // Mã trùng -> toast lỗi, Modal vẫn mở
  await unitRow(page, `Tập đoàn ${s}`).click()
  await unitMenu(page, 'org-unit-add')
  await modal.getByLabel('Mã đơn vị').fill(div)
  await modal.getByLabel('Tên đơn vị').fill('Trùng mã')
  await modal.getByTestId('org-unit-save').click()
  await expect(toast(page, 'đã được dùng')).toBeVisible()
  await modal.getByRole('button', { name: 'Huỷ' }).click()
  await expect(modal).toHaveCount(0)

  // ORG-04: xem trước báo lỗi từng dòng, còn lỗi thì không xác nhận được
  await tab(page, 'Nhập dữ liệu').click()
  await expect(page).toHaveURL(/tab=import/)
  await page.getByLabel('File Excel / CSV').setInputFiles(csvFile(`${HEADER}${nv.email},${nv.name},KHONG-CO-${s},,,,\n`))
  await page.getByRole('button', { name: 'Xem trước' }).click()
  const preview = page.locator('.import-preview')
  await expect(preview).toContainText(`KHONG-CO-${s} không có`)
  await expect(page.getByRole('button', { name: 'Xác nhận nhập' })).toBeDisabled()

  // File đúng: quản lý nằm ngay trong file, quản lý của quản lý là tài khoản đã có (admin)
  const good = `${HEADER}${nv.email},${nv.name},${div},,${tp.email},,Nhân viên kinh doanh\n` +
    `${tp.email},${tp.name},${div},,${ADMIN.email},,Trưởng phòng\n`
  await page.getByLabel('File Excel / CSV').setInputFiles(csvFile(good))
  await page.getByRole('button', { name: 'Xem trước' }).click()
  await expect(preview).toContainText('2 tạo mới')
  await expect(preview.getByText('Tạo mới', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Xác nhận nhập' }).click()
  const done = page.locator('.import-done')
  await expect(done).toContainText('2 tài khoản mới')
  const password = (await done.locator('tr', { hasText: nv.email }).locator('td.mono').textContent()).trim()
  expect(password.length).toBeGreaterThan(8)

  // Chạy lại cùng file: không tạo trùng
  await page.getByLabel('File Excel / CSV').setInputFiles(csvFile(good))
  await page.getByRole('button', { name: 'Xem trước' }).click()
  await expect(preview).toContainText('0 tạo mới · 0 cập nhật · 2 giữ nguyên')

  // ORG-14: nhân viên đăng nhập bằng mật khẩu vừa tạo — mở mặc định ở tab Của tôi, thấy quản lý của mình
  const p = await pageAs(browser, { email: nv.email, password })
  await p.goto('/org')
  await expect(tab(p, 'Của tôi')).toHaveAttribute('aria-selected', 'true')
  await expect(p.getByTestId('my-manager')).toContainText(tp.name)
  await expect(tab(p, 'Nhập dữ liệu')).toHaveCount(0)                                 // không phải QT
  await tab(p, 'Sơ đồ').click()
  await unitRow(p, `Phòng Kinh doanh ${s}`).click()
  await expect(p.locator('.unit-people')).toContainText(tp.name)
  await expect(p.getByTestId('org-unit-more')).toHaveCount(0)                          // không phải QT: không có thao tác đơn vị

  // ORG-06: cấp vai trò Người duyệt cho trưởng phòng trong phạm vi phòng
  await tab(page, 'Vai trò chức năng').click()
  const grantForm = page.getByTestId('org-grant-form')
  const [tpUser] = await (await page.request.get(`/api/users?q=${encodeURIComponent(tp.email)}`)).json()
  await grantForm.getByRole('combobox', { name: 'Người', exact: true }).selectOption(tpUser.id)
  await grantForm.getByRole('combobox', { name: 'Vai trò', exact: true }).selectOption('reviewer')
  const units = await (await page.request.get('/api/org/units')).json()
  await grantForm.getByRole('combobox', { name: 'Đơn vị', exact: true }).selectOption(units.find((u) => u.code === div).id)
  await grantForm.getByRole('button', { name: 'Cấp vai trò' }).click()
  await expect(toast(page, `Đã cấp Người duyệt cho ${tp.name}`)).toBeVisible()
  await expect(page.getByTestId('org-grant-row').filter({ hasText: tp.name })).toContainText('Người duyệt')

  // ORG-08: trưởng phòng nghỉ việc (menu Thêm ▾ của hàng) -> vai trò + người dưới quyền chuyển cho quản lý của họ (admin)
  await tab(page, 'Sơ đồ').click()
  await unitRow(page, `Phòng Kinh doanh ${s}`).click()
  const tpRow = page.getByTestId('org-person-row').filter({ hasText: tp.email })
  await tpRow.getByTestId('org-person-more').click()
  await page.getByRole('menuitem', { name: 'Nghỉ việc…' }).click()
  const drawer = page.getByTestId('org-person-drawer')                                 // kết quả hiện trong hồ sơ ?person=
  await expect(page).toHaveURL(/[?&]person=/)
  const result = drawer.locator('.offboard-result')
  await expect(result).toContainText(`Người nhận bàn giao: ${ADMIN.name}`)
  await expect(result).toContainText('Người duyệt')
  await expect(result).toContainText(nv.name)
  await drawer.getByTestId('org-person-drawer-close').click()
  await expect(page).not.toHaveURL(/[?&]person=/)
  await expect(tpRow).toContainText('Đã nghỉ')

  await p.goto('/org')                                                                  // mặc định lại tab Của tôi
  await expect(p.getByTestId('my-manager')).toContainText(ADMIN.name)
  await p.context().close()
})

test('QT sửa hồ sơ tổ chức: chặn vòng quản lý', async ({ page }) => {
  const s = uid()
  const mk = async (name) => (await (await page.request.post('/api/users', { data: { name, email: `${name}.${s}@e2e.test`, password: 'mat-khau-e2e' } })).json())
  const a = await mk('sep')
  const b = await mk('nv')
  let r = await page.request.patch(`/api/org/users/${b.id}`, { data: { manager_id: a.id } })
  expect(r.ok()).toBeTruthy()
  r = await page.request.patch(`/api/org/users/${a.id}`, { data: { manager_id: b.id } })
  expect(r.status()).toBe(400)
  expect((await r.json()).detail).toContain('vòng quản lý')
})

test('QT xếp cấp bậc + kiêm nhiệm qua hồ sơ (Drawer), nhập Excel có cột Cấp bậc, sửa bảng cấp bậc → bậc nội dung (ORG-05 phần dữ liệu)', async ({ page, browser }) => {
  const s = uid().toUpperCase()
  const code = `LV${s}`
  const unit = await (await page.request.post('/api/org/units', { data: { code, name: `Phòng ${s}`, kind: 'group' } })).json()
  const unit2 = await (await page.request.post('/api/org/units', { data: { code: `${code}-B`, name: `Nhóm phụ ${s}`, kind: 'group' } })).json()
  const mk = async (name) => (await (await page.request.post('/api/users', { data: { name: `${name} ${s}`, email: `${name}.${s.toLowerCase()}@e2e.test`, password: 'mat-khau-e2e' } })).json())
  const nv = await mk('nvlv')
  await page.request.patch(`/api/org/users/${nv.id}`, { data: { unit_ids: [unit.id] } })

  // Mở thẳng đơn vị bằng URL (?unit=), sửa hồ sơ trong Drawer: cấp bậc + đơn vị kiêm nhiệm (checkbox có nhãn)
  await page.goto(`/org?unit=${unit.id}`)
  await expect(page.getByTestId('org-unit-panel').getByRole('heading', { name: `Phòng ${s}` })).toBeVisible()
  const row = page.getByTestId('org-person-row').filter({ hasText: nv.email })
  await row.getByRole('button', { name: `Sửa hồ sơ: nvlv ${s}` }).click()
  await expect(page).toHaveURL(/[?&]edit=1/)
  await expect(page).toHaveURL(new RegExp(`[?&]person=${nv.id}`))
  const drawer = page.getByTestId('org-person-drawer')
  await drawer.getByRole('combobox', { name: 'Cấp bậc' }).selectOption('3')
  await drawer.getByRole('group', { name: 'Đơn vị kiêm nhiệm' }).getByRole('checkbox', { name: new RegExp(`Nhóm phụ ${s}`) }).check()
  await drawer.getByRole('button', { name: 'Lưu hồ sơ' }).click()
  await expect(toast(page, `Đã lưu hồ sơ của nvlv ${s}`)).toBeVisible()
  await expect(drawer.getByTestId('org-profile-level')).toContainText('cấp 3 · Key staff')
  await expect(drawer.getByTestId('org-profile')).toContainText(`Nhóm phụ ${s}`)
  const [saved] = await (await page.request.get(`/api/users?q=${encodeURIComponent(nv.email)}`)).json()
  expect(saved.org.unit_ids).toEqual([unit.id, unit2.id])
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(row).toContainText('cấp 3 · Key staff')

  // Nhập Excel: cấp bậc ngoài 1–7 báo lỗi ở xem trước
  await tab(page, 'Nhập dữ liệu').click()
  const head = 'Email,Họ tên,Mã đơn vị,Chức năng,Email quản lý,Email quản lý chuyên môn,Chức danh,Cấp bậc\n'
  await page.getByLabel('File Excel / CSV').setInputFiles(csvFile(`${head}${nv.email},,${code},,,,,9\n`))
  await page.getByRole('button', { name: 'Xem trước' }).click()
  await expect(page.locator('.import-preview')).toContainText('phải là số 1–7')
  await page.getByLabel('File Excel / CSV').setInputFiles(csvFile(`${head}${nv.email},,${code},,,,,5\n`))
  await page.getByRole('button', { name: 'Xem trước' }).click()
  await page.getByRole('button', { name: 'Xác nhận nhập' }).click()
  await expect(page.locator('.import-done')).toContainText('1 cập nhật')

  // Nhân viên thấy cấp bậc của mình
  const p = await pageAs(browser, { email: nv.email, password: 'mat-khau-e2e' })
  await p.goto('/org')
  await expect(p.getByTestId('my-level')).toContainText('5 · Trưởng phòng')
  await expect(tab(p, 'Cấp bậc')).toHaveCount(0)                                        // tab chỉ cho QT
  await p.goto('/org?tab=levels')                                                        // gõ thẳng URL cũng không mở được
  await expect(tab(p, 'Của tôi')).toHaveAttribute('aria-selected', 'true')
  await p.context().close()

  // Bảng cấp bậc → bậc nội dung: mặc định theo Phân loại v2 mục 11, sửa và lưu được
  await tab(page, 'Cấp bậc').click()
  const box = page.getByRole('checkbox', { name: 'Cấp 2 own Nhập môn' })
  await expect(page.getByRole('checkbox', { name: 'Cấp 2 own Thực thi' })).toBeChecked()
  const was = await box.isChecked()
  await box.setChecked(!was)
  await page.getByRole('button', { name: 'Lưu bảng' }).click()
  await expect(toast(page, 'Đã lưu bảng cấp bậc')).toBeVisible()
  const map = await (await page.request.get('/api/org/level-map')).json()
  expect(map.levels['2'].own.includes('nhap-mon')).toBe(!was)
  await box.setChecked(was)                                                            // trả lại như cũ
  await page.getByRole('button', { name: 'Lưu bảng' }).click()
})
