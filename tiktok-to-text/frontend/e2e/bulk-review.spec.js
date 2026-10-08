// Duyệt hàng loạt thẻ nháp trên /wiki/review (yêu cầu …d817e mục B — backend/app/kb/bulk_review.py).
// Người trong kho lọc theo nhánh + bậc → thẻ tag xem-lai-phan-loai bị loại mặc định → chọn nhiều → Duyệt → mỗi thẻ có bản 1.
import AxeBuilder from '@axe-core/playwright'
import { test, expect, uid, createUser, pageAs } from './fixtures'

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

test('lọc theo nhánh + bậc, loại thẻ độ tin cậy thấp, duyệt nhiều thẻ một lần', async ({ page, browser }) => {
  test.setTimeout(90_000)
  const s = uid()
  const pw = 'mat-khau-e2e'
  const mk = async (key) => {
    const u = { name: `${key} ${s}`, email: `${key}.${s}@e2e.test`, password: pw }
    return { ...u, id: (await createUser(page, u)).id }
  }
  await page.goto('/')
  const author = await mk('tac-gia')
  const editor = await mk('bien-tap')
  const root = await ok(await page.request.post('/api/categories', { data: { name: `Bán hàng ${s}`, slug: `bh${s}` } }))
  const leaf = await ok(await page.request.post('/api/categories', { data: { name: `Chốt đơn ${s}`, slug: `bh${s}.chot`, parent_id: root.id } }))
  await ok(await page.request.put('/api/wiki/review-settings', { data: { min_approvers: 1 } }))

  try {
    const a = await pageAs(browser, author)
    const space = await ok(await a.request.post('/api/spaces', { data: { name: `Kho KD ${s}` } }))
    await ok(await a.request.post(`/api/spaces/${space.id}/members`, { data: { email: editor.email, role: 'editor' } }))
    const mkCard = async (title, extra = {}) => ok(await a.request.post('/api/wiki/cards', {
      data: { space_id: space.id, type: 'concept', title, summary: 'Tóm tắt', body: 'Nội dung', categories: [leaf.slug], level: 'nhap-mon', ...extra },
    }))
    const c1 = await mkCard(`Chào hàng ${s}`)
    const c2 = await mkCard(`Hỏi nhu cầu ${s}`)
    await mkCard(`Tin cậy thấp ${s}`, { tags: ['xem-lai-phan-loai'] })
    await mkCard(`Điều hành ${s}`, { level: 'dieu-hanh' })

    const e = await pageAs(browser, editor)
    await e.goto('/wiki/review')
    await e.getByRole('tab', { name: 'Duyệt hàng loạt' }).click()
    await e.getByLabel('Nhánh (gồm nhánh con)').selectOption(root.slug)
    await e.getByLabel('Bậc').selectOption('nhap-mon,thuc-thi')
    await e.getByRole('button', { name: 'Duyệt cả thẻ chưa có kết quả cổng so sánh' }).click()
    // không còn nút "Xem danh sách": đổi lọc là tự tải, bộ lọc nằm trên URL (dán link là thấy đúng danh sách)
    await expect(e.getByRole('button', { name: 'Xem danh sách' })).toHaveCount(0)
    await expect(e).toHaveURL(new RegExp(`cat=${root.slug}.*pending=1|pending=1.*cat=${root.slug}`))
    await expect(e.getByTestId('bulk-review-summary')).toContainText('Đã loại 1 thẻ độ tin cậy phân loại thấp')
    await expect(e.getByText('xem-lai-phan-loai')).toHaveCount(0)                  // không hiện slug thô
    await expect(e.getByLabel(`Chọn Chào hàng ${s}`)).toBeChecked()
    await expect(e.getByLabel(`Chọn Hỏi nhu cầu ${s}`)).toBeChecked()
    await expect(e.getByText(`Điều hành ${s}`)).toHaveCount(0)
    // tiêu đề thẻ là link thật (mở tab mới được) tới đề xuất / thẻ
    await expect(e.getByTestId('bulk-review-table').getByRole('link', { name: `Chào hàng ${s}` }))
      .toHaveAttribute('href', new RegExp(`/wiki/review\\?tab=all&change=|/wiki\\?card=${c1.id}`))
    await e.reload()                                                               // tải lại vẫn đúng bộ lọc
    await expect(e.getByLabel(`Chọn Chào hàng ${s}`)).toBeChecked()
    await expect(e.getByTestId('bulk-review-table-bulk')).toContainText('Đã chọn 2')
    const axe = await new AxeBuilder({ page: e }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(axe.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => v.id)).toEqual([])

    await e.getByRole('button', { name: 'Duyệt 2 thẻ' }).click()
    await expect(e.getByTestId('toast').filter({ hasText: 'Đã duyệt 2 thẻ' })).toBeVisible()

    for (const c of [c1, c2]) {
      const card = await ok(await e.request.get(`/api/wiki/cards/${c.id}`))
      expect(card.status).toBe('approved')
      expect(card.current_revision).toBe(1)
    }
    // tác giả không duyệt hàng loạt thẻ của mình (bốn mắt)
    const p = await ok(await a.request.post('/api/wiki/bulk-review/preview', { data: { category: root.slug, include_low_confidence: true, include_pending_novelty: true } }))
    expect(p.items.every((i) => i.skip === 'Bạn là tác giả (bốn mắt)')).toBeTruthy()
  } finally {
    await page.request.put('/api/wiki/review-settings', { data: { min_approvers: 2 } })
  }
})

test('link lọc sẵn ?ids=: đổi link ngay trong trang thì danh sách đổi theo, thẻ độ tin cậy thấp không bị ẩn', async ({ page, browser }) => {
  const s = uid()
  const pw = 'mat-khau-e2e'
  const mk = async (key) => {
    const u = { name: `${key} ${s}`, email: `${key}.${s}@e2e.test`, password: pw }
    return { ...u, id: (await createUser(page, u)).id }
  }
  await page.goto('/')
  const author = await mk('tac-gia-ids')
  const editor = await mk('bien-tap-ids')
  const a = await pageAs(browser, author)
  const space = await ok(await a.request.post('/api/spaces', { data: { name: `Kho ids ${s}` } }))
  await ok(await a.request.post(`/api/spaces/${space.id}/members`, { data: { email: editor.email, role: 'editor' } }))
  const mkCard = async (title, extra = {}) => ok(await a.request.post('/api/wiki/cards', {
    data: { space_id: space.id, type: 'concept', title, summary: 'Tóm tắt', body: 'Nội dung', ...extra },
  }))
  const x1 = await mkCard(`Link một ${s}`)
  const y1 = await mkCard(`Link hai ${s}`, { tags: ['xem-lai-phan-loai'] })

  const e = await pageAs(browser, editor)
  await e.goto(`/wiki/review?tab=bulk&ids=${x1.id}`)
  await expect(e.getByLabel(`Chọn Link một ${s}`)).toBeChecked()
  // mở link thứ hai ngay trong trang (điều hướng trong app, không nạp lại)
  await e.evaluate((url) => { window.history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')) },
    `/wiki/review?tab=bulk&ids=${y1.id}`)
  await expect(e.getByLabel(`Chọn Link hai ${s}`)).toBeChecked()
  await expect(e.getByText(`Link một ${s}`)).toHaveCount(0)
})
