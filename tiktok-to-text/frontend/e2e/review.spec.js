// Hộp duyệt + luật duyệt 2 bước (GOV-02, 04…06 — docs/BA.md mục 16.3–16.4, 16.7; DESIGN SCR-09 TPL-A2).
// Luồng dùng thử: tạo thẻ → gửi duyệt → người trong kho duyệt bước 1 → chủ nhánh tầng 2 duyệt bước 2 → thẻ approved
// có bản 1; sửa thẻ đã duyệt → thành đề xuất → duyệt 2 bước → bản 2.
// TPL-A2: Duyệt / Từ chối hoãn gửi (8 giây; window.__e2eFast = 2 giây) để Hoàn tác được; mục rời danh sách, mục kế tự mở.
import AxeBuilder from '@axe-core/playwright'
import { test, expect, uid, createUser, pageAs } from './fixtures'

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

// axe: 0 lỗi critical / serious khi đang mở đề xuất (a11y.spec.js chỉ quét trang rỗng)
async function axeSerious(p) {
  const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  return r.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => `${v.id} (${v.nodes.length})`)
}

const isDecide = (r) => r.request().method() === 'POST' && /\/api\/wiki\/changes\/[^/]+\/decide$/.test(new URL(r.url()).pathname)
const fast = (p) => p.addInitScript(() => { window.__e2eFast = true })

// Bấm Duyệt trong khung chi tiết rồi chờ lượt gửi thật (sau thời gian hoãn)
async function approveAndSend(p, detail) {
  const res = p.waitForResponse(isDecide, { timeout: 15_000 })
  await detail.getByTestId('review-change-approve').click()
  const r = await res
  expect(r.ok(), await r.text()).toBeTruthy()
}

// Mở đề xuất của thẻ `title` trong danh sách, trả id đề xuất
async function openRow(p, title) {
  const link = p.getByTestId('review-list').getByRole('link', { name: title, exact: true })
  const id = await link.locator('xpath=ancestor::tr').getAttribute('data-id')
  await link.click()
  await expect(p).toHaveURL(new RegExp(`change=${id}`))
  return id
}

