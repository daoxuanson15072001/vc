// UI-1 (DESIGN V.9.1): bàn phím và URL của component dùng chung trên trang mẫu /dev/ui (chỉ có khi chạy dev).
// Bốn component khó theo WAI-ARIA APG: Modal / Drawer (bẫy Tab, Esc, trả tiêu điểm), ActionMenu (mũi tên, Home / End,
// gõ chữ, Esc, Tab), Tree (mũi tên, mở / đóng, chọn ghi URL), Tabs (mũi tên, Home / End, ?tab=).
import { test, expect, confirmDialog, manualConfirm } from './fixtures'

const focused = (page) => page.evaluate(() => {
  const el = document.activeElement
  return { name: el?.getAttribute('aria-label') || el?.textContent?.trim() || '', role: el?.getAttribute('role'), tag: el?.tagName, testid: el?.dataset?.testid }
})
const inDialog = (page, name) => page.evaluate((n) => {
  const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => x.querySelector('h2')?.textContent === n)
  return !!d && d.contains(document.activeElement)
}, name)

test.describe('Modal / Drawer', () => {
  test('Modal: tiêu điểm vào ô đầu, Tab xoay vòng trong khung, Esc đóng và trả tiêu điểm', async ({ page }) => {
    await page.goto('/dev/ui')
    const opener = page.getByTestId('uikit-open-modal')
    await opener.click()
    const dlg = page.getByRole('dialog', { name: 'Tạo lĩnh vực' })
    await expect(dlg).toBeVisible()
    await expect(dlg).toHaveAttribute('aria-modal', 'true')
    await expect(page.getByTestId('uikit-modal-name')).toBeFocused()
    // 4 phần tử: ô tên, Huỷ, Tạo lĩnh vực, Đóng (đầu khung) — Tab 6 lần vẫn ở trong khung
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await inDialog(page, 'Tạo lĩnh vực')).toBe(true)
    }
    // Shift+Tab từ phần tử đầu (nút Đóng) nhảy về phần tử cuối (Tạo lĩnh vực)
    await dlg.getByRole('button', { name: 'Đóng: Tạo lĩnh vực' }).focus()
    await page.keyboard.press('Shift+Tab')
    await expect(dlg.getByRole('button', { name: 'Tạo lĩnh vực', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
    await expect(opener).toBeFocused()
    // khoá cuộn nền được trả lại
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  })

  test('Drawer mở theo URL ?item=, Esc đóng, Quay lại mở lại, tiêu điểm về liên kết đã mở', async ({ page }) => {
    await page.goto('/dev/ui?item=src-2030')
    const dlg = page.getByRole('dialog', { name: 'Bảng giá phụ tùng Toyota tháng 9.pdf' })
    await expect(dlg).toBeVisible()
    await expect(dlg).toBeFocused()
    await expect(page).toHaveTitle(/Thư viện component · VC Content Engine/)
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
    await expect(page).not.toHaveURL(/item=/)
    // mở bằng URL, không có nút mở → tiêu điểm về vùng nội dung chính
    await expect(page.locator('#main')).toBeFocused()
    await page.goBack()
    await expect(dlg).toBeVisible()
    await page.getByTestId('uikit-drawer-close').click()
    await expect(dlg).toBeHidden()

    const link = page.getByRole('link', { name: 'Hướng dẫn thay má phanh Innova' })
    await link.click()
    await expect(page).toHaveURL(/item=src-2028/)
    const d2 = page.getByRole('dialog', { name: 'Hướng dẫn thay má phanh Innova' })
    await expect(d2).toBeVisible()
    await expect(page.locator('tr[data-id="src-2028"]')).toHaveAttribute('aria-current', 'true')
    await page.keyboard.press('Escape')
    await expect(link).toBeFocused()
  })

  test('Menu trong Drawer: Esc thứ nhất đóng menu, Esc thứ hai đóng Drawer', async ({ page }) => {
    await page.goto('/dev/ui?item=src-2031')
    const dlg = page.getByRole('dialog', { name: 'Cách kiểm tra lọc gió động cơ Vios 2019' })
    const btn = page.getByTestId('uikit-drawer-more')
    await btn.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('uikit-drawer-more-menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('uikit-drawer-more-menu')).toBeHidden()
    await expect(dlg).toBeVisible()
    await expect(btn).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
  })
})

test.describe('ActionMenu', () => {
  test('mở bằng Enter / ↑, mũi tên xoay vòng, Home / End, gõ chữ, Esc trả tiêu điểm, Tab đóng', async ({ page }) => {
    await page.goto('/dev/ui')
    const btn = page.getByRole('button', { name: 'Thêm hành động cho Thư viện component' })
    await expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
    await btn.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu', { name: 'Thêm hành động cho Thư viện component' })
    await expect(menu).toBeVisible()
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
    const item = (name) => menu.getByRole('menuitem', { name })
    await expect(item('Sao chép liên kết')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(item('Tải xuống')).toBeFocused()
    await page.keyboard.press('End')
    await expect(item('Xoá dữ liệu mẫu…')).toBeFocused()
    await page.keyboard.press('ArrowDown')              // xoay vòng về đầu
    await expect(item('Sao chép liên kết')).toBeFocused()
    await page.keyboard.press('ArrowUp')                // xoay vòng về cuối
    await expect(item('Xoá dữ liệu mẫu…')).toBeFocused()
    await page.keyboard.press('Home')
    await page.keyboard.press('l')                      // gõ chữ: "Làm mới"
    await expect(item('Làm mới')).toBeFocused()
    // mục nguy hiểm đứng cuối, sau đường ngăn
    await expect(menu.locator('[role="separator"] + [role="menuitem"]')).toHaveText('Xoá dữ liệu mẫu…')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(btn).toBeFocused()

    await page.keyboard.press('ArrowUp')                // ↑ trên nút: mở và vào mục cuối
    await expect(item('Xoá dữ liệu mẫu…')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(menu).toBeHidden()

    await btn.click()
    await item('Làm mới').click()
    await expect(page.getByTestId('uikit-log')).toHaveText('Đã làm mới')
  })

  test('mục nguy hiểm luôn hỏi lại; Huỷ thì không làm gì', async ({ page }) => {
    await page.goto('/dev/ui')
    await manualConfirm(page)
    await page.getByRole('button', { name: 'Thêm hành động cho Thư viện component' }).click()
    await page.getByTestId('uikit-danger').click()
    await expect(confirmDialog(page)).toContainText('Xoá dữ liệu mẫu?')
    await page.getByTestId('confirm-cancel').click()
    await expect(page.getByTestId('uikit-log')).toHaveText('Chưa có hành động nào')
    await page.getByRole('button', { name: 'Thêm hành động cho Thư viện component' }).click()
    await page.getByTestId('uikit-danger').click()
    await page.getByTestId('confirm-ok').click()
    await expect(page.getByTestId('uikit-log')).toHaveText('Đã xoá dữ liệu mẫu')
  })

  test('RowActions: nút mang tên đối tượng, phần còn lại trong Thêm ▾', async ({ page }) => {
    await page.goto('/dev/ui')
    const row = page.locator('tr[data-id="src-2029"]')
    await expect(row).toHaveAttribute('data-status', 'queued')
    await row.getByRole('button', { name: 'Tinh chế: Livestream garage Thủ Đức 28/09' }).click()
    await expect(page.getByTestId('uikit-log')).toHaveText('Tinh chế: Livestream garage Thủ Đức 28/09')
    await row.getByRole('button', { name: 'Thêm hành động cho Livestream garage Thủ Đức 28/09' }).click()
    await page.getByRole('menuitem', { name: 'Mở chi tiết' }).click()
    await expect(page).toHaveURL(/item=src-2029/)
  })
})

test.describe('Tree', () => {
  test('một điểm Tab, ↓ ↑ → ← Home End, Enter chọn và ghi ?node=, gõ chữ', async ({ page }) => {
    await page.goto('/dev/ui?tab=tree')
    const tree = page.getByRole('tree', { name: 'Lĩnh vực' })
    const node = (name) => tree.getByRole('treeitem', { name: new RegExp(`^${name}`) })
    // chỉ một treeitem trong thứ tự Tab
    await expect(tree.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1)
    await node('Phụ tùng ô tô').focus()
    await expect(node('Phụ tùng ô tô')).toHaveAttribute('aria-expanded', 'true')
    await expect(node('Phụ tùng ô tô')).toHaveAttribute('aria-level', '1')
    await page.keyboard.press('ArrowRight')              // đang mở → vào con đầu
    await expect(node('Hệ thống phanh')).toBeFocused()
    await expect(node('Hệ thống phanh')).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('ArrowRight')              // đang đóng → mở
    await expect(node('Hệ thống phanh')).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(node('Má phanh')).toBeFocused()
    await expect(node('Má phanh')).toHaveAttribute('aria-level', '3')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/node=ma-phanh/)
    await expect(node('Má phanh')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowDown')
    await expect(node('Đĩa phanh')).toBeFocused()
    await page.keyboard.press('ArrowLeft')               // lá → về cha
    await expect(node('Hệ thống phanh')).toBeFocused()
    await page.keyboard.press('ArrowLeft')               // đang mở → đóng
    await expect(node('Hệ thống phanh')).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('End')
    await expect(node('Marketing')).toBeFocused()
    await page.keyboard.press('Home')
    await expect(node('Phụ tùng ô tô')).toBeFocused()
    await page.keyboard.press('d')                       // gõ chữ: "Dịch vụ garage"
    await expect(node('Dịch vụ garage')).toBeFocused()
    await page.keyboard.press(' ')
    await expect(page).toHaveURL(/node=dich-vu/)
    // tên treeitem không gộp chữ của nhánh con
    await expect(node('Phụ tùng ô tô')).toHaveAccessibleName('Phụ tùng ô tô 412')
  })

  test('mở link có ?node= thì tự mở nhánh cha và đánh dấu nút', async ({ page }) => {
    await page.goto('/dev/ui?tab=tree&node=loc-gio')
    const tree = page.getByRole('tree', { name: 'Lĩnh vực' })
    await expect(tree.getByRole('treeitem', { name: /^Lọc gió, lọc dầu/ })).toHaveAttribute('aria-expanded', 'true')
    await expect(tree.getByRole('treeitem', { name: /^Lọc gió 30/ })).toHaveAttribute('aria-selected', 'true')
    await expect(tree.locator('[role="treeitem"][tabindex="0"]')).toHaveAttribute('data-node', 'loc-gio')
  })
})

test.describe('Tabs, Segmented, FilterBar, DataTable', () => {
  test('Tabs panel: ← → chọn theo tiêu điểm, Home / End, ghi ?tab= (tab đầu không ghi)', async ({ page }) => {
    await page.goto('/dev/ui')
    const list = page.getByRole('tablist', { name: 'Khu thư viện' })
    const tab = (name) => list.getByRole('tab', { name: new RegExp(`^${name}`) })
    await expect(tab('Bảng')).toHaveAttribute('aria-selected', 'true')
    await expect(list.locator('[role="tab"][tabindex="0"]')).toHaveCount(1)
    await tab('Bảng').focus()
    await page.keyboard.press('ArrowRight')
    await expect(tab('Cây')).toBeFocused()
    await expect(tab('Cây')).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/tab=tree/)
    await expect(page.getByRole('tabpanel', { name: 'Cây' })).toBeVisible()
    await page.keyboard.press('End')
    await expect(tab('Khác')).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')              // xoay vòng
    await expect(tab('Bảng')).toHaveAttribute('aria-selected', 'true')
    await expect(page).not.toHaveURL(/tab=/)
    await page.goBack()                                  // đổi tab ghi lịch sử (push)
    await expect(tab('Khác')).toHaveAttribute('aria-selected', 'true')
    // số đếm là chữ trong tên tab
    await expect(tab('Bảng')).toHaveAccessibleName('Bảng 4')
  })

  test('Segmented: mũi tên đổi chế độ xem và ghi ?view=', async ({ page }) => {
    await page.goto('/dev/ui?tab=misc')
    const group = page.getByRole('radiogroup', { name: 'Chế độ xem' })
    await group.getByRole('radio', { name: 'Lưới' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(group.getByRole('radio', { name: 'Lộ trình' })).toBeFocused()
    await expect(group.getByRole('radio', { name: 'Lộ trình' })).toHaveAttribute('aria-checked', 'true')
    await expect(page).toHaveURL(/view=path/)
  })

  test('FilterBar + DataTable: lọc ghi URL, đếm kết quả, chọn nhiều có nhãn', async ({ page }) => {
    await page.goto('/dev/ui')
    const form = page.getByRole('search', { name: 'Lọc nguồn' })
    await expect(form.getByRole('status')).toHaveText('4 nguồn')
    await form.getByRole('searchbox', { name: 'Tìm nguồn' }).fill('phanh')
    await expect(page).toHaveURL(/q=phanh/)
    await expect(form.getByRole('status')).toHaveText('1 nguồn')
    await form.getByRole('button', { name: 'Xoá lọc' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await form.getByRole('button', { name: 'TikTok' }).click()
    await expect(form.getByRole('button', { name: 'TikTok' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/tiktok=1/)
    await form.getByRole('button', { name: 'Xoá lọc' }).click()
    await form.getByLabel('Trạng thái:').selectOption('failed')
    await expect(page).toHaveURL(/status=failed/)
    await expect(page.locator('tbody tr[data-id]')).toHaveCount(1)
    await page.goto('/dev/ui')

    const table = page.getByRole('table', { name: 'Danh sách nguồn mẫu' })
    await expect(table.getByRole('columnheader', { name: 'Tên nguồn' })).toBeVisible()
    await table.getByRole('checkbox', { name: 'Chọn Hướng dẫn thay má phanh Innova' }).check()
    await expect(page.getByTestId('uikit-table-bulk')).toContainText('Đã chọn 1')
    await table.getByRole('checkbox', { name: 'Chọn tất cả trên trang' }).check()
    await expect(page.getByTestId('uikit-table-bulk')).toContainText('Đã chọn 4')
    await page.getByRole('button', { name: 'Bỏ chọn' }).click()
    await expect(page.getByTestId('uikit-table-bulk')).toBeHidden()
  })
})
