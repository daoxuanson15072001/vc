// VCWIKI — chế độ xem "Lộ trình" theo lĩnh vực (/wiki?category=…): thẻ xếp theo bậc Nhập môn → Điều hành,
// trong bậc theo bước quy trình → loại thẻ → ngày tạo; đánh số liên tục; nút chuyển Lộ trình / Lưới giữ trên URL.
// Dữ liệu dựng qua API bằng phiên admin trong một lĩnh vực riêng (tên duy nhất mỗi lượt chạy).
import { test, expect, uid, mongo } from './fixtures'

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

// Dựng: kho riêng + lĩnh vực gốc riêng + 9 thẻ. Trả về { slug, t } với t = tên thẻ theo khoá.
async function seed(page) {
  const s = uid()
  const space = await ok(await page.request.post('/api/spaces', { data: { name: `Kho lộ trình ${s}`, description: '', visibility: 'private' } }))
  const cat = await ok(await page.request.post('/api/categories', { data: { name: `Lộ trình E2E ${s}` } }))
  // [khoá, loại, bậc, bước quy trình, tiêu đề]
  const rows = [
    ['n_lesson_b', 'lesson', 'nhap-mon', ['qt.ban-hang-b2b.b'], `Chốt đơn bước hai ${s}`],
    ['n_hook_a', 'hook', 'nhap-mon', ['qt.ban-hang-b2b.a'], `Mở lời bước một ${s}`],
    ['n_framework', 'framework', 'nhap-mon', [], `Khung chào hàng ${s}`],
    ['n_concept', 'concept', 'nhap-mon', [], `Khái niệm khách hàng ${s}`],
    ['v_case', 'case_study', 'van-hanh', [], `Ca khách trả hàng ${s}`],
    ['v_regulation', 'regulation', 'van-hanh', [], `Quy định kho hàng ${s}`],
    ['d_insight_new', 'insight', 'dieu-hanh', [], `Nhận định mới ${s}`],
    ['d_insight_old', 'insight', 'dieu-hanh', [], `Nhận định cũ ${s}`],
    ['u_concept', 'concept', null, [], `Chưa xếp bậc ${s}`],
  ]
  const t = {}
  const ids = {}
  for (const [key, type, level, steps, title] of rows) {
    const card = await ok(await page.request.post('/api/wiki/cards', {
      data: { space_id: space.id, type, title, summary: 'Tóm tắt thẻ lộ trình', categories: [cat.slug],
        ...(level ? { level } : {}), process_steps: steps },
    }))
    t[key] = title
    ids[key] = card.id
  }
  // "Nhận định mới" được tạo trước nhưng đặt ngày tạo muộn hơn -> "Nhận định cũ" phải đứng trước (cũ nhất trước)
  mongo(`db.wiki_cards.updateOne({ _id: ObjectId('${ids.d_insight_new}') }, { $set: { created_at: new Date(Date.now() + 3600e3) } })`)
  return { slug: cat.slug, t, ids, s }
}

const items = (page) => page.locator('.timeline a.timeline-item')   // mục lộ trình là Link (SCR-06)
const stageHeads = (page) => page.locator('.timeline .timeline-stage .timeline-stage-head')
const toggle = (page, name) => page.getByRole('radiogroup', { name: 'Chế độ xem' }).getByRole('radio', { name, exact: true })   // Segmented
// Tiêu đề bậc "A · Nhập môn (4 thẻ)" — chữ cái có thể nằm trong huy hiệu riêng (không có dấu · trong text)
const head = (letter, name, n) => new RegExp(`^\\s*${letter}\\s*(·\\s*)?${name}\\s*\\(${n} thẻ\\)`)
const typeSelect = (page) => page.getByLabel('Loại thẻ:', { exact: true })