test('thẻ mới qua 2 bước duyệt thành bản 1; sửa thẻ đã duyệt thành đề xuất rồi thành bản 2', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const s = uid()
  const pw = 'mat-khau-e2e'
  const mk = async (key) => {
    const u = { name: `${key} ${s}`, email: `${key}.${s}@e2e.test`, password: pw }
    return { ...u, id: (await createUser(page, u)).id }
  }
  await page.goto('/')
  const author = await mk('tac-gia')
  const editor = await mk('bien-tap')
  const owner = await mk('chu-nhanh')

  // Cây lĩnh vực: cấp 1 › cấp 2 (chủ nhánh = owner) › cấp 3 — admin tạo
  const root = await ok(await page.request.post('/api/categories', { data: { name: `Bán hàng ${s}`, slug: `bh${s}` } }))
  const tier2 = await ok(await page.request.post('/api/categories', { data: { name: `B2B ${s}`, slug: `bh${s}.b2b`, parent_id: root.id, owner_id: owner.id } }))
  const leaf = await ok(await page.request.post('/api/categories', { data: { name: `Chốt đơn ${s}`, slug: `bh${s}.b2b.chot`, parent_id: tier2.id } }))

  // Tác giả: kho chung (biên tập viên được sửa) + thẻ nháp bậc vận hành
  const a = await pageAs(browser, author)
  const space = await ok(await a.request.post('/api/spaces', { data: { name: `Kho KD ${s}` } }))
  await ok(await a.request.post(`/api/spaces/${space.id}/members`, { data: { email: editor.email, role: 'editor' } }))
  const title = `Quy trình chốt đơn ${s}`
  const card = await ok(await a.request.post('/api/wiki/cards', {
    data: { space_id: space.id, type: 'sop', title, summary: 'Ba bước chốt đơn', body: 'Hỏi nhu cầu\nBáo giá\nChốt', categories: [leaf.slug], level: 'van-hanh' },
  }))

  // Gửi duyệt trên giao diện; tác giả không thấy nút duyệt
  await a.goto(`/wiki?card=${card.id}`)
  const drawer = a.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await drawer.getByRole('button', { name: 'Gửi duyệt' }).click()
  await expect(drawer.getByLabel('Trạng thái duyệt')).toContainText('Đang chờ duyệt: bước 1/2')
  await expect(drawer.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0)

  // Bước 1: biên tập viên duyệt trong Hộp duyệt — cấu hình số người duyệt không còn ở đầu trang (chuyển sang /admin)
  const e = await pageAs(browser, editor)
  await fast(e)
  await e.goto('/')
  await e.locator('.sidebar nav').getByRole('link', { name: 'Hộp duyệt' }).click()
  await expect(e.getByLabel('Số người duyệt tối thiểu')).toHaveCount(0)
  const createId = await openRow(e, title)
  const detail = e.getByTestId('review-detail')
  await expect(detail.getByRole('heading', { level: 2 })).toHaveText(`Đề xuất: ${title}`)
  await expect(detail).toContainText('Chủ nhánh tầng 2')
  await expect(detail).toContainText(owner.name)
  await expect(detail.getByRole('region', { name: 'Cổng so sánh' })).toBeVisible()
  await approveAndSend(e, detail)
  await expect(e.getByTestId('review-list').getByRole('link', { name: title, exact: true })).toHaveCount(0)
  await e.goto(`/wiki/review?tab=all&change=${createId}`)
  await expect(detail).toContainText('Bước 2/2')
  await expect(detail.getByTestId('review-change-approve')).toHaveCount(0)   // người bước 1 không làm bước 2

  // Bước 2: chủ nhánh (không là thành viên kho) vẫn thấy trong hộp duyệt
  const o = await pageAs(browser, owner)
  await fast(o)
  await o.goto('/wiki/review')
  await openRow(o, title)
  const od = o.getByTestId('review-detail')
  await approveAndSend(o, od)
  await o.goto(`/wiki/review?tab=all&change=${createId}`)
  await expect(od).toContainText('Đã thành bản 1 của thẻ')

  // Tác giả: thẻ đã duyệt, có bản 1
  await a.reload()
  await expect(drawer.getByTestId('card-status')).toHaveText('Đã duyệt')
  await expect(drawer.getByText('Bản 1', { exact: true })).toBeVisible()

  // Sửa thẻ đã duyệt → đề xuất (thẻ giữ nguyên tới khi duyệt)
  await drawer.getByRole('button', { name: 'Đề xuất sửa' }).click()
  await drawer.getByLabel('Tiêu đề').fill(`${title} (v2)`)
  const box = drawer.getByRole('group', { name: 'Đề xuất thay đổi' })   // form trong trang thay window.prompt
  await box.getByLabel('Tóm tắt thay đổi').fill('Đổi tên quy trình')
  await box.getByLabel('Mức thay đổi').selectOption('major')
  await drawer.getByRole('button', { name: 'Gửi đề xuất' }).click()
  await expect(drawer.getByLabel('Trạng thái duyệt')).toContainText('Thẻ đã duyệt không sửa trực tiếp')
  await expect(drawer.getByLabel('Trạng thái duyệt')).toContainText('Đề xuất «Đổi tên quy trình»')
  await expect(drawer.getByRole('heading', { name: `Thẻ VCWIKI: ${title}`, exact: true })).toBeVisible()

  // Duyệt 2 bước; hộp duyệt hiện so sánh hai cột Bản hiện tại / Bản đề xuất
  await e.goto('/wiki/review')
  const updId = await openRow(e, title)
  await expect(detail).toContainText('Đổi tên quy trình')
  const diff = detail.getByRole('region', { name: 'So sánh thay đổi' })
  await expect(diff.getByRole('group', { name: 'Bản đề xuất' }).locator('ins', { hasText: `${title} (v2)` })).toBeVisible()
  await expect(diff.getByRole('group', { name: /^Bản hiện tại/ }).locator('del', { hasText: title })).toBeVisible()
  await expect(detail.getByLabel('Mức thay đổi')).toHaveValue('major')           // mức người đề xuất chọn
  await detail.getByLabel('Mức thay đổi').selectOption('minor')
  await approveAndSend(e, detail)
  await e.goto(`/wiki/review?tab=all&change=${updId}`)
  await expect(detail).toContainText('Bước 2/2')
  await o.goto('/wiki/review')
  await openRow(o, title)
  // chủ nhánh ngoài kho: không có link mở thẻ (mở ra sẽ "Không tìm thấy thẻ"), nội dung đầy đủ nằm trong đề xuất
  await expect(od.getByTestId('review-open-card')).toHaveCount(0)
  await expect(od.getByText('không ở trong kho chứa thẻ')).toBeVisible()
  await expect(od.locator('.review-full')).toContainText('Hỏi nhu cầu')
  await approveAndSend(o, od)
  await o.goto(`/wiki/review?tab=all&change=${updId}`)
  await expect(od).toContainText('Đã thành bản 2 của thẻ')

  // Tác giả: thẻ mang nội dung mới, lịch sử có bản 2 với lý do là tóm tắt đề xuất
  await a.reload()
  await expect(drawer.getByRole('heading', { name: `${title} (v2)` })).toBeVisible()
  await drawer.getByRole('tab', { name: 'Lịch sử' }).click()
  const rows = drawer.locator('.revision-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Đổi tên quy trình')
  await expect(rows.nth(0)).toContainText(`Duyệt: ${editor.name}, ${owner.name}`)

  for (const p of [a, e, o]) await p.context().close()
})

test('hộp duyệt màn 400px: khung chi tiết là Drawer, không tràn ngang; đề xuất chỉ đổi tag mang nhãn "Đổi phân loại"', async ({ page, browser }) => {
  const s = uid()
  const pw = 'mat-khau-e2e'
  await page.goto('/')
  const author = { name: `tac-gia ${s}`, email: `tg.${s}@e2e.test`, password: pw }
  const editor = { name: `bien-tap ${s}`, email: `bt.${s}@e2e.test`, password: pw }
  author.id = (await createUser(page, author)).id
  editor.id = (await createUser(page, editor)).id
  await ok(await page.request.put('/api/wiki/review-settings', { data: { min_approvers: 1 } }))
  try {
    const a = await pageAs(browser, author)
    const space = await ok(await a.request.post('/api/spaces', { data: { name: `Kho hẹp ${s}` } }))
    await ok(await a.request.post(`/api/spaces/${space.id}/members`, { data: { email: editor.email, role: 'editor' } }))
    const title = `Thẻ đổi tag ${s}`
    const card = await ok(await a.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'lesson', title, body: 'Một dòng nội dung khá dài '.repeat(20) } }))
    const e = await pageAs(browser, editor)
    // tác giả gửi duyệt, biên tập viên duyệt (min = 1) → thẻ approved; tác giả đề xuất chỉ đổi tag
    await ok(await a.request.patch(`/api/wiki/cards/${card.id}`, { data: { status: 'approved' } }))
    const ch = await ok(await e.request.get('/api/wiki/changes', { params: { inbox: 1 } }))
    const mine = ch.items.find((x) => x.card?.id === card.id)
    await ok(await e.request.post(`/api/wiki/changes/${mine.id}/decide`, { data: { decision: 'approve' } }))
    const res = await ok(await a.request.patch(`/api/wiki/cards/${card.id}`, { data: { tags: ['mot-tag-moi'], change_summary: `Chỉ đổi tag ${s}` } }))
    expect(res.change.kind_label).toBe('Đổi phân loại')

    await e.setViewportSize({ width: 400, height: 800 })
    await e.goto('/wiki/review')
    const row = e.getByTestId('review-list').locator('tr', { hasText: `Chỉ đổi tag ${s}` })
    await expect(row).toContainText('Đổi phân loại')
    await expect(e).not.toHaveURL(/change=/)                                    // màn hẹp: không tự mở mục đầu
    await row.getByRole('link', { name: title }).click()
    const detail = e.getByRole('dialog', { name: `Đề xuất: ${title}` })
    await expect(detail).toBeVisible()
    await expect(detail.getByTestId('review-change-approve')).toBeVisible()
    expect(await axeSerious(e)).toEqual([])
    const widths = await e.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: window.innerWidth }))
    expect(widths.doc).toBeLessThanOrEqual(widths.view)
    const box = await detail.boundingBox()
    expect(box.width).toBeGreaterThan(300)                                      // chi tiết chiếm cả bề ngang
    await e.keyboard.press('Escape')                                            // Esc đóng Drawer, bỏ ?change=
    await expect(detail).toHaveCount(0)
    await expect(e).not.toHaveURL(/change=/)
    await e.context().close()
    await a.context().close()
  } finally {
    await page.request.put('/api/wiki/review-settings', { data: { min_approvers: 2 } })
  }
})