test('lộ trình theo lĩnh vực: nhóm theo bậc, thứ tự trong bậc, đánh số liên tục, mở thẻ', async ({ page }) => {
  const { slug, t, ids } = await seed(page)
  await page.goto(`/wiki?category=${slug}`)

  // Có lĩnh vực -> mặc định Lộ trình
  await expect(page.locator('.timeline')).toBeVisible()
  await expect(page.locator('.ui-card-grid')).toHaveCount(0)
  await expect(toggle(page, 'Lộ trình')).toHaveAttribute('aria-checked', 'true')
  await expect(toggle(page, 'Lưới')).toHaveAttribute('aria-checked', 'false')

  // Bậc thấp -> cao, bỏ bậc trống (Thực thi, Thiết kế), chữ cái liên tục; thẻ không bậc ở cuối
  await expect(stageHeads(page)).toHaveCount(4)
  await expect(stageHeads(page).nth(0)).toHaveText(head('A', 'Nhập môn', 4))
  await expect(stageHeads(page).nth(1)).toHaveText(head('B', 'Vận hành', 2))
  await expect(stageHeads(page).nth(2)).toHaveText(head('C', 'Điều hành', 2))
  await expect(stageHeads(page).nth(3)).toHaveText(/Chưa xếp bậc \(1 thẻ\)/)

  // Trong bậc: có bước quy trình trước (a trước b) -> theo loại (concept, framework, regulation, insight,
  // case_study, …) -> ngày tạo cũ trước
  const order = [t.n_hook_a, t.n_lesson_b, t.n_concept, t.n_framework, t.v_regulation, t.v_case,
    t.d_insight_old, t.d_insight_new, t.u_concept]
  await expect(items(page)).toHaveCount(order.length)
  for (let i = 0; i < order.length; i++) {
    const it = items(page).nth(i)
    await expect(it).toContainText(order[i])
    await expect(it.locator('.timeline-num')).toHaveText(String(i + 1))   // số liên tục qua các bậc
  }
  // Thẻ thuộc đúng nhóm bậc
  const stage = (name) => page.locator('.timeline-stage').filter({ has: page.locator('.timeline-stage-head', { hasText: name }) })
  await expect(stage('Vận hành').locator('a.timeline-item')).toHaveCount(2)
  await expect(stage('Chưa xếp bậc').locator('a.timeline-item')).toContainText(t.u_concept)

  // Bấm mục -> mở ngăn thẻ như ở lưới
  await items(page).nth(4).click()
  await expect(page).toHaveURL(new RegExp(`card=${ids.v_regulation}`))
  const drawer = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await expect(drawer.getByRole('heading', { name: t.v_regulation })).toBeVisible()
  await drawer.getByRole('button', { name: 'Đóng' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(page.locator('.timeline')).toBeVisible()
})

test('chuyển Lộ trình / Lưới: mặc định theo có lĩnh vực hay không, ?view= ghi đè, giữ sau khi tải lại', async ({ page }) => {
  const { slug, t } = await seed(page)

  // Không có lĩnh vực -> mặc định Lưới
  await page.goto('/wiki')
  await expect(page.locator('.ui-card-grid')).toBeVisible()
  await expect(page.locator('.timeline')).toHaveCount(0)
  await expect(toggle(page, 'Lưới')).toHaveAttribute('aria-checked', 'true')
  await expect(toggle(page, 'Lộ trình')).toHaveAttribute('aria-checked', 'false')

  // ?view= ghi đè mặc định ở cả hai phía
  await page.goto('/wiki?view=timeline')
  await expect(page.locator('.timeline')).toBeVisible()
  await expect(page.locator('.ui-card-grid')).toHaveCount(0)
  await page.goto(`/wiki?category=${slug}&view=grid`)
  await expect(page.locator('.ui-card-grid')).toBeVisible()
  await expect(page.locator('.timeline')).toHaveCount(0)
  await expect(page.getByTestId('wiki-card').filter({ hasText: t.n_concept })).toBeVisible()

  // Bấm nút -> URL đổi view=, tải lại vẫn giữ
  await toggle(page, 'Lộ trình').click()
  await expect(page).toHaveURL(/[?&]view=timeline/)
  await expect(page.locator('.timeline')).toBeVisible()
  await expect(toggle(page, 'Lộ trình')).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  await expect(page.locator('.timeline')).toBeVisible()
  await expect(page.locator('.ui-card-grid')).toHaveCount(0)

  await toggle(page, 'Lưới').click()
  await expect(page).toHaveURL(/[?&]view=grid/)
  await expect(page.locator('.ui-card-grid')).toBeVisible()
  await page.reload()
  await expect(page.locator('.ui-card-grid')).toBeVisible()
  await expect(page.locator('.timeline')).toHaveCount(0)
  await expect(toggle(page, 'Lưới')).toHaveAttribute('aria-checked', 'true')
})

test('lộ trình vẫn áp bộ lọc loại thẻ và ô tìm; 375 px không cuộn ngang', async ({ page }) => {
  const { slug, t } = await seed(page)
  await page.goto(`/wiki?category=${slug}`)
  await expect(items(page)).toHaveCount(9)

  // Lọc loại "Khái niệm": còn 2 thẻ (Nhập môn + Chưa xếp bậc), đánh số lại 1..2
  await typeSelect(page).selectOption('concept')
  await expect(page).toHaveURL(/type=concept/)
  await expect(page.locator('.timeline')).toBeVisible()
  await expect(items(page)).toHaveCount(2)
  await expect(stageHeads(page)).toHaveCount(2)
  await expect(stageHeads(page).nth(0)).toHaveText(head('A', 'Nhập môn', 1))
  await expect(stageHeads(page).nth(1)).toHaveText(/Chưa xếp bậc \(1 thẻ\)/)
  await expect(items(page).nth(0)).toContainText(t.n_concept)
  await expect(items(page).nth(1)).toContainText(t.u_concept)
  await expect(items(page).nth(1).locator('.timeline-num')).toHaveText('2')
  await typeSelect(page).selectOption('')
  await expect(items(page)).toHaveCount(9)

  // Tìm không dấu: chỉ còn thẻ quy định, bậc Vận hành thành bậc A
  await page.getByPlaceholder(/Tìm trong thẻ/).fill(`quy dinh kho ${t.v_regulation.split(' ').pop()}`)
  await expect(items(page)).toHaveCount(1)
  await expect(items(page).first()).toContainText(t.v_regulation)
  await expect(items(page).first().locator('.timeline-num')).toHaveText('1')
  await expect(stageHeads(page)).toHaveCount(1)
  await expect(stageHeads(page).first()).toHaveText(head('A', 'Vận hành', 1))
  await page.getByPlaceholder(/Tìm trong thẻ/).fill('')
  await expect(items(page)).toHaveCount(9)

  // Điện thoại 375 px: không cuộn ngang
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(`/wiki?category=${slug}`)
  await expect(items(page)).toHaveCount(9)
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  expect(sw).toBeLessThanOrEqual(cw)
})