test('duyệt xong tự mở mục kế; Hoàn tác không gọi API; hết giờ hoãn thì gửi thật; Từ chối bắt buộc lý do; đổi tab gửi ngay', async ({ page, browser }) => {
  test.setTimeout(90_000)
  const s = uid()
  const pw = 'mat-khau-e2e'
  await page.goto('/')
  const author = { name: `tg-hoan ${s}`, email: `tgh.${s}@e2e.test`, password: pw }
  const editor = { name: `bt-hoan ${s}`, email: `bth.${s}@e2e.test`, password: pw }
  author.id = (await createUser(page, author)).id
  editor.id = (await createUser(page, editor)).id
  const a = await pageAs(browser, author)
  const space = await ok(await a.request.post('/api/spaces', { data: { name: `Kho hoàn tác ${s}` } }))
  await ok(await a.request.post(`/api/spaces/${space.id}/members`, { data: { email: editor.email, role: 'editor' } }))
  const bodies = ['Kiểm tra áp suất lốp mỗi sáng', 'Cách đọc mã lỗi động cơ bằng máy OBD', 'Quy trình nhận xe và ghi phiếu dịch vụ']
  for (const [i, body] of bodies.entries()) {
    const c = await ok(await a.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'lesson', title: `Hoàn tác ${i + 1} ${s}`, body } }))
    await ok(await a.request.patch(`/api/wiki/cards/${c.id}`, { data: { status: 'approved' } }))   // gửi duyệt
  }

  const e = await pageAs(browser, editor)
  await fast(e)
  let calls = 0
  e.on('request', (r) => { if (r.method() === 'POST' && /\/decide$/.test(r.url())) calls++ })
  await e.goto('/wiki/review?filtered=1')
  const rows = e.getByTestId('review-list').locator('tbody tr[data-id]')
  await expect(rows).toHaveCount(3)
  const ids = await rows.evaluateAll((els) => els.map((x) => x.dataset.id))
  const names = await rows.locator('th').allInnerTexts()
  // màn rộng: tự mở mục đầu, hàng đang mở aria-current
  await expect(e).toHaveURL(new RegExp(`change=${ids[0]}`))
  await expect(rows.first()).toHaveAttribute('aria-current', 'true')
  await expect(e.getByRole('tab', { name: /Chờ tôi duyệt/ })).toContainText('3')
  const detail = e.getByTestId('review-detail')
  await expect(detail.getByRole('heading', { level: 2 })).toHaveText(`Đề xuất: ${names[0]}`)
  expect(await axeSerious(e)).toEqual([])

  // Từ chối khi chưa có lý do: lỗi bằng chữ, aria-invalid, không gọi API
  await detail.getByTestId('review-change-reject').click()
  await expect(detail.getByTestId('review-comment-error')).toContainText('Từ chối cần ghi lý do')
  await expect(detail.getByTestId('review-comment')).toHaveAttribute('aria-invalid', 'true')

  // Duyệt: mục rời danh sách, mục kế mở, tiêu điểm vào tiêu đề khung chi tiết
  await detail.getByTestId('review-change-approve').click()
  await expect(rows).toHaveCount(2)
  await expect(e).toHaveURL(new RegExp(`change=${ids[1]}`))
  await expect(detail.getByRole('heading', { level: 2 })).toHaveText(`Đề xuất: ${names[1]}`)
  await expect(detail.getByRole('heading', { level: 2 })).toBeFocused()
  await expect(e.getByRole('tab', { name: /Chờ tôi duyệt/ })).toContainText('2')

  // Hoàn tác: mục quay lại và mở lại, không gọi API kể cả khi quá thời gian hoãn
  await e.getByTestId('toast').filter({ hasText: `Đã duyệt: ${names[0]}` }).getByTestId('toast-action').click()
  await expect(rows).toHaveCount(3)
  await expect(e).toHaveURL(new RegExp(`change=${ids[0]}`))
  await e.waitForTimeout(3000)
  expect(calls).toBe(0)
  const still = await ok(await e.request.get(`/api/wiki/changes/${ids[0]}`))
  expect(still.approvals.filter((x) => x.decision === 'approve')).toHaveLength(0)

  // Duyệt lại, để hết giờ: gửi thật, mục đã duyệt không quay lại
  await approveAndSend(e, detail)
  expect(calls).toBe(1)
  const done = await ok(await e.request.get(`/api/wiki/changes/${ids[0]}`))
  expect(done.approvals.some((x) => x.decision === 'approve')).toBeTruthy()
  await expect(rows).toHaveCount(2)

  // Không chế độ nhanh (hoãn 8 giây): đổi tab thì gửi ngay các quyết định còn hoãn
  const e2 = await pageAs(browser, editor)
  await e2.goto(`/wiki/review?filtered=1&change=${ids[1]}`)
  const d2 = e2.getByTestId('review-detail')
  await expect(d2.getByRole('heading', { level: 2 })).toHaveText(`Đề xuất: ${names[1]}`)
  await d2.getByTestId('review-comment').fill('Thiếu nguồn dẫn')
  await d2.getByTestId('review-change-reject').click()
  await expect(e2.getByTestId('toast').filter({ hasText: `Đã từ chối: ${names[1]}` })).toBeVisible()
  const sent = e2.waitForResponse(isDecide, { timeout: 4000 })
  await e2.getByRole('tab', { name: 'Gần đây' }).click()
  expect((await sent).ok()).toBeTruthy()
  const rej = await ok(await e2.request.get(`/api/wiki/changes/${ids[1]}`))
  expect(rej.status).toBe('rejected')

  for (const p of [a, e, e2]) await p.context().close()
})

// GOV-13 (DESIGN TK-04d): người duyệt Trả về (lý do bắt buộc, hoãn gửi như Duyệt / Từ chối) → đề xuất rời hộp duyệt,
// người đề xuất thấy dòng *Đề xuất cần sửa* ở Việc của tôi → tab Tôi đề xuất lọc Cần sửa → Sửa và gửi lại → về hộp
// người duyệt; lịch sử có lượt Trả về / Gửi lại.
test('trả về đề xuất: lý do bắt buộc, rời hộp duyệt; người đề xuất sửa và gửi lại', async ({ page, browser }) => {
  test.setTimeout(90_000)
  const s = uid()
  const pw = 'mat-khau-e2e'
  await page.goto('/')
  const author = { name: `tg-tra ${s}`, email: `tgt.${s}@e2e.test`, password: pw }
  const editor = { name: `bt-tra ${s}`, email: `btt.${s}@e2e.test`, password: pw }
  author.id = (await createUser(page, author)).id
  editor.id = (await createUser(page, editor)).id
  const a = await pageAs(browser, author)
  await fast(a)
  const space = await ok(await a.request.post('/api/spaces', { data: { name: `Kho trả về ${s}` } }))
  await ok(await a.request.post(`/api/spaces/${space.id}/members`, { data: { email: editor.email, role: 'editor' } }))
  const title = `Trả về ${s}`
  const card = await ok(await a.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'lesson', title, body: 'Kiểm tra dầu máy mỗi tuần' } }))
  const sub = await ok(await a.request.patch(`/api/wiki/cards/${card.id}`, { data: { status: 'approved' } }))   // gửi duyệt
  const e = await pageAs(browser, editor)
  await fast(e)
  await ok(await e.request.post(`/api/wiki/changes/${sub.change.id}/decide`, { data: { decision: 'approve' } }))
  const done = await ok(await page.request.post(`/api/wiki/changes/${sub.change.id}/decide`, { data: { decision: 'approve' } }))   // bước 2: quản trị viên
  expect(done.status).toBe('approved')
  // sửa thẻ đã duyệt → đề xuất sửa
  const upd = await ok(await a.request.patch(`/api/wiki/cards/${card.id}`, { data: { body: 'Kiểm tra dầu máy mỗi ngày', change_summary: 'Đổi chu kỳ' } }))
  const cid = upd.change.id

  // Người duyệt: Trả về khi chưa có lý do → lỗi chữ + aria-invalid; có lý do → mục rời danh sách, toast Hoàn tác
  await e.goto(`/wiki/review?filtered=1&change=${cid}`)
  const detail = e.getByTestId('review-detail')
  await expect(detail.getByRole('heading', { level: 2 })).toHaveText(`Đề xuất: ${title}`)
  await detail.getByTestId('review-change-return').click()
  await expect(detail.getByTestId('review-comment-error')).toContainText('Trả về cần ghi lý do')
  await expect(detail.getByTestId('review-comment')).toHaveAttribute('aria-invalid', 'true')
  await detail.getByTestId('review-comment').fill('Ghi rõ căn cứ đổi chu kỳ')
  const sent = e.waitForResponse(isDecide, { timeout: 15_000 })
  await detail.getByTestId('review-change-return').click()
  await expect(e.getByTestId('toast').filter({ hasText: `Đã trả về người đề xuất: ${title}` })).toBeVisible()
  await expect(e.getByTestId('review-list').locator(`tr[data-id="${cid}"]`)).toHaveCount(0)
  expect((await sent).ok()).toBeTruthy()
  const inbox = await ok(await e.request.get('/api/wiki/changes?inbox=1&page_size=300'))
  expect(inbox.items.map((x) => x.id)).not.toContain(cid)

  // Người đề xuất: Việc của tôi → Đề xuất cần sửa → tab Tôi đề xuất lọc Cần sửa
  await a.goto('/')
  const row = a.locator('[data-testid="home-task"][data-kind="returned"]')
  await expect(row).toHaveAttribute('data-count', '1')
  await row.getByRole('link').click()
  await expect(a).toHaveURL(/tab=mine/)
  await expect(a).toHaveURL(/status=returned/)
  const mine = a.getByTestId('review-list').locator('tbody tr[data-id]')
  await expect(mine).toHaveCount(1)
  await expect(mine.first()).toContainText('Cần sửa')
  await expect(mine.first().getByTestId('review-row-returned')).toContainText('Ghi rõ căn cứ đổi chu kỳ')
  const d = a.getByTestId('review-detail')
  await expect(d.getByTestId('review-returned-note')).toHaveText('Ghi rõ căn cứ đổi chu kỳ')
  await expect(d.getByTestId('review-change-approve')).toHaveCount(0)
  expect(await axeSerious(a)).toEqual([])

  // Sửa và gửi lại (form trong khung)
  await d.getByTestId('review-change-resubmit').click()
  const form = d.getByTestId('review-resubmit-form')
  await expect(form.getByTestId('review-resubmit-title')).toBeFocused()
  await form.getByTestId('review-resubmit-body').fill('Kiểm tra dầu máy mỗi ngày (theo khuyến cáo hãng, sổ bảo dưỡng trang 12)')
  await form.getByTestId('review-resubmit-note').fill('Đã thêm căn cứ')
  expect(await axeSerious(a)).toEqual([])
  const res = a.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith(`/api/wiki/changes/${cid}/resubmit`))
  await form.getByTestId('review-resubmit-send').click()
  expect((await res).ok()).toBeTruthy()
  await expect(a.getByTestId('toast').filter({ hasText: `Đã gửi lại đề xuất: ${title}` })).toBeVisible()
  await expect(d.getByTestId('review-resubmit-form')).toHaveCount(0)
  await expect(d.getByTestId('review-returned')).toHaveCount(0)
  await expect(d.locator('.rv-approvals li[data-decision="return"]')).toContainText('Trả về')
  await expect(d.locator('.rv-approvals li[data-decision="resubmit"]')).toContainText('Đã thêm căn cứ')

  // Về lại hộp người duyệt, nội dung mới
  const back = await ok(await e.request.get(`/api/wiki/changes/${cid}`))
  expect(back.returned ?? null).toBeNull()
  expect(back.after.body).toContain('sổ bảo dưỡng trang 12')
  const inbox2 = await ok(await e.request.get('/api/wiki/changes?inbox=1&page_size=300'))
  expect(inbox2.items.map((x) => x.id)).toContain(cid)

  for (const p of [a, e]) await p.context().close()
})
